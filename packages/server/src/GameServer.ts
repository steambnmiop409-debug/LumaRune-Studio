import {
  DAY_END,
  SLEEP_FROM,
  DEFAULT_WORLD_SEED,
  HOTBAR_SIZE,
  INVENTORY_SIZE,
  MS_PER_GAME_MINUTE,
  Rng,
  SHIP_DEPARTURE,
  TILE,
  advanceDay,
  deliverRequest,
  addItem,
  craft,
  chestMove,
  sortBackpack,
  splitStack,
  applyPrecipitationHour,
  buy,
  createPlayer,
  createWorldState,
  departShip,
  generateWorld,
  getCrop,
  mineFloor,
  rideLift,
  repairGreenhouse,
  tidyGreenhouse,
  newSoil,
  newCrop,
  enterMine,
  leaveMine,
  interact,
  makeSave,
  migrateSave,
  pack,
  sanitizeAppearance,
  swapSlots,
  useItem,
  type ClientMessage,
  type GameEvent,
  type PlayerPublic,
  type PlayerState,
  type ServerMessage,
  type SimContext,
  type WorldMap,
  type WorldState,
} from '@lumina/core';
import { SAVE_SLOTS, slotInfo, type SaveStore } from './persistence/SaveStore';

/** Real time between autosaves while anything is happening. */
const AUTOSAVE_MS = 30_000;

/** A connected client, whatever the transport (worker postMessage, WebSocket, test harness). */
export interface ClientLink {
  id: string;
  send(msg: ServerMessage): void;
}

interface Session {
  link: ClientLink;
  playerId: string | null;
  paused: boolean;
}

export interface GameServerOptions {
  store: SaveStore;
  seed?: number;
  /** Allow debug commands (time skip, gold). */
  debug?: boolean;
  /** Max players sharing one island. */
  maxPlayers?: number;
}

const TICK_INTERVAL_MS = 200;
/** Generous movement tolerance per `move` message (px). */
const MAX_MOVE_STEP = 72;

/**
 * Authoritative simulation. Owns the world state, advances time, validates every intent,
 * and tells clients what changed. Knows nothing about rendering or transports.
 */
export class GameServer {
  private sessions = new Map<string, Session>();
  private map: WorldMap | null = null;
  private state: WorldState | null = null;
  private rng = new Rng(1);
  private slot = -1;
  private acc = 0;
  private tickAcc = 0;
  private timeScale = 1;
  private dirtySoil = new Set<number>();
  private dirtyPlaced = false;
  private dirtySocial = false;
  private dirtyDebris = false;
  private dirtyPlayers = new Set<string>();
  private saving: Promise<void> = Promise.resolve();
  /** Real milliseconds since the last save, and whether anything happened since. */
  private sinceSave = 0;
  private changed = false;

  constructor(private opts: GameServerOptions) {}

  connect(link: ClientLink): void {
    this.sessions.set(link.id, { link, playerId: null, paused: false });
  }

  disconnect(linkId: string): void {
    const s = this.sessions.get(linkId);
    this.sessions.delete(linkId);
    if (s?.playerId && this.state) {
      const p = this.state.players[s.playerId];
      if (p) p.sleeping = false;
      void this.persist();
    }
  }

  /** Current world (read-only use: tests, tools). */
  get world(): WorldState | null {
    return this.state;
  }

  async handle(linkId: string, msg: ClientMessage): Promise<void> {
    const session = this.sessions.get(linkId);
    if (!session || !msg || typeof msg.t !== 'string') return;
    try {
      if (msg.t === 'listSaves') {
        const slots = [];
        for (let i = 0; i < SAVE_SLOTS; i++) slots.push(slotInfo(i, await this.opts.store.load(i)));
        session.link.send({ t: 'saves', slots });
        return;
      }
      if (msg.t === 'join') {
        await this.join(session, msg);
        return;
      }
      const p = this.playerOf(session);
      if (!p || !this.state || !this.map) return;
      if (msg.t === 'save') {
        await this.persist();
        return;
      }
      if (msg.t !== 'pause') this.changed = true;
      this.onPlayerMessage(session, p, msg);
      this.flush();
    } catch (err) {
      session.link.send({ t: 'error', reason: err instanceof Error ? err.message : String(err) });
    }
  }

  private playerOf(session: Session): PlayerState | null {
    return session.playerId && this.state ? (this.state.players[session.playerId] ?? null) : null;
  }

