import { TILE, hash2, type Building } from '@lumina/core';
import { Pix } from '../Pix';
import { light, shade } from '../palette';

export interface LightSpot {
  x: number;
  y: number;
  r: number;
  color: string;
}

export interface BuildingSprite {
  img: HTMLCanvasElement;
  /** Only the lit windows — blended in at night. */
  night: HTMLCanvasElement;
  /** Sprite offset from the footprint's top-left pixel. */
  ox: number;
  oy: number;
  lights: LightSpot[];
  smoke: Array<{ x: number; y: number }>;
}

type WallStyle = 'plaster' | 'plank' | 'stone' | 'timber';

class Painter {
  p: Pix;
  n: Pix;
  lights: LightSpot[] = [];
  smoke: Array<{ x: number; y: number }> = [];
  constructor(w: number, h: number) {
    this.p = new Pix(w, h);
    this.n = new Pix(w, h);
  }

  roof(x0: number, y0: number, w: number, h: number, color: string, style: 'tile' | 'slate' | 'thatch' = 'tile', inset = 5, moss = false) {
    const p = this.p;
    const hi = light(color, 1);
    const hi2 = light(color, 2);
    const lo = shade(color, 1);
    const lo2 = shade(color, 2);
    const lo3 = shade(color, 3);
    for (let y = y0; y < y0 + h; y++) {
      const t = (y - y0) / (h - 1);
      const ins = Math.round((1 - t) * inset);
      for (let x = x0 + ins; x < x0 + w - ins; x++) {
        const row = y - y0;
        const rowH = style === 'slate' ? 4 : 3;
        const r = Math.floor(row / rowH);
        const ly = row % rowH;
        const off = (r & 1) * 3;
        const lx = (x - x0 + off) % 6;
        let c = color;
        if (style === 'thatch') {
          c = hash2(x, y, 3) < 0.3 ? hi : hash2(x, y, 4) < 0.2 ? lo : color;
          if (ly === rowH - 1) c = lo;
        } else {
          // Each tile: its own weathered tone, a glint on its upper left, a shadow line below.
          const tileId = Math.floor((x - x0 + off) / 6);
          const k = hash2(tileId, r, 17);
          const base = k < 0.14 ? hi : k > 0.86 ? lo : color;
          c = base;
          if (ly === rowH - 1) c = lo2;
          else if (ly === 0) c = lx === 1 || lx === 2 ? hi2 : hi;
          if (lx === 0 && ly !== rowH - 1) c = lo;
          if (moss && ly !== rowH - 1 && hash2(tileId >> 1, r >> 1, 19) < 0.18 && hash2(x, y, 20) < 0.7) c = hash2(x, y, 21) < 0.5 ? '#7fa34e' : '#658a42';
        }
        // Side slopes darker/lighter for volume.
        if (x < x0 + ins + 2) c = hi;
        if (x >= x0 + w - ins - 2) c = lo2;
        if (y === y0) c = hi2; // ridge
        if (y === y0 + h - 1 || y === y0 + h - 2) c = y === y0 + h - 1 ? lo3 : lo2; // eave
        p.set(x, y, c);
      }
    }
  }

