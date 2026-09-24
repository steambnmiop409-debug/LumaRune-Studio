import { settings } from '../settings';
import { hash2, type DayWeather } from '@lumina/core';

interface Drop {
  x: number;
  y: number;
  z: number;
  s: number;
}

/**
 * Screen-space weather: rain streaks and splashes, snow, drifting fog banks,
 * lightning, plus world-space cloud shadows gliding over the island.
 */
export class WeatherFx {
  private drops: Drop[] = [];
  private flakes: Drop[] = [];
  private flash = 0;
  private nextBolt = 4;
  private fog: HTMLCanvasElement;
  private cloud: HTMLCanvasElement;
  onThunder: ((delay: number) => void) | null = null;
  private t = 0;

  constructor() {
    for (let i = 0; i < 420; i++) this.drops.push({ x: Math.random(), y: Math.random(), z: Math.random(), s: 0.7 + Math.random() * 0.6 });
    for (let i = 0; i < 260; i++) this.flakes.push({ x: Math.random(), y: Math.random(), z: Math.random(), s: 0.5 + Math.random() });
    this.fog = makeFog();
    this.cloud = makeCloud();
  }

  update(dt: number, w: DayWeather, raining: boolean): void {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 2.5);
    if (w.kind === 'storm' && raining) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.flash = settings.flashes ? 1 : 0.12;
        this.nextBolt = 5 + Math.random() * 12;
        this.onThunder?.(0.4 + Math.random() * 1.5);
      }
    }
  }

  /** Cloud shadows in world space (drawn before lighting). */
  drawCloudShadows(ctx: CanvasRenderingContext2D, camX: number, camY: number, vw: number, vh: number, w: DayWeather, worldW: number, worldH: number): void {
    const amount = w.kind === 'clear' ? 0.09 : w.kind === 'cloudy' ? 0.16 : w.kind === 'fog' ? 0 : 0.12;
    if (!amount) return;
    ctx.globalAlpha = amount;
    const speed = 6 + w.wind * 20;
    for (let i = 0; i < 26; i++) {
      const bx = hash2(i, 1, 99) * worldW;
      const by = hash2(i, 2, 99) * worldH;
      const x = ((bx + this.t * speed) % (worldW + 400)) - 200;
      const y = by + Math.sin(this.t * 0.02 + i) * 20;
      const sx = x - camX;
      const sy = y - camY;
      if (sx > vw || sy > vh || sx + this.cloud.width < 0 || sy + this.cloud.height < 0) continue;
      ctx.drawImage(this.cloud, Math.round(sx), Math.round(sy));
    }
    ctx.globalAlpha = 1;
  }

  /** Precipitation & fog in screen space (drawn after lighting so it stays visible at night). */
  draw(ctx: CanvasRenderingContext2D, vw: number, vh: number, w: DayWeather, raining: boolean, dark: number, camX: number, camY: number): void {
    const wind = w.wind;
    if (raining && (w.kind === 'rain' || w.kind === 'storm')) {
      const n = w.kind === 'storm' ? 420 : 240;
      const slant = 0.25 + wind * 0.6;
      ctx.fillStyle = dark > 0.5 ? 'rgba(170,190,230,0.45)' : 'rgba(200,215,240,0.55)';
      for (let i = 0; i < n; i++) {
        const d = this.drops[i];
        const fall = (this.t * (260 + d.z * 160) * d.s) / vh;
        const y = ((d.y + fall) % 1) * (vh + 30) - 15;
        const x = (((d.x + fall * slant * (vh / vw)) % 1) + 1) % 1 * (vw + 40) - 20 - ((camX * (0.5 + d.z * 0.5)) % 40);
        const len = 3 + Math.round(d.z * 4);
        for (let k = 0; k < len; k++) ctx.fillRect(Math.round(x - k * slant), Math.round(y - k), 1, 1);
      }
      // Splashes on the ground.
      ctx.fillStyle = 'rgba(210,225,245,0.7)';
      const cell = Math.floor(this.t * 12);
      for (let i = 0; i < (w.kind === 'storm' ? 60 : 32); i++) {
        const sx = Math.floor(hash2(i, cell, 3) * vw);
        const sy = Math.floor(hash2(i, cell, 4) * vh);
        ctx.fillRect(sx - 1, sy, 1, 1);
        ctx.fillRect(sx + 1, sy, 1, 1);
        ctx.fillRect(sx, sy - 1, 1, 1);
      }
    }
    if (raining && w.kind === 'snow') {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 220; i++) {
        const f = this.flakes[i];
        const fall = (this.t * (18 + f.z * 26)) / vh;
        const y = ((f.y + fall) % 1) * (vh + 10) - 5 - ((camY * 0.2) % 10);
        const x = ((((f.x + Math.sin(this.t * 0.8 + i) * 0.01 + fall * wind * 0.4 - camX / vw / 3) % 1) + 1) % 1) * vw;
        ctx.globalAlpha = 0.6 + f.z * 0.4;
        const s = f.z > 0.7 ? 2 : 1;
        ctx.fillRect(Math.round(x), Math.round(y), s, s);
      }
      ctx.globalAlpha = 1;
    }
    if (w.kind === 'fog') {
      ctx.globalAlpha = 0.32;
      const fw = this.fog.width;
      const fh = this.fog.height;
      for (let layer = 0; layer < 2; layer++) {
        const ox = -(((camX * (0.6 + layer * 0.3) + this.t * (6 + layer * 5)) % fw) + fw) % fw;
        const oy = -(((camY * (0.6 + layer * 0.3)) % fh) + fh) % fh;
        for (let y = oy; y < vh; y += fh) for (let x = ox; x < vw; x += fw) ctx.drawImage(this.fog, Math.round(x), Math.round(y));
      }
      ctx.globalAlpha = 1;
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(235,240,255,${this.flash * 0.55})`;
      ctx.fillRect(0, 0, vw, vh);
    }
  }
}

function makeFog(): HTMLCanvasElement {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      // Tileable blobby noise from a few sine waves.
      const v =
        Math.sin((x / S) * Math.PI * 2 * 2 + Math.sin((y / S) * Math.PI * 2) * 1.5) * 0.5 +
        Math.sin((y / S) * Math.PI * 2 * 3 + Math.cos((x / S) * Math.PI * 2 * 2)) * 0.35 +
        Math.sin(((x + y) / S) * Math.PI * 2) * 0.3;
      const a = Math.max(0, Math.min(1, (v + 0.4) / 1.4));
      const i = (y * S + x) * 4;
      img.data[i] = 235;
      img.data[i + 1] = 238;
      img.data[i + 2] = 245;
      img.data[i + 3] = Math.round(a * 255);
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

function makeCloud(): HTMLCanvasElement {
  const W = 220;
  const H = 120;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const blobs = [
    [70, 60, 60, 38],
    [130, 55, 70, 45],
    [165, 70, 45, 30],
    [100, 75, 55, 30],
  ];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let inside = 0;
      for (const [bx, by, rx, ry] of blobs) inside = Math.max(inside, 1 - ((x - bx) / rx) ** 2 - ((y - by) / ry) ** 2);
      // Dithered soft edge.
      const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][(y & 3) * 4 + (x & 3)] / 16;
      if (inside > 0 && (inside > 0.35 || inside * 3 > bayer)) {
        const i = (y * W + x) * 4;
        img.data[i] = 20;
        img.data[i + 1] = 26;
        img.data[i + 2] = 60;
        img.data[i + 3] = 255;
      }
    }
  ctx.putImageData(img, 0, 0);
  return c;
}
