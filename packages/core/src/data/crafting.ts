/** Workbench recipes: materials in, one item (or a small stack) out. */
export interface Recipe {
  id: string;
  out: string;
  qty: number;
  needs: Array<[itemId: string, qty: number]>;
  /** Short line shown under the recipe. */
  note: string;
}

export const RECIPES: readonly Recipe[] = [
  { id: 'chest', out: 'place.chest', qty: 1, needs: [['mat.wood', 30]], note: '18칸 보관' },
  { id: 'compost', out: 'place.compost', qty: 1, needs: [['mat.wood', 20], ['mat.fiber', 15]], note: '섬유·작물 → 비료' },
  { id: 'furnace', out: 'place.furnace', qty: 1, needs: [['mat.stone', 25], ['ore.copper', 10]], note: '광석 → 주괴' },
  { id: 'jar', out: 'place.jar', qty: 1, needs: [['mat.wood', 25], ['mat.stone', 15], ['mat.coal', 2]], note: '잼·절임·허브차' },
  { id: 'beehouse', out: 'place.beehouse', qty: 1, needs: [['mat.wood', 35], ['mat.fiber', 10], ['bar.copper', 1]], note: '3일마다 꿀' },
  { id: 'seedmaker', out: 'place.seedmaker', qty: 1, needs: [['mat.wood', 25], ['mat.coal', 5], ['bar.copper', 2]], note: '작물 → 씨앗' },
  { id: 'keg', out: 'place.keg', qty: 1, needs: [['mat.wood', 30], ['bar.copper', 1], ['bar.iron', 1]], note: '과일주·주스' },
  { id: 'harvester', out: 'place.harvester', qty: 1, needs: [['bar.iron', 4], ['bar.copper', 4], ['mat.wood', 20], ['gem.quartz', 1]], note: '매일 아침 5×5 자동 수확' },
  { id: 'sprinkler1', out: 'place.sprinkler1', qty: 1, needs: [['bar.copper', 1], ['bar.iron', 1]], note: '상하좌우 4칸 물주기' },
  { id: 'sprinkler2', out: 'place.sprinkler2', qty: 1, needs: [['bar.copper', 2], ['bar.iron', 2], ['gem.quartz', 1]], note: '주변 8칸 물주기' },
  { id: 'cover', out: 'place.cover', qty: 1, needs: [['mat.wood', 20], ['mat.fiber', 20]], note: '3×3 비 가림' },
  { id: 'fert', out: 'fert.basic', qty: 5, needs: [['mat.fiber', 8], ['mat.stone', 2]], note: '기본 비료 5개' },
  { id: 'retain', out: 'fert.retain', qty: 5, needs: [['mat.stone', 5], ['mat.fiber', 5]], note: '보습토 5개' },
  { id: 'crate', out: 'crate', qty: 5, needs: [['mat.wood', 10]], note: '출하 상자 5개' },
];

export const RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));
