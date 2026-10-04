import { memo, useEffect, useState } from 'react';
import { repository } from '../lib/repository';
import type { Book, CoverMotif, GeneratedCover } from '../lib/types';

// ---------- cover images (object URLs cached for the session) ----------

const urlCache = new Map<string, Promise<string | null>>();

export function coverUrl(blobKey: string) {
  if (!urlCache.has(blobKey)) {
    urlCache.set(
      blobKey,
      repository.getBlob(blobKey).then((b) => (b ? URL.createObjectURL(b) : null)).catch(() => null),
    );
  }
  return urlCache.get(blobKey)!;
}

export function useCoverUrl(book: Book) {
  const key = book.cover.kind === 'image' ? book.cover.blobKey : null;
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!key) {
      setUrl(null);
      return;
    }
    coverUrl(key).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [key]);
  return url;
}

// ---------- generated covers ----------

const PALETTES: [string, string, string][] = [
  ['#2a3d36', '#f0e4c8', '#c9a45c'],
  ['#5a1f2b', '#f3e6cf', '#e5b86b'],
  ['#1d2c44', '#efe4cf', '#d9a68b'],
  ['#3a2a1e', '#f2e5cb', '#b8894a'],
  ['#2b2233', '#f0e2c8', '#c58b6b'],
  ['#3d4a3c', '#ede6d6', '#a7b59a'],
  ['#4a3326', '#f4e9d4', '#d7a86e'],
  ['#233a45', '#eee5d2', '#9fc0c4'],
];
const MOTIFS: CoverMotif[] = ['moon', 'wave', 'leaf', 'lamp', 'star', 'key', 'feather', 'cup'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function generatedCoverFor(title: string): GeneratedCover {
  const h = hash(title);
  return { kind: 'generated', palette: PALETTES[h % PALETTES.length], motif: MOTIFS[(h >>> 8) % MOTIFS.length] };
}

export function Motif({ motif, color }: { motif: CoverMotif; color: string }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (motif) {
    case 'moon':
      return (
        <svg viewBox="0 0 64 64" aria-hidden>
          <path d="M40 12a20 20 0 1 0 12 30A16 16 0 1 1 40 12z" {...common} fill={color} fillOpacity={0.18} />
          <path d="M14 14l1.2 2.6L18 18l-2.8 1.2L14 22l-1.2-2.8L10 18l2.8-1.4z M50 50l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" fill={color} stroke="none" />
        </svg>
      );
    case 'wave':
      return (
        <svg viewBox="0 0 64 64" aria-hidden>
          <path d="M6 26c6-6 12-6 18 0s12 6 18 0 12-6 16-2" {...common} />
          <path d="M6 36c6-6 12-6 18 0s12 6 18 0 12-6 16-2" {...common} opacity={0.75} />
          <path d="M6 46c6-6 12-6 18 0s12 6 18 0 12-6 16-2" {...common} opacity={0.5} />
          <circle cx="46" cy="13" r="4" fill={color} fillOpacity={0.3} stroke="none" />
        </svg>
      );
    case 'leaf':
      return (
        <svg viewBox="0 0 64 64" aria-hidden>
          <path d="M14 50C14 26 30 12 52 12c0 22-14 38-38 38z" {...common} fill={color} fillOpacity={0.15} />
          <path d="M14 50L40 24M24 40l-1-8M30 34l-1-9M24 40l8 1M30 34l9 1" {...common} />
        </svg>
      );
    case 'lamp':
      return (
        <svg viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="22" r="13" fill={color} fillOpacity={0.12} stroke="none" />
          <path d="M26 16h12l-2 12h-8z M32 10v6 M29 28h6 M32 28v28 M26 56h12" {...common} />
          <path d="M30 20l2 4 2-4" {...common} strokeWidth={1.2} />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 64 64" aria-hidden>
          <path d="M32 8l4 18 18 6-18 6-4 18-4-18-18-6 18-6z" {...common} fill={color} fillOpacity={0.15} />
          <circle cx="32" cy="32" r="22" {...common} strokeDasharray="1 4" />
        </svg>
      );
    case 'key':
      return (
        <svg viewBox="0 0 64 64" aria-hidden>
          <circle cx="20" cy="32" r="9" {...common} fill={color} fillOpacity={0.12} />
          <circle cx="20" cy="32" r="3.5" {...common} />
          <path d="M29 32h26 M47 32v7 M52 32v5" {...common} />
        </svg>
      );
    case 'feather':
      return (
        <svg viewBox="0 0 64 64" aria-hidden>
          <path d="M48 10C30 14 18 30 18 48c14-2 28-14 30-38z" {...common} fill={color} fillOpacity={0.14} />
          <path d="M12 56L44 16 M24 40h10 M28 32h11" {...common} />
        </svg>
      );
    case 'cup':
      return (
        <svg viewBox="0 0 64 64" aria-hidden>
          <path d="M16 30h28v8a12 12 0 0 1-12 12h-4a12 12 0 0 1-12-12z" {...common} fill={color} fillOpacity={0.14} />
          <path d="M44 33h3a5 5 0 0 1 0 10h-4 M12 54h40" {...common} />
          <path d="M26 24c-2-3 2-5 0-9 M34 24c-2-3 2-5 0-9" {...common} opacity={0.7} />
        </svg>
      );
  }
}

function GeneratedFace({ book, cover }: { book: Book; cover: GeneratedCover }) {
  const [bg, ink, accent] = cover.palette;
  const long = book.title.length > 26;
  return (
    <div className="cover-gen" style={{ background: bg, color: ink, ['--accent' as string]: accent }}>
      <div className="cover-gen__inner">
        <div className="cover-gen__frame" />
        <div className="cover-gen__motif">
          <Motif motif={cover.motif} color={accent} />
        </div>
        <div className={`cover-gen__title${long ? ' is-long' : ''}`}>{book.title}</div>
        <div className="cover-gen__rule" />
        <div className="cover-gen__author">{book.author}</div>
      </div>
    </div>
  );
}

/** A book cover at any size. Fills its parent (which sets the aspect ratio). */
export const Cover = memo(function Cover({ book }: { book: Book }) {
  const url = useCoverUrl(book);
  const [broken, setBroken] = useState(false);
  if (book.cover.kind === 'image' && !broken) {
    return url ? (
      <img className="cover-img" src={url} alt="" draggable={false} onError={() => setBroken(true)} />
    ) : (
      <div className="cover-loading" />
    );
  }
  const gen = book.cover.kind === 'generated' ? book.cover : generatedCoverFor(book.title);
  return <GeneratedFace book={book} cover={gen} />;
});
