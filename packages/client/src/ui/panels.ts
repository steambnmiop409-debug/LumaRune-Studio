import {
  cargoItemId,
  CATEGORY_LABEL,
  CART_CAPACITY,
  CRATE_CAPACITY,
  CROPS,
  SHOPS,
  TILE,
  WEATHER_NAME,
  ZONE_NAME,
  countItem,
  findCrop,
  formatDate,
  getItem,
  getCrop,
  unitPrice,
  GREENHOUSE_COST,
  type ClientMessage,
  type CropCategory,
  type DaySummary,
  type ShopId,
  allNpcPoses,
  isReady,
  MAX_HEARTS,
  MINE_DEPTH,
  NPCS,
  NPC_BY_ID,
  POINTS_PER_HEART,
  SHIP_DEPARTURE,
  WATER_THRESHOLD,
  type Appearance,
} from '@lumina/core';
import { Sprites } from '../art/Sprites';
import { WALK_FRAMES } from '../art/sprites/character';
import { P, shade } from '../art/palette';
import type { AudioManager } from '../audio/AudioManager';
import { drawText, measure, wrap } from '../engine/text';
import type { ClientWorld } from '../net/ClientWorld';
import { icon2x, itemCard, seedCard } from './cards';
import { heartsRow } from './social';
import { formatGold, type UI } from './kit';

export interface Panel {
  closed: boolean;
  /** Single-player time pauses while this is open. */
  pauses: boolean;
  update?(dt: number): void;
  draw(ui: UI, vw: number, vh: number): void;
}

type Send = (m: ClientMessage) => void;

function closeButton(ui: UI, x: number, y: number): boolean {
  const r = { x, y, w: 13, h: 13 };
  const hot = ui.hover(r);
  const c = ui.ctx;
  c.fillStyle = P.ink;
  c.fillRect(x, y, 13, 13);
  c.fillStyle = hot ? P.coral : P.paperLight;
  c.fillRect(x + 1, y + 1, 11, 11);
  c.fillStyle = P.ink;
  for (let i = 0; i < 7; i++) {
    c.fillRect(x + 3 + i, y + 3 + i, 1, 1);
    c.fillRect(x + 9 - i, y + 3 + i, 1, 1);
  }
  return ui.clicked(r);
}

function dimBackground(ui: UI, vw: number, vh: number, a = 0.45) {
  ui.ctx.fillStyle = `rgba(20,22,48,${a})`;
  ui.ctx.fillRect(0, 0, vw, vh);
}

// ───────────────────────────── Journal ─────────────────────────────

type JournalTab = 'island' | 'people' | 'dex' | 'log';
const TABS: Array<[JournalTab, string, string]> = [
  ['island', '나의 섬', '#c8704a'],
  ['people', '주민', '#9a78b0'],
  ['dex', '도감', '#5a9a6a'],
  ['log', '출하', '#4f7ab0'],
];
const CATS: Array<CropCategory | 'all'> = ['all', 'leafy', 'root', 'bulb', 'fruitveg', 'legume', 'grain', 'special', 'herb', 'flower', 'fruit'];

type Page = { lx: number; rx: number; py: number; pw: number; ph: number };

/** A labelled progress bar on a journal page. */
function progress(ui: UI, x: number, y: number, w: number, label: string, value: string, f: number, color: string = P.teal) {
  const c = ui.ctx;
  drawText(c, label, x, y, { font: 'small' });
  drawText(c, value, x + w, y, { font: 'small', color: P.inkSoft, align: 'right' });
  const r = { x, y: y + 12, w, h: 6 };
  c.fillStyle = P.ink;
  c.fillRect(r.x, r.y, r.w, r.h);
  c.fillStyle = P.paperShade;
  c.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  const fw = Math.round((r.w - 2) * Math.max(0, Math.min(1, f)));
  c.fillStyle = color;
  c.fillRect(r.x + 1, r.y + 1, fw, r.h - 2);
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.fillRect(r.x + 1, r.y + 1, fw, 1);
}

function rule(ui: UI, x: number, y: number, w: number) {
  ui.ctx.fillStyle = P.paperShade;
  ui.ctx.fillRect(x, y, w, 1);
}

/** A small painted backdrop (sky and grass) with a character standing on it at 2×. */
function stage(ui: UI, x: number, y: number, w: number, h: number, img: HTMLCanvasElement) {
  const c = ui.ctx;
  c.fillStyle = P.ink;
  c.fillRect(x - 1, y - 1, w + 2, h + 2);
  c.fillStyle = '#bcd8e8';
  c.fillRect(x, y, w, h);
  c.fillStyle = '#95c776';
  c.fillRect(x, y + h - 18, w, 18);
  c.fillStyle = '#7ab35a';
  for (let i = 0; i < 9; i++) c.fillRect(x + ((i * 23) % (w - 2)) + 1, y + h - 16 + ((i * 7) % 14), 2, 1);
  c.fillStyle = 'rgba(24,30,64,0.25)';
  c.fillRect(x + w / 2 - 10, y + h - 9, 20, 3);
  c.drawImage(img, Math.round(x + w / 2 - img.width), y + h - 8 - img.height * 2, img.width * 2, img.height * 2);
}

export class JournalPanel implements Panel {
  closed = false;
  pauses = true;
  tab: JournalTab;
  private who = 0;
  private dexCat: CropCategory | 'all' = 'all';
  private dexPage = 0;
  private dexSel: string | null = null;
  private logSel = 0;
  private time = 0;

  constructor(
    private world: ClientWorld,
    private send: Send,
    private audio: AudioManager,
    tab: JournalTab = 'island',
  ) {
    this.tab = tab;
  }

  update(dt: number): void {
    this.time += dt;
  }