  wall(x0: number, y0: number, w: number, h: number, color: string, style: WallStyle) {
    const p = this.p;
    const lo = shade(color, 1);
    const lo2 = shade(color, 2);
    const hi = light(color, 1);
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        let c = color;
        if (style === 'plank') {
          if ((y - y0) % 4 === 3) c = lo;
          else if ((y - y0) % 4 === 0) c = hi;
          if (hash2(x >> 3, y >> 2, 5) < 0.2 && (y - y0) % 4 !== 3) c = lo;
        } else if (style === 'stone') {
          const row = Math.floor((y - y0) / 5);
          const lx = (x - x0 + (row & 1) * 4) % 8;
          const ly = (y - y0) % 5;
          if (ly === 4 || lx === 0) c = lo2;
          else if (ly === 0) c = hi;
          else if (hash2(Math.floor((x - x0 + (row & 1) * 4) / 8), row, 9) < 0.35) c = lo;
        } else {
          if (hash2(x, y, 11) < 0.07) c = lo;
          if (hash2(x, y, 12) < 0.04) c = hi;
        }
        p.set(x, y, c);
      }
    // Deep shadow under the eave, fading out.
    for (let x = x0; x < x0 + w; x++) {
      p.set(x, y0, shade(color, 3));
      p.set(x, y0 + 1, lo2);
      p.set(x, y0 + 2, lo);
      if ((x + y0) & 1) p.set(x, y0 + 3, lo);
    }
    // Rain-splash weathering just above the footing.
    for (let x = x0; x < x0 + w; x++)
      for (let k = 0; k < 4; k++) if (hash2(x, k, 23) < 0.5 - k * 0.12) p.set(x, y0 + h - 5 - k, k === 0 ? lo2 : lo);
    // Stone footing: a course of individual stones.
    for (let x = x0 - 1; x < x0 + w + 1; x++)
      for (let yy = 0; yy < 4; yy++) {
        const stone = Math.floor((x - x0 + (yy > 1 ? 3 : 0)) / 6);
        const edge = (x - x0 + (yy > 1 ? 3 : 0)) % 6 === 0 || yy === 2 || yy === 3 ? yy === 3 : false;
        let c = hash2(stone, yy > 1 ? 1 : 0, 25) < 0.5 ? '#9a9088' : '#8a8078';
        if (yy === 0 || yy === 2) c = '#b0a69c';
        if ((x - x0 + (yy > 1 ? 3 : 0)) % 6 === 0 || edge) c = '#5e544c';
        p.set(x, y0 + h - 4 + yy, c);
      }
    if (style === 'timber') {
      const beam = '#6e4a34';
      for (let x = x0; x < x0 + w; x += 16) p.rect(x, y0 + 2, 2, h - 4, beam);
      p.rect(x0, y0 + 2, w, 2, beam);
      p.rect(x0 + w - 2, y0 + 2, 2, h - 4, beam);
    }
    // Corner shading.
    for (let y = y0 + 2; y < y0 + h - 2; y++) {
      p.set(x0, y, shade(color, 2));
      p.set(x0 + w - 1, y, shade(color, 2));
    }
  }

  window(x: number, y: number, w = 10, h = 10, box?: string, shutters?: string) {
    const p = this.p;
    if (shutters) {
      // Louvred shutters folded back beside the frame.
      for (const sx of [x - 5, x + w + 1])
        for (let yy = y; yy < y + h; yy++)
          for (let xx = sx; xx < sx + 4; xx++) {
            let c = (yy - y) % 2 ? shade(shutters, 1) : shutters;
            if (xx === sx) c = light(shutters, 1);
            if (xx === sx + 3) c = shade(shutters, 2);
            p.set(xx, yy, c);
          }
    }
    const frame = '#5a3e2c';
    p.rect(x, y, w, h, frame);
    for (let yy = y + 1; yy < y + h - 1; yy++)
      for (let xx = x + 1; xx < x + w - 1; xx++) {
        const t = (yy - y) / h;
        p.set(xx, yy, t < 0.5 ? '#a8d8ea' : '#7fb4d0');
        this.n.set(xx, yy, t < 0.5 ? '#ffe7a8' : '#ffc873');
      }
    // Mullions & glare.
    p.rect(x + Math.floor(w / 2), y + 1, 1, h - 2, frame);
    p.rect(x + 1, y + Math.floor(h / 2), w - 2, 1, frame);
    this.n.rect(x + Math.floor(w / 2), y + 1, 1, h - 2, '#b8864a');
    this.n.rect(x + 1, y + Math.floor(h / 2), w - 2, 1, '#b8864a');
    p.set(x + 2, y + 2, '#f4fbff');
    p.set(x + 3, y + 2, '#f4fbff');
    p.set(x + 2, y + 3, '#f4fbff');
    // Sill.
    p.rect(x - 1, y + h, w + 2, 1, '#e8d8b8');
    p.rect(x - 1, y + h + 1, w + 2, 1, '#9a8468');
    if (box) {
      p.rect(x, y + h + 2, w, 3, '#8a5a3a');
      for (let i = 0; i < w; i += 2) {
        p.set(x + i, y + h + 1, i % 4 ? box : '#fff4d0');
        p.set(x + i + 1, y + h + 1, '#5e9a4a');
      }
    }
    this.lights.push({ x: x + w / 2, y: y + h / 2, r: 26, color: '#ffc873' });
  }

  door(x: number, y: number, w: number, h: number, color = '#8a5a3a', open = false) {
    const p = this.p;
    p.rect(x - 1, y - 1, w + 2, h + 1, '#5a3e2c');
    if (open) {
      p.rect(x, y, w, h, '#3a2a28');
      this.n.rect(x, y, w, h, '#ffcf80');
      p.rect(x, y + h - 2, w, 2, '#6e5a4a');
      return;
    }
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        const lx = xx - x;
        let c = color;
        if (lx % 4 === 3) c = shade(color, 1);
        if (lx === 0) c = light(color, 1);
        p.set(xx, yy, c);
      }
    p.rect(x + 2, y + 3, w - 4, 4, '#a8d8ea');
    this.n.rect(x + 2, y + 3, w - 4, 4, '#ffd98a');
    p.set(x + w - 3, y + Math.floor(h / 2) + 1, '#f0c050');
    // Step.
    p.rect(x - 2, y + h, w + 4, 1, '#b8ac9c');
  }

  /** Climbing ivy from the ground up the wall. */
  ivy(x: number, bottom: number, height: number, seed: number) {
    const p = this.p;
    let cx = x;
    for (let k = 0; k < height; k++) {
      const y = bottom - k;
      if (hash2(seed, k, 31) < 0.3) cx += hash2(seed, k, 32) < 0.5 ? -1 : 1;
      p.set(cx, y, '#4e7a3a');
      if (k % 2 === 0) {
        p.set(cx - 1, y, '#6ea24a');
        p.set(cx + 1, y - 1, '#5a8e42');
      }
      if (k % 3 === 0) {
        p.set(cx - 2, y - 1, '#8ac05a');
        p.set(cx + 2, y, '#6ea24a');
      }
    }
  }

  chimney(x: number, y: number, h: number) {
    this.p.rect(x, y, 6, h, '#9a6a5a');
    this.p.rect(x, y, 1, h, '#b8806a');
    this.p.rect(x + 5, y, 1, h, '#6e4a40');
    this.p.rect(x - 1, y, 8, 2, '#6e4a40');
    this.smoke.push({ x: x + 3, y: y - 1 });
  }

  awning(x: number, y: number, w: number, a: string, b: string) {
    const p = this.p;
    for (let yy = 0; yy < 6; yy++)
      for (let xx = 0; xx < w; xx++) {
        const stripe = Math.floor(xx / 4) % 2 ? a : b;
        p.set(x + xx, y + yy, yy === 0 ? shade(stripe, 1) : stripe);
      }
    // Scalloped edge.
    for (let xx = 0; xx < w; xx += 4) {
      const stripe = Math.floor(xx / 4) % 2 ? a : b;
      p.set(x + xx + 1, y + 6, stripe);
      p.set(x + xx + 2, y + 6, stripe);
      p.set(x + xx + 1, y + 7, shade(stripe, 1));
      p.set(x + xx + 2, y + 7, shade(stripe, 1));
    }
  }

  sign(x: number, y: number, icon: (p: Pix, x: number, y: number) => void) {
    const p = this.p;
    p.rect(x - 1, y - 3, 1, 3, '#3a3a4a');
    p.rect(x - 1, y - 3, 10, 1, '#3a3a4a');
    p.rect(x, y, 16, 12, '#5a3e2c');
    p.rect(x + 1, y + 1, 14, 10, '#e8d0a0');
    p.rect(x + 1, y + 10, 14, 1, '#c8a878');
    icon(p, x + 4, y + 2);
  }

  done(): Pick<BuildingSprite, 'img' | 'night' | 'lights' | 'smoke'> {
    this.p.outline(undefined, 'noTop');
    return { img: this.p.toCanvas(), night: this.n.toCanvas(), lights: this.lights, smoke: this.smoke };
  }
}

