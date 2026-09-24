export const TILE = 16;

/** Terrain ids stored in `WorldMap.terrain`. */
export const Terrain = {
  Deep: 0,
  Sea: 1,
  Sand: 2,
  Grass: 3,
  Forest: 4,
  Meadow: 5,
  Path: 6,
  Cobble: 7,
  Rock: 8,
  Dock: 9,
  Bridge: 10,
  River: 11,
  Pond: 12,
  /** Vertical rock face below a plateau edge (solid). */
  Cliff: 13,
  /** Stone steps cut into a cliff face where a road climbs. */
  Stairs: 14,
} as const;
export type TerrainId = (typeof Terrain)[keyof typeof Terrain];

export const Zone = {
  None: 0,
  Farm: 1,
  Village: 2,
  Harbor: 3,
  Forest: 4,
  Meadow: 5,
  Beach: 6,
  Cape: 7,
  Ruins: 8,
  Orchard: 9,
  Camp: 10,
  Falls: 11,
} as const;
export type ZoneId = (typeof Zone)[keyof typeof Zone];

export const ZONE_NAME: Record<ZoneId, string> = {
  0: '루미나 섬',
  1: '나의 농장',
  2: '마을 광장',
  3: '항구',
  4: '속삭이는 숲',
  5: '별빛 언덕',
  6: '노을 해변',
  7: '등대 곶',
  8: '잊힌 유적',
  9: '햇살 과수원',
  10: '숲속 야영지',
  11: '은빛 폭포',
};

export function isWater(t: number): boolean {
  return t === Terrain.Deep || t === Terrain.Sea || t === Terrain.River || t === Terrain.Pond;
}

/** Fresh water can refill a watering can; sea water cannot. */
export function isFreshWater(t: number): boolean {
  return t === Terrain.River || t === Terrain.Pond;
}

export function isWalkableTerrain(t: number): boolean {
  return !isWater(t);
}