  private async join(session: Session, msg: Extract<ClientMessage, { t: 'join' }>) {
    const slot = Math.max(0, Math.min(SAVE_SLOTS - 1, msg.slot | 0));
    if (this.state && this.slot !== slot) {
      session.link.send({ t: 'error', reason: '이 서버는 다른 섬을 열고 있어요.' });
      return;
    }
    if (!this.state) {
      const saved = await this.opts.store.load(slot);
      if (saved && !msg.newGame) {
        const file = migrateSave(saved);
        this.state = file.state;
        this.rng = new Rng(1);
        this.rng.state = this.state.rngState;
      } else if (msg.newGame) {
        this.rng = new Rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
        const seed = this.opts.seed ?? DEFAULT_WORLD_SEED;
        this.map = generateWorld(seed);
        this.state = createWorldState(seed, this.rng, this.map);
      } else {
        session.link.send({ t: 'needCharacter', slot });
        return;
      }
      if (this.map?.seed !== this.state.seed) this.map = generateWorld(this.state.seed);
      // Older farms may have soil or debris where the glasshouse now stands.
      tidyGreenhouse(this.state, this.map);
      this.slot = slot;
    }
    const state = this.state!;
    const map = this.map!;

    let player: PlayerState | undefined;
    if (msg.newGame) {
      if (Object.keys(state.players).length >= (this.opts.maxPlayers ?? 4)) {
        session.link.send({ t: 'error', reason: '섬이 가득 찼어요.' });
        return;
      }
      const name = String(msg.newGame.name ?? '').trim().slice(0, 12) || '농부';
      const farmName = String(msg.newGame.farmName ?? '').trim().slice(0, 14) || '루미나 농장';
      const id = `p${Object.keys(state.players).length + 1}-${Math.floor(this.rng.next() * 1e6)}`;
      player = createPlayer(id, name, farmName, sanitizeAppearance(msg.newGame.look), map);
      state.players[id] = player;
      await this.persist();
    } else {
      const taken = new Set([...this.sessions.values()].map((s) => s.playerId));
      player = Object.values(state.players).find((p) => !taken.has(p.id));
      if (!player) {
        session.link.send({ t: 'needCharacter', slot });
        return;
      }
    }
    session.playerId = player.id;
    session.link.send({ t: 'welcome', you: player.id, state });
    this.sendTick();
  }

  private ctx(): SimContext {
    return {
      state: this.state!,
      map: this.map!,
      rng: this.rng,
      emit: (e, to) => this.emit(e, to),
      touchSoil: (k) => this.dirtySoil.add(k),
      touchPlaced: () => (this.dirtyPlaced = true),
      touchPlayer: (id) => this.dirtyPlayers.add(id),
      touchDebris: () => (this.dirtyDebris = true),
    };
  }

