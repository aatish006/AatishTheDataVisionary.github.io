import { memo, useEffect, useState } from 'react';
import type { FixedDocument } from '../lib/importers/types';
import type { PageSide } from './BookStage';
import type { PageLayout } from './paginate';

interface Common {
  side: PageSide;
  layout: PageLayout;
  head?: string;
  folio?: string;
}

function Frame({ side, layout, head, folio, children, className = '' }: Common & { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`page page--${side} ${className}`} style={{ width: layout.W, height: layout.H }}>
      <div className="page__grain" />
      {head && (
        <div className="page__head" style={{ top: layout.padT * 0.42, left: layout.padL, right: layout.padR }}>
          {head}
        </div>
      )}
      {children}
      {folio && (
        <div className="page__foot" style={{ bottom: layout.padB * 0.36, left: layout.padL, right: layout.padR }}>
          {folio}
        </div>
      )}
      <div className="page__gutter" />
    </div>
  );
}

/** One page of reflowable text: the section's HTML, shifted to its column. */
export const FlowPage = memo(function FlowPage(props: Common & { html: string; index: number; chapterStart: boolean }) {
  const { layout, html, index } = props;
  return (
    <Frame {...props} head={props.chapterStart ? undefined : props.head} className={props.chapterStart ? 'is-chapter-start' : ''}>
      <div className="page__body" style={{ top: layout.padT, left: layout.padL, width: layout.cw, height: layout.ch }}>
        <div
          className="flow"
          style={{
            width: layout.cw,
            height: layout.ch,
            columnWidth: layout.cw,
            columnGap: layout.gap,
            transform: `translate3d(${-(layout.cw + layout.gap) * index}px,0,0)`,
            ['--content-h' as string]: `${layout.ch}px`,
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </Frame>
  );
});

/** One page of a fixed-layout document (PDF), rendered to an image. */
export const FixedPage = memo(function FixedPage(props: Common & { doc: FixedDocument; index: number }) {
  const { doc, index, layout } = props;
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const pad = Math.round(Math.min(layout.W, layout.H) * 0.035);
  const bw = layout.W - pad * 2;
  const bh = layout.H - pad * 2 - 18;
  useEffect(() => {
    let alive = true;
    setUrl(null);
    setFailed(false);
    doc
      .renderPage(index, bw, bh)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [doc, index, bw, bh]);
  return (
    <Frame side={props.side} layout={layout} folio={props.folio} className="page--fixed">
      <div className="page__fixed" style={{ inset: `${pad}px ${pad}px ${pad + 18}px` }}>
        {url ? <img src={url} alt={`Page ${index + 1}`} draggable={false} /> : <div className={failed ? 'page__error' : 'page__loading'}>{failed ? 'This page could not be drawn.' : ''}</div>}
      </div>
    </Frame>
  );
});

/** Decorative endpapers before the first and after the last page. */
export const Endpaper = memo(function Endpaper({ side, layout, kind, title }: { side: PageSide; layout: PageLayout; kind: 'front' | 'back'; title: string }) {
  return (
    <Frame side={side} layout={layout} className={`page--endpaper page--endpaper-${kind}`}>
      <div className="endpaper">
        {kind === 'front' ? (
          <div className="bookplate">
            <div className="bookplate__ex">Ex Libris</div>
            <div className="bookplate__orn">❦</div>
            <div className="bookplate__names">Aatish &amp; Nishi</div>
            <div className="bookplate__lib">Our Little Library</div>
            <div className="bookplate__title">{title}</div>
          </div>
        ) : (
          <div className="endpaper__fin">
            <span>❦</span>
          </div>
        )}
      </div>
    </Frame>
  );
});

/** The blank reverse of a leaf, seen while turning in single-page mode. */
export function PaperBack({ layout }: { layout: PageLayout }) {
  return <div className="page page--paperback" style={{ width: layout.W, height: layout.H }}><div className="page__grain" /></div>;
}
