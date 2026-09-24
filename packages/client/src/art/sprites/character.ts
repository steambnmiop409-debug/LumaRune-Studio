import { BOTTOM_COLORS, CLOTH_COLORS, EYE_COLORS, HAIR_COLORS, SHOE_COLORS, fullAppearance, type Appearance, type Dir } from '@lumina/core';
import { Pix } from '../Pix';
import { mix, pack, rgbToHex, shade, unpack } from '../palette';
import { HAIR_STYLES, HATS_T, HEAD_DOWN, HEAD_RIGHT, HEAD_UP, type Tpl } from './charTemplates';

/**
 * The 16×32 villager / farmer sprite.
 *
 * Head, hair and hats are hand-placed templates; the body is drawn from a small rig every frame —
 * hips, knees and ankles for the legs, shoulders, elbows and hands for the arms — so both legs are
 * always the same thickness (the far one is only shaded darker), limbs bend at the joints through an
 * 8-frame walk, and the hands can hold things. Clothes are painted over the rig per outfit.
 */
export const CHAR_W = 16;
export const CHAR_H = 32;
export const WALK_FRAMES = 8;

/**
 * free: arms swing · hold: one hand holds a tool at the side · lift: both hands hold something in front
 * · carry: arms overhead · raise / strike: the two halves of a tool swing.
 */
export type Pose = 'free' | 'hold' | 'lift' | 'carry' | 'raise' | 'strike';

/** Hand-tuned skin ramps: light, base, shade, outline, blush. */
const SKIN_RAMPS = [
  ['#fff1e6', '#f8dac8', '#e8b6a2', '#9a5a5a', '#f4a2a2'],
  ['#fde2cc', '#f1c3a1', '#dca07e', '#8a4a44', '#ec968a'],
  ['#f2c6a4', '#e0a883', '#c68664', '#7a4034', '#e2867a'],
  ['#e2ae88', '#c98e68', '#ac7050', '#6a3a2c', '#d4786a'],
  ['#c89272', '#a8704e', '#8a5638', '#502a1e', '#c06a5a'],
  ['#aa7a5a', '#8a573c', '#6e4230', '#40221a', '#a85a4a'],
  ['#8a5e44', '#6b412c', '#553222', '#301a14', '#8a4a3a'],
  ['#6e4834', '#4e2e20', '#3e2418', '#241410', '#6a3a2c'],
] as const;

/** Hat ramps: outline, shade, base, light, band. */
const HAT_COLORS: Record<number, [string, string, string, string, string]> = {
  1: ['#7a5a2e', '#c9a052', '#eccb7a', '#fbe7a8', '#d0503a'],
  2: ['#6a2436', '#a8404e', '#c84a5a', '#e07080', '#c84a5a'],
  3: ['#233c62', '#3f6494', '#4f7ab0', '#7aa0d0', '#f4ecd8'],
  4: ['#7a2a2a', '#b8403a', '#d85a4a', '#fbe0c8', '#a8302a'],
  5: ['#23305a', '#3a4a8a', '#4a62a8', '#f4ecd8', '#e8c050'],
  6: ['#3a6a3a', '#5a9a4a', '#7ab85a', '#f8a8c0', '#f8d860'],
};

/** A light-to-dark ramp that keeps its hue: warm highlights, cool shadows, a deep line colour. */
function ramp(c: string) {
  return { hi: mix(c, '#fff8e8', 0.3), base: c, lo: mix(c, '#2a2046', 0.26), line: mix(c, '#1c1426', 0.64) };
}

type Pal = Record<string, string>;

function palette(look: Required<Appearance>): Pal {
  const [sL, sB, sS, sO, blush] = SKIN_RAMPS[look.skin] ?? SKIN_RAMPS[1];
  const hair = ramp(HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0]);
  const top = ramp(CLOTH_COLORS[look.topColor] ?? CLOTH_COLORS[0]);
  const bottom = ramp(BOTTOM_COLORS[look.bottomColor] ?? BOTTOM_COLORS[0]);
  const shoe = ramp(SHOE_COLORS[look.shoes] ?? SHOE_COLORS[0]);
  const [hG, hq, hQ, hR, hr] = HAT_COLORS[look.hat] ?? HAT_COLORS[1];
  const shirt = ramp('#f3ede0');
  return {
    O: sO,
    S: sB,
    s: sS,
    L: sL,
    B: blush,
    M: mix(sS, '#8a2a3a', 0.45),
    E: '#2b2230',
    e: EYE_COLORS[look.eyes] ?? EYE_COLORS[0],
    W: '#ffffff',
    X: hair.line,
    H: hair.base,
    h: hair.lo,
    K: hair.hi,
    Y: top.line,
    T: top.base,
    t: top.lo,
    u: top.hi,
    A: look.top === 1 ? '#f0c050' : '#fdf8ef',
    Z: bottom.line,
    P: bottom.base,
    p: bottom.lo,
    q: bottom.hi,
    F: shoe.base,
    f: shoe.lo,
    n: shoe.line,
    // Shirt under a vest / jacket.
    w: shirt.base,
    v: shirt.lo,
    G: hG,
    Q: hQ,
    q2: hq,
    R: hR,
    r: hr,
  };
}

