import { describe, expect, it } from 'vitest';
import { NPCS, NPC_SPEED, TILE, generateWorld, npcPose } from '../src';

const map = generateWorld();

describe('villagers', () => {
  it('walk smoothly through the whole day — never jumping ahead', () => {
    const step = 0.05;
    const limit = NPC_SPEED * step * TILE * 1.5 + 0.01;
    for (const npc of NPCS) {
      let prev = npcPose(npc, map, 300);
      for (let m = 300 + step; m < 1560; m += step) {
        const p = npcPose(npc, map, m);
        expect(Math.hypot(p.x - prev.x, p.y - prev.y), `${npc.id} at ${m.toFixed(2)}`).toBeLessThanOrEqual(limit);
        prev = p;
      }
    }
  });
});
