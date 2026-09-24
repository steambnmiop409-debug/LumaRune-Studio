import {
  HOTBAR_SIZE,
  REACH_PX,
  SHOPS,
  TILE,
  Terrain,
  ZONE_NAME,
  findCrop,
  getCrop,
  getItem,
  isPrecipitating,
  isReady,
  seasonOf,
  cropStage,
  allNpcPoses,
  NPC_BY_ID,
  npcAt,
  MACHINE_NAME,
  NODE_NAME,
  timeLeft,
  debrisBlocks,
  inGreenhouse,
  NPC_SPEED,
  MS_PER_GAME_MINUTE,
  GIFTABLE,
  mineFloor,
  MINE_THEME_NAME,
  MINE_DEPTH,
  type Dir,
  type GameEvent,
  type InteractKind,
  type WorldState,
  type ZoneId,
} from '@lumina/core';
import { Sprites } from '../art/Sprites';
import { P } from '../art/palette';
import type { Game } from '../engine/Game';
import type { Scene } from '../engine/Scene';
import { approach } from '../engine/math';
import { drawText, measure } from '../engine/text';
import { ClientWorld } from '../net/ClientWorld';
import type { Connection } from '../net/Connection';
import { WorldView, type ViewInput, type ViewPlayer } from '../render/WorldView';
import { MineView, type MineViewInput } from '../render/MineView';
import { SEASON_TRACK, type Sfx } from '../audio/AudioManager';
import { Hud } from '../ui/Hud';
import { formatGold } from '../ui/kit';
import { DaySummaryPanel, JournalPanel, LiftPanel, RepairPanel, PackingPanel, PauseMenu, ShopPanel, SleepDialog, type Panel } from '../ui/panels';
import { TitleScene } from './TitleScene';
import { BoardPanel, DialoguePanel } from '../ui/social';
import { ChestPanel, CraftPanel } from '../ui/crafting';

const SPEED = 88;
const SWING_TIME = 0.32;

interface Pickup {
  img: HTMLCanvasElement;
  x: number;
  y: number;
  t: number;
  label: string;
}

const INTERACT_LABEL: Record<InteractKind, string> = {
  seedShop: SHOPS.seedShop.name,
  toolShop: SHOPS.toolShop.name,
  ship: '화물선',
  packing: '포장대',
  bed: '잠자리에 들기',
  well: '우물에서 물 긷기',
  board: '마을 게시판',
  workbench: '작업대',
  cave: '동굴 입구',
  greenhouse: '낡은 온실 고치기',
};

export class GameScene implements Scene {
  private game!: Game;
  private world: ClientWorld;
  private view: WorldView;
  private mine: MineView;
  /** Mine floor shown last frame (to announce arrivals). */
  private shownFloor = 0;
  private hud = new Hud();
  private panel: Panel | null = null;
  private px: number;
  private py: number;
  private dir: Dir = 'down';
  private moving = false;
  private animT = 0;
  private swing: { item: string; t: number } | null = null;
  private moveT = 0;
  private lastSent = '';
  private stepT = 0;
  private blinkT = 3;
  private pickups: Pickup[] = [];
  /** Things leaving the hands: a gift to a villager, produce into a machine, a seed into the soil. */
  private offers: Array<{ img: HTMLCanvasElement; x0: number; y0: number; x1: number; y1: number; t: number; dur: number; small: boolean }> = [];
  /** What was in hand when the last item was used (the server's reply may come after the slot empties). */
  private lastUsed: string | null = null;
  private zone: ZoneId = 0;
  private pausedSent = false;
  private target = { x: 0, y: 0 };
  private time = 0;
  private cursorPulse = 0;
  private useHeld = 0;
  private npcAnim = new Map<string, number>();

  constructor(
    private conn: Connection,
    you: string,
    state: WorldState,
  ) {
    this.world = new ClientWorld(you, state);
    this.view = new WorldView(this.world.map);
    this.mine = new MineView(state.seed, this.view.particles);
    this.px = this.world.self.x;
    this.py = this.world.self.y;
    this.hud.setGoldInstant(this.world.gold);
    conn.onMessage = (m) => this.world.apply(m);
  }

  enter(game: Game): void {
    this.game = game;
    const { width, height } = game.screen;
    this.view.centerOn(this.px, this.py - 12, width, height);
    this.hud.toast(`${this.world.self.farmName}에 오신 걸 환영해요!`, 'good');
    if (this.world.clock.day === 0) {
      this.hud.toast('괭이로 밭을 갈고 씨앗을 심어 보세요.', 'info');
      this.hud.toast('수확물은 포장대에서 상자에 담아 부두의 배로!', 'info');
    }
    game.audio.preload(['hoe', 'water', 'plant', 'harvest', 'pop', 'coin', 'click', 'step_grass', 'step_path', 'crate', 'open']);
  }

  exit(): void {
    this.conn.close();
  }

  /** Dev/test hook: send a raw message to the server. */
  debugSend(m: Parameters<Connection['send']>[0]): void {
    this.send(m);
  }

  private send(m: Parameters<Connection['send']>[0]) {
    this.conn.send(m);
  }

  // ── Collision & targeting ──────────────────────────────────────────────

  /** Mine floor the local player is on (0 = the island). */
  private get floor(): number {
    return this.world.self?.floor ?? 0;
  }

  private blockedAt(x: number, y: number): boolean {
    if (this.floor) return this.blockedInMine(x, y);
    const map = this.world.map;
    for (const [ox, oy] of [
      [-4, -3],
      [4, -3],
      [-4, 0],
      [4, 0],
    ]) {
      const tx = Math.floor((x + ox) / TILE);
      const ty = Math.floor((y + oy) / TILE);
      if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
      if (map.solid[ty * map.w + tx]) return true;
      if (this.world.placed.some((p) => p.x === tx && p.y === ty)) return true;
      if (debrisBlocks(this.world.state.debris[ty * map.w + tx])) return true;
      if (this.world.state.nodes[ty * map.w + tx]) return true;
      const crop = this.world.soil[ty * map.w + tx]?.crop;
      if (crop && !crop.dead && getCrop(crop.id).trellis && cropStage(crop) >= 1) return true;
    }
    return false;
  }

