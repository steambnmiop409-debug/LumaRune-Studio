/** Tiny offline DSP toolkit for shaping rendered recordings into game-ready sounds. */
export const SR = 44100;

export interface Buf {
  L: Float32Array;
  R: Float32Array;
}

export function silence(seconds: number): Buf {
  const n = Math.max(1, Math.round(seconds * SR));
  return { L: new Float32Array(n), R: new Float32Array(n) };
}

export function length(b: Buf): number {
  return b.L.length / SR;
}

/** Adds `src` into `dst` starting at `at` seconds. Grows `dst` if needed. */
export function mix(dst: Buf, src: Buf, at = 0, gain = 1, pan = 0): Buf {
  const off = Math.round(at * SR);
  const need = off + src.L.length;
  if (need > dst.L.length) {
    const L = new Float32Array(need);
    const R = new Float32Array(need);
    L.set(dst.L);
    R.set(dst.R);
    dst = { L, R };
  }
  const gl = gain * Math.min(1, 1 - pan);
  const gr = gain * Math.min(1, 1 + pan);
  for (let i = 0; i < src.L.length; i++) {
    dst.L[off + i] += src.L[i] * gl;
    dst.R[off + i] += src.R[i] * gr;
  }
  return dst;
}

export function slice(b: Buf, from: number, to: number): Buf {
  const a = Math.max(0, Math.round(from * SR));
  const z = Math.min(b.L.length, Math.round(to * SR));
  return { L: b.L.slice(a, z), R: b.R.slice(a, z) };
}

export function gain(b: Buf, g: number): Buf {
  for (let i = 0; i < b.L.length; i++) {
    b.L[i] *= g;
    b.R[i] *= g;
  }
  return b;
}

export function peak(b: Buf): number {
  let p = 0;
  for (let i = 0; i < b.L.length; i++) p = Math.max(p, Math.abs(b.L[i]), Math.abs(b.R[i]));
  return p;
}

export function rms(b: Buf): number {
  let s = 0;
  for (let i = 0; i < b.L.length; i++) s += b.L[i] * b.L[i] + b.R[i] * b.R[i];
  return Math.sqrt(s / (b.L.length * 2));
}

export const db = (v: number) => 10 ** (v / 20);

/** Scales so the loudest sample hits `targetDb` dBFS. */
export function normalize(b: Buf, targetDb = -1): Buf {
  const p = peak(b);
  return p > 0 ? gain(b, db(targetDb) / p) : b;
}

/** Scales to a target RMS (perceived loudness), then soft-limits peaks. */
export function loudness(b: Buf, targetRmsDb: number, ceilingDb = -1): Buf {
  const r = rms(b);
  if (r > 0) gain(b, db(targetRmsDb) / r);
  return softLimit(b, ceilingDb);
}

export function softLimit(b: Buf, ceilingDb = -1): Buf {
  const c = db(ceilingDb);
  const f = (x: number) => (Math.abs(x) <= c * 0.7 ? x : Math.sign(x) * (c * 0.7 + c * 0.3 * Math.tanh((Math.abs(x) - c * 0.7) / (c * 0.3))));
  for (let i = 0; i < b.L.length; i++) {
    b.L[i] = f(b.L[i]);
    b.R[i] = f(b.R[i]);
  }
  return b;
}

/** Removes leading/trailing silence below `thresholdDb` (relative to peak). */
export function trim(b: Buf, thresholdDb = -50, keepTail = 0.02): Buf {
  const t = peak(b) * db(thresholdDb);
  let a = 0;
  while (a < b.L.length && Math.abs(b.L[a]) < t && Math.abs(b.R[a]) < t) a++;
  let z = b.L.length - 1;
  while (z > a && Math.abs(b.L[z]) < t && Math.abs(b.R[z]) < t) z--;
  z = Math.min(b.L.length, z + Math.round(keepTail * SR));
  return { L: b.L.slice(Math.max(0, a - 32), z), R: b.R.slice(Math.max(0, a - 32), z) };
}

