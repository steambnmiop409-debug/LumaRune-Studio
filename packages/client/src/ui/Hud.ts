import {
  HOTBAR_SIZE,
  SHIP_DEPARTURE,
  WEATHER_NAME,
  findCrop,
  formatDate,
  formatTime,
  getItem,
  isPrecipitating,
  temperatureAt,
  type CargoCrate,
  type DayWeather,
  type PlayerState,
} from '@lumina/core';
import { Sprites } from '../art/Sprites';
import { P, mix } from '../art/palette';
import { drawText, measure } from '../engine/text';
import { formatGold, type UI } from './kit';

const SKY: Array<[number, string, string]> = [
  [0, '#141633', '#2a2d5a'],
  [300, '#1c1f45', '#3a3a6a'],
  [360, '#3a3a78', '#e8a0a0'],
  [420, '#6aa8d8', '#f8d8b0'],
  [540, '#5aa8e0', '#bfe4f4'],
  [960, '#5aa8e0', '#c8e8f4'],
  [1050, '#6a88c8', '#f8c890'],
  [1110, '#4a5aa0', '#f09070'],
  [1170, '#2a2d6a', '#9a6aa0'],
  [1260, '#161838', '#2a2d5a'],
  [1600, '#141633', '#2a2d5a'],
];

function skyColors(minute: number, w: DayWeather): [string, string] {
  let top = SKY[0][1];
  let bot = SKY[0][2];
  for (let i = 0; i < SKY.length - 1; i++) {
    const [m0, t0, b0] = SKY[i];
    const [m1, t1, b1] = SKY[i + 1];
    if (minute >= m0 && minute <= m1) {
      const t = (minute - m0) / (m1 - m0);
      top = mix(t0, t1, t);
      bot = mix(b0, b1, t);
    }
  }
  const grey = w.kind === 'storm' ? 0.65 : w.kind === 'rain' ? 0.5 : w.kind === 'cloudy' || w.kind === 'snow' ? 0.35 : w.kind === 'fog' ? 0.4 : 0;
  if (grey) {
    top = mix(top, '#707890', grey);
    bot = mix(bot, '#a0a8b8', grey);
  }
  return [top, bot];
}

export interface Toast {
  text: string;
  tone: 'info' | 'good' | 'warn';
  t: number;
  icon?: HTMLCanvasElement;
}

/**
 * The always-visible HUD: Sky Dial (time, weather, temperature, ship countdown),
 * money pouch, rope hotbar, stamina leaf, carried crates, letters (toasts) and zone banner.
 */
export class Hud {
  toasts: Toast[] = [];
  private shownGold = 0;
  private nameTag: { text: string; t: number } | null = null;
  private banner: { text: string; t: number } | null = null;
  private lastSel = -1;

  toast(text: string, tone: Toast['tone'] = 'info', icon?: HTMLCanvasElement): void {
    this.toasts.push({ text, tone, t: 0, icon });
    if (this.toasts.length > 5) this.toasts.shift();
  }

  showBanner(text: string): void {
    this.banner = { text, t: 0 };
  }

