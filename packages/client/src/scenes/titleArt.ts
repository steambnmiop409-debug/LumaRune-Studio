/**
 * Pieces of the title screen, drawn the way well-loved pixel-art games dress theirs:
 * a banded dusk sky with twinkling stars and layered clouds (parallax), a gull flock crossing now
 * and then, fireflies in the foreground, a big lettered logo with bevel, outline, drop shadow and a
 * passing glint, and wooden sign-board menu buttons.
 */
import { hash2 } from '@lumina/core';
import { hexToRgb, type RGB } from '../art/palette';
import { drawText, measure } from '../engine/text';

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ───────────── sky ─────────────

/** Dusk, top to horizon, in flat bands blended by a 4×4 ordered dither (no smooth gradients). */
const SKY = ['#191b3d', '#232454', '#322d66', '#4a3877', '#6a4585', '#8f5487', '#b8657f', '#d97f78', '#eea27a', '#f6c68e'];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

let skyCache: { w: number; h: number; c: HTMLCanvasElement } | null = null;
export function sky(w: number, h: number): HTMLCanvasElement {
  if (skyCache && skyCache.w === w && skyCache.h === h) return skyCache.c;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const cols = SKY.map(hexToRgb);
  for (let y = 0; y < h; y++) {
    const f = (y / h) * (cols.length - 1);
    const i = Math.min(cols.length - 2, Math.floor(f));
    const t = f - i;
    for (let x = 0; x < w; x++) {
      const pick = t * 16 > BAYER[(y & 3) * 4 + (x & 3)] ? cols[i + 1] : cols[i];
      const o = (y * w + x) * 4;
      img.data[o] = pick[0];
      img.data[o + 1] = pick[1];
      img.data[o + 2] = pick[2];
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  skyCache = { w, h, c };
  return c;
}

/** Stars in the upper sky; each twinkles on its own beat. */
export function stars(ctx: CanvasRenderingContext2D, w: number, h: number, oy: number, t: number, alpha: number): void {
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(hash2(i, 7) * w);
    const y = Math.floor(hash2(i, 13) ** 1.6 * h * 0.55) + oy;
    const tw = Math.sin(t * (1 + hash2(i, 3) * 2) + i) * 0.5 + 0.5;
    ctx.globalAlpha = alpha * (0.35 + tw * 0.65);
    ctx.fillStyle = hash2(i, 5) > 0.8 ? '#ffe9c0' : '#e8ecff';
    ctx.fillRect(x, y, 1, 1);
    if (hash2(i, 9) > 0.9 && tw > 0.7) {
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
    }
  }
  ctx.globalAlpha = 1;
}

// ───────────── clouds ─────────────

/** A lumpy pixel cloud lit from below by the setting sun. */
function cloud(seed: number, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const puffs: Array<[number, number, number]> = [];
  const n = 4 + Math.floor(hash2(seed, 1) * 4);
  for (let i = 0; i < n; i++) {
    const r = h * (0.28 + hash2(seed, i + 10) * 0.22);
    const x = r + (w - 2 * r) * (n === 1 ? 0.5 : i / (n - 1)) + (hash2(seed, i + 20) - 0.5) * 6;
    const y = h - r - 1 - hash2(seed, i + 30) * (h * 0.25) * Math.sin((i / (n - 1)) * Math.PI);
    puffs.push([x, y, r]);
  }
  const inside = (x: number, y: number) => puffs.some(([px, py, r]) => (x - px) ** 2 + ((y - py) * 1.25) ** 2 <= r * r) && y < h - 1;
  const top = hexToRgb('#f3b6a0');
  const mid = hexToRgb('#c98398');
  const low = hexToRgb('#7a5a8e');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      // Lit edges face down toward the sun; the tops fall into shade.
      const below = !inside(x, y + 2);
      const above = !inside(x, y - 2);
      const col = below ? top : above ? low : y > h * 0.62 ? mix(mid, top, 0.35) : mid;
      const o = (y * w + x) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

let clouds: HTMLCanvasElement[] | null = null;
function cloudSprites(): HTMLCanvasElement[] {
  clouds ??= [0, 1, 2, 3, 4, 5].map((i) => cloud(i + 3, 60 + Math.floor(hash2(i, 4) * 60), 16 + Math.floor(hash2(i, 6) * 10)));
  return clouds;
}

/** Three layers of drifting clouds; nearer layers move faster and sit lower (parallax). */
export function cloudLayers(ctx: CanvasRenderingContext2D, w: number, h: number, oy: number, t: number): void {
  const sp = cloudSprites();
  for (let layer = 0; layer < 3; layer++) {
    const speed = 3 + layer * 4;
    const y0 = h * (0.12 + layer * 0.14) + oy;
    ctx.globalAlpha = 0.55 + layer * 0.2;
    for (let i = 0; i < 4; i++) {
      const s = sp[(i + layer * 2) % sp.length];
      const span = w + s.width + 40;
      const x = ((hash2(i, layer) * span + t * speed) % span) - s.width;
      const y = y0 + (hash2(i, layer + 7) - 0.5) * 30;
      ctx.drawImage(s, Math.round(x), Math.round(y));
    }
  }
  ctx.globalAlpha = 1;
}

// ───────────── life ─────────────

/** A few gulls cross the sky every so often, flapping in turns. */
export function birds(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const period = 16;
  const k = (t % period) / 9;
  if (k > 1) return;
  const run = Math.floor(t / period);
  const y0 = h * (0.18 + hash2(run, 2) * 0.2);
  const dir = hash2(run, 3) > 0.5 ? 1 : -1;
  const x0 = dir > 0 ? -30 + k * (w + 60) : w + 30 - k * (w + 60);
  ctx.fillStyle = '#2b2440';
  const n = 3 + Math.floor(hash2(run, 4) * 3);
  for (let i = 0; i < n; i++) {
    const x = Math.round(x0 - dir * i * 9);
    const y = Math.round(y0 + (i % 2 ? 4 : 0) + i * 2 + Math.sin(t * 2 + i) * 1.5);
    const up = Math.floor(t * 6 + i * 1.7) % 2 === 0;
    if (up) {
      ctx.fillRect(x - 3, y - 1, 1, 1);
      ctx.fillRect(x - 2, y, 2, 1);
      ctx.fillRect(x + 1, y, 2, 1);
      ctx.fillRect(x + 3, y - 1, 1, 1);
      ctx.fillRect(x, y + 1, 1, 1);
    } else {
      ctx.fillRect(x - 3, y + 1, 1, 1);
      ctx.fillRect(x - 2, y, 5, 1);
      ctx.fillRect(x + 3, y + 1, 1, 1);
    }
  }
}

/** Fireflies drifting over the foreground at dusk. */
export function fireflies(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, alpha: number): void {
  for (let i = 0; i < 16; i++) {
    const bx = hash2(i, 21) * w;
    const by = h * (0.55 + hash2(i, 22) * 0.4);
    const x = Math.round(bx + Math.sin(t * 0.4 + i * 1.3) * 18);
    const y = Math.round(by + Math.sin(t * 0.7 + i * 2.1) * 8);
    const glow = Math.max(0, Math.sin(t * (0.8 + hash2(i, 23)) + i * 3));
    if (glow < 0.05) continue;
    ctx.globalAlpha = alpha * glow * 0.35;
    ctx.fillStyle = '#fff2a0';
    ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.globalAlpha = alpha * glow;
    ctx.fillStyle = '#fffbd8';
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}

// ───────────── logo ─────────────

interface Logo {
  img: HTMLCanvasElement;
  /** White where the lettering's face is (for the glint). */
  face: HTMLCanvasElement;
}

const logos = new Map<string, Logo>();

/**
 * The game's name as big lettering: the title font scaled up, then shaded at native resolution —
 * a warm top-to-bottom gradient, a light top bevel and dark bottom bevel on every stroke,
 * a two-pixel ink outline, a soft purple rim and a drop shadow.
 */
export function logo(text: string, scale = 3): Logo {
  const key = `${text}|${scale}`;
  const hit = logos.get(key);
  if (hit) return hit;
  const tw = measure(text, 'title', true) + 3;
  const th = 18;
  const small = document.createElement('canvas');
  small.width = tw;
  small.height = th;
  drawText(small.getContext('2d')!, text, 1, 1, { font: 'title', color: '#ffffff', raw: true });
  const raw = small.getContext('2d')!.getImageData(0, 0, tw, th).data;
  // Faux bold: every stroke one pixel wider, so the lettering reads as a chunky logo, not body text.
  const ink1 = (x: number, y: number) => x >= 0 && x < tw && raw[(y * tw + x) * 4 + 3] > 128;
  const sm = new Uint8Array(tw * th * 4);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (ink1(x, y) || ink1(x - 1, y)) sm[(y * tw + x) * 4 + 3] = 255;
  const pad = 5;
  const W = tw * scale + pad * 2;
  const H = th * scale + pad * 2 + 3;
  const on = new Uint8Array(W * H);
  let top = H;
  let bottom = 0;
  for (let y = 0; y < th * scale; y++)
    for (let x = 0; x < tw * scale; x++)
      if (sm[(Math.floor(y / scale) * tw + Math.floor(x / scale)) * 4 + 3] > 128) {
        on[(y + pad) * W + x + pad] = 1;
        top = Math.min(top, y + pad);
        bottom = Math.max(bottom, y + pad);
      }
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && on[y * W + x] === 1;
  const near = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) <= r + 1 && at(x + dx, y + dy)) return true;
    return false;
  };
  const grad = ['#fff7de', '#ffe8a8', '#fbd477', '#f2b95a', '#e39a42', '#cf7f36'].map(hexToRgb);
  const ink = hexToRgb('#2a1a34');
  const rim = hexToRgb('#5a3a70');
  const hiC = hexToRgb('#fffdf2');
  const loC = hexToRgb('#a85f2a');
  const shadow = hexToRgb('#140c24');
  const img = new ImageData(W, H);
  const face = new ImageData(W, H);
  const put = (d: ImageData, x: number, y: number, c: readonly number[], a = 255) => {
    const o = (y * W + x) * 4;
    d.data[o] = c[0];
    d.data[o + 1] = c[1];
    d.data[o + 2] = c[2];
    d.data[o + 3] = a;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (at(x, y)) {
        const f = (y - top) / Math.max(1, bottom - top);
        let c = grad[Math.min(grad.length - 1, Math.floor(f * grad.length))];
        if (!at(x, y - 1) || !at(x, y - 2)) c = !at(x, y - 1) ? hiC : mix(c, hiC, 0.5);
        else if (!at(x, y + 1)) c = loC;
        else if (!at(x, y + 2)) c = mix(c, loC, 0.5);
        put(img, x, y, c);
        put(face, x, y, [255, 255, 255]);
      } else if (near(x, y, 1)) put(img, x, y, ink);
      else if (near(x, y, 2)) put(img, x, y, rim);
      else if (near(x, y - 3, 2)) put(img, x, y, shadow, 150);
    }
  const mk = (d: ImageData) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    c.getContext('2d')!.putImageData(d, 0, 0);
    return c;
  };
  const out = { img: mk(img), face: mk(face) };
  logos.set(key, out);
  return out;
}

