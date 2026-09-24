import { hash2, type CropDef, type ProduceShape } from '@lumina/core';
import { Pix } from '../Pix';
import { light, mix, shade } from '../palette';
import { clump } from './shading';

export const CROP_W = 24;
export const CROP_H = 36;
/** Ground line inside the crop sprite. */
const GY = 33;
const CX = 12;

type Pal = { l: string; ll: string; d: string; dd: string };
const pal = (c: string): Pal => ({ l: light(c, 1), ll: light(c, 2), d: shade(c, 1), dd: shade(c, 2) });

/** A tapered leaf blade from (bx, by) at `angle` (radians, 0 = right, -π/2 = up). */
function leaf(p: Pix, bx: number, by: number, angle: number, len: number, wid: number, c: string) {
  const P = pal(c);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let t = 0; t <= len; t += 0.5) {
    const hw = wid * Math.sin((Math.PI * t) / len) * (t < len * 0.3 ? 0.8 : 1);
    const cx = bx + dx * t;
    const cy = by + dy * t;
    for (let s = -hw; s <= hw; s += 0.5) {
      const x = cx - dy * s;
      const y = cy + dx * s;
      // Upper side lighter, lower side darker, midrib.
      const side = s * -Math.sign(dx || 1);
      let col = side > hw * 0.3 ? P.l : side < -hw * 0.4 ? P.d : c;
      if (Math.abs(s) < 0.5 && t > 1) col = P.ll;
      p.set(x, y, col);
    }
  }
}

function stem(p: Pix, x0: number, y0: number, x1: number, y1: number, c: string) {
  p.line(x0, y0, x1, y1, shade(c, 1));
}

function blob(p: Pix, cx: number, cy: number, rx: number, ry: number, c: string, seed: number, cell = 3) {
  const P = [light(c, 2), light(c, 1), c, shade(c, 1), shade(c, 2)];
  p.ellipse(cx, cy, rx, ry, (nx, ny) => {
    let t = 2 + clump(Math.round(cx + nx * rx), Math.round(cy + ny * ry), cell, seed);
    if (ny > 0.55) t++;
    if (ny < -0.5) t--;
    return P[Math.max(0, Math.min(4, t))];
  });
}

/** Small fruit dot: round with a highlight. */
function fruit(p: Pix, x: number, y: number, r: number, c: string) {
  const hi = light(c, 2);
  const lo = shade(c, 1);
  if (r <= 1) {
    p.set(x, y, c);
    p.set(x + 1, y, lo);
    p.set(x, y - 1, hi);
    return;
  }
  p.ellipse(x, y, r, r, (nx, ny) => (nx < -0.2 && ny < -0.2 ? hi : nx + ny > 0.6 ? lo : c));
}

function mound(p: Pix) {
  p.ellipse(CX, GY, 4, 1.8, '#7a5236');
  p.set(CX - 1, GY - 1, '#a87a52');
  p.set(CX + 1, GY - 1, '#c8a878');
}

function sprout(p: Pix, c: string) {
  stem(p, CX, GY, CX, GY - 4, c);
  leaf(p, CX, GY - 4, -2.4, 4, 1.5, light(c, 1));
  leaf(p, CX, GY - 4, -0.7, 4, 1.5, c);
}

function trellis(p: Pix, height: number) {
  const wood = '#b8875a';
  p.rect(CX - 6, GY - height, 1, height + 1, wood);
  p.rect(CX + 6, GY - height, 1, height + 1, wood);
  for (let y = GY - height + 3; y < GY; y += 6) p.rect(CX - 6, y, 13, 1, shade(wood, 1));
  p.rect(CX - 6, GY - height, 13, 1, light(wood, 1));
}

