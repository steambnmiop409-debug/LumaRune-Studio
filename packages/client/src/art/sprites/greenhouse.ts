import { getCrop, hash2 } from '@lumina/core';
import { Pix, bayer } from '../Pix';
import { light, mix, pack, shade } from '../palette';

/** Glasshouse sprites. The footprint is 9×6 tiles; walls stand WALL_H pixels tall. */
export const GH_W = 144;
export const GH_WALL = 36;
/** Pixels of ridge above the back wall's top edge. */
export const GH_RIDGE = 8;

const FRAME = '#e6eee0';
const FRAME_D = '#a8b8a4';
const FRAME_RUST = '#8e8a78';
const FRAME_RUST_D = '#5e5a50';
const BRICK = '#b8674e';
const GLASS = '#cfeef4';

function brickRow(p: Pix, y0: number, h: number, w: number, ruined: boolean) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = 0; x < w; x++) {
      const row = Math.floor((y - y0) / 3);
      const mortar = (y - y0) % 3 === 2 || (x + (row % 2) * 4) % 8 === 7;
      const base = ruined ? mix(BRICK, '#7a6a60', 0.35) : BRICK;
      p.set(x, y, mortar ? shade(base, 2) : hash2(x >> 3, row, 9) < 0.3 ? shade(base, 1) : hash2(x, y, 3) < 0.08 ? light(base, 1) : base);
    }
  for (let x = 0; x < w; x++) p.set(x, y0, light(ruined ? '#9a8a80' : '#d8c8b0', 0));
}

/** A glass pane with a soft vertical gradient and the odd diagonal glint. `a` is its opacity 0..255. */
function pane(p: Pix, x0: number, y0: number, w: number, h: number, a: number, seed: number, broken: boolean) {
  const gone = broken && hash2(x0, y0, seed) < 0.42;
  const cracked = broken && !gone && hash2(x0, y0, seed + 1) < 0.5;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      if (gone) {
        // Jagged shards still stuck in the corners of an empty frame.
        const corner = Math.min(x - x0, x0 + w - 1 - x) + Math.min(y - y0, y0 + h - 1 - y) * 0.7;
        if (corner < 2.2 + hash2(x, y, seed) * 2) p.set(x, y, pack(GLASS, Math.round(a * 1.3)));
        continue;
      }
      const t = (y - y0) / h;
      const glint = (x - x0 + (y - y0)) % 14;
      const shine = !broken && hash2(x0, y0, seed + 2) < 0.55 && (glint === 3 || glint === 4 || glint === 7);
      const c = shine ? '#ffffff' : mix(GLASS, '#9fd0e0', t * 0.6);
      p.set(x, y, pack(c, shine ? Math.min(255, a + 70) : Math.round(a * (0.85 + bayer(x, y) * 0.3))));
    }
  if (cracked) {
    let x = x0 + 2 + Math.floor(hash2(x0, y0, seed + 3) * (w - 4));
    let y = y0 + 1;
    while (y < y0 + h - 1) {
      p.set(x, y, pack('#ffffff', 200));
      y++;
      x += hash2(x, y, seed) < 0.33 ? -1 : hash2(x, y, seed + 1) < 0.5 ? 1 : 0;
      x = Math.max(x0, Math.min(x0 + w - 1, x));
    }
  }
}

function mullionV(p: Pix, x: number, y0: number, y1: number, ruined: boolean) {
  p.rect(x, y0, 2, y1 - y0, ruined ? FRAME_RUST : FRAME);
  p.rect(x + 1, y0, 1, y1 - y0, ruined ? FRAME_RUST_D : FRAME_D);
}
function mullionH(p: Pix, x0: number, x1: number, y: number, ruined: boolean) {
  p.rect(x0, y, x1 - x0, 1, ruined ? FRAME_RUST : FRAME);
  p.rect(x0, y + 1, x1 - x0, 1, ruined ? FRAME_RUST_D : FRAME_D);
}

