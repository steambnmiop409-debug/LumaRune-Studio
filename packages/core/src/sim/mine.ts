import { L } from '../i18n';
import { getItem } from '../data/items';
import type { Rng } from '../math/rng';
import type { NodeKind, PlayerState, WorldState } from '../state/types';
import { MINE_DEPTH, MINE_THEME_NAME, liftFloors, mineFloor, mineTheme, type MineFloor } from '../world/mine';
import { TILE } from '../world/tiles';
import type { WorldMap } from '../world/types';
import type { SimContext } from './actions';
import { NODE_NAME, giveAll, nodeDrops } from './machines';

/** Rock mix per theme: earthy galleries have coal and copper, frost caves iron, the ember depths gems. */
const ROCK_MIX: Record<number, Array<[NodeKind, number]>> = {
  0: [
    ['coal', 0.18],
    ['copper', 0.2],
    ['iron', 0.02],
    ['gem', 0.02],
  ],
  1: [
    ['coal', 0.12],
    ['copper', 0.08],
    ['iron', 0.22],
    ['gem', 0.06],
  ],
  2: [
    ['coal', 0.1],
    ['copper', 0.04],
    ['iron', 0.28],
    ['gem', 0.13],
  ],
};

export const floorOf = (state: WorldState, p: PlayerState): MineFloor => mineFloor(state.seed, p.floor);

/** Scatters today's rocks on a floor the first time anyone comes down to it. */
export function spawnMineRocks(state: WorldState, floor: number, rng: Rng): void {
  if (state.mine.rocks[floor]) return;
  const f = mineFloor(state.seed, floor);
  const rocks: Record<number, NodeKind> = {};
  const want = Math.min(f.spots.length, 26 + Math.min(18, floor));
  const mix = ROCK_MIX[f.theme];
  for (let tries = 0, n = 0; n < want && tries < want * 20; tries++) {
    const k = f.spots[rng.int(0, f.spots.length - 1)];
    if (rocks[k]) continue;
    let r = rng.next();
    let kind: NodeKind = 'stone';
    for (const [k2, w] of mix) {
      if (r < w) {
        kind = k2;
        break;
      }
      r -= w;
    }
    rocks[k] = kind;
    n++;
  }
  state.mine.rocks[floor] = rocks;
}

function place(ctx: SimContext, p: PlayerState, floor: number, x: number, y: number) {
  p.floor = floor;
  p.x = x;
  p.y = y;
  p.dir = 'down';
  p.moving = false;
  ctx.touchPlayer(p.id);
  ctx.touchDebris?.();
  ctx.emit({ t: 'warp', x, y, floor }, p.id);
}

/** Climbs down (or rides the lift) to a floor, arriving at the foot of its ladder. */
export function enterMine(ctx: SimContext, p: PlayerState, floor: number): string | null {
  const { state } = ctx;
  if (p.carrying.length) return '상자를 들고는 사다리를 탈 수 없어요.';
  floor = Math.max(1, Math.min(MINE_DEPTH, floor | 0));
  spawnMineRocks(state, floor, ctx.rng);
  const f = mineFloor(state.seed, floor);
  const first = floor > state.mine.deepest;
  state.mine.deepest = Math.max(state.mine.deepest, floor);
  place(ctx, p, floor, f.up.x * TILE + TILE / 2, (f.up.y + 1) * TILE + TILE - 3);
  ctx.emit({ t: 'fx', kind: 'ladder', x: f.up.x, y: f.up.y + 1, by: p.id, floor }, p.id);
  if (first && floor % 5 === 0) ctx.emit({ t: 'toast', text: L('{n}층 도달! 입구의 승강기로 바로 내려올 수 있어요.', { n: floor }), tone: 'good' }, p.id);
  if (first && (floor === 10 || floor === 20)) ctx.emit({ t: 'toast', text: L('{place}에 들어섰어요.', { place: MINE_THEME_NAME[mineTheme(floor)] }), tone: 'info' }, p.id);
  return null;
}

