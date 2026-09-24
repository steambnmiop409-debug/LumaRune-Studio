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
  /** Snow on the roof, sills and chimney — laid over the sprite in winter. */
  snow: HTMLCanvasElement;
  /** Sprite offset from the footprint's top-left pixel. */
  ox: number;
  oy: number;
  lights: LightSpot[];
  smoke: Array<{ x: number; y: number }>;
}

type WallStyle = 'plaster' | 'plank' | 'stone' | 'timber' | 'log';

class Painter {
  p: Pix;
  n: Pix;
  /** Snow overlay (winter). */
  s: Pix;
  private roofs: Array<{ x0: number; y0: number; w: number; h: number; inset: number }> = [];
  private sills: Array<{ x: number; y: number; w: number }> = [];
  lights: LightSpot[] = [];
  smoke: Array<{ x: number; y: number }> = [];
  constructor(w: number, h: number) {
    this.p = new Pix(w, h);
    this.n = new Pix(w, h);
    this.s = new Pix(w, h);
  }

  roof(x0: number, y0: number, w: number, h: number, color: string, style: 'tile' | 'slate' | 'thatch' | 'shake' = 'tile', inset = 5, moss = false) {
    const p = this.p;
    const hi = light(color, 1);
    const hi2 = light(color, 2);
    const lo = shade(color, 1);
    const lo2 = shade(color, 2);
    const lo3 = shade(color, 3);
    this.roofs.push({ x0, y0, w, h, inset });
    for (let y = y0; y < y0 + h; y++) {
      const t = (y - y0) / (h - 1);
      // Pitch: the upper courses catch the sky, the lower ones fall toward the eave shadow.
      const pitch = t < 0.22 ? 1 : t > 0.72 ? -1 : 0;
      const ins = Math.round((1 - t) * inset);
      for (let x = x0 + ins; x < x0 + w - ins; x++) {
        const row = y - y0;
        const rowH = style === 'slate' ? 4 : 3;
        const r = Math.floor(row / rowH);
        const ly = row % rowH;
        const off = (r & 1) * 3;
        const lx = (x - x0 + off) % 6;
        let c = color;
        if (style === 'shake') {
          // Split-wood shakes: uneven lengths, each with a lit edge and a dark gap.
          const tileId = Math.floor((x - x0 + off) / 4);
          const k = hash2(tileId, r, 29);
          c = k < 0.2 ? hi : k > 0.8 ? lo : color;
          if (ly === rowH - 1 || (x - x0 + off) % 4 === 0) c = lo2;
          else if (ly === 0) c = hi;
          if (moss && hash2(tileId >> 1, r >> 1, 30) < 0.14 && ly !== rowH - 1) c = '#6f9a48';
        } else if (style === 'thatch') {
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
        if (pitch > 0 && c === color) c = hi;
        else if (pitch < 0 && (c === color || c === hi)) c = pitch < 0 && c === hi ? color : lo;
        // Side slopes darker/lighter for volume.
        if (x < x0 + ins + 2) c = hi;
        if (x >= x0 + w - ins - 2) c = lo2;
        if (y === y0) c = hi2; // ridge
        if (y === y0 + h - 1 || y === y0 + h - 2) c = y === y0 + h - 1 ? lo3 : lo2; // eave
        p.set(x, y, c);
      }
    }
    // Painted fascia board along the eave, with a drip shadow under it.
    for (let x = x0 + 1; x < x0 + w - 1; x++) {
      p.set(x, y0 + h - 2, style === 'shake' || style === 'thatch' ? '#8a6040' : '#efe6d6');
      p.set(x, y0 + h - 1, style === 'shake' || style === 'thatch' ? '#5a3a26' : '#b8ac9c');
    }
  }

  /**
   * A gable end turned toward the viewer. The ridge runs away from us, so on screen it is a
   * line down the middle of the roof: the left slope catches the sun, the right one is in shade,
   * and the courses of tiles run up and down. Below the rakes (with their barge boards) the
   * triangular gable wall is filled in the building's own wall material, with an attic window.
   * `wallY` is where the front wall starts; the roof overhangs the wall by 2 px each side.
   */
  gableRoof(x0: number, w: number, yTop: number, wallY: number, gableH: number, color: string, style: 'tile' | 'slate' | 'shake' | 'thatch', wallColor: string, wallStyle: WallStyle, attic = true) {
    const p = this.p;
    const cx = x0 + w / 2;
    const half = w / 2 + 2;
    const hiC = light(color, 1);
    const hi2 = light(color, 2);
    const lo = shade(color, 1);
    const lo2 = shade(color, 2);
    const lo3 = shade(color, 3);
    const trim = style === 'shake' || style === 'thatch' ? '#6e4a34' : '#efe6d6';
    const trimLo = style === 'shake' || style === 'thatch' ? '#4a3022' : '#b8ac9c';
    const rake = (x: number) => wallY - 1 - Math.round(gableH * Math.max(0, 1 - Math.abs(x + 0.5 - cx) / half));
    for (let x = Math.floor(cx - half); x < Math.ceil(cx + half); x++) {
      const ry = rake(x);
      const left = x + 0.5 < cx;
      const col = left ? x - Math.floor(cx - half) : Math.ceil(cx + half) - 1 - x;
      for (let y = yTop; y < ry + 1; y++) {
        let c: string;
        if (y >= ry - 1) c = y === ry ? trimLo : trim;
        else {
          // Tile courses run up and down; each course is offset by half a tile from the next.
          const k = Math.floor(col / 4);
          const lx = col % 4;
          const rowH = style === 'slate' ? 5 : 4;
          const ly = (y - yTop + (k & 1) * 2) % rowH;
          const r = Math.floor((y - yTop + (k & 1) * 2) / rowH);
          // Sunlit slope: light tiles with a glint on each course; shaded slope: flat and calm.
          const weathered = hash2(k, r, 57) < 0.12;
          const base = left ? (weathered ? color : hiC) : weathered ? lo2 : lo;
          if (style === 'thatch') c = hash2(x, y, 58) < 0.3 ? (left ? hi2 : color) : hash2(x, y, 59) < 0.2 ? lo2 : base;
          else if (lx === 0) c = left ? color : lo2;
          else if (ly === rowH - 1 && style !== 'shake') c = left ? color : lo2;
          else if (lx === 1 && left && ly === 0) c = hi2;
          else c = base;
          if (style === 'shake' && hash2(k, r, 60) < 0.12) c = '#6f9a48';
          // Ridge cap down the middle and the back edge of the roof.
          if (Math.abs(x + 0.5 - cx) < 1.5) c = Math.abs(x + 0.5 - cx) < 0.6 ? hi2 : left ? hiC : lo;
          if (y === yTop) c = lo3;
          if (col === 0) c = lo3;
        }
        p.set(x, y, c);
        // Winter: snow on the slopes, thinning toward the eaves.
        if (y < ry - 2 && col > 1 && hash2(x >> 1, y >> 1, 61) > col / half - 0.35) this.s.set(x, y, left ? '#f8fbff' : '#e4ecf5');
      }
    }
    // The gable wall under the rakes, shaded just under the barge boards.
    const g0 = Math.floor(cx - w / 2);
    for (let x = g0; x < g0 + w; x++)
      for (let y = rake(x) + 1; y < wallY; y++) {
        const d = y - rake(x);
        let c = wallPixel(wallStyle, wallColor, x, y, g0, wallY - gableH - 2);
        if (d <= 2) c = shade(wallColor, d === 1 ? 3 : 2);
        p.set(x, y, c);
      }
    if (attic && gableH >= 14) {
      const ay = wallY - Math.round(gableH * 0.55);
      const ax = Math.round(cx) - 3;
      p.rect(ax, ay, 6, 7, '#5a3e2c');
      p.rect(ax + 1, ay + 1, 4, 5, '#a8d8ea');
      p.rect(ax + 3, ay + 1, 1, 5, '#5a3e2c');
      p.set(ax + 1, ay + 1, '#f4fbff');
      p.set(ax, ay, shade(wallColor, 1));
      p.set(ax + 5, ay, shade(wallColor, 1));
      this.n.rect(ax + 1, ay + 1, 4, 5, '#ffe0a0');
      this.lights.push({ x: ax + 3, y: ay + 3, r: 12, color: '#ffc873' });
    }
  }

  /** A plank porch deck in front of a set-back wall, with a step down in front of the door. */
  porch(x0: number, y0: number, w: number, h: number, stepX?: number) {
    const p = this.p;
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const ly = (y - y0) % 3;
        let c = ly === 2 ? '#8a5e3c' : ly === 0 ? '#d6a46c' : '#c08c58';
        if ((x + (Math.floor((y - y0) / 3) & 1) * 7) % 14 === 0 && ly !== 2) c = '#8a5e3c';
        p.set(x, y, c);
      }
    // Shadow of the wall on the deck, and the deck's front edge.
    p.rect(x0, y0, w, 1, '#6e4a34');
    p.rect(x0, y0 + h - 1, w, 1, '#5a3a26');
    if (stepX !== undefined) {
      p.rect(stepX - 1, y0 + h - 1, 16, 1, '#d6a46c');
    }
  }

