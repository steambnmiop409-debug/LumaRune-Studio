import { Terrain, TILE, Zone, fbm, hash2, splitStroke, strokeBounds, strokeDistance, valueNoise, type Stroke, type WorldMap } from '@lumina/core';
import { bayer } from '../art/Pix';
import { pack, rgba32 } from '../art/palette';

export const CHUNK_TILES = 16;
export const CHUNK_PX = CHUNK_TILES * TILE;
const MARGIN = 12;
const FOAM_FRAMES = 6;

const WATER = new Set<number>([Terrain.Deep, Terrain.Sea, Terrain.River, Terrain.Pond]);
/** Relative height used for edge shading (banks, lips, cast shadows). */
const HEIGHT: Record<number, number> = {
  [Terrain.Deep]: 0,
  [Terrain.Sea]: 0,
  [Terrain.River]: 0,
  [Terrain.Pond]: 0,
  [Terrain.Sand]: 1,
  [Terrain.Path]: 2,
  [Terrain.Cobble]: 2,
  [Terrain.Grass]: 3,
  [Terrain.Forest]: 3,
  [Terrain.Meadow]: 3,
  [Terrain.Rock]: 4,
  [Terrain.Dock]: 5,
  [Terrain.Bridge]: 5,
  [Terrain.Cliff]: 6,
  [Terrain.Stairs]: 2,
};

const C = (h: string) => pack(h);
const SEA = ['#93dccf', '#72c8c8', '#56b0c4', '#4396bb', '#377ca3', '#2d648c', '#254f78'].map(C);
const FRESH = ['#86d4c0', '#68bdb6', '#52a6ad', '#448ea2', '#3a7894'].map(C);
const GRASS = ['#93c565', '#80b85b', '#6ea651', '#5d9449'].map(C);
const FOREST = ['#679b52', '#578b4a', '#4a7b44', '#3e6a3e'].map(C);
const MEADOW = ['#9ccc6c', '#8bc062', '#79b058', '#699f50'].map(C);
const SAND = ['#f4e4b6', '#ebd6a2', '#dfc68f', '#d0b37c'].map(C);
const WET_SAND = ['#d5ba8a', '#c9aa79'].map(C);
const PATH = ['#d8b582', '#caa372', '#b99263', '#a57f55'].map(C);
const COBBLE = ['#d6cdc0', '#cbc1b4', '#bfb5a9', '#b1a79c'].map(C);
const MORTAR = C('#958980');
const ROCK = ['#b1aaa1', '#9d968e', '#8a837d', '#77716c'].map(C);
const PLANK = ['#c39461', '#b38555', '#a3774b'].map(C);
const PLANK_SEAM = C('#6e4b32');
const PLANK_DARK = C('#5a3c28');
const BANK = [C('#9a7652'), C('#7d5d40'), C('#654a34')];
const FLOWER_SPECKS = ['#f9d8e3', '#fff4c8', '#ecc0f4', '#ffffff', '#f8bea6', '#c8dcff'].map(C);
const FOAM = C('#f4fbf7');
const FRESH_EDGE = rgba32(190, 232, 222, 230);
const FOAM2 = rgba32(224, 244, 238, 200);
const WASH = rgba32(200, 236, 230, 70);
const SHADOW = rgba32(20, 24, 60, 70);
const SHADOW_DEEP = rgba32(24, 20, 44, 110);
// Warm sandstone for cliff faces, light to dark.
const ROCKF = ['#d8c6aa', '#bfa98d', '#a58f76', '#8b7662', '#725f50', '#5a4a3f'].map(C);
const ROCK_LINE = C('#46382f');
const MOSS = [C('#7aa150'), C('#5f8a44')];
const STEP = ['#e4d9c6', '#cfc2ad', '#b3a58f', '#8a7b68', '#6a5c4e'].map(C);
const FALL = ['#e6f7f6', '#bfe8ec', '#96d4e2', '#74bcd6'].map(C);
const FALL_FRAMES = 4;

function band(colors: number[], v: number, x: number, y: number): number {
  const f = Math.max(0, Math.min(colors.length - 1.001, v * (colors.length - 1)));
  const i = Math.floor(f);
  return f - i > bayer(x, y) ? colors[i + 1] : colors[i];
}

