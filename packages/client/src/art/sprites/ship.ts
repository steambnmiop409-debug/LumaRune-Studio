import { hash2 } from '@lumina/core';
import { Pix } from '../Pix';
import { light, shade } from '../palette';

/** The cargo sloop moored at the pier. `crates` shows how full the deck is. */
export function shipSprite(crates: number): { img: HTMLCanvasElement; night: HTMLCanvasElement } {
  const W = 200;
  const H = 150;
  const p = new Pix(W, H);
  const n = new Pix(W, H);
  const hullTop = 104;
  const hullBot = 138;
  // Hull (side-on, bow to the right).
  for (let y = hullTop; y <= hullBot; y++) {
    const t = (y - hullTop) / (hullBot - hullTop);
    const x0 = 10 + t * t * 18;
    const x1 = W - 14 - t * t * 44 - (y < hullTop + 6 ? 0 : 0);
    for (let x = Math.round(x0); x < x1; x++) {
      let c = y < hullTop + 4 ? '#f4ecd8' : y < hullTop + 7 ? '#2f4a6a' : y > hullBot - 7 ? '#8a3a34' : '#6e4a34';
      if (y >= hullTop + 7 && y <= hullBot - 7 && (y - hullTop) % 5 === 0) c = shade(c, 1);
      if (x < x0 + 2) c = light(c, 1);
      p.set(x, y, c);
    }
  }
  // Portholes.
  for (let x = 40; x < 150; x += 22) {
    p.ellipse(x, hullTop + 14, 2.5, 2.5, '#2b2d4a');
    p.ellipse(x, hullTop + 14, 1.5, 1.5, '#a8d8ea');
    n.ellipse(x, hullTop + 14, 1.5, 1.5, '#ffe0a0');
  }
  // Deck.
  for (let y = hullTop - 10; y < hullTop; y++)
    for (let x = 14 + (hullTop - y); x < W - 20 - (hullTop - y) * 2; x++) p.set(x, y, (x + (y & 1) * 4) % 8 === 0 ? '#a8744a' : '#c8955a');
  // Cabin.
  p.rect(26, 76, 38, 20, '#f4ecd8');
  p.rect(26, 76, 38, 3, '#3f6a9a');
  p.rect(24, 73, 42, 4, '#2f4a6a');
  for (const x of [32, 46]) {
    p.rect(x, 82, 8, 7, '#2b2d4a');
    p.rect(x + 1, 83, 6, 5, '#a8d8ea');
    n.rect(x + 1, 83, 6, 5, '#ffd98a');
  }
  // Masts and furled sails.
  for (const [mx, top] of [
    [96, 6],
    [140, 22],
  ]) {
    p.rect(mx, top, 3, hullTop - top, '#8a5a3a');
    p.rect(mx, top, 1, hullTop - top, '#a8744a');
    p.rect(mx - 22, top + 18, 48, 3, '#8a5a3a');
    p.ellipse(mx + 1, top + 23, 24, 3, (nx, ny) => (ny < 0 ? '#f8f4ea' : '#d8d0c0'));
    for (let x = mx - 20; x < mx + 22; x += 6) p.set(x, top + 24, '#b8a890');
    p.line(mx + 1, top, W - 14, hullTop - 6, '#5a4a3a');
    p.line(mx + 1, top, 30, hullTop - 10, '#5a4a3a');
  }
  // Flag.
  p.rect(97, 0, 12, 6, '#e8836b');
  p.rect(97, 3, 12, 1, '#f4ecd8');
  // Lantern at the stern.
  p.rect(18, 86, 4, 6, '#3a3d52');
  p.rect(19, 87, 2, 4, '#ffe7a0');
  n.rect(19, 87, 2, 4, '#fff2c0');
  // Cargo crates on deck.
  const slots = Math.min(crates, 14);
  for (let i = 0; i < slots; i++) {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = 72 + col * 14 + (row ? 5 : 0);
    const y = hullTop - 22 - row * 10;
    const wood = hash2(i, 3, 9) < 0.5 ? '#d8a86a' : '#c8955a';
    p.rect(x, y, 12, 11, wood);
    p.rect(x, y, 12, 1, light(wood, 1));
    p.rect(x, y + 5, 12, 1, shade(wood, 1));
    p.rect(x + 11, y, 1, 11, shade(wood, 2));
  }
  p.outline(undefined, 'noTop');
  return { img: p.toCanvas(), night: n.toCanvas() };
}
