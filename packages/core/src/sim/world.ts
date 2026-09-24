import { isFarmable } from '../world/worldgen';
import { COVER_RADIUS, sprinklerArea } from '../data/items';
import { recoverMarket, settleCargo } from '../economy/market';
import { evaporate, growCropOneDay } from '../farming/growth';
import { addItem, emptyInventory } from '../inventory/inventory';
import { Rng } from '../math/rng';
import { regrowWeeds, scatterDebris } from './debris';
import { morningMachines, spawnNodes } from './machines';
import { newRequest, spawnForage } from './social';
import { greenhouseWeather, growGiants, inGreenhouse } from './greenhouse';
import { getCrop } from '../data/crops';
import type { Appearance } from '../player/appearance';
import type { DaySummary } from '../protocol/messages';
import type { PlayerState, ShipmentRecord, SoilState, WorldState } from '../state/types';
import { DAY_START } from '../time/calendar';
import { generateDayWeather, isPrecipitating, isWet } from '../weather/weather';
import { TILE } from '../world/tiles';
import type { WorldMap } from '../world/types';

export const SAVE_VERSION = 5;
export const START_GOLD = 500;
export const MAX_STAMINA = 100;

export function createWorldState(seed: number, rng: Rng, map?: WorldMap): WorldState {
  const weather = generateDayWeather(rng, 0, null);
  // The very first morning is always fair — a gentle welcome to the island.
  weather.kind = 'clear';
  weather.precipStart = weather.precipEnd = 0;
  const forecast = generateDayWeather(rng, 1, weather.kind);
  const state: WorldState = {
    version: SAVE_VERSION,
    seed,
    clock: { day: 0, minute: DAY_START },
    weather,
    forecast,
    rngState: rng.state,
    soil: {},
    placed: [],
    nextId: 1,
    gold: START_GOLD,
    lifetimeEarnings: 0,
    market: {},
    ship: { present: true, cargo: [] },
    history: [],
    players: {},
    discovered: [],
    departedToday: false,
    npcs: {},
    forage: {},
    request: null,
    debris: {},
    nodes: {},
    mine: { rocks: {}, ladders: {}, deepest: 0 },
    greenhouse: false,
  };
  if (map) {
    scatterDebris(state, map, rng);
    spawnNodes(state, map, rng);
    spawnForage(state, map, rng);
  }
  newRequest(state, rng);
  state.rngState = rng.state;
  return state;
}

export function createPlayer(id: string, name: string, farmName: string, look: Appearance, map: WorldMap): PlayerState {
  const inv = emptyInventory();
  addItem(inv, 'tool.hoe', 1);
  addItem(inv, 'tool.can.1', 1);
  addItem(inv, 'tool.scythe', 1);
  addItem(inv, 'seed.radish', 12);
  addItem(inv, 'seed.lettuce', 8);
  addItem(inv, 'crate', 10);
  return {
    id,
    name,
    farmName,
    look,
    x: map.spawn.x * TILE + TILE / 2,
    y: map.spawn.y * TILE + TILE - 2,
    dir: 'down',
    moving: false,
    inv,
    sel: 0,
    stamina: MAX_STAMINA,
    maxStamina: MAX_STAMINA,
    carrying: [],
    cart: false,
    sleeping: false,
    floor: 0,
  };
}

export function soilAt(state: WorldState, map: WorldMap, x: number, y: number): SoilState | undefined {
  return state.soil[y * map.w + x];
}

export function newSoil(): SoilState {
  return { tilled: true, moisture: 0, dayMax: 0, fert: null, fertility: 60, crop: null };
}

export function placedAt(state: WorldState, x: number, y: number) {
  return state.placed.find((p) => p.x === x && p.y === y);
}

export function isCovered(state: WorldState, x: number, y: number): boolean {
  return state.placed.some((p) => p.kind === 'cover' && Math.abs(p.x - x) <= COVER_RADIUS && Math.abs(p.y - y) <= COVER_RADIUS);
}

export function canTill(state: WorldState, map: WorldMap, x: number, y: number): boolean {
  if (inGreenhouse(map, x, y) && !state.greenhouse) return false;
  return isFarmable(map, x, y) && !placedAt(state, x, y) && !state.debris[y * map.w + x];
}

/** Sheltered from rain: under a rain cover or inside the restored glasshouse. */
export function isSheltered(state: WorldState, map: WorldMap, x: number, y: number): boolean {
  return (state.greenhouse && inGreenhouse(map, x, y)) || isCovered(state, x, y);
}

