/**
 * 200 real-world crops, translated to game scale.
 *
 * Every number here is a design value documented in docs/design/05-systems.md.
 * Prices are derived (see `derivePrices`) so that higher tiers are always worth more.
 */

export type CropCategory =
  | 'leafy'
  | 'root'
  | 'bulb'
  | 'fruitveg'
  | 'legume'
  | 'grain'
  | 'special'
  | 'herb'
  | 'flower'
  | 'fruit';

/** How the plant looks in the field. */
export type PlantForm =
  | 'leafy'
  | 'rosette'
  | 'root'
  | 'bulb'
  | 'bush'
  | 'vine'
  | 'sprawl'
  | 'grain'
  | 'stalk'
  | 'flower'
  | 'herb'
  | 'tree'
  | 'paddy'
  | 'tall';

/** How the harvested produce icon looks. */
export type ProduceShape =
  | 'round'
  | 'long'
  | 'root'
  | 'head'
  | 'leaf'
  | 'cluster'
  | 'pod'
  | 'bloom'
  | 'bundle'
  | 'pepper'
  | 'gourd'
  | 'bulb'
  | 'nut'
  | 'berry'
  | 'spike'
  | 'tuber'
  | 'stalk';

export interface CropDef {
  id: string;
  name: string;
  nameEn: string;
  category: CropCategory;
  form: PlantForm;
  shape: ProduceShape;
  /** Game days from planting to first harvest. */
  growDays: number;
  /** Days between repeat harvests (0 = single harvest). */
  regrowDays: number;
  yield: readonly [number, number];
  /** 1 (common) .. 5 (premium). */
  tier: 1 | 2 | 3 | 4 | 5;
  /** Optimal growing temperature band in °C. */
  temp: readonly [number, number];
  /** Water need 1 (low) .. 3 (high). */
  water: 1 | 2 | 3;
  /** Rain tolerance 0 (splits / rots easily) .. 3 (loves rain). */
  rainTolerance: 0 | 1 | 2 | 3;
  frostHardy: boolean;
  trellis: boolean;
  perennial: boolean;
  /** Wetland / paddy crop. */
  paddy: boolean;
  leafColor: string;
  produceColor: string;
  /** Base sell price for one ★1 unit. */
  sellPrice: number;
  /** Price of one seed (or sapling). */
  seedPrice: number;
}

type Row = [
  id: string,
  name: string,
  nameEn: string,
  form: PlantForm,
  shape: ProduceShape,
  grow: number,
  regrow: number,
  yMin: number,
  yMax: number,
  tier: 1 | 2 | 3 | 4 | 5,
  tMin: number,
  tMax: number,
  water: 1 | 2 | 3,
  rain: 0 | 1 | 2 | 3,
  leaf: string,
  produce: string,
  /** f = frost hardy, t = trellis, p = perennial, w = paddy */
  flags?: string,
];

const LEAFY: Row[] = [
  ['lettuce', '상추', 'Lettuce', 'rosette', 'leaf', 5, 3, 1, 2, 1, 7, 22, 2, 1, '#7fc25a', '#a6e07a'],
  ['romaine', '로메인', 'Romaine', 'rosette', 'head', 7, 0, 1, 1, 1, 7, 22, 2, 1, '#5fa84a', '#8fd06a'],
  ['spinach', '시금치', 'Spinach', 'rosette', 'leaf', 5, 0, 1, 2, 1, 2, 20, 2, 2, '#3f8f3a', '#5fb04a', 'f'],
  ['napa', '배추', 'Napa Cabbage', 'rosette', 'head', 10, 0, 1, 1, 2, 8, 20, 3, 1, '#9fd070', '#e8f0c0'],
  ['cabbage', '양배추', 'Cabbage', 'rosette', 'head', 11, 0, 1, 1, 2, 5, 22, 2, 2, '#6fae5a', '#b8e090', 'f'],
  ['redcabbage', '적양배추', 'Red Cabbage', 'rosette', 'head', 12, 0, 1, 1, 3, 5, 22, 2, 2, '#6a4f8a', '#9b6fc0', 'f'],
  ['kale', '케일', 'Kale', 'leafy', 'leaf', 7, 3, 1, 2, 2, -5, 24, 2, 2, '#3e7a4a', '#5a9c5e', 'f'],
  ['bokchoy', '청경채', 'Bok Choy', 'rosette', 'head', 5, 0, 1, 1, 1, 8, 22, 2, 1, '#5aa24a', '#e0f0d0'],
  ['chard', '근대', 'Swiss Chard', 'leafy', 'leaf', 6, 3, 1, 2, 1, 5, 25, 2, 2, '#3f8a3f', '#d04a4a', 'f'],
  ['crowndaisy', '쑥갓', 'Crown Daisy', 'herb', 'leaf', 5, 3, 1, 1, 1, 10, 22, 2, 1, '#4f9a3f', '#6fb85a'],
  ['perillaleaf', '깻잎', 'Perilla Leaf', 'bush', 'leaf', 7, 2, 2, 3, 2, 18, 30, 2, 2, '#3f7a3a', '#5f9a4a'],
  ['minari', '미나리', 'Water Dropwort', 'herb', 'leaf', 6, 3, 1, 2, 2, 10, 25, 3, 3, '#4fae4a', '#9ad07a', 'w'],
  ['arugula', '루콜라', 'Arugula', 'leafy', 'leaf', 4, 0, 1, 2, 1, 8, 22, 2, 1, '#4f8f3a', '#6faa4a'],
  ['watercress', '물냉이', 'Watercress', 'herb', 'leaf', 5, 3, 1, 1, 2, 10, 22, 3, 3, '#3f9a4a', '#5fc06a', 'w'],
  ['chicory', '치커리', 'Chicory', 'leafy', 'leaf', 7, 0, 1, 1, 2, 10, 24, 2, 1, '#4f8a3a', '#8fb05a'],
  ['mustardgreens', '갓', 'Mustard Greens', 'leafy', 'leaf', 6, 0, 1, 2, 1, 5, 22, 2, 2, '#5a8a3a', '#8a5a7a', 'f'],
  ['garlicchives', '부추', 'Garlic Chives', 'herb', 'leaf', 6, 3, 1, 2, 1, 10, 28, 2, 2, '#3f9a3a', '#5fba4a', 'p'],
  ['celery', '셀러리', 'Celery', 'leafy', 'stalk', 14, 0, 1, 1, 3, 12, 24, 3, 2, '#7ab85a', '#b8e08a'],
  ['broccoli', '브로콜리', 'Broccoli', 'rosette', 'head', 10, 4, 1, 1, 2, 7, 22, 2, 1, '#3f7a4a', '#3f8a3a', 'f'],
  ['cauliflower', '콜리플라워', 'Cauliflower', 'rosette', 'head', 12, 0, 1, 1, 3, 8, 20, 2, 1, '#5a9a5a', '#f5f0dc'],
  ['brussels', '방울양배추', 'Brussels Sprouts', 'tall', 'cluster', 16, 4, 2, 4, 3, 2, 20, 2, 2, '#4f8a4a', '#8ac06a', 'f'],
  ['kohlrabi', '콜라비', 'Kohlrabi', 'bulb', 'round', 7, 0, 1, 1, 2, 8, 22, 2, 2, '#6aa05a', '#9a7ac8'],
  ['asparagus', '아스파라거스', 'Asparagus', 'stalk', 'stalk', 20, 2, 1, 2, 4, 10, 25, 2, 2, '#5a9a4a', '#7ab85a', 'p'],
  ['artichoke', '아티초크', 'Artichoke', 'bush', 'head', 14, 5, 1, 1, 4, 12, 24, 2, 1, '#6a9a8a', '#7aa08a', 'p'],
  ['waterspinach', '공심채', 'Water Spinach', 'leafy', 'leaf', 4, 2, 1, 2, 1, 22, 32, 3, 3, '#4faa3a', '#7ac85a', 'w'],
  ['gomchwi', '곰취', 'Gomchwi', 'leafy', 'leaf', 8, 3, 1, 1, 3, 5, 20, 2, 2, '#3f7a3a', '#5a9a4a', 'fp'],
];

