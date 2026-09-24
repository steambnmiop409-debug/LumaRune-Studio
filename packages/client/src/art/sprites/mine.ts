import { MineCell, TILE, hash2, valueNoise, type MineFloor, type MineTheme } from '@lumina/core';
import { Pix, bayer } from '../Pix';
import { light, mix, pack, shade } from '../palette';

/** Colours of each depth: earthy galleries, frost caverns, ember depths. */
export const MINE_PAL: Record<MineTheme, { floor: string[]; rock: string[]; top: string; rim: string; line: string; pool: string[]; glow: string; tint: string; ambient: string }> = {
  0: {
    floor: ['#8a6c52', '#7a5e48', '#6a503e', '#5a4434', '#48362c'],
    rock: ['#c4a482', '#ad8e6e', '#94785c', '#7a624c', '#624e40', '#4a3a32'],
    top: '#281e20',
    rim: '#5a4438',
    line: '#2e2222',
    pool: ['#1e2c40', '#2a4058', '#3e5e7c', '#7aa0c0'],
    glow: '#ffc070',
    tint: '#a08466',
    ambient: '#5a5068',
  },
  1: {
    floor: ['#7a8aa2', '#6a7a94', '#5a6a84', '#4c5a74', '#3e4a62'],
    rock: ['#d8e8f6', '#b8cce4', '#98b0d0', '#7c94b8', '#62789c', '#4a5c7e'],
    top: '#161c2e',
    rim: '#3e4e6e',
    line: '#1a2034',
    pool: ['#18304a', '#224468', '#36688e', '#9ad0f0'],
    glow: '#80e0ff',
    tint: '#9ab4d4',
    ambient: '#46547a',
  },
  2: {
    floor: ['#6a4648', '#5c3a3e', '#4e3034', '#40262c', '#321c22'],
    rock: ['#ae7c6c', '#96665a', '#7e544a', '#66423c', '#50342e', '#3a2424'],
    top: '#1a0e12',
    rim: '#4a2a2a',
    line: '#1c0c10',
    pool: ['#7a1a0e', '#c8401a', '#f07a2a', '#ffd070'],
    glow: '#ff8a40',
    tint: '#8a5a50',
    ambient: '#583a42',
  },
};

const cellAt = (f: MineFloor, x: number, y: number) => (x < 0 || y < 0 || x >= f.w || y >= f.h ? MineCell.Wall : f.cells[y * f.w + x]);
const isWall = (f: MineFloor, x: number, y: number) => cellAt(f, x, y) === MineCell.Wall;

/**
 * The whole floor pre-rendered once: boulder-faced walls two tiles high where they face you,
 * dark rock tops with a lit rim, a speckled floor darkened at the foot of the walls, and still pools.
 */
