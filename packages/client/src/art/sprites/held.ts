import { Pix } from '../Pix';
import { mix } from '../palette';

/**
 * Tools as they look in the hand (smaller than their inventory icons): a hoe, scythe or pickaxe held
 * upright by its handle, the watering can hanging from its grip. `view` is 'front' (facing the camera
 * or away) or 'side' (facing right; flip it for left). The anchor is where the hand closes.
 */
export interface HeldSprite {
  img: HTMLCanvasElement;
  ax: number;
  ay: number;
}

const WOOD = '#a8744a';
const WOOD_D = '#7a5236';
const METAL = ['#e8ecf2', '#b8c0cc', '#8a92a0', '#5a6070'];
const CAN = [['#f0a860', '#d0803a', '#a8602a', '#6a3a1a'], ['#e8a070', '#c8704a', '#9a4a2a', '#5a2a1a'], ['#e0e8f0', '#b0bccc', '#8090a4', '#4a5468']];

export function heldTool(tool: 'hoe' | 'scythe' | 'pick' | 'can', view: 'front' | 'side', tier = 1): HeldSprite {
  if (tool === 'can') {
    const c = CAN[Math.max(0, Math.min(2, tier - 1))];
    const p = new Pix(12, 10);
    // Body.
    for (let y = 3; y <= 8; y++) for (let x = 2; x <= 8; x++) p.set(x, y, x === 2 ? c[0] : x >= 7 ? c[2] : c[1]);
    for (let x = 2; x <= 8; x++) p.set(x, 5, mix(c[1], '#ffffff', 0.25));
    // Handle arching over the top, where the hand holds it.
    for (let x = 3; x <= 7; x++) p.set(x, 1, c[2]);
    p.set(3, 2, c[2]);
    p.set(7, 2, c[2]);
    // Spout reaching forward.
    if (view === 'side') {
      p.set(9, 5, c[1]);
      p.set(10, 4, c[1]);
      p.set(11, 3, c[0]);
    } else {
      p.set(1, 5, c[1]);
      p.set(0, 4, c[0]);
    }
    p.outline(c[3]);
    return { img: p.toCanvas(), ax: 5, ay: 1 };
  }
  const p = new Pix(12, 16);
  if (view === 'front') {
    // Upright: handle straight up from the fist, head on top.
    for (let y = 4; y <= 15; y++) {
      p.set(5, y, y % 4 === 0 ? WOOD_D : WOOD);
      p.set(6, y, WOOD_D);
    }
    if (tool === 'hoe') {
      for (let x = 2; x <= 6; x++) p.set(x, 2, METAL[x === 2 ? 0 : 1]);
      for (let x = 2; x <= 4; x++) p.set(x, 3, METAL[2]);
    } else if (tool === 'pick') {
      for (let x = 1; x <= 10; x++) p.set(x, 2 + (x < 3 || x > 8 ? 1 : 0), METAL[x < 6 ? 1 : 2]);
      p.set(5, 1, METAL[0]);
      p.set(6, 1, METAL[1]);
    } else {
      // Scythe: a curved blade sweeping to the left.
      for (let x = 1; x <= 6; x++) p.set(x, 1 + (x < 3 ? 1 : 0), METAL[x < 4 ? 0 : 1]);
      p.set(0, 3, METAL[1]);
      p.set(1, 3, METAL[2]);
    }
    p.outline('#2b2d4a');
    return { img: p.toCanvas(), ax: 5, ay: 12 };
  }
  // Side view: carried angled forward, head up and ahead.
  for (let i = 0; i <= 9; i++) {
    const x = 2 + Math.round(i * 0.55);
    const y = 14 - i;
    p.set(x, y, i % 3 === 0 ? WOOD_D : WOOD);
    p.set(x + 1, y, WOOD_D);
  }
  const hx = 7;
  const hy = 4;
  if (tool === 'hoe') {
    for (let y = hy; y <= hy + 3; y++) p.set(hx + 1, y, METAL[y === hy ? 0 : 1]);
    p.set(hx + 2, hy + 3, METAL[2]);
    p.set(hx + 2, hy + 2, METAL[1]);
  } else if (tool === 'pick') {
    for (let i = -3; i <= 3; i++) p.set(hx + i, hy - 1 + Math.abs(i) / 2, METAL[i < 0 ? 1 : 2]);
    p.set(hx, hy - 2, METAL[0]);
  } else {
    for (let i = 0; i <= 5; i++) p.set(hx + 1 - Math.round(i * 0.4), hy - 1 + i, METAL[i < 2 ? 0 : 1]);
    p.set(hx + 2, hy - 1, METAL[1]);
  }
  p.outline('#2b2d4a');
  return { img: p.toCanvas(), ax: 2, ay: 13 };
}
