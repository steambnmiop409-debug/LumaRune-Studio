import { LANGS, tr } from '@lumina/core';
import { P, shade } from '../art/palette';
import type { Game } from '../engine/Game';
import { drawText, measure } from '../engine/text';
import { host } from '../platform/host';
import { DEFAULT_KEYS, keyName, resetSettings, settings, updateSettings, type Action, type Settings } from '../settings';
import type { UI } from './kit';
import type { Panel } from './panels';

type Tab = 'general' | 'display' | 'audio' | 'controls' | 'access';
const TABS: Array<[Tab, string]> = [
  ['general', '일반'],
  ['display', '화면'],
  ['audio', '소리'],
  ['controls', '조작'],
  ['access', '접근성'],
];

const ACTIONS: Array<[Action, string]> = [
  ['up', '위로 이동'],
  ['down', '아래로 이동'],
  ['left', '왼쪽으로 이동'],
  ['right', '오른쪽으로 이동'],
  ['run', '달리기'],
  ['use', '도구 사용'],
  ['interact', '상호작용 · 말 걸기'],
  ['inventory', '가방'],
  ['journal', '일지'],
  ['map', '지도'],
  ['confirm', '확인'],
  ['cancel', '메뉴 · 닫기'],
];

const TEXT_SPEEDS = ['느리게', '보통', '빠르게', '즉시'];

/**
 * Settings, laid out like a PC game's options screen: categories down the left, one setting per
 * row with its control on the right. Every change applies at once and is saved.
 */
export class SettingsPanel implements Panel {
  closed = false;
  pauses = true;
  private tab: Tab = 'general';
  /** Waiting for a key to bind: which action and which of its two slots. */
  private binding: { action: Action; slot: number } | null = null;
  private savesDir = '';
  private time = 0;

  constructor(private game: Game) {
    game.audio.play('page', { volume: 0.5 });
    void host?.saves.dir().then((d) => (this.savesDir = d));
    void host?.isFullscreen().then((on) => {
      if (on !== settings.fullscreen) updateSettings({ fullscreen: on });
    });
  }

  update(dt: number): void {
    this.time += dt;
  }

  /** Esc while binding a key cancels the binding instead of closing the screen. */
  onCancel(): boolean {
    if (this.binding) {
      this.binding = null;
      return true;
    }
    return false;
  }

  draw(ui: UI, vw: number, vh: number): void {
    const c = ui.ctx;
    c.fillStyle = 'rgba(20,22,48,0.55)';
    c.fillRect(0, 0, vw, vh);
    const W = Math.min(vw - 16, 470);
    const H = Math.min(vh - 16, 300);
    const x = Math.round((vw - W) / 2);
    const y = Math.round((vh - H) / 2);
    ui.panel({ x, y, w: W, h: H });
    drawText(c, '설정', x + 14, y + 9, { font: 'title' });

    // Categories (as wide as the longest name in this language).
    const tw = Math.min(130, Math.max(92, ...TABS.map(([, l]) => measure(l) + 16)));
    TABS.forEach(([id, label], i) => {
      const r = { x: x + 10, y: y + 36 + i * 26, w: tw, h: 22 };
      const active = this.tab === id;
      const hot = ui.hover(r);
      c.fillStyle = active ? P.ink : hot ? shade(P.paperShade, 1) : 'transparent';
      if (active || hot) c.fillRect(r.x, r.y, r.w, r.h);
      if (active) {
        c.fillStyle = P.brass;
        c.fillRect(r.x, r.y, 3, r.h);
      }
      drawText(c, label, r.x + 10, r.y + 5, { color: active ? P.paperLight : P.ink, maxWidth: r.w - 14 });
      if (ui.clicked(r) && !active) {
        this.tab = id;
        this.binding = null;
        this.game.audio.play('page', { volume: 0.45 });
      }
    });

    const area = { x: x + tw + 20, y: y + 34, w: W - tw - 32, h: H - 70 };
    ui.inset(area);
    const row = { x: area.x + 8, w: area.w - 16, y: area.y + 6 };
    if (this.tab === 'general') this.general(ui, row);
    else if (this.tab === 'display') this.display(ui, row);
    else if (this.tab === 'audio') this.audio(ui, row);
    else if (this.tab === 'controls') this.controls(ui, row, area);
    else this.access(ui, row);

    const by = y + H - 30;
    if (ui.button({ x: x + tw + 20, y: by, w: 120, h: 20 }, this.tab === 'controls' ? '키 설정 초기화' : '기본값으로', { font: 'small' })) {
      resetSettings(this.tab === 'controls' ? 'keys' : 'all');
      this.game.screen.refresh();
      this.game.audio.applyVolumes();
    }
    if (ui.button({ x: x + W - 94, y: by, w: 82, h: 20 }, '닫기', { tone: 'brass' })) this.closed = true;
  }

