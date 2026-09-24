import { findCrop, getItem, isMachine, parseArtisan, type Appearance, type Building, type WeatherKind } from '@lumina/core';

/** Colour of an artisan good's contents, from what it was made of. */
const FORAGE_COLOR: Record<string, string> = {
  'forage.apple': '#d8403a',
  'forage.peach': '#f0a050',
  'forage.pear': '#c8d050',
  'forage.plum': '#8a3a78',
  'forage.wildberry': '#b82a58',
  'forage.chanterelle': '#f0b040',
  'forage.morel': '#9a7048',
  'forage.wildflower': '#e888c8',
};
function sourceColor(source: string | null): string {
  if (!source) return '#f0b030';
  if (source.startsWith('crop.')) return findCrop(source.slice(5))?.produceColor ?? '#c8a060';
  return FORAGE_COLOR[source] ?? '#c8a060';
}
import { buildingSprite, windmillSails, type BuildingSprite } from './sprites/buildings';
import { characterSheet, type CharacterSheet } from './sprites/character';
import { cropSprite, deadCropSprite, produceIcon, seedIcon } from './sprites/crops';
import { ITEM_ICONS } from './sprites/items';
import { forageGround, forageIcon, noticeBoard } from './sprites/forage';
import * as landmarks from './sprites/landmarks';
import { fieldStone, twig, weed } from './sprites/debris';
import * as machines from './sprites/machines';
import { birch, broadleaf, cherry, conifer, shrub } from './sprites/foliage';
import { Pix } from './Pix';
import { pack as packColor } from './palette';
import { flowers, palmTree, reeds, rock, stump, type SeasonLook, type TreeSprite } from './sprites/nature';
import * as props from './sprites/props';
import * as details from './sprites/details';
import { shipSprite } from './sprites/ship';
import * as ui from './sprites/ui';

/**
 * Central sprite cache. Every sprite is generated on first use and memoised by key.
 * Hand-drawn art can later replace any entry by registering an image under the same key.
 */
class SpriteCache {
  private cache = new Map<string, unknown>();

  get<T>(key: string, make: () => T): T {
    let v = this.cache.get(key) as T | undefined;
    if (v === undefined) {
      v = make();
      this.cache.set(key, v);
    }
    return v;
  }

  /** Override a generated sprite with custom art. */
  register(key: string, value: unknown): void {
    this.cache.set(key, value);
  }

  tree(kind: 'oak' | 'pine' | 'blossom' | 'palm' | 'fruittree', v: number, season: SeasonLook): TreeSprite {
    const variant = v; // every tree on the island is its own drawing
    return this.get(`tree:${kind}:${variant}:${kind === 'palm' ? 0 : season}`, () =>
      kind === 'oak'
        ? // Broadleaf woods mix oaks with the odd birch and golden-leaved tree.
          variant % 7 === 3
          ? birch(variant, season)
          : broadleaf(variant, season, variant % 6 === 1)
        : kind === 'pine'
          ? conifer(variant, season)
          : kind === 'blossom'
            ? cherry(variant, season)
            : kind === 'fruittree'
              ? landmarks.fruitTree(variant, season)
              : palmTree(variant),
    );
  }
  /** Landmark props (tents, ruins, gazebo…). `frame` animates where it matters. */
  landmark(kind: string, v: number, frame = 0): HTMLCanvasElement {
    return this.get(`landmark:${kind}:${v}:${frame}`, () => {
      switch (kind) {
        case 'tent':
          return landmarks.tent(v);
        case 'campfire':
          return landmarks.campfire(v, frame);
        case 'logseat':
          return landmarks.logSeat(v);
        case 'woodpile':
          return landmarks.woodpile(v);
        case 'ruin':
          return landmarks.ruinPillar(v);
        case 'shrine':
          return landmarks.shrine(v, frame === 1);
        case 'tidepool':
          return landmarks.tidepool(v, frame);
        case 'parasol':
          return landmarks.parasol(v);
        case 'sandcastle':
          return landmarks.sandcastle(v);
        case 'buoy':
          return landmarks.buoy(v, frame);
        case 'cave':
          return machines.caveMouth(v, frame === 1);
        case 'rail':
          return machines.rail(v);
        case 'minecart':
          return machines.minecart(v);
        case 'orepile':
          return machines.orePile(v);
        case 'workbench':
          return machines.workbench(v);
        default:
          return landmarks.gazebo(v);
      }
    });
  }