const ROOT: Row[] = [
  ['radish', '래디시', 'Radish', 'root', 'root', 4, 0, 1, 1, 1, 5, 22, 2, 2, '#5a9a3a', '#e04a5a', 'f'],
  ['mu', '무', 'Korean Radish', 'root', 'root', 9, 0, 1, 1, 1, 8, 22, 2, 2, '#5a9a3a', '#f0f0e0', 'f'],
  ['carrot', '당근', 'Carrot', 'root', 'root', 9, 0, 1, 1, 1, 8, 24, 2, 2, '#4f9a3a', '#f08a2a'],
  ['potato', '감자', 'Potato', 'bush', 'tuber', 12, 0, 2, 4, 1, 10, 24, 2, 1, '#4f8a3a', '#c8a060'],
  ['sweetpotato', '고구마', 'Sweet Potato', 'sprawl', 'tuber', 16, 0, 2, 4, 2, 20, 32, 1, 1, '#5a8a3a', '#c05a6a'],
  ['beet', '비트', 'Beet', 'root', 'root', 8, 0, 1, 1, 1, 8, 24, 2, 2, '#5a8a3a', '#8a1f3f', 'f'],
  ['turnip', '순무', 'Turnip', 'root', 'root', 6, 0, 1, 1, 1, 5, 20, 2, 2, '#5a9a4a', '#d8c8e8', 'f'],
  ['parsnip', '파스닙', 'Parsnip', 'root', 'root', 12, 0, 1, 1, 2, 2, 20, 2, 2, '#5a9a4a', '#f0e0b0', 'f'],
  ['burdock', '우엉', 'Burdock', 'root', 'long', 18, 0, 1, 1, 3, 10, 28, 1, 2, '#4f7a3a', '#8a6a4a'],
  ['lotusroot', '연근', 'Lotus Root', 'paddy', 'tuber', 22, 0, 1, 2, 4, 20, 30, 3, 3, '#4f9a5a', '#e8d8c0', 'w'],
  ['taro', '토란', 'Taro', 'leafy', 'tuber', 18, 0, 2, 3, 3, 20, 32, 3, 3, '#3f8a4a', '#8a6a5a', 'w'],
  ['yam', '마', 'Chinese Yam', 'vine', 'long', 20, 0, 1, 2, 3, 18, 30, 2, 2, '#4f8a3a', '#b89a7a', 't'],
  ['ginger', '생강', 'Ginger', 'herb', 'tuber', 22, 0, 1, 2, 3, 20, 30, 2, 2, '#6a9a4a', '#e0c070'],
  ['turmeric', '강황', 'Turmeric', 'leafy', 'tuber', 24, 0, 1, 2, 4, 22, 32, 2, 2, '#5a9a4a', '#f0a020'],
  ['sunchoke', '돼지감자', 'Sunchoke', 'stalk', 'tuber', 16, 0, 2, 4, 1, 10, 30, 1, 2, '#4f8a3a', '#c8a080', 'f'],
  ['doraji', '도라지', 'Bellflower Root', 'flower', 'root', 24, 0, 1, 1, 4, 10, 28, 1, 1, '#5a8a4a', '#f0ecd8', 'fp'],
  ['deodeok', '더덕', 'Deodeok', 'vine', 'root', 24, 0, 1, 1, 4, 10, 25, 1, 1, '#4f8a4a', '#d8c8a8', 'ftp'],
  ['ginseng', '인삼', 'Ginseng', 'herb', 'root', 28, 0, 1, 1, 5, 8, 22, 2, 0, '#4f7a3a', '#e8d0a0', 'fp'],
  ['wasabi', '고추냉이', 'Wasabi', 'leafy', 'root', 28, 0, 1, 1, 5, 8, 18, 3, 3, '#3f8a5a', '#7ab88a', 'w'],
  ['horseradish', '서양고추냉이', 'Horseradish', 'leafy', 'root', 16, 0, 1, 1, 2, 5, 22, 2, 2, '#5a8a3a', '#e8e0c8', 'fp'],
];

