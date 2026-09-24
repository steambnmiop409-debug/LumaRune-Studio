import { hash2 } from '@lumina/core';
import { Pix } from '../Pix';
import { light, mix, pack, shade } from '../palette';
import { canopy, trunk, type SeasonLook, type TreeSprite } from './nature';

/** Landmark props. Each takes the object's own seed `v`, so no two on the island match. */
const r = (v: number, k: number) => hash2(v, k, 5151);

const FRUITS = [
  { skin: '#d8403a', hi: '#ff9a80' }, // apple
  { skin: '#f0a050', hi: '#ffd8a0' }, // peach
  { skin: '#c8d050', hi: '#f0f4a0' }, // pear
  { skin: '#8a3a78', hi: '#c880b8' }, // plum
];

/** Orchard tree: blossom in spring, heavy with fruit in summer and autumn, bare in winter. */
export function fruitTree(v: number, season: SeasonLook): TreeSprite {
  const p = new Pix(32, 42);
  const fruit = FRUITS[v % FRUITS.length];
  // Every tree has its own build: trunk height, lean, crown size and shape.
  const lean = Math.round((r(v, 5) - 0.5) * 4);
  const trunkTop = 22 + Math.floor(r(v, 6) * 5);
  const crownY = trunkTop - 9 + Math.floor(r(v, 7) * 3);
  const crownW = 9.5 + r(v, 4) * 3.5;
  const crownH = 7.5 + r(v, 8) * 3;
  const cx = 16 + lean;
  trunk(p, 16, trunkTop, 41, 3 + (v % 2), mix('#7a5236', '#8e6444', r(v, 1)));
  p.line(16, trunkTop + 2, cx - 4, trunkTop - 2, '#6e4a34');
  p.line(16, trunkTop + 2, cx + 4, trunkTop - 3, '#6e4a34');
  if (season === 3) {
    const br = '#6e4a34';
    p.line(cx - 4, trunkTop - 2, cx - 9, crownY - 4, br);
    p.line(cx + 4, trunkTop - 3, cx + 9, crownY - 5, br);
    p.line(16, trunkTop, cx, crownY - 8, br);
    p.line(cx - 7, crownY - 1, cx - 11, crownY - 3, br);
    p.line(cx + 7, crownY - 2, cx + 11, crownY - 1, br);
    p.line(cx, crownY - 3, cx - 4, crownY - 7, br);
    p.line(cx, crownY - 4, cx + 4, crownY - 8, br);
    p.outline(shade(br, 3));
    return { img: p.toCanvas(), swayRows: trunkTop, ax: 16, ay: 41 };
  }
  const leaf = season === 2 ? mix('#8aa84a', '#d8a040', 0.5 + r(v, 2) * 0.3) : mix('#4e9a4a', '#7ab44c', r(v, 3));
  const blobs: Array<[number, number, number, number]> = [[cx, crownY, crownW, crownH]];
  const extra = 2 + Math.floor(r(v, 9) * 4);
  for (let i = 0; i < extra; i++) {
    const a = r(v, 10 + i) * Math.PI * 2;
    blobs.push([cx + Math.cos(a) * crownW * 0.6, crownY + Math.sin(a) * crownH * 0.5 - 1, 3.5 + r(v, 20 + i) * 3, 3.5 + r(v, 30 + i) * 2]);
  }
  canopy(p, blobs, season === 0 ? light(leaf, 1) : leaf, v * 7 + 3, 4);
  p.outline();
  const inside = (x: number, y: number) => blobs.some(([cx, cy, rx, ry]) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 0.8);
  if (season === 0) {
    // Blossom clusters.
    for (let i = 0; i < 22; i++) {
      const x = Math.floor(cx - crownW + r(v, 40 + i) * crownW * 2);
      const y = Math.floor(crownY - crownH + r(v, 70 + i) * crownH * 2);
      if (!inside(x, y)) continue;
      p.set(x, y, '#fff4f6');
      if (r(v, 100 + i) < 0.6) p.set(x + 1, y, '#f8c8d8');
      if (r(v, 130 + i) < 0.4) p.set(x, y + 1, '#f0b0c4');
    }
  } else {
    // Fruit: 2×2 with a highlight and a dark underside; more of it in autumn.
    const n = season === 2 ? 12 : 8;
    for (let i = 0; i < n; i++) {
      const x = Math.floor(cx - crownW + 1 + r(v, 40 + i) * (crownW * 2 - 2));
      const y = Math.floor(crownY - crownH + 2 + r(v, 70 + i) * (crownH * 2 - 2));
      if (!inside(x, y) || !inside(x + 1, y + 1)) continue;
      p.set(x, y, fruit.hi);
      p.set(x + 1, y, fruit.skin);
      p.set(x, y + 1, fruit.skin);
      p.set(x + 1, y + 1, shade(fruit.skin, 1));
      p.set(x + 1, y - 1, '#4a6a2a');
    }
  }
  return { img: p.toCanvas(), swayRows: trunkTop, ax: 16, ay: 41 };
}

