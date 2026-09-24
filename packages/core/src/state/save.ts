import { SAVE_VERSION } from '../sim/world';
import type { WorldState } from './types';

export interface SaveFile {
  version: number;
  savedAt: number;
  state: WorldState;
}

type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

/** Migrations from version N to N+1. Add one whenever WorldState changes shape. */
const MIGRATIONS: Record<number, Migration> = {
  // v2: villagers, forage and the notice board.
  1: (s) => ({ ...s, npcs: {}, forage: {}, request: null }),
  // v3: farm debris (existing farms start tidy).
  2: (s) => ({ ...s, debris: {} }),
};

export function makeSave(state: WorldState): SaveFile {
  return { version: SAVE_VERSION, savedAt: Date.now(), state };
}

export function migrateSave(raw: unknown): SaveFile {
  const file = raw as SaveFile;
  if (!file || typeof file !== 'object' || !file.state) throw new Error('Corrupt save file');
  let v = file.version ?? 1;
  let state = file.state as unknown as Record<string, unknown>;
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`No migration from save version ${v}`);
    state = m(state);
    v++;
  }
  if (v > SAVE_VERSION) throw new Error(`Save version ${v} is newer than this game (${SAVE_VERSION})`);
  const ws = state as unknown as WorldState;
  ws.version = SAVE_VERSION;
  return { version: SAVE_VERSION, savedAt: file.savedAt ?? 0, state: ws };
}
