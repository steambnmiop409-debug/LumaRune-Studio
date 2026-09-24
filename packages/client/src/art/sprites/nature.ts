import { hash2 } from '@lumina/core';
import { Pix } from '../Pix';
import { light, mix, shade } from '../palette';
import { clump } from './shading';

export type SeasonLook = 0 | 1 | 2 | 3;

export interface TreeSprite {
  img: HTMLCanvasElement;
  /** Pixel row where the canopy ends (rows above sway in the wind). */
  swayRows: number;
  /** Anchor: sprite x of the trunk centre, sprite y of the ground. */
  ax: number;
  ay: number;
}

function canopyPalette(base: string): string[] {
  return [light(base, 2), light(base, 1), base, shade(base, 1), shade(base, 2)];
}

const OAK_LEAVES = ['#5ea24c', '#6aa84a', '#579c56', '#72ad48'];
const AUTUMN = ['#e0923a', '#d0703a', '#e8b04a', '#c85a3a'];
const BLOSSOM = ['#f0b0c4', '#f5c0cf', '#eaa3bb'];

/** Paints a canopy made of overlapping blobs with clump shading. */
function canopy(p: Pix, blobs: Array<[number, number, number, number]>, base: string, seed: number, cell = 5, speckle?: string) {
  const pal = canopyPalette(base);
  const inside = (x: number, y: number) => blobs.some(([cx, cy, rx, ry]) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1);
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, cy, , ry] of blobs) {
    minY = Math.min(minY, cy - ry);
    maxY = Math.max(maxY, cy + ry);
  }
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (!inside(x, y)) continue;
      // Global light: top-left bright, bottom dark.
      const gy = (y - minY) / (maxY - minY);
      let tone = 2 + clump(x, y, cell, seed) + (gy > 0.78 ? 1 : gy < 0.25 ? -1 : 0);
      if (!inside(x, y + 1) || !inside(x + 1, y + 1)) tone = Math.max(tone, 3);
      tone = Math.max(0, Math.min(4, tone));
      let c = pal[tone];
      if (speckle && tone <= 2 && hash2(x, y, seed + 9) < 0.06) c = speckle;
      p.set(x, y, c);
    }
}

function trunk(p: Pix, cx: number, top: number, bottom: number, w: number, bark = '#8a5a3a') {
  const l = light(bark, 1);
  const d = shade(bark, 1);
  const dd = shade(bark, 2);
  for (let y = top; y <= bottom; y++) {
    const flare = y >= bottom - 1 ? 1 : 0;
    const x0 = Math.round(cx - w / 2) - flare;
    const x1 = Math.round(cx + w / 2) - 1 + flare;
    for (let x = x0; x <= x1; x++) {
      let c = bark;
      if (x === x0) c = l;
      else if (x === x1) c = dd;
      else if (x === x1 - 1) c = d;
      if (hash2(x, y, 7) < 0.12 && x > x0 && x < x1 - 1) c = d;
      p.set(x, y, c);
    }
  }
}

export function oakTree(v: number, season: SeasonLook): TreeSprite {
  const p = new Pix(34, 46);
  const s = (v % 7) / 7;
  const big = v % 3 === 0 ? 1 : 0;
  trunk(p, 17, 28, 45, 6);
  if (season === 3) {
    // Bare winter branches.
    const br = '#6e4a34';
    p.line(17, 30, 9, 16, br);
    p.line(17, 29, 25, 14, br);
    p.line(16, 26, 16, 10, br);
    p.line(12, 22, 7, 20, br);
    p.line(22, 21, 28, 19, br);
    p.line(16, 16, 12, 9, br);
    p.line(17, 16, 21, 8, br);
    p.outline(shade(br, 3));
    return { img: p.toCanvas(), swayRows: 28, ax: 17, ay: 45 };
  }
  const base = season === 2 ? AUTUMN[v % AUTUMN.length] : OAK_LEAVES[v % OAK_LEAVES.length];
  const tint = season === 0 ? light(base, 1) : base;
  canopy(
    p,
    [
      [17, 17 - big, 14 + big, 11 + big],
      [9, 23, 7 + s * 2, 6],
      [25, 22, 8, 6 + s * 2],
      [16, 8 - big, 9, 7],
      [21, 12, 7, 6],
    ],
    tint,
    v * 13,
    5,
    season === 0 && v % 2 === 0 ? '#fdf2c0' : undefined,
  );
  p.outline();
  return { img: p.toCanvas(), swayRows: 28, ax: 17, ay: 45 };
}

