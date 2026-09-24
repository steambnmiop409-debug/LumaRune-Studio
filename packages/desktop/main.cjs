// Lumina Isle desktop shell. Serves the built client from a privileged app:// origin
// (so fetch and workers behave exactly like on the web) and opens a frameless-feeling game window.
//
// Saves are plain files (Saves/slotN.json, with a .bak of the previous one) and settings.json in
// the per-user game data folder each OS expects — see files.cjs.
const { app, BrowserWindow, protocol, net, Menu, shell, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { dataRoot, readJson, writeAtomic } = require('./files.cjs');

const ROOT = dataRoot(process.platform, process.env, app.getPath('home'));
const SAVES = path.join(ROOT, 'Saves');
const SETTINGS = path.join(ROOT, 'settings.json');
const slotFile = (slot) => path.join(SAVES, `slot${(Number(slot) | 0) + 1}.json`);

ipcMain.handle('saves:load', (_e, slot) => readJson(slotFile(slot)));
ipcMain.handle('saves:save', (_e, slot, text) => {
  JSON.parse(text);
  return writeAtomic(slotFile(slot), text);
});
ipcMain.handle('saves:remove', async (_e, slot) => {
  const f = slotFile(slot);
  // Deleted worlds are kept once as .deleted, in case of a slip.
  await fs.rename(f, `${f}.deleted`).catch(() => {});
  await fs.rm(`${f}.bak`, { force: true });
});
ipcMain.handle('saves:dir', () => SAVES);
ipcMain.handle('saves:open', async () => {
  await fs.mkdir(SAVES, { recursive: true });
  return shell.openPath(SAVES);
});
ipcMain.handle('settings:load', () => readJson(SETTINGS));
ipcMain.handle('settings:save', (_e, text) => {
  JSON.parse(text);
  return writeAtomic(SETTINGS, text);
});
ipcMain.handle('win:fullscreen', (e, on) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  win?.setFullScreen(!!on);
  return !!win?.isFullScreen();
});
ipcMain.handle('win:isFullscreen', (e) => !!BrowserWindow.fromWebContents(e.sender)?.isFullScreen());

const GAME_DIR = app.isPackaged ? path.join(__dirname, 'game') : path.join(__dirname, '..', 'client', 'dist');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } },
]);

// Pixel-exact rendering: never let Chromium resample the canvas.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 640,
    minHeight: 360,
    backgroundColor: '#14152a',
    title: 'Lumina Isle',
    autoHideMenuBar: true,
    useContentSize: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false, preload: path.join(__dirname, 'preload.cjs') },
  });
  win.once('ready-to-show', () => win.show());
  // Closing the window asks the game to save first; it answers with app:quit-ready (or we give up after 5 s).
  let closing = false;
  win.on('close', (e) => {
    if (closing) return;
    e.preventDefault();
    closing = true;
    const done = () => {
      if (!win.isDestroyed()) win.destroy();
    };
    ipcMain.once('app:quit-ready', done);
    setTimeout(done, 5000);
    win.webContents.send('app:before-quit');
  });
  win.webContents.setZoomFactor(1);
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
    // Block browser zoom: it would break integer pixel scaling.
    if ((input.control || input.meta) && ['+', '-', '=', '0'].includes(input.key)) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadURL('app://game/index.html');
}

ipcMain.on('app:quit', (e) => BrowserWindow.fromWebContents(e.sender)?.close());

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(GAME_DIR, decodeURIComponent(pathname)));
    if (!file.startsWith(GAME_DIR)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => app.quit());
