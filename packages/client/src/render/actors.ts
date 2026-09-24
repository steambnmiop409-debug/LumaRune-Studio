import { findItem, holdStyle, type HoldStyle } from '@lumina/core';
import { Sprites } from '../art/Sprites';
import { CHAR_H, CHAR_W, WALK_FRAMES, type FrameInfo, type Pose } from '../art/sprites/character';
import type { ViewPlayer } from './WorldView';

/** Walk frames per second (8 frames ≈ one 0.6 s stride pair). */
const WALK_FPS = 13;

/** How this character holds what's in their hand right now. */
export function heldStyle(pl: ViewPlayer): HoldStyle {
  if (pl.carrying > 0) return 'overhead';
  const def = pl.held ? findItem(pl.held) : undefined;
  return def ? holdStyle(def) : 'none';
}

const POSE: Record<HoldStyle, Pose> = { none: 'free', tool: 'hold', can: 'hold', front: 'lift', overhead: 'carry' };

/** The frame a character shows this instant (walk cycle, tool swing, holding, breathing, blinking). */
export function actorFrame(pl: ViewPlayer, time: number): FrameInfo {
  const sheet = Sprites.character(pl.look);
  if (pl.swing) return sheet.frame(pl.dir, -1, pl.swing.t < 0.35 ? 'raise' : 'strike');
  const walk = pl.moving ? Math.floor(pl.animT * WALK_FPS) % WALK_FRAMES : -1;
  const pose = POSE[heldStyle(pl)];
  const breathing = !pl.moving && Math.floor((time + pl.x * 0.01) / 0.9) % 2 === 1;
  return sheet.frame(pl.dir, walk, pose, !pl.moving && !!pl.blink, breathing && pose === 'free');
}

/** Screen position of a character sprite whose feet are at (pl.x, pl.y). */
export function actorPos(pl: ViewPlayer, cx: number, cy: number): [number, number] {
  return [Math.round(pl.x - CHAR_W / 2 - cx), Math.round(pl.y - CHAR_H + 1 - cy)];
}

function toolOf(id: string): 'hoe' | 'scythe' | 'pick' | 'can' | null {
  if (id.startsWith('tool.can')) return 'can';
  if (id === 'tool.hoe') return 'hoe';
  if (id === 'tool.scythe') return 'scythe';
  if (id === 'tool.pick') return 'pick';
  return null;
}

/**
 * Draws a character with whatever they are holding, layered the way hands work: a tool held in the
 * far hand or behind the back goes under the body; an item held in front goes over it with the hands
 * drawn again on top; things lifted overhead sit above the head; a swinging tool follows the arm.
 */
export function drawActor(ctx: CanvasRenderingContext2D, pl: ViewPlayer, f: FrameInfo, px: number, py: number): void {
  const style = pl.swing ? 'none' : heldStyle(pl);
  const facing = pl.dir;
  const behind = facing === 'up';

  // What goes under the body.
  if (!pl.swing && pl.held && pl.carrying === 0) {
    const tool = toolOf(pl.held);
    if ((style === 'tool' || style === 'can') && tool && behind) drawHeldTool(ctx, pl, f, px, py, tool);
    // From behind, only the top of what's held in front peeks over the shoulders.
    if (style === 'front' && behind) drawIcon(ctx, pl.held, px + f.grip[0] - 8, py + f.grip[1] - 12);
  }
  // A swing: the tool follows the arm through raise and strike.
  const swingIcon = pl.swing ? Sprites.icon(pl.swing.item) : null;
  const swingPos = () => {
    const t = pl.swing!.t;
    const raise = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
    switch (facing) {
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
  if (swingIcon && facing === 'up') {
    const [tx, ty] = swingPos();
    ctx.drawImage(swingIcon, tx, ty);
  }

  ctx.drawImage(f.img, px, py);

  if (swingIcon && facing !== 'up') {
    const [tx, ty] = swingPos();
    ctx.drawImage(swingIcon, tx, ty);
  }
  if (!pl.swing && pl.held && pl.carrying === 0) {
    const tool = toolOf(pl.held);
    if ((style === 'tool' || style === 'can') && tool && !behind) drawHeldTool(ctx, pl, f, px, py, tool);
    if (style === 'front' && !behind) {
      // Hugged against the belly (keeping the face clear), the hands laid over it.
      drawIcon(ctx, pl.held, px + f.grip[0] - 8, py + f.grip[1] - (facing === 'down' ? 5 : 6));
      if (f.hands) ctx.drawImage(f.hands, px, py);
    }
    if (style === 'overhead') drawIcon(ctx, pl.held, px + f.grip[0] - 8, py + f.grip[1] - 12);
  }
  if (pl.carrying > 0) {
    const crate = Sprites.crate('#e8836b');
    for (let i = 0; i < Math.min(pl.carrying, 4); i++) ctx.drawImage(crate, px, py - 3 + f.bob - i * 9 - 8);
  }
}

function drawIcon(ctx: CanvasRenderingContext2D, id: string, x: number, y: number) {
  ctx.drawImage(Sprites.icon(id), Math.round(x), Math.round(y));
}

function drawHeldTool(ctx: CanvasRenderingContext2D, pl: ViewPlayer, f: FrameInfo, px: number, py: number, tool: 'hoe' | 'scythe' | 'pick' | 'can') {
  const side = pl.dir === 'left' || pl.dir === 'right';
  const tier = tool === 'can' ? Number(pl.held!.split('.')[2] ?? 1) : 1;
  const h = Sprites.held(tool, side ? 'side' : 'front', tier);
  const w = h.img.width;
  const y = Math.round(py + f.hand[1] - h.ay);
  if (pl.dir === 'left') {
    // Mirrored: the anchor flips inside the sprite, the hand cell was mirrored by the frame.
    const x = Math.round(px + f.hand[0] + 1 - (w - 1 - h.ax));
    ctx.save();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(h.img, 0, 0);
    ctx.restore();
  } else ctx.drawImage(h.img, Math.round(px + f.hand[0] - h.ax), y);
}