/** Draws produce details on a ready plant, by shape. */
function produceOn(p: Pix, shape: ProduceShape, c: string, spots: Array<[number, number]>, big = false) {
  for (const [x, y] of spots) {
    switch (shape) {
      case 'pepper':
        p.set(x, y - 1, '#4f8a3a');
        p.set(x, y, c);
        p.set(x, y + 1, c);
        p.set(x + 1, y + 2, shade(c, 1));
        p.set(x - 1, y, light(c, 1));
        break;
      case 'long':
        p.set(x, y - 1, '#4f7a3a');
        p.rect(x - 1, y, 2, 4, c);
        p.set(x - 1, y, light(c, 1));
        p.set(x, y + 3, shade(c, 1));
        break;
      case 'pod':
        p.line(x, y, x + 1, y + 4, c);
        p.set(x + 1, y + 1, light(c, 1));
        break;
      case 'berry':
      case 'cluster':
        fruit(p, x, y, 1, c);
        fruit(p, x + 1, y + 1, 1, c);
        if (shape === 'cluster') {
          fruit(p, x - 1, y + 1, 1, c);
          fruit(p, x, y + 2, 1, c);
        }
        break;
      case 'bloom':
        p.set(x, y, '#f5d040');
        p.set(x - 1, y, c);
        p.set(x + 1, y, c);
        p.set(x, y - 1, light(c, 1));
        p.set(x, y + 1, shade(c, 1));
        break;
      case 'nut':
        fruit(p, x, y, 1, c);
        p.set(x, y - 1, shade(c, 2));
        break;
      default:
        fruit(p, x, y, big ? 2 : 1.4, c);
    }
  }
}