  /** A little gabled dormer window sitting on the roof. */
  dormer(x: number, y: number, roof: string) {
    const p = this.p;
    // Cheeks and window.
    p.rect(x, y + 5, 12, 8, '#efe6d6');
    p.rect(x + 11, y + 5, 1, 8, '#c8bcac');
    p.rect(x + 3, y + 7, 6, 5, '#5a3e2c');
    p.rect(x + 4, y + 8, 4, 3, '#a8d8ea');
    p.set(x + 4, y + 8, '#f4fbff');
    this.n.rect(x + 4, y + 8, 4, 3, '#ffe0a0');
    this.lights.push({ x: x + 6, y: y + 9, r: 14, color: '#ffc873' });
    // Its own little roof.
    for (let yy = 0; yy < 6; yy++) {
      const half = 2 + yy;
      for (let xx = 6 - half; xx < 6 + half; xx++) p.set(x + xx, y + yy, yy === 5 ? shade(roof, 2) : xx < 6 ? light(roof, 1) : shade(roof, 1));
    }
    this.roofs.push({ x0: x - 1, y0: y, w: 14, h: 6, inset: 5 });
  }

  wall(x0: number, y0: number, w: number, h: number, color: string, style: WallStyle, eaveShadow = true) {
    const p = this.p;
    const lo = shade(color, 1);
    const lo2 = shade(color, 2);
    const hi = light(color, 1);
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        let c = color;
        if (style === 'log') {
          // Stacked round logs: lit top, shaded underside, dark chinking between.
          const ly = (y - y0) % 6;
          c = ly === 5 ? '#4a3226' : ly === 0 ? light(color, 1) : ly >= 4 ? shade(color, 1) : color;
          if (ly > 0 && ly < 5 && hash2(x >> 2, Math.floor((y - y0) / 6), 27) < 0.12) c = shade(color, 1);
          p.set(x, y, c);
          continue;
        }
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
    if (eaveShadow)
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
    if (style === 'log') {
      // Notched log ends poking out at both corners.
      for (let yy = y0 + 3; yy < y0 + h - 4; yy += 6)
        for (const ex of [x0 - 2, x0 + w - 1]) {
          p.rect(ex, yy, 3, 4, '#c89a62');
          p.set(ex + 1, yy + 1, '#8a6a42');
          p.set(ex + 1, yy + 2, '#a8804e');
          p.rect(ex, yy + 4, 3, 1, '#5a3a26');
        }
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
    this.sills.push({ x: x - 1, y: y + h, w: w + 2 });
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
    this.sills.push({ x: x - 1, y, w: 8 });
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

  /** Builds the winter overlay: a soft blanket on each roof, snow on sills, icicles at the eaves. */
  private snowCover() {
    const s = this.s;
    const p = this.p;
    for (const r of this.roofs)
      for (let y = r.y0 - 1; y < r.y0 + r.h - 1; y++) {
        const t = (y - r.y0) / Math.max(1, r.h - 1);
        const ins = Math.round((1 - Math.max(0, t)) * r.inset);
        for (let x = r.x0 + ins; x < r.x0 + r.w - ins; x++) {
          if (!p.opaque(x, Math.max(0, y))) continue;
          // Thinner toward the eave and the right slope, with a few bare tiles showing.
          if (t > 0.75 && hash2(x, y, 41) < (t - 0.75) * 3) continue;
          if (hash2(x >> 2, y >> 1, 42) < 0.06) continue;
          const edge = x < r.x0 + ins + 1 || x >= r.x0 + r.w - ins - 1;
          s.set(x, y, edge || y === r.y0 - 1 ? '#dde6f0' : (y - r.y0) % 3 === 2 ? '#e4ecf5' : x > r.x0 + r.w - ins - 5 ? '#e8eef6' : '#f8fbff');
        }
        if (y === r.y0 + r.h - 2)
          for (let x = r.x0 + 2; x < r.x0 + r.w - 2; x += 3)
            if (hash2(x, y, 43) < 0.55) {
              const len = 1 + Math.floor(hash2(x, y, 44) * 3);
              for (let k = 0; k < len; k++) s.set(x, y + 2 + k, k === len - 1 ? '#c8e4f4' : '#eaf6fc');
            }
      }
    for (const sl of this.sills)
      for (let x = sl.x; x < sl.x + sl.w; x++) {
        s.set(x, sl.y - 1, '#f8fbff');
        if (hash2(x, sl.y, 45) < 0.5) s.set(x, sl.y - 2, '#eef4fa');
      }
  }

  done(): Pick<BuildingSprite, 'img' | 'night' | 'snow' | 'lights' | 'smoke'> {
    this.p.outline(undefined, 'noTop');
    this.snowCover();
    return { img: this.p.toCanvas(), night: this.n.toCanvas(), snow: this.s.toCanvas(), lights: this.lights, smoke: this.smoke };
  }
}

/** One pixel of wall in a given material (used where a wall isn't a plain rectangle, like a gable). */
function wallPixel(style: WallStyle, color: string, x: number, y: number, x0: number, y0: number): string {
  if (style === 'log') {
    const ly = (y - y0) % 6;
    return ly === 5 ? '#4a3226' : ly === 0 ? light(color, 1) : ly >= 4 ? shade(color, 1) : color;
  }
  if (style === 'plank') {
    // Vertical board-and-batten in a gable reads better than courses.
    const lx = (x - x0) % 5;
    return lx === 4 ? shade(color, 1) : lx === 0 ? light(color, 1) : color;
  }
  if (style === 'stone') {
    const row = Math.floor((y - y0) / 5);
    const lx = (x - x0 + (row & 1) * 4) % 8;
    const ly = (y - y0) % 5;
    return ly === 4 || lx === 0 ? shade(color, 2) : ly === 0 ? light(color, 1) : color;
  }
  if (style === 'timber') {
    // Half-timbering: a king post and diagonal braces.
    return (x - x0) % 16 === 0 || (x - x0) % 16 === 1 ? '#6e4a34' : hash2(x, y, 11) < 0.07 ? shade(color, 1) : color;
  }
  return hash2(x, y, 11) < 0.07 ? shade(color, 1) : color;
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

/**
 * The farmhouse, L-shaped: a living block with its long side to us and a porch in front of the
 * door, and a bedroom wing on the right turned gable-first, stepping out toward the yard.
 */
function house(b: Building): BuildingSprite {
  const { w, h, pt } = base(b, 38);
  const wingW = 40;
  const wingX = w - 2 - wingW;
  const porchH = 8;
  const mainBottom = h - porchH;
  const mainWallH = 30;
  const mainWallY = mainBottom - mainWallH;
  // Living block (set back behind the porch).
  pt.chimney(20, 6, 18);
  pt.roof(0, 10, wingX + 10, mainWallY - 8, '#d9735a', 'tile', 6);
  pt.wall(2, mainWallY, wingX + 4, mainWallH, '#f3e6cc', 'timber');
  const doorX = 2 + TILE * (b.door!.x - b.x) + 2;
  pt.door(doorX, mainBottom - 22, 12, 20, '#9a5a3a');
  pt.window(12, mainWallY + 9, 10, 10, '#f07aa0', '#5a8a6a');
  pt.porch(0, mainBottom, wingX + 2, porchH, doorX);
  // Porch posts carrying the eave.
  for (const px of [1, wingX - 2]) {
    pt.p.rect(px, mainWallY - 2, 3, mainWallH + porchH - 1, '#8a5a3a');
    pt.p.rect(px, mainWallY - 2, 1, mainWallH + porchH - 1, '#b07a4e');
  }
  // Bedroom wing, gable to the yard.
  const wingWallH = 30;
  const wingWallY = h - wingWallH;
  pt.gableRoof(wingX, wingW, 16, wingWallY, 20, '#d9735a', 'tile', '#f3e6cc', 'timber');
  pt.wall(wingX, wingWallY, wingW, wingWallH, '#f3e6cc', 'timber', false);
  pt.window(wingX + 13, wingWallY + 8, 14, 11, '#f5d040', '#5a8a6a');
  pt.ivy(w - 5, h - 5, 30, 7);
  pt.p.rect(wingX - 6, h - 8, 3, 5, '#8a5a3a');
  const d = pt.done();
  return { ...d, ox: -2, oy: 0 };
}

function seedShop(b: Building): BuildingSprite {
  const { w, h, pt } = base(b, 34);
  const wallH = 36;
  const wallY = h - wallH;
  pt.roof(0, 8, w, wallY - 6, '#5aa58a', 'tile', 5, true);
  pt.wall(2, wallY, w - 4, wallH, '#e8c898', 'plank');
  const doorX = 2 + TILE * (b.door!.x - b.x) + 2;
  // A cross gable over the entrance breaks up the long roof.
  pt.gableRoof(doorX - 14, 40, 12, wallY, 16, '#5aa58a', 'tile', '#e8c898', 'plank');
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
  pt.roof(28, 12, w - 28, wallY - 10, '#5a6a8a', 'slate', 6);
  pt.dormer(w - 44, 18, '#5a6a8a');
  pt.wall(30, wallY, w - 32, wallH, '#b8aa98', 'stone');
  pt.wall(30, wallY, w - 32, 16, '#8a6a4a', 'plank');
  pt.awning(34, wallY + 14, w - 40, '#e8836b', '#f7efd8');
  // The forge: a stone wing with its gable to the square and a tall chimney.
  pt.chimney(10, 0, 24);
  pt.gableRoof(2, 36, 18, wallY + 4, 20, '#5a6a8a', 'slate', '#a09488', 'stone', false);
  pt.wall(2, wallY + 4, 36, wallH - 4, '#a09488', 'stone', false);
  pt.p.rect(10, wallY + 14, 20, 16, '#3a2a28');
  pt.p.rect(11, wallY + 15, 18, 14, '#5a3a2a');
  pt.n.rect(11, wallY + 22, 18, 7, '#ff9a4a');
  pt.p.rect(11, wallY + 26, 18, 3, '#8a4a2a');
  const doorX = 2 + TILE * (b.door!.x - b.x) + 2;
  pt.door(doorX, h - 22, 12, 20, '#6e4a34', true);
  pt.window(w - 28, wallY + 24, 14, 10);
  // Forge glow in the chimney top and the open hearth.
  pt.n.rect(11, 1, 4, 2, '#ff9a4a');
  pt.lights.push({ x: 13, y: 0, r: 18, color: '#ff9a4a' });
  pt.lights.push({ x: 20, y: wallY + 24, r: 30, color: '#ff9a4a' });
  pt.sign(w - 22, 18, hammer);
  const d = pt.done();
  return { ...d, ox: -2, oy: 0 };
}

const COTTAGE_ROOFS = ['#c8604a', '#4f7ab0', '#8a6ab0', '#d89a4a', '#5a9a7a'];
const COTTAGE_WALLS = ['#f3e6cc', '#e8d8c0', '#f0e0d0', '#e0d0b0'];

/**
 * Village cottages come in three shapes so the lanes don't look stamped out: long side to the
 * street, gable end to the street, or an L with a gabled wing on one side.
 */
function cottage(b: Building): BuildingSprite {
  const { w, h, pt } = base(b, 36);
  const wallH = 30;
  const wallY = h - wallH;
  const roofC = COTTAGE_ROOFS[b.v % COTTAGE_ROOFS.length];
  const wallC = COTTAGE_WALLS[b.v % COTTAGE_WALLS.length];
  const style: WallStyle = b.v % 2 ? 'plaster' : 'timber';
  const roofStyle = b.v % 5 === 0 ? 'thatch' : 'tile';
  const doorX = 2 + TILE * (b.door!.x - b.x) + 2;
  const shutter = ['#5a8a6a', '#4f6a9a', '#a85a4a', '#7a6a9a'][b.v % 4];
  const doorC = ['#9a5a3a', '#4f6a8a', '#7a8a4a'][b.v % 3];
  const shape = b.v % 3;
  if (shape === 1) {
    // Gable end to the street, door in the gable wall.
    pt.gableRoof(2, w - 4, 4, wallY, 24, roofC, roofStyle, wallC, style);
    if (b.v % 2) pt.chimney(w - 20, 2, 12);
    pt.wall(2, wallY, w - 4, wallH, wallC, style, false);
    pt.door(doorX, h - 22, 12, 20, doorC);
    pt.window(8, wallY + 8, 10, 10, '#e8a0b8', shutter);
    pt.window(w - 20, wallY + 8, 10, 10, '#f5d040', shutter);
  } else if (shape === 2) {
    // L: a gabled wing on the far side from the door.
    const wingW = 34;
    const wingLeft = doorX > w / 2;
    const wingX = wingLeft ? 2 : w - 2 - wingW;
    const porchH = 6;
    const mainBottom = h - porchH;
    const mainY = mainBottom - wallH;
    const mx = wingLeft ? wingX + wingW - 8 : 0;
    const mw = wingLeft ? w - mx : wingX + 10;
    if (b.v % 2) pt.chimney(wingLeft ? w - 18 : 10, 6, 14);
    pt.roof(mx, 10, mw, mainY - 8, roofC, roofStyle, 5, b.v % 2 === 0);
    pt.wall(Math.max(2, mx + 2), mainY, Math.min(w - 4, mw - 4), wallH, wallC, style);
    pt.door(doorX, mainBottom - 22, 12, 20, doorC);
    pt.porch(Math.max(0, mx), mainBottom, Math.min(w, mw), porchH, doorX);
    pt.gableRoof(wingX, wingW, 14, wallY, 18, roofC, roofStyle, wallC, style, false);
    pt.wall(wingX, wallY, wingW, wallH, wallC, style, false);
    pt.window(wingX + 11, wallY + 8, 12, 10, '#e8a0b8', undefined);
  } else {
    // Long side to the street.
    if (b.v % 2) pt.chimney(12, 6, 16);
    pt.roof(0, 10, w, wallY - 8, roofC, roofStyle, 5, b.v % 2 === 0);
    pt.wall(2, wallY, w - 4, wallH, wallC, style);
    pt.door(doorX, h - 22, 12, 20, doorC);
    pt.window(9, wallY + 9, 10, 10, '#e8a0b8', shutter);
    pt.window(w - 21, wallY + 9, 10, 10, '#f5d040', shutter);
    if (b.v % 2 === 1) pt.ivy(4, h - 5, 22, b.v);
  }
  const d = pt.done();
  return { ...d, ox: -2, oy: 0 };
}

/** The miner's log cabin by the quarry: round-log walls, shake roof, stone chimney. */
function cabin(b: Building): BuildingSprite {
  const { w, h, pt } = base(b, 32);
  const wallH = 30;
  const wallY = h - wallH;
  // Fieldstone chimney up the side.
  const p = pt.p;
  for (let y = 4; y < h - 2; y++)
    for (let x = w - 14; x < w - 7; x++) {
      const row = Math.floor(y / 4);
      const edge = y % 4 === 0 || (x + (row & 1) * 2) % 4 === 0;
      p.set(x, y, edge ? '#5e5650' : hash2(Math.floor((x + (row & 1) * 2) / 4), row, 5) < 0.5 ? '#a09890' : '#8a8078');
    }
  pt.smoke.push({ x: w - 10, y: 3 });
  // Gable end forward, like a trapper's cabin.
  pt.gableRoof(3, w - 6, 8, wallY, 22, '#8a6040', 'shake', '#a8784a', 'log');
  pt.wall(3, wallY, w - 6, wallH, '#a8784a', 'log', false);
  const doorX = 3 + TILE * (b.door!.x - b.x) + 1;
  pt.door(doorX, h - 22, 12, 20, '#6e4a34');
  pt.window(9, wallY + 9, 10, 9, undefined, '#5a7a4a');
  // Lantern by the door and an axe in a stump.
  p.rect(doorX + 14, wallY + 8, 3, 4, '#ffd870');
  p.rect(doorX + 14, wallY + 7, 3, 1, '#3a3a4a');
  pt.lights.push({ x: doorX + 15, y: wallY + 10, r: 22, color: '#ffc873' });
  const d = pt.done();
  return { ...d, ox: -2, oy: 0 };
}

function harborOffice(b: Building): BuildingSprite {
  const { w, h, pt } = base(b, 30);
  const wallH = 32;
  const wallY = h - wallH;
  pt.gableRoof(2, w - 4, 6, wallY, 22, '#3f6a9a', 'slate', '#9ac0c8', 'plank', false);
  pt.wall(2, wallY, w - 4, wallH, '#9ac0c8', 'plank', false);
  const doorX = 2 + TILE * (b.door!.x - b.x) + 2;
  pt.door(doorX, h - 22, 12, 20, '#2f4a6a');
  pt.window(8, wallY + 9, 10, 10);
  // Life ring.
  pt.p.ellipse(w - 14, wallY + 14, 5, 5, '#f4f0e8');
  pt.p.ellipse(w - 14, wallY + 14, 2, 2, '#9ac0c8');
  pt.p.rect(w - 19, wallY + 13, 2, 3, '#e8503a');
  pt.p.rect(w - 11, wallY + 13, 2, 3, '#e8503a');
  pt.sign(Math.round(w / 2) - 8, wallY - 18, anchor);
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
    case 'cabin':
      return cabin(b);
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
