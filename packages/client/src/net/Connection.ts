import type { ClientMessage, ServerMessage } from '@lumina/core';
import ServerWorker from '@lumina/server/worker?worker';
import { host } from '../platform/host';

type StoreRequest = { __store: { id: number; op: 'load' | 'save' | 'remove'; slot: number; data?: string } };

/** A pipe to a game server — the client never touches the simulation directly. */
export interface Connection {
  send(msg: ClientMessage): void;
  onMessage: ((msg: ServerMessage) => void) | null;
  close(): void;
}

/** Single-player: the authoritative server runs in a Web Worker. */
export class WorkerConnection implements Connection {
  private worker: Worker;
  onMessage: ((msg: ServerMessage) => void) | null = null;

  constructor() {
    this.worker = new ServerWorker();
    // In the desktop app, saves are files the app writes for the worker.
    const files = host?.saves;
    if (files) this.worker.postMessage({ __host: 'files' });
    this.worker.onmessage = (e: MessageEvent<ServerMessage | StoreRequest>) => {
      const d = e.data;
      if (files && '__store' in d) {
        const { id, op, slot, data } = d.__store;
        const call = op === 'load' ? files.load(slot) : op === 'save' ? files.save(slot, data ?? '') : files.remove(slot);
        call.then(
          (r) => this.worker.postMessage({ __storeReply: { id, ok: true, data: r ?? null } }),
          (err: unknown) => this.worker.postMessage({ __storeReply: { id, ok: false, error: String(err) } }),
        );
        return;
      }
      this.onMessage?.(d as ServerMessage);
    };
  }

  send(msg: ClientMessage): void {
    this.worker.postMessage(msg);
  }

  close(): void {
    this.worker.terminate();
  }
}

/** Co-op: a dedicated Node server over WebSocket (`?server=ws://host:7777`). */
export class SocketConnection implements Connection {
  private ws: WebSocket;
  private queue: string[] = [];
  onMessage: ((msg: ServerMessage) => void) | null = null;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      for (const m of this.queue) this.ws.send(m);
      this.queue = [];
    };
    this.ws.onmessage = (e) => this.onMessage?.(JSON.parse(String(e.data)) as ServerMessage);
  }

  send(msg: ClientMessage): void {
    const raw = JSON.stringify(msg);
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(raw);
    else this.queue.push(raw);
  }

  close(): void {
    this.ws.close();
  }
}

export function connect(): Connection {
  const url = new URLSearchParams(location.search).get('server');
  return url ? new SocketConnection(url) : new WorkerConnection();
}