const BULB: Row[] = [
  ['garlic', '마늘', 'Garlic', 'bulb', 'bulb', 20, 0, 1, 1, 2, 0, 22, 1, 1, '#7aa85a', '#f0ece0', 'f'],
  ['onion', '양파', 'Onion', 'bulb', 'bulb', 14, 0, 1, 1, 1, 8, 24, 1, 1, '#6aa85a', '#d8a860', 'f'],
  ['shallot', '샬롯', 'Shallot', 'bulb', 'bulb', 12, 0, 2, 3, 2, 8, 24, 1, 1, '#7aa85a', '#c87a5a', 'f'],
  ['scallion', '대파', 'Scallion', 'bulb', 'stalk', 10, 0, 1, 1, 1, 5, 28, 2, 2, '#4f9a3a', '#e8f0e0', 'f'],
  ['leek', '리크', 'Leek', 'bulb', 'stalk', 16, 0, 1, 1, 2, 2, 24, 2, 2, '#4f7a5a', '#e0e8c8', 'f'],
  ['jjokpa', '쪽파', 'Green Onion', 'bulb', 'stalk', 6, 3, 1, 1, 1, 5, 25, 2, 2, '#5aaa3a', '#eaf0d8', 'f'],
  ['dallae', '달래', 'Wild Chive', 'herb', 'bulb', 8, 0, 1, 2, 2, 2, 20, 2, 2, '#5a9a3a', '#f0f0e0', 'f'],
];

const FRUITVEG: Row[] = [
  ['tomato', '토마토', 'Tomato', 'vine', 'round', 13, 4, 2, 3, 2, 18, 29, 2, 0, '#4f8a3a', '#e0402f', 't'],
  ['cherrytomato', '방울토마토', 'Cherry Tomato', 'vine', 'berry', 11, 3, 3, 5, 2, 18, 29, 2, 0, '#4f8a3a', '#f04a3a', 't'],
  ['eggplant', '가지', 'Eggplant', 'bush', 'long', 12, 4, 1, 2, 2, 20, 30, 2, 1, '#4f7a4a', '#5a2f6a'],
  ['chili', '고추', 'Chili Pepper', 'bush', 'pepper', 14, 3, 2, 3, 2, 20, 30, 2, 0, '#3f7a3a', '#d0302a'],
  ['cheongyang', '청양고추', 'Cheongyang Pepper', 'bush', 'pepper', 14, 3, 2, 3, 3, 20, 30, 2, 0, '#3f7a3a', '#3f9a2f'],
  ['bellpepper', '피망', 'Bell Pepper', 'bush', 'round', 13, 4, 1, 2, 2, 20, 29, 2, 1, '#3f7a3a', '#3f9a3a'],
  ['paprika', '파프리카', 'Paprika', 'bush', 'round', 16, 4, 1, 2, 3, 20, 28, 2, 0, '#3f7a3a', '#f0c020'],
  ['habanero', '하바네로', 'Habanero', 'bush', 'round', 18, 4, 2, 3, 3, 22, 32, 2, 0, '#3f7a3a', '#f07a1f'],
  ['cucumber', '오이', 'Cucumber', 'vine', 'long', 9, 2, 1, 2, 1, 18, 30, 3, 1, '#4f9a3a', '#3f8a3a', 't'],
  ['zucchini', '애호박', 'Zucchini', 'bush', 'long', 9, 2, 1, 2, 1, 18, 30, 2, 1, '#4f8a3a', '#8ac05a'],
  ['kabocha', '단호박', 'Kabocha', 'sprawl', 'gourd', 14, 0, 1, 1, 2, 18, 28, 2, 1, '#4f8a3a', '#2f5a3a'],
  ['pumpkin', '호박', 'Pumpkin', 'sprawl', 'gourd', 17, 0, 1, 1, 3, 18, 30, 2, 1, '#4f8a3a', '#e8802a'],
  ['butternut', '버터넛 스쿼시', 'Butternut Squash', 'sprawl', 'gourd', 16, 0, 1, 1, 2, 18, 30, 2, 1, '#4f8a3a', '#e8c080'],
  ['watermelon', '수박', 'Watermelon', 'sprawl', 'gourd', 14, 0, 1, 1, 3, 22, 32, 2, 0, '#4f8a3a', '#2f7a3a'],
  ['chamoe', '참외', 'Korean Melon', 'sprawl', 'round', 12, 0, 1, 2, 3, 22, 32, 2, 0, '#4f8a3a', '#f0d020'],
  ['muskmelon', '머스크멜론', 'Muskmelon', 'sprawl', 'round', 16, 0, 1, 1, 4, 24, 32, 2, 0, '#4f8a3a', '#b8c89a'],
  ['cantaloupe', '칸탈루프', 'Cantaloupe', 'sprawl', 'round', 13, 0, 1, 1, 3, 22, 32, 2, 0, '#4f8a3a', '#d8b070'],
  ['bittermelon', '여주', 'Bitter Melon', 'vine', 'long', 12, 3, 1, 2, 2, 22, 32, 2, 1, '#4f9a3a', '#7ab83a', 't'],
  ['luffa', '수세미', 'Luffa', 'vine', 'long', 14, 4, 1, 1, 2, 22, 32, 2, 2, '#4f8a3a', '#6a9a4a', 't'],
  ['bottlegourd', '박', 'Bottle Gourd', 'vine', 'gourd', 15, 0, 1, 1, 2, 22, 32, 2, 2, '#4f8a3a', '#b8d08a', 't'],
  ['okra', '오크라', 'Okra', 'tall', 'pod', 11, 2, 1, 3, 2, 22, 34, 1, 1, '#4f8a3a', '#6aaa3a'],
  ['corn', '옥수수', 'Corn', 'stalk', 'spike', 14, 0, 1, 2, 1, 18, 32, 2, 2, '#5a9a3a', '#f0d040'],
  ['sweetcorn', '초당옥수수', 'Sweet Corn', 'stalk', 'spike', 13, 0, 1, 2, 3, 20, 30, 2, 2, '#5a9a3a', '#f8e870'],
  ['strawberry', '딸기', 'Strawberry', 'bush', 'berry', 8, 3, 2, 3, 3, 10, 24, 2, 0, '#4f8a3a', '#e8303a'],
];

