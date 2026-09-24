import { hash2 } from '@lumina/core';
import { Pix } from '../Pix';
import { light, mix, shade } from '../palette';

/**
 * Farm machines, quarry outcrops, the old mine and the workbench.
 * World sprites are drawn to stand on the bottom of their tile.
 */
const r = (v: number, k: number) => hash2(v, k, 7373);

const WOOD = '#a8744a';
const WOOD_D = '#7a5236';
const WOOD_L = '#c8945e';
const IRON = '#6a6e7a';
const IRON_L = '#9aa0ac';

function planks(p: Pix, x0: number, y0: number, w: number, h: number, base: string, vertical = false) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const along = vertical ? x - x0 : y - y0;
      let c = base;
      if (along % 4 === 3) c = shade(base, 1);
      else if (along % 4 === 0) c = light(base, 1);
      if (hash2(vertical ? x : x >> 2, vertical ? y >> 2 : y, 5) < 0.08) c = shade(base, 1);
      p.set(x, y, c);
    }
}

// ── Machines ─────────────────────────────────────────────────────────────

export function chest(v: number): HTMLCanvasElement {
  const p = new Pix(16, 16);
  const wood = mix(WOOD, '#b8845a', r(v, 1));
  planks(p, 1, 7, 14, 8, wood);
  // Lid, domed.
  for (let y = 3; y < 7; y++) for (let x = 1; x < 15; x++) p.set(x, y, y === 3 ? light(wood, 1) : y === 6 ? shade(wood, 2) : wood);
  p.rect(2, 2, 12, 1, light(wood, 1));
  // Iron bands and lock.
  for (const x of [3, 12]) p.rect(x, 2, 1, 13, IRON);
  p.rect(1, 6, 14, 1, IRON);
  p.rect(7, 6, 2, 3, '#e8c060');
  p.set(7, 7, '#8a6a2a');
  p.rect(1, 14, 14, 1, shade(wood, 2));
  p.outline('#3a2a20');
  return p.toCanvas();
}

export function compost(v: number, full: boolean): HTMLCanvasElement {
  const p = new Pix(18, 18);
  // Slatted box with gaps.
  for (let y = 5; y < 17; y++)
    for (let x = 1; x < 17; x++) {
      const slat = (y - 5) % 4;
      if (slat === 3 && x > 1 && x < 16) {
        p.set(x, y, '#3a2a20');
        continue;
      }
      p.set(x, y, slat === 0 ? WOOD_L : x < 3 ? WOOD_L : x > 14 ? WOOD_D : WOOD);
    }
  // Heap of soil and green scraps on top.
  p.ellipse(9, 5, 7, 2.5, full ? '#5a3e2c' : '#6e4e36');
  if (full)
    for (let i = 0; i < 9; i++) p.set(4 + Math.floor(r(v, i) * 10), 4 + Math.floor(r(v, i + 20) * 3), ['#7ac05a', '#e8b040', '#c85a4a'][i % 3]);
  p.rect(1, 16, 16, 1, shade(WOOD_D, 1));
  p.outline('#2e2018');
  return p.toCanvas();
}

export function furnace(v: number, lit: number): HTMLCanvasElement {
  const p = new Pix(18, 24);
  const stone = mix('#a09890', '#b0a498', r(v, 1));
  // Dome of fitted stones.
  for (let y = 4; y < 24; y++)
    for (let x = 1; x < 17; x++) {
      const nx = (x + 0.5 - 9) / 8;
      const ny = (y + 0.5 - 12) / 12;
      if (y < 12 && nx * nx + ny * ny > 1) continue;
      const row = Math.floor(y / 4);
      const col = Math.floor((x + (row & 1) * 2) / 4);
      const edge = y % 4 === 0 || (x + (row & 1) * 2) % 4 === 0;
      let c = hash2(col, row, v) < 0.5 ? stone : shade(stone, 1);
      if (nx < -0.5) c = light(c, 1);
      if (nx > 0.6) c = shade(c, 1);
      p.set(x, y, edge ? shade(stone, 2) : c);
    }
  // Chimney.
  p.rect(11, 0, 4, 6, shade(stone, 1));
  p.rect(11, 0, 1, 6, stone);
  // Mouth: glowing when lit.
  const glow = lit ? ['#fff0a0', '#ffc040', '#f08030'][lit % 3] : '#2a2226';
  p.ellipse(9, 18, 4, 3.5, (nx, ny) => (ny > 0.55 ? null : lit ? (Math.hypot(nx, ny) < 0.5 ? '#fff4c0' : glow) : glow));
  p.rect(5, 21, 8, 1, shade(stone, 2));
  p.outline('#3a3234');
  return p.toCanvas();
}