function drawForm(p: Pix, def: CropDef, stage: number, seed: number) {
  const L = def.leafColor;
  const F = def.produceColor;
  const ready = stage >= 4;
  const g = stage / 4;
  switch (def.form) {
    case 'rosette': {
      const r = 2 + g * 5;
      const n = 5 + stage;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI + (i / (n - 1)) * Math.PI + (hash2(i, seed, 1) - 0.5) * 0.3;
        leaf(p, CX, GY - 1, a, r + 1, 1.2 + g * 1.6, i % 2 ? L : light(L, 1));
      }
      if (stage >= 3) {
        const head = ready ? (def.shape === 'leaf' ? light(F, 0) : F) : light(L, 1);
        const hr = ready ? 3.8 : 2.6;
        if (def.shape === 'leaf') for (let i = 0; i < 5; i++) leaf(p, CX, GY - 2, -Math.PI + 0.3 + i * 0.6, 5 + (ready ? 2 : 0), 2.2, i % 2 ? head : light(head, 1));
        else blob(p, CX, GY - 4, hr + 0.5, hr, head, seed + 5, 3);
      }
      break;
    }
    case 'leafy':
    case 'herb': {
      const fine = def.form === 'herb';
      const n = 3 + stage * (fine ? 2 : 1);
      const len = 3 + g * (fine ? 8 : 11);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / Math.max(1, n - 1) - 0.5) * 2.2 + (hash2(i, seed, 2) - 0.5) * 0.3;
        const l = len * (0.7 + hash2(i, seed, 3) * 0.3);
        if (!fine && def.produceColor !== def.leafColor && def.category === 'leafy') stem(p, CX, GY, CX + Math.cos(a) * l * 0.5, GY + Math.sin(a) * l * 0.5, F);
        leaf(p, CX, GY - 1, a, l, fine ? 1 : 1.3 + g * 1.4, i % 3 === 0 ? light(L, 1) : L);
      }
      if (ready) {
        const tips: Array<[number, number]> = [];
        for (let i = 0; i < (fine ? 5 : 3); i++) tips.push([CX - 5 + Math.floor(hash2(i, seed, 4) * 10), GY - 4 - Math.floor(hash2(i, seed, 5) * len * 0.8)]);
        if (def.shape === 'leaf' || def.shape === 'stalk') for (const [x, y] of tips) p.set(x, y, light(F, 1));
        else produceOn(p, def.shape, F, tips);
      }
      if (def.category === 'root' && ready) {
        p.ellipse(CX, GY, 3.5, 1.8, F);
        p.set(CX - 1, GY - 1, light(F, 1));
      }
      break;
    }
    case 'root': {
      const n = 3 + stage;
      const len = 4 + g * 9;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / Math.max(1, n - 1) - 0.5) * 1.8;
        leaf(p, CX, GY - 2, a, len * (0.75 + hash2(i, seed, 6) * 0.25), 1.2 + g, i % 2 ? L : light(L, 1));
      }
      if (stage >= 3) {
        // Shoulder of the root peeking from the soil.
        const w = ready ? 3.5 : 2.5;
        p.ellipse(CX, GY - 0.5, w, ready ? 2.5 : 1.6, (nx, ny) => (ny < -0.3 ? light(F, 1) : nx > 0.4 ? shade(F, 1) : F));
      }
      break;
    }
    case 'bulb': {
      const n = 2 + stage;
      const len = 5 + g * 12;
      for (let i = 0; i < n; i++) {
        const x = CX - n / 2 + i + 0.5;
        const lean = (i - n / 2) * 0.35;
        p.line(x, GY - 2, x + lean * 3, GY - 2 - len * (0.8 + hash2(i, seed, 7) * 0.2), i % 2 ? L : light(L, 1));
      }
      if (stage >= 3) {
        const w = ready ? 4 : 2.5;
        p.ellipse(CX, GY - 2, w, ready ? 3 : 2, (nx, ny) => (nx < -0.3 && ny < 0 ? light(F, 1) : nx > 0.4 ? shade(F, 1) : F));
      }
      break;
    }
    case 'bush': {
      if (stage === 1) {
        sprout(p, L);
        break;
      }
      const rx = 3 + g * 6;
      const ry = 2.5 + g * 5.5;
      const cy = GY - ry;
      stem(p, CX, GY, CX, cy, '#6e5a3a');
      blob(p, CX, cy, rx, ry, L, seed, 3);
      if (stage >= 3 && def.category === 'fruit') for (let i = 0; i < 4; i++) p.set(CX - 4 + Math.floor(hash2(i, seed, 8) * 8), cy - 2 + Math.floor(hash2(i, seed, 9) * 5), '#fff4f4');
      if (ready) {
        const spots: Array<[number, number]> = [];
        const n = def.shape === 'berry' ? 6 : 4;
        for (let i = 0; i < n; i++) spots.push([Math.round(CX - rx + 2 + hash2(i, seed, 10) * (rx * 2 - 4)), Math.round(cy - ry + 3 + hash2(i, seed, 11) * (ry * 2 - 5))]);
        produceOn(p, def.shape, F, spots, def.shape === 'round' || def.shape === 'head');
      }
      break;
    }
    case 'vine': {
      if (stage === 1) {
        trellis(p, 10);
        sprout(p, L);
        break;
      }
      const h = 10 + stage * 5;
      trellis(p, h);
      const top = GY - (stage >= 3 ? h : h * 0.6);
      for (let y = GY - 1; y > top; y -= 2) {
        const side = ((y >> 1) & 1) === 0 ? -1 : 1;
        const x = CX + side * (2 + hash2(y, seed, 12) * 3);
        leaf(p, CX, y, side < 0 ? Math.PI + 0.4 : -0.4, 3 + hash2(y, seed, 13) * 2, 1.4, y % 4 ? L : light(L, 1));
        p.set(x, y, shade(L, 1));
      }
      if (ready) {
        const spots: Array<[number, number]> = [];
        for (let i = 0; i < 4; i++) spots.push([Math.round(CX - 5 + hash2(i, seed, 14) * 10), Math.round(top + 4 + hash2(i, seed, 15) * (GY - top - 8))]);
        produceOn(p, def.shape, F, spots, def.shape === 'round' || def.shape === 'gourd');
      }
      break;
    }
    case 'sprawl': {
      if (stage === 1) {
        sprout(p, L);
        break;
      }
      const r = 3 + g * 7;
      for (let i = 0; i < 3 + stage; i++) {
        const a = -Math.PI + (i / (2 + stage)) * Math.PI;
        leaf(p, CX, GY - 2, a, r, 2 + g, i % 2 ? L : light(L, 1));
      }
      p.line(CX - r, GY - 1, CX + r, GY, shade(L, 1));
      if (ready) {
        const big = def.shape === 'gourd';
        p.ellipse(CX + 2, GY - (big ? 4 : 3), big ? 5.5 : 4, big ? 4.2 : 3.3, (nx, ny) => {
          let c = nx < -0.3 && ny < -0.2 ? light(F, 1) : nx > 0.35 || ny > 0.5 ? shade(F, 1) : F;
          if (def.id === 'watermelon' && Math.floor((nx + 1) * 4) % 2 === 0) c = shade(F, 2);
          if ((def.id === 'pumpkin' || def.id === 'kabocha') && Math.abs(nx) > 0.2 && Math.abs(nx) < 0.3) c = shade(F, 1);
          return c;
        });
        p.set(CX + 2, GY - (big ? 9 : 7), '#5a8a3a');
      }
      break;
    }
    case 'grain':
    case 'paddy': {
      if (def.form === 'paddy') {
        p.ellipse(CX, GY, 8, 2.5, '#5fa8c8');
        p.ellipse(CX - 2, GY - 0.5, 3, 0.8, '#a8e0f0');
      }
      if (def.id === 'lotus' || def.id === 'lotusroot') {
        for (let i = 0; i < 1 + stage; i++) {
          const x = CX - 6 + hash2(i, seed, 16) * 12;
          const y = GY - 2 - hash2(i, seed, 17) * 4;
          p.ellipse(x, y, 2.5 + g, 1.5 + g * 0.5, i % 2 ? L : light(L, 1));
        }
        if (ready && def.id === 'lotus') {
          stem(p, CX, GY - 2, CX, GY - 12, L);
          produceOn(p, 'bloom', F, [[CX, GY - 13]]);
          p.set(CX - 2, GY - 13, F);
          p.set(CX + 2, GY - 13, F);
        }
        break;
      }
      const n = 3 + stage * 2;
      const len = 4 + g * 14;
      const golden = ready ? mix(L, F, 0.55) : L;
      for (let i = 0; i < n; i++) {
        const x = CX - n / 2 + i;
        const lean = (hash2(i, seed, 18) - 0.5) * 3;
        const top = GY - len * (0.8 + hash2(i, seed, 19) * 0.2);
        p.line(x, GY - 1, x + lean, top, i % 2 ? golden : light(golden, 1));
        if (ready || stage >= 3) {
          const head = ready ? F : light(L, 1);
          p.set(x + lean, top - 1, head);
          p.set(x + lean, top, head);
          p.set(x + lean + (i % 2 ? 1 : -1), top + 1, shade(head, 1));
          if (ready) p.set(x + lean, top - 2, light(head, 1));
        }
      }
      break;
    }
    case 'stalk':
    case 'tall': {
      if (stage === 1) {
        sprout(p, L);
        break;
      }
      const h = 6 + g * (def.form === 'stalk' ? 22 : 18);
      const top = GY - h;
      p.line(CX, GY, CX, top, shade(L, 1));
      p.line(CX + 1, GY, CX + 1, top + 2, L);
      for (let y = GY - 3; y > top + 2; y -= 4) {
        const side = ((y >> 2) & 1) === 0 ? -1 : 1;
        leaf(p, CX, y, side < 0 ? Math.PI + 0.5 : -0.5, 4 + g * 3, 1.3, y % 8 ? L : light(L, 1));
      }
      if (ready) {
        if (def.shape === 'bloom' && def.form === 'stalk') {
          // Sunflower-like big head.
          p.ellipse(CX, top, 5, 5, (nx, ny) => (Math.hypot(nx, ny) < 0.5 ? (nx + ny > 0 ? '#5a3a24' : '#7a5236') : ny < -0.2 ? light(F, 1) : F));
        } else if (def.shape === 'spike') {
          p.ellipse(CX + 3, top + 8, 2, 4, (nx, ny) => (nx < -0.3 ? '#8ab85a' : ny < 0.6 ? F : shade(F, 1)));
          p.set(CX + 3, top + 3, '#c8a060');
        } else if (def.shape === 'bundle') {
          for (let i = -2; i <= 2; i++) p.line(CX + i, top, CX + i * 1.5, top - 5, i % 2 ? F : light(F, 1));
        } else {
          const spots: Array<[number, number]> = [];
          for (let i = 0; i < 4; i++) spots.push([CX + (i % 2 ? 2 : -2), top + 3 + i * Math.max(2, (h - 6) / 5)]);
          produceOn(p, def.shape, F, spots);
        }
      } else if (stage === 3 && def.shape === 'bloom') {
        p.ellipse(CX, top, 2, 2, light(L, 1));
      }
      break;
    }
    case 'flower': {
      if (stage === 1) {
        sprout(p, L);
        break;
      }
      const h = 4 + g * 10;
      const top = GY - h;
      leaf(p, CX, GY - 1, Math.PI + 0.6, 4 + g * 2, 1.4, L);
      leaf(p, CX, GY - 1, -0.6, 4 + g * 2, 1.4, light(L, 1));
      p.line(CX, GY, CX, top, shade(L, 1));
      if (stage >= 3) {
        const bloom = ready ? F : light(L, 1);
        if (ready) {
          p.ellipse(CX, top, 3.2, 2.6, (nx, ny) => (Math.hypot(nx, ny) < 0.35 ? '#f5d040' : ny < -0.2 ? light(bloom, 1) : nx > 0.4 ? shade(bloom, 1) : bloom));
          if (def.id === 'buckwheat' || def.id === 'rapeseed' || def.id === 'flax') {
            fruit(p, CX - 4, top + 3, 1, bloom);
            fruit(p, CX + 4, top + 2, 1, bloom);
          }
        } else p.ellipse(CX, top, 1.5, 2, bloom);
      }
      break;
    }
    case 'tree': {
      if (stage <= 2) {
        const h = 6 + stage * 5;
        p.line(CX, GY, CX, GY - h, '#7a5236');
        leaf(p, CX, GY - h + 1, Math.PI + 0.6, 3 + stage, 1.5, L);
        leaf(p, CX, GY - h + 1, -0.6, 3 + stage, 1.5, light(L, 1));
        leaf(p, CX, GY - h, -Math.PI / 2, 2 + stage, 1.3, L);
        break;
      }
      p.rect(CX - 1, GY - 12, 3, 12, '#8a5a3a');
      p.rect(CX - 1, GY - 12, 1, 12, '#a8744a');
      blob(p, CX, GY - 20, 9, 8, L, seed, 4);
      blob(p, CX - 4, GY - 16, 5, 4, L, seed + 1, 4);
      blob(p, CX + 5, GY - 16, 5, 4, L, seed + 2, 4);
      if (ready) {
        const spots: Array<[number, number]> = [];
        for (let i = 0; i < 6; i++) spots.push([Math.round(CX - 7 + hash2(i, seed, 20) * 14), Math.round(GY - 26 + hash2(i, seed, 21) * 12)]);
        produceOn(p, def.shape, F, spots, def.shape === 'round');
      }
      break;
    }
  }
}

