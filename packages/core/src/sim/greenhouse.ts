import { L } from '../i18n';
import { getCrop, type CropDef } from '../data/crops';
import { getItem } from '../data/items';
import { rollQuality } from '../farming/growth';
import { addItem, canFit, countItem, removeItem } from '../inventory/inventory';
import type { Rng } from '../math/rng';
import type { PlayerState, WorldState } from '../state/types';
import type { DayWeather } from '../weather/weather';
import type { WorldMap } from '../world/types';
import type { SimContext } from './actions';

// ── The glasshouse ───────────────────────────────────────────────────────

/** What it takes to glaze and mend the old glasshouse. */
export const GREENHOUSE_COST = {
  gold: 4000,
  items: [
    ['mat.wood', 100],
    ['mat.stone', 80],
    ['bar.copper', 6],
    ['bar.iron', 2],
  ] as Array<[string, number]>,
};

/** Tiles inside the glasshouse walls (the 7×4 bed). */
export function inGreenhouse(map: WorldMap, x: number, y: number): boolean {
  const g = map.greenhouse;
  return g.w > 0 && x > g.x && x < g.x + g.w - 1 && y > g.y && y < g.y + g.h - 1;
}

/** Anywhere on the glasshouse footprint, walls included. */
export function onGreenhouse(map: WorldMap, x: number, y: number): boolean {
  const g = map.greenhouse;
  return x >= g.x && x < g.x + g.w && y >= g.y && y < g.y + g.h;
}

/**
 * Under glass it is always a gentle, dry, windless day at exactly the temperature the plant likes:
 * no frost, no rain, any crop in any season (you still water it).
 */
export function greenhouseWeather(outside: DayWeather, def: CropDef): DayWeather {
  const [lo, hi] = def.temp;
  const mid = (lo + hi) / 2;
  return { ...outside, kind: 'clear', precipStart: 0, precipEnd: 0, wind: 0, meanTemp: mid, minTemp: Math.max(2, lo), maxTemp: hi };
}

/** Clears anything left on the glasshouse walls (and inside it while it is still a ruin). */
export function tidyGreenhouse(state: WorldState, map: WorldMap): void {
  const g = map.greenhouse;
  for (let y = g.y; y < g.y + g.h; y++)
    for (let x = g.x; x < g.x + g.w; x++) {
      if (!map.solid[y * map.w + x] && state.greenhouse && inGreenhouse(map, x, y)) continue;
      const k = y * map.w + x;
      delete state.debris[k];
      if (map.solid[k] || !state.greenhouse) delete state.soil[k];
      state.placed = state.placed.filter((p) => p.x !== x || p.y !== y);
    }
}

export function hasGreenhouseCost(state: WorldState, p: PlayerState): boolean {
  return state.gold >= GREENHOUSE_COST.gold && GREENHOUSE_COST.items.every(([id, n]) => countItem(p.inv, id) >= n);
}

/** Pays for and restores the glasshouse. */
export function repairGreenhouse(ctx: SimContext, p: PlayerState): string | null {
  const { state, map } = ctx;
  if (state.greenhouse) return null;
  const door = map.interactables.find((i) => i.kind === 'greenhouse');
  if (!door || Math.hypot(door.x * 16 + 8 - p.x, door.y * 16 + 8 - (p.y - 4)) > 64) return '온실 앞에서 고칠 수 있어요.';
  if (state.gold < GREENHOUSE_COST.gold) return L('돈이 부족해요. ({gold}G 필요)', { gold: GREENHOUSE_COST.gold });
  for (const [id, n] of GREENHOUSE_COST.items) if (countItem(p.inv, id) < n) return L('{item}이(가) {n}개 필요해요.', { item: getItem(id).name, n });
  state.gold -= GREENHOUSE_COST.gold;
  for (const [id, n] of GREENHOUSE_COST.items) removeItem(p.inv, id, n);
  state.greenhouse = true;
  tidyGreenhouse(state, map);
  ctx.touchPlayer(p.id);
  ctx.touchDebris?.();
  ctx.emit({ t: 'toast', text: '온실을 되살렸어요! 유리 안에서는 계절과 상관없이 무엇이든 자라요.', tone: 'good' }, p.id);
  ctx.emit({ t: 'fx', kind: 'restore', x: door.x, y: door.y - 2, by: p.id }, 'all');
  return null;
}