  private blockedInMine(x: number, y: number): boolean {
    const f = mineFloor(this.world.state.seed, this.floor);
    const rocks = this.world.state.mine.rocks[this.floor] ?? {};
    for (const [ox, oy] of [
      [-4, -3],
      [4, -3],
      [-4, 0],
      [4, 0],
    ]) {
      const tx = Math.floor((x + ox) / TILE);
      const ty = Math.floor((y + oy) / TILE);
      if (tx < 0 || ty < 0 || tx >= f.w || ty >= f.h) return true;
      const k = ty * f.w + tx;
      if (f.solid[k] || rocks[k]) return true;
    }
    return false;
  }

  private inReach(tx: number, ty: number, extra = 0): boolean {
    return Math.hypot(tx * TILE + 8 - this.px, ty * TILE + 8 - (this.py - 4)) <= REACH_PX + extra;
  }

  private facingTile(): { x: number; y: number } {
    const fx = Math.floor(this.px / TILE);
    const fy = Math.floor((this.py - 3) / TILE);
    const d = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[this.dir];
    return { x: fx + d[0], y: fy + d[1] };
  }

  private computeTarget() {
    const input = this.game.input;
    const cam = this.floor ? this.mine : this.view;
    const mx = Math.floor((input.mouseX + Math.round(cam.camX)) / TILE);
    const my = Math.floor((input.mouseY + Math.round(cam.camY)) / TILE);
    const mouseActive = performance.now() - input.mouseMovedAt < 3000 && !this.game.ui.hovering;
    this.target = mouseActive && this.inReach(mx, my) ? { x: mx, y: my } : this.facingTile();
  }

  /** The interactable the E key would use right now, if any. */
  /** In the mine: the ladder up or down within reach, if any. */
  private mineCandidate(): { kind: 'up' | 'down'; x: number; y: number } | null {
    const f = mineFloor(this.world.state.seed, this.floor);
    const ladder = this.world.state.mine.ladders[this.floor];
    const spots: Array<{ kind: 'up' | 'down'; x: number; y: number }> = [{ kind: 'up', x: f.up.x, y: f.up.y }];
    if (ladder !== undefined) spots.push({ kind: 'down', x: ladder % f.w, y: Math.floor(ladder / f.w) });
    return spots.find((s) => this.inReach(s.x, s.y, 10) || (s.kind === 'up' && this.inReach(s.x, s.y + 1, 6))) ?? null;
  }

