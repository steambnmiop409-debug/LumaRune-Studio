import { CROPS, type CropDef } from './crops';
import { seasonMeanTemp } from '../weather/climate';
import type { Season } from '../time/calendar';

export type ShopId = 'seedShop' | 'toolShop';

export interface ShopDef {
  id: ShopId;
  name: string;
  keeper: string;
  open: number;
  close: number;
  /** Weekday (0 = Monday) the shop is closed. */
  closedWeekday: number;
}

export const SHOPS: Record<ShopId, ShopDef> = {
  seedShop: { id: 'seedShop', name: '들꽃 씨앗방', keeper: '하나', open: 9 * 60, close: 18 * 60, closedWeekday: 2 },
  toolShop: { id: 'toolShop', name: '등불 공방', keeper: '도윤', open: 9 * 60, close: 18 * 60, closedWeekday: 6 },
};

export const TOOL_SHOP_STOCK = [
  'crate',
  'fert.basic',
  'fert.quality',
  'fert.speed',
  'fert.speed2',
  'fert.retain',
  'tonic',
  'place.sprinkler1',
  'place.sprinkler2',
  'place.sprinkler3',
  'place.cover',
  'tool.pick',
  'tool.can.2',
  'tool.can.3',
  'upgrade.cart',
] as const;

/** Lifetime shipping earnings needed before the seed shop stocks each tier. */
export const TIER_UNLOCK_EARNINGS = [0, 0, 0, 2000, 10000, 30000] as const;

/** How well a crop's temperature band fits a season: 0 = perfect, larger = worse. */
export function seasonFit(crop: CropDef, season: Season): number {
  const t = seasonMeanTemp(season);
  const [lo, hi] = crop.temp;
  if (t < lo) return lo - t;
  if (t > hi) return t - hi;
  return 0;
}

/**
 * Seeds stocked this season: everything that grows now or next season, gated by tier progress.
 * Sorted so crops that fit right now come first, cheapest first.
 */
export function seedShopStock(season: Season, lifetimeEarnings: number): string[] {
  const next = ((season + 1) % 4) as Season;
  return CROPS.filter((c) => TIER_UNLOCK_EARNINGS[c.tier] <= lifetimeEarnings)
    .filter((c) => seasonFit(c, season) <= 3 || seasonFit(c, next) <= 1)
    .sort((a, b) => {
      const fa = seasonFit(a, season) <= 3 ? 0 : 1;
      const fb = seasonFit(b, season) <= 3 ? 0 : 1;
      return fa - fb || a.tier - b.tier || a.seedPrice - b.seedPrice;
    })
    .map((c) => `seed.${c.id}`);
}
