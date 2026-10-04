// EPUB importer.
//
// We use JSZip to read the container and the browser's DOMParser to read the
// OPF package, navigation and chapters. Content is sanitised and handed to our
// own paginator, rather than rendered through an iframe-based EPUB viewer,
// because the page-curl animation needs real page surfaces we fully control.

import type JSZipType from 'jszip';
import { sanitizeNode, topLevelBlocks, type SanitizeContext } from './sanitize';
import type { BookImporter, FlowDocument, FlowSection, ImportedMeta, TocEntry } from './types';

const MAX_SECTION_CHARS = 28000;

async function loadZip(file: Blob): Promise<JSZipType> {
  const { default: JSZip } = await import('jszip');
  try {
    return await JSZip.loadAsync(file);
  } catch {
    throw new Error('This file does not look like a valid EPUB (it could not be unzipped).');
  }
}

const parser = () => new DOMParser();

function parseXml(text: string): Document {
  return parser().parseFromString(text, 'application/xml');
}

function parseXhtml(text: string): Document {
  const doc = parser().parseFromString(text, 'application/xhtml+xml');
  if (doc.getElementsByTagName('parsererror').length) return parser().parseFromString(text, 'text/html');
  return doc;
}

const byTag = (root: Document | Element, name: string) => Array.from(root.getElementsByTagNameNS('*', name));
const firstText = (root: Document | Element, name: string) => byTag(root, name)[0]?.textContent?.trim() || '';

function dirname(path: string) {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i + 1);
}

/** Resolve `href` relative to the file at `base`, returning a zip path (no fragment). */
function resolvePath(base: string, href: string): { path: string; fragment?: string } {
  const [rawPath, fragment] = href.split('#');
  let decoded = rawPath;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    /* keep raw */
  }
  if (!decoded) return { path: base, fragment };
  const parts = (decoded.startsWith('/') ? decoded.slice(1) : dirname(base) + decoded).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.' && p !== '') out.push(p);
  }
  return { path: out.join('/'), fragment: fragment || undefined };
}

interface ManifestItem {
  id: string;
  path: string;
  mediaType: string;
  properties: string;
}

interface Package {
  zip: JSZipType;
  opfPath: string;
  opf: Document;
  manifest: Map<string, ManifestItem>;
  spine: ManifestItem[];
}

async function readText(zip: JSZipType, path: string): Promise<string | undefined> {
  const f = zip.file(path) ?? zip.file(decodeURI(path));
  if (!f) {
    // Some EPUBs differ in case; fall back to a case-insensitive lookup.
    const lower = path.toLowerCase();
    const match = Object.keys(zip.files).find((k) => k.toLowerCase() === lower);
    return match ? zip.file(match)!.async('text') : undefined;
  }
  return f.async('text');
}

async function readPackage(file: Blob): Promise<Package> {
  const zip = await loadZip(file);
  const container = await readText(zip, 'META-INF/container.xml');
  if (!container) throw new Error('This EPUB is missing its container file.');
  const opfPath = byTag(parseXml(container), 'rootfile')[0]?.getAttribute('full-path');
  if (!opfPath) throw new Error('This EPUB does not declare its contents.');
  const opfText = await readText(zip, opfPath);
  if (!opfText) throw new Error('This EPUB’s package file is missing.');
  const opf = parseXml(opfText);

  const manifest = new Map<string, ManifestItem>();
  for (const item of byTag(opf, 'item')) {
    const id = item.getAttribute('id') ?? '';
    manifest.set(id, {
      id,
      path: resolvePath(opfPath, item.getAttribute('href') ?? '').path,
      mediaType: item.getAttribute('media-type') ?? '',
      properties: item.getAttribute('properties') ?? '',
    });
  }
  const spine = byTag(opf, 'itemref')
    .map((ref) => manifest.get(ref.getAttribute('idref') ?? ''))
    .filter((m): m is ManifestItem => !!m && /html|xml/.test(m.mediaType));
  if (!spine.length) throw new Error('This EPUB has no readable chapters.');
  return { zip, opfPath, opf, manifest, spine };
}

