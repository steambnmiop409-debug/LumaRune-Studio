import { L } from '../i18n';
import { CROPS } from '../data/crops';
import { FORAGE, ORCHARD_FRUIT, bareName, getItem, parseArtisan } from '../data/items';
import { NPCS, NPC_BY_ID, type GiftReaction, type NpcDef } from '../data/npcs';
import { addItem, canFit, countItem, removeItem } from '../inventory/inventory';
import type { Rng } from '../math/rng';
import type { Friendship, PlayerState, WorldState } from '../state/types';
import { seasonOf } from '../time/calendar';
import { TILE, Terrain, Zone } from '../world/tiles';
import type { WorldMap } from '../world/types';
import { allNpcPoses } from './npc';
import type { SimContext } from './actions';

export const MAX_HEARTS = 10;
export const POINTS_PER_HEART = 100;

export function friendship(state: WorldState, id: string): Friendship {
  if (!state.npcs[id]) state.npcs[id] = { points: 0, talked: -1, gifted: -1 };
  return state.npcs[id];
}

export const hearts = (f: Friendship) => Math.min(MAX_HEARTS, Math.floor(f.points / POINTS_PER_HEART));

/** The villager standing at (or right next to) tile (x, y), if any. */
export function npcAt(map: WorldMap, minute: number, x: number, y: number): string | null {
  // The server's clock is whole minutes while clients see villagers mid-stride: check across the minute.
  for (const m of [minute, minute + 0.5, minute + 1])
    for (const p of allNpcPoses(map, m)) {
      const tx = p.x / TILE;
      const ty = (p.y - 6) / TILE;
      if (Math.abs(tx - (x + 0.5)) < 1.1 && Math.abs(ty - (y + 0.5)) < 1.3) return p.id;
    }
  return null;
}

export function talk(ctx: SimContext, p: PlayerState, npcId: string): null {
  const { state } = ctx;
  const npc = NPC_BY_ID.get(npcId)!;
  const f = friendship(state, npcId);
  const first = f.talked !== state.clock.day;
  if (first) {
    f.talked = state.clock.day;
    f.points += 10;
  }
  const h = hearts(f);
  const r = ctx.rng;
  const raining = state.weather.kind === 'rain' || state.weather.kind === 'storm';
  const pool = raining && r.chance(0.5) ? npc.lines.rain : h >= 6 ? npc.lines.close : h >= 3 ? [...npc.lines.friend, ...npc.lines.greet] : npc.lines.greet;
  ctx.emit({ t: 'dialogue', npc: npcId, text: r.pick(pool), hearts: h }, p.id);
  ctx.touchPlayer(p.id);
  return null;
}

/** Item kinds a villager will accept as a gift. */
export const GIFTABLE = new Set(['produce', 'forage', 'artisan', 'gem']);

/** How a villager reacts to a gift, and what they say. */
export function giftReaction(npc: NpcDef, itemId: string): { reaction: GiftReaction; text: string; handmade: boolean } {
  const plain = (id: string): GiftReaction | null => (npc.loves.includes(id) ? 'loved' : npc.likes.includes(id) ? 'liked' : npc.dislikes.includes(id) ? 'disliked' : null);
  const art = parseArtisan(itemId);
  if (!art) {
    const reaction = plain(itemId) ?? (getItem(itemId).kind === 'gem' ? 'liked' : 'neutral');
    return { reaction, text: npc.lines[reaction], handmade: false };
  }
  // Handmade goods: the kind of good decides, a favourite ingredient makes anything but a disliked kind a treasure.
  const byType = npc.artisan[art.type] ?? 'liked';
  const fromFav = !!art.source && plain(art.source) === 'loved';
  const reaction: GiftReaction = byType === 'disliked' ? 'disliked' : fromFav ? 'loved' : byType;
  const srcName = art.source ? bareName(art.source) : '';
  const text = byType !== 'disliked' && fromFav ? L(npc.lines.favSource, { src: srcName }) : (npc.lines.made[art.type] ?? (reaction === 'disliked' ? npc.lines.disliked : npc.lines.handmade));
  return { reaction, text, handmade: true };
}

export function gift(ctx: SimContext, p: PlayerState, npcId: string, slot: number): string | null {
  const { state } = ctx;
  const npc = NPC_BY_ID.get(npcId)!;
  const stack = p.inv[slot];
  if (!stack) return null;
  if (!GIFTABLE.has(getItem(stack.id).kind)) return L('{npc}에게는 작물·채집물·가공품·보석을 선물할 수 있어요.', { npc: npc.name });
  const f = friendship(state, npcId);
  if (f.gifted === state.clock.day) return L('{npc}에게는 오늘 이미 선물했어요.', { npc: npc.name });
  const { reaction, text, handmade } = giftReaction(npc, stack.id);
  // Handmade gifts count for more: time and care went into them.
  const gain = { loved: 80, liked: 45, neutral: 20, disliked: -20 }[reaction] + (stack.q ?? 1) * 4 + (handmade && reaction !== 'disliked' ? 20 : 0);
  f.points = Math.max(0, Math.min(MAX_HEARTS * POINTS_PER_HEART, f.points + gain));
  f.gifted = state.clock.day;
  stack.qty -= 1;
  if (stack.qty <= 0) p.inv[slot] = null;
  ctx.emit({ t: 'dialogue', npc: npcId, text, hearts: hearts(f), gift: reaction }, p.id);
  ctx.touchPlayer(p.id);
  return null;
}

