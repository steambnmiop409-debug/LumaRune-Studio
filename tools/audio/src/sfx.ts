/**
 * Sound effect recipes. Every effect is built from recorded samples in the SoundFont
 * (GS "SFX" kit foley, percussion, and real instruments), then edited: layered, sliced,
 * pitch-varied, filtered, faded and loudness-matched — one file per sound.
 */
import { type Buf, db, eq, fade, gain, highpass, lowpass, mix, normalize, resample, rng, silence, slice, trim } from './dsp';
import { DRUM, KIT, hit, render, voice } from './synth';

// GS SFX kit keys (recorded one-shots and loops).
const SFX = { slap: 40, scratch: 61, footsteps1: 56, footsteps2: 57, doorCreak: 59, door: 60, windchime: 62, birds: 78, rain: 79, thunder: 80, wind: 81, seashore: 82, stream: 83, bubble: 84 } as const;
// Standard kit keys.
const STD = { kick: 36, sideStick: 37, snare: 38, lowTom: 45, cabasa: 69, maracas: 70, hiWood: 76, lowWood: 77, openTriangle: 81 } as const;
// General MIDI programs (recorded instruments).
const GM = { celesta: 8, glockenspiel: 9, musicBox: 10, marimba: 12, tubularBells: 14, pizzicato: 45, harp: 46, tuba: 58, frenchHorn: 60, bassoon: 70, kalimba: 108, tinkleBell: 112, birdTweet: 123 } as const;

async function oneShot(kit: number, key: number, vel: number, seconds = 2): Promise<Buf> {
  return render(hit(kit, key, vel, 0, seconds), seconds + 0.5, false);
}

export interface SfxRecipe {
  name: string;
  variants: number;
  /** Target peak level in dBFS (sets relative loudness between effects). */
  level: number;
  make(v: number): Promise<Buf>;
}

