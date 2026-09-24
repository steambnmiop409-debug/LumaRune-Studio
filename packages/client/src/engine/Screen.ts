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
  forcedScale = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.out = canvas.getContext('2d', { alpha: false })!;
    this.buffer = document.createElement('canvas');
    this.ctx = this.buffer.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    const devW = Math.floor(window.innerWidth * this.dpr);
    const devH = Math.floor(window.innerHeight * this.dpr);
    const auto = Math.max(1, Math.floor(Math.min(devW / BASE_W, devH / BASE_H)));
    this.scale = this.forcedScale > 0 ? Math.min(auto, this.forcedScale) : auto;
    this.canvas.width = devW;
    this.canvas.height = devH;
    this.width = Math.ceil(devW / this.scale);
    this.height = Math.ceil(devH / this.scale);
    this.buffer.width = this.width;
    this.buffer.height = this.height;
    this.ctx.imageSmoothingEnabled = false;
    this.out.imageSmoothingEnabled = false;
  }

  present(): void {
    this.out.drawImage(this.buffer, 0, 0, this.width * this.scale, this.height * this.scale);
  }

  /** Converts a DOM client coordinate into logical pixels. */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    return {
      x: Math.floor((clientX * this.dpr) / this.scale),
      y: Math.floor((clientY * this.dpr) / this.scale),
    };
  }
}
