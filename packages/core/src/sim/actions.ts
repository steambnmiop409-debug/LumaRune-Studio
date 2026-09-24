import { getCrop } from '../data/crops';
import { CAN_CAPACITY, FERTILIZER_EFFECT, getItem } from '../data/items';
import { SHOPS, TOOL_SHOP_STOCK, seedShopStock, type ShopId } from '../data/shops';
import { CART_CAPACITY, CRATE_CAPACITY } from '../economy/market';
import { isReady, newCrop, rollQuality, rollYield } from '../farming/growth';
import { addItem, canFit, countItem, removeItem, takeFromSlot } from '../inventory/inventory';
import type { Rng } from '../math/rng';
import type { GameEvent } from '../protocol/messages';
import type { PlayerState, WorldState } from '../state/types';
import { seasonOf, weekdayOf } from '../time/calendar';
import { TILE, isFreshWater } from '../world/tiles';
import type { InteractKind, WorldMap } from '../world/types';
import { canTill, newSoil, placedAt } from './world';
import { gift, npcAt, pickForage, talk } from './social';

/** Max distance (px) from the player's feet to a tile centre for tool use / interaction. */
export const REACH_PX = 30;

export const STAMINA_COST = { hoe: 2, can: 1, scythe: 1 } as const;

export interface SimContext {
  state: WorldState;
  map: WorldMap;
  rng: Rng;
  /** Send an event to one player, or to everyone. */
  emit(e: GameEvent, to: string | 'all'): void;
  /** Mark a soil tile as changed so it gets broadcast. */
  touchSoil(key: number): void;
  touchPlaced(): void;
  touchPlayer(id: string): void;
}

type Result = string | null;

function toast(ctx: SimContext, p: PlayerState, text: string, tone: 'info' | 'good' | 'warn' = 'warn') {
  ctx.emit({ t: 'toast', text, tone }, p.id);
}

export function inReach(p: PlayerState, tx: number, ty: number, reach = REACH_PX): boolean {
  const cx = tx * TILE + TILE / 2;
  const cy = ty * TILE + TILE / 2;
  return Math.hypot(cx - p.x, cy - (p.y - 4)) <= reach;
}

export function interactableAt(map: WorldMap, x: number, y: number): InteractKind | null {
  return map.interactables.find((i) => i.x === x && i.y === y)?.kind ?? null;
}

function spendStamina(p: PlayerState, n: number): boolean {
  if (p.stamina < n) return false;
  p.stamina -= n;
  return true;
}

function isWaterSource(map: WorldMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
  return isFreshWater(map.terrain[y * map.w + x]) || interactableAt(map, x, y) === 'well';
}

function refill(ctx: SimContext, p: PlayerState, slot: number, x: number, y: number): Result {
  const s = p.inv[slot]!;
  const cap = CAN_CAPACITY[getItem(s.id).tier ?? 1];
  if ((s.water ?? 0) >= cap) return '물뿌리개가 이미 가득 찼어요.';
  s.water = cap;
  ctx.emit({ t: 'fx', kind: 'refill', x, y, by: p.id }, 'all');
  ctx.touchPlayer(p.id);
  return null;
}

