import { getCrop } from '../data/crops';
import type { CargoCrate, ShipmentLine, ShipmentRecord } from '../state/types';

export const QUALITY_MULT = [0, 1, 1.2, 1.45, 1.8, 2.5] as const;
export const SATURATION_PER_UNIT = 0.003;
export const MAX_SATURATION = 0.6;
export const SATURATION_RECOVERY = 0.85;
export const OFF_SEASON_BONUS = 1.25;
export const CRATE_CAPACITY = 30;
export const CART_CAPACITY = 4;

export function isOffSeason(cropId: string, meanTemp: number): boolean {
  const [lo, hi] = getCrop(cropId).temp;
  return meanTemp < lo - 4 || meanTemp > hi + 4;
}

/** Current price of one unit before selling it. */
export function unitPrice(cropId: string, quality: number, saturation: number, meanTemp: number): number {
  const def = getCrop(cropId);
  const season = isOffSeason(cropId, meanTemp) ? OFF_SEASON_BONUS : 1;
  return def.sellPrice * QUALITY_MULT[quality] * season * (1 - saturation);
}

/** Sells a whole ship's cargo, updating market saturation. Pure apart from `market`. */
export function settleCargo(cargo: readonly CargoCrate[], market: Record<string, number>, meanTemp: number, day: number): ShipmentRecord {
  const byKey = new Map<string, ShipmentLine>();
  for (const crate of cargo) {
    let sat = market[crate.cropId] ?? 0;
    let gold = 0;
    for (let i = 0; i < crate.qty; i++) {
      gold += unitPrice(crate.cropId, crate.q, sat, meanTemp);
      sat = Math.min(MAX_SATURATION, sat + SATURATION_PER_UNIT);
    }
    market[crate.cropId] = sat;
    const key = `${crate.cropId}:${crate.q}`;
    const line = byKey.get(key) ?? { cropId: crate.cropId, q: crate.q, qty: 0, gold: 0 };
    line.qty += crate.qty;
    line.gold += gold;
    byKey.set(key, line);
  }
  const lines = [...byKey.values()].map((l) => ({ ...l, gold: Math.round(l.gold) }));
  lines.sort((a, b) => b.gold - a.gold);
  return { day, lines, total: lines.reduce((s, l) => s + l.gold, 0) };
}

export function recoverMarket(market: Record<string, number>): void {
  for (const k of Object.keys(market)) {
    market[k] *= SATURATION_RECOVERY;
    if (market[k] < 0.005) delete market[k];
  }
}