export function jar(v: number, full: boolean): HTMLCanvasElement {
  const p = new Pix(14, 18);
  const clay = mix('#c8845a', '#b87850', r(v, 1));
  p.ellipse(7, 11, 6, 6.5, (nx, ny) => (nx < -0.4 ? light(clay, 1) : nx > 0.5 || ny > 0.6 ? shade(clay, 1) : clay));
  // Neck and cloth lid tied with string.
  p.rect(4, 3, 6, 3, clay);
  p.rect(3, 2, 8, 2, full ? '#f0e4c8' : '#e0d4b8');
  p.rect(3, 4, 8, 1, '#a88a60');
  // Painted band and label.
  p.rect(2, 10, 10, 1, shade(clay, 2));
  p.rect(5, 12, 4, 3, '#f4ecd8');
  p.set(6, 13, full ? '#c84a4a' : '#8a8070');
  p.outline('#4a2a1e');
  return p.toCanvas();
}

export function keg(v: number): HTMLCanvasElement {
  const p = new Pix(16, 20);
  const wood = mix('#9a6a42', '#a8784c', r(v, 1));
  for (let y = 2; y < 19; y++) {
    const bulge = Math.round(Math.sin(((y - 2) / 16) * Math.PI) * 1.6);
    for (let x = 2 - bulge; x < 14 + bulge; x++) {
      const stave = (x + 20) % 3 === 0;
      let c = stave ? shade(wood, 1) : wood;
      if (x < 4 - bulge) c = light(wood, 1);
      if (x > 11 + bulge) c = shade(wood, 1);
      p.set(x, y, c);
    }
  }
  // Iron hoops.
  for (const y of [4, 10, 16]) {
    const bulge = Math.round(Math.sin(((y - 2) / 16) * Math.PI) * 1.6);
    p.rect(2 - bulge, y, 12 + bulge * 2, 1, IRON);
    p.set(3 - bulge, y, IRON_L);
  }
  // Lid and tap.
  p.ellipse(8, 2, 6, 1.5, light(wood, 1));
  p.rect(12, 12, 3, 2, '#c8a040');
  p.set(14, 14, '#c8a040');
  p.outline('#3a2418');
  return p.toCanvas();
}

export function seedMaker(v: number, frame: number): HTMLCanvasElement {
  const p = new Pix(18, 20);
  const wood = mix('#8a6a4a', '#9a7852', r(v, 1));
  planks(p, 2, 8, 14, 11, wood, true);
  // Funnel hopper on top.
  for (let y = 1; y < 8; y++) {
    const hw = 7 - Math.floor(y * 0.6);
    for (let x = 9 - hw; x < 9 + hw; x++) p.set(x, y, y === 1 ? IRON_L : x < 9 - hw + 2 ? IRON_L : IRON);
  }
  p.rect(4, 0, 10, 1, shade(IRON, 1));
  // Crank handle, turning.
  const ang = (frame % 4) * (Math.PI / 2);
  const hx = 16 + Math.round(Math.cos(ang) * 2);
  const hy = 12 + Math.round(Math.sin(ang) * 2);
  p.line(16, 12, hx, hy, IRON);
  p.set(hx, hy, '#c85a4a');
  // Seed drawer.
  p.rect(5, 14, 8, 3, shade(wood, 1));
  p.rect(8, 15, 2, 1, '#e8c060');
  p.outline('#2e2218');
  return p.toCanvas();
}

