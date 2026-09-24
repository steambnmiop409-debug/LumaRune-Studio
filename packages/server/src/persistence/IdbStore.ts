import type { SaveFile } from '@lumina/core';
import type { SaveStore } from './SaveStore';

/** IndexedDB-backed store. Works in browser windows and Web Workers. */
export class IdbStore implements SaveStore {
  private db: Promise<IDBDatabase>;

  constructor(name = 'lumina-isle') {
    this.db = new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('saves');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await this.db;
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction('saves', mode);
      const req = fn(t.objectStore('saves'));
      t.oncomplete = () => resolve(req.result as T);
      t.onerror = () => reject(t.error);
    });
  }

  async load(slot: number): Promise<SaveFile | null> {
    const raw = await this.tx<string | undefined>('readonly', (s) => s.get(`slot-${slot}`));
    return raw ? (JSON.parse(raw) as SaveFile) : null;
  }

  async save(slot: number, file: SaveFile): Promise<void> {
    // Keep the previous save as a backup before overwriting.
    const prev = await this.tx<string | undefined>('readonly', (s) => s.get(`slot-${slot}`));
    await this.tx('readwrite', (s) => {
      if (prev) s.put(prev, `slot-${slot}.bak`);
      return s.put(JSON.stringify(file), `slot-${slot}`);
    });
  }

  async remove(slot: number): Promise<void> {
    await this.tx('readwrite', (s) => s.delete(`slot-${slot}`));
  }
}
