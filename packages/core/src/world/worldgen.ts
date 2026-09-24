import { fbm, valueNoise } from '../math/noise';
import { Rng, hash2 } from '../math/rng';
import { astar } from './path';
import { chaikin, simplify, strokeBounds, strokeDistance, type Stroke } from './polyline';
import { Terrain, Zone, isWater } from './tiles';
import type { Building, BuildingKind, Interactable, ObjectKind, Rect, WorldMap, WorldObject } from './types';

export const WORLD_W = 240;
export const WORLD_H = 180;
/** The shared, canonical island. Every player sails to the same Lumina Isle. */
export const DEFAULT_WORLD_SEED = 20260923;

const SOLID_OBJECTS: ReadonlySet<ObjectKind> = new Set<ObjectKind>([
  'oak',
  'pine',
  'blossom',
  'palm',
  'bush',
  'rock',
  'boulder',
  'stump',
  'lamp',
  'fence',
  'bench',
  'well',
  'fountain',
  'sign',
  'flowerpot',
  'crate',
  'barrel',
  'bollard',
  'packbench',
  'mailbox',
  'log',
  'boat',
  'netrack',
  'fishcrate',
  'anchor',
  'stall',
  'laundry',
  'haybale',
  'scarecrow',
  'beehive',
  'telescope',
  'board',
  'fruittree',
  'tent',
  'campfire',
  'logseat',
  'woodpile',
  'ruin',
  'shrine',
  'tidepool',
  'gazebo',
  'parasol',
  'sandcastle',
  'buoy',
  'workbench',
  'cave',
  'minecart',
  'orepile',
]);

export function isSolidObject(kind: ObjectKind): boolean {
  return SOLID_OBJECTS.has(kind);
}

/**
 * Generates Lumina Isle: a noise-shaped island with hand-placed anchors
 * (farm, village plaza, harbour bay, lighthouse cape, river, forest, meadow).
 * Pure and deterministic — server and client produce identical maps from the same seed.
 */
