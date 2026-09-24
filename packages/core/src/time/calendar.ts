/** Real milliseconds per in-game minute. */
export const MS_PER_GAME_MINUTE = 700;
export const DAY_START = 6 * 60;
/** The earliest you can go to bed (19:00): no sleeping the day away to skip ahead. */
export const SLEEP_FROM = 19 * 60;
/** 02:00 of the next day — forced sleep. */
export const DAY_END = 26 * 60;
export const SHIP_DEPARTURE = 17 * 60;
export const DAYS_PER_SEASON = 28;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * 4;

export type Season = 0 | 1 | 2 | 3;
export const SEASON_NAME = ['봄', '여름', '가을', '겨울'] as const;
export const SEASON_NAME_EN = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
export const WEEKDAY_NAME = ['월', '화', '수', '목', '금', '토', '일'] as const;

export interface Clock {
  /** Absolute day index, starting at 0 = Spring 1, Year 1. */
  day: number;
  /** Minutes since midnight of `day` (360 .. 1560). */
  minute: number;
}

export function seasonOf(day: number): Season {
  return Math.floor((day % DAYS_PER_YEAR) / DAYS_PER_SEASON) as Season;
}

export function dayOfSeason(day: number): number {
  return (day % DAYS_PER_SEASON) + 1;
}

export function dayOfYear(day: number): number {
  return day % DAYS_PER_YEAR;
}

export function yearOf(day: number): number {
  return Math.floor(day / DAYS_PER_YEAR) + 1;
}

export function weekdayOf(day: number): number {
  return day % 7;
}

/** "06:40" — minutes can exceed 24h (e.g. 25:10 → 01:10). */
export function formatTime(minute: number): string {
  const m = Math.floor(minute) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = Math.floor((m % 60) / 10) * 10;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function formatDate(day: number): string {
  return `${SEASON_NAME[seasonOf(day)]} ${dayOfSeason(day)}일 (${WEEKDAY_NAME[weekdayOf(day)]})`;
}
