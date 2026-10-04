import { motion } from 'framer-motion';
import { useState } from 'react';
import { Dust, ShelfWall } from '../components/Atmosphere';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { userName, type UserId } from '../lib/types';
import { useLibrary } from '../state/library';

/** Shown once per device per reader when cloud sync is on. */
export function SignIn({ user, onBack }: { user: UserId; onBack(): void }) {
  const { signIn } = useLibrary();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(navigator.onLine === false ? 'You’re offline. Connect to the internet to sign in the first time.' : (err as Error).message);
      setBusy(false);
    }
  };

  return (
    <motion.div className="welcome signin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
      <div className="welcome__wall">
        <ShelfWall rows={6} perRow={60} />
      </div>
      <div className="welcome__vignette" />
      <div className="welcome__lamp" />
      <Dust count={50} />

      <main className="welcome__center">
        <motion.form
          className="signin-card"
          onSubmit={submit}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Avatar user={user} mood={busy ? 'reading' : 'wave'} size={92} />
          <h1>Hello, {userName(user)}</h1>
          <p className="signin-card__lede">Sign in once on this device. Your books, bookmarks and place in every story will follow you wherever you read.</p>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && (
            <p className="signin-card__error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn--gold signin-card__submit" type="submit" disabled={busy}>
            {busy ? 'Opening your library…' : 'Sign in'}
          </button>
          <button type="button" className="link-btn signin-card__back" onClick={onBack}>
            <Icon name="back" size={15} /> Someone else is reading
          </button>
        </motion.form>
      </main>
    </motion.div>
  );
}