/** Plant sprite for a crop at growth stage 0..4. */
export function cropSprite(def: CropDef, stage: number): HTMLCanvasElement {
  const p = new Pix(CROP_W, CROP_H);
  const seed = def.id.length * 31 + def.id.charCodeAt(0);
  if (stage === 0) mound(p);
  else if (stage === 1 && def.form !== 'vine' && def.form !== 'bush' && def.form !== 'stalk' && def.form !== 'tall' && def.form !== 'sprawl' && def.form !== 'flower' && def.form !== 'tree' && def.form !== 'paddy') {
    drawForm(p, def, 1, seed);
  } else drawForm(p, def, stage, seed);
  p.outline(undefined, 'all');
  return p.toCanvas();
}

export function deadCropSprite(tall: boolean): HTMLCanvasElement {
  const p = new Pix(CROP_W, CROP_H);
  const c = '#8a6a44';
  const h = tall ? 16 : 8;
  for (let i = -2; i <= 2; i++) {
    p.line(CX + i, GY, CX + i * 2, GY - h + Math.abs(i) * 2, i % 2 ? c : shade(c, 1));
    p.set(CX + i * 2 + (i < 0 ? -1 : 1), GY - h + Math.abs(i) * 2 + 1, shade(c, 1));
  }
  p.outline();
  return p.toCanvas();
}

