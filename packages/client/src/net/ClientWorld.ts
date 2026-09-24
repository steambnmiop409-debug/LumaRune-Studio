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

  /** Smooth, locally extrapolated minute for sky rendering. */
  minute(paused: boolean): number {
    const ahead = paused ? 0 : Math.min(1.5, (performance.now() - this.tickAt) / MS_PER_GAME_MINUTE);
    return this.clock.minute + ahead;
  }

  apply(msg: ServerMessage): void {
    switch (msg.t) {
      case 'tick': {
        const newDay = msg.clock.day !== this.clock.day;
        this.clock = msg.clock;
        this.tickAt = performance.now();
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
      case 'event':
        this.events.push(msg.e);
        break;
    }
  }
}
