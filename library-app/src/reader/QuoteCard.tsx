import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { userName, type UserId } from '../lib/types';

// Quote cards: a highlighted passage set like a page from a fine book,
// drawn on a canvas so it can be saved to Photos or sent to each other.

export type CardStyle = 'ivory' | 'night' | 'rose' | 'sage';

const STYLES: Record<CardStyle, { label: string; bg: [string, string]; ink: string; soft: string; accent: string; grain: number }> = {
  ivory: { label: 'Ivory', bg: ['#fbf5e6', '#efe2c6'], ink: '#2b2018', soft: '#7a6650', accent: '#8c2f39', grain: 0.05 },
  night: { label: 'Night', bg: ['#2a1d15', '#140e0a'], ink: '#f3e7d0', soft: '#bfae92', accent: '#e2c48a', grain: 0.06 },
  rose: { label: 'Rose', bg: ['#6a2a36', '#3f1520'], ink: '#f7e9d6', soft: '#e3c3b7', accent: '#f0c98a', grain: 0.06 },
  sage: { label: 'Sage', bg: ['#3d5246', '#223029'], ink: '#f1eadb', soft: '#c8d1bf', accent: '#e2c48a', grain: 0.06 },
};

export interface QuoteInput {
  text: string;
  note?: string;
  noteAuthor?: UserId;
  title: string;
  author: string;
}

const W = 1080;
const H = 1350;
const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS = "'DM Sans Variable', system-ui, sans-serif";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\n+/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Text with letter-spacing, centred on x (canvas letterSpacing isn't everywhere yet). */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  const widths = [...text].map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let cx = x - total / 2;
  ctx.textAlign = 'left';
  [...text].forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = 'center';
}

function grain(ctx: CanvasRenderingContext2D, amount: number) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 160;
  const t = tile.getContext('2d')!;
  const img = t.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255 * amount;
  }
  t.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(tile, 'repeat')!;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export async function renderQuoteCard(q: QuoteInput, style: CardStyle): Promise<Blob> {
  const s = STYLES[style];
  await Promise.all([
    document.fonts.load(`italic 500 60px ${SERIF}`),
    document.fonts.load(`600 40px ${SERIF}`),
    document.fonts.load(`500 24px ${SANS}`),
  ]).catch(() => undefined);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // paper
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
  g.addColorStop(0, s.bg[0]);
  g.addColorStop(1, s.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.28, 40, W / 2, H * 0.28, W * 0.8);
  glow.addColorStop(0, style === 'ivory' ? 'rgba(255,255,255,0.45)' : 'rgba(255,200,130,0.12)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  grain(ctx, s.grain);

  // double frame
  ctx.strokeStyle = s.accent;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.strokeRect(56, 56, W - 112, H - 112);
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.strokeRect(70, 70, W - 140, H - 140);
  ctx.globalAlpha = 1;

  // big opening quote mark
  ctx.fillStyle = s.accent;
  ctx.globalAlpha = 0.85;
  ctx.font = `500 220px ${SERIF}`;
  ctx.fillText('“', W / 2, 330);
  ctx.globalAlpha = 1;

  // the passage — largest size that fits the space
  const maxW = 820;
  const top = 360;
  const noteSpace = q.note ? 150 : 0;
  const bottomLimit = H - 330 - noteSpace;
  let size = 76;
  let lines: string[] = [];
  let lh = 0;
  for (; size >= 34; size -= 2) {
    ctx.font = `italic 500 ${size}px ${SERIF}`;
    lines = wrap(ctx, q.text.trim(), maxW);
    lh = size * 1.28;
    if (top + lines.length * lh <= bottomLimit) break;
  }
  // last resort for very long passages: trim with an ellipsis
  const maxLines = Math.max(1, Math.floor((bottomLimit - top) / lh));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  }
  const blockH = lines.length * lh;
  let y = top + (bottomLimit - top - blockH) / 2 + size;
  ctx.fillStyle = s.ink;
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += lh;
  }

  // a little note under the passage
  if (q.note) {
    ctx.font = `500 30px ${SANS}`;
    ctx.fillStyle = s.soft;
    const who = q.noteAuthor ? `${userName(q.noteAuthor)}’s note` : 'note';
    spaced(ctx, who.toUpperCase(), W / 2, y + 40, 4);
    ctx.font = `italic 500 38px ${SERIF}`;
    const noteLines = wrap(ctx, q.note, 760).slice(0, 2);
    noteLines.forEach((l, i) => ctx.fillText(i === 1 && wrap(ctx, q.note!, 760).length > 2 ? l + '…' : l, W / 2, y + 92 + i * 46));
  }

  // ornament, title, author
  ctx.fillStyle = s.accent;
  ctx.font = `500 46px ${SERIF}`;
  ctx.fillText('❦', W / 2, H - 250);
  ctx.fillStyle = s.ink;
  ctx.font = `600 44px ${SERIF}`;
  const title = wrap(ctx, q.title, 860)[0] + (wrap(ctx, q.title, 860).length > 1 ? '…' : '');
  ctx.fillText(title, W / 2, H - 182);
  ctx.fillStyle = s.soft;
  ctx.font = `500 24px ${SANS}`;
  spaced(ctx, q.author.toUpperCase(), W / 2, H - 140, 5);

  // signature
  ctx.globalAlpha = 0.7;
  ctx.font = `500 19px ${SANS}`;
  spaced(ctx, 'OUR LITTLE LIBRARY', W / 2, H - 92, 6);
  ctx.globalAlpha = 1;

  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not draw the card.'))), 'image/png'));
}

