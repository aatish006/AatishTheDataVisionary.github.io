// PDF importer, built on Mozilla's pdf.js (loaded lazily, only when a PDF is used).
// PDF pages are fixed layout, so each page is rendered to an image that sits on
// our paper; the same page-curl engine turns them.

import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { BookImporter, FixedDocument, TocEntry } from './types';

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

function pdfjs() {
  pdfjsPromise ??= (async () => {
    const lib = await import('pdfjs-dist');
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  })();
  return pdfjsPromise;
}

async function load(file: Blob): Promise<PDFDocumentProxy> {
  const lib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  try {
    return await lib.getDocument({ data, isEvalSupported: false }).promise;
  } catch (e) {
    const msg = (e as Error)?.name === 'PasswordException' ? 'This PDF is password protected.' : 'This PDF could not be opened.';
    throw new Error(msg);
  }
}

async function renderToBlob(pdf: PDFDocumentProxy, index: number, maxW: number, maxH: number, type = 'image/png', quality?: number) {
  const page = await pdf.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(maxW / base.width, maxH / base.height);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Render failed'))), type, quality),
  );
}

export const pdfImporter: BookImporter = {
  format: 'pdf',
  label: 'PDF',
  extensions: ['.pdf'],
  mimeTypes: ['application/pdf'],

  async inspect(file) {
    const pdf = await load(file);
    try {
      const meta = (await pdf.getMetadata().catch(() => null)) as { info?: Record<string, unknown> } | null;
      const info = meta?.info ?? {};
      const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
      const cover = await renderToBlob(pdf, 0, 520, 780, 'image/jpeg', 0.86).catch(() => undefined);
      return {
        title: str(info.Title) ?? '',
        author: str(info.Author) ?? 'Unknown author',
        description: str(info.Subject),
        pageCount: pdf.numPages,
        cover,
      };
    } finally {
      void pdf.destroy();
    }
  },

  async open(file): Promise<FixedDocument> {
    const pdf = await load(file);
    const aspects: number[] = [];
    const first = await pdf.getPage(1);
    const v = first.getViewport({ scale: 1 });
    const defaultAspect = v.width / v.height;

    // Small LRU of rendered pages.
    const cache = new Map<string, Promise<string>>();
    const order: string[] = [];
    const LIMIT = 14;

    const toc: TocEntry[] = [];
    try {
      const outline = await pdf.getOutline();
      const walk = async (items: typeof outline, depth: number) => {
        for (const item of items ?? []) {
          try {
            const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
            const ref = dest?.[0];
            if (ref) {
              const pageIndex = typeof ref === 'number' ? ref : await pdf.getPageIndex(ref);
              toc.push({ label: item.title, section: pageIndex, depth });
            }
          } catch {
            /* skip broken outline entries */
          }
          if (item.items?.length && depth < 3) await walk(item.items, depth + 1);
        }
      };
      await walk(outline, 0);
    } catch {
      /* no outline */
    }

    return {
      kind: 'fixed',
      pageCount: pdf.numPages,
      toc,
      pageAspect: (i) => aspects[i] ?? defaultAspect,
      renderPage(index, cssW, cssH) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const w = Math.round(cssW * dpr);
        const h = Math.round(cssH * dpr);
        const key = `${index}:${w}x${h}`;
        const hit = cache.get(key);
        if (hit) return hit;
        const p = renderToBlob(pdf, index, w, h).then((b) => URL.createObjectURL(b));
        cache.set(key, p);
        order.push(key);
        while (order.length > LIMIT) {
          const old = order.shift()!;
          cache.get(old)?.then((u) => setTimeout(() => URL.revokeObjectURL(u), 4000));
          cache.delete(old);
        }
        return p;
      },
      async pageText(index) {
        const page = await pdf.getPage(index + 1);
        const content = await page.getTextContent();
        return content.items.map((it) => ('str' in it ? it.str : '')).join(' ');
      },
      dispose() {
        cache.forEach((p) => p.then((u) => URL.revokeObjectURL(u)));
        void pdf.destroy();
      },
    };
  },
};
