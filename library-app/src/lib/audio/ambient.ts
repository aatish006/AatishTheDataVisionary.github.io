// Ambient soundscapes. Each one is synthesised live with the Web Audio API so
// the library works without any audio assets; if a loopable file is listed in
// audio/manifest.json it is used instead. Switching crossfades gently.

import type { AmbientId } from '../types';
import { buses, burst, getContext, loadBuffer, loadManifest, noise, pick, rand, scheduler, tone, unlockAudio } from './engine';
import { synthPageTurn } from './pageTurn';

export const AMBIENTS: { id: AmbientId; label: string; hint: string }[] = [
  { id: 'rain', label: 'Rain', hint: 'on the window' },
  { id: 'fireplace', label: 'Fireplace', hint: 'a slow crackle' },
  { id: 'cafe', label: 'Café', hint: 'soft chatter' },
  { id: 'forest', label: 'Forest', hint: 'leaves & birds' },
  { id: 'ocean', label: 'Ocean', hint: 'distant waves' },
  { id: 'night', label: 'Night', hint: 'crickets' },
  { id: 'library', label: 'Library', hint: 'clock & pages' },
];

type Stop = () => void;
type Synth = (c: AudioContext, out: AudioNode) => Stop;

const mk = (c: AudioContext, type: BiquadFilterType, f: number, q = 0.7) => {
  const b = c.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
};

const gain = (c: AudioContext, v: number) => {
  const g = c.createGain();
  g.gain.value = v;
  return g;
};

/** Slowly wander a parameter between two values, like natural variation. */
function wander(c: AudioContext, param: AudioParam, min: number, max: number, minT = 1.5, maxT = 5) {
  return scheduler(c, (at) => {
    const t = rand(minT, maxT);
    param.setTargetAtTime(rand(min, max), at, t / 3);
    return t;
  }, 0);
}