  private interactCandidate(): { kind: InteractKind; x: number; y: number } | null {
    let best: { kind: InteractKind; x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const it of this.world.map.interactables) {
      if (!this.inReach(it.x, it.y, 6)) continue;
      // Once restored, the glasshouse door is just a doorway (it must not steal E from the beds beside it).
      if (it.kind === 'greenhouse' && this.world.state.greenhouse) continue;
      const d = Math.hypot(it.x - this.target.x, it.y - this.target.y);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }

  // ── Update ─────────────────────────────────────────────────────────────

  update(dt: number): void {
    this.time += dt;
    const game = this.game;
    const input = game.input;
    const world = this.world;
    const self = world.self;
    if (!self) return;

    if (world.correction) {
      this.px = world.correction.x;
      this.py = world.correction.y;
      world.correction = null;
    }

    for (const e of world.events.splice(0)) this.onEvent(e);

    // Panels.
    if (this.panel) {
      this.panel.update?.(dt);
      if (input.wasPressed('cancel') || (this.panel instanceof JournalPanel && (input.wasPressed('journal') || input.wasPressed('map')))) this.panel.closed = true;
      if (this.panel.closed) {
        this.panel = null;
        game.audio.play('close', { volume: 0.5 });
      }
    } else {
      this.handleWorldInput(dt);
    }
    const wantPause = !!this.panel?.pauses;
    if (wantPause !== this.pausedSent) {
      this.pausedSent = wantPause;
      this.send({ t: 'pause', on: wantPause });
    }

    // Swing animation.
    if (this.swing) {
      this.swing.t += dt / SWING_TIME;
      if (this.swing.t >= 1) this.swing = null;
    }
    this.blinkT -= dt;
    if (this.blinkT < -0.14) this.blinkT = 2.5 + Math.random() * 3;

    // Network: position.
    this.moveT -= dt;
    const key = `${Math.round(this.px)},${Math.round(this.py)},${this.dir},${this.moving}`;
    if (this.moveT <= 0 && key !== this.lastSent) {
      this.moveT = 0.05;
      this.lastSent = key;
      this.send({ t: 'move', x: this.px, y: this.py, dir: this.dir, moving: this.moving });
    }

    // Remote players glide toward their reported positions.
    for (const o of world.others.values()) {
      o.rx = approach(o.rx, o.x, 12, dt);
      o.ry = approach(o.ry, o.y, 12, dt);
      if (o.moving) o.animT += dt;
    }

    // Camera (snaps on arrival at a new floor, glides otherwise).
    const { width: vw, height: vh } = game.screen;
    const tx = this.px - vw / 2;
    const ty = this.py - 12 - vh / 2;
    const floor = this.floor;
    const arrived = floor !== this.shownFloor;
    const cam = floor ? this.mine : this.view;
    cam.camX = arrived ? tx : approach(cam.camX, tx, 8, dt);
    cam.camY = arrived ? ty : approach(cam.camY, ty, 8, dt);
    if (floor) this.mine.clamp(mineFloor(world.state.seed, floor), vw, vh);
    else this.view.centerOn(this.view.camX + vw / 2, this.view.camY + vh / 2, vw, vh);
    if (arrived) {
      this.shownFloor = floor;
      this.zone = 0;
      if (floor) this.hud.showBanner(`광산 ${floor}층 · ${MINE_THEME_NAME[mineFloor(world.state.seed, floor).theme]}`);
    }

    // Zone banner.
    const tileZ = floor ? 0 : (world.map.zone[Math.floor(this.py / TILE) * world.map.w + Math.floor(this.px / TILE)] as ZoneId);
    if (tileZ && tileZ !== this.zone) {
      this.zone = tileZ;
      this.hud.showBanner(ZONE_NAME[tileZ]);
    }

    // Pickups.
    for (const p of this.pickups) p.t += dt;
    for (const o of this.offers) o.t += dt / o.dur;
    this.offers = this.offers.filter((o) => o.t < 1);
    this.pickups = this.pickups.filter((p) => p.t < 1.1);

    // Villagers' walk cycles, paced to their strolling speed (the player's cycle is 10 frames/s at 88 px/s).
    if (!floor)
      for (const n of allNpcPoses(world.map, world.minute(!!this.panel?.pauses)))
        if (n.moving) this.npcAnim.set(n.id, (this.npcAnim.get(n.id) ?? 0) + dt * ((NPC_SPEED * TILE) / (MS_PER_GAME_MINUTE / 1000) / SPEED));
    this.hud.update(dt, world.gold);
    if (floor) this.mine.update(dt, this.mineInput(), vw, vh);
    else this.view.update(dt, this.viewInput(), vw, vh);
    this.updateSound(dt);
  }

  private handleWorldInput(dt: number) {
    const game = this.game;
    const input = game.input;
    const world = this.world;
    const self = world.self;

    for (let i = 0; i < HOTBAR_SIZE; i++) if (input.keyPressed(`Digit${(i + 1) % 10}`)) this.select(i);
    if (input.wheel && !game.ui.hovering) this.select((self.sel + (input.wheel > 0 ? 1 : HOTBAR_SIZE - 1)) % HOTBAR_SIZE);
    if (input.wasPressed('journal')) this.open(new JournalPanel(world, (m) => this.send(m), game.audio, 'bag'));
    if (input.wasPressed('map')) this.open(new JournalPanel(world, (m) => this.send(m), game.audio, 'map'));
    if (input.wasPressed('cancel')) this.open(new PauseMenu(game.audio, () => this.quit()));
    if (import.meta.env.DEV) {
      if (input.keyPressed('F1')) this.send({ t: 'debug', cmd: 'weather', arg: (['clear', 'cloudy', 'rain', 'storm', 'fog', 'snow'].indexOf(world.weather.kind) + 1) % 6 });
      if (input.keyPressed('F2')) this.send({ t: 'debug', cmd: 'skip', arg: 60 });
      if (input.keyPressed('F3')) this.send({ t: 'debug', cmd: 'grow' });
      if (input.keyPressed('F4')) this.send({ t: 'debug', cmd: 'gold', arg: 5000 });
    }

    // Movement.
    let mx = 0;
    let my = 0;
    if (!this.swing) {
      if (input.isDown('left')) mx -= 1;
      if (input.isDown('right')) mx += 1;
      if (input.isDown('up')) my -= 1;
      if (input.isDown('down')) my += 1;
    }
    this.moving = mx !== 0 || my !== 0;
    if (this.moving) {
      if (Math.abs(mx) > Math.abs(my) || (mx && my && (this.dir === 'left' || this.dir === 'right'))) this.dir = mx < 0 ? 'left' : 'right';
      else if (my) this.dir = my < 0 ? 'up' : 'down';
      if (mx && my && !(this.dir === 'left' || this.dir === 'right')) this.dir = my < 0 ? 'up' : 'down';
      const len = Math.hypot(mx, my);
      const run = input.isDown('run') && self.stamina > 0 ? 1.35 : 1;
      const speed = SPEED * run * (self.carrying.length ? 0.8 : 1);
      const dx = (mx / len) * speed * dt;
      const dy = (my / len) * speed * dt;
      if (!this.blockedAt(this.px + dx, this.py)) this.px += dx;
      if (!this.blockedAt(this.px, this.py + dy)) this.py += dy;
      this.animT += dt;
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.3 / run;
        this.footstep();
      }
    } else this.animT = 0;

    this.computeTarget();
    const ui = game.ui;
    const useDown = (input.mousePressed[0] && !ui.hovering) || input.wasPressed('use');
    const interactDown = (input.mousePressed[2] && !ui.hovering) || input.wasPressed('interact');
    const useHeld = (input.mouseDown[0] && !ui.hovering) || input.isDown('use');
    this.useHeld = useHeld ? this.useHeld + dt : 0;
    if (useDown && !this.swing) this.useSelected();
    else if (this.useHeld > 0.35 && !this.swing) this.useSelected();
    if (interactDown) {
      // A villager right where we're looking wins over a nearby counter; otherwise use the nearest interactable.
      const cand = this.floor ? this.mineCandidate() : this.interactCandidate();
      const npcHere = !this.floor && npcAt(world.map, world.clock.minute, this.target.x, this.target.y);
      const t = npcHere && !(cand && cand.x === this.target.x && cand.y === this.target.y) ? this.target : (cand ?? this.target);
      this.send({ t: 'interact', tx: t.x, ty: t.y });
    }
  }

  private select(i: number) {
    this.send({ t: 'select', slot: i });
    this.world.self.sel = i;
    this.game.audio.play('click', { volume: 0.3, rate: 1.3 });
  }

  private useSelected() {
    const self = this.world.self;
    const stack = self.inv[self.sel];
    if (!stack) return;
    const def = getItem(stack.id);
    // Face the target.
    const dx = this.target.x * TILE + 8 - this.px;
    const dy = this.target.y * TILE + 8 - (this.py - 4);
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx < 0 ? 'left' : 'right';
    else this.dir = dy < 0 ? 'up' : 'down';
    this.lastUsed = stack.id;
    if (def.kind === 'tool') {
      this.swing = { item: stack.id, t: 0 };
      if (def.tool !== 'can') this.game.audio.play('swing', { volume: 0.5, rate: def.tool === 'pick' ? 0.85 : 1 });
    }
    this.send({ t: 'useItem', slot: self.sel, tx: this.target.x, ty: this.target.y });
  }