  update(dt: number, gold: number): void {
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < 4.2);
    if (this.nameTag) {
      this.nameTag.t += dt;
      if (this.nameTag.t > 1.4) this.nameTag = null;
    }
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > 3) this.banner = null;
    }
    const diff = gold - this.shownGold;
    this.shownGold += Math.abs(diff) < 1 ? diff : diff * Math.min(1, dt * 6);
  }

  setGoldInstant(g: number): void {
    this.shownGold = g;
  }

  /** Top-right: the Sky Dial. Returns true when hovered (shows the forecast). */
  skyDial(ui: UI, vw: number, minute: number, day: number, weather: DayWeather, forecast: DayWeather, shipPresent: boolean, departed: boolean, gold: number, time: number): void {
    const ctx = ui.ctx;
    const W = 132;
    const x = vw - W - 6;
    const y = 6;
    ui.panel({ x, y, w: W, h: 50 });
    // Semicircular sky window.
    const cx = x + 30;
    const cy = y + 40;
    const R = 23;
    const [top, bot] = skyColors(minute, weather);
    for (let yy = 0; yy <= R; yy++) {
      const half = Math.floor(Math.sqrt(R * R - (R - yy) * (R - yy)));
      ctx.fillStyle = mix(top, bot, yy / R);
      ctx.fillRect(cx - half, cy - R + yy, half * 2, 1);
    }
    const night = minute < 330 || minute > 1180;
    if (night)
      for (let i = 0; i < 9; i++) {
        const sx = cx - 18 + ((i * 37) % 36);
        const sy = cy - 20 + ((i * 17) % 16);
        if (Math.hypot(sx - cx, sy - cy) < R - 2 && Math.sin(time * 2 + i) > -0.4) {
          ctx.fillStyle = '#fff8d0';
          ctx.fillRect(sx, sy, 1, 1);
        }
      }
    // Sun (06:00–19:00) or moon travelling along the arc.
    const sunT = (minute - 360) / (1140 - 360);
    const moonT = ((minute < 360 ? minute + 1440 : minute) - 1140) / (1800 - 1140);
    const body = sunT >= 0 && sunT <= 1 ? { t: sunT, sun: true } : { t: Math.max(0, Math.min(1, moonT)), sun: false };
    const ang = Math.PI * (1 - body.t);
    const bx = Math.round(cx + Math.cos(ang) * (R - 7));
    const by = Math.round(cy - Math.sin(ang) * (R - 7));
    if (weather.kind !== 'storm' && weather.kind !== 'rain') {
      ctx.fillStyle = body.sun ? '#ffe070' : '#f4f0dc';
      ctx.fillRect(bx - 2, by - 3, 5, 7);
      ctx.fillRect(bx - 3, by - 2, 7, 5);
      if (!body.sun) {
        ctx.fillStyle = mix(top, bot, 0.3);
        ctx.fillRect(bx, by - 2, 3, 4);
      }
    }
    // Weather inside the window.
    const raining = isPrecipitating(weather, minute);
    if (weather.kind !== 'clear') {
      const n = weather.kind === 'cloudy' ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const ox = ((time * 3 + i * 17) % 50) - 25;
        const col = weather.kind === 'storm' || weather.kind === 'rain' ? '#8a90a8' : '#f4f6fa';
        ctx.fillStyle = col;
        const px = Math.round(cx + ox);
        const py = cy - 16 + i * 5;
        ctx.fillRect(px - 5, py, 11, 3);
        ctx.fillRect(px - 3, py - 2, 6, 2);
      }
    }
    if (raining) {
      ctx.fillStyle = weather.kind === 'snow' ? '#ffffff' : '#a8d0f0';
      for (let i = 0; i < 12; i++) {
        const rx = cx - 18 + ((i * 29) % 36);
        const ry = cy - 12 + ((Math.floor(time * 40) + i * 7) % 12);
        if (Math.hypot(rx - cx, ry - cy) < R - 1) ctx.fillRect(rx, ry, 1, weather.kind === 'snow' ? 1 : 2);
      }
    }
    if (weather.kind === 'fog') {
      ctx.fillStyle = 'rgba(230,234,240,0.55)';
      ctx.fillRect(cx - R + 2, cy - 8, R * 2 - 4, 3);
      ctx.fillRect(cx - R + 5, cy - 3, R * 2 - 10, 2);
    }
    // Brass rim.
    ctx.fillStyle = P.brassDark;
    ctx.fillRect(cx - R - 1, cy, R * 2 + 2, 2);
    ctx.fillStyle = P.brass;
    ctx.fillRect(cx - R - 1, cy, R * 2 + 2, 1);

    const tx = x + 60;
    drawText(ctx, formatTime(minute), tx, y + 5, { font: 'bold' });
    drawText(ctx, formatDate(day), tx, y + 19, { font: 'small' });
    const temp = Math.round(temperatureAt(weather, minute));
    ctx.drawImage(Sprites.weather(weather.kind), tx - 1, y + 33);
    drawText(ctx, `${temp}°C ${WEATHER_NAME[weather.kind]}`, tx + 14, y + 33, { font: 'small' });

    // Ship chip.
    const chip = { x: vw - W - 6, y: y + 52, w: W, h: 15 };
    const left = SHIP_DEPARTURE - minute;
    const urgent = shipPresent && !departed && left > 0 && left <= 60;
    ui.ctx.fillStyle = P.ink;
    ui.ctx.fillRect(chip.x, chip.y, chip.w, chip.h);
    ui.ctx.fillStyle = urgent && Math.floor(time * 3) % 2 ? P.brassLight : '#e8d8b2';
    ui.ctx.fillRect(chip.x + 1, chip.y + 1, chip.w - 2, chip.h - 2);
    const shipText = shipPresent && !departed && left > 0 ? `출항까지 ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : '배는 내일 06:00 도착';
    drawText(ctx, `⚓ ${shipText}`, chip.x + 6, chip.y + 2, { font: 'small', color: urgent ? P.coralDark : P.ink });

    // Money pouch.
    const mx = vw - 6 - 86;
    const my = chip.y + 18;
    ui.panel({ x: mx, y: my, w: 86, h: 18 });
    ctx.drawImage(Sprites.coin(), mx + 5, my + 5);
    drawText(ctx, formatGold(this.shownGold), mx + 80, my + 3, { font: 'bold', align: 'right' });
    void gold;

    if (ui.hover({ x, y, w: W, h: 50 })) {
      ui.tooltip(
        [
          { text: '내일 날씨', font: 'bold' },
          { text: `${WEATHER_NAME[forecast.kind]} · ${Math.round(forecast.minTemp)}~${Math.round(forecast.maxTemp)}°C` },
          { text: forecast.kind === 'rain' || forecast.kind === 'storm' ? '비에 약한 작물은 비가림막으로 지켜 주세요.' : forecast.minTemp < 0 ? '서리 주의! 추위에 약한 작물이 위험해요.' : '밭일하기 좋은 날이에요.', font: 'small', color: P.inkSoft },
        ],
        x - 150,
        y + 54,
      );
    }
  }

  hotbar(ui: UI, vw: number, vh: number, p: PlayerState, onSelect: (i: number) => void): void {
    const ctx = ui.ctx;
    const gap = 3;
    const w = HOTBAR_SIZE * 22 + (HOTBAR_SIZE - 1) * gap;
    const x0 = Math.round((vw - w) / 2);
    const y0 = vh - 28;
    if (p.sel !== this.lastSel) {
      if (this.lastSel >= 0 && p.inv[p.sel]) this.nameTag = { text: getItem(p.inv[p.sel]!.id).name, t: 0 };
      this.lastSel = p.sel;
    }
    // Rope.
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(x0 - 6, y0 + 11, w + 12, 2);
    ctx.fillStyle = '#b89668';
    for (let x = x0 - 6; x < x0 + w + 6; x += 3) ctx.fillRect(x, y0 + 11, 1, 1);
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const x = x0 + i * (22 + gap);
      const sel = p.sel === i;
      const y = y0 - (sel ? 3 : 0);
      if (i > 0) {
        ctx.fillStyle = '#6e5234';
        ctx.fillRect(x - 3, y0 + 9, 3, 6);
        ctx.fillStyle = '#a8845a';
        ctx.fillRect(x - 2, y0 + 10, 1, 4);
      }
      const hot = ui.slot(x, y, p.inv[i], sel);
      drawText(ctx, String((i + 1) % 10), x + 2, y + 1, { font: 'small', color: sel ? P.brassDark : '#a8987a' });
      if (hot && p.inv[i]) {
        const def = getItem(p.inv[i]!.id);
        ui.tooltip([{ text: def.name, font: 'bold' }], x - 10, y - 24);
      }
      if (ui.clicked({ x, y, w: 22, h: 22 })) onSelect(i);
    }
    if (this.nameTag) {
      const a = Math.min(1, (1.4 - this.nameTag.t) * 3);
      ctx.globalAlpha = a;
      const tw = measure(this.nameTag.text) + 12;
      const tx = Math.round(vw / 2 - tw / 2);
      ui.panel({ x: tx, y: y0 - 26, w: tw, h: 18 });
      drawText(ctx, this.nameTag.text, vw / 2, y0 - 23, { align: 'center' });
      ctx.globalAlpha = 1;
    }
  }

  stamina(ui: UI, vw: number, vh: number, p: PlayerState): void {
    const ctx = ui.ctx;
    const x = vw - 22;
    const y = vh - 72;
    const h = 60;
    ui.panel({ x, y, w: 14, h: h + 6 });
    const t = p.stamina / p.maxStamina;
    const fill = Math.round((h - 6) * t);
    ctx.fillStyle = '#3a3c5e';
    ctx.fillRect(x + 4, y + 4, 6, h - 6);
    ctx.fillStyle = t > 0.5 ? '#7fb85a' : t > 0.2 ? P.brass : P.coral;
    ctx.fillRect(x + 4, y + 4 + (h - 6 - fill), 6, fill);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + 5, y + 4 + (h - 6 - fill), 1, fill);
    // Leaf emblem.
    ctx.fillStyle = '#5e9a4a';
    ctx.fillRect(x + 4, y + h + 1, 6, 3);
    ctx.fillRect(x + 5, y + h, 4, 5);
    if (ui.hover({ x, y, w: 14, h: h + 6 })) ui.tooltip([{ text: `체력 ${p.stamina}/${p.maxStamina}`, font: 'bold' }, { text: '잠을 자면 회복돼요.', font: 'small' }], x - 110, y);
  }

  carrying(ui: UI, vw: number, vh: number, crates: CargoCrate[], cart: boolean): void {
    if (!crates.length) return;
    const ctx = ui.ctx;
    const w = 128;
    const x = Math.round(vw / 2 - w / 2);
    const y = vh - 28 - 44;
    ui.panel({ x, y, w, h: 38 });
    drawText(ctx, `운반 중 (${crates.length}/${cart ? 4 : 1})`, x + 6, y + 4, { font: 'small', color: P.inkSoft });
    crates.slice(0, 4).forEach((c, i) => {
      const cx = x + 6 + i * 30;
      ctx.drawImage(Sprites.crate('#e8836b'), cx, y + 17);
      ctx.drawImage(Sprites.icon(`crop.${c.cropId}`), cx + 12, y + 14);
      drawText(ctx, String(c.qty), cx + 29, y + 24, { font: 'small', color: P.white, outline: P.ink, align: 'right' });
    });
    if (crates.length === 1) {
      const c = crates[0];
      drawText(ctx, `${findCrop(c.cropId)?.name} ★${c.q}`, x + 46, y + 20, { font: 'small' });
    }
  }

  drawToasts(ui: UI): void {
    const ctx = ui.ctx;
    let y = 8;
    for (const t of this.toasts) {
      const w = Math.min(260, measure(t.text) + 30);
      const slide = t.t < 0.25 ? (1 - t.t / 0.25) * -w : t.t > 3.8 ? ((t.t - 3.8) / 0.4) * -w : 0;
      const x = Math.round(8 + slide);
      ui.panel({ x, y, w, h: 20 });
      // Wax seal.
      ctx.fillStyle = t.tone === 'good' ? '#5a9a6a' : t.tone === 'warn' ? P.coralDark : P.tealDark;
      ctx.fillRect(x + 6, y + 6, 8, 8);
      ctx.fillRect(x + 5, y + 7, 10, 6);
      if (t.icon) ctx.drawImage(t.icon, x + 2, y + 2);
      drawText(ctx, t.text, x + 20, y + 4, { font: 'body' });
      y += 23;
    }
  }

  drawBanner(ui: UI, vw: number, vh: number): void {
    if (!this.banner) return;
    const ctx = ui.ctx;
    const t = this.banner.t;
    const a = t < 0.5 ? t / 0.5 : t > 2.4 ? (3 - t) / 0.6 : 1;
    ctx.globalAlpha = Math.max(0, a);
    const w = measure(this.banner.text, 'title') + 40;
    const x = Math.round(vw / 2 - w / 2);
    const by = Math.round(vh * 0.26);
    ctx.fillStyle = 'rgba(43,45,74,0.55)';
    ctx.fillRect(x, by, w, 24);
    ctx.fillStyle = P.brass;
    ctx.fillRect(x + 6, by + 12, 10, 1);
    ctx.fillRect(x + w - 16, by + 12, 10, 1);
    drawText(ctx, this.banner.text, vw / 2, by + 3, { font: 'title', color: P.paperLight, align: 'center' });
    ctx.globalAlpha = 1;
  }
}
