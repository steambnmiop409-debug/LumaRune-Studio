/**
 * Plays the game's recorded sound assets (see tools/audio for how each file is produced).
 * Sounds are real audio files in /audio — nothing is synthesized at runtime.
 */
export type Sfx =
  | 'hoe'
  | 'water'
  | 'plant'
  | 'harvest'
  | 'pop'
  | 'coin'
  | 'click'
  | 'open'
  | 'close'
  | 'error'
  | 'step_grass'
  | 'step_path'
  | 'step_wood'
  | 'refill'
  | 'crate'
  | 'horn'
  | 'bell'
  | 'thunder'
  | 'fert'
  | 'door'
  | 'chime'
  | 'sparkle';

export type Ambience = 'sea' | 'rain' | 'wind' | 'birds' | 'crickets';
export type Track = 'title' | 'day' | 'evening' | 'night' | 'rain';

const SFX_VARIANTS: Partial<Record<Sfx, number>> = { step_grass: 4, step_path: 4, step_wood: 3, hoe: 3, harvest: 2, pop: 3 };

export class AudioManager {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer | null>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private ambBus!: GainNode;
  private amb = new Map<Ambience, { src: AudioBufferSourceNode; gain: GainNode } | null>();
  private music: { track: Track; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wantedTrack: Track | null = null;
  volumes = { master: 0.8, music: 0.55, sfx: 0.8, amb: 0.7 };

  constructor(private base = './audio/') {
    try {
      const raw = localStorage.getItem('lumina:volumes');
      if (raw) Object.assign(this.volumes, JSON.parse(raw));
    } catch {
      /* storage unavailable */
    }
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.bus(this.master);
    this.musicBus = this.bus(this.master);
    this.ambBus = this.bus(this.master);
    this.applyVolumes();
    if (this.wantedTrack) this.playMusic(this.wantedTrack);
  }

  private bus(to: AudioNode): GainNode {
    const g = this.ctx!.createGain();
    g.connect(to);
    return g;
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.sfxBus.gain.value = this.volumes.sfx;
    this.musicBus.gain.value = this.volumes.music;
    this.ambBus.gain.value = this.volumes.amb;
    try {
      localStorage.setItem('lumina:volumes', JSON.stringify(this.volumes));
    } catch {
      /* ignore */
    }
  }

  private load(path: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(path);
    if (cached !== undefined) return Promise.resolve(cached);
    let p = this.loading.get(path);
    if (!p) {
      p = fetch(this.base + path)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => this.ctx!.decodeAudioData(b))
        .catch(() => null)
        .then((buf) => {
          this.buffers.set(path, buf);
          return buf;
        });
      this.loading.set(path, p);
    }
    return p;
  }

  /** Preloads a list of sound effects so the first play has no delay. */
  preload(names: Sfx[]): void {
    if (!this.ctx) return;
    for (const n of names) {
      const v = SFX_VARIANTS[n] ?? 1;
      for (let i = 1; i <= v; i++) void this.load(v > 1 ? `sfx/${n}_${i}.ogg` : `sfx/${n}.ogg`);
    }
  }

  play(name: Sfx, opts: { volume?: number; rate?: number; pan?: number; delay?: number } = {}): void {
    if (!this.ctx) return;
    const v = SFX_VARIANTS[name] ?? 1;
    const file = v > 1 ? `sfx/${name}_${1 + Math.floor(Math.random() * v)}.ogg` : `sfx/${name}.ogg`;
    void this.load(file).then((buf) => {
      if (!buf || !this.ctx) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = (opts.rate ?? 1) * (0.97 + Math.random() * 0.06);
      const g = this.ctx.createGain();
      g.gain.value = opts.volume ?? 1;
      let node: AudioNode = g;
      if (opts.pan) {
        const pan = this.ctx.createStereoPanner();
        pan.pan.value = Math.max(-1, Math.min(1, opts.pan));
        g.connect(pan);
        node = pan;
      }
      src.connect(g);
      node.connect(this.sfxBus);
      src.start(this.ctx.currentTime + (opts.delay ?? 0));
    });
  }

  /** Sets the loudness (0..1) of a looping ambience bed, fading smoothly. */
  ambience(name: Ambience, level: number): void {
    if (!this.ctx) return;
    const cur = this.amb.get(name);
    if (cur === undefined) {
      if (level <= 0.001) return;
      this.amb.set(name, null);
      void this.load(`amb/${name}.ogg`).then((buf) => {
        if (!buf || !this.ctx) return;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        src.connect(gain);
        gain.connect(this.ambBus);
        src.start(0, Math.random() * buf.duration);
        this.amb.set(name, { src, gain });
        gain.gain.setTargetAtTime(level, this.ctx.currentTime, 1.2);
      });
      return;
    }
    if (cur) cur.gain.gain.setTargetAtTime(level, this.ctx.currentTime, 1.2);
  }

  playMusic(track: Track | null): void {
    this.wantedTrack = track;
    if (!this.ctx) return;
    if (this.music?.track === track) return;
    const old = this.music;
    if (old) {
      old.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 1.5);
      old.src.stop(this.ctx.currentTime + 6);
    }
    this.music = null;
    if (!track) return;
    void this.load(`music/${track}.ogg`).then((buf) => {
      if (!buf || !this.ctx || this.wantedTrack !== track) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain);
      gain.connect(this.musicBus);
      src.start();
      gain.gain.setTargetAtTime(1, this.ctx.currentTime, 2);
      this.music = { track, src, gain };
    });
  }
}
