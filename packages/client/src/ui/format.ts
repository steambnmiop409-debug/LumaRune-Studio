import { tr } from '@lumina/core';
import { settings } from '../settings';

/** Clock time in the player's chosen style: 06:40 or 6:40 AM (in their language). */
export function fmtTime(minute: number): string {
  const m = Math.floor(minute) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = String(Math.floor((m % 60) / 10) * 10).padStart(2, '0');
  if (settings.clock24) return `${String(h).padStart(2, '0')}:${mm}`;
  return tr(h < 12 ? '오전 {t}' : '오후 {t}', { t: `${h % 12 || 12}:${mm}` });
}

const toUnit = (c: number) => Math.round(settings.tempUnit === 'F' ? (c * 9) / 5 + 32 : c);

/** A temperature in °C or °F. */
export function fmtTemp(c: number): string {
  return `${toUnit(c)}°${settings.tempUnit}`;
}

/** A range like 18~29°C. */
export function fmtTempRange(lo: number, hi: number): string {
  return `${toUnit(lo)}~${toUnit(hi)}°${settings.tempUnit}`;
}
