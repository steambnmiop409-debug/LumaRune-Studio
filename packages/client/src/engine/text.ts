import galmuri11 from 'galmuri/dist/Galmuri11.woff2?url';
import galmuri11b from 'galmuri/dist/Galmuri11-Bold.woff2?url';
import galmuri9 from 'galmuri/dist/Galmuri9.woff2?url';
import galmuri14 from 'galmuri/dist/Galmuri14.woff2?url';
import { hexToRgb } from '../art/palette';

export type FontId = 'body' | 'bold' | 'small' | 'title';

const FONTS: Record<FontId, { family: string; size: number; url: string; lineH: number }> = {
  body: { family: 'Galmuri11', size: 12, url: galmuri11, lineH: 14 },
  bold: { family: 'Galmuri11B', size: 12, url: galmuri11b, lineH: 14 },
  small: { family: 'Galmuri9', size: 10, url: galmuri9, lineH: 11 },
  title: { family: 'Galmuri14', size: 15, url: galmuri14, lineH: 18 },
};

export async function loadFonts(): Promise<void> {
  await Promise.all(
    Object.values(FONTS).map(async (f) => {
      const face = new FontFace(f.family, `url(${f.url})`);
      await face.load();
      document.fonts.add(face);
    }),
  );
}

const measureCtx = document.createElement('canvas').getContext('2d')!;
const cache = new Map<string, HTMLCanvasElement>();

export function lineHeight(font: FontId = 'body'): number {
  return FONTS[font].lineH;
}

export function measure(text: string, font: FontId = 'body'): number {
  const f = FONTS[font];
  measureCtx.font = `${f.size}px ${f.family}`;
  return Math.ceil(measureCtx.measureText(text).width);
}

/**
 * Renders text into a cached sprite with alpha thresholding, so glyph edges stay crisp pixels
 * even though the browser rasterizes fonts with anti-aliasing.
 */
function textSprite(text: string, font: FontId, color: string): HTMLCanvasElement {
  const key = `${font}|${color}|${text}`;
  let spr = cache.get(key);
  if (spr) return spr;
  const f = FONTS[font];
  const w = Math.max(1, measure(text, font) + 2);
  const h = f.lineH + 2;
  spr = document.createElement('canvas');
  spr.width = w;
  spr.height = h;
  const ctx = spr.getContext('2d')!;
  ctx.font = `${f.size}px ${f.family}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 0, 1);
  const img = ctx.getImageData(0, 0, w, h);
  const [r, g, b] = hexToRgb(color);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const on = d[i + 3] >= 110;
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = on ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
  if (cache.size > 4000) cache.clear();
  cache.set(key, spr);
  return spr;
}

export interface TextOpts {
  font?: FontId;
  color?: string;
  shadow?: string;
  outline?: string;
  align?: 'left' | 'center' | 'right';
}

/** Draws pixel text at integer coordinates. Returns the drawn width. */
export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: TextOpts = {}): number {
  const font = o.font ?? 'body';
  const color = o.color ?? '#2b2d4a';
  const spr = textSprite(text, font, color);
  const w = spr.width - 2;
  let dx = Math.round(x);
  if (o.align === 'center') dx = Math.round(x - w / 2);
  else if (o.align === 'right') dx = Math.round(x - w);
  const dy = Math.round(y) - 1;
  if (o.outline) {
    const out = textSprite(text, font, o.outline);
    for (const [ox, oy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ])
      ctx.drawImage(out, dx + ox, dy + oy);
  } else if (o.shadow) {
    ctx.drawImage(textSprite(text, font, o.shadow), dx, dy + 1);
  }
  ctx.drawImage(spr, dx, dy);
  return w;
}

/** Word-wraps text (Korean-aware: breaks on spaces, falls back to characters). */
export function wrap(text: string, maxW: number, font: FontId = 'body'): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (measure(test, font) <= maxW) {
        line = test;
        continue;
      }
      if (line) out.push(line);
      if (measure(word, font) <= maxW) {
        line = word;
        continue;
      }
      line = '';
      for (const ch of word) {
        if (measure(line + ch, font) > maxW) {
          out.push(line);
          line = ch;
        } else line += ch;
      }
    }
    out.push(line);
  }
  return out;
}
