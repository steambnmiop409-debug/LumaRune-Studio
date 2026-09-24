import { mkdir, readFile, rename, rm, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SaveFile } from '@lumina/core';
import type { SaveStore } from './SaveStore';

/** JSON files on disk with atomic writes (tmp → rename) and one backup. Node only. */
export class FileStore implements SaveStore {
  constructor(private dir: string) {}

  private path(slot: number) {
    return join(this.dir, `slot-${slot}.json`);
  }

  async load(slot: number): Promise<SaveFile | null> {
    try {
      return JSON.parse(await readFile(this.path(slot), 'utf8')) as SaveFile;
    } catch {
      return null;
    }
  }

  async save(slot: number, file: SaveFile): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const target = this.path(slot);
    const tmp = `${target}.tmp`;
    await writeFile(tmp, JSON.stringify(file));
    if (existsSync(target)) await copyFile(target, `${target}.bak`);
    await rename(tmp, target);
  }

  async remove(slot: number): Promise<void> {
    await rm(this.path(slot), { force: true });
  }
}