const LEGUME: Row[] = [
  ['pea', '완두콩', 'Pea', 'vine', 'pod', 8, 2, 2, 3, 1, 8, 22, 2, 1, '#5a9a4a', '#7ac85a', 'ft'],
  ['kidneybean', '강낭콩', 'Kidney Bean', 'bush', 'pod', 10, 0, 2, 3, 1, 16, 28, 2, 1, '#4f8a3a', '#8a2f2f'],
  ['soybean', '대두', 'Soybean', 'bush', 'pod', 16, 0, 2, 4, 1, 18, 30, 2, 2, '#5a8a3a', '#d8c070'],
  ['mungbean', '녹두', 'Mung Bean', 'bush', 'pod', 11, 0, 2, 4, 2, 22, 32, 1, 1, '#4f8a3a', '#5aa03a'],
  ['adzuki', '팥', 'Adzuki Bean', 'bush', 'pod', 13, 0, 2, 4, 2, 18, 30, 1, 1, '#4f8a3a', '#8a2a2a'],
  ['peanut', '땅콩', 'Peanut', 'bush', 'nut', 18, 0, 3, 5, 2, 20, 30, 1, 1, '#4f9a3a', '#d8b080'],
  ['chickpea', '병아리콩', 'Chickpea', 'bush', 'pod', 14, 0, 2, 4, 2, 15, 28, 1, 0, '#6a9a5a', '#e0c890'],
  ['lentil', '렌틸콩', 'Lentil', 'bush', 'pod', 12, 0, 2, 4, 2, 10, 26, 1, 0, '#6a9a5a', '#c89a5a', 'f'],
  ['fava', '누에콩', 'Fava Bean', 'tall', 'pod', 13, 0, 2, 3, 2, 5, 20, 2, 2, '#4f7a4a', '#7aaa5a', 'f'],
  ['edamame', '풋콩', 'Edamame', 'bush', 'pod', 11, 0, 2, 3, 2, 18, 30, 2, 2, '#4f8a3a', '#6ab83a'],
  ['greenbean', '그린빈', 'Green Bean', 'vine', 'pod', 9, 3, 2, 3, 1, 16, 28, 2, 1, '#4f8a3a', '#5aa83a', 't'],
  ['seoritae', '서리태', 'Black Soybean', 'bush', 'pod', 18, 0, 2, 4, 3, 18, 30, 2, 2, '#4f8a3a', '#2a2a3a'],
];

const GRAIN: Row[] = [
  ['rice', '벼', 'Rice', 'paddy', 'bundle', 20, 0, 2, 4, 2, 22, 32, 3, 3, '#7ab84a', '#e8d890', 'w'],
  ['blackrice', '흑미', 'Black Rice', 'paddy', 'bundle', 22, 0, 2, 4, 3, 22, 32, 3, 3, '#6a9a4a', '#3a2a3a', 'w'],
  ['wheat', '밀', 'Wheat', 'grain', 'bundle', 14, 0, 2, 3, 1, 8, 24, 1, 1, '#9ac05a', '#e8c860', 'f'],
  ['barley', '보리', 'Barley', 'grain', 'bundle', 12, 0, 2, 3, 1, 5, 22, 1, 1, '#8ab85a', '#d8c070', 'f'],
  ['rye', '호밀', 'Rye', 'grain', 'bundle', 14, 0, 2, 3, 1, 0, 20, 1, 1, '#8ab86a', '#b8a070', 'f'],
  ['oats', '귀리', 'Oats', 'grain', 'bundle', 12, 0, 2, 3, 1, 5, 22, 2, 2, '#9ac86a', '#e0d8a0', 'f'],
  ['buckwheat', '메밀', 'Buckwheat', 'flower', 'bundle', 8, 0, 2, 3, 1, 12, 24, 1, 1, '#6aa04a', '#f5f0f0'],
  ['sorghum', '수수', 'Sorghum', 'stalk', 'bundle', 16, 0, 2, 3, 2, 20, 32, 1, 1, '#7aa04a', '#a03a2a'],
  ['foxtailmillet', '조', 'Foxtail Millet', 'grain', 'bundle', 12, 0, 2, 3, 2, 18, 30, 1, 1, '#8ab85a', '#e8c040'],
  ['prosomillet', '기장', 'Proso Millet', 'grain', 'bundle', 10, 0, 2, 3, 2, 18, 30, 1, 1, '#8ab85a', '#f0d880'],
  ['quinoa', '퀴노아', 'Quinoa', 'tall', 'bundle', 14, 0, 2, 3, 3, 10, 24, 1, 0, '#7aa04a', '#d85a5a'],
  ['jobstears', '율무', "Job's Tears", 'grain', 'nut', 16, 0, 2, 3, 3, 20, 30, 2, 2, '#7aa04a', '#c8c0b8'],
];

