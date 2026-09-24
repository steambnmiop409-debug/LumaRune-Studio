import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APPEARANCE,
  GREENHOUSE_COST,
  NPC_BY_ID,
  Rng,
  TILE,
  addItem,
  advanceDay,
  canTill,
  countItem,
  createPlayer,
  createWorldState,
  generateWorld,
  getCrop,
  giftReaction,
  growGiants,
  inGreenhouse,
  interact,
  newCrop,
  newSoil,
  repairGreenhouse,
  useItem,
  type GameEvent,
  type PlayerState,
  type SimContext,
} from '../src';

const map = generateWorld();

function setup(seed = 9) {
  const rng = new Rng(seed);
  const state = createWorldState(map.seed, rng, map);
  const p = createPlayer('p1', '루미', '별빛 농장', DEFAULT_APPEARANCE, map);
  state.players[p.id] = p;
  const events: GameEvent[] = [];
  const ctx: SimContext = { state, map, rng, emit: (e) => events.push(e), touchSoil: () => {}, touchPlaced: () => {}, touchPlayer: () => {}, touchDebris: () => {} };
  return { rng, state, p, ctx, events };
}

const stand = (p: PlayerState, tx: number, ty: number) => {
  p.x = tx * TILE + TILE / 2;
  p.y = ty * TILE + TILE - 2;
};

describe('greenhouse', () => {
  const g = map.greenhouse;
  const door = { x: g.x + 4, y: g.y + g.h - 1 };

  it('sits on the farm with solid walls, an open door and a 7×4 bed', () => {
    expect(map.solid[g.y * map.w + g.x]).toBe(1);
    expect(map.solid[door.y * map.w + door.x]).toBe(0);
    let inside = 0;
    for (let y = g.y; y < g.y + g.h; y++) for (let x = g.x; x < g.x + g.w; x++) if (inGreenhouse(map, x, y)) inside++;
    expect(inside).toBe(28);
  });

  it('must be restored before the bed can be tilled, and costs gold and materials', () => {
    const { state, p, ctx, events } = setup();
    const bed = { x: g.x + 2, y: g.y + 2 };
    expect(canTill(state, map, bed.x, bed.y)).toBe(false);
    stand(p, door.x, door.y + 1);
    interact(ctx, p, door.x, door.y);
    expect(events.some((e) => e.t === 'openRepair')).toBe(true);
    expect(repairGreenhouse(ctx, p)).toMatch(/부족|필요/);
    state.gold = GREENHOUSE_COST.gold + 10;
    for (const [id, n] of GREENHOUSE_COST.items) addItem(p.inv, id, n);
    expect(repairGreenhouse(ctx, p)).toBeNull();
    expect(state.greenhouse).toBe(true);
    expect(state.gold).toBe(10);
    expect(countItem(p.inv, 'mat.wood')).toBe(0);
    expect(canTill(state, map, bed.x, bed.y)).toBe(true);
  });

  it('grows anything in any season, safe from frost and rain', () => {
    const { state, rng } = setup();
    state.greenhouse = true;
    const k = (g.y + 2) * map.w + g.x + 2;
    const out = (g.y + 12) * map.w + g.x + 2;
    for (const key of [k, out]) {
      state.soil[key] = newSoil();
      state.soil[key].crop = newCrop('watermelon', 0);
    }
    // A freezing winter day outside.
    state.weather = { ...state.weather, kind: 'snow', meanTemp: -4, minTemp: -9, maxTemp: 0, precipStart: 0, precipEnd: 1440 };
    for (const key of [k, out]) {
      state.soil[key].moisture = 100;
      state.soil[key].dayMax = 100;
    }
    advanceDay(state, map, rng, false);
    expect(state.soil[out].crop!.dead).toBe('frost');
    expect(state.soil[k].crop!.dead).toBeNull();
    expect(state.soil[k].crop!.growth).toBeCloseTo(1);
  });
});

describe('giant crops', () => {
  it('a ripe 3×3 patch can merge into a giant that harvests all at once', () => {
    const { state, p, ctx, rng } = setup();
    const x0 = map.farm.x + 10;
    const y0 = map.farm.y + 14;
    const def = getCrop('pumpkin');
    for (let dy = 0; dy < 3; dy++)
      for (let dx = 0; dx < 3; dx++) {
        const key = (y0 + dy) * map.w + x0 + dx;
        delete state.debris[key];
        state.soil[key] = newSoil();
        state.soil[key].crop = { ...newCrop('pumpkin', 0), growth: def.growDays };
      }
    let made: string | null = null;
    for (let i = 0; i < 200 && !made; i++) made = growGiants(state, map, rng);
    expect(made).toBe('pumpkin');
    const anchor = y0 * map.w + x0;
    expect(state.soil[anchor + map.w + 1].crop!.giant).toBe(anchor);

    addItem(p.inv, 'tool.scythe', 1);
    const slot = p.inv.findIndex((s) => s?.id === 'tool.scythe');
    stand(p, x0 + 1, y0 + 3);
    expect(useItem(ctx, p, slot, x0 + 1, y0 + 2)).toBeNull();
    expect(countItem(p.inv, 'crop.pumpkin')).toBeGreaterThanOrEqual(14);
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) expect(state.soil[(y0 + dy) * map.w + x0 + dx].crop).toBeNull();
  });
});

describe('gifts of handmade goods', () => {
  it('villagers react to the kind of good and to favourite ingredients', () => {
    const bomi = NPC_BY_ID.get('bomi')!;
    expect(giftReaction(bomi, 'artisan.wine.crop.grape').reaction).toBe('disliked');
    expect(giftReaction(bomi, 'artisan.jam.crop.blueberry').reaction).toBe('loved');
    const fav = giftReaction(bomi, 'artisan.juice.crop.strawberry');
    expect(fav.reaction).toBe('loved');
    expect(fav.text).toContain('딸기');
    const sora = NPC_BY_ID.get('sora')!;
    expect(giftReaction(sora, 'artisan.tea.crop.mint').reaction).toBe('loved');
    expect(giftReaction(sora, 'gem.aquamarine').reaction).toBe('loved');
    expect(giftReaction(NPC_BY_ID.get('marin')!, 'gem.quartz').reaction).toBe('liked');
    expect(giftReaction(NPC_BY_ID.get('doyun')!, 'artisan.honey.wild').reaction).toBe('liked');
  });
});
