import { BOTTOM_COLORS, CLOTH_COLORS, EYE_COLORS, HAIR_COLORS, type Appearance, type Dir } from '@lumina/core';
import { Pix } from '../Pix';
import { light, mix, shade } from '../palette';
import {
  HAIR_STYLES,
  HATS_T,
  HEAD_DOWN,
  HEAD_DOWN_BLINK,
  HEAD_RIGHT,
  HEAD_RIGHT_BLINK,
  HEAD_UP,
  TORSO_DOWN,
  TORSO_RIGHT,
  TORSO_UP,
  armsDown,
  legsDown,
  legsRight,
  type Tpl,
} from './charTemplates';

export const CHAR_W = 16;
export const CHAR_H = 32;
export const WALK_FRAMES = 6;

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
};

function palette(a: Appearance): Record<string, string> {
  const [sL, sB, sS, sO, blush] = SKIN_RAMPS[a.skin] ?? SKIN_RAMPS[1];
  const hair = HAIR_COLORS[a.hairColor];
  const top = CLOTH_COLORS[a.topColor];
  const bottom = BOTTOM_COLORS[a.bottomColor];
  const [hG, hq, hQ, hR, hr] = HAT_COLORS[a.hat] ?? HAT_COLORS[1];
  const accent = a.top === 1 ? '#f0c050' : a.top === 2 ? light(top, 2) : '#fdf8ef';
  return {
    O: sO,
    S: sB,
    s: sS,
    L: sL,
    B: blush,
    M: mix(sS, '#8a2a3a', 0.45),
    E: '#2b2230',
    e: EYE_COLORS[a.eyes],
    W: '#ffffff',
    X: shade(hair, 3),
    H: hair,
    h: shade(hair, 1),
    K: light(hair, 2),
    Y: shade(top, 3),
    T: top,
    t: shade(top, 1),
    u: light(top, 1),
    A: accent,
    Z: shade(bottom, 3),
    P: bottom,
    p: shade(bottom, 1),
    F: '#7a5242',
    f: '#44302a',
    G: hG,
    Q: hQ,
    q: hq,
    R: hR,
    r: hr,
  };
}

function paint(p: Pix, tpl: Tpl | undefined, pal: Record<string, string>, dy = 0): void {
  if (!tpl) return;
  const [y0, rows] = tpl;
  p.template(rows, pal, 0, y0 + dy);
}

/** Side-view near arm (3px wide incl. outline), swinging by `phase` (-1 back .. 1 forward). */
function armSide(p: Pix, pal: Record<string, string>, phase: number, longSleeve: boolean, dy: number) {
  for (let y = 20; y <= 26; y++) {
    const s = y >= 23 ? phase : 0;
    const yy = y + dy;
    if (y <= 21) {
      p.set(6, yy, pal.Y);
      p.set(7, yy, y === 20 ? pal.u : pal.T);
      p.set(8, yy, pal.t);
      p.set(9, yy, pal.Y);
    } else if (y <= 24) {
      const sleeve = longSleeve && y <= 23;
      p.set(6 + s, yy, sleeve ? pal.Y : pal.O);
      p.set(7 + s, yy, sleeve ? pal.T : pal.S);
      p.set(8 + s, yy, sleeve ? pal.t : pal.s);
      p.set(9 + s, yy, sleeve ? pal.Y : pal.O);
    } else if (y === 25) {
      p.set(6 + s, yy, pal.O);
      p.set(7 + s, yy, pal.L);
      p.set(8 + s, yy, pal.S);
      p.set(9 + s, yy, pal.O);
    } else {
      p.set(7 + s, yy, pal.O);
      p.set(8 + s, yy, pal.O);
    }
  }
}

const BOB = [0, 1, 0, 0, 1, 0];
const STRIDE = [1, 1, 0, -1, -1, 0];
const SIDE_POSE = [1, 1, 2, 3, 3, 2];
const SIDE_ARM = [-1, -1, 0, 1, 1, 0];

/**
 * Composes one 16×32 frame from the layered templates.
 * `frame` -1 = idle; 0..5 = walk cycle (head bob on the down beats).
 */
export function characterFrame(a: Appearance, dir: Dir, frame: number, blink = false): HTMLCanvasElement {
  const p = new Pix(CHAR_W, CHAR_H);
  const pal = palette(a);
  const d: Dir = dir === 'left' ? 'right' : dir;
  const walking = frame >= 0;
  const bob = walking ? BOB[frame] : 0;
  const hair = HAIR_STYLES[a.hairStyle] ?? HAIR_STYLES[0];
  const hat = HATS_T[a.hat];
  const skirt = a.top === 3;
  const longSleeve = a.top === 2;

  if (d === 'down') {
    paint(p, hair.down.back, pal, bob);
    paint(p, legsDown(walking ? STRIDE[frame] : 0, skirt), pal);
    paint(p, TORSO_DOWN[a.top], pal, bob);
    paint(p, armsDown(walking ? -STRIDE[frame] : 0, longSleeve, false), pal, bob);
    paint(p, HEAD_DOWN, pal, bob);
    if (blink) paint(p, HEAD_DOWN_BLINK, pal, bob);
    paint(p, hair.down.front, pal, bob);
    if (hat) paint(p, hat.down, pal, bob);
  } else if (d === 'up') {
    paint(p, legsDown(walking ? -STRIDE[frame] : 0, skirt), pal);
    paint(p, TORSO_UP[a.top], pal, bob);
    paint(p, armsDown(walking ? STRIDE[frame] : 0, longSleeve, true), pal, bob);
    paint(p, HEAD_UP, pal, bob);
    paint(p, hair.up.front, pal, bob);
    if (hat) paint(p, hat.up, pal, bob);
  } else {
    paint(p, hair.right.back, pal, bob);
    paint(p, legsRight(walking ? SIDE_POSE[frame] : 0, skirt), pal);
    paint(p, TORSO_RIGHT[a.top], pal, bob);
    armSide(p, pal, walking ? SIDE_ARM[frame] : 0, longSleeve, bob);
    paint(p, HEAD_RIGHT, pal, bob);
    if (blink) paint(p, HEAD_RIGHT_BLINK, pal, bob);
    paint(p, hair.right.front, pal, bob);
    if (hat) paint(p, hat.right, pal, bob);
  }

  const canvas = p.toCanvas();
  if (dir !== 'left') return canvas;
  const flipped = document.createElement('canvas');
  flipped.width = CHAR_W;
  flipped.height = CHAR_H;
  const ctx = flipped.getContext('2d')!;
  ctx.scale(-1, 1);
  ctx.drawImage(canvas, -CHAR_W, 0);
  return flipped;
}

export interface CharacterSheet {
  walk: Record<Dir, HTMLCanvasElement[]>;
  idle: Record<Dir, HTMLCanvasElement>;
  blink: Record<Dir, HTMLCanvasElement>;
}

export function characterSheet(a: Appearance): CharacterSheet {
  const dirs: Dir[] = ['down', 'up', 'left', 'right'];
  const sheet: CharacterSheet = { walk: {} as CharacterSheet['walk'], idle: {} as CharacterSheet['idle'], blink: {} as CharacterSheet['blink'] };
  for (const dir of dirs) {
    sheet.walk[dir] = Array.from({ length: WALK_FRAMES }, (_, f) => characterFrame(a, dir, f));
    sheet.idle[dir] = characterFrame(a, dir, -1);
    sheet.blink[dir] = characterFrame(a, dir, -1, true);
  }
  return sheet;
}
