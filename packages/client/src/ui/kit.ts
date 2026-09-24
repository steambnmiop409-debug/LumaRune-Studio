import { formatNumber } from '@lumina/core';
import { getItem, type ItemStack } from '@lumina/core';
import { Sprites } from '../art/Sprites';
import { P, shade } from '../art/palette';
import type { Input } from '../engine/Input';
import { inRect } from '../engine/math';
import { drawText, lineHeight, measure, type FontId } from '../engine/text';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ButtonOpts {
  disabled?: boolean;
  tone?: 'paper' | 'brass' | 'teal' | 'coral';
  font?: FontId;
  icon?: HTMLCanvasElement;
}

/** Immediate-mode UI helpers drawn in the "sailor's journal" style. */
export class UI {
  /** Set by widgets when the pointer is over interactive UI (so the world ignores clicks). */
  hovering = false;
  onClick: (() => void) | null = null;

  constructor(
    public ctx: CanvasRenderingContext2D,
    public input: Input,
  ) {}

  beginFrame(): void {
    this.hovering = false;
  }

  hover(r: Rect): boolean {
    const h = inRect(this.input.mouseX, this.input.mouseY, r);
    if (h) this.hovering = true;
    return h;
  }

  clicked(r: Rect, button = 0): boolean {
    if (this.input.consumed) return false;
    const hit = this.input.mouseReleased[button] && inRect(this.input.mouseX, this.input.mouseY, r);
    if (hit) {
      this.input.consumed = true;
      this.onClick?.();
    }
    return hit;
  }

  panel(r: Rect, tone: 'paper' | 'dark' = 'paper'): void {
    this.ctx.drawImage(Sprites.panel(r.w, r.h, tone), r.x, r.y);
  }

  /** A flat inset box (for lists, text fields). */
  inset(r: Rect, fill: string = P.paperLight): void {
    const c = this.ctx;
    c.fillStyle = shade(P.paperShade, 1);
    c.fillRect(r.x, r.y, r.w, r.h);
    c.fillStyle = fill;
    c.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    c.fillStyle = P.paperShade;
    c.fillRect(r.x + 1, r.y + 1, r.w - 2, 1);
  }

  button(r: Rect, label: string, o: ButtonOpts = {}): boolean {
    const c = this.ctx;
    const hot = !o.disabled && this.hover(r);
    const down = hot && this.input.mouseDown[0];
    const base = o.disabled ? '#cfc2a4' : o.tone === 'brass' ? P.brassLight : o.tone === 'teal' ? '#9fd4c8' : o.tone === 'coral' ? '#f4b8a4' : P.paperLight;
    const y = r.y + (down ? 1 : 0);
    c.fillStyle = P.ink;
    c.fillRect(r.x + 1, r.y, r.w - 2, r.h + 1);
    c.fillRect(r.x, r.y + 1, r.w, r.h - 1);
    c.fillStyle = shade(base, 2);
    c.fillRect(r.x + 1, y + 1, r.w - 2, r.h - 2);
    c.fillStyle = hot ? '#fffaf0' : base;
    c.fillRect(r.x + 1, y + 1, r.w - 2, r.h - (down ? 3 : 4));
    if (hot) {
      c.fillStyle = P.brass;
      c.fillRect(r.x + 2, y + 1, r.w - 4, 1);
    }
    // Longer translations step down a font size before they'd be cut short.
    const room = r.w - 6 - (o.icon ? o.icon.width + 3 : 0);
    let font: FontId = o.font ?? 'body';
    if (measure(label, font) > room && font === 'body') font = 'small';
    if (measure(label, font) > room && font === 'small') font = 'tiny';
    const lw = Math.min(room, measure(label, font));
    let tx = r.x + r.w / 2;
    if (o.icon) {
      const total = o.icon.width + 3 + lw;
      c.drawImage(o.icon, Math.round(r.x + (r.w - total) / 2), Math.round(y + (r.h - 2 - o.icon.height) / 2));
      tx = r.x + (r.w - total) / 2 + o.icon.width + 3 + lw / 2;
    }
    drawText(c, label, tx, y + Math.floor((r.h - 2 - lineHeight(font)) / 2) + 1, { font, color: o.disabled ? '#8a7e68' : P.ink, align: 'center', maxWidth: room });
    return !o.disabled && this.clicked(r);
  }