export function mineFloorCanvas(f: MineFloor, seed: number): HTMLCanvasElement {
  const W = f.w * TILE;
  const H = f.h * TILE;
  const p = new Pix(W, H);
  const pal = MINE_PAL[f.theme];
  const floorC = pal.floor.map((c) => pack(c));
  const rockC = pal.rock.map((c) => pack(c));
  const top = pack(pal.top);
  const topD = pack(shade(pal.top, 1));
  const rim = pack(pal.rim);
  const line = pack(pal.line);
  const poolC = pal.pool.map((c) => pack(c));
  const s = seed + f.floor * 977;
  // Face height per column, in tiles: up to two tiles of wall show their face above floor.
  const faceTop = (tx: number, ty: number): number => {
    // Returns the tile row where this face starts, or -1 if (tx, ty) isn't part of a face.
    if (!isWall(f, tx, ty)) return -1;
    if (!isWall(f, tx, ty + 1)) return isWall(f, tx, ty - 1) ? ty - 1 : ty;
    if (!isWall(f, tx, ty + 2) && isWall(f, tx, ty + 1)) return ty;
    return -1;
  };
  for (let wy = 0; wy < H; wy++) {
    const ty = Math.floor(wy / TILE);
    for (let wx = 0; wx < W; wx++) {
      const tx = Math.floor(wx / TILE);
      const c = cellAt(f, tx, ty);
      const lx = wx - tx * TILE;
      const ly = wy - ty * TILE;
      if (c === MineCell.Wall) {
        const ft = faceTop(tx, ty);
        if (ft >= 0) {
          // Boulder face (jittered Voronoi, lit from the top left).
          let foot = ty;
          while (isWall(f, tx, foot + 1) && foot - ty < 2) foot++;
          const fy = wy - ft * TILE;
          const fh = (foot + 1 - ft) * TILE;
          if (fy < 2) {
            p.set(wx, wy, fy === 1 ? rim : top);
            continue;
          }
          if (fy === 2) {
            p.set(wx, wy, line);
            continue;
          }
          const footLine = fh - 1 - Math.floor(valueNoise(wx / 4, 1.7, s + 3) * 2);
          if (fy >= footLine) {
            p.set(wx, wy, fy === footLine ? line : rockC[5]);
            continue;
          }
          const CW = 13;
          const CH = 9;
          const gx = Math.floor(wx / CW);
          const gy = Math.floor(fy / CH);
          let d1 = Infinity;
          let d2 = Infinity;
          let rx = 0;
          let ry = 0;
          let cell = 0;
          for (let oy = -1; oy <= 1; oy++)
            for (let ox = -1; ox <= 1; ox++) {
              const cx = gx + ox;
              const cy = gy + oy;
              const px = cx * CW + 2 + hash2(cx, cy + ft * 31, s + 11) * (CW - 4);
              const py = cy * CH + 2 + hash2(cx, cy + ft * 31, s + 12) * (CH - 4);
              const dx = wx + 0.5 - px;
              const dy = (fy + 0.5 - py) * 1.3;
              const d = Math.hypot(dx, dy);
              if (d < d1) {
                d2 = d1;
                d1 = d;
                rx = dx;
                ry = dy;
                cell = cy * 7919 + cx;
              } else if (d < d2) d2 = d;
            }
          if (d2 - d1 < 1.2) {
            p.set(wx, wy, line);
            continue;
          }
          const lit = -(rx * 0.5 + ry * 0.8) / 7 + (hash2(cell, 3, s) - 0.5) * 0.5;
          // Deeper down the face gets darker (the torchlight is up top).
          const depth = fy / fh;
          let idx = lit > 0.45 ? 0 : lit > 0.1 ? 1 : lit > -0.25 ? 2 : 3;
          if (depth > 0.72) idx = Math.min(5, idx + 1);
          if (d2 - d1 < 2.2 && hash2(wx, wy, s) < 0.5) idx = Math.min(5, idx + 1);
          p.set(wx, wy, rockC[idx]);
          continue;
        }
        // Rock top seen from above: near-black, with a lit rim where it drops to a floor or face.
        const edge =
          (!isWall(f, tx - 1, ty) && lx < 2) ||
          (!isWall(f, tx + 1, ty) && lx > 13) ||
          (!isWall(f, tx, ty - 1) && ly < 2) ||
          (faceTop(tx, ty + 1) === ty + 1 && ly > 13);
        if (edge) {
          p.set(wx, wy, (lx + ly) % 3 === 0 ? line : rim);
          continue;
        }
        p.set(wx, wy, valueNoise(wx / 5, wy / 5, s + 20) + (hash2(wx, wy, s + 21) - 0.5) * 0.2 > 0.55 ? topD : top);
        continue;
      }
      if (c === MineCell.Water || c === MineCell.Lava) {
        const shoreTop = cellAt(f, tx, ty - 1) !== c && ly < 3;
        const n = valueNoise(wx / 6, wy / 4, s + 40);
        if (c === MineCell.Water) {
          if (shoreTop) p.set(wx, wy, ly === 0 ? line : poolC[0]);
          else p.set(wx, wy, n > 0.68 && (wx + wy) % 5 === 0 ? poolC[3] : n > 0.5 ? poolC[2] : n + bayer(wx, wy) * 0.2 > 0.42 ? poolC[1] : poolC[0]);
        } else {
          // Lava: bright molten veins between drifting crust.
          const crack = Math.abs(valueNoise(wx / 5, wy / 5, s + 41) - 0.5) < 0.06;
          if (shoreTop) p.set(wx, wy, ly === 0 ? line : poolC[0]);
          else p.set(wx, wy, crack ? poolC[3] : n > 0.6 ? poolC[0] : n + bayer(wx, wy) * 0.25 > 0.4 ? poolC[1] : poolC[2]);
        }
        continue;
      }
      // Floor.
      const n = valueNoise(wx / 9, wy / 9, s + 30) * 0.7 + valueNoise(wx / 3, wy / 3, s + 31) * 0.3;
      let idx = n > 0.62 ? 0 : n > 0.44 ? 1 : n > 0.3 ? 2 : 3;
      if (hash2(wx, wy, s + 32) < 0.05) idx = Math.min(4, idx + 1);
      // Ambient occlusion: the foot of a wall face and the sides of walls.
      const aboveWall = isWall(f, tx, ty - 1);
      if (aboveWall && ly < 4 && bayer(wx, wy) < (4 - ly) / 4) idx = Math.min(4, idx + (ly < 2 ? 2 : 1));
      if ((isWall(f, tx - 1, ty) && lx < 2) || (isWall(f, tx + 1, ty) && lx > 13)) idx = Math.min(4, idx + 1);
      p.set(wx, wy, floorC[idx]);
    }
  }
  // Pebbles, cracks and rubble on the floor.
  for (let ty = 0; ty < f.h; ty++)
    for (let tx = 0; tx < f.w; tx++) {
      if (cellAt(f, tx, ty) !== MineCell.Floor) continue;
      const r = hash2(tx, ty, s + 50);
      const ox = tx * TILE;
      const oy = ty * TILE;
      if (r < 0.22) {
        const px = ox + 2 + Math.floor(hash2(tx, ty, s + 51) * 11);
        const py = oy + 4 + Math.floor(hash2(tx, ty, s + 52) * 9);
        p.set(px, py, rockC[1]);
        p.set(px + 1, py, rockC[2]);
        p.set(px, py + 1, rockC[4]);
        p.set(px + 1, py + 1, rockC[5]);
      } else if (r < 0.3) {
        let x = ox + 3 + Math.floor(hash2(tx, ty, s + 53) * 8);
        let y = oy + 5 + Math.floor(hash2(tx, ty, s + 54) * 6);
        for (let i = 0; i < 6; i++) {
          p.set(x, y, pack(pal.floor[4]));
          x += hash2(x, y, s + 55) < 0.6 ? 1 : 0;
          y += hash2(x, y, s + 56) < 0.5 ? 1 : -1;
        }
      }
    }
  return p.toCanvas();
}

