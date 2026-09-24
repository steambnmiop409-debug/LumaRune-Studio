import type { ShopId } from '../data/shops';
import type { Appearance } from '../player/appearance';
import type { DeathReason, DebrisKind, Dir, Friendship, MineState, NodeKind, PlacedObject, PlayerState, ShipmentRecord, SoilState, VillageRequest, WorldState } from '../state/types';
import type { Clock } from '../time/calendar';
import type { DayWeather } from '../weather/weather';

export interface SaveSlotInfo {
  slot: number;
  name: string;
  farmName: string;
  day: number;
  gold: number;
  savedAt: number;
  /** How the host farmer looks (for the slot's portrait). */
  look?: Appearance;
  lifetime?: number;
}

export type ClientMessage =
  | { t: 'listSaves' }
  /** Deletes a world from the title screen (not the one currently open). */
  | { t: 'deleteSave'; slot: number }
  | { t: 'join'; slot: number; newGame?: { name: string; farmName: string; look: Appearance } }
  | { t: 'move'; x: number; y: number; dir: Dir; moving: boolean }
  | { t: 'useItem'; slot: number; tx: number; ty: number }
  | { t: 'interact'; tx: number; ty: number }
  | { t: 'select'; slot: number }
  | { t: 'swap'; a: number; b: number }
  /** Move part of a stack to another slot. */
  | { t: 'split'; from: number; to: number; qty: number }
  | { t: 'buy'; shop: ShopId; item: string; qty: number }
  | { t: 'pack'; slot: number; qty: number }
  | { t: 'sleep' }
  | { t: 'cancelSleep' }
  | { t: 'pause'; on: boolean }
  /** Write the world to disk now (quitting, the window closing, the tab going to the background). */
  | { t: 'save' }
  | { t: 'deliver' }
  | { t: 'sort' }
  | { t: 'craft'; recipe: string }
  | { t: 'chest'; id: number; from: 'inv' | 'chest'; slot: number }
  /** Ride the lift at the mine entrance down to a floor. */
  | { t: 'lift'; floor: number }
  /** Pay to restore the farm glasshouse. */
  | { t: 'repair' }
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
  /** Mine floor (0 = island). */
  floor: number;
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
  /** Crop id of a giant crop that swelled up overnight. */
  giant?: string | null;
}

export type GameEvent =
  | { t: 'toast'; text: string; tone?: 'info' | 'good' | 'warn' }
  | { t: 'openShop'; shop: ShopId; stock: string[] }
  | { t: 'openPacking' }
  | { t: 'sleepPrompt' }
  | { t: 'fx'; kind: 'till' | 'water' | 'plant' | 'fert' | 'refill' | 'clear' | 'break' | 'chop' | 'mine' | 'load' | 'place' | 'pickup' | 'tonic' | 'ladder' | 'restore'; x: number; y: number; by: string; floor?: number }
  | { t: 'harvest'; x: number; y: number; cropId: string; q: number; qty: number; by: string; giant?: boolean }
  | { t: 'shipLoaded'; crates: number; by: string }
  | { t: 'shipDeparted'; record: ShipmentRecord }
  | { t: 'shipArrived' }
  | { t: 'dayStart'; summary: DaySummary }
  | { t: 'bought'; item: string; qty: number; gold: number }
  | { t: 'dialogue'; npc: string; text: string; hearts: number; gift?: 'loved' | 'liked' | 'neutral' | 'disliked' }
  | { t: 'openBoard' }
  | { t: 'forage'; x: number; y: number; item: string }
  /** Items that went into the bag from a machine, outcrop or debris (for the pickup animation). */
  | { t: 'gain'; item: string; qty: number; x: number; y: number }
  | { t: 'crafted'; item: string; qty: number }
  | { t: 'openCraft' }
  | { t: 'openChest'; id: number }
  /** A save finished (ok) or could not be written. */
  | { t: 'saved'; ok: boolean }
  /** The player was moved to another place (mine floor or back to the island). */
  | { t: 'warp'; x: number; y: number; floor: number }
  /** The lift at the mine entrance: floors it can go to. */
  | { t: 'openLift'; floors: number[] }
  /** The ruined glasshouse: show what restoring it costs. */
  | { t: 'openRepair' };

export type ServerMessage =
  | { t: 'saves'; slots: Array<SaveSlotInfo | null> }
  | { t: 'needCharacter'; slot: number }
  | { t: 'welcome'; you: string; state: WorldState }
  /** `sub` is how far into the current minute the clock is (0..1); `rate` is game minutes per real minute-length (0 when paused). */
  | { t: 'tick'; clock: Clock; sub: number; rate: number; weather: DayWeather; forecast: DayWeather; players: PlayerPublic[]; shipPresent: boolean; cargo: number; gold: number }
  | { t: 'soil'; tiles: Array<[number, SoilState | null]> }
  | { t: 'placed'; placed: PlacedObject[] }
  | { t: 'self'; player: PlayerState; gold: number; lifetime: number; discovered: string[] }
  | { t: 'social'; npcs: Record<string, Friendship>; forage: Record<number, string>; request: VillageRequest | null }
  | { t: 'debris'; debris: Record<number, DebrisKind>; nodes: Record<number, NodeKind>; mine: MineState; greenhouse: boolean }
  | { t: 'event'; e: GameEvent }
  /** Server rejected a move; snap the local player back here. */
  | { t: 'correct'; x: number; y: number }
  | { t: 'error'; reason: string };
