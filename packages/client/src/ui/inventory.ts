import { HOTBAR_SIZE, INVENTORY_SIZE, getItem, sameStack, swapSlots, type ClientMessage, type ItemStack } from '@lumina/core';
import { Sprites } from '../art/Sprites';
import { P, shade } from '../art/palette';
import type { AudioManager } from '../audio/AudioManager';
import { drawText } from '../engine/text';
import type { ClientWorld } from '../net/ClientWorld';
import { actorFrame, drawActor } from '../render/actors';
import { itemCard } from './cards';
import { formatGold, type UI } from './kit';
import type { Panel } from './panels';

const SLOT = 24;
const COLS = 10;

interface Drag {
  from: number;
  stack: ItemStack;
  /** Only part of the stack (a right-click split). */
  part: boolean;
}

/**
 * The bag (E): the hotbar row and two rows of backpack. Drag a stack to move or swap it; right-drag
 * carries half; Shift+click jumps between hotbar and backpack; hovering a slot and pressing 1–0 puts
 * it on that hotbar key. Your farmer stands beside it, holding whatever is selected.
 */
export class InventoryPanel implements Panel {
  closed = false;
  pauses = true;
  private drag: Drag | null = null;
  private hovered = -1;
  private time = 0;

  constructor(
    private world: ClientWorld,
    private send: (m: ClientMessage) => void,
    private audio: AudioManager,
  ) {
    audio.play('page', { volume: 0.5 });
  }

  update(dt: number): void {
    this.time += dt;
  }