/** Canvas A-frame tent with an open flap, guy lines and pegs. */
export function tent(v: number): HTMLCanvasElement {
  const p = new Pix(44, 32);
  const cloth = ['#e07a3a', '#3a9a8a', '#c84a4a', '#6a7ac8'][v % 4];
  const hi = light(cloth, 1);
  const lo = shade(cloth, 1);
  const lo2 = shade(cloth, 2);
  // Body: triangle from ridge (22,3) to base (6..38, 29).
  for (let y = 4; y <= 29; y++) {
    const t = (y - 4) / 25;
    const half = Math.round(2 + t * 15);
    for (let x = 22 - half; x <= 22 + half; x++) {
      const left = x < 22;
      let c = left ? hi : lo;
      if (Math.abs(x - 22) <= 0) c = light(cloth, 2);
      if (y % 6 === 0) c = left ? cloth : lo2; // seams
      p.set(x, y, c);
    }
  }
  // Open flap: dark doorway with a folded-back corner.
  for (let y = 14; y <= 29; y++) {
    const half = Math.round((y - 14) * 0.42);
    for (let x = 22 - half; x <= 22 + half; x++) p.set(x, y, y > 26 ? '#2a1e24' : '#3a2a30');
  }
  for (let y = 16; y <= 27; y++) p.set(22 + Math.round((y - 14) * 0.42) + 1, y, hi);
  p.line(23, 16, 27, 27, lo2);
  // Sleeping-bag glimpse.
  p.rect(20, 26, 5, 2, '#8a6ab0');
  // Ridge pole and guy lines with pegs.
  p.line(22, 1, 22, 4, '#6a4a2a');
  p.line(22, 2, 2, 28, '#d8d0c0');
  p.line(22, 2, 42, 28, '#d8d0c0');
  p.set(2, 29, '#5a4030');
  p.set(42, 29, '#5a4030');
  p.rect(6, 30, 33, 1, pack('#1a1a30', 60));
  p.outline(shade(cloth, 3));
  return p.toCanvas();
}

/** Ring of stones and crossed logs; `frame` animates the flame (-1 = cold ashes). */
export function campfire(v: number, frame: number): HTMLCanvasElement {
  const p = new Pix(18, 22);
  // Logs.
  p.line(3, 19, 14, 15, '#6e4a34');
  p.line(3, 18, 14, 14, '#8a5a3a');
  p.line(14, 19, 3, 15, '#7a5236');
  p.line(14, 18, 3, 14, '#9a6a44');
  p.set(3, 14, '#d8b07a');
  p.set(14, 14, '#d8b07a');
  // Stones.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const x = 9 + Math.cos(a) * 7.5;
    const y = 17 + Math.sin(a) * 3.2;
    const c = ['#a8a098', '#8f8a86', '#bcb4a8'][Math.floor(r(v, i) * 3)];
    p.ellipse(x, y, 1.6, 1.2, (nx, ny) => (ny < -0.2 ? light(c, 1) : ny > 0.4 ? shade(c, 1) : c));
  }
  if (frame < 0) {
    p.rect(7, 16, 4, 2, '#5a5058');
    p.set(8, 15, '#7a7078');
  } else {
    const sway = [0, 1, -1][frame % 3];
    const shape: Array<[number, number, string]> = [];
    for (let y = 0; y < 11; y++) {
      const w = Math.max(0, Math.round(3.4 * Math.sin(((y + 1) / 12) * Math.PI) * (1 - y / 14)));
      const cx = 9 + Math.round(sway * (y / 10));
      for (let x = cx - w; x <= cx + w; x++) {
        const edge = Math.abs(x - cx) >= w - 0 && w > 0;
        shape.push([x, 16 - y, y < 3 ? (edge ? '#f07a2a' : '#fff0a0') : edge ? '#d8502a' : y < 7 ? '#ffc040' : '#f08a30']);
      }
    }
    for (const [x, y, c] of shape) p.set(x, y, c);
    // Sparks.
    p.set(9 + sway * 2 + (frame === 1 ? 2 : -2), 3 + frame, '#ffe070');
  }
  return p.toCanvas();
}

