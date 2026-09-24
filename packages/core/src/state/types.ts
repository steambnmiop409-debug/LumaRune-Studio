import type { FertilizerKind, PlaceableKind } from '../data/items';
import type { Appearance } from '../player/appearance';
import type { Clock } from '../time/calendar';
import type { DayWeather } from '../weather/weather';

export type Dir = 'down' | 'up' | 'left' | 'right';
export type DeathReason = 'frost' | 'drought' | 'rot';

export interface CropState {
  id: string;
  /** Growth progress in (effective) days. Ready when >= growDays. */
  growth: number;
  plantedDay: number;
  /** Consecutive under-watered days. */
  dry: number;
  /** Consecutive days of excessive rain. */
  soggy: number;
  /** Accumulated stress points (lower quality). */
  stress: number;
  /** Days with perfect conditions. */
  good: number;
  /** Days counted for care ratio. */
  total: number;
  tonic: number;
  harvests: number;
  dead: DeathReason | null;
  dormant: boolean;
  /** Part of a giant crop: the tile key of the giant's top-left corner. */
  giant?: number;
}

export interface SoilState {
  tilled: boolean;
  /** 0..100 */
  moisture: number;
  /** Highest moisture reached today (watering / rain / sprinklers). */
  dayMax: number;
  fert: FertilizerKind | null;
  /** 20..100 — drops on harvest, restored by fertilizer. */
  fertility: number;
  crop: CropState | null;
}

export interface PlacedObject {
  id: number;
  kind: PlaceableKind;
  x: number;
  y: number;
  /** A machine's current batch: what comes out and when (absolute game minute: day × 1440 + minute). */
  work?: { out: ItemStack[]; ready: number } | null;
  /** Storage slots (chest, auto-harvester). */
  store?: Array<ItemStack | null>;
  /** Bee house: days of nectar gathered toward the next jar. */
  days?: number;
}

/** Mineable outcrops in the quarry. */
export type NodeKind = 'stone' | 'coal' | 'copper' | 'iron' | 'gem';

export interface ItemStack {
  id: string;
  qty: number;
  /** Quality ★1..5 for produce. */
  q?: number;
  /** Water left in a watering can. */
  water?: number;
}

export interface CargoCrate {
  cropId: string;
  q: number;
  qty: number;
}

export interface PlayerState {
  id: string;
  name: string;
  farmName: string;
  look: Appearance;
  /** Feet position in world pixels. */
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
  inv: Array<ItemStack | null>;
  sel: number;
  stamina: number;
  maxStamina: number;
  /** Packed crates being carried. */
  carrying: CargoCrate[];
  cart: boolean;
  sleeping: boolean;
  /** Mine floor the player is on (0 = out on the island). */
  floor: number;
}

export interface ShipmentLine {
  cropId: string;
  q: number;
  qty: number;
  gold: number;
}

export interface ShipmentRecord {
  day: number;
  lines: ShipmentLine[];
  total: number;
}

export interface ShipState {
  /** Docked (06:00–17:00). */
  present: boolean;
  cargo: CargoCrate[];
}

export interface WorldState {
  version: number;
  seed: number;
  clock: Clock;
  weather: DayWeather;
  forecast: DayWeather;
  rngState: number;
  /** Farm soil keyed by tile index (y * w + x). */
  soil: Record<number, SoilState>;
  placed: PlacedObject[];
  nextId: number;
  gold: number;
  lifetimeEarnings: number;
  /** Market saturation per crop id (0..0.6). */
  market: Record<string, number>;
  ship: ShipState;
  history: ShipmentRecord[];
  players: Record<string, PlayerState>;
  /** Crop ids harvested at least once (encyclopedia). */
  discovered: string[];
  /** True once today's ship has departed. */
  departedToday: boolean;
  /** Friendship with each villager. */
  npcs: Record<string, Friendship>;
  /** Wild items lying on the island today, keyed by tile index. */
  forage: Record<number, string>;
  /** Today's request on the plaza notice board. */
  request: VillageRequest | null;
  /** Weeds, stones and twigs on the farm, keyed by tile index. */
  debris: Record<number, DebrisKind>;
  /** Ore and stone outcrops in the quarry, keyed by tile index. */
  nodes: Record<number, NodeKind>;
  mine: MineState;
  /** The farm's glasshouse has been restored. */
  greenhouse: boolean;
}

/** Today's state of the mine below the quarry (rocks regrow every morning). */
export interface MineState {
  /** Rocks per floor, keyed by tile index on that floor. A floor has no entry until someone visits it today. */
  rocks: Record<number, Record<number, NodeKind>>;
  /** Tile of the ladder down, once uncovered today. */
  ladders: Record<number, number>;
  /** Deepest floor anyone has reached (unlocks the lift every 5 floors). */
  deepest: number;
}

export type DebrisKind = 'weed' | 'stone' | 'twig';

export interface Friendship {
  points: number;
  /** Day index of the last chat / gift (once per day each). */
  talked: number;
  gifted: number;
}

export interface VillageRequest {
  npc: string;
  item: string;
  qty: number;
  reward: number;
  day: number;
  done: boolean;
}
