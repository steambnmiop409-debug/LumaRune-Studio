/// <reference lib="webworker" />
/**
 * Single-player: the whole authoritative server runs inside a Web Worker.
 * The client talks to it with postMessage using the same protocol as the WebSocket server.
 *
 * Saves go to IndexedDB in a browser. In the desktop app the page first sends `{ __host: 'files' }`
 * and saves become real files in the OS's game data folder (see packages/desktop).
 */
import type { ClientMessage } from '@lumina/core';
import { GameServer } from '../GameServer';
import { HostStore, MigratingStore } from '../persistence/HostStore';
import { IdbStore } from '../persistence/IdbStore';
import type { SaveStore } from '../persistence/SaveStore';

declare const self: DedicatedWorkerGlobalScope;

const debug = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;
let server: GameServer | null = null;
let host: HostStore | null = null;

function start(store: SaveStore): GameServer {
  const s = new GameServer({ store, debug, maxPlayers: 1 });
  s.connect({ id: 'local', send: (m) => self.postMessage(m) });
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    s.update(Math.min(250, now - last));
    last = now;
  }, 50);
  return s;
}

self.onmessage = (e: MessageEvent<ClientMessage | { __host: 'files' }>) => {
  if (host?.receive(e.data)) return;
  if ('__host' in e.data) {
    if (!server) {
      host = new HostStore((m) => self.postMessage(m));
      server = start(new MigratingStore(host, new IdbStore()));
    }
    return;
  }
  server ??= start(new IdbStore());
  void server.handle('local', e.data);
};
