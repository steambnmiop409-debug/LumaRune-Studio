import { CROPS, type CropDef } from './crops';

export type ItemKind = 'seed' | 'produce' | 'forage' | 'tool' | 'fertilizer' | 'tonic' | 'placeable' | 'crate' | 'upgrade';
export type ToolKind = 'hoe' | 'can' | 'scythe';
export type FertilizerKind = 'basic' | 'quality' | 'speed' | 'speed2' | 'retain';
export type PlaceableKind = 'sprinkler1' | 'sprinkler2' | 'sprinkler3' | 'cover';

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
  const r = kind === 'sprinkler3' ? 2 : 1;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (kind === 'sprinkler1' && dx !== 0 && dy !== 0) continue;
      out.push([dx, dy]);
    }
  }
  return kind === 'cover' ? [] : out;
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

/** Item id of something packed in a crate (crop id or forage id). */
export function cargoItemId(cargoId: string): string {
  return cargoId.startsWith('forage.') ? cargoId : `crop.${cargoId}`;
}

const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): ItemDef {
  const it = ITEM_BY_ID.get(id);
  if (!it) throw new Error(`Unknown item: ${id}`);
  return it;
}

export function findItem(id: string): ItemDef | undefined {
  return ITEM_BY_ID.get(id);
}