export function fade(b: Buf, inSec: number, outSec: number): Buf {
  const n = b.L.length;
  const fi = Math.min(n, Math.round(inSec * SR));
  const fo = Math.min(n, Math.round(outSec * SR));
  for (let i = 0; i < fi; i++) {
    const g = Math.sin(((i / fi) * Math.PI) / 2);
    b.L[i] *= g;
    b.R[i] *= g;
  }
  for (let i = 0; i < fo; i++) {
    const g = Math.cos(((i / fo) * Math.PI) / 2);
    b.L[n - fo + i] *= g;
    b.R[n - fo + i] *= g;
  }
  return b;
}

/** Varispeed pitch shift (like a tape machine): rate > 1 is higher and shorter. */
export function resample(b: Buf, rate: number): Buf {
  const n = Math.floor(b.L.length / rate);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * rate;
    const i0 = Math.floor(x);
    const f = x - i0;
    const i1 = Math.min(b.L.length - 1, i0 + 1);
    L[i] = b.L[i0] * (1 - f) + b.L[i1] * f;
    R[i] = b.R[i0] * (1 - f) + b.R[i1] * f;
  }
  return { L, R };
}

function biquad(b: Buf, type: 'lp' | 'hp' | 'peak', freq: number, q = 0.707, gainDb = 0): Buf {
  const w = (2 * Math.PI * freq) / SR;
  const cos = Math.cos(w);
  const sin = Math.sin(w);
  const alpha = sin / (2 * q);
  const A = 10 ** (gainDb / 40);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (type === 'lp') {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = (1 - cos) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  } else if (type === 'hp') {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = (1 + cos) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  } else {
    b0 = 1 + alpha * A;
    b1 = -2 * cos;
    b2 = 1 - alpha * A;
    a0 = 1 + alpha / A;
    a1 = -2 * cos;
    a2 = 1 - alpha / A;
  }
  for (const ch of [b.L, b.R]) {
    let x1 = 0,
      x2 = 0,
      y1 = 0,
      y2 = 0;
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i];
      const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      ch[i] = y;
    }
  }
  return b;
}

export const lowpass = (b: Buf, f: number, q?: number) => biquad(b, 'lp', f, q);
export const highpass = (b: Buf, f: number, q?: number) => biquad(b, 'hp', f, q);
export const eq = (b: Buf, f: number, gainDb: number, q = 1) => biquad(b, 'peak', f, q, gainDb);

/** Makes a seamless loop: the last `xfade` seconds are cross-faded into the start. */
export function loopify(b: Buf, xfade: number): Buf {
  const n = b.L.length;
  const x = Math.round(xfade * SR);
  const out = { L: b.L.slice(0, n - x), R: b.R.slice(0, n - x) };
  for (let i = 0; i < x; i++) {
    const t = i / x;
    const gIn = Math.sin((t * Math.PI) / 2);
    const gOut = Math.cos((t * Math.PI) / 2);
    out.L[i] = out.L[i] * gIn + b.L[n - x + i] * gOut;
    out.R[i] = out.R[i] * gIn + b.R[n - x + i] * gOut;
  }
  return out;
}

/** Folds a reverb/release tail past `loopLen` back onto the start (for music loops). */
export function foldTail(b: Buf, loopLen: number): Buf {
  const n = Math.round(loopLen * SR);
  const out = { L: b.L.slice(0, n), R: b.R.slice(0, n) };
  for (let i = n; i < b.L.length; i++) {
    out.L[i - n] += b.L[i];
    out.R[i - n] += b.R[i];
  }
  return out;
}

/** Splits a render into individual hits (onsets) — for slicing recorded footsteps etc. */
export function onsets(b: Buf, minGapSec = 0.06, thresholdRel = 0.3): number[] {
  const win = Math.round(0.005 * SR);
  const env: number[] = [];
  for (let i = 0; i < b.L.length; i += win) {
    let s = 0;
    for (let j = i; j < Math.min(b.L.length, i + win); j++) s += Math.abs(b.L[j]);
    env.push(s / win);
  }
  const p = Math.max(...env);
  const out: number[] = [];
  let armed = true;
  let lastAt = -Infinity;
  env.forEach((e, k) => {
    const t = (k * win) / SR;
    if (armed && e > p * thresholdRel && t - lastAt > minGapSec) {
      out.push(t);
      lastAt = t;
      armed = false;
    } else if (e < p * thresholdRel * 0.35) armed = true;
  });
  return out;
}

/** Deterministic PRNG for reproducible sound design. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
