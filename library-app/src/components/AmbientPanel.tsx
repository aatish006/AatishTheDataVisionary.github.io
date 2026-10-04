import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AMBIENTS, ambientPlayer } from '../lib/audio/ambient';
import type { AmbientId } from '../lib/types';
import { useLibrary } from '../state/library';
import { Icon } from './Icon';

const GLYPH: Record<AmbientId, string> = {
  rain: 'M7 15a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17 15zM8 18l-1 2M12 18l-1 2M16 18l-1 2',
  fireplace: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 1-9z',
  cafe: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M9 3c-1 1.5 1 2.5 0 4M12 3c-1 1.5 1 2.5 0 4',
  forest: 'M12 3l5 7h-3l4 6H6l4-6H7zM12 16v5',
  ocean: 'M3 10c3-3 6-3 9 0s6 3 9 0M3 15c3-3 6-3 9 0s6 3 9 0M3 20c3-3 6-3 9 0s6 3 9 0',
  night: 'M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z',
  library: 'M5 4h3v16H5zM10 4h3v16h-3zM15.5 4.5l2.9-.8 4 15.5-2.9.8z',
};

export function useAmbientPlaying() {
  return useSyncExternalStore(
    (cb) => ambientPlayer.subscribe(cb),
    () => ambientPlayer.playing,
  );
}

function useSleepAt() {
  return useSyncExternalStore(
    (cb) => ambientPlayer.subscribe(cb),
    () => ambientPlayer.sleepAt,
  );
}

const SLEEP_OPTIONS = [15, 30, 60];

/** The floating "sound" button with its little panel. */
export function AmbientControl({ placement = 'floating', className = '' }: { placement?: 'floating' | 'inline'; className?: string }) {
  const { prefs, updatePrefs } = useLibrary();
  const playing = useAmbientPlaying();
  const [open, setOpen] = useState(false);
  const sleepAt = useSleepAt();
  const [, tick] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const sleepLeft = sleepAt ? Math.max(1, Math.round((sleepAt - Date.now()) / 60000)) : null;

  // Refresh the "fading out in …" countdown while the panel is open.
  useEffect(() => {
    if (!open || !sleepAt) return;
    const id = window.setInterval(() => tick((n) => n + 1), 20000);
    return () => window.clearInterval(id);
  }, [open, sleepAt]);

  useEffect(() => {
    ambientPlayer.setVolume(prefs.ambientVolume);
  }, [prefs.ambientVolume]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (id: AmbientId) => {
    updatePrefs({ ambient: id });
    void ambientPlayer.play(id);
  };

  const toggle = () => {
    if (playing) ambientPlayer.pause();
    else void ambientPlayer.play(prefs.ambient);
  };

  return (
    <div ref={ref} className={`ambient ambient--${placement} ${className}`} onPointerDown={(e) => e.stopPropagation()}>
      <button
        className={`ambient__btn${playing ? ' is-playing' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={playing ? `Ambient sound: ${playing}. Open sound panel` : 'Open ambient sound panel'}
        aria-expanded={open}
      >
        <span className="ambient__pulse" />
        <Icon name="music" size={19} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="ambient__panel"
            role="dialog"
            aria-label="Ambient sound"
            initial={{ opacity: 0, y: placement === 'floating' ? 12 : -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: placement === 'floating' ? 8 : -6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="ambient__head">
              <div>
                <div className="ambient__title">Ambience</div>
                <div className="ambient__sub">
                  {playing
                    ? `${AMBIENTS.find((a) => a.id === playing)?.label} · ${sleepLeft ? `fading out in ${sleepLeft} min` : 'playing softly'}`
                    : 'Quiet for now'}
                </div>
              </div>
              <button className="ambient__play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
                <Icon name={playing ? 'pause' : 'play'} size={18} filled={!playing} />
              </button>
            </div>
            <div className="ambient__grid">
              {AMBIENTS.map((a) => (
                <button
                  key={a.id}
                  className={`ambient__item${playing === a.id ? ' is-on' : ''}${prefs.ambient === a.id ? ' is-chosen' : ''}`}
                  onClick={() => choose(a.id)}
                  aria-pressed={playing === a.id}
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={GLYPH[a.id]} />
                  </svg>
                  <span className="ambient__label">{a.label}</span>
                  <span className="ambient__hint">{a.hint}</span>
                </button>
              ))}
            </div>
            <div className="ambient__sleep" role="group" aria-label="Sleep timer">
              <span className="ambient__sleep-label">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                  <path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z" />
                </svg>
                Fade out
              </span>
              {[null, ...SLEEP_OPTIONS].map((m) => {
                const on = (sleepAt ? ambientPlayer.sleepMinutes : null) === m;
                return (
                  <button
                    key={m ?? 'off'}
                    className={`ambient__chip${on ? ' is-on' : ''}`}
                    onClick={() => {
                      ambientPlayer.setSleep(m);
                      if (m && !playing) void ambientPlayer.play(prefs.ambient);
                    }}
                    aria-pressed={on}
                  >
                    {m === null ? 'Off' : `${m}m`}
                  </button>
                );
              })}
            </div>
            <label className="ambient__vol">
              <Icon name="volume" size={16} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={prefs.ambientVolume}
                onChange={(e) => updatePrefs({ ambientVolume: Number(e.target.value) })}
                aria-label="Ambient volume"
                style={{ ['--fill' as string]: `${prefs.ambientVolume * 100}%` }}
              />
            </label>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
