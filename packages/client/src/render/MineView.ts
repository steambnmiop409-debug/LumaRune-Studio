import { MineCell, TILE, hash2, mineFloor, type MineFloor } from '@lumina/core';
import { Sprites } from '../art/Sprites';
import { MINE_PAL } from '../art/sprites/mine';
import { actorFrame, actorPos, drawActor } from './actors';
import { Lighting, sunAt, type Light } from './Lighting';
import type { Particles } from './Particles';
import type { ViewPlayer } from './WorldView';

export interface MineViewInput {
  floor: number;
  minute: number;
  rocks: Record<number, string>;
  /** Tile key of the ladder down, once found. */
  ladder: number | undefined;
  players: ViewPlayer[];
}

interface Drawable {
  y: number;
  draw: () => void;
}

/** Things that hang on (or stand against) a wall face rather than sit on the floor. */
const WALL_PROPS = new Set(['torch', 'beam', 'crystal', 'icicle']);

/**
 * Renders one floor of the mine: the pre-drawn cave, its props, rocks and ladders, the miners,
 * and a lighting pass: a dim glow in the rock, torches on the walls, crystals, mushrooms and lava.
 */
export class MineView {
  private lighting = new Lighting();
  camX = 0;
  camY = 0;
  time = 0;
  private emitT = 0;

  constructor(
    private seed: number,
    readonly particles: Particles,
  ) {}

  floorOf(n: number): MineFloor {
    return mineFloor(this.seed, n);
  }

  /** Clamps the camera to the floor (centring floors smaller than the screen). */
  clamp(f: MineFloor, vw: number, vh: number): void {
    const W = f.w * TILE;
    const H = f.h * TILE;
    this.camX = W <= vw ? (W - vw) / 2 : Math.max(0, Math.min(W - vw, this.camX));
    this.camY = H <= vh ? (H - vh) / 2 : Math.max(0, Math.min(H - vh, this.camY));
  }

  update(dt: number, input: MineViewInput, vw: number, vh: number): void {
    this.time += dt;
    this.particles.update(dt, 0);
    const f = this.floorOf(input.floor);
    const pal = MINE_PAL[f.theme];
    this.emitT += dt;
    if (this.emitT < 0.1) return;
    this.emitT = 0;
    const me = input.players[0];
    // Dust drifting in the dim air.
    if (me && Math.random() < 0.5)
      this.particles.spawn({ kind: 'sparkle', x: me.x + (Math.random() - 0.5) * 120, y: me.y - 10 + (Math.random() - 0.5) * 80, vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2, max: 2.5, color: f.theme === 1 ? '#e0f0ff' : '#f0d8b0' });
    // Drips into pools, embers off the lava.
    const x0 = Math.floor(this.camX / TILE);
    const y0 = Math.floor(this.camY / TILE);
    for (let i = 0; i < 6; i++) {
      const tx = x0 + Math.floor(Math.random() * (vw / TILE + 1));
      const ty = y0 + Math.floor(Math.random() * (vh / TILE + 1));
      const c = f.cells[ty * f.w + tx];
      if (c === MineCell.Water && Math.random() < 0.3) this.particles.spawn({ kind: 'splash', x: tx * TILE + 8, y: ty * TILE + 8, max: 0.6, color: pal.pool[3] });
      if (c === MineCell.Lava && Math.random() < 0.6)
        this.particles.spawn({ x: tx * TILE + Math.random() * 16, y: ty * TILE + 6, vx: (Math.random() - 0.5) * 8, vy: -18 - Math.random() * 14, g: -4, max: 1.4, color: Math.random() < 0.5 ? '#ffd070' : '#ff7a2a' });
    }
    for (const p of f.props)
      if (p.kind === 'vent' && Math.random() < 0.15) this.particles.spawn({ kind: 'smoke', x: p.x * TILE + 8, y: p.y * TILE + 8, vy: -8, max: 1.8, color: '#6a4a4a' });
  }

