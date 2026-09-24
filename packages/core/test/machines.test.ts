import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APPEARANCE,
  Rng,
  TILE,
  addItem,
  advanceDay,
  countItem,
  createPlayer,
  createWorldState,
  generateWorld,
  getItem,
  interact,
  migrateSave,
  newCrop,
  newSoil,
  nowAbs,
  pack,
  reachable,
  useItem,
  type GameEvent,
  type PlayerState,
  type SimContext,
  type WorldState,
} from '../src';
import { craft, chestMove } from '../src/sim/machines';

const map = generateWorld();

function setup(seed = 3) {
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
  p.y = (ty + 1) * TILE + 6;
};

/** An open farm tile next to (x, y) with nothing on it. */
function clearTile(state: WorldState, x: number, y: number) {
  delete state.debris[y * map.w + x];
  delete state.soil[y * map.w + x];
}

describe('quarry, crafting and machines', () => {
  it('fills the quarry with outcrops the pickaxe can break', () => {
    const { state, p, ctx } = setup();
    const keys = Object.keys(state.nodes).map(Number);
    expect(keys.length).toBeGreaterThanOrEqual(10);
    addItem(p.inv, 'tool.pick', 1);
    const slot = p.inv.findIndex((s) => s?.id === 'tool.pick');
    const k = keys[0];
    const x = k % map.w;
    const y = (k - x) / map.w;
    stand(p, x, y);
    // Everything in the quarry is reachable on foot from home.
    const seen = reachable(map.w, map.h, map.spawn.x, map.spawn.y, (xx, yy) => !map.solid[yy * map.w + xx]);
    expect(seen[(y + 1) * map.w + x] || seen[(y - 1) * map.w + x] || seen[y * map.w + x + 1] || seen[y * map.w + x - 1]).toBeTruthy();
    const before = p.inv.filter(Boolean).length;
    expect(useItem(ctx, p, slot, x, y)).toBeNull();
    expect(state.nodes[k]).toBeUndefined();
    expect(p.inv.filter(Boolean).length).toBeGreaterThan(before);
    // Next morning the quarry is topped up again.
    advanceDay(state, map, ctx.rng, false);
    expect(Object.keys(state.nodes).length).toBeGreaterThanOrEqual(keys.length);
  });

  it('crafts a furnace at the workbench and smelts copper', () => {
    const { state, p, ctx } = setup();
    const bench = map.interactables.find((i) => i.kind === 'workbench')!;
    stand(p, bench.x, bench.y + 1);
    expect(craft(ctx, p, 'furnace')).toMatch(/부족/);
    addItem(p.inv, 'mat.stone', 25);
    addItem(p.inv, 'ore.copper', 15);
    addItem(p.inv, 'mat.coal', 2);
    expect(craft(ctx, p, 'furnace')).toBeNull();
    expect(countItem(p.inv, 'place.furnace')).toBe(1);
    expect(countItem(p.inv, 'ore.copper')).toBe(5);

    // Place it on open farm ground and feed it ore.
    const x = map.farm.x + 10;
    const y = map.farm.y + 12;
    clearTile(state, x, y);
    stand(p, x, y + 1);
    expect(useItem(ctx, p, p.inv.findIndex((s) => s?.id === 'place.furnace'), x, y)).toBeNull();
    const furnace = state.placed.find((o) => o.kind === 'furnace')!;
    expect(useItem(ctx, p, p.inv.findIndex((s) => s?.id === 'ore.copper'), x, y)).toBeNull();
    expect(furnace.work?.out[0].id).toBe('bar.copper');
    expect(interact(ctx, p, x, y)).toMatch(/남음/);
    state.clock.minute += 130;
    expect(interact(ctx, p, x, y)).toBeNull();
    expect(countItem(p.inv, 'bar.copper')).toBe(1);
    expect(furnace.work).toBeNull();
  });

  it('turns fruit into jam worth more than the fruit, and ships it', () => {
    const { state, p, ctx } = setup();
    const x = map.farm.x + 14;
    const y = map.farm.y + 12;
    clearTile(state, x, y);
    state.placed.push({ id: 99, kind: 'jar', x, y });
    addItem(p.inv, 'crop.strawberry', 3, 2);
    stand(p, x, y + 1);
    const slot = p.inv.findIndex((s) => s?.id === 'crop.strawberry');
    expect(useItem(ctx, p, slot, x, y)).toBeNull();
    const jar = state.placed.find((o) => o.id === 99)!;
    const jam = jar.work!.out[0].id;
    expect(jam).toBe('artisan.jam.crop.strawberry');
    expect(getItem(jam).name).toBe('딸기 잼');
    state.clock.day += 2;
    expect(interact(ctx, p, x, y)).toBeNull();
    expect(countItem(p.inv, jam)).toBe(1);
    // Pack it at the bench and it becomes cargo like any crop.
    const packing = map.interactables.find((i) => i.kind === 'packing')!;
    stand(p, packing.x, packing.y + 1);
    expect(pack(ctx, p, p.inv.findIndex((s) => s?.id === jam), 1)).toBeNull();
    expect(p.carrying[0].cropId).toBe(jam);
    expect(getItem(jam).price).toBeGreaterThan(2 * 20);
  });

  it('bees make flower honey, and the auto-harvester gathers ripe crops', () => {
    const { state, p, ctx } = setup(5);
    const x = map.farm.x + 20;
    const y = map.farm.y + 14;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) clearTile(state, x + dx, y + dy);
    state.placed.push({ id: 1, kind: 'beehouse', x, y });
    state.placed.push({ id: 2, kind: 'harvester', x: x + 1, y: y + 1 });
    // Lavender in bloom next to the hive, radishes ripe next to the harvester.
    const lav = newSoil();
    lav.crop = newCrop('lavender', 0);
    lav.crop.growth = 99;
    state.soil[y * map.w + x - 1] = lav;
    const rad = newSoil();
    rad.crop = newCrop('radish', 0);
    rad.crop.growth = 99;
    state.soil[(y + 2) * map.w + x + 2] = rad;
    for (let d = 0; d < 3; d++) advanceDay(state, map, ctx.rng, false);
    const hive = state.placed.find((o) => o.id === 1)!;
    expect(hive.work?.out[0].id).toBe('artisan.honey.crop.lavender');
    const harvester = state.placed.find((o) => o.id === 2)!;
    expect(harvester.store?.some((s) => s?.id === 'crop.radish')).toBe(true);
    stand(p, x, y + 1);
    expect(interact(ctx, p, x + 1, y + 1)).toBeNull();
    expect(countItem(p.inv, 'crop.radish')).toBeGreaterThan(0);
    expect(nowAbs(state)).toBeGreaterThan(0);
  });

  it('stores and retrieves from a chest; old saves migrate', () => {
    const { state, p, ctx } = setup();
    const x = map.farm.x + 6;
    const y = map.farm.y + 16;
    clearTile(state, x, y);
    state.placed.push({ id: 7, kind: 'chest', x, y });
    stand(p, x, y + 1);
    const slot = p.inv.findIndex((s) => s?.id === 'seed.radish');
    expect(chestMove(ctx, p, 7, 'inv', slot)).toBeNull();
    expect(p.inv[slot]).toBeNull();
    const chest = state.placed.find((o) => o.id === 7)!;
    expect(chest.store?.[0]?.id).toBe('seed.radish');
    expect(chestMove(ctx, p, 7, 'chest', 0)).toBeNull();
    expect(countItem(p.inv, 'seed.radish')).toBe(12);

    const old = { version: 3, savedAt: 0, state: { ...state, version: 3, nodes: undefined } };
    expect(migrateSave(JSON.parse(JSON.stringify(old))).state.nodes).toEqual({});
  });
});