export const SFX_RECIPES: SfxRecipe[] = [
  {
    name: 'step_grass',
    variants: 4,
    level: -9,
    // Soft footfall: recorded footstep, softened and shortened, with a whisper of shaker for grass rustle.
    async make(v) {
      const r = rng(10 + v);
      let step = await oneShot(KIT.sfx, v % 2 ? SFX.footsteps1 : SFX.footsteps2, 80 + v * 8, 0.6);
      step = resample(trim(step, -45), 0.92 + r() * 0.16);
      lowpass(step, 2400);
      const rustle = lowpass(highpass(await oneShot(KIT.standard, STD.cabasa, 28 + v * 4, 0.4), 2000), 6000);
      return fade(mix(step, trim(rustle, -40), 0.005, 0.25), 0.002, 0.05);
    },
  },
  {
    name: 'step_path',
    variants: 4,
    level: -8,
    // Gravel & dirt: crisper footstep plus a maracas crunch.
    async make(v) {
      const r = rng(20 + v);
      let step = await oneShot(KIT.sfx, v % 2 ? SFX.footsteps2 : SFX.footsteps1, 95, 0.6);
      step = resample(trim(step, -45), 0.95 + r() * 0.15);
      highpass(step, 180);
      eq(step, 3200, 3);
      const grit = highpass(await oneShot(KIT.standard, STD.maracas, 30 + v * 5, 0.4), 1500);
      return fade(mix(step, trim(grit, -40), 0.004, 0.22), 0.002, 0.05);
    },
  },
  {
    name: 'step_wood',
    variants: 3,
    level: -8,
    // Hollow boards of the pier and bridge: low wood block knock under a footstep.
    async make(v) {
      const knock = lowpass(trim(await oneShot(KIT.standard, STD.lowWood, 40 + v * 6, 0.5), -45), 1500);
      const step = resample(trim(await oneShot(KIT.sfx, SFX.footsteps1, 90, 0.6), -45), 0.85 + v * 0.05);
      return fade(mix(gain(knock, 0.7), step, 0.0, 0.8), 0.002, 0.06);
    },
  },
  {
    name: 'hoe',
    variants: 3,
    level: -5,
    // Blade into soil: a muffled kick thud, a slowed footstep crunch and a short scrape of earth.
    async make(v) {
      const r = rng(30 + v);
      const thud = lowpass(await oneShot(KIT.standard, STD.kick, 60 + v * 8, 0.5), 380);
      const crunch = resample(trim(await oneShot(KIT.sfx, SFX.footsteps2, 110, 0.6), -45), 0.68 + r() * 0.1);
      const scrape = lowpass(resample(trim(await oneShot(KIT.sfx, SFX.scratch, 70, 0.6), -40), 0.75 + r() * 0.1), 2600);
      let out = mix(gain(thud, 1.2), crunch, 0.01, 0.9);
      out = mix(out, scrape, 0.035, 0.35);
      return fade(trim(out, -50), 0.002, 0.12);
    },
  },
  {
    name: 'water',
    variants: 1,
    level: -8,
    // Watering can: a short cut of a recorded stream, brightened, with a few bubbles.
    async make() {
      const stream = await render(hit(KIT.sfx, SFX.stream, 110, 0, 4), 4, false);
      const bubbles = await render(hit(KIT.sfx, SFX.bubble, 80, 0, 3), 3, false);
      let out = slice(stream, 1.2, 2.2);
      highpass(out, 350);
      out = mix(out, slice(bubbles, 0.6, 1.2), 0.1, 0.35);
      return fade(out, 0.06, 0.45);
    },
  },
  {
    name: 'refill',
    variants: 1,
    level: -7,
    // Dipping the can: rising gurgle of bubbles over running water.
    async make() {
      const bubbles = await render(hit(KIT.sfx, SFX.bubble, 110, 0, 4), 4, false);
      const stream = await render(hit(KIT.sfx, SFX.stream, 90, 0, 4), 4, false);
      let out = resample(slice(bubbles, 0.4, 1.5), 1.1);
      out = mix(out, lowpass(slice(stream, 1.6, 2.6), 3000), 0, 0.6);
      return fade(out, 0.03, 0.4);
    },
  },
  {
    name: 'plant',
    variants: 1,
    level: -9,
    // Pressing a seed into soil: brush-kit tap and a light pat of earth.
    async make() {
      const brush = lowpass(await oneShot(KIT.brush, STD.snare, 55, 0.6), 3200);
      const pat = lowpass(resample(trim(await oneShot(KIT.sfx, SFX.footsteps1, 60, 0.6), -45), 1.25), 1800);
      return fade(trim(mix(brush, pat, 0.02, 0.6), -50), 0.002, 0.08);
    },
  },
  {
    name: 'harvest',
    variants: 2,
    level: -6,
    // Pulling a ripe crop: bright kalimba + pizzicato pluck.
    async make(v) {
      const notes = v === 0 ? [79, 84] : [76, 83];
      const ev = [...voice(0, GM.kalimba, [[0, notes[1], 0.5, 100]], { reverb: 30 }), ...voice(1, GM.pizzicato, [[0.01, notes[0], 0.4, 90]], { reverb: 30 })];
      return fade(trim(await render(ev, 1.4), -45), 0.001, 0.3);
    },
  },
  {
    name: 'pop',
    variants: 3,
    level: -6,
    // "Pop!" as the crop leaves the ground: high wood block, sped up, with a hand slap.
    async make(v) {
      const block = resample(trim(await oneShot(KIT.standard, STD.hiWood, 85, 0.4), -45), 1.25 + v * 0.18);
      const slap = highpass(trim(await oneShot(KIT.sfx, SFX.slap, 70, 0.5), -40), 900);
      return fade(mix(block, slap, 0, 0.3), 0.001, 0.05);
    },
  },
  {
    name: 'coin',
    variants: 1,
    level: -7,
    // Money: two-note music box chime with a tinkle bell sparkle.
    async make() {
      const ev = [
        ...voice(0, GM.musicBox, [
          [0, 88, 0.6, 105],
          [0.08, 95, 0.9, 110],
        ], { reverb: 50 }),
        ...voice(1, GM.tinkleBell, [[0.08, 100, 0.5, 45]], { reverb: 60 }),
      ];
      return fade(trim(await render(ev, 1.6), -50), 0.001, 0.5);
    },
  },
  {
    name: 'click',
    variants: 1,
    level: -14,
    // UI tick: a side-stick rim click, tightened.
    async make() {
      const c = highpass(resample(trim(await oneShot(KIT.standard, STD.sideStick, 45, 0.3), -40), 1.3), 900);
      return fade(slice(c, 0, 0.08), 0.001, 0.03);
    },
  },
  {
    name: 'open',
    variants: 1,
    level: -11,
    // Opening the journal: a gentle rising harp flourish.
    async make() {
      const ev = voice(0, GM.harp, [
        [0, 72, 0.6, 60],
        [0.035, 76, 0.6, 64],
        [0.07, 79, 0.6, 68],
        [0.105, 84, 0.8, 72],
      ], { reverb: 45 });
      return fade(trim(await render(ev, 1.5), -45), 0.001, 0.4);
    },
  },
  {
    name: 'close',
    variants: 1,
    level: -13,
    async make() {
      const ev = voice(0, GM.harp, [
        [0, 79, 0.5, 55],
        [0.04, 76, 0.5, 52],
        [0.08, 72, 0.7, 50],
      ], { reverb: 45 });
      return fade(trim(await render(ev, 1.2), -45), 0.001, 0.35);
    },
  },
  {
    name: 'error',
    variants: 1,
    level: -10,
    // Soft "nope": two descending marimba notes.
    async make() {
      const ev = voice(0, GM.marimba, [
        [0, 57, 0.25, 95],
        [0.11, 53, 0.4, 90],
      ], { reverb: 20 });
      return fade(trim(await render(ev, 1), -45), 0.001, 0.25);
    },
  },
  {
    name: 'crate',
    variants: 1,
    level: -6,
    // A wooden crate set down: recorded door thump, slowed, plus a low tom body.
    async make() {
      const door = lowpass(resample(trim(await oneShot(KIT.sfx, SFX.door, 100, 1), -45), 0.8), 1800);
      const body = lowpass(await oneShot(KIT.standard, STD.lowTom, 60, 0.6), 600);
      return fade(trim(mix(door, body, 0.005, 0.7), -50), 0.001, 0.15);
    },
  },
  {
    name: 'horn',
    variants: 1,
    level: -4,
    // The cargo sloop's horn: tuba + french horn + bassoon in low unison, one long and one short blast, heard across the water.
    async make() {
      const blast = (t: number, d: number): Array<[number, number, number, number]> => [[t, 38, d, 110]];
      const ev = [
        ...voice(0, GM.tuba, [...blast(0, 1.6), ...blast(2.0, 0.7)], { reverb: 90 }),
        ...voice(1, GM.frenchHorn, [
          [0, 50, 1.6, 100],
          [2.0, 50, 0.7, 95],
        ], { reverb: 90 }),
        ...voice(2, GM.bassoon, [
          [0, 45, 1.6, 90],
          [2.0, 45, 0.7, 85],
        ], { reverb: 90 }),
      ];
      const out = lowpass(await render(ev, 4.5), 1400);
      return fade(trim(out, -50), 0.08, 1.2);
    },
  },
  {
    name: 'bell',
    variants: 1,
    level: -8,
    // Harbour bell announcing the ship: two strikes of tubular bells.
    async make() {
      const ev = voice(0, GM.tubularBells, [
        [0, 72, 1.5, 100],
        [0.55, 72, 2.0, 90],
      ], { reverb: 80 });
      return fade(trim(await render(ev, 4), -50), 0.001, 1.2);
    },
  },
  {
    name: 'thunder',
    variants: 1,
    level: -2,
    // Recorded thunder roll, darkened.
    async make() {
      const t = lowpass(await render(hit(KIT.sfx, SFX.thunder, 127, 0, 5), 5, false), 3200);
      return fade(trim(t, -50), 0.02, 0.8);
    },
  },
  {
    name: 'fert',
    variants: 1,
    level: -10,
    // Scattering fertilizer: three quick shakes of cabasa and maracas.
    async make() {
      let out = silence(0.5);
      for (let i = 0; i < 3; i++) {
        out = mix(out, trim(await oneShot(KIT.standard, i % 2 ? STD.maracas : STD.cabasa, 55 + i * 8, 0.4), -45), i * 0.07, 0.8 - i * 0.15);
      }
      return fade(highpass(out, 1400), 0.001, 0.12);
    },
  },
  {
    name: 'door',
    variants: 1,
    level: -8,
    // Shop door: a short creak and a little bell hung over the door.
    async make() {
      const creak = slice(await render(hit(KIT.sfx, SFX.doorCreak, 90, 0, 2), 2, false), 0, 0.5);
      const bell = await render(voice(0, GM.glockenspiel, [
        [0, 93, 0.4, 70],
        [0.09, 100, 0.6, 60],
      ], { reverb: 50 }), 1.6);
      const out = mix(gain(fade(creak, 0.01, 0.2), 0.6), bell, 0.06, 0.9);
      return fade(trim(out, -50), 0.001, 0.5);
    },
  },
  {
    name: 'chime',
    variants: 1,
    level: -8,
    // Morning: a recorded wind chime.
    async make() {
      const c = await render(hit(KIT.sfx, SFX.windchime, 100, 0, 5), 5);
      return fade(slice(c, 0, 3.5), 0.01, 1.5);
    },
  },
  {
    name: 'sparkle',
    variants: 1,
    level: -11,
    async make() {
      const ev = voice(0, GM.celesta, [
        [0, 84, 0.4, 70],
        [0.04, 88, 0.4, 70],
        [0.08, 91, 0.4, 70],
        [0.12, 96, 0.6, 75],
      ], { reverb: 60 });
      return fade(trim(await render(ev, 1.4), -45), 0.001, 0.4);
    },
  },
];

