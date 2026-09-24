// Where the game keeps its files on each OS, and crash-safe reads and writes. Plain Node, no Electron,
// so it can be tested on its own.
const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * The per-user game data folder each platform expects:
 *   Windows  %APPDATA%\LuminaIsle                      (like Stardew Valley's %APPDATA%\StardewValley)
 *   macOS    ~/Library/Application Support/LuminaIsle
 *   Linux    $XDG_DATA_HOME/LuminaIsle  (default ~/.local/share/LuminaIsle)
 */
function dataRoot(platform, env, home) {
  if (platform === 'win32') return path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'LuminaIsle');
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'LuminaIsle');
  return path.join(env.XDG_DATA_HOME || path.join(home, '.local', 'share'), 'LuminaIsle');
}

/** Temp file → flushed to disk → the old file becomes .bak → rename. A crash at any point leaves a whole file. */
async function writeAtomic(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  const h = await fs.open(tmp, 'w');
  try {
    await h.writeFile(text, 'utf8');
    await h.sync();
  } finally {
    await h.close();
  }
  await fs.copyFile(file, `${file}.bak`).catch(() => {});
  await fs.rename(tmp, file);
}

/** The file's text if it parses as JSON, else its backup's, else null. */
async function readJson(file) {
  for (const f of [file, `${file}.bak`]) {
    try {
      const text = await fs.readFile(f, 'utf8');
      JSON.parse(text);
      return text;
    } catch {
      // Missing or damaged: try the backup.
    }
  }
  return null;
}

module.exports = { dataRoot, writeAtomic, readJson };