// ── Produce icons (16×16) ─────────────────────────────────────────────────

export function produceIcon(def: CropDef): HTMLCanvasElement {
  const p = new Pix(16, 16);
  const F = def.produceColor;
  const L = def.leafColor;
  const hi = light(F, 2);
  const lo = shade(F, 1);
  const lo2 = shade(F, 2);
  const shadeFn = (nx: number, ny: number) => (nx < -0.25 && ny < -0.25 ? hi : nx + ny > 0.7 ? lo2 : nx + ny > 0.2 ? lo : F);
  switch (def.shape) {
    case 'round':
      p.ellipse(8, 9, 5.5, 5.5, shadeFn);
      leaf(p, 8, 4, -0.7, 4, 1.4, L);
      p.set(8, 3, shade(L, 2));
      p.set(8, 4, shade(L, 2));
      break;
    case 'long':
      for (let t = 0; t < 10; t++) p.ellipse(4 + t * 0.9, 12 - t * 0.9, 2.6, 2.6, shadeFn);
      leaf(p, 12, 3, -0.8, 3, 1.4, L);
      break;
    case 'root':
      for (let y = 5; y < 15; y++) {
        const hw = Math.max(0.5, 3.2 * (1 - (y - 5) / 11));
        for (let x = Math.round(8 - hw); x <= Math.round(8 + hw - 1); x++) p.set(x, y, x < 8 - hw / 2 ? hi : x > 8 + hw / 2 - 1 ? lo : F);
        if (y % 3 === 0) p.set(8 + Math.round(hw) - 1, y, lo2);
      }
      for (let i = -1; i <= 1; i++) leaf(p, 8, 5, -Math.PI / 2 + i * 0.5, 4, 1.2, L);
      break;
    case 'head':
      p.ellipse(8, 9, 6, 5.5, shadeFn);
      p.line(5, 6, 8, 12, lo);
      p.line(11, 6, 8, 12, lo);
      leaf(p, 8, 12, Math.PI - 0.4, 6, 2, L);
      leaf(p, 8, 12, -0.4, 6, 2, light(L, 1));
      break;
    case 'leaf':
      for (let i = -1; i <= 1; i++) leaf(p, 8, 14, -Math.PI / 2 + i * 0.45, 11, 2.6, i === 0 ? light(F, 1) : F);
      p.rect(6, 12, 5, 2, '#c8a060');
      break;
    case 'cluster':
      for (const [x, y] of [
        [6, 6],
        [9, 6],
        [12, 6],
        [7, 9],
        [10, 9],
        [8, 12],
        [5, 8],
        [11, 11],
      ])
        p.ellipse(x, y, 1.9, 1.9, shadeFn);
      p.line(9, 1, 9, 4, '#6e5a3a');
      leaf(p, 9, 3, -0.3, 4, 1.5, L);
      break;
    case 'pod':
      for (let t = 0; t < 11; t++) p.ellipse(3 + t, 12 - t * 0.6 - Math.sin(t / 3.5) * 2, 1.8, 1.8, shadeFn);
      for (let t = 2; t < 11; t += 3) p.set(3 + t, 11 - t * 0.6 - Math.sin(t / 3.5) * 2, hi);
      break;
    case 'bloom':
      p.line(8, 9, 8, 15, shade(L, 1));
      leaf(p, 8, 13, -0.5, 4, 1.4, L);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        p.ellipse(8 + Math.cos(a) * 3.2, 6 + Math.sin(a) * 3.2, 2.2, 2.2, i < 3 ? F : lo);
      }
      p.ellipse(8, 6, 1.8, 1.8, '#f5c542');
      break;
    case 'bundle':
      for (let x = 4; x <= 12; x++) {
        p.line(x, 15, 8 + (x - 8) * 0.4, 7, x % 2 ? mix(L, F, 0.6) : light(mix(L, F, 0.6), 1));
        p.ellipse(x, 4 + Math.abs(x - 8) * 0.4, 1, 2.2, x % 2 ? F : hi);
      }
      p.rect(5, 10, 7, 2, '#c8503a');
      break;
    case 'pepper':
      for (let t = 0; t < 10; t++) p.ellipse(6 + t * 0.6, 5 + t, 2.4 - t * 0.18, 2.4 - t * 0.18, shadeFn);
      p.rect(4, 3, 5, 2, '#4f8a3a');
      p.set(5, 2, '#4f8a3a');
      break;
    case 'gourd':
      p.ellipse(8, 10, 7, 5, (nx, ny) => {
        const c = shadeFn(nx, ny);
        return Math.abs(nx) > 0.3 && Math.abs(nx) < 0.42 ? lo2 : c;
      });
      p.rect(7, 3, 2, 3, '#6e5a3a');
      leaf(p, 9, 4, -0.3, 4, 1.5, L);
      break;
    case 'bulb':
      p.ellipse(8, 10, 5, 4.5, shadeFn);
      p.line(8, 2, 8, 6, F);
      p.line(7, 3, 8, 6, lo);
      for (let x = 6; x <= 10; x += 2) p.set(x, 15, '#c8b890');
      break;
    case 'nut':
      p.ellipse(8, 9, 5, 5.5, shadeFn);
      p.ellipse(8, 5, 5, 2.2, lo2);
      p.set(8, 2, '#6e5a3a');
      break;
    case 'berry':
      for (const [x, y] of [
        [6, 9],
        [10, 9],
        [8, 12],
      ])
        p.ellipse(x, y, 2.6, 2.6, shadeFn);
      leaf(p, 8, 7, -2.2, 5, 1.8, L);
      leaf(p, 8, 7, -0.6, 5, 1.8, light(L, 1));
      break;
    case 'spike':
      p.ellipse(8, 8, 3.2, 6.5, (nx, ny) => ((Math.floor((ny + 1) * 6) + Math.floor((nx + 1) * 3)) % 2 ? F : lo));
      leaf(p, 8, 15, -Math.PI / 2 - 0.35, 10, 1.6, L);
      leaf(p, 8, 15, -Math.PI / 2 + 0.4, 9, 1.6, light(L, 1));
      break;
    case 'tuber':
      p.ellipse(8, 9, 6, 4.5, shadeFn);
      p.set(6, 8, lo2);
      p.set(10, 10, lo2);
      p.set(9, 7, lo2);
      break;
    case 'stalk':
      for (let x = 5; x <= 11; x++) p.line(x, 15, x + (x - 8) * 0.3, 3, x % 2 ? F : hi);
      for (let x = 5; x <= 11; x += 2) leaf(p, x, 4, -Math.PI / 2 + (x - 8) * 0.2, 3, 1.2, L);
      p.rect(5, 11, 7, 1, '#c8503a');
      break;
  }
  p.outline();
  return p.toCanvas();
}