function paint(p: Pix, tpl: Tpl | undefined, pal: Pal, dy = 0): void {
  if (!tpl) return;
  const [y0, rows] = tpl;
  // Hats use 'q' for their shade, which clothes use too: map it through q2.
  p.template(rows, { ...pal, q: pal.q2 }, 0, y0 + dy);
}

/**
 * Paints hat rows (whose 'q' is the hat's own shade), first trimming any hair that would poke out
 * above the crown (spikes, a bun) so the hat sits on the head instead of floating in the hair.
 */
function paintHat(p: Pix, tpl: Tpl | undefined, pal: Pal, dy: number) {
  if (!tpl) return;
  const [y0, rows] = tpl;
  const hairTones = new Set([pal.X, pal.H, pal.h, pal.K].map((c) => pack(c)));
  for (let x = 0; x < CHAR_W; x++) {
    let top = -1;
    for (let r = 0; r < rows.length && top < 0; r++) if (rows[r][x] !== '.' && rows[r][x] !== ' ') top = y0 + dy + r;
    if (top < 0) continue;
    for (let y = 0; y < top; y++) if (hairTones.has(p.get(x, y))) p.set(x, y, 0);
  }
  p.template(rows, { ...pal, q: pal.q2 }, 0, y0 + dy);
}

// ── Limbs ────────────────────────────────────────────────────────────────

/**
 * A 2-pixel-wide limb along a polyline of joints, outlined, lit on the left edge.
 * `fill(i, n)` picks the colour pair [lit, shade] for step i of n (sleeve / trouser / skin).
 */
function limb(p: Pix, pts: Array<[number, number]>, outline: (t: number) => string, fill: (t: number) => [string, string], under = false) {
  const cells: Array<[number, number, number]> = [];
  let total = 0;
  for (let s = 0; s < pts.length - 1; s++) total += Math.max(Math.abs(pts[s + 1][0] - pts[s][0]), Math.abs(pts[s + 1][1] - pts[s][1]), 1);
  let k = 0;
  for (let s = 0; s < pts.length - 1; s++) {
    const [x0, y0] = pts[s];
    const [x1, y1] = pts[s + 1];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = s === 0 ? 0 : 1; i <= steps; i++, k++) cells.push([Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), k / Math.max(1, total)]);
  }
  // Outline first (only where empty unless drawing a far limb behind), then the 2×1 fill.
  for (const [x, y, t] of cells)
    for (const [dx, dy] of [
      [-1, 0],
      [2, 0],
      [0, -1],
      [1, -1],
      [0, 1],
      [1, 1],
    ])
      if (under || !p.opaque(x + dx, y + dy)) p.set(x + dx, y + dy, outline(t));
  for (const [x, y, t] of cells) {
    const [lit, dark] = fill(t);
    p.set(x, y, lit);
    p.set(x + 1, y, dark);
  }
}

interface Look {
  pal: Pal;
  look: Required<Appearance>;
  /** Sleeves reach the wrist. */
  longSleeve: boolean;
  /** Arm colour (shirt under a vest is white). */
  sleeve: [string, string, string];
  dress: boolean;
  /** 0 trousers, 1 shorts, 2 skirt. */
  bottom: number;
}

function lookOf(a: Appearance): Look {
  const look = fullAppearance(a);
  const pal = palette(look);
  const longSleeve = look.top === 2 || look.top === 4 || look.top === 5 || look.top === 6;
  const sleeve: [string, string, string] = look.top === 5 ? [pal.w, pal.v, mix(pal.v, '#1c1426', 0.5)] : [pal.T, pal.t, pal.Y];
  return { pal, look, longSleeve, sleeve, dress: look.top === 3, bottom: look.top === 3 ? 2 : look.bottom };
}

/** One arm from shoulder through elbow to hand; sleeves cover the upper part. */
function arm(p: Pix, L: Look, pts: Array<[number, number]>, lit: boolean, far = false) {
  const { pal, longSleeve, sleeve } = L;
  const cut = longSleeve ? 0.86 : 0.38;
  limb(
    p,
    pts,
    (t) => (t < cut ? sleeve[2] : pal.O),
    (t) => {
      if (t < cut) return far ? [sleeve[1], sleeve[1]] : lit ? [sleeve[0], sleeve[1]] : [sleeve[1], sleeve[1]];
      return far ? [pal.s, pal.s] : lit ? [pal.S, pal.s] : [pal.s, pal.s];
    },
    // A near arm lays its outline over the body so it reads against the shirt; a far arm tucks behind.
    !far,
  );
  // The hand: a rounded 2×2 with a lit knuckle.
  const [hx, hy] = pts[pts.length - 1];
  p.set(hx, hy, far ? pal.s : pal.S);
  p.set(hx + 1, hy, pal.s);
  p.set(hx, hy + 1, far ? pal.s : pal.S);
  p.set(hx + 1, hy + 1, pal.s);
}