  draw(ui: UI, vw: number, vh: number): void {
    dimBackground(ui, vw, vh);
    const W = 460;
    const H = 272;
    const x = Math.round((vw - W) / 2);
    const y = Math.round((vh - H) / 2);
    const c = ui.ctx;
    // Leather cover.
    c.fillStyle = P.ink;
    c.fillRect(x - 1, y - 1, W + 2, H + 2);
    c.fillStyle = '#5a3a2e';
    c.fillRect(x, y, W, H);
    c.fillStyle = '#6e4a3a';
    c.fillRect(x + 2, y + 2, W - 4, H - 4);
    // Pages.
    const pw = (W - 20) / 2;
    const lx = x + 8;
    const rx = x + 12 + pw;
    const py = y + 8;
    const ph = H - 16;
    for (const px of [lx, rx]) {
      c.fillStyle = P.paper;
      c.fillRect(px, py, pw, ph);
      c.fillStyle = P.paperShade;
      c.fillRect(px, py + ph - 2, pw, 2);
    }
    c.fillStyle = shade(P.paperShade, 1);
    c.fillRect(lx + pw - 2, py, 2, ph);
    c.fillRect(rx, py, 2, ph);
    // Bookmark tabs along the top edge.
    let tx = x + 14;
    TABS.forEach(([id, label, color]) => {
      const tw = measure(label, 'small') + 16;
      const active = this.tab === id;
      const r = { x: tx, y: y - (active ? 17 : 14), w: tw, h: active ? 18 : 15 };
      const hot = ui.hover(r);
      c.fillStyle = P.ink;
      c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 1);
      c.fillStyle = active ? color : hot ? shade(color, 0) : shade(color, 1);
      c.fillRect(r.x, r.y, r.w, r.h);
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.fillRect(r.x, r.y, r.w, 1);
      drawText(c, label, r.x + r.w / 2, r.y + 3, { font: 'small', color: P.paperLight, align: 'center' });
      if (ui.clicked(r) && !active) {
        this.tab = id;
        this.audio.play('page', { volume: 0.5 });
      }
      tx += tw + 3;
    });
    drawText(c, 'A/D: 넘기기', x + W - 20, y - 12, { font: 'small', color: P.paperLight, outline: P.ink, align: 'right' });
    const order = TABS.map((t) => t[0]);
    const k = ui.input;
    const step = k.keyPressed('KeyA') || k.keyPressed('ArrowLeft') ? -1 : k.keyPressed('KeyD') || k.keyPressed('ArrowRight') ? 1 : 0;
    if (step) {
      this.tab = order[(order.indexOf(this.tab) + step + order.length) % order.length];
      this.audio.play('page', { volume: 0.5 });
    }
    if (closeButton(ui, x + W - 16, y - 6)) this.closed = true;

