import { settings } from '../settings';

/** Logical resolution the game is designed for (16:9; scales to 720p, 1080p, 1440p and 4K exactly). */
export const BASE_W = 640;
export const BASE_H = 360;

/**
 * Owns the low-resolution back buffer and puts it on the visible canvas.
 *
 * The view always keeps the same proportions: the 640×360 design view is fitted to the window
 * and any extra width or height shows a little more of the island, so resizing the window or going
 * full screen changes how big things are smoothly, never how the scene is framed. At 720p, 1080p,
 * 1440p and 4K the scale is a whole number and every art pixel is an exact block. In between, the
 * frame is first blown up by the next whole number (nearest neighbour) and then eased down to size
 * ("sharp bilinear"), so pixels stay square and even instead of some being a device pixel wider.
 * Players who want whole-number scaling only can turn on pixel-perfect mode.
 *
 * Resizes are applied at the start of the next frame, right before it's drawn, so the canvas is
 * never shown cleared (that was the flicker while dragging the window edge).
 */
export class Screen {
  readonly canvas: HTMLCanvasElement;
  readonly buffer: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private out: CanvasRenderingContext2D;
  /** Logical (art-pixel) size of the view. */
  width = BASE_W;
  height = BASE_H;
  /** Device pixels per art pixel (may be fractional). */
  scale = 1;
  dpr = 1;
  private dev: [number, number] = [0, 0];
  private pending: [number, number] | null = null;
  private exact = false;
  private up: HTMLCanvasElement | null = null;
  private dirty = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.out = canvas.getContext('2d', { alpha: false })!;
    this.buffer = document.createElement('canvas');
    this.ctx = this.buffer.getContext('2d')!;
    this.pending = this.windowSize();
    this.beginFrame();
    window.addEventListener('resize', () => {
      if (!this.exact) this.pending = this.windowSize();
    });
    // The exact device-pixel size of the canvas box (handles 125%/150% OS scaling without resampling).
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver((entries) => {
        const box = entries[0].devicePixelContentBoxSize?.[0];
        if (box) {
          this.exact = true;
          this.pending = [box.inlineSize, box.blockSize];
        } else this.pending = this.windowSize();
      });
      try {
        ro.observe(canvas, { box: 'device-pixel-content-box' });
      } catch {
        ro.observe(canvas);
      }
    }
  }

  private windowSize(): [number, number] {
    this.dpr = window.devicePixelRatio || 1;
    return [Math.round(window.innerWidth * this.dpr), Math.round(window.innerHeight * this.dpr)];
  }

  /** Re-fit after a settings change (view size, pixel-perfect). */
  refresh(): void {
    this.dirty = true;
  }

  /** Applies a pending resize. Called by the game loop at the start of every frame. */
  beginFrame(): void {
    const p = this.pending;
    if (p && (p[0] !== this.dev[0] || p[1] !== this.dev[1])) {
      this.dev = [Math.max(1, p[0]), Math.max(1, p[1])];
      this.dirty = true;
    }
    this.pending = null;
    if (!this.dirty) return;
    this.dirty = false;
    const [devW, devH] = this.dev;
    let k = Math.min(devW / BASE_W, devH / BASE_H) * settings.viewScale;
    if (settings.pixelPerfect) k = Math.max(1, Math.floor(k + 1e-6));
    k = Math.max(0.5, k);
    // Snap scales within a hair of a whole number, so 1080p is exactly 3×.
    if (Math.abs(k - Math.round(k)) < 0.004) k = Math.round(k);
    this.scale = k;
    const w = Math.ceil(devW / k - 1e-6);
    const h = Math.ceil(devH / k - 1e-6);
    if (this.canvas.width !== devW || this.canvas.height !== devH) {
      this.canvas.width = devW;
      this.canvas.height = devH;
    }
    this.width = w;
    this.height = h;
    if (this.buffer.width !== w || this.buffer.height !== h) {
      this.buffer.width = w;
      this.buffer.height = h;
    }
    const m = Math.ceil(k);
    if (m !== k) {
      this.up ??= document.createElement('canvas');
      if (this.up.width !== w * m || this.up.height !== h * m) {
        this.up.width = w * m;
        this.up.height = h * m;
      }
    } else this.up = null;
    this.ctx.imageSmoothingEnabled = false;
    this.out.imageSmoothingEnabled = false;
  }

  toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }

  present(): void {
    const k = this.scale;
    if (!this.up) {
      this.out.imageSmoothingEnabled = false;
      this.out.drawImage(this.buffer, 0, 0, this.width * k, this.height * k);
      return;
    }
    const m = this.up.width / this.width;
    const u = this.up.getContext('2d')!;
    u.imageSmoothingEnabled = false;
    u.drawImage(this.buffer, 0, 0, this.width * m, this.height * m);
    this.out.imageSmoothingEnabled = true;
    this.out.imageSmoothingQuality = 'low';
    this.out.drawImage(this.up, 0, 0, this.width * k, this.height * k);
  }

  /** Converts a DOM client coordinate into logical pixels. */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const kx = this.canvas.width / (r.width || 1);
    const ky = this.canvas.height / (r.height || 1);
    return {
      x: Math.floor(((clientX - r.left) * kx) / this.scale),
      y: Math.floor(((clientY - r.top) * ky) / this.scale),
    };
  }
}
