/**
 * Original music for Lumina Isle.
 *
 * Every song is written as sections (intro, A, A′, B, bridge, outro) over chord symbols, with
 * hand-written melodies and an arrangement that brings instruments in and out, so a loop runs
 * two to three and a half minutes before it repeats. It is performed by the recorded instruments
 * of the GeneralUser GS SoundFont: nylon and steel guitar, harp, piano, celesta, music box,
 * marimba, kalimba, flute, clarinet, oboe, bassoon, tin whistle, horn, violin, cello, string
 * sections, choir, acoustic and fretless bass, and a brush drum kit.
 */
import { type Buf, foldTail, rng } from './dsp';
import { DRUM, type Ev, render, voice } from './synth';

// ── Pitch & chords ───────────────────────────────────────────────────────

const PC: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

/** "F#5" → MIDI note number (C4 = 60). */
export function n(name: string): number {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note ${name}`);
  return PC[m[1]] + (Number(m[2]) + 1) * 12;
}

const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '9': [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7sus4': [0, 5, 7, 10],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  aug: [0, 4, 8],
};

interface Chord {
  sym: string;
  root: number;
  bass: number;
  /** Pitch classes of the chord (root first). */
  pcs: number[];
  /** Third and seventh (or sixth / ninth): the tones that define the harmony. */
  guide: number[];
}

function chord(sym: string): Chord {
  const m = /^([A-G][#b]?)(maj9|maj7|m7b5|madd9|m9|m7|m6|7sus4|add9|dim7|dim|aug|sus2|sus4|m|9|7|6)?(?:\/([A-G][#b]?))?$/.exec(sym);
  if (!m) throw new Error(`Bad chord ${sym}`);
  const root = PC[m[1]];
  const iv = QUALITY[m[2] ?? ''];
  const pcs = iv.map((i) => (root + i) % 12);
  const guide = iv.filter((i) => i === 3 || i === 4 || i === 10 || i === 11 || i === 9 || i === 5).map((i) => (root + i) % 12);
  return { sym, root, bass: m[3] ? PC[m[3]] : root, pcs, guide: guide.length ? guide : [pcs[1]] };
}

/** The lowest note of pitch class `pc` at or above `lo`. */
const above = (pc: number, lo: number) => lo + ((pc - lo) % 12 + 12) % 12;

/** A `count`-note close voicing between lo and hi, moving as little as possible from `prev`. */
function voicing(c: Chord, lo: number, hi: number, count: number, prev: number[] | null): number[] {
  const tones: number[] = [];
  for (let m = lo; m <= hi; m++) if (c.pcs.includes(m % 12)) tones.push(m);
  let best: number[] = tones.slice(0, count);
  let bestCost = Infinity;
  for (let i = 0; i + count <= tones.length; i++) {
    const v = tones.slice(i, i + count);
    // Keep the root out of the top voice of 4-note voicings (sweeter), and avoid clusters of seconds.
    const cost = prev ? v.reduce((s, x, k) => s + Math.abs(x - (prev[k] ?? prev[prev.length - 1])), 0) : Math.abs(v[0] + v[v.length - 1] - lo - hi);
    if (cost < bestCost) {
      best = v;
      bestCost = cost;
    }
  }
  return best;
}

// ── Score model ──────────────────────────────────────────────────────────

/** [beat, midi, lengthBeats, velocity] */
type Note = [number, number, number, number];

interface Seg {
  start: number;
  len: number;
  chord: Chord;
  next: Chord;
}

interface Ctx {
  segs: Seg[];
  start: number;
  bars: number;
  bpb: number;
  /** 0..1 how full this section is. */
  int: number;
  r: () => number;
}

type Layer = (c: Ctx) => Note[];

interface Instrument {
  program: number;
  volume?: number;
  pan?: number;
  reverb?: number;
  chorus?: number;
  /** Drum kit program on the drum channel. */
  kit?: number;
  /** Timing looseness in beats (players are human). */
  loose?: number;
}

interface Section {
  /** Chord symbols: bars split by "|", two chords in a bar split by spaces. */
  chords: string;
  /** Layer name → intensity (0..1). */
  play: Record<string, number>;
  /** Melodies for this section: track name → notes (from `mel`). */
  lines?: Record<string, Note[]>;
}

interface SongDef {
  name: string;
  title: string;
  bpm: number;
  bpb: number;
  /** Delay of every off-beat eighth, in beats (0 = straight). */
  swing?: number;
  instruments: Record<string, Instrument>;
  /** Accompaniment layers: `track:layer` keys map to generators. */
  layers: Record<string, [string, Layer]>;
  sections: Section[];
  seed: number;
}

/**
 * A melody in text: "D5:1 G5:1 B5:1.5 A5:.5 | …". Bars are checked against the metre.
 * "-" is a rest; a trailing "!" accents the note.
 */
function mel(src: string, bpb: number, vel = 84, legato = 0.94): Note[] {
  const out: Note[] = [];
  let beat = 0;
  const bars = src.split('|').map((b) => b.trim()).filter(Boolean);
  bars.forEach((bar, i) => {
    let sum = 0;
    for (const tok of bar.split(/\s+/)) {
      const m = /^(-|[A-G][#b]?-?\d):(\d*\.?\d+)(!?)$/.exec(tok);
      if (!m) throw new Error(`Bad melody token "${tok}"`);
      const len = Number(m[2]);
      if (m[1] !== '-') out.push([beat, n(m[1]), len * legato, m[3] ? Math.min(127, vel + 14) : vel]);
      beat += len;
      sum += len;
    }
    if (Math.abs(sum - bpb) > 1e-6) throw new Error(`Melody bar ${i + 1} has ${sum} beats, expected ${bpb}: "${bar}"`);
  });
  return out;
}

const shift = (notes: Note[], semis: number, velMul = 1): Note[] => notes.map(([b, m, l, v]) => [b, m + semis, l, Math.round(v * velMul)]);
/** The same tune at half speed (augmentation) — for a slow restatement in a bridge. */
const augment = (notes: Note[], bars: number, bpb: number): Note[] => notes.filter(([b]) => b < (bars * bpb) / 2).map(([b, m, l, v]) => [b * 2, m, l * 2, v]);
const take = (notes: Note[], fromBar: number, bars: number, bpb: number): Note[] =>
  notes.filter(([b]) => b >= fromBar * bpb && b < (fromBar + bars) * bpb).map(([b, m, l, v]) => [b - fromBar * bpb, m, l, v]);

// ── Accompaniment generators ─────────────────────────────────────────────

const vel = (base: number, c: Ctx, k = 1) => Math.max(1, Math.min(127, Math.round(base * (0.72 + 0.28 * c.int) * k * (0.94 + c.r() * 0.12))));

/** Sustained chords, voice-led. */
function pad(lo: string, hi: string, count: number, v: number, restrike = false): Layer {
  return (c) => {
    const out: Note[] = [];
    let prev: number[] | null = null;
    for (const s of c.segs) {
      const vs = voicing(s.chord, n(lo), n(hi), count, prev);
      prev = vs;
      const parts = restrike && s.len > c.bpb / 2 ? 2 : 1;
      for (let p = 0; p < parts; p++) for (const m of vs) out.push([s.start + (p * s.len) / parts, m, (s.len / parts) * 0.99, vel(v, c, p ? 0.8 : 1)]);
    }
    return out;
  };
}

/** Broken chords: `pattern` indexes the voicing (0 = lowest); indexes past the top repeat an octave up. */
function arp(lo: string, hi: string, count: number, pattern: number[], step: number, v: number, ring = 1.6): Layer {
  return (c) => {
    const out: Note[] = [];
    let prev: number[] | null = null;
    for (const s of c.segs) {
      const vs = voicing(s.chord, n(lo), n(hi), count, prev);
      prev = vs;
      for (let k = 0, t = 0; t < s.len - 1e-6; k++, t += step) {
        const idx = pattern[k % pattern.length];
        const m = vs[idx % vs.length] + Math.floor(idx / vs.length) * 12;
        out.push([s.start + t, m, step * ring, vel(v, c, k % pattern.length === 0 ? 1.12 : 1)]);
      }
    }
    return out;
  };
}

/** Fingerpicked guitar: bass on the strong beats (alternating root and fifth), treble in between. */
function fingerpick(v: number, treble: number[], bassBeats: number[]): Layer {
  return (c) => {
    const out: Note[] = [];
    let prev: number[] | null = null;
    for (const s of c.segs) {
      const vs = voicing(s.chord, n('G3'), n('E5'), 3, prev);
      prev = vs;
      const root = above(s.chord.bass, n('E2'));
      const fifth = above((s.chord.root + 7) % 12, n('A2'));
      bassBeats.forEach((b, k) => {
        if (b < s.len) out.push([s.start + b, k % 2 && s.chord.bass === s.chord.root ? fifth : root, 1.8, vel(v, c, 1.1)]);
      });
      for (let k = 0, t = 0.5; t < s.len - 1e-6; k++, t += 1) out.push([s.start + t, vs[treble[k % treble.length] % vs.length], 1.2, vel(v, c, 0.85)]);
    }
    return out;
  };
}

/** Bass: `steps` are [beat, degree, length] with degree 'r' root, '5' fifth, '8' octave, 'a' approach to the next chord. */
function bass(lo: string, steps: Array<[number, 'r' | '5' | '8' | '3' | 'a', number]>, v: number): Layer {
  return (c) => {
    const out: Note[] = [];
    for (const s of c.segs) {
      const root = above(s.chord.bass, n(lo));
      for (const [b, d, l] of steps) {
        if (b >= s.len - 1e-6) continue;
        let m = root;
        if (d === '5') m = above((s.chord.root + 7) % 12, root - 5);
        if (d === '8') m = root + 12;
        if (d === '3') m = above(s.chord.pcs[1], root);
        if (d === 'a') {
          const target = above(s.next.bass, n(lo));
          m = target + (target > root ? -1 : 1);
        }
        out.push([s.start + b, m, Math.min(l, s.len - b), vel(v, c, b === 0 ? 1.1 : 0.95)]);
      }
    }
    return out;
  };
}

/** Short chord hits on given beats of every chord (pizzicato, strums, skank guitar). */
function stabs(lo: string, hi: string, count: number, beats: number[], len: number, v: number, strum = 0): Layer {
  return (c) => {
    const out: Note[] = [];
    let prev: number[] | null = null;
    for (const s of c.segs) {
      const vs = voicing(s.chord, n(lo), n(hi), count, prev);
      prev = vs;
      for (const b of beats) if (b < s.len - 1e-6) vs.forEach((m, k) => out.push([s.start + b + k * strum, m, len, vel(v, c, b === 0 ? 1.1 : 1)]));
    }
    return out;
  };
}

/** A slow inner line through the guide tones (thirds and sevenths), one note per chord. */
function guide(lo: string, hi: string, v: number, rhythm: 'chord' | 'half' = 'chord'): Layer {
  return (c) => {
    const out: Note[] = [];
    let last = Math.round((n(lo) + n(hi)) / 2);
    for (const s of c.segs) {
      const parts = rhythm === 'half' && s.len >= 4 ? 2 : 1;
      for (let p = 0; p < parts; p++) {
        const cands: number[] = [];
        const pool = p === 0 ? s.chord.guide : s.chord.pcs;
        for (let m = n(lo); m <= n(hi); m++) if (pool.includes(m % 12)) cands.push(m);
        cands.sort((a, b) => Math.abs(a - last) - Math.abs(b - last) || a - b);
        const pick = cands.find((m) => m !== last) ?? cands[0];
        last = pick;
        out.push([s.start + (p * s.len) / parts, pick, (s.len / parts) * 0.97, vel(v, c)]);
      }
    }
    return out;
  };
}

/** Scattered bell-like notes from the chord, high up (glockenspiel, celesta, raindrops, cave drips). */
function sparkle(lo: string, hi: string, perBar: number, v: number): Layer {
  return (c) => {
    const out: Note[] = [];
    for (const s of c.segs) {
      const count = Math.max(0, Math.round((perBar * s.len) / c.bpb + (c.r() - 0.5)));
      for (let k = 0; k < count; k++) {
        const t = Math.floor(c.r() * s.len * 2) / 2;
        const tones: number[] = [];
        for (let m = n(lo); m <= n(hi); m++) if (s.chord.pcs.includes(m % 12)) tones.push(m);
        out.push([s.start + t, tones[Math.floor(c.r() * tones.length)], 1, vel(v, c, 0.8 + c.r() * 0.3)]);
      }
    }
    return out;
  };
}

/** GM drum keys (brush kit). */
const K = { kick: 36, brush: 38, swirl: 40, rim: 37, hat: 42, pedal: 44, open: 46, ride: 51, bell: 53, tamb: 54, shaker: 70, cabasa: 69, claves: 75, tri: 81, mtri: 80, jingle: 83, cymbal: 49, timp: 47 } as const;

/** A drum groove: per bar, [beat, key, velocity] hits; soft ghost variation from the seed. */
function groove(hits: Array<[number, keyof typeof K, number]>, fillEvery = 0): Layer {
  return (c) => {
    const out: Note[] = [];
    for (let bar = 0; bar < c.bars; bar++) {
      const b0 = c.start + bar * c.bpb;
      for (const [t, key, v] of hits) if (t < c.bpb) out.push([b0 + t, K[key], 0.5, vel(v, c)]);
      if (fillEvery && (bar + 1) % fillEvery === 0) for (const t of [c.bpb - 1, c.bpb - 0.5]) out.push([b0 + t, K.brush, 0.5, vel(52, c, 0.9)]);
    }
    return out;
  };
}

// ── Performing ───────────────────────────────────────────────────────────

/** Lays out the sections, generates every layer, humanizes, and returns MIDI events. */
function arrange(song: SongDef): { events: Ev[]; beats: number } {
  const r = rng(song.seed);
  const tracks = new Map<string, Note[]>();
  const add = (name: string, notes: Note[]) => {
    if (!tracks.has(name)) tracks.set(name, []);
    tracks.get(name)!.push(...notes);
  };
  let beat = 0;
  const all = song.sections.map((s) => s.chords.split('|').map((bar) => bar.trim().split(/\s+/).map(chord)));
  song.sections.forEach((sec, si) => {
    const bars = all[si];
    const segs: Seg[] = [];
    bars.forEach((chs, bi) =>
      chs.forEach((ch, k) => {
        const len = song.bpb / chs.length;
        segs.push({ start: beat + bi * song.bpb + k * len, len, chord: ch, next: ch });
      }),
    );
    // Each chord knows what comes next (for approach notes), across sections and around the loop.
    const nextSec = all[(si + 1) % all.length];
    segs.forEach((s, i) => (s.next = segs[i + 1]?.chord ?? nextSec[0][0]));
    for (const [key, int] of Object.entries(sec.play)) {
      const [track, layer] = song.layers[key] ?? [];
      if (!track || !layer) throw new Error(`${song.name}: unknown layer ${key}`);
      add(track, layer({ segs, start: beat, bars: bars.length, bpb: song.bpb, int, r }));
    }
    for (const [track, notes] of Object.entries(sec.lines ?? {})) add(track, notes.map(([b, m, l, v]) => [b + beat, m, l, v] as Note));
    beat += bars.length * song.bpb;
  });

  const spb = 60 / song.bpm;
  const events: Ev[] = [];
  let ch = 0;
  for (const [name, notes] of tracks) {
    const inst = song.instruments[name];
    if (!inst) throw new Error(`${song.name}: no instrument for ${name}`);
    const drum = inst.kit !== undefined;
    const chan = drum ? DRUM : ch === DRUM ? ++ch : ch;
    if (!drum) ch = chan + 1;
    const loose = inst.loose ?? 0.012;
    const timed = notes.map(([b, m, l, v]) => {
      // Swing the off-beat eighths, then let every player breathe a little.
      const frac = b - Math.floor(b);
      const sw = song.swing && Math.abs(frac - 0.5) < 1e-6 ? song.swing : 0;
      const t = Math.max(0, (b + sw + (r() - 0.5) * 2 * loose) * spb);
      return [t, m, Math.max(0.05, l * spb), v] as [number, number, number, number];
    });
    events.push(...voice(chan, drum ? inst.kit! : inst.program, timed, { volume: inst.volume, pan: inst.pan, reverb: inst.reverb, chorus: inst.chorus }));
  }
  if (ch > 15) throw new Error(`${song.name}: too many instruments`);
  return { events, beats: beat };
}

// ═════════════════════════════ The songs ═════════════════════════════════

// ── Title: "Lighthouse Lullaby" (D major, 3/4) ──

const TITLE_A = mel(
  `F#5:1 A5:1 D6:1 | C#6:2 A5:1 | B5:1.5 A5:.5 F#5:1 | A5:3 |
   G5:1 B5:1 D6:1 | F#5:2 E5:1 | E5:1 G5:1 B5:1 | A5:2 G5:.5 E5:.5 |
   F#5:1 A5:1 D6:1 | E6:2 C#6:1 | D6:1.5 C#6:.5 B5:1 | A5:2 F#5:1 |
   G5:1 B5:1 E6:1 | D6:1 C#6:1 E5:1 | D6:3 | -:3`,
  3,
  86,
);
const TITLE_B = mel(
  `B5:1 D6:1 G6:1 | E6:2 C#6:1 | A5:1 C#6:1 F#6:1 | D6:2 B5:1 |
   G5:1 B5:1 D6:1 | F#6:2 D6:1 | E6:1 D6:1 B5:1 | C#6:3 |
   B5:1 D6:1 G6:1 | A6:2 G6:1 | F#6:1 E6:1 C#6:1 | D6:2 F#6:1 |
   G6:1 F#6:1 E6:1 | E6:1 C#6:1 A5:1 | D6:3 | -:3`,
  3,
  80,
);
const TITLE_A_CH = 'D | A/C# | Bm | F#m | G | D/F# | Em | A | D | A/C# | Bm | F#m | G | A | D | D';
const TITLE_B_CH = 'G | A | F#m | Bm | G | D/F# | Em7 | A7 | G | A | F#m | Bm | Em7 | A7 | D | A7';

