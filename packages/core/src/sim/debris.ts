import { seedShopStock } from '../data/shops';
import type { Rng } from '../math/rng';
import type { DebrisKind, WorldState } from '../state/types';
import { seasonOf } from '../time/calendar';
import { Terrain, Zone } from '../world/tiles';
import type { WorldMap } from '../world/types';

/** Farm tiles that can hold debris: open farm grass, not the house path, nothing placed or tilled. */
function open(state: WorldState, map: WorldMap, k: number): boolean {
  if (map.zone[k] !== Zone.Farm || map.solid[k] || map.terrain[k] !== Terrain.Grass) return false;
  if (state.soil[k] || state.debris[k]) return false;
  const x = k % map.w;
  const y = (k - x) / map.w;
  if (Math.abs(x - map.spawn.x) <= 2 && Math.abs(y - map.spawn.y) <= 2) return false;
  return !state.placed.some((p) => p.x === x && p.y === y);
}

/** A new farm starts overgrown: weeds, field stones and fallen twigs to clear. */
export function scatterDebris(state: WorldState, map: WorldMap, rng: Rng, share = 0.2): void {
  const f = map.farm;
  for (let y = f.y; y < f.y + f.h; y++)
    for (let x = f.x; x < f.x + f.w; x++) {
      const k = y * map.w + x;
      if (!open(state, map, k) || !rng.chance(share)) continue;
      const r = rng.next();
      state.debris[k] = r < 0.55 ? 'weed' : r < 0.8 ? 'stone' : 'twig';
    }
}

/** Overnight, a few weeds creep back onto untended ground (not in winter). */
export function regrowWeeds(state: WorldState, map: WorldMap, rng: Rng): number[] {
  if (seasonOf(state.clock.day) === 3) return [];
  const changed: number[] = [];
  const f = map.farm;
  for (let y = f.y; y < f.y + f.h; y++)
    for (let x = f.x; x < f.x + f.w; x++) {
      const k = y * map.w + x;
      if (open(state, map, k) && rng.chance(0.004)) {
        state.debris[k] = 'weed';
        changed.push(k);
      }
    }
  return changed;
}

export const DEBRIS_NAME: Record<DebrisKind, string> = { weed: '잡초', stone: '돌멩이', twig: '나뭇가지' };

/** Stones and twigs are in the way; weeds you can wade through. */
export function debrisBlocks(kind: DebrisKind | undefined): boolean {
  return kind === 'stone' || kind === 'twig';
}

/** Something useful sometimes turns up in the weeds: a packet of this season's seeds. */
export function weedFind(state: WorldState, rng: Rng): string | null {
  if (!rng.chance(0.1)) return null;
  const stock = seedShopStock(seasonOf(state.clock.day), 0);
  return stock.length ? rng.pick(stock) : null;
}
