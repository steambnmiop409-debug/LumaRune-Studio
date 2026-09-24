import {
  MS_PER_GAME_MINUTE,
  generateWorld,
  type Clock,
  type DayWeather,
  type GameEvent,
  type PlacedObject,
  type PlayerPublic,
  type PlayerState,
  type ServerMessage,
  type SoilState,
  type WorldMap,
  type WorldState,
} from '@lumina/core';

export interface RemotePlayer extends PlayerPublic {
  /** Smoothed render position. */
  rx: number;
  ry: number;
  animT: number;
}

/**
 * The client's mirror of the server world. Applies server messages and exposes
 * read-only views for rendering. Game rules are never decided here.
 */
export class ClientWorld {
  map: WorldMap;
  state: WorldState;
  me: string;
  clock: Clock;
  weather: DayWeather;
  forecast: DayWeather;
  gold: number;
  lifetime: number;
  discovered: Set<string>;
  shipPresent = true;
  cargo = 0;
  others = new Map<string, RemotePlayer>();
  events: GameEvent[] = [];
  /** Server position corrections for the local player. */
  correction: { x: number; y: number } | null = null;
  soilVersion = 0;
  private tickAt = performance.now();
  private sub = 0;
  private rate = 1;
  /** Last minute handed out, so the smooth clock never runs backwards within a day. */
  private shown = { day: -1, minute: 0 };

  constructor(you: string, state: WorldState) {
    this.me = you;
    this.state = state;
    this.map = generateWorld(state.seed);
    this.clock = { ...state.clock };
    this.weather = state.weather;
    this.forecast = state.forecast;
    this.gold = state.gold;
    this.lifetime = state.lifetimeEarnings;
    this.discovered = new Set(state.discovered);
    this.shipPresent = state.ship.present;
    this.cargo = state.ship.cargo.length;
  }

  get self(): PlayerState {
    return this.state.players[this.me];
  }

  get soil(): Record<number, SoilState> {
    return this.state.soil;
  }

  get placed(): PlacedObject[] {
    return this.state.placed;
  }

  /**
   * Smooth game minute for rendering (sky, shadows, villagers walking): the server's minute plus how
   * far into it the server was, extrapolated since the last tick — never jumping backwards.
   */
  minute(paused: boolean): number {
    const ahead = paused ? 0 : ((performance.now() - this.tickAt) / MS_PER_GAME_MINUTE) * this.rate;
    let m = Math.min(this.clock.minute + this.sub + ahead, this.clock.minute + 1.999);
    if (this.shown.day === this.clock.day && m < this.shown.minute && this.shown.minute - m < 3) m = this.shown.minute;
    this.shown = { day: this.clock.day, minute: m };
    return m;
  }

  apply(msg: ServerMessage): void {
    switch (msg.t) {
      case 'tick': {
        const newDay = msg.clock.day !== this.clock.day;
        this.clock = msg.clock;
        this.tickAt = performance.now();
        this.sub = msg.sub ?? 0;
        this.rate = msg.rate ?? 1;
        this.weather = msg.weather;
        this.forecast = msg.forecast;
        this.gold = msg.gold;
        this.shipPresent = msg.shipPresent;
        this.cargo = msg.cargo;
        const seen = new Set<string>();
        for (const p of msg.players) {
          if (p.id === this.me) continue;
          seen.add(p.id);
          const cur = this.others.get(p.id);
          if (cur) Object.assign(cur, p);
          else this.others.set(p.id, { ...p, rx: p.x, ry: p.y, animT: 0 });
        }
        for (const id of [...this.others.keys()]) if (!seen.has(id)) this.others.delete(id);
        if (newDay) this.soilVersion++;
        break;
      }
      case 'soil':
        for (const [k, s] of msg.tiles) {
          if (s) this.state.soil[k] = s;
          else delete this.state.soil[k];
        }
        this.soilVersion++;
        break;
      case 'placed':
        this.state.placed = msg.placed;
        break;
      case 'correct':
        this.correction = { x: msg.x, y: msg.y };
        break;
      case 'self': {
        // Position is client-predicted; keep ours, take everything else from the server.
        const prev = this.state.players[this.me];
        const next = msg.player;
        if (prev) {
          next.x = prev.x;
          next.y = prev.y;
          next.dir = prev.dir;
        }
        this.state.players[this.me] = next;
        this.gold = msg.gold;
        this.lifetime = msg.lifetime;
        this.discovered = new Set(msg.discovered);
        break;
      }
      case 'debris':
        this.state.debris = msg.debris;
        this.state.nodes = msg.nodes;
        this.state.mine = msg.mine;
        this.state.greenhouse = msg.greenhouse;
        break;
      case 'social':
        this.state.npcs = msg.npcs;
        this.state.forage = msg.forage;
        this.state.request = msg.request;
        break;
      case 'event':
        // A warp moves us to another floor right away, so collision and rendering switch in the same frame.
        if (msg.e.t === 'warp') {
          this.correction = { x: msg.e.x, y: msg.e.y };
          if (this.self) this.self.floor = msg.e.floor;
        }
        this.events.push(msg.e);
        break;
    }
  }
}
