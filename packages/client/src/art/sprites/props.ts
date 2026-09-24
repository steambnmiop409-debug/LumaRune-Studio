import { hash2 } from '@lumina/core';
import { Pix } from '../Pix';
import { light, shade } from '../palette';

export function lamp(lit: boolean): HTMLCanvasElement {
  const p = new Pix(12, 34);
  const iron = '#3a3d52';
  p.rect(5, 10, 2, 22, iron);
  p.rect(5, 10, 1, 22, '#565a74');
  p.rect(3, 31, 6, 3, iron);
  p.rect(3, 31, 6, 1, '#565a74');
  // Lantern head.
  p.rect(2, 2, 8, 2, iron);
  p.rect(4, 0, 4, 2, iron);
  p.rect(3, 4, 6, 6, iron);
  p.rect(4, 5, 4, 4, lit ? '#ffe7a0' : '#cfdce8');
  if (lit) p.rect(5, 6, 2, 2, '#fff8e0');
  p.rect(2, 10, 8, 1, iron);
  p.outline(undefined, 'noTop');
  return p.toCanvas();
}

/** Fence tile. `mask` bits: 1 = left, 2 = right, 4 = up, 8 = down neighbours. */
export function fence(mask: number): HTMLCanvasElement {
  const p = new Pix(16, 20);
  const wood = '#b8875a';
  const dark = shade(wood, 2);
  const lite = light(wood, 1);
  // Post.
  p.rect(6, 4, 4, 15, wood);
  p.rect(6, 4, 1, 15, lite);
  p.rect(9, 4, 1, 15, dark);
  p.rect(6, 3, 4, 1, lite);
  const rail = (y: number, x0: number, x1: number) => {
    p.rect(x0, y, x1 - x0, 2, wood);
    p.rect(x0, y, x1 - x0, 1, lite);
    p.rect(x0, y + 2, x1 - x0, 1, dark);
  };
  if (mask & 1) {
    rail(7, 0, 6);
    rail(12, 0, 6);
  }
  if (mask & 2) {
    rail(7, 10, 16);
    rail(12, 10, 16);
  }
  if (mask & 8) {
    p.rect(7, 19, 2, 1, wood);
  }
  p.outline(undefined, 'noTop');
  return p.toCanvas();
}

export function bench(): HTMLCanvasElement {
  const p = new Pix(32, 18);
  const wood = '#b07a4a';
  p.rect(2, 3, 28, 3, wood);
  p.rect(2, 3, 28, 1, light(wood, 1));
  p.rect(2, 9, 28, 3, wood);
  p.rect(2, 9, 28, 1, light(wood, 1));
  p.rect(2, 12, 28, 1, shade(wood, 2));
  for (const x of [4, 26]) p.rect(x, 6, 2, 11, '#3a3d52');
  p.outline();
  return p.toCanvas();
}

export function well(): HTMLCanvasElement {
  const p = new Pix(22, 30);
  // Stone ring.
  p.ellipse(11, 22, 10, 6, (nx, ny) => (ny < -0.2 && Math.abs(nx) < 0.75 ? '#2f4a6a' : ny < 0 ? '#c8c0b4' : '#9a9288'));
  p.ellipse(11, 20, 6.5, 2.5, '#3f6a8a');
  p.set(9, 20, '#8ac8e0');
  // Posts & roof.
  p.rect(2, 6, 2, 15, '#8a5a3a');
  p.rect(18, 6, 2, 15, '#8a5a3a');
  for (let y = 0; y < 7; y++) {
    const ins = 6 - y;
    p.rect(ins - 1, y + 1, 24 - ins * 2, 1, y % 2 ? '#b85a4a' : '#d06a55');
  }
  p.rect(4, 9, 14, 1, '#6e4a34');
  p.rect(10, 10, 1, 5, '#6e4a34');
  p.rect(9, 14, 3, 3, '#8a6a4a');
  p.outline();
  return p.toCanvas();
}

export function fountain(frame: number): HTMLCanvasElement {
  const p = new Pix(34, 34);
  p.ellipse(17, 24, 16, 9, (nx, ny) => (Math.hypot(nx, ny) > 0.82 ? (ny < 0 ? '#d8d0c4' : '#a89e94') : '#5fb0c8'));
  p.ellipse(17, 24, 11, 5.5, (nx, ny) => (ny < -0.3 ? '#7cc4d8' : '#4f9ab8'));
  p.rect(15, 10, 4, 14, '#c8c0b4');
  p.rect(15, 10, 1, 14, '#e0d8cc');
  p.ellipse(17, 10, 6, 2.5, '#b8b0a4');
  // Animated water.
  const drops = [
    [17, 3],
    [13, 6],
    [21, 6],
    [11, 10],
    [23, 10],
  ];
  drops.forEach(([x, y], i) => {
    const yy = y + ((frame + i) % 3);
    p.set(x, yy, '#e8f8ff');
    p.set(x, yy + 1, '#a8e0f0');
  });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + frame * 0.5;
    p.set(17 + Math.cos(a) * 8, 24 + Math.sin(a) * 3.5, '#e8f8ff');
  }
  p.outline();
  return p.toCanvas();
}

