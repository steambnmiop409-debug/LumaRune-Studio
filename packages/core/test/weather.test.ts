import { describe, expect, it } from 'vitest';
import { Rng, baseTemperature, generateDayWeather, rainExposureHours, temperatureAt, type WeatherKind } from '../src';

describe('climate & weather', () => {
  it('is warm in summer and cold in winter', () => {
    expect(baseTemperature(0)).toBeCloseTo(7, 0);
    expect(baseTemperature(52)).toBeGreaterThan(25);
    expect(baseTemperature(98)).toBeLessThan(4);
  });

  it('produces a plausible mix of weather over ten years', () => {
    const rng = new Rng(1);
    let prev: WeatherKind | null = null;
    const counts: Record<string, number> = {};
    for (let d = 0; d < 1120; d++) {
      const w = generateDayWeather(rng, d, prev);
      counts[w.kind] = (counts[w.kind] ?? 0) + 1;
      prev = w.kind;
      if (w.kind === 'snow') expect(w.meanTemp).toBeLessThan(4);
      if (w.kind === 'rain' || w.kind === 'storm') expect(rainExposureHours(w)).toBeGreaterThan(0);
      expect(w.minTemp).toBeLessThan(w.maxTemp);
    }
    expect(counts.clear / 1120).toBeGreaterThan(0.3);
    expect(counts.rain / 1120).toBeGreaterThan(0.1);
    expect(counts.snow).toBeGreaterThan(0);
  });

  it('peaks in the afternoon', () => {
    const w = generateDayWeather(new Rng(5), 40, null);
    expect(temperatureAt(w, 15 * 60)).toBeGreaterThan(temperatureAt(w, 5 * 60));
  });
});
