import { CLOTH_COLORS, NPC_BY_ID, TILE, Terrain, WEATHER_NAME, ZONE_NAME, allNpcPoses, formatDate, hash2, type WorldMap } from '@lumina/core';
import { P, mix, shade } from '../art/palette';
import type { AudioManager } from '../audio/AudioManager';
import { drawText, measure } from '../engine/text';
import type { ClientWorld } from '../net/ClientWorld';
import type { UI } from './kit';
import type { Panel } from './panels';

/** Map pixels per tile in the painted map (zoom 1). */
const PX = 2;

const TERRAIN_COLOR: Record<number, string> = {
  [Terrain.Deep]: '#3a6496',
  [Terrain.Sea]: '#5e9ec4',
  [Terrain.River]: '#6cb2c6',
  [Terrain.Pond]: '#6cb2c6',
  [Terrain.Sand]: '#e8d6a2',
  [Terrain.Grass]: '#8ab862',
  [Terrain.Forest]: '#5c8c50',
  [Terrain.Meadow]: '#a8c876',
  [Terrain.Path]: '#d2ae7c',
  [Terrain.Cobble]: '#c8bfb2',
  [Terrain.Rock]: '#a49c94',
  [Terrain.Dock]: '#a87a50',
  [Terrain.Bridge]: '#a87a50',
  [Terrain.Cliff]: '#9a8064',
  [Terrain.Stairs]: '#cfc3ad',
};

let painted: { seed: number; img: HTMLCanvasElement } | null = null;

/**
 * The island painted like a hand-coloured chart: land tinted by ground, gentle relief on the
 * plateaus, cliffs and coasts inked in, trees as little canopies, roofs in their colours.
 */
function paintedMap(map: WorldMap): HTMLCanvasElement {
  if (painted?.seed === map.seed) return painted.img;
  const c = document.createElement('canvas');
  c.width = map.w * PX;
  c.height = map.h * PX;
  const ctx = c.getContext('2d')!;
  const water = (t: number) => t === Terrain.Deep || t === Terrain.Sea || t === Terrain.River || t === Terrain.Pond;
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      const i = y * map.w + x;
      const t = map.terrain[i];
      let col = TERRAIN_COLOR[t] ?? '#000000';
      if (!water(t)) {
        if (map.level[i]) col = mix(col, '#fff4d0', 0.14);
        col = mix(col, hash2(x, y, 3) < 0.5 ? '#ffffff' : '#000000', 0.03);
        // Coastline ink.
        const nb = [map.terrain[i - 1], map.terrain[i + 1], map.terrain[i - map.w], map.terrain[i + map.w]];
        if (nb.some((n) => n === Terrain.Sea || n === Terrain.Deep)) col = mix(col, '#6a5a40', 0.35);
      } else if (t === Terrain.Sea) {
        // Shallows lighter near the shore.
        let near = false;
        for (let d = 1; d <= 2 && !near; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) if (!water(map.terrain[i + dx + dy * map.w] ?? 0)) near = true;
        if (near) col = mix(col, '#a8e0e0', 0.35);
      }
      ctx.fillStyle = col;
      ctx.fillRect(x * PX, y * PX, PX, PX);
      // Cliff faces: a darker lower lip.
      if (t === Terrain.Cliff) {
        ctx.fillStyle = shade(col, 2);
        ctx.fillRect(x * PX, y * PX + PX - 1, PX, 1);
      }
    }
  for (const o of map.objects) {
    if (o.kind === 'oak' || o.kind === 'pine' || o.kind === 'blossom' || o.kind === 'palm' || o.kind === 'fruittree') {
      const base = o.kind === 'blossom' ? '#e8a8b8' : o.kind === 'fruittree' ? '#6aa84a' : o.kind === 'pine' ? '#3e6a3e' : o.kind === 'palm' ? '#5a9a4a' : '#4a7a44';
      ctx.fillStyle = shade(base, 1);
      ctx.fillRect(o.x * PX, o.y * PX + 1, PX, PX);
      ctx.fillStyle = base;
      ctx.fillRect(o.x * PX, o.y * PX, PX, PX - 1 || 1);
    } else if (o.kind === 'rock' || o.kind === 'fence') {
      ctx.fillStyle = o.kind === 'rock' ? '#8a847c' : '#8a6a4a';
      ctx.fillRect(o.x * PX, o.y * PX, 1, 1);
    }
  }
  for (const b of map.buildings) {
    const roof = b.kind === 'seedShop' ? '#4f9a7a' : b.kind === 'toolShop' ? '#4a5a8a' : b.kind === 'lighthouse' ? '#e05a4a' : b.kind === 'windmill' ? '#d8c8a8' : b.kind === 'harborOffice' ? '#4a6aa8' : '#c8604a';
    ctx.fillStyle = '#2b2d4a';
    ctx.fillRect(b.x * PX - 1, b.y * PX - 1, b.w * PX + 2, b.h * PX + 2);
    ctx.fillStyle = roof;
    ctx.fillRect(b.x * PX, b.y * PX, b.w * PX, b.h * PX);
    ctx.fillStyle = mix(roof, '#ffffff', 0.25);
    ctx.fillRect(b.x * PX, b.y * PX, b.w * PX, 1);
  }
  const g = map.greenhouse;
  if (g.w) {
    ctx.fillStyle = '#2b2d4a';
    ctx.fillRect(g.x * PX - 1, g.y * PX - 1, g.w * PX + 2, g.h * PX + 2);
    ctx.fillStyle = '#bfe6ea';
    ctx.fillRect(g.x * PX, g.y * PX, g.w * PX, g.h * PX);
  }
  ctx.fillStyle = '#7a5236';
  ctx.fillRect(map.ship.x * PX, (map.ship.y + 1) * PX, map.ship.w * PX, (map.ship.h - 2) * PX);
  painted = { seed: map.seed, img: c };
  return c;
}

