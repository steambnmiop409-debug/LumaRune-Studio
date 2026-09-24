import { CHEST_SLOTS, INVENTORY_SIZE, RECIPES, countItem, getItem, type ClientMessage, type ItemStack } from '@lumina/core';
import { Sprites } from '../art/Sprites';
import { P } from '../art/palette';
import type { AudioManager } from '../audio/AudioManager';
import { drawText, wrap } from '../engine/text';
import type { ClientWorld } from '../net/ClientWorld';
import { icon2x } from './cards';
import type { UI } from './kit';
import type { Panel } from './panels';

type Send = (m: ClientMessage) => void;

function dim(ui: UI, vw: number, vh: number) {
  ui.ctx.fillStyle = 'rgba(20,22,48,0.45)';
  ui.ctx.fillRect(0, 0, vw, vh);
}

function closeX(ui: UI, x: number, y: number): boolean {
  const r = { x, y, w: 13, h: 13 };
  const c = ui.ctx;
  c.fillStyle = P.ink;
  c.fillRect(x, y, 13, 13);
  c.fillStyle = ui.hover(r) ? P.coral : P.paperLight;
  c.fillRect(x + 1, y + 1, 11, 11);
  drawText(c, '×', x + 7, y + 1, { font: 'small', align: 'center' });
  return ui.clicked(r);
}

/** The workbench: pick a recipe on the left, see what it needs on the right. */
export class CraftPanel implements Panel {
  closed = false;
  pauses = true;
  private sel = 0;
  private flash = 0;

  constructor(
    private world: ClientWorld,
    private send: Send,
    private audio: AudioManager,
  ) {}

  update(dt: number) {
    this.flash = Math.max(0, this.flash - dt);
  }

  /** Called when the server confirms a craft. */
  crafted() {
    this.flash = 0.5;
  }

  private canMake(i: number): boolean {
    const inv = this.world.self.inv;
    return RECIPES[i].needs.every(([id, n]) => countItem(inv, id) >= n);
  }

  draw(ui: UI, vw: number, vh: number): void {
    dim(ui, vw, vh);
    const c = ui.ctx;
    const W = 420;
    const H = 268;
    const x = Math.round((vw - W) / 2);
    const y = Math.round((vh - H) / 2);
    ui.panel({ x, y, w: W, h: H });
    drawText(c, '작업대', x + 12, y + 8, { font: 'title' });
    drawText(c, '재료를 모아 장비를 만들어요. 재료는 채석장·숲·농장에서 얻어요.', x + 12, y + 28, { font: 'small', color: P.inkSoft });
    if (closeX(ui, x + W - 18, y + 5)) this.closed = true;

    // Recipe list.
    const lx = x + 10;
    const ly = y + 44;
    ui.inset({ x: lx, y: ly, w: 176, h: H - 54 }, P.paperLight);
    RECIPES.forEach((r, i) => {
      const ry = ly + 3 + i * 15;
      const rect = { x: lx + 2, y: ry, w: 172, h: 14 };
      const ok = this.canMake(i);
      if (i === this.sel) {
        c.fillStyle = P.brassLight;
        c.fillRect(rect.x, rect.y, rect.w, rect.h);
      } else if (ui.hover(rect)) {
        c.fillStyle = '#efe2c4';
        c.fillRect(rect.x, rect.y, rect.w, rect.h);
      }
      c.drawImage(Sprites.icon(r.out), lx + 3, ry - 1);
      const def = getItem(r.out);
      drawText(c, r.qty > 1 ? `${def.name} ×${r.qty}` : def.name, lx + 22, ry + 2, { font: 'small', color: ok ? P.ink : P.inkSoft, maxWidth: 124 });
      if (ok) drawText(c, '●', lx + 168, ry + 2, { font: 'tiny', color: P.tealDark, align: 'right' });
      if (ui.clicked(rect)) {
        this.sel = i;
        this.audio.play('click', { volume: 0.3 });
      }
    });
    if (ui.input.wasPressed('down')) this.sel = (this.sel + 1) % RECIPES.length;
    if (ui.input.wasPressed('up')) this.sel = (this.sel + RECIPES.length - 1) % RECIPES.length;

    // Detail.
    const r = RECIPES[this.sel];
    const def = getItem(r.out);
    const dx = x + 198;
    const dy = y + 46;
    const dw = W - 210;
    icon2x(c, Sprites.icon(r.out), dx, dy);
    drawText(c, def.name, dx + 40, dy + 2, { font: 'bold', maxWidth: dw - 40 });
    drawText(c, r.note, dx + 40, dy + 17, { font: 'small', color: P.tealDark, maxWidth: dw - 40 });
    let yy = dy + 40;
    for (const line of wrap(def.desc, dw, 'small').slice(0, 4)) {
      drawText(c, line, dx, yy, { font: 'small' });
      yy += 11;
    }
    yy += 6;
    drawText(c, '필요한 재료', dx, yy, { font: 'bold' });
    yy += 16;
    const inv = this.world.self.inv;
    for (const [id, n] of r.needs) {
      const have = countItem(inv, id);
      c.drawImage(Sprites.icon(id), dx, yy - 2);
      drawText(c, getItem(id).name, dx + 20, yy + 1, { font: 'small' });
      drawText(c, `${Math.min(have, 999)}/${n}`, dx + dw, yy + 1, { font: 'small', color: have >= n ? P.tealDark : P.coralDark, align: 'right' });
      yy += 17;
    }
    const ok = this.canMake(this.sel);
    const by = y + H - 32;
    if (this.flash > 0) drawText(c, '만들었어요!', dx, by + 5, { font: 'bold', color: P.tealDark });
    if (ui.button({ x: x + W - 96, y: by, w: 84, h: 22 }, '만들기', { tone: 'brass', disabled: !ok }) || (ok && ui.input.wasPressed('confirm'))) {
      this.send({ t: 'craft', recipe: r.id });
    }
  }
}

