// Page-curl geometry.
//
// The turning leaf occupies [0,W]x[0,H] with the spine on its left edge (x=0).
// Its free corner C is dragged to a point P. Physically, the paper folds along
// the perpendicular bisector of C→P: everything on C's side of that line is
// flipped over (the "flap"), showing the reverse side of the leaf, mirrored
// across the fold. The rest of the leaf (the "front") stays flat.
//
// This is the same model classic page-curl effects use; it gives a believable
// bend, a moving fold, a cast shadow and lighting from just three page layers.

export interface Pt {
  x: number;
  y: number;
}

export interface Fold {
  /** visible part of the front face, leaf coords */
  front: Pt[];
  /** visible part of the reverse face, in the reverse page's own local coords */
  backLocal: Pt[];
  /** the flap in screen (leaf) coords, after folding */
  flapScreen: Pt[];
  /** CSS matrix placing the reverse page (local → leaf coords) */
  backMatrix: [number, number, number, number, number, number];
  /** fold line midpoint, unit normal pointing from the corner toward the spine side */
  mid: Pt;
  angle: number;
  /** distance from the fold line to the corner (flap depth) */
  depth: number;
  /** 0..1 how far the page has travelled */
  t: number;
}

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
const len = (a: Pt) => Math.hypot(a.x, a.y);

/** Keep P where a page attached at the spine could physically reach. */
export function constrain(P: Pt, W: number, H: number, cornerY: number): Pt {
  let p = { ...P };
  const near = { x: 0, y: cornerY };
  const far = { x: 0, y: H - cornerY };
  const diag = Math.hypot(W, H);
  for (let i = 0; i < 2; i++) {
    const dn = sub(p, near);
    const ln = len(dn);
    if (ln > W) p = { x: near.x + (dn.x * W) / ln, y: near.y + (dn.y * W) / ln };
    const df = sub(p, far);
    const lf = len(df);
    if (lf > diag) p = { x: far.x + (df.x * diag) / lf, y: far.y + (df.y * diag) / lf };
  }
  return p;
}

/** Sutherland–Hodgman clip of a convex polygon against the half-plane (q-M)·n >= 0 (or <= 0). */
function clipHalf(poly: Pt[], M: Pt, n: Pt, keepPositive: boolean): Pt[] {
  const side = (q: Pt) => (keepPositive ? 1 : -1) * dot(sub(q, M), n);
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) {
      const t = sa / (sa - sb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

export function computeFold(W: number, H: number, C: Pt, Praw: Pt): Fold | null {
  const P = constrain(Praw, W, H, C.y);
  const d = sub(P, C);
  const dl = len(d);
  if (dl < 0.5) return null;
  const n = { x: d.x / dl, y: d.y / dl };
  const M = { x: (C.x + P.x) / 2, y: (C.y + P.y) / 2 };
  const rect: Pt[] = [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: H },
    { x: 0, y: H },
  ];
  const front = clipHalf(rect, M, n, true);
  const flap = clipHalf(rect, M, n, false);
  const reflect = (q: Pt): Pt => {
    const k = 2 * dot(sub(q, M), n);
    return { x: q.x - k * n.x, y: q.y - k * n.y };
  };
  // reverse page local (u,v) ↔ leaf (W-u, v) → folded into place by reflection
  const map = (u: number, v: number) => reflect({ x: W - u, y: v });
  const o = map(0, 0);
  const ex = map(1, 0);
  const ey = map(0, 1);
  return {
    front,
    backLocal: flap.map((q) => ({ x: W - q.x, y: q.y })),
    flapScreen: flap.map(reflect),
    backMatrix: [ex.x - o.x, ex.y - o.y, ey.x - o.x, ey.y - o.y, o.x, o.y],
    mid: M,
    angle: Math.atan2(n.y, n.x),
    depth: dl / 2,
    t: Math.min(1, Math.max(0, (C.x - P.x) / (2 * W))),
  };
}

export const polygon = (pts: Pt[]) =>
  pts.length < 3 ? 'polygon(0 0, 0 0, 0 0)' : `polygon(${pts.map((p) => `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`).join(', ')})`;

/** Where the corner travels during an animated (click/keyboard) turn. */
export function cornerPath(W: number, H: number, cornerY: number, t: number): Pt {
  const lift = (cornerY > H / 2 ? -1 : 1) * H * 0.06;
  return { x: W - 2 * W * t, y: cornerY + lift * Math.sin(Math.PI * t) };
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
