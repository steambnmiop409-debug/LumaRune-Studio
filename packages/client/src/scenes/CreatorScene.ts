import {
  ACCESSORIES,
  APPEARANCE_OPTIONS,
  BOTTOM_COLORS,
  BOTTOM_STYLES,
  CLOTH_COLORS,
  DEFAULT_APPEARANCE,
  EYE_COLORS,
  EYE_SHAPES,
  HAIR_COLORS,
  HAIR_STYLES,
  HATS,
  Rng,
  SHOE_COLORS,
  SKIN_TONES,
  TOP_STYLES,
  fullAppearance,
  randomAppearance,
  tr,
  type Appearance,
  type Dir,
  type ServerMessage,
} from '@lumina/core';
import { Sprites } from '../art/Sprites';
import { P } from '../art/palette';
import { WALK_FRAMES } from '../art/sprites/character';
import type { Game } from '../engine/Game';
import type { Scene } from '../engine/Scene';
import { drawText } from '../engine/text';
import type { Connection } from '../net/Connection';
import { TextField } from '../ui/kit';
import { GameScene } from './GameScene';
import { backdrop } from './TitleScene';

type Key = keyof Appearance;

/** A row of choices: named styles stepped with arrows, or colours picked from swatches. */
type Row = { key: Key; label: string; names?: readonly string[]; colors?: readonly string[] };

const TABS: Array<{ name: string; rows: Row[] }> = [
  {
    name: '얼굴',
    rows: [
      { key: 'skin', label: '피부', colors: SKIN_TONES },
      { key: 'eyeShape', label: '눈 모양', names: EYE_SHAPES },
      { key: 'eyes', label: '눈동자', colors: EYE_COLORS },
      { key: 'accessory', label: '장신구', names: ACCESSORIES },
    ],
  },
  {
    name: '헤어',
    rows: [
      { key: 'hairStyle', label: '머리 모양', names: HAIR_STYLES },
      { key: 'hairColor', label: '머리색', colors: HAIR_COLORS },
      { key: 'hat', label: '모자', names: HATS },
    ],
  },
  {
    name: '옷차림',
    rows: [
      { key: 'top', label: '상의', names: TOP_STYLES },
      { key: 'topColor', label: '상의 색', colors: CLOTH_COLORS },
      { key: 'bottom', label: '하의', names: BOTTOM_STYLES },
      { key: 'bottomColor', label: '하의 색', colors: BOTTOM_COLORS },
      { key: 'shoes', label: '신발', colors: SHOE_COLORS },
    ],
  },
];

const DIRS: Dir[] = ['down', 'left', 'up', 'right'];

/** First visit: design your farmer. A large live preview that walks, turns on request, and hops on every change. */
export class CreatorScene implements Scene {
  private game!: Game;
  private look: Required<Appearance> = fullAppearance(DEFAULT_APPEARANCE);
  private name = new TextField('', 12);
  private farm = new TextField('', 14);
  private t = 0;
  private hop = 0;
  private tab = 0;
  private facing = 0;
  private walking = true;
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

  private set(key: Key, v: number) {
    this.look = { ...this.look, [key]: v };
    this.hop = 1;
    this.game.audio.play('click', { volume: 0.35, rate: 1.2 });
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: vw, height: vh } = this.game.screen;
    const ui = this.game.ui;
    backdrop().render(ctx, vw, vh, 1 / 60);
    ctx.fillStyle = 'rgba(20,22,48,0.35)';
    ctx.fillRect(0, 0, vw, vh);
    const W = 460;
    const H = 318;
    const x = Math.round((vw - W) / 2);
    const y = Math.round((vh - H) / 2);
    ui.panel({ x, y, w: W, h: H });
    drawText(ctx, '새로운 섬 주민', x + 14, y + 10, { font: 'title' });
    drawText(ctx, '루미나 섬에 온 걸 환영해요. 어떤 모습으로 시작할까요?', x + 14, y + 30, { font: 'small', color: P.inkSoft });