  // ───────────── rows ─────────────

  /** A row label; returns the x where its control starts. */
  private label(ui: UI, r: { x: number; w: number; y: number }, text: string, note?: string, room = r.w * 0.5): number {
    drawText(ui.ctx, text, r.x, r.y + 3, { font: 'body', maxWidth: room });
    if (note) drawText(ui.ctx, note, r.x, r.y + 16, { font: 'tiny', color: P.inkSoft, maxWidth: r.w });
    return r.x + Math.round(r.w * 0.5);
  }

  /** ◀ value ▶ — steps through a list of choices. */
  private choice<T>(ui: UI, r: { x: number; w: number; y: number }, text: string, options: readonly T[], value: T, show: (v: T) => string, set: (v: T) => void, note?: string) {
    const cx = this.label(ui, r, text, note);
    const cw = r.x + r.w - cx;
    const i = Math.max(0, options.indexOf(value));
    if (ui.arrow(cx, r.y + 2, -1)) set(options[(i + options.length - 1) % options.length]);
    drawText(ui.ctx, show(options[i]), cx + cw / 2, r.y + 3, { align: 'center', maxWidth: cw - 32, raw: true });
    if (ui.arrow(cx + cw - 13, r.y + 2, 1)) set(options[(i + 1) % options.length]);
    r.y += note ? 30 : 22;
  }

  private toggle(ui: UI, r: { x: number; w: number; y: number }, text: string, on: boolean, set: (v: boolean) => void, note?: string) {
    const cx = this.label(ui, r, text, note, r.w - 40 - 12 - measure(on ? '켜짐' : '꺼짐', 'small'));
    const c = ui.ctx;
    const b = { x: r.x + r.w - 40, y: r.y + 1, w: 40, h: 15 };
    const hot = ui.hover(b);
    c.fillStyle = P.ink;
    c.fillRect(b.x, b.y, b.w, b.h);
    c.fillStyle = on ? '#7fb85a' : '#b8ab90';
    c.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    const kx = on ? b.x + b.w - 15 : b.x + 1;
    c.fillStyle = hot ? '#fffaf0' : P.paperLight;
    c.fillRect(kx, b.y + 1, 14, b.h - 2);
    c.fillStyle = P.paperShade;
    c.fillRect(kx, b.y + b.h - 3, 14, 2);
    drawText(c, on ? '켜짐' : '꺼짐', b.x - 6, r.y + 3, { font: 'small', color: P.inkSoft, align: 'right' });
    void cx;
    if (ui.clicked(b)) set(!on);
    r.y += note ? 30 : 22;
  }

  private slider(ui: UI, r: { x: number; w: number; y: number }, text: string, v: number, set: (v: number) => void) {
    const cx = this.label(ui, r, text);
    const c = ui.ctx;
    const b = { x: cx, y: r.y + 5, w: r.x + r.w - cx - 34, h: 8 };
    ui.inset(b);
    c.fillStyle = P.teal;
    c.fillRect(b.x + 1, b.y + 1, Math.round((b.w - 2) * v), b.h - 2);
    c.fillStyle = P.ink;
    c.fillRect(b.x + Math.round((b.w - 3) * v), b.y - 3, 3, b.h + 6);
    drawText(c, `${Math.round(v * 100)}%`, r.x + r.w, r.y + 3, { font: 'small', align: 'right', raw: true });
    const grab = { x: b.x - 4, y: b.y - 5, w: b.w + 8, h: b.h + 10 };
    if (ui.hover(grab) && ui.input.mouseDown[0]) set(Math.max(0, Math.min(1, Math.round(((ui.input.mouseX - b.x) / b.w) * 20) / 20)));
    r.y += 22;
  }

