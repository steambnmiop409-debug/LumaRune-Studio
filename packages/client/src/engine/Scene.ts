import type { Game } from './Game';

export interface Scene {
  enter?(game: Game): void;
  exit?(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  /** Writes any unsaved progress to disk; resolves true once it's safely there. */
  save?(): Promise<boolean>;
}