/** Uses the item in `slot` on tile (x, y). Returns an error message or null. */
export function useItem(ctx: SimContext, p: PlayerState, slot: number, x: number, y: number): Result {
  const { state, map } = ctx;
  const stack = p.inv[slot];
  if (!stack) return null;
  if (!inReach(p, x, y)) return null;
  if (p.carrying.length) return '상자를 들고 있어서 손을 쓸 수 없어요.';
  const def = getItem(stack.id);
  const key = y * map.w + x;
  const soil = state.soil[key];
  if (def.kind === 'produce' || def.kind === 'forage') {
    const npc = npcAt(map, state.clock.minute, x, y);
    if (npc) return gift(ctx, p, npc, slot);
  }

  switch (def.kind) {
    case 'tool': {
      if (def.tool === 'hoe') {
        if (soil?.crop?.dead) {
          if (!spendStamina(p, STAMINA_COST.hoe)) return '너무 지쳤어요. 오늘은 쉬어야 해요.';
          soil.crop = null;
          ctx.touchSoil(key);
          ctx.emit({ t: 'fx', kind: 'clear', x, y, by: p.id }, 'all');
          break;
        }
        if (soil) return soil.crop ? '작물이 자라고 있어요.' : null;
        if (!canTill(state, map, x, y)) return map.zone[key] === 1 ? null : '농장 밖에서는 땅을 갈 수 없어요.';
        if (!spendStamina(p, STAMINA_COST.hoe)) return '너무 지쳤어요. 오늘은 쉬어야 해요.';
        state.soil[key] = newSoil();
        ctx.touchSoil(key);
        ctx.emit({ t: 'fx', kind: 'till', x, y, by: p.id }, 'all');
        break;
      }
      if (def.tool === 'can') {
        if (isWaterSource(map, x, y)) return refill(ctx, p, slot, x, y);
        const tile = map.terrain[key];
        if (tile === 0 || tile === 1) return '바닷물은 작물에 줄 수 없어요. 강이나 우물을 찾아보세요.';
        if (!soil) return null;
        if ((stack.water ?? 0) <= 0) return '물뿌리개가 비었어요. 우물이나 강에서 채우세요.';
        if (!spendStamina(p, STAMINA_COST.can)) return '너무 지쳤어요. 오늘은 쉬어야 해요.';
        stack.water = (stack.water ?? 0) - 1;
        soil.moisture = 100;
        soil.dayMax = 100;
        ctx.touchSoil(key);
        ctx.emit({ t: 'fx', kind: 'water', x, y, by: p.id }, 'all');
        break;
      }
      if (def.tool === 'scythe') {
        if (!soil?.crop) return null;
        if (soil.crop.dead) {
          if (!spendStamina(p, STAMINA_COST.scythe)) return '너무 지쳤어요.';
          soil.crop = null;
          ctx.touchSoil(key);
          ctx.emit({ t: 'fx', kind: 'clear', x, y, by: p.id }, 'all');
          break;
        }
        if (isReady(soil.crop)) return harvest(ctx, p, x, y);
        return null;
      }
      return null;
    }
    case 'seed': {
      if (!soil) return '먼저 괭이로 땅을 갈아 주세요.';
      if (soil.crop) return '이미 작물이 심겨 있어요.';
      if (placedAt(state, x, y)) return '설치물이 있는 칸이에요.';
      soil.crop = newCrop(def.cropId!, state.clock.day);
      takeFromSlot(p.inv, slot, 1);
      ctx.touchSoil(key);
      ctx.emit({ t: 'fx', kind: 'plant', x, y, by: p.id }, 'all');
      break;
    }
    case 'fertilizer': {
      if (!soil) return '갈아 둔 밭에 뿌려야 해요.';
      if (soil.fert) return '이미 비료를 준 칸이에요.';
      if (soil.crop && soil.crop.growth > 0) return '비료는 심기 전이나 막 심었을 때 줘야 해요.';
      soil.fert = def.fertilizer!;
      if (FERTILIZER_EFFECT[soil.fert].quality > 0) soil.fertility = Math.min(100, soil.fertility + 10);
      takeFromSlot(p.inv, slot, 1);
      ctx.touchSoil(key);
      ctx.emit({ t: 'fx', kind: 'fert', x, y, by: p.id }, 'all');
      break;
    }
    case 'tonic': {
      const crop = soil?.crop;
      if (!crop || crop.dead) return '자라고 있는 작물에게만 줄 수 있어요.';
      if (crop.tonic >= 2) return '이 작물은 영양제를 충분히 받았어요.';
      crop.tonic++;
      crop.stress = Math.max(0, crop.stress - 1.5);
      takeFromSlot(p.inv, slot, 1);
      ctx.touchSoil(key);
      ctx.emit({ t: 'fx', kind: 'tonic', x, y, by: p.id }, 'all');
      break;
    }
    case 'placeable': {
      if (soil?.crop) return '작물이 있는 칸에는 설치할 수 없어요.';
      if (placedAt(state, x, y)) return '이미 설치물이 있어요.';
      if (!soil && !canTill(state, map, x, y)) return '농장 안에만 설치할 수 있어요.';
      if (soil) delete state.soil[key];
      state.placed.push({ id: state.nextId++, kind: def.placeable!, x, y });
      takeFromSlot(p.inv, slot, 1);
      ctx.touchSoil(key);
      ctx.touchPlaced();
      ctx.emit({ t: 'fx', kind: 'place', x, y, by: p.id }, 'all');
      break;
    }
    case 'produce':
    case 'forage':
    case 'crate':
      return '포장대에서 출하 상자에 담아 배로 옮겨 주세요.';
    default:
      return null;
  }
  ctx.touchPlayer(p.id);
  return null;
}

