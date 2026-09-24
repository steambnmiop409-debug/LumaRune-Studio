import { Sprites } from '../art/Sprites';
import { CHAR_H, CHAR_W } from '../art/sprites/character';
import type { ViewPlayer } from './WorldView';

/** The sprite a character shows this instant (walk cycle, tool swing, carrying, breathing, blinking). */
export function actorFrame(pl: ViewPlayer, time: number): { img: HTMLCanvasElement; frame: number } {
  const sheet = Sprites.character(pl.look);
  const frame = pl.moving ? Math.floor(pl.animT * 10) % 6 : 0;
  const breathing = Math.floor((time + pl.x * 0.01) / 0.9) % 2 === 1;
  const img = pl.swing
    ? pl.swing.t < 0.35
      ? sheet.raise[pl.dir]
      : sheet.strike[pl.dir]
    : pl.carrying > 0
      ? sheet.carry[pl.dir][pl.moving ? frame : 0]
      : pl.moving
        ? sheet.walk[pl.dir][frame]
        : pl.blink
          ? sheet.blink[pl.dir]
          : breathing
            ? sheet.breathe[pl.dir]
            : sheet.idle[pl.dir];
  return { img, frame };
}

/** Screen position of a character sprite whose feet are at (pl.x, pl.y). */
export function actorPos(pl: ViewPlayer, cx: number, cy: number): [number, number] {
  return [Math.round(pl.x - CHAR_W / 2 - cx), Math.round(pl.y - CHAR_H + 1 - cy)];
}

/** Draws a character with the tool it is swinging and any crates it carries. */
export function drawActor(ctx: CanvasRenderingContext2D, pl: ViewPlayer, img: HTMLCanvasElement, frame: number, px: number, py: number): void {
  const tool = pl.swing ? Sprites.icon(pl.swing.item) : null;
  const toolPos = () => {
    const t = pl.swing!.t;
    const raise = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
    switch (pl.dir) {
      case 'down':
        return [px + 5, py + 4 + Math.round((1 - raise) * 10) - 6];
      case 'up':
        return [px + 2, py - 6 + Math.round((1 - raise) * 4)];
      case 'left':
        return [px - 8 + Math.round((1 - raise) * 2), py + 2 + Math.round((1 - raise) * 8) - 4];
      default:
        return [px + 8 - Math.round((1 - raise) * 2), py + 2 + Math.round((1 - raise) * 8) - 4];
    }
  };
  if (tool && pl.dir === 'up') {
    const [tx, ty] = toolPos();
    ctx.drawImage(tool, tx, ty);
  }
  ctx.drawImage(img, px, py);
  if (tool && pl.dir !== 'up') {
    const [tx, ty] = toolPos();
    ctx.drawImage(tool, tx, ty);
  }
  if (pl.carrying > 0) {
    const bob = pl.moving && (frame === 1 || frame === 4) ? 1 : 0;
    const crate = Sprites.crate('#e8836b');
    for (let i = 0; i < Math.min(pl.carrying, 4); i++) ctx.drawImage(crate, px, py - 11 - i * 9 + bob);
  }
}
