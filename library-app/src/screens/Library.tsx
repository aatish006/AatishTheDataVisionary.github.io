import { AnimatePresence, motion, PresenceContext } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AmbientControl } from '../components/AmbientPanel';
import { Dust } from '../components/Atmosphere';
import { Avatar } from '../components/Avatar';
import { AddBook, BookDetail, EditBook } from '../components/BookDialogs';
import { Cover } from '../components/Cover';
import { Icon } from '../components/Icon';
import { Bookshelf, ShelfBook } from '../components/Shelf';
import { setOpeningOrigin } from '../reader/Overlays';
import { partnerOf, userName, type Book, type UserId } from '../lib/types';
import { useLibrary } from '../state/library';

type Filter = 'all' | 'reading' | 'want' | 'finished' | 'favourites' | 'bookmarked' | 'recent';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All books' },
  { id: 'reading', label: 'Reading' },
  { id: 'want', label: 'Want to read' },
  { id: 'finished', label: 'Finished' },
  { id: 'favourites', label: 'Favourites' },
  { id: 'bookmarked', label: 'Bookmarked' },
  { id: 'recent', label: 'Recently added' },
];

function syncLabel(s: { state: string; lastSynced?: number }) {
  switch (s.state) {
    case 'syncing':
      return 'Syncing…';
    case 'synced': {
      const mins = s.lastSynced ? Math.floor((Date.now() - s.lastSynced) / 60000) : 0;
      return mins < 1 ? 'In sync on all your devices' : `Synced ${mins} min ago`;
    }
    case 'offline':
      return 'Offline — will sync when you’re back online';
    case 'error':
      return 'Couldn’t reach the cloud — will retry';
    default:
      return 'Connecting…';
  }
}

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Still awake';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Good night';
}

function moodLine(d = new Date()) {
  const h = d.getHours();
  const day = d.toLocaleDateString(undefined, { weekday: 'long' });
  if (h < 5) return `${day}, the quiet hours. One more chapter?`;
  if (h < 12) return `${day} morning — tea, and a few pages.`;
  if (h < 17) return `${day} afternoon — a good time to wander off somewhere.`;
  if (h < 22) return `${day} evening — the lamps are on.`;
  return `${day} night — a perfect night for a chapter.`;
}

