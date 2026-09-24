import { Rng } from '../math/rng';

export interface Appearance {
  skin: number;
  hairStyle: number;
  hairColor: number;
  /** Eye colour. */
  eyes: number;
  top: number;
  topColor: number;
  bottomColor: number;
  hat: number;
  /** Eye shape (round, smiling, keen, sleepy). Optional in older saves. */
  eyeShape?: number;
  /** Long trousers, shorts or skirt (ignored under a dress). */
  bottom?: number;
  shoes?: number;
  /** Glasses, freckles, a scarf… */
  accessory?: number;
}

export const SKIN_TONES = ['#f7d7c4', '#f1c3a1', '#e0a883', '#c98e68', '#a8704e', '#8a573c', '#6b412c', '#4e2e20'] as const;
export const HAIR_STYLES = ['단정한 단발', '둥근 보브', '긴 생머리', '포니테일', '곱슬머리', '묶은 똥머리', '짧은 스파이크', '양갈래 머리', '옆가르마', '긴 웨이브'] as const;
export const HAIR_COLORS = ['#2b2230', '#4a3228', '#7a4a2c', '#b0703a', '#d8a860', '#f0d890', '#c84a3a', '#8a8ab0', '#e8e4e0', '#4a6aa8', '#e89ab0', '#5a8a5a'] as const;
export const EYE_COLORS = ['#2b2d4a', '#5a3a2a', '#3a6a8a', '#3a7a4a', '#7a5aa0', '#8a6a2a'] as const;
export const EYE_SHAPES = ['동그란 눈', '웃는 눈', '또렷한 눈', '졸린 눈'] as const;
export const TOP_STYLES = ['티셔츠', '멜빵바지', '니트 스웨터', '원피스', '후드티', '셔츠와 조끼', '작업 재킷', '줄무늬 티'] as const;
export const BOTTOM_STYLES = ['긴바지', '반바지', '치마'] as const;
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
export const SHOE_COLORS = ['#7a5242', '#3a3040', '#b8603a', '#e8e0d0', '#4a6a8a', '#8a3a3a'] as const;
export const HATS = ['없음', '밀짚모자', '베레모', '비니', '두건', '야구모자', '꽃 화관'] as const;
export const ACCESSORIES = ['없음', '동그란 안경', '네모 안경', '주근깨', '목도리'] as const;

export const APPEARANCE_OPTIONS: Record<keyof Appearance, number> = {
  skin: SKIN_TONES.length,
  hairStyle: HAIR_STYLES.length,
  hairColor: HAIR_COLORS.length,
  eyes: EYE_COLORS.length,
  eyeShape: EYE_SHAPES.length,
  top: TOP_STYLES.length,
  topColor: CLOTH_COLORS.length,
  bottom: BOTTOM_STYLES.length,
  bottomColor: BOTTOM_COLORS.length,
  shoes: SHOE_COLORS.length,
  hat: HATS.length,
  accessory: ACCESSORIES.length,
};

export const DEFAULT_APPEARANCE: Appearance = {
  skin: 1,
  hairStyle: 1,
  hairColor: 2,
  eyes: 0,
  eyeShape: 0,
  top: 1,
  topColor: 4,
  bottom: 0,
  bottomColor: 0,
  shoes: 0,
  hat: 1,
  accessory: 0,
};

/** Fills in the fields older saves don't have. */
export function fullAppearance(a: Appearance): Required<Appearance> {
  return { ...(DEFAULT_APPEARANCE as Required<Appearance>), eyeShape: 0, bottom: 0, shoes: 0, accessory: 0, ...a } as Required<Appearance>;
}

export function randomAppearance(rng: Rng): Appearance {
  const out = {} as Appearance;
  for (const k of Object.keys(APPEARANCE_OPTIONS) as Array<keyof Appearance>) out[k] = rng.int(0, APPEARANCE_OPTIONS[k] - 1);
  // Most people don't wear glasses or a scarf.
  if (rng.chance(0.5)) out.accessory = 0;
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
