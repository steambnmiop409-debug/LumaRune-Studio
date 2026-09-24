import { RECIPE_BY_ID } from '../data/crafting';
import { getCrop } from '../data/crops';
import { artisanId, getItem, type ArtisanType, type PlaceableKind } from '../data/items';
import { isReady, rollQuality, rollYield } from '../farming/growth';
import { addItem, canFit, countItem, removeItem, takeFromSlot } from '../inventory/inventory';
import type { Rng } from '../math/rng';
import type { ItemStack, NodeKind, PlacedObject, PlayerState, WorldState } from '../state/types';
import { seasonOf } from '../time/calendar';
import { Terrain } from '../world/tiles';
import type { WorldMap } from '../world/types';
import type { SimContext } from './actions';

export const CHEST_SLOTS = 18;
export const HARVESTER_SLOTS = 12;
/** Tiles around the auto-harvester it reaches (radius, so 5×5). */
export const HARVESTER_RADIUS = 2;
/** Bee houses look this far for flowers. */
export const BEE_RADIUS = 5;

export const MACHINE_NAME: Partial<Record<PlaceableKind, string>> = {
  chest: '저장 상자',
  compost: '퇴비통',
  furnace: '용광로',
  jar: '보존 항아리',
  keg: '술통',
  seedmaker: '씨앗 제조기',
  beehouse: '벌통',
  harvester: '자동 수확기',
};

/** Absolute game minute (monotonic across days). */
export const nowAbs = (state: WorldState) => state.clock.day * 1440 + state.clock.minute;

type Group = 'fruit' | 'veg' | 'herb' | 'flower' | 'other';

const FORAGE_GROUP: Record<string, Group> = {
  'forage.wildberry': 'fruit',
  'forage.apple': 'fruit',
  'forage.peach': 'fruit',
  'forage.pear': 'fruit',
  'forage.plum': 'fruit',
  'forage.chanterelle': 'veg',
  'forage.morel': 'veg',
  'forage.wildflower': 'flower',
};

/** Sweet fruiting vegetables that cook down like fruit. */
const SWEET = new Set(['strawberry', 'watermelon', 'chamoe', 'muskmelon', 'cantaloupe', 'cherrytomato']);

/** Plants whose blossoms bees visit (flowers, and herbs grown for their flowers). */
export function isBeeFlower(cropId: string): boolean {
  const c = getCrop(cropId);
  return c.category === 'flower' || c.form === 'flower' || c.shape === 'bloom';
}

/** Which family an input belongs to, for the jar and keg. */
export function sourceGroup(itemId: string): Group {
  if (itemId.startsWith('crop.')) {
    const c = getCrop(itemId.slice(5));
    if (c.category === 'fruit' || SWEET.has(c.id)) return 'fruit';
    if (isBeeFlower(c.id)) return 'flower';
    if (c.category === 'herb') return 'herb';
    if (c.category === 'flower') return 'flower';
    if (c.category === 'grain' || c.category === 'special') return 'other';
    return 'veg';
  }
  return FORAGE_GROUP[itemId] ?? 'other';
}

interface Batch {
  /** How many of the held item it takes. */
  need: number;
  /** Extra items consumed (e.g. coal). */
  extra?: [string, number];
  out: ItemStack[];
  minutes: number;
}