export function beehouse(v: number): HTMLCanvasElement {
  const p = new Pix(16, 22);
  const paint = ['#f4efe6', '#f0e0b0', '#d8e8f0'][v % 3];
  // Legs.
  p.rect(3, 18, 2, 4, WOOD_D);
  p.rect(11, 18, 2, 4, WOOD_D);
  // Stacked boxes.
  for (let y = 7; y < 19; y++)
    for (let x = 2; x < 14; x++) {
      let c = (y - 7) % 4 === 3 ? shade(paint, 1) : paint;
      if (x < 4) c = light(paint, 1);
      if (x > 12) c = shade(paint, 1);
      p.set(x, y, c);
    }
  // Roof.
  for (let y = 2; y < 8; y++) {
    const half = 3 + Math.floor((y - 2) * 1.1);
    for (let x = 8 - half; x < 8 + half; x++) p.set(x, y, y > 6 ? '#8a5a3a' : x < 8 ? '#b8784a' : '#9a6440');
  }
  // Entrance slot with a bee.
  p.rect(5, 16, 6, 1, '#2a2226');
  p.set(11, 14, '#f0c030');
  p.set(12, 14, '#2a2226');
  p.outline('#4a3a2e');
  return p.toCanvas();
}

export function harvester(v: number, frame: number): HTMLCanvasElement {
  const p = new Pix(20, 24);
  const copper = '#c8784a';
  // Basket body.
  for (let y = 12; y < 22; y++)
    for (let x = 3; x < 17; x++) {
      const weave = (x + y) % 3 === 0;
      p.set(x, y, weave ? '#a8804a' : x < 5 ? '#e0b070' : '#c89858');
    }
  p.rect(3, 12, 14, 1, '#e8c088');
  // Copper boiler on top with a pressure gauge.
  p.ellipse(10, 8, 5, 4.5, (nx, ny) => (nx < -0.3 && ny < 0 ? light(copper, 2) : nx > 0.4 ? shade(copper, 1) : copper));
  p.ellipse(10, 8, 1.5, 1.5, '#f4ecd8');
  p.set(10, 8, '#c84a4a');
  p.rect(9, 1, 2, 3, IRON);
  // Reaping arms, sweeping.
  const a = (frame % 4) * (Math.PI / 2) + 0.4;
  for (const s of [-1, 1]) {
    const ex = 10 + Math.round(Math.cos(a) * 8 * s);
    const ey = 10 + Math.round(Math.sin(a) * 3);
    p.line(10, 10, ex, ey, IRON_L);
    p.set(ex, ey, '#e8e8f0');
  }
  // Wheels.
  p.ellipse(5, 22, 2, 2, '#4a4a52');
  p.ellipse(15, 22, 2, 2, '#4a4a52');
  p.outline('#2e2420');
  return p.toCanvas();
}

// ── Quarry ───────────────────────────────────────────────────────────────

const ORE: Record<string, { fleck: string[]; base: string }> = {
  stone: { fleck: [], base: '#a8a098' },
  coal: { fleck: ['#2a2830', '#3e3a44'], base: '#908880' },
  copper: { fleck: ['#e88850', '#c8603a', '#f8b078'], base: '#a09890' },
  iron: { fleck: ['#c8c8d8', '#8a4a3a', '#e0e4ec'], base: '#9a948e' },
  gem: { fleck: ['#b890f0', '#80e0f0', '#ffffff'], base: '#a0988e' },
};

/** A faceted outcrop veined with its ore; `v` keeps every one unique. */
export function outcrop(kind: string, v: number): HTMLCanvasElement {
  const o = ORE[kind] ?? ORE.stone;
  const p = new Pix(18, 16);
  const base = mix(o.base, '#b8b0a6', r(v, 1) * 0.4);
  const pal = [light(base, 2), light(base, 1), base, shade(base, 1), shade(base, 2)];
  const w = 7 + r(v, 2) * 1.5;
  const h = 6 + r(v, 3) * 1.5;
  const cy = 15 - h;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 18; x++) {
      const nx = (x + 0.5 - 9) / w;
      const ny = (y + 0.5 - cy) / h;
      if (nx * nx + ny * ny > 1 + (hash2(x >> 1, y >> 1, v) - 0.5) * 0.2 || y > 14) continue;
      const facet = Math.floor((x + (y >> 1) + v) / 4) % 3;
      const lit = -(nx * 0.55 + ny * 0.85) + (facet - 1) * 0.18;
      p.set(x, y, pal[lit > 0.5 ? 0 : lit > 0.15 ? 1 : lit > -0.2 ? 2 : lit > -0.55 ? 3 : 4]);
    }
  // Veins and crystals.
  if (kind === 'gem') {
    for (let i = 0; i < 3; i++) {
      const gx = 5 + Math.floor(r(v, 10 + i) * 8);
      const gy = 5 + Math.floor(r(v, 20 + i) * 5);
      const c = o.fleck[i % 2];
      p.set(gx, gy, c);
      p.set(gx, gy - 1, light(c, 1));
      p.set(gx + 1, gy, shade(c, 1));
      p.set(gx, gy - 2, '#ffffff');
    }
  } else if (o.fleck.length)
    for (let i = 0; i < 7; i++) {
      const fx = 4 + Math.floor(r(v, 30 + i) * 10);
      const fy = 5 + Math.floor(r(v, 40 + i) * 8);
      if (!p.opaque(fx, fy)) continue;
      p.set(fx, fy, o.fleck[i % o.fleck.length]);
      if (i % 2) p.set(fx + 1, fy, o.fleck[(i + 1) % o.fleck.length]);
    }
  p.outline(shade(base, 4));
  return p.toCanvas();
}

