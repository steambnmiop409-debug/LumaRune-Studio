import { describe, expect, it } from 'vitest';
import { CATEGORY_LABEL, CROPS, TIER_DAILY_VALUE, findItem } from '../src';

describe('crop data', () => {
  it('has exactly 200 real crops with unique ids', () => {
    expect(CROPS.length).toBe(200);
    expect(new Set(CROPS.map((c) => c.id)).size).toBe(200);
    expect(new Set(CROPS.map((c) => c.name)).size).toBe(200);
  });

  it('has sane values for every crop', () => {
    for (const c of CROPS) {
      expect(CATEGORY_LABEL[c.category], c.id).toBeTruthy();
      expect(c.growDays, c.id).toBeGreaterThanOrEqual(3);
      expect(c.growDays, c.id).toBeLessThanOrEqual(28);
      expect(c.regrowDays, c.id).toBeLessThan(c.growDays);
      expect(c.yield[0], c.id).toBeLessThanOrEqual(c.yield[1]);
      expect(c.temp[0], c.id).toBeLessThan(c.temp[1]);
      expect(c.leafColor, c.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(c.produceColor, c.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(c.sellPrice, c.id).toBeGreaterThan(0);
      expect(c.seedPrice, c.id).toBeGreaterThan(0);
      expect(findItem(`seed.${c.id}`), c.id).toBeTruthy();
      expect(findItem(`crop.${c.id}`), c.id).toBeTruthy();
    }
  });

  it('pays more per day for higher tiers', () => {
    const avgDaily = (tier: number) => {
      const cs = CROPS.filter((c) => c.tier === tier && c.regrowDays === 0);
      return cs.reduce((s, c) => s + (c.sellPrice * (c.yield[0] + c.yield[1])) / 2 / c.growDays, 0) / cs.length;
    };
    for (let t = 1; t < 5; t++) expect(avgDaily(t + 1)).toBeGreaterThan(avgDaily(t));
    expect(TIER_DAILY_VALUE[5]).toBeGreaterThan(TIER_DAILY_VALUE[1] * 4);
  });

  it('single-harvest crops always turn a profit over their seed', () => {
    for (const c of CROPS.filter((c) => c.regrowDays === 0)) {
      expect(c.sellPrice * c.yield[0], c.id).toBeGreaterThan(c.seedPrice);
    }
  });

  it('models real rain sensitivity', () => {
    const tol = (id: string) => CROPS.find((c) => c.id === id)!.rainTolerance;
    expect(tol('tomato')).toBe(0);
    expect(tol('strawberry')).toBe(0);
    expect(tol('cherry')).toBe(0);
    expect(tol('rice')).toBe(3);
    expect(tol('minari')).toBe(3);
  });
});