  private heading(ui: UI, r: { x: number; w: number; y: number }, text: string) {
    drawText(ui.ctx, text, r.x, r.y + 2, { font: 'small', color: P.brassDark });
    ui.ctx.fillStyle = P.paperShade;
    ui.ctx.fillRect(r.x, r.y + 13, r.w, 1);
    r.y += 18;
  }

  private general(ui: UI, r: { x: number; w: number; y: number }) {
    this.heading(ui, r, '언어와 표기');
    this.choice(ui, r, '언어 · Language', LANGS.map((l) => l.id), settings.lang, (id) => LANGS.find((l) => l.id === id)!.name, (lang) => updateSettings({ lang }));
    this.choice(ui, r, '시계', [true, false], settings.clock24, (v) => tr(v ? '24시간 (18:30)' : '12시간 (오후 6:30)'), (clock24) => updateSettings({ clock24 }));
    this.choice(ui, r, '온도 단위', ['C', 'F'] as const, settings.tempUnit, (v) => (v === 'C' ? '°C' : '°F'), (tempUnit) => updateSettings({ tempUnit }));
    this.heading(ui, r, '게임');
    this.choice(ui, r, '대사 속도', [0, 1, 2, 3] as const, settings.textSpeed, (v) => tr(TEXT_SPEEDS[v]), (textSpeed) => updateSettings({ textSpeed }));
    this.toggle(ui, r, '조작 도움말', settings.hints, (hints) => updateSettings({ hints }));
    // Where the island is kept.
    const c = ui.ctx;
    drawText(c, '저장 위치', r.x, r.y + 3);
    if (host) {
      drawText(c, this.savesDir, r.x, r.y + 16, { font: 'tiny', color: P.inkSoft, maxWidth: r.w - 60, raw: true });
      if (ui.button({ x: r.x + r.w - 54, y: r.y + 1, w: 54, h: 16 }, '폴더 열기', { font: 'small' })) void host.saves.open();
    } else drawText(c, '이 브라우저 안 (자동 저장)', r.x + r.w, r.y + 3, { font: 'small', color: P.inkSoft, align: 'right' });
  }

  private display(ui: UI, r: { x: number; w: number; y: number }) {
    const screen = this.game.screen;
    this.heading(ui, r, '창');
    const full = host ? settings.fullscreen : !!document.fullscreenElement;
    this.toggle(ui, r, '전체 화면', full, (on) => {
      if (host) void host.setFullscreen(on).then((v) => updateSettings({ fullscreen: v }));
      else if (on !== !!document.fullscreenElement) screen.toggleFullscreen();
    }, 'F11 또는 Alt+Enter');
    const views = [0.8, 0.9, 1, 1.15, 1.3, 1.5];
    this.choice(ui, r, '화면 확대', views, views.reduce((a, b) => (Math.abs(b - settings.viewScale) < Math.abs(a - settings.viewScale) ? b : a)), (v) => `${Math.round(v * 100)}%`, (viewScale) => {
      updateSettings({ viewScale });
      screen.refresh();
    }, '낮출수록 섬이 더 넓게 보여요');
    this.toggle(ui, r, '정수 배율만 사용', settings.pixelPerfect, (pixelPerfect) => {
      updateSettings({ pixelPerfect });
      screen.refresh();
    }, '모든 픽셀 크기가 똑같지만 창 크기에 따라 보이는 범위가 달라져요');
    this.heading(ui, r, '성능');
    this.choice(ui, r, '프레임 제한', [0, 60, 30] as const, settings.fpsCap, (v) => (v ? `${v} FPS` : tr('모니터에 맞춤')), (fpsCap) => updateSettings({ fpsCap }), '노트북에서는 60이나 30으로 배터리를 아낄 수 있어요');
  }

