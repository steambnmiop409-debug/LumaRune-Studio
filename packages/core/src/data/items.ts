import { CROPS, type CropDef } from './crops';

export type ItemKind = 'seed' | 'produce' | 'forage' | 'tool' | 'fertilizer' | 'tonic' | 'placeable' | 'crate' | 'upgrade' | 'material' | 'gem' | 'artisan';
export type ToolKind = 'hoe' | 'can' | 'scythe' | 'pick';
export type FertilizerKind = 'basic' | 'quality' | 'speed' | 'speed2' | 'retain';
export type PlaceableKind =
  | 'sprinkler1'
  | 'sprinkler2'
  | 'sprinkler3'
  | 'cover'
  | 'chest'
  | 'compost'
  | 'furnace'
  | 'jar'
  | 'keg'
  | 'seedmaker'
  | 'beehouse'
  | 'harvester';

/** Placeables that hold or process things (as opposed to sprinklers and covers). */
export const MACHINE_KINDS: ReadonlySet<PlaceableKind> = new Set(['chest', 'compost', 'furnace', 'jar', 'keg', 'seedmaker', 'beehouse', 'harvester']);
export const isMachine = (k: PlaceableKind) => MACHINE_KINDS.has(k);

export interface ItemDef {
  id: string;
  name: string;
  nameEn: string;
  kind: ItemKind;
  /** Shop buy price (0 = not sold). For forage: base sell price. */
  price: number;
  maxStack: number;
  desc: string;
  cropId?: string;
  tool?: ToolKind;
  /** Tool tier, e.g. watering can capacity level. */
  tier?: number;
  fertilizer?: FertilizerKind;
  placeable?: PlaceableKind;
}

/** Watering can capacity by tier. */
export const CAN_CAPACITY = [0, 20, 40, 70] as const;

export const FERTILIZER_EFFECT: Record<FertilizerKind, { quality: number; speed: number; retain: boolean }> = {
  basic: { quality: 0.5, speed: 0, retain: false },
  quality: { quality: 1.0, speed: 0, retain: false },
  speed: { quality: 0, speed: 0.1, retain: false },
  speed2: { quality: 0, speed: 0.25, retain: false },
  retain: { quality: 0, speed: 0, retain: true },
};

/** Tiles watered each morning, relative to the sprinkler. */
export function sprinklerArea(kind: PlaceableKind): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (kind !== 'sprinkler1' && kind !== 'sprinkler2' && kind !== 'sprinkler3') return [];
  const r = kind === 'sprinkler3' ? 2 : 1;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (kind === 'sprinkler1' && dx !== 0 && dy !== 0) continue;
      out.push([dx, dy]);
    }
  }
  return out;
}

/** Tiles sheltered from rain by a rain cover (3×3 including its own post tile). */
export const COVER_RADIUS = 1;

