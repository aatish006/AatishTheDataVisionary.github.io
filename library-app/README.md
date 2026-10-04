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
  state/library.tsx       React context: current reader, books, per-user state, prefs
  lib/
    types.ts              every persisted shape (Book, UserBookState, UserPrefs, …)
    db.ts                 tiny IndexedDB wrapper (no dependency)
    repository.ts         LibraryRepository interface + IndexedDB implementation  ← swap for a backend
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
  screens/                Welcome.tsx (who's reading tonight?), Library.tsx
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

## Adding real ebooks

Choose **+ Add Book** (or drag a file onto the library), then pick an `.epub` or `.pdf` (up to 150 MB). The app reads the title, author, description, subject and cover. PDFs also get a page count, and their first page becomes the cover. You can edit everything afterwards. The book lands on the current reader's shelf. Open it and turn on **Our Shelf** to share it.

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
| Storage (IndexedDB) | Solid, but **this device only**, behind a repository interface |
| Profiles (Aatish / Nishi picker) | **Prototype**: a profile selector, not authentication |
| Cross-device sync | **Not implemented**: needs the backend below |

### Recommended production setup

- **Auth.** Supabase Auth (or Firebase Auth) with magic-link or passkey sign-in, restricted to your two email addresses (an allow-list, with sign-ups disabled).
- **Data.** Postgres tables mirroring `types.ts` (`books`, `user_book_state`, `user_prefs`). Row-level security: `user_book_state.user_id = auth.uid()`, and books visible when `owner_id = auth.uid() OR shared`.
- **Files.** A **private** Storage bucket. The app downloads files with short-lived signed URLs and caches them in IndexedDB for offline reading.
- **Code.** Implement `LibraryRepository` against that backend and replace `repository` in `src/lib/repository.ts`. The UI doesn't change.
- **Hosting.** The GitHub Pages repo is public, so the app's code and the demo stories are public too. **Uploaded books never leave the browser** in this version. For a private deployment, host on Cloudflare Pages or Netlify behind their access controls (e.g. Cloudflare Access with your two emails).

## Browser limitations

- **Haptics.** Android browsers support the Vibration API and get a 7 ms tick. iOS Safari has no Vibration API. On iOS 17.4+ the app toggles a hidden native `<input switch>`, which produces the system haptic, but only for taps (not mid-drag) and only when system haptics are on. Elsewhere it does nothing, without errors. Toggle it under **Aa → Haptic feedback**.
- **Audio autoplay.** Browsers block sound until you interact with the page. Nothing ever autoplays. The audio engine starts on your first tap or key press, and your ambient choice and volume are remembered, but you press play each visit. On iPhone, the silent switch mutes Web Audio.
- **Local storage.** Data lives in this browser's IndexedDB on this device. Clearing site data, private browsing or Safari's storage policies can remove it, so the app asks the browser to keep it (`navigator.storage.persist()`). Different browsers on the same device don't share a library, and neither do different devices. That needs the backend above.
- **Fonts and layout.** EPUB styling is intentionally replaced by our typography. Fixed-layout EPUBs (comics, picture books) are better imported as PDF.

## Ideas for the next version

1. A real backend (above) so progress follows you from phone to laptop.
2. Highlights and margin notes, and optionally *see Nishi's highlight here*-style sharing on Our Shelf.
3. A "reading together" nudge: when both of you are in the same shared book, a small shared progress ribbon.
4. A yearly reading calendar or "memories" shelf with dates finished and favourite quotes.
5. Offline install as a PWA (service worker plus an app icon on the home screen).
6. Text-to-speech read-aloud with a bedtime timer.
7. Real recorded ambience and page sounds (see *Audio assets*).