/** Split-log bench. */
export function logSeat(v: number): HTMLCanvasElement {
  const p = new Pix(30, 14);
  const bark = mix('#6e4a34', '#8a5a3a', r(v, 1));
  const len = 24 + Math.floor(r(v, 2) * 4);
  const x0 = Math.floor((30 - len) / 2);
  for (let x = x0; x < x0 + len; x++) {
    // Flat sawn top.
    p.set(x, 5, '#e0c090');
    p.set(x, 6, (x + v) % 9 === 0 ? '#b08a5a' : '#d0aa78');
    for (let y = 7; y < 11; y++) p.set(x, y, y === 10 ? shade(bark, 1) : (x * 3 + y + v) % 7 === 0 ? shade(bark, 1) : bark);
  }
  p.rect(x0 + 3, 11, 2, 2, shade(bark, 1));
  p.rect(x0 + len - 5, 11, 2, 2, shade(bark, 1));
  p.outline(shade(bark, 3));
  return p.toCanvas();
}

/** Stacked firewood with visible end-grain rings. */
export function woodpile(v: number): HTMLCanvasElement {
  const p = new Pix(26, 20);
  const rows = [5, 4, 3];
  for (let row = 0; row < rows.length; row++)
    for (let i = 0; i < rows[row]; i++) {
      const cx = 13 - (rows[row] - 1) * 2.5 + i * 5 + (r(v, row * 7 + i) - 0.5);
      const cy = 16 - row * 4.2;
      const tone = r(v, row * 9 + i + 40);
      p.ellipse(cx, cy, 2.6, 2.3, (nx, ny) => {
        const d = Math.hypot(nx, ny);
        if (d > 0.78) return tone < 0.5 ? '#6e4a34' : '#7a5236';
        return d > 0.45 ? '#d8b07a' : d > 0.2 ? '#c89a62' : '#b08452';
      });
    }
  p.outline('#3a2a20');
  return p.toCanvas();
}

/** A broken marble column: its own height, cracks, ivy and moss. */
export function ruinPillar(v: number): HTMLCanvasElement {
  const p = new Pix(18, 44);
  const h = 14 + Math.floor(r(v, 1) * 22);
  const stone = mix('#d8d2c4', '#bcb6aa', r(v, 2));
  const top = 42 - h;
  // Base plinth.
  p.rect(2, 39, 14, 4, shade(stone, 1));
  p.rect(2, 39, 14, 1, light(stone, 1));
  // Fluted shaft.
  for (let y = top; y < 39; y++)
    for (let x = 4; x < 14; x++) {
      let c = x < 6 ? light(stone, 1) : x > 11 ? shade(stone, 1) : stone;
      if ((x - 4) % 3 === 2) c = shade(stone, 1);
      p.set(x, y, c);
    }
  // Jagged broken top: bite out the rim and light the new edge.
  for (let x = 4; x < 14; x++) {
    const bite = Math.floor(r(v, 10 + x) * 4);
    for (let y = top; y < top + bite; y++) p.data[y * p.w + x] = 0;
    p.set(x, top + bite, light(stone, 2));
  }
  // Crack.
  let cx = 6 + Math.floor(r(v, 3) * 5);
  for (let y = top + 4; y < top + 4 + Math.min(h - 6, 10); y++) {
    p.set(cx, y, shade(stone, 3));
    if (r(v, 50 + y) < 0.35) cx += r(v, 80 + y) < 0.5 ? -1 : 1;
  }
  // Ivy climbing from the base.
  const ivy = 4 + Math.floor(r(v, 4) * Math.min(18, h - 4));
  for (let k = 0; k < ivy; k++) {
    const x = 4 + Math.round(3 + Math.sin(k * 0.7 + v) * 3);
    const y = 38 - k;
    p.set(x, y, k % 3 === 0 ? '#5a9a48' : '#4a8040');
    if (k % 4 === 1) p.set(x + 1, y, '#7ab85a');
  }
  // Fallen chunk at the foot.
  if (r(v, 5) < 0.6) p.ellipse(15, 41, 2.2, 1.6, (nx, ny) => (ny < 0 ? light(stone, 1) : shade(stone, 1)));
  p.outline(shade(stone, 4));
  return p.toCanvas();
}