function findCover(pkg: Package): ManifestItem | undefined {
  const items = Array.from(pkg.manifest.values());
  const byProp = items.find((i) => /\bcover-image\b/.test(i.properties));
  if (byProp) return byProp;
  const metaCover = byTag(pkg.opf, 'meta').find((m) => m.getAttribute('name') === 'cover')?.getAttribute('content');
  if (metaCover && pkg.manifest.get(metaCover)?.mediaType.startsWith('image/')) return pkg.manifest.get(metaCover);
  return items.find((i) => i.mediaType.startsWith('image/') && /cover/i.test(i.id + i.path));
}

async function readToc(pkg: Package): Promise<{ label: string; path: string; fragment?: string; depth: number }[]> {
  const out: { label: string; path: string; fragment?: string; depth: number }[] = [];
  const nav = Array.from(pkg.manifest.values()).find((i) => /\bnav\b/.test(i.properties));
  if (nav) {
    const text = await readText(pkg.zip, nav.path);
    if (text) {
      const doc = parseXhtml(text);
      const navs = byTag(doc, 'nav');
      const tocNav =
        navs.find((n) => (n.getAttributeNS('http://www.idpf.org/2007/ops', 'type') ?? n.getAttribute('epub:type')) === 'toc') ?? navs[0];
      const walk = (ol: Element, depth: number) => {
        for (const li of Array.from(ol.children).filter((c) => c.localName === 'li')) {
          const a = Array.from(li.children).find((c) => c.localName === 'a' || c.localName === 'span');
          const href = a?.getAttribute('href');
          const label = a?.textContent?.replace(/\s+/g, ' ').trim();
          if (a && href && label) out.push({ label, ...resolvePath(nav.path, href), depth });
          const sub = Array.from(li.children).find((c) => c.localName === 'ol');
          if (sub) walk(sub, depth + 1);
        }
      };
      const ol = tocNav && byTag(tocNav, 'ol')[0];
      if (ol) walk(ol, 0);
      if (out.length) return out;
    }
  }
  const tocId = byTag(pkg.opf, 'spine')[0]?.getAttribute('toc');
  const ncx = (tocId && pkg.manifest.get(tocId)) || Array.from(pkg.manifest.values()).find((i) => i.mediaType === 'application/x-dtbncx+xml');
  if (ncx) {
    const text = await readText(pkg.zip, ncx.path);
    if (text) {
      const doc = parseXml(text);
      const walk = (parent: Element, depth: number) => {
        for (const np of Array.from(parent.children).filter((c) => c.localName === 'navPoint')) {
          const label = firstText(np, 'text');
          const src = byTag(np, 'content')[0]?.getAttribute('src');
          if (label && src) out.push({ label, ...resolvePath(ncx.path, src), depth });
          walk(np, depth + 1);
        }
      };
      const navMap = byTag(doc, 'navMap')[0];
      if (navMap) walk(navMap, 0);
    }
  }
  return out;
}

function readMeta(pkg: Package): Omit<ImportedMeta, 'cover'> {
  const strip = (s: string) => {
    if (!/[<&]/.test(s)) return s;
    const d = parser().parseFromString(s, 'text/html');
    return d.body.textContent?.trim() ?? s;
  };
  return {
    title: firstText(pkg.opf, 'title') || 'Untitled',
    author: byTag(pkg.opf, 'creator').map((c) => c.textContent?.trim()).filter(Boolean).join(', ') || 'Unknown author',
    description: strip(firstText(pkg.opf, 'description')) || undefined,
    category: firstText(pkg.opf, 'subject') || undefined,
  };
}