const zoneCentres = new Map<string, { x: number; y: number } | null>();
function zoneCentre(map: WorldMap, id: number): { x: number; y: number } | null {
  const key = `${map.seed}:${id}`;
  if (zoneCentres.has(key)) return zoneCentres.get(key)!;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let i = 0; i < map.zone.length; i++)
    if (map.zone[i] === id) {
      sx += i % map.w;
      sy += Math.floor(i / map.w);
      n++;
    }
  const c = n ? { x: sx / n, y: sy / n } : null;
  zoneCentres.set(key, c);
  return c;
}

type Glyph = 'house' | 'shop' | 'tool' | 'ship' | 'light' | 'cave' | 'glass' | 'board' | 'bench' | 'well' | 'tent' | 'shrine' | 'star';

const GLYPH_COLOR: Record<Glyph, string> = {
  house: '#e8836b',
  shop: '#5aa58a',
  tool: '#5a7ac8',
  ship: '#a87a50',
  light: '#e05a4a',
  cave: '#8a7a6a',
  glass: '#8ad0e0',
  board: '#c89b52',
  bench: '#9a78b0',
  well: '#4fa3c8',
  tent: '#e07a3a',
  shrine: '#c8c0b0',
  star: '#f5c542',
};

const GLYPH_NAME: Record<Glyph, string> = {
  house: '나의 집',
  shop: '들꽃 씨앗방',
  tool: '등불 공방',
  ship: '화물선 부두',
  light: '등대',
  cave: '광산 입구',
  glass: '온실',
  board: '마을 게시판',
  bench: '작업대',
  well: '우물',
  tent: '숲속 야영지',
  shrine: '잊힌 유적',
  star: '은빛 폭포',
};