/** A small stone shrine with a tiled roof and a lantern niche (`lit` glows at night). */
export function shrine(v: number, lit: boolean): HTMLCanvasElement {
  const p = new Pix(30, 38);
  const stone = '#b8b2a6';
  // Steps.
  p.rect(2, 33, 26, 4, shade(stone, 1));
  p.rect(2, 33, 26, 1, light(stone, 1));
  p.rect(5, 30, 20, 3, stone);
  p.rect(5, 30, 20, 1, light(stone, 1));
  // Body.
  for (let y = 13; y < 30; y++)
    for (let x = 7; x < 23; x++) p.set(x, y, x < 9 ? light(stone, 1) : x > 20 ? shade(stone, 1) : (x + y * 3 + v) % 11 === 0 ? shade(stone, 1) : stone);
  // Niche with a lantern.
  p.rect(12, 17, 6, 9, '#3a3440');
  p.rect(13, 20, 4, 5, lit ? '#ffd870' : '#8a7a5a');
  p.rect(14, 21, 2, 3, lit ? '#fff4c0' : '#a89a78');
  p.rect(13, 19, 4, 1, '#5a4a3a');
  // Offerings.
  p.set(9, 29, '#e05a4a');
  p.set(10, 29, '#f0a040');
  p.set(20, 29, '#f7c6d6');
  // Roof: curved eaves.
  const roof = ['#5a6a8a', '#4a5a7a', '#3a4a6a'][v % 3];
  for (let y = 4; y < 13; y++) {
    const t = (y - 4) / 8;
    const half = Math.round(5 + t * 9 + (y > 10 ? 1 : 0));
    for (let x = 15 - half; x < 15 + half; x++) p.set(x, y, y >= 11 ? shade(roof, 1) : (x + y) % 3 === 0 ? light(roof, 1) : roof);
  }
  p.rect(12, 2, 6, 2, shade(roof, 1));
  p.set(15, 1, '#e8c060');
  // Moss on the steps.
  for (let i = 0; i < 6; i++) p.set(3 + Math.floor(r(v, i) * 24), 33 + Math.floor(r(v, i + 9) * 2), '#6a9a4a');
  p.outline(shade(stone, 4));
  return p.toCanvas();
}

/** Rocky tide pool with water, a starfish and anemones. */
export function tidepool(v: number, frame: number): HTMLCanvasElement {
  const p = new Pix(34, 20);
  const cx = 17;
  const cy = 10;
  for (let y = 0; y < 20; y++)
    for (let x = 0; x < 34; x++) {
      const d = Math.hypot((x + 0.5 - cx) / 15, (y + 0.5 - cy) / 8.2) + (r(v, x * 31 + y) - 0.5) * 0.08;
      if (d > 1) continue;
      if (d > 0.72) {
        // Rim rocks.
        const c = ['#8f8a86', '#a8a098', '#7a746e'][Math.floor(r(v, x + y * 7 + 100) * 3)];
        p.set(x, y, y < cy - 3 ? light(c, 1) : y > cy + 3 ? shade(c, 1) : c);
      } else {
        const deep = d < 0.4;
        let c = deep ? '#3a8aa0' : '#5ab0b8';
        if ((x + y * 2 + frame * 3) % 11 === 0 && !deep) c = '#a8e0e0';
        p.set(x, y, c);
      }
    }
  // Starfish.
  const sx = 11 + Math.floor(r(v, 1) * 10);
  const sy = 9 + Math.floor(r(v, 2) * 3);
  const star = ['#f07a4a', '#e85a8a', '#f0c040'][v % 3];
  p.set(sx, sy, star);
  p.set(sx - 1, sy, star);
  p.set(sx + 1, sy, star);
  p.set(sx, sy - 1, star);
  p.set(sx - 1, sy + 1, star);
  p.set(sx + 1, sy + 1, star);
  // Anemones.
  for (let i = 0; i < 3; i++) {
    const ax = 8 + Math.floor(r(v, 10 + i) * 18);
    const ay = 6 + Math.floor(r(v, 20 + i) * 8);
    p.set(ax, ay, '#f0a0c0');
    p.set(ax, ay - 1, frame ? '#ffd0e0' : '#e888b0');
  }
  p.outline('#4a4640');
  return p.toCanvas();
}

