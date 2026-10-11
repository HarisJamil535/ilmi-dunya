import { useState } from 'react';
import { pdfLinks } from './pdfLinks';

export default function PdfPreview({ url, title }) {
  const [expanded, setExpanded] = useState(false);
  if (!url) return null;
  return <details className="mt-4 border-t border-slate-200 pt-3" onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-bold text-primary">Read online</summary>
    {expanded && <iframe title={title || 'PDF preview'} src={pdfLinks(url).preview} loading="lazy" className="mt-3 h-[65dvh] min-h-[320px] w-full rounded-lg border border-slate-200 bg-white" />}
  </details>;
}
