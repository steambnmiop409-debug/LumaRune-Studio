import { LANGS, formatDate, generateWorld, getLang, tr, type SaveSlotInfo, type ServerMessage } from '@lumina/core';
import { Sprites } from '../art/Sprites';
import { P } from '../art/palette';
import type { Game } from '../engine/Game';
import type { Scene } from '../engine/Scene';
import { drawText, measure } from '../engine/text';
import { connect, type Connection } from '../net/Connection';
import { host } from '../platform/host';
import { settings } from '../settings';
import { formatGold } from '../ui/kit';
import { SettingsPanel } from '../ui/settings';
import { Backdrop } from './backdrop';
import { CreatorScene } from './CreatorScene';
import { GameScene } from './GameScene';
import { birds, cloudLayers, fireflies, glint, logo, signBoard, sky, sparkle, stars, type SignIcon } from './titleArt';

let sharedBackdrop: Backdrop | null = null;
export function backdrop(): Backdrop {
  if (!sharedBackdrop) sharedBackdrop = new Backdrop(generateWorld());
  return sharedBackdrop;
}

/** The first title of a session plays the descent from the sky; coming back from the island skips it. */
let introPlayed = false;

const INTRO = 2.8;
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const easeBack = (k: number) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;

type Mode = 'intro' | 'gate' | 'menu' | 'load' | 'confirm';
interface Item {
  label: string;
  icon: SignIcon;
  run: () => void;
}

/**
 * Title: the camera comes down through dusk clouds onto the harbour, the logo drops in, and
 * wooden signs offer the way in. Mouse or keyboard both work throughout.
 */
