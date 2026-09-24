import { describe, expect, it } from 'vitest';
import { DAY_START, DEFAULT_APPEARANCE, MS_PER_GAME_MINUTE, SHIP_DEPARTURE, SLEEP_FROM, type ServerMessage } from '@lumina/core';
import { GameServer, MemoryStore } from '../src';

function harness() {
  const store = new MemoryStore();
  const server = new GameServer({ store, debug: true });
  const inbox: ServerMessage[] = [];
  server.connect({ id: 'c1', send: (m) => inbox.push(JSON.parse(JSON.stringify(m))) });
  return { server, store, inbox };
}

describe('GameServer', () => {
  it('asks for a character when the slot is empty, then creates the world', async () => {
    const { server, inbox } = harness();
    await server.handle('c1', { t: 'join', slot: 0 });
    expect(inbox.at(-1)?.t).toBe('needCharacter');
    await server.handle('c1', { t: 'join', slot: 0, newGame: { name: '루미', farmName: '별빛 농장', look: DEFAULT_APPEARANCE } });
    const welcome = inbox.find((m) => m.t === 'welcome');
    expect(welcome).toBeTruthy();
    expect(server.world!.clock.minute).toBe(DAY_START);
  });

  it('advances time, departs the ship at 17:00 and saves the next morning', async () => {
    const { server, store, inbox } = harness();
    await server.handle('c1', { t: 'join', slot: 1, newGame: { name: 'A', farmName: 'B', look: DEFAULT_APPEARANCE } });
    server.update((SHIP_DEPARTURE - DAY_START) * MS_PER_GAME_MINUTE);
    expect(inbox.some((m) => m.t === 'event' && m.e.t === 'shipDeparted')).toBe(true);
    expect(server.world!.ship.present).toBe(false);
    // Too early to sleep, and it has to be in bed.
    await server.handle('c1', { t: 'sleep' });
    expect(server.world!.clock.day).toBe(0);
    server.update((SLEEP_FROM - SHIP_DEPARTURE) * MS_PER_GAME_MINUTE);
    await server.handle('c1', { t: 'sleep' });
    expect(server.world!.clock.day).toBe(1);
    expect(inbox.some((m) => m.t === 'event' && m.e.t === 'dayStart')).toBe(true);
    await server.persist();
    const saved = await store.load(1);
    expect(saved!.state.clock.day).toBe(1);
  });

  it('saves on request, autosaves during play and reports a failed write', async () => {
    const { server, store, inbox } = harness();
    await server.handle('c1', { t: 'join', slot: 0, newGame: { name: 'A', farmName: 'B', look: DEFAULT_APPEARANCE } });
    server.world!.gold = 777;
    inbox.length = 0;
    await server.handle('c1', { t: 'save' });
    expect((await store.load(0))!.state.gold).toBe(777);
    expect(inbox.some((m) => m.t === 'event' && m.e.t === 'saved' && m.e.ok)).toBe(true);

    // Half a minute of play later the world is on disk without anyone asking.
    server.world!.gold = 888;
    for (let i = 0; i < 31; i++) server.update(1000);
    await server.persist();
    expect((await store.load(0))!.state.gold).toBe(888);
    server.world!.gold = 889;
    server.update(31_000);
    await new Promise((r) => setTimeout(r, 0));
    expect((await store.load(0))!.state.gold).toBe(889);

    // A broken disk is reported, not swallowed.
    store.save = () => Promise.reject(new Error('disk full'));
    inbox.length = 0;
    await server.handle('c1', { t: 'save' });
    expect(inbox.some((m) => m.t === 'event' && m.e.t === 'saved' && !m.e.ok)).toBe(true);
  });

  it('rejects teleport-like movement', async () => {
    const { server } = harness();
    await server.handle('c1', { t: 'join', slot: 0, newGame: { name: 'A', farmName: 'B', look: DEFAULT_APPEARANCE } });
    const p = Object.values(server.world!.players)[0];
    const { x, y } = p;
    await server.handle('c1', { t: 'move', x: x + 900, y, dir: 'right', moving: true });
    expect(p.x).toBe(x);
    await server.handle('c1', { t: 'move', x: x + 3, y, dir: 'right', moving: true });
    expect(p.x).toBe(x + 3);
  });

  it('resumes a saved island', async () => {
    const { server, store } = harness();
    await server.handle('c1', { t: 'join', slot: 2, newGame: { name: 'A', farmName: 'B', look: DEFAULT_APPEARANCE } });
    server.world!.gold = 4242;
    await server.persist();
    const again = new GameServer({ store });
    const inbox: ServerMessage[] = [];
    again.connect({ id: 'x', send: (m) => inbox.push(m) });
    await again.handle('x', { t: 'join', slot: 2 });
    expect(again.world!.gold).toBe(4242);
    expect(inbox.some((m) => m.t === 'welcome')).toBe(true);
  });
});
