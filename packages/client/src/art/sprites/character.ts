import { BOTTOM_COLORS, CLOTH_COLORS, EYE_COLORS, HAIR_COLORS, type Appearance, type Dir } from '@lumina/core';
import { Pix } from '../Pix';
import { light, mix, rgbToHex, shade, unpack } from '../palette';
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
export type Pose = 'walk' | 'idle' | 'breathe' | 'raise' | 'strike' | 'carry';

/** Thick 2px limb from (x0,y0) to (x1,y1): lit edge + shaded edge + dark outline, hand at the end. */
function limb(p: Pix, pal: Record<string, string>, x0: number, y0: number, x1: number, y1: number, sleeveRows: number, lit: boolean) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    const sleeve = i < sleeveRows;
    for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [1, -1], [0, 2], [1, 2]]) if (!p.opaque(x + dx, y + dy)) p.set(x + dx, y + dy, sleeve ? pal.Y : pal.O);
    p.set(x, y, sleeve ? (lit ? pal.u : pal.T) : lit ? pal.S : pal.s);
    p.set(x + 1, y, sleeve ? pal.t : pal.s);
    p.set(x, y + 1, sleeve ? pal.T : pal.S);
    p.set(x + 1, y + 1, sleeve ? pal.t : pal.s);
  }
  p.set(Math.round(x1), Math.round(y1), pal.L);
}

/** Arms for action poses, drawn over the torso. */
function poseArms(p: Pix, pal: Record<string, string>, d: Dir, pose: Pose, bob: number, longSleeve: boolean) {
  const sl = longSleeve ? 6 : 2;
  const sy = 19 + bob;
  if (d === 'right') {
    if (pose === 'raise') limb(p, pal, 7, sy, 4, 11 + bob, sl, true);
    else if (pose === 'strike') limb(p, pal, 7, sy, 13, 22 + bob, sl, true);
    else limb(p, pal, 7, sy, 9, 11 + bob, sl, true);
    return;
  }
  if (pose === 'raise' || pose === 'carry') {
    limb(p, pal, 3, sy, 2, (pose === 'carry' ? 10 : 12) + bob, sl, d === 'down');
    limb(p, pal, 12, sy, 13, (pose === 'carry' ? 10 : 12) + bob, sl, d !== 'down');
  } else {
    limb(p, pal, 3, sy, 6, 24 + bob, sl, d === 'down');
    limb(p, pal, 12, sy, 9, 24 + bob, sl, d !== 'down');
  }
}

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
      const [r, g, b] = unpack(inner);
      p.set(x, y, shade(rgbToHex([r, g, b]), 2));
    }
}

/**
 * Composes one 16×32 frame from the layered templates.
 * `frame` 0..5 = walk cycle (head bob on the down beats); `pose` selects idle/action poses.
 */
export function characterFrame(a: Appearance, dir: Dir, frame: number, blink = false, pose: Pose = frame >= 0 ? 'walk' : 'idle'): HTMLCanvasElement {
  const p = new Pix(CHAR_W, CHAR_H);
  const pal = palette(a);
  const d: Dir = dir === 'left' ? 'right' : dir;
  const walking = pose === 'walk' || (pose === 'carry' && frame >= 0);
  const f = Math.max(0, frame);
  const bob = walking ? BOB[f] : pose === 'breathe' ? 1 : pose === 'strike' ? 1 : 0;
  const hair = HAIR_STYLES[a.hairStyle] ?? HAIR_STYLES[0];
  const hat = HATS_T[a.hat];
  const skirt = a.top === 3;
  const longSleeve = a.top === 2;
  const action = pose === 'raise' || pose === 'strike' || pose === 'carry';

  if (d === 'down') {
    paint(p, hair.down.back, pal, bob);
    paint(p, legsDown(walking ? STRIDE[f] : 0, skirt), pal);
    paint(p, TORSO_DOWN[a.top], pal, bob);
    if (!action) paint(p, armsDown(walking ? -STRIDE[f] : 0, longSleeve, false), pal, bob);
    paint(p, HEAD_DOWN, pal, bob);
    if (blink) paint(p, HEAD_DOWN_BLINK, pal, bob);
    paint(p, hair.down.front, pal, bob);
    if (hat) paint(p, hat.down, pal, bob);
    if (action) poseArms(p, pal, d, pose, bob, longSleeve);
  } else if (d === 'up') {
    paint(p, legsDown(walking ? -STRIDE[f] : 0, skirt), pal);
    paint(p, TORSO_UP[a.top], pal, bob);
    if (!action) paint(p, armsDown(walking ? STRIDE[f] : 0, longSleeve, true), pal, bob);
    paint(p, HEAD_UP, pal, bob);
    paint(p, hair.up.front, pal, bob);
    if (hat) paint(p, hat.up, pal, bob);
    if (action) poseArms(p, pal, d, pose, bob, longSleeve);
  } else {
    paint(p, hair.right.back, pal, bob);
    paint(p, legsRight(walking ? SIDE_POSE[f] : pose === 'strike' ? 1 : 0, skirt), pal);
    paint(p, TORSO_RIGHT[a.top], pal, bob);
    if (!action) armSide(p, pal, walking ? SIDE_ARM[f] : 0, longSleeve, bob);
    paint(p, HEAD_RIGHT, pal, bob);
    if (blink) paint(p, HEAD_RIGHT_BLINK, pal, bob);
    paint(p, hair.right.front, pal, bob);
    if (hat) paint(p, hat.right, pal, bob);
    if (action) poseArms(p, pal, d, pose, bob, longSleeve);
  }
  selOut(p);

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
  carry: Record<Dir, HTMLCanvasElement[]>;
  idle: Record<Dir, HTMLCanvasElement>;
  breathe: Record<Dir, HTMLCanvasElement>;
  blink: Record<Dir, HTMLCanvasElement>;
  raise: Record<Dir, HTMLCanvasElement>;
  strike: Record<Dir, HTMLCanvasElement>;
}

export function characterSheet(a: Appearance): CharacterSheet {
  const dirs: Dir[] = ['down', 'up', 'left', 'right'];
  const sheet = { walk: {}, carry: {}, idle: {}, breathe: {}, blink: {}, raise: {}, strike: {} } as CharacterSheet;
  for (const dir of dirs) {
    sheet.walk[dir] = Array.from({ length: WALK_FRAMES }, (_, f) => characterFrame(a, dir, f));
    sheet.carry[dir] = Array.from({ length: WALK_FRAMES }, (_, f) => characterFrame(a, dir, f, false, 'carry'));
    sheet.idle[dir] = characterFrame(a, dir, -1);
    sheet.breathe[dir] = characterFrame(a, dir, -1, false, 'breathe');
    sheet.blink[dir] = characterFrame(a, dir, -1, true);
    sheet.raise[dir] = characterFrame(a, dir, -1, false, 'raise');
    sheet.strike[dir] = characterFrame(a, dir, -1, false, 'strike');
  }
  return sheet;
}
