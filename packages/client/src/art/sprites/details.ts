import { hash2 } from '@lumina/core';
import { Pix } from '../Pix';
import { light, mix, shade } from '../palette';
import { clump } from './shading';

/** Each detail takes `v` (the object's own seed) so every instance on the island is drawn differently. */
const r = (v: number, k: number) => hash2(v, k, 4242);

export function tallGrass(v: number, frame: number): HTMLCanvasElement {
  const p = new Pix(16, 18);
  const base = ['#6aa84e', '#78b458', '#5e9a48', '#86bc5e'][v % 4];
  const blades = 5 + Math.floor(r(v, 1) * 5);
  for (let i = 0; i < blades; i++) {
    const x = 2 + Math.floor(r(v, i + 10) * 12);
    const h = 5 + Math.floor(r(v, i + 20) * 10);
    const bend = (r(v, i + 30) - 0.5) * 3 + (frame ? 1 : 0);
    for (let k = 0; k < h; k++) {
      const t = k / h;
      const xx = Math.round(x + bend * t * t);
      p.set(xx, 17 - k, t > 0.75 ? light(base, 1) : t < 0.3 ? shade(base, 1) : base);
    }
    if (r(v, i + 40) < 0.2) p.set(Math.round(x + bend), 17 - h, '#f4e8a0');
  }
  return p.toCanvas();
}

export function pebbles(v: number): HTMLCanvasElement {
  const p = new Pix(16, 16);
  const n = 2 + Math.floor(r(v, 1) * 4);
  for (let i = 0; i < n; i++) {
    const x = 2 + r(v, i + 2) * 11;
    const y = 4 + r(v, i + 9) * 9;
    const s = 0.8 + r(v, i + 17) * 1.4;
    const c = ['#b8b0a4', '#a39a8f', '#c8c0b2', '#8f8a86'][Math.floor(r(v, i + 23) * 4)];
    p.ellipse(x, y, s, s * 0.7, (nx, ny) => (nx + ny < -0.3 ? light(c, 1) : nx + ny > 0.5 ? shade(c, 1) : c));
  }
  return p.toCanvas();
}

export function mushroom(v: number): HTMLCanvasElement {
  const p = new Pix(16, 16);
  const cap = ['#d04a3a', '#c8904a', '#e8d8b8', '#9a6a4a'][v % 4];
  const n = 1 + Math.floor(r(v, 1) * 3);
  for (let i = 0; i < n; i++) {
    const x = 4 + Math.floor(r(v, i + 3) * 8);
    const h = 3 + Math.floor(r(v, i + 6) * 3);
    const w = 2 + r(v, i + 8) * 1.8;
    p.rect(x, 15 - h, 1, h, '#f0e8d8');
    p.ellipse(x + 0.5, 15 - h, w, w * 0.65, (nx, ny) => (ny > 0.3 ? null : nx < -0.2 ? light(cap, 1) : nx > 0.5 ? shade(cap, 1) : cap));
    if (cap === '#d04a3a') p.set(x - 1, 14 - h, '#fff4e8');
  }
  p.outline();
  return p.toCanvas();
}

export function log(v: number): HTMLCanvasElement {
  const p = new Pix(34, 16);
  const bark = mix('#7a5236', '#8a6a4a', r(v, 1));
  for (let x = 2; x < 30; x++)
    for (let y = 5; y < 13; y++) {
      const ny = (y - 9) / 4;
      let c = ny < -0.4 ? light(bark, 1) : ny > 0.5 ? shade(bark, 1) : bark;
      if ((x + Math.floor(y * 1.7) + v) % 7 === 0) c = shade(bark, 2);
      p.set(x, y, c);
    }
  p.ellipse(30, 9, 3, 4, (nx, ny) => (Math.hypot(nx, ny) > 0.7 ? '#a8845a' : Math.hypot(nx, ny) > 0.35 ? '#d8b07a' : '#c89a62'));
  for (let i = 0; i < 4; i++) p.set(4 + Math.floor(r(v, i + 5) * 22), 5, '#6a9a4a');
  if (r(v, 9) < 0.6) {
    p.set(12, 4, '#c8904a');
    p.set(13, 4, '#c8904a');
    p.set(12, 3, '#e8b86a');
  }
  p.outline();
  return p.toCanvas();
}

