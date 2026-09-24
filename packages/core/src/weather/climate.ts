import { DAYS_PER_YEAR, type Season } from '../time/calendar';

/** Mean temperature keyframes over the year (day-of-year → °C). Maritime island climate. */
const KEYFRAMES: ReadonlyArray<readonly [number, number]> = [
  [0, 7],
  [14, 12],
  [28, 18],
  [42, 24],
  [52, 27],
  [60, 23],
  [72, 15],
  [84, 8],
  [98, 2],
  [112, 7],
];

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Climatological mean temperature for a day of the year (before weather). */
export function baseTemperature(dayOfYear: number): number {
  const d = ((dayOfYear % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    const [d0, t0] = KEYFRAMES[i];
    const [d1, t1] = KEYFRAMES[i + 1];
    if (d >= d0 && d <= d1) return t0 + (t1 - t0) * smooth((d - d0) / (d1 - d0));
  }
  return KEYFRAMES[0][1];
}

/** Average temperature of a whole season — used for shop stocking and "in season" pricing. */
export function seasonMeanTemp(season: Season): number {
  let sum = 0;
  for (let i = 0; i < 28; i++) sum += baseTemperature(season * 28 + i);
  return sum / 28;
}
