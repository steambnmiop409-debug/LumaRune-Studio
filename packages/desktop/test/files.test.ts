import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const { dataRoot, readJson, writeAtomic } = createRequire(import.meta.url)('../files.cjs') as {
  dataRoot(platform: string, env: Record<string, string | undefined>, home: string): string;
  readJson(file: string): Promise<string | null>;
  writeAtomic(file: string, text: string): Promise<void>;
};

describe('desktop save files', () => {
  it('uses each OS’s per-user game data folder', () => {
    expect(dataRoot('win32', { APPDATA: 'C:\\Users\\a\\AppData\\Roaming' }, 'C:\\Users\\a')).toContain('LuminaIsle');
    expect(dataRoot('darwin', {}, '/Users/a')).toBe('/Users/a/Library/Application Support/LuminaIsle');
    expect(dataRoot('linux', {}, '/home/a')).toBe('/home/a/.local/share/LuminaIsle');
    expect(dataRoot('linux', { XDG_DATA_HOME: '/data' }, '/home/a')).toBe('/data/LuminaIsle');
  });

  it('writes atomically, keeps a backup and falls back to it when the save is damaged', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lumina-'));
    const f = join(dir, 'Saves', 'slot1.json');
    await writeAtomic(f, '{"day":1}');
    await writeAtomic(f, '{"day":2}');
    expect(await readJson(f)).toBe('{"day":2}');
    expect(await readFile(`${f}.bak`, 'utf8')).toBe('{"day":1}');
    await writeFile(f, '{"day":'); // torn write
    expect(await readJson(f)).toBe('{"day":1}');
    expect(await readJson(join(dir, 'missing.json'))).toBeNull();
  });
});
