import { hash2 } from '@lumina/core';

/**
 * Leaf-clump shading: splits a canopy into rounded clusters (jittered Voronoi),
 * each lit from the top-left. Returns a tone offset in -2..2.
 */
export function clump(x: number, y: number, cell: number, seed: number): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  let d1 = Infinity;
  let d2 = Infinity;
  let rx = 0;
  let ry = 0;
  for (let oy = -1; oy <= 1; oy++)
    for (let ox = -1; ox <= 1; ox++) {
      const cx = gx + ox;
      const cy = gy + oy;
      const fx = (cx + 0.2 + hash2(cx, cy, seed) * 0.6) * cell;
      const fy = (cy + 0.2 + hash2(cx, cy, seed + 1) * 0.6) * cell;
      const d = Math.hypot(x + 0.5 - fx, y + 0.5 - fy);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        rx = (x + 0.5 - fx) / cell;
        ry = (y + 0.5 - fy) / cell;
      } else if (d < d2) d2 = d;
    }
  // Crease between clumps.
  if (d2 - d1 < 0.9) return 2;
  const lit = -(rx * 0.6 + ry * 0.9);
  if (lit > 0.32) return -2;
  if (lit > 0.1) return -1;
  if (lit < -0.3) return 1;
  return 0;
}