const BASE_ITEMS: ItemDef[] = [
  { id: 'tool.hoe', name: '괭이', nameEn: 'Hoe', kind: 'tool', tool: 'hoe', tier: 1, price: 0, maxStack: 1, desc: '농장 땅을 갈아 밭으로 만든다. 시든 작물도 치울 수 있다.' },
  { id: 'tool.can.1', name: '물뿌리개', nameEn: 'Watering Can', kind: 'tool', tool: 'can', tier: 1, price: 0, maxStack: 1, desc: '밭에 물을 준다. 강·연못·우물 같은 민물에서만 채울 수 있다. (20회)' },
  { id: 'tool.can.2', name: '구리 물뿌리개', nameEn: 'Copper Can', kind: 'tool', tool: 'can', tier: 2, price: 1200, maxStack: 1, desc: '더 많은 물을 담는다. (40회)' },
  { id: 'tool.can.3', name: '은 물뿌리개', nameEn: 'Silver Can', kind: 'tool', tool: 'can', tier: 3, price: 4000, maxStack: 1, desc: '공방의 걸작. 넉넉하게 담긴다. (70회)' },
  { id: 'tool.scythe', name: '낫', nameEn: 'Scythe', kind: 'tool', tool: 'scythe', tier: 1, price: 0, maxStack: 1, desc: '다 자란 작물을 수확하고 시든 작물을 벤다.' },
  { id: 'fert.basic', name: '기본 비료', nameEn: 'Basic Fertilizer', kind: 'fertilizer', fertilizer: 'basic', price: 25, maxStack: 99, desc: '심기 전 밭에 뿌린다. 품질이 조금 오르고 땅이 기름져진다.' },
  { id: 'fert.quality', name: '고급 비료', nameEn: 'Quality Fertilizer', kind: 'fertilizer', fertilizer: 'quality', price: 80, maxStack: 99, desc: '심기 전 밭에 뿌린다. 품질이 크게 오른다.' },
  { id: 'fert.speed', name: '성장 촉진제', nameEn: 'Speed-Gro', kind: 'fertilizer', fertilizer: 'speed', price: 40, maxStack: 99, desc: '작물이 10% 빨리 자란다.' },
  { id: 'fert.speed2', name: '고급 성장 촉진제', nameEn: 'Deluxe Speed-Gro', kind: 'fertilizer', fertilizer: 'speed2', price: 120, maxStack: 99, desc: '작물이 25% 빨리 자란다.' },
  { id: 'fert.retain', name: '보습토', nameEn: 'Retaining Soil', kind: 'fertilizer', fertilizer: 'retain', price: 30, maxStack: 99, desc: '흙의 수분이 절반만 마른다.' },
  { id: 'tonic', name: '식물 영양제', nameEn: 'Plant Tonic', kind: 'tonic', price: 60, maxStack: 99, desc: '자라는 작물에 준다. 스트레스를 덜고 품질을 높인다. (작물당 2회)' },
  { id: 'place.sprinkler1', name: '구리 스프링클러', nameEn: 'Copper Sprinkler', kind: 'placeable', placeable: 'sprinkler1', price: 180, maxStack: 99, desc: '매일 아침 상하좌우 4칸에 물을 준다.' },
  { id: 'place.sprinkler2', name: '황동 스프링클러', nameEn: 'Brass Sprinkler', kind: 'placeable', placeable: 'sprinkler2', price: 650, maxStack: 99, desc: '매일 아침 주변 8칸에 물을 준다.' },
  { id: 'place.sprinkler3', name: '은 스프링클러', nameEn: 'Silver Sprinkler', kind: 'placeable', placeable: 'sprinkler3', price: 1800, maxStack: 99, desc: '매일 아침 5×5 범위 24칸에 물을 준다.' },
  { id: 'place.cover', name: '비가림막', nameEn: 'Rain Cover', kind: 'placeable', placeable: 'cover', price: 350, maxStack: 99, desc: '주변 3×3 칸을 비로부터 지킨다. 대신 물은 직접 줘야 한다.' },
  { id: 'tool.pick', name: '곡괭이', nameEn: 'Pickaxe', kind: 'tool', tool: 'pick', tier: 1, price: 800, maxStack: 1, desc: '돌과 광맥을 깬다. 채석장에서 광석과 보석을 캘 수 있다. 빈 장비도 곡괭이로 회수한다.' },
  // Materials for crafting.
  { id: 'mat.wood', name: '나무', nameEn: 'Wood', kind: 'material', price: 0, maxStack: 999, desc: '숲에 떨어진 굵은 가지와 농장의 나뭇가지에서 얻는다.' },
  { id: 'mat.stone', name: '돌', nameEn: 'Stone', kind: 'material', price: 0, maxStack: 999, desc: '곡괭이로 깬 돌멩이. 여러 장비의 재료.' },
  { id: 'mat.fiber', name: '섬유', nameEn: 'Fiber', kind: 'material', price: 0, maxStack: 999, desc: '잡초를 베면 나오는 질긴 풀줄기. 퇴비통에 넣으면 비료가 된다.' },
  { id: 'mat.coal', name: '석탄', nameEn: 'Coal', kind: 'material', price: 0, maxStack: 999, desc: '채석장의 검은 광맥에서 캔다. 용광로의 연료.' },
  { id: 'ore.copper', name: '구리 광석', nameEn: 'Copper Ore', kind: 'material', price: 0, maxStack: 999, desc: '용광로에서 석탄과 함께 녹이면 구리 주괴가 된다. (5개)' },
  { id: 'ore.iron', name: '철 광석', nameEn: 'Iron Ore', kind: 'material', price: 0, maxStack: 999, desc: '용광로에서 석탄과 함께 녹이면 철 주괴가 된다. (5개)' },
  { id: 'bar.copper', name: '구리 주괴', nameEn: 'Copper Bar', kind: 'material', price: 0, maxStack: 999, desc: '장비 제작에 쓰는 붉은 금속.' },
  { id: 'bar.iron', name: '철 주괴', nameEn: 'Iron Bar', kind: 'material', price: 0, maxStack: 999, desc: '튼튼한 장비에 들어가는 금속.' },
  // Gems ship like produce.
  { id: 'gem.quartz', name: '석영', nameEn: 'Quartz', kind: 'gem', price: 80, maxStack: 99, desc: '맑게 반짝이는 흔한 결정. 상자에 담아 팔 수 있다.' },
  { id: 'gem.amethyst', name: '자수정', nameEn: 'Amethyst', kind: 'gem', price: 240, maxStack: 99, desc: '보랏빛이 깊은 귀한 결정.' },
  { id: 'gem.aquamarine', name: '아쿠아마린', nameEn: 'Aquamarine', kind: 'gem', price: 420, maxStack: 99, desc: '바다를 닮은 푸른 보석. 아주 드물게 나온다.' },
  // Crafted machines (made at the workbench).
  { id: 'place.chest', name: '저장 상자', nameEn: 'Chest', kind: 'placeable', placeable: 'chest', price: 0, maxStack: 99, desc: '물건을 18칸까지 보관한다.' },
  { id: 'place.compost', name: '퇴비통', nameEn: 'Compost Bin', kind: 'placeable', placeable: 'compost', price: 0, maxStack: 99, desc: '섬유 10개 → 다음 날 기본 비료 3개. 작물 3개 → 고급 비료 1개와 기본 비료 1개.' },
  { id: 'place.furnace', name: '용광로', nameEn: 'Furnace', kind: 'placeable', placeable: 'furnace', price: 0, maxStack: 99, desc: '광석 5개와 석탄 1개를 녹여 주괴 1개를 만든다.' },
  { id: 'place.jar', name: '보존 항아리', nameEn: 'Preserves Jar', kind: 'placeable', placeable: 'jar', price: 0, maxStack: 99, desc: '과일은 잼, 채소는 절임, 허브는 허브차가 된다. 원재료보다 훨씬 비싸게 팔린다.' },
  { id: 'place.keg', name: '술통', nameEn: 'Keg', kind: 'placeable', placeable: 'keg', price: 0, maxStack: 99, desc: '과일은 4일 뒤 과일주, 채소는 2일 뒤 주스가 된다.' },
  { id: 'place.seedmaker', name: '씨앗 제조기', nameEn: 'Seed Maker', kind: 'placeable', placeable: 'seedmaker', price: 0, maxStack: 99, desc: '작물 1개에서 반나절 만에 씨앗 1~3개를 받는다.' },
  { id: 'place.beehouse', name: '벌통', nameEn: 'Bee House', kind: 'placeable', placeable: 'beehouse', price: 0, maxStack: 99, desc: '3일마다 꿀이 찬다. 주변 5칸 안에 핀 꽃 작물이 있으면 그 꽃의 꿀이 된다. (겨울엔 쉼)' },
  { id: 'place.harvester', name: '자동 수확기', nameEn: 'Auto-Harvester', kind: 'placeable', placeable: 'harvester', price: 0, maxStack: 99, desc: '매일 아침 주변 5×5 칸의 다 자란 작물을 수확해 보관한다.' },
  { id: 'crate', name: '출하 상자', nameEn: 'Shipping Crate', kind: 'crate', price: 20, maxStack: 99, desc: '포장대에서 같은 작물·품질을 30개까지 담는다.' },
  { id: 'upgrade.cart', name: '손수레', nameEn: 'Handcart', kind: 'upgrade', price: 2500, maxStack: 1, desc: '포장된 상자를 한 번에 4개까지 옮길 수 있다.' },
];

