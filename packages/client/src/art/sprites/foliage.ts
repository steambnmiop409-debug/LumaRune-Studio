import { hash2 } from '@lumina/core';
import { Pix } from '../Pix';
import { mix } from '../palette';
import type { SeasonLook, TreeSprite } from './nature';

/**
 * Painterly pixel trees. A canopy is a heap of leaf masses; each mass is shaded like a
 * sphere lit from the upper left, textured leaf by leaf, with deep creases where masses
 * overlap, a sunlit rim on top and a darker selective outline underneath.
 */

/** Six tones, brightest first: rim, light, mid-light, mid, shadow, deep. */
export type Pal = [string, string, string, string, string, string];

export const PALS: Record<string, Pal> = {
  oakSpring: ['#c4ee74', '#8ed052', '#62b040', '#459037', '#2f7031', '#1e4c2a'],
  oakSummer: ['#b0e062', '#78c046', '#529e3a', '#3c8133', '#2a642e', '#1a4527'],
  golden: ['#f6f08c', '#d8e05a', '#aec640', '#80a638', '#567e32', '#38582e'],
  autumnOrange: ['#ffe7a0', '#fbbf58', '#ee923e', '#d0683a', '#a44a38', '#6e3434'],
  autumnRed: ['#ffd0a0', '#f8986a', '#e0664a', '#bc4440', '#8c3040', '#5c2438'],
  autumnYellow: ['#fff6ac', '#f7de68', '#e2bb44', '#bf9438', '#8c6a32', '#5e482e'],
  birch: ['#d0f080', '#9ed45a', '#70b646', '#50983e', '#387838', '#24542f'],
  blossom: ['#fffafc', '#ffdce8', '#f8b8cf', '#e890b2', '#c06c90', '#86486c'],
  pine: ['#a4d876', '#68b25c', '#448e50', '#2f7046', '#20543b', '#153a2e'],
  pineWinter: ['#ffffff', '#e8f0f8', '#7cae8c', '#4f8a6c', '#35684f', '#244a3e'],
  bush: ['#b8e46e', '#82c44e', '#5aa440', '#408538', '#2c6631', '#1b4628'],
  bushAutumn: ['#ffe29a', '#f0b858', '#d88e40', '#b0683a', '#824a36', '#583430'],
};

/** Micro relief of one leaf tuft (about 5 px across) at (x, y): -0.6..0.35. */
function tuft(x: number, y: number, seed: number): number {
  const C = 4 + (seed % 3) * 0.6;
  const gx = Math.floor(x / C);
  const gy = Math.floor(y / C);
  let d1 = Infinity;
  let d2 = Infinity;
  let rx = 0;
  let ry = 0;
  for (let oy = -1; oy <= 1; oy++)
    for (let ox = -1; ox <= 1; ox++) {
      const cx = gx + ox;
      const cy = gy + oy;
      const fx = (cx + 0.15 + hash2(cx, cy, seed + 21) * 0.7) * C;
      const fy = (cy + 0.15 + hash2(cx, cy, seed + 22) * 0.7) * C;
      const dx = x + 0.5 - fx;
      const dy = (y + 0.5 - fy) * 1.2;
      const d = Math.hypot(dx, dy);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        rx = dx / C;
        ry = dy / C;
      } else if (d < d2) d2 = d;
    }
  // Only the underside of a tuft falls into shadow, so leaves read as stacked crescents.
  if (d2 - d1 < 0.9) return ry > -0.05 ? -0.36 : -0.06;
  return -(rx * 0.35 + ry * 0.9) * 0.34;
}

const LIGHT = (() => {
  const l = [-0.55, -0.75, 0.5];
  const n = Math.hypot(l[0], l[1], l[2]);
  return l.map((v) => v / n);
})();

export interface Mass {
  x: number;
  y: number;
  r: number;
}

