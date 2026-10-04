import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { HIGHLIGHT_COLORS, userName, type Highlight, type HighlightColor, type PartnerHighlight, type UserId } from '../lib/types';

export type PopoverTarget = { kind: 'mine'; id: string; rect: DOMRect; fresh?: boolean } | { kind: 'partner'; h: PartnerHighlight; rect: DOMRect };

const COLOR_NAME: Record<HighlightColor, string> = { honey: 'Honey', rose: 'Rose', sage: 'Sage', lavender: 'Lavender' };

function place(rect: DOMRect, w: number, h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(vw - w - 12, Math.max(12, rect.left + rect.width / 2 - w / 2));
  const below = rect.bottom + 12;
  const top = below + h < vh - 12 ? below : Math.max(12, rect.top - h - 12);
  return { left, top };
}

export function HighlightPopover(props: {
  target: PopoverTarget;
  highlight?: Highlight;
  canShare: boolean;
  partner: UserId;
  onChange(patch: Partial<Highlight>): void;
  onErase(): void;
  onClose(): void;
}) {
  const { target, highlight, onClose } = props;
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(highlight?.note ?? '');
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 300, h: 70 });

  useEffect(() => {
    const el = ref.current;
    if (el) setSize({ w: el.offsetWidth, h: el.offsetHeight });
  }, [editing, target]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    // Wait a tick so the tap that opened the popover doesn't close it.
    const id = window.setTimeout(() => window.addEventListener('pointerdown', onDown), 0);
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const pos = place(target.rect, size.w, size.h);

  if (target.kind === 'partner') {
    const h = target.h;
    return (
      <motion.div ref={ref} className="hlpop hlpop--partner" style={pos} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} role="dialog" aria-label={`${userName(h.author)}’s highlight`}>
        <div className="hlpop__who">
          <Avatar user={h.author} size={30} mood="reading" />
          <span>
            <strong>{userName(h.author)}</strong> left this for you
          </span>
        </div>
        <blockquote className={`hlpop__quote hl--${h.color}`}>{h.text}</blockquote>
        {h.note && <p className="hlpop__note">“{h.note}”</p>}
      </motion.div>
    );
  }

  if (!highlight) return null;

  const saveNote = () => {
    props.onChange({ note: note.trim() || undefined });
    setEditing(false);
  };

  return (
    <motion.div ref={ref} className="hlpop" style={pos} initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} role="dialog" aria-label="Highlight">
      <div className="hlpop__row">
        <div className="hlpop__colors" role="radiogroup" aria-label="Highlight colour">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              className={`hlpop__swatch hl--${c}${highlight.color === c ? ' is-on' : ''}`}
              onClick={() => props.onChange({ color: c })}
              role="radio"
              aria-checked={highlight.color === c}
              aria-label={COLOR_NAME[c]}
            />
          ))}
        </div>
        <span className="hlpop__sep" />
        <button className={`hlpop__btn${highlight.note ? ' is-on' : ''}`} onClick={() => setEditing((v) => !v)} aria-label={highlight.note ? 'Edit note' : 'Add a note'} title="Note">
          <Icon name="edit" size={17} />
        </button>
        {props.canShare && (
          <button
            className={`hlpop__btn${highlight.shared ? ' is-love' : ''}`}
            onClick={() => props.onChange({ shared: !highlight.shared })}
            aria-pressed={!!highlight.shared}
            aria-label={highlight.shared ? `Stop sharing with ${userName(props.partner)}` : `Share with ${userName(props.partner)}`}
            title={highlight.shared ? `Shared with ${userName(props.partner)}` : `Leave it for ${userName(props.partner)}`}
          >
            <Icon name="heart" size={17} filled={!!highlight.shared} />
          </button>
        )}
        <button className="hlpop__btn hlpop__btn--erase" onClick={props.onErase} aria-label="Erase highlight" title="Erase">
          <Icon name="eraser" size={17} />
        </button>
      </div>
      {editing ? (
        <div className="hlpop__edit">
          <textarea
            autoFocus
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={props.canShare && highlight.shared ? `A little note for ${userName(props.partner)}…` : 'A little note to remember…'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNote();
            }}
          />
          <button className="btn btn--gold hlpop__save" onClick={saveNote}>
            Save note
          </button>
        </div>
      ) : (
        highlight.note && <p className="hlpop__note">{highlight.note}</p>
      )}
      {target.fresh && !editing && !highlight.note && <p className="hlpop__hint">Highlighted. Add a note, pick a colour{props.canShare ? ', or leave it for ' + userName(props.partner) : ''}.</p>}
    </motion.div>
  );
}