  private slotAt(mx: number, my: number, gx: number, gy: number): number {
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const [sx, sy] = this.slotPos(i, gx, gy);
      if (mx >= sx && mx < sx + SLOT - 2 && my >= sy && my < sy + SLOT - 2) return i;
    }
    return -1;
  }

  private slotPos(i: number, gx: number, gy: number): [number, number] {
    const row = Math.floor(i / COLS);
    // Room for the "배낭" label between the hotbar and the backpack rows.
    return [gx + (i % COLS) * SLOT, gy + row * SLOT + (row > 0 ? 14 : 0)];
  }

  /** Swaps locally at once (the server confirms a moment later). */
  private swap(a: number, b: number) {
    if (a === b) return;
    swapSlots(this.world.self.inv, a, b);
    this.send({ t: 'swap', a, b });
    this.audio.play('drop', { volume: 0.6 });
  }

  private split(from: number, to: number, qty: number) {
    this.send({ t: 'split', from, to, qty });
    this.audio.play('drop', { volume: 0.6 });
  }

  draw(ui: UI, vw: number, vh: number): void {
    const c = ui.ctx;
    const inv = this.world.self.inv;
    c.fillStyle = 'rgba(20,22,48,0.45)';
    c.fillRect(0, 0, vw, vh);
    const gridW = COLS * SLOT - 2;
    const W = gridW + 24 + 150;
    const H = 226;
    const x = Math.round((vw - W) / 2);
    const y = Math.round((vh - H) / 2);
    ui.panel({ x, y, w: W, h: H });
    drawText(c, '가방', x + 12, y + 8, { font: 'title' });
    const goldW = drawText(c, formatGold(this.world.gold), x + gridW + 8, y + 12, { font: 'bold', align: 'right' });
    c.drawImage(Sprites.coin(), x + gridW + 8 - goldW - 14, y + 11);
    if (ui.button({ x: x + gridW + 24 - 2, y: y + 8, w: 60, h: 18 }, '정리', { font: 'small' })) {
      this.send({ t: 'sort' });
      this.audio.play('page', { volume: 0.4, rate: 1.2 });
    }

    // Slots.
    const gx = x + 12;
    const gy = y + 44;
    drawText(c, '핫바', gx, gy - 12, { font: 'small', color: P.inkSoft });
    drawText(c, '배낭', gx, gy + SLOT, { font: 'small', color: P.inkSoft });
    const mx = ui.input.mouseX;
    const my = ui.input.mouseY;
    this.hovered = this.slotAt(mx, my, gx, gy);
    if (this.hovered >= 0) ui.hovering = true;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const [sx, sy] = this.slotPos(i, gx, gy);
      const dragging = this.drag?.from === i;
      const st = inv[i];
      ui.slot(sx, sy, dragging && !this.drag!.part ? null : st, i === this.world.self.sel, this.hovered === i);
      if (dragging && this.drag!.part && st) {
        // What stays behind while half is being carried.
        const left = st.qty - this.drag!.stack.qty;
        c.fillStyle = 'rgba(251,241,220,0.55)';
        c.fillRect(sx + 1, sy + 1, SLOT - 4, SLOT - 4);
        drawText(c, String(left), sx + SLOT - 4, sy + SLOT - 12, { font: 'small', color: P.ink, align: 'right' });
      }
      if (i < HOTBAR_SIZE) drawText(c, String((i + 1) % 10), sx + 2, sy + 1, { font: 'small', color: P.inkSoft });
    }

    this.handleInput(ui);

    // Right: the farmer holding the selected item, and the card of what's under the cursor.
    const rx = x + gridW + 24;
    const stage = { x: rx, y: y + 32, w: W - gridW - 36, h: 3 * SLOT + 24 };
    c.fillStyle = shade(P.paperShade, 1);
    c.fillRect(stage.x, stage.y, stage.w, stage.h);
    c.fillStyle = '#a9d68a';
    c.fillRect(stage.x + 1, stage.y + 1, stage.w - 2, stage.h - 2);
    c.fillStyle = '#95c776';
    c.fillRect(stage.x + 1, stage.y + stage.h - 20, stage.w - 2, 19);
    const self = this.world.self;
    const pl = {
      id: self.id,
      look: self.look,
      x: 0,
      y: 0,
      dir: (['down', 'right', 'down', 'left'] as const)[Math.floor(this.time / 2.4) % 4],
      moving: Math.floor(this.time / 1.2) % 2 === 1,
      animT: this.time,
      carrying: 0,
      held: inv[self.sel]?.id ?? null,
    };
    const f = actorFrame(pl, this.time);
    // Draw the 16×32 figure at 2× through a scratch canvas so held items scale with it.
    const tmp = scratch();
    const tctx = tmp.getContext('2d')!;
    tctx.clearRect(0, 0, tmp.width, tmp.height);
    drawActor(tctx, pl, f, 16, 16);
    c.fillStyle = 'rgba(24,30,64,0.25)';
    c.fillRect(stage.x + stage.w / 2 - 12, stage.y + stage.h - 12, 24, 3);
    c.drawImage(tmp, 0, 0, 48, 64, Math.round(stage.x + stage.w / 2 - 48), stage.y + stage.h - 128 - 8 + 32, 96, 128);

    const show = this.drag ? this.drag.stack : this.hovered >= 0 ? inv[this.hovered] : inv[self.sel];
    const cardY = stage.y + stage.h + 6;
    ui.inset({ x: x + 12, y: cardY, w: W - 24, h: H - (cardY - y) - 30 });
    if (show) itemCard(ui, x + 18, cardY + 5, W - 36, show.id, show.q);
    else drawText(c, '빈 칸', x + 18, cardY + 6, { color: P.inkSoft });
    drawText(c, '끌어서 옮기기 · 우클릭으로 끌면 절반만', x + W / 2, y + H - 26, { font: 'small', color: P.inkSoft, align: 'center' });
    drawText(c, 'Shift+클릭: 핫바↔배낭 · 칸 위에서 1~0: 그 핫바 칸으로', x + W / 2, y + H - 15, { font: 'small', color: P.inkSoft, align: 'center' });

    // The stack being dragged follows the pointer.
    if (this.drag) {
      ui.item(this.drag.stack, mx - 8, my - 8);
      if (this.drag.part) drawText(c, '½', mx + 6, my - 12, { font: 'small', color: P.coralDark });
    }
  }

  private handleInput(ui: UI) {
    const input = ui.input;
    const inv = this.world.self.inv;
    const h = this.hovered;
    // Hover + 1..0: put this stack on that hotbar key.
    if (h >= 0 && !this.drag)
      for (let k = 0; k < HOTBAR_SIZE; k++)
        if (input.keyPressed(`Digit${(k + 1) % 10}`)) {
          this.swap(h, k);
          input.consumed = true;
        }
    if (!this.drag) {
      if (h >= 0 && inv[h] && input.mousePressed[0]) {
        const st = inv[h]!;
        if (input.isDown('run')) {
          // Shift+click: jump between hotbar and backpack.
          const range = h < HOTBAR_SIZE ? [HOTBAR_SIZE, INVENTORY_SIZE] : [0, HOTBAR_SIZE];
          let to = -1;
          for (let i = range[0]; i < range[1] && to < 0; i++) if (inv[i] && sameStack(inv[i]!, st.id, st.q) && inv[i]!.qty < getItem(st.id).maxStack) to = i;
          for (let i = range[0]; i < range[1] && to < 0; i++) if (!inv[i]) to = i;
          if (to >= 0) this.swap(h, to);
        } else {
          this.drag = { from: h, stack: st, part: false };
          this.audio.play('slot', { volume: 0.6 });
        }
        input.consumed = true;
      } else if (h >= 0 && inv[h] && input.mousePressed[2] && inv[h]!.qty > 1) {
        const st = inv[h]!;
        this.drag = { from: h, stack: { ...st, qty: Math.ceil(st.qty / 2) }, part: true };
        this.audio.play('slot', { volume: 0.6, rate: 1.15 });
        input.consumed = true;
      } else if (h >= 0 && h < HOTBAR_SIZE && input.mousePressed[0] && !inv[h]) {
        // Clicking an empty hotbar slot just selects it.
        this.send({ t: 'select', slot: h });
        this.world.self.sel = h;
      }
      return;
    }
    const released = this.drag.part ? input.mouseReleased[2] || input.mouseReleased[0] : input.mouseReleased[0];
    if (!released) return;
    const d = this.drag;
    this.drag = null;
    input.consumed = true;
    if (h < 0 || h === d.from) return;
    if (d.part) {
      const dst = inv[h];
      if (!dst || sameStack(dst, d.stack.id, d.stack.q)) this.split(d.from, h, d.stack.qty);
      else this.audio.play('error', { volume: 0.3 });
    } else this.swap(d.from, h);
  }
}

let tmpCanvas: HTMLCanvasElement | null = null;
function scratch(): HTMLCanvasElement {
  if (!tmpCanvas) {
    tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = 48;
    tmpCanvas.height = 64;
  }
  return tmpCanvas;
}
