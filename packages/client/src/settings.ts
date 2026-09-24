import { detectLang, setLang, type Lang } from '@lumina/core';
import { host } from './platform/host';

/** Things the player can do, each bound to up to two keys. */
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

export const DEFAULT_KEYS: Record<Action, string[]> = {
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

export interface Settings {
  lang: Lang;
  /** How much of the island fits on screen: 1 = the 640×360 design view; bigger zooms in. */
  viewScale: number;
  /** Whole-number pixel scales only (every pixel exactly the same size; the framing then varies). */
  pixelPerfect: boolean;
  fullscreen: boolean;
  /** Frame-rate cap: 0 = the display's refresh rate. */
  fpsCap: 0 | 30 | 60;
  volumes: { master: number; music: number; sfx: number; amb: number };
  /** Silence the game while its window isn't focused. */
  muteUnfocused: boolean;
  keys: Record<Action, string[]>;
  clock24: boolean;
  tempUnit: 'C' | 'F';
  /** Key hints at the bottom of the screen and first-day tips. */
  hints: boolean;
  /** Dialogue text: 0 slow … 3 instant. */
  textSpeed: 0 | 1 | 2 | 3;
  /** Lightning flashes the whole screen during storms. */
  flashes: boolean;
  /** Hold Shift to walk instead of to run. */
  autoRun: boolean;
  /** Draw the mouse pointer at twice the size. */
  bigCursor: boolean;
}

function defaults(): Settings {
  const lang = detectLang(navigator.languages ?? [navigator.language]);
  return {
    lang,
    viewScale: 1,
    pixelPerfect: false,
    fullscreen: false,
    fpsCap: 0,
    volumes: { master: 0.8, music: 0.55, sfx: 0.8, amb: 0.7 },
    muteUnfocused: false,
    keys: structuredClone(DEFAULT_KEYS),
    clock24: lang !== 'en',
    tempUnit: lang === 'en' ? 'F' : 'C',
    hints: true,
    textSpeed: 1,
    flashes: true,
    autoRun: false,
    bigCursor: false,
  };
}

const KEY = 'lumina:settings';

/** The player's settings. Mutate through update() so listeners hear about it and it's saved. */
export const settings: Settings = defaults();
const listeners: Array<(s: Settings) => void> = [];

function merge(raw: unknown) {
  if (!raw || typeof raw !== 'object') return;
  const r = raw as Partial<Settings>;
  const d = defaults();
  Object.assign(settings, d, r);
  settings.volumes = { ...d.volumes, ...(r.volumes ?? {}) };
  settings.keys = { ...d.keys };
  for (const a of Object.keys(d.keys) as Action[]) {
    const k = r.keys?.[a];
    if (Array.isArray(k) && k.every((x) => typeof x === 'string')) settings.keys[a] = k.slice(0, 2);
  }
}

/**
 * Reads settings: the desktop app keeps them in settings.json next to the saves, a browser in
 * localStorage. Settings from before this file existed (zoom, volumes) are carried over.
 */
export async function loadSettings(): Promise<void> {
  let text: string | null = null;
  try {
    text = host ? await host.settings.load() : localStorage.getItem(KEY);
  } catch {
    text = null;
  }
  if (text) {
    try {
      merge(JSON.parse(text));
    } catch {
      /* damaged: keep defaults */
    }
  } else {
    try {
      const vol = localStorage.getItem('lumina:volumes');
      if (vol) Object.assign(settings.volumes, JSON.parse(vol));
    } catch {
      /* storage unavailable */
    }
  }
  setLang(settings.lang);
}

let timer = 0;
function persist() {
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    const text = JSON.stringify(settings, null, 1);
    try {
      if (host) void host.settings.save(text).catch(() => {});
      else localStorage.setItem(KEY, text);
    } catch {
      /* storage unavailable */
    }
  }, 250);
}

export function updateSettings(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  if (patch.lang) setLang(patch.lang);
  persist();
  for (const f of listeners) f(settings);
}

export function onSettings(f: (s: Settings) => void): void {
  listeners.push(f);
}

export function resetSettings(part: 'keys' | 'all'): void {
  const d = defaults();
  if (part === 'keys') updateSettings({ keys: d.keys });
  else updateSettings({ ...d, lang: settings.lang });
}

/** A key code as the player would name it (KeyW → W, ShiftLeft → L-Shift). */
export function keyName(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const names: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Space: 'Space',
    Enter: 'Enter',
    Escape: 'Esc',
    Tab: 'Tab',
    ShiftLeft: 'L-Shift',
    ShiftRight: 'R-Shift',
    ControlLeft: 'L-Ctrl',
    ControlRight: 'R-Ctrl',
    AltLeft: 'L-Alt',
    AltRight: 'R-Alt',
    Backspace: 'Backspace',
    CapsLock: 'Caps',
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backslash: '\\',
  };
  return names[code] ?? code;
}