const TITLE: SongDef = {
  name: 'title',
  title: 'Lighthouse Lullaby',
  bpm: 80,
  bpb: 3,
  seed: 11,
  instruments: {
    harp: { program: 46, volume: 104, pan: -0.2, reverb: 72 },
    box: { program: 10, volume: 98, pan: 0.15, reverb: 82 },
    flute: { program: 73, volume: 88, pan: 0.3, reverb: 70 },
    strings: { program: 49, volume: 80, reverb: 92, chorus: 30 },
    cello: { program: 42, volume: 82, pan: -0.3, reverb: 80 },
  },
  layers: {
    harp: ['harp', arp('D3', 'A4', 4, [0, 1, 2, 3, 2, 1], 0.5, 68)],
    pad: ['strings', pad('A3', 'F#4', 3, 36)],
    cello: ['cello', guide('D3', 'D4', 50)],
  },
  sections: [
    { chords: 'D | A/C# | G | A', play: { harp: 0.5 } },
    { chords: TITLE_A_CH, play: { harp: 0.6, pad: 0.4 }, lines: { box: TITLE_A } },
    { chords: TITLE_B_CH, play: { harp: 0.8, pad: 0.7, cello: 0.6 }, lines: { flute: TITLE_B } },
    { chords: TITLE_A_CH, play: { harp: 0.9, pad: 0.8, cello: 0.7 }, lines: { box: TITLE_A, flute: shift(TITLE_A, -12, 0.6) } },
  ],
};