export function Library({ user, onRead, onSwitch }: { user: UserId; onRead(id: string): void; onSwitch(): void }) {
  const lib = useLibrary();
  const { books, states, prefs } = lib;
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [detail, setDetail] = useState<Book | null>(null);
  const [editing, setEditing] = useState<Book | null>(null);
  const [adding, setAdding] = useState<{ file: File | null } | null>(null);
  const [menu, setMenu] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [avatarMood, setAvatarMood] = useState<'wave' | 'idle'>('wave');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setAvatarMood('idle'), 2200);
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(id);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const stateOf = (id: string) => states[id];
  const mine = useMemo(() => books.filter((b) => b.ownerId === user || (b.shared && states[b.id] && states[b.id].status !== 'none')), [books, user, states]);
  const ourShelf = useMemo(() => books.filter((b) => b.shared).sort((a, b) => b.addedAt - a.addedAt), [books]);

  const current = useMemo(() => {
    return books
      .filter((b) => {
        const s = states[b.id];
        return s && s.status === 'reading' && s.progress < 1;
      })
      .sort((a, b) => (states[b.id]?.lastOpenedAt ?? 0) - (states[a.id]?.lastOpenedAt ?? 0));
  }, [books, states]);
  const hero = current[0];

  const shelfBooks = useMemo(() => {
    const byRecent = [...mine].sort((a, b) => b.addedAt - a.addedAt);
    switch (filter) {
      case 'reading':
        return current;
      case 'want':
        return byRecent.filter((b) => stateOf(b.id)?.status === 'want');
      case 'finished':
        return byRecent.filter((b) => stateOf(b.id)?.status === 'finished').sort((a, b) => (stateOf(b.id)?.finishedAt ?? 0) - (stateOf(a.id)?.finishedAt ?? 0));
      case 'favourites':
        return byRecent.filter((b) => stateOf(b.id)?.favourite);
      case 'bookmarked':
        return byRecent.filter((b) => (stateOf(b.id)?.bookmarks.length ?? 0) > 0);
      case 'recent':
        return byRecent.slice(0, 12);
      default:
        return byRecent;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, filter, states, current]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return books.filter((b) => [b.title, b.author, b.category ?? ''].some((f) => f.toLowerCase().includes(q)));
  }, [books, query]);

  const read = useCallback(
    (b: Book, el?: HTMLElement | null) => {
      setOpeningOrigin(el?.getBoundingClientRect() ?? null);
      onRead(b.id);
    },
    [onRead],
  );
  const open = useCallback((b: Book) => setDetail(b), []);
  const readFromShelf = useCallback((b: Book, el: HTMLElement) => read(b, el), [read]);

  const renderBooks = (list: Book[], seed = 0) =>
    list.map((b, i) => (
      <ShelfBook
        key={b.id}
        book={b}
        state={states[b.id]}
        viewer={user}
        isNew={b.id === lib.lastAddedId}
        onOpen={open}
        onRead={readFromShelf}
        tilt={((i * 7 + seed) % 5 === 0 ? -1.2 : 0)}
      />
    ));

  const heroState = hero ? states[hero.id] : undefined;
  const partner = partnerOf(user);
  const emptyLibrary = mine.length === 0;

  return (
    <motion.div
      className="library"
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) setAdding({ file: f });
      }}
    >
      {/* Only this screen's root takes part in the route transition; inner motion stays independent. */}
      <PresenceContext.Provider value={null}>
      <div className="library__room" aria-hidden>
        <div className="library__lamp" />
        <Dust count={28} className="library__dust" />
      </div>

      <header className={`topbar${scrolled ? ' is-scrolled' : ''}`}>
        <div className="topbar__brand">
          <svg width="30" height="21" viewBox="0 0 44 30" aria-hidden>
            <path d="M2 4c7-3 13-2 20 2v22c-7-4-13-5-20-2z" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M42 4c-7-3-13-2-20 2v22c7-4 13-5 20-2z" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M28 6v11l2.5-2 2.5 2V5" fill="var(--burgundy)" />
          </svg>
          <span>Our Little Library</span>
        </div>
        <div className="topbar__actions">
          <div className={`search${searchOpen || query ? ' is-open' : ''}`}>
            <button className="icon-btn" onClick={() => setSearchOpen((o) => !o)} aria-label="Search the library">
              <Icon name="search" />
            </button>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => !query && setSearchOpen(false)}
              onKeyDown={(e) => e.key === 'Escape' && (setQuery(''), setSearchOpen(false))}
              placeholder="Title, author or category"
              aria-label="Search title, author or category"
            />
            {query && (
              <button className="icon-btn icon-btn--small" onClick={() => setQuery('')} aria-label="Clear search">
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
          <button className="btn btn--add" onClick={() => setAdding({ file: null })}>
            <Icon name="plus" size={18} />
            <span>Add Book</span>
          </button>
          {lib.cloudMode !== 'local' && (
            <button className={`sync-dot sync-dot--${lib.syncStatus.state}`} onClick={() => void lib.syncNow()} title={syncLabel(lib.syncStatus)} aria-label={`${syncLabel(lib.syncStatus)}. Sync now`}>
              <Icon name="cloud" size={19} />
            </button>
          )}
          <div className="profile">
            <button className="profile__btn" onClick={() => setMenu((m) => !m)} aria-label={`${userName(user)} — profile menu`} aria-expanded={menu}>
              <Avatar user={user} size={40} mood={avatarMood} />
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div
                  className="menu"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  onMouseLeave={() => setMenu(false)}
                >
                  <div className="menu__who">
                    <Avatar user={user} size={44} />
                    <div>
                      <strong>{userName(user)}</strong>
                      <small>{mine.length} {mine.length === 1 ? 'book' : 'books'} · {Object.values(states).filter((s) => s.status === 'finished').length} finished</small>
                    </div>
                  </div>
                  <button onClick={onSwitch}>
                    <Avatar user={partner} size={22} /> Switch to {userName(partner)}
                  </button>
                  <button onClick={() => lib.updatePrefs({ showDemo: !prefs.showDemo })}>
                    <Icon name="sparkle" size={16} /> {prefs.showDemo ? 'Hide demo books' : 'Show demo books'}
                  </button>
                  {lib.cloudMode !== 'local' && (
                    <button
                      onClick={async () => {
                        await lib.signOut();
                        onSwitch();
                      }}
                    >
                      <Icon name="logout" size={16} /> Sign out on this device
                    </button>
                  )}
                  <div className="menu__note">
                    {lib.cloudMode !== 'local' ? (
                      <>
                        <Icon name="cloud" size={14} /> {syncLabel(lib.syncStatus)}. Your books and progress follow you to every device.
                      </>
                    ) : (
                      <>
                        <Icon name="lock" size={14} /> Books and progress are stored privately in this browser.
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="library__main">
        {results ? (
          <section className="section">
            <div className="section__head">
              <h2>
                {results.length ? `Found ${results.length} ${results.length === 1 ? 'book' : 'books'}` : 'Nothing on the shelves by that name'}
              </h2>
              <p className="section__sub">for “{query}”</p>
            </div>
            {results.length > 0 && <Bookshelf>{renderBooks(results)}</Bookshelf>}
          </section>
        ) : (
          <>
            <section className="greet">
              <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.7 }}>
                {greeting()}, {userName(user)} <span className="greet__emoji" aria-hidden>📚</span>
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.8 }}>
                {moodLine()}
              </motion.p>
            </section>

            {hero && heroState ? (
              <motion.section className="hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}>
                <div className="hero__label">Continue your story</div>
                <div className="hero__inner">
                  <button className="hero__book" onClick={(e) => read(hero, e.currentTarget.querySelector('.book3d') as HTMLElement)} aria-label={`Continue reading ${hero.title}`}>
                    <div className="book3d book3d--hero">
                      <Cover book={hero} />
                    </div>
                  </button>
                  <div className="hero__text">
                    {hero.isDemo && <span className="tag tag--demo">Demo</span>}
                    <h2>{hero.title}</h2>
                    <div className="hero__author">{hero.author}</div>
                    <div className="hero__where">{heroState.positionLabel ?? 'Where you left off'}</div>
                    <div className="hero__progress">
                      <div className="progress progress--lg">
                        <motion.span initial={{ width: 0 }} animate={{ width: `${heroState.progress * 100}%` }} transition={{ delay: 0.6, duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }} />
                      </div>
                      <span>{Math.round(heroState.progress * 100)}% complete</span>
                    </div>
                    <div className="hero__actions">
                      <button className="btn btn--gold" onClick={(e) => read(hero, (e.currentTarget.closest('.hero__inner') as HTMLElement)?.querySelector('.book3d') as HTMLElement)}>
                        Continue reading
                      </button>
                      <button className="btn btn--quiet" onClick={() => open(hero)}>
                        Details
                      </button>
                    </div>
                  </div>
                </div>
                {current.length > 1 && (
                  <div className="hero__also">
                    <span>Also reading</span>
                    {current.slice(1, 4).map((b) => (
                      <button key={b.id} className="mini" onClick={(e) => read(b, e.currentTarget.querySelector('.mini__cover') as HTMLElement)}>
                        <span className="mini__cover">
                          <Cover book={b} />
                        </span>
                        <span className="mini__text">
                          <strong>{b.title}</strong>
                          <small>{Math.round((states[b.id]?.progress ?? 0) * 100)}%</small>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.section>
            ) : (
              !emptyLibrary && (
                <section className="hero hero--quiet">
                  <div className="hero__label">Nothing open right now</div>
                  <p>Pick something from your shelf — the first page is always the best part.</p>
                </section>
              )
            )}

            <section className="section">
              <div className="section__head">
                <h2>Your Library</h2>
                <div className="chips" role="tablist" aria-label="Filter your library">
                  {FILTERS.map((f) => (
                    <button key={f.id} role="tab" aria-selected={filter === f.id} className={`chip${filter === f.id ? ' is-on' : ''}`} onClick={() => setFilter(f.id)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              {emptyLibrary ? (
                <div className="empty">
                  <Bookshelf decorate minRows={1} seed={1}>
                    {[]}
                  </Bookshelf>
                  <div className="empty__pair" aria-hidden>
                    <Avatar user="aatish" size={70} mood="reading" />
                    <Avatar user="nishi" size={70} mood="reading" />
                  </div>
                  <h3>Your little library is waiting.</h3>
                  <button className="btn btn--gold" onClick={() => setAdding({ file: null })}>
                    <Icon name="plus" size={18} /> Add your first book
                  </button>
                </div>
              ) : shelfBooks.length ? (
                <Bookshelf seed={filter.length}>{renderBooks(shelfBooks)}</Bookshelf>
              ) : (
                <div className="shelf-empty">
                  <Bookshelf decorate minRows={1} seed={2}>
                    {[]}
                  </Bookshelf>
                  <p>
                    {
                      {
                        reading: 'Nothing open at the moment.',
                        want: 'No books waiting yet. Add one, or mark a book as “Want to read”.',
                        finished: 'No finished books yet — every story starts with page one.',
                        favourites: 'Tap the heart on a book you love.',
                        bookmarked: 'Ribbons you place inside books will gather here.',
                        recent: 'Nothing new lately.',
                        all: '',
                      }[filter]
                    }
                  </p>
                </div>
              )}
            </section>

            <section className="section section--ours">
              <div className="section__head">
                <h2>
                  Our Shelf <span className="heart" aria-hidden>❤</span>
                </h2>
                <p className="section__sub">Stories we’re sharing.</p>
              </div>
              {ourShelf.length ? (
                <Bookshelf seed={3}>{renderBooks(ourShelf, 2)}</Bookshelf>
              ) : (
                <div className="shelf-empty">
                  <Bookshelf decorate minRows={1} seed={0}>
                    {[]}
                  </Bookshelf>
                  <p>Open any of your books and turn on “Our Shelf” to share it with {userName(partner)}.</p>
                </div>
              )}
            </section>
          </>
        )}
        <footer className="library__foot">
          <span>Made for Aatish &amp; Nishi</span>
          <span aria-hidden>·</span>
          <span>{lib.cloudMode !== 'local' ? 'Private · synced across your devices' : 'Everything stays on this device'}</span>
        </footer>
      </main>

      <AmbientControl placement="floating" />

      <AnimatePresence>
        {dragOver && (
          <motion.div className="dropveil" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div>
              <Icon name="upload" size={34} />
              <p>Drop to add it to {userName(user)}’s shelf</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detail && (
          <BookDetail
            key="detail"
            book={books.find((b) => b.id === detail.id) ?? detail}
            onClose={() => setDetail(null)}
            onRead={(b) => {
              setDetail(null);
              read(b, null);
            }}
            onEdit={(b) => {
              setDetail(null);
              setEditing(b);
            }}
          />
        )}
        {editing && <EditBook key="edit" book={editing} onClose={() => setEditing(null)} />}
        {adding && <AddBook key="add" user={user} initialFile={adding.file} onClose={() => setAdding(null)} />}
      </AnimatePresence>
      </PresenceContext.Provider>
    </motion.div>
  );
}
