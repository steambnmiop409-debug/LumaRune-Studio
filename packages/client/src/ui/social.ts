import { MAX_HEARTS, NPCS, NPC_BY_ID, POINTS_PER_HEART, countItem, getItem, type ClientMessage } from '@lumina/core';
import { Sprites } from '../art/Sprites';
import { P } from '../art/palette';
import { drawText, measure, wrap } from '../engine/text';
import type { ClientWorld } from '../net/ClientWorld';
import { icon2x } from './cards';
import { formatGold, type UI } from './kit';
import type { Panel } from './panels';

const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];

export function heart(ctx: CanvasRenderingContext2D, x: number, y: number, fill: number) {
  // fill: 0 empty, 1 full.
  for (let r = 0; r < HEART.length; r++)
    for (let c = 0; c < 7; c++) {
      if (HEART[r][c] !== '#') continue;
      const edge = r === 0 || c === 0 || c === 6 || HEART[r - 1]?.[c] !== '#' || HEART[r + 1]?.[c] !== '#' || HEART[r][c - 1] !== '#' || HEART[r][c + 1] !== '#';
      ctx.fillStyle = edge ? P.ink : fill ? (r < 2 && c < 3 ? '#ff9ab0' : '#e0485e') : P.paperShade;
      ctx.fillRect(x + c, y + r, 1, 1);
    }
}

export function heartsRow(ctx: CanvasRenderingContext2D, x: number, y: number, points: number) {
  const h = Math.min(MAX_HEARTS, Math.floor(points / POINTS_PER_HEART));
  for (let i = 0; i < MAX_HEARTS; i++) heart(ctx, x + i * 8, y, i < h ? 1 : 0);
}

/** A 2× bust of a villager (head and shoulders from their idle frame). */
function portrait(ctx: CanvasRenderingContext2D, npcId: string, x: number, y: number, blink: boolean) {
  const npc = NPC_BY_ID.get(npcId)!;
  const sheet = Sprites.character(npc.look);
  const img = sheet.frame('down', -1, 'free', blink).img;
  ctx.fillStyle = P.ink;
  ctx.fillRect(x - 1, y - 1, 40, 42);
  ctx.fillStyle = '#bcd8e8';
  ctx.fillRect(x, y, 38, 40);
  ctx.fillStyle = '#a8c8dc';
  ctx.fillRect(x, y + 28, 38, 12);
  ctx.drawImage(img, 0, 0, img.width, 20, x + 19 - img.width, y + 1, img.width * 2, 40);
}

/** Bottom-of-screen dialogue with a typewriter reveal. */
export class DialoguePanel implements Panel {
  closed = false;
  pauses = true;
  private t = 0;
  private lines: string[] = [];

  constructor(
    private world: ClientWorld,
    private npc: string,
    private text: string,
    private gift?: 'loved' | 'liked' | 'neutral' | 'disliked',
  ) {}

  update(dt: number) {
    this.t += dt;
  }

  draw(ui: UI, vw: number, vh: number): void {
    const c = ui.ctx;
    const npc = NPC_BY_ID.get(this.npc)!;
    const W = Math.min(420, vw - 24);
    const H = 70;
    const x = Math.round((vw - W) / 2);
    const y = vh - H - 44;
    ui.panel({ x, y, w: W, h: H });
    portrait(c, this.npc, x + 8, y + 10, this.t % 4 > 3.85);
    drawText(c, npc.name, x + 56, y + 7, { font: 'bold' });
    drawText(c, npc.role, x + 60 + measure(npc.name, 'bold'), y + 9, { font: 'tiny', color: P.inkSoft });
    const pts = this.world.state.npcs[this.npc]?.points ?? 0;
    heartsRow(c, x + W - 90, y + 9, pts);
    if (!this.lines.length) this.lines = wrap(this.text, W - 70, 'body');
    let shown = Math.floor(this.t * 40);
    let yy = y + 24;
    for (const line of this.lines) {
      const part = [...line].slice(0, Math.max(0, shown)).join('');
      shown -= [...line].length;
      drawText(c, part, x + 56, yy);
      yy += 13;
    }
    const done = shown >= 0;
    if (this.gift) {
      const tag = { loved: ['정말 좋아해요!', '#d0405a'], liked: ['좋아해요', P.tealDark], neutral: ['고마워해요', P.inkSoft], disliked: ['별로인 것 같아요…', P.brassDark] }[this.gift];
      drawText(c, tag[0], x + W - 10, y + H - 14, { font: 'small', color: tag[1], align: 'right' });
    } else if (done && Math.floor(this.t * 2) % 2 === 0) drawText(c, '▼', x + W - 14, y + H - 14, { font: 'small', color: P.inkSoft });
    const advance = ui.input.wasPressed('confirm') || ui.input.wasPressed('interact') || ui.input.mousePressed[0];
    if (advance && this.t > 0.15) {
      if (!done) this.t = 99;
      else this.closed = true;
    }
  }
}