  private open(p: Panel) {
    this.panel = p;
    this.game.audio.play('open', { volume: 0.55 });
  }

  private quit() {
    this.send({ t: 'pause', on: false });
    this.game.setScene(new TitleScene());
  }

  /** What the ground underfoot sounds like: tilled soil, sand, snow, stone, boards, leaves or grass. */
  private groundSound(): Sfx {
    if (this.floor) return mineFloor(this.world.state.seed, this.floor).theme === 0 ? 'step_path' : 'step_stone';
    const map = this.world.map;
    const tx = Math.floor(this.px / TILE);
    const ty = Math.floor(this.py / TILE);
    const k = ty * map.w + tx;
    const t = map.terrain[k];
    const season = seasonOf(this.world.clock.day);
    if (t === Terrain.Dock || t === Terrain.Bridge) return 'step_wood';
    if (this.world.soil[k] || (this.world.state.greenhouse && inGreenhouse(map, tx, ty))) return 'step_soil';
    if (t === Terrain.Cobble || t === Terrain.Rock || t === Terrain.Stairs || t === Terrain.Cliff) return season === 3 && t !== Terrain.Cobble ? 'step_snow' : 'step_stone';
    if (t === Terrain.Sand) return 'step_sand';
    if (season === 3) return 'step_snow';
    if (t === Terrain.Path) return 'step_path';
    if (t === Terrain.Forest && season === 2) return 'step_leaves';
    return 'step_grass';
  }

  private footstep() {
    const audio = this.game.audio;
    const kind = this.groundSound();
    audio.play(kind, { volume: kind === 'step_soil' || kind === 'step_sand' ? 0.42 : 0.35 });
    if (this.floor) {
      if (Math.random() < 0.5) this.view.particles.burst(this.px, this.py - 1, 2, ['#8a7a6a', '#6a5a4a'], 8, 5, 0, 0.35);
      return;
    }
    const dust: Partial<Record<Sfx, string[]>> = { step_sand: ['#f0e0b8', '#dcc690'], step_path: ['#d8b888', '#b8986a'], step_soil: ['#8a5a3a', '#6e4630'], step_snow: ['#ffffff', '#e2eaf3'], step_leaves: ['#e0923a', '#c85a3a'] };
    const colors = dust[kind];
    if (colors) this.view.particles.burst(this.px, this.py - 1, kind === 'step_leaves' ? 3 : 2, colors, 10, 6, 0, 0.35);
    // Puddles underfoot in the rain.
    if (isPrecipitating(this.world.weather, this.world.clock.minute) && this.world.weather.kind !== 'snow' && kind !== 'step_wood' && kind !== 'step_stone') {
      this.view.particles.spawn({ kind: 'splash', x: this.px, y: this.py, max: 0.3, color: '#b8d8f0' });
      if (Math.random() < 0.6) audio.play('step_splash', { volume: 0.3 });
    }
  }

  // ── Events from the server ─────────────────────────────────────────────