export function lilypad(v: number, frame: number): HTMLCanvasElement {
  const p = new Pix(16, 16);
  const x = 4 + r(v, 1) * 7 + (frame ? 0.5 : 0);
  const y = 5 + r(v, 2) * 6;
  const s = 2.6 + r(v, 3) * 1.6;
  p.ellipse(x, y, s, s * 0.7, (nx, ny) => (nx > 0 && Math.abs(ny) < 0.15 ? null : ny < -0.2 ? '#7ab860' : '#5e9a4a'));
  if (r(v, 4) < 0.35) {
    p.set(Math.round(x) - 1, Math.round(y) - 1, '#f8c8d8');
    p.set(Math.round(x), Math.round(y) - 2, '#fbe0ea');
    p.set(Math.round(x) + 1, Math.round(y) - 1, '#f8c8d8');
    p.set(Math.round(x), Math.round(y) - 1, '#f8e070');
  }
  return p.toCanvas();
}

export function boat(v: number): HTMLCanvasElement {
  const p = new Pix(36, 22);
  const hull = ['#c8604a', '#4f7ab0', '#e8d8b8', '#5a9a7a'][v % 4];
  for (let y = 8; y < 18; y++) {
    const t = (y - 8) / 10;
    const inset = Math.round(t * t * 6);
    for (let x = 2 + inset; x < 34 - inset * 1.5; x++) {
      let c = y < 10 ? light(hull, 1) : y > 15 ? shade(hull, 2) : hull;
      if (y === 12) c = '#f4ecd8';
      p.set(x, y, c);
    }
  }
  // Inside of the boat.
  p.rect(5, 8, 25, 2, '#8a5a3a');
  p.rect(12, 7, 2, 3, '#6e4a34');
  p.rect(22, 7, 2, 3, '#6e4a34');
  // Oars.
  p.line(8, 5, 20, 9, '#b8875a');
  p.rect(6, 4, 3, 2, '#b8875a');
  if (r(v, 1) < 0.5) p.ellipse(28, 7, 2, 1.5, '#e8d8a8');
  p.outline();
  return p.toCanvas();
}

export function netRack(v: number): HTMLCanvasElement {
  const p = new Pix(34, 26);
  p.rect(3, 4, 2, 21, '#8a5a3a');
  p.rect(29, 4, 2, 21, '#8a5a3a');
  p.rect(2, 4, 30, 2, '#6e4a34');
  for (let x = 5; x < 29; x++)
    for (let y = 6; y < 6 + 10 + Math.round(Math.sin((x / 24) * Math.PI) * 5); y++) if ((x + y) % 3 === 0 || (x - y) % 3 === 0) p.set(x, y, mix('#c8b890', '#9aa8a0', r(v, 1)));
  p.ellipse(10, 17, 1.5, 1.5, '#e8b030');
  p.ellipse(22, 19, 1.5, 1.5, '#e8b030');
  p.outline();
  return p.toCanvas();
}

export function fishCrate(v: number): HTMLCanvasElement {
  const p = new Pix(16, 14);
  p.rect(1, 4, 14, 9, '#b08a5a');
  p.rect(1, 4, 14, 1, '#d0aa7a');
  p.rect(1, 8, 14, 1, '#8a6a44');
  for (let i = 0; i < 4; i++) {
    const x = 3 + i * 3;
    const c = ['#9ab0c8', '#c8d0dc', '#8aa0b8'][Math.floor(r(v, i) * 3)];
    p.ellipse(x, 4, 2, 1.2, c);
    p.set(x + 2, 3, shade(c, 1));
  }
  p.outline();
  return p.toCanvas();
}

export function anchor(): HTMLCanvasElement {
  const p = new Pix(16, 20);
  const iron = '#4a4e62';
  p.rect(7, 3, 2, 13, iron);
  p.rect(4, 5, 8, 2, iron);
  p.ellipse(8, 2, 2, 2, (nx, ny) => (Math.hypot(nx, ny) < 0.5 ? null : iron));
  for (let x = 2; x <= 13; x++) p.set(x, 16 - Math.round(Math.abs(x - 7.5) < 5 ? (1 - ((x - 7.5) / 5.5) ** 2) * -2 + 2 : 0), iron);
  p.rect(2, 13, 2, 2, iron);
  p.rect(12, 13, 2, 2, iron);
  p.line(9, 4, 13, 10, '#c8a878');
  p.outline();
  return p.toCanvas();
}