  bush(v: number, season: SeasonLook) {
    return this.get(`bush:${v}:${season}`, () => shrub(v, season));
  }
  /** Crisp pixel ellipse shadow with a dithered rim (no anti-aliased edges). */
  shadowBlob(rx: number, ry: number, alpha = 60) {
    return this.get(`shadow:${rx}:${ry}:${alpha}`, () => {
      const w = rx * 2 + 1;
      const h = ry * 2 + 1;
      const p = new Pix(w, h);
      const solid = packColor('#18204a', alpha);
      const soft = packColor('#18204a', Math.round(alpha * 0.55));
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const d = ((x - rx) / (rx + 0.5)) ** 2 + ((y - ry) / (ry + 0.5)) ** 2;
          if (d > 1) continue;
          if (d > 0.62) {
            if ((x + y) & 1) p.set(x, y, soft);
          } else p.set(x, y, solid);
        }
      return p.toCanvas();
    });
  }
  rock(v: number) {
    return this.get(`rock:${v}`, () => rock(v));
  }
  stump() {
    return this.get('stump', stump);
  }
  flowers(v: number, frame: number) {
    return this.get(`flowers:${v}:${frame}`, () => flowers(v, frame));
  }
  reeds(v: number, frame: number) {
    return this.get(`reeds:${v}:${frame}`, () => reeds(v, frame));
  }
  /** Unique life-detail props (tall grass, boats, stalls…). */
  detail(kind: string, v: number, frame = 0): HTMLCanvasElement {
    return this.get(`detail:${kind}:${v}:${frame}`, () => {
      switch (kind) {
        case 'tallgrass':
          return details.tallGrass(v, frame);
        case 'pebbles':
          return details.pebbles(v);
        case 'mushroom':
          return details.mushroom(v);
        case 'log':
          return details.log(v);
        case 'lilypad':
          return details.lilypad(v, frame);
        case 'boat':
          return details.boat(v);
        case 'netrack':
          return details.netRack(v);
        case 'fishcrate':
          return details.fishCrate(v);
        case 'anchor':
          return details.anchor();
        case 'stall':
          return details.stall(v);
        case 'flowerbed':
          return details.flowerBed(v);
        case 'laundry':
          return details.laundry(v, frame);
        case 'haybale':
          return details.hayBale(v);
        case 'scarecrow':
          return details.scarecrow(v, frame);
        case 'beehive':
          return details.beehive(v);
        case 'picnic':
          return details.picnic(v);
        default:
          return details.telescope();
      }
    });
  }
  lamp(lit: boolean) {
    return this.get(`lamp:${lit}`, () => props.lamp(lit));
  }
  fence(mask: number) {
    return this.get(`fence:${mask}`, () => props.fence(mask));
  }
  prop(kind: 'bench' | 'well' | 'sign' | 'barrel' | 'bollard' | 'packbench' | 'mailbox') {
    return this.get(`prop:${kind}`, () => {
      switch (kind) {
        case 'bench':
          return props.bench();
        case 'well':
          return props.well();
        case 'sign':
          return props.signpost();
        case 'barrel':
          return props.barrel();
        case 'bollard':
          return props.bollard();
        case 'packbench':
          return props.packbench();
        case 'mailbox':
          return props.mailbox();
      }
    });
  }
  fountain(frame: number) {
    return this.get(`fountain:${frame}`, () => props.fountain(frame));
  }
  flowerpot(v: number) {
    return this.get(`pot:${v}`, () => props.flowerpot(v));
  }
  crate(label?: string) {
    return this.get(`crate:${label ?? ''}`, () => props.crate(label));
  }
  sprinkler(tier: 1 | 2 | 3) {
    return this.get(`sprinkler:${tier}`, () => props.sprinkler(tier));
  }
  rainCover() {
    return this.get('raincover', props.rainCover);
  }
  soil(mask: number, wet: boolean) {
    return this.get(`soil:${mask}:${wet}`, () => props.soilTile(mask, wet));
  }
  fert(kind: string) {
    return this.get(`fert:${kind}`, () => props.fertMark(kind));
  }
  building(b: Building): BuildingSprite {
    return this.get(`bld:${b.id}`, () => buildingSprite(b));
  }
  sails(frame: number) {
    return this.get(`sails:${frame}`, () => windmillSails(frame, 12));
  }
  ship(crates: number) {
    return this.get(`ship:${Math.min(14, crates)}`, () => shipSprite(crates));
  }
  crop(id: string, stage: number) {
    return this.get(`crop:${id}:${stage}`, () => cropSprite(findCrop(id)!, stage));
  }
  deadCrop(tall: boolean) {
    return this.get(`dead:${tall}`, () => deadCropSprite(tall));
  }
  character(look: Appearance): CharacterSheet {
    const key = `char:${look.skin}.${look.hairStyle}.${look.hairColor}.${look.eyes}.${look.top}.${look.topColor}.${look.bottomColor}.${look.hat}`;
    return this.get(key, () => characterSheet(look));
  }

  /** 16×16 icon for any item id. */
  icon(id: string): HTMLCanvasElement {
    return this.get(`icon:${id}`, () => {
      const def = getItem(id);
      if (def.kind === 'seed') return seedIcon(findCrop(def.cropId!)!);
      if (def.kind === 'produce') return produceIcon(findCrop(def.cropId!)!);
      if (def.kind === 'forage') return forageIcon(id) ?? props.crate();
      if (machines.MATERIAL_ICONS[id]) return machines.MATERIAL_ICONS[id]();
      if (def.kind === 'artisan') {
        const a = parseArtisan(id)!;
        return machines.artisanIcon(a.type, sourceColor(a.source));
      }
      if (def.placeable && isMachine(def.placeable)) return machines.machineIcon(def.placeable);
      if (def.placeable?.startsWith('sprinkler')) return props.sprinkler(Number(def.placeable.slice(-1)) as 1 | 2 | 3);
      const make = ITEM_ICONS[id];
      return make ? make() : props.crate();
    });
  }

  debris(kind: 'weed' | 'stone' | 'twig', v: number, frame = 0, season = 1) {
    const s = kind === 'weed' ? season : 1;
    return this.get(`debris:${kind}:${v}:${frame}:${s}`, () => (kind === 'weed' ? weed(v, frame, s) : kind === 'stone' ? fieldStone(v) : twig(v)));
  }
  /** A placed machine; `state` animates it (furnace glow, crank, reaping arms, fullness). */
  machine(kind: string, v: number, state = 0) {
    return this.get(`machine:${kind}:${v}:${state}`, () => {
      switch (kind) {
        case 'chest':
          return machines.chest(v);
        case 'compost':
          return machines.compost(v, state > 0);
        case 'furnace':
          return machines.furnace(v, state);
        case 'jar':
          return machines.jar(v, state > 0);
        case 'keg':
          return machines.keg(v);
        case 'seedmaker':
          return machines.seedMaker(v, state);
        case 'beehouse':
          return machines.beehouse(v);
        default:
          return machines.harvester(v, state);
      }
    });
  }
  outcrop(kind: string, v: number) {
    return this.get(`outcrop:${kind}:${v}`, () => machines.outcrop(kind, v));
  }
  board(fresh: boolean) {
    return this.get(`board:${fresh}`, () => noticeBoard(fresh));
  }
  forage(id: string) {
    return this.get(`forageG:${id}`, () => forageGround(id) ?? this.icon(id));
  }

  panel(w: number, h: number, tone: 'paper' | 'dark' = 'paper') {
    return this.get(`panel:${w}x${h}:${tone}`, () => ui.panel(w, h, tone));
  }
  slot(selected: boolean) {
    return this.get(`slot:${selected}`, () => ui.slotFrame(selected));
  }
  star(filled: boolean, size: 5 | 7 = 5) {
    return this.get(`star:${filled}:${size}`, () => ui.star(filled, size));
  }
  quality(q: number) {
    return this.get(`quality:${q}`, () => ui.qualityStar(q));
  }
  coin() {
    return this.get('coin', ui.coin);
  }
  drop(filled: boolean) {
    return this.get(`drop:${filled}`, () => ui.drop(filled));
  }
  umbrella() {
    return this.get('umbrella', ui.umbrella);
  }
  thermometer() {
    return this.get('thermo', ui.thermometer);
  }
  snowflake() {
    return this.get('snowflake', ui.snowflake);
  }
  weather(kind: WeatherKind) {
    return this.get(`wicon:${kind}`, () => ui.weatherIcon(kind));
  }
  cursor(color: string) {
    return this.get(`cursor:${color}`, () => ui.cursorBrackets(color));
  }
  pointer() {
    return this.get('pointer', ui.pointer);
  }
}

export const Sprites = new SpriteCache();