/** Paints leaf masses into `p`. Returns the covered-pixel mask. */
export function leafMass(p: Pix, masses: Mass[], pal: Pal, seed: number, speckle?: string): Uint8Array {
  const W = p.w;
  const H = p.h;
  const mask = new Uint8Array(W * H);
  const tone = new Int8Array(W * H).fill(-1);
  let minY = Infinity;
  let maxY = -Infinity;
  for (const m of masses) {
    minY = Math.min(minY, m.y - m.r);
    maxY = Math.max(maxY, m.y + m.r);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // Leafy silhouette: the boundary wobbles leaf by leaf.
      const wob = (hash2(x >> 1, y >> 1, seed + 3) - 0.5) * 0.34;
      let front = -1;
      let best = -Infinity;
      let fh = 0;
      let fdx = 0;
      let fdy = 0;
      let covered = 0;
      for (let i = 0; i < masses.length; i++) {
        const m = masses[i];
        const dx = (x + 0.5 - m.x) / m.r;
        const dy = (y + 0.5 - m.y) / (m.r * 0.92);
        const d2 = dx * dx + dy * dy;
        if (d2 > 1 + wob) continue;
        covered++;
        const h = Math.sqrt(Math.max(0, 1 - d2));
        const score = m.y + h * m.r * 0.7;
        if (score > best) {
          best = score;
          front = i;
          fh = h;
          fdx = dx;
          fdy = dy;
        }
      }
      if (front < 0) continue;
      mask[y * W + x] = 1;
      const nz = Math.max(0.15, fh);
      const diff = fdx * LIGHT[0] + fdy * LIGHT[1] + nz * LIGHT[2];
      // Leaf clumps: a jittered grid of little rounded tufts, each lit on its upper left
      // and shaded underneath, with a dark crease between neighbours.
      const leaf = tuft(x, y, seed);
      // Creases where a mass meets the one behind it.
      const crease = covered > 1 && fh < 0.45 ? 0.5 * (1 - fh / 0.45) : 0;
      const grad = ((y - minY) / Math.max(1, maxY - minY)) * 0.42;
      const v = 0.3 + diff * 0.66 + leaf * 0.85 - crease - grad + (hash2(x, y, seed + 1) - 0.5) * 0.08;
      // Highlights stay rare so the canopy reads deep and rounded rather than washed out.
      const t = v > 1.04 ? 0 : v > 0.84 ? 1 : v > 0.6 ? 2 : v > 0.36 ? 3 : v > 0.12 ? 4 : 5;
      tone[y * W + x] = t;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!mask[i]) continue;
      let t = tone[i];
      const up = y > 0 && mask[i - W];
      const left = x > 0 && mask[i - 1];
      const down = y < H - 1 && mask[i + W];
      const right = x < W - 1 && mask[i + 1];
      // Sunlit rim along the top-left silhouette; darker lip underneath.
      if (!up && t > 0 && t < 4) t = Math.max(0, t - 2);
      else if (!left && t > 1 && t < 4) t -= 1;
      if (!down) t = Math.max(t, 4);
      if (!right && t < 3) t += 1;
      let c = pal[t];
      if (speckle && t <= 2 && hash2(x, y, seed + 9) < 0.05) c = speckle;
      p.set(x, y, c);
    }
  // Selective outline: deep tone below/right, shadow tone above/left.
  const out: Array<[number, number, string]> = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (mask[i] || p.opaque(x, y)) continue;
      const n = (dx: number, dy: number) => x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H && mask[(y + dy) * W + x + dx];
      if (n(0, -1) || n(-1, 0)) out.push([x, y, mix(pal[5], '#1a2a30', 0.35)]);
      else if (n(0, 1) || n(1, 0)) out.push([x, y, pal[5]]);
    }
  for (const [x, y, c] of out) p.set(x, y, c);
  return mask;
}

