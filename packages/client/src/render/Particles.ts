export type ParticleKind = 'pixel' | 'smoke' | 'sparkle' | 'petal' | 'leaf' | 'firefly' | 'splash' | 'text';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  color: string;
  size: number;
  /** Used by text particles. */
  text?: string;
  phase: number;
}

/** A simple pooled particle system in world coordinates. */
export class Particles {
  list: Particle[] = [];

  spawn(p: Partial<Particle> & { x: number; y: number }): Particle {
    const part: Particle = {
      kind: 'pixel',
      vx: 0,
      vy: 0,
      g: 0,
      life: 0,
      max: 0.6,
      color: '#ffffff',
      size: 1,
      phase: Math.random() * 6.28,
      ...p,
    };
    if (this.list.length < 1500) this.list.push(part);
    return part;
  }

  burst(x: number, y: number, n: number, colors: string[], speed = 40, up = 30, g = 120, max = 0.5): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5 - up * Math.random(), g, max: max * (0.6 + Math.random() * 0.6), color: colors[i % colors.length], size: Math.random() < 0.3 ? 2 : 1 });
    }
  }

  update(dt: number, wind: number): void {
    const out: Particle[] = [];
    for (const p of this.list) {
      p.life += dt;
      if (p.life >= p.max) continue;
      p.phase += dt;
      switch (p.kind) {
        case 'smoke':
          p.vx += (wind * 18 - p.vx) * dt;
          p.size = 1 + (p.life / p.max) * 3;
          break;
        case 'petal':
        case 'leaf':
          p.vx = wind * 25 + Math.sin(p.phase * 2.2) * 14;
          break;
        case 'firefly':
          p.vx = Math.sin(p.phase * 0.9) * 8;
          p.vy = Math.cos(p.phase * 1.3) * 6;
          break;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      out.push(p);
    }
    this.list = out;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, glowOnly = false): void {
    for (const p of this.list) {
      if ((p.kind === 'firefly') !== glowOnly) continue;
      const x = Math.round(p.x - camX);
      const y = Math.round(p.y - camY);
      const t = p.life / p.max;
      switch (p.kind) {
        case 'smoke':
          ctx.globalAlpha = 0.45 * (1 - t);
          ctx.fillStyle = p.color;
          ctx.fillRect(x - Math.floor(p.size / 2), y - Math.floor(p.size / 2), Math.ceil(p.size), Math.ceil(p.size));
          break;
        case 'sparkle': {
          ctx.globalAlpha = 1 - t;
          ctx.fillStyle = p.color;
          const s = t < 0.5 ? 1 : 0;
          ctx.fillRect(x, y - 1 - s, 1, 3 + s * 2);
          ctx.fillRect(x - 1 - s, y, 3 + s * 2, 1);
          break;
        }
        case 'firefly': {
          const pulse = 0.5 + 0.5 * Math.sin(p.phase * 3);
          ctx.globalAlpha = Math.min(1, (1 - t) * 3) * pulse;
          ctx.fillStyle = '#fff8a0';
          ctx.fillRect(x, y, 1, 1);
          ctx.globalAlpha *= 0.35;
          ctx.fillStyle = '#e8ff80';
          ctx.fillRect(x - 1, y, 3, 1);
          ctx.fillRect(x, y - 1, 1, 3);
          break;
        }
        case 'petal':
          ctx.globalAlpha = Math.min(1, (1 - t) * 4);
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, Math.sin(p.phase * 4) > 0 ? 2 : 1, 1);
          break;
        case 'leaf':
          ctx.globalAlpha = Math.min(1, (1 - t) * 4);
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, 2, Math.sin(p.phase * 3) > 0 ? 1 : 2);
          break;
        case 'splash':
          ctx.globalAlpha = 1 - t;
          ctx.fillStyle = p.color;
          ctx.fillRect(x - 1 - Math.round(t * 2), y, 1, 1);
          ctx.fillRect(x + 1 + Math.round(t * 2), y, 1, 1);
          break;
        default:
          ctx.globalAlpha = Math.min(1, (1 - t) * 3);
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }
}
