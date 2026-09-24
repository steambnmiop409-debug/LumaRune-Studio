import type { WeatherKind } from '@lumina/core';
import { hexToRgb, mix } from '../art/palette';

const KEYS: Array<[number, string]> = [
  [0, '#3a4278'],
  [290, '#39406e'],
  [330, '#7a6aa6'],
  [360, '#d8aab4'],
  [410, '#f6dcd0'],
  [460, '#fdf0e4'],
  [540, '#ffffff'],
  [960, '#fffaf0'],
  [1010, '#ffe6b8'],
  [1090, '#f5a888'],
  [1150, '#b884a8'],
  [1220, '#6a6aa0'],
  [1290, '#4a5288'],
  [1440, '#3d4580'],
  [1560, '#353c70'],
];

const WEATHER_TINT: Record<WeatherKind, [string, number]> = {
  clear: ['#ffffff', 0],
  cloudy: ['#c4c8d6', 0.3],
  rain: ['#98a2bc', 0.48],
  storm: ['#7c84a0', 0.6],
  fog: ['#d4d8e2', 0.3],
  snow: ['#e4ecfa', 0.2],
};

/** How much direct light gets through: shadows are crisp in sun, gone under heavy cloud. */
const SUN_THROUGH: Record<WeatherKind, number> = { clear: 1, cloudy: 0.4, rain: 0.08, storm: 0, fog: 0.12, snow: 0.45 };

export interface Light {
  x: number;
  y: number;
  r: number;
  color: string;
  /** 0..1 multiplier. */
  a?: number;
}

export interface Beam {
  x: number;
  y: number;
  angle: number;
  len: number;
  spread: number;
}

/** Where the sun (or moon) is and what kind of shadows it casts. */
export interface Sun {
  /** Shadow offset per pixel of height: x (towards the side away from the sun) and y (flattened onto the ground). */
  dx: number;
  dy: number;
  /** Shadow strength 0..1 (0 = no cast shadows). */
  k: number;
  /** Golden-hour warmth 0..1. */
  warm: number;
  /** 0 = sun on the horizon, 1 = overhead. */
  elev: number;
  /** Shadow tint (multiplied onto the ground). */
  tint: string;
  /** True when the moon is the light source. */
  moon: boolean;
}

const SUNRISE = 345;
const SUNSET = 1150;

/**
 * The sun rises in the east (right of the screen), arcs overhead and sets in the west, so
 * shadows swing from long-left in the morning, short at noon, to long-right at dusk.
 * After dark a pale moon takes over with faint bluish shadows.
 */
export function sunAt(minute: number, weather: WeatherKind): Sun {
  const m = ((minute % 1440) + 1440) % 1440;
  const through = SUN_THROUGH[weather];
  if (m >= SUNRISE && m <= SUNSET) {
    const t = (m - SUNRISE) / (SUNSET - SUNRISE);
    const az = Math.cos(Math.PI * t);
    const elev = Math.sin(Math.PI * t);
    // Fade in/out right at the horizon so shadows never pop.
    const edge = Math.min(1, elev / 0.18);
    const len = 0.22 + 0.95 * (1 - elev) ** 1.6;
    const warm = Math.max(0, 1 - elev / 0.42) * through;
    return {
      dx: -az * len,
      dy: 0.26 + 0.2 * (1 - elev),
      k: 0.34 * edge * through,
      warm,
      elev,
      tint: mix('#3a4a8a', '#6a3a70', warm),
      moon: false,
    };
  }
  // Night: the moon crosses the sky between sunset and sunrise.
  const span = 1440 - SUNSET + SUNRISE;
  const t = (m > SUNSET ? m - SUNSET : m + 1440 - SUNSET) / span;
  const az = Math.cos(Math.PI * t);
  const elev = Math.sin(Math.PI * t);
  const edge = Math.max(0, Math.min(1, (elev - 0.15) / 0.3));
  return { dx: -az * (0.3 + 0.6 * (1 - elev)), dy: 0.3, k: 0.14 * edge * (weather === 'clear' ? 1 : weather === 'snow' ? 0.4 : 0), warm: 0, elev, tint: '#101838', moon: true };
}

/** Ambient colour for a time of day (minutes) and weather. */
export function ambientColor(minute: number, weather: WeatherKind): string {
  let c = KEYS[KEYS.length - 1][1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [m0, c0] = KEYS[i];
    const [m1, c1] = KEYS[i + 1];
    if (minute >= m0 && minute <= m1) {
      c = mix(c0, c1, (minute - m0) / (m1 - m0));
      break;
    }
  }
  const [tint, amount] = WEATHER_TINT[weather];
  return amount ? mix(c, tint === '#ffffff' ? c : mixMul(c, tint), amount) : c;
}

