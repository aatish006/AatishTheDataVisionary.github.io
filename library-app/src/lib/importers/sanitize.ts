// Whitelist sanitiser for ebook HTML.
// EPUB chapters are arbitrary XHTML from the internet: we keep structure and
// meaning, drop scripts, event handlers, styles and anything active, then let
// our own typography take over so every book feels at home on our paper.

const KEEP = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'em', 'i', 'b', 'strong', 'u', 's', 'small', 'sup', 'sub',
  'blockquote', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'br', 'hr', 'img', 'a', 'span', 'div', 'section',
  'article', 'aside', 'header', 'footer', 'figure', 'figcaption', 'pre', 'code', 'table', 'thead', 'tbody',
  'tfoot', 'tr', 'td', 'th', 'caption', 'abbr', 'cite', 'q', 'mark', 'center',
]);

/** Elements whose contents are dropped entirely. */
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'form', 'input', 'button', 'select', 'textarea', 'video', 'audio', 'canvas', 'link', 'meta', 'title', 'head', 'math']);

const BLOCK_REMAP: Record<string, string> = { center: 'div', article: 'section', header: 'div', footer: 'div', aside: 'aside' };

export interface SanitizeContext {
  /** resolve an image reference to a safe (blob:) URL */
  resolveImage(src: string): string | undefined;
  /** resolve an internal link; return `undefined` for external */
  resolveLink(href: string): string | undefined;
}

export function sanitizeNode(src: Node, ctx: SanitizeContext, out: Document): Node | null {
  if (src.nodeType === Node.TEXT_NODE) return out.createTextNode(src.textContent ?? '');
  if (src.nodeType !== Node.ELEMENT_NODE) return null;
  const el = src as Element;
  let tag = el.localName.toLowerCase();

  if (DROP.has(tag)) return null;

  // SVG wrappers are commonly used for full-page images (covers). Keep the image only.
  if (tag === 'svg') {
    const image = el.getElementsByTagNameNS('*', 'image')[0];
    const href = image?.getAttribute('href') ?? image?.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
    const url = href ? ctx.resolveImage(href) : undefined;
    if (!url) return null;
    const img = out.createElement('img');
    img.src = url;
    img.alt = '';
    img.className = 'full-image';
    return img;
  }

  const children = () => {
    const frag = out.createDocumentFragment();
    el.childNodes.forEach((c) => {
      const n = sanitizeNode(c, ctx, out);
      if (n) frag.appendChild(n);
    });
    return frag;
  };

  if (!KEEP.has(tag)) return children(); // unwrap unknown tags but keep their text

  tag = BLOCK_REMAP[tag] ?? tag;
  const node = out.createElement(tag);

  const id = el.getAttribute('id');
  if (id) node.setAttribute('id', id);

  if (tag === 'img') {
    const s = el.getAttribute('src');
    const url = s ? ctx.resolveImage(s) : undefined;
    if (!url) return null;
    node.setAttribute('src', url);
    node.setAttribute('alt', el.getAttribute('alt') ?? '');
    return node;
  }

  if (tag === 'a') {
    const href = el.getAttribute('href') ?? '';
    if (/^https?:\/\//i.test(href)) {
      node.setAttribute('href', href);
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    } else {
      const target = href ? ctx.resolveLink(href) : undefined;
      if (target) node.setAttribute('data-href', target);
    }
  }

  if (tag === 'td' || tag === 'th') {
    const span = el.getAttribute('colspan');
    if (span && /^\d+$/.test(span)) node.setAttribute('colspan', span);
  }

  // Preserve a hint of intent from common EPUB class names.
  const cls = (el.getAttribute('class') ?? '').toLowerCase();
  if (/\b(center|centered|centre)\b/.test(cls) || el.localName === 'center') node.className = 'center';
  else if (/\b(right)\b/.test(cls)) node.className = 'right';

  node.appendChild(children());
  return node;
}

/** Collapse documents whose whole body is one wrapper div so we can chunk by real blocks. */
export function topLevelBlocks(body: Element): Element[] {
  let root: Element = body;
  for (let i = 0; i < 4; i++) {
    const els = Array.from(root.children);
    const meaningfulText = Array.from(root.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
    if (els.length === 1 && !meaningfulText && /^(div|section|article|main|body)$/i.test(els[0].localName)) root = els[0];
    else break;
  }
  return Array.from(root.children);
}