/** One leg from hip through knee to ankle, then the shoe (toe forward when seen side-on). */
function leg(p: Pix, L: Look, pts: Array<[number, number]>, side: boolean, far: boolean) {
  const { pal, bottom } = L;
  // Trousers down to the ankle, shorts to mid-thigh, skirts leave the legs bare.
  const cloth = bottom === 0 ? 1.01 : bottom === 1 ? 0.45 : -1;
  const farP = mix(pal.p, pal.Z, 0.35);
  const farS = mix(pal.s, pal.O, 0.3);
  // Same width either way; the far leg is only darker, and the near leg's outline cuts in front of it.
  limb(
    p,
    pts,
    (t) => (t < cloth ? pal.Z : pal.O),
    (t) => {
      if (t < cloth) return far ? [farP, farP] : [pal.P, pal.p];
      return far ? [farS, farS] : [pal.S, pal.s];
    },
    !far,
  );
  const [ax, ay] = pts[pts.length - 1];
  // Shoe: leather, a lit toe cap and the sole — as wide as the leg head-on, a toe longer side-on.
  const len = side ? 3 : 2;
  const toe = far ? pal.f : mix(pal.F, '#fff8e8', 0.3);
  for (let i = 0; i < len; i++) {
    p.set(ax + i, ay + 1, far ? pal.f : (side ? i === len - 1 : i === 0) ? toe : pal.F);
    p.set(ax + i, ay + 2, pal.f);
  }
  p.set(ax - 1, ay + 1, pal.n);
  p.set(ax - 1, ay + 2, pal.n);
  p.set(ax + len, ay + 1, pal.n);
  p.set(ax + len, ay + 2, pal.n);
  for (let i = 0; i < len; i++) p.set(ax + i, ay + 3, pal.n);
}

// ── Walk cycles ──────────────────────────────────────────────────────────
// Frames: 0 contact · 1 down · 2 passing · 3 up · 4 contact · 5 down · 6 passing · 7 up.

/** Body bob (1 = one pixel lower) through the walk. */
const BOB = [1, 1, 0, 0, 1, 1, 0, 0];
/** Front/back view: how high each foot is lifted (screen-left foot, screen-right foot). */
const LIFT_A = [0, 0, 0, 0, 0, 1, 2, 1];
const LIFT_B = [0, 1, 2, 1, 0, 0, 0, 0];
/** Side view: foot position relative to the hip [x, lift] for the near and far leg. */
const SIDE_NEAR: Array<[number, number]> = [
  [3, 0],
  [2, 0],
  [0, 0],
  [-2, 0],
  [-3, 0],
  [-3, 1],
  [-1, 2],
  [1, 1],
];
const SIDE_FAR: Array<[number, number]> = [
  [-3, 0],
  [-3, 1],
  [-1, 2],
  [1, 1],
  [3, 0],
  [2, 0],
  [0, 0],
  [-2, 0],
];
/** Arm swing (hand offset) opposite the legs. */
const ARM_SWING = [-2, -1, 0, 1, 2, 1, 0, -1];

// ── Torso & clothes ──────────────────────────────────────────────────────

