import { TILE, Terrain, type WorldMap } from '@lumina/core';
import { Pix } from '../art/Pix';
import { light, shade } from '../art/palette';

/**
 * Small island wildlife: butterflies over the flowers, gulls gliding over the sea,
 * sparrows that peck about and scatter when you come close, dragonflies by fresh
 * water and fish that leap now and then. Purely cosmetic, spawned around the camera.
 */
type Kind = 'butterfly' | 'gull' | 'sparrow' | 'fish' | 'dragonfly';

interface Critter {
  kind: Kind;
  x: number;
  y: number;
  /** Height above the ground (px). */
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  life: number;
  color: string;
  /** Wander target. */
  tx: number;
  ty: number;
  flying: boolean;
  pause: number;
}

export interface CritterWorld {
  map: WorldMap;
  camX: number;
  camY: number;
  vw: number;
  vh: number;
  season: number;
  dark: number;
  raining: boolean;
  player: { x: number; y: number } | null;
  splash: (x: number, y: number) => void;
}

const cache = new Map<string, HTMLCanvasElement>();
function spr(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = make();
    cache.set(key, c);
  }
  return c;
}

function butterfly(color: string, frame: number): HTMLCanvasElement {
  return spr(`bf:${color}:${frame}`, () => {
    const p = new Pix(7, 5);
    const d = shade(color, 1);
    if (frame === 0) {
      // Wings open.
      p.set(0, 0, color);
      p.set(1, 0, color);
      p.set(0, 1, color);
      p.set(1, 1, light(color, 1));
      p.set(1, 2, d);
      p.set(5, 0, color);
      p.set(6, 0, color);
      p.set(6, 1, color);
      p.set(5, 1, light(color, 1));
      p.set(5, 2, d);
      p.set(2, 1, d);
      p.set(4, 1, d);
    } else {
      // Wings folded up.
      p.set(2, 0, color);
      p.set(4, 0, color);
      p.set(2, 1, d);
      p.set(4, 1, d);
    }
    p.set(3, 1, '#3a2a30');
    p.set(3, 2, '#3a2a30');
    p.set(3, 3, '#3a2a30');
    return p.toCanvas();
  });
}

function gull(frame: number): HTMLCanvasElement {
  return spr(`gull:${frame}`, () => {
    const p = new Pix(13, 6);
    const w = '#f4f6f8';
    const g = '#a8b0bc';
    const tip = '#3a3e48';
    // Body.
    p.rect(5, 2, 3, 2, w);
    p.set(8, 2, '#f0b040');
    p.set(4, 3, g);
    if (frame === 0) {
      // Wings raised.
      p.line(4, 2, 1, 0, g);
      p.line(8, 2, 11, 0, g);
      p.set(0, 0, tip);
      p.set(12, 0, tip);
    } else if (frame === 1) {
      p.line(4, 2, 0, 2, w);
      p.line(8, 2, 12, 2, w);
      p.set(0, 2, tip);
      p.set(12, 2, tip);
      p.line(4, 3, 1, 3, g);
      p.line(8, 3, 11, 3, g);
    } else {
      p.line(4, 3, 1, 5, g);
      p.line(8, 3, 11, 5, g);
      p.set(1, 5, tip);
      p.set(11, 5, tip);
    }
    return p.toCanvas();
  });
}

