import type { Game } from './Game';

export interface Scene {
  enter?(game: Game): void;
  exit?(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
}
