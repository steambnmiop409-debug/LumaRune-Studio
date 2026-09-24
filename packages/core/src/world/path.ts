/** Minimal binary-heap A* on a grid with 8-neighbourhood. */
export function astar(
  w: number,
  h: number,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  cost: (x: number, y: number) => number,
): Array<[number, number]> | null {
  const N = w * h;
  const g = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap: number[] = [];
  const f = new Float32Array(N).fill(Infinity);

  const push = (i: number) => {
    heap.push(i);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (f[heap[p]] <= f[heap[c]]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = l + 1;
        let m = c;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };

  const hdist = (x: number, y: number) => {
    const dx = Math.abs(x - tx);
    const dy = Math.abs(y - ty);
    return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
  };

  const s = sy * w + sx;
  g[s] = 0;
  f[s] = hdist(sx, sy);
  push(s);
  while (heap.length) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    if (cx === tx && cy === ty) {
      const out: Array<[number, number]> = [];
      let i = cur;
      while (i !== -1) {
        out.push([i % w, Math.floor(i / w)]);
        i = came[i];
      }
      return out.reverse();
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (closed[ni]) continue;
        const c = cost(nx, ny);
        if (!Number.isFinite(c)) continue;
        // Don't cut corners through blocked tiles.
        if (dx && dy && (!Number.isFinite(cost(cx + dx, cy)) || !Number.isFinite(cost(cx, cy + dy)))) continue;
        const ng = g[cur] + c * (dx && dy ? 1.414 : 1);
        if (ng < g[ni]) {
          g[ni] = ng;
          f[ni] = ng + hdist(nx, ny);
          came[ni] = cur;
          push(ni);
        }
      }
    }
  }
  return null;
}

/** Breadth-first reachability over walkable tiles (4-neighbourhood). */
export function reachable(w: number, h: number, sx: number, sy: number, walkable: (x: number, y: number) => boolean): Uint8Array {
  const seen = new Uint8Array(w * h);
  const q: number[] = [sy * w + sx];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    const nb = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of nb) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (seen[ni] || !walkable(nx, ny)) continue;
      seen[ni] = 1;
      q.push(ni);
    }
  }
  return seen;
}