const SPECIAL: Row[] = [
  ['sesame', '참깨', 'Sesame', 'tall', 'pod', 14, 0, 2, 3, 3, 22, 32, 1, 0, '#5a8a3a', '#f0e8d0'],
  ['perillaseed', '들깨', 'Perilla Seed', 'bush', 'bundle', 16, 0, 2, 3, 2, 18, 30, 1, 1, '#3f7a3a', '#6a5a4a'],
  ['rapeseed', '유채', 'Rapeseed', 'flower', 'pod', 12, 0, 2, 3, 1, 5, 20, 2, 2, '#5a9a3a', '#f8e030', 'f'],
  ['flax', '아마', 'Flax', 'flower', 'bundle', 12, 0, 2, 3, 2, 10, 22, 2, 1, '#6a9a5a', '#6a8ae0'],
  ['cotton', '목화', 'Cotton', 'tall', 'bloom', 18, 3, 1, 2, 2, 20, 32, 1, 0, '#4f8a3a', '#f8f8f0'],
  ['sugarcane', '사탕수수', 'Sugarcane', 'stalk', 'stalk', 24, 0, 2, 3, 3, 24, 34, 3, 3, '#6aa04a', '#a8c86a'],
  ['hops', '홉', 'Hops', 'vine', 'cluster', 16, 4, 2, 3, 3, 12, 26, 2, 1, '#4f8a3a', '#aad06a', 'tp'],
  ['sugarbeet', '사탕무', 'Sugar Beet', 'root', 'root', 18, 0, 1, 1, 2, 8, 24, 2, 2, '#5a8a3a', '#f0e8d8', 'f'],
  ['tea', '차나무', 'Tea', 'bush', 'leaf', 24, 3, 1, 2, 4, 12, 28, 2, 3, '#2f6a3a', '#5a9a4a', 'fp'],
  ['coffee', '커피', 'Coffee', 'tree', 'berry', 28, 4, 2, 3, 5, 18, 28, 2, 2, '#2f5a3a', '#b02a2a', 'p'],
  ['cacao', '카카오', 'Cacao', 'tree', 'gourd', 28, 5, 1, 2, 5, 22, 32, 3, 3, '#2f6a3a', '#c8802a', 'p'],
  ['vanilla', '바닐라', 'Vanilla', 'vine', 'pod', 28, 6, 1, 1, 5, 22, 32, 2, 1, '#3f7a3a', '#3a2a2a', 'tp'],
  ['blackpepper', '후추', 'Black Pepper', 'vine', 'cluster', 26, 5, 1, 2, 5, 22, 32, 2, 2, '#2f6a3a', '#3a3a2a', 'tp'],
  ['saffron', '사프란', 'Saffron', 'flower', 'spike', 14, 0, 1, 1, 5, 10, 22, 1, 0, '#5a8a4a', '#d02a1a', 'f'],
  ['indigo', '쪽', 'Indigo', 'leafy', 'leaf', 14, 4, 2, 3, 2, 18, 30, 2, 2, '#3f6a5a', '#3a4aa0'],
];

const HERB: Row[] = [
  ['basil', '바질', 'Basil', 'herb', 'leaf', 7, 3, 1, 2, 2, 18, 30, 2, 1, '#3f9a3a', '#5aba4a'],
  ['mint', '민트', 'Mint', 'herb', 'leaf', 6, 3, 1, 2, 1, 10, 26, 3, 2, '#3faa5a', '#6ad07a', 'fp'],
  ['rosemary', '로즈마리', 'Rosemary', 'herb', 'leaf', 14, 4, 1, 2, 3, 10, 28, 1, 0, '#4f7a5a', '#7a9a8a', 'fp'],
  ['thyme', '타임', 'Thyme', 'herb', 'leaf', 10, 3, 1, 2, 2, 10, 28, 1, 0, '#5a7a4a', '#8aa06a', 'fp'],
  ['sage', '세이지', 'Sage', 'herb', 'leaf', 12, 4, 1, 2, 2, 10, 28, 1, 0, '#6a8a7a', '#9ab0a0', 'fp'],
  ['oregano', '오레가노', 'Oregano', 'herb', 'leaf', 10, 3, 1, 2, 2, 12, 28, 1, 1, '#4f8a4a', '#7aaa5a', 'fp'],
  ['parsley', '파슬리', 'Parsley', 'herb', 'leaf', 9, 3, 1, 2, 1, 8, 24, 2, 2, '#2f8a3a', '#4fa84a', 'f'],
  ['cilantro', '고수', 'Cilantro', 'herb', 'leaf', 6, 0, 1, 2, 1, 10, 24, 2, 1, '#4f9a3a', '#6aba5a'],
  ['dill', '딜', 'Dill', 'herb', 'leaf', 8, 0, 1, 2, 2, 10, 26, 2, 1, '#6aa04a', '#c8d03a'],
  ['chives', '차이브', 'Chives', 'herb', 'leaf', 7, 3, 1, 1, 1, 5, 25, 2, 2, '#4f9a3a', '#b87ac8', 'fp'],
  ['lemonbalm', '레몬밤', 'Lemon Balm', 'herb', 'leaf', 8, 3, 1, 2, 2, 12, 26, 2, 2, '#6aba4a', '#9ad06a', 'fp'],
  ['chamomile', '캐모마일', 'Chamomile', 'flower', 'bloom', 9, 3, 2, 3, 2, 8, 24, 1, 1, '#6a9a4a', '#f8f8e0', 'f'],
  ['fennel', '펜넬', 'Fennel', 'herb', 'bulb', 12, 0, 1, 1, 2, 12, 26, 2, 1, '#8ab84a', '#eaf0d0'],
  ['stevia', '스테비아', 'Stevia', 'herb', 'leaf', 12, 3, 1, 2, 3, 18, 30, 2, 1, '#4f9a3a', '#7ac05a'],
  ['lemongrass', '레몬그라스', 'Lemongrass', 'grain', 'stalk', 14, 4, 1, 2, 3, 22, 32, 2, 2, '#8ab84a', '#c8d880'],
  ['echinacea', '에키네시아', 'Echinacea', 'flower', 'bloom', 16, 4, 1, 2, 3, 12, 28, 1, 1, '#4f8a3a', '#d86aa0', 'fp'],
  ['mugwort', '쑥', 'Mugwort', 'herb', 'leaf', 6, 3, 1, 2, 1, 5, 25, 2, 2, '#6a9a7a', '#8ab89a', 'fp'],
  ['lavender', '라벤더', 'Lavender', 'flower', 'bloom', 14, 4, 1, 2, 3, 12, 28, 1, 0, '#6a8a7a', '#9a7ad8', 'fp'],
];