const fileName = (title: string) => `${title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) || 'quote'}-quote.png`;

export function QuoteCardDialog({ quote, defaultStyle = 'ivory', onClose }: { quote: QuoteInput; defaultStyle?: CardStyle; onClose(): void }) {
  const [style, setStyle] = useState<CardStyle>(defaultStyle);
  const [withNote, setWithNote] = useState(!!quote.note);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string>();

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    setBlob(null);
    renderQuoteCard({ ...quote, note: withNote ? quote.note : undefined }, style).then((b) => {
      if (!alive) return;
      made = URL.createObjectURL(b);
      setBlob(b);
      setUrl(made);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [quote, style, withNote]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const file = blob ? new File([blob], fileName(quote.title), { type: 'image/png' }) : null;
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: quote.title });
    } catch {
      /* closed the share sheet */
    }
  };
  const save = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(quote.title);
    a.click();
    setToast('Saved');
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`“${quote.text.trim()}”\n— ${quote.title}, ${quote.author}`);
      setToast('Quote copied');
    } catch {
      setToast('Couldn’t copy');
    }
  };
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(undefined), 1800);
    return () => window.clearTimeout(id);
  }, [toast]);

  return (
    <motion.div className="modal-scrim modal-scrim--center qcard-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} onPointerDown={(e) => e.stopPropagation()}>
      <motion.div
        className="qcard"
        role="dialog"
        aria-modal="true"
        aria-label="Quote card"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="icon-btn qcard__close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
        <div className="qcard__preview">
          {url ? <img src={url} alt={`Quote card: “${quote.text}” — ${quote.title}`} /> : <div className="qcard__loading" />}
          {toast && <div className="qcard__toast">{toast}</div>}
        </div>
        <div className="qcard__controls">
          <div className="qcard__styles" role="radiogroup" aria-label="Card style">
            {(Object.keys(STYLES) as CardStyle[]).map((k) => (
              <button
                key={k}
                role="radio"
                aria-checked={style === k}
                className={`qcard__style${style === k ? ' is-on' : ''}`}
                onClick={() => setStyle(k)}
                style={{ background: `linear-gradient(160deg, ${STYLES[k].bg[0]}, ${STYLES[k].bg[1]})`, color: STYLES[k].accent }}
              >
                <span>“</span>
                <small>{STYLES[k].label}</small>
              </button>
            ))}
          </div>
          {quote.note && (
            <label className="chip-toggle qcard__note">
              <input type="checkbox" checked={withNote} onChange={(e) => setWithNote(e.target.checked)} />
              <span>
                <Icon name="edit" size={14} /> Include the note
              </span>
            </label>
          )}
          <div className="qcard__actions">
            {canShare ? (
              <button className="btn btn--gold" onClick={share} disabled={!blob}>
                <Icon name="upload" size={17} /> Send
              </button>
            ) : (
              <button className="btn btn--gold" onClick={save} disabled={!blob}>
                <Icon name="upload" size={17} /> Save image
              </button>
            )}
            {canShare && (
              <button className="btn btn--quiet" onClick={save} disabled={!blob}>
                Save
              </button>
            )}
            <button className="btn btn--quiet" onClick={copy}>
              Copy text
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
