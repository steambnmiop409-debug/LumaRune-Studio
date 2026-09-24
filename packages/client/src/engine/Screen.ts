/** Logical resolution the game is designed for. The view grows in whole logical pixels to fill the window. */
export const BASE_W = 640;
export const BASE_H = 360;

/**
 * Owns the low-resolution back buffer and scales it by an integer factor onto the visible canvas,
 * so every art pixel is an exact N×N block on screen (no mixels, no blur).
 */
export class Screen {
  readonly canvas: HTMLCanvasElement;
  readonly buffer: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private out: CanvasRenderingContext2D;
  width = BASE_W;
  height = BASE_H;
  scale = 1;
  dpr = 1;
  /** Player's zoom choice: 0 = automatic, otherwise a whole-number pixel scale. */
  forcedScale = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    try {
      this.forcedScale = Number(localStorage.getItem('lumina:zoom')) || 0;
    } catch {
      /* storage unavailable */
    }
    this.out = canvas.getContext('2d', { alpha: false })!;
    this.buffer = document.createElement('canvas');
    this.ctx = this.buffer.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    // The exact device-pixel size of the canvas box (handles 125%/150% OS scaling without resampling).
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver((entries) => {
        const box = entries[0].devicePixelContentBoxSize?.[0];
        if (box) this.resize(box.inlineSize, box.blockSize);
      });
      try {
        ro.observe(canvas, { box: 'device-pixel-content-box' });
      } catch {
        ro.observe(canvas);
      }
    }
  }

  private devSize: [number, number] | null = null;

  resize(devW?: number, devH?: number): void {
    this.dpr = window.devicePixelRatio || 1;
    if (devW && devH) this.devSize = [devW, devH];
    else if (this.devSize && Math.abs(this.devSize[0] - window.innerWidth * this.dpr) < 2) [devW, devH] = this.devSize;
    else {
      devW = Math.round(window.innerWidth * this.dpr);
      devH = Math.round(window.innerHeight * this.dpr);
    }
    // The biggest whole-number scale that still shows the full 640×360 design view…
    const fit = Math.max(1, Math.floor(Math.min(devW / BASE_W, devH / BASE_H)));
    // …but by default aim for a view about 440 pixels tall, so a 720p window and a 1080p full screen
    // keep the same pixel size (going full screen shows more of the island instead of zooming in).
    const auto = Math.max(1, Math.min(fit, Math.round(devH / 440)));
    this.scale = this.forcedScale > 0 ? Math.min(fit, this.forcedScale) : auto;
    // Only touch the canvases when something changed (resizing clears them).
    const w = Math.ceil(devW / this.scale);
    const h = Math.ceil(devH / this.scale);
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
    this.ctx.imageSmoothingEnabled = false;
    this.out.imageSmoothingEnabled = false;
  }

  /** Largest zoom the current window allows. */
  get maxScale(): number {
    const [w, h] = this.devSize ?? [Math.round(window.innerWidth * this.dpr), Math.round(window.innerHeight * this.dpr)];
    return Math.max(1, Math.floor(Math.min(w / BASE_W, h / BASE_H)));
  }

  /** Sets the zoom (0 = automatic) and remembers it. */
  setZoom(scale: number): void {
    this.forcedScale = scale;
    try {
      localStorage.setItem('lumina:zoom', String(scale));
    } catch {
      /* ignore */
    }
    this.resize();
  }

  toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }

  present(): void {
    this.out.drawImage(this.buffer, 0, 0, this.width * this.scale, this.height * this.scale);
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