/** Bark: lit left edge, dark right, knots and a flared root. */
function bark(p: Pix, cx: number, top: number, bottom: number, w: number, base: string, dark: string, birch = false) {
  for (let y = top; y <= bottom; y++) {
    const flare = y >= bottom - 2 ? bottom - y === 0 ? 2 : 1 : 0;
    const x0 = Math.round(cx - w / 2) - flare;
    const x1 = Math.round(cx + w / 2) - 1 + flare;
    for (let x = x0; x <= x1; x++) {
      const rel = (x - x0) / Math.max(1, x1 - x0);
      let c = rel < 0.25 ? mix(base, '#ffffff', birch ? 0.3 : 0.15) : rel > 0.72 ? dark : base;
      if (!birch && hash2(x, y >> 1, 11) < 0.14 && rel > 0.2 && rel < 0.8) c = mix(base, dark, 0.6);
      if (birch && hash2(x >> 1, y, 12) < 0.12) c = '#3a3a40';
      p.set(x, y, c);
    }
  }
  // Roots.
  p.set(Math.round(cx - w / 2) - 3, bottom, dark);
  p.set(Math.round(cx + w / 2) + 2, bottom, dark);
}

const r = (v: number, k: number) => hash2(v, k, 8181);

function deciduousPal(v: number, season: SeasonLook, golden: boolean): Pal {
  if (season === 0) return golden ? PALS.golden : PALS.oakSpring;
  if (season === 1) return golden ? PALS.golden : PALS.oakSummer;
  const k = r(v, 90);
  return k < 0.4 ? PALS.autumnOrange : k < 0.7 ? PALS.autumnYellow : PALS.autumnRed;
}

function bareBranches(p: Pix, cx: number, top: number, spread: number, v: number, snow: boolean) {
  const br = '#6e4a38';
  const tips: Array<[number, number]> = [];
  const limbs = 4 + Math.floor(r(v, 70) * 3);
  for (let i = 0; i < limbs; i++) {
    const a = -Math.PI / 2 + (i / (limbs - 1) - 0.5) * 2.2;
    const len = spread * (0.6 + r(v, 71 + i) * 0.4);
    const ex = cx + Math.cos(a) * len;
    const ey = top + Math.sin(a) * len * 0.8;
    p.line(cx, top, ex, ey, br);
    const mx = (cx + ex) / 2;
    const my = (top + ey) / 2;
    p.line(mx, my, mx + Math.cos(a - 0.6) * len * 0.4, my + Math.sin(a - 0.6) * len * 0.35, br);
    tips.push([ex, ey]);
  }
  if (snow) for (const [x, y] of tips) p.set(Math.round(x), Math.round(y) - 1, '#f4f8ff');
}

/** Round-crowned broadleaf (oak), or the yellow-green "golden" variety. */
export function broadleaf(v: number, season: SeasonLook, golden = false): TreeSprite {
  const W = 50;
  const H = 60;
  const p = new Pix(W, H);
  const cx = 25 + Math.round((r(v, 1) - 0.5) * 4);
  const crownR = 15 + r(v, 2) * 4;
  const crownY = 22 + r(v, 3) * 3;
  const trunkTop = Math.round(crownY + crownR * 0.45);
  bark(p, 25, trunkTop, H - 1, 6 + (v % 2), '#8a5c3c', '#5a3a2c');
  if (season === 3) {
    bareBranches(p, 25, trunkTop, crownR * 1.1, v, true);
    p.outline('#3a2a24');
    return { img: p.toCanvas(), swayRows: trunkTop, ax: 25, ay: H - 1 };
  }
  const masses: Mass[] = [{ x: cx, y: crownY, r: crownR }];
  const n = 7 + Math.floor(r(v, 4) * 6);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 1.05 + (i / (n - 1)) * Math.PI * 1.1 + (r(v, 10 + i) - 0.5) * 0.4;
    const d = crownR * (0.62 + r(v, 20 + i) * 0.3);
    masses.push({ x: cx + Math.cos(a) * d * 1.1, y: crownY + Math.sin(a) * d * 0.85, r: 5.5 + r(v, 30 + i) * 4.5 });
  }
  // Lower masses hang over the trunk top.
  masses.push({ x: cx - crownR * 0.45, y: crownY + crownR * 0.55, r: 6 + r(v, 40) * 3 });
  masses.push({ x: cx + crownR * 0.5, y: crownY + crownR * 0.5, r: 6 + r(v, 41) * 3 });
  leafMass(p, masses, deciduousPal(v, season, golden), v * 13 + 5, season === 0 && !golden && v % 3 === 0 ? '#fff6d0' : undefined);
  return { img: p.toCanvas(), swayRows: trunkTop, ax: 25, ay: H - 1 };
}

