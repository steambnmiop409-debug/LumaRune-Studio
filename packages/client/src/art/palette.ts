/** The shared, romantic island palette. Pick colours from here; derive shades with `shade` / `light`. */
export const P = {
  ink: '#2b2d4a',
  ink2: '#44466b',
  inkSoft: '#6a6a8e',
  paper: '#f3e3c3',
  paperLight: '#fbf1dc',
  paperShade: '#dcc59c',
  paperDeep: '#c4a878',
  brass: '#c89b52',
  brassLight: '#ecc97a',
  brassDark: '#8e6a34',
  teal: '#4fa3a5',
  tealDark: '#2f7a86',
  coral: '#e8836b',
  coralDark: '#b85a4a',
  rose: '#e8a0b8',
  gold: '#f5c542',
  sky: '#8ecae6',
  night: '#1c1f3f',
  white: '#fdf8ef',
  green: '#7fb85a',
  leaf: '#5e9a4a',
  red: '#d05a4a',
  water: '#4fa3c8',
} as const;

export type RGB = [number, number, number];

const hexCache = new Map<string, RGB>();
export function hexToRgb(hex: string): RGB {
  let c = hexCache.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    hexCache.set(hex, c);
  }
  return c;
}

export function rgbToHex([r, g, b]: RGB): string {
  return `#${((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1)}`;
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function shiftHue(h: number, target: number, amount: number): number {
  let d = target - h;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return h + Math.sign(d) * Math.min(Math.abs(d), amount);
}

const shadeCache = new Map<string, string>();
/** Darker, cooler variant (hue shifts toward blue-violet). */
export function shade(hex: string, steps = 1): string {
  const key = `${hex}:s${steps}`;
  let v = shadeCache.get(key);
  if (!v) {
    const [h, s, l] = rgbToHsl(hexToRgb(hex));
    v = rgbToHex(hslToRgb(shiftHue(h, 245, 9 * steps), Math.min(1, s + 0.03 * steps), Math.max(0.04, l - 0.085 * steps)));
    shadeCache.set(key, v);
  }
  return v;
}

/** Lighter, warmer variant (hue shifts toward yellow). */
export function light(hex: string, steps = 1): string {
  const key = `${hex}:l${steps}`;
  let v = shadeCache.get(key);
  if (!v) {
    const [h, s, l] = rgbToHsl(hexToRgb(hex));
    v = rgbToHex(hslToRgb(shiftHue(h, 55, 7 * steps), Math.max(0, s - 0.02 * steps), Math.min(0.97, l + 0.075 * steps)));
    shadeCache.set(key, v);
  }
  return v;
}

export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

export function desaturate(hex: string, amount: number): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb(h, s * (1 - amount), l));
}

/** Packed little-endian ABGR for Uint32Array views over ImageData. */
export function rgba32(r: number, g: number, b: number, a = 255): number {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

const packCache = new Map<string, number>();
export function pack(hex: string, a = 255): number {
  const key = a === 255 ? hex : `${hex}/${a}`;
  let v = packCache.get(key);
  if (v === undefined) {
    const [r, g, b] = hexToRgb(hex);
    v = rgba32(r, g, b, a);
    packCache.set(key, v);
  }
  return v;
}

export function unpack(c: number): RGB {
  return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255];
}
