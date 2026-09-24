import { findCrop, getItem, type Appearance, type Building, type WeatherKind } from '@lumina/core';
import { buildingSprite, windmillSails, type BuildingSprite } from './sprites/buildings';
import { characterSheet, type CharacterSheet } from './sprites/character';
import { cropSprite, deadCropSprite, produceIcon, seedIcon } from './sprites/crops';
import { ITEM_ICONS } from './sprites/items';
import { blossomTree, bush, flowers, oakTree, palmTree, pineTree, reeds, rock, stump, type SeasonLook, type TreeSprite } from './sprites/nature';
import * as props from './sprites/props';
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

  tree(kind: 'oak' | 'pine' | 'blossom' | 'palm', v: number, season: SeasonLook): TreeSprite {
    const variant = v % 8;
    return this.get(`tree:${kind}:${variant}:${kind === 'palm' ? 0 : season}`, () =>
      kind === 'oak' ? oakTree(variant, season) : kind === 'pine' ? pineTree(variant, season) : kind === 'blossom' ? blossomTree(variant, season) : palmTree(variant),
    );
  }

  bush(v: number, season: SeasonLook) {
    return this.get(`bush:${v % 6}:${season}`, () => bush(v % 6, season));
  }
  rock(v: number) {
    return this.get(`rock:${v % 6}`, () => rock(v % 6));
  }
  stump() {
    return this.get('stump', stump);
  }
  flowers(v: number, frame: number) {
    return this.get(`flowers:${v % 12}:${frame}`, () => flowers(v % 12, frame));
  }
  reeds(v: number, frame: number) {
    return this.get(`reeds:${v % 10}:${frame}`, () => reeds(v % 10, frame));
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
    return this.get(`pot:${v % 4}`, () => props.flowerpot(v % 4));
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
      if (def.placeable?.startsWith('sprinkler')) return props.sprinkler(Number(def.placeable.slice(-1)) as 1 | 2 | 3);
      const make = ITEM_ICONS[id];
      return make ? make() : props.crate();
    });
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
