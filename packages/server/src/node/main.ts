/**
 * Dedicated co-op server:  npm run server  (PORT=7777 SLOT=0 SAVE_DIR=./saves)
 * Clients connect with  ?server=ws://host:7777
 */
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMessage } from '@lumina/core';
import { GameServer } from '../GameServer';
import { FileStore } from '../persistence/FileStore';

const port = Number(process.env.PORT ?? 7777);
const server = new GameServer({
  store: new FileStore(process.env.SAVE_DIR ?? './saves'),
  debug: process.env.DEBUG === '1',
  maxPlayers: 4,
});

const wss = new WebSocketServer({ port });
let nextId = 1;

wss.on('connection', (ws: WebSocket) => {
  const id = `ws-${nextId++}`;
  server.connect({
    id,
    send: (m) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
    },
  });
  ws.on('message', (data) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(data)) as ClientMessage;
    } catch {
      return;
    }
    void server.handle(id, msg);
  });
  ws.on('close', () => server.disconnect(id));
});

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  server.update(Math.min(250, now - last));
  last = now;
}, 50);

const shutdown = async () => {
  await server.persist();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`🌊 Lumina Isle server listening on ws://localhost:${port}`);
