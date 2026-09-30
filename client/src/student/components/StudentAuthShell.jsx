import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, ShieldCheck, Sparkles } from "lucide-react";
import logo from "../../assets/logo.png";
import hero from "../../assets/hero_img.jpg";

const StudentAuthShell = ({ eyebrow, title, description, children, footer, maxWidth = "max-w-md" }) => (
  <main className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)]">
    <aside className="relative hidden min-h-screen overflow-hidden bg-primary-dark text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
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

    <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
      <div className={`w-full ${maxWidth}`}>
        <div className="mb-7 flex items-center justify-between lg:mb-9">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-primary"><ArrowLeft className="h-4 w-4" /> Home</Link>
          <Link to="/" className="flex items-center gap-2 lg:hidden"><img src={logo} alt="IlmiDunya" className="h-9 w-9 object-contain" /><span className="text-lg font-black text-primary-dark">IlmiDunya</span></Link>
        </div>
        <header className="mb-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">{description}</p>
        </header>
        {children}
        {footer && <div className="mt-6 border-t border-slate-200 pt-5 text-center text-sm text-slate-500">{footer}</div>}
        <p className="mt-7 text-center text-xs text-slate-400">By continuing, you agree to use IlmiDunya respectfully and keep your account secure.</p>
      </div>
    </section>
  </main>
);

export default StudentAuthShell;