/** Front (or back) torso rows 18..24 for an outfit. `back` hides buttons, collars and pockets. */
function torsoFront(p: Pix, L: Look, b: number, back: boolean) {
  const { pal, look, bottom } = L;
  const s = look.top;
  const y = (r: number) => r + b;
  const main = s === 5 ? [pal.u, pal.T, pal.t, pal.Y] : [pal.u, pal.T, pal.t, pal.Y];
  // Silhouette: sloping shoulders, a straight body.
  const rows: Array<[number, number, number]> = [
    [18, 5, 10],
    [19, 3, 12],
    [20, 3, 12],
    [21, 4, 11],
    [22, 4, 11],
    [23, 4, 11],
  ];
  for (const [r, x0, x1] of rows)
    for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1;
      p.set(x, y(r), edge ? main[3] : x <= x0 + 1 ? main[0] : x >= x1 - 1 ? main[2] : main[1]);
    }
  // Neck and neckline.
  if (!back) {
    p.set(7, y(18), pal.S);
    p.set(8, y(18), pal.s);
    if (s === 0 || s === 7 || s === 3) {
      p.set(6, y(18), pal.u);
      p.set(9, y(18), pal.u);
    }
  } else {
    p.set(7, y(18), pal.s);
    p.set(8, y(18), pal.s);
  }
  // Hips: waistband and trouser tops (or the dress).
  if (!L.dress) {
    for (let x = 4; x <= 11; x++) p.set(x, y(24), x === 4 || x === 11 ? pal.Z : bottom === 2 ? (x < 8 ? pal.P : pal.p) : pal.P);
    p.set(7, y(24), pal.p);
    if (bottom === 2)
      // Skirt: flares over the thighs.
      for (let r = 25; r <= 26; r++)
        for (let x = 3; x <= 12; x++) p.set(x, y(r), x === 3 || x === 12 || r === 26 ? pal.Z : (x + r) % 3 === 0 ? pal.p : pal.P);
  }
  switch (s) {
    case 1: // Overalls: bib and straps in the trouser colour, gold buttons.
      for (let r = 20; r <= 23; r++) for (let x = 5; x <= 10; x++) p.set(x, y(r), x === 5 || x === 10 ? pal.Z : x === 9 ? pal.p : pal.P);
      p.set(5, y(19), pal.P);
      p.set(10, y(19), pal.p);
      p.set(5, y(18), pal.Z);
      p.set(10, y(18), pal.Z);
      if (!back) {
        p.set(6, y(20), pal.A);
        p.set(9, y(20), pal.A);
        p.set(7, y(22), pal.p);
        p.set(8, y(22), pal.p);
      } else {
        p.set(7, y(21), pal.Z);
        p.set(8, y(21), pal.Z);
      }
      break;
    case 2: // Knit sweater: cable stitches and a ribbed hem.
      for (let r = 19; r <= 23; r++) for (let x = 5; x <= 10; x++) if ((x + r) % 3 === 0) p.set(x, y(r), pal.u);
      for (let x = 5; x <= 10; x++) p.set(x, y(23), x % 2 ? pal.t : pal.T);
      if (!back) for (let x = 6; x <= 9; x++) p.set(x, y(18), pal.u);
      break;
    case 3: // Dress: a sash at the waist, the skirt flaring to the knee.
      for (let x = 4; x <= 11; x++) p.set(x, y(22), x === 4 || x === 11 ? pal.Y : pal.A);
      for (let r = 23; r <= 27; r++) {
        const half = 4 + Math.floor((r - 23) / 2);
        for (let x = 8 - half; x <= 7 + half; x++) {
          const edge = x === 8 - half || x === 7 + half || r === 27;
          p.set(x, y(r) - (r > 25 ? b : 0), edge ? pal.Y : (x + 1) % 3 === 0 ? pal.t : x < 7 ? pal.u : pal.T);
        }
      }
      break;
    case 4: // Hoodie: hood bunched behind the neck, drawstrings, a front pocket.
      for (let x = 5; x <= 10; x++) p.set(x, y(18), x === 5 || x === 10 ? pal.Y : pal.t);
      if (!back) {
        p.set(6, y(19), pal.A);
        p.set(6, y(20), pal.A);
        p.set(9, y(19), pal.A);
        p.set(9, y(20), pal.A);
        for (let x = 5; x <= 10; x++) p.set(x, y(22), pal.t);
        p.set(5, y(23), pal.t);
        p.set(10, y(23), pal.t);
      } else for (let r = 19; r <= 20; r++) for (let x = 5; x <= 10; x++) p.set(x, y(r), x === 5 || x === 10 ? pal.Y : pal.t);
      break;
    case 5: // Shirt and vest: white shirt showing in the V, buttons down the front.
      if (!back) {
        for (let r = 18; r <= 21; r++) {
          const w = r - 18;
          for (let x = 7 - Math.min(1, w); x <= 8 + Math.min(1, w); x++) if (r < 21 || (x >= 7 && x <= 8)) p.set(x, y(r), x <= 7 ? pal.w : pal.v);
        }
        p.set(7, y(22), pal.A);
        p.set(7, y(23), pal.A);
      }
      break;
    case 6: // Work jacket: open over a shirt, pockets and a turned collar.
      if (!back) {
        for (let r = 18; r <= 23; r++) {
          p.set(7, y(r), pal.w);
          p.set(8, y(r), pal.v);
        }
        p.set(6, y(19), pal.u);
        p.set(9, y(19), pal.u);
        p.set(5, y(21), pal.t);
        p.set(6, y(21), pal.t);
        p.set(9, y(21), pal.t);
        p.set(10, y(21), pal.t);
      } else for (let x = 5; x <= 10; x++) p.set(x, y(19), pal.t);
      break;
    case 7: // Striped tee.
      for (const r of [19, 21, 23]) for (let x = 5; x <= 10; x++) p.set(x, y(r), (x > 8 ? pal.v : pal.w) as string);
      break;
  }
}