  private onPlayerMessage(session: Session, p: PlayerState, msg: ClientMessage) {
    const ctx = this.ctx();
    const fail = (reason: string | null) => {
      if (reason) this.emit({ t: 'toast', text: reason, tone: 'warn' }, p.id);
    };
    switch (msg.t) {
      case 'move':
        if (!this.move(p, msg.x, msg.y, msg.dir, msg.moving)) session.link.send({ t: 'correct', x: p.x, y: p.y });
        break;
      case 'select':
        if (Number.isInteger(msg.slot) && msg.slot >= 0 && msg.slot < HOTBAR_SIZE) {
          p.sel = msg.slot;
          this.dirtyPlayers.add(p.id);
        }
        break;
      case 'swap':
        if (Number.isInteger(msg.a) && Number.isInteger(msg.b) && msg.a < INVENTORY_SIZE && msg.b < INVENTORY_SIZE) {
          swapSlots(p.inv, msg.a, msg.b);
          this.dirtyPlayers.add(p.id);
        }
        break;
      case 'useItem':
        if (Number.isInteger(msg.slot) && msg.slot >= 0 && msg.slot < INVENTORY_SIZE) fail(useItem(ctx, p, msg.slot, msg.tx | 0, msg.ty | 0));
        break;
      case 'interact':
        fail(interact(ctx, p, msg.tx | 0, msg.ty | 0));
        break;
      case 'buy':
        fail(buy(ctx, p, msg.shop, String(msg.item), msg.qty | 0));
        break;
      case 'pack':
        fail(pack(ctx, p, msg.slot | 0, msg.qty | 0));
        break;
      case 'deliver':
        fail(deliverRequest(ctx, p));
        this.dirtySocial = true;
        break;
      case 'split':
        if (Number.isInteger(msg.from) && Number.isInteger(msg.to) && msg.from >= 0 && msg.to >= 0 && msg.from < INVENTORY_SIZE && msg.to < INVENTORY_SIZE) {
          splitStack(p.inv, msg.from, msg.to, msg.qty | 0);
          this.dirtyPlayers.add(p.id);
        }
        break;
      case 'sort':
        sortBackpack(p.inv);
        this.dirtyPlayers.add(p.id);
        break;
      case 'craft':
        fail(craft(ctx, p, String(msg.recipe)));
        break;
      case 'lift':
        fail(rideLift(ctx, p, msg.floor | 0));
        break;
      case 'repair':
        fail(repairGreenhouse(ctx, p));
        break;
      case 'chest':
        if (Number.isInteger(msg.slot) && msg.slot >= 0 && (msg.from === 'inv' || msg.from === 'chest')) fail(chestMove(ctx, p, msg.id | 0, msg.from, msg.slot));
        break;
      case 'sleep': {
        // Only at night, and only in bed (the client can't skip the day on its own).
        const bed = this.map!.interactables.find((i) => i.kind === 'bed');
        const atBed = !!bed && Math.hypot(bed.x * TILE + 8 - p.x, bed.y * TILE + 8 - (p.y - 4)) < 48 && !p.floor;
        if (this.state!.clock.minute < SLEEP_FROM || !atBed) break;
        p.sleeping = true;
        this.checkSleep();
        break;
      }
      case 'cancelSleep':
        p.sleeping = false;
        break;
      case 'pause':
        session.paused = !!msg.on;
        // Opening a menu is a natural moment to save.
        if (msg.on && this.changed) void this.persist();
        break;
      case 'debug':
        if (this.opts.debug) this.debug(p, msg.cmd, msg.arg);
        break;
    }
  }

  /** Returns false when the move was rejected and the client must be corrected. */
  private move(p: PlayerState, x: number, y: number, dir: PlayerState['dir'], moving: boolean): boolean {
    const map = this.map!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    const tooFar = Math.hypot(x - p.x, y - p.y) > MAX_MOVE_STEP;
    const grid = p.floor ? mineFloor(this.state!.seed, p.floor) : map;
    const blocked = tx < 0 || ty < 0 || tx >= grid.w || ty >= grid.h || grid.solid[ty * grid.w + tx] === 1;
    if (tooFar || blocked) return false;
    p.x = x;
    p.y = y;
    if (dir === 'down' || dir === 'up' || dir === 'left' || dir === 'right') p.dir = dir;
    p.moving = !!moving;
    return true;
  }

