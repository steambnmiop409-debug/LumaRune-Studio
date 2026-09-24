import type { WeatherKind } from '@lumina/core';
import { Pix } from '../Pix';
import { P, light, shade } from '../palette';
import { hash2 } from '@lumina/core';

/** Parchment panel with ink border and brass corner rivets. */
export function panel(w: number, h: number, tone: 'paper' | 'dark' = 'paper'): HTMLCanvasElement {
  const p = new Pix(w, h);
  const fill = tone === 'paper' ? P.paper : '#3a3c5e';
  const fillShade = tone === 'paper' ? P.paperShade : '#2f3150';
  const border = P.ink;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      const inner = x === 1 || y === 1 || x === w - 2 || y === h - 2;
      const corner = (x < 2 || x > w - 3) && (y < 2 || y > h - 3);
      if (corner && (x === 0 || x === w - 1) && (y === 0 || y === h - 1)) continue;
      let c = fill;
      if (edge) c = border;
      else if (inner) c = y === h - 2 || x === w - 2 ? fillShade : tone === 'paper' ? P.paperLight : '#4a4c72';
      else if (hash2(x, y, w * 7 + h) < 0.035) c = fillShade;
      else if (y >= h - 4) c = fillShade;
      p.set(x, y, c);
    }
  // Brass rivets.
  for (const [x, y] of [
    [3, 3],
    [w - 5, 3],
    [3, h - 5],
    [w - 5, h - 5],
  ]) {
    p.rect(x, y, 2, 2, P.brass);
    p.set(x, y, P.brassLight);
    p.set(x + 1, y + 1, P.brassDark);
  }
  return p.toCanvas();
}

export function slotFrame(selected: boolean): HTMLCanvasElement {
  const p = new Pix(22, 22);
  const bg = selected ? '#fff4d8' : '#ecd9b2';
  p.rect(1, 1, 20, 20, bg);
  p.rect(0, 1, 1, 20, P.ink);
  p.rect(21, 1, 1, 20, P.ink);
  p.rect(1, 0, 20, 1, P.ink);
  p.rect(1, 21, 20, 1, P.ink);
  p.rect(1, 20, 20, 1, shade(bg, 1));
  p.rect(20, 1, 1, 20, shade(bg, 1));
  p.rect(1, 1, 20, 1, light(bg, 1));
  if (selected) {
    p.rect(0, 0, 22, 1, P.brass);
    p.rect(0, 21, 22, 1, P.brassDark);
    p.rect(0, 0, 1, 22, P.brassLight);
    p.rect(21, 0, 1, 22, P.brassDark);
  }
  return p.toCanvas();
}

export function star(filled: boolean, size: 5 | 7 = 5): HTMLCanvasElement {
  const p = new Pix(size, size);
  const c = filled ? P.gold : '#b8a888';
  const d = filled ? '#c8902a' : '#8a7a62';
  if (size === 5) {
    p.set(2, 0, c);
    p.rect(1, 1, 3, 1, c);
    p.rect(0, 2, 5, 1, c);
    p.rect(1, 3, 3, 1, c);
    p.set(0, 4, d);
    p.set(4, 4, d);
    p.set(2, 3, filled ? '#fff0a0' : c);
  } else {
    p.set(3, 0, c);
    p.rect(2, 1, 3, 2, c);
    p.rect(0, 2, 7, 2, c);
    p.rect(1, 4, 5, 1, c);
    p.rect(1, 5, 2, 1, d);
    p.rect(4, 5, 2, 1, d);
    p.set(0, 6, d);
    p.set(6, 6, d);
    p.set(3, 2, filled ? '#fff0a0' : c);
  }
  return p.toCanvas();
}

/** Quality badge: bronze ★2, silver ★3, gold ★4, violet ★5. */
export const QUALITY_COLORS = ['', '', '#d8955a', '#dfe6ee', '#f5c542', '#c89af0'] as const;

export function qualityStar(q: number): HTMLCanvasElement {
  const p = new Pix(7, 7);
  const c = QUALITY_COLORS[q] || P.gold;
  const d = shade(c, 2);
  p.set(3, 0, c);
  p.rect(2, 1, 3, 2, c);
  p.rect(0, 2, 7, 2, c);
  p.rect(1, 4, 5, 1, c);
  p.rect(1, 5, 2, 1, d);
  p.rect(4, 5, 2, 1, d);
  p.set(3, 2, light(c, 2));
  p.outline(P.ink);
  return p.toCanvas();
}

export function coin(): HTMLCanvasElement {
  const p = new Pix(9, 9);
  p.ellipse(4.5, 4.5, 4, 4, (nx, ny) => (nx + ny < -0.5 ? '#fff0a0' : nx + ny > 0.6 ? '#c8902a' : P.gold));
  p.rect(4, 2, 1, 5, '#c8902a');
  p.outline(P.ink);
  return p.toCanvas();
}

