import { useContext, useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Loader2, Save } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AppContext } from "@/context/AppContext";
import { CustomSelect } from "@/admin/components/CustomSelect";
import { AdminAlert, DeleteButton } from "@/admin/components/AdminUI";
import { isValidUrl, noteTypeLabels } from "@/admin/components/ResourceHelpers";
import SmartSelect from "../../shared/CustomSelect";

const noteTypes = Object.entries(noteTypeLabels).map(([value, label]) => ({ value, label }));
const sortByName = (items) => [...items].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));
const sortChapters = (items) => [...items].sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0) || (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));

const NotesManagement = () => {
    const { boards, classes, groups, selectedBoard, setSelectedBoard, selectedClass, setSelectedClass, selectedGroup, setSelectedGroup, isLoadingContext, refreshContext } = useContext(AppContext);
    const [subjects, setSubjects] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedChapter, setSelectedChapter] = useState("");
    const [notes, setNotes] = useState([]);
    const [selectedType, setSelectedType] = useState("");
    const [drafts, setDrafts] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => { refreshContext(); }, [refreshContext]);

    useEffect(() => {
        let active = true;
        setSelectedSubject("");
        setSelectedChapter("");
        setSubjects([]);
        setChapters([]);
        if (selectedBoard && selectedClass && selectedGroup) {
            axiosInstance.get("/subjects?boardId=" + selectedBoard + "&classId=" + selectedClass + "&groupId=" + selectedGroup)
                .then((res) => { if (active) setSubjects(sortByName(res.data.subjects || [])); })
                .catch(() => { if (active) setError("Could not load subjects. Select the group again to retry."); });
        }
        return () => { active = false; };
    }, [selectedBoard, selectedClass, selectedGroup]);

    useEffect(() => {
        let active = true;
        setSelectedChapter("");
        setChapters([]);
        if (selectedSubject) {
            const params = new URLSearchParams({ boardId: selectedBoard, classId: selectedClass, groupId: selectedGroup, subjectId: selectedSubject });
            axiosInstance.get("/chapters?" + params.toString())
                .then((res) => { if (active) setChapters(sortChapters(res.data.chapters || [])); })
                .catch(() => { if (active) setError("Could not load chapters. Select the subject again to retry."); });
        }
        return () => { active = false; };
    }, [selectedSubject, selectedBoard, selectedClass, selectedGroup]);

    useEffect(() => {
        setNotes([]);
        setDrafts({});
        setSelectedType("");
        setError("");
        setMessage("");
    }, [selectedChapter]);

    useEffect(() => {
        let active = true;
        if (!selectedChapter) return () => { active = false; };
        setLoading(true);
        axiosInstance.get("/resources/chapter-notes?chapter=" + selectedChapter)
            .then((res) => { if (active) setNotes(res.data.notes || []); })
            .catch(() => { if (active) setError("Could not load notes. Select this chapter again to retry."); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [selectedChapter, refreshKey]);

    const existingNote = useMemo(() => notes.find((note) => note.noteType === selectedType), [notes, selectedType]);
    const title = drafts[selectedType]?.title ?? existingNote?.title ?? "";
    const pdfUrl = drafts[selectedType]?.pdfUrl ?? existingNote?.pdfUrl ?? "";
    const canSave = selectedChapter && selectedType && title.trim() && title.trim().length <= 180 && isValidUrl(pdfUrl.trim()) && !loading && !saving;

    const updateDraft = (patch) => {
        setDrafts((current) => ({ ...current, [selectedType]: { title, pdfUrl, ...current[selectedType], ...patch } }));
    };

    const saveNote = async (event) => {
        event.preventDefault();
        if (!canSave) return;
        setError("");
        setMessage("");
        setSaving(true);
        try {
            await axiosInstance.post("/resources/chapter-notes", {
                title: title.trim(),
                noteType: selectedType,
                pdfUrl: pdfUrl.trim(),
                chapter: selectedChapter,
            });
            setMessage(existingNote ? "Notes updated successfully." : "Notes added successfully.");
            setRefreshKey((current) => current + 1);
        } catch (err) {
            setError(err.response?.data?.message || "Could not save notes. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const deleteNote = async (note) => {
        setSaving(true);
        setError("");
        setMessage("");
        try {
            await axiosInstance.delete("/resources/chapter-notes/" + note._id);
            setNotes((current) => current.filter((item) => item._id !== note._id));
            setDrafts((current) => {
                const next = { ...current };
                delete next[note.noteType];
                return next;
            });
            setMessage("Notes removed successfully.");
        } catch (err) {
            setError(err.response?.data?.message || "Could not delete notes. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen min-w-0 bg-slate-50/60 p-3 text-slate-800 sm:p-6 md:p-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <header className="rounded-2xl bg-gradient-to-br from-primary-dark via-primary to-primary-muted p-5 text-white shadow-md sm:p-6">
                    <div className="flex items-center gap-3">
                        <FileText className="h-7 w-7" />
                        <div>
                            <h1 className="text-2xl font-bold">Chapter Notes</h1>
                            <p className="mt-1 text-sm text-white/80">Add one notes PDF at a time for a selected chapter.</p>
                        </div>
                    </div>
                </header>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                    <h2 className="mb-4 text-sm font-bold text-slate-700">Choose a chapter</h2>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                        <CustomSelect label="Board" value={selectedBoard} onChange={setSelectedBoard} options={boards} placeholder="Select Board" isLoading={isLoadingContext} />
                        <CustomSelect label="Class" value={selectedClass} onChange={setSelectedClass} options={classes} placeholder="Select Class" isLoading={isLoadingContext} />
                        <CustomSelect label="Group" value={selectedGroup} onChange={setSelectedGroup} options={groups} placeholder="Select Group" isLoading={isLoadingContext} />
                        <CustomSelect label="Subject" value={selectedSubject} onChange={setSelectedSubject} options={subjects} placeholder="Select Subject" disabled={!selectedBoard || !selectedClass || !selectedGroup} />
                        <CustomSelect label="Chapter" value={selectedChapter} onChange={setSelectedChapter} options={chapters.map((chapter) => ({ ...chapter, name: `Ch ${chapter.chapterNumber}: ${chapter.name}` }))} placeholder="Select Chapter" disabled={!selectedSubject} />
                    </div>
                </section>

                <form onSubmit={saveNote} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                    <div className="mb-5">
                        <h2 className="text-lg font-bold text-slate-900">{existingNote ? "Edit notes" : "Add notes"}</h2>
                        <p className="mt-1 text-sm text-slate-500">Select a type, enter a clear title and paste the PDF link students will open.</p>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                        <SmartSelect label="Notes type" value={selectedType} onChange={setSelectedType} options={noteTypes} placeholder="Select notes type" disabled={!selectedChapter || loading || saving} />
                        <label className="block min-w-0">
                            <span className="mb-2 block text-xs font-bold uppercase text-slate-500">Notes title</span>
                            <input value={title} onChange={(event) => updateDraft({ title: event.target.value })} disabled={!selectedType || saving} maxLength={180} placeholder="FBISE Class 10 Physics - Chapter 2 Short Questions" className="min-h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-soft disabled:bg-slate-50" />
                        </label>
                    </div>
                    <label className="mt-4 block min-w-0">
                        <span className="mb-2 block text-xs font-bold uppercase text-slate-500">PDF link</span>
                        <input type="url" value={pdfUrl} onChange={(event) => updateDraft({ pdfUrl: event.target.value })} disabled={!selectedType || saving} placeholder="https://example.com/chapter-2-notes.pdf" className="min-h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-soft disabled:bg-slate-50" />
                        <span className="mt-1.5 block text-xs text-slate-500">Use a public HTTPS link that opens the complete PDF.</span>
                    </label>
                    <div className="mt-5 flex justify-end">
                        <button type="submit" disabled={!canSave} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {existingNote ? "Update notes" : "Add notes"}
                        </button>
                    </div>
                    <AdminAlert type="error">{error}</AdminAlert>
                    <AdminAlert>{message}</AdminAlert>
                </form>

                {selectedChapter && (
                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
                            <h2 className="font-bold text-slate-900">Notes in this chapter</h2>
                        </div>
                        {loading ? (
                            <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading notes...</div>
                        ) : notes.length === 0 ? (
                            <p className="p-6 text-sm text-slate-500">No notes have been added for this chapter yet.</p>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {notes.map((note) => (
                                    <div key={note._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold uppercase text-primary">{noteTypeLabels[note.noteType]}</p>
                                            <h3 className="mt-1 break-words font-semibold text-slate-900">{note.title}</h3>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <a href={note.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary-soft px-3 text-sm font-semibold text-primary hover:bg-primary-soft/70"><ExternalLink className="h-4 w-4" /> View</a>
                                            <button type="button" onClick={() => setSelectedType(note.noteType)} className="min-h-10 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200">Edit</button>
                                            <DeleteButton onClick={() => deleteNote(note)} disabled={saving} title={"Delete " + noteTypeLabels[note.noteType]} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
};

export default NotesManagement;
