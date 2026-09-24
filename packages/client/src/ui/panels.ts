import {
  CATEGORY_LABEL,
  CART_CAPACITY,
  CRATE_CAPACITY,
  CROPS,
  INVENTORY_SIZE,
  SHOPS,
  TILE,
  Terrain,
  WEATHER_NAME,
  ZONE_NAME,
  countItem,
  findCrop,
  formatDate,
  getItem,
  unitPrice,
  type ClientMessage,
  type CropCategory,
  type DaySummary,
  type ShopId,
  type WorldMap,
} from '@lumina/core';
import { Sprites } from '../art/Sprites';
import { P, shade } from '../art/palette';
import type { AudioManager } from '../audio/AudioManager';
import { drawText, measure, wrap } from '../engine/text';
import type { ClientWorld } from '../net/ClientWorld';
import { icon2x, itemCard, seedCard } from './cards';
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

type JournalTab = 'bag' | 'dex' | 'log' | 'map';
const TABS: Array<[JournalTab, string, string]> = [
  ['bag', '가방', '#c8704a'],
  ['dex', '도감', '#5a9a6a'],
  ['log', '출하', '#4f7ab0'],
  ['map', '지도', '#9a78b0'],
];
const CATS: Array<CropCategory | 'all'> = ['all', 'leafy', 'root', 'bulb', 'fruitveg', 'legume', 'grain', 'special', 'herb', 'flower', 'fruit'];