function sparrow(pose: number, flip: boolean): HTMLCanvasElement {
  return spr(`sp:${pose}:${flip}`, () => {
    const p = new Pix(8, 7);
    const body = '#9a7050';
    const belly = '#e0cfb0';
    const cap = '#6a4a34';
    const set = (x: number, y: number, c: string) => p.set(flip ? 7 - x : x, y, c);
    if (pose <= 1) {
      // Standing (0) or pecking (1).
      const dy = pose === 1 ? 1 : 0;
      set(2, 3, body);
      set(3, 3, body);
      set(4, 3, body);
      set(2, 4, belly);
      set(3, 4, belly);
      set(4, 4, body);
      set(1, 3, shade(body, 1));
      set(0, 2, shade(body, 1));
      set(5, 2 + dy, cap);
      set(5, 3 + dy, body);
      set(6, 3 + dy, '#e8c060');
      set(5, 2 + dy, cap);
      set(6, 2 + dy, '#2a2030');
      set(3, 5, '#6a5040');
      set(4, 5, '#6a5040');
    } else {
      // Flying, wings up (2) or down (3).
      set(2, 3, body);
      set(3, 3, body);
      set(4, 3, body);
      set(5, 3, cap);
      set(6, 3, '#e8c060');
      set(1, 3, shade(body, 1));
      if (pose === 2) {
        set(3, 1, shade(body, 1));
        set(3, 2, body);
        set(4, 2, body);
      } else {
        set(3, 4, shade(body, 1));
        set(3, 5, shade(body, 1));
      }
    }
    return p.toCanvas();
  });
}

function dragonfly(frame: number, flip: boolean): HTMLCanvasElement {
  return spr(`df:${frame}:${flip}`, () => {
    const p = new Pix(9, 5);
    const set = (x: number, y: number, c: string) => p.set(flip ? 8 - x : x, y, c);
    for (let x = 1; x < 7; x++) set(x, 2, x > 5 ? '#2a6a8a' : '#3aa8c8');
    set(7, 2, '#1a3a4a');
    const wing = frame ? 'rgba(220,240,255,0.9)' : '#d8ecf8';
    if (frame === 0) {
      set(5, 0, wing);
      set(6, 1, wing);
      set(5, 4, wing);
      set(6, 3, wing);
    } else {
      set(4, 1, wing);
      set(5, 1, wing);
      set(4, 3, wing);
      set(5, 3, wing);
    }
    return p.toCanvas();
  });
}

function fish(up: boolean): HTMLCanvasElement {
  return spr(`fish:${up}`, () => {
    const p = new Pix(4, 6);
    const c = '#c8d8e0';
    if (up) {
      p.set(1, 0, c);
      p.set(2, 0, c);
      p.set(1, 1, light(c, 1));
      p.set(2, 1, c);
      p.set(1, 2, c);
      p.set(2, 2, shade(c, 1));
      p.set(1, 3, shade(c, 1));
      p.set(0, 4, shade(c, 1));
      p.set(3, 4, shade(c, 1));
    } else {
      p.set(0, 1, shade(c, 1));
      p.set(3, 1, shade(c, 1));
      p.set(1, 2, shade(c, 1));
      p.set(1, 3, c);
      p.set(2, 3, shade(c, 1));
      p.set(1, 4, light(c, 1));
      p.set(2, 4, c);
      p.set(1, 5, c);
      p.set(2, 5, c);
    }
    return p.toCanvas();
  });
}

const BUTTERFLY = ['#fff4e0', '#f8d850', '#f0904a', '#8ab8f0', '#f0a8d0'];

export class Critters {
  list: Critter[] = [];
  private spawnT = 0;
  private fishT = 2;

  private terrainAt(map: WorldMap, x: number, y: number): number {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return Terrain.Deep;
    return map.terrain[ty * map.w + tx];
  }

  private count(kind: Kind): number {
    let n = 0;
    for (const c of this.list) if (c.kind === kind) n++;
    return n;
  }

  private make(kind: Kind, x: number, y: number, extra: Partial<Critter> = {}): Critter {
    const c: Critter = { kind, x, y, z: 0, vx: 0, vy: 0, vz: 0, t: Math.random() * 10, life: 0, color: '#ffffff', tx: x, ty: y, flying: false, pause: 0, ...extra };
    this.list.push(c);
    return c;
  }