/** Tiny map icons, 7×7, drawn in ink with a coloured core. */
function drawGlyph(ctx: CanvasRenderingContext2D, g: Glyph, x: number, y: number) {
  const col = GLYPH_COLOR[g];
  ctx.fillStyle = P.ink;
  ctx.fillRect(x - 3, y - 3, 7, 7);
  ctx.fillStyle = P.paperLight;
  ctx.fillRect(x - 2, y - 2, 5, 5);
  ctx.fillStyle = col;
  switch (g) {
    case 'house':
    case 'shop':
    case 'tool':
      ctx.fillRect(x - 2, y, 5, 2);
      ctx.fillRect(x - 1, y - 1, 3, 1);
      ctx.fillRect(x, y - 2, 1, 1);
      break;
    case 'light':
      ctx.fillRect(x - 1, y - 2, 3, 5);
      ctx.fillStyle = '#fff4c8';
      ctx.fillRect(x, y - 2, 1, 1);
      break;
    case 'ship':
      ctx.fillRect(x - 2, y + 1, 5, 1);
      ctx.fillRect(x, y - 2, 1, 3);
      break;
    case 'cave':
      ctx.fillRect(x - 2, y - 1, 5, 3);
      ctx.fillStyle = P.ink;
      ctx.fillRect(x - 1, y, 3, 2);
      break;
    default:
      ctx.fillRect(x - 1, y - 1, 3, 3);
  }
}

/**
 * The island map (M): a painted chart you can zoom (wheel) and drag around, with landmarks,
 * villagers where they are right now, and you. The side bar has the date, weather, where you
 * stand, a legend and who is where.
 */
export class MapPanel implements Panel {
  closed = false;
  pauses = true;
  private time = 0;
  private zoom = 0;
  private cx = 0;
  private cy = 0;
  private dragging: { mx: number; my: number; cx: number; cy: number } | null = null;
  private fitted = false;

  constructor(
    private world: ClientWorld,
    private audio: AudioManager,
  ) {
    audio.play('page', { volume: 0.55 });
    const p = world.self;
    this.cx = p.floor ? world.map.w / 2 : p.x / TILE;
    this.cy = p.floor ? world.map.h / 2 : p.y / TILE;
  }

  update(dt: number): void {
    this.time += dt;
  }

