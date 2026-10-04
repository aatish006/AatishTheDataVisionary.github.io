import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { computeFold, cornerPath, easeInOut, easeOut, polygon, type Fold, type Pt } from './foldGeometry';

// The book itself: lays out pages, owns the page-turn animation and gestures.
//
// Every page is a keyed child of ONE container, so a page that moves from
// "right page" to "turning leaf" keeps its DOM (no re-parse, no flicker).
// Fold geometry is applied imperatively per animation frame (no React renders
// mid-turn), which keeps the curl at 60fps even with heavy text pages.

export type StageMode = 'spread' | 'single';
export type PageSide = 'left' | 'right' | 'single';
export type Role = 'left' | 'right' | 'base' | 'front' | 'back' | 'hidden';

/** Virtual page id: page index, or "paper" for the blank reverse side in single mode. */
type Vp = number | 'paper';

interface Flip {
  dir: 1 | -1;
  staticLeft?: number;
  base: number;
  front: number;
  back: Vp;
  /** the corner being turned */
  cornerY: number;
  dragging: boolean;
}

export interface StageHandle {
  turn(dir: 1 | -1): void;
  isBusy(): boolean;
}

interface Props {
  mode: StageMode;
  W: number;
  H: number;
  /** spread index (spread mode) or page index (single mode) */
  cur: number;
  /** number of spreads / pages */
  count: number;
  renderPage(v: number, side: PageSide): ReactNode;
  renderPaper(): ReactNode;
  onTurned(next: number, dir: 1 | -1): void;
  onTurnStart?(dir: 1 | -1): void;
  onTap?(zone: 'prev' | 'center' | 'next', target: EventTarget | null): void;
  reducedMotion?: boolean;
  /** extra overlay content (ribbon, spine) rendered above pages */
  children?: ReactNode;
}

const DRAG_START = 10;