let glintBuf: HTMLCanvasElement | null = null;
/** A bright diagonal band sweeping across the lettering every few seconds. */
export function glint(ctx: CanvasRenderingContext2D, lg: Logo, x: number, y: number, t: number): void {
  const period = 5.5;
  const k = (t % period) / 0.9;
  if (k > 1) return;
  const { width: W, height: H } = lg.img;
  glintBuf ??= document.createElement('canvas');
  if (glintBuf.width !== W || glintBuf.height !== H) {
    glintBuf.width = W;
    glintBuf.height = H;
  }
  const g = glintBuf.getContext('2d')!;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  const bx = -H + k * (W + H * 2);
  for (let yy = 0; yy < H; yy++) g.fillRect(Math.round(bx + yy * 0.6), yy, 5, 1);
  g.fillStyle = 'rgba(255,255,255,0.4)';
  for (let yy = 0; yy < H; yy++) g.fillRect(Math.round(bx + yy * 0.6) + 8, yy, 2, 1);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(lg.face, 0, 0);
  ctx.drawImage(glintBuf, x, y);
}

/** A four-point twinkle. */
export function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const s = Math.sin(t * 3) * 0.5 + 0.5;
  const r = 1 + Math.round(s * 3);
  ctx.fillStyle = '#fffbe0';
  ctx.globalAlpha = 0.5 + s * 0.5;
  ctx.fillRect(x - r, y, r * 2 + 1, 1);
  ctx.fillRect(x, y - r, 1, r * 2 + 1);
  ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.globalAlpha = 1;
}