/** What a machine would make from the held stack, or why it can't. */
export function batchFor(kind: PlaceableKind, stack: ItemStack, rng: Rng): Batch | string {
  const id = stack.id;
  const def = getItem(id);
  switch (kind) {
    case 'compost':
      if (id === 'mat.fiber') return { need: 10, out: [{ id: 'fert.basic', qty: 3 }], minutes: 1440 };
      if (def.kind === 'produce' || def.kind === 'forage')
        return { need: 3, out: [{ id: 'fert.quality', qty: 1 }, { id: 'fert.basic', qty: 1 }], minutes: 1440 };
      return '섬유 10개나 작물 3개를 넣을 수 있어요.';
    case 'furnace':
      if (id === 'ore.copper') return { need: 5, extra: ['mat.coal', 1], out: [{ id: 'bar.copper', qty: 1 }], minutes: 120 };
      if (id === 'ore.iron') return { need: 5, extra: ['mat.coal', 1], out: [{ id: 'bar.iron', qty: 1 }], minutes: 240 };
      return '광석 5개와 석탄 1개를 넣어 주세요.';
    case 'jar':
    case 'keg': {
      if (def.kind !== 'produce' && def.kind !== 'forage') return kind === 'jar' ? '과일·채소·허브를 넣어 주세요.' : '과일이나 채소를 넣어 주세요.';
      const g = sourceGroup(id);
      let type: ArtisanType | null = null;
      let minutes = 2880;
      if (kind === 'jar') {
        if (g === 'fruit') type = 'jam';
        else if (g === 'veg') type = 'pickle';
        else if (g === 'herb') {
          type = 'tea';
          minutes = 1440;
        }
      } else if (g === 'fruit') {
        type = 'wine';
        minutes = 5760;
      } else if (g === 'veg') type = 'juice';
      if (!type) return `${def.name}(으)로는 만들 수 있는 게 없어요.`;
      return { need: 1, out: [{ id: artisanId(type, id), qty: 1 }], minutes };
    }
    case 'seedmaker':
      if (def.kind !== 'produce') return '밭에서 기른 작물을 넣어 주세요.';
      return { need: 1, out: [{ id: `seed.${def.cropId}`, qty: 1 + rng.int(0, 2) }], minutes: 720 };
    default:
      return '재료를 넣는 장비가 아니에요.';
  }
}

/** Feeds the held stack into a machine. Returns an error message or null. */
export function loadMachine(ctx: SimContext, p: PlayerState, obj: PlacedObject, slot: number): string | null {
  const stack = p.inv[slot];
  if (!stack) return null;
  const name = MACHINE_NAME[obj.kind] ?? '장비';
  if (obj.work) return obj.work.ready <= nowAbs(ctx.state) ? '먼저 결과물을 꺼내 주세요.' : `${name}이(가) 아직 작업 중이에요.`;
  const b = batchFor(obj.kind, stack, ctx.rng);
  if (typeof b === 'string') return b;
  if (stack.qty < b.need) return `${getItem(stack.id).name}이(가) ${b.need}개 필요해요.`;
  if (b.extra && countItem(p.inv, b.extra[0]) < b.extra[1]) return `${getItem(b.extra[0]).name}이(가) ${b.extra[1]}개 필요해요.`;
  takeFromSlot(p.inv, slot, b.need);
  if (b.extra) removeItem(p.inv, b.extra[0], b.extra[1]);
  obj.work = { out: b.out, ready: nowAbs(ctx.state) + b.minutes };
  ctx.touchPlaced();
  ctx.touchPlayer(p.id);
  ctx.emit({ t: 'fx', kind: 'load', x: obj.x, y: obj.y, by: p.id }, 'all');
  return null;
}