  private onEvent(e: GameEvent) {
    const audio = this.game.audio;
    const ps = this.view.particles;
    const me = this.world.me;
    switch (e.t) {
      case 'toast':
        this.hud.toast(e.text, e.tone ?? 'info');
        if (e.tone === 'warn') audio.play('error', { volume: 0.5 });
        break;
      case 'openShop':
        audio.play('door', { volume: 0.5 });
        this.panel = new ShopPanel(e.shop, e.stock, this.world, (m) => this.send(m), audio);
        break;
      case 'openPacking':
        this.open(new PackingPanel(this.world, (m) => this.send(m)));
        break;
      case 'sleepPrompt':
        this.open(new SleepDialog(() => this.send({ t: 'sleep' })));
        break;
      case 'fx': {
        if ((e.floor ?? 0) !== this.floor && e.kind !== 'ladder') break;
        const x = e.x * TILE + 8;
        const y = e.y * TILE + 10;
        const pan = (x - ((this.floor ? this.mine.camX : this.view.camX) + this.game.screen.width / 2)) / 300;
        if (e.kind === 'till' || e.kind === 'clear') {
          ps.burst(x, y, 10, e.kind === 'clear' ? ['#6a9a4a', '#8ab85a', '#8a5a3a'] : ['#8a5a3a', '#a87a52', '#6e4630'], 40, 40, 160, 0.5);
          const held = this.world.self.inv[this.world.self.sel];
          audio.play(e.kind === 'clear' && held && getItem(held.id).tool === 'scythe' ? 'scythe' : 'hoe', { pan });
        } else if (e.kind === 'break') {
          ps.burst(x, y - 2, 12, ['#b0a898', '#8f8a86', '#d0c8bc'], 55, 50, 220, 0.55);
          audio.play('pick', { pan, rate: 1.1 });
          audio.play('crate', { pan, volume: 0.5, rate: 1.4, delay: 0.03 });
        } else if (e.kind === 'mine') {
          ps.burst(x, y - 4, 16, ['#b0a898', '#8f8a86', '#d0c8bc', '#6a6670'], 70, 60, 240, 0.6);
          audio.play('pick', { pan });
          audio.play('crate', { pan, volume: 0.6, rate: 1.6, delay: 0.04 });
        } else if (e.kind === 'restore') {
          for (let i = 0; i < 40; i++) ps.spawn({ kind: 'sparkle', x: x - 60 + Math.random() * 120, y: y - 50 + Math.random() * 70, vy: -10, max: 1 + Math.random(), color: i % 3 ? '#cfeef4' : '#ffffff' });
          audio.play('chime', { volume: 0.8 });
          audio.play('coin', { rate: 0.8, delay: 0.1 });
        } else if (e.kind === 'ladder') {
          audio.play('ladder', { volume: 0.7 });
          if (e.by !== me) ps.burst(x, y - 4, 10, ['#d8c8a8', '#a89878'], 30, 30, 120, 0.5);
        } else if (e.kind === 'load') {
          if (e.by === me && this.lastUsed) this.offer(this.lastUsed, x, y - 8, 0.35);
          audio.play('crate', { pan, volume: 0.55, rate: 1.1 });
          ps.burst(x, y - 8, 6, ['#fff4d0', '#e8d8b0'], 20, 30, 100, 0.4);
        } else if (e.kind === 'chop') {
          ps.burst(x, y - 2, 9, ['#8a5a3a', '#d8b07a', '#6a9a4a'], 45, 45, 200, 0.5);
          audio.play('crate', { pan, volume: 0.6, rate: 1.2 });
        } else if (e.kind === 'water') {
          for (let i = 0; i < 10; i++) ps.spawn({ x: x - 5 + Math.random() * 10, y: y - 10, vx: (Math.random() - 0.5) * 20, vy: 20 + Math.random() * 30, g: 200, max: 0.4, color: i % 2 ? '#8ad0f0' : '#d8f0ff' });
          audio.play('water', { pan });
        } else if (e.kind === 'refill') {
          ps.burst(x, y, 12, ['#a8e0f8', '#ffffff'], 30, 40, 150, 0.6);
          audio.play('refill', { pan });
        } else if (e.kind === 'plant') {
          if (e.by === me && this.lastUsed) this.offer(this.lastUsed, x, y - 2, 0.22, true);
          ps.burst(x, y, 5, ['#8a5a3a', '#6fb85a'], 20, 20, 120, 0.4);
          audio.play('plant', { pan });
        } else if (e.kind === 'fert' || e.kind === 'tonic') {
          for (let i = 0; i < 6; i++) ps.spawn({ kind: 'sparkle', x: x - 6 + Math.random() * 12, y: y - 8 + Math.random() * 8, vy: -8, max: 0.7, color: e.kind === 'tonic' ? '#9af0a8' : '#fff0a0' });
          audio.play('fert', { pan });
        } else if (e.kind === 'place' || e.kind === 'pickup') audio.play('crate', { pan, volume: 0.7 });
        break;
      }
      case 'harvest': {
        const def = findCrop(e.cropId)!;
        const x = e.x * TILE + 8;
        const y = e.y * TILE + 4;
        this.pickups.push({ img: Sprites.icon(`crop.${def.id}`), x, y, t: 0, label: `+${e.qty}` });
        if (e.giant) {
          ps.burst(x, y, 30, [def.produceColor, def.leafColor, '#8a5a3a'], 90, 70, 200, 0.8);
          if (e.by === me) audio.play('harvest', { rate: 0.6, volume: 1 });
        }
        for (let i = 0; i < 4 + e.q * 2; i++) ps.spawn({ kind: 'sparkle', x: x - 8 + Math.random() * 16, y: y - 10 + Math.random() * 10, vy: -12, max: 0.6 + Math.random() * 0.4, color: e.q >= 4 ? '#ffe070' : '#ffffff' });
        ps.burst(x, y + 4, 6, ['#8a5a3a', def.leafColor], 30, 30, 150, 0.4);
        if (e.by === me) {
          audio.play('pop');
          audio.play('harvest', { delay: 0.05, volume: 0.8, rate: 0.9 + e.q * 0.05 });
        }
        break;
      }
      case 'shipLoaded':
        audio.play('crate');
        if (e.by === me) this.hud.toast(`출하 상자 ${e.crates}개를 배에 실었어요.`, 'good');
        break;
      case 'shipDeparted':
        this.view.shipLeaves();
        audio.play('horn', { volume: 0.9 });
        if (e.record.total > 0) this.hud.toast(`배가 출항했어요! 오늘의 출하 ${formatGold(e.record.total)}`, 'good');
        else this.hud.toast('배가 출항했어요. 내일 아침 6시에 돌아와요.', 'info');
        break;
      case 'shipArrived':
        this.view.shipArrives();
        audio.play('bell', { volume: 0.6, delay: 2 });
        break;
      case 'dayStart':
        this.panel = new DaySummaryPanel(e.summary);
        this.swing = null;
        audio.play('chime', { volume: 0.7 });
        break;
      case 'dialogue':
        if (e.gift && this.lastUsed) {
          const npc = allNpcPoses(this.world.map, this.world.minute(false)).find((n) => n.id === e.npc);
          if (npc) this.offer(this.lastUsed, npc.x, npc.y - 18, 0.4);
        }
        audio.play('pop', { volume: 0.5, rate: 1.2 });
        this.panel = new DialoguePanel(this.world, e.npc, e.text, e.gift);
        if (e.gift === 'loved') for (let i = 0; i < 10; i++) ps.spawn({ kind: 'sparkle', x: this.px - 10 + Math.random() * 20, y: this.py - 30 + Math.random() * 10, vy: -14, max: 0.9, color: '#ff9ab0' });
        break;
      case 'openBoard':
        this.open(new BoardPanel(this.world, (m) => this.send(m)));
        break;
      case 'forage':
        this.pickups.push({ img: Sprites.icon(e.item), x: e.x * TILE + 8, y: e.y * TILE + 4, t: 0, label: '+1' });
        audio.play('pop');
        break;
      case 'openCraft':
        this.open(new CraftPanel(this.world, (m) => this.send(m), audio));
        break;
      case 'openChest':
        this.open(new ChestPanel(this.world, e.id, (m) => this.send(m), audio));
        break;
      case 'crafted':
        audio.play('coin', { rate: 1.3, volume: 0.6 });
        audio.play('crate', { volume: 0.5, delay: 0.05 });
        if (this.panel instanceof CraftPanel) this.panel.crafted();
        this.hud.toast(`${getItem(e.item).name}${e.qty > 1 ? ` ×${e.qty}` : ''} 제작!`, 'good', Sprites.icon(e.item));
        break;
      case 'gain':
        this.pickups.push({ img: Sprites.icon(e.item), x: e.x * TILE + 8, y: e.y * TILE + 4, t: Math.random() * 0.1, label: `+${e.qty}` });
        break;
      case 'saved':
        this.hud.toast('저장했어요', 'info');
        break;
      case 'openRepair':
        this.open(new RepairPanel(this.world, () => this.send({ t: 'repair' })));
        break;
      case 'openLift':
        this.open(new LiftPanel(e.floors, (f) => this.send({ t: 'lift', floor: f })));
        break;
      case 'bought':
        audio.play('coin');
        this.hud.toast(`${getItem(e.item).name} ×${e.qty} 구매 (${formatGold(e.gold)})`, 'good', Sprites.icon(e.item));
        break;
    }
  }

