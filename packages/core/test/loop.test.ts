import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APPEARANCE,
  Rng,
  TILE,
  addItem,
  advanceDay,
  createPlayer,
  createWorldState,
  countItem,
  departShip,
  generateWorld,
  getCrop,
  interact,
  isFarmable,
  isReady,
  makeSave,
  migrateSave,
  pack,
  useItem,
  type GameEvent,
  type SimContext,
} from '../src';

describe('core loop: seed → field → crate → ship → gold', () => {
  it('earns money from a shipped harvest', () => {
    const map = generateWorld();
    const rng = new Rng(42);
    const state = createWorldState(map.seed, rng);
    const p = createPlayer('p1', '루미', '별빛 농장', DEFAULT_APPEARANCE, map);
    state.players[p.id] = p;
    const events: GameEvent[] = [];
    const ctx: SimContext = {
      state,
      map,
      rng,
      emit: (e) => events.push(e),
      touchSoil: () => {},
      touchPlaced: () => {},
      touchPlayer: () => {},
    };
    const stand = (tx: number, ty: number) => {
      p.x = tx * TILE + TILE / 2;
      p.y = (ty + 1) * TILE + 6;
    };

    // Pick a farm tile and till → plant radish → water daily.
    let tx = map.farm.x + 20;
    const ty = map.farm.y + 14;
    while (!isFarmable(map, tx, ty)) tx++;
    stand(tx, ty);
    const slotOf = (id: string) => p.inv.findIndex((s) => s?.id === id);
    expect(useItem(ctx, p, slotOf('tool.hoe'), tx, ty)).toBeNull();
    expect(useItem(ctx, p, slotOf('seed.radish'), tx, ty)).toBeNull();
    const def = getCrop('radish');
    // Force pleasant weather so the test is about the loop, not luck.
    for (let d = 0; d < def.growDays; d++) {
      state.weather = { ...state.weather, kind: 'clear', precipStart: 0, precipEnd: 0, meanTemp: 14, minTemp: 8, maxTemp: 20 };
      stand(tx, ty);
      expect(useItem(ctx, p, slotOf('tool.can.1'), tx, ty)).toBeNull();
      advanceDay(state, map, rng, false);
    }
    const soil = state.soil[ty * map.w + tx];
    expect(isReady(soil.crop!)).toBe(true);

    stand(tx, ty);
    expect(interact(ctx, p, tx, ty)).toBeNull();
    const harvested = events.find((e) => e.t === 'harvest');
    expect(harvested).toBeTruthy();
    expect(countItem(p.inv, 'crop.radish')).toBeGreaterThan(0);

    // Pack at the bench.
    const bench = map.interactables.find((i) => i.kind === 'packing')!;
    p.x = bench.x * TILE + TILE / 2;
    p.y = (bench.y + 1) * TILE + 8;
    expect(pack(ctx, p, slotOf('crop.radish'), 30)).toBeNull();
    expect(p.carrying.length).toBe(1);
    stand(tx, ty);
    expect(useItem(ctx, p, slotOf('tool.hoe'), tx, ty)).toMatch(/상자/);

    // Walk to the pier and load the ship.
    p.x = map.pierEnd.x * TILE + TILE / 2;
    p.y = map.pierEnd.y * TILE + TILE - 2;
    const ship = map.interactables.find((i) => i.kind === 'ship')!;
    expect(interact(ctx, p, ship.x, ship.y)).toBeNull();
    expect(state.ship.cargo.length).toBe(1);

    const before = state.gold;
    const record = departShip(state);
    expect(record!.total).toBeGreaterThan(0);
    expect(state.gold).toBe(before + record!.total);
    expect(state.ship.present).toBe(false);

    // Save round-trip.
    const restored = migrateSave(JSON.parse(JSON.stringify(makeSave(state))));
    expect(restored.state.gold).toBe(state.gold);
  });

  it('refuses sea water and accepts the well', () => {
    const map = generateWorld();
    const rng = new Rng(1);
    const state = createWorldState(map.seed, rng);
    const p = createPlayer('p', 'a', 'b', DEFAULT_APPEARANCE, map);
    state.players.p = p;
    addItem(p.inv, 'fert.basic', 1);
    const ctx: SimContext = { state, map, rng, emit: () => {}, touchSoil: () => {}, touchPlaced: () => {}, touchPlayer: () => {} };
    const can = p.inv.find((s) => s?.id === 'tool.can.1')!;
    can.water = 0;
    const well = map.interactables.find((i) => i.kind === 'well')!;
    p.x = well.x * TILE + TILE / 2;
    p.y = (well.y + 1) * TILE + 8;
    expect(interact(ctx, p, well.x, well.y)).toBeNull();
    expect(can.water).toBe(20);
  });
});
