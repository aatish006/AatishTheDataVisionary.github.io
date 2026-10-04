import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Reader } from './reader/Reader';
import { Library } from './screens/Library';
import { SignIn } from './screens/SignIn';
import { Welcome } from './screens/Welcome';
import { LibraryProvider, useLibrary } from './state/library';
import { USERS, type UserId } from './lib/types';

// Tiny hash router:  #/  ·  #/nishi  ·  #/nishi/read/<bookId>
// Hash routing works on static hosting (GitHub Pages) and keeps the browser back button meaningful.
interface Route {
  user: UserId | null;
  bookId: string | null;
}

function parse(): Route {
  const [, u, verb, id] = window.location.hash.replace(/^#\/?/, '/').split('/');
  const user = USERS.some((x) => x.id === u) ? (u as UserId) : null;
  return { user, bookId: user && verb === 'read' && id ? decodeURIComponent(id) : null };
}

const go = (path: string) => {
  window.location.hash = path;
};

export function App() {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return (
    <LibraryProvider user={route.user}>
      <Screens route={route} />
    </LibraryProvider>
  );
}

function Screens({ route }: { route: Route }) {
  const { ready, userReady, error, authNeeded } = useLibrary();
  const scrollY = useRef(0);

  // Return to the same spot on the shelf after closing a book.
  useLayoutEffect(() => {
    if (route.user && !route.bookId) window.scrollTo(0, scrollY.current);
  }, [route.user, route.bookId]);

  const openBook = useCallback(
    (id: string) => {
      scrollY.current = window.scrollY;
      go(`/${route.user}/read/${encodeURIComponent(id)}`);
    },
    [route.user],
  );
  const closeBook = useCallback(() => {
    if (window.history.length > 1 && window.location.hash.includes('/read/')) window.history.back();
    else go(`/${route.user}`);
  }, [route.user]);

  if (error) {
    return (
      <div className="fatal">
        <h1>Our Little Library</h1>
        <p>The library couldn’t open its shelves in this browser.</p>
        <p className="fatal__detail">{error}</p>
        <p>Private/incognito windows sometimes block storage — try a normal window.</p>
      </div>
    );
  }
  if (!ready) return <div className="boot" aria-label="Opening the library" />;
  const waiting = !!route.user && !userReady && !authNeeded;

  const key = route.bookId ? `read:${route.bookId}` : route.user ? `lib:${route.user}` : 'welcome';
  return (
    <AnimatePresence mode="wait">
      {waiting ? null : route.user && authNeeded ? (
        <SignIn key={`signin:${route.user}`} user={route.user} onBack={() => go('/')} />
      ) : !route.user ? (
        <Welcome key={key} onChoose={(u) => go(`/${u}`)} />
      ) : route.bookId ? (
        <Reader key={key} bookId={route.bookId} onExit={closeBook} />
      ) : (
        <Library key={key} user={route.user} onRead={openBook} onSwitch={() => go('/')} />
      )}
    </AnimatePresence>
  );
}