// ── Spring day: "Blossom Path" (G major, 4/4) ──

const SPRING_A = mel(
  `D5:1 G5:1 B5:1.5 A5:.5 | A5:1 F#5:1 D5:2 | E5:1 G5:1 B5:1 D6:1 | C6:1.5 B5:.5 G5:2 |
   B5:1 D6:1 G6:1.5 F#6:.5 | E6:1 D6:1 C6:1 A5:1 | G5:1 A5:1 B5:1 C6:1 | B5:3 -:1`,
  4,
  82,
);
const SPRING_A2 = mel(
  `D5:1 G5:1 B5:1.5 A5:.5 | A5:1 F#5:.5 A5:.5 D6:2 | E6:1 D6:1 B5:1 G5:1 | C6:1 E6:1 G5:2 |
   B5:1 D6:1 G6:1.5 A6:.5 | G6:1 E6:1 C6:1 A5:1 | B5:1 C6:1 D6:1 F#6:1 | G6:3 -:1`,
  4,
  84,
);
const SPRING_B = mel(
  `E6:2 D6:1 C6:1 | D6:1.5 A5:.5 F#5:2 | F#5:1 A5:1 D6:1 F#6:1 | E6:3 D6:.5 B5:.5 |
   C6:1 E6:1 A6:1 G6:.5 E6:.5 | F#6:1.5 E6:.5 D6:2 | B5:1 D6:1 F#6:1 D6:1 | E6:2 C6:1 A5:1`,
  4,
  86,
);
const SPRING_A_CH = 'G | D/F# | Em7 | Cmaj7 | G | Am7 | C D | G';
const SPRING_B_CH = 'C | D | Bm7 | Em7 | Am7 | D | Gmaj7 | D7sus4 D7';

