# Our Little Library

*A quiet place for our stories.* A private ebook library and reading room for Aatish and Nishi.

- **Source:** `library-app/` (React, TypeScript, Vite)
- **Built site:** `../docs/library/`. GitHub Pages publishes this repo from `/docs`, so it is served at `/library/`

## Run it

```bash
cd library-app
npm install
npm run dev        # http://localhost:5173 — hot reload
npm run build      # typecheck + production build into ../docs/library
npm run preview    # serve the production build locally
```

Commit the rebuilt `docs/library/` folder to publish it on GitHub Pages. It needs no server or environment variables.

## Architecture

```
src/
  App.tsx                 hash router:  #/  ·  #/nishi  ·  #/nishi/read/<bookId>
  state/library.tsx       React context: current reader, books, per-user state, prefs, sign-in, sync
  lib/
    types.ts              every persisted shape (Book, UserBookState, UserPrefs, …)
    db.ts                 tiny IndexedDB wrapper (no dependency)
    repository.ts         the local store (IndexedDB) — what the UI always reads from
    cloud/                cross-device sync: index.ts (sync engine), supabase.ts, mock.ts (tests only)
    importers/            format registry: epub.ts (JSZip + DOMParser), pdf.ts (pdf.js), sanitize.ts
    demoBooks.ts          six short original demo stories, clearly labelled "Demo"
    audio/                engine.ts (Web Audio buses), pageTurn.ts, ambient.ts (7 synthesised soundscapes)
    haptics.ts            Vibration API, plus the iOS switch-input haptic
  reader/
    Reader.tsx            the reading room: loading, position, chrome, panels, saving
    BookStage.tsx         page layout, gestures and the page-curl animation
    foldGeometry.ts       the curl maths (fold line, clipping, reflection)
    paginate.ts           CSS-column paginator, anchor lookup, in-book search
    PageView.tsx          text pages, PDF pages, endpapers
    layout.ts             spread vs single page, page sizing, typefaces
    ReaderPanels.tsx      contents / bookmarks / search, reading settings
    Overlays.tsx          book-opening animation, "Welcome back", "Book finished"
  screens/                Welcome.tsx (who's reading tonight?), SignIn.tsx, Library.tsx
  components/             Avatar, Cover, Shelf, BookDialogs, AmbientPanel, Atmosphere, Icon
  styles/                 base / welcome / library / reader CSS (design tokens in base.css)
```

### Key decisions

- **Rendering ebooks.** EPUBs are unzipped with JSZip and read with the browser's XML parser: package, spine, nav/NCX table of contents and cover. Chapters go through a whitelist sanitiser that removes scripts, event handlers, inline styles, iframes and similar. They are not shown in an iframe-based EPUB viewer, because the page curl needs real page surfaces we fully control. PDFs are rendered by Mozilla's pdf.js, one page at a time into an image, with a small cache. Both libraries load only when needed.
- **Pagination.** Each chapter is laid out once in a hidden box whose CSS columns are exactly one page wide, so the column count is the page count. Visible pages render the same HTML in an identical box shifted by N columns, so measurement and rendering cannot disagree. Very long chapters are split at block boundaries to keep layout cheap.
- **Reading position.** Saved as `{ section, fraction }`, not as a page number. It survives font, margin and screen changes: change the text size and you stay on the same paragraph.
- **Page curl.** `foldGeometry.ts` models a real fold. The free corner is dragged to point P, and the paper folds along the perpendicular bisector. The flat part is clipped with `clip-path`. The reverse side is placed with one CSS matrix (a reflection) and clipped. Gradients add the crease highlight and the shadow cast on the page underneath. It is applied per frame without React renders. Every page is a keyed child of one container, so a page moving from "right page" to "turning leaf" keeps its DOM. Neighbouring pages are pre-mounted, so a turn starts instantly. Drag the page with a finger or mouse, or tap, click, or use the arrow keys or space. With "reduce motion" on, turns become a soft fade.
- **Spread vs single.** Laptops and landscape tablets get an open two-page spread with a spine, page stacks that grow as you read, and endpapers (an *Ex Libris* bookplate). Phones get a full-bleed single page. Portrait tablets get one large page.
- **Data separation.** Reading state is keyed `userId:bookId`, and the repository refuses a write whose key doesn't match its owner. Books have an `ownerId`. Shared books appear on *Our Shelf* for both readers, but each keeps their own progress, bookmarks and favourites.

- **Sync.** See *Cloud sync* below.

## Cloud sync (your library on every device)

With cloud sync on, every book you upload, and every reader's progress, bookmarks, shelves and reading settings, follows you to any phone, tablet or laptop you sign in on.

**How it works.** Each device keeps a full local copy, so the library opens instantly and works offline. Every change is stamped with the time it was made. The app syncs with the cloud when it opens, when you come back to it, when you go back online, every minute while open, and a moment after each change (page turns included). The newest change wins. Book files are uploaded once to a private bucket. Another device downloads a file the first time you open that book, then keeps it.

**Privacy.** Each person signs in with their own email and password. Database row-level security means each account can only read and write its own progress and preferences. Books are visible to their owner, plus to both of you when they're on *Our Shelf*. Files sit in a private bucket that follows the same rules. The anon key in `config.json` is designed to be public: it grants nothing beyond these rules.

### One-time setup (about 10 minutes, free)