/** Slender white-barked birch with an airy, broken crown. */
export function birch(v: number, season: SeasonLook): TreeSprite {
  const W = 38;
  const H = 62;
  const p = new Pix(W, H);
  const lean = Math.round((r(v, 1) - 0.5) * 4);
  // Trunk with a gentle lean.
  for (let y = 14; y < H; y++) {
    const t = (H - 1 - y) / (H - 15);
    const x = 19 + Math.round(lean * t);
    bark(p, x, y, y, 4, '#ece8e0', '#a8a49c', true);
  }
  p.set(18, H - 1, '#8a8680');
  if (season === 3) {
    bareBranches(p, 19 + lean, 22, 12, v, true);
    p.outline('#4a4640');
    return { img: p.toCanvas(), swayRows: 34, ax: 19, ay: H - 1 };
  }
  const masses: Mass[] = [];
  const n = 8 + Math.floor(r(v, 2) * 4);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    masses.push({ x: 19 + lean + (r(v, 10 + i) - 0.5) * 22, y: 6 + t * 28 + (r(v, 20 + i) - 0.5) * 4, r: 4.5 + r(v, 30 + i) * 3.5 });
  }
  const pal = season === 2 ? PALS.autumnYellow : PALS.birch;
  leafMass(p, masses, pal, v * 7 + 1);
  return { img: p.toCanvas(), swayRows: 38, ax: 19, ay: H - 1 };
}

/** Cherry in blossom (spring); a green broadleaf the rest of the year. */
export function cherry(v: number, season: SeasonLook): TreeSprite {
  if (season !== 0) return broadleaf(v + 1, season);
  const W = 50;
  const H = 58;
  const p = new Pix(W, H);
  bark(p, 25, 34, H - 1, 6, '#7a4a42', '#4e2e30');
  p.line(25, 36, 16, 26, '#6a3e38');
  p.line(25, 35, 34, 25, '#6a3e38');
  const masses: Mass[] = [{ x: 25, y: 20, r: 14 + r(v, 1) * 2 }];
  const n = 8 + Math.floor(r(v, 2) * 5);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 1.05 + (i / (n - 1)) * Math.PI * 1.1;
    masses.push({ x: 25 + Math.cos(a) * 14, y: 21 + Math.sin(a) * 11, r: 5 + r(v, 30 + i) * 4 });
  }
  masses.push({ x: 14, y: 28, r: 6 }, { x: 36, y: 28, r: 6 });
  leafMass(p, masses, PALS.blossom, v * 5 + 2, '#ffffff');
  return { img: p.toCanvas(), swayRows: 34, ax: 25, ay: H - 1 };
}

