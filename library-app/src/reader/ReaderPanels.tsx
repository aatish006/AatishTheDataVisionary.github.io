import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { canHaptic } from '../lib/haptics';
import type { ReaderDocument, TocEntry } from '../lib/importers/types';
import type { Bookmark, ReaderFont, ReaderTheme, UserPrefs } from '../lib/types';
import { FONT_LABEL, FONT_STACK } from './layout';
import { searchFlow, type SearchHit } from './paginate';

const panelMotion = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 24 },
  transition: { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] as const },
};

// ---------------------------------------------------------------- settings

export function SettingsPanel({ prefs, update, fixed, onClose }: { prefs: UserPrefs; update(p: Partial<UserPrefs>): void; fixed: boolean; onClose(): void }) {
  const themes: { id: ReaderTheme; label: string }[] = [
    { id: 'day', label: 'Day' },
    { id: 'sepia', label: 'Sepia' },
    { id: 'night', label: 'Night' },
  ];
  return (
    <motion.aside className="rpanel rpanel--settings" role="dialog" aria-label="Reading settings" {...panelMotion} onPointerDown={(e) => e.stopPropagation()}>
      <header className="rpanel__head">
        <h2>Reading</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close settings">
          <Icon name="close" />
        </button>
      </header>

      <div className="rset">
        <div className="rset__label">Paper</div>
        <div className="rset__themes">
          {themes.map((t) => (
            <button key={t.id} className={`theme-swatch theme-swatch--${t.id}${prefs.theme === t.id ? ' is-on' : ''}`} onClick={() => update({ theme: t.id })} aria-pressed={prefs.theme === t.id}>
              <span className="theme-swatch__page">Aa</span>
              <span className="theme-swatch__name">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {!fixed && (
        <>
          <div className="rset">
            <div className="rset__label">Text size</div>
            <div className="rset__row">
              <button className="step-btn" onClick={() => update({ fontSize: Math.max(14, prefs.fontSize - 1) })} aria-label="Smaller text">
                <span style={{ fontSize: 13 }}>A</span>
              </button>
              <input
                type="range"
                min={14}
                max={28}
                step={1}
                value={prefs.fontSize}
                onChange={(e) => update({ fontSize: Number(e.target.value) })}
                aria-label="Text size"
                style={{ ['--fill' as string]: `${((prefs.fontSize - 14) / 14) * 100}%` }}
              />
              <button className="step-btn" onClick={() => update({ fontSize: Math.min(28, prefs.fontSize + 1) })} aria-label="Larger text">
                <span style={{ fontSize: 20 }}>A</span>
              </button>
            </div>
          </div>

          <div className="rset">
            <div className="rset__label">Typeface</div>
            <div className="rset__fonts">
              {(Object.keys(FONT_STACK) as ReaderFont[]).map((f) => (
                <button key={f} className={`font-opt${prefs.font === f ? ' is-on' : ''}`} onClick={() => update({ font: f })} aria-pressed={prefs.font === f} style={{ fontFamily: FONT_STACK[f] }}>
                  <span className="font-opt__aa">Aa</span>
                  <span className="font-opt__name">{FONT_LABEL[f]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rset rset--split">
            <div>
              <div className="rset__label">Line spacing</div>
              <div className="seg">
                {[1.45, 1.6, 1.8].map((lh, i) => (
                  <button key={lh} className={prefs.lineHeight === lh ? 'is-on' : ''} onClick={() => update({ lineHeight: lh })} aria-label={['Compact', 'Comfortable', 'Airy'][i]} aria-pressed={prefs.lineHeight === lh}>
                    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
                      {[0, 1, 2].map((r) => (
                        <rect key={r} x="3" y={4 + r * (3 + i * 1.6)} width="14" height="1.6" rx=".8" fill="currentColor" />
                      ))}
                    </svg>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="rset__label">Margins</div>
              <div className="seg">
                {([0, 1, 2] as const).map((w) => (
                  <button key={w} className={prefs.width === w ? 'is-on' : ''} onClick={() => update({ width: w })} aria-label={['Narrow column', 'Balanced', 'Wide column'][w]} aria-pressed={prefs.width === w}>
                    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
                      <rect x="2.5" y="3" width="15" height="14" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
                      <rect x={7 - w * 1.6} y="6.5" width={6 + w * 3.2} height="7" rx=".6" fill="currentColor" opacity=".7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="rset">
        <div className="rset__label">Brightness</div>
        <div className="rset__row">
          <Icon name="sun" size={14} />
          <input
            type="range"
            min={0.55}
            max={1}
            step={0.01}
            value={prefs.brightness}
            onChange={(e) => update({ brightness: Number(e.target.value) })}
            aria-label="Brightness"
            style={{ ['--fill' as string]: `${((prefs.brightness - 0.55) / 0.45) * 100}%` }}
          />
          <Icon name="sun" size={20} />
        </div>
      </div>

      <div className="rset">
        <label className="toggle">
          <span>
            Page-turn sound
            <small>Soft paper, never loud</small>
          </span>
          <input type="checkbox" checked={prefs.pageSound} onChange={(e) => update({ pageSound: e.target.checked })} />
          <i aria-hidden />
        </label>
        {canHaptic() && (
          <label className="toggle">
            <span>
              Haptic feedback
              <small>A tiny tap as pages turn</small>
            </span>
            <input type="checkbox" checked={prefs.haptics} onChange={(e) => update({ haptics: e.target.checked })} />
            <i aria-hidden />
          </label>
        )}
      </div>
    </motion.aside>
  );
}

// ---------------------------------------------------------------- contents / bookmarks / search

type Tab = 'contents' | 'bookmarks' | 'search';

export function ContentsPanel(props: {
  doc: ReaderDocument;
  currentSection: number;
  bookmarks: Bookmark[];
  onGoToc(entry: TocEntry): void;
  onGoBookmark(b: Bookmark): void;
  onRemoveBookmark(b: Bookmark): void;
  onGoHit(hit: SearchHit, query: string): void;
  onClose(): void;
  initialTab?: Tab;
}) {
  const { doc } = props;
  const [tab, setTab] = useState<Tab>(props.initialTab ?? 'contents');
  const [query, setQuery] = useState('');
  const hits = useMemo(() => (doc.kind === 'flow' && tab === 'search' ? searchFlow(doc, query) : []), [doc, query, tab]);

  const toc: TocEntry[] = doc.toc.length
    ? doc.toc
    : doc.kind === 'flow'
      ? doc.sections.map((s, i) => ({ label: s.title ?? `Part ${i + 1}`, section: i, depth: 0 })).filter((e, i, arr) => i === 0 || e.label !== arr[i - 1].label)
      : [];

  // Highlight the entry the reader is currently inside.
  let activeIdx = -1;
  toc.forEach((e, i) => {
    if (e.section <= props.currentSection) activeIdx = i;
  });

  return (
    <motion.aside className="rpanel rpanel--contents" role="dialog" aria-label="Contents" {...panelMotion} onPointerDown={(e) => e.stopPropagation()}>
      <header className="rpanel__head">
        <div className="tabs" role="tablist">
          {(['contents', 'bookmarks', ...(doc.kind === 'flow' ? ['search'] : [])] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => setTab(t)}>
              {t === 'contents' ? 'Contents' : t === 'bookmarks' ? `Bookmarks${props.bookmarks.length ? ` · ${props.bookmarks.length}` : ''}` : 'Search'}
            </button>
          ))}
        </div>
        <button className="icon-btn" onClick={props.onClose} aria-label="Close contents">
          <Icon name="close" />
        </button>
      </header>

      {tab === 'contents' && (
        <ol className="toc">
          {toc.length === 0 && <li className="empty-note">This book doesn’t include a table of contents.</li>}
          {toc.map((e, i) => (
            <li key={i} style={{ paddingLeft: e.depth * 16 }}>
              <button className={i === activeIdx ? 'is-current' : ''} onClick={() => props.onGoToc(e)}>
                {e.depth === 0 && <span className="toc__num">{String(toc.slice(0, i + 1).filter((x) => x.depth === 0).length).padStart(2, '0')}</span>}
                <span className="toc__label">{e.label}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {tab === 'bookmarks' && (
        <ul className="bmarks">
          {props.bookmarks.length === 0 && (
            <li className="empty-note">
              <svg width="28" height="44" viewBox="0 0 28 44" aria-hidden>
                <path d="M2 0h24v44l-12-9-12 9z" fill="var(--burgundy)" opacity=".8" />
              </svg>
              No ribbons yet. Tap the ribbon at the top of a page to keep your place.
            </li>
          )}
          {props.bookmarks.map((b) => (
            <li key={b.id}>
              <button className="bmarks__go" onClick={() => props.onGoBookmark(b)}>
                <span className="bmarks__label">{b.label}</span>
                <span className="bmarks__meta">
                  {Math.round(b.progress * 100)}% · {new Date(b.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </span>
              </button>
              <button className="icon-btn icon-btn--small" onClick={() => props.onRemoveBookmark(b)} aria-label={`Remove bookmark ${b.label}`}>
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {tab === 'search' && (
        <div className="bsearch">
          <label className="search-field">
            <Icon name="search" size={17} />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search inside this book" aria-label="Search inside this book" />
          </label>
          <ul className="bsearch__hits">
            {query.trim().length >= 2 && hits.length === 0 && <li className="empty-note">Nothing found for “{query}”.</li>}
            {hits.map((h, i) => (
              <li key={i}>
                <button onClick={() => props.onGoHit(h, query)}>
                  <span className="bsearch__where">{doc.kind === 'flow' ? doc.sections[h.section].title ?? `Part ${h.section + 1}` : ''}</span>
                  <span className="bsearch__snip">
                    …{h.before}
                    <mark>{h.match}</mark>
                    {h.after}…
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.aside>
  );
}
