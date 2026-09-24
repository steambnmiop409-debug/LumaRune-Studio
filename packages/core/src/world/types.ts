import type { Stroke } from './polyline';
import type { ZoneId } from './tiles';

export type ObjectKind =
  | 'oak'
  | 'pine'
  | 'blossom'
  | 'palm'
  | 'bush'
  | 'rock'
  | 'stump'
  | 'lamp'
  | 'fence'
  | 'bench'
  | 'well'
  | 'fountain'
  | 'sign'
  | 'flowerpot'
  | 'crate'
  | 'barrel'
  | 'bollard'
  | 'packbench'
  | 'flowers'
  | 'reeds'
  | 'mailbox'
  | 'tallgrass'
  | 'pebbles'
  | 'mushroom'
  | 'log'
  | 'lilypad'
  | 'boat'
  | 'netrack'
  | 'fishcrate'
  | 'anchor'
  | 'stall'
  | 'flowerbed'
  | 'laundry'
  | 'haybale'
  | 'scarecrow'
  | 'beehive'
  | 'picnic'
  | 'telescope'
  | 'board';

/** Decorative / blocking object anchored at a tile. */
export interface WorldObject {
  kind: ObjectKind;
  x: number;
  y: number;
  /** Width/height in tiles of the blocking footprint (default 1×1). */
  w?: number;
  h?: number;
  /** Visual variant seed. */
  v: number;
}

export type BuildingKind = 'house' | 'seedShop' | 'toolShop' | 'cottage' | 'lighthouse' | 'windmill' | 'harborOffice';

export interface Building {
  id: string;
  kind: BuildingKind;
  /** Footprint in tiles (solid). The sprite is drawn anchored to the footprint bottom. */
  x: number;
  y: number;
  w: number;
  h: number;
  door: { x: number; y: number } | null;
  v: number;
}

export type InteractKind = 'seedShop' | 'toolShop' | 'ship' | 'packing' | 'bed' | 'well' | 'board';

export interface Interactable {
  kind: InteractKind;
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorldMap {
  seed: number;
  w: number;
  h: number;
  terrain: Uint8Array;
  /** Per-tile elevation (used for water depth shading). */
  elev: Float32Array;
  zone: Uint8Array;
  solid: Uint8Array;
  objects: WorldObject[];
  buildings: Building[];
  interactables: Interactable[];
  farm: Rect;
  plaza: Rect;
  spawn: { x: number; y: number };
  /** Tile the ship's hull is anchored at (top-left of a 12×5 area). */
  ship: Rect;
  /** Pier tile the player stands on to load cargo. */
  pierEnd: { x: number; y: number };
  lighthouse: { x: number; y: number };
  /** Smooth centre-lines used to render rivers and roads without a tile staircase. */
  rivers: Stroke[];
  roads: Stroke[];
}

export type ZoneAt = (x: number, y: number) => ZoneId;
