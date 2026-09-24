import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { SoundBankLoader, SpessaSynthProcessor, SPESSA_BUFSIZE, type BasicSoundBank } from 'spessasynth_core';
import { SR, type Buf } from './dsp';

const require = createRequire(import.meta.url);
let bank: BasicSoundBank | null = null;

/** GeneralUser GS — a SoundFont made of recorded instrument and sound-effect samples. */
function soundBank(): BasicSoundBank {
  if (!bank) {
    const f = readFileSync(require.resolve('generaluser/GeneralUser.sf2'));
    bank = SoundBankLoader.fromArrayBuffer(f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength) as ArrayBuffer);
  }
  return bank;
}

export type Ev =
  | { t: number; type: 'prog'; ch: number; program: number }
  | { t: number; type: 'on'; ch: number; note: number; vel: number }
  | { t: number; type: 'off'; ch: number; note: number }
  | { t: number; type: 'cc'; ch: number; cc: number; value: number }
  | { t: number; type: 'bend'; ch: number; value: number };

/** Drum channel (GS): program 56 selects the SFX kit of recorded sound effects. */
export const DRUM = 9;
export const KIT = { standard: 0, room: 8, brush: 40, orchestral: 48, sfx: 56 } as const;

/** Plays a list of MIDI events through the SoundFont and returns the recorded stereo audio. */
export async function render(events: Ev[], seconds: number, reverb = true): Promise<Buf> {
  const synth = new SpessaSynthProcessor(SR, { enableEffects: reverb } as never);
  synth.soundBankManager.addSoundBank(soundBank(), 'main');
  await synth.processorInitialized;
  const n = Math.round(seconds * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const evs = [...events].sort((a, b) => a.t - b.t);
  let e = 0;
  let i = 0;
  while (i < n) {
    while (e < evs.length && Math.round(evs[e].t * SR) <= i) {
      const ev = evs[e++];
      switch (ev.type) {
        case 'prog':
          synth.programChange(ev.ch, ev.program);
          break;
        case 'on':
          synth.noteOn(ev.ch, ev.note, ev.vel);
          break;
        case 'off':
          synth.noteOff(ev.ch, ev.note);
          break;
        case 'cc':
          synth.controllerChange(ev.ch, ev.cc as never, ev.value);
          break;
        case 'bend':
          synth.pitchWheel(ev.ch, ev.value);
          break;
      }
    }
    const next = e < evs.length ? Math.round(evs[e].t * SR) : n;
    const count = Math.max(1, Math.min(SPESSA_BUFSIZE, next - i, n - i));
    synth.process(L, R, i, count);
    i += count;
  }
  return { L, R };
}

/** Convenience: one hit on the drum channel (a recorded one-shot). */
export function hit(kit: number, key: number, vel = 110, t = 0, holdSec = 4): Ev[] {
  return [
    { t, type: 'prog', ch: DRUM, program: kit },
    { t, type: 'on', ch: DRUM, note: key, vel },
    { t: t + holdSec, type: 'off', ch: DRUM, note: key },
  ];
}

/** Convenience: melodic notes on one channel. `notes` = [time, midi, duration, velocity]. */
export function voice(ch: number, program: number, notes: Array<[number, number, number, number]>, opts: { volume?: number; pan?: number; reverb?: number; chorus?: number } = {}): Ev[] {
  const ev: Ev[] = [
    { t: 0, type: 'prog', ch, program },
    { t: 0, type: 'cc', ch, cc: 7, value: opts.volume ?? 100 },
    { t: 0, type: 'cc', ch, cc: 10, value: 64 + Math.round((opts.pan ?? 0) * 63) },
    { t: 0, type: 'cc', ch, cc: 91, value: opts.reverb ?? 40 },
    { t: 0, type: 'cc', ch, cc: 93, value: opts.chorus ?? 0 },
  ];
  for (const [t, note, dur, vel] of notes) {
    ev.push({ t, type: 'on', ch, note, vel });
    ev.push({ t: t + dur, type: 'off', ch, note });
  }
  return ev;
}
