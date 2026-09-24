import { describe, expect, it } from 'vitest';
import { Rng, getCrop, growCropOneDay, isReady, newCrop, newSoil, rollQuality, type DayWeather, type SoilState } from '../src';

const day = (over: Partial<DayWeather> = {}): DayWeather => ({
  day: 0,
  kind: 'clear',
  precipStart: 0,
  precipEnd: 0,
  wind: 0,
  meanTemp: 20,
  minTemp: 14,
  maxTemp: 26,
  ...over,
});
const rainy = (hours: number, over: Partial<DayWeather> = {}) => day({ kind: 'rain', precipStart: 600, precipEnd: 600 + hours * 60, ...over });

function planted(id: string): SoilState {
  const s = newSoil();
  s.crop = newCrop(id, 0);
  return s;
}

describe('crop growth', () => {
  it('reaches harvest in exactly growDays with perfect care', () => {
    const s = planted('tomato');
    const def = getCrop('tomato');
    for (let d = 0; d < def.growDays; d++) {
      s.dayMax = 100;
      growCropOneDay(s, day(), false);
    }
    expect(isReady(s.crop!)).toBe(true);
    expect(rollQuality(s, new Rng(3))).toBeGreaterThanOrEqual(3);
  });

  it('dies of drought when never watered', () => {
    const s = planted('cucumber'); // high water need
    for (let d = 0; d < 3; d++) growCropOneDay(s, day(), false);
    expect(s.crop!.dead).toBe('drought');
  });

  it('rots rain-sensitive crops after days of heavy rain, unless covered', () => {
    const exposed = planted('strawberry');
    const covered = planted('strawberry');
    for (let d = 0; d < 3; d++) {
      exposed.dayMax = covered.dayMax = 100;
      growCropOneDay(exposed, rainy(10), false);
      growCropOneDay(covered, rainy(10), true);
    }
    expect(exposed.crop!.dead).toBe('rot');
    expect(covered.crop!.dead).toBeNull();
  });

  it('lets rain-loving rice thrive in the same rain', () => {
    const s = planted('rice');
    for (let d = 0; d < 5; d++) {
      s.dayMax = 100;
      growCropOneDay(s, rainy(12, { meanTemp: 26 }), false);
    }
    expect(s.crop!.dead).toBeNull();
    expect(s.crop!.stress).toBe(0);
  });

  it('frost kills tender crops but not hardy ones', () => {
    const tender = planted('tomato');
    const hardy = planted('kale');
    const frost = day({ meanTemp: 3, minTemp: -3, maxTemp: 8 });
    tender.dayMax = hardy.dayMax = 100;
    growCropOneDay(tender, frost, false);
    growCropOneDay(hardy, frost, false);
    expect(tender.crop!.dead).toBe('frost');
    expect(hardy.crop!.dead).toBeNull();
  });

  it('grows slower outside the temperature band', () => {
    const s = planted('lettuce');
    s.dayMax = 100;
    growCropOneDay(s, day({ meanTemp: 33, minTemp: 27, maxTemp: 39 }), false);
    expect(s.crop!.growth).toBeLessThan(0.5);
  });

  it('rewards fertilizer and tonic with higher quality', () => {
    const plain = planted('cabbage');
    const cared = planted('cabbage');
    cared.fert = 'quality';
    cared.fertility = 90;
    cared.crop!.tonic = 2;
    for (const s of [plain, cared]) {
      s.crop!.good = 10;
      s.crop!.total = 10;
    }
    let a = 0;
    let b = 0;
    const rng = new Rng(9);
    for (let i = 0; i < 200; i++) {
      a += rollQuality(plain, rng);
      b += rollQuality(cared, rng);
    }
    expect(b / 200).toBeGreaterThan(a / 200 + 1);
    expect(b / 200).toBeGreaterThan(4.5);
  });
});