    const page = { lx, rx, py, pw, ph };
    if (this.tab === 'island') this.drawIsland(ui, page);
    else if (this.tab === 'people') this.drawPeople(ui, page);
    else if (this.tab === 'dex') this.drawDex(ui, page);
    else this.drawLog(ui, page);
  }

  /** Left: you, your farm and how far you've come. Right: today — weather, the ship, the board and the fields. */
  private drawIsland(ui: UI, { lx, rx, py, pw }: Page) {
    const c = ui.ctx;
    const w = this.world;
    const p = w.self;
    drawText(c, '나의 섬', lx + 10, py + 6, { font: 'bold' });
    drawText(c, `섬 생활 ${w.clock.day + 1}일째`, lx + pw - 10, py + 8, { font: 'small', color: P.inkSoft, align: 'right' });
    const dir = (['down', 'left', 'down', 'right'] as const)[Math.floor(this.time / 2.4) % 4];
    const walking = Math.floor(this.time / 1.2) % 2 === 1;
    stage(ui, lx + 10, py + 24, 56, 76, Sprites.character(p.look).frame(dir, walking ? Math.floor(this.time * 13) % WALK_FRAMES : -1, 'free', !walking && this.time % 3.2 > 3.05).img);
    const tx = lx + 76;
    drawText(c, p.name, tx, py + 26, { font: 'bold' });
    drawText(c, p.farmName, tx, py + 40, { font: 'small', color: P.inkSoft });
    c.drawImage(Sprites.coin(), tx, py + 58);
    drawText(c, formatGold(w.gold), tx + 12, py + 56, { font: 'bold' });
    drawText(c, `누적 출하 ${formatGold(w.lifetime)}`, tx, py + 72, { font: 'small', color: P.inkSoft });
    const crates = countItem(p.inv, 'crate');
    drawText(c, `빈 상자 ${crates}개 · 손수레 ${p.cart ? '있음' : '없음'}`, tx, py + 86, { font: 'small', color: P.inkSoft });

    let y = py + 110;
    rule(ui, lx + 10, y, pw - 20);
    y += 6;
    drawText(c, '진행도', lx + 10, y, { font: 'small', color: P.inkSoft });
    y += 14;
    const bw = pw - 20;
    progress(ui, lx + 10, y, bw, '작물 도감', `${w.discovered.size} / ${CROPS.length}`, w.discovered.size / CROPS.length, '#5a9a6a');
    y += 24;
    const deepest = w.state.mine.deepest;
    progress(ui, lx + 10, y, bw, '광산 탐사', `${deepest} / ${MINE_DEPTH}층`, deepest / MINE_DEPTH, '#8a7a9a');
    y += 24;
    const love = NPCS.reduce((n, d) => n + Math.min(MAX_HEARTS, Math.floor((w.state.npcs[d.id]?.points ?? 0) / POINTS_PER_HEART)), 0);
    progress(ui, lx + 10, y, bw, '주민과의 우정', `♥ ${love} / ${NPCS.length * MAX_HEARTS}`, love / (NPCS.length * MAX_HEARTS), '#e0485e');
    y += 24;
    progress(ui, lx + 10, y, bw, '온실', w.state.greenhouse ? '복구 완료' : `복구 전 · ${formatGold(GREENHOUSE_COST.gold)}`, w.state.greenhouse ? 1 : 0, P.brass);

    // Right page: today.
    const x = rx + 12;
    const cw = pw - 24;
    drawText(c, '오늘', x, py + 6, { font: 'bold' });
    drawText(c, formatDate(w.clock.day), x + cw, py + 8, { font: 'small', color: P.inkSoft, align: 'right' });
    y = py + 24;
    drawText(c, `${WEATHER_NAME[w.weather.kind]} · 평균 ${Math.round(w.weather.meanTemp)}°C`, x, y, { font: 'small' });
    drawText(c, `내일 ${WEATHER_NAME[w.forecast.kind]}`, x + cw, y, { font: 'small', color: P.inkSoft, align: 'right' });
    y += 13;
    const now = w.minute(true);
    const ship = w.shipPresent
      ? now < SHIP_DEPARTURE
        ? `화물선 정박 중 · ${Math.floor(SHIP_DEPARTURE / 60)}:00 출항`
        : '화물선 출항 준비 중'
      : '화물선은 떠났어요 · 내일 아침 입항';
    drawText(c, ship, x, y, { font: 'small', color: w.shipPresent ? P.tealDark : P.inkSoft });
    y += 17;
    rule(ui, x, y, cw);
    y += 6;

    // The fields at a glance.
    let crops = 0;
    let ready = 0;
    let thirsty = 0;
    for (const soil of Object.values(w.soil)) {
      const cr = soil.crop;
      if (!cr || cr.dead) continue;
      crops++;
      if (isReady(cr)) ready++;
      else if (!cr.dormant && soil.dayMax < WATER_THRESHOLD[getCrop(cr.id).water]) thirsty++;
    }
    drawText(c, '밭', x, y, { font: 'small', color: P.inkSoft });
    y += 13;
    if (!crops) {
      drawText(c, '심은 작물이 없어요.', x, y, { font: 'small', color: P.inkSoft });
      y += 12;
      drawText(c, '씨앗방에서 씨앗을 사 보세요.', x, y, { font: 'small', color: P.inkSoft });
      y += 12;
    } else {
      drawText(c, `자라는 작물 ${crops}그루`, x, y, { font: 'small' });
      y += 12;
      drawText(c, ready ? `수확할 수 있어요: ${ready}` : '수확할 작물은 아직 없어요', x, y, { font: 'small', color: ready ? P.tealDark : P.inkSoft });
      y += 12;
      drawText(c, thirsty ? `목마른 작물: ${thirsty}` : '물은 넉넉해요', x, y, { font: 'small', color: thirsty ? P.coralDark : P.inkSoft });
    }
    y += 18;
    rule(ui, x, y, cw);
    y += 6;

    // The board's request.
    drawText(c, '게시판 의뢰', x, y, { font: 'small', color: P.inkSoft });
    y += 13;
    const req = w.state.request;
    if (!req) drawText(c, '오늘은 올라온 의뢰가 없어요.', x, y, { font: 'small', color: P.inkSoft });
    else {
      const def = getItem(req.item);
      c.fillStyle = P.paperLight;
      c.fillRect(x, y, 20, 20);
      c.drawImage(Sprites.icon(req.item), x + 2, y + 2);
      const who = NPC_BY_ID.get(req.npc);
      drawText(c, `${who?.name ?? ''}: ${def.name} ×${req.qty}`, x + 26, y, { font: 'small' });
      const have = countItem(p.inv, req.item);
      drawText(
        c,
        req.done ? '완료했어요!' : `보상 ${formatGold(req.reward)} · 가진 수량 ${Math.min(have, req.qty)}/${req.qty}`,
        x + 26,
        y + 11,
        { font: 'small', color: req.done ? P.tealDark : have >= req.qty ? P.tealDark : P.inkSoft },
      );
    }
    y += 30;
    rule(ui, x, y, cw);
    y += 6;
    const sat = Object.entries(w.state.market).sort((a, b) => b[1] - a[1]).filter(([, v]) => v > 0.05).slice(0, 2);
    drawText(c, '시세', x, y, { font: 'small', color: P.inkSoft });
    y += 13;
    if (!sat.length) drawText(c, '모든 작물이 제값을 받고 있어요.', x, y, { font: 'small', color: P.inkSoft });
    else for (const [id, v] of sat) {
      drawText(c, `${findCrop(id)?.name ?? id} 값이 ${Math.round(v * 100)}% 내렸어요`, x, y, { font: 'small', color: P.coralDark });
      y += 12;
    }
  }

  /** Left: everyone on the island with their hearts. Right: the one you picked — where they are and what they love. */
  private drawPeople(ui: UI, { lx, rx, py, pw }: Page) {
    const c = ui.ctx;
    const w = this.world;
    drawText(c, '섬 주민', lx + 10, py + 6, { font: 'bold' });
    const minute = w.minute(true);
    const poses = allNpcPoses(w.map, minute);
    const today = w.clock.day;
    NPCS.forEach((d, i) => {
      const r = { x: lx + 6, y: py + 22 + i * 44, w: pw - 12, h: 42 };
      const hot = ui.hover(r);
      if (hot || this.who === i) {
        c.fillStyle = this.who === i ? P.paperLight : 'rgba(255,255,255,0.35)';
        c.fillRect(r.x, r.y, r.w, r.h);
      }
      if (ui.clicked(r) && this.who !== i) {
        this.who = i;
        this.audio.play('click', { volume: 0.4 });
      }
      bust(c, d.look, r.x + 4, r.y + 4, 16, 34);
      const f = w.state.npcs[d.id];
      drawText(c, d.name, r.x + 26, r.y + 3, { font: 'bold' });
      drawText(c, d.role, r.x + 26 + measure(d.name, 'bold') + 6, r.y + 5, { font: 'small', color: P.inkSoft });
      heartsRow(c, r.x + 26, r.y + 18, f?.points ?? 0);
      const marks = [f?.talked === today ? '대화 ✓' : '대화', f?.gifted === today ? '선물 ✓' : '선물'];
      drawText(c, marks.join(' · '), r.x + 26, r.y + 28, { font: 'small', color: P.inkSoft });
    });

    const d = NPCS[this.who];
    const f = w.state.npcs[d.id];
    const x = rx + 12;
    const cw = pw - 24;
    stage(ui, x, py + 10, 52, 72, Sprites.character(d.look).frame('down', -1, 'free', this.time % 3.4 > 3.25).img);
    drawText(c, d.name, x + 62, py + 12, { font: 'title' });
    drawText(c, d.role, x + 62, py + 32, { font: 'small', color: P.inkSoft });
    heartsRow(c, x + 62, py + 48, f?.points ?? 0);
    const pose = poses.find((q) => q.id === d.id);
    if (pose) {
      const zone = ZONE_NAME[w.map.zone[Math.floor(pose.y / TILE) * w.map.w + Math.floor(pose.x / TILE)] as keyof typeof ZONE_NAME] ?? '루미나 섬';
      drawText(c, pose.moving ? `${zone} 쪽으로 걷는 중` : `지금 ${zone}에 있어요`, x + 62, py + 62, { font: 'small', color: P.tealDark });
    }
    let y = py + 92;
    rule(ui, x, y, cw);
    y += 6;
    // Loved gifts reveal themselves as you grow closer (one per two hearts).
    drawText(c, '좋아하는 선물', x, y, { font: 'small', color: P.inkSoft });
    y += 13;
    const h = Math.floor((f?.points ?? 0) / POINTS_PER_HEART);
    d.loves.forEach((id, i) => {
      const known = h >= i * 2 + 1;
      const bx = x + i * 24;
      c.fillStyle = P.ink;
      c.fillRect(bx, y, 22, 22);
      c.fillStyle = P.paperLight;
      c.fillRect(bx + 1, y + 1, 20, 20);
      if (known) {
        c.drawImage(Sprites.icon(id), bx + 3, y + 3);
        if (ui.hover({ x: bx, y, w: 22, h: 22 })) ui.tooltip([{ text: getItem(id).name, font: 'bold' }]);
      } else drawText(c, '?', bx + 11, y + 6, { font: 'bold', color: P.inkSoft, align: 'center' });
    });
    y += 30;
    const next = d.loves.findIndex((_, i) => h < i * 2 + 1);
    if (next >= 0) drawText(c, `♥ ${next * 2 + 1}개가 되면 하나 더 알게 돼요.`, x, y, { font: 'small', color: P.inkSoft });
    y += 16;
    rule(ui, x, y, cw);
    y += 6;
    drawText(c, '좋아하는 것', x, y, { font: 'small', color: P.inkSoft });
    y += 13;
    const liked = h >= 3 ? d.likes.slice(0, 5).map((id) => getItem(id).name).join(', ') : '조금 더 친해지면 알 수 있어요.';
    for (const line of wrap(liked, cw, 'small')) {
      drawText(c, line, x, y, { font: 'small', color: h >= 3 ? P.ink : P.inkSoft });
      y += 12;
    }
    y += 4;
    wrap('하루에 한 번씩 말을 걸고(F) 선물을 주면 친해져요.', cw, 'small').forEach((line, i) => drawText(c, line, x, py + 230 + i * 12, { font: 'small', color: P.inkSoft }));
  }

  private drawDex(ui: UI, { lx, rx, py, pw }: { lx: number; rx: number; py: number; pw: number; ph: number }) {
    const c = ui.ctx;
    const found = this.world.discovered;
    drawText(c, '작물 도감', lx + 10, py + 6, { font: 'bold' });
    drawText(c, `${found.size} / ${CROPS.length}`, lx + pw - 10, py + 6, { font: 'small', color: P.inkSoft, align: 'right' });
    // Category chips.
    let cx = lx + 8;
    let cy = py + 22;
    for (const cat of CATS) {
      const label = cat === 'all' ? '전체' : CATEGORY_LABEL[cat];
      const w = measure(label, 'small') + 8;
      if (cx + w > lx + pw - 6) {
        cx = lx + 8;
        cy += 14;
      }
      const r = { x: cx, y: cy, w, h: 12 };
      const active = this.dexCat === cat;
      c.fillStyle = active ? P.tealDark : P.paperShade;
      c.fillRect(r.x, r.y, r.w, r.h);
      drawText(c, label, r.x + w / 2, r.y + 1, { font: 'small', color: active ? P.paperLight : P.ink, align: 'center' });
      if (ui.clicked(r)) {
        this.dexCat = cat;
        this.dexPage = 0;
      }
      ui.hover(r);
      cx += w + 3;
    }
    const list = CROPS.filter((cr) => this.dexCat === 'all' || cr.category === this.dexCat);
    const per = 8 * 5;
    const pages = Math.max(1, Math.ceil(list.length / per));
    this.dexPage = Math.min(this.dexPage, pages - 1);
    const gy = cy + 18;
    list.slice(this.dexPage * per, this.dexPage * per + per).forEach((cr, i) => {
      const sx = lx + 10 + (i % 8) * 24;
      const sy = gy + Math.floor(i / 8) * 22;
      const r = { x: sx, y: sy, w: 20, h: 20 };
      const hot = ui.hover(r);
      c.fillStyle = hot || this.dexSel === cr.id ? P.paperLight : '#ead8b0';
      c.fillRect(sx, sy, 20, 20);
      const icon = Sprites.icon(`crop.${cr.id}`);
      if (found.has(cr.id)) c.drawImage(icon, sx + 2, sy + 2);
      else {
        c.globalAlpha = 0.28;
        c.drawImage(icon, sx + 2, sy + 2);
        c.globalAlpha = 1;
      }
      if (hot) this.dexSel = cr.id;
      if (ui.clicked(r)) this.dexSel = cr.id;
    });
    const ny = gy + 5 * 22 + 2;
    if (ui.arrow(lx + 10, ny, -1)) this.dexPage = Math.max(0, this.dexPage - 1);
    drawText(c, `${this.dexPage + 1} / ${pages}`, lx + pw / 2, ny + 1, { font: 'small', align: 'center' });
    if (ui.arrow(lx + pw - 24, ny, 1)) this.dexPage = Math.min(pages - 1, this.dexPage + 1);

    const sel = this.dexSel ?? list[0]?.id;
    if (sel) seedCard(ui, rx + 12, py + 10, pw - 24, sel, this.world.weather.meanTemp, found.has(sel));
  }

  private drawLog(ui: UI, { lx, rx, py, pw }: { lx: number; rx: number; py: number; pw: number; ph: number }) {
    const c = ui.ctx;
    drawText(c, '출하 기록', lx + 10, py + 6, { font: 'bold' });
    const hist = [...this.world.state.history].reverse();
    if (!hist.length) {
      drawText(c, '아직 배에 실어 보낸 상자가 없어요.', lx + 10, py + 28, { font: 'small', color: P.inkSoft });
      drawText(c, '작물을 수확해서 포장대에서 상자에 담고,', lx + 10, py + 42, { font: 'small', color: P.inkSoft });
      drawText(c, '17시 출항 전에 부두의 배에 실어 보세요.', lx + 10, py + 54, { font: 'small', color: P.inkSoft });
    }
    hist.slice(0, 12).forEach((h, i) => {
      const r = { x: lx + 8, y: py + 24 + i * 17, w: pw - 16, h: 15 };
      const hot = ui.hover(r);
      c.fillStyle = hot || this.logSel === i ? P.paperLight : 'transparent';
      if (hot || this.logSel === i) c.fillRect(r.x, r.y, r.w, r.h);
      drawText(c, formatDate(h.day), r.x + 4, r.y + 2, { font: 'small' });
      drawText(c, formatGold(h.total), r.x + r.w - 4, r.y + 2, { font: 'small', align: 'right' });
      if (ui.clicked(r)) this.logSel = i;
    });
    const rec = hist[this.logSel];
    drawText(c, '적재 내역', rx + 12, py + 6, { font: 'bold' });
    if (rec) {
      rec.lines.slice(0, 11).forEach((l, i) => {
        const yy = py + 26 + i * 18;
        c.drawImage(Sprites.icon(cargoItemId(l.cropId)), rx + 12, yy);
        drawText(c, `${getItem(cargoItemId(l.cropId)).name} ★${l.q} ×${l.qty}`, rx + 32, yy + 3, { font: 'small' });
        drawText(c, formatGold(l.gold), rx + pw - 12, yy + 3, { font: 'small', align: 'right' });
      });
    }
    // Market note: what's flooded.
    const sat = Object.entries(this.world.state.market).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (sat.length) {
      const yy = py + 236;
      drawText(c, `시세 하락: ${sat.map(([id, s]) => `${findCrop(id)?.name} -${Math.round(s * 100)}%`).join(', ')}`, rx + 12, yy, { font: 'small', color: P.coralDark });
    }
  }

}

