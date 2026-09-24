import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, Rng, TILE, advanceDay, canTill, createPlayer, createWorldState, generateWorld, migrateSave, useItem, type SimContext } from '../src';

describe('farm debris', () => {
  const map = generateWorld();

  it('starts the farm overgrown, and clearing a tile lets you till it', () => {
    const rng = new Rng(7);
    const state = createWorldState(map.seed, rng, map);
    const keys = Object.keys(state.debris).map(Number);
    expect(keys.length).toBeGreaterThan(40);
    const kinds = new Set(Object.values(state.debris));
    for (const k of ['weed', 'stone', 'twig']) expect(kinds.has(k as 'weed')).toBe(true);

    const p = createPlayer('p1', '루미', '별빛 농장', DEFAULT_APPEARANCE, map);
    state.players[p.id] = p;
    let cleared = 0;
    const ctx: SimContext = { state, map, rng, emit: () => {}, touchSoil: () => {}, touchPlaced: () => {}, touchPlayer: () => {}, touchDebris: () => cleared++ };
    const stone = keys.find((k) => state.debris[k] === 'stone')!;
    const x = stone % map.w;
    const y = (stone - x) / map.w;
    expect(canTill(state, map, x, y)).toBe(false);
    p.x = x * TILE + TILE / 2;
    p.y = (y + 1) * TILE + 6;
    // The scythe can't move a stone; the hoe can.
    expect(useItem(ctx, p, 2, x, y)).toMatch(/괭이/);
    expect(useItem(ctx, p, 0, x, y)).toBeNull();
    expect(state.debris[stone]).toBeUndefined();
    expect(cleared).toBe(1);
    expect(canTill(state, map, x, y)).toBe(true);
  });

  it('lets a few weeds creep back overnight, and migrates old saves', () => {
    const rng = new Rng(8);
    const state = createWorldState(map.seed, rng, map);
    state.debris = {};
    for (let d = 0; d < 5; d++) advanceDay(state, map, rng, false);
    const n = Object.keys(state.debris).length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(60);

    const old = { version: 2, savedAt: 0, state: { ...state, version: 2, debris: undefined } };
    const file = migrateSave(JSON.parse(JSON.stringify(old)));
    expect(file.state.debris).toEqual({});
  });
});
