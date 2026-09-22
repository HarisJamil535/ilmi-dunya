import { useCallback, useContext, useEffect, useState } from "react";
import PublishingFields from "../components/PublishingFields";
import { FileText, Loader2, Plus } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AppContext } from "@/context/AppContext";
import { CustomSelect } from "@/admin/components/CustomSelect";
import { isValidUrl } from "@/admin/components/ResourceHelpers";
import SmartSelect from "../../shared/CustomSelect";
import { DeleteButton, EditButton } from "../components/AdminUI";

const initialForm = { title: "", year: new Date().getFullYear(), session: "morning", pdfUrl: "" };
const sortByName = (items) => [...items].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));
const sortPapers = (items) => [...items].sort((a, b) => (b.year || 0) - (a.year || 0) || (a.title || "").localeCompare(b.title || "", undefined, { numeric: true, sensitivity: "base" }));

const Field = ({ label, helper, children }) => (
    <label className="block">
        <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
        {children}
        {helper && <span className="mt-1.5 block text-xs font-semibold leading-5 text-slate-400">{helper}</span>}
    </label>
);

const PastPaperManagement = () => {
    const { boards, classes, groups, selectedBoard, setSelectedBoard, selectedClass, setSelectedClass, selectedGroup, setSelectedGroup, isLoadingContext, refreshContext } = useContext(AppContext);
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [papers, setPapers] = useState([]);
    const [form, setForm] = useState(initialForm);
    const [editingId, setEditingId] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => { refreshContext(); }, [refreshContext]);

    useEffect(() => {
        const loadSubjects = async () => {
            setSelectedSubject("");
            setSubjects([]);
            setPapers([]);
            if (!selectedBoard || !selectedClass || !selectedGroup) return;
            const res = await axiosInstance.get(`/subjects?boardId=${selectedBoard}&classId=${selectedClass}&groupId=${selectedGroup}`);
            setSubjects(sortByName(res.data.subjects || []));
        };
        loadSubjects().catch(() => setError("Failed to load subjects."));
    }, [selectedBoard, selectedClass, selectedGroup]);

    const loadPapers = useCallback(async () => {
        if (!selectedBoard || !selectedClass || !selectedGroup || !selectedSubject) return;
        setLoading(true);
        const params = new URLSearchParams({ board: selectedBoard, class: selectedClass, group: selectedGroup, subject: selectedSubject });
        const res = await axiosInstance.get(`/resources/past-papers?${params.toString()}`);
        setPapers(sortPapers(res.data.papers || []));
        setLoading(false);
    }, [selectedBoard, selectedClass, selectedGroup, selectedSubject]);

    useEffect(() => { loadPapers().catch(() => { setLoading(false); setError("Failed to load past papers."); }); }, [loadPapers]);

    const resetForm = () => {
        setForm(initialForm);
        setEditingId("");
        setError("");
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        if (!form.title.trim()) return setError("Title is required.");
        if (!Number(form.year)) return setError("Year is required.");
        if (!isValidUrl(form.pdfUrl.trim())) return setError("Enter a valid PDF URL.");
        setSaving(true);
        try {
            const payload = { ...form, title: form.title.trim(), pdfUrl: form.pdfUrl.trim(), board: selectedBoard, class: selectedClass, group: selectedGroup, subject: selectedSubject };
            if (editingId) await axiosInstance.put(`/resources/past-papers/${editingId}`, payload);
            else await axiosInstance.post("/resources/past-papers", payload);
            resetForm();
            await loadPapers();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to save past paper.");
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (paper) => {
        setEditingId(paper._id);
        setForm({ ...paper, title: paper.title, year: paper.year, session: paper.session, pdfUrl: paper.pdfUrl });
    };

    const handleDelete = async (paperId) => {
        setSaving(true);
        try {
            await axiosInstance.delete(`/resources/past-papers/${paperId}`);
            await loadPapers();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to delete past paper.");
        } finally {
            setSaving(false);
        }
    };

    const canManage = selectedBoard && selectedClass && selectedGroup && selectedSubject;

    return (
        <div className="min-h-screen bg-slate-50/60 p-6 md:p-8 text-slate-800">
            <div className="mx-auto max-w-6xl space-y-6">
                <header className="rounded-2xl bg-gradient-to-br from-primary-dark via-primary to-primary-muted p-6 text-white shadow-md">
                    <div className="flex items-center gap-3">
                        <FileText className="h-7 w-7" />
                        <div>
                            <h1 className="text-2xl font-bold">Past Papers</h1>
                            <p className="text-sm text-primary-muted">Upload year-wise morning and evening papers for each subject context.</p>
                        </div>
                    </div>
                </header>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="grid gap-4 md:grid-cols-4">
                        <CustomSelect label="Board" value={selectedBoard} onChange={setSelectedBoard} options={boards} placeholder="Select Board" isLoading={isLoadingContext} />
                        <CustomSelect label="Class" value={selectedClass} onChange={setSelectedClass} options={classes} placeholder="Select Class" isLoading={isLoadingContext} />
                        <CustomSelect label="Group" value={selectedGroup} onChange={setSelectedGroup} options={groups} placeholder="Select Group" isLoading={isLoadingContext} />
                        <CustomSelect label="Subject" value={selectedSubject} onChange={setSelectedSubject} options={subjects} placeholder="Select Subject" disabled={!selectedBoard || !selectedClass || !selectedGroup} />
                    </div>
                </section>

                <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-lg font-black text-slate-900">{editingId ? "Edit Past Paper" : "Add Past Paper"}</h2>
                    <div className="grid gap-4 md:grid-cols-[1fr_120px_150px_1fr]">
                        <Field label="Paper Title" helper="Example: BISE Lahore Class 10 Physics 2025 Morning - Subjective.">
                            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Paper title" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" />
                        </Field>
                        <Field label="Year" helper="Exam year.">
                            <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" />
                        </Field>
                        <Field label="Session" helper="Morning or evening paper.">
                            <SmartSelect value={form.session} onChange={(value) => setForm({ ...form, session: value })} options={[{ value: "morning", label: "Morning" }, { value: "evening", label: "Evening" }]} placeholder="Choose session" />
                        </Field>
                        <Field label="PDF Link" helper="Paste the direct PDF URL students can open.">
                            <input value={form.pdfUrl} onChange={(e) => setForm({ ...form, pdfUrl: e.target.value })} placeholder="https://example.com/paper.pdf" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary" />
                        </Field>
                    </div>
                    <PublishingFields kind="past-paper" value={form} title={form.title} onChange={(patch) => setForm(current => ({ ...current, ...patch }))} />
                    {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-600">{error}</p>}
                    <div className="mt-5 flex justify-end gap-3">
                        {editingId && <button type="button" onClick={resetForm} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>}
                        <button disabled={!canManage || saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {editingId ? "Update Paper" : "Add Paper"}
                        </button>
                    </div>
                </form>

                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 p-5">
                        <h2 className="text-sm font-black uppercase tracking-wider text-slate-600">Uploaded Past Papers</h2>
                    </div>
                    {loading ? (
                        <div className="p-10 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
                    ) : papers.length === 0 ? (
                        <div className="p-10 text-center text-sm font-semibold text-slate-400">No past papers uploaded for this context yet.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {papers.map((paper) => (
                                <div key={paper._id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h3 className="font-bold text-slate-900">{paper.title}</h3>
                                        <div className="mt-1 flex gap-2 text-xs font-bold uppercase">
                                            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-primary">{paper.year}</span>
                                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{paper.session}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <a href={paper.pdfUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">View</a>
                                        <EditButton onClick={() => handleEdit(paper)} />
                                        <DeleteButton onClick={() => handleDelete(paper._id)} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default PastPaperManagement;