export function stall(v: number): HTMLCanvasElement {
  const p = new Pix(34, 36);
  const a = ['#e8836b', '#4fa3a5', '#9a78b0', '#f0b860'][v % 4];
  // Posts and counter.
  p.rect(3, 10, 2, 24, '#8a5a3a');
  p.rect(29, 10, 2, 24, '#8a5a3a');
  p.rect(2, 24, 30, 9, '#b07a4a');
  p.rect(2, 24, 30, 1, '#d09a6a');
  p.rect(2, 32, 30, 1, '#6e4a34');
  // Striped canopy with scallops.
  for (let y = 2; y < 10; y++) for (let x = 1; x < 33; x++) p.set(x, y, Math.floor(x / 4) % 2 ? a : '#f7efd8');
  for (let x = 1; x < 33; x += 4) {
    p.set(x + 1, 10, Math.floor(x / 4) % 2 ? a : '#f7efd8');
    p.set(x + 2, 10, Math.floor(x / 4) % 2 ? a : '#f7efd8');
  }
  // Produce baskets on the counter — different wares for each stall.
  const wares = [
    ['#e0402f', '#f08a2a', '#f5d040'],
    ['#6a3a8a', '#b8e070', '#d03a5a'],
    ['#f8a080', '#f09020', '#9ac04a'],
    ['#e8c860', '#c8a060', '#5aa03a'],
  ][v % 4];
  for (let b = 0; b < 3; b++) {
    const bx = 5 + b * 9;
    p.rect(bx, 20, 7, 4, '#c8a060');
    p.rect(bx, 20, 7, 1, '#e0c080');
    for (let k = 0; k < 5; k++) p.set(bx + 1 + (k % 3) * 2, 18 + Math.floor(k / 3), wares[b]);
  }
  p.outline(undefined, 'noTop');
  return p.toCanvas();
}

export function flowerBed(v: number): HTMLCanvasElement {
  const p = new Pix(32, 14);
  p.rect(1, 5, 30, 8, '#8a5a3a');
  p.rect(1, 5, 30, 1, '#6e4a34');
  p.rect(0, 4, 32, 1, '#a8a098');
  p.rect(0, 13, 32, 1, '#8a8278');
  const cols = [
    ['#f07aa0', '#fff4d0', '#b88ae0'],
    ['#f5d040', '#f89a1a', '#fff4d0'],
    ['#e83a4a', '#f8f0f0', '#f0a0c0'],
  ][v % 3];
  for (let i = 0; i < 14; i++) {
    const x = 2 + Math.floor(r(v, i) * 28);
    const y = 2 + Math.floor(r(v, i + 30) * 7);
    p.set(x, y + 2, '#4f8a3a');
    p.set(x, y + 1, '#5e9a4a');
    p.set(x, y, cols[i % 3]);
    p.set(x + 1, y, shade(cols[i % 3], 1));
  }
  p.outline(undefined, 'noTop');
  return p.toCanvas();
}

export function laundry(v: number, frame: number): HTMLCanvasElement {
  const p = new Pix(34, 26);
  p.rect(2, 4, 2, 21, '#8a5a3a');
  p.rect(30, 4, 2, 21, '#8a5a3a');
  for (let x = 4; x < 30; x++) p.set(x, 5 + Math.round(Math.sin(((x - 4) / 26) * Math.PI) * 2), '#e8e0d0');
  const cloth = ['#f4ecd8', '#8ecae6', '#e8a0b8', '#f0b860', '#8ac06a'];
  for (let i = 0; i < 3; i++) {
    const x = 7 + i * 8;
    const c = cloth[(v + i) % cloth.length];
    const sway = frame && i % 2 ? 1 : 0;
    const h = 6 + Math.floor(r(v, i) * 5);
    for (let y = 7; y < 7 + h; y++) p.rect(x + (y > 10 ? sway : 0), y, 5, 1, y === 7 + h - 1 ? shade(c, 1) : c);
    p.set(x + 1, 6, '#b8875a');
    p.set(x + 3, 6, '#b8875a');
  }
  p.outline(undefined, 'noTop');
  return p.toCanvas();
}