export function blossomTree(v: number, season: SeasonLook): TreeSprite {
  if (season !== 0) return oakTree(v + 1, season);
  const p = new Pix(34, 44);
  trunk(p, 17, 27, 43, 5, '#7a4a3a');
  p.line(17, 28, 11, 20, '#7a4a3a');
  p.line(17, 27, 23, 19, '#7a4a3a');
  canopy(
    p,
    [
      [17, 16, 14, 10],
      [8, 21, 7, 6],
      [26, 20, 7, 6],
      [15, 8, 9, 7],
      [22, 10, 6, 5],
    ],
    BLOSSOM[v % BLOSSOM.length],
    v * 7 + 3,
    4,
    '#fff6f8',
  );
  p.outline(shade('#d98ba2', 2));
  return { img: p.toCanvas(), swayRows: 27, ax: 17, ay: 43 };
}

export function pineTree(v: number, season: SeasonLook): TreeSprite {
  const p = new Pix(26, 48);
  trunk(p, 13, 38, 47, 4, '#7a4e36');
  const base = v % 2 ? '#3f7a5a' : '#467f55';
  const pal = canopyPalette(base);
  const tiers = [
    [4, 14, 8],
    [11, 23, 10],
    [18, 32, 12],
    [25, 41, 13],
  ];
  for (const [top, bottom, half] of tiers) {
    for (let y = top; y <= bottom; y++) {
      const t = (y - top) / (bottom - top);
      const hw = 1 + t * half;
      for (let x = Math.floor(13 - hw); x <= Math.ceil(13 + hw - 1); x++) {
        const rel = (x + 0.5 - 13) / hw;
        // Jagged bottom edge.
        if (y === bottom && (x & 1)) continue;
        let tone = rel < -0.35 ? 1 : rel > 0.45 ? 3 : 2;
        if (t < 0.25) tone = Math.max(0, tone - 1);
        if (y >= bottom - 1) tone = Math.min(4, tone + 1);
        if (hash2(x, y, v) < 0.08) tone = Math.min(4, tone + 1);
        p.set(x, y, pal[tone]);
      }
    }
  }
  if (season === 3) {
    // Snow on the tiers.
    for (const [top, bottom, half] of tiers) {
      const y = top + Math.floor((bottom - top) * 0.55);
      const hw = 1 + ((y - top) / (bottom - top)) * half;
      for (let x = Math.floor(13 - hw); x <= Math.ceil(13 + hw - 1); x++) if (hash2(x, y, 3) < 0.7) p.set(x, y, '#f4f8ff');
    }
  }
  p.outline();
  return { img: p.toCanvas(), swayRows: 36, ax: 13, ay: 47 };
}

export function palmTree(v: number): TreeSprite {
  const p = new Pix(36, 48);
  const lean = v % 2 ? 1 : -1;
  // Curved, ringed trunk.
  for (let y = 16; y <= 47; y++) {
    const t = (47 - y) / 31;
    const cx = 18 + lean * Math.round(t * t * 6);
    for (let x = cx - 2; x <= cx + 1; x++) {
      let c = x === cx - 2 ? '#c49a6a' : x === cx + 1 ? '#7a5a3e' : '#a07a52';
      if (y % 4 === 0) c = shade(c, 1);
      p.set(x, y, c);
    }
  }
  const topX = 18 + lean * 6;
  const fronds: Array<[number, number]> = [
    [-15, 4],
    [-10, -6],
    [-2, -9],
    [8, -7],
    [15, 3],
    [4, 9],
    [-8, 8],
  ];
  const leaf = ['#7cc060', '#5aa050', '#3f7a40'];
  for (const [dx, dy] of fronds) {
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = topX + dx * t;
      const y = 16 + dy * t + t * t * 5;
      p.set(x, y, leaf[1]);
      p.set(x, y + 1, leaf[2]);
      if (i % 2 === 0) {
        p.set(x + (dx > 0 ? -1 : 1), y + 2, leaf[1]);
        p.set(x, y - 1, leaf[0]);
      }
    }
  }
  p.ellipse(topX - 1, 18, 2, 2, '#6a4a2a');
  p.ellipse(topX + 2, 19, 2, 2, '#7a5530');
  p.outline();
  return { img: p.toCanvas(), swayRows: 26, ax: 18, ay: 47 };
}