// ───────────── menu ─────────────

export type SignIcon = 'continue' | 'new' | 'settings' | 'quit' | 'back';

const ICONS: Record<SignIcon, string[]> = {
  continue: ['..........', '.##....##.', '#..#..#..#', '#...##...#', '#...##...#', '#...##...#', '#...##...#', '.###..###.', '..........'],
  new: ['....##....', '...#..#...', '.##.##.##.', '#..#..#..#', '.##.##.##.', '....##....', '....##....', '..######..', '.########.'],
  settings: ['...####...', '.##.##.##.', '.#......#.', '##..##..##', '#..#..#..#', '##..##..##', '.#......#.', '.##.##.##.', '...####...'],
  quit: ['.#######..', '.#.....#..', '.#.....#..', '.#...#.#..', '.#..####..', '.#...#.#..', '.#.....#..', '.#######..', '..........'],
  back: ['...#......', '..##......', '.#######..', '########..', '.#######..', '..##......', '...#......', '..........', '..........'],
};

function icon(ctx: CanvasRenderingContext2D, which: SignIcon, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ICONS[which].forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(x + i, y + j, 1, 1);
  });
}

/**
 * A wooden sign-board button. The selected one slides out, brightens and gets a brass pointer.
 */
export function signBoard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, which: SignIcon, selected: boolean, t: number): void {
  const slide = selected ? 4 : 0;
  x += slide;
  // Shadow, rope-tied plank, grain, nails.
  ctx.fillStyle = 'rgba(20,12,30,0.45)';
  ctx.fillRect(x + 2, y + 3, w, h);
  ctx.fillStyle = '#2a1a1e';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = selected ? '#b07a4e' : '#94613e';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = selected ? '#c8915e' : '#a8704a';
  ctx.fillRect(x + 1, y + 1, w - 2, 2);
  ctx.fillStyle = selected ? '#8a5a38' : '#74482e';
  ctx.fillRect(x + 1, y + h - 3, w - 2, 2);
  ctx.fillStyle = selected ? '#9c6a42' : '#83553a';
  for (let i = 0; i < 5; i++) {
    const gy = y + 5 + Math.floor(hash2(i, w) * (h - 9));
    const gx = x + 6 + Math.floor(hash2(i, h + 3) * (w - 40));
    ctx.fillRect(gx, gy, 10 + Math.floor(hash2(i, 9) * 18), 1);
  }
  ctx.fillStyle = '#e8d8b0';
  ctx.fillRect(x + 3, y + Math.floor(h / 2) - 1, 2, 2);
  ctx.fillRect(x + w - 5, y + Math.floor(h / 2) - 1, 2, 2);
  icon(ctx, which, x + 10, y + Math.floor((h - 9) / 2) + 1, '#2a1a1e');
  icon(ctx, which, x + 10, y + Math.floor((h - 9) / 2), selected ? '#fff2c8' : '#f3dfb4');
  drawText(ctx, label, x + 26, y + Math.floor((h - 14) / 2) + 1, { color: selected ? '#fff6dc' : '#f3e3c3', outline: '#2a1a1e', maxWidth: w - 32 });
  if (selected) {
    // Brass pointer, bobbing.
    const px = x - 10 - slide + Math.round(Math.sin(t * 6) * 1.5);
    const py = y + Math.floor(h / 2) - 3;
    ctx.fillStyle = '#2a1a1e';
    for (let i = 0; i < 4; i++) ctx.fillRect(px + i, py - 1 + i, 1, 9 - i * 2);
    ctx.fillStyle = '#ecc97a';
    for (let i = 0; i < 3; i++) ctx.fillRect(px + i, py + 1 + i, 1, 5 - i * 2);
  }
}