/** The mine entrance cut into the cliff face (48×48, three tiles by three). */
export function caveMouth(v: number, lit: boolean): HTMLCanvasElement {
  const p = new Pix(48, 48);
  // Darkness receding into the rock.
  for (let y = 6; y < 48; y++)
    for (let x = 6; x < 42; x++) {
      const nx = (x + 0.5 - 24) / 18;
      const ny = (y + 0.5 - 30) / 24;
      if (y < 30 && nx * nx + ny * ny > 1) continue;
      const depth = Math.hypot(nx * 0.8, (y - 48) / 44);
      p.set(x, y, depth > 0.75 ? '#3a3036' : depth > 0.5 ? '#2a2228' : '#1a1418');
    }
  // Timber frame: two posts and a lintel with bolts.
  for (const x of [6, 38]) {
    p.rect(x, 12, 4, 36, WOOD);
    p.rect(x, 12, 1, 36, WOOD_L);
    p.rect(x + 3, 12, 1, 36, WOOD_D);
  }
  p.rect(4, 10, 40, 4, WOOD);
  p.rect(4, 10, 40, 1, WOOD_L);
  p.rect(4, 13, 40, 1, WOOD_D);
  for (const x of [8, 40]) p.set(x, 11, IRON_L);
  // Hanging lantern.
  p.line(34, 14, 34, 17, '#3a3a4a');
  p.rect(33, 18, 3, 4, lit ? '#ffe070' : '#8a7a5a');
  p.rect(32, 17, 5, 1, '#3a3a4a');
  // Rubble and a sign.
  for (let i = 0; i < 6; i++) {
    const x = 10 + Math.floor(r(v, i) * 26);
    const c = ['#8f8a86', '#a8a098', '#7a746e'][i % 3];
    p.ellipse(x, 46, 2 + r(v, i + 9), 1.5, (nx, ny) => (ny < 0 ? light(c, 1) : c));
  }
  p.rect(12, 20, 12, 7, '#c8a878');
  p.rect(12, 20, 12, 1, '#e0c898');
  p.rect(14, 22, 8, 1, '#5a4030');
  p.rect(14, 24, 6, 1, '#5a4030');
  p.outline('#2a1e18');
  return p.toCanvas();
}

export function rail(v: number): HTMLCanvasElement {
  const p = new Pix(16, 16);
  for (let y = 1; y < 16; y += 4) {
    p.rect(1, y, 14, 2, (y + v) % 8 === 1 ? '#8a5a3a' : '#7a4e34');
    p.rect(1, y, 14, 1, '#9a6a44');
  }
  for (const x of [3, 12]) {
    p.rect(x, 0, 1, 16, IRON_L);
    p.rect(x + 1, 0, 1, 16, IRON);
  }
  return p.toCanvas();
}

