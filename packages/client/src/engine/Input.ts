import type { Screen } from './Screen';

export type Action =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'use'
  | 'interact'
  | 'journal'
  | 'inventory'
  | 'map'
  | 'cancel'
  | 'confirm'
  | 'run';

const BINDINGS: Record<Action, string[]> = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  use: ['Space', 'KeyC'],
  interact: ['KeyF', 'KeyX'],
  inventory: ['KeyE', 'KeyI'],
  journal: ['Tab'],
  map: ['KeyM'],
  cancel: ['Escape'],
  confirm: ['Enter'],
  run: ['ShiftLeft', 'ShiftRight'],
};

/** Keyboard + mouse state, polled once per frame. Mouse is in logical pixels. */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  mouseX = -100;
  mouseY = -100;
  mouseDown = [false, false, false];
  mousePressed = [false, false, false];
  mouseReleased = [false, false, false];
  wheel = 0;
  /** Characters typed this frame (for text fields). */
  typed = '';
  /** Set when a UI element consumed the click this frame. */
  consumed = false;
  mouseMovedAt = 0;

  constructor(private screen: Screen) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (e.key === 'Backspace') this.typed += '\b';
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) this.typed += e.key;
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener('blur', () => this.down.clear());
    const canvas = screen.canvas;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      const p = this.screen.toLogical(e.clientX, e.clientY);
      this.mouseX = p.x;
      this.mouseY = p.y;
      this.mouseMovedAt = performance.now();
    });
    window.addEventListener('mousedown', (e) => {
      const p = this.screen.toLogical(e.clientX, e.clientY);
      this.mouseX = p.x;
      this.mouseY = p.y;
      if (e.button < 3) {
        this.mouseDown[e.button] = true;
        this.mousePressed[e.button] = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button < 3) {
        this.mouseDown[e.button] = false;
        this.mouseReleased[e.button] = true;
      }
    });
    window.addEventListener(
      'wheel',
      (e) => {
        this.wheel += Math.sign(e.deltaY);
      },
      { passive: true },
    );
  }

  isDown(a: Action): boolean {
    return BINDINGS[a].some((k) => this.down.has(k));
  }

  wasPressed(a: Action): boolean {
    return BINDINGS[a].some((k) => this.pressed.has(k));
  }

  keyPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  keyDown(code: string): boolean {
    return this.down.has(code);
  }

  /** Call at the end of each frame. */
  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
    this.mousePressed = [false, false, false];
    this.mouseReleased = [false, false, false];
    this.wheel = 0;
    this.typed = '';
    this.consumed = false;
  }
}