const SPRING: SongDef = {
  name: 'spring',
  title: 'Blossom Path',
  bpm: 100,
  bpb: 4,
  swing: 0.06,
  seed: 21,
  instruments: {
    guitar: { program: 24, volume: 108, pan: -0.25, reverb: 45 },
    flute: { program: 73, volume: 100, pan: 0.2, reverb: 58 },
    clarinet: { program: 71, volume: 82, pan: 0.35, reverb: 55 },
    violin: { program: 40, volume: 86, pan: 0.25, reverb: 62 },
    cello: { program: 42, volume: 84, pan: -0.35, reverb: 66 },
    pizz: { program: 45, volume: 88, pan: 0.1, reverb: 50 },
    strings: { program: 49, volume: 70, reverb: 85, chorus: 25 },
    glock: { program: 9, volume: 66, pan: 0.4, reverb: 72 },
    harp: { program: 46, volume: 92, pan: -0.1, reverb: 70 },
    bass: { program: 32, volume: 96, pan: 0, reverb: 30 },
    drums: { program: 0, kit: 40, volume: 70, reverb: 38, loose: 0.02 },
  },
  layers: {
    pick: ['guitar', fingerpick(66, [2, 1, 0, 1], [0, 2])],
    bass: ['bass', bass('G1', [[0, 'r', 1.8], [2, '5', 1.4], [3.5, 'a', 0.5]], 70)],
    pad: ['strings', pad('B3', 'G4', 3, 38)],
    counter: ['clarinet', guide('D4', 'D5', 58, 'half')],
    pizz: ['pizz', stabs('D4', 'B4', 3, [0, 1.5, 2.5], 0.4, 58)],
    glock: ['glock', sparkle('G5', 'D7', 1.2, 48)],
    harp: ['harp', arp('G2', 'D4', 4, [0, 1, 2, 3, 4, 3, 2, 1], 0.5, 58)],
    drums: ['drums', groove([[0, 'kick', 54], [1, 'shaker', 40], [1.5, 'shaker', 30], [2, 'brush', 42], [3, 'shaker', 40], [3.5, 'shaker', 30]], 8)],
    lightdrums: ['drums', groove([[0, 'kick', 40], [2, 'shaker', 30], [3.5, 'tri', 26]])],
  },
  sections: [
    { chords: 'G | Cadd9 | Em7 | D', play: { pick: 0.5, glock: 0.4 } },
    { chords: SPRING_A_CH, play: { pick: 0.6, bass: 0.5, pad: 0.4 }, lines: { flute: SPRING_A } },
    { chords: SPRING_A_CH, play: { pick: 0.7, bass: 0.6, pad: 0.5, counter: 0.6, lightdrums: 0.5 }, lines: { flute: SPRING_A2 } },
    { chords: SPRING_B_CH, play: { pick: 0.8, bass: 0.8, pad: 0.7, pizz: 0.7, drums: 0.7, glock: 0.6 }, lines: { flute: SPRING_B } },
    { chords: SPRING_A_CH, play: { pick: 0.8, bass: 0.8, pad: 0.6, pizz: 0.6, drums: 0.8 }, lines: { violin: shift(SPRING_A, -12, 0.95), flute: shift(SPRING_A2, 0, 0.7) } },
    { chords: 'G | Gmaj7 | D/F# | Dsus4 D | Em7 | G/B | Cmaj7 | Am7 D7sus4', play: { harp: 0.5, pad: 0.6 }, lines: { cello: shift(augment(SPRING_A, 8, 4), -24, 0.9) } },
    { chords: SPRING_B_CH, play: { pick: 0.9, bass: 0.9, pad: 0.8, pizz: 0.8, drums: 0.9, glock: 0.7, counter: 0.7 }, lines: { flute: SPRING_B, violin: shift(SPRING_B, -12, 0.75) } },
    { chords: 'Cadd9 | G/B | Am7 D | G', play: { pick: 0.5, pad: 0.5, glock: 0.5, bass: 0.4 } },
  ],
};

// ── Summer day: "Sun on the Tide" (D major, 4/4, island swing) ──

const SUMMER_A = mel(
  `F#5:.5 A5:.5 D6:1 C#6:.5 D6:.5 A5:1 | E5:.5 A5:.5 C#6:1 B5:.5 C#6:.5 E6:1 | D6:1 B5:.5 F#5:.5 B5:1 A5:1 | G5:.5 B5:.5 D6:1 E6:1 D6:1 |
   F#6:1 E6:.5 D6:.5 A5:1 F#5:1 | G5:.5 A5:.5 B5:1 E6:1 D6:1 | B5:1 D6:1 C#6:1 E6:1 | D6:3 -:1`,
  4,
  88,
);
const SUMMER_B = mel(
  `B5:1 D6:.5 B5:.5 G5:2 | A5:1 C#6:.5 E6:.5 A6:2 | F#6:1 E6:.5 C#6:.5 A5:1 C#6:1 | D6:2 B5:1 F#5:1 |
   G5:1 B5:1 E6:1 G6:1 | F#6:1 E6:1 C#6:1 A5:1 | F#5:.5 A5:.5 C#6:1 D6:1 F#6:1 | E6:2 G6:1 E6:1`,
  4,
  88,
);
const SUMMER_A_CH = 'D | A/C# | Bm | G | D | Em7 | G A | D';
const SUMMER_B_CH = 'G | A | F#m7 | Bm7 | Em7 | A | Dmaj7 | A7sus4 A7';