/** Moves finished goods (or a harvester's store) into the bag. */
export function collectMachine(ctx: SimContext, p: PlayerState, obj: PlacedObject): string | null {
  const now = nowAbs(ctx.state);
  const name = MACHINE_NAME[obj.kind] ?? '장비';
  const source: ItemStack[] = [];
  if (obj.kind === 'harvester') source.push(...(obj.store ?? []).filter((s): s is ItemStack => !!s));
  else if (obj.work && obj.work.ready <= now) source.push(...obj.work.out);
  if (!source.length) {
    if (obj.kind === 'harvester') return '아직 수확한 작물이 없어요. 매일 아침 주변 5×5를 수확해요.';
    if (obj.kind === 'beehouse') return `꿀이 차오르는 중이에요. (${Math.max(1, 3 - (obj.days ?? 0))}일 남음)`;
    if (obj.work) return `${name} 작업 중 · ${timeLeft(obj.work.ready - now)} 남음`;
    return idleHint(obj.kind);
  }
  const left: ItemStack[] = [];
  let got = 0;
  for (const s of source) {
    if (canFit(p.inv, s.id, s.qty, s.q)) {
      addItem(p.inv, s.id, s.qty, s.q);
      ctx.emit({ t: 'gain', item: s.id, qty: s.qty, x: obj.x, y: obj.y }, p.id);
      got++;
    } else left.push(s);
  }
  if (obj.kind === 'harvester') obj.store = Array.from({ length: HARVESTER_SLOTS }, (_, i) => left[i] ?? null);
  else if (left.length) obj.work = { out: left, ready: obj.work!.ready };
  else {
    obj.work = null;
    if (obj.kind === 'beehouse') obj.days = 0;
  }
  ctx.touchPlaced();
  ctx.touchPlayer(p.id);
  if (!got) return '가방이 가득 찼어요.';
  return left.length ? '가방이 가득 차서 일부만 꺼냈어요.' : null;
}

export function timeLeft(min: number): string {
  if (min >= 1440) return `${Math.ceil(min / 1440)}일`;
  if (min >= 60) return `${Math.ceil(min / 60)}시간`;
  return `${Math.max(1, Math.ceil(min))}분`;
}

export function idleHint(kind: PlaceableKind): string {
  switch (kind) {
    case 'compost':
      return '섬유 10개나 작물 3개를 들고 사용하면 넣을 수 있어요.';
    case 'furnace':
      return '광석 5개를 들고 사용하세요. (석탄 1개 필요)';
    case 'jar':
      return '과일·채소·허브를 들고 사용하면 넣을 수 있어요.';
    case 'keg':
      return '과일이나 채소를 들고 사용하면 넣을 수 있어요.';
    case 'seedmaker':
      return '작물을 들고 사용하면 씨앗을 만들어요.';
    default:
      return '';
  }
}

/** Rolls what the ripe crop on tile `key` would give, without touching the field. */
export function rollHarvest(state: WorldState, rng: Rng, key: number): ItemStack | null {
  const soil = state.soil[key];
  if (!soil?.crop || soil.crop.dead || !isReady(soil.crop) || soil.crop.giant !== undefined) return null;
  const def = getCrop(soil.crop.id);
  const q = rollQuality(soil, rng);
  return { id: `crop.${def.id}`, qty: rollYield(def, q, rng), q };
}

/** Picks the crop: regrowers reset to their regrow stage, others leave bare soil. */
export function applyHarvest(state: WorldState, key: number): void {
  const soil = state.soil[key];
  if (!soil?.crop) return;
  const def = getCrop(soil.crop.id);
  soil.fertility = Math.max(20, soil.fertility - 4);
  if (def.regrowDays > 0) {
    soil.crop.growth = def.growDays - def.regrowDays;
    soil.crop.harvests++;
  } else {
    soil.crop = null;
    soil.fert = null;
  }
  if (!state.discovered.includes(def.id)) state.discovered.push(def.id);
}

/** Harvests the ripe crop on tile `key` (used by the auto-harvester). */
export function harvestCrop(state: WorldState, rng: Rng, key: number): ItemStack | null {
  const got = rollHarvest(state, rng, key);
  if (got) applyHarvest(state, key);
  return got;
}