  // ── Sound bed ──────────────────────────────────────────────────────────

  private soundT = 0;
  private updateSound(dt: number) {
    this.soundT -= dt;
    if (this.soundT > 0) return;
    this.soundT = 0.5;
    const audio = this.game.audio;
    const world = this.world;
    const map = world.map;
    const m = world.clock.minute;
    const w = world.weather;
    const raining = isPrecipitating(w, m);
    if (this.floor) {
      // Underground: no sky, only a cold draft through the tunnels.
      for (const a of ['sea', 'rain', 'birds', 'crickets', 'wind'] as const) audio.ambience(a, 0);
      audio.ambience('cave', 0.85);
      audio.playMusic('mine');
      return;
    }
    const tx = Math.floor(this.px / TILE);
    const ty = Math.floor(this.py / TILE);
    let sea = 0;
    let n = 0;
    for (let y = ty - 14; y <= ty + 14; y += 2)
      for (let x = tx - 18; x <= tx + 18; x += 2) {
        if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
        const t = map.terrain[y * map.w + x];
        if (t === Terrain.Sea || t === Terrain.Deep) sea++;
        n++;
      }
    const season = seasonOf(world.clock.day);
    audio.ambience('cave', 0);
    audio.ambience('sea', Math.min(1, 0.15 + (sea / n) * 1.8));
    audio.ambience('rain', raining && (w.kind === 'rain' || w.kind === 'storm') ? (w.kind === 'storm' ? 1 : 0.75) : 0);
    audio.ambience('wind', w.kind === 'storm' ? 0.8 : season === 3 || w.wind > 0.4 ? 0.35 : 0.08);
    audio.ambience('birds', !raining && m >= 330 && m < 1080 && season !== 3 ? 0.55 : 0);
    audio.ambience('crickets', !raining && (m >= 1170 || m < 300) && (season === 1 || season === 2) ? 0.5 : 0);
    audio.playMusic(raining ? 'rain' : m < 1020 ? SEASON_TRACK[season] : m < 1200 ? 'evening' : 'night');
  }

  // ── Render ─────────────────────────────────────────────────────────────

  private viewInput(): ViewInput {
    const world = this.world;
    const minute = world.minute(!!this.panel?.pauses);
    const players: ViewPlayer[] = [this.selfView()];
    for (const n of allNpcPoses(world.map, minute))
      players.push({ id: n.id, look: NPC_BY_ID.get(n.id)!.look, x: Math.round(n.x), y: Math.round(n.y), dir: n.dir, moving: n.moving, animT: this.npcAnim.get(n.id) ?? 0, carrying: 0 });
    for (const o of world.others.values())
      if (!o.floor) players.push({ id: o.id, look: o.look, x: Math.round(o.rx), y: Math.round(o.ry), dir: o.dir, moving: o.moving, animT: o.animT, carrying: o.carrying, name: o.name, held: o.held });
    return {
      minute,
      day: world.clock.day,
      weather: world.weather,
      raining: isPrecipitating(world.weather, minute),
      soil: world.soil,
      placed: world.placed,
      shipPresent: world.shipPresent,
      cargo: world.cargo,
      players,
      forage: world.state.forage,
      debris: world.state.debris,
      nodes: world.state.nodes,
      now: world.clock.day * 1440 + Math.floor(minute),
      greenhouse: world.state.greenhouse,
      boardFresh: !!world.state.request && !world.state.request.done,
    };
  }

  private selfView(): ViewPlayer {
    const self = this.world.self;
    return {
      id: self.id,
      look: self.look,
      x: Math.round(this.px),
      y: Math.round(this.py),
      dir: this.dir,
      moving: this.moving,
      animT: this.animT,
      carrying: self.carrying.length,
      swing: this.swing,
      blink: this.blinkT < 0,
      held: self.inv[self.sel]?.id ?? null,
    };
  }

