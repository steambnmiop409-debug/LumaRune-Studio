/// <reference lib="webworker" />
/**
 * Single-player: the whole authoritative server runs inside a Web Worker.
 * The client talks to it with postMessage using the same protocol as the WebSocket server.
 */
import type { ClientMessage } from '@lumina/core';
import { GameServer } from '../GameServer';
import { IdbStore } from '../persistence/IdbStore';

declare const self: DedicatedWorkerGlobalScope;

const debug = new URL(self.location.href).searchParams.get('debug') === '1';
const server = new GameServer({ store: new IdbStore(), debug, maxPlayers: 1 });
server.connect({ id: 'local', send: (m) => self.postMessage(m) });

self.onmessage = (e: MessageEvent<ClientMessage>) => {
  void server.handle('local', e.data);
};

let last = performance.now();
setInterval(() => {
  const now = performance.now();
  server.update(Math.min(250, now - last));
  last = now;
}, 50);
