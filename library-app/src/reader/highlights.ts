// Highlight plumbing: text offsets ↔ DOM positions, painting marks into
// section HTML, and locating a highlight's page.
//
// Offsets count characters across the section's text nodes in document order.
// Wrapping text in <mark> doesn't change that order, so offsets stay valid
// however many highlights are painted, and on every device.

import type { FlowDocument } from '../lib/importers/types';
import type { Highlight, PartnerHighlight } from '../lib/types';
import { setupFlow, type PageLayout } from './paginate';

export interface Paint {
  id: string;
  start: number;
  end: number;
  className: string;
}

function textNodes(root: Node): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

/** Character offset of a DOM point within `root`'s text. */
export function offsetOf(root: Element, node: Node, offset: number): number | null {
  if (!root.contains(node)) return null;
  // A caret inside an element: move it to the start of the child it points at.
  if (node.nodeType !== Node.TEXT_NODE) {
    const child = node.childNodes[offset];
    if (child) {
      const first = textNodes(child)[0];
      if (first) return offsetOf(root, first, 0);
    }
    const all = textNodes(node);
    const last = all[all.length - 1];
    return last ? offsetOf(root, last, last.length) : null;
  }
  let total = 0;
  for (const t of textNodes(root)) {
    if (t === node) return total + offset;
    total += t.length;
  }
  return null;
}

/** A Range covering [start, end) of `root`'s text. */
export function rangeFor(root: Element, start: number, end: number): Range | null {
  const range = document.createRange();
  let total = 0;
  let startSet = false;
  for (const t of textNodes(root)) {
    const len = t.length;
    if (!startSet && start <= total + len) {
      range.setStart(t, Math.max(0, start - total));
      startSet = true;
    }
    if (startSet && end <= total + len) {
      range.setEnd(t, Math.max(0, end - total));
      return range;
    }
    total += len;
  }
  return startSet ? range : null;
}

/** Wrap each painted range in <mark> elements. The template element keeps it inert. */
export function paintHtml(html: string, paints: Paint[]): string {
  if (!paints.length) return html;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const root = tpl.content;
  for (const p of [...paints].sort((a, b) => a.start - b.start)) {
    let total = 0;
    for (const t of textNodes(root)) {
      const len = t.length;
      const s = Math.max(p.start, total);
      const e = Math.min(p.end, total + len);
      if (e > s && t.data.slice(s - total, e - total).trim()) {
        let target = t;
        if (s > total) target = target.splitText(s - total);
        if (e < total + len) target.splitText(e - s);
        const mark = document.createElement('mark');
        mark.className = p.className;
        mark.dataset.hl = p.id;
        target.parentNode!.insertBefore(mark, target);
        mark.appendChild(target);
      }
      total += len;
      if (total >= p.end) break;
    }
  }
  return tpl.innerHTML;
}

const WORD = /[\p{L}\p{N}'’\-]/u;

/** Expand a character range outwards to whole words. */
export function snapToWords(text: string, a: number, b: number): [number, number] {
  let s = Math.min(a, b);
  let e = Math.max(a, b);
  while (s > 0 && WORD.test(text[s - 1])) s--;
  while (e < text.length && WORD.test(text[e])) e++;
  // trim stray whitespace at the ends
  while (s < e && /\s/.test(text[s])) s++;
  while (e > s && /\s/.test(text[e - 1])) e--;
  return [s, e];
}

/** The caret (node + offset) under a screen point, across browsers. */
export function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y);
    if (p) return { node: p.offsetNode, offset: p.offset };
  }
  if (d.caretRangeFromPoint) {
    const r = d.caretRangeFromPoint(x, y);
    if (r) return { node: r.startContainer, offset: r.startOffset };
  }
  return null;
}

/** Screen rectangles for a highlight on the visible pages, clipped to each page's text area. */
export function screenRects(container: Element, section: number, start: number, end: number): DOMRect[] {
  const rects: DOMRect[] = [];
  container.querySelectorAll<HTMLElement>(`.slot:not(.slot--hidden) .flow[data-section="${section}"]`).forEach((flow) => {
    const body = flow.parentElement!.getBoundingClientRect();
    const range = rangeFor(flow, start, end);
    if (!range) return;
    for (const r of Array.from(range.getClientRects())) {
      if (r.width < 1 || r.right <= body.left + 1 || r.left >= body.right - 1 || r.bottom <= body.top || r.top >= body.bottom) continue;
      rects.push(r);
    }
  });
  return rects;
}

/** Page (within its section) where character `offset` falls. */
export async function locateOffset(doc: FlowDocument, section: number, offset: number, l: PageLayout, host: HTMLElement) {
  const flow = host.querySelector<HTMLElement>('.flow')!;
  setupFlow(flow, l);
  flow.innerHTML = doc.sections[section].html;
  const range = rangeFor(flow, offset, offset + 1);
  const rect = range?.getClientRects()[0] ?? range?.getBoundingClientRect();
  const page = rect ? Math.max(0, Math.floor((rect.left - flow.getBoundingClientRect().left + 1) / (l.cw + l.gap))) : 0;
  flow.innerHTML = '';
  return page;
}

export function paintsFor(section: number, mine: Highlight[], partner: PartnerHighlight[]): Paint[] {
  return [
    ...partner.filter((h) => h.section === section).map((h) => ({ id: h.id, start: h.start, end: h.end, className: `hl hl--partner hl--${h.color}` })),
    ...mine.filter((h) => h.section === section).map((h) => ({ id: h.id, start: h.start, end: h.end, className: `hl hl--${h.color}${h.note ? ' hl--note' : ''}` })),
  ];
}
