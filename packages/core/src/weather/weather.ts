import { Rng } from '../math/rng';
import { dayOfSeason, dayOfYear, seasonOf, DAY_START, type Season } from '../time/calendar';
import { baseTemperature } from './climate';

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow';

export const WEATHER_NAME: Record<WeatherKind, string> = {
  clear: '맑음',
  cloudy: '흐림',
  rain: '비',
  storm: '폭풍',
  fog: '안개',
  snow: '눈',
};

export interface DayWeather {
  day: number;
  kind: WeatherKind;
  /** Precipitation window in minutes since midnight (only for rain/storm/snow). */
  precipStart: number;
  precipEnd: number;
  /** 0 .. 1 */
  wind: number;
  meanTemp: number;
  minTemp: number;
  maxTemp: number;
}

const SEASON_TABLE: Record<Season, Record<WeatherKind, number>> = {
  0: { clear: 45, cloudy: 25, rain: 20, storm: 3, fog: 7, snow: 0 },
  1: { clear: 45, cloudy: 15, rain: 25, storm: 12, fog: 3, snow: 0 },
  2: { clear: 50, cloudy: 25, rain: 15, storm: 4, fog: 6, snow: 0 },
  3: { clear: 40, cloudy: 35, rain: 10, storm: 2, fog: 3, snow: 10 },
};

const TEMP_OFFSET: Record<WeatherKind, number> = { clear: 1.5, cloudy: 0, rain: -2, storm: -3, fog: -1, snow: -3 };

export function isWet(kind: WeatherKind): boolean {
  return kind === 'rain' || kind === 'storm';
}

/** Decides the weather of `day`, given the previous day's weather. Deterministic for a given rng state. */
export function generateDayWeather(rng: Rng, day: number, prev: WeatherKind | null): DayWeather {
  const season = seasonOf(day);
  let kind: WeatherKind;
  const persist = prev === 'storm' ? 0.15 : 0.35;
  if (prev && prev !== 'snow' && rng.chance(persist)) {
    kind = prev;
  } else {
    const table = { ...SEASON_TABLE[season] };
    const dos = dayOfSeason(day);
    // Monsoon: early summer doubles rain.
    if (season === 1 && dos >= 5 && dos <= 18) table.rain *= 2;
    kind = rng.weighted(table);
  }

  const base = baseTemperature(dayOfYear(day));
  let meanTemp = base + TEMP_OFFSET[kind] + rng.range(-3, 3);
  if (kind === 'rain' && meanTemp < 2) kind = 'snow';
  if (kind === 'snow' && meanTemp >= 4) kind = 'rain';
  if (kind === 'snow') meanTemp = Math.min(meanTemp, 1);
  const swing = kind === 'clear' ? 6 : 4;

  let precipStart = 0;
  let precipEnd = 0;
  if (kind === 'rain' || kind === 'snow') {
    precipStart = DAY_START + rng.int(0, 12) * 60;
    precipEnd = precipStart + rng.int(4, 12) * 60;
  } else if (kind === 'storm') {
    precipStart = DAY_START + rng.int(0, 8) * 60;
    precipEnd = precipStart + rng.int(8, 16) * 60;
  }

  const wind = kind === 'storm' ? rng.range(0.8, 1) : kind === 'rain' ? rng.range(0.2, 0.5) : rng.range(0, 0.35);

  return {
    day,
    kind,
    precipStart,
    precipEnd,
    wind,
    meanTemp: Math.round(meanTemp * 10) / 10,
    minTemp: Math.round((meanTemp - swing) * 10) / 10,
    maxTemp: Math.round((meanTemp + swing) * 10) / 10,
  };
}

/** Temperature at a given minute: minimum at 05:00, maximum at 15:00. */
export function temperatureAt(w: DayWeather, minute: number): number {
  const h = (minute / 60) % 24;
  const phase = Math.cos(((h - 15) / 24) * Math.PI * 2);
  return w.meanTemp + ((w.maxTemp - w.minTemp) / 2) * phase;
}

export function isPrecipitating(w: DayWeather, minute: number): boolean {
  return w.precipEnd > w.precipStart && minute >= w.precipStart && minute < w.precipEnd;
}

/** Hours of rain (storm counts double) — used for crop rain exposure. */
export function rainExposureHours(w: DayWeather): number {
  if (!isWet(w.kind)) return 0;
  const hours = (w.precipEnd - w.precipStart) / 60;
  return w.kind === 'storm' ? hours * 2 : hours;
}
