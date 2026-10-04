import type { ReaderFont, UserPrefs } from '../lib/types';
import type { StageMode } from './BookStage';
import type { PageLayout } from './paginate';

export const FONT_STACK: Record<ReaderFont, string> = {
  literata: "'Literata Variable', 'Iowan Old Style', Georgia, serif",
  garamond: "'EB Garamond Variable', Garamond, 'Times New Roman', serif",
  lora: "'Lora Variable', Georgia, serif",
  sans: "'DM Sans Variable', system-ui, -apple-system, sans-serif",
};

export const FONT_LABEL: Record<ReaderFont, string> = {
  literata: 'Literata',
  garamond: 'Garamond',
  lora: 'Lora',
  sans: 'Sans',
};

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ReaderGeometry {
  mode: StageMode;
  phone: boolean;
  layout: PageLayout;
}

/**
 * Decide between a two-page spread and a single page, and size the pages.
 * Desktop & landscape tablets get the open-book spread; phones get a
 * full-bleed single page; portrait tablets get one generous page.
 */
export function computeGeometry(vw: number, vh: number, prefs: UserPrefs, insets: Insets, fixedAspect?: number): ReaderGeometry {
  const phone = vw < 600 || (vh < 500 && vw < 950);
  const spread = !phone && vw >= 900 && vw / vh >= 1.12;
  const aspect = fixedAspect ?? 0.69;

  let W: number;
  let H: number;
  if (spread) {
    H = Math.min(vh - 150, 1000); // leave the margins for the (auto-hiding) top & bottom bars
    W = H * aspect;
    const maxW = (vw - 120) / 2;
    if (W > maxW) {
      W = maxW;
      H = W / aspect;
    }
  } else if (phone) {
    W = vw;
    H = vh;
  } else {
    H = Math.min(vh - 156, 1100);
    W = Math.min(H * (fixedAspect ?? 0.74), vw - 56, 760);
    H = fixedAspect ? W / fixedAspect : H;
  }
  W = Math.floor(W);
  H = Math.floor(H);

  const widthFactor = phone ? [0.1, 0.075, 0.055][prefs.width] : [0.135, 0.1, 0.075][prefs.width];
  const padL = Math.max(18, Math.round(W * widthFactor)) + (phone ? insets.left : 0);
  const padR = Math.max(18, Math.round(W * widthFactor)) + (phone ? insets.right : 0);
  const padT = phone ? 52 + insets.top : Math.max(48, Math.round(H * 0.085));
  const padB = phone ? 46 + insets.bottom : Math.max(46, Math.round(H * 0.08));

  return {
    mode: spread ? 'spread' : 'single',
    phone,
    layout: {
      W,
      H,
      padT,
      padB,
      padL,
      padR,
      cw: Math.floor(W - padL - padR),
      ch: Math.floor(H - padT - padB),
      gap: 48,
    },
  };
}

export function readInsets(): Insets {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const v = { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
  probe.remove();
  return v;
}
