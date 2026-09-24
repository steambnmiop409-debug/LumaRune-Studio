import { NPCS, type NpcDef, type Place } from '../data/npcs';
import { astar } from '../world/path';
import { TILE } from '../world/tiles';
import type { WorldMap } from '../world/types';
import type { Dir } from '../state/types';

/** NPC walking speed, in tiles per game minute (a stroll: a bit over half the player's walk). */
export const NPC_SPEED = 2.4;

export function npcPlaces(map: WorldMap): Record<Place, { x: number; y: number }> {
  const b = (k: string, n = 0) => map.buildings.filter((x) => x.kind === k)[n];
  const front = (bb: { door: { x: number; y: number } | null; x: number; y: number; h: number } | undefined, dx = 0) =>
    bb?.door ? { x: bb.door.x + dx, y: bb.door.y + 1 } : { x: map.plaza.x + 5, y: map.plaza.y + 5 };
  const p = map.plaza;
  const lh = map.lighthouse;
  return {
    seedShop: front(b('seedShop'), 1),
    toolShop: front(b('toolShop'), 1),
    fountain: { x: p.x + Math.floor(p.w / 2) - 2, y: p.y + Math.floor(p.h / 2) + 2 },
    stallW: { x: p.x + 3, y: p.y + p.h - 2 },
    stallE: { x: p.x + p.w - 3, y: p.y + p.h - 2 },
    pier: { x: map.pierEnd.x - 1, y: map.pierEnd.y - 1 },
    harbor: front(b('harborOffice')),
    lighthouse: { x: lh.x + 1, y: lh.y + 4 },
    meadow: { x: 177, y: 56 },
    beach: { x: 58, y: 132 },
    farmGate: { x: map.farm.x + map.farm.w + 2, y: map.farm.y + 12 },
    home0: front(b('cottage', 0)),
    home1: front(b('cottage', 1)),
    home2: front(b('cottage', 2)),
    forest: { x: 102, y: 38 },
  };
}

const routeCache = new Map<string, Array<[number, number]>>();

function route(map: WorldMap, a: { x: number; y: number }, b: { x: number; y: number }): Array<[number, number]> {
  const key = `${map.seed}:${a.x},${a.y}>${b.x},${b.y}`;
  let r = routeCache.get(key);
  if (!r) {
    r =
      astar(map.w, map.h, a.x, a.y, b.x, b.y, (x, y) => {
        if (map.solid[y * map.w + x]) return Infinity;
        const t = map.terrain[y * map.w + x];
        return t === 6 || t === 7 || t === 9 || t === 10 ? 1 : 2.2;
      }) ?? [
        [a.x, a.y],
        [b.x, b.y],
      ];
    routeCache.set(key, r);
  }
  return r;
}

export interface NpcPose {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
}

interface Leg {
  start: number;
  end: number;
  path: Array<[number, number]>;
}

const legCache = new Map<string, Leg[]>();

/**
 * A villager's day as walks: each leg sets off at its scheduled time, or as soon as the previous walk
 * arrives if that runs late — so nobody ever skips ahead to a place they haven't walked to.
 */
function dayLegs(npc: NpcDef, map: WorldMap, places: Record<Place, { x: number; y: number }>): Leg[] {
  const key = `${map.seed}:${npc.id}`;
  let legs = legCache.get(key);
  if (!legs) {
    legs = [];
    const sch = npc.schedule;
    let t = -Infinity;
    for (let i = 0; i < sch.length; i++) {
      const path = route(map, places[sch[(i - 1 + sch.length) % sch.length][1]], places[sch[i][1]]);
      const start = Math.max(sch[i][0], t);
      t = start + Math.max(0, path.length - 1) / NPC_SPEED;
      legs.push({ start, end: t, path });
    }
    legCache.set(key, legs);
  }
  return legs;
}

const toPx = (t: [number, number]) => ({ x: t[0] * TILE + TILE / 2, y: t[1] * TILE + TILE - 2 });

/** Where an NPC is at `minute` (fractional) — deterministic, so server and client agree without syncing. */
export function npcPose(npc: NpcDef, map: WorldMap, minute: number, places = npcPlaces(map)): NpcPose {
  const legs = dayLegs(npc, map, places);
  // Before the first walk of the day they are still where the last one ended (home).
  let leg = legs[legs.length - 1];
  for (const l of legs) if (minute >= l.start) leg = l;
  const walking = minute >= legs[0].start && minute < leg.end && leg.path.length > 1;
  if (walking) {
    const walked = (minute - leg.start) * NPC_SPEED;
    const k = Math.floor(walked);
    const f = walked - k;
    const a = toPx(leg.path[k]);
    const b = toPx(leg.path[Math.min(leg.path.length - 1, k + 1)]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return { id: npc.id, x: a.x + dx * f, y: a.y + dy * f, dir: Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down', moving: true };
  }
  const end = toPx(leg.path[leg.path.length - 1]);
  // Idle: look around now and then.
  const dirs: Dir[] = ['down', 'left', 'down', 'right'];
  return { id: npc.id, x: end.x, y: end.y, dir: dirs[Math.floor(minute / 23) % 4], moving: false };
}

export function allNpcPoses(map: WorldMap, minute: number): NpcPose[] {
  const places = npcPlaces(map);
  return NPCS.map((n) => npcPose(n, map, minute, places));
}