const CATEGORY_TINT: Record<string, string> = {
  leafy: '#8ac06a',
  root: '#e8a060',
  bulb: '#d8c8a0',
  fruitveg: '#e8836b',
  legume: '#a8c86a',
  grain: '#e8c860',
  special: '#b89ad8',
  herb: '#6ab89a',
  flower: '#f0a0c0',
  fruit: '#f07a7a',
};

/** Seed packet (or sapling bundle for trees). */
export function seedIcon(def: CropDef): HTMLCanvasElement {
  const p = new Pix(16, 16);
  if (def.form === 'tree') {
    p.ellipse(8, 13, 4.5, 2.5, '#b08a5a');
    p.line(6, 12, 10, 13, '#8a6a44');
    p.line(8, 12, 8, 4, '#7a5236');
    leaf(p, 8, 6, Math.PI + 0.6, 4, 1.6, def.leafColor);
    leaf(p, 8, 6, -0.6, 4, 1.6, light(def.leafColor, 1));
    leaf(p, 8, 4, -Math.PI / 2, 3, 1.4, def.leafColor);
    p.set(10, 8, def.produceColor);
    p.outline();
    return p.toCanvas();
  }
  const tint = CATEGORY_TINT[def.category];
  p.rect(3, 2, 10, 13, '#f4ecd8');
  p.rect(3, 2, 10, 3, tint);
  p.rect(3, 2, 10, 1, light(tint, 1));
  for (let x = 3; x < 13; x += 2) p.set(x, 1, '#f4ecd8');
  p.rect(12, 5, 1, 10, '#d8ccb0');
  p.rect(3, 14, 10, 1, '#c8bca0');
  // Tiny illustration.
  p.ellipse(8, 10, 2.6, 2.6, (nx, ny) => (nx < -0.2 && ny < -0.2 ? light(def.produceColor, 1) : nx + ny > 0.5 ? shade(def.produceColor, 1) : def.produceColor));
  p.set(8, 6, def.leafColor);
  p.set(9, 6, light(def.leafColor, 1));
  p.set(7, 7, def.leafColor);
  p.outline();
  return p.toCanvas();
}