interface Piece {
  s: Stroke;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function pieces(strokes: Stroke[]): Piece[] {
  return strokes.flatMap((st) => splitStroke(st, 8)).map((s) => {
    const b = strokeBounds(s);
    return { s, x0: b.x0 * TILE, y0: b.y0 * TILE, x1: b.x1 * TILE, y1: b.y1 * TILE };
  });
}

/** Grass tuft pattern: 0 none, 1 bright blade, 2 dark root. */
function tuft(wx: number, wy: number, seed: number): number {
  const cx = Math.floor(wx / 6);
  const cy = Math.floor(wy / 5);
  if (hash2(cx, cy, seed) > 0.42) return 0;
  const ox = cx * 6 + 1 + Math.floor(hash2(cx, cy, seed + 1) * 4);
  const oy = cy * 5 + 1 + Math.floor(hash2(cx, cy, seed + 2) * 3);
  const dx = wx - ox;
  const dy = wy - oy;
  if (dy === 0 && (dx === -1 || dx === 1)) return 1;
  if (dy === -1 && dx === 0 && hash2(cx, cy, seed + 3) < 0.5) return 1;
  if (dy === 1 && dx === 0) return 2;
  return 0;
}

/** Organic cobblestones from a jittered Voronoi grid. Returns -1 for mortar, else tone 0..3. */
function cobble(wx: number, wy: number, seed: number): number {
  const cw = 8;
  const ch = 7;
  const gx = Math.floor(wx / cw);
  const gy = Math.floor(wy / ch);
  let d1 = Infinity;
  let d2 = Infinity;
  let best = 0;
  let ry = 0;
  for (let oy = -1; oy <= 1; oy++)
    for (let ox = -1; ox <= 1; ox++) {
      const cx = gx + ox;
      const cy = gy + oy;
      const fx = cx * cw + 1 + hash2(cx, cy, seed + 13) * (cw - 2);
      const fy = cy * ch + 1 + hash2(cx, cy, seed + 14) * (ch - 2);
      const d = Math.hypot(wx + 0.5 - fx, (wy + 0.5 - fy) * 1.15);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        best = cy * 7919 + cx;
        ry = wy + 0.5 - fy;
      } else if (d < d2) d2 = d;
    }
  if (d2 - d1 < 1.05) return -1;
  const tone = Math.floor(hash2(best, 1, seed) * 3);
  if (ry < -1.4) return Math.max(0, tone - 1);
  if (ry > 1.6) return Math.min(3, tone + 1);
  return tone;
}

interface Chunk {
  base: HTMLCanvasElement;
  foam: HTMLCanvasElement[] | null;
  falls: HTMLCanvasElement[] | null;
  used: number;
}

/**
 * Renders the island terrain pixel-by-pixel into 256×256 chunk canvases.
 * Borders between terrain types are wobbled with noise so the tile grid disappears.
 */
export class TerrainRenderer {
  private chunks = new Map<number, Chunk>();
  private frame = 0;
  private riverPieces: Piece[];
  private roadPieces: Piece[];

  private fallSet: Set<number>;

  constructor(private map: WorldMap) {
    this.riverPieces = pieces(map.rivers);
    this.roadPieces = pieces(map.roads);
    this.fallSet = new Set(map.falls);
  }

  private levelAt(tx: number, ty: number): number {
    const map = this.map;
    return tx < 0 || ty < 0 || tx >= map.w || ty >= map.h ? 0 : map.level[ty * map.w + tx];
  }

  private isFall(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.map.w && ty < this.map.h && this.fallSet.has(ty * this.map.w + tx);
  }