  private mineInput(): MineViewInput {
    const world = this.world;
    const floor = this.floor;
    const players: ViewPlayer[] = [this.selfView()];
    for (const o of world.others.values())
      if (o.floor === floor) players.push({ id: o.id, look: o.look, x: Math.round(o.rx), y: Math.round(o.ry), dir: o.dir, moving: o.moving, animT: o.animT, carrying: o.carrying, name: o.name, held: o.held });
    return { floor, minute: world.minute(!!this.panel?.pauses), rocks: world.state.mine.rocks[floor] ?? {}, ladder: world.state.mine.ladders[floor], players };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const game = this.game;
    const { width: vw, height: vh } = game.screen;
    const ui = game.ui;
    const world = this.world;
    const self = world.self;
    if (!self) return;
    if (this.floor) {
      this.renderMine(ctx, vw, vh);
      return;
    }
    const input = this.viewInput();
    this.view.render(ctx, vw, vh, input);
    const cx = Math.round(this.view.camX);
    const cy = Math.round(this.view.camY);

    // Other players' name tags.
    for (const o of world.others.values()) if (!o.floor) drawText(ctx, o.name, Math.round(o.rx - cx), Math.round(o.ry - 44 - cy), { font: 'small', color: P.paperLight, outline: P.ink, align: 'center' });

    for (const p of input.players) {
      const npc = NPC_BY_ID.get(p.id);
      if (npc && Math.hypot(p.x - this.px, p.y - this.py) < 64) drawText(ctx, npc.name, p.x - cx, p.y - 44 - cy, { font: 'small', color: P.paperLight, outline: P.ink, align: 'center' });
    }

    this.drawPickups(ctx, cx, cy);
    if (!this.panel) {
      // Target brackets.
      const held = self.inv[self.sel];
      const tx = this.target.x;
      const ty = this.target.y;
      const soil = world.soil[ty * world.map.w + tx];
      const ready = soil?.crop && isReady(soil.crop);
      const color = ready ? P.brassLight : held ? P.paperLight : 'rgba(0,0,0,0)';
      if (held || ready) {
        this.cursorPulse = (this.cursorPulse + 1 / 60) % 1;
        const pulse = Math.round(Math.sin(this.time * 6) * 1);
        const img = Sprites.cursor(color);
        ctx.drawImage(img, tx * TILE - 2 - pulse - cx, ty * TILE - 2 - pulse - cy, 20 + pulse * 2, 20 + pulse * 2);
      }
      // Interaction whisper.
      const cand = this.interactCandidate();
      let label: string | null = null;
      let lx = 0;
      let ly = 0;
      const npcHere = npcAt(world.map, world.clock.minute, tx, ty);
      const forageHere = world.state.forage[ty * world.map.w + tx];
      const placedHere = world.placed.find((q) => q.x === tx && q.y === ty);
      const nodeHere = world.state.nodes[ty * world.map.w + tx];
      if (npcHere) {
        const heldKind = held ? getItem(held.id).kind : null;
        const name = NPC_BY_ID.get(npcHere)!.name;
        label = heldKind && GIFTABLE.has(heldKind) ? `${name}와 대화 · 클릭: 선물` : `${name}와 대화`;
        lx = tx * TILE + 8 - cx;
        ly = ty * TILE - 30 - cy;
      } else if (placedHere && MACHINE_NAME[placedHere.kind]) {
        const name = MACHINE_NAME[placedHere.kind]!;
        const now = world.clock.day * 1440 + world.clock.minute;
        const w = placedHere.work;
        const stored = placedHere.store?.some((st) => st);
        label =
          placedHere.kind === 'chest'
            ? `${name} 열기`
            : w && now >= w.ready
              ? `${name} · ${getItem(w.out[0].id).name} 꺼내기`
              : w
                ? `${name} · ${timeLeft(w.ready - now)} 남음`
                : placedHere.kind === 'harvester'
                  ? stored
                    ? `${name} · 수확물 꺼내기`
                    : `${name} · 내일 아침 수확`
                  : placedHere.kind === 'beehouse'
                    ? `${name} · 꿀 모으는 중`
                    : `${name} · 재료를 들고 사용`;
        lx = tx * TILE + 8 - cx;
        ly = ty * TILE - 22 - cy;
      } else if (nodeHere) {
        label = `${NODE_NAME[nodeHere as keyof typeof NODE_NAME]} · 곡괭이로 캐기`;
        lx = tx * TILE + 8 - cx;
        ly = ty * TILE - 8 - cy;
      } else if (forageHere) {
        label = `${getItem(forageHere).name} 줍기`;
        lx = tx * TILE + 8 - cx;
        ly = ty * TILE - 6 - cy;
      } else if (cand && !(cand.kind === 'greenhouse' && world.state.greenhouse)) {
        label = cand.kind === 'ship' ? (self.carrying.length ? `상자 ${self.carrying.length}개 싣기` : world.shipPresent ? '화물선 (상자를 들고 오세요)' : '배는 내일 아침에') : INTERACT_LABEL[cand.kind];
        lx = cand.x * TILE + 8 - cx;
        ly = cand.y * TILE - 6 - cy;
        if (cand.kind === 'seedShop' || cand.kind === 'toolShop' || cand.kind === 'bed') ly = cand.y * TILE - 26 - cy;
      } else if (ready) {
        label = `${findCrop(soil!.crop!.id)?.name} 수확`;
        lx = tx * TILE + 8 - cx;
        ly = ty * TILE - 18 - cy;
      }
      if (label) this.whisper(ctx, label, lx, ly);

      // Crop inspection bubble on hover.
      const mx = Math.floor((game.input.mouseX + cx) / TILE);
      const my = Math.floor((game.input.mouseY + cy) / TILE);
      const hs = world.soil[my * world.map.w + mx];
      if (hs?.crop && !ui.hovering && performance.now() - game.input.mouseMovedAt < 2000) this.inspect(hs, game.input.mouseX, game.input.mouseY);
    }

    this.drawHud(ctx, vw, vh, input.minute);
  }

  /** Sends an item from the hands to (x, y) in world pixels; `small` shrinks it on the way (a seed going in). */
  private offer(id: string, x: number, y: number, dur: number, small = false) {
    this.offers.push({ img: Sprites.icon(id), x0: this.px, y0: this.py - 14, x1: x, y1: y, t: 0, dur, small });
  }

