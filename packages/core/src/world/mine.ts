import { Rng, hash2 } from '../math/rng';
import { valueNoise } from '../math/noise';

/** The old mine under the quarry: procedurally dug floors, deeper = colder, then hotter, and richer. */
export const MINE_W = 46;
export const MINE_H = 36;
export const MINE_DEPTH = 30;
/** Every this-many floors the lift at the entrance can take you straight down. */
export const LIFT_STEP = 5;

export const MineCell = { Wall: 0, Floor: 1, Water: 2, Lava: 3 } as const;
export type MineCellId = (typeof MineCell)[keyof typeof MineCell];

/** 0 earthy galleries (1–9), 1 frost caverns (10–19), 2 ember depths (20–30). */
export type MineTheme = 0 | 1 | 2;
export const MINE_THEME_NAME = ['흙빛 갱도', '서리 동굴', '불씨 심층'] as const;

export function mineTheme(floor: number): MineTheme {
  return floor < 10 ? 0 : floor < 20 ? 1 : 2;
}

export type MinePropKind = 'torch' | 'beam' | 'crystal' | 'stalagmite' | 'mushroom' | 'crate' | 'cart' | 'bones' | 'icicle' | 'vent';

export interface MineProp {
  kind: MinePropKind;
  x: number;
  y: number;
  v: number;
}

export interface MineFloor {
  floor: number;
  theme: MineTheme;
  w: number;
  h: number;
  cells: Uint8Array;
  /** Walls, pools and solid props. */
  solid: Uint8Array;
  /** The ladder back up (the player arrives on the tile below it). */
  up: { x: number; y: number };
  /** Floor tiles where rocks may appear, nearest to the ladder first excluded. */
  spots: number[];
  props: MineProp[];
}

/** Props that block movement. */
const SOLID_PROPS = new Set<MinePropKind>(['stalagmite', 'crate', 'cart']);

function carve(rng: Rng, seed: number, floor: number): Uint8Array {
  const w = MINE_W;
  const h = MINE_H;
  let g = new Uint8Array(w * h);
  // Open caverns get roomier the deeper you go.
  const open = 0.53 + Math.min(0.06, floor * 0.002);
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const bias = (valueNoise(x / 7, y / 7, seed + floor * 31) - 0.5) * 0.3;
      g[y * w + x] = rng.next() < open + bias ? MineCell.Floor : MineCell.Wall;
    }
  for (let it = 0; it < 5; it++) {
    const n = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        let walls = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[(y + dy) * w + x + dx] === MineCell.Wall) walls++;
        n[y * w + x] = walls >= 5 ? MineCell.Wall : MineCell.Floor;
      }
    for (let x = 0; x < w; x++) n[x] = n[(h - 1) * w + x] = MineCell.Wall;
    for (let y = 0; y < h; y++) n[y * w] = n[y * w + w - 1] = MineCell.Wall;
    g = n;
  }
  return g;
}

function flood(g: Uint8Array, start: number, pass: (c: number) => boolean): Uint8Array {
  const w = MINE_W;
  const seen = new Uint8Array(g.length);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const k = stack.pop()!;
    for (const d of [-1, 1, -w, w]) {
      const n = k + d;
      if (n < 0 || n >= g.length || seen[n] || !pass(g[n])) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }
  return seen;
}

