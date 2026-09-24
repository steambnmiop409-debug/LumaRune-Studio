/**
 * Finds every piece of player-facing Korean text in the source: plain string literals and the
 * templates passed to tr()/L(). Also reports template literals that splice values into Korean
 * text with ${…} — those can't be translated and must be rewritten as tr('…{x}…', { x }).
 *
 *   node tools/i18n/extract.mjs            → summary
 *   node tools/i18n/extract.mjs --json     → { ids: [...], spliced: [...] }
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const DIRS = ['packages/core/src', 'packages/server/src', 'packages/client/src'];
const HANGUL = /[가-힣ㄱ-ㆎ]/;
/** Files whose Korean is not shown to players (debug tools, translation tables themselves). */
const SKIP = [/\/i18n\//, /\/debug\//];

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** A tiny TS tokenizer: enough to tell comments, strings and template literals apart. */
function literals(src) {
  const out = [];
  let i = 0;
  let line = 1;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') line++;
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') line++;
        i++;
      }
      i += 2;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      let s = '';
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') {
          const e = src[j + 1];
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e;
          j += 2;
          continue;
        }
        s += src[j++];
      }
      out.push({ kind: 'str', text: s, line, at: i });
      i = j + 1;
      continue;
    }
    if (c === '`') {
      let j = i + 1;
      let s = '';
      let spliced = false;
      let depth = 0;
      const startLine = line;
      while (j < n) {
        if (src[j] === '\\') {
          s += src[j + 1] === 'n' ? '\n' : src[j + 1];
          j += 2;
          continue;
        }
        if (src[j] === '`' && depth === 0) break;
        if (src[j] === '$' && src[j + 1] === '{' && depth === 0) {
          spliced = true;
          depth = 1;
          s += '${';
          j += 2;
          continue;
        }
        if (depth > 0) {
          if (src[j] === '{') depth++;
          if (src[j] === '}') depth--;
          if (depth === 0) {
            s += '}';
            j++;
            continue;
          }
        }
        if (src[j] === '\n') line++;
        s += src[j++];
      }
      out.push({ kind: spliced ? 'tpl' : 'str', text: s, line: startLine, at: i });
      i = j + 1;
      continue;
    }
    i++;
  }
  return out;
}

export function extract() {
  const ids = new Map();
  const spliced = [];
  for (const d of DIRS)
    for (const f of files(join(ROOT, d))) {
      const rel = relative(ROOT, f);
      if (SKIP.some((r) => r.test(rel))) continue;
      const src = readFileSync(f, 'utf8');
      for (const l of literals(src)) {
        if (!HANGUL.test(l.text)) continue;
        if (l.kind === 'tpl') {
          // Only the Korean outside ${…} matters.
          const outside = l.text.replace(/\$\{[^}]*\}/g, '');
          if (HANGUL.test(outside)) spliced.push(`${rel}:${l.line}  ${l.text.slice(0, 80)}`);
          continue;
        }
        if (!ids.has(l.text)) ids.set(l.text, `${rel}:${l.line}`);
      }
    }
  return { ids: [...ids.keys()], where: Object.fromEntries(ids), spliced };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = extract();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 1));
  else {
    console.log(`${r.ids.length} texts, ${r.spliced.length} spliced templates`);
    for (const s of r.spliced) console.log('  ' + s);
  }
}
