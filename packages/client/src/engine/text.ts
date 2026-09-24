import { tr } from '@lumina/core';
import { hexToRgb } from '../art/palette';

/**
 * Bitmap text. Glyphs come straight from the Galmuri BDF bitmap fonts (converted by
 * tools/font/build.ts), so every letter is placed as exact 1-bit pixels: no browser
 * anti-aliasing, no half pixels, and measurements that match what is drawn.
 *
 * Everything drawn or measured here is translated on the way in (see tr() in @lumina/core), so
 * a Korean literal passed to drawText shows in the player's language. Names the player typed
 * are drawn with { raw: true }.
 */
export type FontId = 'body' | 'bold' | 'small' | 'tiny' | 'title';

interface Glyph {
  dw: number;
  w: number;
  h: number;
  x: number;
  y: number;
  bits: Uint8Array;
}

interface BitmapFont {
  ascent: number;
  descent: number;
  glyphs: Map<number, Glyph>;
}

const fonts = {} as Record<FontId, BitmapFont>;
const IDS: FontId[] = ['body', 'bold', 'small', 'tiny', 'title'];

function parse(buf: ArrayBuffer): BitmapFont {
  const v = new DataView(buf);
  const count = v.getUint32(0, true);
  const ascent = v.getUint8(4);
  const descent = v.getUint8(5);
  const glyphs = new Map<number, Glyph>();
  let o = 8;
  for (let i = 0; i < count; i++) {
    const cp = v.getUint32(o, true);
    const dw = v.getUint8(o + 4);
    const w = v.getUint8(o + 5);
    const h = v.getUint8(o + 6);
    const x = v.getInt8(o + 7);
    const y = v.getInt8(o + 8);
    o += 9;
    const n = Math.ceil(w / 8) * h;
    glyphs.set(cp, { dw, w, h, x, y, bits: new Uint8Array(buf, o, n) });
    o += n;
  }
  return { ascent, descent, glyphs };
}

export async function loadFonts(): Promise<void> {
  await Promise.all(
    IDS.map(async (id) => {
      const res = await fetch(`./fonts/${id}.bin`);
      fonts[id] = parse(await res.arrayBuffer());
    }),
  );
}

let cjk: Promise<void> | null = null;
/** Kanji live in separate files, fetched only when Japanese is chosen. */
export function loadCjkFonts(): Promise<void> {
  // Bold has no kanji of its own (it borrows the regular ones), so it has no .cjk file.
  cjk ??= Promise.all(
    (['body', 'small', 'tiny', 'title'] as const).map(async (id) => {
      try {
        const res = await fetch(`./fonts/${id}.cjk.bin`);
        if (!res.ok) return;
        for (const [cp, g] of parse(await res.arrayBuffer()).glyphs) fonts[id].glyphs.set(cp, g);
      } catch {
        // Without the kanji file the game still runs; missing kanji show as "?".
      }
    }),
  ).then(() => cache.clear());
  return cjk;
}

/** Bold has no kana or kanji of its own: borrow the regular ones. */
function glyph(f: BitmapFont, cp: number): Glyph {
  return f.glyphs.get(cp) ?? (f === fonts.bold ? fonts.body.glyphs.get(cp) : undefined) ?? f.glyphs.get(0x3f)!;
}

export function lineHeight(font: FontId = 'body'): number {
  const f = fonts[font];
  return f.ascent + f.descent + 2;
}

export function measure(text: string, font: FontId = 'body', raw = false): number {
  if (!raw) text = tr(text);
  const f = fonts[font];
  let w = 0;
  for (const ch of text) w += glyph(f, ch.codePointAt(0)!).dw;
  return w;
}

const cache = new Map<string, HTMLCanvasElement>();

/** Renders a string into a 1-bit sprite of the given colour. */
function sprite(text: string, font: FontId, color: string): HTMLCanvasElement {
  const key = `${font}|${color}|${text}`;
  let c = cache.get(key);
  if (c) return c;
  const f = fonts[font];
  const w = Math.max(1, measure(text, font, true)) + 2;
  const h = lineHeight(font);
  c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const [r, g, b] = hexToRgb(color);
  let pen = 0;
  for (const ch of text) {
    const gl = glyph(f, ch.codePointAt(0)!);
    const rb = Math.ceil(gl.w / 8);
    const top = 1 + f.ascent - gl.y - gl.h;
    for (let yy = 0; yy < gl.h; yy++)
      for (let xx = 0; xx < gl.w; xx++) {
        if (!(gl.bits[yy * rb + (xx >> 3)] & (0x80 >> (xx & 7)))) continue;
        const px = pen + gl.x + xx;
        const py = top + yy;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const i = (py * w + px) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    pen += gl.dw;
  }
  ctx.putImageData(img, 0, 0);
  if (cache.size > 6000) cache.clear();
  cache.set(key, c);
  return c;
}

export interface TextOpts {
  font?: FontId;
  color?: string;
  shadow?: string;
  outline?: string;
  align?: 'left' | 'center' | 'right';
  /** Truncate with "…" to fit this width. */
  maxWidth?: number;
  /** Text the player typed (names): shown as is, never translated. */
  raw?: boolean;
}

/** Fits text into `maxW` pixels, adding an ellipsis if needed. */
export function fit(text: string, maxW: number, font: FontId = 'body', raw = false): string {
  if (!raw) text = tr(text);
  if (measure(text, font, true) <= maxW) return text;
  let s = text;
  while (s.length > 1 && measure(`${s}…`, font, true) > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

/** Draws pixel text at integer coordinates (top-left of the line box). Returns the width. */
export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: TextOpts = {}): number {
  const font = o.font ?? 'body';
  if (!o.raw) text = tr(text);
  if (o.maxWidth) text = fit(text, o.maxWidth, font, true);
  const color = o.color ?? '#2b2d4a';
  const spr = sprite(text, font, color);
  const w = spr.width - 2;
  let dx = Math.round(x);
  if (o.align === 'center') dx = Math.round(x - w / 2);
  else if (o.align === 'right') dx = Math.round(x - w);
  const dy = Math.round(y) - 1;
  if (o.outline) {
    const out = sprite(text, font, o.outline);
    for (const [ox, oy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      ctx.drawImage(out, dx + ox, dy + oy);
  } else if (o.shadow) ctx.drawImage(sprite(text, font, o.shadow), dx, dy + 1);
  ctx.drawImage(spr, dx, dy);
  return w;
}

/** Characters that may not start a line in Japanese (kinsoku): they stay with the one before. */
const NO_START = new Set('、。，．・：；？！ー」』）】〉》ぁぃぅぇぉっゃゅょァィゥェォッャュョ…'.split(''));

/** Word-wraps text (breaks on spaces, falls back to characters for long Korean or Japanese runs). */
export function wrap(text: string, maxW: number, font: FontId = 'body', raw = false): string[] {
  if (!raw) text = tr(text);
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (measure(test, font, true) <= maxW) {
        line = test;
        continue;
      }
      if (line) out.push(line);
      if (measure(word, font, true) <= maxW) {
        line = word;
        continue;
      }
      line = '';
      for (const ch of word) {
        if (measure(line + ch, font, true) > maxW && !NO_START.has(ch)) {
          out.push(line);
          line = ch;
        } else line += ch;
      }
    }
    out.push(line);
  }
  return out;
}