/** Conifer with drooping, scalloped tiers of boughs. */
export function conifer(v: number, season: SeasonLook): TreeSprite {
  const W = 36;
  const H = 66;
  const p = new Pix(W, H);
  const cx = 18;
  bark(p, cx, 50, H - 1, 4, '#7a4e36', '#4a3024');
  const pal = season === 3 ? PALS.pineWinter : PALS.pine;
  const tiers = 6 + Math.floor(r(v, 1) * 2);
  const top = 3 + Math.floor(r(v, 2) * 3);
  const bottom = 54;
  const mask = new Uint8Array(W * H);
  for (let k = 0; k < tiers; k++) {
    const t0 = k / tiers;
    const ty = top + Math.round(t0 * (bottom - top - 8));
    const th = 11 + Math.round(t0 * 4);
    // Each side of each tier has its own reach, so the silhouette is ragged, not a cone.
    const base = 3 + t0 * 13;
    const halfL = base + (r(v, 10 + k) - 0.3) * 3;
    const halfR = base + (r(v, 30 + k) - 0.3) * 3;
    for (let y = ty; y < ty + th; y++) {
      const f = (y - ty) / th;
      for (let x = 0; x < W; x++) {
        const side = x + 0.5 < cx ? halfL : halfR;
        const hw = side * (0.3 + 0.7 * f);
        const rel = (x + 0.5 - cx) / hw;
        if (Math.abs(rel) > 1) continue;
        // Drooping bough tips along the bottom of each tier.
        const scallop = Math.abs(Math.sin((x + k * 3) * 0.85)) * 2.4;
        if (y > ty + th - 1 - scallop * (0.35 + Math.abs(rel) * 0.9)) continue;
        const i = y * W + x;
        // Sunlit upper face, shaded underside, needles as short diagonal strokes.
        const shadeUnder = f > 0.8 ? 1.5 : f > 0.62 ? 0.7 : 0;
        const needle = (x + y * 2 + k) % 3 === 0 ? 0.55 : 0;
        const topLit = f < 0.22 ? -1.2 : f < 0.4 ? -0.5 : 0;
        let tone = 2.3 + rel * 1.25 + shadeUnder + topLit + needle + t0 * 0.35 + (hash2(x, y, v + k) - 0.5) * 0.5;
        if (mask[i]) tone = Math.max(tone, 2.4);
        const tt = Math.max(0, Math.min(5, Math.round(tone)));
        mask[i] = 1;
        p.set(x, y, pal[tt]);
      }
    }
    if (season === 3) {
      const sy = ty + Math.round(th * 0.3);
      for (let x = Math.floor(cx - halfL * 0.6); x <= Math.ceil(cx + halfR * 0.35); x++) if (hash2(x, sy, v) < 0.8 && mask[sy * W + x]) {
        p.set(x, sy, '#ffffff');
        if (hash2(x, sy + 1, v) < 0.4) p.set(x, sy + 1, '#e8f0f8');
      }
    }
  }
  p.outline(mix(pal[5], '#10202a', 0.4));
  return { img: p.toCanvas(), swayRows: 50, ax: cx, ay: H - 1 };
}

/** Dense leafy shrub; berries or blossoms on some. */
export function shrub(v: number, season: SeasonLook): HTMLCanvasElement {
  const p = new Pix(22, 18);
  if (season === 3) {
    bareBranches(p, 11, 15, 8, v, true);
    p.outline('#3a2a24');
    return p.toCanvas();
  }
  const masses: Mass[] = [
    { x: 11, y: 10, r: 7 + r(v, 1) * 1.5 },
    { x: 5.5 + r(v, 2) * 1.5, y: 12, r: 4.5 },
    { x: 16.5 - r(v, 3) * 1.5, y: 12, r: 4.5 },
    { x: 9 + r(v, 4) * 4, y: 6, r: 4.5 },
  ];
  leafMass(p, masses, season === 2 ? PALS.bushAutumn : PALS.bush, v * 3 + 7);
  if (v % 4 === 0 && season !== 2)
    for (let i = 0; i < 6; i++) {
      const x = 4 + Math.floor(r(v, 50 + i) * 14);
      const y = 5 + Math.floor(r(v, 60 + i) * 9);
      if (p.opaque(x, y)) p.set(x, y, season === 0 ? '#fff0f8' : '#e84a5a');
    }
  return p.toCanvas();
}