/** Wall torch in an iron bracket; `frame` flickers the flame. */
export function torch(frame: number): HTMLCanvasElement {
  const p = new Pix(10, 18);
  p.rect(4, 8, 2, 8, '#5a3a26');
  p.set(4, 8, '#8a5a36');
  p.rect(3, 15, 4, 1, '#3a3a44');
  p.rect(2, 10, 6, 1, '#4a4a56');
  p.set(2, 9, '#4a4a56');
  p.set(7, 9, '#4a4a56');
  const flame = [
    ['..y..', '.yoy.', 'yoOoy', 'yOwOy', '.yOy.'],
    ['.y...', '.yoy.', 'yoOoy', 'yOwOy', '.yOy.'],
    ['...y.', '.yoy.', 'yooOy', 'yOwOy', '.yOy.'],
  ][frame % 3];
  p.template(flame, { y: '#f08a2a', o: '#ffb040', O: '#ffd070', w: '#fff8d8' }, 2, 3);
  return p.toCanvas();
}

/** A timber support frame on a wall face, two tiles wide. */
export function beam(v: number): HTMLCanvasElement {
  const p = new Pix(32, 30);
  const wood = mix('#9a6a44', '#7a5236', hash2(v, 1, 5) * 0.5);
  for (const x of [2, 26]) {
    p.rect(x, 4, 4, 26, wood);
    p.rect(x, 4, 1, 26, light(wood, 1));
    p.rect(x + 3, 4, 1, 26, shade(wood, 1));
  }
  p.rect(0, 2, 32, 4, wood);
  p.rect(0, 2, 32, 1, light(wood, 1));
  p.rect(0, 5, 32, 1, shade(wood, 2));
  for (const x of [4, 28]) p.set(x, 3, '#3a3a44');
  p.outline('#2a1e1a');
  return p.toCanvas();
}

/** A crystal cluster growing from the rock (frost: ice-blue, ember: rose-orange). */
export function crystal(theme: MineTheme, v: number): HTMLCanvasElement {
  const p = new Pix(16, 18);
  const base = theme === 2 ? (v % 3 === 0 ? '#ff7a9a' : '#ff9a4a') : v % 4 === 0 ? '#b08af0' : '#7ad8f8';
  const shards = 3 + (v % 2);
  for (let i = 0; i < shards; i++) {
    const cx = 3 + Math.floor(hash2(v, i, 11) * 10);
    const hgt = 6 + Math.floor(hash2(v, i, 12) * 9);
    const lean = hash2(v, i, 13) < 0.5 ? -1 : 1;
    for (let y = 0; y < hgt; y++) {
      const wdt = y < 2 ? 1 : 2;
      const x = cx + Math.round((lean * y) / 5);
      for (let k = 0; k < wdt; k++) p.set(x + k, 17 - y, k === 0 ? light(base, y > hgt - 3 ? 2 : 1) : shade(base, 1));
    }
    p.set(cx + Math.round((lean * (hgt - 1)) / 5), 17 - hgt + 1, '#ffffff');
  }
  p.outline(shade(base, 4));
  return p.toCanvas();
}

