import { pack, shade, rgbToHex, unpack } from './palette';

/**
 * A tiny software pixel canvas. Sprites are generated pixel-by-pixel here,
 * then turned into an HTMLCanvasElement once and cached.
 */
export class Pix {
  readonly data: Uint32Array;
  private img: ImageData;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.img = new ImageData(w, h);
    this.data = new Uint32Array(this.img.data.buffer);
  }

  set(x: number, y: number, c: string | number): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = typeof c === 'number' ? c : pack(c);
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }

  opaque(x: number, y: number): boolean {
    return this.get(x, y) >>> 24 > 0;
  }

  rect(x: number, y: number, w: number, h: number, c: string | number): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string | number): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Filled ellipse; `shadeFn` can pick a colour per pixel from the normalized offset. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string | number | ((nx: number, ny: number) => string | number | null)): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) {
          const col = typeof c === 'function' ? c(nx, ny) : c;
          if (col !== null) this.set(x, y, col);
        }
      }
    }
  }

  /** Draws a 1px outline around opaque pixels, using a darker hue-shifted version of each neighbour. */
  outline(color?: string, sides: 'all' | 'noTop' = 'all'): void {
    const src = this.data.slice();
    const w = this.w;
    const h = this.h;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[y * w + x]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (at(x, y) >>> 24) continue;
        const nb = [at(x, y + 1), at(x - 1, y), at(x + 1, y), sides === 'all' ? at(x, y - 1) : 0].find((c) => c >>> 24);
        if (!nb) continue;
        this.data[y * w + x] = pack(color ?? shade(rgbToHex(unpack(nb)), 4));
      }
    }
  }

  /** Paints a string template: each char maps to a colour (space / '.' = transparent). */
  template(rows: readonly string[], map: Record<string, string | undefined>, ox = 0, oy = 0, flip = false): void {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === ' ' || ch === '.') continue;
        const c = map[ch];
        if (!c) continue;
        this.set(ox + (flip ? row.length - 1 - x : x), oy + y, c);
      }
    }
  }

  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    c.getContext('2d')!.putImageData(this.img, 0, 0);
    return c;
  }
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

/** 4×4 Bayer matrix for ordered dithering (values 0..15). */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer(x: number, y: number): number {
  return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}