const SUMMER: SongDef = {
  name: 'summer',
  title: 'Sun on the Tide',
  bpm: 116,
  bpb: 4,
  swing: 0.12,
  seed: 31,
  instruments: {
    whistle: { program: 78, volume: 92, pan: 0.2, reverb: 50 },
    marimba: { program: 12, volume: 100, pan: -0.25, reverb: 40 },
    steel: { program: 114, volume: 84, pan: 0.35, reverb: 48 },
    guitar: { program: 25, volume: 88, pan: -0.35, reverb: 35 },
    bass: { program: 32, volume: 104, reverb: 25 },
    strings: { program: 48, volume: 72, reverb: 70 },
    clarinet: { program: 71, volume: 80, pan: -0.15, reverb: 55 },
    drums: { program: 0, kit: 40, volume: 80, reverb: 30, loose: 0.018 },
  },
  layers: {
    marimba: ['marimba', arp('D4', 'D5', 3, [0, 1, 2, 1, 3, 2, 1, 2], 0.5, 64, 1.1)],
    skank: ['guitar', stabs('F#3', 'D4', 3, [0.5, 1.5, 2.5, 3.5], 0.3, 58, 0.012)],
    bass: ['bass', bass('D1', [[0, 'r', 1], [1.5, '5', 0.5], [2, '8', 1], [3, '5', 0.5], [3.5, 'a', 0.5]], 76)],
    strings: ['strings', stabs('A3', 'F#4', 3, [0, 2.5], 1.2, 48)],
    steel: ['steel', guide('F#5', 'F#6', 56, 'half')],
    groove: ['drums', groove([[0, 'kick', 64], [0.5, 'shaker', 36], [1, 'rim', 50], [1.5, 'shaker', 36], [2, 'kick', 50], [2.5, 'shaker', 36], [3, 'rim', 52], [3.5, 'tamb', 40]], 8)],
    light: ['drums', groove([[0, 'kick', 50], [1, 'shaker', 36], [2, 'shaker', 30], [3, 'shaker', 36], [3.5, 'shaker', 26]])],
  },
  sections: [
    { chords: 'D | G | D | A', play: { marimba: 0.6, light: 0.5 } },
    { chords: SUMMER_A_CH, play: { marimba: 0.6, bass: 0.6, skank: 0.5, light: 0.6 }, lines: { whistle: SUMMER_A } },
    { chords: SUMMER_A_CH, play: { marimba: 0.7, bass: 0.7, skank: 0.7, groove: 0.7, steel: 0.6 }, lines: { whistle: SUMMER_A } },
    { chords: SUMMER_B_CH, play: { marimba: 0.8, bass: 0.8, skank: 0.8, groove: 0.8, strings: 0.7 }, lines: { whistle: SUMMER_B, clarinet: shift(SUMMER_B, -12, 0.6) } },
    { chords: SUMMER_A_CH, play: { marimba: 0.9, bass: 0.9, skank: 0.8, groove: 0.9, strings: 0.6 }, lines: { steel: SUMMER_A, whistle: shift(SUMMER_A, 0, 0.55) } },
    { chords: 'D | Dmaj7 | A/C# | A | Bm | Bm7 | G | Em7 A7sus4', play: { marimba: 0.5, bass: 0.5, light: 0.5, strings: 0.5 }, lines: { clarinet: shift(augment(SUMMER_A, 8, 4), -12, 0.9) } },
    { chords: SUMMER_B_CH, play: { marimba: 0.9, bass: 0.9, skank: 0.9, groove: 1, strings: 0.8, steel: 0.7 }, lines: { whistle: SUMMER_B } },
    { chords: 'G | A | D | D', play: { marimba: 0.6, bass: 0.6, light: 0.6 } },
  ],
};

// ── Autumn day: "Amber Orchard" (A minor → C major, 3/4 waltz) ──

const AUTUMN_A = mel(
  `E5:1 A5:1 B5:1 | C6:2 B5:1 | A5:1.5 G5:.5 F5:1 | E5:2 G#5:1 |
   F5:1 A5:1 D6:1 | C6:1.5 B5:.5 A5:1 | D#5:1 F#5:1 A5:1 | G#5:3 |
   E5:1 A5:1 B5:1 | C6:2 D6:1 | E6:1.5 D6:.5 C6:1 | G5:2 E5:1 |
   F5:1 A5:1 D6:1 | B5:1.5 A5:.5 G#5:1 | A5:3 | -:3`,
  3,
  84,
);
const AUTUMN_B = mel(
  `G5:1 C6:1 E6:1 | D6:2 B5:1 | C6:1 E6:1 A6:1 | G6:2 E6:1 |
   F6:1 E6:1 D6:1 | E6:1.5 D6:.5 C6:1 | D6:1 F6:1 A5:1 | B5:3 |
   G5:1 C6:1 E6:1 | D6:2 G6:1 | E6:1 D6:1 C6:1 | B5:2 G5:1 |
   A5:1 C6:1 F6:1 | E6:1 D6:1 B5:1 | C6:3 | B5:2 G#5:1`,
  3,
  84,
);
const AUTUMN_A_CH = 'Am | Am/G | F | E | Dm | Am | B7 | E | Am | Am/G | Fmaj7 | C | Dm | E7 | Am | Am';
const AUTUMN_B_CH = 'C | G/B | Am | Em | F | C | Dm | G7 | C | G/B | Am | Em | F | G | C | E7';

const AUTUMN: SongDef = {
  name: 'autumn',
  title: 'Amber Orchard',
  bpm: 92,
  bpb: 3,
  seed: 41,
  instruments: {
    oboe: { program: 68, volume: 96, pan: 0.2, reverb: 60 },
    accordion: { program: 21, volume: 70, pan: -0.3, reverb: 45 },
    harp: { program: 46, volume: 96, pan: -0.15, reverb: 65 },
    cello: { program: 42, volume: 88, pan: -0.35, reverb: 62 },
    bassoon: { program: 70, volume: 86, pan: 0.1, reverb: 50 },
    strings: { program: 49, volume: 70, reverb: 85, chorus: 20 },
    piano: { program: 0, volume: 92, pan: 0.05, reverb: 60 },
    clarinet: { program: 71, volume: 84, pan: 0.3, reverb: 58 },
    drums: { program: 0, kit: 40, volume: 62, reverb: 40, loose: 0.02 },
  },
  layers: {
    waltz: ['accordion', stabs('C4', 'A4', 3, [1, 2], 0.6, 50)],
    oom: ['bassoon', bass('A1', [[0, 'r', 0.9]], 64)],
    harp: ['harp', arp('A2', 'E4', 4, [0, 1, 2, 3, 2, 1], 0.5, 58)],
    pad: ['strings', pad('C4', 'A4', 3, 36)],
    cello: ['cello', guide('C3', 'C4', 56)],
    piano: ['piano', arp('A3', 'E5', 3, [0, 1, 2, 1, 2, 1], 0.5, 50)],
    tamb: ['drums', groove([[0, 'tamb', 38], [1, 'shaker', 22], [2, 'shaker', 22]])],
  },
  sections: [
    { chords: 'Am | F | C | E7', play: { harp: 0.5, pad: 0.3 } },
    { chords: AUTUMN_A_CH, play: { waltz: 0.6, oom: 0.6, harp: 0.5, pad: 0.4 }, lines: { oboe: AUTUMN_A } },
    { chords: AUTUMN_B_CH, play: { waltz: 0.7, oom: 0.7, harp: 0.7, pad: 0.6, cello: 0.6, tamb: 0.5 }, lines: { oboe: AUTUMN_B } },
    { chords: 'Am | Am9 | Am/G | Em/G | F | Dm7 | E | E7', play: { piano: 0.6, pad: 0.5 }, lines: { clarinet: shift(augment(take(AUTUMN_A, 0, 8, 3), 8, 3), -12, 0.9) } },
    { chords: AUTUMN_A_CH, play: { waltz: 0.8, oom: 0.8, harp: 0.8, pad: 0.7, tamb: 0.6 }, lines: { cello: shift(AUTUMN_A, -12, 1.05), oboe: shift(take(AUTUMN_A, 8, 8, 3).map(([b, m, l, v]) => [b + 24, m, l, v] as Note), 0, 0.8) } },
    { chords: AUTUMN_B_CH, play: { waltz: 0.9, oom: 0.9, harp: 0.8, pad: 0.8, cello: 0.7, tamb: 0.7 }, lines: { oboe: AUTUMN_B, clarinet: shift(AUTUMN_B, -12, 0.6) } },
    { chords: 'Dm | E7 | Am | Am', play: { harp: 0.5, pad: 0.5, oom: 0.4 } },
  ],
};