  private audio(ui: UI, r: { x: number; w: number; y: number }) {
    const a = this.game.audio;
    const set = (k: keyof Settings['volumes']) => (v: number) => {
      a.volumes[k] = v;
      a.applyVolumes();
    };
    this.heading(ui, r, '음량');
    this.slider(ui, r, '전체 음량', a.volumes.master, set('master'));
    this.slider(ui, r, '음악', a.volumes.music, set('music'));
    this.slider(ui, r, '효과음', a.volumes.sfx, set('sfx'));
    this.slider(ui, r, '환경음', a.volumes.amb, set('amb'));
    this.heading(ui, r, '기타');
    this.toggle(ui, r, '창이 뒤에 있을 때 음소거', settings.muteUnfocused, (muteUnfocused) => {
      updateSettings({ muteUnfocused });
      a.applyVolumes(false);
    });
  }

  private controls(ui: UI, r: { x: number; w: number; y: number }, area: { x: number; y: number; w: number; h: number }) {
    const c = ui.ctx;
    const input = ui.input;
    // Capture the next key for the slot being rebound.
    if (this.binding) {
      const code = input.anyKeyPressed();
      if (code && code !== 'Escape') {
        const { action, slot } = this.binding;
        const keys = structuredClone(settings.keys);
        if (code === 'Backspace' || code === 'Delete') keys[action].splice(slot, 1);
        else {
          // A key does one thing: take it away from whatever had it.
          for (const a of Object.keys(keys) as Action[]) keys[a] = keys[a].filter((k) => k !== code);
          keys[action][slot] = code;
          keys[action] = keys[action].filter(Boolean);
        }
        // Never leave an action with no key at all.
        for (const a of Object.keys(keys) as Action[]) if (!keys[a].length) keys[a] = [DEFAULT_KEYS[a][0]];
        updateSettings({ keys });
        this.binding = null;
        input.consumed = true;
        this.game.audio.play('click', { volume: 0.5 });
      }
    }
    const rowH = 16;
    const kw = 64;
    drawText(c, '키를 클릭하고 새 키를 누르세요 · Backspace: 지우기', r.x, r.y, { font: 'tiny', color: P.inkSoft, maxWidth: r.w });
    r.y += 12;
    for (const [action, label] of ACTIONS) {
      drawText(c, label, r.x, r.y + 2, { font: 'small', maxWidth: r.w - kw * 2 - 12 });
      for (let slot = 0; slot < 2; slot++) {
        const b = { x: r.x + r.w - kw * (2 - slot) - (1 - slot) * 4, y: r.y, w: kw, h: rowH - 2 };
        const waiting = this.binding?.action === action && this.binding.slot === slot;
        const key = settings.keys[action][slot];
        const hot = ui.hover(b);
        c.fillStyle = P.ink;
        c.fillRect(b.x, b.y, b.w, b.h);
        c.fillStyle = waiting ? P.brassLight : hot ? '#fffaf0' : P.paperLight;
        c.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
        const text = waiting ? (Math.floor(this.time * 3) % 2 ? tr('키 입력…') : '') : key ? keyName(key) : '—';
        drawText(c, text, b.x + b.w / 2, b.y + 2, { font: 'small', align: 'center', color: key || waiting ? P.ink : P.inkSoft, raw: true, maxWidth: b.w - 4 });
        if (ui.clicked(b)) this.binding = { action, slot };
      }
      r.y += rowH;
    }
    drawText(c, '마우스: 좌클릭 도구 · 우클릭 상호작용 · 휠 핫바', area.x + 8, area.y + area.h - 12, { font: 'tiny', color: P.inkSoft, maxWidth: area.w - 16 });
  }

  private access(ui: UI, r: { x: number; w: number; y: number }) {
    this.heading(ui, r, '보기 편하게');
    this.toggle(ui, r, '번개 번쩍임', settings.flashes, (flashes) => updateSettings({ flashes }), '끄면 폭풍우 때 화면이 번쩍이지 않아요');
    this.toggle(ui, r, '큰 마우스 커서', settings.bigCursor, (bigCursor) => updateSettings({ bigCursor }));
    this.heading(ui, r, '조작 편하게');
    this.toggle(ui, r, '항상 달리기', settings.autoRun, (autoRun) => updateSettings({ autoRun }), '켜면 Shift를 누르는 동안 걸어요');
  }
}