/** Head and shoulders of a character, cut from its idle frame at 1×. */
function bust(ctx: CanvasRenderingContext2D, look: Appearance, x: number, y: number, w: number, h: number) {
  const img = Sprites.character(look).frame('down', -1).img;
  ctx.fillStyle = P.ink;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#bcd8e8';
  ctx.fillRect(x, y, w, h);
  ctx.drawImage(img, 0, 0, img.width, Math.min(img.height, h), x + Math.round((w - img.width) / 2), y + 1, img.width, Math.min(img.height, h));
}

// ───────────────────────────── Shop ─────────────────────────────

const KEEPER_LINES: Record<ShopId, string[]> = {
  seedShop: ['어서 오세요! 오늘 바람이 참 좋네요.', '제철 씨앗은 위쪽에 모아 뒀어요.', '비에 약한 작물은 비가림막을 꼭 챙기세요.'],
  toolShop: ['등불 공방입니다. 뭐든 고쳐 드려요.', '스프링클러 하나면 아침이 한결 여유로워요.', '상자는 넉넉히 사 두는 게 좋아요.'],
};

export class ShopPanel implements Panel {
  closed = false;
  pauses = true;
  private sel = 0;
  private scroll = 0;
  private qty = 1;
  private line: string;

  constructor(
    private shop: ShopId,
    private stock: string[],
    private world: ClientWorld,
    private send: Send,
    private audio: AudioManager,
  ) {
    const lines = KEEPER_LINES[shop];
    this.line = lines[Math.floor(Math.random() * lines.length)];
  }

