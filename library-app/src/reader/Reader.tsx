import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AmbientControl } from '../components/AmbientPanel';
import { AaIcon, Icon } from '../components/Icon';
import { unlockAudio } from '../lib/audio/engine';
import { playPageTurn } from '../lib/audio/pageTurn';
import { openDemoBook } from '../lib/demoBooks';
import { hapticTick } from '../lib/haptics';
import { importerByFormat } from '../lib/importers';
import type { ReaderDocument, TocEntry } from '../lib/importers/types';
import { fetchBlob } from '../lib/cloud';
import type { Bookmark, ReadingPosition } from '../lib/types';
import { useLibrary } from '../state/library';
import { BookStage, type PageSide, type StageHandle } from './BookStage';
import { computeGeometry, FONT_STACK, readInsets, type Insets } from './layout';
import { BookOpening, FinishedCelebration, WelcomeBack } from './Overlays';
import { Endpaper, FixedPage, FlowPage, PaperBack } from './PageView';
import { locateAnchor, locateText, paginate, type Pagination, type SearchHit } from './paginate';
import { ContentsPanel, SettingsPanel } from './ReaderPanels';

type Panel = null | 'contents' | 'settings';

function useReducedMotion() {
  const [r, setR] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setR(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

const stripChapterPrefix = (t?: string) => t?.replace(/^Chapter \d+ · /, '');

export function Reader({ bookId, onExit }: { bookId: string; onExit(): void }) {
  const lib = useLibrary();
  const { prefs, updatePrefs, user } = lib;
  const book = lib.allBooks.find((b) => b.id === bookId);
  const saved = lib.stateOf(bookId);
  const reduced = useReducedMotion();

  // Lock page scroll only while the reader is mounted (after the library has gone).
  useEffect(() => {
    document.body.classList.add('is-reading');
    return () => document.body.classList.remove('is-reading');
  }, []);

  // ---- open the document ---------------------------------------------------------
  const [doc, setDoc] = useState<ReaderDocument | null>(null);
  const [loadError, setLoadError] = useState<string>();
  useEffect(() => {
    if (!book) return;
    let alive = true;
    let opened: ReaderDocument | null = null;
    (async () => {
      try {
        if (book.format === 'demo') opened = openDemoBook(book.id);
        else {
          // Downloads from the cloud the first time this device opens the book, then it's cached.
          const blob = book.fileKey ? await fetchBlob(book.fileKey, book.remoteFile).catch(() => undefined) : undefined;
          if (!blob)
            throw new Error(
              book.remoteFile ? 'This book couldn’t be downloaded. Check your connection and try again.' : 'The file for this book is missing from this device.',
            );
          const importer = importerByFormat(book.format);
          if (!importer) throw new Error(`No reader is available for ${book.format.toUpperCase()} files.`);
          opened = await importer.open(blob);
        }
        if (alive) setDoc(opened);
        else opened.dispose();
      } catch (e) {
        if (alive) setLoadError((e as Error).message || 'This book could not be opened.');
      }
    })();
    return () => {
      alive = false;
      opened?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id]);

  // ---- viewport & geometry -----------------------------------------------------------
  const rootRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [insets] = useState<Insets>(() => readInsets());
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let t = 0;
    const ro = new ResizeObserver(([entry]) => {
      window.clearTimeout(t);
      const { width, height } = entry.contentRect;
      t = window.setTimeout(() => setVp({ w: Math.round(width), h: Math.round(height) }), 120);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fixedAspect = doc?.kind === 'fixed' ? doc.pageAspect(0) : undefined;
  const geo = useMemo(() => computeGeometry(vp.w, vp.h, prefs, insets, fixedAspect), [vp.w, vp.h, prefs, insets, fixedAspect]);
  const { layout, mode } = geo;
  const spread = mode === 'spread';
  const typoKey = `${prefs.font}|${prefs.fontSize}|${prefs.lineHeight}`;

  // ---- pagination ------------------------------------------------------------------------
  const [pg, setPg] = useState<Pagination | null>(null);
  useEffect(() => {
    if (!doc) return;
    if (doc.kind === 'fixed') {
      setPg({ pages: [], starts: [], total: doc.pageCount });
      return;
    }
    let cancelled = false;
    (async () => {
      const family = FONT_STACK[prefs.font].split(',')[0];
      try {
        await Promise.all([document.fonts.load(`${prefs.fontSize}px ${family}`), document.fonts.load(`italic ${prefs.fontSize}px ${family}`), document.fonts.load(`600 32px 'Cormorant Garamond'`)]);
        await document.fonts.ready;
      } catch {
        /* fall back to whatever is available */
      }
      if (cancelled || !measureRef.current) return;
      const result = await paginate(doc, bookId, layout, typoKey, measureRef.current, () => cancelled);
      if (!cancelled && result) setPg(result);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, layout.cw, layout.ch, typoKey]);

  const N = pg?.total ?? 0;

  const globalFromPos = useCallback(
    (p: ReadingPosition | undefined) => {
      if (!pg || !p || !doc) return 0;
      if (doc.kind === 'fixed') return Math.min(N - 1, Math.max(0, p.section));
      const s = Math.min(pg.pages.length - 1, Math.max(0, p.section));
      return pg.starts[s] + Math.min(pg.pages[s] - 1, Math.max(0, Math.floor(p.fraction * pg.pages[s] + 1e-6)));
    },
    [pg, doc, N],
  );

  const locate = useCallback(
    (g: number) => {
      if (!pg || !doc || doc.kind === 'fixed') return { section: g, page: 0 };
      let s = 0;
      while (s + 1 < pg.starts.length && pg.starts[s + 1] <= g) s++;
      return { section: s, page: g - pg.starts[s] };
    },
    [pg, doc],
  );

  const posFromGlobal = useCallback(
    (g: number): ReadingPosition => {
      if (!doc || doc.kind === 'fixed' || !pg) return { section: g, fraction: 0 };
      const { section, page } = locate(g);
      return { section, fraction: (page + 0.5) / pg.pages[section] };
    },
    [doc, pg, locate],
  );

  const labelFor = useCallback(
    (g: number) => {
      if (!doc) return '';
      if (doc.kind === 'fixed') return `Page ${g + 1}`;
      const { section } = locate(g);
      return doc.sections[section]?.title ?? `Part ${section + 1}`;
    },
    [doc, locate],
  );

  // ---- position --------------------------------------------------------------------------
  const count = spread ? Math.floor(N / 2) + 1 : N;
  const curFromGlobal = useCallback((g: number) => (spread ? Math.floor((g + 1) / 2) : g), [spread]);
  const [cur, setCur] = useState(0);
  const anchor = useRef<ReadingPosition>(saved.position ?? { section: 0, fraction: 0 });
  const primary = spread ? Math.max(0, Math.min(N - 1, 2 * cur - 1)) : cur;
  const visible = (spread ? [2 * cur - 1, 2 * cur] : [cur]).filter((v) => v >= 0 && v < N);
  const lastVisible = visible.length ? visible[visible.length - 1] : 0;
  const progress = N ? (lastVisible + 1) / N : 0;

  // Re-derive the page whenever pagination or layout mode changes.
  const [posReady, setPosReady] = useState(false);
  useLayoutEffect(() => {
    if (!pg) return;
    setCur(curFromGlobal(globalFromPos(anchor.current)));
    setPosReady(true);
  }, [pg, spread, curFromGlobal, globalFromPos]);

  const turnedRef = useRef(false);
  const onTurned = useCallback(
    (next: number) => {
      turnedRef.current = true;
      setCur(next);
    },
    [],
  );

  useEffect(() => {
    if (!posReady || !N) return;
    anchor.current = posFromGlobal(primary);
  }, [primary, posReady, N, posFromGlobal]);

  // ---- welcome back / start ---------------------------------------------------------------
  const [opening, setOpening] = useState(true);
  const [started, setStarted] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const decided = useRef(false);
  useEffect(() => {
    if (!posReady || decided.current) return;
    decided.current = true;
    const p = saved.progress;
    if (saved.position && p > 0.01 && p < 0.985 && saved.status !== 'finished') setWelcome(true);
    else {
      if (saved.status === 'finished') {
        anchor.current = { section: 0, fraction: 0 };
        setCur(0);
      }
      setStarted(true);
    }
  }, [posReady, saved]);

  const jumpTo = useCallback(
    (g: number) => {
      const c = curFromGlobal(Math.max(0, Math.min(N - 1, g)));
      setCur(c);
      anchor.current = posFromGlobal(Math.max(0, Math.min(N - 1, g)));
    },
    [curFromGlobal, N, posFromGlobal],
  );

  // ---- persist progress ----------------------------------------------------------------------
  const saveRef = useRef<() => void>(() => {});
  saveRef.current = () => {
    if (!started || !N || !book) return;
    void lib.saveProgress(book.id, anchor.current, progress, labelFor(primary));
  };
  useEffect(() => {
    if (!started) return;
    const id = window.setTimeout(() => saveRef.current(), 450);
    return () => window.clearTimeout(id);
  }, [cur, started, N]);
  useEffect(() => {
    const flush = () => saveRef.current();
    window.addEventListener('pagehide', flush);
    const onVis = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // ---- finishing -------------------------------------------------------------------------------
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (!started || !N || N < 2 || !turnedRef.current) return;
    if (!visible.includes(N - 1) || saved.status === 'finished') return;
    const id = window.setTimeout(() => {
      setCelebrate(true);
      void lib.setStatus(bookId, 'finished');
    }, 900);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, started, N]);

  // ---- UI chrome --------------------------------------------------------------------------------
  const [ui, setUi] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const hideTimer = useRef(0);
  const hoveringUi = useRef(false);
  const scheduleHide = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!hoveringUi.current) setUi(false);
    }, 2600);
  }, []);
  useEffect(() => {
    if (started && !geo.phone) scheduleHide();
    if (started && geo.phone) {
      const id = window.setTimeout(() => setUi(false), 1800);
      return () => window.clearTimeout(id);
    }
  }, [started, geo.phone, scheduleHide]);
  const onMouseMove = () => {
    if (geo.phone || !started) return;
    setUi(true);
    scheduleHide();
  };
  const showUi = ui || panel !== null || !started;

  // ---- turning -----------------------------------------------------------------------------------
  const stage = useRef<StageHandle>(null);
  const onTurnStart = useCallback(
    (dir: 1 | -1) => {
      if (prefs.pageSound) void playPageTurn(dir);
      if (prefs.haptics) hapticTick();
      if (geo.phone) setUi(false);
    },
    [prefs.pageSound, prefs.haptics, geo.phone],
  );
  const turn = useCallback((dir: 1 | -1) => stage.current?.turn(dir), []);

  const followLink = useCallback(
    async (target: string) => {
      if (!doc || doc.kind !== 'flow' || !pg || !measureRef.current) return;
      const r = doc.resolveLink(target);
      if (!r) return;
      const p = r.anchor ? await locateAnchor(doc, r.section, r.anchor, layout, measureRef.current) : 0;
      jumpTo(pg.starts[r.section] + p);
    },
    [doc, pg, layout, jumpTo],
  );

  const onTap = useCallback(
    (zone: 'prev' | 'center' | 'next', target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      const link = el?.closest?.('a');
      if (link) {
        const internal = link.getAttribute('data-href');
        if (internal) void followLink(internal);
        else if (link.getAttribute('href')) window.open(link.getAttribute('href')!, '_blank', 'noopener');
        return;
      }
      if (panel) {
        setPanel(null);
        return;
      }
      if (zone === 'center') {
        setUi((u) => !u);
        return;
      }
      turn(zone === 'next' ? 1 : -1);
    },
    [panel, turn, followLink],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (welcome || celebrate) return;
      const t = e.target as HTMLElement;
      if (t?.closest?.('input, textarea, select, [contenteditable]')) return;
      void unlockAudio();
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          turn(1);
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          turn(-1);
          break;
        case 'Home':
          jumpTo(0);
          break;
        case 'End':
          jumpTo(N - 1);
          break;
        case 'Escape':
          if (panel) setPanel(null);
          else onExit();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turn, jumpTo, N, panel, onExit, welcome, celebrate]);

  // ---- bookmarks -----------------------------------------------------------------------------------
  const bookmarks = saved.bookmarks;
  const here = bookmarks.find((b) => visible.includes(globalFromPos(b.position)));
  const toggleBookmark = async () => {
    if (here) await lib.removeBookmark(bookId, here.id);
    else await lib.addBookmark(bookId, { position: posFromGlobal(primary), label: `${labelFor(primary)} · p. ${primary + 1}`, progress });
    if (prefs.haptics) hapticTick('medium');
  };

  // ---- navigation from panels ------------------------------------------------------------------
  const goToc = async (e: TocEntry) => {
    if (!doc || !pg) return;
    if (doc.kind === 'fixed') jumpTo(e.section);
    else {
      const p = e.anchor && measureRef.current ? await locateAnchor(doc, e.section, e.anchor, layout, measureRef.current) : 0;
      jumpTo(pg.starts[e.section] + p);
    }
    if (geo.phone) setPanel(null);
  };
  const goBookmark = (b: Bookmark) => {
    jumpTo(globalFromPos(b.position));
    if (geo.phone) setPanel(null);
  };
  const goHit = async (h: SearchHit, q: string) => {
    if (!doc || doc.kind !== 'flow' || !pg || !measureRef.current) return;
    const p = await locateText(doc, h.section, q, h.occurrence, layout, measureRef.current);
    jumpTo(pg.starts[h.section] + p);
    if (geo.phone) setPanel(null);
  };

  // ---- scrubber ---------------------------------------------------------------------------------
  const [scrub, setScrub] = useState<number | null>(null);

  // ---- rendering pages ----------------------------------------------------------------------------
  const renderPage = useCallback(
    (v: number, side: PageSide) => {
      if (!doc || !book) return null;
      if (v < 0) return <Endpaper side={side} layout={layout} kind="front" title={book.title} />;
      if (v >= N) return <Endpaper side={side} layout={layout} kind="back" title={book.title} />;
      if (doc.kind === 'fixed') return <FixedPage side={side} layout={layout} doc={doc} index={v} folio={String(v + 1)} />;
      const { section, page } = locate(v);
      const title = stripChapterPrefix(doc.sections[section]?.title);
      return (
        <FlowPage
          side={side}
          layout={layout}
          html={doc.sections[section].html}
          index={page}
          chapterStart={page === 0}
          head={side === 'left' ? book.title : title ?? book.title}
          folio={String(v + 1)}
        />
      );
    },
    [doc, book, layout, N, locate],
  );
  const renderPaper = useCallback(() => <PaperBack layout={layout} />, [layout]);

  if (!book) {
    return (
      <div className="reader reader--missing">
        <p>This book isn’t on your shelf any more.</p>
        <button className="btn btn--gold" onClick={onExit}>
          Back to the library
        </button>
      </div>
    );
  }

  const { section: curSection, page: curPageInSection } = locate(primary);
  const pagesLeftInChapter = doc?.kind === 'flow' && pg ? Math.max(0, pg.pages[curSection] - curPageInSection - (spread ? 2 : 1)) : 0;
  const ready = !!pg && posReady;
  const scrubValue = scrub ?? primary;

  return (
    <div
      ref={rootRef}
      className={`reader theme-${prefs.theme}${geo.phone ? ' is-phone' : ''}${showUi ? ' ui-on' : ''}`}
      style={{
        ['--rd-font' as string]: FONT_STACK[prefs.font],
        ['--rd-size' as string]: `${prefs.fontSize}px`,
        ['--rd-lh' as string]: prefs.lineHeight,
      }}
      onMouseMove={onMouseMove}
      onPointerDownCapture={() => void unlockAudio()}
    >
      <div className="reader__room" aria-hidden />

      {/* hidden measuring box: identical typography to the pages */}
      <div className="measure" ref={measureRef} aria-hidden>
        <div className="flow" />
      </div>

      {loadError ? (
        <div className="reader__error" role="alert">
          <h2>This book wouldn’t open</h2>
          <p>{loadError}</p>
          <button className="btn btn--gold" onClick={onExit}>
            Back to the library
          </button>
        </div>
      ) : (
        ready && (
          <div className="reader__desk">
            <div className={`book book--${mode}`} style={{ ['--edge-l' as string]: `${Math.round(progress * 6)}px`, ['--edge-r' as string]: `${Math.round((1 - progress) * 6)}px` }}>
              <BookStage
                ref={stage}
                mode={mode}
                W={layout.W}
                H={layout.H}
                cur={cur}
                count={count}
                renderPage={renderPage}
                renderPaper={renderPaper}
                onTurned={onTurned}
                onTurnStart={onTurnStart}
                onTap={onTap}
                reducedMotion={reduced}
              >
                {spread && <div className="stage__spine" aria-hidden />}
                <button
                  className={`ribbon${here ? ' is-on' : ''}`}
                  style={{ left: spread ? layout.W * 2 - Math.max(56, layout.padR * 0.9) : layout.W - Math.max(44, layout.padR + 8) }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={toggleBookmark}
                  aria-label={here ? 'Remove bookmark from this page' : 'Bookmark this page'}
                  aria-pressed={!!here}
                >
                  <span className="ribbon__tail" />
                </button>
              </BookStage>
              <div className="book__dim" style={{ opacity: 1 - prefs.brightness }} aria-hidden />
            </div>
          </div>
        )
      )}

      {/* top bar */}
      <motion.header
        className="rbar rbar--top"
        animate={{ opacity: showUi ? 1 : 0, y: showUi ? 0 : -12 }}
        transition={{ duration: 0.3 }}
        style={{ pointerEvents: showUi ? 'auto' : 'none' }}
        onMouseEnter={() => (hoveringUi.current = true)}
        onMouseLeave={() => (hoveringUi.current = false)}
      >
        <button className="rbtn rbtn--back" onClick={onExit} aria-label="Back to library">
          <Icon name="back" />
          <span className="rbtn__text">Library</span>
        </button>
        <div className="rbar__title">
          <span className="rbar__book">{book.title}</span>
          <span className="rbar__author">{book.author}</span>
        </div>
        <div className="rbar__actions">
          <button className={`rbtn${panel === 'contents' ? ' is-on' : ''}`} onClick={() => setPanel((p) => (p === 'contents' ? null : 'contents'))} aria-label="Contents, bookmarks and search">
            <Icon name="contents" />
          </button>
          <button className={`rbtn${panel === 'settings' ? ' is-on' : ''}`} onClick={() => setPanel((p) => (p === 'settings' ? null : 'settings'))} aria-label="Reading settings">
            <AaIcon size={22} />
          </button>
          <AmbientControl placement="inline" />
          <button className={`rbtn${here ? ' is-on is-ribbon' : ''}`} onClick={toggleBookmark} aria-label={here ? 'Remove bookmark' : 'Add bookmark'} aria-pressed={!!here}>
            <Icon name="bookmark" filled={!!here} />
          </button>
        </div>
      </motion.header>

      {/* bottom bar */}
      {ready && (
        <motion.footer
          className="rbar rbar--bottom"
          animate={{ opacity: showUi ? 1 : 0, y: showUi ? 0 : 12 }}
          transition={{ duration: 0.3 }}
          style={{ pointerEvents: showUi ? 'auto' : 'none' }}
          onMouseEnter={() => (hoveringUi.current = true)}
          onMouseLeave={() => (hoveringUi.current = false)}
        >
          {!geo.phone && (
            <button className="rbtn" onClick={() => turn(-1)} disabled={cur <= 0} aria-label="Previous page">
              <Icon name="back" />
            </button>
          )}
          <div className="scrub">
            <div className="scrub__meta">
              <span className="scrub__where">{labelFor(scrubValue)}</span>
              <span className="scrub__pct">
                {scrub !== null ? `Page ${scrub + 1} of ${N}` : `${Math.round(progress * 100)}%${doc?.kind === 'flow' && pagesLeftInChapter > 0 ? ` · ${pagesLeftInChapter} ${pagesLeftInChapter === 1 ? 'page' : 'pages'} left in chapter` : ''}`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, N - 1)}
              value={scrubValue}
              onChange={(e) => setScrub(Number(e.target.value))}
              onPointerUp={() => {
                if (scrub !== null) jumpTo(scrub);
                setScrub(null);
              }}
              onKeyUp={() => {
                if (scrub !== null) jumpTo(scrub);
                setScrub(null);
              }}
              aria-label="Position in book"
              aria-valuetext={`${labelFor(scrubValue)}, page ${scrubValue + 1} of ${N}`}
              style={{ ['--fill' as string]: `${N > 1 ? (scrubValue / (N - 1)) * 100 : 0}%` }}
            />
          </div>
          {!geo.phone && (
            <button className="rbtn" onClick={() => turn(1)} disabled={cur >= count - 1} aria-label="Next page">
              <Icon name="next" />
            </button>
          )}
        </motion.footer>
      )}

      {/* quiet progress line when chrome is hidden */}
      {ready && (
        <div className={`rprogress${showUi ? ' is-hidden' : ''}`} aria-hidden>
          <div className="rprogress__bar" style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}

      <AnimatePresence>
        {panel === 'settings' && <SettingsPanel key="s" prefs={prefs} update={updatePrefs} fixed={doc?.kind === 'fixed'} onClose={() => setPanel(null)} />}
        {panel === 'contents' && doc && (
          <ContentsPanel
            key="c"
            doc={doc}
            currentSection={doc.kind === 'fixed' ? primary : curSection}
            bookmarks={bookmarks}
            onGoToc={goToc}
            onGoBookmark={goBookmark}
            onRemoveBookmark={(b) => void lib.removeBookmark(bookId, b.id)}
            onGoHit={goHit}
            onClose={() => setPanel(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {welcome && !opening && (
          <WelcomeBack
            label={saved.positionLabel}
            progress={saved.progress}
            onContinue={() => {
              setWelcome(false);
              setStarted(true);
            }}
            onRestart={() => {
              setWelcome(false);
              jumpTo(0);
              setStarted(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {celebrate && user && (
          <FinishedCelebration user={user} title={book.title} onLibrary={onExit} onStay={() => setCelebrate(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>{opening && !loadError && <BookOpening key="open" book={book} ready={ready} reduced={reduced} onDone={() => setOpening(false)} />}</AnimatePresence>
    </div>
  );
}