export function minecart(v: number): HTMLCanvasElement {
  const p = new Pix(20, 18);
  const body = mix('#6a6e7a', '#7a6a5e', r(v, 1));
  for (let y = 6; y < 14; y++) {
    const inset = Math.floor((y - 6) * 0.3);
    for (let x = 2 + inset; x < 18 - inset; x++) p.set(x, y, x < 4 + inset ? light(body, 1) : x > 15 - inset ? shade(body, 1) : body);
  }
  p.rect(2, 6, 16, 1, light(body, 2));
  for (const x of [5, 14]) p.rect(x, 7, 1, 7, shade(body, 2));
  // Heap of ore.
  p.ellipse(10, 6, 7, 3, (nx, ny) => (ny > 0.4 ? null : hash2(Math.round(nx * 9), Math.round(ny * 9), v) < 0.3 ? '#e88850' : ny < -0.3 ? '#b0a8a0' : '#8f8a86'));
  // Wheels on the rails.
  for (const x of [5, 15]) p.ellipse(x, 15, 2.5, 2.5, (nx, ny) => (Math.hypot(nx, ny) < 0.4 ? IRON_L : '#3a3a42'));
  p.outline('#22242a');
  return p.toCanvas();
}

export function orePile(v: number): HTMLCanvasElement {
  const p = new Pix(32, 18);
  for (let i = 0; i < 16; i++) {
    const x = 5 + r(v, i) * 22;
    const y = 10 + r(v, i + 30) * 5 - Math.sin(((x - 5) / 22) * Math.PI) * 5;
    const c = ['#8f8a86', '#a8a098', '#7a746e', '#b8b0a6'][i % 4];
    p.ellipse(x, y, 2.5 + r(v, i + 60) * 1.5, 2, (nx, ny) => (nx + ny < -0.4 ? light(c, 1) : nx + ny > 0.5 ? shade(c, 1) : c));
    if (i % 5 === 0) p.set(Math.round(x), Math.round(y) - 1, '#e88850');
  }
  // A shovel stuck in the heap.
  p.line(24, 2, 21, 12, '#8a5a3a');
  p.rect(23, 0, 3, 3, IRON_L);
  p.outline('#3a3634');
  return p.toCanvas();
}

/** Sturdy workbench with a vise, saw and planks (two tiles wide). */
export function workbench(v: number): HTMLCanvasElement {
  const p = new Pix(32, 22);
  // Legs and stretcher.
  for (const x of [3, 27]) {
    p.rect(x, 10, 3, 12, WOOD_D);
    p.rect(x, 10, 1, 12, WOOD);
  }
  p.rect(4, 17, 25, 2, WOOD_D);
  // Top.
  planks(p, 1, 6, 30, 5, WOOD_L);
  p.rect(1, 10, 30, 1, shade(WOOD, 1));
  // Vise on the left end.
  p.rect(1, 3, 5, 4, IRON);
  p.rect(1, 3, 5, 1, IRON_L);
  p.line(0, 5, 3, 5, IRON_L);
  // Saw, hammer, a plank and shavings.
  p.line(10, 5, 17, 5, '#c8ccd8');
  p.line(10, 4, 17, 4, '#e0e4ec');
  p.rect(17, 3, 3, 3, '#8a5a3a');
  p.rect(22, 3, 5, 2, IRON);
  p.line(24, 5, 27, 5, '#a8744a');
  for (let i = 0; i < 5; i++) p.set(8 + Math.floor(r(v, i) * 18), 20 + (i % 2), '#e8c890');
  p.outline('#2e2018');
  return p.toCanvas();
}

// ── Icons (16×16) ────────────────────────────────────────────────────────

function icon(draw: (p: Pix) => void, outline = '#2a2230'): HTMLCanvasElement {
  const p = new Pix(16, 16);
  draw(p);
  p.outline(outline);
  return p.toCanvas();
}

