// Page-turn sound. Uses recorded samples from audio/manifest.json when present,
// otherwise synthesises a soft paper swish. Every turn is slightly different
// (pitch, length, brightness, stereo travel) so it never feels mechanical.

import { buses, getContext, loadBuffer, loadManifest, rand } from './engine';

let lastPlayed = 0;
let lastSample = -1;

export async function playPageTurn(direction: 1 | -1 = 1, volume = 1) {
  const c = getContext();
  if (!c || c.state !== 'running') return;
  const now = c.currentTime;
  // Rapid flicking shouldn't produce a machine-gun of sounds.
  if (now - lastPlayed < 0.12) return;
  lastPlayed = now;

  const manifest = await loadManifest();
  if (manifest.pageTurn.length) {
    let i = Math.floor(Math.random() * manifest.pageTurn.length);
    if (i === lastSample && manifest.pageTurn.length > 1) i = (i + 1) % manifest.pageTurn.length;
    lastSample = i;
    const buf = await loadBuffer(manifest.pageTurn[i]);
    if (buf) {
      const s = c.createBufferSource();
      s.buffer = buf;
      s.playbackRate.value = rand(0.93, 1.07);
      const g = c.createGain();
      g.gain.value = 0.45 * volume * rand(0.8, 1);
      s.connect(g).connect(buses().sfx);
      s.start();
      return;
    }
  }
  synthPageTurn(c, buses().sfx, c.currentTime, direction, volume);
}

/** Synthesised paper swish: band-passed noise with a crinkle envelope and a soft landing. */
export function synthPageTurn(c: AudioContext, dest: AudioNode, at: number, direction: 1 | -1 = 1, volume = 1) {
  const dur = rand(0.32, 0.46);
  const peak = 0.16 * volume * rand(0.75, 1);

  const len = Math.floor(c.sampleRate * (dur + 0.1));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  // Granular "crinkle": noise whose density varies, like fibres rubbing.
  let crinkle = 0;
  for (let i = 0; i < len; i++) {
    if (Math.random() < 0.0009) crinkle = rand(0.4, 1);
    crinkle *= 0.9994;
    d[i] = (Math.random() * 2 - 1) * (0.55 + crinkle * 0.6);
  }
  const src = c.createBufferSource();
  src.buffer = buf;

  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 380;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = rand(0.5, 0.9);
  const f0 = rand(900, 1300);
  bp.frequency.setValueAtTime(f0, at);
  bp.frequency.exponentialRampToValueAtTime(rand(2600, 3800), at + dur * 0.45);
  bp.frequency.exponentialRampToValueAtTime(rand(1300, 1900), at + dur);

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak * 0.5, at + dur * 0.12);
  g.gain.linearRampToValueAtTime(peak, at + dur * 0.38);
  g.gain.exponentialRampToValueAtTime(peak * 0.25, at + dur * 0.78);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

  let tail: AudioNode = g;
  if (c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.setValueAtTime(0.35 * direction, at);
    p.pan.linearRampToValueAtTime(-0.35 * direction, at + dur);
    g.connect(p);
    tail = p;
  }
  src.connect(hp).connect(bp).connect(g);
  tail.connect(dest);
  src.start(at);
  src.stop(at + dur + 0.1);

  // Soft landing of the page.
  const landAt = at + dur * rand(0.78, 0.9);
  const lsrc = c.createBufferSource();
  lsrc.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = rand(450, 700);
  const lg = c.createGain();
  lg.gain.setValueAtTime(0.0001, landAt);
  lg.gain.exponentialRampToValueAtTime(peak * 0.9, landAt + 0.008);
  lg.gain.exponentialRampToValueAtTime(0.0001, landAt + 0.07);
  lsrc.connect(lp).connect(lg).connect(dest);
  lsrc.start(landAt, 0.02);
  lsrc.stop(landAt + 0.1);
}