const sprout = (p: Pix, x: number, y: number) => {
  p.rect(x + 1, y + 6, 6, 2, '#8a5a3a');
  p.line(x + 4, y + 6, x + 4, y + 2, '#4f8a3a');
  p.rect(x + 1, y + 1, 3, 2, '#6fb85a');
  p.rect(x + 5, y + 2, 3, 2, '#5fa84a');
};
const hammer = (p: Pix, x: number, y: number) => {
  p.line(x + 1, y + 7, x + 6, y + 2, '#8a5a3a');
  p.rect(x + 4, y, 4, 3, '#5a6a7a');
  p.rect(x + 1, y + 7, 6, 1, '#3a3a4a');
};
const anchor = (p: Pix, x: number, y: number) => {
  p.line(x + 4, y + 1, x + 4, y + 7, '#2f5a7a');
  p.rect(x + 2, y + 2, 5, 1, '#2f5a7a');
  p.line(x + 1, y + 5, x + 4, y + 7, '#2f5a7a');
  p.line(x + 7, y + 5, x + 4, y + 7, '#2f5a7a');
  p.set(x + 4, y, '#2f5a7a');
};

function base(b: Building, roofExtra: number) {
  const w = b.w * TILE + 4;
  const h = b.h * TILE + roofExtra;
  return { w, h, pt: new Painter(w, h), wallTop: h - 34 };
}