/** Side-view torso, facing right. */
function torsoSide(p: Pix, L: Look, b: number) {
  const { pal, look, bottom } = L;
  const s = look.top;
  const y = (r: number) => r + b;
  const rows: Array<[number, number, number]> = [
    [18, 6, 10],
    [19, 5, 11],
    [20, 5, 11],
    [21, 5, 11],
    [22, 5, 11],
    [23, 5, 11],
  ];
  for (const [r, x0, x1] of rows)
    for (let x = x0; x <= x1; x++) p.set(x, y(r), x === x0 || x === x1 ? pal.Y : x === x1 - 1 ? pal.u : x === x0 + 1 ? pal.t : pal.T);
  p.set(9, y(18), pal.s);
  if (!L.dress) {
    for (let x = 5; x <= 11; x++) p.set(x, y(24), x === 5 || x === 11 ? pal.Z : pal.P);
    if (bottom === 2) for (let r = 25; r <= 26; r++) for (let x = 4; x <= 11; x++) p.set(x, y(r), x === 4 || x === 11 || r === 26 ? pal.Z : x % 3 === 0 ? pal.p : pal.P);
  }
  switch (s) {
    case 1:
      for (let r = 20; r <= 23; r++) for (let x = 7; x <= 10; x++) p.set(x, y(r), x === 10 ? pal.Z : pal.P);
      p.set(8, y(19), pal.P);
      p.set(8, y(18), pal.Z);
      p.set(9, y(20), pal.A);
      break;
    case 2:
      for (let r = 19; r <= 23; r++) for (let x = 6; x <= 9; x++) if ((x + r) % 3 === 0) p.set(x, y(r), pal.u);
      break;
    case 3:
      for (let x = 5; x <= 10; x++) p.set(x, y(22), x === 5 || x === 10 ? pal.Y : pal.A);
      for (let r = 23; r <= 27; r++) {
        const half = 3 + Math.floor((r - 23) / 2);
        for (let x = 7 - half; x <= 8 + half; x++) p.set(x, y(r) - (r > 25 ? b : 0), x === 7 - half || x === 8 + half || r === 27 ? pal.Y : x % 3 === 0 ? pal.t : pal.T);
      }
      break;
    case 4:
      for (let r = 18; r <= 20; r++) {
        p.set(4, y(r), pal.Y);
        p.set(5, y(r), pal.t);
      }
      p.set(10, y(19), pal.A);
      p.set(10, y(20), pal.A);
      break;
    case 5:
      p.set(9, y(18), pal.w);
      p.set(9, y(19), pal.w);
      p.set(10, y(21), pal.A);
      break;
    case 6:
      p.set(9, y(19), pal.u);
      p.set(10, y(18), pal.w);
      p.set(10, y(19), pal.w);
      p.set(7, y(21), pal.t);
      p.set(8, y(21), pal.t);
      break;
    case 7:
      for (const r of [19, 21, 23]) for (let x = 6; x <= 9; x++) p.set(x, y(r), pal.w);
      break;
  }
}

// ── Faces & accessories ──────────────────────────────────────────────────

/** Eye shapes, left eye cells for rows 12..14 (the right eye mirrors the columns). */
const EYES: Record<number, string[]> = {
  0: ['EE', 'We', 'ee'],
  1: ['SS', 'EE', 'ES'],
  2: ['EE', 'We', 'ee'],
  3: ['SS', 'EE', 'ee'],
};

function faceFront(p: Pix, L: Look, b: number, blink: boolean) {
  const { pal, look } = L;
  const rows = blink ? ['SS', 'EE', 'SS'] : EYES[look.eyeShape] ?? EYES[0];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 2; c++) {
      const ch = rows[r][c];
      p.set(4 + c, 12 + r + b, pal[ch]);
      const mirror = rows[r][1 - c];
      p.set(10 + c, 12 + r + b, pal[mirror === 'W' ? 'e' : mirror === 'e' && rows[r][c] === 'W' ? 'W' : mirror]);
    }
  // Keen eyes have lashes flicking out at the corners.
  if (look.eyeShape === 2 && !blink) {
    p.set(3, 12 + b, pal.E);
    p.set(12, 12 + b, pal.E);
  }
  // Brows (hidden under a fringe if the hair comes down).
  p.set(4, 11 + b, pal.h);
  p.set(5, 11 + b, pal.h);
  p.set(10, 11 + b, pal.h);
  p.set(11, 11 + b, pal.h);
}