const FLOWER: Row[] = [
  ['sunflower', '해바라기', 'Sunflower', 'stalk', 'bloom', 12, 0, 1, 1, 2, 18, 32, 2, 2, '#4f8a3a', '#f8c820'],
  ['tulip', '튤립', 'Tulip', 'flower', 'bloom', 9, 0, 1, 1, 2, 5, 20, 2, 1, '#5a9a4a', '#e83a4a', 'f'],
  ['rose', '장미', 'Rose', 'bush', 'bloom', 16, 4, 1, 2, 4, 15, 26, 2, 0, '#3f6a3a', '#d0203a', 'fp'],
  ['daffodil', '수선화', 'Daffodil', 'flower', 'bloom', 9, 0, 1, 1, 2, 5, 20, 2, 1, '#5a9a4a', '#f8e040', 'f'],
  ['lily', '백합', 'Lily', 'flower', 'bloom', 12, 0, 1, 1, 3, 12, 26, 2, 1, '#4f8a3a', '#f8f0f0'],
  ['carnation', '카네이션', 'Carnation', 'flower', 'bloom', 12, 3, 1, 2, 2, 12, 24, 1, 1, '#7aa08a', '#f06a8a', 'f'],
  ['chrysanthemum', '국화', 'Chrysanthemum', 'flower', 'bloom', 14, 4, 1, 2, 2, 10, 24, 2, 1, '#4f7a3a', '#f8d030', 'fp'],
  ['cosmos', '코스모스', 'Cosmos', 'flower', 'bloom', 10, 3, 1, 2, 1, 15, 28, 1, 2, '#6aa04a', '#f08ab8'],
  ['calendula', '금잔화', 'Calendula', 'flower', 'bloom', 9, 3, 1, 2, 1, 8, 24, 2, 1, '#5a9a4a', '#f89a1a', 'f'],
  ['marigold', '메리골드', 'Marigold', 'flower', 'bloom', 9, 3, 1, 2, 1, 16, 30, 1, 1, '#4f8a3a', '#f8b020'],
  ['dahlia', '다알리아', 'Dahlia', 'bush', 'bloom', 14, 4, 1, 2, 3, 15, 26, 2, 1, '#4f7a3a', '#c02a5a'],
  ['peony', '작약', 'Peony', 'bush', 'bloom', 20, 0, 1, 2, 4, 10, 24, 2, 0, '#4f7a4a', '#f0a0b8', 'fp'],
  ['hydrangea', '수국', 'Hydrangea', 'bush', 'bloom', 18, 5, 1, 2, 3, 12, 26, 3, 3, '#3f7a4a', '#7a9ae0', 'fp'],
  ['babysbreath', '안개꽃', "Baby's Breath", 'flower', 'bloom', 10, 3, 1, 2, 2, 12, 26, 1, 1, '#7aa08a', '#f8f8f8'],
  ['freesia', '프리지아', 'Freesia', 'flower', 'bloom', 11, 0, 1, 1, 3, 10, 20, 2, 1, '#5a9a4a', '#f8e050'],
  ['poppy', '양귀비', 'Corn Poppy', 'flower', 'bloom', 9, 0, 1, 1, 2, 8, 22, 1, 1, '#6a9a5a', '#e8301a', 'f'],
  ['violet', '제비꽃', 'Violet', 'flower', 'bloom', 7, 0, 1, 1, 1, 5, 20, 2, 2, '#4f8a4a', '#7a4ab8', 'f'],
  ['pansy', '팬지', 'Pansy', 'flower', 'bloom', 7, 3, 1, 1, 1, 2, 20, 2, 1, '#4f8a4a', '#b86ae0', 'f'],
  ['zinnia', '백일홍', 'Zinnia', 'flower', 'bloom', 10, 3, 1, 2, 1, 18, 32, 1, 1, '#4f8a3a', '#f05a3a'],
  ['sweetpea', '스위트피', 'Sweet Pea', 'vine', 'bloom', 11, 3, 1, 2, 2, 8, 22, 2, 1, '#5a9a5a', '#e8a0d0', 'ft'],
  ['lilyvalley', '은방울꽃', 'Lily of the Valley', 'flower', 'bloom', 12, 0, 1, 1, 4, 5, 18, 2, 2, '#3f7a4a', '#f8f8f0', 'fp'],
  ['camellia', '동백', 'Camellia', 'bush', 'bloom', 22, 5, 1, 2, 4, -2, 18, 2, 2, '#2f5a3a', '#d0202a', 'fp'],
  ['lotus', '연꽃', 'Lotus', 'paddy', 'bloom', 18, 4, 1, 1, 4, 20, 32, 3, 3, '#4f9a6a', '#f0a0c0', 'wp'],
  ['cornflower', '수레국화', 'Cornflower', 'flower', 'bloom', 9, 3, 1, 2, 1, 8, 24, 1, 1, '#6a9a7a', '#3a6ae0', 'f'],
  ['lisianthus', '리시안셔스', 'Lisianthus', 'flower', 'bloom', 16, 0, 1, 1, 4, 15, 26, 2, 0, '#5a8a7a', '#b0a0e8'],
  ['ranunculus', '라넌큘러스', 'Ranunculus', 'flower', 'bloom', 12, 0, 1, 1, 3, 5, 18, 2, 1, '#4f8a4a', '#f8a080', 'f'],
  ['forgetmenot', '물망초', 'Forget-me-not', 'flower', 'bloom', 8, 0, 1, 1, 2, 5, 20, 3, 2, '#4f8a5a', '#7ab0f0', 'f'],
];