/** Called on every in-game hour while it rains. Returns changed soil keys. */
export function applyPrecipitationHour(state: WorldState, map: WorldMap): number[] {
  const w = state.weather;
  if (!isPrecipitating(w, state.clock.minute)) return [];
  const gain = w.kind === 'storm' ? 35 : isWet(w.kind) ? 20 : 5;
  const changed: number[] = [];
  for (const key of Object.keys(state.soil)) {
    const k = Number(key);
    const s = state.soil[k];
    const x = k % map.w;
    const y = (k - x) / map.w;
    if (isSheltered(state, map, x, y)) continue;
    const before = s.moisture;
    s.moisture = Math.min(100, s.moisture + gain);
    s.dayMax = Math.max(s.dayMax, s.moisture);
    if (Math.round(before) !== Math.round(s.moisture)) changed.push(k);
  }
  return changed;
}

/** Morning sprinkler pass. Returns changed soil keys. */
export function runSprinklers(state: WorldState, map: WorldMap): number[] {
  const changed: number[] = [];
  for (const p of state.placed) {
    for (const [dx, dy] of sprinklerArea(p.kind)) {
      const k = (p.y + dy) * map.w + (p.x + dx);
      const s = state.soil[k];
      if (!s) continue;
      s.moisture = 100;
      s.dayMax = 100;
      changed.push(k);
    }
  }
  return changed;
}

/** 17:00 — the ship leaves with everything loaded today. */
export function departShip(state: WorldState): ShipmentRecord | null {
  if (state.departedToday) return null;
  state.departedToday = true;
  state.ship.present = false;
  if (!state.ship.cargo.length) return null;
  const record = settleCargo(state.ship.cargo, state.market, state.weather.meanTemp, state.clock.day);
  state.ship.cargo = [];
  state.gold += record.total;
  state.lifetimeEarnings += record.total;
  state.history.push(record);
  if (state.history.length > 60) state.history.shift();
  return record;
}

/**
 * Ends the current day and starts the next one at 06:00.
 * Crops grow using the finished day's weather, soil dries, markets recover, the ship returns.
 */
export function advanceDay(state: WorldState, map: WorldMap, rng: Rng, passedOut: boolean): { summary: DaySummary; changed: number[] } {
  // Today's shipment: either it leaves now (slept before 17:00) or it already left at 17:00.
  const shipment = departShip(state) ?? state.history.find((h) => h.day === state.clock.day) ?? null;
  const ended = state.weather;
  const deaths: DaySummary['deaths'] = {};
  let ready = 0;
  const changed: number[] = [];

  for (const key of Object.keys(state.soil)) {
    const k = Number(key);
    const s = state.soil[k];
    const x = k % map.w;
    const y = (k - x) / map.w;
    // Under glass every plant gets its own perfect day.
    const glass = state.greenhouse && inGreenhouse(map, x, y);
    const weather = glass && s.crop ? greenhouseWeather(ended, getCrop(s.crop.id)) : ended;
    if (s.crop) {
      const r = growCropOneDay(s, weather, glass || isCovered(state, x, y));
      if (r.died) deaths[r.died] = (deaths[r.died] ?? 0) + 1;
      if (r.becameReady) ready++;
    }
    evaporate(s, weather);
    // Bare, dry, unfertilized soil slowly returns to grass.
    if (!s.crop && !s.fert && s.moisture <= 0 && rng.chance(0.08)) {
      delete state.soil[k];
    }
    changed.push(k);
  }

  const giant = growGiants(state, map, rng);
  recoverMarket(state.market);
  state.clock.day += 1;
  state.clock.minute = DAY_START;
  state.weather = state.forecast;
  state.forecast = generateDayWeather(rng, state.clock.day + 1, state.weather.kind);
  state.ship.present = true;
  state.departedToday = false;
  changed.push(...runSprinklers(state, map));
  changed.push(...morningMachines(state, map, rng));
  spawnNodes(state, map, rng);
  spawnForage(state, map, rng);
  newRequest(state, rng);
  regrowWeeds(state, map, rng);
  // The mine settles overnight: fresh rocks, ladders buried again.
  state.mine.rocks = {};
  state.mine.ladders = {};

  for (const p of Object.values(state.players)) {
    p.stamina = passedOut ? Math.round(p.maxStamina * 0.7) : p.maxStamina;
    p.sleeping = false;
    p.floor = 0;
    p.x = map.spawn.x * TILE + TILE / 2;
    p.y = map.spawn.y * TILE + TILE - 2;
    p.dir = 'down';
    p.moving = false;
  }
  state.rngState = rng.state;

  return {
    summary: { day: state.clock.day, shipment, deaths, ready, weather: state.weather, forecast: state.forecast, passedOut, giant },
    changed: [...new Set(changed)],
  };
}
