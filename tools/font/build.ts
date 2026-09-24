/**
 * Converts Galmuri BDF bitmap fonts into compact binary glyph files for the game's
 * pixel text renderer (exact 1-bit glyphs: no anti-aliasing, exact metrics).
 * Run: npx tsx tools/font/build.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = resolve('node_modules/galmuri/dist');
const out = resolve('packages/client/public/fonts');
mkdirSync(out, { recursive: true });
const FONTS = { body: 'Galmuri11', bold: 'Galmuri11-Bold', small: 'Galmuri9', tiny: 'Galmuri7', title: 'Galmuri14' };

/** Kanji / hanja go to a separate <id>.cjk.bin, loaded only when the game is set to Japanese. */
const isCjk = (cp: number) => (cp >= 0x3400 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff);
const keep = (cp: number) => cp < 0x20000;

for (const [id, file] of Object.entries(FONTS)) {
  const text = readFileSync(`${src}/${file}.bdf`, 'utf8');
  const ascent = Number(/FONT_ASCENT (\d+)/.exec(text)![1]);
  const descent = Number(/FONT_DESCENT (\d+)/.exec(text)![1]);
  const parts = { base: { chunks: [] as Buffer[], count: 0 }, cjk: { chunks: [] as Buffer[], count: 0 } };
  for (const block of text.split('STARTCHAR').slice(1)) {
    const cp = Number(/ENCODING (-?\d+)/.exec(block)![1]);
    if (cp < 0 || !keep(cp)) continue;
    const part = isCjk(cp) ? parts.cjk : parts.base;
    const dw = Number(/DWIDTH (\d+)/.exec(block)![1]);
    const [w, h, x, y] = /BBX (-?\d+) (-?\d+) (-?\d+) (-?\d+)/.exec(block)!.slice(1).map(Number);
    const rows = block.split('BITMAP')[1].split('ENDCHAR')[0].trim().split(/\s+/).filter(Boolean);
    const rb = Math.ceil(w / 8);
    const head = Buffer.alloc(9);
    head.writeUInt32LE(cp, 0);
    head.writeUInt8(dw, 4);
    head.writeUInt8(w, 5);
    head.writeUInt8(h, 6);
    head.writeInt8(x, 7);
    head.writeInt8(y, 8);
    const bits = Buffer.alloc(rb * h);
    rows.forEach((r, i) => Buffer.from(r.padEnd(rb * 2, '0').slice(0, rb * 2), 'hex').copy(bits, i * rb));
    part.chunks.push(head, bits);
    part.count++;
  }
  for (const [suffix, part] of [['', parts.base], ['.cjk', parts.cjk]] as const) {
    if (!part.count) continue;
    const header = Buffer.alloc(8);
    header.writeUInt32LE(part.count, 0);
    header.writeUInt8(ascent, 4);
    header.writeUInt8(descent, 5);
    const buf = Buffer.concat([header, ...part.chunks]);
    writeFileSync(`${out}/${id}${suffix}.bin`, buf);
    console.log(`${id}${suffix}`, file, part.count, 'glyphs', (buf.length / 1024).toFixed(0), 'KB');
  }
}
