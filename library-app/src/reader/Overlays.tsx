import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Cover } from '../components/Cover';
import type { Book, UserId } from '../lib/types';

// Where the cover was on the shelf when the reader clicked it (for the opening animation).
let origin: DOMRect | null = null;
export const setOpeningOrigin = (r: DOMRect | null) => {
  origin = r;
};

/** The cover flies from the shelf to the centre and swings open. */
export function BookOpening({ book, ready, onDone, reduced }: { book: Book; ready: boolean; onDone(): void; reduced: boolean }) {
  const [opened, setOpened] = useState(false);
  const [from] = useState(() => origin);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const h = Math.min(vh * 0.62, 520);
  const w = h * 0.66;
  const target = { x: vw / 2 - w / 2, y: vh / 2 - h / 2 };

  useEffect(() => {
    if (reduced) {
      setOpened(true);
      return;
    }
    const id = setTimeout(() => setOpened(true), 650);
    return () => clearTimeout(id);
  }, [reduced]);

  useEffect(() => {
    if (!ready || !opened) return;
    const id = setTimeout(onDone, reduced ? 50 : 650);
    return () => clearTimeout(id);
  }, [ready, opened, onDone, reduced]);

  return (
    <motion.div className="opening" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.45 } }}>
      <motion.div
        className="opening__book"
        initial={from ? { x: from.left, y: from.top, width: from.width, height: from.height, opacity: 1 } : { x: target.x, y: target.y + 30, width: w, height: h, opacity: 0 }}
        animate={{ x: target.x, y: target.y, width: w, height: h, opacity: 1 }}
        transition={{ duration: reduced ? 0 : 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="opening__pages">
          <div className="opening__line" />
          <div className="opening__line" />
          <div className="opening__line short" />
          {!ready && opened && <div className="opening__hint">Preparing the pages…</div>}
        </div>
        <motion.div
          className="opening__cover"
          animate={{ rotateY: opened ? -158 : 0 }}
          transition={{ duration: reduced ? 0 : 0.9, ease: [0.45, 0.05, 0.25, 1] }}
        >
          <div className="opening__front">
            <Cover book={book} />
          </div>
          <div className="opening__inside" />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export function WelcomeBack({ label, progress, onContinue, onRestart }: { label?: string; progress: number; onContinue(): void; onRestart(): void }) {
  return (
    <motion.div className="modal-scrim modal-scrim--soft modal-scrim--center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="welcome-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wb-title"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="welcome-card__ribbon" aria-hidden />
        <h2 id="wb-title">Welcome back.</h2>
        <p>
          You were {label ? <>at <em>{label}</em></> : 'part way through'} — {Math.round(progress * 100)}% of the way.
          <br />
          Continue from where you left off?
        </p>
        <div className="welcome-card__actions">
          <button className="btn btn--gold" onClick={onContinue} autoFocus>
            Continue reading
          </button>
          <button className="btn btn--quiet" onClick={onRestart}>
            Start from the beginning
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function FinishedCelebration({ user, title, onLibrary, onStay }: { user: UserId; title: string; onLibrary(): void; onStay(): void }) {
  const sparks = Array.from({ length: 22 }, (_, i) => i);
  return (
    <motion.div className="modal-scrim modal-scrim--center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="finished-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fin-title"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="sparks" aria-hidden>
          {sparks.map((i) => (
            <span key={i} style={{ ['--i' as string]: i, ['--x' as string]: `${(i * 37) % 100}%`, ['--d' as string]: `${(i % 7) * 0.12}s` }} />
          ))}
        </div>
        <Avatar user={user} mood="happy" size={104} />
        <div className="finished-card__kicker">✦ Book finished ✦</div>
        <h2 id="fin-title">{title}</h2>
        <p>“Another story added to your memories.”</p>
        <div className="welcome-card__actions">
          <button className="btn btn--gold" onClick={onLibrary} autoFocus>
            Back to the library
          </button>
          <button className="btn btn--quiet" onClick={onStay}>
            Stay a moment
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