/** Wild things found around the island each morning. */
export type ForageWhere = 'beach' | 'forest' | 'meadow' | 'orchard';

export const FORAGE: Array<{ id: string; name: string; nameEn: string; price: number; desc: string; where: ForageWhere }> = [
  { id: 'forage.shell', name: '조개껍데기', nameEn: 'Seashell', price: 30, desc: '파도가 밀어 올린 분홍빛 조개껍데기.', where: 'beach' },
  { id: 'forage.seaglass', name: '바다유리', nameEn: 'Sea Glass', price: 70, desc: '파도에 둥글게 닳은 초록 유리 조각. 빛에 비추면 반짝인다.', where: 'beach' },
  { id: 'forage.driftwood', name: '유목', nameEn: 'Driftwood', price: 20, desc: '바다를 떠돌다 온 매끈한 나뭇가지.', where: 'beach' },
  { id: 'forage.chanterelle', name: '꾀꼬리버섯', nameEn: 'Chanterelle', price: 90, desc: '살구 향이 나는 노란 버섯. 숲 그늘에서 자란다.', where: 'forest' },
  { id: 'forage.morel', name: '곰보버섯', nameEn: 'Morel', price: 140, desc: '봄 숲에서만 드물게 보이는 귀한 버섯.', where: 'forest' },
  { id: 'forage.pinecone', name: '솔방울', nameEn: 'Pinecone', price: 15, desc: '송진 냄새가 은은한 솔방울.', where: 'forest' },
  { id: 'forage.wildflower', name: '들꽃 다발', nameEn: 'Wildflowers', price: 40, desc: '별빛 언덕에서 꺾은 작은 들꽃들.', where: 'meadow' },
  { id: 'forage.wildberry', name: '산딸기', nameEn: 'Wild Berries', price: 55, desc: '햇볕에 잘 익은 새콤한 산딸기.', where: 'meadow' },
  { id: 'forage.apple', name: '과수원 사과', nameEn: 'Orchard Apple', price: 65, desc: '햇살 과수원 나무에서 떨어진 새빨간 사과.', where: 'orchard' },
  { id: 'forage.peach', name: '과수원 복숭아', nameEn: 'Orchard Peach', price: 85, desc: '솜털이 보송한 달콤한 복숭아.', where: 'orchard' },
  { id: 'forage.pear', name: '과수원 배', nameEn: 'Orchard Pear', price: 75, desc: '물이 많고 사각거리는 노란 배.', where: 'orchard' },
  { id: 'forage.plum', name: '과수원 자두', nameEn: 'Orchard Plum', price: 60, desc: '새콤한 보랏빛 자두.', where: 'orchard' },
];