export function harvest(ctx: SimContext, p: PlayerState, x: number, y: number): Result {
  const { state, map, rng } = ctx;
  const key = y * map.w + x;
  const soil = state.soil[key];
  if (!soil?.crop || !isReady(soil.crop)) return null;
  const def = getCrop(soil.crop.id);
  const q = rollQuality(soil, rng);
  const qty = rollYield(def, q, rng);
  const itemId = `crop.${def.id}`;
  if (!canFit(p.inv, itemId, qty, q)) return '가방이 가득 찼어요.';
  addItem(p.inv, itemId, qty, q);
  soil.fertility = Math.max(20, soil.fertility - 4);
  if (def.regrowDays > 0) {
    soil.crop.growth = def.growDays - def.regrowDays;
    soil.crop.harvests++;
  } else {
    soil.crop = null;
    soil.fert = null;
  }
  if (!state.discovered.includes(def.id)) {
    state.discovered.push(def.id);
    ctx.emit({ t: 'toast', text: `도감에 새 작물이 기록됐어요: ${def.name}`, tone: 'good' }, p.id);
  }
  ctx.touchSoil(key);
  ctx.touchPlayer(p.id);
  ctx.emit({ t: 'harvest', x, y, cropId: def.id, q, qty, by: p.id }, 'all');
  return null;
}

export function shopIsOpen(state: WorldState, shop: ShopId): boolean {
  const def = SHOPS[shop];
  const m = state.clock.minute;
  return weekdayOf(state.clock.day) !== def.closedWeekday && m >= def.open && m < def.close;
}

export function shopStock(state: WorldState, shop: ShopId): string[] {
  return shop === 'seedShop' ? seedShopStock(seasonOf(state.clock.day), state.lifetimeEarnings) : [...TOOL_SHOP_STOCK];
}

/** Interaction (right click / E) on tile (x, y). */
export function interact(ctx: SimContext, p: PlayerState, x: number, y: number): Result {
  const { state, map } = ctx;
  if (!inReach(p, x, y, REACH_PX + 6)) return null;
  const npc = npcAt(map, state.clock.minute, x, y);
  if (npc) return talk(ctx, p, npc);
  if (state.forage[y * map.w + x]) return pickForage(ctx, p, x, y);
  const kind = interactableAt(map, x, y);
  if (kind) {
    switch (kind) {
      case 'seedShop':
      case 'toolShop': {
        const def = SHOPS[kind];
        if (!shopIsOpen(state, kind)) {
          const closedToday = weekdayOf(state.clock.day) === def.closedWeekday;
          return closedToday ? `${def.name}은(는) 오늘 쉬는 날이에요.` : `${def.name} 영업시간은 09:00~18:00이에요.`;
        }
        ctx.emit({ t: 'openShop', shop: kind, stock: shopStock(state, kind) }, p.id);
        return null;
      }
      case 'packing':
        if (p.carrying.length >= (p.cart ? CART_CAPACITY : 1)) return '이미 상자를 들고 있어요. 먼저 배에 실어 주세요.';
        ctx.emit({ t: 'openPacking' }, p.id);
        return null;
      case 'ship':
        return loadShip(ctx, p);
      case 'bed':
        ctx.emit({ t: 'sleepPrompt' }, p.id);
        return null;
      case 'board':
        ctx.emit({ t: 'openBoard' }, p.id);
        return null;
      case 'well': {
        const slot = p.inv.findIndex((s) => s && getItem(s.id).tool === 'can');
        if (slot < 0) return '물뿌리개가 없어요.';
        return refill(ctx, p, slot, x, y);
      }
    }
  }
  const soil = state.soil[y * map.w + x];
  if (soil?.crop && isReady(soil.crop)) return harvest(ctx, p, x, y);
  const placed = placedAt(state, x, y);
  if (placed) {
    const itemId = `place.${placed.kind}`;
    if (!canFit(p.inv, itemId, 1)) return '가방이 가득 찼어요.';
    state.placed = state.placed.filter((o) => o !== placed);
    addItem(p.inv, itemId, 1);
    ctx.touchPlaced();
    ctx.touchPlayer(p.id);
    ctx.emit({ t: 'fx', kind: 'pickup', x, y, by: p.id }, 'all');
    return null;
  }
  const held = p.inv[p.sel];
  if (held && getItem(held.id).tool === 'can' && isWaterSource(map, x, y)) return refill(ctx, p, p.sel, x, y);
  return null;
}

