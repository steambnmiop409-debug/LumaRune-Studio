import { describe, expect, it } from 'vitest';
import { L, LANGS, detectLang, formatDate, hasTranslation, setLang, tr, type Lang } from '../src';
import { TABLE } from '../src/i18n/strings';
// The extractor is plain Node (no types); it walks the source for every player-facing Korean text.
// @ts-expect-error untyped .mjs tool
import { extract } from '../../../tools/i18n/extract.mjs';

const { ids, where, spliced } = extract() as { ids: string[]; where: Record<string, string>; spliced: string[] };

describe('translations', () => {
  it('has no Korean text spliced together with ${…} (it could never be translated)', () => {
    expect(spliced).toEqual([]);
  });

  it('translates every player-facing text into every language', () => {
    for (const lang of LANGS.map((l) => l.id).filter((l) => l !== 'ko') as Lang[]) {
      const missing = ids.filter((id) => !hasTranslation(lang, id)).map((id) => `${where[id]}  ${id}`);
      expect(missing, `${lang} is missing`).toEqual([]);
    }
  });

  it('keeps every {placeholder} of the Korean template in each translation', () => {
    const bad: string[] = [];
    for (const row of TABLE) {
      const want = (row[0].match(/\{\w+\}/g) ?? []).sort().join();
      row.slice(1).forEach((t, i) => {
        if ((t.match(/\{\w+\}/g) ?? []).sort().join() !== want) bad.push(`${['en', 'ja', 'de', 'es'][i]}: ${row[0]} → ${t}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('has no duplicate keys', () => {
    const seen = new Set<string>();
    const dup = TABLE.map((r) => r[0]).filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
    expect(dup).toEqual([]);
  });

  it('fills templates, translating names passed as values, and unpacks server messages', () => {
    setLang('en');
    expect(tr(L('{item}이(가) {n}개 필요해요.', { item: '구리 광석', n: 5 }))).toBe('You need 5 Copper Ore.');
    expect(tr(formatDate(0))).toBe('Spring 1 (Mon)');
    expect(tr(L('{crop} 씨앗', { crop: '상추' }))).toBe('Lettuce Seeds');
    setLang('en-GB');
    expect(tr('기본 비료')).toBe('Basic Fertiliser');
    expect(tr('가을')).toBe('Autumn');
    setLang('de');
    expect(tr(L('돈이 부족해요. ({gold}G 필요)', { gold: 12000 }))).toBe('Nicht genug Geld. (12.000G nötig)');
    setLang('ko');
    expect(tr(L('{crop} 씨앗', { crop: '상추' }))).toBe('상추 씨앗');
  });

  it('picks a language from the system locale', () => {
    expect(detectLang(['ja-JP'])).toBe('ja');
    expect(detectLang(['en-GB', 'en'])).toBe('en-GB');
    expect(detectLang(['es-MX'])).toBe('es');
    expect(detectLang(['fr-FR'])).toBe('en');
  });
});