export const epubImporter: BookImporter = {
  format: 'epub',
  label: 'EPUB',
  extensions: ['.epub'],
  mimeTypes: ['application/epub+zip'],

  async inspect(file) {
    const pkg = await readPackage(file);
    const meta = readMeta(pkg);
    const coverItem = findCover(pkg);
    let cover: Blob | undefined;
    if (coverItem) {
      const data = await pkg.zip.file(coverItem.path)?.async('blob');
      if (data) cover = new Blob([data], { type: coverItem.mediaType });
    }
    return { ...meta, cover };
  },

  async open(file): Promise<FlowDocument> {
    const pkg = await readPackage(file);
    const urls: string[] = [];
    const imageCache = new Map<string, string>();
    const imageBlobs = new Map<string, Promise<void>>();

    const tocRaw = await readToc(pkg);
    const sections: FlowSection[] = [];
    const fileStart = new Map<string, number>();
    const anchorSection = new Map<string, number>(); // `${path}#${id}` -> section

    const outDoc = document.implementation.createHTMLDocument('');

    // Pre-extract all images referenced by the manifest so sanitising stays synchronous.
    for (const item of pkg.manifest.values()) {
      if (!item.mediaType.startsWith('image/')) continue;
      imageBlobs.set(
        item.path,
        (async () => {
          const data = await pkg.zip.file(item.path)?.async('blob');
          if (!data) return;
          const url = URL.createObjectURL(new Blob([data], { type: item.mediaType }));
          urls.push(url);
          imageCache.set(item.path, url);
        })(),
      );
    }
    await Promise.all(imageBlobs.values());

    for (const item of pkg.spine) {
      const text = await readText(pkg.zip, item.path);
      if (!text) continue;
      const doc = parseXhtml(text);
      const body = doc.body ?? byTag(doc, 'body')[0];
      if (!body) continue;

      const ctx: SanitizeContext = {
        resolveImage: (src) => imageCache.get(resolvePath(item.path, src).path),
        resolveLink: (href) => {
          const r = resolvePath(item.path, href);
          return r.fragment ? `${r.path}#${r.fragment}` : r.path;
        },
      };

      const tocTitle = tocRaw.find((t) => t.path === item.path)?.label;
      const heading = firstText(body, 'h1') || firstText(body, 'h2');

      // Chunk long files at block boundaries so pagination and rendering stay light.
      const blocks = topLevelBlocks(body);
      let chunk = outDoc.createElement('div');
      let chars = 0;
      const first = sections.length;
      const flush = () => {
        if (!chunk.childNodes.length) return;
        const idx = sections.length;
        chunk.querySelectorAll('[id]').forEach((n) => anchorSection.set(`${item.path}#${n.id}`, idx));
        sections.push({ html: chunk.innerHTML, title: tocTitle || heading || undefined });
        chunk = outDoc.createElement('div');
        chars = 0;
      };
      const source = blocks.length ? blocks : [body];
      if (body.id) anchorSection.set(`${item.path}#${body.id}`, first);
      for (const block of source) {
        const clean = sanitizeNode(block, ctx, outDoc);
        if (!clean) continue;
        const len = block.textContent?.length ?? 0;
        if (chars > 0 && chars + len > MAX_SECTION_CHARS) flush();
        chunk.appendChild(clean);
        chars += len;
      }
      flush();
      if (sections.length > first) fileStart.set(item.path, first);
    }

    if (!sections.length) throw new Error('No readable text was found in this EPUB.');

    const resolveLink = (target: string) => {
      const [path, fragment] = target.split('#');
      if (fragment && anchorSection.has(target)) return { section: anchorSection.get(target)!, anchor: fragment };
      const s = fileStart.get(path);
      return s === undefined ? undefined : { section: s };
    };

    const toc: TocEntry[] = [];
    for (const t of tocRaw) {
      const r = resolveLink(t.fragment ? `${t.path}#${t.fragment}` : t.path);
      if (r) toc.push({ label: t.label, section: r.section, anchor: r.anchor, depth: t.depth });
    }

    return {
      kind: 'flow',
      sections,
      toc,
      resolveLink,
      dispose: () => urls.forEach((u) => URL.revokeObjectURL(u)),
    };
  },
};