// ── Winter day: "Snow Lantern" (F major, 4/4) ──

const WINTER_A = mel(
  `A4:1 C5:1 F5:1.5 E5:.5 | E5:1 D5:1 C5:2 | D5:1 F5:1 A5:1.5 G5:.5 | E5:3 C5:1 |
   D5:1 F5:1 Bb5:1.5 A5:.5 | A5:1 G5:1 F5:1 C5:1 | D5:1 F5:1 E5:1 D5:1 | C5:3 -:1`,
  4,
  74,
);
const WINTER_B = mel(
  `F5:2 D5:1 F5:1 | G5:2 E5:1 G5:1 | A5:1 C6:1 E6:1 C6:1 | D6:3 A5:1 |
   Bb5:1 A5:1 G5:1 F5:1 | E5:1 G5:1 C6:2 | A5:1 C6:1 D6:1 F6:1 | F6:2 E6:2`,
  4,
  74,
);
const WINTER_A_CH = 'F | C/E | Dm | Am | Bb | F/A | Gm7 | C7';
const WINTER_B_CH = 'Bb | C | Am7 | Dm | Gm7 | C | F/A Bb | C7sus4 C7';

const WINTER: SongDef = {
  name: 'winter',
  title: 'Snow Lantern',
  bpm: 76,
  bpb: 4,
  seed: 51,
  instruments: {
    piano: { program: 0, volume: 104, pan: 0, reverb: 72 },
    celesta: { program: 8, volume: 90, pan: -0.25, reverb: 80 },
    box: { program: 10, volume: 70, pan: 0.35, reverb: 85 },
    horn: { program: 60, volume: 76, pan: -0.2, reverb: 75 },
    strings: { program: 49, volume: 78, reverb: 92, chorus: 30 },
    choir: { program: 52, volume: 64, reverb: 95 },
    harp: { program: 46, volume: 90, pan: 0.2, reverb: 78 },
    bass: { program: 43, volume: 82, reverb: 60 },
    flute: { program: 73, volume: 84, pan: 0.25, reverb: 75 },
    drums: { program: 0, kit: 40, volume: 58, reverb: 60, loose: 0.02 },
  },
  layers: {
    celesta: ['celesta', arp('F4', 'C6', 4, [0, 2, 1, 3, 2, 1, 3, 2], 0.5, 50, 2)],
    pianoLH: ['piano', arp('F2', 'C4', 3, [0, 1, 2, 1], 1, 46, 1.8)],
    pad: ['strings', pad('A3', 'F4', 3, 40)],
    choir: ['choir', pad('C4', 'A4', 3, 38)],
    horn: ['horn', guide('C4', 'C5', 52, 'chord')],
    bass: ['bass', bass('F1', [[0, 'r', 3.8]], 58)],
    box: ['box', sparkle('C6', 'F7', 1, 40)],
    harp: ['harp', arp('F3', 'F5', 4, [0, 1, 2, 3, 4, 5, 6, 7], 0.5, 48)],
    bells: ['drums', groove([[0, 'jingle', 30], [1, 'jingle', 22], [2, 'jingle', 28], [3, 'jingle', 22], [3.5, 'tri', 20]])],
  },
  sections: [
    { chords: 'Fmaj7 | C/E | Dm7 | Bbmaj7', play: { celesta: 0.5, box: 0.4 } },
    { chords: WINTER_A_CH, play: { pianoLH: 0.5, pad: 0.4, bass: 0.4, box: 0.3 }, lines: { piano: WINTER_A } },
    { chords: WINTER_A_CH, play: { pianoLH: 0.6, celesta: 0.5, pad: 0.6, bass: 0.6, horn: 0.5 }, lines: { piano: WINTER_A, flute: shift(WINTER_A, 12, 0.5) } },
    { chords: WINTER_B_CH, play: { pianoLH: 0.7, harp: 0.6, pad: 0.8, choir: 0.6, bass: 0.7, bells: 0.5 }, lines: { flute: WINTER_B, horn: shift(WINTER_B, -12, 0.55) } },
    { chords: 'F | Fmaj7 | C/E | C | Dm | Dm7 | Am | C7', play: { celesta: 0.5, pad: 0.5 }, lines: { horn: shift(augment(WINTER_A, 8, 4), 0, 0.9) } },
    { chords: WINTER_A_CH, play: { pianoLH: 0.8, celesta: 0.6, pad: 0.8, choir: 0.5, bass: 0.8, bells: 0.4, box: 0.4 }, lines: { piano: WINTER_A, flute: shift(WINTER_A, 12, 0.55) } },
    { chords: WINTER_B_CH, play: { pianoLH: 0.8, harp: 0.7, pad: 0.9, choir: 0.7, bass: 0.8, bells: 0.6 }, lines: { piano: shift(WINTER_B, 0, 0.95), flute: shift(WINTER_B, 12, 0.6) } },
    { chords: 'Bbmaj7 | C | Fmaj7 | Fmaj7', play: { celesta: 0.4, pad: 0.4, box: 0.4 } },
  ],
};

// ── Evening: "Sunset Pier" (F major, 4/4) ──

const EVE_A = mel(
  `A3:2 C4:2 | G3:2 E3:2 | F3:2 A3:1 D4:1 | D4:3 C4:1 |
   C4:2 F4:2 | Bb3:2 D4:1 C4:1 | C4:4 | E3:2 G3:2 |
   A3:2 C4:1 F4:1 | E4:3 C4:1 | D4:2 F4:2 | D4:2 Bb3:2 |
   Bb3:2 D4:1 G4:1 | E4:2 G4:1 E4:1 | F4:4 | F3:4`,
  4,
  86,
  0.97,
);
const EVE_B = mel(
  `A5:2 F5:1 D5:1 | E5:2 C5:1 E5:1 | F5:1 G5:1 A5:1 Bb5:1 | A5:3 -:1 |
   Bb5:2 A5:1 G5:1 | C6:2 A5:1 E5:1 | D6:1 C6:1 Bb5:1 A5:1 | G5:3 -:1`,
  4,
  82,
);
const EVE_A_CH = 'F | C/E | Dm | Bb | F/A | Gm | C | C7 | F | Am | Dm | Bb | Gm | C | F | F';
const EVE_B_CH = 'Dm | Am | Bb | F | Gm7 | Am7 | Bb | C';