  update(dt: number, w: CritterWorld): void {
    const { map, camX, camY, vw, vh } = w;
    const day = w.dark < 0.25;
    const randomSpot = () => ({ x: camX + Math.random() * vw, y: camY + Math.random() * vh });

    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.6;
      // Butterflies over grass and meadow in the warm seasons.
      if (day && !w.raining && (w.season === 0 || w.season === 1) && this.count('butterfly') < 7) {
        const s = randomSpot();
        const t = this.terrainAt(map, s.x, s.y);
        if (t === Terrain.Meadow || (t === Terrain.Grass && Math.random() < 0.4))
          this.make('butterfly', s.x, s.y, { z: 10, color: BUTTERFLY[Math.floor(Math.random() * BUTTERFLY.length)], flying: true });
      }
      // Gulls sweeping across if there's sea in view.
      if (day && this.count('gull') < 2 && Math.random() < 0.25) {
        const s = randomSpot();
        const t = this.terrainAt(map, s.x, s.y);
        if (t === Terrain.Sea || t === Terrain.Deep || t === Terrain.Sand) {
          const fromLeft = Math.random() < 0.5;
          this.make('gull', fromLeft ? camX - 20 : camX + vw + 20, s.y, { z: 40 + Math.random() * 30, vx: (fromLeft ? 1 : -1) * (26 + Math.random() * 14), flying: true });
        }
      }
      // A little flock of sparrows on open ground, well away from the player.
      if (day && !w.raining && this.count('sparrow') < 5 && Math.random() < 0.3) {
        const s = randomSpot();
        const t = this.terrainAt(map, s.x, s.y);
        const far = !w.player || Math.hypot(s.x - w.player.x, s.y - w.player.y) > 110;
        const solid = map.solid[Math.floor(s.y / TILE) * map.w + Math.floor(s.x / TILE)];
        if (far && !solid && (t === Terrain.Grass || t === Terrain.Path || t === Terrain.Cobble)) {
          const n = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) this.make('sparrow', s.x + (Math.random() - 0.5) * 24, s.y + (Math.random() - 0.5) * 14, { pause: Math.random() });
        }
      }
      // Dragonflies over fresh water in summer.
      if (day && !w.raining && w.season === 1 && this.count('dragonfly') < 3) {
        const s = randomSpot();
        const t = this.terrainAt(map, s.x, s.y);
        if (t === Terrain.River || t === Terrain.Pond) this.make('dragonfly', s.x, s.y, { z: 8, flying: true });
      }
    }

    // Fish leap now and then.
    this.fishT -= dt;
    if (this.fishT <= 0) {
      this.fishT = 2 + Math.random() * 4;
      for (let k = 0; k < 6; k++) {
        const s = randomSpot();
        const t = this.terrainAt(map, s.x, s.y);
        if (t === Terrain.River || t === Terrain.Pond || t === Terrain.Sea) {
          this.make('fish', s.x, s.y, { vz: 55, vx: (Math.random() - 0.5) * 30, flying: true });
          w.splash(s.x, s.y);
          break;
        }
      }
    }

    for (const c of this.list) {
      c.t += dt;
      c.life += dt;
      switch (c.kind) {
        case 'butterfly': {
          if (Math.hypot(c.tx - c.x, c.ty - c.y) < 4 || c.life % 3 < dt) {
            c.tx = c.x + (Math.random() - 0.5) * 60;
            c.ty = c.y + (Math.random() - 0.5) * 40;
          }
          const a = Math.atan2(c.ty - c.y, c.tx - c.x);
          c.vx += (Math.cos(a) * 18 - c.vx) * dt * 2;
          c.vy += (Math.sin(a) * 12 - c.vy) * dt * 2;
          c.x += c.vx * dt + Math.sin(c.t * 7) * 0.3;
          c.y += c.vy * dt;
          c.z = 9 + Math.sin(c.t * 3) * 4;
          if (c.life > 25) c.life = 999;
          break;
        }
        case 'gull':
          c.x += c.vx * dt;
          c.z += Math.sin(c.t * 0.8) * dt * 6;
          c.y += Math.sin(c.t * 0.5) * dt * 4;
          break;
        case 'sparrow': {
          const pl = w.player;
          if (!c.flying && ((pl && Math.hypot(pl.x - c.x, pl.y - c.y) < 44) || w.raining)) {
            c.flying = true;
            const away = pl ? Math.sign(c.x - pl.x) || 1 : 1;
            c.vx = away * (60 + Math.random() * 30);
            c.vz = 55 + Math.random() * 20;
          }
          if (c.flying) {
            c.x += c.vx * dt;
            c.z += c.vz * dt;
            c.y -= 8 * dt;
          } else {
            c.pause -= dt;
            if (c.pause <= 0) {
              c.pause = 0.4 + Math.random() * 1.6;
              // A tiny hop.
              if (Math.random() < 0.5) {
                c.vx = (Math.random() - 0.5) * 30;
                c.vz = 20;
              }
            }
            c.x += c.vx * dt;
            c.z = Math.max(0, c.z + c.vz * dt);
            c.vz -= 120 * dt;
            if (c.z <= 0) {
              c.vx = 0;
              c.vz = 0;
            }
          }
          break;
        }
        case 'dragonfly': {
          c.pause -= dt;
          if (c.pause <= 0) {
            c.pause = 0.6 + Math.random() * 1.2;
            c.tx = c.x + (Math.random() - 0.5) * 70;
            c.ty = c.y + (Math.random() - 0.5) * 40;
          }
          c.x += (c.tx - c.x) * Math.min(1, dt * 6);
          c.y += (c.ty - c.y) * Math.min(1, dt * 6);
          c.z = 8 + Math.sin(c.t * 5) * 1.5;
          if (c.life > 30) c.life = 999;
          break;
        }
        case 'fish':
          c.x += c.vx * dt;
          c.z += c.vz * dt;
          c.vz -= 160 * dt;
          if (c.z < 0) {
            w.splash(c.x, c.y);
            c.life = 999;
          }
          break;
      }
    }
    const margin = 80;
    this.list = this.list.filter(
      (c) => c.life < 999 && c.x > camX - margin && c.x < camX + vw + margin && c.y - c.z > camY - margin * 2 && c.y < camY + vh + margin,
    );
  }

  /** Sparrows on the ground sort with everything else. */
  groundDrawables(ctx: CanvasRenderingContext2D, cx: number, cy: number): Array<{ y: number; draw: () => void }> {
    const out: Array<{ y: number; draw: () => void }> = [];
    for (const c of this.list) {
      if (c.kind !== 'sparrow' || c.flying) continue;
      const pose = c.z > 0 ? 0 : Math.floor(c.t * 2 + c.x) % 5 === 0 ? 1 : 0;
      const img = sparrow(pose, c.vx < 0 || (c.vx === 0 && Math.floor(c.x) % 2 === 0));
      out.push({
        y: c.y,
        draw: () => {
          ctx.fillStyle = 'rgba(20,24,60,0.22)';
          ctx.fillRect(Math.round(c.x - 2 - cx), Math.round(c.y - cy), 5, 1);
          ctx.drawImage(img, Math.round(c.x - 4 - cx), Math.round(c.y - 6 - c.z - cy));
        },
      });
    }
    return out;
  }

  /** Everything in the air, drawn above the scene with a soft shadow below. */
  drawAir(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    for (const c of this.list) {
      if (c.kind === 'sparrow' && !c.flying) continue;
      let img: HTMLCanvasElement;
      switch (c.kind) {
        case 'butterfly':
          img = butterfly(c.color, Math.floor(c.t * 9) % 2);
          break;
        case 'gull':
          img = gull([0, 1, 2, 1][Math.floor(c.t * 5) % 4]);
          break;
        case 'sparrow':
          img = sparrow(2 + (Math.floor(c.t * 12) % 2), c.vx < 0);
          break;
        case 'dragonfly':
          img = dragonfly(Math.floor(c.t * 20) % 2, c.tx < c.x);
          break;
        default:
          img = fish(c.vz > 0);
      }
      if (c.kind !== 'fish') {
        ctx.fillStyle = c.kind === 'gull' ? 'rgba(20,24,60,0.14)' : 'rgba(20,24,60,0.2)';
        ctx.fillRect(Math.round(c.x - img.width / 4 - cx), Math.round(c.y - cy), Math.max(2, Math.round(img.width / 2)), 1);
      }
      ctx.drawImage(img, Math.round(c.x - img.width / 2 - cx), Math.round(c.y - img.height - c.z - cy));
    }
  }
}
