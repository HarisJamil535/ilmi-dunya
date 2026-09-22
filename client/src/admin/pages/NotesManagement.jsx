import { useCallback, useContext, useEffect, useState } from "react";
import PublishingFields from "../components/PublishingFields";
import { FileText, Loader2, Save } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AppContext } from "@/context/AppContext";
import { CustomSelect } from "@/admin/components/CustomSelect";
import { DeleteButton } from "@/admin/components/AdminUI";
import { isValidUrl, noteTypeLabels } from "@/admin/components/ResourceHelpers";

const emptyNotes = { short_questions: "", long_questions: "", mcqs: "" };
const sortByName = (items) => [...items].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));
const sortChapters = (items) => [...items].sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0) || (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));

const NotesManagement = () => {
    const { boards, classes, groups, selectedBoard, setSelectedBoard, selectedClass, setSelectedClass, selectedGroup, setSelectedGroup, isLoadingContext, refreshContext } = useContext(AppContext);
    const [subjects, setSubjects] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedChapter, setSelectedChapter] = useState("");
    const [notes, setNotes] = useState([]);
    const [metadata, setMetadata] = useState({});
    const [urls, setUrls] = useState(emptyNotes);
    const [savingType, setSavingType] = useState("");
    const [error, setError] = useState("");

    useEffect(() => { refreshContext(); }, [refreshContext]);

    useEffect(() => {
        const loadSubjects = async () => {
            setSelectedSubject("");
            setSelectedChapter("");
            setSubjects([]);
            setChapters([]);
            if (!selectedBoard || !selectedClass || !selectedGroup) return;
            const res = await axiosInstance.get(`/subjects?boardId=${selectedBoard}&classId=${selectedClass}&groupId=${selectedGroup}`);
            setSubjects(sortByName(res.data.subjects || []));
        };
        loadSubjects().catch(() => setError("Failed to load subjects."));
    }, [selectedBoard, selectedClass, selectedGroup]);

    useEffect(() => {
        const loadChapters = async () => {
            setSelectedChapter("");
            setChapters([]);
            if (!selectedSubject) return;
            const params = new URLSearchParams({ boardId: selectedBoard, classId: selectedClass, groupId: selectedGroup, subjectId: selectedSubject });
            const res = await axiosInstance.get(`/chapters?${params.toString()}`);
            setChapters(sortChapters(res.data.chapters || []));
        };
        loadChapters().catch(() => setError("Failed to load chapters."));
    }, [selectedSubject, selectedBoard, selectedClass, selectedGroup]);

    const loadNotes = useCallback(async () => {
        setNotes([]);
        setUrls(emptyNotes);
        setMetadata({});
        if (!selectedChapter) return;
        const res = await axiosInstance.get(`/resources/chapter-notes?chapter=${selectedChapter}`);
        const nextNotes = res.data.notes || [];
        setNotes(nextNotes);
        setMetadata(Object.fromEntries(nextNotes.map(note => [note.noteType, note])));
        setUrls({
            short_questions: nextNotes.find((note) => note.noteType === "short_questions")?.pdfUrl || "",
            long_questions: nextNotes.find((note) => note.noteType === "long_questions")?.pdfUrl || "",
            mcqs: nextNotes.find((note) => note.noteType === "mcqs")?.pdfUrl || "",
        });
    }, [selectedChapter]);

    useEffect(() => { loadNotes().catch(() => setError("Failed to load notes.")); }, [loadNotes]);

    const saveNote = async (noteType) => {
        setError("");
        const pdfUrl = urls[noteType]?.trim();
        if (!isValidUrl(pdfUrl)) return setError("Enter a valid PDF URL.");
        setSavingType(noteType);
        try {
            await axiosInstance.post("/resources/chapter-notes", {
                ...metadata[noteType],
                title: metadata[noteType]?.title || noteTypeLabels[noteType],
                noteType,
                pdfUrl,
                chapter: selectedChapter,
            });
            await loadNotes();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to save notes.");
        } finally {
            setSavingType("");
        }
    };

    const deleteNote = async (noteType) => {
        const note = notes.find((item) => item.noteType === noteType);
        if (!note) return;
        setSavingType(noteType);
        try {
            await axiosInstance.delete(`/resources/chapter-notes/${note._id}`);
            await loadNotes();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to delete notes.");
        } finally {
            setSavingType("");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/60 p-6 md:p-8 text-slate-800">
            <div className="mx-auto max-w-6xl space-y-6">
                <header className="rounded-2xl bg-gradient-to-br from-primary-dark via-primary to-primary-muted p-6 text-white shadow-md">
                    <div className="flex items-center gap-3">
                        <FileText className="h-7 w-7" />
                        <div>
                            <h1 className="text-2xl font-bold">Chapter Notes</h1>
                            <p className="text-sm text-primary-muted">Manage short questions, long questions and MCQs notes per chapter.</p>
                        </div>
                    </div>
                </header>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="grid gap-4 md:grid-cols-5">
                        <CustomSelect label="Board" value={selectedBoard} onChange={setSelectedBoard} options={boards} placeholder="Select Board" isLoading={isLoadingContext} />
                        <CustomSelect label="Class" value={selectedClass} onChange={setSelectedClass} options={classes} placeholder="Select Class" isLoading={isLoadingContext} />
                        <CustomSelect label="Group" value={selectedGroup} onChange={setSelectedGroup} options={groups} placeholder="Select Group" isLoading={isLoadingContext} />
                        <CustomSelect label="Subject" value={selectedSubject} onChange={setSelectedSubject} options={subjects} placeholder="Select Subject" disabled={!selectedBoard || !selectedClass || !selectedGroup} />
                        <CustomSelect label="Chapter" value={selectedChapter} onChange={setSelectedChapter} options={chapters.map((chapter) => ({ ...chapter, name: `Ch ${chapter.chapterNumber}: ${chapter.name}` }))} placeholder="Select Chapter" disabled={!selectedSubject} />
                    </div>
                </section>

                {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-600">{error}</p>}

                <section className="grid gap-5">
                    {Object.entries(noteTypeLabels).map(([noteType, label]) => {
                        const existingNote = notes.find((note) => note.noteType === noteType);
                        return (
                            <div key={noteType} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h2 className="text-lg font-black text-slate-900">{label}</h2>
                                <p className="mt-1 text-xs text-slate-500">Add a PDF URL students can view and download.</p>
                                <label className="mt-4 block text-sm font-semibold">Notes title
                                    <input className="input" value={metadata[noteType]?.title || ""} placeholder="FBISE Class 10 Physics - Chapter 2 Short Questions" onChange={e => setMetadata(current => ({ ...current, [noteType]: { ...current[noteType], title: e.target.value } }))} />
                                </label>
                                <input
                                    aria-label={`${label} PDF URL`}
                                    value={urls[noteType]}
                                    onChange={(e) => setUrls({ ...urls, [noteType]: e.target.value })}
                                    placeholder="https://example.com/notes.pdf"
                                    className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary"
                                />
                                <PublishingFields kind="notes" value={metadata[noteType] || {}} title={metadata[noteType]?.title || label} onChange={patch => setMetadata(current => ({ ...current, [noteType]: { ...current[noteType], ...patch } }))} />
                                <div className="mt-4 flex gap-2">
                                    {existingNote && <a href={existingNote.pdfUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">View</a>}
                                    <button disabled={!selectedChapter || savingType === noteType} onClick={() => saveNote(noteType)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                                        {savingType === noteType ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                                    </button>
                                    {existingNote && <DeleteButton onClick={() => deleteNote(noteType)} disabled={savingType === noteType} />}
                                </div>
                            </div>
                        );
                    })}
                </section>
            </div>
        </div>
    );
};

export default NotesManagement;