function faceSide(p: Pix, L: Look, b: number, blink: boolean) {
  const { pal, look } = L;
  const rows = blink ? ['SS', 'EE', 'SS'] : EYES[look.eyeShape] ?? EYES[0];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) p.set(11 + c, 12 + r + b, pal[rows[r][c]]);
  if (look.eyeShape === 2 && !blink) p.set(13, 12 + b, pal.E);
  p.set(11, 11 + b, pal.h);
  p.set(12, 11 + b, pal.h);
}

const GLASS = '#3a3040';

function accessoryFront(p: Pix, L: Look, b: number) {
  const { pal, look } = L;
  const a = look.accessory;
  if (a === 1 || a === 2) {
    for (const x0 of [3, 9]) {
      if (a === 1) {
        for (const [dx, dy] of [
          [1, 0],
          [2, 0],
          [0, 1],
          [3, 1],
          [0, 2],
          [3, 2],
          [1, 3],
          [2, 3],
        ])
          p.set(x0 + dx, 11 + dy + b, GLASS);
      } else {
        for (let dx = 0; dx <= 3; dx++) {
          p.set(x0 + dx, 11 + b, GLASS);
          p.set(x0 + dx, 14 + b, GLASS);
        }
        for (let dy = 1; dy <= 2; dy++) {
          p.set(x0, 11 + dy + b, GLASS);
          p.set(x0 + 3, 11 + dy + b, GLASS);
        }
      }
    }
    p.set(7, 12 + b, GLASS);
    p.set(8, 12 + b, GLASS);
    p.set(4, 12 + b, '#e8f4ff');
  } else if (a === 3) {
    for (const [x, y] of [
      [3, 15],
      [5, 15],
      [4, 16],
      [10, 15],
      [12, 15],
      [11, 16],
    ])
      p.set(x, y + b, pal.s);
  }
}

function accessorySide(p: Pix, L: Look, b: number) {
  const { pal, look } = L;
  const a = look.accessory;
  if (a === 1 || a === 2) {
    for (let x = 10; x <= 13; x++) {
      p.set(x, 11 + b, GLASS);
      p.set(x, 14 + b, GLASS);
    }
    p.set(10, 12 + b, GLASS);
    p.set(10, 13 + b, GLASS);
    p.set(13, 12 + b, GLASS);
    p.set(13, 13 + b, GLASS);
    for (let x = 6; x < 10; x++) p.set(x, 12 + b, GLASS);
    if (a === 1) {
      p.set(10, 11 + b, pal.S);
      p.set(13, 14 + b, pal.S);
    }
  } else if (a === 3) {
    p.set(10, 15 + b, pal.s);
    p.set(12, 15 + b, pal.s);
  }
}

/** A knitted scarf round the neck, its tail hanging down one side. */
function scarf(p: Pix, d: Dir, b: number) {
  const c = ['#c8503a', '#e8836b', '#8a2a2a'];
  if (d === 'right') {
    for (let x = 6; x <= 10; x++) {
      p.set(x, 17 + b, x === 10 ? c[2] : c[0]);
      p.set(x, 18 + b, x % 2 ? c[1] : c[0]);
    }
    for (let r = 19; r <= 21; r++) {
      p.set(5, r + b, c[r % 2 ? 0 : 1]);
      p.set(4, r + b, c[2]);
    }
    return;
  }
  for (let x = 4; x <= 11; x++) {
    p.set(x, 17 + b, x === 4 || x === 11 ? c[2] : c[0]);
    p.set(x, 18 + b, x === 4 || x === 11 ? c[2] : x % 2 ? c[1] : c[0]);
  }
  if (d === 'down')
    for (let r = 19; r <= 22; r++) {
      p.set(9, r + b, c[r % 2 ? 0 : 1]);
      p.set(10, r + b, c[2]);
    }
}

// ── Composition ──────────────────────────────────────────────────────────

/**
 * Selective outline ("sel-out"): outline pixels on the lit top-left rim take a deep tone of the
 * colour they border instead of the dark line, which softens the silhouette like hand-shaded sprites.
 */
function selOut(p: Pix) {
  const src = p.data.slice();
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= p.w || y >= p.h ? 0 : src[y * p.w + x]);
  const lum = (c: number) => ((c & 255) * 0.3 + ((c >>> 8) & 255) * 0.59 + ((c >>> 16) & 255) * 0.11) / 255;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = at(x, y);
      if (!(c >>> 24) || lum(c) > 0.3) continue;
      const openUp = !(at(x, y - 1) >>> 24);
      const openLeft = !(at(x - 1, y) >>> 24);
      if (!openUp && !openLeft) continue;
      const inner = openUp ? at(x, y + 1) : at(x + 1, y);
      if (!(inner >>> 24) || lum(inner) < 0.3) continue;
      const [r, g, bb] = unpack(inner);
      p.set(x, y, shade(rgbToHex([r, g, bb]), 2));
    }
}

