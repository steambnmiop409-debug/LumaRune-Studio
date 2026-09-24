import { getCrop, type CropDef } from '../data/crops';
import { FERTILIZER_EFFECT } from '../data/items';
import type { Rng } from '../math/rng';
import type { CropState, DeathReason, SoilState } from '../state/types';
import { rainExposureHours, type DayWeather } from '../weather/weather';

/** Minimum moisture reached during the day for the crop to count as watered, by water need 1..3. */
export const WATER_THRESHOLD = [0, 25, 45, 65] as const;
/** Consecutive dry days before a crop dies, by water need. */
export const MAX_DRY_DAYS = [0, 4, 3, 2] as const;
/** Hours of rain a crop tolerates per day, by rain tolerance 0..3. */
export const RAIN_ALLOWED_HOURS = [2, 5, 10, Infinity] as const;
/** Consecutive over-rained days before rot, by rain tolerance. */
export const MAX_SOGGY_DAYS = [2, 3, 5, Infinity] as const;
export const QUALITY_THRESHOLDS = [1.6, 2.4, 3.2, 4.0] as const;

export function newCrop(id: string, day: number): CropState {
  return { id, growth: 0, plantedDay: day, dry: 0, soggy: 0, stress: 0, good: 0, total: 0, tonic: 0, harvests: 0, dead: null, dormant: false };
}

export function isReady(crop: CropState): boolean {
  return !crop.dead && !crop.dormant && crop.growth >= getCrop(crop.id).growDays;
}

/** 0..4 visual stage (4 = harvestable). */
export function cropStage(crop: CropState): number {
  const def = getCrop(crop.id);
  if (crop.growth >= def.growDays) return 4;
  return Math.min(3, Math.floor((crop.growth / def.growDays) * 4));
}

/** Fine-grained visual step 0..10 (10 = harvestable) so plants visibly grow a little each day. */
export function cropStep(crop: CropState): number {
  const def = getCrop(crop.id);
  if (crop.growth >= def.growDays) return 10;
  if (crop.growth <= 0) return 0;
  return Math.min(9, 1 + Math.floor((crop.growth / def.growDays) * 9));
}

export function temperatureFactor(def: CropDef, temp: number): number {
  const [lo, hi] = def.temp;
  if (temp >= lo && temp <= hi) return 1;
  const dist = temp < lo ? lo - temp : temp - hi;
  return dist <= 4 ? 0.5 : 0.1;
}

export interface DailyCropReport {
  died: DeathReason | null;
  becameReady: boolean;
  stressed: Array<'dry' | 'rain' | 'cold' | 'heat'>;
}

/**
 * Advances one crop by one day using the weather of the day that just ended.
 * `covered` means the tile is under a rain cover.
 */
export function growCropOneDay(soil: SoilState, weather: DayWeather, covered: boolean): DailyCropReport {
  const crop = soil.crop!;
  const report: DailyCropReport = { died: null, becameReady: false, stressed: [] };
  if (crop.dead) return report;
  const def = getCrop(crop.id);
  const wasReady = crop.growth >= def.growDays;

  // Perennials sleep through unsuitable seasons instead of dying (unless it freezes and they are tender).
  const [lo, hi] = def.temp;
  crop.dormant = def.perennial && (weather.meanTemp < lo - 6 || weather.meanTemp > hi + 6);

  // 1. Frost.
  if (weather.minTemp < 0 && !def.frostHardy) {
    crop.dead = 'frost';
    report.died = 'frost';
    return report;
  }
  if (crop.dormant) return report;

  // 2. Water.
  const watered = soil.dayMax >= WATER_THRESHOLD[def.water];
  if (!watered) {
    crop.dry++;
    report.stressed.push('dry');
    if (crop.dry >= MAX_DRY_DAYS[def.water]) {
      crop.dead = 'drought';
      report.died = 'drought';
      return report;
    }
  } else crop.dry = 0;

  // 3. Rain exposure.
  const rainH = covered ? 0 : rainExposureHours(weather);
  const allowed = RAIN_ALLOWED_HOURS[def.rainTolerance];
  const excess = Math.max(0, rainH - allowed);
  if (excess > 0) {
    crop.soggy++;
    crop.stress += Math.min(3, excess / Math.max(1, allowed));
    report.stressed.push('rain');
    if (crop.soggy >= MAX_SOGGY_DAYS[def.rainTolerance]) {
      crop.dead = 'rot';
      report.died = 'rot';
      return report;
    }
  } else crop.soggy = Math.max(0, crop.soggy - 1);

  // 4. Temperature.
  const tf = temperatureFactor(def, weather.meanTemp);
  if (tf < 1) {
    crop.stress += (1 - tf) * 0.5;
    report.stressed.push(weather.meanTemp < lo ? 'cold' : 'heat');
  }

  // 5. Growth.
  const speed = soil.fert ? FERTILIZER_EFFECT[soil.fert].speed : 0;
  crop.growth += tf * (watered ? 1 : 0.25) * (1 + speed);

  // 6. Care score.
  crop.total++;
  if (watered && tf === 1 && excess === 0) crop.good++;
  if (def.rainTolerance === 3 && rainH > 0) crop.good = Math.min(crop.total, crop.good + 0.5);

  report.becameReady = !wasReady && crop.growth >= def.growDays;
  return report;
}

/** Evaporation at the end of a day. */
export function evaporate(soil: SoilState, weather: DayWeather): void {
  let evap = 30 + Math.max(0, weather.meanTemp - 15) * 2;
  if (weather.kind === 'clear') evap += 10;
  if (weather.kind === 'cloudy' || weather.kind === 'fog') evap -= 8;
  if (soil.fert && FERTILIZER_EFFECT[soil.fert].retain) evap *= 0.5;
  soil.moisture = Math.max(0, soil.moisture - evap);
  soil.dayMax = soil.moisture;
}

/** ★1..5 at harvest time. */
export function rollQuality(soil: SoilState, rng: Rng): number {
  const crop = soil.crop!;
  const care = crop.total > 0 ? crop.good / crop.total : 0.5;
  const fert = soil.fert ? FERTILIZER_EFFECT[soil.fert].quality : 0;
  const score = care * 3 + fert + ((soil.fertility - 50) / 50) * 0.5 + crop.tonic * 0.4 - crop.stress * 0.25 + rng.range(-0.3, 0.3);
  let stars = 1;
  for (const t of QUALITY_THRESHOLDS) if (score >= t) stars++;
  return stars;
}

export function rollYield(def: CropDef, quality: number, rng: Rng): number {
  let n = rng.int(def.yield[0], def.yield[1]);
  if (quality >= 4 && rng.chance(0.3)) n++;
  return n;
}
