import { BookOpen, Loader2 } from "lucide-react";

const PageLoader = ({ label = "Loading IlmiDunya..." }) => {
  return (
    <div className="flex min-h-[55vh] items-center justify-center bg-slate-50 px-4">
      <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-primary-soft bg-white/90 px-8 py-10 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <span className="absolute h-full w-full animate-ping rounded-2xl bg-primary-muted opacity-30" />
          <BookOpen className="relative h-7 w-7" />
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>{label}</span>
        </div>
        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
};

export default PageLoader;