export class TitleScene implements Scene {
  private game!: Game;
  private conn: Connection | null = null;
  private slots: Array<SaveSlotInfo | null> | null = null;
  private mode: Mode = introPlayed ? 'menu' : 'intro';
  private t = introPlayed ? INTRO + 1 : 0;
  /** Time since the menu appeared (buttons slide in one after another). */
  private menuT = 0;
  private sel = 0;
  private slotSel = 0;
  private deleting: SaveSlotInfo | null = null;
  private child: SettingsPanel | null = null;
  /** Fading to black before leaving; the action runs when it's dark. */
  private leaving: { t: number; then: () => void; done: boolean } | null = null;
  private worldBuf = document.createElement('canvas');

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
      this.afterFade(() => this.game.setScene(new GameScene(conn, m.you, m.state)));
    } else if (m.t === 'needCharacter' && this.conn) {
      const conn = this.conn;
      this.conn = null;
      this.afterFade(() => this.game.setScene(new CreatorScene(conn, m.slot)));
    }
  }

  exit(): void {
    this.conn?.close();
  }

  /** Runs `then` once the screen has faded to black (straight away if it already has). */
  private afterFade(then: () => void) {
    if (!this.leaving) this.leaving = { t: 0, then, done: false };
    else if (this.leaving.done) then();
    else this.leaving.then = then;
  }

  update(dt: number): void {
    this.t += dt;
    if (this.mode !== 'intro' && this.mode !== 'gate') this.menuT += dt;
    this.child?.update(dt);
    if (this.child?.closed) this.child = null;
    const input = this.game.input;
    if (this.mode === 'intro') {
      if (this.t >= INTRO) {
        this.mode = 'gate';
        introPlayed = true;
      } else if (input.anyKeyPressed() || input.mousePressed[0]) {
        this.t = INTRO;
        this.mode = 'gate';
        introPlayed = true;
        input.consumed = true;
      }
    } else if (this.mode === 'gate' && this.t > INTRO + 0.25 && (input.anyKeyPressed() || input.mouseReleased[0])) {
      this.mode = 'menu';
      this.menuT = 0;
      input.consumed = true;
      this.game.audio.play('open', { volume: 0.5 });
    }
    if (this.leaving) {
      this.leaving.t += dt;
      if (this.leaving.t >= 0.45 && !this.leaving.done) {
        this.leaving.done = true;
        this.leaving.then();
      }
    }
  }

  private saves(): SaveSlotInfo[] {
    return (this.slots ?? []).filter((s): s is SaveSlotInfo => !!s);
  }

  private items(): Item[] {
    const out: Item[] = [];
    if (this.saves().length)
      out.push({
        label: '이어하기',
        icon: 'continue',
        run: () => {
          this.mode = 'load';
          this.slotSel = Math.max(0, (this.slots ?? []).findIndex((s) => !!s));
        },
      });
    out.push({
      label: '새로운 섬 생활',
      icon: 'new',
      run: () => {
        const empty = (this.slots ?? [null, null, null]).findIndex((s) => !s);
        if (empty >= 0) this.start(empty, true);
        else {
          this.mode = 'load';
          this.game.audio.play('error', { volume: 0.4 });
        }
      },
    });
    out.push({ label: '설정', icon: 'settings', run: () => (this.child = new SettingsPanel(this.game)) });
    if (host) out.push({ label: '게임 종료', icon: 'quit', run: () => host!.quit() });
    return out;
  }

  private start(slot: number, fresh: boolean) {
    if (!this.conn || this.leaving) return;
    this.game.audio.play('open', { volume: 0.6 });
    if (fresh) {
      const conn = this.conn;
      this.conn = null;
      this.afterFade(() => this.game.setScene(new CreatorScene(conn, slot)));
    } else {
      this.conn.send({ t: 'join', slot });
      // Fade now; the scene switches once the island has loaded.
      this.afterFade(() => {});
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: vw, height: vh } = this.game.screen;
    const ui = this.game.ui;
    const t = this.t;
    // The descent: sky slides up and away, the harbour rises into place beneath it.
    const p = ease(Math.min(1, t / INTRO));
    const buf = this.worldBuf;
    if (buf.width !== vw || buf.height !== vh) {
      buf.width = vw;
      buf.height = vh;
    }
    const bctx = buf.getContext('2d')!;
    bctx.imageSmoothingEnabled = false;
    backdrop().render(bctx, vw, vh, 1 / 60);
    const worldY = Math.round(vh * 0.35 * (1 - p));
    ctx.fillStyle = '#191b3d';
    ctx.fillRect(0, 0, vw, vh);
    ctx.drawImage(buf, 0, worldY);
    fireflies(ctx, vw, vh, t, Math.min(1, Math.max(0, (t - 1.5) / 1.5)));
    if (p < 1) {
      const skyY = Math.round(-vh * 1.05 * p);
      ctx.drawImage(sky(vw, vh), 0, skyY);
      stars(ctx, vw, vh, skyY, t, 1);
      cloudLayers(ctx, vw, vh, skyY, t);
      this.cloudBank(ctx, vw, skyY + vh, t);
    }
    birds(ctx, vw, vh, t + 6);

    // Logo: drops in with a bounce, then floats; a glint sweeps across it now and then.
    const lang = getLang();
    const name = lang === 'ko' ? '루미나 아일' : lang === 'ja' ? 'ルミナ・アイル' : 'Lumina Isle';
    const lg = logo(name, 3);
    const drop = easeBack(Math.min(1, Math.max(0, (t - INTRO + 0.9) / 0.8)));
    if (drop > 0) {
      const lx = Math.round(vw / 2 - lg.img.width / 2);
      const baseY = Math.round(vh * 0.1);
      const ly = Math.round(baseY - (1 - drop) * (baseY + lg.img.height)) + Math.round(Math.sin(t * 1.3) * 1.5);
      // A soft dark band behind the lettering keeps it legible over the busy harbour.
      const band = ctx.createLinearGradient(0, ly - 20, 0, ly + lg.img.height + 44);
      band.addColorStop(0, 'rgba(20,16,44,0)');
      band.addColorStop(0.4, 'rgba(20,16,44,0.45)');
      band.addColorStop(1, 'rgba(20,16,44,0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, ly - 20, vw, lg.img.height + 64);
      ctx.drawImage(lg.img, lx, ly);
      glint(ctx, lg, lx, ly, t - INTRO);
      sparkle(ctx, lx + lg.img.width - 6, ly + 6, t);
      sparkle(ctx, lx + 10, ly + lg.img.height - 8, t + 1.7);
      const sub = lang === 'ko' || lang === 'ja' ? 'LUMINA ISLE' : '';
      let sy = ly + lg.img.height + 2;
      if (sub) {
        drawText(ctx, sub, vw / 2, sy, { font: 'bold', color: P.brassLight, outline: '#2a1a34', align: 'center', raw: true });
        sy += 15;
      }
      drawText(ctx, '등대 불빛 아래, 작은 섬의 농장 이야기', vw / 2, sy, { font: 'small', color: P.paperLight, outline: '#2a1a34', align: 'center' });
    }

    if (this.mode === 'gate') {
      if (Math.floor((t - INTRO) * 1.6) % 2 === 0) drawText(ctx, '아무 키나 누르세요', vw / 2, Math.round(vh * 0.72), { color: P.paperLight, outline: '#2a1a34', align: 'center' });
    } else if (this.mode === 'menu') this.menu(ctx, vw, vh);
    else if (this.mode === 'load' || this.mode === 'confirm') this.load(ctx, vw, vh);

    // Corners.
    if (this.mode !== 'intro') {
      drawText(ctx, 'v0.2 · LumaRune Studio', vw - 6, vh - 14, { font: 'small', color: P.paperLight, outline: '#2a1a34', align: 'right', raw: true });
      const langName = LANGS.find((l) => l.id === settings.lang)!.name;
      const lw = measure(langName, 'small', true) + 18;
      const r = { x: 6, y: vh - 18, w: lw, h: 14 };
      const hot = ui.hover(r);
      this.globe(ctx, r.x + 2, r.y + 2, hot);
      drawText(ctx, langName, r.x + 15, r.y + 1, { font: 'small', color: hot ? P.brassLight : P.paperLight, outline: '#2a1a34', raw: true });
      if (ui.clicked(r) && !this.child) this.child = new SettingsPanel(this.game);
    }

    if (this.child) this.child.draw(ui, vw, vh);
    if (this.leaving) {
      ctx.fillStyle = `rgba(10,8,20,${Math.min(1, this.leaving.t / 0.45)})`;
      ctx.fillRect(0, 0, vw, vh);
    }
  }

  /** The cloud bank at the bottom of the sky that the camera sinks through. */
  private cloudBank(ctx: CanvasRenderingContext2D, vw: number, y: number, t: number) {
    const cols = ['#7a5a8e', '#a8708e', '#d0908e', '#f0b8a0'];
    // Rows of billows, darker behind, lit in front; each has a lumpy top and a lumpy underside.
    for (let row = 0; row < 4; row++) {
      ctx.fillStyle = cols[row];
      const yy = y - 30 + row * 8;
      for (let x = -20; x < vw + 20; x += 2) {
        const up = Math.sin((x + t * (4 + row * 3)) * 0.07 + row * 1.7) * 6 + Math.sin((x - t * 3) * 0.19 + row) * 2;
        const down = Math.sin((x - t * (3 + row * 2)) * 0.05 + row * 2.3) * 7 + Math.sin((x + t * 2) * 0.23 + row) * 2;
        const top = Math.round(yy - 10 - up);
        const bottom = Math.round(yy + 14 + row * 3 + down);
        ctx.fillRect(x, top, 2, Math.max(0, bottom - top));
      }
    }
  }

  private globe(ctx: CanvasRenderingContext2D, x: number, y: number, hot: boolean) {
    const rows = ['..###..', '.#.#.#.', '#######', '#..#..#', '#######', '.#.#.#.', '..###..'];
    ctx.fillStyle = '#2a1a34';
    rows.forEach((r, j) => {
      for (let i = 0; i < 7; i++) if (r[i] === '#') ctx.fillRect(x + i + 1, y + j + 1, 1, 1);
    });
    ctx.fillStyle = hot ? P.brassLight : P.paperLight;
    rows.forEach((r, j) => {
      for (let i = 0; i < 7; i++) if (r[i] === '#') ctx.fillRect(x + i, y + j, 1, 1);
    });
  }

  private menu(ctx: CanvasRenderingContext2D, vw: number, vh: number) {
    const ui = this.game.ui;
    const input = this.game.input;
    const items = this.items();
    this.sel = Math.min(this.sel, items.length - 1);
    // Keys only once the signs are in (the key that opened the menu mustn't also press a sign).
    if (!this.child && !this.leaving && this.menuT > 0.2) {
      if (input.wasPressed('down')) this.move(1, items.length);
      if (input.wasPressed('up')) this.move(-1, items.length);
      if (input.wasPressed('confirm') || input.keyPressed('Space')) items[this.sel].run();
    }
    const w = 176;
    const h = 24;
    const x0 = Math.round(vw / 2 - w / 2);
    let y = Math.round(vh * 0.5);
    items.forEach((it, i) => {
      // Signs swing in from the left one after another.
      const k = Math.min(1, Math.max(0, (this.menuT - i * 0.07) / 0.35));
      const x = Math.round(x0 - (1 - ease(k)) * (x0 + w + 20));
      const r = { x, y, w, h };
      if (!this.child && !this.leaving && ui.hover(r) && this.sel !== i && input.mouseMovedAt > performance.now() - 50) {
        this.sel = i;
        this.game.audio.play('click', { volume: 0.2, rate: 1.4 });
      }
      signBoard(ctx, x, y, w, h, it.label, it.icon, this.sel === i && k >= 1, this.t);
      if (!this.child && !this.leaving && this.menuT > 0.2 && ui.clicked(r)) it.run();
      y += h + 7;
    });
  }

  private move(d: number, n: number) {
    this.sel = (this.sel + d + n) % n;
    this.game.audio.play('click', { volume: 0.25, rate: 1.3 });
  }

  /** Three save slots as cards: portrait, farm, date, gold, when it was saved; delete with a confirm. */
  private load(ctx: CanvasRenderingContext2D, vw: number, vh: number) {
    const ui = this.game.ui;
    const input = this.game.input;
    const slots = this.slots ?? [null, null, null];
    const W = Math.min(vw - 24, 380);
    const cardH = 52;
    const H = 34 + slots.length * (cardH + 6) + 30;
    const x = Math.round((vw - W) / 2);
    const y = Math.round(Math.min(vh - H - 6, Math.max(vh * 0.44, (vh - H) / 2 + 30)));
    ui.panel({ x, y, w: W, h: H });
    drawText(ctx, '섬 고르기', x + 12, y + 8, { font: 'bold' });
    drawText(ctx, '진행 상황은 자동으로 저장돼요', x + W - 12, y + 10, { font: 'small', color: P.inkSoft, align: 'right' });
    if (this.mode === 'load' && !this.child && !this.leaving) {
      if (input.wasPressed('down')) this.slotSel = (this.slotSel + 1) % slots.length;
      if (input.wasPressed('up')) this.slotSel = (this.slotSel + slots.length - 1) % slots.length;
      if (input.wasPressed('cancel')) this.mode = 'menu';
    }
    slots.forEach((s, i) => {
      const r = { x: x + 10, y: y + 28 + i * (cardH + 6), w: W - 20, h: cardH };
      const hot = this.mode === 'load' && ui.hover(r);
      if (hot) this.slotSel = i;
      const on = this.slotSel === i;
      ctx.fillStyle = P.ink;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = on ? '#fffaf0' : P.paperLight;
      ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      if (on) {
        ctx.fillStyle = P.brass;
        ctx.fillRect(r.x + 1, r.y + 1, 3, r.h - 2);
      }
      // Portrait window.
      ctx.fillStyle = P.ink;
      ctx.fillRect(r.x + 8, r.y + 5, 34, 42);
      ctx.fillStyle = s ? '#bcd8e8' : P.paperShade;
      ctx.fillRect(r.x + 9, r.y + 6, 32, 40);
      if (s) {
        ctx.fillStyle = '#95c776';
        ctx.fillRect(r.x + 9, r.y + 36, 32, 10);
        if (s.look) {
          const img = Sprites.character(s.look).frame('down', -1, 'free', this.t % 3.7 > 3.55).img;
          ctx.drawImage(img, 0, 0, img.width, 22, r.x + 9, r.y + 5, img.width * 2, 44 - 3);
        }
        drawText(ctx, s.farmName, r.x + 50, r.y + 5, { font: 'bold', raw: true, maxWidth: r.w - 150 });
        drawText(ctx, s.name, r.x + 50, r.y + 20, { font: 'small', color: P.inkSoft, raw: true, maxWidth: r.w - 150 });
        drawText(ctx, formatDate(s.day), r.x + 50, r.y + 33, { font: 'small' });
        ctx.drawImage(Sprites.coin(), r.x + r.w - 92, r.y + 7);
        drawText(ctx, formatGold(s.gold), r.x + r.w - 80, r.y + 5, { font: 'bold', raw: true });
        const when = s.savedAt ? new Intl.DateTimeFormat(LANGS.find((l) => l.id === settings.lang)!.locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(s.savedAt)) : '';
        drawText(ctx, when, r.x + r.w - 26, r.y + 22, { font: 'tiny', color: P.inkSoft, align: 'right', raw: true });
        // Delete.
        const d = { x: r.x + r.w - 20, y: r.y + r.h - 18, w: 14, h: 14 };
        const dh = this.mode === 'load' && ui.hover(d);
        ctx.fillStyle = dh ? P.coralDark : P.inkSoft;
        for (let k = 0; k < 7; k++) {
          ctx.fillRect(d.x + 3 + k, d.y + 3 + k, 1, 1);
          ctx.fillRect(d.x + 9 - k, d.y + 3 + k, 1, 1);
        }
        if (dh) ui.tooltip([{ text: '이 섬 지우기', font: 'small' }]);
        if (this.mode === 'load' && ui.clicked(d)) {
          this.deleting = s;
          this.mode = 'confirm';
          return;
        }
      } else {
        drawText(ctx, '빈 자리', r.x + 50, r.y + 12, { color: P.inkSoft });
        drawText(ctx, '여기서 새로운 섬 생활을 시작해요', r.x + 50, r.y + 28, { font: 'small', color: P.inkSoft });
      }
      const go = this.mode === 'load' && !this.leaving && (ui.clicked(r) || (on && (input.wasPressed('confirm') || input.keyPressed('Space'))));
      if (go) this.start(i, !s);
    });
    if (this.mode === 'load' && ui.button({ x: x + W / 2 - 50, y: y + H - 26, w: 100, h: 20 }, '뒤로', { font: 'small' })) this.mode = 'menu';

    if (this.mode === 'confirm' && this.deleting) {
      const s = this.deleting;
      ctx.fillStyle = 'rgba(20,16,44,0.5)';
      ctx.fillRect(0, 0, vw, vh);
      const cw = 280;
      const ch = 92;
      const cx = Math.round((vw - cw) / 2);
      const cy = Math.round((vh - ch) / 2);
      ui.panel({ x: cx, y: cy, w: cw, h: ch });
      drawText(ctx, tr('‘{farm}’ 섬을 지울까요?', { farm: s.farmName }), cx + cw / 2, cy + 12, { font: 'bold', align: 'center', maxWidth: cw - 20 });
      drawText(ctx, '지운 섬은 되돌릴 수 없어요.', cx + cw / 2, cy + 30, { font: 'small', color: P.coralDark, align: 'center' });
      if (ui.button({ x: cx + 20, y: cy + ch - 32, w: 110, h: 22 }, '지우기', { tone: 'coral' })) {
        this.conn?.send({ t: 'deleteSave', slot: s.slot });
        this.deleting = null;
        this.mode = 'load';
        this.game.audio.play('drop', { volume: 0.5 });
      }
      if (ui.button({ x: cx + cw - 130, y: cy + ch - 32, w: 110, h: 22 }, '취소') || input.wasPressed('cancel')) {
        this.deleting = null;
        this.mode = 'load';
      }
    }
  }
}