/** The hilltop gazebo: white posts, lattice rail, and a hipped roof with a weather vane. */
export function gazebo(v: number): HTMLCanvasElement {
  const p = new Pix(58, 60);
  const wood = '#f4efe6';
  const woodS = '#d0c8bc';
  const roof = ['#3f8a86', '#b85a4a', '#5a6aa8'][v % 3];
  // Deck.
  p.rect(4, 48, 50, 8, '#c89a6a');
  for (let x = 4; x < 54; x += 5) p.rect(x, 48, 1, 8, '#a87a4a');
  p.rect(4, 48, 50, 1, '#e0b884');
  p.rect(4, 55, 50, 1, '#8a5e3a');
  // Posts.
  for (const x of [7, 20, 37, 50]) {
    p.rect(x, 24, 3, 25, wood);
    p.rect(x + 2, 24, 1, 25, woodS);
  }
  // Lattice rail between posts.
  for (let x = 10; x < 50; x++) {
    if (x > 20 && x < 37) continue; // open front
    p.set(x, 40, wood);
    p.set(x, 47, woodS);
    for (let y = 41; y < 47; y++) if ((x + y) % 4 === 0 || (x - y + 100) % 4 === 0) p.set(x, y, woodS);
  }
  // Hanging flower baskets.
  for (const x of [13, 44]) {
    p.line(x, 24, x, 27, '#8a6a4a');
    p.ellipse(x, 29, 2.5, 2, '#8a5a3a');
    p.set(x - 1, 27, '#f0a0c0');
    p.set(x + 1, 27, '#fff0a0');
    p.set(x, 26, '#e88aa8');
  }
  // Roof.
  for (let y = 6; y < 25; y++) {
    const t = (y - 6) / 18;
    const half = Math.round(4 + t * 24);
    for (let x = 29 - half; x < 29 + half; x++) {
      const left = x < 29;
      let c = left ? light(roof, 1) : roof;
      if ((y - 6) % 4 === 3) c = shade(roof, left ? 0 : 1);
      if (y > 22) c = shade(roof, 2);
      p.set(x, y, c);
    }
  }
  p.rect(3, 24, 52, 1, shade(roof, 2));
  // Finial and vane.
  p.rect(28, 2, 2, 5, '#c8a040');
  p.line(25, 3, 32, 3, '#6a5a4a');
  p.set(33, 3, '#6a5a4a');
  p.set(24, 2, '#6a5a4a');
  p.outline(shade(roof, 3));
  return p.toCanvas();
}