function vines(p: Pix, x: number, y0: number, y1: number, seed: number) {
  let cx = x;
  for (let y = y1; y > y0; y--) {
    cx += hash2(y, seed, 1) < 0.3 ? -1 : hash2(y, seed, 2) < 0.3 ? 1 : 0;
    p.set(cx, y, '#4a7a3a');
    if (y % 3 === 0) {
      const side = hash2(y, seed, 3) < 0.5 ? -1 : 1;
      p.set(cx + side, y, '#6aa04a');
      p.set(cx + side * 2, y - 1, '#8ac05a');
      p.set(cx + side, y - 1, '#6aa04a');
    }
  }
}

/** The back wall seen from inside/front: a brick knee wall, glass above, and a shelf of pots when restored. */
export function greenhouseBack(ruined: boolean): HTMLCanvasElement {
  const H = GH_WALL + 2;
  const p = new Pix(GH_W, H);
  for (let x = 0; x < GH_W; x += 16) pane(p, x + 1, 2, 15, H - 12, ruined ? 150 : 175, 70, ruined);
  for (let x = 0; x <= GH_W - 2; x += 16) mullionV(p, Math.min(x, GH_W - 2), 0, H - 10, ruined);
  mullionH(p, 0, GH_W, 0, ruined);
  mullionH(p, 0, GH_W, 14, ruined);
  brickRow(p, H - 10, 10, GH_W, ruined);
  if (!ruined) {
    // A potting shelf along the knee wall.
    p.rect(4, H - 13, GH_W - 8, 2, '#a8744a');
    p.rect(4, H - 11, GH_W - 8, 1, '#7a5236');
    for (let i = 0; i < 9; i++) {
      const x = 8 + i * 15 + Math.floor(hash2(i, 1, 5) * 4);
      p.rect(x, H - 17, 5, 4, '#c8704a');
      p.rect(x, H - 17, 5, 1, '#e08a5e');
      const leaf = ['#5e9a4a', '#7fb85a', '#e87aa0', '#f0c040'][i % 4];
      p.set(x + 2, H - 19, leaf);
      p.set(x + 1, H - 18, leaf);
      p.set(x + 3, H - 18, leaf);
      p.set(x + 2, H - 20, i % 4 >= 2 ? leaf : '#7fb85a');
    }
  } else {
    vines(p, 20, 4, H - 1, 1);
    vines(p, 100, 10, H - 1, 2);
  }
  p.outline(ruined ? '#3a3630' : '#4a5a50', 'noTop');
  return p.toCanvas();
}

/**
 * The roof, side posts and front wall in one sprite, drawn over everything inside it.
 * Glass is translucent so the plants read through it; the doorway in the front is open.
 */