/** Morning work: bees fill their jars, auto-harvesters gather ripe crops. Returns changed soil keys. */
export function morningMachines(state: WorldState, map: WorldMap, rng: Rng): number[] {
  const changed: number[] = [];
  const winter = seasonOf(state.clock.day) === 3;
  for (const o of state.placed) {
    if (o.kind === 'beehouse' && !winter && !o.work) {
      o.days = (o.days ?? 0) + 1;
      if (o.days >= 3) {
        // The best flower in bloom nearby flavours the honey.
        let best: string | null = null;
        let bestPrice = -1;
        for (let dy = -BEE_RADIUS; dy <= BEE_RADIUS; dy++)
          for (let dx = -BEE_RADIUS; dx <= BEE_RADIUS; dx++) {
            const s = state.soil[(o.y + dy) * map.w + o.x + dx];
            if (!s?.crop || s.crop.dead) continue;
            const c = getCrop(s.crop.id);
            if (!isBeeFlower(c.id) || s.crop.growth < c.growDays * 0.6) continue;
            if (c.sellPrice > bestPrice) {
              bestPrice = c.sellPrice;
              best = `crop.${c.id}`;
            }
          }
        o.work = { out: [{ id: artisanId('honey', best), qty: 1 }], ready: nowAbs(state) };
      }
    }
    if (o.kind === 'harvester') {
      o.store ??= Array.from({ length: HARVESTER_SLOTS }, () => null);
      for (let dy = -HARVESTER_RADIUS; dy <= HARVESTER_RADIUS; dy++)
        for (let dx = -HARVESTER_RADIUS; dx <= HARVESTER_RADIUS; dx++) {
          const k = (o.y + dy) * map.w + o.x + dx;
          const soil = state.soil[k];
          if (!soil?.crop || !isReady(soil.crop) || soil.crop.dead) continue;
          // Only take it if there's a free slot for the whole yield.
          if (!o.store.some((s) => !s)) continue;
          const got = harvestCrop(state, rng, k);
          if (got) {
            addItem(o.store, got.id, got.qty, got.q);
            changed.push(k);
          }
        }
    }
  }
  return changed;
}

// ── Workbench ────────────────────────────────────────────────────────────

export function craft(ctx: SimContext, p: PlayerState, recipeId: string): string | null {
  const r = RECIPE_BY_ID.get(recipeId);
  if (!r) return null;
  const bench = ctx.map.interactables.find((i) => i.kind === 'workbench');
  if (bench && Math.hypot(bench.x * 16 + 8 - p.x, bench.y * 16 + 8 - p.y) > 64) return '작업대 앞에서 만들 수 있어요.';
  for (const [id, n] of r.needs) if (countItem(p.inv, id) < n) return `${getItem(id).name}이(가) 부족해요. (${countItem(p.inv, id)}/${n})`;
  if (!canFit(p.inv, r.out, r.qty)) return '가방에 자리가 없어요.';
  for (const [id, n] of r.needs) removeItem(p.inv, id, n);
  addItem(p.inv, r.out, r.qty);
  ctx.touchPlayer(p.id);
  ctx.emit({ t: 'crafted', item: r.out, qty: r.qty }, p.id);
  return null;
}

// ── Chests ───────────────────────────────────────────────────────────────

/** Moves a whole stack between the bag and a chest, merging where it can. */
export function chestMove(ctx: SimContext, p: PlayerState, objId: number, from: 'inv' | 'chest', slot: number): string | null {
  const obj = ctx.state.placed.find((o) => o.id === objId && o.kind === 'chest');
  if (!obj) return null;
  if (Math.hypot(obj.x * 16 + 8 - p.x, obj.y * 16 + 8 - p.y) > 56) return '상자 가까이에서 옮길 수 있어요.';
  obj.store ??= Array.from({ length: CHEST_SLOTS }, () => null);
  const src = from === 'inv' ? p.inv : obj.store;
  const dst = from === 'inv' ? obj.store : p.inv;
  const s = src[slot];
  if (!s) return null;
  const max = getItem(s.id).maxStack;
  let left = s.qty;
  for (const d of dst) {
    if (!left) break;
    if (d && d.id === s.id && (d.q ?? 0) === (s.q ?? 0) && d.water === undefined && d.qty < max) {
      const n = Math.min(left, max - d.qty);
      d.qty += n;
      left -= n;
    }
  }
  if (left) {
    const i = dst.findIndex((d) => !d);
    if (i < 0) {
      s.qty = left;
      ctx.touchPlaced();
      ctx.touchPlayer(p.id);
      return from === 'inv' ? '상자가 가득 찼어요.' : '가방이 가득 찼어요.';
    }
    dst[i] = { ...s, qty: left };
  }
  src[slot] = null;
  ctx.touchPlaced();
  ctx.touchPlayer(p.id);
  return null;
}

