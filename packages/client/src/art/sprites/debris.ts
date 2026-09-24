import { hash2 } from '@lumina/core';
import { Pix } from '../Pix';
import { light, mix, shade } from '../palette';

/** Farm debris. `v` is the tile's own seed, so every weed, stone and twig is drawn differently. */
const r = (v: number, k: number) => hash2(v, k, 6262);

/** A rank clump of weeds: broad dock leaves, grass blades, and sometimes a seed head or a dandelion. */
export function weed(v: number, frame: number, season = 1): HTMLCanvasElement {
  const p = new Pix(16, 16);
  // Green in spring and summer, yellowing in autumn, withered and frosted in winter.
  const base = season === 3 ? mix('#8a7a5a', '#9a8a68', r(v, 1)) : season === 2 ? mix('#9a9a3a', '#b0943a', r(v, 1)) : mix('#5a8a3a', '#7a9a3a', r(v, 1));
  const dark = shade(base, 1);
  // Broad leaves fanning from the root.
  const leaves = 3 + Math.floor(r(v, 2) * 3);
  for (let i = 0; i < leaves; i++) {
    const a = -Math.PI / 2 + (i / (leaves - 1) - 0.5) * 2.4 + (frame ? 0.08 : 0);
    const len = 4 + r(v, 10 + i) * 4;
    for (let t = 0; t <= len; t += 0.5) {
      const w = Math.sin((t / len) * Math.PI) * 1.4;
      const x = 8 + Math.cos(a) * t;
      const y = 14 + Math.sin(a) * t * 0.9;
      for (let k = -w; k <= w; k += 0.5) {
        const px = Math.round(x - Math.sin(a) * k);
        const py = Math.round(y + Math.cos(a) * k * 0.6);
        p.set(px, py, k < 0 ? light(base, 1) : k > 0.6 ? dark : base);
      }
    }
  }
  // Wiry blades.
  for (let i = 0; i < 4; i++) {
    const x = 4 + Math.floor(r(v, 20 + i) * 8);
    const h = 5 + Math.floor(r(v, 30 + i) * 6);
    for (let k = 0; k < h; k++) p.set(x + Math.round((k / h) * (r(v, 40 + i) - 0.5) * 3 + (frame ? 0.5 : 0)), 15 - k, k > h - 2 ? '#a8b860' : '#6a8a40');
  }
  const bloom = season === 3 ? 1 : r(v, 5);
  if (season === 3) for (let i = 0; i < 4; i++) p.set(4 + Math.floor(r(v, 70 + i) * 8), 6 + Math.floor(r(v, 80 + i) * 6), '#f4f8fc');
  if (bloom < 0.3) {
    // Dandelion.
    p.set(10, 5, '#f8d840');
    p.set(9, 5, '#f0c030');
    p.set(10, 4, '#fff080');
    p.set(11, 5, '#f0c030');
  } else if (bloom < 0.5) {
    // Seed head.
    p.set(5, 3, '#e8e0c8');
    p.set(6, 3, '#fff8e8');
    p.set(5, 4, '#e8e0c8');
  }
  p.outline(shade(base, 3));
  return p.toCanvas();
}

/** A field stone half-sunk in the soil, with lichen spots. */
export function fieldStone(v: number): HTMLCanvasElement {
  const p = new Pix(16, 16);
  const c = mix('#9a948c', '#b0a898', r(v, 1));
  const rx = 4.5 + r(v, 2) * 2;
  const ry = 3.2 + r(v, 3) * 1.4;
  const cx = 8 + (r(v, 4) - 0.5) * 2;
  // Soil ring.
  p.ellipse(cx, 12.5, rx + 1, 1.8, '#7a5a3e');
  p.ellipse(cx, 12 - ry * 0.4, rx, ry, (nx, ny) => {
    const lit = -(nx * 0.6 + ny * 0.9);
    return lit > 0.45 ? light(c, 2) : lit > 0.1 ? light(c, 1) : lit < -0.45 ? shade(c, 2) : lit < -0.1 ? shade(c, 1) : c;
  });
  // A crack and lichen.
  if (r(v, 5) < 0.6) p.line(cx - 1, 12 - ry, cx + 1, 11, shade(c, 2));
  for (let i = 0; i < 3; i++) p.set(Math.round(cx - 2 + r(v, 10 + i) * 4), Math.round(10 - r(v, 20 + i) * ry), r(v, 30 + i) < 0.5 ? '#a8b860' : '#d8c870');
  p.outline(shade(c, 3));
  return p.toCanvas();
}

/** A fallen branch with a couple of side twigs and a leaf or two. */
export function twig(v: number): HTMLCanvasElement {
  const p = new Pix(16, 16);
  const bark = mix('#7a5236', '#8e6a48', r(v, 1));
  const a = (r(v, 2) - 0.5) * 0.8;
  const x0 = 2;
  const y0 = 11 + Math.round(a * 4);
  const x1 = 14;
  const y1 = 11 - Math.round(a * 4);
  p.line(x0, y0, x1, y1, bark);
  p.line(x0, y0 + 1, x1, y1 + 1, shade(bark, 1));
  const forks = 1 + Math.floor(r(v, 3) * 2);
  for (let i = 0; i < forks; i++) {
    const t = 0.3 + r(v, 10 + i) * 0.5;
    const fx = Math.round(x0 + (x1 - x0) * t);
    const fy = Math.round(y0 + (y1 - y0) * t);
    const up = r(v, 20 + i) < 0.5 ? -1 : 1;
    p.line(fx, fy, fx + 3, fy + up * 3, bark);
    if (r(v, 30 + i) < 0.7) {
      p.set(fx + 3, fy + up * 3 - 1, '#6a9a4a');
      p.set(fx + 4, fy + up * 3, '#8ab85a');
    }
  }
  p.set(x1, y1, '#d8b07a');
  p.outline(shade(bark, 3));
  return p.toCanvas();
}