  /** Vertical rock face: grass overhang, stacked boulders lit from the upper left, moss, a ragged dark foot. */
  private cliffPixel(wx: number, wy: number): number {
    const s = this.map.seed;
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const faceish = (x: number, y: number) => this.tileAt(x, y) === Terrain.Cliff || this.isFall(x, y);
    let topTile = ty;
    while (faceish(tx, topTile - 1) && ty - topTile < 3) topTile--;
    let botTile = ty;
    while (faceish(tx, botTile + 1) && botTile - ty < 3) botTile++;
    const top = topTile * TILE;
    const fh = (botTile + 1) * TILE - top;
    const ly = wy - top;
    const lx = wx - tx * TILE;
    // Grass (or forest floor) curling over the top edge, with the odd hanging tuft.
    const above = this.groundOf(tx, topTile - 1);
    const pal = above === Terrain.Forest ? FOREST : above === Terrain.Meadow ? MEADOW : GRASS;
    const lip = 2 + Math.floor(valueNoise(wx / 3, 7.3, s + 70) * 3);
    const hang = hash2(wx, 5, s + 75) < 0.2 ? 1 + Math.floor(hash2(wx, 6, s + 75) * 3) : 0;
    if (ly < lip) return ly === lip - 1 ? pal[3] : hash2(wx, wy, s + 76) < 0.3 ? pal[1] : pal[2];
    if (ly < lip + hang) return ly === lip + hang - 1 ? pal[3] : pal[2];
    if (ly === lip + hang || ly === lip) return ROCK_LINE;
    // Ragged foot where the rock meets the ground.
    const foot = fh - 2 - Math.floor(valueNoise(wx / 4, 3.1, s + 71) * 3);
    if (ly >= foot) return ly === foot ? ROCK_LINE : ROCKF[5];
    // Boulders: a jittered Voronoi of rounded stones, in face-local space so rows follow the edge.
    const CW = 14;
    const CH = 10;
    const gx = Math.floor(wx / CW);
    const gy = Math.floor(ly / CH);
    let d1 = Infinity;
    let d2 = Infinity;
    let rx = 0;
    let ry = 0;
    let cell = 0;
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        const cx = gx + ox;
        const cy = gy + oy;
        const fx = cx * CW + 2 + hash2(cx, cy + tx * 0, s + 86) * (CW - 4);
        const fy = cy * CH + 2 + hash2(cx, cy, s + 87) * (CH - 4);
        const dx = wx + 0.5 - fx;
        const dy = (ly + 0.5 - fy) * 1.25;
        const d = Math.hypot(dx, dy);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          rx = dx;
          ry = dy;
          cell = cy * 7919 + cx;
        } else if (d < d2) d2 = d;
      }
    const gap = d2 - d1;
    if (gap < 1.0) return ly < fh * 0.4 ? ROCKF[4] : ROCK_LINE;
    let tone = 0.3 + hash2(cell, 3, s + 88) * 1.1 + (ly / fh) ** 1.3 * 3;
    if (ry < -2.4) tone -= 1.3;
    else if (ry < -1) tone -= 0.5;
    else if (ry > 2.6) tone += 0.9;
    if (rx < -3) tone -= 0.4;
    else if (rx > 3.2) tone += 0.6;
    if (gap < 1.8 && ry > 0) tone += 0.7;
    // Rounded ends: lit on the left, in shade on the right.
    if (!faceish(tx - 1, ty) && lx < 3) tone -= 1 - lx * 0.3;
    if (!faceish(tx + 1, ty) && lx > 12) tone += (lx - 12) * 0.5;
    // Moss settles on the tops of the upper stones.
    if (ry < -1.2 && ly < fh * 0.6 && valueNoise(wx / 5, wy / 5, s + 74) > 0.62) return MOSS[hash2(wx, wy, s) < 0.6 ? 0 : 1];
    const f = Math.max(0, Math.min(5, tone + (bayer(wx, wy) - 0.5) * 0.8));
    return ROCKF[Math.round(f)];
  }

  /** Stone steps with side walls. */
  private stairPixel(wx: number, wy: number): number {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const lx = wx - tx * TILE;
    const st = (x: number, y: number) => this.tileAt(x, y) === Terrain.Stairs;
    if (!st(tx - 1, ty) && lx < 3) return lx === 0 ? ROCK_LINE : ROCKF[lx === 1 ? 1 : 3];
    if (!st(tx + 1, ty) && lx > 12) return lx === 15 ? ROCK_LINE : ROCKF[lx === 14 ? 4 : 3];
    const top = (st(tx, ty - 1) ? ty - 1 : ty) * TILE;
    const k = (wy - top) % 6;
    const worn = hash2(wx, Math.floor((wy - top) / 6), this.map.seed + 79) < 0.12;
    return k === 0 ? STEP[0] : k < 3 ? STEP[worn ? 2 : 1] : k < 5 ? STEP[2] : STEP[4];
  }

  private tileAt(tx: number, ty: number): number {
    const map = this.map;
    return tx < 0 || ty < 0 || tx >= map.w || ty >= map.h ? Terrain.Deep : map.terrain[ty * map.w + tx];
  }

  /** The ground a tile contributes when blending borders (stroke-drawn and structural tiles resolve to what lies beneath). */
  private groundOf(tx: number, ty: number): number {
    const t = this.tileAt(tx, ty);
    if (t === Terrain.Path || t === Terrain.River || t === Terrain.Bridge || t === Terrain.Cobble || t === Terrain.Cliff || t === Terrain.Stairs) {
      const map = this.map;
      const cx = Math.max(0, Math.min(map.w - 1, tx));
      const cy = Math.max(0, Math.min(map.h - 1, ty));
      return map.zone[cy * map.w + cx] === Zone.Beach ? Terrain.Sand : Terrain.Grass;
    }
    if (t === Terrain.Dock) return Terrain.Sea;
    return t;
  }

  private terrainAtPixel(wx: number, wy: number, rivers: Piece[], roads: Piece[]): number {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const raw = this.tileAt(tx, ty);
    if (raw === Terrain.Dock || raw === Terrain.Bridge || raw === Terrain.Cobble || raw === Terrain.Cliff || raw === Terrain.Stairs) return raw;
    const s = this.map.seed;
    if (this.isFall(tx, ty)) {
      const wob0 = (valueNoise(wx / 5, wy / 5, s + 3) - 0.5) * 2.2;
      for (const p of rivers) if (strokeDistance(p.s, wx / TILE, wy / TILE) * TILE + wob0 < 0) return Terrain.River;
      return Terrain.Cliff;
    }
    // Borders come from a bilinear vote of the four nearest tile centres (so diagonals become
    // straight slopes and corners round off), sampled through a gentle noise warp.
    const ox = (valueNoise(wx / 9, wy / 9, s + 1) - 0.5) * 9 + (valueNoise(wx / 3, wy / 3, s + 4) - 0.5) * 1.6;
    const oy = (valueNoise(wx / 9, wy / 9, s + 2) - 0.5) * 9 + (valueNoise(wx / 3, wy / 3, s + 5) - 0.5) * 1.6;
    const sx = (wx + ox) / TILE - 0.5;
    const sy = (wy + oy) / TILE - 0.5;
    const x0 = Math.floor(sx);
    const y0 = Math.floor(sy);
    const fx = sx - x0;
    const fy = sy - y0;
    const cand = [this.groundOf(x0, y0), this.groundOf(x0 + 1, y0), this.groundOf(x0, y0 + 1), this.groundOf(x0 + 1, y0 + 1)];
    const wts = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
    let t = cand[0];
    let best = -1;
    for (let k = 0; k < 4; k++) {
      let sum = 0;
      for (let j = 0; j < 4; j++) if (cand[j] === cand[k]) sum += wts[j];
      if (sum > best + 1e-6) {
        best = sum;
        t = cand[k];
      }
    }
    if (t === Terrain.Deep || t === Terrain.Sea) return t;
    const fxw = wx / TILE;
    const fyw = wy / TILE;
    const wob = (valueNoise(wx / 5, wy / 5, s + 3) - 0.5) * 2.2;
    for (const p of rivers) {
      if (wx < p.x0 - 4 || wx > p.x1 + 4 || wy < p.y0 - 4 || wy > p.y1 + 4) continue;
      if (strokeDistance(p.s, fxw, fyw) * TILE + wob < 0) return Terrain.River;
    }
    if (t === Terrain.Pond) return t;
    for (const p of roads) {
      if (wx < p.x0 - 4 || wx > p.x1 + 4 || wy < p.y0 - 4 || wy > p.y1 + 4) continue;
      if (strokeDistance(p.s, fxw, fyw) * TILE + wob * 0.7 < 0) return Terrain.Path;
    }
    return t;
  }

  private elevAt(wx: number, wy: number): number {
    const map = this.map;
    const fx = wx / TILE - 0.5;
    const fy = wy / TILE - 0.5;
    const x0 = Math.max(0, Math.min(map.w - 2, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(map.h - 2, Math.floor(fy)));
    const tx = Math.max(0, Math.min(1, fx - x0));
    const ty = Math.max(0, Math.min(1, fy - y0));
    const e = map.elev;
    const a = e[y0 * map.w + x0];
    const b = e[y0 * map.w + x0 + 1];
    const c = e[(y0 + 1) * map.w + x0];
    const d = e[(y0 + 1) * map.w + x0 + 1];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  }

  private build(cx: number, cy: number): Chunk {
    const S = CHUNK_PX + MARGIN * 2;
    const x0 = cx * CHUNK_PX - MARGIN;
    const y0 = cy * CHUNK_PX - MARGIN;
    const types = new Uint8Array(S * S);
    const near = (list: Piece[]) => list.filter((p) => p.x1 >= x0 - 8 && p.x0 <= x0 + S + 8 && p.y1 >= y0 - 8 && p.y0 <= y0 + S + 8);
    const rivers = near(this.riverPieces);
    const roads = near(this.roadPieces);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) types[y * S + x] = this.terrainAtPixel(x0 + x, y0 + y, rivers, roads);

    // Chamfer distance transforms: water→land and land→water (in pixels, capped).
    const INF = 255;
    const dWater = new Uint8Array(S * S); // for water pixels: distance to land
    const dLand = new Uint8Array(S * S); // for land pixels: distance to water
    for (let i = 0; i < S * S; i++) {
      const w = WATER.has(types[i]);
      dWater[i] = w ? INF : 0;
      dLand[i] = w ? 0 : INF;
    }
    const chamfer = (d: Uint8Array) => {
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const i = y * S + x;
          let v = d[i];
          if (x > 0) v = Math.min(v, d[i - 1] + 2);
          if (y > 0) v = Math.min(v, d[i - S] + 2);
          if (x > 0 && y > 0) v = Math.min(v, d[i - S - 1] + 3);
          if (x < S - 1 && y > 0) v = Math.min(v, d[i - S + 1] + 3);
          d[i] = v;
        }
      for (let y = S - 1; y >= 0; y--)
        for (let x = S - 1; x >= 0; x--) {
          const i = y * S + x;
          let v = d[i];
          if (x < S - 1) v = Math.min(v, d[i + 1] + 2);
          if (y < S - 1) v = Math.min(v, d[i + S] + 2);
          if (x < S - 1 && y < S - 1) v = Math.min(v, d[i + S + 1] + 3);
          if (x > 0 && y < S - 1) v = Math.min(v, d[i + S - 1] + 3);
          d[i] = v;
        }
    };
    chamfer(dWater);
    chamfer(dLand);

    const img = new ImageData(CHUNK_PX, CHUNK_PX);
    const out = new Uint32Array(img.data.buffer);
    const seed = this.map.seed;
    let hasShore = false;
    const T = (x: number, y: number) => types[(y + MARGIN) * S + x + MARGIN];

    for (let py = 0; py < CHUNK_PX; py++) {
      for (let px = 0; px < CHUNK_PX; px++) {
        const wx = x0 + MARGIN + px;
        const wy = y0 + MARGIN + py;
        const i = (py + MARGIN) * S + px + MARGIN;
        const t = types[i];
        let col: number;
        const h = hash2(wx, wy, seed + 77);

        const ptx = Math.floor(wx / TILE);
        const pty = Math.floor(wy / TILE);
        if (t === Terrain.River && this.isFall(ptx, pty)) {
          // Falling water: bright vertical ribbons.
          const r = valueNoise(wx / 2.5, wy / 40, seed + 81);
          col = band(FALL, r * 0.9 + ((wy - pty * TILE) / 32) * 0.3, wx, wy);
          out[py * CHUNK_PX + px] = col;
          continue;
        }
        if (t === Terrain.Cliff) {
          out[py * CHUNK_PX + px] = this.cliffPixel(wx, wy);
          continue;
        }
        if (t === Terrain.Stairs) {
          out[py * CHUNK_PX + px] = this.stairPixel(wx, wy);
          continue;
        }
        if (WATER.has(t)) {
          const d = dWater[i] / 2; // px to land
          if (d < 12) hasShore = true;
          const fresh = t === Terrain.River || t === Terrain.Pond;
          if (fresh) {
            col = band(FRESH, Math.min(1, d / 10 + 0.1), wx, wy);
          } else {
            const e = this.elevAt(wx, wy);
            // Depth from the island-wide elevation (continuous across chunks) plus a shallow shelf by the shore.
            const depth = Math.max(0, Math.min(1, -e * 2.4 + 0.08 + Math.min(d, 10) / 28));
            col = band(SEA, depth, wx, wy);
          }
          // Land casts a soft shadow onto the water right below it.
          const above = T(px, py - 1);
          const above2 = T(px, py - 2);
          const above3 = T(px, py - 3);
          if (!WATER.has(above) || !WATER.has(above2)) col = band(fresh ? FRESH : SEA, 0.95, wx, wy);
          else if (!WATER.has(above3) && h < 0.6) col = band(fresh ? FRESH : SEA, 0.8, wx, wy);
        } else {
          const below = T(px, py + 1);
          const below2 = T(px, py + 2);
          const above = T(px, py - 1);
          const hh = HEIGHT[t];
          const macro = fbm(wx / 110, wy / 110, seed + 5, 2);
          const meso = valueNoise(wx / 13, wy / 13, seed + 6);
          const v = macro * 0.55 + meso * 0.35 + h * 0.18 - 0.05;
          switch (t) {
            case Terrain.Grass:
            case Terrain.Forest:
            case Terrain.Meadow: {
              const pal = t === Terrain.Grass ? GRASS : t === Terrain.Forest ? FOREST : MEADOW;
              col = band(pal, 0.2 + macro * 0.45 + meso * 0.25, wx, wy);
              const tf = tuft(wx, wy, seed + 60);
              if (tf === 1) col = pal[0];
              else if (tf === 2) col = pal[3];
              if (t === Terrain.Forest && h > 0.992) col = C('#8a7a4e');
              if (t === Terrain.Meadow && h > 0.965) col = FLOWER_SPECKS[Math.floor(hash2(wx, wy, seed + 9) * FLOWER_SPECKS.length)];
              break;
            }
            case Terrain.Sand: {
              const dl = dLand[i] / 2;
              if (dl < 3) col = WET_SAND[1];
              else if (dl < 6) col = band(WET_SAND, 0.5 + bayer(wx, wy) * 0.2, wx, wy);
              else col = band(SAND, v * 0.9, wx, wy);
              if (dl >= 6 && h < 0.03) col = SAND[3];
              if (dl >= 6 && h > 0.985) col = C('#fcf4dc');
              break;
            }
            case Terrain.Path: {
              col = band(PATH, v * 0.8, wx, wy);
              if (h < 0.025) col = PATH[3];
              else if (h > 0.985) col = C('#e6c897');
              break;
            }
            case Terrain.Cobble: {
              const c = cobble(wx, wy, seed);
              col = c < 0 ? MORTAR : COBBLE[c];
              // Curb stones along the plaza edge.
              const edge = T(px - 1, py) !== Terrain.Cobble || T(px + 1, py) !== Terrain.Cobble || T(px, py - 1) !== Terrain.Cobble || T(px, py + 1) !== Terrain.Cobble;
              if (edge) col = MORTAR;
              break;
            }
            case Terrain.Rock: {
              col = band(ROCK, v, wx, wy);
              if (h < 0.03) col = ROCK[3];
              break;
            }
            case Terrain.Dock: {
              const ly = ((wy % 4) + 4) % 4;
              const plank = Math.floor(wy / 4);
              col = ly === 0 ? PLANK_SEAM : PLANK[Math.floor(hash2(plank, Math.floor(wx / 24), seed) * 3)];
              if (ly === 2 && ((wx + plank * 5) % 24 === 0 || (wx + plank * 5) % 24 === 1)) col = PLANK_DARK;
              const l = T(px - 1, py);
              const r = T(px + 1, py);
              if (l !== Terrain.Dock || r !== Terrain.Dock) col = PLANK_DARK;
              break;
            }
            case Terrain.Bridge: {
              const lx = ((wx % 4) + 4) % 4;
              const plank = Math.floor(wx / 4);
              col = lx === 0 ? PLANK_SEAM : PLANK[Math.floor(hash2(plank, 3, seed) * 3)];
              const u = T(px, py - 1);
              const u2 = T(px, py - 2);
              const b = T(px, py + 1);
              if (u !== Terrain.Bridge || b !== Terrain.Bridge) col = PLANK_DARK;
              else if (u2 !== Terrain.Bridge) col = C('#d8a86e');
              break;
            }
            default:
              col = GRASS[1];
          }

          // Plateau rims: a rocky lip where the high ground drops away to the west, east or north.
          if (this.levelAt(ptx, pty) === 1 && t !== Terrain.Path) {
            const lxp = wx - ptx * TILE;
            const lyp = wy - pty * TILE;
            const jit = Math.round((valueNoise(wx / 4, wy / 4, seed + 80) - 0.5) * 2.4);
            const drop = (dx: number, dy: number) => {
              if (this.levelAt(ptx + dx, pty + dy) !== 0) return false;
              const nt = this.tileAt(ptx + dx, pty + dy);
              return nt !== Terrain.Cliff && nt !== Terrain.Stairs && !WATER.has(nt) && nt !== Terrain.Path;
            };
            // Side walls read as a narrow rock band; the far (north) edge is a thinner lip.
            let side = 99;
            let north = 99;
            if (drop(-1, 0)) side = Math.min(side, lxp + jit);
            if (drop(1, 0)) side = Math.min(side, 15 - lxp + jit);
            if (drop(0, -1)) north = lyp + jit;
            // Corner tiles: follow the diagonal neighbours too so the band wraps around.
            if (side > 5 && north > 5) {
              if (drop(-1, -1) && !drop(-1, 0) && !drop(0, -1)) side = Math.min(side, Math.max(lxp, lyp) + jit);
              if (drop(1, -1) && !drop(1, 0) && !drop(0, -1)) side = Math.min(side, Math.max(15 - lxp, lyp) + jit);
            }
            const d = Math.min(side, north + 1);
            if (d <= 0) col = ROCK_LINE;
            else if (d <= 6 && side <= north + 1) {
              const tone = [4, 3, 2, 1, 1][d - 1] ?? 0;
              col = d === 6 ? (t === Terrain.Forest ? FOREST[3] : t === Terrain.Meadow ? MEADOW[3] : GRASS[3]) : ROCKF[Math.min(5, tone + (hash2(wx, Math.floor(wy / 3), seed + 82) < 0.3 ? 1 : 0))];
            } else if (d <= 3) col = d === 1 ? ROCKF[3] : d === 2 ? ROCKF[1] : t === Terrain.Forest ? FOREST[3] : t === Terrain.Meadow ? MEADOW[3] : GRASS[3];
          }

          // Banks: land that meets water just below shows an earthy 2px edge.
          if (t !== Terrain.Dock && t !== Terrain.Bridge) {
            if (WATER.has(below) || WATER.has(below2)) {
              if (t === Terrain.Sand) col = WATER.has(below) ? WET_SAND[1] : WET_SAND[0];
              else col = WATER.has(below) ? BANK[1] : BANK[0];
            } else if (HEIGHT[below] < hh && hh >= 2 && HEIGHT[below] >= 1 && below !== Terrain.Dock && below !== Terrain.Bridge) {
              // Grass lip over lower ground.
              const pal = t === Terrain.Forest ? FOREST : t === Terrain.Meadow ? MEADOW : t === Terrain.Rock ? ROCK : t === Terrain.Grass ? GRASS : null;
              if (pal) col = pal[3];
            } else if (HEIGHT[above] > hh && HEIGHT[above] <= 4 && HEIGHT[above] >= 2) {
              // Soft shadow cast by the higher ground above.
              col = t === Terrain.Sand ? SAND[3] : t === Terrain.Path ? PATH[3] : t === Terrain.Cobble ? COBBLE[3] : col;
            }
          }
        }
        out[py * CHUNK_PX + px] = col;
      }
    }

    const base = document.createElement('canvas');
    base.width = base.height = CHUNK_PX;
    base.getContext('2d')!.putImageData(img, 0, 0);

    // Dock & bridge planks cast a shadow on the water below; pilings poke out of the water.
    {
      const ctx = base.getContext('2d')!;
      const shadow = new ImageData(CHUNK_PX, CHUNK_PX);
      const sd = new Uint32Array(shadow.data.buffer);
      let any = false;
      for (let py = 0; py < CHUNK_PX; py++)
        for (let px = 0; px < CHUNK_PX; px++) {
          const t = T(px, py);
          if (!WATER.has(t)) {
            if (t === Terrain.Cliff || t === Terrain.Stairs) continue;
            // Cliffs throw a short shadow onto the ground at their foot; rims shade the lowland beside them.
            const a1 = T(px, py - 1);
            const a3 = T(px, py - 3);
            const wx = x0 + MARGIN + px;
            const wy = y0 + MARGIN + py;
            const ptx = Math.floor(wx / TILE);
            const pty = Math.floor(wy / TILE);
            const lxp = wx - ptx * TILE;
            let shade = 0;
            if (a1 === Terrain.Cliff) shade = 2;
            else if (a3 === Terrain.Cliff || T(px, py - 2) === Terrain.Cliff) shade = 1;
            else if (this.levelAt(ptx, pty) === 0) {
              if ((lxp < 2 && this.levelAt(ptx - 1, pty) === 1) || (lxp > 13 && this.levelAt(ptx + 1, pty) === 1)) shade = 1;
            }
            if (shade) {
              sd[py * CHUNK_PX + px] = shade === 2 ? SHADOW_DEEP : SHADOW;
              any = true;
            }
            continue;
          }
          for (let k = 1; k <= 4; k++) {
            const a = T(px, py - k);
            if (a === Terrain.Dock || a === Terrain.Bridge) {
              sd[py * CHUNK_PX + px] = SHADOW;
              any = true;
              break;
            }
            if (!WATER.has(a)) break;
          }
        }
      if (any) {
        const sc = document.createElement('canvas');
        sc.width = sc.height = CHUNK_PX;
        sc.getContext('2d')!.putImageData(shadow, 0, 0);
        ctx.drawImage(sc, 0, 0);
      }
    }

    let foam: HTMLCanvasElement[] | null = null;
    if (hasShore) {
      foam = [];
      for (let f = 0; f < FOAM_FRAMES; f++) {
        const fimg = new ImageData(CHUNK_PX, CHUNK_PX);
        const fo = new Uint32Array(fimg.data.buffer);
        const t = f / FOAM_FRAMES;
        for (let py = 0; py < CHUNK_PX; py++) {
          for (let px = 0; px < CHUNK_PX; px++) {
            const i = (py + MARGIN) * S + px + MARGIN;
            const ty = types[i];
            if (!WATER.has(ty)) continue;
            const d = dWater[i] / 2;
            if (d > 11) continue;
            const wx = x0 + MARGIN + px;
            const wy = y0 + MARGIN + py;
            const fresh = ty === Terrain.River || ty === Terrain.Pond;
            const phase = valueNoise(wx / 24, wy / 24, seed + 40) * 1.4;
            const wave = (Math.sin((t + phase) * Math.PI * 2) * 0.5 + 0.5) * (fresh ? 2.5 : 6) + 1.2;
            if (d < 1.2) fo[py * CHUNK_PX + px] = fresh ? FRESH_EDGE : FOAM;
            else if (fresh && d > 3) continue;
            else if (Math.abs(d - wave) < 0.75) fo[py * CHUNK_PX + px] = hash2(wx, wy, f) < 0.8 ? FOAM2 : 0;
            else if (d < wave) fo[py * CHUNK_PX + px] = WASH;
          }
        }
        const fc = document.createElement('canvas');
        fc.width = fc.height = CHUNK_PX;
        fc.getContext('2d')!.putImageData(fimg, 0, 0);
        foam.push(fc);
      }
    }
    let fallsFx: HTMLCanvasElement[] | null = null;
    const hasFall = this.map.falls.some((k) => {
      const fx = (k % this.map.w) * TILE;
      const fy = Math.floor(k / this.map.w) * TILE;
      return fx >= x0 - TILE && fx < x0 + S + TILE && fy >= y0 - TILE && fy < y0 + S + TILE * 2;
    });
    if (hasFall) {
      fallsFx = [];
      for (let f = 0; f < FALL_FRAMES; f++) {
        const fimg = new ImageData(CHUNK_PX, CHUNK_PX);
        const fo = new Uint32Array(fimg.data.buffer);
        for (let py = 0; py < CHUNK_PX; py++)
          for (let px = 0; px < CHUNK_PX; px++) {
            const ty2 = T(px, py);
            if (ty2 !== Terrain.River && ty2 !== Terrain.Pond) continue;
            const wx = x0 + MARGIN + px;
            const wy = y0 + MARGIN + py;
            const ptx = Math.floor(wx / TILE);
            const pty = Math.floor(wy / TILE);
            if (ty2 === Terrain.River && this.isFall(ptx, pty)) {
              // Streaks sliding down, each column at its own pace.
              const speed = 1 + Math.floor(hash2(wx, 0, seed + 83) * 2);
              const k = (((wy - f * 4 * speed + Math.floor(hash2(wx, 1, seed + 84) * 16)) % 16) + 16) % 16;
              if (k < 3) fo[py * CHUNK_PX + px] = k === 0 ? FOAM : FOAM2;
            } else if ((this.isFall(ptx, pty - 1) || this.isFall(ptx, pty - 2)) && wy - pty * TILE < 12) {
              // Churning white water at the plunge.
              const r = hash2(wx, wy, seed + 85 + f);
              if (r < 0.55 - (wy - pty * TILE) * 0.07) fo[py * CHUNK_PX + px] = r < 0.25 ? FOAM : FOAM2;
            }
          }
        const fc = document.createElement('canvas');
        fc.width = fc.height = CHUNK_PX;
        fc.getContext('2d')!.putImageData(fimg, 0, 0);
        fallsFx.push(fc);
      }
    }
    return { base, foam, falls: fallsFx, used: this.frame };
  }

  private get(cx: number, cy: number): Chunk {
    const key = cy * 1000 + cx;
    let c = this.chunks.get(key);
    if (!c) {
      c = this.build(cx, cy);
      this.chunks.set(key, c);
      if (this.chunks.size > 48) {
        let oldest = -1;
        let oldKey = -1;
        for (const [k, v] of this.chunks)
          if (oldest < 0 || v.used < oldest) {
            oldest = v.used;
            oldKey = k;
          }
        this.chunks.delete(oldKey);
      }
    }
    c.used = this.frame;
    return c;
  }

  /** Builds one not-yet-cached chunk near the view (spread work over frames). */
  prefetch(camX: number, camY: number, w: number, h: number): void {
    const cx0 = Math.floor((camX - CHUNK_PX) / CHUNK_PX);
    const cy0 = Math.floor((camY - CHUNK_PX) / CHUNK_PX);
    const cx1 = Math.floor((camX + w + CHUNK_PX) / CHUNK_PX);
    const cy1 = Math.floor((camY + h + CHUNK_PX) / CHUNK_PX);
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) {
        if (cx < 0 || cy < 0 || cx * CHUNK_PX >= this.map.w * TILE || cy * CHUNK_PX >= this.map.h * TILE) continue;
        if (!this.chunks.has(cy * 1000 + cx)) {
          this.get(cx, cy);
          return;
        }
      }
  }

  /** Draws terrain for the view rectangle. `time` in seconds drives the foam animation. */
  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number, time: number): void {
    this.frame++;
    const cx0 = Math.floor(camX / CHUNK_PX);
    const cy0 = Math.floor(camY / CHUNK_PX);
    const cx1 = Math.floor((camX + w) / CHUNK_PX);
    const cy1 = Math.floor((camY + h) / CHUNK_PX);
    const f = Math.floor(time * 3.2) % (FOAM_FRAMES * 2 - 2);
    const frame = f < FOAM_FRAMES ? f : FOAM_FRAMES * 2 - 2 - f;
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) {
        const dx = cx * CHUNK_PX - camX;
        const dy = cy * CHUNK_PX - camY;
        if (cx < 0 || cy < 0 || cx * CHUNK_PX >= this.map.w * TILE || cy * CHUNK_PX >= this.map.h * TILE) {
          ctx.fillStyle = '#254f78';
          ctx.fillRect(dx, dy, CHUNK_PX, CHUNK_PX);
          continue;
        }
        const c = this.get(cx, cy);
        ctx.drawImage(c.base, dx, dy);
        if (c.foam) ctx.drawImage(c.foam[frame], dx, dy);
        if (c.falls) ctx.drawImage(c.falls[Math.floor(time * 10) % FALL_FRAMES], dx, dy);
      }
  }
}