1. Create a free account at [supabase.com](https://supabase.com), then **New project**. Pick any name and password and the region nearest you.
2. **SQL Editor → New query**: paste all of [`supabase/setup.sql`](supabase/setup.sql) and click **Run**. This creates the tables, rules and private file bucket.
3. **Authentication → Sign In / Providers**: keep **Email** on, turn **Allow new users to sign up** *off*, and turn **Confirm email** off.
4. **Authentication → Users → Add user → Create new user**: add one user for Aatish and one for Nishi, each with an email and password. Tick *Auto confirm user*.
5. **Project Settings → API** (or **Data API**): copy the **Project URL** and the **anon / publishable** key into `library-app/public/config.json`:
   ```json
   { "supabaseUrl": "https://xxxx.supabase.co", "supabaseAnonKey": "eyJ…" }
   ```
   Run `npm run build` and push. Alternatively, edit `docs/library/config.json` directly on GitHub; no rebuild is needed.
6. Open the site, tap your name and sign in. The first sign-in links that account to that profile. Books already on a device are uploaded automatically the first time you sign in there.

Leave `config.json` empty and the app works exactly as before: no sign-in, this device only.

**Limits (free plan).** 50 MB per book file and 1 GB of storage in total, which is plenty for EPUBs (typically 0.5–5 MB). Free projects pause after a week with no activity. Reading every week or two keeps it awake, or you can restore it with one click in the dashboard.

## Adding real ebooks

Choose **+ Add Book** (or drag a file onto the library), then pick an `.epub` or `.pdf` (up to 150 MB on one device, 50 MB with cloud sync). The app reads the title, author, description, subject and cover. PDFs also get a page count, and their first page becomes the cover. You can edit everything afterwards. The book lands on the current reader's shelf. Open it and turn on **Our Shelf** to share it.

To add another format (`.txt`, `.fb2`, `.cbz`, …), write a `BookImporter` in `src/lib/importers/` that returns a `FlowDocument` (reflowable) or a `FixedDocument` (pages). Register it in `importers/index.ts` and add it to `BookFormat` in `types.ts`. Nothing else needs to change.

DRM-protected files (Kindle, Apple Books, Adobe DRM) cannot be opened. That is a format limitation, not a bug.

## Audio assets

Everything works without audio files: the page-turn sound and all seven soundscapes (rain, fireplace, café, forest, ocean, night, library) are synthesised live with the Web Audio API. To use real recordings instead:

```
library-app/public/audio/
  manifest.json            ← list your files here
  page-turn/               ← 3–6 short page-turn recordings (mp3/m4a/ogg)
  ambient/                 ← seamless loops, e.g. rain.mp3
```

```json
{
  "pageTurn": ["page-turn/page-turn-1.mp3", "page-turn/page-turn-2.mp3"],
  "ambient": { "rain": "ambient/rain.mp3", "fireplace": null }
}
```

`null` (or an empty list) keeps the synthesised sound. One page-turn sample is picked at random each time, with slight pitch and volume variation. Ambient loops crossfade when you switch. Freesound.org (CC0) is a good source. Check each file's licence.

## Prototype-only vs production-ready

| Area | Status |
| --- | --- |
| Reader, pagination, page curl, themes, typography, bookmarks, progress, search, TOC | Production quality |
| EPUB and PDF import, sanitisation, error handling | Production quality (DRM-free files) |
| Storage | Local IndexedDB copy on every device, synced through Supabase when configured |
| Sign-in | Supabase email + password with row-level security, once `config.json` is filled in. Without it, the Aatish / Nishi picker is a profile selector, not authentication |
| Cross-device sync | Newest-change-wins per book, per reading state and per preferences record. Fine for two readers; not a real-time collaborative merge |

**Hosting.** The GitHub Pages repo is public, so the app's code and the demo stories are public too. Uploaded books are not: they live only in the browser, or in your private Supabase bucket.

## Browser limitations

- **Haptics.** Android browsers support the Vibration API and get a 7 ms tick. iOS Safari has no Vibration API. On iOS 17.4+ the app toggles a hidden native `<input switch>`, which produces the system haptic, but only for taps (not mid-drag) and only when system haptics are on. Elsewhere it does nothing, without errors. Toggle it under **Aa → Haptic feedback**.
- **Audio autoplay.** Browsers block sound until you interact with the page. Nothing ever autoplays. The audio engine starts on your first tap or key press, and your ambient choice and volume are remembered, but you press play each visit. On iPhone, the silent switch mutes Web Audio.
- **Local storage.** Data lives in this browser's IndexedDB on this device. Clearing site data, private browsing or Safari's storage policies can remove it, so the app asks the browser to keep it (`navigator.storage.persist()`). Without cloud sync, different browsers and devices don't share a library. With it, the cloud copy is the safety net.
- **Fonts and layout.** EPUB styling is intentionally replaced by our typography. Fixed-layout EPUBs (comics, picture books) are better imported as PDF.

## Ideas for the next version

1. Live updates while both devices are open (Supabase Realtime) instead of a once-a-minute sync.
2. Highlights and margin notes, and optionally *see Nishi's highlight here*-style sharing on Our Shelf.
3. A "reading together" nudge: when both of you are in the same shared book, a small shared progress ribbon.
4. A yearly reading calendar or "memories" shelf with dates finished and favourite quotes.
5. Offline install as a PWA (service worker plus an app icon on the home screen).
6. Text-to-speech read-aloud with a bedtime timer.
7. Real recorded ambience and page sounds (see *Audio assets*).
