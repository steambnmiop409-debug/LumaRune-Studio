import {
  TILE,
  Terrain,
  cropStep,
  getCrop,
  hash2,
  isWater,
  seasonOf,
  type Appearance,
  type DayWeather,
  type Dir,
  type PlacedObject,
  type SoilState,
  type WorldMap,
  type WorldObject,
} from '@lumina/core';
import { Sprites } from '../art/Sprites';
import { CHAR_H, CHAR_W } from '../art/sprites/character';
import { CROP_H, CROP_W } from '../art/sprites/crops';
import type { SeasonLook } from '../art/sprites/nature';
import { Lighting, ambientColor, darkness, type Light } from './Lighting';
import { Particles } from './Particles';
import { Critters } from './Critters';
import { TerrainRenderer } from './TerrainRenderer';
import { WeatherFx } from './WeatherFx';

export interface ViewPlayer {
  id: string;
  look: Appearance;
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
  animT: number;
  carrying: number;
  name?: string;
  /** Active tool swing: item id and progress 0..1. */
  swing?: { item: string; t: number } | null;
  blink?: boolean;
}

export interface ViewInput {
  minute: number;
  day: number;
  weather: DayWeather;
  raining: boolean;
  soil: Record<number, SoilState>;
  placed: PlacedObject[];
  shipPresent: boolean;
  cargo: number;
  players: ViewPlayer[];
  /** Forage lying on the ground, by tile key. */
  forage: Record<number, string>;
  /** Today's notice-board request is still open. */
  boardFresh: boolean;
  /** Farm debris by tile key. */
  debris: Record<number, 'weed' | 'stone' | 'twig'>;
  /** Quarry outcrops by tile key. */
  nodes: Record<number, string>;
  /** Absolute game minute (day × 1440 + minute), for machine timers. */
  now: number;
}

interface Drawable {
  y: number;
  draw: () => void;
}

const TREE_KINDS = new Set(['oak', 'pine', 'blossom', 'palm', 'fruittree']);
const LANDMARKS = new Set(['tent', 'campfire', 'logseat', 'woodpile', 'ruin', 'shrine', 'tidepool', 'gazebo', 'parasol', 'sandcastle', 'buoy', 'cave', 'rail', 'minecart', 'orepile', 'workbench']);
const SPRINKLERS = new Set(['sprinkler1', 'sprinkler2', 'sprinkler3']);

export class WorldView {
  readonly terrain: TerrainRenderer;
  readonly particles = new Particles();
  readonly critters = new Critters();
  readonly weatherFx = new WeatherFx();
  private lighting = new Lighting();
  camX = 0;
  camY = 0;
  time = 0;
  dark = 0;
  ambient = '#ffffff';
  private fences = new Set<number>();
  private ship: { mode: 'leave' | 'arrive'; t: number } | null = null;
  private smokeT = 0;
  /** Last drawn growth step per soil tile, for the grow-in cross-fade. */
  private cropSteps = new Map<number, { step: number; prev: number; t: number }>();
  private ambientT = 0;

  constructor(readonly map: WorldMap) {
    this.terrain = new TerrainRenderer(map);
    for (const o of map.objects) if (o.kind === 'fence') this.fences.add(o.y * map.w + o.x);
  }

  shipLeaves(): void {
    this.ship = { mode: 'leave', t: 0 };
  }

  shipArrives(): void {
    this.ship = { mode: 'arrive', t: 0 };
  }

  centerOn(x: number, y: number, vw: number, vh: number): void {
    const maxX = this.map.w * TILE - vw;
    const maxY = this.map.h * TILE - vh;
    this.camX = Math.max(0, Math.min(maxX, x - vw / 2));
    this.camY = Math.max(0, Math.min(maxY, y - vh / 2));
  }

  /** A little speech bubble with an item icon, bobbing over a machine that's done. */
  private bubble(ctx: CanvasRenderingContext2D, icon: HTMLCanvasElement, x: number, y: number) {
    const bob = Math.round(Math.sin(this.time * 3) * 1.5);
    const bx = Math.round(x - 11);
    const by = Math.round(y - 22 + bob);
    ctx.fillStyle = '#2b2d4a';
    ctx.fillRect(bx, by, 22, 20);
    ctx.fillStyle = '#fbf3e0';
    ctx.fillRect(bx + 1, by + 1, 20, 18);
    ctx.fillRect(bx + 9, by + 20, 4, 1);
    ctx.fillStyle = '#2b2d4a';
    ctx.fillRect(bx + 10, by + 21, 2, 2);
    ctx.drawImage(icon, bx + 3, by + 2);
  }

  private season(day: number): SeasonLook {
    return seasonOf(day) as SeasonLook;
  }