export function bush(v: number, season: SeasonLook): HTMLCanvasElement {
  const p = new Pix(18, 16);
  const base = season === 2 ? '#b8883a' : ['#5a9a48', '#4f9050', '#62a04a'][v % 3];
  canopy(
    p,
    [
      [9, 9, 7.5, 6],
      [5, 10, 4, 4],
      [13, 10, 4, 4],
      [9, 5, 5, 4],
    ],
    base,
    v,
    4,
  );
  if (v % 4 === 0 && season !== 3)
    for (let i = 0; i < 5; i++) p.set(4 + Math.floor(hash2(v, i, 1) * 10), 5 + Math.floor(hash2(v, i, 2) * 7), i % 2 ? '#e05060' : '#f0e0ff');
  p.outline();
  return p.toCanvas();
}

export function rock(v: number): HTMLCanvasElement {
  const p = new Pix(18, 14);
  const base = '#a39d96';
  const pal = [light(base, 2), light(base, 1), base, shade(base, 1), shade(base, 2)];
  const w = 6 + (v % 3);
  const h = 4.5 + (v % 2);
  p.ellipse(9, 8, w, h, (nx, ny) => {
    const l = -(nx * 0.6 + ny * 0.9);
    const t = l > 0.45 ? 0 : l > 0.1 ? 1 : l > -0.35 ? 2 : l > -0.7 ? 3 : 4;
    return pal[t];
  });
  if (v % 3 === 0) for (let x = 5; x < 12; x++) if (hash2(x, v, 3) < 0.6) p.set(x, 4 + Math.round(Math.abs(x - 9) * 0.3), '#6f9a52');
  p.line(8, 7, 10, 9, pal[4]);
  p.outline();
  return p.toCanvas();
}

export function stump(): HTMLCanvasElement {
  const p = new Pix(16, 12);
  p.rect(4, 5, 8, 6, '#8a5a3a');
  p.rect(4, 5, 1, 6, '#a8744a');
  p.rect(11, 5, 1, 6, '#5e3c2a');
  p.ellipse(8, 5, 4, 2, '#d8b07a');
  p.set(8, 5, '#a8744a');
  p.set(7, 5, '#c89a62');
  p.outline();
  return p.toCanvas();
}

const FLOWER_COLS = ['#f7c6d6', '#fff2b0', '#e2b6f2', '#ffffff', '#f5a88a', '#b8d4ff', '#f58a8a'];

export function flowers(v: number, frame: number): HTMLCanvasElement {
  const p = new Pix(16, 16);
  const n = 3 + (v % 3);
  for (let i = 0; i < n; i++) {
    const x = 2 + Math.floor(hash2(v, i, 5) * 12);
    const y = 5 + Math.floor(hash2(v, i, 6) * 9);
    const sway = frame && i % 2 ? 1 : 0;
    const col = FLOWER_COLS[Math.floor(hash2(v, i, 7) * FLOWER_COLS.length)];
    p.set(x, y + 1, '#4f8a40');
    p.set(x, y + 2, '#4f8a40');
    p.set(x - 1, y + 2, '#6aa84e');
    p.set(x + sway - 1, y, col);
    p.set(x + sway + 1, y, col);
    p.set(x + sway, y - 1, col);
    p.set(x + sway, y + 1 - 1 + 1, col);
    p.set(x + sway, y, i % 3 ? '#f5d040' : '#ffffff');
  }
  return p.toCanvas();
}

export function reeds(v: number, frame: number): HTMLCanvasElement {
  const p = new Pix(16, 20);
  const n = 4 + (v % 4);
  for (let i = 0; i < n; i++) {
    const x = 2 + Math.floor(hash2(v, i, 8) * 12);
    const hgt = 7 + Math.floor(hash2(v, i, 9) * 9);
    const lean = frame === 1 ? 1 : 0;
    for (let k = 0; k < hgt; k++) {
      const xx = x + (k > hgt * 0.6 ? lean : 0);
      p.set(xx, 19 - k, k > hgt - 3 && i % 3 === 0 ? '#8a5a3a' : mix('#5a8a48', '#9ac070', k / hgt));
    }
  }
  return p.toCanvas();
}