export const MATERIAL_ICONS: Record<string, () => HTMLCanvasElement> = {
  'tool.pick': () =>
    icon((p) => {
      p.line(4, 14, 10, 5, '#a8744a');
      p.line(5, 14, 11, 5, '#8a5a3a');
      // Curved iron head.
      for (let x = 3; x < 15; x++) {
        const y = 4 - Math.round(Math.sin(((x - 3) / 11) * Math.PI) * 2);
        p.set(x, y, '#9aa0ac');
        p.set(x, y + 1, '#6a6e7a');
      }
      p.set(3, 4, '#e0e4ec');
    }),
  'mat.wood': () =>
    icon((p) => {
      for (const [x, y] of [
        [3, 10],
        [8, 11],
        [5, 6],
      ]) {
        p.rect(x, y, 8, 3, '#8a5a3a');
        p.rect(x, y, 8, 1, '#a8744a');
        p.ellipse(x + 8, y + 1.5, 1.6, 1.6, (nx, ny) => (Math.hypot(nx, ny) < 0.5 ? '#c89a62' : '#d8b07a'));
      }
    }),
  'mat.stone': () =>
    icon((p) => {
      p.ellipse(7, 10, 5, 4, (nx, ny) => (nx + ny < -0.4 ? '#c8c0b6' : nx + ny > 0.5 ? '#7a746e' : '#a39d96'));
      p.ellipse(11, 7, 3, 2.5, (nx, ny) => (nx + ny < -0.3 ? '#d0c8be' : '#9a948e'));
    }),
  'mat.fiber': () =>
    icon((p) => {
      for (let i = 0; i < 6; i++) p.line(4 + i, 14, 6 + i * 1.4, 2 + (i % 2), i % 2 ? '#7aa84a' : '#5a8a3a');
      p.rect(4, 9, 8, 2, '#c8a060');
    }),
  'mat.coal': () =>
    icon((p) => {
      p.ellipse(8, 9, 5.5, 4.5, (nx, ny) => (nx + ny < -0.5 ? '#6a6670' : nx + ny > 0.4 ? '#1e1c22' : '#3a3640'));
      p.set(6, 7, '#9a96a0');
    }),
  'ore.copper': () =>
    icon((p) => {
      p.ellipse(8, 9, 5.5, 4.5, (nx, ny) => (nx + ny < -0.4 ? '#b8b0a6' : '#8f8a86'));
      for (const [x, y] of [
        [6, 8],
        [9, 10],
        [10, 7],
        [7, 11],
      ])
        p.set(x, y, '#e88850');
      p.set(6, 7, '#f8b078');
    }),
  'ore.iron': () =>
    icon((p) => {
      p.ellipse(8, 9, 5.5, 4.5, (nx, ny) => (nx + ny < -0.4 ? '#b8b0a6' : '#8a8480'));
      for (const [x, y] of [
        [6, 8],
        [9, 10],
        [10, 7],
        [7, 11],
      ])
        p.set(x, y, (x + y) % 2 ? '#e0e4ec' : '#8a4a3a');
    }),
  'bar.copper': () =>
    icon((p) => {
      for (let y = 7; y < 12; y++) for (let x = 3 + (11 - y) * 0; x < 13; x++) p.set(x, y, y === 7 ? '#f8b078' : y > 10 ? '#a0502e' : '#d0703e');
      p.rect(5, 6, 8, 1, '#ffd0a0');
    }),
  'bar.iron': () =>
    icon((p) => {
      for (let y = 7; y < 12; y++) for (let x = 3; x < 13; x++) p.set(x, y, y === 7 ? '#e0e4ec' : y > 10 ? '#6a6e7a' : '#9aa0ac');
      p.rect(5, 6, 8, 1, '#f4f6fa');
    }),
  'gem.quartz': () =>
    icon((p) => {
      p.line(8, 2, 8, 13, '#f4f8ff');
      p.line(6, 5, 6, 13, '#d8e4f0');
      p.line(10, 5, 10, 13, '#b8c8dc');
      p.line(7, 3, 7, 13, '#ffffff');
      p.line(9, 3, 9, 13, '#c8d8e8');
    }, '#6a7a90'),
  'gem.amethyst': () =>
    icon((p) => {
      for (let y = 3; y < 14; y++) {
        const hw = y < 7 ? (y - 3) * 0.9 : 3.5;
        for (let x = Math.round(8 - hw); x <= Math.round(8 + hw); x++) p.set(x, y, x < 8 ? '#c8a0f8' : x > 9 ? '#6a3aa8' : '#9a68d8');
      }
      p.set(7, 5, '#f4e8ff');
    }, '#3a2060'),
  'gem.aquamarine': () =>
    icon((p) => {
      p.ellipse(8, 8, 5, 5.5, (nx, ny) => (nx + ny < -0.6 ? '#d8faff' : nx + ny < 0 ? '#80e0f0' : nx + ny < 0.6 ? '#40b8d0' : '#2888a8'));
      p.set(6, 5, '#ffffff');
      p.line(8, 3, 8, 13, '#60c8e0');
    }, '#185868'),
};

