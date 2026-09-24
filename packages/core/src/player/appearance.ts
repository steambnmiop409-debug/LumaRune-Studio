import { Rng } from '../math/rng';

export interface Appearance {
  skin: number;
  hairStyle: number;
  hairColor: number;
  eyes: number;
  top: number;
  topColor: number;
  bottomColor: number;
  hat: number;
}

export const SKIN_TONES = ['#f7d7c4', '#f1c3a1', '#e0a883', '#c98e68', '#a8704e', '#8a573c', '#6b412c', '#4e2e20'] as const;
export const HAIR_STYLES = ['단정한 단발', '둥근 보브', '긴 생머리', '포니테일', '곱슬머리', '묶은 똥머리'] as const;
export const HAIR_COLORS = ['#2b2230', '#4a3228', '#7a4a2c', '#b0703a', '#d8a860', '#f0d890', '#c84a3a', '#8a8ab0', '#e8e4e0', '#4a6aa8'] as const;
export const EYE_COLORS = ['#2b2d4a', '#5a3a2a', '#3a6a8a', '#3a7a4a', '#7a5aa0', '#8a6a2a'] as const;
export const TOP_STYLES = ['티셔츠', '멜빵바지', '니트 스웨터', '원피스'] as const;
export const CLOTH_COLORS = [
  '#e8836b',
  '#f0b860',
  '#f3e3c3',
  '#8ac06a',
  '#4fa3a5',
  '#5a7ac8',
  '#2b2d4a',
  '#9a78b0',
  '#e8a0b8',
  '#c8503a',
  '#7a5a4a',
  '#e8e8e0',
] as const;
export const BOTTOM_COLORS = ['#3a4a7a', '#2b2d4a', '#6a4a3a', '#8a7a5a', '#4a6a4a', '#5a5a6a', '#a05a4a', '#d8c8a8', '#3a5a8a', '#7a3a4a'] as const;
export const HATS = ['없음', '밀짚모자', '베레모', '비니'] as const;

export const APPEARANCE_OPTIONS: Record<keyof Appearance, number> = {
  skin: SKIN_TONES.length,
  hairStyle: HAIR_STYLES.length,
  hairColor: HAIR_COLORS.length,
  eyes: EYE_COLORS.length,
  top: TOP_STYLES.length,
  topColor: CLOTH_COLORS.length,
  bottomColor: BOTTOM_COLORS.length,
  hat: HATS.length,
};

export const DEFAULT_APPEARANCE: Appearance = {
  skin: 1,
  hairStyle: 1,
  hairColor: 2,
  eyes: 0,
  top: 1,
  topColor: 4,
  bottomColor: 0,
  hat: 1,
};

export function randomAppearance(rng: Rng): Appearance {
  const out = {} as Appearance;
  for (const k of Object.keys(APPEARANCE_OPTIONS) as Array<keyof Appearance>) out[k] = rng.int(0, APPEARANCE_OPTIONS[k] - 1);
  return out;
}

/** Clamps untrusted input from a client into a valid appearance. */
export function sanitizeAppearance(a: Partial<Appearance> | undefined): Appearance {
  const out = { ...DEFAULT_APPEARANCE };
  if (!a) return out;
  for (const k of Object.keys(APPEARANCE_OPTIONS) as Array<keyof Appearance>) {
    const v = Number(a[k]);
    if (Number.isInteger(v) && v >= 0 && v < APPEARANCE_OPTIONS[k]) out[k] = v;
  }
  return out;
}