const EVENING: SongDef = {
  name: 'evening',
  title: 'Sunset Pier',
  bpm: 76,
  bpb: 4,
  seed: 61,
  instruments: {
    piano: { program: 0, volume: 100, pan: -0.15, reverb: 62 },
    cello: { program: 42, volume: 104, pan: 0.2, reverb: 70 },
    violin: { program: 40, volume: 92, pan: 0.3, reverb: 70 },
    strings: { program: 49, volume: 74, reverb: 90, chorus: 30 },
    guitar: { program: 24, volume: 86, pan: -0.3, reverb: 50 },
    bass: { program: 32, volume: 84, reverb: 40 },
    drums: { program: 0, kit: 40, volume: 60, reverb: 45, loose: 0.02 },
  },
  layers: {
    piano: ['piano', arp('F3', 'C5', 4, [0, 1, 2, 3, 5, 3, 2, 1], 0.5, 56, 1.4)],
    pad: ['strings', pad('A3', 'F4', 3, 34)],
    guitar: ['guitar', fingerpick(52, [2, 1, 2, 0], [0, 2])],
    bass: ['bass', bass('F1', [[0, 'r', 1.8], [2, '5', 1.4], [3.5, 'a', 0.5]], 60)],
    brush: ['drums', groove([[0, 'kick', 38], [1, 'swirl', 30], [2, 'brush', 34], [3, 'swirl', 30]])],
    violin: ['violin', guide('F4', 'F5', 48, 'half')],
  },
  sections: [
    { chords: 'F | C/E | Dm | Bb', play: { piano: 0.45 } },
    { chords: EVE_A_CH, play: { piano: 0.55, pad: 0.35 }, lines: { cello: EVE_A } },
    { chords: EVE_B_CH, play: { piano: 0.6, pad: 0.6, bass: 0.5, brush: 0.4 }, lines: { violin: EVE_B } },
    { chords: EVE_A_CH, play: { guitar: 0.6, pad: 0.6, bass: 0.6, brush: 0.5 }, lines: { violin: shift(EVE_A, 12, 0.9), cello: shift(take(EVE_A, 8, 8, 4).map(([b, m, l, v]) => [b + 32, m, l, v] as Note), 0, 0.7) } },
    { chords: EVE_B_CH, play: { piano: 0.7, pad: 0.7, bass: 0.6, brush: 0.5 }, lines: { cello: shift(EVE_B, -12), violin: shift(EVE_B, 0, 0.6) } },
    { chords: 'Bb | C | F | F', play: { piano: 0.45, pad: 0.4 } },
  ],
};

// ── Night: "Starlit Hill" (E minor, 4/4) ──

const NIGHT_A = mel(`-:4 | -:4 | -:4 | -:4 | B5:2 G5:2 | A5:1 B5:1 E5:2 | C6:2 B5:1 A5:1 | F#5:4 | -:4 | -:4 | -:4 | -:4 | E6:2 D6:1 C6:1 | C6:2 B5:1 A5:1 | B5:2 D#6:2 | E6:4`, 4, 70);
const NIGHT_B = mel(`E5:2 C5:1 E5:1 | F#5:3 A5:1 | B5:2 D6:1 B5:1 | G5:3 E5:1 | A5:1 C6:1 E6:1 C6:1 | D#6:2 B5:2 | E6:3 B5:1 | G5:4`, 4, 72);
const NIGHT_A_CH = 'Em | Cmaj7 | G | D | Em | C | Am | B7 | Em | Cmaj7 | G | D | C | Am | B7 | Em';
const NIGHT_B_CH = 'Am7 | D | Gmaj7 | Cmaj7 | Am7 | B7 | Em | Em';

const NIGHT: SongDef = {
  name: 'night',
  title: 'Starlit Hill',
  bpm: 64,
  bpb: 4,
  seed: 71,
  instruments: {
    celesta: { program: 8, volume: 92, pan: 0.2, reverb: 100 },
    harp: { program: 46, volume: 96, pan: -0.2, reverb: 95 },
    pad: { program: 89, volume: 72, reverb: 100, chorus: 50 },
    box: { program: 10, volume: 88, pan: -0.1, reverb: 100 },
    flute: { program: 73, volume: 84, pan: 0.25, reverb: 95 },
    vibes: { program: 11, volume: 84, pan: 0.15, reverb: 95 },
    bass: { program: 35, volume: 80, reverb: 70 },
    drums: { program: 0, kit: 40, volume: 50, reverb: 80, loose: 0.02 },
  },
  layers: {
    celesta: ['celesta', arp('E4', 'B5', 3, [1, 2, 3, 2], 1, 46, 1.1)],
    harp: ['harp', arp('E2', 'B3', 4, [0, 1, 2, 3, 2, 1, 2, 3], 0.5, 44)],
    pad: ['pad', pad('G3', 'E4', 3, 40)],
    bass: ['bass', bass('E1', [[0, 'r', 3.8]], 54)],
    tri: ['drums', groove([[0, 'mtri', 24], [2.5, 'tri', 20]])],
  },
  sections: [
    { chords: 'Em | Cmaj7 | G | D', play: { harp: 0.4, pad: 0.3 } },
    { chords: NIGHT_A_CH, play: { harp: 0.5, pad: 0.5, bass: 0.4 }, lines: { box: NIGHT_A } },
    { chords: NIGHT_B_CH, play: { celesta: 0.6, pad: 0.6, bass: 0.5, tri: 0.4 }, lines: { flute: NIGHT_B } },
    { chords: NIGHT_A_CH, play: { celesta: 0.6, harp: 0.5, pad: 0.6, bass: 0.6, tri: 0.4 }, lines: { vibes: NIGHT_A, flute: shift(NIGHT_A, -12, 0.5) } },
    { chords: NIGHT_B_CH, play: { harp: 0.6, pad: 0.7, bass: 0.6 }, lines: { box: shift(NIGHT_B, 12, 0.9), vibes: shift(NIGHT_B, 0, 0.6) } },
    { chords: 'C | Am | B7 | Em', play: { harp: 0.4, pad: 0.4 } },
  ],
};

// ── Rain: "Rain on the Window" (A minor, 4/4) ──

const RAIN_A = mel(
  `E5:1.5 D5:.5 C5:1 E5:1 | A5:2 G5:1 E5:1 | G5:1.5 F5:.5 E5:1 C5:1 | D5:3 -:1 |
   E5:1 G5:1 C6:1.5 B5:.5 | A5:1 F5:1 D5:2 | G5:1 E5:1 B4:1 D5:1 | C5:3 -:1 |
   A5:1.5 G5:.5 F5:1 C5:1 | B4:1 D5:1 G5:2 | G5:1 E5:1 B5:1.5 A5:.5 | A5:3 -:1 |
   F5:1 A5:1 D6:1.5 C6:.5 | B5:1 G5:1 D5:2 | E5:1 G5:1 B5:1 C6:1 | B5:2 G#5:2`,
  4,
  78,
);
const RAIN_CH = 'Am7 | Fmaj7 | C | G | Am7 | Dm7 | Em7 | Am | F | G | Em | Am | Dm | G | Cmaj7 | E7';