  draw(ui: UI, vw: number, vh: number): void {
    dimBackground(ui, vw, vh);
    const W = 440;
    const H = 262;
    const x = Math.round((vw - W) / 2);
    const y = Math.round((vh - H) / 2);
    const c = ui.ctx;
    ui.panel({ x, y, w: W, h: H });
    const def = SHOPS[this.shop];
    drawText(c, def.name, x + 12, y + 8, { font: 'title' });
    drawText(c, `${def.keeper}: “${this.line}”`, x + 12, y + 28, { font: 'small', color: P.inkSoft });
    c.drawImage(Sprites.coin(), x + W - 100, y + 12);
    drawText(c, formatGold(this.world.gold), x + W - 24, y + 10, { font: 'bold', align: 'right' });
    if (closeButton(ui, x + W - 18, y + 5)) this.closed = true;

    // Item list.
    const list = { x: x + 10, y: y + 44, w: 200, h: H - 54 };
    ui.inset(list);
    const rowH = 22;
    const visible = Math.floor((list.h - 4) / rowH);
    if (ui.hover(list) && ui.input.wheel) this.scroll = Math.max(0, Math.min(this.stock.length - visible, this.scroll + ui.input.wheel));
    this.stock.slice(this.scroll, this.scroll + visible).forEach((id, i) => {
      const idx = this.scroll + i;
      const r = { x: list.x + 2, y: list.y + 2 + i * rowH, w: list.w - 4, h: rowH - 1 };
      const hot = ui.hover(r);
      if (hot || this.sel === idx) {
        c.fillStyle = this.sel === idx ? '#f5e2b8' : '#fbf1dc';
        c.fillRect(r.x, r.y, r.w, r.h);
      }
      const it = getItem(id);
      c.drawImage(Sprites.icon(id), r.x + 3, r.y + 3);
      const name = it.name.length > 11 ? `${it.name.slice(0, 10)}…` : it.name;
      drawText(c, name, r.x + 23, r.y + 4, { font: 'small', color: it.price > this.world.gold ? '#a8987a' : P.ink });
      drawText(c, formatGold(it.price), r.x + r.w - 4, r.y + 4, { font: 'small', align: 'right' });
      if (it.cropId) {
        const cr = findCrop(it.cropId)!;
        const [lo, hi] = cr.temp;
        const t = this.world.weather.meanTemp;
        if (t >= lo && t <= hi) {
          c.fillStyle = P.tealDark;
          c.fillRect(r.x + r.w - 2, r.y + 2, 2, r.h - 4);
        }
      }
      if (ui.clicked(r)) {
        this.sel = idx;
        this.qty = 1;
        this.audio.play('click', { volume: 0.4 });
      }
    });
    if (this.stock.length > visible) {
      const bar = Math.max(10, Math.round((visible / this.stock.length) * (list.h - 4)));
      const by = list.y + 2 + Math.round((this.scroll / (this.stock.length - visible)) * (list.h - 4 - bar));
      c.fillStyle = P.paperDeep;
      c.fillRect(list.x + list.w - 3, by, 2, bar);
    }

    // Detail.
    const id = this.stock[this.sel];
    if (!id) return;
    const it = getItem(id);
    const dx = x + 222;
    const dw = W - 234;
    if (it.kind === 'seed') seedCard(ui, dx, y + 46, dw, it.cropId!, this.world.weather.meanTemp, this.world.discovered.has(it.cropId!));
    else itemCard(ui, dx, y + 46, dw, id);
    const single = it.kind === 'tool' || it.kind === 'upgrade';
    const by = y + H - 42;
    if (!single) {
      if (ui.arrow(dx, by + 2, -1)) this.qty = Math.max(1, this.qty - (ui.input.keyDown('ShiftLeft') ? 10 : 1));
      drawText(c, `×${this.qty}`, dx + 34, by + 3, { font: 'bold', align: 'center' });
      if (ui.arrow(dx + 54, by + 2, 1)) this.qty = Math.min(99, this.qty + (ui.input.keyDown('ShiftLeft') ? 10 : 1));
      // One click for as many as the purse allows.
      const most = Math.max(1, Math.min(99, Math.floor(this.world.gold / Math.max(1, it.price))));
      if (ui.button({ x: dx, y: by - 19, w: 44, h: 15 }, `최대 ${most}`, { disabled: this.qty === most, font: 'small' })) this.qty = most;
      if (ui.button({ x: dx + 48, y: by - 19, w: 26, h: 15 }, '1', { disabled: this.qty === 1, font: 'small' })) this.qty = 1;
    }
    const total = it.price * (single ? 1 : this.qty);
    drawText(c, `합계 ${formatGold(total)}`, dx + 76, by + 3, { font: 'small' });
    const afford = total <= this.world.gold;
    if (ui.button({ x: x + W - 84, y: by - 2, w: 72, h: 22 }, '구매', { tone: afford ? 'brass' : 'paper', disabled: !afford })) {
      this.send({ t: 'buy', shop: this.shop, item: id, qty: single ? 1 : this.qty });
    }
    if (!afford) drawText(c, '돈이 부족해요', x + W - 48, by + 22, { font: 'small', color: P.coralDark, align: 'center' });
  }
}