  draw(ui: UI, vw: number, vh: number): void {
    const c = ui.ctx;
    const map = this.world.map;
    const img = paintedMap(map);
    c.fillStyle = 'rgba(20,22,48,0.55)';
    c.fillRect(0, 0, vw, vh);
    const W = Math.min(vw - 16, 900);
    const H = Math.min(vh - 16, 520);
    const x = Math.round((vw - W) / 2);
    const y = Math.round((vh - H) / 2);
    ui.panel({ x, y, w: W, h: H });
    const side = Math.min(170, Math.round(W * 0.3));
    const view = { x: x + 10, y: y + 28, w: W - side - 26, h: H - 38 };
    drawText(c, '루미나 섬 지도', x + 12, y + 8, { font: 'title' });

    // Zoom levels: 0.5×, 1×, 2× of the 2-px-per-tile chart; start with the whole island in view.
    const zooms = [0.5, 1, 2];
    if (!this.fitted) {
      this.fitted = true;
      this.zoom = img.width <= view.w && img.height <= view.h ? 1 : 0;
      if (this.zoom === 0) {
        this.cx = map.w / 2;
        this.cy = map.h / 2;
      }
    }
    const z = zooms[this.zoom] * PX;
    const input = ui.input;
    const inView = input.mouseX >= view.x && input.mouseY >= view.y && input.mouseX < view.x + view.w && input.mouseY < view.y + view.h;
    if (inView) {
      ui.hovering = true;
      if (input.wheel) {
        const nz = Math.max(0, Math.min(zooms.length - 1, this.zoom - Math.sign(input.wheel)));
        if (nz !== this.zoom) {
          // Zoom about the cursor.
          const wx = this.cx + (input.mouseX - view.x - view.w / 2) / z;
          const wy = this.cy + (input.mouseY - view.y - view.h / 2) / z;
          const nzz = zooms[nz] * PX;
          this.cx = wx - (input.mouseX - view.x - view.w / 2) / nzz;
          this.cy = wy - (input.mouseY - view.y - view.h / 2) / nzz;
          this.zoom = nz;
          this.audio.play('click', { volume: 0.3, rate: 1.3 });
        }
      }
      if (input.mousePressed[0]) this.dragging = { mx: input.mouseX, my: input.mouseY, cx: this.cx, cy: this.cy };
    }
    if (this.dragging) {
      if (!input.mouseDown[0]) this.dragging = null;
      else {
        const zz = zooms[this.zoom] * PX;
        this.cx = this.dragging.cx - (input.mouseX - this.dragging.mx) / zz;
        this.cy = this.dragging.cy - (input.mouseY - this.dragging.my) / zz;
      }
    }
    const zz = zooms[this.zoom] * PX;
    const halfW = view.w / 2 / zz;
    const halfH = view.h / 2 / zz;
    this.cx = map.w / 2 <= halfW ? map.w / 2 : Math.max(halfW, Math.min(map.w - halfW, this.cx));
    this.cy = map.h / 2 <= halfH ? map.h / 2 : Math.max(halfH, Math.min(map.h - halfH, this.cy));
    const ox = Math.round(view.x + view.w / 2 - this.cx * zz);
    const oy = Math.round(view.y + view.h / 2 - this.cy * zz);
    const toScreen = (tx: number, ty: number): [number, number] => [Math.round(ox + tx * zz), Math.round(oy + ty * zz)];

    // Sea behind, the chart, then the frame.
    c.save();
    c.beginPath();
    c.rect(view.x, view.y, view.w, view.h);
    c.clip();
    c.fillStyle = '#3a6496';
    c.fillRect(view.x, view.y, view.w, view.h);
    c.imageSmoothingEnabled = false;
    c.drawImage(img, ox, oy, img.width * zooms[this.zoom], img.height * zooms[this.zoom]);
    // Your fields.
    c.fillStyle = '#8a5a3a';
    const sz = Math.max(1, Math.round(zz));
    for (const k of Object.keys(this.world.soil)) {
      const n = Number(k);
      const [sx, sy] = toScreen(n % map.w, Math.floor(n / map.w));
      c.fillRect(sx, sy, sz, sz);
    }

    // Landmarks.
    const marks: Array<{ g: Glyph; x: number; y: number }> = [];
    const home = map.buildings.find((b) => b.kind === 'house');
    if (home) marks.push({ g: 'house', x: home.x + home.w / 2, y: home.y + home.h / 2 });
    for (const it of map.interactables) {
      if (it.kind === 'seedShop') marks.push({ g: 'shop', x: it.x, y: it.y - 2 });
      else if (it.kind === 'toolShop') marks.push({ g: 'tool', x: it.x, y: it.y - 2 });
      else if (it.kind === 'cave') marks.push({ g: 'cave', x: it.x, y: it.y });
      else if (it.kind === 'board') marks.push({ g: 'board', x: it.x, y: it.y });
      else if (it.kind === 'greenhouse') marks.push({ g: 'glass', x: it.x, y: it.y - 2 });
    }
    marks.push({ g: 'ship', x: map.pierEnd.x, y: map.pierEnd.y }, { g: 'light', x: map.lighthouse.x + 1, y: map.lighthouse.y + 1 });
    const tent = map.objects.find((o) => o.kind === 'tent');
    if (tent) marks.push({ g: 'tent', x: tent.x + 1, y: tent.y });
    const shrine = map.objects.find((o) => o.kind === 'shrine');
    if (shrine) marks.push({ g: 'shrine', x: shrine.x + 1, y: shrine.y });
    if (map.falls[0] !== undefined) marks.push({ g: 'star', x: map.falls[0] % map.w, y: Math.floor(map.falls[0] / map.w) });
    for (const m of marks) {
      const [sx, sy] = toScreen(m.x, m.y);
      drawGlyph(c, m.g, sx, sy);
    }

    // Zone names; ones that would overlap a name already placed are skipped.
    const taken: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (const [zid, name] of Object.entries(ZONE_NAME)) {
      const id = Number(zid);
      if (!id) continue;
      const cen = zoneCentre(map, id);
      if (!cen) continue;
      const [sx, sy] = toScreen(cen.x, cen.y);
      const lw = measure(name, 'small') + 4;
      const r = { x: sx - lw / 2, y: sy - 12, w: lw, h: 11 };
      if (taken.some((q) => r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h)) continue;
      taken.push(r);
      drawText(c, name, sx, sy - 12, { font: 'small', color: P.ink, outline: P.paperLight, align: 'center' });
    }

    // Villagers and you.
    const minute = this.world.minute(true);
    const poses = this.world.self.floor ? [] : allNpcPoses(map, minute);
    for (const n of poses) {
      const def = NPC_BY_ID.get(n.id)!;
      const [sx, sy] = toScreen(n.x / TILE, n.y / TILE);
      c.fillStyle = P.ink;
      c.fillRect(sx - 2, sy - 5, 5, 5);
      c.fillRect(sx, sy, 1, 2);
      c.fillStyle = CLOTH_COLORS[def.look.topColor];
      c.fillRect(sx - 1, sy - 4, 3, 3);
    }
    const me = this.world.self;
    if (!me.floor) {
      const [px, py] = toScreen(me.x / TILE, me.y / TILE);
      const pulse = Math.floor(this.time * 4) % 4;
      c.strokeStyle = 'rgba(232,131,107,0.8)';
      c.strokeRect(px - 3 - pulse, py - 3 - pulse, 7 + pulse * 2, 7 + pulse * 2);
      c.fillStyle = P.ink;
      c.fillRect(px - 3, py - 3, 7, 7);
      c.fillStyle = P.coral;
      c.fillRect(px - 2, py - 2, 5, 5);
      c.fillStyle = P.white;
      c.fillRect(px - 1, py - 1, 2, 2);
    }

    // Compass rose.
    const rx = view.x + view.w - 22;
    const ry = view.y + 22;
    c.fillStyle = 'rgba(251,241,220,0.85)';
    c.fillRect(rx - 13, ry - 13, 27, 27);
    c.fillStyle = P.ink;
    c.fillRect(rx, ry - 10, 1, 21);
    c.fillRect(rx - 10, ry, 21, 1);
    c.fillStyle = P.coralDark;
    c.fillRect(rx - 1, ry - 10, 3, 6);
    drawText(c, 'N', rx + 1, ry - 12, { font: 'tiny', color: P.ink, align: 'center' });
    c.restore();
    c.fillStyle = P.ink;
    c.strokeStyle = P.ink;
    c.strokeRect(view.x - 0.5, view.y - 0.5, view.w + 1, view.h + 1);

    // Hover: the place and anything notable there.
    if (inView && !this.dragging) {
      const hx = Math.floor(this.cx + (input.mouseX - view.x - view.w / 2) / zz);
      const hy = Math.floor(this.cy + (input.mouseY - view.y - view.h / 2) / zz);
      if (hx >= 0 && hy >= 0 && hx < map.w && hy < map.h) {
        const lines: Array<{ text: string; font?: 'small' | 'bold'; color?: string }> = [];
        const zid = map.zone[hy * map.w + hx] as keyof typeof ZONE_NAME;
        lines.push({ text: ZONE_NAME[zid] ?? '루미나 섬', font: 'bold' });
        const near = 3 / zooms[this.zoom];
        for (const m of marks) if (Math.abs(m.x - hx) < near && Math.abs(m.y - hy) < near) lines.push({ text: GLYPH_NAME[m.g], font: 'small', color: P.brassDark });
        for (const n of poses) if (Math.abs(n.x / TILE - hx) < near && Math.abs(n.y / TILE - hy) < near) lines.push({ text: NPC_BY_ID.get(n.id)!.name, font: 'small', color: P.tealDark });
        if (!me.floor && Math.abs(me.x / TILE - hx) < near && Math.abs(me.y / TILE - hy) < near) lines.push({ text: '현재 위치', font: 'small', color: P.coralDark });
        ui.tooltip(lines);
      }
    }

    // Side bar.
    const sx = view.x + view.w + 10;
    let sy = view.y;
    const sw = side;
    ui.inset({ x: sx, y: sy, w: sw, h: view.h });
    sy += 6;
    drawText(c, formatDate(this.world.clock.day), sx + 8, sy, { font: 'bold' });
    sy += 14;
    drawText(c, `${WEATHER_NAME[this.world.weather.kind]} · ${Math.round(this.world.weather.meanTemp)}°C`, sx + 8, sy, { font: 'small', color: P.inkSoft });
    sy += 14;
    const here = me.floor ? `광산 ${me.floor}층` : ZONE_NAME[map.zone[Math.floor(me.y / TILE) * map.w + Math.floor(me.x / TILE)] as keyof typeof ZONE_NAME] ?? '루미나 섬';
    drawText(c, `지금: ${here}`, sx + 8, sy, { font: 'small', color: P.coralDark });
    sy += 16;
    c.fillStyle = P.paperShade;
    c.fillRect(sx + 6, sy, sw - 12, 1);
    sy += 5;
    drawText(c, '주민', sx + 8, sy, { font: 'small', color: P.inkSoft });
    sy += 12;
    const allPoses = allNpcPoses(map, minute);
    for (const n of allPoses) {
      const def = NPC_BY_ID.get(n.id)!;
      c.fillStyle = P.ink;
      c.fillRect(sx + 8, sy + 2, 5, 5);
      c.fillStyle = CLOTH_COLORS[def.look.topColor];
      c.fillRect(sx + 9, sy + 3, 3, 3);
      const zone = ZONE_NAME[map.zone[Math.floor(n.y / TILE) * map.w + Math.floor(n.x / TILE)] as keyof typeof ZONE_NAME] ?? '';
      const nw = drawText(c, def.name, sx + 17, sy, { font: 'small' });
      drawText(c, n.moving ? `${zone}로 가는 중` : zone, sx + 21 + nw, sy, { font: 'small', color: P.inkSoft });
      sy += 12;
    }
    sy += 4;
    c.fillStyle = P.paperShade;
    c.fillRect(sx + 6, sy, sw - 12, 1);
    sy += 5;
    drawText(c, '범례', sx + 8, sy, { font: 'small', color: P.inkSoft });
    sy += 12;
    const legend: Glyph[] = ['house', 'shop', 'tool', 'ship', 'cave', 'glass', 'light'];
    for (const g of legend) {
      if (sy > view.y + view.h - 40) break;
      drawGlyph(c, g, sx + 11, sy + 4);
      drawText(c, GLYPH_NAME[g], sx + 19, sy, { font: 'small' });
      sy += 11;
    }
    // Controls.
    const by = view.y + view.h - 26;
    if (ui.button({ x: sx + 6, y: by, w: 56, h: 20 }, '내 위치', { font: 'small' }) && !me.floor) {
      this.cx = me.x / TILE;
      this.cy = me.y / TILE;
      if (this.zoom === 0) this.zoom = 1;
    }
    if (ui.button({ x: sx + 66, y: by, w: 22, h: 20 }, '+') && this.zoom < zooms.length - 1) this.zoom++;
    if (ui.button({ x: sx + 92, y: by, w: 22, h: 20 }, '-') && this.zoom > 0) this.zoom--;
    drawText(c, '휠: 확대 · 끌기: 이동', x + W - 12, y + 12, { font: 'small', color: P.inkSoft, align: 'right' });
  }
}
