import { Sprites } from '../art/Sprites';
import { AudioManager } from '../audio/AudioManager';
import { settings } from '../settings';
import { UI } from '../ui/kit';
import { Input } from './Input';
import type { Scene } from './Scene';
import { Screen } from './Screen';

/** Owns the main loop, the screen, input, audio and the active scene. */
export class Game {
  readonly screen: Screen;
  readonly input: Input;
  readonly audio = new AudioManager();
  readonly ui: UI;
  scene: Scene | null = null;
  private last = performance.now();
  time = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.screen = new Screen(canvas);
    this.input = new Input(this.screen);
    this.ui = new UI(this.screen.ctx, this.input);
    this.ui.onClick = () => this.audio.play('click', { volume: 0.45 });
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  setScene(next: Scene): void {
    this.scene?.exit?.();
    this.scene = next;
    next.enter?.(this);
  }

  start(): void {
    const frame = (now: number) => {
      // Frame-rate cap: skip display refreshes that come too soon (a little slack for timer jitter).
      if (settings.fpsCap && now - this.last < 1000 / settings.fpsCap - 2) {
        requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.screen.beginFrame();
      this.last = now;
      this.time += dt;
      const ctx = this.screen.ctx;
      this.ui.ctx = ctx;
      this.ui.beginFrame();
      if (this.scene) {
        this.scene.update(dt);
        this.scene.render(ctx);
      }
      // Pointer.
      if (performance.now() - this.input.mouseMovedAt < 4000) {
        const p = Sprites.pointer();
        const k = settings.bigCursor ? 2 : 1;
        ctx.drawImage(p, this.input.mouseX, this.input.mouseY, p.width * k, p.height * k);
      }
      this.screen.present();
      this.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
