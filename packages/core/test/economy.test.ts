import { describe, expect, it } from 'vitest';
import { QUALITY_MULT, getCrop, recoverMarket, settleCargo, unitPrice } from '../src';

describe('market', () => {
  it('pays more for higher quality', () => {
    const p1 = unitPrice('tomato', 1, 0, 24);
    const p5 = unitPrice('tomato', 5, 0, 24);
    expect(p5 / p1).toBeCloseTo(QUALITY_MULT[5], 5);
  });

  it('pays an off-season premium', () => {
    expect(unitPrice('tomato', 1, 0, 5)).toBeGreaterThan(unitPrice('tomato', 1, 0, 24));
  });

  it('drops prices when flooding the market and recovers over days', () => {
    const market: Record<string, number> = {};
    const first = settleCargo([{ cropId: 'radish', q: 1, qty: 30 }], market, 12, 0);
    const second = settleCargo([{ cropId: 'radish', q: 1, qty: 30 }], market, 12, 0);
    expect(second.total).toBeLessThan(first.total);
    const sat = market.radish;
    recoverMarket(market);
    expect(market.radish).toBeLessThan(sat);
    expect(first.total).toBeLessThanOrEqual(getCrop('radish').sellPrice * 30);
  });
});
