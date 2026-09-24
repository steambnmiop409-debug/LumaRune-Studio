import { hash2 } from '@lumina/core';
import { Pix } from '../Pix';
import { light, mix, shade } from '../palette';

export type SeasonLook = 0 | 1 | 2 | 3;

export interface TreeSprite {
  img: HTMLCanvasElement;
  /** Pixel row where the canopy ends (rows above sway in the wind). */
  swayRows: number;
  /** Anchor: sprite x of the trunk centre, sprite y of the ground. */
  ax: number;
  ay: number;
}

export function trunk(p: Pix, cx: number, top: number, bottom: number, w: number, bark = '#8a5a3a') {
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

/** A faceted boulder: flat-lit planes, a mossy crown on some, a crack on others. */
export function rock(v: number): HTMLCanvasElement {
  const p = new Pix(20, 16);
  const base = mix('#aaa49c', '#b8b0a2', hash2(v, 1, 5));
  const pal = [light(base, 2), light(base, 1), base, shade(base, 1), shade(base, 2), shade(base, 3)];
  const w = 6.5 + (v % 3) * 0.8;
  const h = 5 + (v % 2);
  const cy = 15 - h;
  const facet = (x: number, y: number) => {
    // Voronoi facets, each with its own tilt.
    let best = Infinity;
    let id = 0;
    for (let k = 0; k < 6; k++) {
      const fx = 10 + (hash2(v, 10 + k, 5) - 0.5) * w * 1.6;
      const fy = cy + (hash2(v, 20 + k, 5) - 0.5) * h * 1.6;
      const d = Math.hypot(x + 0.5 - fx, (y + 0.5 - fy) * 1.3);
      if (d < best) {
        best = d;
        id = k;
      }
    }
    return id;
  };
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 20; x++) {
      const nx = (x + 0.5 - 10) / w;
      const ny = (y + 0.5 - cy) / h;
      const wob = (hash2(x >> 1, y >> 1, v) - 0.5) * 0.15;
      if (nx * nx + ny * ny > 1 + wob || y > 14) continue;
      const id = facet(x, y);
      const lit = -(nx * 0.55 + ny * 0.85) + (hash2(v, 30 + id, 5) - 0.5) * 0.8;
      let t = lit > 0.55 ? 0 : lit > 0.2 ? 1 : lit > -0.15 ? 2 : lit > -0.5 ? 3 : 4;
      if (id !== facet(x + 1, y) || id !== facet(x, y + 1)) t = Math.min(5, t + 1);
      p.set(x, y, pal[t]);
    }
  if (v % 3 === 0)
    for (let x = 4; x < 16; x++) {
      const top = Math.round(cy - h * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - 10) / w) ** 2))) + 1;
      if (hash2(x, v, 3) < 0.75) p.set(x, top, x < 10 ? '#8ac05a' : '#6a9a4a');
      if (hash2(x, v, 4) < 0.35) p.set(x, top + 1, '#6a9a4a');
    }
  else if (v % 3 === 1) p.line(9, cy - 1, 11, cy + 3, pal[5]);
  p.outline(shade(base, 4));
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
