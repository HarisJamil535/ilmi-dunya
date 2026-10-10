import { useCallback, useContext, useEffect, useState } from "react";
import { ExternalLink, FileCheck2, Loader2, Plus, Save, SearchX, X } from "lucide-react";
import Spinner from "../../shared/Spinner";
import axiosInstance from "@/api/axios";
import { AppContext } from "@/context/AppContext";
import { CustomSelect } from "@/admin/components/CustomSelect";
import { DeleteButton, EditButton } from "@/admin/components/AdminUI";
import { getName, isValidUrl } from "@/admin/components/ResourceHelpers";

const blankForm = { id: "", board: "", class: "", title: "", pdfUrl: "" };

const Field = ({ label, helper, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
    {children}
    <span className="mt-1.5 block text-xs font-semibold leading-5 text-slate-400">{helper}</span>
  </label>
);

export default function AnswerSheetManagement() {
  const { boards, classes, isLoadingContext, refreshContext } = useContext(AppContext);
  const [form, setForm] = useState(blankForm);
  const [answerSheets, setAnswerSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { refreshContext(); }, [refreshContext]);

  const loadAnswerSheets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axiosInstance.get("/resources/answer-sheets");
      setAnswerSheets([...(response.data.answerSheets || [])].sort((a, b) =>
        `${getName(a.board)} ${getName(a.class)}`.localeCompare(`${getName(b.board)} ${getName(b.class)}`, undefined, { numeric: true })
      ));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Answer sheets could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAnswerSheets(); }, [loadAnswerSheets]);

  const resetForm = () => {
    setForm(blankForm);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!form.board || !form.class) return setError("Select the board and class first.");
    if (!form.title.trim()) return setError("Enter a clear answer sheet title.");
    if (!isValidUrl(form.pdfUrl.trim())) return setError("Enter a valid public PDF URL.");

    setSaving(true);
    try {
      const payload = { board: form.board, class: form.class, title: form.title.trim(), pdfUrl: form.pdfUrl.trim() };
      if (form.id) await axiosInstance.put(`/resources/answer-sheets/${form.id}`, payload);
      else await axiosInstance.post("/resources/answer-sheets", payload);
      setMessage(form.id ? "Answer sheet updated successfully." : "Answer sheet added successfully.");
      setForm(blankForm);
      await loadAnswerSheets();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Answer sheet could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const editAnswerSheet = (answerSheet) => {
    setForm({ id: answerSheet._id, board: answerSheet.board?._id || answerSheet.board, class: answerSheet.class?._id || answerSheet.class, title: answerSheet.title, pdfUrl: answerSheet.pdfUrl });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteAnswerSheet = async (id) => {
    setSaving(true);
    setError("");
    try {
      await axiosInstance.delete(`/resources/answer-sheets/${id}`);
      if (form.id === id) setForm(blankForm);
      setMessage("Answer sheet deleted successfully.");
      await loadAnswerSheets();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Answer sheet could not be deleted.");
    } finally {
      setSaving(false);
    }
  };

  const canSave = form.board && form.class && form.title.trim() && isValidUrl(form.pdfUrl.trim());

  return (
    <div className="min-h-screen bg-slate-50/60 p-3 text-slate-800 sm:p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl bg-gradient-to-br from-primary-dark via-primary to-slate-950 p-5 text-white shadow-md sm:p-7">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/12"><FileCheck2 /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/70">Exam Resources</p>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">Board Answer Sheets</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Optionally publish one official answer-sheet pattern for each board and class. It appears automatically on matching subject chapter pages.</p>
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-black text-slate-950">{form.id ? "Update Answer Sheet" : "Add Answer Sheet"}</h2>
              <p className="mt-1 text-sm text-slate-500">Choose the board and class, then paste a public PDF link showing the expected exam answer-sheet layout.</p>
            </div>
            {form.id && <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600"><X size={16} />Cancel edit</button>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <CustomSelect label="Board" value={form.board} onChange={(value) => setForm({ ...form, board: value })} options={boards} placeholder="Select Board" isLoading={isLoadingContext} />
            <CustomSelect label="Class" value={form.class} onChange={(value) => setForm({ ...form, class: value })} options={classes} placeholder="Select Class" isLoading={isLoadingContext} />
            <Field label="Resource title" helper="Example: BISE Lahore Class 10 Official Answer Sheet Pattern">
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={140} placeholder="Answer sheet title" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft" />
            </Field>
            <Field label="PDF link" helper="Use a public HTTPS link that opens the answer-sheet PDF directly.">
              <input type="url" value={form.pdfUrl} onChange={(event) => setForm({ ...form, pdfUrl: event.target.value })} placeholder="https://example.com/answer-sheet.pdf" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft" />
            </Field>
          </div>

          {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
          {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
          <div className="mt-5 flex justify-end">
            <button disabled={!canSave || saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto">
              {saving ? <Loader2 className="animate-spin" size={16} /> : form.id ? <Save size={16} /> : <Plus size={16} />}
              {form.id ? "Update Answer Sheet" : "Add Answer Sheet"}
            </button>
          </div>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div><h2 className="text-lg font-black text-slate-950">Published answer sheets</h2><p className="mt-1 text-sm text-slate-500">Only boards and classes listed here display the student-page button.</p></div>
            <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-black text-primary">{answerSheets.length} total</span>
          </div>
          {loading ? <div className="flex justify-center py-12"><Spinner /></div> : answerSheets.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {answerSheets.map((item) => <article key={item._id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-primary/30 hover:bg-white hover:shadow-sm sm:p-5">
                <p className="text-xs font-black uppercase tracking-wider text-primary">{getName(item.board)} · {getName(item.class)}</p>
                <h3 className="mt-2 font-black leading-snug text-slate-950">{item.title}</h3>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <a href={item.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary" title="Open PDF"><ExternalLink size={16} /></a>
                  <EditButton onClick={() => editAnswerSheet(item)} title="Edit answer sheet" />
                  <DeleteButton onClick={() => deleteAnswerSheet(item._id)} disabled={saving} title="Delete answer sheet" />
                </div>
              </article>)}
            </div>
          ) : <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center"><SearchX className="mx-auto text-slate-400" /><h3 className="mt-3 font-black text-slate-950">No answer sheets added yet</h3><p className="mt-1 text-sm text-slate-500">This resource is optional. Add one only when an official or accurate pattern is available.</p></div>}
        </section>
      </div>
    </div>
  );
}