export function stalagmite(theme: MineTheme, v: number): HTMLCanvasElement {
  const p = new Pix(14, 22);
  const rock = MINE_PAL[theme].rock;
  const hgt = 12 + Math.floor(hash2(v, 1, 21) * 8);
  for (let y = 0; y < hgt; y++) {
    const half = Math.max(0.6, (y / hgt) * 5.5);
    for (let x = 0; x < 14; x++) {
      const d = x + 0.5 - 7;
      if (Math.abs(d) > half) continue;
      const lit = -d / half + ((y + x) % 4 === 0 ? -0.3 : 0);
      p.set(x, 21 - hgt + y, rock[lit > 0.4 ? 1 : lit > -0.2 ? 2 : lit > -0.6 ? 3 : 4]);
    }
  }
  p.outline(MINE_PAL[theme].line);
  return p.toCanvas();
}

/** Glowing cave mushrooms. */
export function caveMushroom(theme: MineTheme, v: number): HTMLCanvasElement {
  const p = new Pix(14, 12);
  const cap = theme === 1 ? '#8ae0f0' : v % 2 ? '#7af0c0' : '#c0a0f8';
  for (let i = 0; i < 3; i++) {
    const x = 2 + i * 4 + Math.floor(hash2(v, i, 31) * 2);
    const h = 3 + Math.floor(hash2(v, i, 32) * 4);
    p.rect(x + 1, 11 - h, 1, h, '#e8e0d0');
    p.rect(x, 10 - h, 3, 2, cap);
    p.set(x, 10 - h, light(cap, 2));
    p.set(x + 2, 11 - h, shade(cap, 1));
  }
  p.outline(shade(cap, 4));
  return p.toCanvas();
}

export function bones(v: number): HTMLCanvasElement {
  const p = new Pix(16, 10);
  const b = '#e8dcc4';
  p.line(2, 7, 11, 4, b);
  p.set(1, 7, b);
  p.set(2, 8, b);
  p.set(12, 3, b);
  p.set(11, 3, b);
  p.ellipse(10 + (v % 3), 7, 2, 1.5, '#d8ccb4');
  p.set(10 + (v % 3), 7, '#3a2a2a');
  p.outline('#3a2424');
  return p.toCanvas();
}

export function icicles(v: number): HTMLCanvasElement {
  const p = new Pix(16, 12);
  for (let i = 0; i < 4; i++) {
    const x = 1 + i * 4 + Math.floor(hash2(v, i, 41) * 2);
    const h = 3 + Math.floor(hash2(v, i, 42) * 8);
    for (let y = 0; y < h; y++) p.set(x, y, y < h - 2 ? '#c8e8f8' : '#ffffff');
    p.set(x + 1, 0, '#8ab0d0');
  }
  return p.toCanvas();
}

/** A glowing crack in the floor of the ember depths. */
export function vent(frame: number, v: number): HTMLCanvasElement {
  const p = new Pix(16, 10);
  const hot = frame ? '#ffd070' : '#ff9a40';
  let x = 2;
  let y = 5;
  for (let i = 0; i < 12; i++) {
    p.set(x, y, i % 3 === 0 ? hot : '#e0501a');
    p.set(x, y + 1, '#401010');
    x++;
    y += hash2(v, i, 51) < 0.5 ? 0 : hash2(v, i, 52) < 0.5 ? -1 : 1;
    y = Math.max(2, Math.min(7, y));
  }
  return p.toCanvas();
}

/** The ladder back up: a wooden ladder leaning into a shaft of daylight in the wall face. */
export function ladderUp(theme: MineTheme): HTMLCanvasElement {
  const p = new Pix(20, 40);
  const pal = MINE_PAL[theme];
  // The shaft opening in the wall.
  p.ellipse(10, 9, 8, 8, '#0e0a10');
  p.ellipse(10, 8, 6, 6, '#1a1620');
  const wood = '#a8744a';
  for (const x of [4, 14]) {
    p.rect(x, 2, 2, 38, wood);
    p.rect(x, 2, 1, 38, '#c8945e');
  }
  for (let y = 5; y < 38; y += 5) {
    p.rect(5, y, 10, 1, '#8a5a36');
    p.rect(5, y + 1, 10, 1, '#5a3a26');
  }
  p.outline(pal.line);
  return p.toCanvas();
}

/** The hole down to the next floor, with a ladder's top poking out. */
export function ladderDown(theme: MineTheme): HTMLCanvasElement {
  const p = new Pix(18, 18);
  const pal = MINE_PAL[theme];
  p.ellipse(9, 10, 8, 6, pal.line);
  p.ellipse(9, 10, 7, 5, '#08060a');
  p.ellipse(9, 11, 5, 3, '#000000');
  p.rect(2, 6, 14, 1, pal.rock[1]);
  const wood = '#a8744a';
  for (const x of [5, 12]) {
    p.rect(x, 2, 2, 10, wood);
    p.set(x, 2, '#c8945e');
  }
  p.rect(5, 5, 9, 1, '#8a5a36');
  p.rect(5, 9, 9, 1, '#6a4a30');
  p.outline('#1a1016');
  return p.toCanvas();
}