// ───────────────────────────── Packing ─────────────────────────────

export class PackingPanel implements Panel {
  closed = false;
  pauses = true;
  private sel = -1;
  private qty = CRATE_CAPACITY;

  constructor(
    private world: ClientWorld,
    private send: Send,
  ) {}

  draw(ui: UI, vw: number, vh: number): void {
    dimBackground(ui, vw, vh);
    const W = 330;
    const H = 214;
    const x = Math.round((vw - W) / 2);
    const y = Math.round((vh - H) / 2);
    const c = ui.ctx;
    const p = this.world.self;
    ui.panel({ x, y, w: W, h: H });
    drawText(c, '포장대', x + 12, y + 8, { font: 'title' });
    drawText(c, '같은 작물·같은 품질을 한 상자에 최대 30개까지 담아요.', x + 12, y + 28, { font: 'small', color: P.inkSoft });
    if (closeButton(ui, x + W - 18, y + 5)) this.closed = true;
    const packable = (id: string) => ['produce', 'forage', 'artisan', 'gem'].includes(getItem(id).kind);
    const produce = p.inv.map((s, i) => [s, i] as const).filter(([s]) => s && packable(s.id));
    if (!produce.length) drawText(c, '가방에 출하할 물건이 없어요.', x + 12, y + 50, { color: P.inkSoft });
    produce.forEach(([s, i], k) => {
      const sx = x + 12 + (k % 8) * 26;
      const sy = y + 46 + Math.floor(k / 8) * 26;
      ui.slot(sx, sy, s, this.sel === i);
      if (ui.clicked({ x: sx, y: sy, w: 22, h: 22 })) {
        this.sel = i;
        this.qty = Math.min(CRATE_CAPACITY, s!.qty);
      }
    });
    const crates = countItem(p.inv, 'crate');
    const cap = p.cart ? CART_CAPACITY : 1;
    drawText(c, `빈 상자 ${crates}개 · 들고 있는 상자 ${p.carrying.length}/${cap}`, x + 12, y + H - 58, { font: 'small' });
    const s = this.sel >= 0 ? p.inv[this.sel] : null;
    if (s && packable(s.id)) {
      const def = getItem(s.id);
      const cid = def.kind === 'produce' ? def.cropId! : s.id;
      const cr = { id: cid, name: def.name };
      const by = y + H - 40;
      icon2x(c, Sprites.icon(s.id), x + 12, by - 6);
      drawText(c, `${cr.name} ★${s.q ?? 1}`, x + 50, by - 4, { font: 'bold' });
      const est = unitPrice(cr.id, s.q ?? 1, this.world.state.market[cr.id] ?? 0, this.world.weather.meanTemp) * this.qty;
      drawText(c, `예상 ${formatGold(est)}`, x + 50, by + 10, { font: 'small', color: P.inkSoft });
      if (ui.arrow(x + 150, by, -1)) this.qty = Math.max(1, this.qty - 1);
      drawText(c, `${this.qty}개`, x + 180, by + 1, { font: 'bold', align: 'center' });
      if (ui.arrow(x + 196, by, 1)) this.qty = Math.min(CRATE_CAPACITY, s.qty, this.qty + 1);
      const ok = crates > 0 && p.carrying.length < cap;
      if (ui.button({ x: x + W - 96, y: by - 4, w: 86, h: 22 }, '상자에 담기', { tone: 'brass', disabled: !ok })) {
        this.send({ t: 'pack', slot: this.sel, qty: this.qty });
        this.closed = true;
      }
    }
  }
}