type Send = (m: ClientMessage) => void;

/** The plaza notice board: today's request plus everyone you know. */
export class BoardPanel implements Panel {
  closed = false;
  pauses = true;

  constructor(
    private world: ClientWorld,
    private send: Send,
  ) {}

  draw(ui: UI, vw: number, vh: number): void {
    ui.ctx.fillStyle = 'rgba(20,22,48,0.45)';
    ui.ctx.fillRect(0, 0, vw, vh);
    const c = ui.ctx;
    const W = 360;
    const H = 262;
    const x = Math.round((vw - W) / 2);
    const y = Math.round((vh - H) / 2);
    ui.panel({ x, y, w: W, h: H });
    drawText(c, '마을 게시판', x + 12, y + 8, { font: 'title' });
    const req = this.world.state.request;
    // Request card.
    ui.inset({ x: x + 10, y: y + 30, w: W - 20, h: 74 }, '#fffaf0');
    if (!req) drawText(c, '오늘은 붙은 의뢰가 없어요.', x + 20, y + 40, { color: P.inkSoft });
    else {
      const npc = NPC_BY_ID.get(req.npc)!;
      const item = getItem(req.item);
      icon2x(c, Sprites.icon(req.item), x + 18, y + 40);
      drawText(c, `${npc.name}의 부탁`, x + 58, y + 36, { font: 'bold' });
      drawText(c, `${item.name} ${req.qty}개를 가져다 주세요.`, x + 58, y + 50, { font: 'small' });
      const have = countItem(this.world.self.inv, req.item);
      drawText(c, `가진 수량 ${Math.min(have, req.qty)}/${req.qty}`, x + 58, y + 63, { font: 'small', color: have >= req.qty ? P.tealDark : P.coralDark });
      c.drawImage(Sprites.coin(), x + 58, y + 78);
      const rw = drawText(c, `보상 ${formatGold(req.reward)} · 우정`, x + 70, y + 77, { font: 'small' });
      heart(c, x + 74 + rw, y + 79, 1);
      if (req.done) drawText(c, '완료!', x + W - 24, y + 74, { font: 'bold', color: P.tealDark, align: 'right' });
      else if (ui.button({ x: x + W - 96, y: y + 70, w: 80, h: 22 }, '전달하기', { tone: 'brass', disabled: have < req.qty })) {
        this.send({ t: 'deliver' });
        this.closed = true;
      }
    }
    // Villagers.
    drawText(c, '섬 주민', x + 12, y + 110, { font: 'bold' });
    NPCS.forEach((n, i) => {
      const ry = y + 126 + i * 19;
      const f = this.world.state.npcs[n.id];
      const img = Sprites.character(n.look).frame('down', -1).img;
      c.drawImage(img, 0, 1, img.width, 16, x + 14, ry - 1, img.width, 16);
      const nw = drawText(c, n.name, x + 36, ry + 2, { font: 'small' });
      const talked = f?.talked === this.world.clock.day;
      const gifted = f?.gifted === this.world.clock.day;
      const roleEnd = x + W - 100 - (talked || gifted ? 34 : 0);
      drawText(c, n.role, x + 42 + nw, ry + 3, { font: 'tiny', color: P.inkSoft, maxWidth: roleEnd - (x + 42 + nw) });
      heartsRow(c, x + W - 92, ry + 4, f?.points ?? 0);
      if (talked || gifted) drawText(c, gifted ? '선물함' : '대화함', x + W - 98, ry + 3, { font: 'tiny', color: P.tealDark, align: 'right' });
    });
    const hint = wrap('주민에게 말을 걸면(E) 친해지고, 작물·채집물을 들고 사용하면 선물할 수 있어요. 선물은 하루 한 번!', W - 24, 'tiny');
    hint.forEach((l, i) => drawText(c, l, x + 12, y + H - 8 - hint.length * 9 + i * 9, { font: 'tiny', color: P.inkSoft }));
    const r = { x: x + W - 18, y: y + 5, w: 13, h: 13 };
    c.fillStyle = P.ink;
    c.fillRect(r.x, r.y, 13, 13);
    c.fillStyle = ui.hover(r) ? P.coral : P.paperLight;
    c.fillRect(r.x + 1, r.y + 1, 11, 11);
    drawText(c, '×', r.x + 7, r.y + 1, { font: 'small', align: 'center' });
    if (ui.clicked(r)) this.closed = true;
  }
}