/** Fruit that falls from an orchard tree with this seed (matches the tree's drawn fruit). */
export const ORCHARD_FRUIT = ['forage.apple', 'forage.peach', 'forage.pear', 'forage.plum'];

function seedItem(c: CropDef): ItemDef {
  const sapling = c.form === 'tree';
  return {
    id: `seed.${c.id}`,
    name: sapling ? `${c.name} 묘목` : `${c.name} 씨앗`,
    nameEn: sapling ? `${c.nameEn} Sapling` : `${c.nameEn} Seeds`,
    kind: 'seed',
    cropId: c.id,
    price: c.seedPrice,
    maxStack: 99,
    desc: '',
  };
}

function produceItem(c: CropDef): ItemDef {
  return {
    id: `crop.${c.id}`,
    name: c.name,
    nameEn: c.nameEn,
    kind: 'produce',
    cropId: c.id,
    price: 0,
    maxStack: 99,
    desc: '',
  };
}

export const ITEMS: readonly ItemDef[] = [
  ...BASE_ITEMS,
  ...CROPS.map(seedItem),
  ...CROPS.map(produceItem),
  ...FORAGE.map((f) => ({ id: f.id, name: f.name, nameEn: f.nameEn, kind: 'forage' as const, price: f.price, maxStack: 99, desc: f.desc })),
];

