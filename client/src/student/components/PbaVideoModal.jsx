import { ExternalLink, X } from "lucide-react";
import ModalViewport from "../../shared/ModalViewport";

// Plays a lecture inside the page, with a link to open it on YouTube instead.
export default function PbaVideoModal({ video, onClose }) {
  return <ModalViewport onClose={onClose}>
    <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-slate-950 shadow-2xl animate-in fade-in zoom-in-95" role="dialog" aria-modal="true" aria-label={video.title}>
      <div className="flex items-center justify-between gap-3 px-5 py-3 text-white">
        <p className="min-w-0 truncate text-sm font-bold">{video.title}</p>
        <div className="flex shrink-0 items-center gap-1">
          <a href={video.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white/80 hover:bg-white/10"><ExternalLink className="h-3.5 w-3.5" />YouTube</a>
          <button type="button" onClick={onClose} aria-label="Close video" className="grid h-9 w-9 place-items-center rounded-lg text-white/80 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="aspect-video w-full bg-black"><iframe title={video.title} src={video.embed} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
    </div>
  </ModalViewport>;
}
