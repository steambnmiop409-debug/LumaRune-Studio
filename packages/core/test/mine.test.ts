import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APPEARANCE,
  MINE_DEPTH,
  MineCell,
  Rng,
  TILE,
  addItem,
  advanceDay,
  caveEntrance,
  countItem,
  createPlayer,
  createWorldState,
  generateMineFloor,
  generateWorld,
  interact,
  liftFloors,
  migrateSave,
  mineFloor,
  rideLift,
  useItem,
  type GameEvent,
  type PlayerState,
  type SimContext,
} from '../src';

const map = generateWorld();

function setup(seed = 5) {
  const rng = new Rng(seed);
  const state = createWorldState(map.seed, rng, map);
  const p = createPlayer('p1', '루미', '별빛 농장', DEFAULT_APPEARANCE, map);
  state.players[p.id] = p;
  const events: GameEvent[] = [];
  const ctx: SimContext = { state, map, rng, emit: (e) => events.push(e), touchSoil: () => {}, touchPlaced: () => {}, touchPlayer: () => {}, touchDebris: () => {} };
  return { rng, state, p, ctx, events };
}

const stand = (p: PlayerState, tx: number, ty: number) => {
  p.x = tx * TILE + TILE / 2;
  p.y = ty * TILE + TILE - 2;
};

describe('mine floors', () => {
  it('are deterministic and fully connected from the ladder', () => {
    for (const floor of [1, 7, 12, 25, MINE_DEPTH]) {
      const a = generateMineFloor(map.seed, floor);
      const b = generateMineFloor(map.seed, floor);
      expect(Array.from(a.cells)).toEqual(Array.from(b.cells));
      expect(a.cells[(a.up.y - 1) * a.w + a.up.x]).toBe(MineCell.Wall);
      // Every rock spot can be walked to from the arrival tile.
      const start = (a.up.y + 1) * a.w + a.up.x;
      const seen = new Set([start]);
      const stack = [start];
      while (stack.length) {
        const k = stack.pop()!;
        for (const d of [-1, 1, -a.w, a.w]) {
          const n = k + d;
          if (!seen.has(n) && !a.solid[n]) {
            seen.add(n);
            stack.push(n);
          }
        }
      }
      expect(a.spots.length).toBeGreaterThan(200);
      for (const s of a.spots) expect(seen.has(s)).toBe(true);
    }
  });

  it('change theme with depth', () => {
    expect(mineFloor(map.seed, 3).theme).toBe(0);
    expect(mineFloor(map.seed, 14).theme).toBe(1);
    expect(mineFloor(map.seed, 26).theme).toBe(2);
    expect(liftFloors(0)).toEqual([1]);
    expect(liftFloors(12)).toEqual([1, 5, 10]);
  });
});

describe('mining', () => {
  it('enters from the cave, mines rocks, finds the ladder and climbs back out', () => {
    const { state, p, ctx, events } = setup();
    const cave = caveEntrance(map);
    stand(p, cave.x, cave.y + 1);
    expect(interact(ctx, p, cave.x, cave.y)).toBeNull();
    expect(p.floor).toBe(1);
    expect(state.mine.deepest).toBe(1);
    expect(events.some((e) => e.t === 'warp')).toBe(true);
    const f = mineFloor(state.seed, 1);
    const rocks = state.mine.rocks[1];
    expect(Object.keys(rocks).length).toBeGreaterThan(20);

    addItem(p.inv, 'tool.pick', 1);
    const slot = p.inv.findIndex((s) => s?.id === 'tool.pick');
    let broken = 0;
    for (const key of Object.keys(rocks).map(Number)) {
      if (state.mine.ladders[1] !== undefined) break;
      p.stamina = 100;
      const x = key % f.w;
      const y = Math.floor(key / f.w);
      stand(p, x, y + 1);
      expect(useItem(ctx, p, slot, x, y)).toBeNull();
      broken++;
    }
    expect(broken).toBeGreaterThan(0);
    expect(countItem(p.inv, 'mat.stone')).toBeGreaterThan(0);
    const ladder = state.mine.ladders[1];
    expect(ladder).toBeDefined();
    const lx = ladder % f.w;
    const ly = Math.floor(ladder / f.w);
    stand(p, lx, ly + 1);
    expect(interact(ctx, p, lx, ly)).toBeNull();
    expect(p.floor).toBe(2);

    const f2 = mineFloor(state.seed, 2);
    stand(p, f2.up.x, f2.up.y + 1);
    expect(interact(ctx, p, f2.up.x, f2.up.y)).toBeNull();
    expect(p.floor).toBe(0);
  });

  it('the lift only goes to checkpoints already reached, and the mine resets overnight', () => {
    const { state, p, ctx, rng } = setup();
    const cave = caveEntrance(map);
    stand(p, cave.x, cave.y + 1);
    expect(rideLift(ctx, p, 5)).toMatch(/내려가 본 적/);
    state.mine.deepest = 7;
    expect(rideLift(ctx, p, 5)).toBeNull();
    expect(p.floor).toBe(5);
    advanceDay(state, map, rng, false);
    expect(p.floor).toBe(0);
    expect(state.mine.rocks).toEqual({});
    expect(state.mine.deepest).toBe(7);
  });

  it('migrates v4 saves', () => {
    const { state } = setup();
    const raw = JSON.parse(JSON.stringify({ version: 4, savedAt: 1, state }));
    delete raw.state.mine;
    for (const pl of Object.values(raw.state.players) as Array<Record<string, unknown>>) delete pl.floor;
    const file = migrateSave(raw);
    expect(file.state.mine).toEqual({ rocks: {}, ladders: {}, deepest: 0 });
    expect(Object.values(file.state.players)[0].floor).toBe(0);
  });
});