/** A chest: click a slot to move that stack to the other side. */
export class ChestPanel implements Panel {
  closed = false;
  pauses = true;

  constructor(
    private world: ClientWorld,
    private id: number,
    private send: Send,
    private audio: AudioManager,
  ) {}

  draw(ui: UI, vw: number, vh: number): void {
    dim(ui, vw, vh);
    const c = ui.ctx;
    const obj = this.world.placed.find((o) => o.id === this.id);
    if (!obj) {
      this.closed = true;
      return;
    }
    const store: Array<ItemStack | null> = obj.store ?? Array.from({ length: CHEST_SLOTS }, () => null);
    const W = 280;
    const H = 232;
    const x = Math.round((vw - W) / 2);
    const y = Math.round((vh - H) / 2);
    ui.panel({ x, y, w: W, h: H });
    drawText(c, '저장 상자', x + 12, y + 8, { font: 'title' });
    drawText(c, '칸을 누르면 반대쪽으로 옮겨요.', x + 12, y + 28, { font: 'small', color: P.inkSoft });
    if (closeX(ui, x + W - 18, y + 5)) this.closed = true;
    let hover: ItemStack | null = null;
    const grid = (items: Array<ItemStack | null>, gx: number, gy: number, cols: number, from: 'inv' | 'chest', count: number) => {
      for (let i = 0; i < count; i++) {
        const sx = gx + (i % cols) * 25;
        const sy = gy + Math.floor(i / cols) * 25;
        const hot = ui.slot(sx, sy, items[i] ?? null, false);
        if (hot && items[i]) hover = items[i];
        if (ui.clicked({ x: sx, y: sy, w: 22, h: 22 }) && items[i]) {
          this.send({ t: 'chest', id: this.id, from, slot: i });
          this.audio.play('click', { volume: 0.35, rate: from === 'inv' ? 0.9 : 1.1 });
        }
      }
    };
    grid(store, x + 16, y + 44, 9, 'chest', CHEST_SLOTS);
    c.fillStyle = P.paperShade;
    c.fillRect(x + 12, y + 97, W - 24, 1);
    drawText(c, '가방', x + 12, y + 101, { font: 'small', color: P.inkSoft });
    grid(this.world.self.inv, x + 16, y + 114, 10, 'inv', INVENTORY_SIZE);
    if (hover) ui.tooltip([{ text: getItem((hover as ItemStack).id).name, font: 'small' }]);
  }
}
