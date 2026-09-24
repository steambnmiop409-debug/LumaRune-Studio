import { generateWorld, type SaveSlotInfo, type ServerMessage } from '@lumina/core';
import { P } from '../art/palette';
import type { Game } from '../engine/Game';
import type { Scene } from '../engine/Scene';
import { drawText } from '../engine/text';
import { connect, type Connection } from '../net/Connection';
import { formatGold } from '../ui/kit';
import { Backdrop } from './backdrop';
import { CreatorScene } from './CreatorScene';
import { GameScene } from './GameScene';

let sharedBackdrop: Backdrop | null = null;
export function backdrop(): Backdrop {
  if (!sharedBackdrop) sharedBackdrop = new Backdrop(generateWorld());
  return sharedBackdrop;
}

/** Title: logo over the harbour at dusk, new game / continue. */
export class TitleScene implements Scene {
  private game!: Game;
  private conn: Connection | null = null;
  private slots: Array<SaveSlotInfo | null> | null = null;
  private mode: 'menu' | 'load' = 'menu';
  private t = 0;
  private joining = false;

  enter(game: Game): void {
    this.game = game;
    this.conn = connect();
    this.conn.onMessage = (m) => this.onMessage(m);
    this.conn.send({ t: 'listSaves' });
    game.audio.playMusic('title');
  }

  private onMessage(m: ServerMessage) {
    if (m.t === 'saves') this.slots = m.slots;
    else if (m.t === 'welcome' && this.conn) {
      const conn = this.conn;
      this.conn = null;
      this.game.setScene(new GameScene(conn, m.you, m.state));
    } else if (m.t === 'needCharacter' && this.conn) {
      const conn = this.conn;
      this.conn = null;
      this.game.setScene(new CreatorScene(conn, m.slot));
    }
  }

  exit(): void {
    this.conn?.close();
  }

  update(dt: number): void {
    this.t += dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: vw, height: vh } = this.game.screen;
    backdrop().render(ctx, vw, vh, 1 / 60);
    const ui = this.game.ui;
    // Logo over a soft dusk vignette for legibility.
    const ly = Math.round(vh * 0.2);
    ctx.globalAlpha = Math.min(1, this.t / 1.5);
    const band = ctx.createLinearGradient(0, ly - 30, 0, ly + 90);
    band.addColorStop(0, 'rgba(20,22,48,0)');
    band.addColorStop(0.35, 'rgba(20,22,48,0.5)');
    band.addColorStop(0.7, 'rgba(20,22,48,0.5)');
    band.addColorStop(1, 'rgba(20,22,48,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, ly - 30, vw, 120);
    drawBigTitle(ctx, '루미나 아일', vw / 2, ly);
    drawText(ctx, 'LUMINA ISLE', vw / 2, ly + 36, { font: 'bold', color: P.brassLight, outline: P.ink, align: 'center' });
    drawText(ctx, '등대 불빛 아래, 작은 섬의 농장 이야기', vw / 2, ly + 52, { font: 'small', color: P.paperLight, outline: P.ink, align: 'center' });
    ctx.globalAlpha = 1;
    if (this.t < 0.8 || this.joining) return;

    const bw = 150;
    const bx = Math.round(vw / 2 - bw / 2);
    let by = Math.round(vh * 0.55);
    const saves = (this.slots ?? []).filter((s): s is SaveSlotInfo => !!s);
    if (this.mode === 'menu') {
      if (saves.length && ui.button({ x: bx, y: by, w: bw, h: 24 }, '이어하기', { tone: 'brass' })) this.mode = 'load';
      if (saves.length) by += 30;
      if (ui.button({ x: bx, y: by, w: bw, h: 24 }, '새로운 섬 생활', { tone: saves.length ? 'paper' : 'brass' })) {
        const empty = (this.slots ?? [null, null, null]).findIndex((s) => !s);
        this.join(empty >= 0 ? empty : 0, true);
      }
      by += 30;
    } else {
      for (const s of saves) {
        const label = `${s.farmName} · ${s.name} · ${s.day + 1}일차 · ${formatGold(s.gold)}`;
        if (ui.button({ x: bx - 60, y: by, w: bw + 120, h: 24 }, label)) this.join(s.slot, false);
        by += 28;
      }
      if (ui.button({ x: bx, y: by + 4, w: bw, h: 22 }, '뒤로')) this.mode = 'menu';
    }
    drawText(ctx, 'v0.1 · LumaRune Studio', vw - 6, vh - 14, { font: 'small', color: P.paperLight, outline: P.ink, align: 'right' });
  }

  private join(slot: number, fresh: boolean) {
    if (!this.conn) return;
    this.joining = true;
    if (fresh) {
      const conn = this.conn;
      this.conn = null;
      this.game.setScene(new CreatorScene(conn, slot));
    } else this.conn.send({ t: 'join', slot });
  }
}

/** The logo: Galmuri14 rendered at an exact 2× with a brass shadow. */
export function drawBigTitle(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number): void {
  const c = document.createElement('canvas');
  const cctx = c.getContext('2d')!;
  cctx.font = '15px Galmuri14';
  const w = Math.ceil(cctx.measureText(text).width) + 4;
  c.width = w;
  c.height = 22;
  drawText(cctx, text, 1, 2, { font: 'title', color: P.paperLight, outline: P.ink });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, Math.round(cx - w), y, w * 2, 44);
}
