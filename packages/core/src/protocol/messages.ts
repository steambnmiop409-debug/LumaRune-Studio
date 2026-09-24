import type { ShopId } from '../data/shops';
import type { Appearance } from '../player/appearance';
import type { DeathReason, Dir, PlacedObject, PlayerState, ShipmentRecord, SoilState, WorldState } from '../state/types';
import type { Clock } from '../time/calendar';
import type { DayWeather } from '../weather/weather';

export interface SaveSlotInfo {
  slot: number;
  name: string;
  farmName: string;
  day: number;
  gold: number;
  savedAt: number;
}

export type ClientMessage =
  | { t: 'listSaves' }
  | { t: 'join'; slot: number; newGame?: { name: string; farmName: string; look: Appearance } }
  | { t: 'move'; x: number; y: number; dir: Dir; moving: boolean }
  | { t: 'useItem'; slot: number; tx: number; ty: number }
  | { t: 'interact'; tx: number; ty: number }
  | { t: 'select'; slot: number }
  | { t: 'swap'; a: number; b: number }
  | { t: 'buy'; shop: ShopId; item: string; qty: number }
  | { t: 'pack'; slot: number; qty: number }
  | { t: 'sleep' }
  | { t: 'cancelSleep' }
  | { t: 'pause'; on: boolean }
  | { t: 'debug'; cmd: string; arg?: number };

export interface PlayerPublic {
  id: string;
  name: string;
  look: Appearance;
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
  /** Number of crates carried (drawn above the head). */
  carrying: number;
  held: string | null;
}

export interface DaySummary {
  /** The new day that just started. */
  day: number;
  shipment: ShipmentRecord | null;
  deaths: Partial<Record<DeathReason, number>>;
  ready: number;
  weather: DayWeather;
  forecast: DayWeather;
  passedOut: boolean;
}

export type GameEvent =
  | { t: 'toast'; text: string; tone?: 'info' | 'good' | 'warn' }
  | { t: 'openShop'; shop: ShopId; stock: string[] }
  | { t: 'openPacking' }
  | { t: 'sleepPrompt' }
  | { t: 'fx'; kind: 'till' | 'water' | 'plant' | 'fert' | 'refill' | 'clear' | 'place' | 'pickup' | 'tonic'; x: number; y: number; by: string }
  | { t: 'harvest'; x: number; y: number; cropId: string; q: number; qty: number; by: string }
  | { t: 'shipLoaded'; crates: number; by: string }
  | { t: 'shipDeparted'; record: ShipmentRecord }
  | { t: 'shipArrived' }
  | { t: 'dayStart'; summary: DaySummary }
  | { t: 'bought'; item: string; qty: number; gold: number };

export type ServerMessage =
  | { t: 'saves'; slots: Array<SaveSlotInfo | null> }
  | { t: 'needCharacter'; slot: number }
  | { t: 'welcome'; you: string; state: WorldState }
  | { t: 'tick'; clock: Clock; weather: DayWeather; forecast: DayWeather; players: PlayerPublic[]; shipPresent: boolean; cargo: number; gold: number }
  | { t: 'soil'; tiles: Array<[number, SoilState | null]> }
  | { t: 'placed'; placed: PlacedObject[] }
  | { t: 'self'; player: PlayerState; gold: number; lifetime: number; discovered: string[] }
  | { t: 'event'; e: GameEvent }
  | { t: 'error'; reason: string };