// ───────────────────────────── Dialogs ─────────────────────────────

export class SleepDialog implements Panel {
  closed = false;
  pauses = true;
  constructor(private onSleep: () => void) {}

  draw(ui: UI, vw: number, vh: number): void {
    dimBackground(ui, vw, vh, 0.35);
    const W = 220;
    const H = 84;
    const x = Math.round((vw - W) / 2);
    const y = Math.round((vh - H) / 2);
    ui.panel({ x, y, w: W, h: H });
    drawText(ui.ctx, '오늘 하루를 마칠까요?', x + W / 2, y + 12, { font: 'bold', align: 'center' });
    drawText(ui.ctx, '잠들면 오늘의 항해 일지가 정리돼요.', x + W / 2, y + 28, { font: 'small', color: P.inkSoft, align: 'center' });
    if (ui.button({ x: x + 16, y: y + 50, w: 88, h: 22 }, '잠자기', { tone: 'brass' }) || ui.input.wasPressed('confirm')) {
      this.onSleep();
      this.closed = true;
    }
    if (ui.button({ x: x + W - 104, y: y + 50, w: 88, h: 22 }, '아직이요')) this.closed = true;
  }
}

/** Restoring the ruined glasshouse: what it costs and what you have. */
export class RepairPanel implements Panel {
  closed = false;
  pauses = true;
  constructor(
    private world: ClientWorld,
    private onRepair: () => void,
  ) {}

  draw(ui: UI, vw: number, vh: number): void {
    dimBackground(ui, vw, vh, 0.35);
    const W = 250;
    const H = 72 + (GREENHOUSE_COST.items.length + 1) * 18 + 34;
    const x = Math.round((vw - W) / 2);
    const y = Math.round((vh - H) / 2);
    const c = ui.ctx;
    ui.panel({ x, y, w: W, h: H });
    drawText(c, '낡은 온실', x + W / 2, y + 10, { font: 'bold', align: 'center' });
    drawText(c, '유리를 다시 끼우면 계절과 날씨에 상관없이', x + W / 2, y + 26, { font: 'small', color: P.inkSoft, align: 'center' });
    drawText(c, '어떤 작물이든 기를 수 있어요. (7×4칸)', x + W / 2, y + 38, { font: 'small', color: P.inkSoft, align: 'center' });
    const self = this.world.self;
    let ly = y + 56;
    const row = (icon: HTMLCanvasElement | null, label: string, ok: boolean, have: string) => {
      if (icon) c.drawImage(icon, x + 20, ly - 3);
      drawText(c, label, x + 40, ly, { font: 'small' });
      drawText(c, have, x + W - 20, ly, { font: 'small', color: ok ? P.tealDark : P.coralDark, align: 'right' });
      ly += 18;
    };
    row(Sprites.coin(), `${GREENHOUSE_COST.gold.toLocaleString()}G`, this.world.gold >= GREENHOUSE_COST.gold, formatGold(this.world.gold));
    let ready = this.world.gold >= GREENHOUSE_COST.gold;
    for (const [id, n] of GREENHOUSE_COST.items) {
      const have = countItem(self.inv, id);
      ready &&= have >= n;
      row(Sprites.icon(id), `${getItem(id).name} ×${n}`, have >= n, `${have}/${n}`);
    }
    if (ui.button({ x: x + 16, y: y + H - 30, w: 104, h: 22 }, '복원하기', { tone: ready ? 'brass' : 'paper' }) && ready) {
      this.onRepair();
      this.closed = true;
    }
    if (ui.button({ x: x + W - 120, y: y + H - 30, w: 104, h: 22 }, '다음에')) this.closed = true;
  }
}

/** The lift at the mine entrance: floor 1, or any checkpoint (every 5 floors) already reached. */
export class LiftPanel implements Panel {
  closed = false;
  pauses = true;
  constructor(
    private floors: number[],
    private onPick: (floor: number) => void,
  ) {}

  draw(ui: UI, vw: number, vh: number): void {
    dimBackground(ui, vw, vh, 0.35);
    const cols = Math.min(4, this.floors.length);
    const rows = Math.ceil(this.floors.length / cols);
    const W = Math.max(200, cols * 52 + 32);
    const H = 64 + rows * 28 + 30;
    const x = Math.round((vw - W) / 2);
    const y = Math.round((vh - H) / 2);
    ui.panel({ x, y, w: W, h: H });
    drawText(ui.ctx, '광산 승강기', x + W / 2, y + 12, { font: 'bold', align: 'center' });
    drawText(ui.ctx, '내려갈 층을 고르세요. 5층마다 멈춰요.', x + W / 2, y + 28, { font: 'small', color: P.inkSoft, align: 'center' });
    const bx0 = x + Math.round((W - cols * 52) / 2) + 2;
    this.floors.forEach((f, i) => {
      const bx = bx0 + (i % cols) * 52;
      const by = y + 48 + Math.floor(i / cols) * 28;
      if (ui.button({ x: bx, y: by, w: 46, h: 22 }, `${f}층`, { tone: i === this.floors.length - 1 ? 'brass' : 'paper' })) {
        this.onPick(f);
        this.closed = true;
      }
    });
    if (ui.button({ x: x + W / 2 - 40, y: y + H - 28, w: 80, h: 20 }, '그만두기')) this.closed = true;
  }
}

export class DaySummaryPanel implements Panel {
  closed = false;
  pauses = true;
  private t = 0;

  constructor(private s: DaySummary) {}

  update(dt: number): void {
    this.t += dt;
  }