function house(b: Building): BuildingSprite {
  const { w, h, pt } = base(b, 36);
  const wallH = 34;
  const wallY = h - wallH;
  pt.chimney(w - 26, 6, 18);
  pt.roof(0, 10, w, wallY - 8, '#d9735a', 'tile', 6);
  pt.wall(2, wallY, w - 4, wallH, '#f3e6cc', 'timber');
  const doorX = 2 + TILE * (b.door!.x - b.x) + 2;
  pt.door(doorX, h - 22, 12, 20, '#9a5a3a');
  pt.window(14, wallY + 9, 12, 10, '#f07aa0', '#5a8a6a');
  pt.window(w - 30, wallY + 9, 12, 10, '#f5d040', '#5a8a6a');
  pt.ivy(w - 8, h - 5, 26, 7);
  pt.p.rect(w - 44, h - 8, 3, 5, '#8a5a3a');
  const d = pt.done();
  return { ...d, ox: -2, oy: 0 };
}

function seedShop(b: Building): BuildingSprite {
  const { w, h, pt } = base(b, 34);
  const wallH = 36;
  const wallY = h - wallH;
  pt.roof(0, 8, w, wallY - 6, '#5aa58a', 'tile', 5);
  pt.wall(2, wallY, w - 4, wallH, '#e8c898', 'plank');
  const doorX = 2 + TILE * (b.door!.x - b.x) + 2;
  pt.awning(4, wallY + 4, w - 8, '#6fb88a', '#f7efd8');
  pt.window(10, wallY + 14, 16, 12, '#f07aa0');
  pt.door(doorX, h - 22, 12, 20, '#5a8a6a', true);
  pt.window(w - 26, wallY + 14, 14, 12, '#f5d040');
  pt.sign(w - 20, 2 + 20, sprout);
  const d = pt.done();
  return { ...d, ox: -2, oy: 0 };
}

function toolShop(b: Building): BuildingSprite {
  const { w, h, pt } = base(b, 36);
  const wallH = 44;
  const wallY = h - wallH;
  pt.chimney(18, 4, 22);
  pt.roof(0, 12, w, wallY - 10, '#5a6a8a', 'slate', 6);
  pt.wall(2, wallY, w - 4, wallH, '#b8aa98', 'stone');
  pt.wall(2, wallY, w - 4, 16, '#8a6a4a', 'plank');
  pt.awning(6, wallY + 14, w - 12, '#e8836b', '#f7efd8');
  const doorX = 2 + TILE * (b.door!.x - b.x) + 2;
  pt.door(doorX, h - 22, 12, 20, '#6e4a34', true);
  pt.window(12, wallY + 24, 14, 10);
  pt.window(w - 28, wallY + 24, 14, 10);
  // Forge glow in the chimney top.
  pt.n.rect(19, 5, 4, 2, '#ff9a4a');
  pt.lights.push({ x: 21, y: 4, r: 18, color: '#ff9a4a' });
  pt.sign(w - 22, 18, hammer);
  const d = pt.done();
  return { ...d, ox: -2, oy: 0 };
}