export function buy(ctx: SimContext, p: PlayerState, shop: ShopId, itemId: string, qty: number): Result {
  const { state } = ctx;
  if (!Number.isInteger(qty) || qty < 1 || qty > 999) return null;
  if (!shopIsOpen(state, shop)) return '가게가 문을 닫았어요.';
  const counter = ctx.map.interactables.find((i) => i.kind === shop);
  if (counter && !inReach(p, counter.x, counter.y, REACH_PX + 48)) return '가게 앞에서 살 수 있어요.';
  if (!shopStock(state, shop).includes(itemId)) return '지금은 팔지 않는 물건이에요.';
  const def = getItem(itemId);
  if (def.kind === 'upgrade' || def.kind === 'tool') qty = 1;
  const cost = def.price * qty;
  if (state.gold < cost) return `돈이 부족해요. (${cost.toLocaleString()}G 필요)`;
  if (itemId === 'upgrade.cart') {
    if (p.cart) return '이미 손수레가 있어요.';
    p.cart = true;
  } else {
    if (def.kind === 'tool' && countItem(p.inv, itemId) > 0) return '이미 가지고 있어요.';
    if (!canFit(p.inv, itemId, qty)) return '가방에 자리가 없어요.';
    addItem(p.inv, itemId, qty);
  }
  state.gold -= cost;
  ctx.touchPlayer(p.id);
  ctx.emit({ t: 'bought', item: itemId, qty, gold: cost }, p.id);
  return null;
}

export function nearPacking(map: WorldMap, p: PlayerState): boolean {
  return map.interactables.some((i) => i.kind === 'packing' && inReach(p, i.x, i.y, REACH_PX + 12));
}

/** Packs up to 30 produce of one kind & quality from `slot` into a crate the player then carries. */
export function pack(ctx: SimContext, p: PlayerState, slot: number, qty: number): Result {
  const s = p.inv[slot];
  const kind = s ? getItem(s.id).kind : null;
  if (!s || (kind !== 'produce' && kind !== 'forage')) return '작물이나 채집물만 상자에 담을 수 있어요.';
  if (!nearPacking(ctx.map, p)) return '포장대 앞에서 담아 주세요.';
  if (p.carrying.length >= (p.cart ? CART_CAPACITY : 1)) return '더 들 수 없어요. 먼저 배에 실어 주세요.';
  if (countItem(p.inv, 'crate') < 1) return '빈 출하 상자가 없어요. 등불 공방에서 살 수 있어요.';
  const n = Math.max(1, Math.min(qty | 0, CRATE_CAPACITY, s.qty));
  const cropId = kind === 'forage' ? s.id : getItem(s.id).cropId!;
  const q = s.q ?? 1;
  takeFromSlot(p.inv, slot, n);
  removeItem(p.inv, 'crate', 1);
  p.carrying.push({ cropId, q, qty: n });
  ctx.touchPlayer(p.id);
  return null;
}

export function loadShip(ctx: SimContext, p: PlayerState): Result {
  const { state } = ctx;
  if (!p.carrying.length) return state.ship.present ? '포장한 상자를 들고 오면 배에 실을 수 있어요.' : '배는 내일 아침 6시에 돌아와요.';
  if (!state.ship.present) return '배가 이미 떠났어요. 내일 아침 6시에 돌아와요.';
  const n = p.carrying.length;
  state.ship.cargo.push(...p.carrying);
  p.carrying = [];
  ctx.touchPlayer(p.id);
  ctx.emit({ t: 'shipLoaded', crates: n, by: p.id }, 'all');
  return null;
}