export const BookStage = forwardRef<StageHandle, Props>(function BookStage(props, ref) {
  const { mode, W, H, cur, count, renderPage, renderPaper, reducedMotion } = props;
  const spread = mode === 'spread';
  const rightX = spread ? W : 0;

  const [flip, setFlip] = useState<Flip | null>(null);
  const [warm, setWarm] = useState(false);
  const flipRef = useRef<Flip | null>(null);
  flipRef.current = flip;
  const propsRef = useRef(props);
  propsRef.current = props;

  const rootRef = useRef<HTMLDivElement>(null);
  const slots = useRef(new Map<string, { outer: HTMLDivElement; inner: HTMLDivElement; shade: HTMLDivElement; strip: HTMLDivElement }>());
  const castRef = useRef<HTMLDivElement>(null);
  const castStripRef = useRef<HTMLDivElement>(null);
  const anim = useRef<{ raf: number; queued: (1 | -1) | null; P: Pt; fast: boolean } | null>(null);
  const [fading, setFading] = useState(0);

  // ---- which pages exist where ------------------------------------------------

  const canPrev = cur > 0;
  const canNext = cur < count - 1;

  function flipFor(dir: 1 | -1, cornerY: number, dragging: boolean): Flip | null {
    if (dir === 1 && !canNext) return null;
    if (dir === -1 && !canPrev) return null;
    if (spread) {
      const k = dir === 1 ? cur : cur - 1; // a backward turn is the previous forward turn, reversed
      return { dir, staticLeft: 2 * k - 1, base: 2 * k + 2, front: 2 * k, back: 2 * k + 1, cornerY, dragging };
    }
    const p = dir === 1 ? cur : cur - 1;
    return { dir, base: p + 1, front: p, back: 'paper', cornerY, dragging };
  }

  // Pages to mount, with their role. Neighbours are pre-mounted (hidden) so turns start instantly.
  const roles = new Map<string, { v: Vp; role: Role }>();
  const put = (v: Vp, role: Role) => {
    const key = String(v);
    const existing = roles.get(key);
    if (!existing || existing.role === 'hidden') roles.set(key, { v, role });
  };
  if (flip) {
    if (spread && flip.staticLeft !== undefined) put(flip.staticLeft, 'left');
    put(flip.base, 'base');
    put(flip.front, 'front');
    put(flip.back, 'back');
  } else if (spread) {
    put(2 * cur - 1, 'left');
    put(2 * cur, 'right');
  } else {
    put(cur, 'right');
  }
  if (warm || flip) {
    if (spread) {
      for (const v of [2 * cur + 1, 2 * cur + 2, 2 * cur - 2, 2 * cur - 3]) put(v, 'hidden');
    } else {
      for (const v of [cur + 1, cur - 1]) put(v, 'hidden');
    }
  }

  // Warm neighbours shortly after settling, so the end of a turn stays smooth.
  useEffect(() => {
    setWarm(false);
    const id = window.setTimeout(() => setWarm(true), 140);
    return () => window.clearTimeout(id);
  }, [cur, mode, W, H]);

  // ---- imperative fold rendering --------------------------------------------------

  const D = Math.ceil(Math.hypot(W, H) * 1.5);

  const resetSlot = useCallback((s: { outer: HTMLDivElement; inner: HTMLDivElement; shade: HTMLDivElement }) => {
    s.inner.style.clipPath = '';
    s.inner.style.transform = '';
    s.outer.style.visibility = '';
    s.shade.style.opacity = '0';
  }, []);

  const applyFold = useCallback(
    (f: Flip, P: Pt) => {
      const front = slots.current.get(String(f.front));
      const back = slots.current.get(String(f.back));
      const cast = castRef.current;
      const castStrip = castStripRef.current;
      if (!front || !back || !cast || !castStrip) return;
      const C = { x: W, y: f.cornerY };
      const fold: Fold | null = computeFold(W, H, C, P);
      if (!fold) {
        resetSlot(front);
        back.outer.style.visibility = 'hidden';
        cast.style.opacity = '0';
        return;
      }
      const { mid, angle, depth, t } = fold;
      const s = Math.min(1, depth / 50) * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.1)));

      // front: the part of the leaf still lying flat
      front.inner.style.clipPath = polygon(fold.front);
      front.shade.style.opacity = '1';
      Object.assign(front.strip.style, {
        left: `${mid.x - D}px`,
        top: `${mid.y - D}px`,
        width: `${2 * D}px`,
        height: `${2 * D}px`,
        transform: `rotate(${angle}rad)`,
        background: `linear-gradient(90deg, rgba(0,0,0,0) ${D - 1}px, rgba(30,18,6,${0.28 * s}) ${D}px, rgba(30,18,6,${0.08 * s}) ${D + depth * 0.1 + 6}px, rgba(0,0,0,0) ${D + depth * 0.45 + 24}px)`,
      });

      // back: the reverse face, folded over
      back.outer.style.visibility = 'visible';
      back.inner.style.transform = `matrix(${fold.backMatrix.map((n) => n.toFixed(5)).join(',')})`;
      back.inner.style.clipPath = polygon(fold.backLocal);
      back.shade.style.opacity = '1';
      const lm = { x: W - mid.x, y: mid.y };
      const la = Math.atan2(-Math.sin(angle), Math.cos(angle));
      Object.assign(back.strip.style, {
        left: `${lm.x - D}px`,
        top: `${lm.y - D}px`,
        width: `${2 * D}px`,
        height: `${2 * D}px`,
        transform: `rotate(${la}rad)`,
        background: `linear-gradient(90deg, rgba(0,0,0,0) ${D - 1}px, rgba(40,24,8,0.22) ${D}px, rgba(255,250,238,0.32) ${D + depth * 0.05 + 3}px, rgba(255,250,238,0.06) ${D + depth * 0.32}px, rgba(40,24,8,0.08) ${D + depth * 0.9}px, rgba(40,24,8,0.16) ${D + depth * 2}px)`,
      });

      // shadow the flap casts on the page being revealed
      cast.style.opacity = '1';
      Object.assign(castStrip.style, {
        left: `${mid.x - D}px`,
        top: `${mid.y - D}px`,
        width: `${2 * D}px`,
        height: `${2 * D}px`,
        transform: `rotate(${angle + Math.PI}rad)`,
        background: `linear-gradient(90deg, rgba(0,0,0,0) ${D - 2}px, rgba(20,10,0,${0.42 * s}) ${D}px, rgba(20,10,0,${0.12 * s}) ${D + Math.min(70, depth * 0.25 + 10)}px, rgba(0,0,0,0) ${D + Math.min(160, depth * 0.6 + 24)}px)`,
      });
    },
    [W, H, D, resetSlot],
  );

  // Reset styles for pages that are not turning, before paint.
  useLayoutEffect(() => {
    const f = flipRef.current;
    slots.current.forEach((s, key) => {
      if (!f || (key !== String(f.front) && key !== String(f.back))) resetSlot(s);
    });
    if (!f && castRef.current) castRef.current.style.opacity = '0';
    if (f && anim.current) applyFold(f, anim.current.P);
  });

  // ---- animation --------------------------------------------------------------------

  const finish = useCallback(
    (f: Flip, committed: boolean) => {
      const a = anim.current;
      anim.current = null;
      if (a) cancelAnimationFrame(a.raf);
      setFlip(null);
      if (committed) {
        const p = propsRef.current;
        p.onTurned(p.cur + f.dir, f.dir);
      }
      const queued = a?.queued;
      if (queued) requestAnimationFrame(() => startTurnRef.current(queued, true));
    },
    [],
  );

  /** Animate P from `from` to `to` (or along the corner path between t0 and t1). */
  const run = useCallback(
    (f: Flip, opts: { t0: number; t1: number; dur: number; path: boolean; from?: Pt; to?: Pt; committed: boolean }) => {
      const start = performance.now();
      const state = anim.current ?? { raf: 0, queued: null, P: opts.from ?? cornerPath(W, H, f.cornerY, opts.t0), fast: false };
      anim.current = state;
      const step = (now: number) => {
        const k = Math.min(1, (now - start) / opts.dur);
        let P: Pt;
        if (opts.path) {
          const e = easeInOut(k);
          P = cornerPath(W, H, f.cornerY, opts.t0 + (opts.t1 - opts.t0) * e);
        } else {
          const e = easeOut(k);
          P = { x: opts.from!.x + (opts.to!.x - opts.from!.x) * e, y: opts.from!.y + (opts.to!.y - opts.from!.y) * e };
        }
        state.P = P;
        applyFold(f, P);
        if (k < 1) state.raf = requestAnimationFrame(step);
        else finish(f, opts.committed);
      };
      state.raf = requestAnimationFrame(step);
    },
    [W, H, applyFold, finish],
  );

  const startTurn = useCallback(
    (dir: 1 | -1, fast = false) => {
      const a = anim.current;
      if (a) {
        a.queued = dir;
        return;
      }
      const f = flipFor(dir, H, false);
      if (!f) return;
      propsRef.current.onTurnStart?.(dir);
      if (reducedMotion) {
        setFading((n) => n + 1);
        propsRef.current.onTurned(propsRef.current.cur + dir, dir);
        return;
      }
      const t0 = dir === 1 ? 0 : 1;
      anim.current = { raf: 0, queued: null, P: cornerPath(W, H, H, t0), fast };
      setFlip(f);
      const dur = (spread ? 720 : 560) * (fast ? 0.62 : 1);
      run(f, { t0, t1: 1 - t0, dur, path: true, committed: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cur, count, mode, W, H, reducedMotion, run],
  );
  const startTurnRef = useRef(startTurn);
  startTurnRef.current = startTurn;

  useImperativeHandle(ref, () => ({
    turn: (dir) => startTurnRef.current(dir),
    isBusy: () => !!anim.current,
  }));

  useEffect(() => () => {
    if (anim.current) cancelAnimationFrame(anim.current.raf);
  }, []);

  // ---- gestures -----------------------------------------------------------------------

  const gesture = useRef<{
    id: number;
    x0: number;
    y0: number;
    t0: number;
    dragging: boolean;
    flip?: Flip;
    P0?: Pt;
    k: number;
    samples: { x: number; t: number }[];
  } | null>(null);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = rootRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left - rightX, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || anim.current) return;
    gesture.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), dragging: false, k: spread ? 1 : 1.7, samples: [{ x: e.clientX, t: performance.now() }] };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    g.samples.push({ x: e.clientX, t: performance.now() });
    if (g.samples.length > 6) g.samples.shift();
    if (!g.dragging) {
      if (Math.abs(dx) < DRAG_START || Math.abs(dx) < Math.abs(dy) * 1.2) {
        if (Math.abs(dy) > DRAG_START * 2) gesture.current = null; // vertical intent: let it go
        return;
      }
      const dir: 1 | -1 = dx < 0 ? 1 : -1;
      const start = local({ clientX: g.x0, clientY: g.y0 });
      const cornerY = start.y < H / 2 ? 0 : H;
      const f = flipFor(dir, cornerY, true);
      if (!f || reducedMotion) {
        gesture.current = null;
        return;
      }
      g.dragging = true;
      g.flip = f;
      g.P0 = dir === 1 ? { x: W, y: cornerY } : { x: -W, y: cornerY };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      anim.current = { raf: 0, queued: null, P: g.P0, fast: false };
      setFlip(f);
      propsRef.current.onTurnStart?.(dir);
    }
    if (g.dragging && g.flip && g.P0 && anim.current) {
      const P = { x: g.P0.x + dx * g.k, y: g.P0.y + dy * 0.8 };
      anim.current.P = P;
      applyFold(g.flip, P);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.id !== e.pointerId) return;
    if (g.dragging && g.flip && anim.current) {
      const f = g.flip;
      const P = anim.current.P;
      const first = g.samples[0];
      const last = g.samples[g.samples.length - 1];
      const vx = (last.x - first.x) / Math.max(1, last.t - first.t); // px/ms
      const travelled = (W - P.x) / (2 * W); // 0 = flat on the right, 1 = fully turned
      let commit: boolean;
      if (f.dir === 1) commit = travelled > 0.3 || vx < -0.45;
      else commit = travelled < 0.7 || vx > 0.45;
      const target = (f.dir === 1) === commit ? { x: -W, y: f.cornerY } : { x: W, y: f.cornerY };
      const dist = Math.abs(target.x - P.x) / (2 * W);
      run(f, { t0: 0, t1: 1, dur: 160 + 380 * dist, path: false, from: P, to: target, committed: commit });
      return;
    }
    // A tap.
    const moved = Math.hypot(e.clientX - g.x0, e.clientY - g.y0);
    if (moved > DRAG_START || performance.now() - g.t0 > 600) return;
    const r = rootRef.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    let zone: 'prev' | 'center' | 'next';
    if (spread) zone = x < 0.47 ? 'prev' : x > 0.53 ? 'next' : 'center';
    else zone = x < 0.3 ? 'prev' : x > 0.7 ? 'next' : 'center';
    propsRef.current.onTap?.(zone, e.target);
  };

  const onPointerCancel = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.dragging && g.flip && anim.current) {
      const P = anim.current.P;
      const back = g.flip.dir === 1 ? { x: W, y: g.flip.cornerY } : { x: -W, y: g.flip.cornerY };
      run(g.flip, { t0: 0, t1: 1, dur: 260, path: false, from: P, to: back, committed: false });
    }
  };

  // ---- render ---------------------------------------------------------------------

  const slotRef = (key: string) => (outer: HTMLDivElement | null) => {
    if (!outer) {
      slots.current.delete(key);
      return;
    }
    const inner = outer.firstElementChild as HTMLDivElement;
    const shade = inner.lastElementChild as HTMLDivElement;
    slots.current.set(key, { outer, inner, shade, strip: shade.firstElementChild as HTMLDivElement });
  };

  const entries = Array.from(roles.entries());

  return (
    <div
      ref={rootRef}
      className={`stage stage--${mode}${fading ? ' stage--fade' : ''}`}
      key={reducedMotion ? fading : undefined}
      style={{ width: spread ? 2 * W : W, height: H }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {entries.map(([key, { v, role }]) => {
        const side: PageSide = !spread ? 'single' : role === 'left' || role === 'back' ? 'left' : 'right';
        const x = role === 'left' ? 0 : rightX;
        const z = { hidden: 0, left: 1, right: 1, base: 1, front: 3, back: 5 }[role];
        return (
          <div
            key={key}
            ref={slotRef(key)}
            className={`slot slot--${role}`}
            style={{ left: x, width: W, height: H, zIndex: z, visibility: role === 'hidden' ? 'hidden' : undefined }}
            aria-hidden={role === 'hidden' || role === 'back' || role === 'base' ? true : undefined}
          >
            <div className="slot__inner">
              {v === 'paper' ? renderPaper() : renderPage(v, side)}
              <div className="slot__shade">
                <div className="slot__strip" />
              </div>
            </div>
          </div>
        );
      })}
      <div ref={castRef} className="stage__cast" style={{ left: rightX, width: W, height: H }}>
        <div ref={castStripRef} className="slot__strip" />
      </div>
      {props.children}
    </div>
  );
});