/** Item id of something packed in a crate (crop id, or a forage / gem / artisan item id). */
export function cargoItemId(cargoId: string): string {
  return cargoId.includes('.') ? cargoId : `crop.${cargoId}`;
}

// ── Artisan goods ────────────────────────────────────────────────────────
// Made by machines from a source item; ids look like `artisan.jam.crop.strawberry`.

export type ArtisanType = 'jam' | 'pickle' | 'tea' | 'wine' | 'juice' | 'honey';

const ARTISAN: Record<ArtisanType, { suffix: string; en: string; value: (base: number) => number; desc: string }> = {
  jam: { suffix: '잼', en: 'Jam', value: (b) => Math.round(b * 2 + 40), desc: '보존 항아리에서 졸인 달콤한 잼.' },
  pickle: { suffix: '절임', en: 'Pickles', value: (b) => Math.round(b * 2 + 30), desc: '보존 항아리에서 새콤하게 익힌 절임.' },
  tea: { suffix: '차', en: 'Tea', value: (b) => Math.round(b * 2.5), desc: '말려서 우린 향긋한 차.' },
  wine: { suffix: '과일주', en: 'Wine', value: (b) => Math.round(b * 3), desc: '술통에서 천천히 익은 과일주.' },
  juice: { suffix: '주스', en: 'Juice', value: (b) => Math.round(b * 2.25), desc: '술통에서 짜낸 신선한 주스.' },
  honey: { suffix: '꿀', en: 'Honey', value: (b) => Math.round(90 + b * 2), desc: '벌통에서 모은 꿀. 꽃에 따라 향과 값이 다르다.' },
};

/** Base value of a source item (a crop's ★1 price, or a forage item's price). */
export function sourceValue(sourceId: string): number {
  if (sourceId.startsWith('crop.')) return CROPS.find((c) => `crop.${c.id}` === sourceId)?.sellPrice ?? 0;
  return ITEM_BY_ID.get(sourceId)?.price ?? 0;
}

export function artisanId(type: ArtisanType, sourceId: string | null): string {
  return `artisan.${type}.${sourceId ?? 'wild'}`;
}

/** Parses an artisan id into its type and source item id (null for wild honey). */
export function parseArtisan(id: string): { type: ArtisanType; source: string | null } | null {
  const m = /^artisan\.(jam|pickle|tea|wine|juice|honey)\.(.+)$/.exec(id);
  if (!m) return null;
  return { type: m[1] as ArtisanType, source: m[2] === 'wild' ? null : m[2] };
}

function makeArtisan(id: string): ItemDef | undefined {
  const a = parseArtisan(id);
  if (!a) return undefined;
  const def = ARTISAN[a.type];
  if (!a.source) return { id, name: '야생화 꿀', nameEn: 'Wildflower Honey', kind: 'artisan', price: def.value(0), maxStack: 99, desc: def.desc };
  const src = ITEM_BY_ID.get(a.source);
  if (!src) return undefined;
  const base = src.name.replace(/^과수원 /, '');
  return { id, name: `${base} ${def.suffix}`, nameEn: `${src.nameEn.replace(/^Orchard /, '')} ${def.en}`, kind: 'artisan', price: def.value(sourceValue(a.source)), maxStack: 99, desc: def.desc };
}

const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): ItemDef {
  let it = ITEM_BY_ID.get(id);
  if (!it && id.startsWith('artisan.')) {
    it = makeArtisan(id);
    if (it) ITEM_BY_ID.set(id, it);
  }
  if (!it) throw new Error(`Unknown item: ${id}`);
  return it;
}

export function findItem(id: string): ItemDef | undefined {
  if (!ITEM_BY_ID.has(id) && id.startsWith('artisan.')) {
    const it = makeArtisan(id);
    if (it) ITEM_BY_ID.set(id, it);
  }
  return ITEM_BY_ID.get(id);
}
