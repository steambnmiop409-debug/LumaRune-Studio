import { CATEGORY_LABEL, QUALITY_MULT, RAIN_LABEL, WATER_LABEL, findCrop, getItem, type CropDef } from '@lumina/core';
import { Sprites } from '../art/Sprites';
import { P } from '../art/palette';
import { drawText, measure, wrap } from '../engine/text';
import { formatGold, type UI } from './kit';

/** Draws a 16px icon at an integer 2× scale (pixel-perfect). */
export function icon2x(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number): void {
  ctx.drawImage(img, x, y, img.width * 2, img.height * 2);
}

function tierDots(ctx: CanvasRenderingContext2D, x: number, y: number, tier: number) {
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + i * 6, y, 5, 5);
    ctx.fillStyle = i < tier ? P.brass : P.paperShade;
    ctx.fillRect(x + i * 6 + 1, y + 1, 3, 3);
  }
}

export function seasonSuitability(c: CropDef, meanTemp: number): 'good' | 'ok' | 'bad' {
  const [lo, hi] = c.temp;
  if (meanTemp >= lo && meanTemp <= hi) return 'good';
  if (meanTemp >= lo - 4 && meanTemp <= hi + 4) return 'ok';
  return 'bad';
}

/**
 * The seed-packet card: everything a farmer needs before planting.
 * Returns the height used.
 */
export function seedCard(ui: UI, x: number, y: number, w: number, cropId: string, meanTemp: number, discovered = true): number {
  const c = findCrop(cropId)!;
  const ctx = ui.ctx;
  icon2x(ctx, Sprites.icon(`crop.${c.id}`), x, y);
  drawText(ctx, c.name, x + 38, y, { font: 'bold', maxWidth: w - 80 });
  drawText(ctx, c.nameEn, x + 38, y + 14, { font: 'tiny', color: P.inkSoft, maxWidth: w - 40 });
  tierDots(ctx, x + 38, y + 25, c.tier);
  drawText(ctx, CATEGORY_LABEL[c.category], x + 72, y + 22, { font: 'small', color: P.inkSoft });
  if (!discovered) drawText(ctx, '미수확', x + w - 2, y + 1, { font: 'small', color: P.coralDark, align: 'right' });
  let yy = y + 38;
  const row = (label: string, value: string, iconImg?: HTMLCanvasElement, color: string = P.ink) => {
    if (iconImg) ctx.drawImage(iconImg, x + 1, yy + 1);
    drawText(ctx, label, x + 12, yy, { font: 'small', color: P.inkSoft });
    drawText(ctx, value, x + 52, yy, { font: 'small', color });
    yy += 12;
  };
  ctx.fillStyle = P.paperShade;
  ctx.fillRect(x, yy - 3, w, 1);
  row('기온', `${c.temp[0]}~${c.temp[1]}°C`, Sprites.thermometer());
  row('생장', c.regrowDays ? `${c.growDays}일 (이후 ${c.regrowDays}일마다)` : `${c.growDays}일`);
  // Water drops.
  drawText(ctx, '물', x + 12, yy, { font: 'small', color: P.inkSoft });
  for (let i = 0; i < 3; i++) ctx.drawImage(Sprites.drop(i < c.water), x + 52 + i * 8, yy + 1);
  drawText(ctx, WATER_LABEL[c.water], x + 80, yy, { font: 'small' });
  yy += 12;
  row('비', RAIN_LABEL[c.rainTolerance], Sprites.umbrella(), c.rainTolerance <= 1 ? P.coralDark : c.rainTolerance === 3 ? P.tealDark : P.ink);
  const tags = [c.frostHardy ? '서리에 강함' : '서리에 약함', c.trellis ? '지지대' : '', c.perennial ? '다년생' : '', c.paddy ? '습지' : ''].filter(Boolean);
  row('특성', tags.join(' · '), Sprites.snowflake());
  row('수확', `${c.yield[0] === c.yield[1] ? c.yield[0] : `${c.yield[0]}~${c.yield[1]}`}개`);
  row('판매', `${formatGold(c.sellPrice)} ~ ${formatGold(c.sellPrice * QUALITY_MULT[5])}`, Sprites.coin());
  const suit = seasonSuitability(c, meanTemp);
  const ribbon = suit === 'good' ? ['지금 심기 좋아요', P.tealDark] : suit === 'ok' ? ['조금 느리게 자라요', P.brassDark] : ['지금은 기온이 맞지 않아요', P.coralDark];
  drawText(ctx, ribbon[0], x, yy + 2, { font: 'small', color: ribbon[1] });
  return yy + 14 - y;
}

/** Generic item card (tools, fertilizer, placeables…). Returns height used. */
export function itemCard(ui: UI, x: number, y: number, w: number, itemId: string, q?: number): number {
  const def = getItem(itemId);
  const ctx = ui.ctx;
  if (def.kind === 'seed') return seedCard(ui, x, y, w, def.cropId!, 15);
  icon2x(ctx, Sprites.icon(itemId), x, y);
  drawText(ctx, def.name, x + 38, y + 3, { font: 'bold' });
  drawText(ctx, def.nameEn, x + 38, y + 17, { font: 'small', color: P.inkSoft });
  let yy = y + 38;
  if (def.kind === 'produce') {
    const c = findCrop(def.cropId!)!;
    const quality = q ?? 1;
    for (let i = 0; i < 5; i++) ctx.drawImage(Sprites.star(i < quality, 7), x + i * 9, yy);
    yy += 12;
    drawText(ctx, `기본 판매가 ${formatGold(c.sellPrice * QUALITY_MULT[quality])}`, x, yy, { font: 'small' });
    yy += 12;
    drawText(ctx, '포장대에서 상자에 담아 배로 보내세요.', x, yy, { font: 'small', color: P.inkSoft });
    return yy + 12 - y;
  }
  for (const line of wrap(def.desc, w, 'small')) {
    drawText(ctx, line, x, yy, { font: 'small' });
    yy += 11;
  }
  if (def.price) {
    yy += 2;
    ctx.drawImage(Sprites.coin(), x, yy + 1);
    const sells = def.kind === 'artisan' || def.kind === 'gem' || def.kind === 'forage';
    drawText(ctx, sells ? `판매가 ${formatGold(def.price)}` : formatGold(def.price), x + 12, yy, { font: 'small' });
    yy += 12;
  }
  return yy - y;
}

export function textWidth(s: string): number {
  return measure(s);
}