  /** Items flying from where they were gathered into the player's bag, and out of the hands to where they go. */
  private drawPickups(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    for (const o of this.offers) {
      const k = 1 - (1 - o.t) * (1 - o.t);
      const x = o.x0 + (o.x1 - o.x0) * k;
      const y = o.y0 + (o.y1 - o.y0) * k - Math.sin(o.t * Math.PI) * 10;
      const size = o.small ? Math.max(4, Math.round(16 * (1 - o.t * 0.7))) : 16;
      ctx.drawImage(o.img, Math.round(x - size / 2 - cx), Math.round(y - size / 2 - cy), size, size);
    }
    for (const p of this.pickups) {
      const t = p.t;
      let x = p.x;
      let y = p.y;
      if (t < 0.45) y -= Math.sin((t / 0.45) * Math.PI) * 14 + t * 10;
      else {
        const k = (t - 0.45) / 0.65;
        x = p.x + (this.px - p.x) * k;
        y = p.y - 5 + (this.py - 20 - (p.y - 5)) * k;
      }
      ctx.drawImage(p.img, Math.round(x - 8 - cx), Math.round(y - 8 - cy));
      if (t < 0.8) drawText(ctx, p.label, Math.round(p.x + 8 - cx), Math.round(p.y - 22 - cy), { font: 'small', color: P.white, outline: P.ink });
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D, vw: number, vh: number, minute: number) {
    const world = this.world;
    const self = world.self;
    const ui = this.game.ui;
    const departed = !world.shipPresent;
    this.hud.skyDial(ui, vw, minute, world.clock.day, world.weather, world.forecast, world.shipPresent, departed, world.gold, this.time);
    this.hud.hotbar(ui, vw, vh, self, (i) => this.select(i));
    this.hud.stamina(ui, vw, vh, self);
    this.hud.carrying(ui, vw, vh, self.carrying, self.cart);
    this.hud.drawToasts(ui, vw);
    this.hud.drawBanner(ui, vw, vh);
    drawText(ctx, 'Tab 일지 · M 지도 · Esc 메뉴', 6, vh - 12, { font: 'small', color: P.paperLight, outline: P.ink });
    if (this.panel) this.panel.draw(ui, vw, vh);
  }

  /** Underground: the floor, pickups, the target bracket and ladder / rock hints, then the HUD. */
  private renderMine(ctx: CanvasRenderingContext2D, vw: number, vh: number) {
    const world = this.world;
    const self = world.self;
    const input = this.mineInput();
    this.mine.render(ctx, vw, vh, input);
    const cx = Math.round(this.mine.camX);
    const cy = Math.round(this.mine.camY);
    for (const o of world.others.values()) if (o.floor === this.floor) drawText(ctx, o.name, Math.round(o.rx - cx), Math.round(o.ry - 44 - cy), { font: 'small', color: P.paperLight, outline: P.ink, align: 'center' });
    this.drawPickups(ctx, cx, cy);
    if (!this.panel) {
      const held = self.inv[self.sel];
      const tx = this.target.x;
      const ty = this.target.y;
      if (held) {
        const pulse = Math.round(Math.sin(this.time * 6) * 1);
        ctx.drawImage(Sprites.cursor(P.paperLight), tx * TILE - 2 - pulse - cx, ty * TILE - 2 - pulse - cy, 20 + pulse * 2, 20 + pulse * 2);
      }
      const f = mineFloor(world.state.seed, this.floor);
      const rock = input.rocks[ty * f.w + tx];
      const cand = this.mineCandidate();
      if (rock) this.whisper(ctx, `${NODE_NAME[rock as keyof typeof NODE_NAME]} · 곡괭이로 캐기`, tx * TILE + 8 - cx, ty * TILE - 8 - cy);
      else if (cand?.kind === 'up') this.whisper(ctx, '사다리 타고 지상으로', cand.x * TILE + 8 - cx, cand.y * TILE - 6 - cy);
      else if (cand?.kind === 'down') this.whisper(ctx, this.floor >= MINE_DEPTH ? '가장 깊은 곳이에요' : `${this.floor + 1}층으로 내려가기`, cand.x * TILE + 8 - cx, cand.y * TILE - 6 - cy);
    }
    this.drawHud(ctx, vw, vh, input.minute);
  }

  private whisper(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
    const w = measure(text, 'small') + 22;
    const bx = Math.round(x - w / 2);
    const by = Math.round(y - 16 + Math.sin(this.time * 3) * 1);
    ctx.fillStyle = P.ink;
    ctx.fillRect(bx, by, w, 15);
    ctx.fillStyle = P.paperLight;
    ctx.fillRect(bx + 1, by + 1, w - 2, 13);
    ctx.fillRect(Math.round(x) - 1, by + 15, 3, 1);
    ctx.fillStyle = P.ink;
    ctx.fillRect(Math.round(x), by + 15, 1, 2);
    // Keycap.
    ctx.fillStyle = P.ink;
    ctx.fillRect(bx + 3, by + 2, 11, 11);
    ctx.fillStyle = P.brassLight;
    ctx.fillRect(bx + 4, by + 3, 9, 8);
    drawText(ctx, 'E', bx + 8, by + 2, { font: 'small', align: 'center' });
    drawText(ctx, text, bx + 17, by + 2, { font: 'small' });
  }

  private inspect(soil: import('@lumina/core').SoilState, x: number, y: number) {
    const crop = soil.crop!;
    const def = getCrop(crop.id);
    const lines: Array<{ text: string; font?: 'body' | 'small' | 'bold'; color?: string }> = [{ text: def.name, font: 'bold' }];
    if (crop.dead) lines.push({ text: crop.dead === 'frost' ? '서리에 시들었어요' : crop.dead === 'rot' ? '비를 너무 맞아 짓물렀어요' : '물이 부족해 말랐어요', font: 'small', color: P.coralDark });
    else if (crop.dormant) lines.push({ text: '휴면 중 (기온이 맞지 않아요)', font: 'small' });
    else if (isReady(crop)) lines.push({ text: '수확할 수 있어요!', font: 'small', color: P.tealDark });
    else {
      const left = Math.max(0, Math.ceil(def.growDays - crop.growth));
      lines.push({ text: `수확까지 약 ${left}일`, font: 'small' });
    }
    if (!crop.dead) {
      const thirsty = soil.dayMax < [0, 25, 45, 65][def.water];
      lines.push({ text: thirsty ? '목말라요 — 물을 주세요' : '물 충분', font: 'small', color: thirsty ? P.coralDark : P.inkSoft });
      if (crop.soggy > 0) lines.push({ text: '비를 많이 맞았어요', font: 'small', color: P.coralDark });
      if (crop.stress > 1) lines.push({ text: `스트레스 ${crop.stress.toFixed(1)}`, font: 'small', color: P.brassDark });
    }
    this.game.ui.tooltip(lines, x + 12, y + 12);
  }
}