export function generateWorld(seed: number = DEFAULT_WORLD_SEED): WorldMap {
  const W = WORLD_W;
  const H = WORLD_H;
  const N = W * H;
  const rng = new Rng(seed);
  const terrain = new Uint8Array(N);
  const elev = new Float32Array(N);
  const zone = new Uint8Array(N);
  const solid = new Uint8Array(N);
  const objects: WorldObject[] = [];
  const buildings: Building[] = [];
  const interactables: Interactable[] = [];
  /** Tiles reserved by structures / roads so decoration never lands on them. */
  const reserved = new Uint8Array(N);

  const idx = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const T = (x: number, y: number) => (inb(x, y) ? terrain[idx(x, y)] : Terrain.Deep);
  const setT = (x: number, y: number, t: number) => {
    if (inb(x, y)) terrain[idx(x, y)] = t;
  };

  // ── Anchors ────────────────────────────────────────────────────────────
  const farm: Rect = { x: 62, y: 66, w: 36, h: 24 };
  const plaza: Rect = { x: 139, y: 97, w: 22, h: 14 };
  const meadowC = { x: 180, y: 54 };
  const forestC = { x: 108, y: 30 };
  const beachC = { x: 52, y: 138 };
  const harborBay = { x: 152, y: 152 };

  const bumps: Array<[number, number, number, number]> = [
    // x, y, sigma, strength
    [farm.x + farm.w / 2, farm.y + farm.h / 2, 24, 0.32],
    [plaza.x + plaza.w / 2, plaza.y + plaza.h / 2, 20, 0.3],
    [meadowC.x, meadowC.y, 16, 0.25],
    [forestC.x, forestC.y, 26, 0.28],
    [70, 120, 18, 0.2],
    // Lighthouse cape — a chain of bumps reaching east.
    [196, 80, 10, 0.3],
    [208, 78, 7, 0.34],
    [218, 77, 5, 0.36],
    // Harbour bay — carve the coast in towards the plaza.
    [harborBay.x, harborBay.y, 13, -0.55],
    [harborBay.x + 4, harborBay.y + 14, 16, -0.4],
  ];

  // ── 1. Elevation & base terrain ────────────────────────────────────────
  const cx = 120;
  const cy = 92;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / 104;
      const dy = (y - cy) / 76;
      const d = Math.sqrt(dx * dx + dy * dy);
      let e = 1 - d + (fbm(x / 26, y / 26, seed, 5) - 0.5) * 0.6;
      for (const [bx, by, s, k] of bumps) {
        const q = ((x - bx) ** 2 + (y - by) ** 2) / (2 * s * s);
        e += k * Math.exp(-q);
      }
      elev[idx(x, y)] = e;
      const beachy = Math.hypot(x - beachC.x, y - beachC.y) < 34 ? 0.1 : 0;
      let t: number;
      if (e < -0.05) t = Terrain.Deep;
      else if (e < 0.04) t = Terrain.Sea;
      else if (e < 0.09 + beachy) t = Terrain.Sand;
      else t = Terrain.Grass;
      terrain[idx(x, y)] = t;
    }
  }

  // Remove tiny islets / specks so the coast reads cleanly.
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        let land = 0;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (!isWater(T(x + ox, y + oy))) land++;
        const t = T(x, y);
        if (!isWater(t) && land <= 3) setT(x, y, Terrain.Sea);
        else if (isWater(t) && land >= 7) setT(x, y, Terrain.Sand);
      }
    }
  }

  // Tidy the beach: lone grass tufts on sand become sand, lone sand patches in grass become grass.
  for (let pass = 0; pass < 2; pass++)
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const t = T(x, y);
        if (t !== Terrain.Grass && t !== Terrain.Sand) continue;
        let same = 0;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if ((ox || oy) && T(x + ox, y + oy) === t) same++;
        if (same <= 2) setT(x, y, t === Terrain.Grass ? Terrain.Sand : Terrain.Grass);
      }

  // ── 2. Forest & meadow floors ──────────────────────────────────────────
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (T(x, y) !== Terrain.Grass) continue;
      const north = (62 - y) / 60;
      const f = fbm(x / 18, y / 18, seed + 7, 3) + north * 0.55;
      if (f > 0.78) {
        setT(x, y, Terrain.Forest);
        zone[idx(x, y)] = Zone.Forest;
      }
      const md = Math.hypot(x - meadowC.x, (y - meadowC.y) * 1.2) + (valueNoise(x / 5, y / 5, seed + 3) - 0.5) * 8;
      if (md < 15) {
        setT(x, y, Terrain.Meadow);
        zone[idx(x, y)] = Zone.Meadow;
      }
      if (Math.hypot(x - beachC.x, y - beachC.y) < 34) zone[idx(x, y)] = Zone.Beach;
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (T(x, y) === Terrain.Sand && Math.hypot(x - beachC.x, y - beachC.y) < 40) zone[idx(x, y)] = Zone.Beach;

  // ── 2b. Plateaus: Starlight Hill and the northern forest ridge ─────────
  const level = new Uint8Array(N);
  const lv = (x: number, y: number) => (inb(x, y) ? level[idx(x, y)] : 0);
  const nearCoast = (x: number, y: number, r: number) => {
    for (let oy = -r; oy <= r; oy++)
      for (let ox = -r; ox <= r; ox++) {
        const t = T(x + ox, y + oy);
        if (t === Terrain.Sea || t === Terrain.Deep || t === Terrain.Sand) return true;
      }
    return false;
  };
  {
    // Decide the shape on a coarse 3×3-tile grid so cliff runs are long and straight
    // (like hand-built cliffs), then round the corners at tile resolution.
    const CELL = 3;
    const cellOk = (cx: number, cy: number) => {
      const x = cx * CELL + 1;
      const y = cy * CELL + 1;
      const hill = Math.hypot((x - meadowC.x) / 1.25, y - meadowC.y + 1) + (fbm(x / 11, y / 11, seed + 61, 3) - 0.5) * 9 < 14;
      const ridgeY = 34 + (fbm(x / 22, 0.5, seed + 62, 2) - 0.5) * 12 - Math.max(0, 82 - x) * 1.3 - Math.max(0, x - 158) * 1.3;
      const ridge = x > 60 && x < 180 && y < ridgeY;
      if (!hill && !ridge) return false;
      for (let yy = cy * CELL; yy < cy * CELL + CELL; yy++) for (let xx = cx * CELL; xx < cx * CELL + CELL; xx++) if (nearCoast(xx, yy, 2)) return false;
      return true;
    };
    const cw = Math.ceil(W / CELL);
    const ch = Math.ceil(H / CELL);
    const cells = new Uint8Array(cw * ch);
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) cells[cy * cw + cx] = cellOk(cx, cy) ? 1 : 0;
    // Drop lonely cells and fill single-cell notches.
    for (let pass = 0; pass < 2; pass++)
      for (let cy = 1; cy < ch - 1; cy++)
        for (let cx = 1; cx < cw - 1; cx++) {
          const n = cells[cy * cw + cx - 1] + cells[cy * cw + cx + 1] + cells[(cy - 1) * cw + cx] + cells[(cy + 1) * cw + cx];
          if (cells[cy * cw + cx] && n <= 1) cells[cy * cw + cx] = 0;
          else if (!cells[cy * cw + cx] && n >= 3 && cellOk(cx, cy)) cells[cy * cw + cx] = 1;
        }
    const raw = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) raw[idx(x, y)] = cells[Math.floor(y / CELL) * cw + Math.floor(x / CELL)];
    // Round off outer corners (a tile with two open sides that meet).
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = idx(x, y);
        if (!raw[i]) continue;
        const l = raw[i - 1];
        const r = raw[i + 1];
        const u = raw[i - W];
        const d = raw[i + W];
        level[i] = (!l && !u) || (!r && !u) || (!l && !d) || (!r && !d) ? 0 : 1;
      }
  }

  // ── 3. River: a smooth stroke from a forest spring down to the sea ─────
  const rivers: Stroke[] = [];
  {
    const raw: Array<[number, number]> = [];
    for (let y = 18; y < H; y += 3) {
      const x = 121 + (fbm(y / 16, 3.7, seed + 99, 3) - 0.5) * 16;
      raw.push([x, y]);
      const t = T(Math.round(x), y);
      if ((t === Terrain.Sea || t === Terrain.Deep) && y > 60) {
        raw.push([x, y + 4]);
        break;
      }
    }
    const pts = simplify(chaikin(raw, 3), 0.5);
    // Where the river leaves the ridge it widens into a proper waterfall.
    let dropY = -1;
    for (const [x, y] of pts) {
      const rx = Math.round(x);
      const ry = Math.round(y);
      if (lv(rx, ry) && !lv(rx, ry + 1)) {
        dropY = ry + 1;
        break;
      }
    }
    const hw = pts.map(([, y]) => {
      const base = 0.95 + Math.min(1, Math.max(0, (y - 40) / 110)) * 0.75;
      return dropY > 0 && y > dropY - 3 && y < dropY + 4 ? Math.max(base, 1.75) : base;
    });
    const river: Stroke = { pts, hw };
    rivers.push(river);
    const b = strokeBounds(river);
    for (let y = Math.max(0, Math.floor(b.y0)); y <= Math.min(H - 1, Math.ceil(b.y1)); y++)
      for (let x = Math.max(0, Math.floor(b.x0)); x <= Math.min(W - 1, Math.ceil(b.x1)); x++) {
        if (strokeDistance(river, x + 0.5, y + 0.5) < 0) {
          const t = T(x, y);
          if (t === Terrain.Sea || t === Terrain.Deep) continue;
          setT(x, y, Terrain.River);
          zone[idx(x, y)] = Zone.None;
        }
      }
  }

  // Plunge pool below the waterfall.
  {
    const r = rivers[0];
    let fx = -1;
    let fy = -1;
    for (const [x, y] of r.pts) {
      const rx = Math.round(x);
      const ry = Math.round(y);
      if (lv(rx, ry - 1) && !lv(rx, ry)) {
        fx = x;
        fy = ry + 3;
        break;
      }
    }
    if (fx > 0)
      for (let y = fy - 1; y <= fy + 4; y++)
        for (let x = Math.floor(fx) - 5; x <= Math.ceil(fx) + 5; x++) {
          const d = Math.hypot((x + 0.5 - fx) / 1.35, y + 0.5 - (fy + 1.5)) + (valueNoise(x / 2, y / 2, seed + 12) - 0.5) * 1.2;
          if (d < 2.6 && !lv(x, y) && T(x, y) !== Terrain.River) setT(x, y, Terrain.Pond);
        }
  }

  // Farm pond — fresh water close to the fields.
  const pond = { x: farm.x + 4, y: farm.y + farm.h + 6 };
  for (let y = pond.y - 4; y <= pond.y + 4; y++)
    for (let x = pond.x - 6; x <= pond.x + 6; x++) {
      const d = Math.hypot((x - pond.x) / 1.4, y - pond.y) + (valueNoise(x / 2, y / 2, seed + 11) - 0.5) * 1.5;
      if (d < 3.4) setT(x, y, Terrain.Pond);
    }

  // ── 4. Farm and plaza ground ───────────────────────────────────────────
  for (let y = farm.y - 2; y < farm.y + farm.h + 2; y++)
    for (let x = farm.x - 2; x < farm.x + farm.w + 2; x++) {
      setT(x, y, Terrain.Grass);
      if (x >= farm.x && x < farm.x + farm.w && y >= farm.y && y < farm.y + farm.h) zone[idx(x, y)] = Zone.Farm;
      else zone[idx(x, y)] = Zone.None;
    }
  for (let y = plaza.y - 7; y < plaza.y + plaza.h + 5; y++)
    for (let x = plaza.x - 6; x < plaza.x + plaza.w + 8; x++) {
      if (isWater(T(x, y)) || T(x, y) === Terrain.Forest) setT(x, y, Terrain.Grass);
      zone[idx(x, y)] = Zone.Village;
    }
  for (let y = plaza.y; y < plaza.y + plaza.h; y++)
    for (let x = plaza.x; x < plaza.x + plaza.w; x++) {
      const corner =
        (x === plaza.x || x === plaza.x + plaza.w - 1) && (y === plaza.y || y === plaza.y + plaza.h - 1);
      if (!corner) setT(x, y, Terrain.Cobble);
    }

  // ── 4b. Cliff faces: three tiles of rock below every south-facing plateau edge ──
  const falls: number[] = [];
  for (let y = 1; y < H - 3; y++)
    for (let x = 1; x < W - 1; x++) {
      if (!lv(x, y) || lv(x, y + 1)) continue;
      for (let k = 1; k <= 3; k++) {
        if (lv(x, y + k)) break;
        const t = T(x, y + k);
        if (t === Terrain.River) {
          falls.push(idx(x, y + k));
          continue;
        }
        if (isWater(t)) break;
        setT(x, y + k, Terrain.Cliff);
      }
    }

  /** Cuts 3-wide stone steps into the straight stretch of cliff nearest to (tx, ty). */
  const placeStairs = (tx: number, ty: number) => {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (let y = 1; y < H - 5; y++)
      for (let x = 2; x < W - 5; x++) {
        let ok = true;
        for (let k = -1; k <= 3 && ok; k++) {
          const xx = x + k;
          if (!lv(xx, y - 1) || T(xx, y) !== Terrain.Cliff || T(xx, y + 1) !== Terrain.Cliff || T(xx, y + 2) !== Terrain.Cliff) ok = false;
          else if (k >= 0 && k <= 2 && (lv(xx, y + 3) || isWater(T(xx, y + 3)) || T(xx, y + 3) === Terrain.Cliff)) ok = false;
        }
        if (!ok) continue;
        const d = Math.hypot(x + 1 - tx, y + 1 - ty);
        if (d < bestD) {
          bestD = d;
          best = [x, y];
        }
      }
    if (!best) return null;
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) setT(best[0] + k, best[1] + j, Terrain.Stairs);
    return { x: best[0] + 1, y: best[1] };
  };
  const hillStairs = placeStairs(plaza.x + plaza.w - 2, plaza.y - 10);
  const ridgeStairs = placeStairs(forestC.x - 6, forestC.y + 10);

  // ── Helpers for structures ─────────────────────────────────────────────
  const reserve = (x: number, y: number, w = 1, h = 1) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (inb(xx, yy)) reserved[idx(xx, yy)] = 1;
  };
  const addBuilding = (kind: BuildingKind, x: number, y: number, w: number, h: number, doorDx: number | null) => {
    const b: Building = {
      id: `${kind}-${buildings.length}`,
      kind,
      x,
      y,
      w,
      h,
      door: doorDx === null ? null : { x: x + doorDx, y: y + h - 1 },
      v: rng.int(0, 999),
    };
    buildings.push(b);
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        if (isWater(T(xx, yy))) setT(xx, yy, Terrain.Grass);
        solid[idx(xx, yy)] = 1;
      }
    // Keep a margin clear of trees, plus the doorstep.
    reserve(x - 1, y - 2, w + 2, h + 3);
    return b;
  };
  const addObject = (kind: ObjectKind, x: number, y: number, w = 1, h = 1): WorldObject | null => {
    if (!inb(x, y)) return null;
    const o: WorldObject = { kind, x, y, v: Math.floor(hash2(x, y, seed) * 1000) };
    if (w !== 1) o.w = w;
    if (h !== 1) o.h = h;
    objects.push(o);
    reserve(x, y, w, h);
    if (isSolidObject(kind)) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (inb(xx, yy)) solid[idx(xx, yy)] = 1;
    return o;
  };

  // ── 5. Buildings ───────────────────────────────────────────────────────
  const house = addBuilding('house', farm.x + 2, farm.y + 1, 6, 4, 2);
  interactables.push({ kind: 'bed', x: house.door!.x, y: house.door!.y });
  const spawn = { x: house.door!.x, y: house.door!.y + 1 };

  addObject('packbench', house.x + house.w + 1, house.y + house.h - 1, 2, 1);
  interactables.push({ kind: 'packing', x: house.x + house.w + 1, y: house.y + house.h - 1 });
  interactables.push({ kind: 'packing', x: house.x + house.w + 2, y: house.y + house.h - 1 });
  addObject('well', house.x + house.w + 5, house.y + 2);
  interactables.push({ kind: 'well', x: house.x + house.w + 5, y: house.y + 2 });
  addObject('mailbox', house.x - 1, house.y + house.h);
  reserve(farm.x, farm.y, 18, 7);

  addBuilding('windmill', farm.x - 8, farm.y + farm.h - 9, 4, 4, 1);

  // The old glasshouse in the farm's north-east corner: walls are solid, the 7×4 inside is soil once restored.
  const greenhouse: Rect = { x: farm.x + farm.w - 10, y: farm.y, w: 9, h: 6 };
  for (let yy = greenhouse.y; yy < greenhouse.y + greenhouse.h; yy++)
    for (let xx = greenhouse.x; xx < greenhouse.x + greenhouse.w; xx++) {
      const wall = yy === greenhouse.y || yy === greenhouse.y + greenhouse.h - 1 || xx === greenhouse.x || xx === greenhouse.x + greenhouse.w - 1;
      if (wall && !(xx === greenhouse.x + 4 && yy === greenhouse.y + greenhouse.h - 1)) solid[idx(xx, yy)] = 1;
    }
  interactables.push({ kind: 'greenhouse', x: greenhouse.x + 4, y: greenhouse.y + greenhouse.h - 1 });
  reserve(greenhouse.x - 1, greenhouse.y, greenhouse.w + 2, greenhouse.h + 2);

  const seedShop = addBuilding('seedShop', plaza.x + 1, plaza.y - 4, 6, 4, 3);
  interactables.push({ kind: 'seedShop', x: seedShop.door!.x, y: seedShop.door!.y });
  addBuilding('cottage', plaza.x + 8, plaza.y - 4, 5, 4, 2);
  const toolShop = addBuilding('toolShop', plaza.x + plaza.w - 8, plaza.y - 5, 7, 5, 3);
  interactables.push({ kind: 'toolShop', x: toolShop.door!.x, y: toolShop.door!.y });
  addBuilding('cottage', plaza.x + plaza.w + 2, plaza.y + 2, 5, 4, 2);
  addBuilding('cottage', plaza.x + 2, plaza.y + plaza.h + 2, 5, 4, 2);

  reserve(plaza.x, plaza.y, plaza.w, plaza.h);
  const fx = plaza.x + Math.floor(plaza.w / 2) - 1;
  const fy = plaza.y + Math.floor(plaza.h / 2) - 1;
  addObject('fountain', fx, fy, 2, 2);

  // ── 5b. Workbench beside the house ─────────────────────────────────────
  addObject('workbench', house.x + house.w + 7, house.y + house.h - 1, 2, 1);
  interactables.push({ kind: 'workbench', x: house.x + house.w + 7, y: house.y + house.h - 1 });
  interactables.push({ kind: 'workbench', x: house.x + house.w + 8, y: house.y + house.h - 1 });

  // ── 5c. The old mine: a cave mouth in the ridge, a quarry floor at its foot ──
  let quarry: Rect = { x: 0, y: 0, w: 0, h: 0 };
  {
    // A straight stretch of ridge face, west of the stairs and clear of the falls.
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    const target = { x: farm.x + 22, y: farm.y - 26 };
    for (let y = 2; y < farm.y - 6; y++)
      for (let x = 3; x < W - 8; x++) {
        let ok = true;
        for (let k = -2; k <= 4 && ok; k++) {
          const xx = x + k;
          if (!lv(xx, y - 1) || T(xx, y) !== Terrain.Cliff || T(xx, y + 1) !== Terrain.Cliff || T(xx, y + 2) !== Terrain.Cliff) ok = false;
          else if (lv(xx, y + 3) || isWater(T(xx, y + 3)) || T(xx, y + 3) === Terrain.Stairs) ok = false;
        }
        if (!ok || (ridgeStairs && Math.abs(x - ridgeStairs.x) < 10)) continue;
        if (falls.some((f) => Math.abs((f % W) - x) < 10 && Math.abs(Math.floor(f / W) - y) < 6)) continue;
        const d = Math.hypot(x - target.x, y - target.y);
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    if (best) {
      const cave = { x: best.x, y: best.y };
      objects.push({ kind: 'cave', x: cave.x, y: cave.y, w: 3, h: 3, v: Math.floor(hash2(cave.x, cave.y, seed) * 1000) });
      interactables.push({ kind: 'cave', x: cave.x + 1, y: cave.y + 2 });
      const floorY = cave.y + 3;
      // An irregular gravel floor spreading out from the mouth.
      const qx = cave.x - 7;
      const qw = 17;
      const qh = 10;
      for (let y = floorY; y < floorY + qh; y++)
        for (let x = qx; x < qx + qw; x++) {
          const d = Math.hypot((x + 0.5 - (cave.x + 1.5)) / (qw / 2), (y + 0.5 - floorY) / qh) + (valueNoise(x / 3, y / 3, seed + 140) - 0.5) * 0.35;
          const t = T(x, y);
          if (d > 1 || lv(x, y) || isWater(t) || t === Terrain.Cliff || t === Terrain.Stairs || solid[idx(x, y)]) continue;
          setT(x, y, Terrain.Rock);
          zone[idx(x, y)] = Zone.Quarry;
          reserve(x, y);
        }
      quarry = { x: qx, y: floorY + 1, w: qw, h: qh - 1 };
      // Mine-cart track out of the mouth, a cart at the end and a heap of spoil.
      for (let k = 0; k < 5; k++) addObject('rail', cave.x + 1, floorY + k);
      addObject('minecart', cave.x + 1, floorY + 5);
      addObject('orepile', cave.x + 3, floorY + 1, 2, 1);
      addObject('crate', cave.x - 1, floorY + 1);
      addObject('lamp', cave.x - 1, floorY);
      // The miner's log cabin beside the quarry.
      for (const [cx, cy] of [
        [qx - 7, floorY + 1],
        [qx + qw + 1, floorY + 1],
        [qx - 7, floorY + 5],
      ]) {
        let free = true;
        for (let y = cy - 2; y < cy + 6 && free; y++)
          for (let x = cx - 1; x < cx + 7 && free; x++) if (!inb(x, y) || lv(x, y) || isWater(T(x, y)) || T(x, y) === Terrain.Cliff || solid[idx(x, y)] || reserved[idx(x, y)]) free = false;
        if (free) {
          addBuilding('cabin', cx, cy, 5, 4, 2);
          addObject('woodpile', cx + 5, cy + 3, 2, 1);
          break;
        }
      }
      for (let y = floorY; y < floorY + qh; y++)
        for (let x = qx - 8; x < qx + qw + 8; x++) if (inb(x, y) && !isWater(T(x, y)) && !lv(x, y) && zone[idx(x, y)] === Zone.None) zone[idx(x, y)] = Zone.Quarry;
    }
  }

  // ── 6. Harbour pier and ship ───────────────────────────────────────────
  const dockX = plaza.x + Math.floor(plaza.w / 2);
  let shoreY = plaza.y + plaza.h;
  while (shoreY < H - 20 && !isWater(T(dockX, shoreY))) shoreY++;
  // Make sure the approach is land.
  for (let y = plaza.y + plaza.h; y < shoreY; y++) for (let x = dockX - 1; x <= dockX + 1; x++) if (isWater(T(x, y))) setT(x, y, Terrain.Sand);
  const pierLen = 12;
  for (let y = shoreY - 1; y < shoreY + pierLen; y++)
    for (let x = dockX - 1; x <= dockX + 1; x++) {
      setT(x, y, Terrain.Dock);
      zone[idx(x, y)] = Zone.Harbor;
    }
  reserve(dockX - 2, shoreY - 3, 5, pierLen + 4);
  const pierEnd = { x: dockX + 1, y: shoreY + pierLen - 3 };
  const ship: Rect = { x: dockX + 2, y: shoreY + pierLen - 6, w: 12, h: 5 };
  for (let y = ship.y - 1; y < ship.y + ship.h + 1; y++)
    for (let x = ship.x; x < ship.x + ship.w + 1; x++) {
      if (!isWater(T(x, y))) setT(x, y, Terrain.Sea);
      solid[idx(x, y)] = 1;
    }
  interactables.push({ kind: 'ship', x: ship.x, y: pierEnd.y });
  for (let y = shoreY + 1; y < shoreY + pierLen; y += 4) {
    addObject('bollard', dockX - 1, y);
  }
  addObject('crate', dockX - 1, shoreY + pierLen - 1);
  addObject('barrel', dockX - 1, shoreY + pierLen - 2);
  const office = addBuilding('harborOffice', dockX - 9, shoreY - 6, 5, 4, 2);
  void office;
  for (let y = shoreY - 8; y < shoreY + 2; y++) for (let x = dockX - 12; x < dockX + 12; x++) if (inb(x, y) && !isWater(T(x, y)) && zone[idx(x, y)] !== Zone.Village) zone[idx(x, y)] = Zone.Harbor;

  // ── 7. Lighthouse on the eastern cape ──────────────────────────────────
  let capeX = 0;
  let capeY = 78;
  for (let y = 66; y <= 92; y++)
    for (let x = W - 1; x > capeX; x--)
      if (!isWater(T(x, y))) {
        if (x > capeX) {
          capeX = x;
          capeY = y;
        }
        break;
      }
  const lh = { x: capeX - 5, y: capeY - 2 };
  for (let y = lh.y - 5; y <= lh.y + 7; y++)
    for (let x = lh.x - 6; x <= lh.x + 8; x++) {
      if (!inb(x, y)) continue;
      const d = Math.hypot(x - lh.x - 1, y - lh.y - 1) + (valueNoise(x / 2, y / 2, seed + 21) - 0.5) * 2;
      if (d < 5.5 && !isWater(T(x, y))) setT(x, y, Terrain.Rock);
      if (!isWater(T(x, y))) zone[idx(x, y)] = Zone.Cape;
    }
  addBuilding('lighthouse', lh.x, lh.y, 3, 3, 1);
  const lighthouse = { x: lh.x, y: lh.y };

  // ── 8. Roads (A* with organic wobble, bridges over the river) ──────────
  const roads: Array<Array<[number, number]>> = [];
  /** A plateau border crossed without stairs (east, west or north edges). */
  const edgeOf = (x: number, y: number) => {
    const own = T(x, y);
    if (own === Terrain.Stairs || own === Terrain.Cliff) return false;
    const l = lv(x, y);
    for (const [ox, oy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (!inb(x + ox, y + oy) || lv(x + ox, y + oy) === l) continue;
      const nt = T(x + ox, y + oy);
      if (nt !== Terrain.Cliff && nt !== Terrain.Stairs && !isWater(nt)) return true;
    }
    return false;
  };
  const roadCost = (x: number, y: number) => {
    if (!inb(x, y) || x < 1 || y < 1 || x >= W - 2 || y >= H - 2) return Infinity;
    // A 2-wide brush must fit, so check the 2×2 block.
    let c = 0;
    for (let oy = 0; oy < 2; oy++)
      for (let ox = 0; ox < 2; ox++) {
        const t = T(x + ox, y + oy);
        if (solid[idx(x + ox, y + oy)]) return Infinity;
        if (t === Terrain.Deep || t === Terrain.Sea || t === Terrain.Pond) return Infinity;
        if (t === Terrain.Cliff || edgeOf(x + ox, y + oy)) return Infinity;
        if (t === Terrain.Stairs) {
          c += 0.2;
          continue;
        }
        if (t === Terrain.River) c += 6;
        else if (t === Terrain.Path || t === Terrain.Cobble || t === Terrain.Bridge || t === Terrain.Dock) c += 0.3;
        else if (t === Terrain.Forest) c += 2.5;
        else c += 1;
      }
    return c / 4 + hash2(x, y, seed + 5) * 0.8;
  };
  const roadStrokes: Stroke[] = [];
  const road = (ax: number, ay: number, bx: number, by: number, surface: number) => {
    const p = astar(W, H, ax, ay, bx, by, roadCost);
    if (!p) return;
    roads.push(p);
    // Centre of the 2×2 brush, smoothed into a flowing curve.
    const pts = simplify(chaikin(p.map(([x, y]) => [x + 1, y + 1] as [number, number]), 3), 0.5);
    const stroke: Stroke = { pts, hw: pts.map(() => 1.05) };
    roadStrokes.push(stroke);
    const b = strokeBounds(stroke);
    const bridge: Array<[number, number]> = [];
    for (let y = Math.max(0, Math.floor(b.y0) - 1); y <= Math.min(H - 1, Math.ceil(b.y1) + 1); y++)
      for (let x = Math.max(0, Math.floor(b.x0) - 1); x <= Math.min(W - 1, Math.ceil(b.x1) + 1); x++) {
        if (strokeDistance(stroke, x + 0.5, y + 0.5) >= 0) continue;
        const t = T(x, y);
        if (t === Terrain.River) bridge.push([x, y]);
        else if (t === Terrain.Cliff || t === Terrain.Stairs) continue;
        else if (t !== Terrain.Cobble && t !== Terrain.Dock && t !== Terrain.Bridge && !isWater(t)) setT(x, y, surface);
        reserve(x - 1, y - 1, 3, 3);
      }
    if (bridge.length) {
      // A straight, rectangular bridge spanning the whole river.
      const ys = bridge.map(([, y]) => y);
      const y0 = Math.min(...ys);
      const y1 = Math.max(y0 + 1, Math.min(Math.max(...ys), y0 + 2));
      // One rectangle wide enough for every row, so a diagonal river never makes a crooked deck.
      let L = Infinity;
      let R = -Infinity;
      for (let y = y0; y <= y1; y++) {
        const xs = bridge.filter(([, by]) => by === y).map(([x]) => x);
        let l = xs.length ? Math.min(...xs) : bridge[0][0];
        let r = xs.length ? Math.max(...xs) : bridge[0][0];
        while (T(l - 1, y) === Terrain.River) l--;
        while (T(r + 1, y) === Terrain.River) r++;
        L = Math.min(L, l);
        R = Math.max(R, r);
      }
      for (let y = y0; y <= y1; y++) {
        for (let x = L; x <= R; x++) setT(x, y, Terrain.Bridge);
        if (!isWater(T(L - 1, y))) setT(L - 1, y, surface);
        if (!isWater(T(R + 1, y))) setT(R + 1, y, surface);
      }
    }
  };
  const gateEast = { x: farm.x + farm.w, y: farm.y + 11 };
  const gateNorth = { x: farm.x + 22, y: farm.y - 2 };
  const gateSouth = { x: farm.x + 12, y: farm.y + farm.h };
  road(gateEast.x, gateEast.y, plaza.x - 1, plaza.y + 6, Terrain.Path);
  road(dockX - 1, plaza.y + plaza.h, dockX - 1, shoreY - 2, Terrain.Path);
  road(plaza.x + plaza.w, plaza.y + 6, lh.x + 1, lh.y + 3, Terrain.Path);
  road(plaza.x + plaza.w - 2, plaza.y - 1, meadowC.x, meadowC.y + 4, Terrain.Path);
  if (ridgeStairs) {
    road(gateNorth.x, gateNorth.y, ridgeStairs.x - 1, ridgeStairs.y + 3, Terrain.Path);
    road(ridgeStairs.x - 1, ridgeStairs.y + 2, forestC.x - 2, forestC.y - 6, Terrain.Path);
  } else road(gateNorth.x, gateNorth.y, forestC.x - 6, forestC.y + 8, Terrain.Path);
  void hillStairs;
  road(gateSouth.x, gateSouth.y + 1, beachC.x + 6, beachC.y - 8, Terrain.Path);
  if (quarry.w) road(gateNorth.x - 1, gateNorth.y - 1, quarry.x + Math.floor(quarry.w / 2) - 3, quarry.y + quarry.h - 2, Terrain.Path);
  // Little path from the house door to the east gate.
  road(spawn.x, spawn.y, gateEast.x - 1, gateEast.y, Terrain.Path);

  // ── 9. Farm fence with gates ───────────────────────────────────────────
  const gateTiles = new Set<string>();
  for (let d = -1; d <= 2; d++) {
    gateTiles.add(`${gateEast.x},${gateEast.y + d}`);
    gateTiles.add(`${gateNorth.x + d},${farm.y - 1}`);
    gateTiles.add(`${gateSouth.x + d},${farm.y + farm.h}`);
  }
  const fenceAt = (x: number, y: number) => {
    if (gateTiles.has(`${x},${y}`) || isWater(T(x, y)) || solid[idx(x, y)]) return;
    if (T(x, y) === Terrain.Path) return;
    addObject('fence', x, y);
  };
  for (let x = farm.x - 1; x <= farm.x + farm.w; x++) {
    fenceAt(x, farm.y - 1);
    fenceAt(x, farm.y + farm.h);
  }
  for (let y = farm.y; y < farm.y + farm.h; y++) {
    fenceAt(farm.x - 1, y);
    fenceAt(farm.x + farm.w, y);
  }
  reserve(farm.x - 1, farm.y - 1, farm.w + 2, farm.h + 2);

  // ── 10. Lamps along village roads, plaza and pier ──────────────────────
  const tryLamp = (x: number, y: number) => {
    if (!inb(x, y)) return;
    const t = T(x, y);
    if (isWater(t) || solid[idx(x, y)] || t === Terrain.Path || t === Terrain.Cobble || t === Terrain.Bridge) return;
    if (objects.some((o) => o.x === x && o.y === y)) return;
    addObject('lamp', x, y);
  };
  for (const [ri, p] of roads.entries()) {
    if (ri >= 4) break; // village roads only
    for (let i = 6; i < p.length - 3; i += 9) {
      const [x, y] = p[i];
      const [nx, ny] = p[Math.min(p.length - 1, i + 1)];
      const dx = nx - x;
      const dy = ny - y;
      // Perpendicular side, alternating.
      const side = (i / 9) % 2 < 1 ? 1 : -1;
      const px = x + (dy !== 0 ? (side > 0 ? 2 : -1) : 0);
      const py = y + (dx !== 0 ? (side > 0 ? 2 : -1) : 0);
      tryLamp(px, py);
    }
  }
  for (const [lx, ly] of [
    [plaza.x, plaza.y],
    [plaza.x + plaza.w - 1, plaza.y],
    [plaza.x, plaza.y + plaza.h - 1],
    [plaza.x + plaza.w - 1, plaza.y + plaza.h - 1],
  ])
    addObject('lamp', lx, ly);
  for (let y = shoreY + 2; y < shoreY + pierLen; y += 4) addObject('lamp', dockX + 1, y);

  // Village props.
  addObject('flowerpot', seedShop.x - 1, seedShop.y + seedShop.h - 1);
  addObject('flowerpot', seedShop.x + seedShop.w, seedShop.y + seedShop.h - 1);
  addObject('crate', toolShop.x - 1, toolShop.y + toolShop.h - 1);
  addObject('barrel', toolShop.x + toolShop.w, toolShop.y + toolShop.h - 1);
  addObject('bench', plaza.x + 4, plaza.y + plaza.h - 2);
  addObject('bench', plaza.x + plaza.w - 6, plaza.y + plaza.h - 2);
  addObject('sign', gateEast.x + 2, gateEast.y - 2);
  addObject('sign', plaza.x - 3, plaza.y + 4);
  addObject('board', plaza.x + 2, plaza.y + 3);
  interactables.push({ kind: 'board', x: plaza.x + 2, y: plaza.y + 3 });
  addObject('bench', meadowC.x + 2, meadowC.y - 1, 2, 1);

  // ── 10b. Landmarks: places worth walking to ────────────────────────────
  {
    const BAD = new Set<number>([Terrain.Cliff, Terrain.Stairs, Terrain.Path, Terrain.Cobble, Terrain.Dock, Terrain.Bridge]);
    const okTile = (x: number, y: number, lvl = -1) =>
      inb(x, y) && !solid[idx(x, y)] && !isWater(T(x, y)) && !BAD.has(T(x, y)) && (lvl < 0 || lv(x, y) === lvl) && !objects.some((o) => o.x === x && o.y === y);
    const okArea = (x: number, y: number, w: number, h: number, lvl = -1) => {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (!okTile(xx, yy, lvl)) return false;
      return true;
    };
    /** Nearest top-left where a w×h box fits, searching outward from (tx, ty). */
    const findBox = (tx: number, ty: number, w: number, h: number, radius: number, lvl = -1) => {
      let best: { x: number; y: number } | null = null;
      let bestD = Infinity;
      for (let y = ty - radius; y <= ty + radius; y++)
        for (let x = tx - radius; x <= tx + radius; x++) {
          const d = Math.hypot(x - tx, y - ty);
          if (d < bestD && okArea(x, y, w, h, lvl)) {
            best = { x, y };
            bestD = d;
          }
        }
      return best;
    };
    const markZone = (x: number, y: number, w: number, h: number, z: number) => {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (inb(xx, yy) && !isWater(T(xx, yy))) zone[idx(xx, yy)] = z;
    };

    // Forest campsite where the ridge trail ends.
    const campAt = { x: forestC.x - 2, y: forestC.y - 6 };
    const camp = findBox(campAt.x + 1, campAt.y - 3, 7, 6, 8, 1);
    if (camp) {
      addObject('tent', camp.x + 2, camp.y, 3, 2);
      addObject('woodpile', camp.x + 5, camp.y + 1, 2, 1);
      addObject('campfire', camp.x + 3, camp.y + 3);
      addObject('logseat', camp.x + 1, camp.y + 3, 2, 1);
      addObject('logseat', camp.x + 4, camp.y + 4, 2, 1);
      reserve(camp.x - 2, camp.y - 2, 11, 10);
      markZone(camp.x - 2, camp.y - 2, 11, 10, Zone.Camp);
      // Forgotten ruins deeper along the ridge, reached by a trail from the camp.
      const ruins = findBox(camp.x + 30, camp.y - 1, 9, 7, 14, 1);
      if (ruins) {
        for (const [dx, dy] of [
          [0, 1],
          [2, 0],
          [6, 0],
          [8, 1],
          [0, 5],
          [8, 5],
        ])
          addObject('ruin', ruins.x + dx, ruins.y + dy);
        addObject('shrine', ruins.x + 3, ruins.y + 1, 3, 1);
        reserve(ruins.x - 2, ruins.y - 2, 13, 11);
        markZone(ruins.x - 2, ruins.y - 2, 13, 11, Zone.Ruins);
        road(camp.x + 3, camp.y + 5, ruins.x + 4, ruins.y + 6, Terrain.Path);
      }
    }

    // Hilltop gazebo on Starlight Hill.
    const gz = findBox(meadowC.x - 1, meadowC.y - 7, 4, 3, 8, 1);
    if (gz) {
      addObject('gazebo', gz.x, gz.y, 4, 2);
      reserve(gz.x - 1, gz.y - 2, 6, 6);
    }

    // Sunny orchard east of the village, in neat rows.
    const orch = { x: plaza.x + plaza.w + 11, y: plaza.y + 5 };
    let trees = 0;
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 6; col++) {
        const x = orch.x + col * 3;
        const y = orch.y + row * 3;
        if (okArea(x, y, 1, 2, 0)) {
          addObject('fruittree', x, y);
          reserve(x - 1, y - 1, 3, 3);
          trees++;
        }
      }
    if (trees) {
      markZone(orch.x - 2, orch.y - 2, 20, 14, Zone.Orchard);
      if (okTile(orch.x - 2, orch.y - 1)) addObject('sign', orch.x - 2, orch.y - 1);
      if (okTile(orch.x + 16, orch.y + 9)) addObject('crate', orch.x + 16, orch.y + 9);
      if (okArea(orch.x + 16, orch.y + 2, 2, 1)) addObject('woodpile', orch.x + 16, orch.y + 2, 2, 1);
      road(plaza.x + plaza.w, plaza.y + 8, orch.x - 2, orch.y + 4, Terrain.Path);
    }

    // Tide pools on the east cove.
    let pools = 0;
    const placedPools: Array<[number, number]> = [];
    for (let y = 84; y < 128 && pools < 4; y++)
      for (let x = 196; x < W - 3 && pools < 4; x++) {
        if (T(x, y) !== Terrain.Sand || T(x + 1, y) !== Terrain.Sand) continue;
        let sea = false;
        for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 3; ox++) if (T(x + ox, y + oy) === Terrain.Sea) sea = true;
        if (!sea || placedPools.some(([px, py]) => Math.hypot(px - x, py - y) < 7) || hash2(x, y, seed + 120) > 0.3) continue;
        if (!okArea(x, y, 2, 1)) continue;
        addObject('tidepool', x, y, 2, 1);
        placedPools.push([x, y]);
        pools++;
      }

    // Sunset Beach: parasols and a sandcastle a few steps from the surf.
    const beachSpots: Array<[number, number]> = [];
    for (let y = beachC.y - 30; y < beachC.y + 30; y++)
      for (let x = beachC.x - 30; x < beachC.x + 30; x++) {
        if (!okArea(x, y, 2, 2) || T(x, y) !== Terrain.Sand || T(x + 1, y + 1) !== Terrain.Sand || zone[idx(x, y)] !== Zone.Beach) continue;
        let seaNear = false;
        let seaTooNear = false;
        for (let oy = -4; oy <= 5; oy++)
          for (let ox = -4; ox <= 5; ox++) {
            const t = T(x + ox, y + oy);
            if (t !== Terrain.Sea && t !== Terrain.Deep) continue;
            seaNear = true;
            if (Math.abs(ox) <= 2 && oy >= -1 && oy <= 3) seaTooNear = true;
          }
        if (seaNear && !seaTooNear && hash2(x, y, seed + 130) < 0.08 && !beachSpots.some(([bx, by]) => Math.hypot(bx - x, by - y) < 8)) beachSpots.push([x, y]);
      }
    beachSpots.slice(0, 4).forEach(([x, y], i) => addObject(i === 2 ? 'sandcastle' : 'parasol', x, y, 2, i === 2 ? 1 : 2));

    // Buoys bobbing off the pier.
    let buoys = 0;
    for (const [bx, by] of [
      [dockX - 6, shoreY + 6],
      [dockX - 4, shoreY + 13],
      [dockX + 16, shoreY + 8],
      [dockX + 7, shoreY + 15],
    ])
      if ((T(bx, by) === Terrain.Sea || T(bx, by) === Terrain.Deep) && !solid[idx(bx, by)] && buoys < 4) {
        addObject('buoy', bx, by);
        buoys++;
      }

    // The waterfall basin gets its own name.
    for (const k of falls) markZone((k % W) - 4, Math.floor(k / W) - 1, 9, 8, Zone.Falls);
  }

  // ── 11. Nature: trees, bushes, rocks, flowers, reeds ───────────────────
  const occupied = (x: number, y: number) => objects.some((o) => Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1);
  const treeGrid = new Uint8Array(N);
  const nearTree = (x: number, y: number) => {
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (inb(x + ox, y + oy) && treeGrid[idx(x + ox, y + oy)]) return true;
    return false;
  };
  // Forest depth (tiles to the nearest non-forest tile, capped) — cores grow dense, edges thin out.
  const fdepth = new Uint8Array(N);
  for (let i = 0; i < N; i++) fdepth[i] = terrain[i] === Terrain.Forest ? 4 : 0;
  for (let pass = 0; pass < 4; pass++)
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = idx(x, y);
        if (!fdepth[i]) continue;
        fdepth[i] = Math.min(fdepth[i], fdepth[i - 1] + 1, fdepth[i + 1] + 1, fdepth[i - W] + 1, fdepth[i + W] + 1);
      }
  const village = { x: plaza.x + plaza.w / 2, y: plaza.y + plaza.h / 2 };
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const i = idx(x, y);
      if (reserved[i] || solid[i]) continue;
      const t = terrain[i];
      const r = hash2(x, y, seed + 31);
      const z = zone[i];
      let kind: ObjectKind | null = null;
      // Woods come in masses and groves with clearings, not an even sprinkle.
      const grove = fbm(x / 13, y / 13, seed + 35, 3);
      const clearing = valueNoise(x / 7, y / 7, seed + 36) > 0.8;
      const pineShare = 0.35 + Math.max(0, (60 - y) / 60) * 0.5 + (level[i] ? 0.15 : 0);
      if (t === Terrain.Forest && !clearing) {
        if (r < (fdepth[i] >= 2 ? 0.72 : 0.42)) kind = hash2(x, y, seed + 32) < pineShare ? 'pine' : 'oak';
      } else if (t === Terrain.Meadow && r < 0.018) kind = 'blossom';
      else if (t === Terrain.Grass && z !== Zone.Village && z !== Zone.Farm) {
        const p = grove > 0.64 ? 0.34 : grove > 0.58 ? 0.1 : 0.0035;
        if (r < p) {
          const nearVillage = Math.hypot(x - village.x, y - village.y) < 45;
          const b = hash2(x, y, seed + 33);
          kind = b < (nearVillage ? 0.16 : 0.05) ? 'blossom' : b > 0.8 && y < 90 ? 'pine' : 'oak';
        }
      } else if (t === Terrain.Sand && z === Zone.Beach && r < (valueNoise(x / 6, y / 6, seed + 39) > 0.55 ? 0.13 : 0.004)) kind = 'palm';
      if (kind) {
        // Keep off coasts and river banks.
        let wet = false;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (isWater(T(x + ox, y + oy))) wet = true;
        if (wet || nearTree(x, y)) continue;
        treeGrid[i] = 1;
        objects.push({ kind, x, y, v: Math.floor(hash2(x, y, seed + 34) * 1000) });
        reserved[i] = 1;
        continue;
      }
      const r2 = hash2(x, y, seed + 41);
      // Bushes gather in thickets (often on grove margins); rocks in stony patches.
      const thicket = valueNoise(x / 6, y / 6, seed + 37) + (grove > 0.55 && grove < 0.66 ? 0.12 : 0);
      const stony = valueNoise(x / 9, y / 9, seed + 42);
      const pBush = thicket > 0.72 ? 0.16 : 0.005;
      const pRock = stony > 0.78 ? 0.06 : 0.0015;
      if ((t === Terrain.Grass || t === Terrain.Forest) && z !== Zone.Farm && z !== Zone.Village && !occupied(x, y)) {
        if (r2 < pRock) {
          objects.push({ kind: 'rock', x, y, v: Math.floor(r2 * 1e6) % 1000 });
          reserved[i] = 1;
          continue;
        }
        if (r2 > 1 - pBush) {
          objects.push({ kind: hash2(x, y, seed + 43) < 0.08 ? 'stump' : 'bush', x, y, v: Math.floor(r2 * 1e5) % 1000 });
          reserved[i] = 1;
          continue;
        }
      }
      if (t === Terrain.Rock && r2 < 0.08 && !occupied(x, y)) {
        objects.push({ kind: 'rock', x, y, v: Math.floor(r2 * 1e5) % 1000 });
        reserved[i] = 1;
        continue;
      }
      const r3 = hash2(x, y, seed + 51);
      let nearFresh = false;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const nt = T(x + ox, y + oy);
        if (nt === Terrain.River || nt === Terrain.Pond) nearFresh = true;
      }
      if (nearFresh && (t === Terrain.Grass || t === Terrain.Sand) && r3 < 0.35) objects.push({ kind: 'reeds', x, y, v: Math.floor(r3 * 1e5) % 1000 });
      else if (t === Terrain.Meadow && r3 < 0.3) objects.push({ kind: 'flowers', x, y, v: Math.floor(r3 * 1e5) % 1000 });
      else if (t === Terrain.Grass && z !== Zone.Farm && r3 < (valueNoise(x / 8, y / 8, seed + 38) > 0.68 ? 0.3 : 0.006))
        objects.push({ kind: 'flowers', x, y, v: Math.floor(r3 * 1e5) % 1000 });
    }
  }

  // ── 11b. Life details: the little things that make a place feel lived in ──
  {
    const free = (x: number, y: number, w = 1, h = 1) => {
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++) {
          if (!inb(xx, yy) || solid[idx(xx, yy)] || isWater(T(xx, yy))) return false;
          if (objects.some((o) => o.x <= xx && xx < o.x + (o.w ?? 1) && o.y <= yy && yy < o.y + (o.h ?? 1) && isSolidObject(o.kind))) return false;
        }
      return true;
    };
    const place = (kind: ObjectKind, x: number, y: number, w = 1, h = 1) => {
      if (free(x, y, w, h)) addObject(kind, x, y, w, h);
    };
    // Scattered ground detail.
    for (let y = 2; y < H - 2; y++)
      for (let x = 2; x < W - 2; x++) {
        const i = idx(x, y);
        if (solid[i] || reserved[i]) continue;
        const t = terrain[i];
        const z = zone[i];
        const r = hash2(x, y, seed + 91);
        const meadowy = valueNoise(x / 7, y / 7, seed + 99);
        if ((t === Terrain.Grass || t === Terrain.Meadow) && z !== Zone.Farm && z !== Zone.Village && r < (meadowy > 0.62 ? 0.32 : 0.012))
          objects.push({ kind: 'tallgrass', x, y, v: Math.floor(hash2(x, y, seed + 92) * 1000) });
        else if (z === Zone.Meadow && t !== Terrain.Path && valueNoise(x / 5, y / 5, seed + 120) > 0.58 && r < 0.6)
          // Drifts of wildflowers on Starlight Hill.
          objects.push({ kind: 'flowers', x, y, v: Math.floor(hash2(x, y, seed + 121) * 1000) });
        else if ((t === Terrain.Sand || t === Terrain.Path) && r < 0.018) objects.push({ kind: 'pebbles', x, y, v: Math.floor(hash2(x, y, seed + 93) * 1000) });
        else if (t === Terrain.Forest && r < 0.025) objects.push({ kind: 'mushroom', x, y, v: Math.floor(hash2(x, y, seed + 94) * 1000) });
        else if (t === Terrain.Forest && r > 0.996 && free(x, y, 2, 1)) addObject('log', x, y, 2, 1);
      }
    // Boulders: big landmarks that break up open ground — in stony fields, under the cliffs,
    // now and then on the beach. Never on a path or hemming one in, and never crowded together.
    const boulders: Array<[number, number]> = [];
    for (let y = 3; y < H - 4; y++)
      for (let x = 3; x < W - 4; x++) {
        const r = hash2(x, y, seed + 131);
        const t = T(x, y);
        const z = zone[idx(x, y)];
        if (z === Zone.Farm || z === Zone.Village) continue;
        const underCliff = T(x, y - 1) === Terrain.Cliff || T(x + 1, y - 1) === Terrain.Cliff;
        const stony = valueNoise(x / 9, y / 9, seed + 42) > 0.66;
        const beach = t === Terrain.Sand && z === Zone.Beach;
        const p = underCliff ? 0.1 : beach ? 0.006 : stony ? 0.03 : 0.0012;
        if (r > p) continue;
        let ok = true;
        for (let yy = y - 1; yy < y + 3 && ok; yy++)
          for (let xx = x - 1; xx < x + 3 && ok; xx++) {
            const tt = T(xx, yy);
            if (tt === Terrain.Path || tt === Terrain.Cobble || tt === Terrain.Stairs || tt === Terrain.Dock || tt === Terrain.Bridge || isWater(tt)) ok = false;
            if (xx >= x && xx < x + 2 && yy >= y && yy < y + 2 && (tt === Terrain.Cliff || reserved[idx(xx, yy)])) ok = false;
          }
        if (!ok || !free(x, y, 2, 2) || boulders.some(([bx, by]) => Math.abs(bx - x) < 6 && Math.abs(by - y) < 6)) continue;
        addObject('boulder', x, y, 2, 2);
        boulders.push([x, y]);
      }
    // Rubble and pebbles at the foot of the cliffs.
    for (let y = 2; y < H - 2; y++)
      for (let x = 2; x < W - 2; x++) {
        if (T(x, y - 1) !== Terrain.Cliff || T(x, y) === Terrain.Cliff || T(x, y) === Terrain.Stairs || isWater(T(x, y))) continue;
        if (solid[idx(x, y)] || reserved[idx(x, y)] || T(x, y) === Terrain.Path) continue;
        const r = hash2(x, y, seed + 97);
        if (r < 0.07 && free(x, y)) addObject('rock', x, y);
        else if (r < 0.3) objects.push({ kind: 'pebbles', x, y, v: Math.floor(hash2(x, y, seed + 98) * 1000) });
      }
    for (let y = 2; y < H - 2; y++)
      for (let x = 2; x < W - 2; x++) if (T(x, y) === Terrain.Pond && hash2(x, y, seed + 95) < 0.3) objects.push({ kind: 'lilypad', x, y, v: Math.floor(hash2(x, y, seed + 96) * 1000) });
    // Beach boats pulled up on the sand.
    let boats = 0;
    for (let y = beachC.y - 20; y < beachC.y + 25 && boats < 2; y += 3)
      for (let x = beachC.x - 30; x < beachC.x + 20 && boats < 2; x++)
        if (T(x, y) === Terrain.Sand && isWater(T(x, y + 2)) && free(x, y, 2, 1) && hash2(x, y, seed) < 0.25) {
          addObject('boat', x, y, 2, 1);
          boats++;
          x += 8;
        }
    // Harbour life around the office.
    const off = buildings.find((b) => b.kind === 'harborOffice');
    if (off) {
      place('netrack', off.x - 3, off.y + off.h, 2, 1);
      place('fishcrate', off.x + off.w + 1, off.y + off.h - 1);
      place('fishcrate', off.x + off.w + 1, off.y + off.h);
      place('anchor', off.x - 1, off.y + off.h - 1);
    }
    // Market stalls on the plaza.
    place('stall', plaza.x + 2, plaza.y + plaza.h - 4, 2, 1);
    place('stall', plaza.x + plaza.w - 4, plaza.y + plaza.h - 4, 2, 1);
    place('flowerbed', fx - 2, fy + 3, 2, 1);
    place('flowerbed', fx + 2, fy + 3, 2, 1);
    // Cottage gardens and laundry.
    buildings
      .filter((b) => b.kind === 'cottage')
      .forEach((b, i) => {
        place('flowerbed', b.x - 2, b.y + b.h - 1, 2, 1);
        if (i % 2 === 0) place('laundry', b.x + b.w + 1, b.y + 1, 2, 1);
      });
    // Farm and windmill.
    const mill = buildings.find((b) => b.kind === 'windmill');
    if (mill) {
      place('haybale', mill.x + mill.w, mill.y + mill.h - 1);
      place('haybale', mill.x + mill.w + 1, mill.y + mill.h);
    }
    place('scarecrow', farm.x + farm.w - 3, farm.y + farm.h - 3);
    place('beehive', farm.x + 1, farm.y + 8);
    place('beehive', farm.x + 1, farm.y + 10);
    // Meadow picnic and lighthouse telescope.
    place('picnic', meadowC.x - 3, meadowC.y + 1, 2, 1);
    place('telescope', lh.x + 4, lh.y + 3);
  }

  // ── 12. Collision map ──────────────────────────────────────────────────
  for (let i = 0; i < N; i++) {
    const t = terrain[i];
    if (isWater(t) || t === Terrain.Cliff) solid[i] = 1;
  }
  // Plateau rims block the way down except where a road or the stairs pass.
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const t = T(x, y);
      if (t === Terrain.Path || t === Terrain.Stairs || isWater(t)) continue;
      if (edgeOf(x, y) && lv(x, y) === 1) solid[idx(x, y)] = 1;
    }
  for (const o of objects) {
    if (!isSolidObject(o.kind)) continue;
    const w = o.w ?? 1;
    const h = o.h ?? 1;
    for (let yy = o.y; yy < o.y + h; yy++) for (let xx = o.x; xx < o.x + w; xx++) if (inb(xx, yy)) solid[idx(xx, yy)] = 1;
  }
  for (const b of buildings) for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) solid[idx(xx, yy)] = 1;

  // Sort so rendering can iterate in a stable order.
  objects.sort((a, b) => a.y - b.y || a.x - b.x);

  return {
    seed,
    w: W,
    h: H,
    terrain,
    elev,
    zone,
    solid,
    objects,
    buildings,
    interactables,
    farm,
    plaza,
    spawn,
    ship,
    pierEnd,
    lighthouse,
    rivers,
    roads: roadStrokes,
    level,
    falls,
    quarry,
    greenhouse,
  };
}

/** True if the tile at (x, y) is inside the farm and can be tilled (terrain-wise). */
export function isFarmable(map: WorldMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
  const i = y * map.w + x;
  if (map.zone[i] !== Zone.Farm || map.solid[i]) return false;
  const g = map.greenhouse;
  if (x === g.x + 4 && y === g.y + g.h - 1) return false;
  const t = map.terrain[i];
  return t === Terrain.Grass || t === Terrain.Path;
}

export function isSolidTile(map: WorldMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true;
  return map.solid[y * map.w + x] === 1;
}
