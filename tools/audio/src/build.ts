/**
 * Produces every audio asset of the game:  npm run audio
 * Output: packages/client/public/audio/{sfx,amb,music}/*.ogg  (+ CREDITS.txt)
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { type Buf, SR, length, loopify, loudness, normalize, peak, rms } from './dsp';
import { SONGS, SONG_TITLES, performSong } from './music';
import { AMB_RECIPES, SFX_RECIPES } from './sfx';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../packages/client/public/audio');
const only = process.argv[2];

function encode(b: Buf, file: string, quality: number): number {
  const pcm = new Float32Array(b.L.length * 2);
  for (let i = 0; i < b.L.length; i++) {
    pcm[i * 2] = b.L[i];
    pcm[i * 2 + 1] = b.R[i];
  }
  mkdirSync(dirname(file), { recursive: true });
  const res = spawnSync(ffmpegPath as unknown as string, ['-y', '-loglevel', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', 'pipe:0', '-c:a', 'libvorbis', '-q:a', String(quality), file], { input: Buffer.from(pcm.buffer) });
  if (res.status !== 0) throw new Error(`ffmpeg failed for ${file}: ${res.stderr}`);
  return pcm.length;
}

const dbfs = (v: number) => (v > 0 ? (20 * Math.log10(v)).toFixed(1) : '-inf');
const report: string[] = [];
const log = (kind: string, name: string, b: Buf) => {
  const line = `${kind.padEnd(6)} ${name.padEnd(16)} ${length(b).toFixed(2).padStart(6)}s  peak ${dbfs(peak(b)).padStart(6)} dB  rms ${dbfs(rms(b)).padStart(6)} dB`;
  report.push(line);
  console.log(line);
};

for (const r of SFX_RECIPES) {
  if (only && only !== r.name && only !== 'sfx') continue;
  for (let v = 0; v < r.variants; v++) {
    const name = r.variants > 1 ? `${r.name}_${v + 1}` : r.name;
    const b = normalize(await r.make(v), r.level);
    encode(b, join(root, 'sfx', `${name}.ogg`), 4);
    log('sfx', name, b);
  }
}

for (const r of AMB_RECIPES) {
  if (only && only !== r.name && only !== 'amb') continue;
  const b = normalize(loopify(await r.make(), 2.5), r.level);
  encode(b, join(root, 'amb', `${r.name}.ogg`), 3);
  log('amb', r.name, b);
}

for (const s of SONGS) {
  if (only && only !== s.name && only !== 'music') continue;
  const b = loudness(await performSong(s), -21, -1.5);
  encode(b, join(root, 'music', `${s.name}.ogg`), 5);
  log('music', s.name, b);
}

writeFileSync(
  join(root, 'CREDITS.txt'),
  `Lumina Isle — audio credits

All sound effects, ambience beds and music in this folder were produced for Lumina Isle
by rendering recorded samples from the GeneralUser GS SoundFont (v1.471, by S. Christian Collins)
through the tools in tools/audio, then edited (layering, slicing, pitch variation, filtering,
fades, loop crossfades and loudness matching).

GeneralUser GS License v2.0: "You may use GeneralUser GS without restriction for your own music
creation, private or commercial." Full text: node_modules/generaluser/LICENSE.txt
https://www.schristiancollins.com

Music composed for Lumina Isle, arranged for the SoundFont's recorded instruments:
${SONG_TITLES.join(', ')}.
`,
);
console.log(`\n${report.length} files written to ${root}`);