const RAIN: SongDef = {
  name: 'rain',
  title: 'Rain on the Window',
  bpm: 72,
  bpb: 4,
  swing: 0.08,
  seed: 81,
  instruments: {
    rhodes: { program: 4, volume: 100, pan: -0.1, reverb: 70, chorus: 40 },
    vibes: { program: 11, volume: 92, pan: 0.2, reverb: 75 },
    cello: { program: 42, volume: 92, pan: 0.25, reverb: 70 },
    clarinet: { program: 71, volume: 86, pan: 0.15, reverb: 65 },
    bass: { program: 35, volume: 96, reverb: 35 },
    glock: { program: 9, volume: 70, pan: 0.35, reverb: 90 },
    strings: { program: 49, volume: 64, reverb: 90, chorus: 30 },
    drums: { program: 0, kit: 40, volume: 66, reverb: 45, loose: 0.02 },
  },
  layers: {
    comp: ['rhodes', stabs('E3', 'C5', 4, [0, 2.5], 1.8, 58)],
    rhodesArp: ['rhodes', arp('A3', 'E5', 4, [0, 2, 1, 3], 1, 50, 1.6)],
    bass: ['bass', bass('A1', [[0, 'r', 2.3], [2.5, '5', 1], [3.5, 'a', 0.5]], 68)],
    drops: ['glock', sparkle('A5', 'A6', 1.5, 44)],
    pad: ['strings', pad('A3', 'G4', 3, 32)],
    brush: ['drums', groove([[0, 'kick', 44], [1, 'swirl', 34], [2, 'brush', 40], [2.5, 'hat', 20], [3, 'swirl', 34], [3.5, 'hat', 22]], 8)],
  },
  sections: [
    { chords: 'Am7 | Fmaj7 | Dm7 | E7', play: { rhodesArp: 0.5, drops: 0.4 } },
    { chords: RAIN_CH, play: { comp: 0.55, bass: 0.5, drops: 0.5 }, lines: { vibes: RAIN_A } },
    { chords: RAIN_CH, play: { comp: 0.7, bass: 0.7, brush: 0.6, pad: 0.4, drops: 0.3 }, lines: { cello: shift(RAIN_A, -12, 1.05) } },
    { chords: 'Dm7 | G7 | Cmaj7 | Fmaj7 | Bm7b5 | E7 | Am7 | E7', play: { rhodesArp: 0.6, bass: 0.5, pad: 0.5, drops: 0.6 } },
    { chords: RAIN_CH, play: { comp: 0.75, bass: 0.75, brush: 0.7, pad: 0.5 }, lines: { clarinet: RAIN_A, vibes: shift(take(RAIN_A, 8, 8, 4).map(([b, m, l, v]) => [b + 32, m, l, v] as Note), 12, 0.5) } },
  ],
};

// ── The mine: "Lantern Deep" (D dorian, 4/4) ──

const MINE_A = mel(`D4:2 F4:1 E4:1 | C4:3 -:1 | D4:1 F4:1 A4:1 G4:1 | E4:3 -:1 | A4:2 G4:1 F4:1 | E4:2 C4:2 | D4:1 F4:1 G4:1 A4:1 | G4:3 -:1`, 4, 80);
const MINE_B = mel(`Bb3:2 D4:2 | A3:3 F3:1 | D4:2 F4:1 A4:1 | C5:3 A4:1 | Bb4:2 G4:1 F4:1 | E4:2 C4:2 | D4:1 F4:1 A4:1 D5:1 | C#5:3 -:1`, 4, 80);
const MINE_A_CH = 'Dm9 | C/D | Bbmaj7/D | C/D | Dm9 | Am7 | Bbmaj7 | C';
const MINE_B_CH = 'Gm7 | Dm | Bbmaj7 | F | Gm7 | Am7 | Bbmaj7 | A7';

const MINE: SongDef = {
  name: 'mine',
  title: 'Lantern Deep',
  bpm: 66,
  bpb: 4,
  seed: 91,
  instruments: {
    kalimba: { program: 108, volume: 96, pan: -0.2, reverb: 80 },
    bassoon: { program: 70, volume: 96, pan: 0.15, reverb: 75 },
    cello: { program: 42, volume: 92, pan: 0.25, reverb: 80 },
    contrabass: { program: 43, volume: 90, reverb: 70 },
    glass: { program: 92, volume: 66, reverb: 100, chorus: 40 },
    choir: { program: 53, volume: 60, reverb: 100 },
    bells: { program: 14, volume: 62, pan: -0.3, reverb: 100 },
    drips: { program: 11, volume: 60, pan: 0.4, reverb: 100 },
    marimba: { program: 12, volume: 74, pan: -0.1, reverb: 80 },
    drums: { program: 0, kit: 40, volume: 56, reverb: 70, loose: 0.02 },
  },
  layers: {
    kalimba: ['kalimba', arp('D4', 'A5', 4, [0, 2, 1, 3, 2, 0, 3, 1], 0.5, 52, 1.4)],
    drone: ['contrabass', bass('D1', [[0, 'r', 1.5], [2.5, 'r', 1.3]], 56)],
    glass: ['glass', pad('A3', 'F4', 3, 38)],
    choir: ['choir', pad('D4', 'A4', 3, 36)],
    counter: ['cello', guide('A3', 'A4', 50, 'half')],
    drips: ['drips', sparkle('A5', 'D7', 0.9, 36)],
    bells: ['bells', sparkle('D5', 'A5', 0.3, 40)],
    marimba: ['marimba', arp('D3', 'D4', 3, [0, 1, 2, 1], 1, 42, 1.2)],
    pulse: ['drums', groove([[0, 'kick', 36], [1.5, 'kick', 24], [2, 'swirl', 20], [3, 'shaker', 16]])],
  },
  sections: [
    { chords: 'Dm9 | C/D | Dm9 | C/D', play: { drone: 0.5, glass: 0.4, drips: 0.4 } },
    { chords: MINE_A_CH, play: { drone: 0.5, glass: 0.5, kalimba: 0.5 }, lines: { bassoon: MINE_A } },
    { chords: MINE_A_CH, play: { drone: 0.6, glass: 0.5, kalimba: 0.6, counter: 0.5, pulse: 0.5 }, lines: { bassoon: MINE_A } },
    { chords: MINE_B_CH, play: { drone: 0.7, choir: 0.5, marimba: 0.6, pulse: 0.6, bells: 0.5 }, lines: { cello: MINE_B } },
    { chords: 'Dm9 | Bbmaj7/D | C/D | Dm9 | Gm7 | C/D | Bbmaj7 | A7sus4', play: { glass: 0.5, drips: 0.6, drone: 0.4 } },
    { chords: MINE_A_CH, play: { drone: 0.7, glass: 0.6, kalimba: 0.7, counter: 0.6, pulse: 0.6, bells: 0.4 }, lines: { bassoon: MINE_A, marimba: shift(MINE_A, 12, 0.5) } },
    { chords: MINE_B_CH, play: { drone: 0.7, choir: 0.6, kalimba: 0.6, pulse: 0.6 }, lines: { cello: MINE_B, bassoon: shift(MINE_B, 0, 0.55) } },
    { chords: 'Dm9 | C/D | Bbmaj7/D | A7sus4', play: { drone: 0.5, glass: 0.4, drips: 0.4 } },
  ],
};

export const SONGS: SongDef[] = [TITLE, SPRING, SUMMER, AUTUMN, WINTER, EVENING, NIGHT, RAIN, MINE];

/** Performs a song and returns a seamless loop (reverb tails folded back onto the start). */
export async function performSong(song: SongDef): Promise<Buf> {
  const { events, beats } = arrange(song);
  const loopLen = (beats * 60) / song.bpm;
  const out = await render(events, loopLen + 6);
  return foldTail(out, loopLen);
}

/** For the credits: "Title (file)". */
export const SONG_TITLES = SONGS.map((s) => `${s.title} (${s.name})`);
