import { describe, expect, it } from 'vitest';
import { Terrain, TILE, generateWorld, isFarmable, isWater, reachable } from '../src';

describe('island generation', () => {
  const map = generateWorld();

  it('is deterministic', () => {
    const again = generateWorld();
    expect(Buffer.from(again.terrain).equals(Buffer.from(map.terrain))).toBe(true);
    expect(again.objects.length).toBe(map.objects.length);
  });

  it('places every key location', () => {
    const kinds = map.buildings.map((b) => b.kind);
    for (const k of ['house', 'seedShop', 'toolShop', 'lighthouse', 'windmill']) expect(kinds).toContain(k);
    const ik = map.interactables.map((i) => i.kind);
    for (const k of ['seedShop', 'toolShop', 'ship', 'packing', 'bed', 'well']) expect(ik).toContain(k);
  });

  it('can reach every interactable on foot from the spawn point', () => {
    const seen = reachable(map.w, map.h, map.spawn.x, map.spawn.y, (x, y) => !map.solid[y * map.w + x]);
    for (const it of map.interactables) {
      let ok = false;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]])
        if (seen[(it.y + dy) * map.w + it.x + dx]) ok = true;
      expect(ok, `${it.kind} at ${it.x},${it.y}`).toBe(true);
    }
  });

  it('has a big farm and a ship floating on water', () => {
    let farmable = 0;
    for (let y = map.farm.y; y < map.farm.y + map.farm.h; y++)
      for (let x = map.farm.x; x < map.farm.x + map.farm.w; x++) if (isFarmable(map, x, y)) farmable++;
    expect(farmable).toBeGreaterThan(600);
    for (let y = map.ship.y; y < map.ship.y + map.ship.h; y++)
      for (let x = map.ship.x; x < map.ship.x + map.ship.w; x++) expect(isWater(map.terrain[y * map.w + x])).toBe(true);
    expect(map.terrain[map.pierEnd.y * map.w + map.pierEnd.x]).toBe(Terrain.Dock);
  });

  it('keeps the seed shop on the way from farm to harbour', () => {
    const seed = map.buildings.find((b) => b.kind === 'seedShop')!;
    const tool = map.buildings.find((b) => b.kind === 'toolShop')!;
    expect(seed.x).toBeLessThan(tool.x);
    expect(seed.x).toBeGreaterThan(map.farm.x + map.farm.w);
    expect(Math.abs(seed.x - map.pierEnd.x) * TILE).toBeLessThan(40 * TILE);
  });

  it('has fresh water near the farm', () => {
    let fresh = 0;
    for (let i = 0; i < map.terrain.length; i++) if (map.terrain[i] === Terrain.Pond || map.terrain[i] === Terrain.River) fresh++;
    expect(fresh).toBeGreaterThan(100);
  });
});