/** Striped beach parasol over a towel; colours and tilt from the seed. */
export function parasol(v: number): HTMLCanvasElement {
  const p = new Pix(36, 40);
  const stripes = [
    ['#e05a5a', '#fff4e8'],
    ['#3a9ac8', '#fff4e8'],
    ['#f0b040', '#fff4e8'],
    ['#6ab870', '#fff8f0'],
  ][v % 4];
  const towel = ['#f08aa8', '#7ab0e8', '#f0d060', '#b890e0'][Math.floor(r(v, 1) * 4)];
  // Towel on the sand.
  for (let y = 30; y < 38; y++)
    for (let x = 5; x < 27; x++) {
      const band = Math.floor((x - 5) / 4) % 2 === 0;
      p.set(x, y, y === 37 ? shade(towel, 1) : band ? towel : light(towel, 1));
    }
  p.rect(5, 30, 22, 1, light(towel, 2));
  // Pole, slightly tilted.
  const tilt = r(v, 2) < 0.5 ? -1 : 1;
  p.line(18, 9, 18 + tilt * 2, 37, '#8a6a4a');
  p.line(19, 9, 19 + tilt * 2, 37, '#b08a5a');
  // Canopy: a shallow dome in alternating gores.
  for (let y = 2; y < 13; y++)
    for (let x = 2; x < 35; x++) {
      const nx = (x + 0.5 - 18.5) / 16.5;
      const ny = (y + 0.5 - 12) / 10;
      if (nx * nx + ny * ny > 1 || y > 11) continue;
      const gore = Math.floor(((Math.atan2(ny, nx) + Math.PI) / Math.PI) * 6) % 2;
      let c = stripes[gore];
      if (y >= 10) c = shade(c, 1);
      else if (nx < -0.3 && y < 7) c = light(c, 1);
      p.set(x, y, c);
    }
  // Scalloped hem.
  for (let x = 3; x < 34; x++) if (x % 4 !== 0) p.set(x, 12, shade(stripes[Math.floor((x - 3) / 4) % 2], 1));
  p.set(18, 1, '#8a6a4a');
  // A pair of flip-flops and a paperback.
  p.rect(8, 33, 2, 3, '#e8c040');
  p.rect(11, 33, 2, 3, '#e8c040');
  p.rect(21, 32, 4, 3, r(v, 3) < 0.5 ? '#5a7ab0' : '#c85a4a');
  p.rect(21, 32, 4, 1, '#fff8e8');
  p.outline(shade(stripes[0], 3));
  return p.toCanvas();
}

/** A child's sandcastle: towers, a flag, a moat and a bucket. */
export function sandcastle(v: number): HTMLCanvasElement {
  const p = new Pix(28, 22);
  const sand = '#e8d098';
  const lit = light(sand, 1);
  const dim = shade(sand, 1);
  // Moat.
  p.ellipse(14, 17, 12, 4, (nx, ny) => (Math.hypot(nx, ny) > 0.75 ? '#c8aa70' : '#6ab8c8'));
  // Keep and towers.
  p.rect(9, 9, 10, 8, sand);
  p.rect(9, 9, 2, 8, lit);
  p.rect(17, 9, 2, 8, dim);
  for (const [x, h] of [
    [6, 9],
    [19, 8 + Math.floor(r(v, 1) * 3)],
  ]) {
    p.rect(x, 17 - h, 4, h, sand);
    p.rect(x, 17 - h, 1, h, lit);
    p.rect(x + 3, 17 - h, 1, h, dim);
    p.set(x, 16 - h, sand);
    p.set(x + 2, 16 - h, sand);
  }
  for (let x = 9; x < 19; x += 2) p.set(x, 8, sand);
  p.rect(13, 13, 2, 4, '#8a7048');
  // Flag and a shell.
  p.line(14, 2, 14, 8, '#6a5a4a');
  p.rect(15, 2, 3, 2, ['#e05a5a', '#3a9ac8', '#f0b040'][v % 3]);
  p.set(11, 12, '#f8c8d0');
  // Bucket.
  p.rect(23, 12, 4, 4, '#e05a5a');
  p.rect(23, 12, 4, 1, '#ff8a80');
  p.outline('#8a7048');
  return p.toCanvas();
}

/** Harbour buoy; `frame` tips it with the swell. */
export function buoy(v: number, frame: number): HTMLCanvasElement {
  const p = new Pix(12, 18);
  const c = ['#e05a4a', '#f0b040', '#3aa870'][v % 3];
  const tip = frame === 1 ? 1 : 0;
  p.ellipse(6, 13, 4.5, 2.2, (nx, ny) => (ny < 0 ? light(c, 1) : shade(c, 1)));
  p.rect(4 + tip, 6, 4, 7, c);
  p.rect(4 + tip, 6, 1, 7, light(c, 1));
  p.rect(7 + tip, 6, 1, 7, shade(c, 1));
  p.rect(4 + tip, 9, 4, 1, '#fff4e8');
  p.rect(5 + tip, 2, 2, 4, '#5a5a6a');
  p.set(5 + tip, 1, frame === 1 ? '#fff0a0' : '#c8b060');
  // Ripple ring.
  for (let x = 1; x < 11; x++) if ((x + frame) % 3) p.set(x, 16, '#d8f0f0');
  p.outline(shade(c, 3));
  return p.toCanvas();
}
