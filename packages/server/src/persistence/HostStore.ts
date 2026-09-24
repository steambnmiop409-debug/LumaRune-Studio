import type { SaveFile } from '@lumina/core';
import type { SaveStore } from './SaveStore';

/** A request from the worker to whatever hosts the page (the desktop app writes real files). */
export interface HostStoreRequest {
  __store: { id: number; op: 'load' | 'save' | 'remove'; slot: number; data?: string };
}
export interface HostStoreReply {
  __storeReply: { id: number; ok: boolean; data?: string | null; error?: string };
}

/**
 * Saves as files in the OS's per-user game data folder, written by the desktop app.
 * The worker can't touch the disk itself, so each call is a round trip through the page.
 */
export class HostStore implements SaveStore {
  private next = 1;
  private waiting = new Map<number, { resolve: (v: string | null | undefined) => void; reject: (e: Error) => void }>();

  constructor(private post: (m: HostStoreRequest) => void) {}

  /** Feed replies from the page here. Returns true if the message was one. */
  receive(m: unknown): boolean {
    const r = (m as HostStoreReply | null)?.__storeReply;
    if (!r) return false;
    const w = this.waiting.get(r.id);
    this.waiting.delete(r.id);
    if (w) r.ok ? w.resolve(r.data) : w.reject(new Error(r.error ?? 'save failed'));
    return true;
  }

  private call(op: 'load' | 'save' | 'remove', slot: number, data?: string): Promise<string | null | undefined> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.post({ __store: { id, op, slot, data } });
    });
  }

  async load(slot: number): Promise<SaveFile | null> {
    const raw = await this.call('load', slot);
    return raw ? (JSON.parse(raw) as SaveFile) : null;
  }

  async save(slot: number, file: SaveFile): Promise<void> {
    await this.call('save', slot, JSON.stringify(file));
  }

  async remove(slot: number): Promise<void> {
    await this.call('remove', slot);
  }
}

/** Reads fall back to an older store (saves made before the move to files); writes go to the new one. */
export class MigratingStore implements SaveStore {
  constructor(
    private primary: SaveStore,
    private legacy: SaveStore,
  ) {}

  async load(slot: number): Promise<SaveFile | null> {
    return (await this.primary.load(slot)) ?? (await this.legacy.load(slot).catch(() => null));
  }

  save(slot: number, file: SaveFile): Promise<void> {
    return this.primary.save(slot, file);
  }

  async remove(slot: number): Promise<void> {
    await this.primary.remove(slot);
    await this.legacy.remove(slot).catch(() => {});
  }
}
