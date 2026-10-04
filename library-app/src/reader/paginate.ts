// Paginates reflowable sections with CSS multi-column layout.
//
// A section is laid out once in a hidden element whose columns are exactly one
// page wide; the number of columns is its page count. Each visible page later
// renders the same section HTML in an identical box, shifted by N columns —
// so measurement and rendering can never disagree.

import type { FlowDocument } from '../lib/importers/types';

export interface PageLayout {
  W: number;
  H: number;
  padT: number;
  padB: number;
  padL: number;
  padR: number;
  cw: number;
  ch: number;
  gap: number;
}

export interface Pagination {
  /** pages per section */
  pages: number[];
  /** first global page of each section */
  starts: number[];
  total: number;
}

export const layoutKey = (l: PageLayout, typo: string) => `${l.cw}x${l.ch}|${typo}`;

const cache = new Map<string, Pagination>();

function waitImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll('img'));
  return Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            const done = () => res();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
            setTimeout(done, 2000);
          }),
    ),
  );
}

export function setupFlow(flow: HTMLElement, l: PageLayout) {
  flow.style.width = `${l.cw}px`;
  flow.style.height = `${l.ch}px`;
  flow.style.columnWidth = `${l.cw}px`;
  flow.style.columnGap = `${l.gap}px`;
  flow.style.setProperty('--content-h', `${l.ch}px`);
}

function columnOf(flow: HTMLElement, x: number, l: PageLayout) {
  return Math.max(0, Math.floor((x - flow.getBoundingClientRect().left + 1) / (l.cw + l.gap)));
}

async function measureSection(flow: HTMLElement, html: string, l: PageLayout): Promise<number> {
  flow.innerHTML = html + '<div class="flow-end"></div>';
  await waitImages(flow);
  const end = flow.lastElementChild as HTMLElement;
  return columnOf(flow, end.getBoundingClientRect().left, l) + 1;
}

export async function paginate(
  doc: FlowDocument,
  cacheId: string,
  l: PageLayout,
  typoKey: string,
  host: HTMLElement,
  isCancelled: () => boolean,
  onProgress?: (f: number) => void,
): Promise<Pagination | null> {
  const key = `${cacheId}|${layoutKey(l, typoKey)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const flow = host.querySelector<HTMLElement>('.flow')!;
  setupFlow(flow, l);
  const pages: number[] = [];
  let last = performance.now();
  for (let i = 0; i < doc.sections.length; i++) {
    if (isCancelled()) return null;
    pages.push(await measureSection(flow, doc.sections[i].html, l));
    if (performance.now() - last > 30) {
      onProgress?.((i + 1) / doc.sections.length);
      await new Promise((r) => setTimeout(r, 0));
      last = performance.now();
    }
  }
  flow.innerHTML = '';
  const starts: number[] = [];
  let total = 0;
  for (const p of pages) {
    starts.push(total);
    total += p;
  }
  const result = { pages, starts, total };
  cache.set(key, result);
  return result;
}

/** Page (within its section) where an element id appears. */
export async function locateAnchor(doc: FlowDocument, section: number, anchor: string, l: PageLayout, host: HTMLElement) {
  const flow = host.querySelector<HTMLElement>('.flow')!;
  setupFlow(flow, l);
  flow.innerHTML = doc.sections[section].html;
  await waitImages(flow);
  const el = flow.querySelector(`[id="${CSS.escape(anchor)}"]`);
  const page = el ? columnOf(flow, el.getBoundingClientRect().left, l) : 0;
  flow.innerHTML = '';
  return page;
}

/** Page (within its section) of the n-th case-insensitive match of `query`. */
export async function locateText(doc: FlowDocument, section: number, query: string, occurrence: number, l: PageLayout, host: HTMLElement) {
  const flow = host.querySelector<HTMLElement>('.flow')!;
  setupFlow(flow, l);
  flow.innerHTML = doc.sections[section].html;
  await waitImages(flow);
  const q = query.toLowerCase();
  const walker = document.createTreeWalker(flow, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let page = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = (n.textContent ?? '').toLowerCase();
    let idx = text.indexOf(q);
    while (idx !== -1) {
      if (seen === occurrence) {
        const range = document.createRange();
        range.setStart(n, idx);
        range.setEnd(n, Math.min(text.length, idx + q.length));
        const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
        page = columnOf(flow, rect.left, l);
        flow.innerHTML = '';
        return page;
      }
      seen++;
      idx = text.indexOf(q, idx + 1);
    }
  }
  flow.innerHTML = '';
  return page;
}

export interface SearchHit {
  section: number;
  occurrence: number;
  before: string;
  match: string;
  after: string;
}

const textCache = new WeakMap<FlowDocument, string[]>();

export function searchFlow(doc: FlowDocument, query: string, limit = 60): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  let texts = textCache.get(doc);
  if (!texts) {
    // DOMParser documents are inert: no image loads, no layout.
    const parser = new DOMParser();
    texts = doc.sections.map((s) => parser.parseFromString(s.html, 'text/html').body.textContent ?? '');
    textCache.set(doc, texts);
  }
  const hits: SearchHit[] = [];
  texts.forEach((t, section) => {
    const lower = t.toLowerCase();
    let idx = lower.indexOf(q);
    let occurrence = 0;
    while (idx !== -1 && hits.length < limit) {
      hits.push({
        section,
        occurrence,
        before: t.slice(Math.max(0, idx - 48), idx).replace(/\s+/g, ' '),
        match: t.slice(idx, idx + q.length),
        after: t.slice(idx + q.length, idx + q.length + 64).replace(/\s+/g, ' '),
      });
      occurrence++;
      idx = lower.indexOf(q, idx + 1);
    }
  });
  return hits;
}
