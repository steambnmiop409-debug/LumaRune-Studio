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

export interface Light {
  x: number;
  y: number;
  r: number;
  color: string;
  /** 0..1 multiplier. */
  a?: number;
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

/**
 * Multiplicative light map: ambient colour everywhere, brightened around light sources.
 * Composited over the scene with `multiply`, then a faint additive glow gives a bloom feel.
 */
export class Lighting {
  private map: HTMLCanvasElement;
  private mctx: CanvasRenderingContext2D;
  private spriteCache = new Map<string, HTMLCanvasElement>();

  constructor() {
    this.map = document.createElement('canvas');
    this.mctx = this.map.getContext('2d')!;
  }

  private lightSprite(r: number, color: string, soft: boolean): HTMLCanvasElement {
    const key = `${r}|${color}|${soft}`;
    let c = this.spriteCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = r * 2;
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(r, r, 0, r, r, r);
      const [cr, cg, cb] = hexToRgb(color);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${soft ? 0.55 : 1})`);
      g.addColorStop(0.35, `rgba(${cr},${cg},${cb},${soft ? 0.25 : 0.6})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, r * 2, r * 2);
      this.spriteCache.set(key, c);
    }
    return c;
  }

  apply(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    ambient: string,
    dark: number,
    lights: Light[],
    beams: Array<{ x: number; y: number; angle: number; len: number; spread: number }>,
  ): void {
    if (this.map.width !== w || this.map.height !== h) {
      this.map.width = w;
      this.map.height = h;
    }
    const m = this.mctx;
    m.globalCompositeOperation = 'source-over';
    m.fillStyle = ambient;
    m.fillRect(0, 0, w, h);
    if (dark > 0.02) {
      m.globalCompositeOperation = 'lighter';
      for (const l of lights) {
        m.globalAlpha = dark * (l.a ?? 1);
        const r = Math.round(l.r);
        m.drawImage(this.lightSprite(r, l.color, false), Math.round(l.x - r), Math.round(l.y - r));
      }
      for (const b of beams) {
        m.globalAlpha = dark * 0.55;
        drawBeam(m, b.x, b.y, b.angle, b.len, b.spread, '#fff2c8');
      }
      m.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.map, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    if (dark > 0.02) {
      for (const l of lights) {
        ctx.globalAlpha = dark * 0.22 * (l.a ?? 1);
        const r = Math.round(l.r * 0.6);
        ctx.drawImage(this.lightSprite(r, l.color, true), Math.round(l.x - r), Math.round(l.y - r));
      }
      for (const b of beams) {
        ctx.globalAlpha = dark * 0.18;
        drawBeam(ctx, b.x, b.y, b.angle, b.len, b.spread, '#fff2c8');
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
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