  draw(ui: UI, vw: number, vh: number): void {
    const c = ui.ctx;
    // Starry night backdrop.
    const g = c.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, '#101230');
    g.addColorStop(1, '#2a2d5a');
    c.fillStyle = g;
    c.fillRect(0, 0, vw, vh);
    for (let i = 0; i < 90; i++) {
      const sx = (i * 97) % vw;
      const sy = (i * 53) % vh;
      c.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(this.t * 1.5 + i));
      c.fillStyle = '#fff8e0';
      c.fillRect(sx, sy, 1, 1);
    }
    c.globalAlpha = 1;
    const W = 320;
    const H = 250;
    const x = Math.round((vw - W) / 2);
    const y = Math.round((vh - H) / 2);
    ui.panel({ x, y, w: W, h: H });
    drawText(c, '오늘의 항해 일지', x + W / 2, y + 10, { font: 'title', align: 'center' });
    drawText(c, `${formatDate(this.s.day - 1)}의 기록`, x + W / 2, y + 30, { font: 'small', color: P.inkSoft, align: 'center' });
    let yy = y + 48;
    const lines = this.s.shipment?.lines ?? [];
    if (!lines.length) {
      drawText(c, '오늘은 배에 실은 상자가 없었어요.', x + 16, yy, { font: 'small', color: P.inkSoft });
      yy += 16;
    }
    lines.slice(0, 7).forEach((l, i) => {
      if (this.t < 0.3 + i * 0.25) return;
      c.drawImage(Sprites.icon(cargoItemId(l.cropId)), x + 16, yy);
      drawText(c, `${getItem(cargoItemId(l.cropId)).name} ★${l.q} × ${l.qty}`, x + 36, yy + 3, { font: 'small' });
      drawText(c, formatGold(l.gold), x + W - 16, yy + 3, { font: 'small', align: 'right' });
      yy += 18;
    });
    const total = this.s.shipment?.total ?? 0;
    const shown = Math.round(total * Math.min(1, Math.max(0, (this.t - 0.4) / 1.6)));
    c.fillStyle = P.paperShade;
    c.fillRect(x + 16, y + 180, W - 32, 1);
    drawText(c, '합계', x + 16, y + 186, { font: 'bold' });
    drawText(c, formatGold(shown), x + W - 16, y + 186, { font: 'bold', align: 'right', color: P.brassDark });
    const notes: string[] = [];
    const d = this.s.deaths;
    if (d.frost) notes.push(`서리로 ${d.frost}그루가 시들었어요.`);
    if (d.rot) notes.push(`비를 너무 맞아 ${d.rot}그루가 짓물렀어요.`);
    if (d.drought) notes.push(`물이 부족해 ${d.drought}그루가 말랐어요.`);
    if (this.s.ready) notes.push(`${this.s.ready}그루가 수확을 기다려요.`);
    if (this.s.giant) notes.push(`밤사이 ${getCrop(this.s.giant).name}가 거대하게 자랐어요!`);
    if (this.s.passedOut) notes.push('너무 늦게까지 일해서 쓰러졌어요… (체력 70%)');
    notes.push(`오늘 날씨: ${WEATHER_NAME[this.s.weather.kind]} ${Math.round(this.s.weather.minTemp)}~${Math.round(this.s.weather.maxTemp)}°C`);
    notes.slice(0, 3).forEach((n, i) => drawText(c, n, x + 16, y + 202 + i * 11, { font: 'small', color: P.inkSoft }));
    if (this.t > 0.8 && (ui.button({ x: x + W - 86, y: y + H - 30, w: 72, h: 22 }, '아침으로', { tone: 'brass' }) || ui.input.wasPressed('confirm'))) this.closed = true;
  }
}

export class PauseMenu implements Panel {
  closed = false;
  pauses = true;
  constructor(
    private audio: AudioManager,
    private onQuit: () => void,
  ) {}

  draw(ui: UI, vw: number, vh: number): void {
    dimBackground(ui, vw, vh, 0.5);
    const W = 240;
    const H = 214;
    const x = Math.round((vw - W) / 2);
    const y = Math.round((vh - H) / 2);
    const c = ui.ctx;
    ui.panel({ x, y, w: W, h: H });
    drawText(c, '잠시 쉬어가기', x + W / 2, y + 10, { font: 'title', align: 'center' });
    if (ui.button({ x: x + 20, y: y + 34, w: W - 40, h: 22 }, '계속하기', { tone: 'brass' })) this.closed = true;
    const sliders: Array<[keyof AudioManager['volumes'], string]> = [
      ['master', '전체 음량'],
      ['music', '음악'],
      ['sfx', '효과음'],
      ['amb', '환경음'],
    ];
    sliders.forEach(([k, label], i) => {
      const sy = y + 66 + i * 20;
      drawText(c, label, x + 20, sy, { font: 'small' });
      const r = { x: x + 90, y: sy + 3, w: 120, h: 8 };
      ui.inset(r);
      const v = this.audio.volumes[k];
      c.fillStyle = P.teal;
      c.fillRect(r.x + 1, r.y + 1, Math.round((r.w - 2) * v), r.h - 2);
      c.fillStyle = P.ink;
      c.fillRect(r.x + Math.round((r.w - 2) * v), r.y - 2, 3, r.h + 4);
      if (ui.hover(r) && ui.input.mouseDown[0]) {
        this.audio.volumes[k] = Math.max(0, Math.min(1, (ui.input.mouseX - r.x) / r.w));
        this.audio.applyVolumes();
      }
    });
    const help = ['이동 WASD · 도구 좌클릭/Space · 달리기 Shift', '상호작용 우클릭/F · 가방 E · 일지 Tab · 지도 M'];
    help.forEach((h, i) => drawText(c, h, x + W / 2, y + 150 + i * 11, { font: 'small', color: P.inkSoft, align: 'center' }));
    if (ui.button({ x: x + 20, y: y + H - 32, w: W - 40, h: 22 }, '저장하고 타이틀로')) this.onQuit();
  }
}

export function wrapText(text: string, w: number): string[] {
  return wrap(text, w, 'small');
}
