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
    const hw = pts.map(([, y]) => 0.95 + Math.min(1, Math.max(0, (y - 40) / 110)) * 0.75);
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
  const roadCost = (x: number, y: number) => {
    if (!inb(x, y) || x < 1 || y < 1 || x >= W - 2 || y >= H - 2) return Infinity;
    // A 2-wide brush must fit, so check the 2×2 block.
    let c = 0;
    for (let oy = 0; oy < 2; oy++)
      for (let ox = 0; ox < 2; ox++) {
        const t = T(x + ox, y + oy);
        if (solid[idx(x + ox, y + oy)]) return Infinity;
        if (t === Terrain.Deep || t === Terrain.Sea || t === Terrain.Pond) return Infinity;
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
        else if (t !== Terrain.Cobble && t !== Terrain.Dock && t !== Terrain.Bridge && !isWater(t)) setT(x, y, surface);
        reserve(x - 1, y - 1, 3, 3);
      }
    if (bridge.length) {
      // A straight, rectangular bridge spanning the whole river.
      const ys = bridge.map(([, y]) => y);
      const y0 = Math.min(...ys);
      const y1 = Math.max(y0 + 1, Math.min(Math.max(...ys), y0 + 2));
      for (let y = y0; y <= y1; y++) {
        const xs = bridge.filter(([, by]) => by === y).map(([x]) => x);
        const seedX = xs.length ? xs[0] : bridge[0][0];
        let l = seedX;
        let r = seedX;
        while (T(l - 1, y) === Terrain.River) l--;
        while (T(r + 1, y) === Terrain.River) r++;
        for (let x = l; x <= r; x++) setT(x, y, Terrain.Bridge);
        if (!isWater(T(l - 1, y))) setT(l - 1, y, surface);
        if (!isWater(T(r + 1, y))) setT(r + 1, y, surface);
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
  road(gateNorth.x, gateNorth.y, forestC.x - 6, forestC.y + 8, Terrain.Path);
  road(gateSouth.x, gateSouth.y + 1, beachC.x + 6, beachC.y - 8, Terrain.Path);
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
  addObject('bench', meadowC.x + 2, meadowC.y - 1, 2, 1);

  // ── 11. Nature: trees, bushes, rocks, flowers, reeds ───────────────────
  const occupied = (x: number, y: number) => objects.some((o) => Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1);
  const treeGrid = new Uint8Array(N);
  const nearTree = (x: number, y: number) => {
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (inb(x + ox, y + oy) && treeGrid[idx(x + ox, y + oy)]) return true;
    return false;
  };
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const i = idx(x, y);
      if (reserved[i] || solid[i]) continue;
      const t = terrain[i];
      const r = hash2(x, y, seed + 31);
      const z = zone[i];
      let kind: ObjectKind | null = null;
      if (t === Terrain.Forest && r < 0.34) kind = hash2(x, y, seed + 32) < 0.55 ? 'pine' : 'oak';
      else if (t === Terrain.Meadow && r < 0.035) kind = 'blossom';
      else if (t === Terrain.Grass && z !== Zone.Village && z !== Zone.Farm && r < 0.03) kind = hash2(x, y, seed + 33) < 0.2 ? 'blossom' : 'oak';
      else if (t === Terrain.Sand && z === Zone.Beach && r < 0.025) kind = 'palm';
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
      if ((t === Terrain.Grass || t === Terrain.Forest) && z !== Zone.Farm && z !== Zone.Village && r2 < 0.012 && !occupied(x, y)) {
        objects.push({ kind: r2 < 0.004 ? 'rock' : r2 < 0.006 ? 'stump' : 'bush', x, y, v: Math.floor(r2 * 1e5) % 1000 });
        reserved[i] = 1;
        continue;
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
      else if (t === Terrain.Grass && z !== Zone.Farm && r3 < 0.035) objects.push({ kind: 'flowers', x, y, v: Math.floor(r3 * 1e5) % 1000 });
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
        if (t === Terrain.Grass && z !== Zone.Farm && z !== Zone.Village && r < 0.05) objects.push({ kind: 'tallgrass', x, y, v: Math.floor(hash2(x, y, seed + 92) * 1000) });
        else if ((t === Terrain.Sand || t === Terrain.Path) && r < 0.018) objects.push({ kind: 'pebbles', x, y, v: Math.floor(hash2(x, y, seed + 93) * 1000) });
        else if (t === Terrain.Forest && r < 0.025) objects.push({ kind: 'mushroom', x, y, v: Math.floor(hash2(x, y, seed + 94) * 1000) });
        else if (t === Terrain.Forest && r > 0.996 && free(x, y, 2, 1)) addObject('log', x, y, 2, 1);
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
    if (isWater(t)) solid[i] = 1;
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
  };
}

/** True if the tile at (x, y) is inside the farm and can be tilled (terrain-wise). */
export function isFarmable(map: WorldMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
  const i = y * map.w + x;
  if (map.zone[i] !== Zone.Farm || map.solid[i]) return false;
  const t = map.terrain[i];
  return t === Terrain.Grass || t === Terrain.Path;
}

export function isSolidTile(map: WorldMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true;
  return map.solid[y * map.w + x] === 1;
}
