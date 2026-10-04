// What an importer produces, and what the reader consumes.

export interface TocEntry {
  label: string;
  /** flow: section index; fixed: page index */
  section: number;
  /** element id within the section, if the entry points mid-chapter */
  anchor?: string;
  depth: number;
}

export interface FlowSection {
  html: string;
  /** chapter title used for "Chapter 7"-style labels */
  title?: string;
}

/** Reflowable text (EPUB, demo books): we paginate it ourselves. */
export interface FlowDocument {
  kind: 'flow';
  sections: FlowSection[];
  toc: TocEntry[];
  /** resolve an internal link (data-href) to a section + anchor */
  resolveLink(target: string): { section: number; anchor?: string } | undefined;
  dispose(): void;
}

/** Fixed-layout pages (PDF): each page is rendered to an image on demand. */
export interface FixedDocument {
  kind: 'fixed';
  pageCount: number;
  toc: TocEntry[];
  /** aspect ratio (width / height) of a page */
  pageAspect(index: number): number;
  /** returns an object URL for the rendered page */
  renderPage(index: number, cssWidth: number, cssHeight: number): Promise<string>;
  /** plain text for in-book search (optional) */
  pageText?(index: number): Promise<string>;
  dispose(): void;
}

export type ReaderDocument = FlowDocument | FixedDocument;

export interface ImportedMeta {
  title: string;
  author: string;
  description?: string;
  category?: string;
  pageCount?: number;
  cover?: Blob;
}

export interface BookImporter {
  format: 'epub' | 'pdf';
  label: string;
  extensions: string[];
  mimeTypes: string[];
  /** read metadata + cover at upload time */
  inspect(file: Blob): Promise<ImportedMeta>;
  /** prepare a document for reading */
  open(file: Blob): Promise<ReaderDocument>;
}