// ── Giant crops ──────────────────────────────────────────────────────────

/** Crops that can swell into one giant when a 3×3 patch is ripe together. */
export const GIANT_CROPS: ReadonlySet<string> = new Set(['pumpkin', 'watermelon', 'kabocha', 'cabbage', 'cauliflower', 'napa', 'muskmelon', 'cantaloupe']);
/** Nightly chance for each qualifying 3×3 patch. */
export const GIANT_CHANCE = 0.12;

/**
 * Overnight: any 3×3 patch of the same ripe giant-capable crop may merge into one giant.
 * Each crop in the patch remembers the patch's top-left tile. Returns the crop id of a new giant, if any.
 */
export function growGiants(state: WorldState, map: WorldMap, rng: Rng): string | null {
  let made: string | null = null;
  const keys = Object.keys(state.soil)
    .map(Number)
    .sort((a, b) => a - b);
  for (const k of keys) {
    const c = state.soil[k]?.crop;
    if (!c || c.dead || c.giant !== undefined || !GIANT_CROPS.has(c.id) || c.growth < getCrop(c.id).growDays) continue;
    const patch: number[] = [];
    for (let dy = 0; dy < 3; dy++)
      for (let dx = 0; dx < 3; dx++) {
        const n = k + dy * map.w + dx;
        const o = state.soil[n]?.crop;
        if (dx + (k % map.w) >= map.w || !o || o.id !== c.id || o.dead || o.giant !== undefined || o.growth < getCrop(o.id).growDays) break;
        patch.push(n);
      }
    if (patch.length !== 9 || !rng.chance(GIANT_CHANCE)) continue;
    for (const n of patch) state.soil[n].crop!.giant = k;
    made = c.id;
  }
  return made;
}

/** The nine tiles of the giant whose top-left is `anchor`. */
export function giantTiles(map: WorldMap, anchor: number): number[] {
  const out: number[] = [];
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) out.push(anchor + dy * map.w + dx);
  return out;
}

/** Harvests a whole giant crop from any of its tiles: a big pile of top-quality produce. */
export function harvestGiant(ctx: SimContext, p: PlayerState, key: number): string | null {
  const { state, map, rng } = ctx;
  const anchor = state.soil[key]?.crop?.giant;
  if (anchor === undefined) return null;
  const def = getCrop(state.soil[anchor].crop!.id);
  const q = Math.min(5, rollQuality(state.soil[anchor], rng) + 1);
  const qty = rng.int(14, 20);
  if (!canFit(p.inv, `crop.${def.id}`, qty, q)) return '가방이 가득 찼어요.';
  addItem(p.inv, `crop.${def.id}`, qty, q);
  for (const n of giantTiles(map, anchor)) {
    const s = state.soil[n];
    if (!s) continue;
    s.crop = null;
    s.fert = null;
    s.fertility = Math.max(20, s.fertility - 6);
    ctx.touchSoil(n);
  }
  if (!state.discovered.includes(def.id)) state.discovered.push(def.id);
  ctx.touchPlayer(p.id);
  const ax = anchor % map.w;
  const ay = Math.floor(anchor / map.w);
  ctx.emit({ t: 'harvest', x: ax + 1, y: ay + 1, cropId: def.id, q, qty, by: p.id, giant: true }, 'all');
  ctx.emit({ t: 'toast', text: L('거대 {crop}를 수확했어요! ×{n}', { crop: def.name, n: qty }), tone: 'good' }, p.id);
  return null;
}