  /** Small square arrow button (◀ ▶). */
  arrow(x: number, y: number, dir: -1 | 1): boolean {
    const r = { x, y, w: 13, h: 13 };
    const hot = this.hover(r);
    const c = this.ctx;
    c.fillStyle = P.ink;
    c.fillRect(x, y, 13, 13);
    c.fillStyle = hot ? P.brassLight : P.paperLight;
    c.fillRect(x + 1, y + 1, 11, 10);
    c.fillStyle = P.ink;
    for (let i = 0; i < 4; i++) {
      const xx = dir > 0 ? x + 5 + i : x + 8 - i;
      c.fillRect(xx, y + 3 + i, 1, 7 - i * 2);
    }
    return this.clicked(r);
  }

  /** Inventory slot with item icon, quantity, quality stars and can water gauge. */
  slot(x: number, y: number, stack: ItemStack | null, selected: boolean, hotOverride?: boolean): boolean {
    const r = { x, y, w: 22, h: 22 };
    const hot = hotOverride ?? this.hover(r);
    this.ctx.drawImage(Sprites.slot(selected || hot), x, y);
    if (stack) this.item(stack, x + 3, y + 3);
    return hot;
  }

  item(stack: ItemStack, x: number, y: number): void {
    const c = this.ctx;
    c.drawImage(Sprites.icon(stack.id), x, y);
    const def = getItem(stack.id);
    if (stack.q && stack.q > 1) c.drawImage(Sprites.quality(stack.q), x - 2, y + 10);
    if (stack.qty > 1) drawText(c, String(stack.qty), x + 17, y + 9, { font: 'small', color: P.white, outline: P.ink, align: 'right' });
    if (def.tool === 'can') {
      const cap = [0, 20, 40, 70][def.tier ?? 1];
      const w = Math.round(((stack.water ?? 0) / cap) * 14);
      c.fillStyle = P.ink;
      c.fillRect(x + 1, y + 16, 16, 3);
      c.fillStyle = '#4fa3c8';
      c.fillRect(x + 2, y + 17, w, 1);
    }
  }

  /** Tooltip box near the pointer. */
  tooltip(lines: Array<{ text: string; font?: FontId; color?: string }>, x = this.input.mouseX + 12, y = this.input.mouseY + 12): void {
    const c = this.ctx;
    const w = Math.max(...lines.map((l) => measure(l.text, l.font ?? 'body'))) + 12;
    const h = lines.reduce((s, l) => s + lineHeight(l.font ?? 'body'), 0) + 8;
    const vw = c.canvas.width;
    const vh = c.canvas.height;
    const bx = Math.min(x, vw - w - 2);
    const by = Math.min(y, vh - h - 2);
    this.panel({ x: bx, y: by, w, h });
    let yy = by + 4;
    for (const l of lines) {
      drawText(c, l.text, bx + 6, yy, { font: l.font ?? 'body', color: l.color ?? P.ink });
      yy += lineHeight(l.font ?? 'body');
    }
  }

  /** A text field backed by a hidden DOM input (so Korean IME composition works). */
  textField(r: Rect, field: TextField, placeholder: string): void {
    const focused = field.focused;
    this.inset(r, focused ? '#fffaf0' : P.paperLight);
    if (focused) {
      this.ctx.fillStyle = P.brass;
      this.ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
    }
    const value = field.value;
    drawText(this.ctx, value || placeholder, r.x + 4, r.y + Math.floor((r.h - 14) / 2) + 1, { color: value ? P.ink : '#a8987a', raw: !!value, maxWidth: r.w - 8 });
    if (focused && Math.floor(performance.now() / 500) % 2 === 0) {
      this.ctx.fillStyle = P.ink;
      this.ctx.fillRect(r.x + 5 + measure(value, 'body', true), r.y + 3, 1, r.h - 6);
    }
    if (this.clicked(r)) field.focus();
  }
}

/** Hidden DOM input that gives canvas UIs proper IME (Hangul) text entry. */
export class TextField {
  private el: HTMLInputElement;
  focused = false;

  constructor(initial: string, maxLength: number) {
    this.el = document.createElement('input');
    this.el.value = initial;
    this.el.maxLength = maxLength;
    Object.assign(this.el.style, { position: 'fixed', left: '-1000px', top: '0', opacity: '0' });
    document.body.appendChild(this.el);
    this.el.addEventListener('blur', () => (this.focused = false));
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab') this.el.blur();
      e.stopPropagation();
    });
  }

  get value(): string {
    return this.el.value;
  }

  set value(v: string) {
    this.el.value = v;
  }

  focus(): void {
    this.focused = true;
    this.el.focus();
  }

  blur(): void {
    this.el.blur();
  }

  dispose(): void {
    this.el.remove();
  }
}

export function formatGold(n: number): string {
  return `${formatNumber(Math.round(n))}G`;
}