const FRUIT: Row[] = [
  ['blueberry', '블루베리', 'Blueberry', 'bush', 'berry', 14, 3, 3, 5, 3, 10, 26, 2, 1, '#3f6a4a', '#3a4aa0', 'fp'],
  ['raspberry', '라즈베리', 'Raspberry', 'bush', 'berry', 12, 3, 3, 5, 3, 10, 25, 2, 1, '#4f7a3a', '#d03a5a', 'fp'],
  ['blackberry', '블랙베리', 'Blackberry', 'bush', 'berry', 13, 3, 3, 5, 2, 10, 28, 2, 1, '#3f6a3a', '#2a1f3a', 'fp'],
  ['bokbunja', '복분자', 'Korean Black Raspberry', 'bush', 'berry', 14, 3, 3, 5, 3, 12, 28, 2, 1, '#3f6a3a', '#4a1f3a', 'fp'],
  ['cranberry', '크랜베리', 'Cranberry', 'bush', 'berry', 16, 4, 3, 5, 3, 8, 24, 3, 3, '#3f6a4a', '#c01f3a', 'fpw'],
  ['gooseberry', '구스베리', 'Gooseberry', 'bush', 'berry', 12, 3, 3, 4, 2, 8, 24, 2, 1, '#4f7a3a', '#9ac86a', 'fp'],
  ['grape', '포도', 'Grape', 'vine', 'cluster', 20, 4, 1, 2, 3, 16, 30, 1, 0, '#4f7a3a', '#6a3a8a', 'tp'],
  ['shinemuscat', '샤인머스캣', 'Shine Muscat', 'vine', 'cluster', 24, 5, 1, 2, 5, 18, 30, 1, 0, '#4f7a3a', '#b8e070', 'tp'],
  ['kiwi', '키위', 'Kiwi', 'vine', 'round', 22, 5, 2, 3, 3, 12, 28, 2, 1, '#4f7a3a', '#8a6a3a', 'tp'],
  ['darae', '다래', 'Hardy Kiwi', 'vine', 'berry', 20, 4, 3, 4, 3, 10, 26, 2, 2, '#4f7a3a', '#7aa04a', 'ftp'],
  ['omija', '오미자', 'Schisandra', 'vine', 'cluster', 22, 5, 2, 3, 4, 10, 26, 2, 1, '#3f6a3a', '#d02030', 'ftp'],
  ['passionfruit', '패션프루트', 'Passion Fruit', 'vine', 'round', 22, 4, 2, 3, 4, 22, 32, 2, 1, '#3f7a3a', '#5a2a5a', 'tp'],
  ['pineapple', '파인애플', 'Pineapple', 'rosette', 'gourd', 28, 0, 1, 1, 4, 22, 32, 1, 1, '#5a8a5a', '#e0b030'],
  ['fig', '무화과', 'Fig', 'tree', 'round', 20, 4, 2, 3, 3, 15, 30, 1, 0, '#4f7a3a', '#7a3a5a', 'p'],
  ['pomegranate', '석류', 'Pomegranate', 'tree', 'round', 24, 5, 1, 2, 4, 18, 32, 1, 1, '#4f7a3a', '#c02a2a', 'p'],
  ['apple', '사과', 'Apple', 'tree', 'round', 26, 5, 2, 3, 3, 8, 24, 2, 1, '#4f7a3a', '#d0302a', 'fp'],
  ['pear', '배', 'Korean Pear', 'tree', 'round', 26, 5, 2, 3, 3, 8, 26, 2, 1, '#4f7a3a', '#d8b060', 'fp'],
  ['peach', '복숭아', 'Peach', 'tree', 'round', 24, 5, 2, 3, 3, 12, 28, 2, 0, '#4f7a3a', '#f8a080', 'fp'],
  ['plum', '자두', 'Plum', 'tree', 'round', 22, 4, 2, 3, 2, 10, 26, 2, 1, '#4f7a3a', '#8a2a5a', 'fp'],
  ['cherry', '체리', 'Cherry', 'tree', 'berry', 24, 5, 3, 5, 4, 8, 24, 2, 0, '#4f7a3a', '#b01f2a', 'fp'],
  ['apricot', '살구', 'Apricot', 'tree', 'round', 22, 4, 2, 3, 2, 10, 26, 1, 0, '#4f7a3a', '#f0a040', 'fp'],
  ['persimmon', '감', 'Persimmon', 'tree', 'round', 26, 5, 2, 3, 3, 12, 28, 2, 1, '#4f7a3a', '#f07a20', 'fp'],
  ['mandarin', '귤', 'Mandarin', 'tree', 'round', 26, 4, 3, 4, 3, 12, 30, 2, 2, '#3f6a3a', '#f09020', 'p'],
  ['hallabong', '한라봉', 'Hallabong', 'tree', 'round', 28, 5, 2, 3, 5, 14, 30, 2, 1, '#3f6a3a', '#f8a020', 'p'],
  ['lemon', '레몬', 'Lemon', 'tree', 'round', 26, 4, 2, 3, 4, 15, 30, 2, 1, '#3f6a3a', '#f8e040', 'p'],
  ['yuzu', '유자', 'Yuzu', 'tree', 'round', 26, 5, 2, 3, 4, 10, 28, 2, 2, '#3f6a3a', '#f0d030', 'fp'],
  ['mulberry', '오디', 'Mulberry', 'tree', 'berry', 18, 3, 3, 5, 2, 12, 30, 2, 2, '#4f7a3a', '#3a1f3a', 'fp'],
  ['aengdu', '앵두', 'Nanking Cherry', 'bush', 'berry', 16, 4, 3, 5, 2, 8, 26, 2, 1, '#4f7a3a', '#e0202a', 'fp'],
  ['maesil', '매실', 'Maesil Plum', 'tree', 'round', 20, 5, 3, 4, 2, 8, 26, 2, 2, '#4f7a3a', '#9ac04a', 'fp'],
  ['jujube', '대추', 'Jujube', 'tree', 'round', 22, 4, 3, 4, 3, 15, 30, 1, 1, '#4f7a3a', '#a02a1a', 'fp'],
  ['chestnut', '밤', 'Chestnut', 'tree', 'nut', 26, 5, 2, 4, 3, 10, 28, 1, 2, '#4f7a3a', '#7a4a2a', 'fp'],
  ['walnut', '호두', 'Walnut', 'tree', 'nut', 28, 6, 2, 3, 4, 10, 28, 1, 2, '#4f7a3a', '#b89a6a', 'fp'],
  ['olive', '올리브', 'Olive', 'tree', 'berry', 28, 5, 3, 5, 4, 15, 32, 1, 0, '#6a8a6a', '#4a5a2a', 'p'],
  ['mango', '망고', 'Mango', 'tree', 'round', 28, 5, 2, 3, 5, 24, 34, 2, 1, '#3f6a3a', '#f0a030', 'p'],
  ['banana', '바나나', 'Banana', 'tree', 'long', 28, 6, 3, 5, 4, 24, 34, 3, 2, '#5a9a4a', '#f0d040', 'p'],
  ['papaya', '파파야', 'Papaya', 'tree', 'gourd', 26, 5, 1, 2, 4, 22, 32, 2, 1, '#4f8a3a', '#f09030', 'p'],
  ['dragonfruit', '용과', 'Dragon Fruit', 'vine', 'round', 24, 5, 1, 2, 5, 22, 34, 1, 0, '#4f8a5a', '#e02a7a', 'tp'],
  ['avocado', '아보카도', 'Avocado', 'tree', 'round', 28, 6, 1, 2, 5, 18, 30, 2, 1, '#3f6a3a', '#3a5a2a', 'p'],
  ['lychee', '리치', 'Lychee', 'tree', 'berry', 28, 5, 3, 4, 5, 22, 32, 2, 1, '#3f6a3a', '#d0404a', 'p'],
];

