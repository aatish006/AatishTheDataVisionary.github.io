// Importer registry. To support a new format (e.g. .txt, .fb2, .cbz):
//   1. write a `BookImporter` that returns a FlowDocument (reflowable) or FixedDocument (pages)
//   2. add it to `IMPORTERS` and to the `BookFormat` union in ../types.ts
// The upload flow, library and reader pick it up automatically.

import { epubImporter } from './epub';
import { pdfImporter } from './pdf';
import type { BookImporter } from './types';

export const IMPORTERS: BookImporter[] = [epubImporter, pdfImporter];

export const ACCEPT = IMPORTERS.flatMap((i) => [...i.extensions, ...i.mimeTypes]).join(',');

export function importerFor(file: { name: string; type: string }): BookImporter | undefined {
  const name = file.name.toLowerCase();
  return IMPORTERS.find((i) => i.extensions.some((e) => name.endsWith(e)) || i.mimeTypes.includes(file.type));
}

export function importerByFormat(format: string): BookImporter | undefined {
  return IMPORTERS.find((i) => i.format === format);
}

export const MAX_FILE_MB = 150;