  render(ctx: CanvasRenderingContext2D, vw: number, vh: number, input: MineViewInput): void {
    const f = this.floorOf(input.floor);
    const pal = MINE_PAL[f.theme];
    const cx = Math.round(this.camX);
    const cy = Math.round(this.camY);
    const t = this.time;
    ctx.fillStyle = '#07060a';
    ctx.fillRect(0, 0, vw, vh);
    ctx.drawImage(Sprites.mineFloor(f, this.seed), -cx, -cy);

    const lights: Light[] = [];
    const drawables: Drawable[] = [];
    const tx0 = Math.max(0, Math.floor(cx / TILE) - 2);
    const ty0 = Math.max(0, Math.floor(cy / TILE) - 2);
    const tx1 = Math.min(f.w - 1, Math.ceil((cx + vw) / TILE) + 2);
    const ty1 = Math.min(f.h - 1, Math.ceil((cy + vh) / TILE) + 2);
    const onScreen = (x: number, y: number) => x >= tx0 && x <= tx1 && y >= ty0 && y <= ty1;

    // Pools: glints on water, pulsing molten veins on lava.
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const c = f.cells[ty * f.w + tx];
        if (c === MineCell.Water) {
          const k = Math.floor(t * 1.4 + hash2(tx, ty, 3) * 10);
          if (hash2(tx, ty, k) < 0.08) {
            ctx.fillStyle = pal.pool[3];
            ctx.fillRect(tx * TILE + Math.floor(hash2(tx, ty, k + 1) * 13) - cx, ty * TILE + 3 + Math.floor(hash2(tx, ty, k + 2) * 11) - cy, 2, 1);
          }
        } else if (c === MineCell.Lava) {
          const glow = 0.5 + 0.5 * Math.sin(t * 2 + tx * 0.9 + ty * 1.3);
          ctx.globalAlpha = glow * 0.35;
          ctx.fillStyle = '#ffb040';
          ctx.fillRect(tx * TILE - cx, ty * TILE - cy, TILE, TILE);
          ctx.globalAlpha = 1;
          if ((tx + ty) % 2 === 0) lights.push({ x: tx * TILE + 8 - cx, y: ty * TILE + 8 - cy, r: 34, color: '#ff5a1a', a: 0.55 + glow * 0.25 });
        }
      }

    const shadow = (x: number, y: number, rx: number, ry: number, alpha = 70) => {
      const R = Math.max(1, Math.round(rx));
      const Rr = Math.max(1, Math.round(ry));
      ctx.drawImage(Sprites.shadowBlob(R, Rr, alpha), Math.round(x - R - cx), Math.round(y - Rr - cy));
    };

    // Props.
    for (const p of f.props) {
      if (!onScreen(p.x, p.y)) continue;
      const bx = p.x * TILE;
      const by = p.y * TILE;
      const frame = p.kind === 'torch' ? Math.floor(t * 8 + p.x) % 3 : p.kind === 'vent' ? (Math.sin(t * 3 + p.x) > 0 ? 1 : 0) : 0;
      const img = Sprites.mineProp(p.kind, f.theme, p.v, frame);
      if (WALL_PROPS.has(p.kind)) {
        // Anchored to the face of wall tile (x, y), standing on the floor tile below it.
        const foot = (p.y + 1) * TILE;
        const ix = p.kind === 'beam' ? bx : bx + 8 - Math.floor(img.width / 2);
        const iy = p.kind === 'icicle' ? (p.y - 1) * TILE + 3 : p.kind === 'torch' ? foot - img.height - 4 : foot - img.height + (p.kind === 'beam' ? 3 : 2);
        drawables.push({ y: foot - 8, draw: () => ctx.drawImage(img, ix - cx, iy - cy) });
        if (p.kind === 'torch') lights.push({ x: bx + 8 - cx, y: iy + 5 - cy, r: 64 + Math.sin(t * 9 + p.x) * 2 + Math.sin(t * 23 + p.y) * 1.5, color: '#ffa050', a: 0.9 });
        if (p.kind === 'crystal') lights.push({ x: bx + 8 - cx, y: foot - 8 - cy, r: 30, color: pal.glow, a: 0.6 + Math.sin(t * 1.5 + p.v) * 0.15 });
        continue;
      }
      const flat = p.kind === 'bones' || p.kind === 'vent';
      if (!flat) shadow(bx + 8, by + 14, 6, 2);
      const ix = bx + 8 - Math.floor(img.width / 2);
      const iy = by + TILE - img.height + (flat ? 3 : 0);
      drawables.push({ y: flat ? by : by + 14, draw: () => ctx.drawImage(img, ix - cx, iy - cy) });
      if (p.kind === 'mushroom') lights.push({ x: bx + 8 - cx, y: by + 8 - cy, r: 18, color: f.theme === 1 ? '#8ae0f0' : '#7af0c0', a: 0.55 + Math.sin(t * 1.2 + p.v) * 0.15 });
      if (p.kind === 'vent') lights.push({ x: bx + 8 - cx, y: by + 9 - cy, r: 22, color: '#ff7030', a: 0.5 + frame * 0.3 });
    }

