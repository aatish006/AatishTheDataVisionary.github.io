import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Dust, ShelfWall } from '../components/Atmosphere';
import { Avatar, type AvatarMood } from '../components/Avatar';
import { unlockAudio } from '../lib/audio/engine';
import { cloudEnabled } from '../lib/cloud';
import { USERS, type UserId } from '../lib/types';

/** "Who is reading tonight?" — the doorway into the library. */
export function Welcome({ onChoose }: { onChoose(u: UserId): void }) {
  const [hover, setHover] = useState<UserId | null>(null);
  const [chosen, setChosen] = useState<UserId | null>(null);
  const [greeted, setGreeted] = useState<UserId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Each avatar waves hello once, a moment after arrival.
  useEffect(() => {
    const a = setTimeout(() => setGreeted('aatish'), 1300);
    const b = setTimeout(() => setGreeted('nishi'), 2100);
    const c = setTimeout(() => setGreeted(null), 3300);
    return () => [a, b, c].forEach(clearTimeout);
  }, []);

  // Gentle parallax: the shelves drift opposite the pointer.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = e.clientX / window.innerWidth - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;
        el.style.setProperty('--px', x.toFixed(3));
        el.style.setProperty('--py', y.toFixed(3));
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const choose = (u: UserId) => {
    if (chosen) return;
    void unlockAudio();
    setChosen(u);
    setTimeout(() => onChoose(u), 1050);
  };

  const mood = (u: UserId): AvatarMood => (chosen === u ? 'happy' : hover === u || greeted === u ? 'wave' : 'idle');

  return (
    <motion.div
      ref={rootRef}
      className={`welcome${chosen ? ' is-leaving' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.06, filter: 'blur(6px)' }}
      transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="welcome__wall">
        <ShelfWall rows={6} perRow={60} />
      </div>
      <div className="welcome__vignette" />
      <div className="welcome__lamp" />
      <Dust count={70} />

      <main className="welcome__center">
        <motion.div className="welcome__mark" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.9 }}>
          <svg width="44" height="30" viewBox="0 0 44 30" aria-hidden>
            <path d="M2 4c7-3 13-2 20 2v22c-7-4-13-5-20-2z" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M42 4c-7-3-13-2-20 2v22c7-4 13-5 20-2z" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M28 6v11l2.5-2 2.5 2V5" fill="var(--burgundy)" />
          </svg>
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 1 }}>
          Our Little Library
        </motion.h1>
        <motion.p className="welcome__sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 1 }}>
          A quiet place for our stories.
        </motion.p>

        <motion.p className="welcome__ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 0.9 }}>
          Who is reading tonight?
        </motion.p>

        <div className="welcome__people">
          {USERS.map((u, i) => (
            <motion.button
              key={u.id}
              className={`person${chosen === u.id ? ' is-chosen' : ''}${chosen && chosen !== u.id ? ' is-other' : ''}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: chosen && chosen !== u.id ? 0.25 : 1, y: 0, scale: chosen === u.id ? 1.08 : 1 }}
              transition={{ delay: chosen ? 0 : 1.3 + i * 0.15, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
              onClick={() => choose(u.id)}
              onPointerEnter={() => setHover(u.id)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(u.id)}
              onBlur={() => setHover(null)}
              aria-label={`Enter as ${u.name}`}
            >
              <span className="person__halo" />
              <Avatar user={u.id} mood={mood(u.id)} size={132} />
              <span className="person__name">{u.name}</span>
            </motion.button>
          ))}
        </div>
      </main>

      <footer className="welcome__foot">
        <span>{cloudEnabled() ? 'Private · your library on every device' : 'Private · stored only on this device'}</span>
      </footer>
    </motion.div>
  );
}