let minimapCache: HTMLCanvasElement | null = null;
function minimap(map: WorldMap): HTMLCanvasElement {
  if (minimapCache) return minimapCache;
  const c = document.createElement('canvas');
  c.width = map.w;
  c.height = map.h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(map.w, map.h);
  const col: Record<number, [number, number, number]> = {
    [Terrain.Deep]: [58, 100, 150],
    [Terrain.Sea]: [96, 158, 196],
    [Terrain.River]: [110, 178, 196],
    [Terrain.Pond]: [110, 178, 196],
    [Terrain.Sand]: [232, 214, 162],
    [Terrain.Grass]: [138, 184, 98],
    [Terrain.Forest]: [92, 140, 80],
    [Terrain.Meadow]: [168, 200, 118],
    [Terrain.Path]: [206, 170, 120],
    [Terrain.Cobble]: [196, 188, 176],
    [Terrain.Rock]: [160, 154, 148],
    [Terrain.Dock]: [170, 120, 80],
    [Terrain.Bridge]: [170, 120, 80],
  };
  for (let i = 0; i < map.terrain.length; i++) {
    const [r, g, b] = col[map.terrain[i]] ?? [0, 0, 0];
    img.data.set([r, g, b, 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  for (const o of map.objects)
    if (o.kind === 'oak' || o.kind === 'pine' || o.kind === 'blossom' || o.kind === 'palm') {
      ctx.fillStyle = o.kind === 'blossom' ? '#e8a8b8' : '#4a7a44';
      ctx.fillRect(o.x, o.y, 1, 1);
    }
  for (const b of map.buildings) {
    ctx.fillStyle = b.kind === 'seedShop' ? '#5aa58a' : b.kind === 'toolShop' ? '#5a6a8a' : b.kind === 'lighthouse' ? '#e05a4a' : '#c8704a';
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  ctx.fillStyle = '#7a5236';
  ctx.fillRect(map.ship.x, map.ship.y + 1, map.ship.w, map.ship.h - 2);
  minimapCache = c;
  return c;
}

export class JournalPanel implements Panel {
  closed = false;
  pauses = true;
  tab: JournalTab;
  private picked: number | null = null;
  private selected = 0;
  private dexCat: CropCategory | 'all' = 'all';
  private dexPage = 0;
  private dexSel: string | null = null;
  private logSel = 0;
  private time = 0;

  constructor(
    private world: ClientWorld,
    private send: Send,
    private audio: AudioManager,
    tab: JournalTab = 'bag',
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
    // Bookmark ribbons.
    TABS.forEach(([id, label, color], i) => {
      const r = { x: x + W - 2, y: y + 14 + i * 26, w: 30, h: 22 };
      const active = this.tab === id;
      c.fillStyle = P.ink;
      c.fillRect(r.x, r.y, r.w + (active ? 4 : 0), r.h);
      c.fillStyle = active ? color : shade(color, 1);
      c.fillRect(r.x, r.y + 1, r.w - 1 + (active ? 4 : 0), r.h - 2);
      drawText(c, label, r.x + 15 + (active ? 2 : 0), r.y + 5, { font: 'small', color: P.paperLight, align: 'center' });
      if (ui.clicked(r)) {
        this.tab = id;
        this.audio.play('open', { volume: 0.5 });
      }
      ui.hover(r);
    });
    if (closeButton(ui, x + W - 16, y - 6)) this.closed = true;

    const page = { lx, rx, py, pw, ph };
    if (this.tab === 'bag') this.drawBag(ui, page);
    else if (this.tab === 'dex') this.drawDex(ui, page);
    else if (this.tab === 'log') this.drawLog(ui, page);
    else this.drawMap(ui, x + 8, py, W - 16, ph);
  }

  private drawBag(ui: UI, { lx, rx, py, pw }: { lx: number; rx: number; py: number; pw: number; ph: number }) {
    const c = ui.ctx;
    const p = this.world.self;
    drawText(c, '가방', lx + 10, py + 6, { font: 'bold' });
    drawText(c, '클릭해서 집고 다른 칸에 놓아요. 윗 두 줄이 핫바.', lx + 10, py + 20, { font: 'small', color: P.inkSoft });
    const cols = 5;
    const gx = lx + 12;
    const gy = py + 36;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const sx = gx + (i % cols) * 25;
      const sy = gy + Math.floor(i / cols) * 25 + (i >= 10 ? 5 : 0);
      const hot = ui.slot(sx, sy, p.inv[i], this.picked === i || this.selected === i);
      if (i < 10) {
        c.fillStyle = P.brass;
        c.fillRect(sx + 1, sy + 20, 20, 1);
      }
      if (hot) this.selected = i;
      if (ui.clicked({ x: sx, y: sy, w: 22, h: 22 })) {
        if (this.picked === null) {
          if (p.inv[i]) this.picked = i;
        } else {
          if (this.picked !== i) this.send({ t: 'swap', a: this.picked, b: i });
          this.picked = null;
        }
        this.audio.play('click', { volume: 0.5 });
      }
    }
    const crates = countItem(p.inv, 'crate');
    drawText(c, `빈 출하 상자 ${crates}개 · 손수레 ${p.cart ? '있음' : '없음'}`, lx + 12, gy + 160, { font: 'small', color: P.inkSoft });

    // Right page: item card + farmer.
    const st = p.inv[this.selected];
    if (st) itemCard(ui, rx + 12, py + 10, pw - 24, st.id, st.q);
    else drawText(c, '빈 칸', rx + 12, py + 12, { color: P.inkSoft });
    const sheet = Sprites.character(p.look);
    const fy = py + 150;
    c.fillStyle = P.paperShade;
    c.fillRect(rx + 12, fy - 6, pw - 24, 1);
    const dir = (['down', 'left', 'up', 'right'] as const)[Math.floor(this.time / 1.2) % 4];
    c.drawImage(sheet.walk[dir][Math.floor(this.time * 8) % 6], rx + 14, fy, 32, 64);
    drawText(c, p.name, rx + 56, fy + 4, { font: 'bold' });
    drawText(c, p.farmName, rx + 56, fy + 18, { font: 'small', color: P.inkSoft });
    c.drawImage(Sprites.coin(), rx + 56, fy + 34);
    drawText(c, formatGold(this.world.gold), rx + 68, fy + 32);
    drawText(c, `누적 출하 ${formatGold(this.world.lifetime)}`, rx + 56, fy + 46, { font: 'small', color: P.inkSoft });
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
        c.drawImage(Sprites.icon(`crop.${l.cropId}`), rx + 12, yy);
        drawText(c, `${findCrop(l.cropId)?.name} ★${l.q} ×${l.qty}`, rx + 32, yy + 3, { font: 'small' });
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

  private drawMap(ui: UI, x: number, y: number, w: number, h: number) {
    const c = ui.ctx;
    const map = this.world.map;
    const img = minimap(map);
    const mx = Math.round(x + (w - img.width) / 2);
    const my = Math.round(y + (h - img.height) / 2) + 4;
    c.fillStyle = P.ink;
    c.fillRect(mx - 1, my - 1, img.width + 2, img.height + 2);
    c.drawImage(img, mx, my);
    drawText(c, '루미나 섬', x + 10, y + 6, { font: 'bold' });
    const label = (text: string, tx: number, ty: number) => drawText(c, text, mx + tx, my + ty, { font: 'small', color: P.ink, outline: P.paperLight, align: 'center' });
    for (const b of map.buildings) {
      const name = b.kind === 'seedShop' ? SHOPS.seedShop.name : b.kind === 'toolShop' ? SHOPS.toolShop.name : b.kind === 'lighthouse' ? '등대' : b.kind === 'house' ? '나의 집' : null;
      if (name) label(name, b.x + b.w / 2, b.y - 11);
    }
    label('항구', map.pierEnd.x, map.pierEnd.y + 3);
    label(ZONE_NAME[5], 180, 44);
    label(ZONE_NAME[4], 108, 20);
    label(ZONE_NAME[6], 52, 136);
    const p = this.world.self;
    if (Math.floor(this.time * 3) % 2 === 0) {
      c.fillStyle = P.coral;
      c.fillRect(mx + Math.floor(p.x / TILE) - 1, my + Math.floor(p.y / TILE) - 1, 3, 3);
      c.fillStyle = P.white;
      c.fillRect(mx + Math.floor(p.x / TILE), my + Math.floor(p.y / TILE), 1, 1);
    }
  }
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
    const produce = p.inv.map((s, i) => [s, i] as const).filter(([s]) => s && getItem(s.id).kind === 'produce');
    if (!produce.length) drawText(c, '가방에 수확한 작물이 없어요.', x + 12, y + 50, { color: P.inkSoft });
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
    if (s && getItem(s.id).kind === 'produce') {
      const cr = findCrop(getItem(s.id).cropId!)!;
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
      c.drawImage(Sprites.icon(`crop.${l.cropId}`), x + 16, yy);
      drawText(c, `${findCrop(l.cropId)?.name} ★${l.q} × ${l.qty}`, x + 36, yy + 3, { font: 'small' });
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
    const help = ['이동 WASD · 도구 좌클릭/Space', '상호작용 우클릭/E · 일지 Tab · 지도 M'];
    help.forEach((h, i) => drawText(c, h, x + W / 2, y + 150 + i * 11, { font: 'small', color: P.inkSoft, align: 'center' }));
    if (ui.button({ x: x + 20, y: y + H - 32, w: W - 40, h: 22 }, '저장하고 타이틀로')) this.onQuit();
  }
}

export function wrapText(text: string, w: number): string[] {
  return wrap(text, w, 'small');
}