    // Preview stage: a patch of grass, the farmer walking or standing, turn buttons below.
    const stage = { x: x + 14, y: y + 48, w: 132, h: 200 };
    ctx.fillStyle = P.ink;
    ctx.fillRect(stage.x - 1, stage.y - 1, stage.w + 2, stage.h + 2);
    const g = ctx.createLinearGradient(0, stage.y, 0, stage.y + stage.h);
    g.addColorStop(0, '#a8d4e8');
    g.addColorStop(0.55, '#d8ecd0');
    g.addColorStop(0.56, '#8cc063');
    g.addColorStop(1, '#6fa650');
    ctx.fillStyle = g;
    ctx.fillRect(stage.x, stage.y, stage.w, stage.h);
    ctx.fillStyle = '#7ab35a';
    for (let i = 0; i < 46; i++) ctx.fillRect(stage.x + ((i * 37) % stage.w), stage.y + 112 + ((i * 53) % (stage.h - 112)), 2, 1);
    const dir = DIRS[this.facing];
    const sheet = Sprites.character(this.look);
    const frame = sheet.frame(dir, this.walking ? Math.floor(this.t * 13) % WALK_FRAMES : -1, 'free', !this.walking && this.t % 3.2 > 3.05).img;
    const hopY = Math.round(Math.sin(this.hop * Math.PI) * 8);
    ctx.fillStyle = 'rgba(24,30,64,0.28)';
    ctx.beginPath();
    ctx.ellipse(stage.x + stage.w / 2, stage.y + 172, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(frame, Math.round(stage.x + stage.w / 2 - 32), stage.y + 176 - 128 - hopY, 64, 128);
    const by = stage.y + stage.h + 6;
    if (ui.button({ x: stage.x, y: by, w: 24, h: 20 }, '◀')) this.facing = (this.facing + 1) % 4;
    if (ui.button({ x: stage.x + 28, y: by, w: 76, h: 20 }, this.walking ? '멈추기' : '걷기')) this.walking = !this.walking;
    if (ui.button({ x: stage.x + 108, y: by, w: 24, h: 20 }, '▶')) this.facing = (this.facing + 3) % 4;
    if (ui.button({ x: stage.x, y: by + 24, w: stage.w, h: 20 }, '무작위로 꾸미기', { tone: 'teal' })) {
      this.look = fullAppearance(randomAppearance(this.rng));
      this.hop = 1;
    }

    // Names.
    const fx = x + 162;
    const fw = W - 176;
    drawText(ctx, '이름', fx, y + 52, { font: 'small', color: P.inkSoft });
    ui.textField({ x: fx + 58, y: y + 48, w: fw - 58, h: 18 }, this.name, '예: 루미');
    drawText(ctx, '농장 이름', fx, y + 74, { font: 'small', color: P.inkSoft });
    ui.textField({ x: fx + 58, y: y + 70, w: fw - 58, h: 18 }, this.farm, '예: 별빛 농장');

    // Tabs.
    const tw = Math.floor(fw / TABS.length);
    TABS.forEach((t, i) => {
      if (ui.button({ x: fx + i * tw, y: y + 96, w: tw - 3, h: 20 }, t.name, { tone: i === this.tab ? 'brass' : 'paper' }) && i !== this.tab) {
        this.tab = i;
        this.game.audio.play('page', { volume: 0.5 });
      }
    });
    ui.inset({ x: fx, y: y + 120, w: fw, h: 150 });
    TABS[this.tab].rows.forEach((row, i) => this.drawRow(ctx, row, fx + 6, y + 126 + i * 29, fw - 12));

    const ok = this.name.value.trim().length > 0;
    if (ui.button({ x: x + W - 140, y: y + H - 36, w: 126, h: 24 }, '섬에서 시작하기', { tone: 'brass', disabled: !ok || this.sent })) {
      this.sent = true;
      this.conn.send({ t: 'join', slot: this.slot, newGame: { name: this.name.value.trim(), farmName: this.farm.value.trim() || tr('{name}의 농장', { name: this.name.value.trim() }), look: this.look } });
    }
    if (!ok) drawText(ctx, '이름을 적어 주세요', x + W - 148, y + H - 30, { font: 'small', color: P.coralDark, align: 'right' });
  }

  private drawRow(ctx: CanvasRenderingContext2D, row: Row, x: number, y: number, w: number) {
    const ui = this.game.ui;
    const max = APPEARANCE_OPTIONS[row.key];
    const v = this.look[row.key] ?? 0;
    drawText(ctx, row.label, x, y + 2, { font: 'small', color: P.inkSoft });
    if (row.colors) {
      // Swatches: click to pick; the chosen one is framed in brass.
      const n = row.colors.length;
      const size = Math.min(15, Math.floor((w - 60) / n) - 2);
      row.colors.forEach((c, i) => {
        const r = { x: x + 58 + i * (size + 2), y: y, w: size, h: size };
        const hot = ui.hover(r);
        ctx.fillStyle = i === v ? P.brass : hot ? P.brassLight : P.ink;
        ctx.fillRect(r.x - 1, r.y - 1, size + 2, size + 2);
        ctx.fillStyle = c;
        ctx.fillRect(r.x, r.y, size, size);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(r.x, r.y, size, 1);
        if (ui.clicked(r) && i !== v) this.set(row.key, i);
      });
      return;
    }
    if (ui.arrow(x + 58, y, -1)) this.set(row.key, (v + max - 1) % max);
    drawText(ctx, row.names![v] ?? `${v + 1}`, x + 58 + (w - 58) / 2, y + 2, { font: 'body', align: 'center' });
    drawText(ctx, `${v + 1}/${max}`, x + w - 18, y + 16, { font: 'small', color: P.inkSoft, align: 'right' });
    if (ui.arrow(x + w - 13, y, 1)) this.set(row.key, (v + 1) % max);
  }
}