const SYNTHS: Record<AmbientId, Synth> = {
  rain(c, out) {
    const wash = noise(c, 'pink');
    const hp = mk(c, 'highpass', 500);
    const lp = mk(c, 'lowpass', 6500);
    const wg = gain(c, 0.55);
    wash.node.connect(hp).connect(lp).connect(wg).connect(out);
    const body = noise(c, 'brown');
    const bg = gain(c, 0.3);
    body.node.connect(mk(c, 'lowpass', 800)).connect(bg).connect(out);
    const w = wander(c, wg.gain, 0.4, 0.65, 3, 8);
    const drops = scheduler(c, (at) => {
      burst(c, out, at, rand(0.006, 0.02), Math.pow(Math.random(), 2) * 0.16, 'bandpass', rand(1800, 6000), rand(1, 4), rand(-0.9, 0.9));
      return rand(0.015, 0.06);
    });
    return () => { w(); drops(); wash.stop(); body.stop(); };
  },

  fireplace(c, out) {
    const roar = noise(c, 'brown');
    const rg = gain(c, 0.5);
    roar.node.connect(mk(c, 'lowpass', 420)).connect(rg).connect(out);
    const hiss = noise(c, 'pink');
    hiss.node.connect(mk(c, 'bandpass', 2600, 0.5)).connect(gain(c, 0.025)).connect(out);
    const w = wander(c, rg.gain, 0.3, 0.6, 0.4, 2.5);
    const crackle = scheduler(c, (at) => {
      const big = Math.random() < 0.07;
      if (big) burst(c, out, at, rand(0.02, 0.05), rand(0.3, 0.55), 'lowpass', rand(1500, 3000), 2, rand(-0.4, 0.4));
      else burst(c, out, at, rand(0.002, 0.007), Math.pow(Math.random(), 3) * 0.5 + 0.02, 'highpass', rand(1500, 4000), 1, rand(-0.5, 0.5));
      // crackles cluster
      return Math.random() < 0.3 ? rand(0.01, 0.05) : rand(0.08, 0.5);
    });
    return () => { w(); crackle(); roar.stop(); hiss.stop(); };
  },

  ocean(c, out) {
    const surf = noise(c, 'pink');
    const lp = mk(c, 'lowpass', 600);
    const g = gain(c, 0.15);
    surf.node.connect(lp).connect(g).connect(out);
    const rumble = noise(c, 'brown');
    rumble.node.connect(mk(c, 'lowpass', 280)).connect(gain(c, 0.25)).connect(out);
    const waves = scheduler(c, (at) => {
      const len = rand(6, 11);
      const rise = len * rand(0.35, 0.45);
      const peak = rand(0.5, 0.85);
      g.gain.setTargetAtTime(peak, at, rise / 3);
      lp.frequency.setTargetAtTime(rand(1800, 2600), at, rise / 3);
      g.gain.setTargetAtTime(rand(0.08, 0.16), at + rise, (len - rise) / 3);
      lp.frequency.setTargetAtTime(rand(450, 650), at + rise, (len - rise) / 3);
      return len;
    }, 0.1);
    return () => { waves(); surf.stop(); rumble.stop(); };
  },

  forest(c, out) {
    const leaves = noise(c, 'pink');
    const lg = gain(c, 0.08);
    leaves.node.connect(mk(c, 'bandpass', 1100, 0.35)).connect(lg).connect(out);
    const w = wander(c, lg.gain, 0.03, 0.14, 2, 6);
    const brook = noise(c, 'brown');
    brook.node.connect(mk(c, 'lowpass', 700)).connect(gain(c, 0.1)).connect(out);
    const birds = scheduler(c, (at) => {
      const pan = rand(-0.8, 0.8);
      const species = Math.random();
      if (species < 0.55) {
        // sweet whistled phrase
        let t = at;
        const base = rand(2400, 4200);
        const notes = Math.floor(rand(2, 6));
        for (let i = 0; i < notes; i++) {
          const o = tone(c, out, t, base * rand(0.85, 1.2), rand(0.07, 0.16), rand(0.015, 0.04), 'sine', pan);
          o.frequency.exponentialRampToValueAtTime(base * rand(0.7, 1.4), t + 0.1);
          t += rand(0.1, 0.22);
        }
      } else {
        // quick trill
        const base = rand(3500, 5200);
        for (let i = 0; i < 9; i++) tone(c, out, at + i * 0.045, base + (i % 2) * 400, 0.035, 0.014, 'sine', pan);
      }
      return rand(1.5, 6);
    }, 1);
    return () => { w(); birds(); leaves.stop(); brook.stop(); };
  },

  night(c, out) {
    const wind = noise(c, 'brown');
    const wg = gain(c, 0.16);
    wind.node.connect(mk(c, 'lowpass', 260)).connect(wg).connect(out);
    const w = wander(c, wg.gain, 0.08, 0.2, 3, 9);
    const crickets = [0, 1, 2].map((i) => {
      const freq = rand(4200, 4900);
      const pan = [-0.6, 0.5, 0.05][i];
      const vol = [0.018, 0.012, 0.007][i];
      return scheduler(c, (at) => {
        const pulses = Math.floor(rand(3, 5));
        for (let p = 0; p < pulses; p++) tone(c, out, at + p * 0.034, freq, 0.022, vol, 'sine', pan);
        return rand(0.7, 1.3) + (Math.random() < 0.08 ? rand(1, 3) : 0);
      }, rand(0.1, 1));
    });
    return () => { w(); crickets.forEach((s) => s()); wind.stop(); };
  },

  cafe(c, out) {
    const room = noise(c, 'brown');
    room.node.connect(mk(c, 'lowpass', 420)).connect(gain(c, 0.22)).connect(out);
    const voices = [0, 1, 2, 3].map(() => {
      const n = noise(c, 'pink', false);
      const g = gain(c, 0);
      const f = mk(c, 'bandpass', rand(350, 900), rand(1.2, 2.2));
      let tail: AudioNode = g;
      if (c.createStereoPanner) {
        const p = c.createStereoPanner();
        p.pan.value = rand(-0.7, 0.7);
        g.connect(p);
        tail = p;
      }
      n.node.connect(f).connect(g);
      tail.connect(out);
      const s = scheduler(c, (at) => {
        const talking = Math.random() < 0.75;
        g.gain.setTargetAtTime(talking ? rand(0.05, 0.14) : 0.005, at, 0.04);
        f.frequency.setTargetAtTime(rand(380, 1100), at, 0.06);
        return talking ? rand(0.08, 0.22) : rand(0.4, 1.6);
      }, rand(0, 1));
      return () => { s(); n.stop(); };
    });
    const clinks = scheduler(c, (at) => {
      const pan = rand(-0.7, 0.7);
      const base = rand(2000, 3200);
      const count = Math.random() < 0.3 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const t = at + k * rand(0.12, 0.25);
        const v = rand(0.012, 0.03);
        [1, 2.76, 5.4].forEach((r, j) => tone(c, out, t, base * r, rand(0.25, 0.5) / (j + 1), v / (j + 1), 'sine', pan));
      }
      return rand(2.5, 8);
    }, 1.5);
    return () => { voices.forEach((v) => v()); clinks(); room.stop(); };
  },

  library(c, out) {
    const room = noise(c, 'brown');
    room.node.connect(mk(c, 'lowpass', 180)).connect(gain(c, 0.3)).connect(out);
    const air = noise(c, 'pink');
    air.node.connect(mk(c, 'highpass', 2500)).connect(gain(c, 0.008)).connect(out);
    let tock = false;
    const clock = scheduler(c, (at) => {
      tock = !tock;
      burst(c, out, at, 0.012, 0.05, 'bandpass', tock ? 2600 : 3200, 9, 0.35);
      return 1;
    });
    const pages = scheduler(c, (at) => {
      synthPageTurn(c, out, at, pick([1, -1]), rand(0.25, 0.45));
      return rand(10, 26);
    }, rand(4, 9));
    return () => { clock(); pages(); room.stop(); air.stop(); };
  },
};