export function signpost(): HTMLCanvasElement {
  const p = new Pix(18, 22);
  p.rect(8, 8, 2, 14, '#8a5a3a');
  p.rect(1, 3, 16, 8, '#c8955a');
  p.rect(1, 3, 16, 1, '#e0b07a');
  p.rect(1, 10, 16, 1, '#8a5a3a');
  p.line(4, 6, 13, 6, '#6e4a34');
  p.line(4, 8, 10, 8, '#6e4a34');
  p.set(14, 6, '#6e4a34');
  p.outline();
  return p.toCanvas();
}

export function flowerpot(v: number): HTMLCanvasElement {
  const p = new Pix(16, 18);
  p.rect(3, 10, 10, 7, '#c8704a');
  p.rect(2, 9, 12, 2, '#d8805a');
  p.rect(3, 16, 10, 1, '#8a4a34');
  p.rect(12, 11, 1, 5, '#a05a3a');
  const cols = ['#f07aa0', '#f5d040', '#b88ae0', '#ffffff'];
  for (let i = 0; i < 7; i++) {
    const x = 3 + Math.floor(hash2(v, i, 1) * 10);
    const y = 2 + Math.floor(hash2(v, i, 2) * 7);
    p.set(x, y + 1, '#5e9a4a');
    p.set(x, y, cols[(v + i) % cols.length]);
    p.set(x + 1, y, cols[(v + i) % cols.length]);
  }
  p.outline();
  return p.toCanvas();
}

export function crate(label?: string): HTMLCanvasElement {
  const p = new Pix(16, 16);
  const wood = '#c8955a';
  p.rect(1, 3, 14, 12, wood);
  p.rect(1, 3, 14, 1, light(wood, 1));
  p.rect(1, 14, 14, 1, shade(wood, 2));
  p.rect(1, 3, 1, 12, shade(wood, 1));
  p.rect(14, 3, 1, 12, shade(wood, 1));
  p.line(2, 4, 13, 13, shade(wood, 1));
  p.rect(1, 8, 14, 1, shade(wood, 1));
  if (label) {
    p.rect(5, 6, 6, 4, '#f4ecd8');
    p.rect(6, 7, 4, 2, label);
  }
  p.outline();
  return p.toCanvas();
}

export function barrel(): HTMLCanvasElement {
  const p = new Pix(14, 18);
  p.ellipse(7, 10, 6, 7, (nx) => (nx < -0.5 ? '#c8955a' : nx > 0.5 ? '#7a5236' : '#a8744a'));
  p.rect(1, 5, 12, 1, '#3a3d52');
  p.rect(1, 14, 12, 1, '#3a3d52');
  p.ellipse(7, 4, 5, 1.5, '#8a5a3a');
  p.outline();
  return p.toCanvas();
}

export function bollard(): HTMLCanvasElement {
  const p = new Pix(10, 12);
  p.rect(2, 3, 6, 8, '#3a3d52');
  p.rect(2, 3, 2, 8, '#565a74');
  p.ellipse(5, 3, 3.5, 1.5, '#565a74');
  p.rect(1, 6, 8, 1, '#c8a878');
  p.outline();
  return p.toCanvas();
}

export function packbench(): HTMLCanvasElement {
  const p = new Pix(34, 26);
  const wood = '#b07a4a';
  // Table.
  p.rect(1, 10, 32, 5, wood);
  p.rect(1, 10, 32, 1, light(wood, 1));
  p.rect(1, 15, 32, 1, shade(wood, 2));
  for (const x of [3, 29]) p.rect(x, 16, 2, 9, shade(wood, 1));
  // Stacked empty crates & twine.
  p.rect(4, 2, 11, 8, '#d8a86a');
  p.rect(4, 2, 11, 1, '#ecc48a');
  p.rect(4, 5, 11, 1, '#a8784a');
  p.rect(18, 4, 10, 6, '#d8a86a');
  p.rect(18, 4, 10, 1, '#ecc48a');
  p.ellipse(30, 8, 2.5, 2, '#e8d8a8');
  p.set(30, 8, '#a89868');
  // Paper tag.
  p.rect(8, 11, 5, 3, '#f4ecd8');
  p.outline();
  return p.toCanvas();
}

