/** A polyline with a half-width at every point, in tile units. */
export interface Stroke {
  pts: Array<[number, number]>;
  /** Half-width at each point (tiles). */
  hw: number[];
}

/** Chaikin corner cutting — turns grid staircases into flowing curves. */
export function chaikin(pts: Array<[number, number]>, iterations = 2): Array<[number, number]> {
  let cur = pts;
  for (let it = 0; it < iterations; it++) {
    if (cur.length < 3) return cur;
    const next: Array<[number, number]> = [cur[0]];
    for (let i = 0; i < cur.length - 1; i++) {
      const [x0, y0] = cur[i];
      const [x1, y1] = cur[i + 1];
      next.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25]);
      next.push([x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    next.push(cur[cur.length - 1]);
    cur = next;
  }
  return cur;
}

/** Drops points closer than `minDist` to keep strokes light. */
export function simplify(pts: Array<[number, number]>, minDist = 0.6): Array<[number, number]> {
  const out: Array<[number, number]> = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [lx, ly] = out[out.length - 1];
    if (Math.hypot(pts[i][0] - lx, pts[i][1] - ly) >= minDist) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Signed distance from (x, y) to the stroke's edge (negative = inside). */
export function strokeDistance(s: Stroke, x: number, y: number): number {
  let best = Infinity;
  const p = s.pts;
  for (let i = 0; i < p.length - 1; i++) {
    const [ax, ay] = p[i];
    const [bx, by] = p[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    let t = ((x - ax) * dx + (y - ay) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t)) - (s.hw[i] + (s.hw[i + 1] - s.hw[i]) * t);
    if (d < best) best = d;
  }
  return best;
}

export function strokeBounds(s: Stroke): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const m = Math.max(...s.hw);
  for (const [x, y] of s.pts) {
    x0 = Math.min(x0, x - m);
    y0 = Math.min(y0, y - m);
    x1 = Math.max(x1, x + m);
    y1 = Math.max(y1, y + m);
  }
  return { x0, y0, x1, y1 };
}

/** Splits a stroke into short pieces so renderers can cull by bounding box. */
export function splitStroke(s: Stroke, piece = 12): Stroke[] {
  const out: Stroke[] = [];
  for (let i = 0; i < s.pts.length - 1; i += piece) {
    const end = Math.min(s.pts.length, i + piece + 1);
    out.push({ pts: s.pts.slice(i, end), hw: s.hw.slice(i, end) });
  }
  return out;
}
