import { DEFAULT_WORLD_SEED, TILE, generateDayWeather, Rng, type WorldMap } from '@lumina/core';
import { WorldView, type ViewInput } from '../render/WorldView';

/** A living island vista behind the title and character screens (harbour at dusk, lighthouse lit). */
export class Backdrop {
  readonly map: WorldMap;
  readonly view: WorldView;
  private input: ViewInput;
  private t = 0;

  constructor(map: WorldMap) {
    this.map = map;
    this.view = new WorldView(map);
    const weather = generateDayWeather(new Rng(3), 20, null);
    weather.kind = 'clear';
    weather.precipStart = weather.precipEnd = 0;
    weather.wind = 0.3;
    this.input = { minute: 1112, day: 14, weather, raining: false, soil: {}, placed: [], shipPresent: true, cargo: 6, players: [], forage: {}, boardFresh: false, debris: {} };
    void DEFAULT_WORLD_SEED;
  }

  render(ctx: CanvasRenderingContext2D, vw: number, vh: number, dt: number): void {
    this.t += dt;
    // Slow cinematic pan along the harbour toward the lighthouse, then back.
    const a = (Math.sin(this.t * 0.03 - Math.PI / 2) + 1) / 2;
    const x0 = (this.map.pierEnd.x - 6) * TILE;
    const x1 = (this.map.lighthouse.x - 8) * TILE;
    const cx = x0 + (x1 - x0) * a;
    const cy = (this.map.pierEnd.y - 8) * TILE + Math.sin(this.t * 0.05) * 30;
    this.view.centerOn(cx, cy, vw, vh);
    this.input.minute = 1185 + Math.sin(this.t * 0.02) * 15;
    this.view.update(dt, this.input, vw, vh);
    this.view.render(ctx, vw, vh, this.input);
  }
}