    // The ladder up, with daylight (or moonlight) falling down the shaft.
    {
      const img = Sprites.mineProp('ladderUp', f.theme, 0);
      const foot = (f.up.y + 1) * TILE + 2;
      const ix = f.up.x * TILE + 8 - Math.floor(img.width / 2);
      drawables.push({ y: foot - 6, draw: () => ctx.drawImage(img, ix - cx, foot - img.height - cy) });
      const day = sunAt(input.minute, 'clear');
      lights.push({ x: f.up.x * TILE + 8 - cx, y: foot - 30 - cy, r: 50, color: day.moon ? '#8a9ad0' : '#fff0d0', a: day.moon ? 0.5 : 0.85 });
    }
    if (input.ladder !== undefined) {
      const lx = input.ladder % f.w;
      const ly = Math.floor(input.ladder / f.w);
      const img = Sprites.mineProp('ladderDown', f.theme, 0);
      drawables.push({ y: ly * TILE, draw: () => ctx.drawImage(img, lx * TILE - 1 - cx, ly * TILE - 1 - cy) });
    }

    // Rocks.
    for (const key of Object.keys(input.rocks)) {
      const k = Number(key);
      const ox = (k % f.w) * TILE;
      const oy = Math.floor(k / f.w) * TILE;
      if (!onScreen(k % f.w, Math.floor(k / f.w))) continue;
      const kind = input.rocks[k];
      const img = Sprites.outcrop(kind, k + input.floor * 7919, pal.tint);
      shadow(ox + 8, oy + 13, 7, 2);
      drawables.push({ y: oy + 12, draw: () => ctx.drawImage(img, ox + 8 - Math.floor(img.width / 2) - cx, oy + TILE - img.height - cy) });
      if (kind === 'gem') lights.push({ x: ox + 8 - cx, y: oy + 8 - cy, r: 12, color: '#c0a0ff', a: 0.4 + Math.sin(t * 2 + k) * 0.2 });
      if (kind !== 'stone' && hash2(k, Math.floor(t * 0.7), 9) < 0.02) this.particles.spawn({ kind: 'sparkle', x: ox + 4 + Math.random() * 10, y: oy + 2 + Math.random() * 8, max: 0.5, color: '#ffffff' });
    }

    // Miners.
    for (const pl of input.players) {
      const f = actorFrame(pl, t);
      const [px, py] = actorPos(pl, cx, cy);
      shadow(pl.x, pl.y, 5, 1.8, 80);
      drawables.push({ y: pl.y, draw: () => drawActor(ctx, pl, f, px, py) });
    }

    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();
    this.particles.draw(ctx, cx, cy, false);

    this.lighting.apply(ctx, vw, vh, pal.ambient, 1, lights, []);
    this.particles.draw(ctx, cx, cy, true);
    this.lighting.grade(ctx, vw, vh, sunAt(0, 'clear'), 0.55, 'clear');
  }
}
