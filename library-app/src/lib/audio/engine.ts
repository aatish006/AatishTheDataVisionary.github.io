// Shared Web Audio plumbing: one AudioContext, two independent buses
// (page-turn effects vs ambient), noise generators and an event scheduler.
//
// Browsers only allow audio to start after a user gesture, so the context is
// created lazily and resumed from click/tap handlers — never on page load.

export interface AudioManifest {
  pageTurn: string[];
  ambient: Record<string, string | null>;
}

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let ambientBus: GainNode | null = null;
const noiseBuffers = new Map<string, AudioBuffer>();
let manifestPromise: Promise<AudioManifest> | null = null;
const decoded = new Map<string, Promise<AudioBuffer | null>>();

export function audioSupported() {
  return typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);
}

export function getContext(): AudioContext | null {
  if (!audioSupported()) return null;
  if (!ctx) {
    const Ctor: typeof AudioContext = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor({ latencyHint: 'interactive' });
    const master = ctx.createDynamicsCompressor();
    master.threshold.value = -10;
    master.ratio.value = 3;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);
    ambientBus = ctx.createGain();
    ambientBus.gain.value = 0.5;
    ambientBus.connect(master);
  }
  return ctx;
}

/** Call from inside a user gesture handler. */
export async function unlockAudio() {
  const c = getContext();
  if (c && c.state !== 'running') {
    try {
      await c.resume();
    } catch {
      /* ignored: will retry on the next gesture */
    }
  }
  return c;
}

export const buses = () => ({ sfx: sfxBus!, ambient: ambientBus! });

export function loadManifest(): Promise<AudioManifest> {
  manifestPromise ??= fetch(new URL('audio/manifest.json', document.baseURI).toString())
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => ({ pageTurn: m?.pageTurn ?? [], ambient: m?.ambient ?? {} }))
    .catch(() => ({ pageTurn: [], ambient: {} }));
  return manifestPromise;
}

export function loadBuffer(path: string): Promise<AudioBuffer | null> {
  if (!decoded.has(path)) {
    decoded.set(
      path,
      (async () => {
        const c = getContext();
        if (!c) return null;
        try {
          const res = await fetch(new URL(`audio/${path}`, document.baseURI).toString());
          if (!res.ok) return null;
          return await c.decodeAudioData(await res.arrayBuffer());
        } catch {
          return null;
        }
      })(),
    );
  }
  return decoded.get(path)!;
}

export type NoiseColor = 'white' | 'pink' | 'brown';

function noiseBuffer(c: AudioContext, color: NoiseColor): AudioBuffer {
  const key = color;
  const hit = noiseBuffers.get(key);
  if (hit) return hit;
  const len = c.sampleRate * 6;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (color === 'white') d[i] = w;
    else if (color === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  // Smooth the loop seam.
  const fade = Math.floor(c.sampleRate * 0.05);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    d[len - fade + i] = d[len - fade + i] * (1 - t) + d[i] * t;
  }
  noiseBuffers.set(key, buf);
  return buf;
}

/** Looping noise source with natural stereo width. */
export function noise(c: AudioContext, color: NoiseColor, stereo = true) {
  const buf = noiseBuffer(c, color);
  const out = c.createGain();
  const sources: AudioBufferSourceNode[] = [];
  const channels = stereo ? 2 : 1;
  const merger = stereo ? c.createChannelMerger(2) : null;
  for (let ch = 0; ch < channels; ch++) {
    const s = c.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    if (merger) s.connect(merger, 0, ch);
    else s.connect(out);
    s.start(c.currentTime, Math.random() * buf.duration);
    sources.push(s);
  }
  merger?.connect(out);
  return {
    node: out,
    stop: (when = 0) => sources.forEach((s) => {
      try {
        s.stop(c.currentTime + when);
      } catch {
        /* already stopped */
      }
    }),
  };
}

/** A short one-shot noise burst (for drops, crackles, clicks). */
export function burst(c: AudioContext, dest: AudioNode, at: number, dur: number, gain: number, filter: BiquadFilterType, freq: number, q = 1, pan = 0) {
  const buf = noiseBuffer(c, 'white');
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + Math.min(0.003, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  let tail: AudioNode = g;
  if (pan && c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    tail = p;
  }
  s.connect(f).connect(g);
  tail.connect(dest);
  s.start(at, Math.random() * (buf.duration - 1));
  s.stop(at + dur + 0.05);
}

export function tone(c: AudioContext, dest: AudioNode, at: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine', pan = 0) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  let tail: AudioNode = g;
  if (pan && c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    tail = p;
  }
  o.connect(g);
  tail.connect(dest);
  o.start(at);
  o.stop(at + dur + 0.05);
  return o;
}

/**
 * Lookahead scheduler for random events. `next(at)` schedules one event at
 * audio time `at` and returns the delay (seconds) until the following one.
 */
export function scheduler(c: AudioContext, next: (at: number) => number, startDelay = 0.2) {
  let t = c.currentTime + startDelay;
  const tick = () => {
    const horizon = c.currentTime + 1.5;
    while (t < horizon) t += Math.max(0.005, next(t));
  };
  tick();
  const id = window.setInterval(tick, 250);
  return () => window.clearInterval(id);
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
