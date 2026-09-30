import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, ShieldCheck, Sparkles } from "lucide-react";
import logo from "../../assets/logo.png";
import hero from "../../assets/hero_img.jpg";

const StudentAuthShell = ({ eyebrow, title, description, children, maxWidth = "max-w-md" }) => (
  <main className="grid h-[100dvh] overflow-hidden bg-slate-50 lg:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)]">
    <aside className="relative hidden h-[100dvh] overflow-hidden bg-primary-dark text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <img src={hero} alt="A student preparing for exams" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#25114d]/95 via-[#4629a7]/85 to-[#36277e]/80" />
      <div className="relative z-10 flex items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white p-2 shadow-lg"><img src={logo} alt="" className="h-full w-full object-contain" /></span>
        <div><p className="text-xl font-black tracking-tight">IlmiDunya</p><p className="text-sm text-white/70">Your learning, moving forward</p></div>
      </div>
      <div className="relative z-10 max-w-xl py-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white/90"><Sparkles className="h-4 w-4" /> Made for your next step</span>
        <h2 className="mt-6 text-4xl font-black leading-tight xl:text-5xl">Learn with clarity.<br />Prepare with confidence.</h2>
        <p className="mt-5 max-w-md text-base leading-7 text-white/75">Keep your study resources, practice tests and progress together in one place.</p>
      </div>
      <div className="relative z-10 flex items-center gap-5 text-sm font-semibold text-white/80">
        <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4" /> Board-aligned study</span>
        <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Secure student account</span>
      </div>
    </aside>

    <section className="flex h-[100dvh] min-h-0 items-center justify-center px-4 py-3 sm:px-8 lg:px-12">
      <div className={`w-full max-h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${maxWidth}`}>
        <div className="mb-3 flex items-center justify-between sm:mb-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-primary"><ArrowLeft className="h-4 w-4" /> Home</Link>
          <Link to="/" className="flex items-center gap-2 lg:hidden"><img src={logo} alt="IlmiDunya" className="h-9 w-9 object-contain" /><span className="text-lg font-black text-primary-dark">IlmiDunya</span></Link>
        </div>
        <header className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
          <p className="mt-1.5 max-w-lg text-xs leading-5 text-slate-500 max-[600px]:max-h-10 sm:text-sm [@media(max-height:600px)]:hidden">{description}</p>
        </header>
        {children}
      </div>
    </section>
  </main>
);

export default StudentAuthShell;