  private debug(p: PlayerState, cmd: string, arg?: number) {
    const state = this.state!;
    if (cmd === 'timeScale') this.timeScale = Math.max(0, Math.min(200, arg ?? 1));
    else if (cmd === 'gold') state.gold += arg ?? 1000;
    else if (cmd === 'skip') for (let i = 0; i < (arg ?? 60); i++) this.stepMinute();
    else if (cmd === 'sleep') this.nextDay(false);
    else if (cmd === 'day' && arg !== undefined) {
      state.clock.day = Math.max(0, arg | 0);
      this.dirtySocial = true;
    }
    else if (cmd === 'mine') {
      if (arg) enterMine(this.ctx(), p, arg);
      else leaveMine(this.ctx(), p);
    } else if (cmd === 'deepest' && arg !== undefined) state.mine.deepest = Math.max(0, arg | 0);
    else if (cmd === 'tp' && arg !== undefined) {
      // arg encodes a tile: y * 1000 + x
      p.x = (arg % 1000) * TILE + TILE / 2;
      p.y = Math.floor(arg / 1000) * TILE + TILE - 2;
      for (const s of this.sessions.values()) if (s.playerId === p.id) s.link.send({ t: 'correct', x: p.x, y: p.y });
    }
    else if (cmd === 'minute') state.clock.minute = Math.max(state.clock.minute, Math.min(DAY_END - 1, arg ?? state.clock.minute));
    else if (cmd === 'weather') {
      const kinds = ['clear', 'cloudy', 'rain', 'storm', 'fog', 'snow'] as const;
      const k = kinds[Math.max(0, Math.min(kinds.length - 1, arg ?? 0))];
      const wet = k === 'rain' || k === 'storm' || k === 'snow';
      state.weather = { ...state.weather, kind: k, precipStart: 0, precipEnd: wet ? DAY_END : 0, wind: k === 'storm' ? 0.9 : state.weather.wind };
    } else if (cmd === 'kit') {
      // Dev: a test kit for the crafting loop.
      for (const [id, n, q] of [
        ['tool.pick', 1],
        ['mat.wood', 400],
        ['mat.stone', 80],
        ['mat.fiber', 60],
        ['mat.coal', 20],
        ['ore.copper', 30],
        ['ore.iron', 20],
        ['bar.copper', 10],
        ['bar.iron', 10],
        ['gem.quartz', 3],
        ['crop.strawberry', 6, 3],
        ['crop.tomato', 6, 2],
      ] as Array<[string, number, number?]>)
        addItem(p.inv, id, n, q);
    } else if (cmd === 'greenhouse') {
      // Dev: restore (1) or ruin (0) the glasshouse; 2 also fills its bed with ripe crops.
      state.greenhouse = !!arg;
      const g = this.map!.greenhouse;
      if (arg === 2)
        for (let y = g.y + 1; y < g.y + g.h - 1; y++)
          for (let x = g.x + 1; x < g.x + g.w - 1; x++) {
            const id = ['strawberry', 'tomato', 'sunflower', 'eggplant', 'lavender', 'blueberry', 'watermelon'][(x + y) % 7];
            const k = y * this.map!.w + x;
            state.soil[k] = { ...newSoil(), moisture: 80, dayMax: 80, crop: { ...newCrop(id, state.clock.day), growth: 99 } };
            this.dirtySoil.add(k);
          }
      tidyGreenhouse(state, this.map!);
      this.dirtyDebris = true;
    } else if (cmd === 'giant' && arg !== undefined) {
      // Dev: a ripe giant pumpkin whose top-left tile is arg (y * 1000 + x).
      const x0 = arg % 1000;
      const y0 = Math.floor(arg / 1000);
      const anchor = y0 * this.map!.w + x0;
      for (let dy = 0; dy < 3; dy++)
        for (let dx = 0; dx < 3; dx++) {
          const k = anchor + dy * this.map!.w + dx;
          delete state.debris[k];
          state.soil[k] = { ...newSoil(), crop: { ...newCrop('pumpkin', 0), growth: 99, giant: anchor } };
          this.dirtySoil.add(k);
        }
      this.dirtyDebris = true;
    } else if (cmd === 'grow') {
      for (const s of Object.values(state.soil)) if (s.crop && !s.crop.dead) s.crop.growth = getCrop(s.crop.id).growDays;
      for (const k of Object.keys(state.soil)) this.dirtySoil.add(Number(k));
    }
    this.dirtyPlayers.add(p.id);
    this.sendTick();
  }

  /** Advance the simulation by `dtMs` real milliseconds. */
  update(dtMs: number): void {
    if (!this.state || !this.map) return;
    const active = [...this.sessions.values()].filter((s) => s.playerId);
    const paused = active.length > 0 && active.every((s) => s.paused);
    if (!paused) {
      this.changed = true;
      this.acc += dtMs * this.timeScale;
      let guard = 0;
      while (this.acc >= MS_PER_GAME_MINUTE && guard++ < 2000) {
        this.acc -= MS_PER_GAME_MINUTE;
        this.stepMinute();
      }
    }
    this.tickAcc += dtMs;
    if (this.tickAcc >= TICK_INTERVAL_MS) {
      this.tickAcc = 0;
      this.sendTick();
    }
    this.flush();
    // Autosave: never lose more than half a minute of play to a crash or a closed window.
    this.sinceSave += dtMs;
    if (this.sinceSave >= AUTOSAVE_MS && this.changed) void this.persist();
  }

  private stepMinute() {
    const state = this.state!;
    state.clock.minute += 1;
    const m = state.clock.minute;
    if (m % 60 === 0) for (const k of applyPrecipitationHour(state, this.map!)) this.dirtySoil.add(k);
    if (m === SHIP_DEPARTURE) {
      const record = departShip(state);
      this.emit({ t: 'shipDeparted', record: record ?? { day: state.clock.day, lines: [], total: 0 } }, 'all');
      for (const p of Object.values(state.players)) this.dirtyPlayers.add(p.id);
    }
    if (m >= DAY_END) this.nextDay(true);
  }

  private checkSleep() {
    const players = [...this.sessions.values()].map((s) => this.playerOf(s)).filter((p): p is PlayerState => !!p);
    if (players.length && players.every((p) => p.sleeping)) this.nextDay(false);
  }

