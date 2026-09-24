/**
 * Languages. The Korean source text is the key: every string a player sees passes through tr(),
 * which looks it up in the current language's table (falling back to Korean).
 *
 * Text with values in it is written as a template — tr('{n}개 필요해요', { n }) — never spliced
 * together, so each language can order the words its own way. The server can't know each
 * player's language, so it sends L('…', args): the same template and values packed into one
 * string, which the client unpacks and translates. String values are translated too, so an
 * item's Korean name passed as a value arrives as that item's name in the player's language.
 */
import { EN_GB, TABLE, toBritish } from './strings';

export type Lang = 'ko' | 'en' | 'en-GB' | 'ja' | 'de' | 'es';

export const LANGS: ReadonlyArray<{ id: Lang; name: string; locale: string }> = [
  { id: 'ko', name: '한국어', locale: 'ko-KR' },
  { id: 'en', name: 'English (US)', locale: 'en-US' },
  { id: 'en-GB', name: 'English (UK)', locale: 'en-GB' },
  { id: 'ja', name: '日本語', locale: 'ja-JP' },
  { id: 'de', name: 'Deutsch', locale: 'de-DE' },
  { id: 'es', name: 'Español', locale: 'es-ES' },
];

/** Column of each language in the shared table (Korean is the key, column 0). */
const COLUMN: Record<Exclude<Lang, 'ko' | 'en-GB'>, number> = { en: 1, ja: 2, de: 3, es: 4 };

type Args = Record<string, string | number>;
const SEP = '␞';

let current: Lang = 'ko';
let maps: Partial<Record<Lang, Map<string, string>>> = {};
let numberFmt = new Intl.NumberFormat('ko-KR');

function build(lang: Lang): Map<string, string> {
  const m = new Map<string, string>();
  if (lang === 'ko') return m;
  const col = COLUMN[lang === 'en-GB' ? 'en' : lang];
  for (const row of TABLE) if (row[col]) m.set(row[0], lang === 'en-GB' ? toBritish(row[col]) : row[col]);
  if (lang === 'en-GB') for (const [k, v] of Object.entries(EN_GB)) m.set(k, v);
  return m;
}

export function setLang(lang: Lang): void {
  current = LANGS.some((l) => l.id === lang) ? lang : 'ko';
  maps[current] ??= build(current);
  numberFmt = new Intl.NumberFormat(LANGS.find((l) => l.id === current)!.locale);
}

export function getLang(): Lang {
  return current;
}

/** Guesses a language from the browser / OS locale list (e.g. navigator.languages). */
export function detectLang(locales: readonly string[]): Lang {
  for (const loc of locales) {
    const l = loc.toLowerCase();
    if (l.startsWith('ko')) return 'ko';
    if (l === 'en-gb' || l === 'en-ie' || l === 'en-au' || l === 'en-nz') return 'en-GB';
    if (l.startsWith('en')) return 'en';
    if (l.startsWith('ja')) return 'ja';
    if (l.startsWith('de')) return 'de';
    if (l.startsWith('es')) return 'es';
  }
  return 'en';
}

/** Server side: a template and its values, to be translated by each client. */
export function L(msg: string, args?: Args): string {
  return args ? `${msg}${SEP}${JSON.stringify(args)}` : msg;
}

export function formatNumber(n: number): string {
  return numberFmt.format(n);
}

/** The text in the current language, with {name} placeholders filled in. */
export function tr(text: string, args?: Args): string {
  let msg = text;
  let a = args;
  const cut = text.indexOf(SEP);
  if (cut >= 0) {
    msg = text.slice(0, cut);
    try {
      a = { ...(JSON.parse(text.slice(cut + 1)) as Args), ...args };
    } catch {
      // A damaged template still shows its text.
    }
  }
  const out = current === 'ko' ? msg : (maps[current]?.get(msg) ?? msg);
  if (!a) return out;
  return out.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = a![k];
    if (v === undefined) return m;
    return typeof v === 'number' ? formatNumber(v) : tr(v);
  });
}

/** Whether a translation exists (tests and tools). */
export function hasTranslation(lang: Lang, msg: string): boolean {
  if (lang === 'ko') return true;
  maps[lang] ??= build(lang);
  return maps[lang]!.has(msg);
}

/** For tests: forget built tables so edits to TABLE are seen. */
export function resetLangCache(): void {
  maps = {};
  setLang(current);
}