  private visibleObjects(vw: number, vh: number): WorldObject[] {
    const objs = this.map.objects;
    const y0 = Math.floor(this.camY / TILE) - 2;
    const y1 = Math.floor((this.camY + vh) / TILE) + 4;
    const x0 = Math.floor(this.camX / TILE) - 3;
    const x1 = Math.floor((this.camX + vw) / TILE) + 3;
    // Objects are sorted by y — binary search the first row.
    let lo = 0;
    let hi = objs.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (objs[mid].y < y0) lo = mid + 1;
      else hi = mid;
    }
    const out: WorldObject[] = [];
    for (let i = lo; i < objs.length && objs[i].y <= y1; i++) {
      const o = objs[i];
      if (o.x >= x0 && o.x <= x1) out.push(o);
    }
    return out;
  }

  update(dt: number, input: ViewInput, vw: number, vh: number): void {
    this.time += dt;
    this.particles.update(dt, input.weather.wind);
    this.weatherFx.update(dt, input.weather, input.raining);
    if (this.ship) {
      this.ship.t += dt;
      if (this.ship.t > 9) this.ship = null;
    }
    const season = this.season(input.day);
    this.terrain.setSeason(season);
    // Chimney smoke.
    this.smokeT += dt;
    if (this.smokeT > 0.28) {
      this.smokeT = 0;
      for (const b of this.map.buildings) {
        const spr = Sprites.building(b);
        for (const s of spr.smoke) {
          const wx = b.x * TILE + spr.ox + s.x;
          const wy = (b.y + b.h) * TILE - spr.img.height + spr.oy + s.y;
          if (wx < this.camX - 40 || wx > this.camX + vw + 40 || wy < this.camY - 60 || wy > this.camY + vh + 40) continue;
          this.particles.spawn({ kind: 'smoke', x: wx + Math.random() * 2, y: wy, vy: -9 - Math.random() * 4, max: 2.6, color: b.kind === 'toolShop' ? '#9a9aa8' : '#e8e8f0' });
        }
      }
    }
    // Wildlife.
    const me = input.players[0];
    this.critters.update(dt, {
      map: this.map,
      camX: this.camX,
      camY: this.camY,
      vw,
      vh,
      season,
      dark: this.dark,
      raining: input.raining,
      player: me ? { x: me.x, y: me.y } : null,
      splash: (x, y) => {
        for (let i = 0; i < 5; i++) this.particles.spawn({ x: x + (Math.random() - 0.5) * 4, y, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 20, g: 140, max: 0.45, color: '#e0f4f8' });
        this.particles.spawn({ kind: 'splash', x, y, max: 0.5, color: '#d8f0f8' });
      },
    });
    // Seasonal ambience.
    this.ambientT += dt;
    if (this.ambientT > 0.12) {
      this.ambientT = 0;
      const objs = this.visibleObjects(vw, vh);
      for (const o of objs) {
        if (season === 0 && o.kind === 'blossom' && Math.random() < 0.08) {
          this.particles.spawn({ kind: 'petal', x: o.x * TILE + 4 + Math.random() * 20, y: o.y * TILE - 18 - Math.random() * 10, vy: 9, max: 5, color: Math.random() < 0.5 ? '#f8c8d4' : '#fde4ea' });
        }
        if (season === 2 && o.kind === 'oak' && Math.random() < 0.04) {
          this.particles.spawn({ kind: 'leaf', x: o.x * TILE + Math.random() * 24 - 4, y: o.y * TILE - 16 - Math.random() * 10, vy: 12, max: 4, color: ['#e0923a', '#d0703a', '#e8b04a'][Math.floor(Math.random() * 3)] });
        }
      }
      const fireflies = this.particles.list.filter((p) => p.kind === 'firefly').length;
      if (season === 1 && this.dark > 0.45 && fireflies < 36 && !input.raining) {
        const tx = Math.floor((this.camX + Math.random() * vw) / TILE);
        const ty = Math.floor((this.camY + Math.random() * vh) / TILE);
        const t = this.map.terrain[ty * this.map.w + tx];
        if (t === Terrain.Grass || t === Terrain.Meadow || t === Terrain.Forest) this.particles.spawn({ kind: 'firefly', x: tx * TILE + 8, y: ty * TILE, max: 6 + Math.random() * 4 });
      }
      // Morning sprinkler spray.
      if (input.minute >= 360 && input.minute < 385)
        for (const p of input.placed)
          if (SPRINKLERS.has(p.kind) && Math.random() < 0.6) {
            const a = Math.random() * Math.PI * 2;
            this.particles.spawn({ x: p.x * TILE + 8, y: p.y * TILE + 4, vx: Math.cos(a) * 30, vy: Math.sin(a) * 15 - 25, g: 90, max: 0.6, color: '#a8e0f8' });
          }
    }
    this.terrain.prefetch(this.camX, this.camY, vw, vh);
  }

  render(ctx: CanvasRenderingContext2D, vw: number, vh: number, input: ViewInput): void {
    const map = this.map;
    const cx = Math.round(this.camX);
    const cy = Math.round(this.camY);
    const season = this.season(input.day);
    this.ambient = ambientColor(input.minute, input.weather.kind);
    this.dark = darkness(this.ambient);
    const lit = this.dark > 0.22;
    const lights: Light[] = [];
    const nightOverlays: Array<[HTMLCanvasElement, number, number]> = [];

    // 1. Terrain.
    this.terrain.draw(ctx, cx, cy, vw, vh, this.time);

    // 2. Water sparkles.
    const tx0 = Math.floor(cx / TILE);
    const ty0 = Math.floor(cy / TILE);
    const tx1 = Math.ceil((cx + vw) / TILE);
    const ty1 = Math.ceil((cy + vh) / TILE);
    ctx.fillStyle = this.dark > 0.5 ? '#c8d8ff' : '#f4fdff';
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = map.terrain[ty * map.w + tx];
        if (t === undefined || !isWater(t)) continue;
        const ph = hash2(tx, ty, 5);
        const k = Math.floor(this.time * 1.3 + ph * 10);
        if (hash2(tx, ty, k) < 0.045) {
          const sx = tx * TILE + Math.floor(hash2(tx, ty, k + 1) * 14) - cx;
          const sy = ty * TILE + Math.floor(hash2(tx, ty, k + 2) * 14) - cy;
          ctx.fillRect(sx, sy, 2, 1);
          if (hash2(tx, ty, k + 3) < 0.4) ctx.fillRect(sx + 3, sy + 1, 1, 1);
        }
      }

    // 3. Farm soil.
    const soilKeys = Object.keys(input.soil);
    for (const key of soilKeys) {
      const k = Number(key);
      const x = k % map.w;
      const y = (k - x) / map.w;
      if (x < tx0 - 1 || x > tx1 || y < ty0 - 1 || y > ty1) continue;
      const s = input.soil[k];
      const mask = (input.soil[k - 1] ? 1 : 0) | (input.soil[k + 1] ? 2 : 0) | (input.soil[k - map.w] ? 4 : 0) | (input.soil[k + map.w] ? 8 : 0);
      ctx.drawImage(Sprites.soil(mask, s.moisture >= 30), x * TILE - cx, y * TILE - cy);
      if (s.fert) ctx.drawImage(Sprites.fert(s.fert), x * TILE - cx, y * TILE - cy);
    }

    // 4. Cloud shadows (under objects so they fall on the ground).
    this.weatherFx.drawCloudShadows(ctx, cx, cy, vw, vh, input.weather, map.w * TILE, map.h * TILE);

    // 5. Soft contact shadows + y-sorted drawables.
    const drawables: Drawable[] = [];
    const shadow = (x: number, y: number, rx: number, ry: number, alpha = 56) => {
      const R = Math.max(1, Math.round(rx));
      const Rr = Math.max(1, Math.round(ry));
      ctx.drawImage(Sprites.shadowBlob(R, Rr, alpha), Math.round(x - R - cx), Math.round(y - Rr - cy));
    };
    const wind = 0.25 + input.weather.wind;
    const objs = this.visibleObjects(vw, vh);
    for (const o of objs) {
      const bx = o.x * TILE;
      const by = o.y * TILE;
      if (TREE_KINDS.has(o.kind)) {
        const tree = Sprites.tree(o.kind as 'oak', o.v, season);
        // Wild trees stand a few pixels off the grid so groves never look planted; orchard rows stay neat.
        const jx = o.kind === 'fruittree' ? 0 : (o.v % 9) - 4;
        const jy = o.kind === 'fruittree' ? 0 : (Math.floor(o.v / 9) % 5) - 2;
        // A broad canopy shadow cast a little to the lower right, plus a dark contact shadow at the trunk.
        const cw = Math.round(tree.img.width * (o.kind === 'pine' ? 0.3 : 0.38));
        shadow(bx + 10 + jx, by + 12 + jy, cw, Math.max(4, Math.round(cw * 0.36)), 44);
        shadow(bx + 8 + jx, by + 14 + jy, 5, 2, 70);
        const sx = bx + 8 - tree.ax - cx + jx;
        const sy = by + 14 - tree.ay - cy + jy;
        const sway = Math.round(Math.sin(this.time * 1.4 + o.x * 0.7 + o.y * 0.3) * wind * 1.3);
        // See-through canopy when the player walks behind it.
        const me = input.players[0];
        const baseY = by + 14 + jy;
        const behind =
          me &&
          me.y < baseY &&
          me.y > baseY - tree.img.height + 6 &&
          me.x + 5 > sx + cx + 2 &&
          me.x - 5 < sx + cx + tree.img.width - 2 &&
          me.y - 26 < sy + cy + tree.swayRows;
        drawables.push({
          y: baseY,
          draw: () => {
            const img = tree.img;
            ctx.drawImage(img, 0, tree.swayRows, img.width, img.height - tree.swayRows, sx, sy + tree.swayRows, img.width, img.height - tree.swayRows);
            if (behind) ctx.globalAlpha = 0.42;
            ctx.drawImage(img, 0, 0, img.width, tree.swayRows, sx + sway, sy, img.width, tree.swayRows);
            ctx.globalAlpha = 1;
          },
        });
        continue;
      }
      if (LANDMARKS.has(o.kind)) {
        const w = (o.w ?? 1) * TILE;
        const h = (o.h ?? 1) * TILE;
        let frame = 0;
        if (o.kind === 'campfire') frame = Math.floor(this.time * 8 + o.x) % 3;
        else if (o.kind === 'shrine') frame = lit ? 1 : 0;
        else if (o.kind === 'tidepool') frame = Math.floor(this.time * 1.5 + o.x) % 2;
        else if (o.kind === 'buoy') frame = Math.sin(this.time * 1.6 + o.x) > 0.3 ? 1 : 0;
        else if (o.kind === 'cave') frame = lit ? 1 : 0;
        const img = Sprites.landmark(o.kind, o.v, frame);
        const flat = o.kind === 'tidepool' || o.kind === 'rail';
        if (!flat && o.kind !== 'campfire' && o.kind !== 'buoy' && o.kind !== 'parasol' && o.kind !== 'cave') shadow(bx + w / 2, by + h - 2, w / 2 - 1, 2.5);
        if (o.kind === 'cave' && lit) lights.push({ x: bx + 34 - cx, y: by + 20 - cy, r: 30, color: '#ffd070' });
        if (o.kind === 'buoy' && lit) lights.push({ x: bx + 6 - cx, y: by - 1 - cy, r: 14, color: '#fff0a0', a: Math.sin(this.time * 3 + o.x) > 0 ? 0.9 : 0.2 });
        const bob = o.kind === 'buoy' ? Math.round(Math.sin(this.time * 1.6 + o.x) * 1.2) : 0;
        const ix = bx + Math.floor((w - img.width) / 2) - cx;
        const iy = by + h - img.height + (o.kind === 'tidepool' ? 2 : o.kind === 'buoy' ? 3 : 0) + bob - cy;
        drawables.push({ y: flat ? by : by + h - 2, draw: () => ctx.drawImage(img, ix, iy) });
        if (o.kind === 'campfire') {
          lights.push({ x: bx + 8 - cx, y: by + 6 - cy, r: 70 + Math.sin(this.time * 9) * 4, color: '#ffb060', a: 0.95 });
          if (Math.random() < 0.08) this.particles.spawn({ x: bx + 8 + (Math.random() - 0.5) * 3, y: by + 2, vx: (Math.random() - 0.5) * 6 + input.weather.wind * 10, vy: -14, max: 1.8, color: '#9a9aa8' });
          if (Math.random() < 0.05) this.particles.spawn({ kind: 'sparkle', x: bx + 8, y: by + 4, vx: (Math.random() - 0.5) * 16, vy: -26, max: 0.7, color: '#ffd070' });
        }
        if (o.kind === 'shrine' && lit) lights.push({ x: bx + 24 - cx, y: by - 8 - cy, r: 36, color: '#ffd98a' });
        continue;
      }
      switch (o.kind) {
        case 'flowers':
        case 'reeds': {
          if (season === 3 && o.kind === 'flowers') break;
          const frame = Math.sin(this.time * 2 + o.x) * wind > 0.2 ? 1 : 0;
          const img = o.kind === 'flowers' ? Sprites.flowers(o.v, frame) : Sprites.reeds(o.v, frame);
          drawables.push({ y: by + 8, draw: () => ctx.drawImage(img, bx - cx, by + TILE - img.height - cy) });
          break;
        }
        case 'tallgrass':
        case 'pebbles':
        case 'mushroom':
        case 'lilypad': {
          // Snow buries the tall grass; the frozen pond has no lily pads.
          if (season === 3 && (o.kind === 'tallgrass' || o.kind === 'lilypad' || o.kind === 'mushroom')) break;
          const frame = (o.kind === 'tallgrass' || o.kind === 'lilypad') && Math.sin(this.time * 1.7 + o.x * 0.8 + o.y) * wind > 0.15 ? 1 : 0;
          const img = Sprites.detail(o.kind, o.v, frame);
          const low = o.kind === 'pebbles' || o.kind === 'lilypad';
          drawables.push({ y: low ? by : by + 9, draw: () => ctx.drawImage(img, bx - cx, by + TILE - img.height - cy) });
          break;
        }
        case 'log':
        case 'boat':
        case 'netrack':
        case 'fishcrate':
        case 'anchor':
        case 'stall':
        case 'flowerbed':
        case 'laundry':
        case 'haybale':
        case 'scarecrow':
        case 'beehive':
        case 'picnic':
        case 'telescope': {
          const frame = (o.kind === 'laundry' || o.kind === 'scarecrow') && Math.sin(this.time * 2.2 + o.x) * wind > 0.1 ? 1 : 0;
          const img = Sprites.detail(o.kind, o.v, frame);
          const w = (o.w ?? 1) * TILE;
          const flat = o.kind === 'picnic' || o.kind === 'flowerbed';
          if (!flat) shadow(bx + w / 2, by + 14, w / 2 - 2, 2);
          drawables.push({ y: flat ? by + 2 : by + 14, draw: () => ctx.drawImage(img, bx + Math.floor((w - img.width) / 2) - cx, by + TILE - img.height + (flat ? 1 : 0) - cy) });
          if (o.kind === 'beehive' && Math.random() < 0.02 && !input.raining && this.dark < 0.3) this.particles.spawn({ x: bx + 8, y: by, vx: (Math.random() - 0.5) * 30, vy: -10, max: 1.5, color: '#f5d040' });
          break;
        }
        case 'fence': {
          const k = o.y * map.w + o.x;
          const mask = (this.fences.has(k - 1) ? 1 : 0) | (this.fences.has(k + 1) ? 2 : 0) | (this.fences.has(k - map.w) ? 4 : 0) | (this.fences.has(k + map.w) ? 8 : 0);
          const img = Sprites.fence(mask);
          drawables.push({ y: by + 12, draw: () => ctx.drawImage(img, bx - cx, by + TILE - img.height - cy) });
          break;
        }
        case 'lamp': {
          const img = Sprites.lamp(lit);
          shadow(bx + 8, by + 14, 4, 1.5);
          drawables.push({ y: by + 14, draw: () => ctx.drawImage(img, bx + 2 - cx, by + TILE - img.height - cy) });
          if (lit) lights.push({ x: bx + 8 - cx, y: by + TILE - 34 + 7 - cy, r: 48, color: '#ffcf80' });
          break;
        }
        case 'fountain': {
          const img = Sprites.fountain(Math.floor(this.time * 6) % 3);
          drawables.push({ y: by + 30, draw: () => ctx.drawImage(img, bx - 1 - cx, by + 32 - img.height - cy) });
          break;
        }
        case 'bush':
        case 'rock':
        case 'stump': {
          const img = o.kind === 'bush' ? Sprites.bush(o.v, season) : o.kind === 'rock' ? Sprites.rock(o.v) : Sprites.stump();
          shadow(bx + 8, by + 14, 7, 2);
          drawables.push({ y: by + 14, draw: () => ctx.drawImage(img, bx + 8 - Math.floor(img.width / 2) - cx, by + TILE - img.height + 1 - cy) });
          break;
        }
        case 'flowerpot':
        case 'crate': {
          const img = o.kind === 'flowerpot' ? Sprites.flowerpot(o.v) : Sprites.crate();
          drawables.push({ y: by + 14, draw: () => ctx.drawImage(img, bx - cx, by + TILE - img.height - cy) });
          break;
        }
        case 'board': {
          const img = Sprites.board(input.boardFresh);
          shadow(bx + 8, by + 14, 9, 2);
          drawables.push({ y: by + 14, draw: () => ctx.drawImage(img, bx + 8 - Math.floor(img.width / 2) - cx, by + TILE - img.height + 1 - cy) });
          break;
        }
        default: {
          const kind = o.kind as 'bench' | 'well' | 'sign' | 'barrel' | 'bollard' | 'packbench' | 'mailbox';
          const img = Sprites.prop(kind);
          const w = (o.w ?? 1) * TILE;
          drawables.push({ y: by + (o.h ?? 1) * TILE - 2, draw: () => ctx.drawImage(img, bx + Math.floor((w - img.width) / 2) - cx, by + (o.h ?? 1) * TILE - img.height - cy) });
        }
      }
    }

    // Buildings.
    for (const b of map.buildings) {
      const spr = Sprites.building(b);
      const sx = b.x * TILE + spr.ox;
      const sy = (b.y + b.h) * TILE - spr.img.height + spr.oy;
      if (sx - cx > vw || sy - cy > vh || sx + spr.img.width - cx < 0 || sy + spr.img.height - cy < -40) continue;
      ctx.fillStyle = 'rgba(24,30,64,0.18)';
      ctx.fillRect(sx + 2 - cx, (b.y + b.h) * TILE - cy, spr.img.width - 4, 3);
      // Walking behind a building fades it so the player never disappears.
      const me = input.players[0];
      const hidden = me && me.y < (b.y + b.h) * TILE - 2 && me.y > sy + 8 && me.x + 5 > sx && me.x - 5 < sx + spr.img.width;
      drawables.push({
        y: (b.y + b.h) * TILE - 1,
        draw: () => {
          if (hidden) ctx.globalAlpha = 0.5;
          ctx.drawImage(spr.img, sx - cx, sy - cy);
          if (season === 3) ctx.drawImage(spr.snow, sx - cx, sy - cy);
          ctx.globalAlpha = 1;
          if (b.kind === 'windmill') {
            const sails = Sprites.sails(Math.floor(this.time * 3 * (0.4 + input.weather.wind)) % 12);
            ctx.drawImage(sails, sx + spr.img.width / 2 - 38 - cx, sy + 20 - 38 - cy);
          }
        },
      });
      if (lit) {
        nightOverlays.push([spr.night, sx - cx, sy - cy]);
        for (const l of spr.lights) lights.push({ x: sx + l.x - cx, y: sy + l.y - cy, r: l.r, color: l.color });
      }
    }

    // Lighthouse beams.
    const beams: Array<{ x: number; y: number; angle: number; len: number; spread: number }> = [];
    {
      const lhb = map.buildings.find((b) => b.kind === 'lighthouse')!;
      const spr = Sprites.building(lhb);
      const lx = lhb.x * TILE + spr.ox + spr.img.width / 2 - cx;
      const ly = (lhb.y + lhb.h) * TILE - spr.img.height + spr.oy + 26 - cy;
      if (this.dark > 0.3) for (const off of [0, Math.PI]) beams.push({ x: lx, y: ly, angle: this.time * 0.42 + off, len: 560, spread: 0.1 });
    }

    // Crops.
    for (const key of soilKeys) {
      const k = Number(key);
      const x = k % map.w;
      const y = (k - x) / map.w;
      if (x < tx0 - 1 || x > tx1 + 1 || y < ty0 - 1 || y > ty1 + 2) continue;
      const crop = input.soil[k].crop;
      if (!crop) continue;
      const def = getCrop(crop.id);
      const step = cropStep(crop);
      let track = this.cropSteps.get(k);
      if (!track || track.step !== step) {
        track = { step, prev: track && track.step < step ? track.step : step, t: 0 };
        this.cropSteps.set(k, track);
      }
      track.t = Math.min(1, track.t + 1 / 60 / 1.2);
      const img = crop.dead ? Sprites.deadCrop(def.form === 'vine' || def.form === 'stalk' || def.form === 'tall') : Sprites.crop(crop.id, step);
      const prevImg = !crop.dead && track.prev !== step && track.t < 1 ? Sprites.crop(crop.id, track.prev) : null;
      const sx = x * TILE + 8 - CROP_W / 2 - cx;
      const sy = y * TILE + 13 - (CROP_H - 3) - cy;
      // Gentle sway for tall plants in the wind.
      const sway = step >= 5 && (def.form === 'stalk' || def.form === 'grain' || def.form === 'tall') ? Math.round(Math.sin(this.time * 1.8 + x * 0.9) * input.weather.wind * 1.2) : 0;
      drawables.push({
        y: y * TILE + 12,
        draw: () => {
          if (prevImg) {
            ctx.globalAlpha = 1 - track!.t;
            ctx.drawImage(prevImg, sx, sy);
            ctx.globalAlpha = track!.t;
          }
          if (sway) {
            ctx.drawImage(img, 0, 22, CROP_W, CROP_H - 22, sx, sy + 22, CROP_W, CROP_H - 22);
            ctx.drawImage(img, 0, 0, CROP_W, 22, sx + sway, sy, CROP_W, 22);
          } else ctx.drawImage(img, sx, sy);
          ctx.globalAlpha = 1;
        },
      });
    }

    // Placed objects.
    const covers: PlacedObject[] = [];
    for (const p of input.placed) {
      const bx = p.x * TILE;
      const by = p.y * TILE;
      if (p.kind === 'cover') {
        covers.push(p);
        const post = Sprites.rainCover().post;
        for (const [dx, dy] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ])
          drawables.push({ y: (p.y + dy) * TILE + 14, draw: () => ctx.drawImage(post, (p.x + dx) * TILE + 6 - cx, (p.y + dy) * TILE + 14 - 18 - cy) });
        continue;
      }
      if (SPRINKLERS.has(p.kind)) {
        const img = Sprites.sprinkler(Number(p.kind.slice(-1)) as 1 | 2 | 3);
        drawables.push({ y: by + 12, draw: () => ctx.drawImage(img, bx - cx, by - cy) });
        continue;
      }
      // Machines: animate while working, show what's ready in a bobbing bubble.
      const working = !!p.work && input.now < p.work.ready;
      const ready = (!!p.work && input.now >= p.work.ready) || (p.kind === 'harvester' && !!p.store?.some((s) => s));
      let state = 0;
      if (p.kind === 'furnace' && working) state = 1 + (Math.floor(this.time * 6) % 3);
      else if ((p.kind === 'compost' || p.kind === 'jar') && p.work) state = 1;
      else if (p.kind === 'seedmaker' && working) state = Math.floor(this.time * 6) % 4;
      else if (p.kind === 'harvester') state = Math.floor(this.time * 2) % 4;
      const img = Sprites.machine(p.kind, p.id, state);
      shadow(bx + 8, by + 14, 6, 2);
      drawables.push({
        y: by + 14,
        draw: () => {
          ctx.drawImage(img, bx + 8 - Math.floor(img.width / 2) - cx, by + TILE - img.height - cy);
          if (ready) {
            const out = p.work?.out[0]?.id ?? p.store?.find((s) => s)?.id;
            if (out) this.bubble(ctx, Sprites.icon(out), bx + 8 - cx, by + TILE - img.height - 4 - cy);
          }
        },
      });
      if (p.kind === 'furnace' && working) {
        lights.push({ x: bx + 8 - cx, y: by + 8 - cy, r: 26, color: '#ffa040' });
        if (Math.random() < 0.05) this.particles.spawn({ kind: 'smoke', x: bx + 12, y: by - 8, vy: -10, max: 2, color: '#9a9aa8' });
      }
      if ((p.kind === 'keg' || p.kind === 'jar' || p.kind === 'compost') && working && Math.random() < 0.02)
        this.particles.spawn({ kind: 'sparkle', x: bx + 4 + Math.random() * 8, y: by - 2, vy: -8, max: 0.8, color: p.kind === 'compost' ? '#c8e0a0' : '#ffffff' });
      if (p.kind === 'beehouse' && !input.raining && this.dark < 0.3 && Math.random() < 0.04)
        this.particles.spawn({ x: bx + 8, y: by + 2, vx: (Math.random() - 0.5) * 30, vy: -10, max: 1.5, color: '#f5d040' });
    }

    // Quarry outcrops.
    for (const key of Object.keys(input.nodes)) {
      const k = Number(key);
      const ox = (k % map.w) * TILE;
      const oy = Math.floor(k / map.w) * TILE;
      if (ox < cx - TILE || oy < cy - TILE || ox > cx + vw + TILE || oy > cy + vh + TILE) continue;
      const img = Sprites.outcrop(input.nodes[k], k);
      shadow(ox + 8, oy + 13, 7, 2);
      drawables.push({ y: oy + 12, draw: () => ctx.drawImage(img, ox + 8 - Math.floor(img.width / 2) - cx, oy + TILE - img.height - cy) });
    }

    // Ship.
    const shipVisible = input.shipPresent || this.ship !== null;
    if (shipVisible) {
      const spr = Sprites.ship(input.cargo);
      let dx = 0;
      let alpha = 1;
      if (this.ship?.mode === 'leave') {
        dx = this.ship.t * this.ship.t * 6;
        alpha = Math.max(0, 1 - Math.max(0, this.ship.t - 6) / 3);
      } else if (this.ship?.mode === 'arrive') {
        const t = Math.min(1, this.ship.t / 7);
        dx = (1 - (1 - (1 - t) ** 3)) * 300;
        alpha = Math.min(1, this.ship.t / 2);
      }
      if (input.shipPresent || this.ship?.mode === 'leave') {
        const bob = Math.round(Math.sin(this.time * 1.1) * 1);
        const sx = map.ship.x * TILE - 6 + dx - cx;
        const sy = (map.ship.y + map.ship.h) * TILE - spr.img.height + 8 + bob - cy;
        drawables.push({
          y: (map.ship.y + map.ship.h) * TILE,
          draw: () => {
            ctx.globalAlpha = alpha;
            ctx.drawImage(spr.img, Math.round(sx), sy);
            ctx.globalAlpha = 1;
          },
        });
        if (lit) {
          nightOverlays.push([spr.night, Math.round(sx), sy]);
          lights.push({ x: sx + 20, y: sy + 89, r: 34, color: '#ffd98a', a: alpha });
        }
      }
    }

    // Farm debris.
    for (const key of Object.keys(input.debris)) {
      const k = Number(key);
      const dx = (k % map.w) * TILE;
      const dy = Math.floor(k / map.w) * TILE;
      if (dx < cx - TILE || dy < cy - TILE || dx > cx + vw + TILE || dy > cy + vh + TILE) continue;
      const kind = input.debris[k];
      const frame = kind === 'weed' && Math.sin(this.time * 1.8 + k) * wind > 0.15 ? 1 : 0;
      const img = Sprites.debris(kind, k, frame, season);
      if (kind !== 'weed') shadow(dx + 8, dy + 13, 6, 1.8);
      drawables.push({ y: dy + (kind === 'weed' ? 9 : 12), draw: () => ctx.drawImage(img, dx - cx, dy + TILE - img.height - cy) });
    }

    // Forage: gentle glint so it reads as something to pick up.
    for (const key of Object.keys(input.forage)) {
      const k = Number(key);
      const fx = (k % map.w) * TILE;
      const fy = Math.floor(k / map.w) * TILE;
      if (fx < cx - TILE || fy < cy - TILE || fx > cx + vw + TILE || fy > cy + vh + TILE) continue;
      const img = Sprites.forage(input.forage[k]);
      const glint = (this.time * 0.6 + k * 0.137) % 3;
      drawables.push({
        y: fy + 8,
        draw: () => {
          ctx.drawImage(img, fx - cx, fy + TILE - img.height + 1 - cy);
          if (glint < 0.25) {
            const gx = fx + 11 - cx;
            const gy = fy - 1 - cy;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(gx, gy - 1, 1, 3);
            ctx.fillRect(gx - 1, gy, 3, 1);
          }
        },
      });
    }

    // Players.
    for (const pl of input.players) {
      const sheet = Sprites.character(pl.look);
      const frame = pl.moving ? Math.floor(pl.animT * 10) % 6 : 0;
      const breathing = Math.floor((this.time + pl.x * 0.01) / 0.9) % 2 === 1;
      const img = pl.swing
        ? pl.swing.t < 0.35
          ? sheet.raise[pl.dir]
          : sheet.strike[pl.dir]
        : pl.carrying > 0
          ? sheet.carry[pl.dir][pl.moving ? frame : 0]
          : pl.moving
            ? sheet.walk[pl.dir][frame]
            : pl.blink
              ? sheet.blink[pl.dir]
              : breathing
                ? sheet.breathe[pl.dir]
                : sheet.idle[pl.dir];
      const px = Math.round(pl.x - CHAR_W / 2 - cx);
      const py = Math.round(pl.y - CHAR_H + 1 - cy);
      shadow(pl.x, pl.y, 5, 1.8);
      drawables.push({
        y: pl.y,
        draw: () => {
          const tool = pl.swing ? Sprites.icon(pl.swing.item) : null;
          const toolPos = () => {
            const t = pl.swing!.t;
            const raise = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
            switch (pl.dir) {
              case 'down':
                return [px + 5, py + 4 + Math.round((1 - raise) * 10) - 6];
              case 'up':
                return [px + 2, py - 6 + Math.round((1 - raise) * 4)];
              case 'left':
                return [px - 8 + Math.round((1 - raise) * 2), py + 2 + Math.round((1 - raise) * 8) - 4];
              default:
                return [px + 8 - Math.round((1 - raise) * 2), py + 2 + Math.round((1 - raise) * 8) - 4];
            }
          };
          if (tool && pl.dir === 'up') {
            const [tx, ty] = toolPos();
            ctx.drawImage(tool, tx, ty);
          }
          ctx.drawImage(img, px, py);
          if (tool && pl.dir !== 'up') {
            const [tx, ty] = toolPos();
            ctx.drawImage(tool, tx, ty);
          }
          if (pl.carrying > 0) {
            const bob = pl.moving && (frame === 1 || frame === 4) ? 1 : 0;
            const crate = Sprites.crate('#e8836b');
            for (let i = 0; i < Math.min(pl.carrying, 4); i++) ctx.drawImage(crate, px, py - 11 - i * 9 + bob);
          }
        },
      });
      if (lit) lights.push({ x: pl.x - cx, y: pl.y - 10 - cy, r: 40, color: '#ffe6b0', a: 0.55 });
    }

    drawables.push(...this.critters.groundDrawables(ctx, cx, cy));
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();
    this.critters.drawAir(ctx, cx, cy);

    // Rain covers over everything below them.
    for (const p of covers) {
      const { canopy } = Sprites.rainCover();
      ctx.globalAlpha = 0.82;
      ctx.drawImage(canopy, (p.x - 1) * TILE - 1 - cx, (p.y - 1) * TILE - 14 - cy);
      ctx.globalAlpha = 1;
    }

    this.particles.draw(ctx, cx, cy, false);

    // 6. Lighting.
    for (const p of this.particles.list) if (p.kind === 'firefly') lights.push({ x: p.x - cx, y: p.y - cy, r: 8, color: '#e8ff80', a: 0.8 });
    this.lighting.apply(ctx, vw, vh, this.ambient, this.dark, lights, beams);
    if (lit) {
      ctx.globalAlpha = Math.min(1, (this.dark - 0.22) * 2);
      for (const [img, x, y] of nightOverlays) ctx.drawImage(img, x, y);
      ctx.globalAlpha = 1;
    }
    this.particles.draw(ctx, cx, cy, true);

    // 7. Weather on top.
    this.weatherFx.draw(ctx, vw, vh, input.weather, input.raining, this.dark, cx, cy);
  }
}