export function greenhouseShell(ruined: boolean): HTMLCanvasElement {
  const inner = 5 * 16; // back-wall line to front-wall line
  const H = GH_RIDGE + inner + GH_WALL;
  const p = new Pix(GH_W, H);
  const roof0 = GH_RIDGE;
  const roof1 = GH_RIDGE + inner;
  const glassA = ruined ? 70 : 62;
  // Roof panes.
  for (let y = roof0; y < roof1; y += 16) for (let x = 0; x < GH_W; x += 16) pane(p, x + 1, y + 1, 15, 15, glassA, 11, ruined);
  for (let x = 0; x <= GH_W - 2; x += 16) mullionV(p, Math.min(x, GH_W - 2), roof0, roof1, ruined);
  for (let y = roof0; y <= roof1; y += 16) mullionH(p, 0, GH_W, y, ruined);
  // Ridge beam with finials.
  p.rect(0, roof0 - 3, GH_W, 3, ruined ? FRAME_RUST : FRAME);
  p.rect(0, roof0 - 1, GH_W, 1, ruined ? FRAME_RUST_D : FRAME_D);
  if (!ruined)
    for (const fx of [2, GH_W / 2 - 1, GH_W - 4]) {
      p.rect(fx, roof0 - 7, 2, 4, FRAME);
      p.set(fx, roof0 - 8, FRAME);
      p.set(fx + 1, roof0 - 8, FRAME_D);
    }
  // Front wall: glass over a brick knee wall, open doorway in the middle.
  const f0 = roof1;
  const knee = H - 10;
  const door0 = 4 * 16;
  const door1 = 5 * 16;
  for (let x = 0; x < GH_W; x += 16) if (x !== door0) pane(p, x + 1, f0 + 2, 15, knee - f0 - 2, ruined ? 90 : 80, 23, ruined);
  for (let x = 0; x <= GH_W - 2; x += 16) mullionV(p, Math.min(x, GH_W - 2), f0, x === door0 || x === door1 ? H : knee, ruined);
  mullionH(p, 0, GH_W, f0, ruined);
  mullionH(p, 0, door0, f0 + 16, ruined);
  mullionH(p, door1, GH_W, f0 + 16, ruined);
  const kneeL = new Pix(door0, 10);
  brickRow(kneeL, 0, 10, door0, ruined);
  const kneeR = new Pix(GH_W - door1 - 2, 10);
  brickRow(kneeR, 0, 10, GH_W - door1 - 2, ruined);
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < door0; x++) p.set(x, knee + y, kneeL.get(x, y));
    for (let x = 0; x < GH_W - door1 - 2; x++) p.set(door1 + 2 + x, knee + y, kneeR.get(x, y));
  }
  // Door lintel with a little sprout plaque, the door itself swung open against the wall.
  p.rect(door0, f0 - 1, 18, 4, ruined ? FRAME_RUST : '#7fae6a');
  if (!ruined) {
    p.rect(door0 + 6, f0, 6, 3, '#f3e3c3');
    p.set(door0 + 9, f0 + 1, '#5e9a4a');
    p.set(door0 + 8, f0 + 1, '#7fb85a');
    p.set(door0 + 9, f0, '#7fb85a');
    p.rect(door1 + 2, f0 + 3, 3, H - f0 - 13, '#7fae6a');
    p.rect(door1 + 2, f0 + 3, 1, H - f0 - 13, '#a8d090');
  }
  // Corner posts.
  mullionV(p, 0, roof0, H, ruined);
  mullionV(p, GH_W - 2, roof0, H, ruined);
  if (ruined) {
    vines(p, 3, roof1 - 30, H - 1, 3);
    vines(p, GH_W - 5, roof1 - 10, H - 1, 4);
    vines(p, 40, knee - 12, H - 1, 5);
  }
  p.outline(ruined ? '#3a3630' : '#4a5a50', 'noTop');
  return p.toCanvas();
}

/** Ground inside the glasshouse: rich dark garden earth when restored; weeds and shards while ruined. */
export function greenhouseFloor(ruined: boolean): HTMLCanvasElement {
  const W = 7 * 16;
  const H = 4 * 16;
  const p = new Pix(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const n = hash2(x >> 1, y >> 1, 41) + bayer(x, y) * 0.3;
      if (ruined) {
        const weed = hash2(x >> 2, y >> 2, 42) < 0.35;
        p.set(x, y, weed ? (n > 0.8 ? '#8ab85a' : '#6a9a48') : n > 0.9 ? '#9a8a70' : n > 0.5 ? '#7a6a52' : '#6a5a46');
      } else p.set(x, y, n > 1.05 ? '#8a6448' : n > 0.6 ? '#6e4e38' : '#5e4230');
    }
  if (ruined)
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(hash2(i, 1, 43) * (W - 3));
      const y = Math.floor(hash2(i, 2, 43) * (H - 3));
      p.set(x, y, pack(GLASS, 230));
      p.set(x + 1, y + 1, '#ffffff');
      p.set(x + 1, y, pack(GLASS, 180));
    }
  return p.toCanvas();
}

