import type { SaveFile, SaveSlotInfo } from '@lumina/core';

export const SAVE_SLOTS = 3;

/** Where worlds are persisted. Implementations: memory (tests), IndexedDB (browser worker), files (Node). */
export interface SaveStore {
  load(slot: number): Promise<SaveFile | null>;
  save(slot: number, file: SaveFile): Promise<void>;
  remove(slot: number): Promise<void>;
}

export function slotInfo(slot: number, file: SaveFile | null): SaveSlotInfo | null {
  if (!file) return null;
  const host = Object.values(file.state.players)[0];
  return {
    slot,
    name: host?.name ?? '?',
    farmName: host?.farmName ?? '',
    day: file.state.clock.day,
    gold: file.state.gold,
    savedAt: file.savedAt,
  };
}

export class MemoryStore implements SaveStore {
  private files = new Map<number, string>();

  async load(slot: number): Promise<SaveFile | null> {
    const raw = this.files.get(slot);
    return raw ? (JSON.parse(raw) as SaveFile) : null;
  }

  async save(slot: number, file: SaveFile): Promise<void> {
    this.files.set(slot, JSON.stringify(file));
  }

  async remove(slot: number): Promise<void> {
    this.files.delete(slot);
  }
}