// ───────────────────────────── Ambience beds ─────────────────────────────

export interface AmbRecipe {
  name: string;
  /** Target peak dBFS. */
  level: number;
  make(): Promise<Buf>;
}

/** Holds a recorded loop sample for a long time and returns its steady middle. */
async function held(key: number, seconds: number, vel = 110): Promise<Buf> {
  const b = await render(hit(KIT.sfx, key, vel, 0, seconds + 1), seconds + 1.5, false);
  return slice(b, 1, seconds);
}

export const AMB_RECIPES: AmbRecipe[] = [
  {
    name: 'sea',
    level: -6,
    // Waves on the shore: the recorded seashore sample layered with the GM seashore patch, offset for variety.
    async make() {
      const a = await held(SFX.seashore, 25);
      const b = await render(voice(0, 122, [[0, 55, 26, 90]], { reverb: 30, pan: 0.3 }), 26, true);
      const out = mix(a, slice(b, 3, 26), 0, 0.55);
      return lowpass(out, 7000);
    },
  },
  {
    name: 'rain',
    level: -5,
    async make() {
      const r = await held(SFX.rain, 25);
      return lowpass(highpass(r, 120), 9000);
    },
  },
  {
    name: 'wind',
    level: -7,
    async make() {
      return lowpass(await held(SFX.wind, 25, 120), 5000);
    },
  },
  {
    name: 'birds',
    level: -9,
    // Morning birdsong: the recorded birds loop plus scattered tweets at different pitches.
    async make() {
      const base = await held(SFX.birds, 25, 100);
      const r = rng(77);
      const tweets: Array<[number, number, number, number]> = [];
      for (let t = 0.5; t < 23; t += 1.2 + r() * 2.8) tweets.push([t, 84 + Math.floor(r() * 10), 0.18 + r() * 0.2, 40 + Math.floor(r() * 30)]);
      const extra = await render(voice(0, GM.birdTweet, tweets, { reverb: 50, pan: 0.4 }), 25);
      return highpass(mix(base, slice(extra, 1, 25), 0, 0.5), 450);
    },
  },
  {
    name: 'crickets',
    level: -14,
    // Summer night: very short, very high bird-tweet grains in cricket rhythms (three pulses per chirp), two insects panned apart.
    async make() {
      const r = rng(5);
      let out = silence(24);
      for (const [pan, rate, base] of [
        [-0.5, 0.95, 0],
        [0.55, 1.08, 0.37],
      ] as const) {
        const notes: Array<[number, number, number, number]> = [];
        for (let t = 0.3 + base; t < 23; t += 0.75 + r() * 0.35) for (let k = 0; k < 3; k++) notes.push([t + k * 0.055, 108, 0.035, 60 + Math.floor(r() * 20)]);
        const c = await render(voice(0, GM.birdTweet, notes, { reverb: 45 }), 24);
        out = mix(out, resample(c, rate), 0, 1, pan);
      }
      return lowpass(highpass(out, 2500), 8000);
    },
  },
];

export { db, normalize, DRUM };