export function hayBale(v: number): HTMLCanvasElement {
  const p = new Pix(18, 16);
  const hay = mix('#e8c860', '#d8b050', r(v, 1));
  p.ellipse(9, 9, 8, 6, (nx, ny) => {
    let c = ny < -0.4 ? light(hay, 1) : ny > 0.4 ? shade(hay, 1) : hay;
    if (hash2(Math.round(nx * 20), Math.round(ny * 20), v) < 0.15) c = shade(hay, 1);
    return c;
  });
  p.rect(4, 3, 1, 12, '#b8503a');
  p.rect(13, 3, 1, 12, '#b8503a');
  p.outline();
  return p.toCanvas();
}

export function scarecrow(v: number, frame: number): HTMLCanvasElement {
  const p = new Pix(22, 34);
  p.rect(10, 8, 2, 25, '#8a5a3a');
  p.rect(2, 14, 18, 2, '#8a5a3a');
  // Shirt.
  const shirt = ['#c8503a', '#4f7ab0', '#8a6ab0'][v % 3];
  p.rect(6, 13, 10, 9, shirt);
  for (let y = 14; y < 22; y += 3) p.rect(6, y, 10, 1, shade(shirt, 1));
  p.rect(2, 13, 4, 3, shirt);
  p.rect(16, 13, 4, 3, shirt);
  // Straw hands.
  p.set(1, 14, '#e8c860');
  p.set(20, 14 + frame, '#e8c860');
  // Sack head with stitched face and straw hat.
  p.ellipse(11, 8, 4, 4, '#e8d8a8');
  p.set(9, 8, '#3a2a28');
  p.set(13, 8, '#3a2a28');
  p.line(9, 10, 13, 10, '#8a5a3a');
  p.ellipse(11, 4, 7, 1.5, '#eccb7a');
  p.ellipse(11, 3, 3.5, 2, '#f0d890');
  p.rect(8, 4, 7, 1, '#d0503a');
  p.outline();
  return p.toCanvas();
}

export function beehive(v: number): HTMLCanvasElement {
  const p = new Pix(16, 22);
  p.rect(3, 16, 2, 5, '#6e4a34');
  p.rect(11, 16, 2, 5, '#6e4a34');
  const wood = ['#f0d890', '#e8e0d0', '#d8b070'][v % 3];
  for (let i = 0; i < 3; i++) {
    const y = 6 + i * 4;
    p.rect(1, y, 14, 4, i % 2 ? shade(wood, 1) : wood);
    p.rect(1, y, 14, 1, light(wood, 1));
  }
  p.rect(0, 3, 16, 3, '#8a6a4a');
  p.rect(0, 3, 16, 1, '#a8845a');
  p.rect(6, 17, 4, 1, '#3a2a28');
  p.outline();
  return p.toCanvas();
}

export function picnic(v: number): HTMLCanvasElement {
  const p = new Pix(34, 18);
  const c = ['#e8836b', '#4fa3a5', '#e8a0b8'][v % 3];
  for (let y = 3; y < 15; y++) for (let x = 2; x < 32; x++) p.set(x, y, (Math.floor(x / 3) + Math.floor(y / 3)) % 2 ? c : '#f7efd8');
  // Basket.
  p.rect(20, 5, 8, 6, '#b8875a');
  for (let x = 20; x < 28; x += 2) p.rect(x, 5, 1, 6, '#8a5a3a');
  p.line(20, 5, 24, 1, '#8a5a3a');
  p.line(24, 1, 27, 5, '#8a5a3a');
  // Bread and an apple.
  p.ellipse(9, 8, 3, 1.8, '#d8a060');
  p.ellipse(15, 10, 1.5, 1.5, '#d0302a');
  return p.toCanvas();
}

export function telescope(): HTMLCanvasElement {
  const p = new Pix(18, 24);
  p.line(9, 12, 4, 23, '#6e4a34');
  p.line(9, 12, 14, 23, '#6e4a34');
  p.line(9, 12, 9, 23, '#8a5a3a');
  for (let t = 0; t < 12; t++) {
    const x = 3 + t;
    const y = 12 - Math.round(t * 0.7);
    p.rect(x, y - 1, 1, 3, t < 4 ? '#b89048' : '#c8a060');
  }
  p.ellipse(15, 3, 1.5, 2, '#8ac8e0');
  p.outline();
  return p.toCanvas();
}

/** Canopy colours for unique leaf tones per tree. */
export function jitterColor(base: string, v: number): string {
  const t = r(v, 99);
  return t < 0.33 ? mix(base, '#9ac05a', 0.2) : t < 0.66 ? mix(base, '#3f7a5a', 0.2) : base;
}

export { clump };