export function pickForage(ctx: SimContext, p: PlayerState, x: number, y: number): string | null {
  const key = y * ctx.map.w + x;
  const item = ctx.state.forage[key];
  if (!item) return null;
  if (!canFit(p.inv, item, 1)) return '가방이 가득 찼어요.';
  addItem(p.inv, item, 1);
  delete ctx.state.forage[key];
  ctx.emit({ t: 'forage', x, y, item }, 'all');
  ctx.touchPlayer(p.id);
  return null;
}

export function deliverRequest(ctx: SimContext, p: PlayerState): string | null {
  const req = ctx.state.request;
  if (!req || req.done) return '오늘의 의뢰가 없어요.';
  if (countItem(p.inv, req.item) < req.qty) return L('{item} {n}개가 필요해요.', { item: getItem(req.item).name, n: req.qty });
  removeItem(p.inv, req.item, req.qty);
  ctx.state.gold += req.reward;
  req.done = true;
  const f = friendship(ctx.state, req.npc);
  f.points = Math.min(MAX_HEARTS * POINTS_PER_HEART, f.points + 60);
  const npc = NPC_BY_ID.get(req.npc)!;
  ctx.emit({ t: 'dialogue', npc: req.npc, text: L('정말 고마워요! 약속한 {gold}G예요.', { gold: req.reward }), hearts: hearts(f), gift: 'loved' }, p.id);
  ctx.emit({ t: 'toast', text: L('의뢰 완료: {npc} (+{gold}G)', { npc: npc.name, gold: req.reward }), tone: 'good' }, p.id);
  ctx.touchPlayer(p.id);
  return null;
}

/** Morning: scatter fresh forage around the island. */
export function spawnForage(state: WorldState, map: WorldMap, rng: Rng): void {
  state.forage = {};
  const season = seasonOf(state.clock.day);
  const pools: Record<'beach' | 'forest' | 'meadow', string[]> = { beach: [], forest: [], meadow: [] };
  for (const f of FORAGE) {
    if (f.id === 'forage.morel' && season !== 0) continue;
    if (f.id === 'forage.wildberry' && season !== 1 && season !== 2) continue;
    if (f.id === 'forage.wildflower' && season === 3) continue;
    if (f.where !== 'orchard') pools[f.where].push(f.id);
  }
  const want: Record<'beach' | 'forest' | 'meadow', number> = { beach: 7, forest: 7, meadow: 5 };
  for (const where of ['beach', 'forest', 'meadow'] as const) {
    if (!pools[where].length) continue;
    let placed = 0;
    for (let tries = 0; tries < 4000 && placed < want[where]; tries++) {
      const x = rng.int(2, map.w - 3);
      const y = rng.int(2, map.h - 3);
      const i = y * map.w + x;
      if (map.solid[i] || state.forage[i]) continue;
      const t = map.terrain[i];
      const ok = where === 'beach' ? t === Terrain.Sand && map.zone[i] === Zone.Beach : where === 'forest' ? t === Terrain.Forest : t === Terrain.Meadow;
      if (!ok) continue;
      state.forage[i] = rng.pick(pools[where]);
      placed++;
    }
  }
  dropFruit(state, map, rng, season);
  // Fallen branches in the woods: the island's supply of wood.
  let wood = 0;
  for (let tries = 0; tries < 3000 && wood < 10; tries++) {
    const x = rng.int(2, map.w - 3);
    const y = rng.int(2, map.h - 3);
    const i = y * map.w + x;
    if (map.solid[i] || state.forage[i] || map.terrain[i] !== Terrain.Forest) continue;
    state.forage[i] = 'mat.wood';
    wood++;
  }
}

/** Summer and autumn mornings: ripe fruit lies under the orchard trees. */
function dropFruit(state: WorldState, map: WorldMap, rng: Rng, season: number): void {
  if (season !== 1 && season !== 2) return;
  for (const o of map.objects) {
    if (o.kind !== 'fruittree' || !rng.chance(season === 2 ? 0.5 : 0.3)) continue;
    const spots = [
      [o.x, o.y + 1],
      [o.x - 1, o.y + 1],
      [o.x + 1, o.y + 1],
    ];
    const [x, y] = spots[rng.int(0, spots.length - 1)];
    const i = y * map.w + x;
    if (map.solid[i] || state.forage[i] || map.terrain[i] === Terrain.Path) continue;
    state.forage[i] = ORCHARD_FRUIT[o.v % ORCHARD_FRUIT.length];
  }
}

/** Morning: a villager pins a new request to the notice board. */
export function newRequest(state: WorldState, rng: Rng): void {
  const season = seasonOf(state.clock.day);
  const npc = rng.pick(NPCS);
  const pool = CROPS.filter((c) => c.tier <= 2 && (c.temp[0] + c.temp[1]) / 2 > [10, 20, 12, 0][season] - 6 && (c.temp[0] + c.temp[1]) / 2 < [10, 20, 12, 0][season] + 8);
  const useForage = rng.chance(0.35) || !pool.length;
  const item = useForage ? rng.pick(FORAGE.filter((f) => f.id !== 'forage.morel' && (f.where !== 'orchard' || season === 1 || season === 2))).id : `crop.${rng.pick(pool).id}`;
  const unit = useForage ? getItem(item).price : CROPS.find((c) => `crop.${c.id}` === item)!.sellPrice;
  const qty = useForage ? rng.int(2, 4) : rng.int(4, 10);
  state.request = { npc: npc.id, item, qty, reward: Math.round((unit * qty * 1.7) / 10) * 10, day: state.clock.day, done: false };
}