/** Daily value per tile by tier — the backbone of the price formula. */
export const TIER_DAILY_VALUE = [0, 9, 14, 21, 31, 46] as const;

const roundPrice = (v: number) => (v >= 10 ? Math.max(10, Math.round(v / 5) * 5) : Math.max(1, Math.round(v)));

export function derivePrices(grow: number, regrow: number, yMin: number, yMax: number, tier: number) {
  const v = TIER_DAILY_VALUE[tier];
  const avgYield = (yMin + yMax) / 2;
  const sellPrice = regrow > 0 ? (v * regrow * 1.3) / avgYield : (v * grow) / avgYield;
  const seedPrice = 0.35 * v * grow;
  return { sellPrice: roundPrice(sellPrice), seedPrice: roundPrice(seedPrice) };
}

function build(category: CropCategory, rows: Row[]): CropDef[] {
  return rows.map(([id, name, nameEn, form, shape, grow, regrow, yMin, yMax, tier, tMin, tMax, water, rain, leaf, produce, flags = '']) => ({
    id,
    name,
    nameEn,
    category,
    form,
    shape,
    growDays: grow,
    regrowDays: regrow,
    yield: [yMin, yMax] as const,
    tier,
    temp: [tMin, tMax] as const,
    water,
    rainTolerance: rain,
    frostHardy: flags.includes('f'),
    trellis: flags.includes('t'),
    perennial: flags.includes('p'),
    paddy: flags.includes('w'),
    leafColor: leaf,
    produceColor: produce,
    ...derivePrices(grow, regrow, yMin, yMax, tier),
  }));
}

export const CROPS: readonly CropDef[] = [
  ...build('leafy', LEAFY),
  ...build('root', ROOT),
  ...build('bulb', BULB),
  ...build('fruitveg', FRUITVEG),
  ...build('legume', LEGUME),
  ...build('grain', GRAIN),
  ...build('special', SPECIAL),
  ...build('herb', HERB),
  ...build('flower', FLOWER),
  ...build('fruit', FRUIT),
];

const BY_ID = new Map(CROPS.map((c) => [c.id, c]));

export function getCrop(id: string): CropDef {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Unknown crop: ${id}`);
  return c;
}

export function findCrop(id: string): CropDef | undefined {
  return BY_ID.get(id);
}

export const CATEGORY_LABEL: Record<CropCategory, string> = {
  leafy: '잎채소',
  root: '뿌리채소',
  bulb: '구근채소',
  fruitveg: '열매채소',
  legume: '콩류',
  grain: '곡물',
  special: '특용작물',
  herb: '허브',
  flower: '꽃',
  fruit: '과일',
};

export const WATER_LABEL = ['', '적음', '보통', '많음'] as const;
export const RAIN_LABEL = ['비에 매우 약함', '비에 약함', '비에 강함', '비를 좋아함'] as const;