class AmbientPlayer {
  private current: { id: AmbientId; gain: GainNode; stop: Stop } | null = null;
  private listeners = new Set<() => void>();
  private sleepTimer = 0;
  /** when the sleep timer will fade the sound out (ms epoch), or null */
  sleepAt: number | null = null;
  /** the chosen sleep timer length, for showing which option is on */
  sleepMinutes: number | null = null;
  volume = 0.5;

  /** Gently fade out after `minutes` (null cancels). For falling asleep to the rain. */
  setSleep(minutes: number | null) {
    window.clearTimeout(this.sleepTimer);
    this.sleepAt = minutes ? Date.now() + minutes * 60000 : null;
    this.sleepMinutes = minutes;
    if (minutes) {
      this.sleepTimer = window.setTimeout(() => {
        this.sleepAt = null;
        this.sleepMinutes = null;
        this.pause(12);
      }, minutes * 60000);
    }
    this.emit();
  }

  get playing() {
    return this.current?.id ?? null;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  setVolume(v: number) {
    this.volume = v;
    const c = getContext();
    if (c) buses().ambient.gain.setTargetAtTime(this.curve(v), c.currentTime, 0.1);
  }

  private curve(v: number) {
    return Math.pow(v, 1.6) * 0.9;
  }

  /** Must be called from a user gesture the first time. */
  async play(id: AmbientId) {
    const c = await unlockAudio();
    if (!c) return;
    if (this.current?.id === id) return;
    this.fadeOutCurrent();
    buses().ambient.gain.setValueAtTime(this.curve(this.volume), c.currentTime);

    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(1, c.currentTime + 1.6);
    g.connect(buses().ambient);

    const entry: { id: AmbientId; gain: GainNode; stop: Stop } = { id, gain: g, stop: () => {} };
    this.current = entry;
    this.emit();

    const manifest = await loadManifest();
    const file = manifest.ambient[id];
    const buf = file ? await loadBuffer(file) : null;
    if (this.current !== entry) return; // switched while loading
    if (buf) {
      const s = c.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.connect(g);
      s.start();
      entry.stop = () => s.stop();
    } else {
      entry.stop = SYNTHS[id](c, g);
    }
  }

  private fadeOutCurrent(seconds = 1.1) {
    const cur = this.current;
    const c = getContext();
    if (!cur || !c) return;
    cur.gain.gain.cancelScheduledValues(c.currentTime);
    cur.gain.gain.setValueAtTime(cur.gain.gain.value, c.currentTime);
    cur.gain.gain.linearRampToValueAtTime(0, c.currentTime + seconds);
    setTimeout(() => {
      cur.stop();
      cur.gain.disconnect();
    }, seconds * 1000 + 150);
    this.current = null;
  }

  pause(fadeSeconds = 1.1) {
    this.fadeOutCurrent(fadeSeconds);
    if (fadeSeconds <= 1.1) {
      window.clearTimeout(this.sleepTimer);
      this.sleepAt = null;
      this.sleepMinutes = null;
    }
    this.emit();
  }
}

export const ambientPlayer = new AmbientPlayer();
