import {
  APPEARANCE_OPTIONS,
  DEFAULT_APPEARANCE,
  HAIR_STYLES,
  HATS,
  Rng,
  TOP_STYLES,
  randomAppearance,
  type Appearance,
  type Dir,
  type ServerMessage,
} from '@lumina/core';
import { Sprites } from '../art/Sprites';
import { P } from '../art/palette';
import type { Game } from '../engine/Game';
import type { Scene } from '../engine/Scene';
import { drawText } from '../engine/text';
import type { Connection } from '../net/Connection';
import { TextField } from '../ui/kit';
import { GameScene } from './GameScene';
import { backdrop } from './TitleScene';

const ROWS: Array<[keyof Appearance, string, (v: number) => string]> = [
  ['skin', '피부', (v) => `${v + 1}`],
  ['hairStyle', '헤어', (v) => HAIR_STYLES[v]],
  ['hairColor', '머리색', (v) => `${v + 1}`],
  ['eyes', '눈동자', (v) => `${v + 1}`],
  ['top', '옷', (v) => TOP_STYLES[v]],
  ['topColor', '옷 색', (v) => `${v + 1}`],
  ['bottomColor', '하의 색', (v) => `${v + 1}`],
  ['hat', '모자', (v) => HATS[v]],
];

/** First visit: design your farmer. Large live preview that turns and walks. */
export class CreatorScene implements Scene {
  private game!: Game;
  private look: Appearance = { ...DEFAULT_APPEARANCE };
  private name = new TextField('', 12);
  private farm = new TextField('', 14);
  private t = 0;
  private hop = 0;
  private rng = new Rng(Date.now() >>> 0);
  private sent = false;

  constructor(
    private conn: Connection,
    private slot: number,
  ) {}

  enter(game: Game): void {
    this.game = game;
    this.conn.onMessage = (m: ServerMessage) => {
      if (m.t === 'welcome') game.setScene(new GameScene(this.conn, m.you, m.state));
    };
  }

  exit(): void {
    this.name.dispose();
    this.farm.dispose();
  }

  update(dt: number): void {
    this.t += dt;
    this.hop = Math.max(0, this.hop - dt * 4);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: vw, height: vh } = this.game.screen;
    const ui = this.game.ui;
    backdrop().render(ctx, vw, vh, 1 / 60);
    ctx.fillStyle = 'rgba(20,22,48,0.35)';
    ctx.fillRect(0, 0, vw, vh);
    const W = 420;
    const H = 300;
    const x = Math.round((vw - W) / 2);
    const y = Math.round((vh - H) / 2);
    ui.panel({ x, y, w: W, h: H });
    drawText(ctx, '새로운 섬 주민', x + 14, y + 10, { font: 'title' });
    drawText(ctx, '루미나 섬에 온 걸 환영해요. 어떤 모습으로 시작할까요?', x + 14, y + 30, { font: 'small', color: P.inkSoft });

    // Preview stage.
    const stage = { x: x + 14, y: y + 48, w: 120, h: 190 };
    ctx.fillStyle = '#8cc063';
    ctx.fillRect(stage.x, stage.y, stage.w, stage.h);
    ctx.fillStyle = '#7ab35a';
    for (let i = 0; i < 40; i++) ctx.fillRect(stage.x + ((i * 37) % stage.w), stage.y + ((i * 53) % stage.h), 2, 1);
    ctx.fillStyle = P.ink;
    ctx.strokeStyle = P.ink;
    ctx.strokeRect(stage.x + 0.5, stage.y + 0.5, stage.w - 1, stage.h - 1);
    const dirs: Dir[] = ['down', 'left', 'up', 'right'];
    const dir = dirs[Math.floor(this.t / 1.6) % 4];
    const sheet = Sprites.character(this.look);
    const frame = sheet.walk[dir][Math.floor(this.t * 9) % 6];
    const hopY = Math.round(Math.sin(this.hop * Math.PI) * 8);
    ctx.fillStyle = 'rgba(24,30,64,0.25)';
    ctx.beginPath();
    ctx.ellipse(stage.x + stage.w / 2, stage.y + 168, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(frame, Math.round(stage.x + stage.w / 2 - 32), stage.y + 172 - 128 - hopY, 64, 128);
    if (ui.button({ x: stage.x, y: stage.y + stage.h + 6, w: stage.w, h: 22 }, '무작위', { tone: 'teal' })) {
      this.look = randomAppearance(this.rng);
      this.hop = 1;
    }

    // Fields.
    const fx = x + 150;
    drawText(ctx, '이름', fx, y + 52, { font: 'small', color: P.inkSoft });
    ui.textField({ x: fx + 50, y: y + 48, w: 200, h: 18 }, this.name, '예: 루미');
    drawText(ctx, '농장 이름', fx, y + 74, { font: 'small', color: P.inkSoft });
    ui.textField({ x: fx + 50, y: y + 70, w: 200, h: 18 }, this.farm, '예: 별빛 농장');
    ROWS.forEach(([key, label, fmt], i) => {
      const ry = y + 98 + i * 20;
      drawText(ctx, label, fx, ry + 1, { font: 'small', color: P.inkSoft });
      const max = APPEARANCE_OPTIONS[key];
      if (ui.arrow(fx + 50, ry, -1)) {
        this.look = { ...this.look, [key]: (this.look[key] + max - 1) % max };
        this.hop = 1;
      }
      const v = this.look[key];
      drawText(ctx, fmt(v), fx + 128, ry + 1, { font: 'small', align: 'center' });
      if (key === 'hairColor' || key === 'topColor' || key === 'bottomColor' || key === 'skin' || key === 'eyes') {
        const sw = sheetSwatch(key, v);
        ctx.fillStyle = P.ink;
        ctx.fillRect(fx + 150, ry + 1, 12, 11);
        ctx.fillStyle = sw;
        ctx.fillRect(fx + 151, ry + 2, 10, 9);
      }
      if (ui.arrow(fx + 190, ry, 1)) {
        this.look = { ...this.look, [key]: (v + 1) % max };
        this.hop = 1;
      }
    });
    const ok = this.name.value.trim().length > 0;
    if (ui.button({ x: x + W - 132, y: y + H - 34, w: 118, h: 24 }, '섬에서 시작하기', { tone: 'brass', disabled: !ok || this.sent })) {
      this.sent = true;
      this.conn.send({ t: 'join', slot: this.slot, newGame: { name: this.name.value.trim(), farmName: this.farm.value.trim() || `${this.name.value.trim()}의 농장`, look: this.look } });
    }
    if (!ok) drawText(ctx, '이름을 적어 주세요', x + W - 140, y + H - 28, { font: 'small', color: P.coralDark, align: 'right' });
  }
}

import { BOTTOM_COLORS, CLOTH_COLORS, EYE_COLORS, HAIR_COLORS, SKIN_TONES } from '@lumina/core';
function sheetSwatch(key: keyof Appearance, v: number): string {
  switch (key) {
    case 'hairColor':
      return HAIR_COLORS[v];
    case 'topColor':
      return CLOTH_COLORS[v];
    case 'bottomColor':
      return BOTTOM_COLORS[v];
    case 'skin':
      return SKIN_TONES[v];
    case 'eyes':
      return EYE_COLORS[v];
    default:
      return P.paper;
  }
}