const COTTAGE_ROOFS = ['#c8604a', '#4f7ab0', '#8a6ab0', '#d89a4a', '#5a9a7a'];
const COTTAGE_WALLS = ['#f3e6cc', '#e8d8c0', '#f0e0d0', '#e0d0b0'];

function cottage(b: Building): BuildingSprite {
  const { w, h, pt } = base(b, 32);
  const wallH = 32;
  const wallY = h - wallH;
  const roofC = COTTAGE_ROOFS[b.v % COTTAGE_ROOFS.length];
  if (b.v % 2) pt.chimney(12, 6, 16);
  pt.roof(0, 10, w, wallY - 8, roofC, b.v % 3 === 0 ? 'thatch' : 'tile', 5, b.v % 2 === 0);
  pt.wall(2, wallY, w - 4, wallH, COTTAGE_WALLS[b.v % COTTAGE_WALLS.length], b.v % 2 ? 'plaster' : 'timber');
  const doorX = 2 + TILE * (b.door!.x - b.x) + 2;
  pt.door(doorX, h - 22, 12, 20, ['#9a5a3a', '#4f6a8a', '#7a8a4a'][b.v % 3]);
  const shutter = ['#5a8a6a', '#4f6a9a', '#a85a4a', '#7a6a9a'][b.v % 4];
  pt.window(9, wallY + 9, 10, 10, '#e8a0b8', b.v % 3 !== 1 ? shutter : undefined);
  pt.window(w - 21, wallY + 9, 10, 10, '#f5d040', b.v % 3 !== 1 ? shutter : undefined);
  if (b.v % 2 === 1) pt.ivy(4, h - 5, 22, b.v);
  const d = pt.done();
  return { ...d, ox: -2, oy: 0 };
}

function harborOffice(b: Building): BuildingSprite {
  const { w, h, pt } = base(b, 30);
  const wallH = 32;
  const wallY = h - wallH;
  pt.roof(0, 8, w, wallY - 6, '#3f6a9a', 'slate', 4);
  pt.wall(2, wallY, w - 4, wallH, '#9ac0c8', 'plank');
  const doorX = 2 + TILE * (b.door!.x - b.x) + 2;
  pt.door(doorX, h - 22, 12, 20, '#2f4a6a');
  pt.window(8, wallY + 9, 10, 10);
  // Life ring.
  pt.p.ellipse(w - 14, wallY + 14, 5, 5, '#f4f0e8');
  pt.p.ellipse(w - 14, wallY + 14, 2, 2, '#9ac0c8');
  pt.p.rect(w - 19, wallY + 13, 2, 3, '#e8503a');
  pt.p.rect(w - 11, wallY + 13, 2, 3, '#e8503a');
  pt.sign(w - 24, 10, anchor);
  const d = pt.done();
  return { ...d, ox: -2, oy: 0 };
}