export function mailbox(): HTMLCanvasElement {
  const p = new Pix(12, 20);
  p.rect(5, 8, 2, 12, '#8a5a3a');
  p.rect(1, 2, 10, 7, '#4f7ab0');
  p.rect(1, 2, 10, 1, '#6a94c8');
  p.rect(1, 8, 10, 1, '#2f4a6a');
  p.rect(9, 3, 1, 4, '#e8503a');
  p.rect(9, 3, 2, 1, '#e8503a');
  p.outline();
  return p.toCanvas();
}

export function sprinkler(tier: 1 | 2 | 3): HTMLCanvasElement {
  const p = new Pix(16, 16);
  const metal = tier === 1 ? '#c8804a' : tier === 2 ? '#d8b050' : '#c8d0dc';
  p.ellipse(8, 11, 5, 3, shade(metal, 1));
  p.ellipse(8, 10, 4, 2.2, metal);
  p.rect(7, 4, 2, 6, metal);
  p.rect(7, 4, 1, 6, light(metal, 1));
  p.rect(5, 3, 6, 2, shade(metal, 1));
  if (tier >= 2) {
    p.set(4, 3, metal);
    p.set(11, 3, metal);
  }
  if (tier === 3) {
    p.set(8, 1, '#4fa3c8');
    p.set(8, 2, metal);
  }
  p.outline();
  return p.toCanvas();
}

/** Rain cover: a translucent vinyl canopy on four posts spanning 3×3 tiles. */
export function rainCover(): { canopy: HTMLCanvasElement; post: HTMLCanvasElement } {
  const c = new Pix(50, 30);
  for (let y = 2; y < 28; y++)
    for (let x = 1; x < 49; x++) {
      const edge = y === 2 || y === 27 || x === 1 || x === 48;
      const rib = x % 12 === 0;
      c.set(x, y, edge ? '#c8d0dc' : rib ? '#e8eef4' : y < 8 ? '#f4f8fc' : '#dde6f0');
    }
  const post = new Pix(4, 18);
  post.rect(1, 0, 2, 18, '#8a8f9e');
  post.rect(1, 0, 1, 18, '#b8bcc8');
  return { canopy: c.toCanvas(), post: post.toCanvas() };
}

/** Soil tile, autotiled by the 4-neighbour mask (1 left, 2 right, 4 up, 8 down). */
export function soilTile(mask: number, wet: boolean): HTMLCanvasElement {
  const p = new Pix(16, 16);
  const base = wet ? '#6a4632' : '#a06e4a';
  const dark = wet ? '#523424' : '#865a3c';
  const crumb = wet ? '#7c5440' : '#b8845a';
  const lip = wet ? '#44291c' : '#6e4a32';
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const l = !(mask & 1) && x === 0;
      const r = !(mask & 2) && x === 15;
      const u = !(mask & 4) && y === 0;
      const d = !(mask & 8) && y >= 14;
      const corner =
        (!(mask & 1) && !(mask & 4) && x + y < 2) ||
        (!(mask & 2) && !(mask & 4) && 15 - x + y < 2) ||
        (!(mask & 1) && !(mask & 8) && x + 15 - y < 2) ||
        (!(mask & 2) && !(mask & 8) && 30 - x - y < 2);
      if (corner) continue;
      // Clods: small lumps lit from the top-left.
      const h = hash2(x >> 1, y >> 1, wet ? 5 : 6);
      let c = base;
      if (h < 0.22) c = hash2(x, y, 9) < 0.5 ? crumb : base;
      if (hash2(x, y, 3) < 0.1) c = dark;
      if (hash2(x, y - 1, 3) < 0.1) c = crumb;
      if (u) c = crumb;
      if (l || r) c = lip;
      if (d) c = y === 15 ? lip : dark;
      p.set(x, y, c);
    }
  return p.toCanvas();
}

export function fertMark(kind: string): HTMLCanvasElement {
  const p = new Pix(16, 16);
  const col = kind === 'quality' ? '#f0d890' : kind === 'basic' ? '#d8c8a0' : kind === 'retain' ? '#6a8aa8' : '#a8e080';
  for (let i = 0; i < 9; i++) p.set(2 + Math.floor(hash2(i, 1, kind.length) * 12), 2 + Math.floor(hash2(i, 2, kind.length) * 12), col);
  return p.toCanvas();
}