export function drop(filled: boolean): HTMLCanvasElement {
  const p = new Pix(7, 9);
  const c = filled ? '#4fa3c8' : '#c8bca0';
  p.set(3, 0, c);
  p.rect(2, 1, 3, 2, c);
  p.ellipse(3.5, 5.5, 3, 3, c);
  if (filled) p.set(2, 4, '#c8ecff');
  return p.toCanvas();
}

export function umbrella(): HTMLCanvasElement {
  const p = new Pix(9, 9);
  p.ellipse(4.5, 3.5, 4.5, 3.5, (nx, ny) => (ny > 0.1 ? null : nx < 0 ? P.coral : P.coralDark));
  p.rect(4, 3, 1, 5, P.ink);
  p.set(3, 8, P.ink);
  return p.toCanvas();
}

export function thermometer(): HTMLCanvasElement {
  const p = new Pix(5, 10);
  p.rect(1, 0, 3, 7, P.ink);
  p.rect(2, 1, 1, 6, '#f4ecd8');
  p.rect(2, 4, 1, 3, '#e8503a');
  p.ellipse(2.5, 8, 2.5, 2, '#e8503a');
  return p.toCanvas();
}

export function snowflake(): HTMLCanvasElement {
  const p = new Pix(9, 9);
  const c = '#6ab0d8';
  p.line(4, 0, 4, 8, c);
  p.line(0, 4, 8, 4, c);
  p.line(1, 1, 7, 7, c);
  p.line(7, 1, 1, 7, c);
  return p.toCanvas();
}

/** Small weather glyph for text lines (12×10). */
export function weatherIcon(kind: WeatherKind): HTMLCanvasElement {
  const p = new Pix(13, 11);
  const cloud = (dark: boolean) => {
    const c = dark ? '#8a90a8' : '#f4f6fa';
    const d = dark ? '#6a708a' : '#c8d0dc';
    p.ellipse(4, 6, 3.5, 3, c);
    p.ellipse(8, 5, 4, 3.5, c);
    p.rect(2, 7, 9, 2, c);
    p.rect(2, 9, 9, 1, d);
  };
  if (kind === 'clear') {
    p.ellipse(6.5, 5.5, 3.5, 3.5, '#f5c542');
    for (const [x, y] of [
      [6, 0],
      [6, 10],
      [1, 5],
      [11, 5],
      [2, 1],
      [10, 1],
      [2, 9],
      [10, 9],
    ])
      p.set(x, y, '#f5a542');
  } else if (kind === 'cloudy' || kind === 'fog') {
    if (kind === 'cloudy') p.ellipse(9, 3, 2.5, 2.5, '#f5c542');
    cloud(false);
    if (kind === 'fog') {
      p.rect(1, 3, 11, 1, '#c8d0dc');
      p.rect(0, 10, 12, 1, '#c8d0dc');
    }
  } else if (kind === 'rain' || kind === 'storm') {
    cloud(kind === 'storm');
    for (const x of [3, 6, 9]) p.set(x, 10, '#4fa3c8');
    if (kind === 'storm') {
      p.set(7, 8, '#f5d040');
      p.set(6, 9, '#f5d040');
      p.set(7, 10, '#f5d040');
    }
  } else {
    cloud(false);
    for (const x of [3, 6, 9]) p.set(x, 10, '#ffffff');
    p.set(5, 10, '#c8d8e8');
  }
  p.outline(P.ink);
  return p.toCanvas();
}

/** Target cursor corner brackets. */
export function cursorBrackets(color: string): HTMLCanvasElement {
  const p = new Pix(20, 20);
  for (const [x, y, dx, dy] of [
    [0, 0, 1, 1],
    [19, 0, -1, 1],
    [0, 19, 1, -1],
    [19, 19, -1, -1],
  ]) {
    for (let i = 0; i < 5; i++) {
      p.set(x + dx * i, y, color);
      p.set(x, y + dy * i, color);
      p.set(x + dx * i, y + dy, shade(color, 2));
    }
  }
  return p.toCanvas();
}

/** Mouse pointer (a small brass-tipped quill arrow). */
export function pointer(): HTMLCanvasElement {
  const p = new Pix(10, 12);
  const rows = ['X.........', 'XX........', 'XWX.......', 'XWWX......', 'XWWWX.....', 'XWWWWX....', 'XWWWWWX...', 'XWWWXXXX..', 'XWXWX.....', 'XX.XWX....', 'X...XWX...', '.....XX...'];
  p.template(rows, { X: P.ink, W: P.paperLight });
  return p.toCanvas();
}
