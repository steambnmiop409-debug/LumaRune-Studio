import { CROPS, generateWorld, randomAppearance, Rng, DEFAULT_APPEARANCE, type Dir } from '@lumina/core';
import { Screen } from '../engine/Screen';
import { Sprites } from '../art/Sprites';
import { loadFonts, drawText } from '../engine/text';

export async function sheet(): Promise<void> {
  await loadFonts();
  const screen = new Screen(document.getElementById('screen') as HTMLCanvasElement);
  document.getElementById('boot')?.remove();
  const ctx = screen.ctx;
  ctx.fillStyle = '#7fb85a';
  ctx.fillRect(0, 0, screen.width, screen.height);
  const map = generateWorld();
  const page = new URLSearchParams(location.search).get('sheet');
  if (page === '1') {
    let x = 4;
    for (const kind of ['oak', 'pine', 'blossom', 'palm'] as const)
      for (let s = 0; s < 4; s++) {
        const t = Sprites.tree(kind, s * 3 + 1, s as 0 | 1 | 2 | 3);
        ctx.drawImage(t.img, x, 4);
        x += t.img.width + 2;
      }
    x = 4;
    let y = 56;
    for (const b of map.buildings) {
      const s = Sprites.building(b);
      if (x + s.img.width > screen.width) break;
      ctx.drawImage(s.img, x, y + 150 - s.img.height);
      x += s.img.width + 4;
    }
    y = 210;
    x = 4;
    const ship = Sprites.ship(9);
    ctx.drawImage(ship.img, x, y);
    x += 204;
    for (const k of ['bench', 'well', 'sign', 'barrel', 'bollard', 'packbench', 'mailbox'] as const) {
      const c = Sprites.prop(k);
      ctx.drawImage(c, x, y);
      x += c.width + 3;
    }
    ctx.drawImage(Sprites.lamp(true), x, y);
    x += 14;
    ctx.drawImage(Sprites.fountain(0), x, y);
    x += 36;
    for (let m = 0; m < 4; m++) {
      ctx.drawImage(Sprites.fence([3, 1, 2, 0][m]), x, y);
      x += 16;
    }
    y = 250;
    x = 210;
    ctx.drawImage(Sprites.bush(1, 1), x, y);
    ctx.drawImage(Sprites.bush(4, 1), x + 20, y);
    ctx.drawImage(Sprites.rock(0), x + 40, y);
    ctx.drawImage(Sprites.rock(3), x + 60, y);
    ctx.drawImage(Sprites.stump(), x + 80, y);
    ctx.drawImage(Sprites.flowers(3, 0), x + 100, y);
    ctx.drawImage(Sprites.reeds(3, 0), x + 120, y);
    for (let m = 0; m < 16; m++) ctx.drawImage(Sprites.soil(m, m % 2 === 0), x + 140 + (m % 8) * 16, y + Math.floor(m / 8) * 16);
    ctx.drawImage(Sprites.sails(1), 560, 210);
  } else if (page === '2') {
    const ids = ['radish', 'carrot', 'lettuce', 'cabbage', 'tomato', 'cucumber', 'strawberry', 'pumpkin', 'watermelon', 'corn', 'wheat', 'rice', 'sunflower', 'tulip', 'basil', 'onion', 'pea', 'chili', 'apple', 'grape'];
    ids.forEach((id, i) => {
      for (let s = 0; s <= 10; s++) ctx.drawImage(Sprites.crop(id, s), 4 + (i % 2) * 318 + s * 28, 2 + Math.floor(i / 2) * 36);
    });
  } else if (page === '3') {
    CROPS.forEach((c, i) => {
      ctx.drawImage(Sprites.icon(`crop.${c.id}`), 4 + (i % 36) * 17, 4 + Math.floor(i / 36) * 17);
      ctx.drawImage(Sprites.icon(`seed.${c.id}`), 4 + (i % 36) * 17, 110 + Math.floor(i / 36) * 17);
    });
    const tools = ['tool.hoe', 'tool.can.1', 'tool.can.2', 'tool.can.3', 'tool.scythe', 'fert.basic', 'fert.quality', 'fert.speed', 'fert.speed2', 'fert.retain', 'tonic', 'place.sprinkler1', 'place.sprinkler2', 'place.sprinkler3', 'place.cover', 'crate', 'upgrade.cart'];
    tools.forEach((t, i) => ctx.drawImage(Sprites.icon(t), 4 + i * 18, 220));
    ctx.drawImage(Sprites.panel(160, 90), 4, 245);
    drawText(ctx, '루미나 아일 — 항해 일지', 14, 256, { font: 'bold' });
    drawText(ctx, '토마토 씨앗 · 18~29°C · 비에 약함', 14, 274);
    drawText(ctx, '작은 글씨 Galmuri9 테스트 123', 14, 292, { font: 'small' });
    drawText(ctx, 'Lumina Isle', 14, 306, { font: 'title', color: '#c89b52' });
    ctx.drawImage(Sprites.slot(false), 180, 250);
    ctx.drawImage(Sprites.slot(true), 204, 250);
    (['clear', 'cloudy', 'rain', 'storm', 'fog', 'snow'] as const).forEach((k, i) => ctx.drawImage(Sprites.weather(k), 232 + i * 16, 254));
    ctx.drawImage(Sprites.coin(), 340, 254);
    ctx.drawImage(Sprites.drop(true), 352, 254);
    ctx.drawImage(Sprites.umbrella(), 362, 254);
    ctx.drawImage(Sprites.star(true, 7), 374, 254);
    ctx.drawImage(Sprites.cursor('#2b2d4a'), 390, 250);
  } else {
    const rng = new Rng(11);
    const dirs: Dir[] = ['down', 'left', 'right', 'up'];
    const looks = [DEFAULT_APPEARANCE, ...Array.from({ length: 5 }, () => randomAppearance(rng))];
    looks[1] = { ...looks[1], hairStyle: 2, top: 3, hat: 0 };
    looks[2] = { ...looks[2], hairStyle: 4, top: 2, hat: 3 };
    looks[3] = { ...looks[3], hairStyle: 3, top: 0, hat: 0 };
    looks[4] = { ...looks[4], hairStyle: 5, top: 1, hat: 2 };
    looks[5] = { ...looks[5], hairStyle: 0, top: 0, hat: 0 };
    looks.forEach((look, n) => {
      const sh = Sprites.character(look);
      const frames = page === '5' ? sh.walk.down.concat(sh.walk.right) : [...dirs.map((d) => sh.idle[d]), sh.breathe.down, sh.raise.down, sh.strike.down, sh.raise.right, sh.strike.right, sh.carry.down[0], sh.carry.right[1], sh.raise.up];
      frames.slice(0, 12).forEach((f, i) => ctx.drawImage(f, 4 + (i % 12) * 36, 2 + n * 66, 32, 64));
    });
  }
  screen.present();
  (window as any).__ready = 1;
}
