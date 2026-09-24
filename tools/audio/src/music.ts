/**
 * Original music for Lumina Isle, written as note data and performed by the recorded
 * instruments of the SoundFont (harp, music box, nylon guitar, flute, piano, cello, strings…).
 */
import { type Buf, foldTail, rng } from './dsp';
import { type Ev, render, voice } from './synth';

const NOTE: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
/** "F#5" → MIDI note number (C4 = 60). */
export function n(name: string): number {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note ${name}`);
  return NOTE[m[1]] + (Number(m[2]) + 1) * 12;
}

type Chord = string[];
/** [beat, note, lengthBeats, velocity] */
type BeatNote = [number, number, number, number];

interface Part {
  program: number;
  notes: BeatNote[];
  volume?: number;
  pan?: number;
  reverb?: number;
  chorus?: number;
}

interface Song {
  name: string;
  bpm: number;
  beatsPerBar: number;
  bars: number;
  parts: Part[];
}

/** Melody written as consecutive [note, beats] pairs ("-" = rest). */
function line(startBeat: number, seq: Array<[string, number]>, vel: number, legato = 0.95): BeatNote[] {
  const out: BeatNote[] = [];
  let b = startBeat;
  for (const [name, len] of seq) {
    if (name !== '-') out.push([b, n(name), len * legato, vel]);
    b += len;
  }
  return out;
}

function arpeggio(chords: Chord[], beatsPerBar: number, pattern: number[], step: number, vel: number, octave = 0, accent = 1.15): BeatNote[] {
  const out: BeatNote[] = [];
  chords.forEach((ch, bar) => {
    const notes = ch.map(n);
    pattern.forEach((idx, k) => {
      const beat = bar * beatsPerBar + k * step;
      if (beat >= (bar + 1) * beatsPerBar) return;
      const v = Math.round(vel * (k === 0 ? accent : 1) * (0.92 + ((k * 7 + bar * 3) % 5) * 0.03));
      out.push([beat, notes[idx % notes.length] + octave * 12 + (idx >= notes.length ? 12 : 0), step * 1.8, Math.min(127, v)]);
    });
  });
  return out;
}

function pad(chords: Chord[], beatsPerBar: number, vel: number, octave = 0, from = 1): BeatNote[] {
  const out: BeatNote[] = [];
  chords.forEach((ch, bar) => {
    for (const name of ch.slice(from)) out.push([bar * beatsPerBar, n(name) + octave * 12, beatsPerBar * 0.98, vel]);
  });
  return out;
}

function bassLine(chords: Chord[], beatsPerBar: number, beats: number[], vel: number, octave = 0): BeatNote[] {
  const out: BeatNote[] = [];
  chords.forEach((ch, bar) => {
    for (const b of beats) out.push([bar * beatsPerBar + b, n(ch[0]) + octave * 12, 0.9, vel]);
  });
  return out;
}

// ───────────────────────────── Title: "Lighthouse Lullaby" (D major, 3/4) ─────────────────────────────

const TITLE_CHORDS: Chord[] = [
  ['D3', 'A3', 'D4', 'F#4'],
  ['C#3', 'A3', 'C#4', 'E4'],
  ['B2', 'F#3', 'B3', 'D4'],
  ['F#2', 'C#3', 'F#3', 'A3'],
  ['G2', 'D3', 'G3', 'B3'],
  ['F#2', 'D3', 'F#3', 'A3'],
  ['E2', 'B2', 'E3', 'G3'],
  ['A2', 'E3', 'A3', 'C#4'],
  ['D3', 'A3', 'D4', 'F#4'],
  ['C#3', 'A3', 'C#4', 'E4'],
  ['B2', 'F#3', 'B3', 'D4'],
  ['F#2', 'C#3', 'F#3', 'A3'],
  ['G2', 'D3', 'G3', 'B3'],
  ['A2', 'E3', 'A3', 'C#4'],
  ['D3', 'A3', 'D4', 'F#4'],
  ['D3', 'A3', 'D4', 'F#4'],
];

const TITLE_MELODY: Array<[string, number]> = [
  ['F#5', 1], ['A5', 1], ['D6', 1],
  ['C#6', 2], ['A5', 1],
  ['B5', 1.5], ['A5', 0.5], ['F#5', 1],
  ['A5', 3],
  ['G5', 1], ['B5', 1], ['D6', 1],
  ['F#5', 2], ['E5', 1],
  ['E5', 1], ['G5', 1], ['B5', 1],
  ['A5', 2], ['G5', 0.5], ['E5', 0.5],
  ['F#5', 1], ['A5', 1], ['D6', 1],
  ['E6', 2], ['C#6', 1],
  ['D6', 1.5], ['C#6', 0.5], ['B5', 1],
  ['A5', 2], ['F#5', 1],
  ['G5', 1], ['B5', 1], ['E6', 1],
  ['D6', 1], ['C#6', 1], ['E5', 1],
  ['D6', 3],
  ['-', 3],
];

const TITLE: Song = {
  name: 'title',
  bpm: 80,
  beatsPerBar: 3,
  bars: 16,
  parts: [
    { program: 46, notes: arpeggio(TITLE_CHORDS, 3, [0, 1, 2, 3, 2, 1], 0.5, 70), reverb: 70, pan: -0.2, volume: 105 },
    { program: 10, notes: line(0, TITLE_MELODY, 88), reverb: 80, pan: 0.15, volume: 100 },
    { program: 73, notes: line(24, TITLE_MELODY.slice(20), 52).map(([b, nn, d, v]) => [b, nn - 12, d, v] as BeatNote), reverb: 70, pan: 0.3, volume: 80 },
    { program: 49, notes: pad(TITLE_CHORDS, 3, 38), reverb: 90, volume: 78, chorus: 30 },
  ],
};

// ───────────────────────────── Day: "Morning Fields" (G major, 4/4) ─────────────────────────────

const DAY_CHORDS: Chord[] = [
  ['G2', 'D3', 'G3', 'B3'],
  ['F#2', 'D3', 'A3', 'D4'],
  ['E2', 'B2', 'E3', 'G3'],
  ['C3', 'G3', 'C4', 'E4'],
  ['G2', 'D3', 'G3', 'B3'],
  ['D3', 'A3', 'D4', 'F#4'],
  ['C3', 'G3', 'C4', 'E4'],
  ['D3', 'A3', 'D4', 'F#4'],
  ['G2', 'D3', 'G3', 'B3'],
  ['F#2', 'D3', 'A3', 'D4'],
  ['E2', 'B2', 'E3', 'G3'],
  ['C3', 'G3', 'C4', 'E4'],
  ['A2', 'E3', 'A3', 'C4'],
  ['D3', 'A3', 'D4', 'F#4'],
  ['G2', 'D3', 'G3', 'B3'],
  ['G2', 'D3', 'G3', 'B3'],
];

const DAY_MELODY: Array<[string, number]> = [
  ['B5', 1], ['D6', 1], ['B5', 0.5], ['A5', 0.5], ['G5', 1],
  ['A5', 1.5], ['B5', 0.5], ['A5', 1], ['F#5', 1],
  ['G5', 1], ['B5', 1], ['E6', 1], ['D6', 1],
  ['C6', 1.5], ['B5', 0.5], ['A5', 1], ['G5', 1],
  ['B5', 0.5], ['C6', 0.5], ['D6', 1], ['G6', 1], ['D6', 1],
  ['E6', 1], ['D6', 1], ['C6', 0.5], ['B5', 0.5], ['A5', 1],
  ['G5', 1], ['E5', 1], ['C6', 1], ['B5', 1],
  ['A5', 3], ['-', 1],
  ['D6', 1], ['B5', 1], ['G5', 1], ['B5', 1],
  ['A5', 1], ['F#5', 1], ['D5', 1], ['F#5', 1],
  ['E5', 1], ['G5', 1], ['B5', 1], ['E6', 1],
  ['E6', 1], ['D6', 1], ['C6', 1], ['E5', 1],
  ['C6', 1], ['A5', 1], ['E6', 1], ['C6', 1],
  ['D6', 1], ['C6', 0.5], ['B5', 0.5], ['A5', 1], ['F#5', 1],
  ['G5', 2], ['B5', 1], ['D6', 1],
  ['G6', 3], ['-', 1],
];

function glockAccents(): BeatNote[] {
  return [4, 8, 12].flatMap((bar) => [
    [bar * 4, n('G6'), 0.5, 45] as BeatNote,
    [bar * 4 + 0.5, n('D7'), 0.5, 40] as BeatNote,
  ]);
}

const DAY: Song = {
  name: 'day',
  bpm: 104,
  beatsPerBar: 4,
  bars: 16,
  parts: [
    { program: 24, notes: arpeggio(DAY_CHORDS, 4, [0, 3, 1, 2, 0, 3, 1, 2], 0.5, 72, 1), reverb: 45, pan: -0.25, volume: 110 },
    { program: 45, notes: bassLine(DAY_CHORDS, 4, [0, 2], 70), reverb: 35, pan: 0.1, volume: 95 },
    { program: 73, notes: line(0, DAY_MELODY, 80, 0.9), reverb: 55, pan: 0.2, volume: 96 },
    { program: 9, notes: glockAccents(), reverb: 70, pan: 0.35, volume: 70 },
  ],
};

// ───────────────────────────── Evening: "Sunset Pier" (F major, 4/4) ─────────────────────────────

const EVE_CHORDS: Chord[] = [
  ['F2', 'C3', 'F3', 'A3'],
  ['E2', 'C3', 'G3', 'C4'],
  ['D2', 'A2', 'D3', 'F3'],
  ['Bb1', 'F2', 'Bb2', 'D3'],
  ['A2', 'C3', 'F3', 'A3'],
  ['G2', 'D3', 'G3', 'Bb3'],
  ['C3', 'G3', 'C4', 'E4'],
  ['C3', 'G3', 'Bb3', 'E4'],
  ['F2', 'C3', 'F3', 'A3'],
  ['A2', 'E3', 'A3', 'C4'],
  ['D2', 'A2', 'D3', 'F3'],
  ['Bb1', 'F2', 'Bb2', 'D3'],
  ['G2', 'D3', 'G3', 'Bb3'],
  ['C3', 'G3', 'C4', 'E4'],
  ['F2', 'C3', 'F3', 'A3'],
  ['F2', 'C3', 'F3', 'A3'],
];

const EVE_MELODY: Array<[string, number]> = [
  ['A3', 2], ['C4', 2],
  ['G3', 2], ['E3', 2],
  ['F3', 2], ['A3', 1], ['D4', 1],
  ['D4', 3], ['C4', 1],
  ['C4', 2], ['F4', 2],
  ['Bb3', 2], ['D4', 1], ['C4', 1],
  ['C4', 4],
  ['E3', 2], ['G3', 2],
  ['A3', 2], ['C4', 1], ['F4', 1],
  ['E4', 3], ['C4', 1],
  ['D4', 2], ['F4', 2],
  ['D4', 2], ['Bb3', 2],
  ['Bb3', 2], ['D4', 1], ['G4', 1],
  ['E4', 2], ['G4', 1], ['E4', 1],
  ['F4', 4],
  ['F3', 4],
];

const EVENING: Song = {
  name: 'evening',
  bpm: 76,
  beatsPerBar: 4,
  bars: 16,
  parts: [
    { program: 0, notes: arpeggio(EVE_CHORDS, 4, [0, 1, 2, 3, 5, 3, 2, 1], 0.5, 58, 1, 1.2), reverb: 60, pan: -0.15, volume: 100 },
    { program: 42, notes: line(0, EVE_MELODY, 84, 0.97), reverb: 70, pan: 0.2, volume: 105 },
    { program: 49, notes: pad(EVE_CHORDS, 4, 34), reverb: 90, volume: 72, chorus: 30 },
  ],
};

// ───────────────────────────── Night: "Starlit Hill" (E minor, 4/4) ─────────────────────────────

const NIGHT_CHORDS: Chord[] = [
  ['E2', 'B2', 'E3', 'G3'],
  ['C3', 'G3', 'B3', 'E4'],
  ['G2', 'D3', 'G3', 'B3'],
  ['D3', 'A3', 'D4', 'F#4'],
  ['E2', 'B2', 'E3', 'G3'],
  ['C3', 'G3', 'C4', 'E4'],
  ['A2', 'E3', 'A3', 'C4'],
  ['B2', 'F#3', 'A3', 'D#4'],
  ['E2', 'B2', 'E3', 'G3'],
  ['C3', 'G3', 'B3', 'E4'],
  ['G2', 'D3', 'G3', 'B3'],
  ['D3', 'A3', 'D4', 'F#4'],
  ['C3', 'G3', 'C4', 'E4'],
  ['A2', 'E3', 'A3', 'C4'],
  ['B2', 'F#3', 'B3', 'D#4'],
  ['E2', 'B2', 'E3', 'G3'],
];

const NIGHT_MELODY_A: Array<[string, number]> = [['B5', 2], ['G5', 2], ['A5', 1], ['B5', 1], ['E5', 2], ['C6', 2], ['B5', 1], ['A5', 1], ['F#5', 4]];
const NIGHT_MELODY_B: Array<[string, number]> = [['E6', 2], ['D6', 1], ['C6', 1], ['C6', 2], ['B5', 1], ['A5', 1], ['B5', 2], ['D#6', 2], ['E6', 4]];

const NIGHT: Song = {
  name: 'night',
  bpm: 64,
  beatsPerBar: 4,
  bars: 16,
  parts: [
    { program: 8, notes: arpeggio(NIGHT_CHORDS, 4, [1, 2, 3, 2], 1, 50, 2, 1.05), reverb: 100, pan: 0.2, volume: 95 },
    { program: 46, notes: bassLine(NIGHT_CHORDS, 4, [0], 64), reverb: 90, pan: -0.2, volume: 100 },
    { program: 89, notes: pad(NIGHT_CHORDS, 4, 40), reverb: 100, volume: 75, chorus: 50 },
    { program: 10, notes: [...line(16, NIGHT_MELODY_A, 70), ...line(48, NIGHT_MELODY_B, 70)], reverb: 100, pan: -0.1, volume: 90 },
  ],
};

// ───────────────────────────── Rain: "Rain on the Window" (A minor, 4/4) ─────────────────────────────

const RAIN_CHORDS: Chord[] = [
  ['A2', 'E3', 'G3', 'C4'],
  ['F2', 'C3', 'E3', 'A3'],
  ['C3', 'G3', 'C4', 'E4'],
  ['G2', 'D3', 'G3', 'B3'],
  ['A2', 'E3', 'G3', 'C4'],
  ['D3', 'A3', 'C4', 'F4'],
  ['E2', 'B2', 'D3', 'G3'],
  ['A2', 'E3', 'A3', 'C4'],
  ['F2', 'C3', 'F3', 'A3'],
  ['G2', 'D3', 'G3', 'B3'],
  ['E2', 'B2', 'E3', 'G3'],
  ['A2', 'E3', 'A3', 'C4'],
  ['D3', 'A3', 'D4', 'F4'],
  ['G2', 'D3', 'G3', 'B3'],
  ['C3', 'G3', 'B3', 'E4'],
  ['E2', 'B2', 'D3', 'G#3'],
];

function rhodesComp(): BeatNote[] {
  const out: BeatNote[] = [];
  RAIN_CHORDS.forEach((ch, bar) => {
    for (const [b, v] of [
      [0, 62],
      [2.5, 50],
    ] as const)
      for (const name of ch.slice(1)) out.push([bar * 4 + b, n(name) + 12, b === 0 ? 2.3 : 1.4, v]);
  });
  return out;
}

function raindrops(): BeatNote[] {
  const r = rng(42);
  const scale = ['A5', 'C6', 'D6', 'E6', 'G6', 'A6'];
  const out: BeatNote[] = [];
  for (let bar = 0; bar < 16; bar++) {
    const count = 1 + Math.floor(r() * 3);
    for (let k = 0; k < count; k++) out.push([bar * 4 + Math.floor(r() * 8) / 2, n(scale[Math.floor(r() * scale.length)]), 0.6, 35 + Math.floor(r() * 25)]);
  }
  return out;
}

const RAIN: Song = {
  name: 'rain',
  bpm: 72,
  beatsPerBar: 4,
  bars: 16,
  parts: [
    { program: 4, notes: rhodesComp(), reverb: 70, pan: -0.1, volume: 100, chorus: 40 },
    { program: 32, notes: bassLine(RAIN_CHORDS, 4, [0, 2.5], 66), reverb: 30, volume: 100 },
    { program: 9, notes: raindrops(), reverb: 90, pan: 0.3, volume: 80 },
    { program: 49, notes: pad(RAIN_CHORDS, 4, 30), reverb: 90, volume: 70, chorus: 30 },
  ],
};

export const SONGS: Song[] = [TITLE, DAY, EVENING, NIGHT, RAIN];

/** Performs a song and returns a seamless loop (reverb tail folded back onto the start). */
export async function performSong(song: Song): Promise<Buf> {
  const spb = 60 / song.bpm;
  const loopLen = song.bars * song.beatsPerBar * spb;
  const events: Ev[] = [];
  let ch = 0;
  for (const part of song.parts) {
    if (ch === 9) ch++;
    const notes = part.notes.map(([b, note, len, vel]) => [b * spb, note, len * spb, vel] as [number, number, number, number]);
    events.push(...voice(ch, part.program, notes, { volume: part.volume, pan: part.pan, reverb: part.reverb, chorus: part.chorus }));
    ch++;
  }
  const out = await render(events, loopLen + 5);
  return foldTail(out, loopLen);
}
