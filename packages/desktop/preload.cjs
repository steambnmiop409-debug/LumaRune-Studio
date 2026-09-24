// The small, fixed surface the game page may use: its save files, its settings file, the
// window's fullscreen state and a quit handshake so the world is saved before the window closes.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('luminaHost', {
  platform: process.platform,
  saves: {
    load: (slot) => ipcRenderer.invoke('saves:load', slot),
    save: (slot, json) => ipcRenderer.invoke('saves:save', slot, json),
    remove: (slot) => ipcRenderer.invoke('saves:remove', slot),
    dir: () => ipcRenderer.invoke('saves:dir'),
    open: () => ipcRenderer.invoke('saves:open'),
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (json) => ipcRenderer.invoke('settings:save', json),
  },
  setFullscreen: (on) => ipcRenderer.invoke('win:fullscreen', on),
  isFullscreen: () => ipcRenderer.invoke('win:isFullscreen'),
  onBeforeQuit: (fn) => ipcRenderer.on('app:before-quit', () => fn()),
  quitReady: () => ipcRenderer.send('app:quit-ready'),
  quit: () => ipcRenderer.send('app:quit'),
});