// ── Quarry ───────────────────────────────────────────────────────────────

const NODE_WEIGHTS: Array<[NodeKind, number]> = [
  ['stone', 0.42],
  ['coal', 0.16],
  ['copper', 0.22],
  ['iron', 0.13],
  ['gem', 0.07],
];

export const NODE_NAME: Record<NodeKind, string> = { stone: '바위', coal: '석탄 광맥', copper: '구리 광맥', iron: '철 광맥', gem: '보석 광맥' };

/** Tops the quarry back up with fresh outcrops each morning. */
export function spawnNodes(state: WorldState, map: WorldMap, rng: Rng, target = 16): void {
  const q = map.quarry;
  if (!q.w) return;
  let have = Object.keys(state.nodes).length;
  // Tiles taken by the track, cart and props stay clear.
  const taken = new Set<number>();
  for (const o of map.objects)
    if (o.x >= q.x - 2 && o.x < q.x + q.w + 2 && o.y >= q.y - 2 && o.y < q.y + q.h + 2)
      for (let yy = o.y; yy < o.y + (o.h ?? 1); yy++) for (let xx = o.x; xx < o.x + (o.w ?? 1); xx++) taken.add(yy * map.w + xx);
  for (let tries = 0; tries < 400 && have < target; tries++) {
    const x = q.x + rng.int(0, q.w - 1);
    const y = q.y + rng.int(0, q.h - 1);
    const k = y * map.w + x;
    if (map.solid[k] || taken.has(k) || state.nodes[k] || state.forage[k] || map.terrain[k] !== Terrain.Rock) continue;
    if (state.placed.some((o) => o.x === x && o.y === y)) continue;
    let r = rng.next();
    let kind: NodeKind = 'stone';
    for (const [k2, w] of NODE_WEIGHTS) {
      if (r < w) {
        kind = k2;
        break;
      }
      r -= w;
    }
    state.nodes[k] = kind;
    have++;
  }
}

/** What a broken outcrop drops. Deeper mine floors (`floor`) yield more ore and rarer gems. */
export function nodeDrops(kind: NodeKind, rng: Rng, floor = 0): ItemStack[] {
  const bonus = floor >= 20 ? 1 : 0;
  switch (kind) {
    case 'stone':
      return [{ id: 'mat.stone', qty: rng.int(2, 4) }, ...(rng.chance(0.12) ? [{ id: 'mat.coal', qty: 1 }] : [])];
    case 'coal':
      return [{ id: 'mat.coal', qty: rng.int(1, 3) }, { id: 'mat.stone', qty: 1 }];
    case 'copper':
      return [{ id: 'ore.copper', qty: rng.int(2, 4) + bonus }, { id: 'mat.stone', qty: 1 }];
    case 'iron':
      return [{ id: 'ore.iron', qty: rng.int(1, 3) + bonus + (floor >= 10 ? 1 : 0) }, { id: 'mat.stone', qty: 1 }];
    default: {
      const r = rng.next() * (1 - Math.min(0.45, floor * 0.015));
      return [{ id: r < 0.68 ? 'gem.quartz' : r < 0.94 ? 'gem.amethyst' : 'gem.aquamarine', qty: 1 }];
    }
  }
}

export function giveAll(ctx: SimContext, p: PlayerState, items: ItemStack[], x: number, y: number): void {
  for (const s of items) {
    const left = addItem(p.inv, s.id, s.qty, s.q);
    if (left < s.qty) ctx.emit({ t: 'gain', item: s.id, qty: s.qty - left, x, y }, p.id);
  }
}