  private nextDay(passedOut: boolean) {
    const state = this.state!;
    const wasDeparted = state.departedToday;
    const { summary, changed } = advanceDay(state, this.map!, this.rng, passedOut);
    if (!wasDeparted && summary.shipment) this.emit({ t: 'shipDeparted', record: summary.shipment }, 'all');
    for (const k of changed) this.dirtySoil.add(k);
    this.dirtyPlaced = true;
    this.dirtySocial = true;
    this.dirtyDebris = true;
    for (const p of Object.values(state.players)) this.dirtyPlayers.add(p.id);
    this.emit({ t: 'dayStart', summary }, 'all');
    // Everyone wakes up at home.
    for (const s of this.sessions.values()) {
      const p = this.playerOf(s);
      if (p) s.link.send({ t: 'correct', x: p.x, y: p.y });
    }
    this.emit({ t: 'shipArrived' }, 'all');
    this.acc = 0;
    this.flush();
    this.sendTick();
    void this.persist();
  }

  private emit(e: GameEvent, to: string | 'all') {
    if (e.t === 'dialogue' || e.t === 'forage') this.dirtySocial = true;
    for (const s of this.sessions.values()) {
      if (!s.playerId) continue;
      if (to === 'all' || s.playerId === to) s.link.send({ t: 'event', e });
    }
  }

  private broadcast(msg: ServerMessage) {
    for (const s of this.sessions.values()) if (s.playerId) s.link.send(msg);
  }

  private flush() {
    const state = this.state;
    if (!state) return;
    if (this.dirtySoil.size) {
      const tiles: Array<[number, (typeof state.soil)[number] | null]> = [];
      for (const k of this.dirtySoil) tiles.push([k, state.soil[k] ?? null]);
      this.dirtySoil.clear();
      this.broadcast({ t: 'soil', tiles });
    }
    if (this.dirtyPlaced) {
      this.dirtyPlaced = false;
      this.broadcast({ t: 'placed', placed: state.placed });
    }
    if (this.dirtyDebris) {
      this.dirtyDebris = false;
      this.broadcast({ t: 'debris', debris: state.debris, nodes: state.nodes, mine: state.mine, greenhouse: state.greenhouse });
    }
    if (this.dirtySocial) {
      this.dirtySocial = false;
      this.broadcast({ t: 'social', npcs: state.npcs, forage: state.forage, request: state.request });
    }
    if (this.dirtyPlayers.size) {
      for (const s of this.sessions.values()) {
        if (s.playerId && this.dirtyPlayers.has(s.playerId)) {
          s.link.send({ t: 'self', player: state.players[s.playerId], gold: state.gold, lifetime: state.lifetimeEarnings, discovered: state.discovered });
        }
      }
      this.dirtyPlayers.clear();
    }
  }

  private sendTick() {
    const state = this.state;
    if (!state) return;
    const online = new Set([...this.sessions.values()].map((s) => s.playerId));
    const players: PlayerPublic[] = Object.values(state.players)
      .filter((p) => online.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        look: p.look,
        x: p.x,
        y: p.y,
        dir: p.dir,
        moving: p.moving,
        carrying: p.carrying.length,
        held: p.inv[p.sel]?.id ?? null,
        floor: p.floor,
      }));
    const active = [...this.sessions.values()].filter((s) => s.playerId);
    const paused = active.length > 0 && active.every((s) => s.paused);
    this.broadcast({
      t: 'tick',
      clock: { ...state.clock },
      sub: Math.min(0.999, this.acc / MS_PER_GAME_MINUTE),
      rate: paused ? 0 : this.timeScale,
      weather: state.weather,
      forecast: state.forecast,
      players,
      shipPresent: state.ship.present,
      cargo: state.ship.cargo.length,
      gold: state.gold,
    });
  }

  /** Writes the current world to its slot. Serialized so saves never interleave. */
  persist(): Promise<void> {
    if (!this.state || this.slot < 0) return this.saving;
    this.state.rngState = this.rng.state;
    const file = makeSave(JSON.parse(JSON.stringify(this.state)));
    const slot = this.slot;
    this.sinceSave = 0;
    this.changed = false;
    this.saving = this.saving
      .then(() => this.opts.store.save(slot, file))
      .then(
        () => this.emit({ t: 'saved', ok: true }, 'all'),
        () => {
          this.changed = true;
          this.emit({ t: 'saved', ok: false }, 'all');
        },
      )
      .then(() => this.flush());
    return this.saving;
  }
}