function lighthouse(b: Building): BuildingSprite {
  const w = b.w * TILE + 12;
  const h = 150;
  const pt = new Painter(w, h);
  const p = pt.p;
  const cx = w / 2;
  const baseY = h - 1;
  const topY = 40;
  // Tapered tower.
  for (let y = topY; y <= baseY; y++) {
    const t = (y - topY) / (baseY - topY);
    const hw = 11 + t * 8;
    const band = Math.floor((y - topY) / 18) % 2 === 1;
    for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
      const rel = (x + 0.5 - cx) / hw;
      let c = band ? '#d9534a' : '#f4efe6';
      if (rel < -0.6) c = light(c, 1);
      if (rel > 0.45) c = shade(c, 1);
      if (rel > 0.8) c = shade(c, 2);
      p.set(x, y, c);
    }
  }
  // Base plinth and door.
  p.rect(Math.floor(cx - 20), baseY - 6, 40, 7, '#8a8278');
  p.rect(Math.floor(cx - 20), baseY - 6, 40, 1, '#aaa298');
  pt.door(Math.floor(cx - 5), baseY - 22, 10, 16, '#4f6a8a');
  pt.window(Math.floor(cx - 3), topY + 30, 6, 8);
  pt.window(Math.floor(cx - 3), topY + 62, 6, 8);
  // Gallery.
  p.rect(Math.floor(cx - 15), topY - 2, 30, 3, '#3a3a4a');
  for (let x = Math.floor(cx - 14); x < cx + 14; x += 3) p.rect(x, topY - 7, 1, 5, '#3a3a4a');
  p.rect(Math.floor(cx - 15), topY - 8, 30, 1, '#3a3a4a');
  // Lantern room.
  p.rect(Math.floor(cx - 9), topY - 20, 18, 13, '#2b2d4a');
  p.rect(Math.floor(cx - 8), topY - 19, 16, 11, '#cfe8f0');
  pt.n.rect(Math.floor(cx - 8), topY - 19, 16, 11, '#fff2b0');
  p.rect(Math.floor(cx - 1), topY - 19, 2, 11, '#2b2d4a');
  // Dome.
  p.ellipse(cx, topY - 21, 11, 7, (nx, ny) => (ny > 0.2 ? null : nx < -0.3 ? '#e0685a' : nx > 0.4 ? '#9a3a34' : '#c84a40'));
  p.rect(Math.floor(cx), topY - 32, 1, 5, '#3a3a4a');
  p.set(cx, topY - 33, '#f0c050');
  pt.lights.push({ x: cx, y: topY - 14, r: 60, color: '#fff2b0' });
  const d = pt.done();
  return { ...d, ox: -6, oy: 0 };
}

function windmill(b: Building): BuildingSprite {
  const w = b.w * TILE + 4;
  const h = 96;
  const pt = new Painter(w, h);
  const p = pt.p;
  const cx = w / 2;
  for (let y = 30; y < h; y++) {
    const t = (y - 30) / (h - 30);
    const hw = 16 + t * 12;
    for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
      const rel = (x + 0.5 - cx) / hw;
      const row = Math.floor(y / 5);
      const lx = (x + (row & 1) * 3) % 7;
      let c = y % 5 === 0 || lx === 0 ? '#a8a090' : '#e8e0d0';
      if (rel < -0.6) c = light(c, 1);
      if (rel > 0.5) c = shade(c, 1);
      p.set(x, y, c);
    }
  }
  for (let y = 8; y < 34; y++) {
    const t = (y - 8) / 26;
    const hw = 2 + t * 18;
    for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
      const rel = (x + 0.5 - cx) / hw;
      p.set(x, y, rel < -0.4 ? '#b8704a' : rel > 0.4 ? '#7a4030' : '#9a5a3a');
    }
  }
  pt.door(Math.floor(cx - 6), h - 20, 12, 18, '#6e4a34');
  pt.window(Math.floor(cx - 4), 44, 8, 8);
  const d = pt.done();
  return { ...d, ox: -2, oy: 0 };
}

/** Rotating windmill sails, drawn pixel-perfect for each angle (no rotated bitmaps). */
export function windmillSails(frame: number, frames: number): HTMLCanvasElement {
  const p = new Pix(76, 76);
  const c = 38;
  const a0 = (frame / frames) * (Math.PI / 2);
  for (let k = 0; k < 4; k++) {
    const a = a0 + (k * Math.PI) / 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const nx = -dy;
    const ny = dx;
    for (let r = 4; r < 36; r++) {
      p.set(c + dx * r, c + dy * r, '#5a3e2c');
      if (r > 10)
        for (let s = 1; s < 8; s++) {
          const col = (r + s) % 4 === 0 ? '#c8b89a' : '#f4ecd8';
          p.set(c + dx * r + nx * s, c + dy * r + ny * s, col);
        }
    }
  }
  p.ellipse(c, c, 3, 3, '#3a2a28');
  p.outline();
  return p.toCanvas();
}

export function buildingSprite(b: Building): BuildingSprite {
  switch (b.kind) {
    case 'house':
      return house(b);
    case 'seedShop':
      return seedShop(b);
    case 'toolShop':
      return toolShop(b);
    case 'cottage':
      return cottage(b);
    case 'harborOffice':
      return harborOffice(b);
    case 'lighthouse':
      return lighthouse(b);
    case 'windmill':
      return windmill(b);
  }
}
