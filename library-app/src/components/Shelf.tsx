import { motion } from 'framer-motion';
import { memo, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { userName, type Book, type UserBookState, type UserId } from '../lib/types';
import { Avatar } from './Avatar';
import { Cover } from './Cover';
import { Icon } from './Icon';

/** A book standing face-out on a shelf, with real depth. */
export const ShelfBook = memo(function ShelfBook({
  book,
  state,
  viewer,
  isNew,
  onOpen,
  onRead,
  tilt = 0,
}: {
  book: Book;
  state?: UserBookState;
  viewer: UserId;
  isNew?: boolean;
  onOpen(book: Book, el: HTMLElement): void;
  onRead(book: Book, el: HTMLElement): void;
  tilt?: number;
}) {
  const coverRef = useRef<HTMLDivElement>(null);
  const reading = state && state.status === 'reading' && state.progress > 0 && state.progress < 1;
  const finished = state?.status === 'finished';
  const sharedBy = book.shared && book.ownerId !== viewer ? book.ownerId : null;
  return (
    <motion.div
      className="sbook"
      style={{ ['--tilt' as string]: `${tilt}deg` }}
      layout="position"
      initial={isNew ? { y: -260, x: 80, rotate: -18, opacity: 0, scale: 1.25 } : false}
      animate={{ y: 0, x: 0, rotate: 0, opacity: 1, scale: 1 }}
      transition={isNew ? { type: 'spring', stiffness: 120, damping: 14, mass: 0.9, delay: 0.25 } : { duration: 0.3 }}
    >
      <button
        className="sbook__btn"
        onClick={() => onOpen(book, coverRef.current!)}
        aria-label={`${book.title} by ${book.author}${reading ? `, ${Math.round(state!.progress * 100)}% read` : ''}${finished ? ', finished' : ''}`}
      >
        <div className="sbook__3d" ref={coverRef}>
          <div className="sbook__cover">
            <Cover book={book} />
            <div className="sbook__sheen" />
          </div>
          <div className="sbook__pages" />
          {reading && (
            <div className="sbook__progress" aria-hidden>
              <span style={{ width: `${state!.progress * 100}%` }} />
            </div>
          )}
          {book.isDemo && <span className="sbook__demo">Demo</span>}
          {finished && (
            <span className="sbook__done" title="Finished">
              <Icon name="check" size={12} />
            </span>
          )}
          {state?.favourite && (
            <span className="sbook__fav" title="Favourite">
              <Icon name="heart" size={12} filled />
            </span>
          )}
          {sharedBy && (
            <span className="sbook__by" title={`Added by ${userName(sharedBy)}`}>
              <Avatar user={sharedBy} size={22} />
            </span>
          )}
        </div>
      </button>
      <div className="sbook__label">
        <span className="sbook__title">{book.title}</span>
        <span className="sbook__author">{book.author}</span>
      </div>
      <button className="sbook__read" onClick={() => onRead(book, coverRef.current!)} tabIndex={-1} aria-hidden>
        {reading ? 'Continue' : 'Read'}
      </button>
    </motion.div>
  );
});

function Candle() {
  return (
    <div className="deco deco--candle" aria-hidden>
      <span className="deco__flame" />
      <span className="deco__glow" />
      <svg viewBox="0 0 40 90" width="34" height="78">
        <path d="M14 30h12v52H14z" fill="#efe2c6" />
        <path d="M14 30h4v52h-4z" fill="#000" opacity=".08" />
        <path d="M20 30v-6" stroke="#2a1d17" strokeWidth="1.4" />
        <ellipse cx="20" cy="84" rx="16" ry="4" fill="#8d6b3d" />
        <path d="M4 84h32v3H4z" fill="#6f5230" />
      </svg>
    </div>
  );
}

function Plant() {
  return (
    <div className="deco deco--plant" aria-hidden>
      <svg viewBox="0 0 70 100" width="58" height="84">
        <g className="deco__leaves" fill="#5f7a55">
          <path d="M35 62C24 52 14 50 6 54c8 6 18 10 29 8z" />
          <path d="M35 60c2-16 10-26 22-30-2 12-10 24-22 30z" fill="#6f8c63" />
          <path d="M35 62c-6-14-6-28 0-40 6 12 6 26 0 40z" fill="#7a9a6d" />
          <path d="M35 64c10-6 22-6 30 0-10 5-20 5-30 0z" fill="#56704d" />
        </g>
        <path d="M18 64h34l-4 32H22z" fill="#a8603e" />
        <path d="M16 62h38v6H16z" fill="#b86d48" />
      </svg>
    </div>
  );
}

function Bookends() {
  return (
    <div className="deco deco--stack" aria-hidden>
      <svg viewBox="0 0 90 60" width="86" height="56">
        <rect x="6" y="40" width="78" height="10" rx="1.5" fill="#4a1f28" />
        <rect x="10" y="30" width="70" height="10" rx="1.5" fill="#2f4a44" />
        <rect x="4" y="50" width="82" height="10" rx="1.5" fill="#6b4a2b" />
        <path d="M10 33h70M6 43h78M4 53h82" stroke="#e7c27a" strokeOpacity=".4" strokeWidth=".8" />
        <circle cx="62" cy="22" r="7" fill="none" stroke="#c9a45c" strokeWidth="1.4" />
        <path d="M62 15v-6" stroke="#c9a45c" strokeWidth="1.4" />
      </svg>
    </div>
  );
}

const DECOS = [Candle, Plant, Bookends];

/**
 * Lays out items on wooden planks: as many per plank as fit the width.
 * Spare space on the last plank gets a small object (a candle, a plant…).
 */
export function Bookshelf({ children, decorate = true, minRows = 1, seed = 0 }: { children: ReactNode[]; decorate?: boolean; minRows?: number; seed?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [perRow, setPerRow] = useState(6);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const bookW = w < 520 ? 104 : w < 900 ? 128 : 150;
      const gap = w < 520 ? 18 : 34;
      setPerRow(Math.max(2, Math.floor((w - 24 + gap) / (bookW + gap))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows: ReactNode[][] = [];
  for (let i = 0; i < children.length; i += perRow) rows.push(children.slice(i, i + perRow));
  while (rows.length < minRows) rows.push([]);

  return (
    <div className="bookshelf" ref={ref}>
      {rows.map((row, i) => {
        const spare = perRow - row.length;
        const Deco = decorate && spare >= 1 ? DECOS[(i + seed) % DECOS.length] : null;
        return (
          <div className="bookshelf__row" key={i}>
            <div className="bookshelf__books">
              {row}
              {Deco && <Deco />}
            </div>
            <div className="bookshelf__plank" />
          </div>
        );
      })}
    </div>
  );
}
