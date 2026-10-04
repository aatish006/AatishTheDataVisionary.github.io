import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ACCEPT, IMPORTERS, MAX_FILE_MB } from '../lib/importers';
import { partnerOf, userName, type Book, type ShelfStatus, type UserId } from '../lib/types';
import { useLibrary } from '../state/library';
import { Avatar } from './Avatar';
import { Cover } from './Cover';
import { Icon } from './Icon';

function Modal({ children, onClose, label, className = '' }: { children: React.ReactNode; onClose(): void; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        ref={ref}
        tabIndex={-1}
        className={`sheet ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__grab" aria-hidden />
        <button className="icon-btn sheet__close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}

const STATUS_LABEL: Record<ShelfStatus, string> = { none: 'On the shelf', want: 'Want to read', reading: 'Reading', finished: 'Finished' };

// ---------------------------------------------------------------- details

export function BookDetail({ book, onClose, onRead, onEdit }: { book: Book; onClose(): void; onRead(b: Book): void; onEdit(b: Book): void }) {
  const lib = useLibrary();
  const st = lib.stateOf(book.id);
  const mine = book.ownerId === lib.user;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const reading = st.progress > 0 && st.progress < 1 && st.status !== 'finished';

  return (
    <Modal onClose={onClose} label={book.title} className="sheet--detail">
      <div className="detail">
        <div className="detail__cover">
          <div className="book3d">
            <Cover book={book} />
          </div>
        </div>
        <div className="detail__body">
          {book.isDemo && <span className="tag tag--demo">Demo book</span>}
          <h2 className="detail__title">{book.title}</h2>
          <div className="detail__author">{book.author}</div>
          <div className="detail__meta">
            {[book.category, book.format === 'demo' ? 'Sample story' : book.format.toUpperCase(), book.pageCount ? `${book.pageCount} pages` : null, `Added ${new Date(book.addedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`]
              .filter(Boolean)
              .join(' · ')}
          </div>
          {book.shared && (
            <div className="detail__shared">
              <Avatar user={book.ownerId} size={22} /> On Our Shelf · added by {userName(book.ownerId)}
            </div>
          )}
          {book.description && <p className="detail__desc">{book.description}</p>}

          {(reading || st.status === 'finished') && (
            <div className="detail__progress">
              <div className="progress">
                <motion.span initial={{ width: 0 }} animate={{ width: `${(st.status === 'finished' ? 1 : st.progress) * 100}%` }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} />
              </div>
              <span>{st.status === 'finished' ? 'Finished' : `${Math.round(st.progress * 100)}% · ${st.positionLabel ?? ''}`}</span>
            </div>
          )}

          <div className="detail__actions">
            <button className="btn btn--gold" onClick={() => onRead(book)}>
              <Icon name="book" size={18} /> {reading ? 'Continue reading' : st.status === 'finished' ? 'Read again' : 'Start reading'}
            </button>
            <button className={`btn btn--icon${st.favourite ? ' is-fav' : ''}`} onClick={() => lib.toggleFavourite(book.id)} aria-pressed={st.favourite} aria-label={st.favourite ? 'Remove from favourites' : 'Add to favourites'}>
              <Icon name="heart" filled={st.favourite} />
            </button>
          </div>

          <div className="detail__row">
            <label className="select">
              <span>Shelf</span>
              <select value={st.status} onChange={(e) => lib.setStatus(book.id, e.target.value as ShelfStatus)}>
                {(Object.keys(STATUS_LABEL) as ShelfStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            {mine && (
              <label className="toggle toggle--inline">
                <span>
                  Our Shelf
                  <small>Share with {userName(partnerOf(lib.user!))}</small>
                </span>
                <input type="checkbox" checked={book.shared} onChange={(e) => lib.updateBook({ ...book, shared: e.target.checked })} />
                <i aria-hidden />
              </label>
            )}
          </div>

          {mine && (
            <div className="detail__owner">
              <button className="link-btn" onClick={() => onEdit(book)}>
                <Icon name="edit" size={16} /> Edit details
              </button>
              {!confirmDelete ? (
                <button className="link-btn link-btn--danger" onClick={() => setConfirmDelete(true)}>
                  <Icon name="trash" size={16} /> Remove
                </button>
              ) : (
                <span className="confirm">
                  Remove from the library?
                  <button
                    className="link-btn link-btn--danger"
                    onClick={async () => {
                      await lib.deleteBook(book.id);
                      onClose();
                    }}
                  >
                    Yes, remove
                  </button>
                  <button className="link-btn" onClick={() => setConfirmDelete(false)}>
                    Keep it
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- edit form

function BookForm({ book, onDone, submitLabel }: { book: Book; onDone(): void; submitLabel: string }) {
  const lib = useLibrary();
  const st = lib.stateOf(book.id);
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [category, setCategory] = useState(book.category ?? '');
  const [description, setDescription] = useState(book.description ?? '');
  const [fav, setFav] = useState(st.favourite);
  const [shared, setShared] = useState(book.shared);
  const [status, setStatus] = useState<ShelfStatus>(st.status === 'none' ? 'want' : st.status);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await lib.updateBook({ ...book, title: title.trim() || book.title, author: author.trim() || 'Unknown author', category: category.trim() || undefined, description: description.trim() || undefined, shared });
    await lib.patchState(book.id, { favourite: fav, status });
    onDone();
  };

  return (
    <form className="bform" onSubmit={save}>
      <div className="bform__cover">
        <div className="book3d">
          <Cover book={{ ...book, title, author }} />
        </div>
      </div>
      <div className="bform__fields">
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="field">
          <span>Author</span>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </label>
        <label className="field">
          <span>Category</span>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Fiction, poetry, essays…" list="cats" />
          <datalist id="cats">
            {['Fiction', 'Romance', 'Mystery', 'Fantasy', 'Essays', 'Poetry', 'Biography', 'History', 'Science', 'Self-growth'].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Description</span>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A line or two to remember it by" />
        </label>
        <div className="bform__toggles">
          <label className="select">
            <span>Shelf</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as ShelfStatus)}>
              {(['want', 'reading', 'finished', 'none'] as ShelfStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="chip-toggle">
            <input type="checkbox" checked={fav} onChange={(e) => setFav(e.target.checked)} />
            <span>
              <Icon name="heart" size={15} filled={fav} /> Favourite
            </span>
          </label>
          <label className="chip-toggle">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
            <span>❤︎ Our Shelf</span>
          </label>
        </div>
        <button className="btn btn--gold bform__submit" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function EditBook({ book, onClose }: { book: Book; onClose(): void }) {
  return (
    <Modal onClose={onClose} label={`Edit ${book.title}`} className="sheet--form">
      <h2 className="sheet__title">Edit details</h2>
      <BookForm book={book} onDone={onClose} submitLabel="Save changes" />
    </Modal>
  );
}

// ---------------------------------------------------------------- upload

type Phase = { k: 'pick' } | { k: 'working'; stage: string; name: string } | { k: 'done'; book: Book } | { k: 'error'; message: string };

export function AddBook({ onClose, initialFile, user }: { onClose(): void; initialFile?: File | null; user: UserId }) {
  const lib = useLibrary();
  const [phase, setPhase] = useState<Phase>({ k: 'pick' });
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  const handle = async (file: File) => {
    setPhase({ k: 'working', stage: 'Adding your book to the library…', name: file.name });
    const t0 = performance.now();
    try {
      const book = await lib.addBook(file, (stage) => setPhase({ k: 'working', stage, name: file.name }));
      // Let the little animation breathe for a moment, even for tiny files.
      const wait = Math.max(0, 1400 - (performance.now() - t0));
      setTimeout(() => setPhase({ k: 'done', book }), wait);
    } catch (e) {
      setPhase({ k: 'error', message: (e as Error).message || 'Something went wrong while reading that file.' });
    }
  };

  useEffect(() => {
    if (initialFile && !started.current) {
      started.current = true;
      void handle(initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  return (
    <Modal onClose={onClose} label="Add a book" className="sheet--form sheet--add">
      <AnimatePresence mode="wait">
        {phase.k === 'pick' && (
          <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="sheet__title">Add a book</h2>
            <p className="sheet__lede">It stays private — the file is kept only in this browser, on this device.</p>
            <div
              className={`dropzone${drag ? ' is-drag' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void handle(f);
              }}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
            >
              <div className="dropzone__book" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <div className="dropzone__text">
                <strong>Choose an ebook</strong> or drop it here
              </div>
              <div className="dropzone__formats">
                {IMPORTERS.map((i) => i.label).join(' · ')} · up to {MAX_FILE_MB} MB
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handle(f);
                  e.target.value = '';
                }}
              />
            </div>
            <p className="sheet__fine">It will be added to {userName(user)}’s shelf. You can share it on Our Shelf afterwards.</p>
          </motion.div>
        )}

        {phase.k === 'working' && (
          <motion.div key="working" className="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="processing__book" aria-hidden>
              <div className="processing__spine" />
              <div className="processing__page" />
              <div className="processing__page" />
              <div className="processing__page" />
            </div>
            <div className="processing__title" role="status">
              {phase.stage}
            </div>
            <div className="processing__file">{phase.name}</div>
          </motion.div>
        )}

        {phase.k === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <h2 className="sheet__title">
              <Icon name="sparkle" size={18} /> On the shelf
            </h2>
            <p className="sheet__lede">Here’s what we found. Change anything you like.</p>
            <BookForm book={phase.book} onDone={onClose} submitLabel="Place it on the shelf" />
          </motion.div>
        )}

        {phase.k === 'error' && (
          <motion.div key="error" className="add-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="sheet__title">That one didn’t fit on the shelf</h2>
            <p className="sheet__lede" role="alert">
              {phase.message}
            </p>
            <button className="btn btn--gold" onClick={() => setPhase({ k: 'pick' })}>
              Try another file
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