function mixMul(a: string, b: string): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return `#${[0, 1, 2].map((i) => Math.round((x[i] * y[i]) / 255).toString(16).padStart(2, '0')).join('')}`;
}

/** 0 (bright day) .. 1 (deep night). */
export function darkness(ambient: string): number {
  const [r, g, b] = hexToRgb(ambient);
  const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
  return Math.max(0, Math.min(1, (0.86 - lum) / 0.5));
}

function canvas(w = 1, h = 1): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Cast shadows: every tall thing is drawn as a flat silhouette, sheared along the sun direction
 * and squashed onto the ground, into one layer that is then multiplied over the terrain at once
 * (so overlapping shadows never double up).
 */
export class ShadowLayer {
  private layer = canvas();
  private lctx = this.layer.getContext('2d')!;
  private silhouettes = new WeakMap<CanvasImageSource, HTMLCanvasElement>();
  private sun: Sun | null = null;
  private tint = '#000000';
  private any = false;

  begin(w: number, h: number, sun: Sun): void {
    if (this.layer.width !== w || this.layer.height !== h) {
      this.layer.width = w;
      this.layer.height = h;
    }
    this.lctx.setTransform(1, 0, 0, 1, 0, 0);
    this.lctx.clearRect(0, 0, w, h);
    this.lctx.imageSmoothingEnabled = false;
    this.sun = sun.k > 0.01 ? sun : null;
    this.tint = sun.tint;
    this.any = false;
  }

  get active(): boolean {
    return this.sun !== null;
  }

  private silhouette(img: HTMLCanvasElement): HTMLCanvasElement {
    let s = this.silhouettes.get(img);
    if (!s) {
      s = canvas(img.width, img.height);
      const c = s.getContext('2d')!;
      c.drawImage(img, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, s.width, s.height);
      this.silhouettes.set(img, s);
    }
    return s;
  }

  /**
   * Casts the shadow of a sprite drawn at screen (x, y) whose foot line is at screen row `baseY`.
   * `scale` shortens the shadow of things that are lower than their sprite suggests.
   */
  cast(img: HTMLCanvasElement, x: number, y: number, baseY: number, scale = 1): void {
    const sun = this.sun;
    if (!sun || !img.width) return;
    const sdx = sun.dx * scale;
    const sdy = sun.dy * scale;
    const h0 = baseY - y;
    this.lctx.setTransform(1, 0, -sdx, -sdy, Math.round(x + sdx * h0), Math.round(baseY + sdy * h0));
    this.lctx.drawImage(this.silhouette(img), 0, 0);
    this.any = true;
  }

  /** Multiplies the finished layer onto the scene. */
  composite(ctx: CanvasRenderingContext2D): void {
    if (!this.sun || !this.any) return;
    const l = this.lctx;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'source-in';
    l.fillStyle = this.tint;
    l.fillRect(0, 0, this.layer.width, this.layer.height);
    l.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = this.sun.k * (this.sun.moon ? 1.6 : 1.7);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.layer, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}

/** 4×4 ordered-dither thresholds. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
/** Light-map cell size in screen pixels: lights are resolved on this grid, so glows read as pixel art. */
const CELL = 2;
/** Brightness steps per channel in a light's falloff. */
const LEVELS = 8;

/**
 * Multiplicative light map on a coarse grid. Ambient colour everywhere; light sources are summed
 * on a grid of 2×2-pixel cells, stepped into a few bands with ordered dithering (so a lamp's glow
 * falls off in crisp pixel rings rather than a smooth airbrush), then multiplied over the scene.
 * The same stepped light is added back faintly for a pixel bloom.
 */
export class Lighting {
  private map = canvas();
  private mctx = this.map.getContext('2d')!;
  private glow = canvas();
  private gctx = this.glow.getContext('2d', { willReadFrequently: true })!;
  private spriteCache = new Map<string, HTMLCanvasElement>();
  private vignette: HTMLCanvasElement | null = null;

  private lightSprite(r: number, color: string): HTMLCanvasElement {
    const key = `${r}|${color}`;
    let c = this.spriteCache.get(key);
    if (!c) {
      c = canvas(r * 2, r * 2);
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(r, r, 0, r, r, r);
      const [cr, cg, cb] = hexToRgb(color);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
      g.addColorStop(0.3, `rgba(${cr},${cg},${cb},0.62)`);
      g.addColorStop(0.65, `rgba(${cr},${cg},${cb},0.2)`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, r * 2, r * 2);
      this.spriteCache.set(key, c);
    }
    return c;
  }