/** Deterministic layout of one mine floor (the same for every player and every visit). */
export function generateMineFloor(seed: number, floor: number): MineFloor {
  const w = MINE_W;
  const h = MINE_H;
  const theme = mineTheme(floor);
  for (let attempt = 0; ; attempt++) {
    const rng = new Rng((seed ^ Math.imul(floor + 1, 0x9e3779b1) ^ Math.imul(attempt + 1, 0x85ebca6b)) >>> 0);
    const g = carve(rng, seed + attempt * 7, floor);
    // The ladder up stands against a back wall, somewhere in the upper half.
    const cands: number[] = [];
    for (let y = 3; y < h / 2; y++)
      for (let x = 4; x < w - 4; x++) {
        const k = y * w + x;
        if (g[k] === MineCell.Floor && g[k - w] === MineCell.Wall && g[k + w] === MineCell.Floor && g[k + w - 1] === MineCell.Floor && g[k + w + 1] === MineCell.Floor) cands.push(k);
      }
    if (!cands.length) continue;
    const upK = cands[rng.int(0, cands.length - 1)];
    const reach = flood(g, upK, (c) => c === MineCell.Floor);
    let count = 0;
    for (let k = 0; k < g.length; k++) {
      if (g[k] === MineCell.Floor && !reach[k]) g[k] = MineCell.Wall;
      if (reach[k]) count++;
    }
    if (count < 420 && attempt < 12) continue;
    const up = { x: upK % w, y: Math.floor(upK / w) };

    // Pools: still water up top and in the frost caves, lava down in the ember depths.
    const pool = theme === 2 ? MineCell.Lava : MineCell.Water;
    for (let y = 2; y < h - 2; y++)
      for (let x = 2; x < w - 2; x++) {
        const k = y * w + x;
        if (g[k] !== MineCell.Floor || Math.hypot(x - up.x, y - up.y) < 7) continue;
        let ring = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[(y + dy) * w + x + dx] !== MineCell.Wall) ring++;
        if (ring === 9 && valueNoise(x / 4, y / 4, seed + floor * 13 + 5) > (theme === 1 ? 0.7 : 0.74)) g[k] = pool;
      }
    // Keep only floor still reachable around the pools.
    const reach2 = flood(g, upK + w, (c) => c === MineCell.Floor);
    for (let k = 0; k < g.length; k++) if (g[k] === MineCell.Floor && !reach2[k] && k !== upK) g[k] = MineCell.Wall;

    const solid = new Uint8Array(w * h);
    for (let k = 0; k < g.length; k++) solid[k] = g[k] === MineCell.Floor ? 0 : 1;
    solid[upK] = 1;

    // Props.
    const props: MineProp[] = [];
    const taken = new Set<number>([upK, upK + w, upK + w - 1, upK + w + 1, upK + 2 * w]);
    const v = (x: number, y: number, s: number) => Math.floor(hash2(x, y, seed + floor * 101 + s) * 1000);
    // Wall-mounted things go on tiles of floor directly under a wall face.
    const torches: Array<[number, number]> = [];
    for (let y = 2; y < h - 1; y++)
      for (let x = 2; x < w - 2; x++) {
        const k = y * w + x;
        if (g[k] !== MineCell.Floor || g[k - w] !== MineCell.Wall || taken.has(k)) continue;
        const r = hash2(x, y, seed + floor * 17);
        if (r < 0.2 && torches.every(([tx, ty]) => Math.hypot(tx - x, ty - y) > 7)) {
          props.push({ kind: 'torch', x, y: y - 1, v: v(x, y, 1) });
          torches.push([x, y]);
        } else if (theme === 0 && r > 0.9 && g[k + 1] === MineCell.Floor && g[k + 1 - w] === MineCell.Wall) {
          props.push({ kind: 'beam', x, y: y - 1, v: v(x, y, 2) });
          taken.add(k + 1);
        } else if (theme > 0 && r > 0.86) props.push({ kind: 'crystal', x, y: y - 1, v: v(x, y, 3) });
        else if (theme === 1 && r > 0.72 && r < 0.8) props.push({ kind: 'icicle', x, y: y - 1, v: v(x, y, 4) });
      }
    // Floor clutter.
    const floorTiles: number[] = [];
    for (let k = 0; k < g.length; k++) if (g[k] === MineCell.Floor && !taken.has(k)) floorTiles.push(k);
    const scatter = (kind: MinePropKind, n: number, near?: boolean) => {
      for (let i = 0, tries = 0; i < n && tries < 200; tries++) {
        const k = floorTiles[rng.int(0, floorTiles.length - 1)];
        const x = k % w;
        const y = Math.floor(k / w);
        if (taken.has(k) || (near ? Math.hypot(x - up.x, y - up.y) > 8 : Math.hypot(x - up.x, y - up.y) < 5)) continue;
        // Solid props never close a corridor: they need open floor all around.
        if (SOLID_PROPS.has(kind)) {
          let open = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[(y + dy) * w + x + dx] === MineCell.Floor && !taken.has((y + dy) * w + x + dx)) open++;
          if (open < 9) continue;
          solid[k] = 1;
        }
        taken.add(k);
        props.push({ kind, x, y, v: v(x, y, 10 + i) });
        i++;
      }
    };
    scatter('stalagmite', 5 + rng.int(0, 4));
    if (theme === 0) {
      scatter('mushroom', 5);
      scatter('crate', 2, true);
      scatter('cart', 1, true);
    } else if (theme === 1) scatter('mushroom', 3);
    else {
      scatter('bones', 3);
      scatter('vent', 4);
    }

    const spots: number[] = [];
    for (let k = 0; k < g.length; k++) {
      if (g[k] !== MineCell.Floor || taken.has(k) || solid[k]) continue;
      const x = k % w;
      const y = Math.floor(k / w);
      if (Math.abs(x - up.x) <= 2 && y >= up.y && y <= up.y + 3) continue;
      spots.push(k);
    }
    props.sort((a, b) => a.y - b.y);
    return { floor, theme, w, h, cells: g, solid, up, spots, props };
  }
}

const cache = new Map<string, MineFloor>();
/** Cached floor layout (floors are regenerated identically from the world seed). */
export function mineFloor(seed: number, floor: number): MineFloor {
  const key = `${seed}:${floor}`;
  let f = cache.get(key);
  if (!f) {
    f = generateMineFloor(seed, floor);
    cache.set(key, f);
    if (cache.size > 12) cache.delete(cache.keys().next().value!);
  }
  return f;
}

/** Floors the lift at the entrance can reach, given the deepest floor visited. */
export function liftFloors(deepest: number): number[] {
  const out = [1];
  for (let f = LIFT_STEP; f <= Math.min(deepest, MINE_DEPTH); f += LIFT_STEP) out.push(f);
  return out;
}
