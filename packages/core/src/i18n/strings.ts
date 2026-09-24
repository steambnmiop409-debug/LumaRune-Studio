/**
 * Every translated string: [Korean (the key), English (US), Japanese, German, Spanish].
 * British English uses the US column except where EN_GB says otherwise.
 * Split by where the text appears; see the files next to this one.
 */
import { CROPS_TEXT } from './crops';
import { ITEMS_TEXT } from './items';
import { NPCS_TEXT } from './npcs';
import { SIM } from './sim';
import { UI } from './ui';

export type Row = readonly [ko: string, en: string, ja: string, de: string, es: string];

export const TABLE: readonly Row[] = [...UI, ...SIM, ...CROPS_TEXT, ...ITEMS_TEXT, ...NPCS_TEXT];

/** Whole strings that British English says differently (beyond spelling, which toBritish handles). */
export const EN_GB: Record<string, string> = {
  가을: 'Autumn',
  '12시간 (오후 6:30)': '12-hour (6:30 pm)',
  '오전 {t}': '{t} am',
  '오후 {t}': '{t} pm',
};

const BRITISH: Array<[RegExp, string]> = [
  [/\b([Ff])ertiliz/g, '$1ertilis'],
  [/\b([Ff])iber/g, '$1ibre'],
  [/\b([Cc])olor/g, '$1olour'],
  [/\b([Hh])arbor/g, '$1arbour'],
  [/\b([Ff])lavor/g, '$1lavour'],
  [/\b([Ff])avorite/g, '$1avourite'],
  [/\b([Nn])eighbor/g, '$1eighbour'],
  [/\b([Cc])enter/g, '$1entre'],
  [/\b([Gg])ray\b/g, '$1rey'],
  [/\b([Oo])rganiz/g, '$1rganis'],
  [/\b([Rr])ealiz/g, '$1ealis'],
  [/\b([Tt])ravel(er|ing|ed)/g, '$1ravell$2'],
  [/\bZucchini\b/g, 'Courgette'],
  [/\bEggplant\b/g, 'Aubergine'],
  [/\bCilantro\b/g, 'Coriander'],
  [/\bArugula\b/g, 'Rocket'],
  [/\bChili\b/g, 'Chilli'],
  [/\bCandy\b/g, 'Sweets'],
  [/\b([Cc])ookie/g, '$1iscuit'],
  [/\bmom\b/g, 'mum'],
];

/** US English → British spelling. */
export function toBritish(s: string): string {
  for (const [re, to] of BRITISH) s = s.replace(re, to);
  return s;
}