/** Back up to the island, in front of the cave mouth. */
export function leaveMine(ctx: SimContext, p: PlayerState): string | null {
  const cave = caveEntrance(ctx.map);
  place(ctx, p, 0, cave.x * TILE + TILE / 2, (cave.y + 1) * TILE + TILE - 3);
  ctx.emit({ t: 'fx', kind: 'ladder', x: cave.x, y: cave.y + 1, by: p.id, floor: 0 }, p.id);
  return null;
}

export function caveEntrance(map: WorldMap): { x: number; y: number } {
  return map.interactables.find((i) => i.kind === 'cave') ?? map.spawn;
}

/** At the cave mouth: straight down to floor 1, or offer the lift once a checkpoint is reached. */
export function useCave(ctx: SimContext, p: PlayerState): string | null {
  const floors = liftFloors(ctx.state.mine.deepest);
  if (floors.length > 1) {
    ctx.emit({ t: 'openLift', floors }, p.id);
    return null;
  }
  return enterMine(ctx, p, 1);
}

/** Lift request from the entrance panel. */
export function rideLift(ctx: SimContext, p: PlayerState, floor: number): string | null {
  if (p.floor) return null;
  const cave = caveEntrance(ctx.map);
  const near = Math.hypot(cave.x * TILE + 8 - p.x, cave.y * TILE + 8 - (p.y - 4)) < 60;
  if (!near) return '광산 입구에서 탈 수 있어요.';
  if (!liftFloors(ctx.state.mine.deepest).includes(floor)) return '아직 그 층까지는 내려가 본 적이 없어요.';
  return enterMine(ctx, p, floor);
}

/** Right click / E inside the mine: the ladders. */
export function mineInteract(ctx: SimContext, p: PlayerState, x: number, y: number): string | null {
  const { state } = ctx;
  const f = floorOf(state, p);
  const key = y * f.w + x;
  if (x === f.up.x && (y === f.up.y || y === f.up.y + 1)) return leaveMine(ctx, p);
  if (state.mine.ladders[p.floor] === key) {
    if (p.floor >= MINE_DEPTH) return '더는 내려갈 길이 없어요. 광산의 가장 깊은 곳이에요.';
    return enterMine(ctx, p, p.floor + 1);
  }
  return null;
}

/** Using the held item inside the mine: only the pickaxe does anything down here. */
export function mineUseItem(ctx: SimContext, p: PlayerState, slot: number, x: number, y: number): string | null {
  const { state, rng } = ctx;
  const stack = p.inv[slot];
  if (!stack) return null;
  const def = getItem(stack.id);
  const f = floorOf(state, p);
  const key = y * f.w + x;
  const rocks = state.mine.rocks[p.floor] ?? {};
  const rock = rocks[key];
  if (!rock) {
    if (def.kind === 'seed' || def.kind === 'placeable' || (def.kind === 'tool' && def.tool !== 'pick')) return '광산 안에서는 곡괭이만 쓸 수 있어요.';
    return null;
  }
  if (def.tool !== 'pick') return def.kind === 'tool' ? L('{node}은(는) 곡괭이로 깰 수 있어요.', { node: NODE_NAME[rock] }) : null;
  if (p.stamina < 4) return '너무 지쳤어요. 오늘은 쉬어야 해요.';
  p.stamina -= 4;
  delete rocks[key];
  giveAll(ctx, p, nodeDrops(rock, rng, p.floor), x, y);
  ctx.emit({ t: 'fx', kind: 'mine', x, y, by: p.id, floor: p.floor }, 'all');
  // One of the rocks hides the way down; the fewer left, the likelier the next one.
  if (state.mine.ladders[p.floor] === undefined && p.floor < MINE_DEPTH) {
    const left = Object.keys(rocks).length;
    if (rng.chance(1 / (left + 1) + 0.06)) {
      state.mine.ladders[p.floor] = key;
      ctx.emit({ t: 'fx', kind: 'ladder', x, y, by: p.id, floor: p.floor }, 'all');
      ctx.emit({ t: 'toast', text: '바위 밑에서 아래층으로 내려가는 사다리를 찾았어요!', tone: 'good' }, p.id);
    }
  }
  ctx.touchDebris?.();
  ctx.touchPlayer(p.id);
  return null;
}