/**
 * A giant crop filling a 3×3 patch: gourds (ribbed pumpkin, striped watermelon), heads (cabbage,
 * cauliflower, napa) and netted melons, each from the crop's own colours.
 */
export function giantCrop(cropId: string): HTMLCanvasElement {
  const def = getCrop(cropId);
  const W = 54;
  const H = 52;
  const p = new Pix(W, H);
  const body = def.produceColor;
  const leaf = def.leafColor;
  const cx = W / 2;
  const cy = 30;
  // Big leaves spreading on the ground behind and around it.
  for (const [lx, ly, rx, ry] of [
    [9, 40, 9, 6],
    [45, 40, 9, 6],
    [16, 46, 8, 5],
    [38, 46, 8, 5],
  ])
    p.ellipse(lx, ly, rx, ry, (nx, ny) => (nx * 0.6 + ny < -0.2 ? light(leaf, 1) : Math.abs(nx) < 0.08 ? shade(leaf, 2) : ny > 0.4 ? shade(leaf, 1) : leaf));
  const kind = def.shape === 'head' ? 'head' : cropId === 'watermelon' ? 'stripe' : def.shape === 'gourd' ? 'rib' : 'net';
  if (kind === 'head') {
    // Outer wrapper leaves, then the tight head.
    p.ellipse(cx, cy + 4, 24, 18, (nx, ny) => {
      const vein = Math.abs(Math.sin(Math.atan2(ny, nx) * 5)) < 0.12;
      return vein ? light(leaf, 1) : nx * 0.5 + ny * 0.8 < -0.3 ? light(leaf, 1) : ny > 0.5 ? shade(leaf, 1) : leaf;
    });
    const head = cropId === 'cauliflower' ? '#f5f0dc' : body;
    p.ellipse(cx, cy, 15, 13, (nx, ny) => {
      if (cropId === 'cauliflower') {
        const bump = (Math.sin(nx * 18) + Math.sin(ny * 16)) * 0.5;
        return bump > 0.6 ? '#fffcee' : bump < -0.5 ? shade(head, 1) : head;
      }
      const curl = Math.abs(Math.sin((nx + ny * 0.3) * 7)) < 0.15;
      return curl ? shade(head, 1) : nx * 0.5 + ny * 0.8 < -0.35 ? light(head, 1) : ny > 0.45 ? shade(head, 1) : head;
    });
  } else {
    p.ellipse(cx, cy, 23, 18, (nx, ny) => {
      const lit = -(nx * 0.55 + ny * 0.75);
      let c = lit > 0.45 ? light(body, 2) : lit > 0.1 ? light(body, 1) : lit > -0.45 ? body : shade(body, 1);
      if (kind === 'rib') {
        const rib = Math.abs(Math.sin(nx * 5.2));
        if (rib < 0.16) c = shade(c, 2);
        else if (rib < 0.3) c = shade(c, 1);
      } else if (kind === 'stripe') {
        const band = Math.sin(nx * 7 + Math.sin(ny * 9) * 0.6);
        if (band > 0.55) c = shade(c, 1);
        else if (band < -0.65) c = light(c, 1);
      } else if (Math.abs(Math.sin(nx * 14 + ny * 6)) < 0.14 || Math.abs(Math.sin(nx * 6 - ny * 14)) < 0.14) c = light(body, 2);
      return c;
    });
    // Shine and stem.
    p.rect(cx - 12, cy - 11, 4, 1, '#ffffff');
    p.rect(cx - 13, cy - 10, 2, 1, '#ffffff');
    p.rect(cx - 1, cy - 22, 3, 6, '#6a5a2a');
    p.rect(cx - 1, cy - 22, 1, 6, '#8a7a3a');
    p.set(cx + 2, cy - 22, '#6a5a2a');
    p.ellipse(cx + 6, cy - 19, 4, 2, leaf);
  }
  p.outline(shade(leaf, 4));
  return p.toCanvas();
}