/** Machine icons: the world sprite, trimmed to fit 16×16. */
export function machineIcon(kind: string): HTMLCanvasElement {
  const src =
    kind === 'chest'
      ? chest(1)
      : kind === 'compost'
        ? compost(1, true)
        : kind === 'furnace'
          ? furnace(1, 0)
          : kind === 'jar'
            ? jar(1, false)
            : kind === 'keg'
              ? keg(1)
              : kind === 'seedmaker'
                ? seedMaker(1, 0)
                : kind === 'beehouse'
                  ? beehouse(1)
                  : harvester(1, 0);
  // Down-sample by dropping every other row/column where the sprite is too big — keeps hard pixels.
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const sw = src.width;
  const sh = src.height;
  const k = Math.max(1, Math.max(sw, sh) / 16);
  const dw = Math.round(sw / k);
  const dh = Math.round(sh / k);
  ctx.drawImage(src, 0, 0, sw, sh, Math.floor((16 - dw) / 2), 16 - dh, dw, dh);
  return c;
}

type ArtisanKind = 'jam' | 'pickle' | 'tea' | 'wine' | 'juice' | 'honey';

/** Artisan goods: the vessel says what it is, the contents take the source's colour. */
export function artisanIcon(type: ArtisanKind, color: string): HTMLCanvasElement {
  const p = new Pix(16, 16);
  const c = color;
  const glass = '#e8f4f8';
  switch (type) {
    case 'jam':
    case 'pickle':
    case 'honey': {
      // Jar with a lid (cloth for jam, metal for pickles, dipper-tag for honey).
      const fill = type === 'honey' ? mix('#f0b030', c, 0.25) : type === 'pickle' ? mix(c, '#8ab04a', 0.35) : c;
      for (let y = 5; y < 15; y++) for (let x = 3; x < 13; x++) p.set(x, y, y < 7 ? glass : x < 5 ? light(fill, 1) : x > 11 ? shade(fill, 1) : fill);
      p.rect(4, 8, 1, 4, '#ffffff');
      if (type === 'jam') {
        p.rect(2, 3, 12, 3, '#f4ecd8');
        for (let x = 2; x < 14; x += 2) p.set(x, 5, '#e05a5a');
        p.rect(2, 6, 12, 1, '#a88a60');
      } else {
        p.rect(3, 3, 10, 2, type === 'honey' ? '#c8a040' : '#9aa0ac');
        p.rect(3, 3, 10, 1, type === 'honey' ? '#e8c860' : '#c8ccd8');
      }
      if (type === 'honey') {
        p.line(11, 1, 9, 6, '#a8744a');
        p.rect(7, 10, 3, 2, '#fff4d0');
      } else p.rect(6, 10, 4, 3, '#f4ecd8');
      break;
    }
    case 'tea': {
      // A cup with steam.
      for (let y = 8; y < 14; y++) for (let x = 3; x < 12; x++) p.set(x, y, x < 5 ? '#ffffff' : x > 10 ? '#c8c8d0' : '#f0f0f4');
      p.rect(4, 8, 7, 1, mix(c, '#a86a3a', 0.4));
      p.rect(12, 9, 2, 3, '#e0e0e8');
      p.rect(2, 14, 11, 1, '#c8c8d0');
      p.line(6, 6, 7, 3, '#e8f0f8');
      p.line(9, 6, 8, 3, '#e8f0f8');
      break;
    }
    default: {
      // Bottle: wine is dark glass with a label, juice clear with a straw of colour.
      const fill = type === 'wine' ? shade(c, 1) : light(c, 1);
      p.rect(7, 1, 2, 4, type === 'wine' ? '#8a5a3a' : '#e0e0e8');
      for (let y = 5; y < 15; y++) {
        const hw = y < 7 ? 2 : 4;
        for (let x = 8 - hw; x < 8 + hw; x++) p.set(x, y, x < 8 - hw + 1 ? light(fill, 1) : x > 8 + hw - 2 ? shade(fill, 1) : fill);
      }
      p.rect(5, 9, 6, 3, '#f4ecd8');
      p.set(6, 10, c);
      p.rect(5, 6, 1, 6, light(fill, 2));
    }
  }
  p.outline(shade(c, 3));
  return p.toCanvas();
}