  apply(ctx: CanvasRenderingContext2D, w: number, h: number, ambient: string, dark: number, lights: Light[], beams: Beam[]): void {
    const gw = Math.ceil(w / CELL);
    const gh = Math.ceil(h / CELL);
    if (this.map.width !== gw || this.map.height !== gh) {
      this.map.width = this.glow.width = gw;
      this.map.height = this.glow.height = gh;
    }
    const m = this.mctx;
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'source-over';
    m.fillStyle = ambient;
    m.fillRect(0, 0, gw, gh);
    const hasLights = dark > 0.02 && (lights.length > 0 || beams.length > 0);
    if (hasLights) {
      // 1. Sum the lights on the grid.
      const g = this.gctx;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#000000';
      g.fillRect(0, 0, gw, gh);
      g.setTransform(1 / CELL, 0, 0, 1 / CELL, 0, 0);
      g.globalCompositeOperation = 'lighter';
      for (const l of lights) {
        const r = Math.max(2, Math.round(l.r));
        if (l.x + r < 0 || l.y + r < 0 || l.x - r > w || l.y - r > h) continue;
        g.globalAlpha = Math.min(1, dark * 1.15) * (l.a ?? 1);
        g.drawImage(this.lightSprite(r, l.color), Math.round(l.x - r), Math.round(l.y - r));
      }
      for (const b of beams) {
        g.globalAlpha = dark * 0.5;
        drawBeam(g, b.x, b.y, b.angle, b.len, b.spread, '#fff2c8');
      }
      g.globalAlpha = 1;
      // 2. Step each channel into bands with ordered dithering.
      const img = g.getImageData(0, 0, gw, gh);
      const d = img.data;
      for (let y = 0; y < gh; y++) {
        const row = (y & 3) << 2;
        for (let x = 0; x < gw; x++) {
          const i = (y * gw + x) << 2;
          if (d[i] + d[i + 1] + d[i + 2] === 0) continue;
          const th = BAYER[row | (x & 3)];
          for (let c = 0; c < 3; c++) {
            const v = (d[i + c] / 255) * LEVELS;
            const base = Math.floor(v);
            d[i + c] = Math.min(255, Math.round(((base + (v - base > th ? 1 : 0)) / LEVELS) * 255));
          }
        }
      }
      g.putImageData(img, 0, 0);
      m.globalCompositeOperation = 'lighter';
      m.drawImage(this.glow, 0, 0);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.map, 0, 0, gw * CELL, gh * CELL);
    if (hasLights) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = dark * 0.2;
      ctx.drawImage(this.glow, 0, 0, gw * CELL, gh * CELL);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Time-of-day colour grading on top of the lit scene: a warm golden hour, washed-out,
   * cooler nights and a soft vignette that deepens after dark.
   */
  grade(ctx: CanvasRenderingContext2D, w: number, h: number, sun: Sun, dark: number, weather: WeatherKind): void {
    if (sun.warm > 0.02) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = sun.warm * 0.42;
      ctx.fillStyle = '#ff9448';
      ctx.fillRect(0, 0, w, h);
    }
    if (!sun.moon && sun.elev > 0.5 && weather === 'clear') {
      // Crisp midday: a touch more contrast and colour.
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = (sun.elev - 0.5) * 0.18;
      ctx.fillStyle = '#fff6e0';
      ctx.fillRect(0, 0, w, h);
    }
    if (dark > 0.05) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = dark * 0.3;
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
    }
    if (!this.vignette || this.vignette.width !== w || this.vignette.height !== h) {
      this.vignette = canvas(w, h);
      const c = this.vignette.getContext('2d')!;
      const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.56);
      g.addColorStop(0, 'rgba(24,26,60,0)');
      g.addColorStop(1, 'rgba(24,26,60,1)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.1 + dark * 0.32;
    ctx.drawImage(this.vignette, 0, 0);
    ctx.globalAlpha = 1;
  }
}

function drawBeam(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, len: number, spread: number, color: string) {
  const [r, g, b] = hexToRgb(color);
  const grad = ctx.createLinearGradient(x, y, x + Math.cos(angle) * len, y + Math.sin(angle) * len * 0.55);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x, y);
  // Flatten vertically: the beam sweeps across a sea seen from above at an angle.
  ctx.lineTo(x + Math.cos(angle - spread) * len, y + Math.sin(angle - spread) * len * 0.55);
  ctx.lineTo(x + Math.cos(angle + spread) * len, y + Math.sin(angle + spread) * len * 0.55);
  ctx.closePath();
  ctx.fill();
}
