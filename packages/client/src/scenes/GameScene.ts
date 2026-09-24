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
import { Hud } from '../ui/Hud';
import { formatGold } from '../ui/kit';
import { DaySummaryPanel, JournalPanel, PackingPanel, PauseMenu, ShopPanel, SleepDialog, type Panel } from '../ui/panels';
import { TitleScene } from './TitleScene';
import { BoardPanel, DialoguePanel } from '../ui/social';

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
};

export class GameScene implements Scene {
  private game!: Game;
  private world: ClientWorld;
  private view: WorldView;
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

  private blockedAt(x: number, y: number): boolean {
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
      const crop = this.world.soil[ty * map.w + tx]?.crop;
      if (crop && !crop.dead && getCrop(crop.id).trellis && cropStage(crop) >= 1) return true;
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
    const mx = Math.floor((input.mouseX + Math.round(this.view.camX)) / TILE);
    const my = Math.floor((input.mouseY + Math.round(this.view.camY)) / TILE);
    const mouseActive = performance.now() - input.mouseMovedAt < 3000 && !this.game.ui.hovering;
    this.target = mouseActive && this.inReach(mx, my) ? { x: mx, y: my } : this.facingTile();
  }

  /** The interactable the E key would use right now, if any. */
  private interactCandidate(): { kind: InteractKind; x: number; y: number } | null {
    let best: { kind: InteractKind; x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const it of this.world.map.interactables) {
      if (!this.inReach(it.x, it.y, 6)) continue;
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

    // Camera.
    const { width: vw, height: vh } = game.screen;
    const tx = this.px - vw / 2;
    const ty = this.py - 12 - vh / 2;
    this.view.camX = approach(this.view.camX, tx, 8, dt);
    this.view.camY = approach(this.view.camY, ty, 8, dt);
    this.view.centerOn(this.view.camX + vw / 2, this.view.camY + vh / 2, vw, vh);

    // Zone banner.
    const tileZ = world.map.zone[Math.floor(this.py / TILE) * world.map.w + Math.floor(this.px / TILE)] as ZoneId;
    if (tileZ && tileZ !== this.zone) {
      this.zone = tileZ;
      this.hud.showBanner(ZONE_NAME[tileZ]);
    }

    // Pickups.
    for (const p of this.pickups) p.t += dt;
    this.pickups = this.pickups.filter((p) => p.t < 1.1);

    this.hud.update(dt, world.gold);
    this.view.update(dt, this.viewInput(), vw, vh);
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
      const cand = this.interactCandidate();
      const t = cand ?? this.target;
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
    if (def.kind === 'tool') this.swing = { item: stack.id, t: 0 };
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

  private footstep() {
    const map = this.world.map;
    const t = map.terrain[Math.floor(this.py / TILE) * map.w + Math.floor(this.px / TILE)];
    const kind = t === Terrain.Dock || t === Terrain.Bridge ? 'step_wood' : t === Terrain.Path || t === Terrain.Cobble || t === Terrain.Sand || t === Terrain.Rock ? 'step_path' : 'step_grass';
    this.game.audio.play(kind, { volume: 0.35 });
    if (t === Terrain.Path || t === Terrain.Sand)
      this.view.particles.burst(this.px, this.py - 1, 2, t === Terrain.Sand ? ['#f0e0b8', '#dcc690'] : ['#d8b888', '#b8986a'], 10, 6, 0, 0.35);
    if (isPrecipitating(this.world.weather, this.world.clock.minute) && this.world.weather.kind !== 'snow')
      this.view.particles.spawn({ kind: 'splash', x: this.px, y: this.py, max: 0.3, color: '#b8d8f0' });
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
        const x = e.x * TILE + 8;
        const y = e.y * TILE + 10;
        const pan = (x - (this.view.camX + this.game.screen.width / 2)) / 300;
        if (e.kind === 'till' || e.kind === 'clear') {
          ps.burst(x, y, 10, ['#8a5a3a', '#a87a52', '#6e4630'], 40, 40, 160, 0.5);
          audio.play('hoe', { pan });
        } else if (e.kind === 'water') {
          for (let i = 0; i < 10; i++) ps.spawn({ x: x - 5 + Math.random() * 10, y: y - 10, vx: (Math.random() - 0.5) * 20, vy: 20 + Math.random() * 30, g: 200, max: 0.4, color: i % 2 ? '#8ad0f0' : '#d8f0ff' });
          audio.play('water', { pan });
        } else if (e.kind === 'refill') {
          ps.burst(x, y, 12, ['#a8e0f8', '#ffffff'], 30, 40, 150, 0.6);
          audio.play('refill', { pan });
        } else if (e.kind === 'plant') {
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
      case 'saved':
        this.hud.toast('저장했어요', 'info');
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
    audio.ambience('sea', Math.min(1, 0.15 + (sea / n) * 1.8));
    audio.ambience('rain', raining && (w.kind === 'rain' || w.kind === 'storm') ? (w.kind === 'storm' ? 1 : 0.75) : 0);
    audio.ambience('wind', w.kind === 'storm' ? 0.8 : season === 3 || w.wind > 0.4 ? 0.35 : 0.08);
    audio.ambience('birds', !raining && m >= 330 && m < 1080 && season !== 3 ? 0.55 : 0);
    audio.ambience('crickets', !raining && (m >= 1170 || m < 300) && (season === 1 || season === 2) ? 0.5 : 0);
    const track = raining ? 'rain' : m < 1020 ? 'day' : m < 1200 ? 'evening' : 'night';
    audio.playMusic(track);
  }

  // ── Render ─────────────────────────────────────────────────────────────

  private viewInput(): ViewInput {
    const world = this.world;
    const minute = world.minute(!!this.panel?.pauses);
    const self = world.self;
    const players: ViewPlayer[] = [
      {
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
      },
    ];
    for (const n of allNpcPoses(world.map, minute)) {
      const t = (this.npcAnim.get(n.id) ?? 0) + (n.moving ? 1 / 60 : 0);
      this.npcAnim.set(n.id, t);
      players.push({ id: n.id, look: NPC_BY_ID.get(n.id)!.look, x: Math.round(n.x), y: Math.round(n.y), dir: n.dir, moving: n.moving, animT: t, carrying: 0 });
    }
    for (const o of world.others.values())
      players.push({ id: o.id, look: o.look, x: Math.round(o.rx), y: Math.round(o.ry), dir: o.dir, moving: o.moving, animT: o.animT, carrying: o.carrying, name: o.name });
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
      boardFresh: !!world.state.request && !world.state.request.done,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const game = this.game;
    const { width: vw, height: vh } = game.screen;
    const ui = game.ui;
    const world = this.world;
    const self = world.self;
    if (!self) return;
    const input = this.viewInput();
    this.view.render(ctx, vw, vh, input);
    const cx = Math.round(this.view.camX);
    const cy = Math.round(this.view.camY);

    // Other players' name tags.
    for (const o of world.others.values()) drawText(ctx, o.name, Math.round(o.rx - cx), Math.round(o.ry - 44 - cy), { font: 'small', color: P.paperLight, outline: P.ink, align: 'center' });

    for (const p of input.players) {
      const npc = NPC_BY_ID.get(p.id);
      if (npc && Math.hypot(p.x - this.px, p.y - this.py) < 64) drawText(ctx, npc.name, p.x - cx, p.y - 44 - cy, { font: 'small', color: P.paperLight, outline: P.ink, align: 'center' });
    }

    // Pickups flying to the player.
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
      if (npcHere) {
        const heldKind = held ? getItem(held.id).kind : null;
        const name = NPC_BY_ID.get(npcHere)!.name;
        label = heldKind === 'produce' || heldKind === 'forage' ? `${name}와 대화 · 클릭: 선물` : `${name}와 대화`;
        lx = tx * TILE + 8 - cx;
        ly = ty * TILE - 30 - cy;
      } else if (forageHere) {
        label = `${getItem(forageHere).name} 줍기`;
        lx = tx * TILE + 8 - cx;
        ly = ty * TILE - 6 - cy;
      } else if (cand) {
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

    // HUD.
    const departed = !world.shipPresent;
    this.hud.skyDial(ui, vw, input.minute, world.clock.day, world.weather, world.forecast, world.shipPresent, departed, world.gold, this.time);
    this.hud.hotbar(ui, vw, vh, self, (i) => this.select(i));
    this.hud.stamina(ui, vw, vh, self);
    this.hud.carrying(ui, vw, vh, self.carrying, self.cart);
    this.hud.drawToasts(ui);
    this.hud.drawBanner(ui, vw, vh);
    drawText(ctx, 'Tab 일지 · M 지도 · Esc 메뉴', 6, vh - 12, { font: 'small', color: P.paperLight, outline: P.ink });

    if (this.panel) this.panel.draw(ui, vw, vh);
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