/** Where the working hand is in a frame (for drawing what it holds), in sprite pixels. */
export interface FrameInfo {
  img: HTMLCanvasElement;
  /** Right/front hand. */
  hand: [number, number];
  /** Both-hands grip point for held-in-front items. */
  grip: [number, number];
  /** Hands drawn on their own, to lay over something held in front (lift pose). */
  hands: HTMLCanvasElement | null;
  bob: number;
}

function flip(c: HTMLCanvasElement): HTMLCanvasElement {
  const f = document.createElement('canvas');
  f.width = c.width;
  f.height = c.height;
  const ctx = f.getContext('2d')!;
  ctx.scale(-1, 1);
  ctx.drawImage(c, -c.width, 0);
  return f;
}

/**
 * Composes one frame. `walk` is the walk frame (0..7) or -1 standing; `breathe` sinks the chest a pixel.
 */
export function composeFrame(a: Appearance, dir: Dir, walk: number, pose: Pose, opts: { blink?: boolean; breathe?: boolean } = {}): FrameInfo {
  const L = lookOf(a);
  const { pal, look } = L;
  const p = new Pix(CHAR_W, CHAR_H);
  const hands = pose === 'lift' ? new Pix(CHAR_W, CHAR_H) : null;
  const d: Dir = dir === 'left' ? 'right' : dir;
  const moving = walk >= 0;
  const f = Math.max(0, walk);
  const b = moving ? BOB[f] : opts.breathe || pose === 'strike' ? 1 : 0;
  const hair = HAIR_STYLES[look.hairStyle] ?? HAIR_STYLES[0];
  const hat = HATS_T[look.hat];
  const swing = moving && pose === 'free' ? ARM_SWING[f] : 0;
  let hand: [number, number] = [12, 24 + b];
  let grip: [number, number] = [8, 21 + b];

  if (d === 'right') {
    // Far arm swings behind the body, opposite the near one.
    if (pose === 'free' || pose === 'hold') arm(p, L, [[7, 19 + b], [7 - Math.round(swing / 2), 21 + b], [7 - swing, 23 + b]], false, true);
    paint(p, hair.right.back, pal, b);
    // Legs: far first, then near, both the same width.
    const far = moving ? SIDE_FAR[f] : [pose === 'strike' ? -2 : -1, 0];
    const near = moving ? SIDE_NEAR[f] : [pose === 'strike' ? 2 : 1, 0];
    const legPts = (foot: [number, number] | number[], hipX: number): Array<[number, number]> => {
      const [fx, lift] = foot;
      const knee = lift > 0 ? Math.max(fx, 0) + 1 : Math.round(fx / 2);
      return [
        [hipX, 25],
        [hipX + knee, 27 - Math.min(1, lift)],
        [hipX + fx, 28 - lift],
      ];
    };
    leg(p, L, legPts(far, 6), true, true);
    leg(p, L, legPts(near, 8), true, false);
    torsoSide(p, L, b);
    if (look.accessory === 4) scarf(p, 'right', b);
    paint(p, HEAD_RIGHT, pal, b);
    faceSide(p, L, b, !!opts.blink);
    accessorySide(p, L, b);
    paint(p, hair.right.front, pal, b);
    if (hat) paintHat(p, hat.right, pal, b);
    // Near arm.
    if (pose === 'free') {
      arm(p, L, [[8, 19 + b], [8 + Math.round(swing / 2), 21 + b], [8 + swing, 23 + b]], true);
      hand = [8 + swing, 23 + b];
    } else if (pose === 'hold') {
      arm(p, L, [[8, 19 + b], [9, 21 + b], [10, 22 + b]], true);
      hand = [10, 22 + b];
    } else if (pose === 'lift') {
      arm(p, L, [[7, 19 + b], [6, 21 + b], [5, 21 + b]], false, true);
      arm(hands!, L, [[8, 19 + b], [10, 20 + b], [12, 20 + b]], true);
      grip = [13, 19 + b];
      hand = [12, 20 + b];
    } else if (pose === 'carry') {
      arm(p, L, [[8, 19 + b], [9, 15 + b], [9, 11 + b]], true);
      hand = [9, 11 + b];
      grip = [8, 9 + b];
    } else if (pose === 'raise') {
      arm(p, L, [[7, 19 + b], [6, 15 + b], [4, 11 + b]], true);
      hand = [4, 11 + b];
    } else {
      arm(p, L, [[8, 19 + b], [11, 20 + b], [13, 22 + b]], true);
      hand = [13, 22 + b];
    }
  } else {
    const back = d === 'up';
    if (!back) paint(p, hair.down.back, pal, b);
    // Legs: the lifted foot rises and its knee bends; both legs keep the same width.
    const la = moving ? LIFT_A[f] : 0;
    const lb = moving ? LIFT_B[f] : 0;
    const frontLeg = (hip: number, lift: number) =>
      leg(
        p,
        L,
        [
          [hip, 25],
          [hip, 27 - Math.min(1, lift)],
          [hip, 28 - lift],
        ],
        false,
        false,
      );
    frontLeg(5, back ? lb : la);
    frontLeg(9, back ? la : lb);
    torsoFront(p, L, b, back);
    if (look.accessory === 4) scarf(p, d, b);
    // Arms at the sides (in the free pose they swing: the forward hand rises a little).
    const sw = pose === 'free' && moving ? ARM_SWING[f] : 0;
    const leftUp = back ? -sw : sw;
    const handY = (up: number) => 24 + b - Math.max(0, up > 0 ? 1 : 0) + (up < 0 ? 0 : 0);
    const armL = (pts: Array<[number, number]>) => arm(p, L, pts, !back);
    const armR = (pts: Array<[number, number]>) => arm(p, L, pts, back);
    if (pose === 'free') {
      armL([[2, 19 + b], [2 - (leftUp > 1 ? 0 : 0), 21 + b], [2 + (leftUp > 0 ? 1 : 0), handY(leftUp)]]);
      armR([[12, 19 + b], [12, 21 + b], [12 - (leftUp < 0 ? 1 : 0), handY(-leftUp)]]);
      hand = back ? [2, 24 + b] : [12, 24 + b];
    } else if (pose === 'hold') {
      // The tool hand (the character's right, on screen left facing us) bent forward at the waist.
      armL(back ? [[2, 19 + b], [2, 21 + b], [2, 24 + b]] : [[2, 19 + b], [2, 21 + b], [3, 23 + b]]);
      armR(back ? [[12, 19 + b], [12, 21 + b], [11, 23 + b]] : [[12, 19 + b], [12, 21 + b], [12, 24 + b]]);
      hand = back ? [11, 23 + b] : [3, 23 + b];
    } else if (pose === 'lift') {
      // Forearms come forward: hands meet in front of the chest.
      const target = back ? p : hands!;
      arm(target, L, [[2, 19 + b], [3, 21 + b], [5, 21 + b]], !back);
      arm(target, L, [[12, 19 + b], [11, 21 + b], [9, 21 + b]], back);
      grip = [8, 20 + b];
      hand = [9, 21 + b];
    } else if (pose === 'carry' || pose === 'raise') {
      armL([[3, 19 + b], [2, 15 + b], [2, pose === 'carry' ? 10 + b : 12 + b]]);
      armR([[12, 19 + b], [13, 15 + b], [13, pose === 'carry' ? 10 + b : 12 + b]]);
      hand = [13, 11 + b];
      grip = [8, 8 + b];
    } else {
      armL([[3, 19 + b], [4, 22 + b], [6, 24 + b]]);
      armR([[12, 19 + b], [11, 22 + b], [9, 24 + b]]);
      hand = [8, 24 + b];
    }
    if (back) {
      paint(p, HEAD_UP, pal, b);
      paint(p, hair.up.front, pal, b);
      if (hat) paintHat(p, hat.up, pal, b);
    } else {
      paint(p, HEAD_DOWN, pal, b);
      faceFront(p, L, b, !!opts.blink);
      accessoryFront(p, L, b);
      paint(p, hair.down.front, pal, b);
      if (hat) paintHat(p, hat.down, pal, b);
    }
  }
  selOut(p);
  let img = p.toCanvas();
  let handsImg = hands ? hands.toCanvas() : null;
  if (dir === 'left') {
    img = flip(img);
    handsImg = handsImg ? flip(handsImg) : null;
    hand = [CHAR_W - 2 - hand[0], hand[1]];
    grip = [CHAR_W - 1 - grip[0], grip[1]];
  }
  return { img, hand, grip, hands: handsImg, bob: b };
}

/** Lazily built frames for one appearance. */
export class CharacterSheet {
  private cache = new Map<string, FrameInfo>();
  constructor(private look: Appearance) {}

  frame(dir: Dir, walk: number, pose: Pose = 'free', blink = false, breathe = false): FrameInfo {
    const key = `${dir}${walk}${pose}${blink ? 1 : 0}${breathe ? 1 : 0}`;
    let f = this.cache.get(key);
    if (!f) {
      f = composeFrame(this.look, dir, walk, pose, { blink, breathe });
      this.cache.set(key, f);
    }
    return f;
  }

  /** Builds every frame up front (e.g. behind a loading moment). */
  warm(): void {
    for (const d of ['down', 'up', 'left', 'right'] as Dir[])
      for (const pose of ['free', 'hold', 'lift', 'carry'] as Pose[]) for (let w = -1; w < WALK_FRAMES; w++) this.frame(d, w, pose);
  }
}

export function characterSheet(a: Appearance): CharacterSheet {
  return new CharacterSheet(a);
}
