import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ChevronDown, CircleDot, Clock3, FilePlus2, ListChecks, Plus, Radio, Upload, X } from "lucide-react";
import axiosInstance from "@/api/axios";
import { AppContext } from "../../context/AppContext";
import { CustomSelect } from "../components/CustomSelect";
import { AdminActionButton, AdminAlert, AdminLoader, AdminPageHeader } from "../components/AdminUI";

const sortByName = (items) => [...items].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));
const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
const opensLabel = (value) => when.format(new Date(value)).replace(" am", " AM").replace(" pm", " PM");

// datetime-local works in the browser's own time; these helpers convert both ways.
const localInput = (date) => {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
};
const presets = () => {
  const now = new Date();
  const tomorrow8 = new Date(now); tomorrow8.setDate(now.getDate() + 1); tomorrow8.setHours(8, 0, 0, 0);
  const inHour = new Date(now.getTime() + 3600000); inHour.setMinutes(0, 0, 0); inHour.setHours(inHour.getHours() + 1);
  const monday = new Date(now); monday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7)); monday.setHours(8, 0, 0, 0);
  return [["In 1 hour", inHour], ["Tomorrow 8 AM", tomorrow8], ["Next Monday 8 AM", monday]];
};

const STATE = {
  live: { label: "Live", className: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30", icon: Radio },
  scheduled: { label: "Scheduled", className: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30", icon: Clock3 },
  off: { label: "Unpublished", className: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10", icon: CircleDot },
  empty: { label: "No MCQs yet", className: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30", icon: FilePlus2 },
};

const StateBadge = ({ item }) => {
  const meta = STATE[item.state] || STATE.off;
  const Icon = meta.icon;
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black ring-1 ring-inset ${meta.className}`}>
    <Icon className="h-3.5 w-3.5" aria-hidden="true" />{item.state === "scheduled" && item.opensAt ? `Opens ${opensLabel(item.opensAt)}` : meta.label}
  </span>;
};

// The on/off switch. "Scheduled" counts as on, so switching it off cancels the schedule.
const Switch = ({ on, busy, disabled, label, onChange }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} disabled={disabled || busy} onClick={() => onChange(!on)}
    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 ${on ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"} ${busy ? "animate-pulse" : ""}`}>
    <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-6" : "translate-x-1"}`} />
  </button>
);

const ScheduleDialog = ({ target, onClose, onConfirm, busy }) => {
  const [{ openedAt, choices }] = useState(() => ({ openedAt: Date.now(), choices: presets() }));
  const [value, setValue] = useState(() => localInput(choices[1][1]));
  const minimum = localInput(new Date(openedAt + 60000));
  const valid = value && new Date(value).getTime() > openedAt;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="schedule-title" onKeyDown={(event) => event.key === "Escape" && onClose()}>
    <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="schedule-title" className="text-lg font-black text-slate-950 dark:text-white">Schedule publishing</h2>
          <p className="mt-1 text-sm text-slate-500">{target.label} will go live for students automatically at this time. It stays hidden until then.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {choices.map(([label, date]) => <button key={label} type="button" onClick={() => setValue(localInput(date))} className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${value === localInput(date) ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-600 hover:border-primary hover:text-primary dark:border-white/10 dark:text-slate-300"}`}>{label}</button>)}
      </div>
      <label className="mt-4 block">
        <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">Date and time</span>
        <input type="datetime-local" value={value} min={minimum} onChange={(event) => setValue(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-primary dark:border-white/10 dark:bg-slate-950 dark:text-white" />
      </label>
      {value && !valid && <p role="alert" className="mt-2 text-xs font-bold text-rose-600">Choose a time in the future.</p>}
      <div className="mt-6 flex justify-end gap-2">
        <AdminActionButton variant="secondary" onClick={onClose}>Cancel</AdminActionButton>
        <AdminActionButton icon={CalendarClock} loading={busy} disabled={!valid || busy} onClick={() => onConfirm(new Date(value).toISOString())}>Schedule</AdminActionButton>
      </div>
    </div>
  </div>;
};

const TestPublishing = () => {
  const { boards, classes, groups, isLoadingContext } = useContext(AppContext);
  const [scope, setScope] = useState({ board: "", class: "", group: "", subject: "" });
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const [pending, setPending] = useState("");
  const [schedule, setSchedule] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setSubjects([]);
    if (!scope.board || !scope.class || !scope.group) return;
    axiosInstance.get(`/subjects?boardId=${scope.board}&classId=${scope.class}&groupId=${scope.group}`)
      .then((response) => setSubjects(sortByName(response.data.subjects || [])))
      .catch(() => setNotice({ type: "error", text: "Subjects could not be loaded." }));
  }, [scope.board, scope.class, scope.group]);

  const load = useCallback(async (quiet = false) => {
    if (!scope.subject) { setChapters(null); return; }
    if (!quiet) setLoading(true);
    try {
      const params = new URLSearchParams(Object.entries(scope).filter(([, value]) => value));
      const response = await axiosInstance.get(`/assessments/publishing?${params}`);
      setChapters(response.data.chapters || []);
    } catch (err) {
      setNotice({ type: "error", text: err.response?.data?.message || "Tests could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { setOpen(new Set()); load(); }, [load]);

  const change = (key, value) => {
    const reset = key === "subject" ? {} : { subject: "" };
    setScope((current) => ({ ...current, ...reset, [key]: value }));
    setNotice(null);
  };

  const act = async (target, action, startsAt) => {
    setPending(target.key);
    setNotice(null);
    try {
      const { data } = await axiosInstance.post("/assessments/publishing", { [target.kind]: target.id, action, startsAt });
      const created = data.created ? ` ${data.created} new ${data.created === 1 ? "test was" : "tests were"} created from the saved MCQs.` : "";
      const text = {
        publish: `${target.label} is now live for students.${created}`,
        unpublish: `${target.label} is now hidden from students.`,
        schedule: `${target.label} will go live on ${startsAt && opensLabel(startsAt)}.${created}`,
        addNew: `${data.added} new ${data.added === 1 ? "MCQ was" : "MCQs were"} added to the test for ${target.label}.`,
      }[action];
      setNotice({ type: "success", text });
      setSchedule(null);
      await load(true);
    } catch (err) {
      setNotice({ type: "error", text: err.response?.data?.message || "That change could not be saved. Please try again." });
    } finally {
      setPending("");
    }
  };

  const totals = useMemo(() => {
    const topics = (chapters || []).flatMap((chapter) => chapter.topics);
    return ["live", "scheduled", "off", "empty"].map((state) => [state, topics.filter((topic) => topic.state === state).length]);
  }, [chapters]);

  const uploadLink = (chapter, topic) => `/admin/assessments/questions?${new URLSearchParams(Object.entries({ ...scope, chapter: chapter._id, topic: topic?._id || "" }).filter(([, value]) => value))}`;

  const toggleOpen = (id) => setOpen((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const Controls = ({ target, item }) => {
    const on = item.state === "live" || item.state === "scheduled";
    const busy = pending === target.key;
    return <div className="flex items-center gap-2">
      {item.state !== "empty" && <button type="button" onClick={() => setSchedule(target)} disabled={busy} title={`Schedule ${target.label}`} aria-label={`Schedule ${target.label}`}
        className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-sky-50 hover:text-sky-700 disabled:opacity-40 dark:hover:bg-sky-500/10"><CalendarClock className="h-[18px] w-[18px]" /></button>}
      <Switch on={on} busy={busy} disabled={item.state === "empty"} label={`${on ? "Unpublish" : "Publish"} ${target.label}`} onChange={(value) => act(target, value ? "publish" : "unpublish")} />
    </div>;
  };

  return <div className="mx-auto max-w-6xl space-y-6">
    <AdminPageHeader icon={Radio} eyebrow="MCQ Tests" title="Publish Tests" description="Turn MCQ tests on or off for any topic or a whole chapter with one switch, or schedule them to go live automatically. Topics with saved MCQs but no test get a test made for them when you switch them on." />

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CustomSelect label="Board" value={scope.board} onChange={(value) => change("board", value)} options={boards} placeholder="Board" isLoading={isLoadingContext} />
        <CustomSelect label="Class" value={scope.class} onChange={(value) => change("class", value)} options={classes} placeholder="Class" isLoading={isLoadingContext} />
        <CustomSelect label="Group" value={scope.group} onChange={(value) => change("group", value)} options={groups} placeholder="Group" isLoading={isLoadingContext} />
        <CustomSelect label="Subject" value={scope.subject} onChange={(value) => change("subject", value)} options={subjects} placeholder="Subject" />
      </div>
    </section>

    {notice && <AdminAlert type={notice.type}>{notice.text}</AdminAlert>}

    {!scope.subject ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <ListChecks className="mx-auto h-9 w-9 text-slate-300" />
      <p className="mt-3 font-black text-slate-800">Choose a board, class, group and subject</p>
      <p className="mt-1 text-sm text-slate-500">Every chapter and topic of the subject will appear with a switch to publish or unpublish its MCQ test.</p>
    </div> : loading && !chapters ? <AdminLoader label="Loading tests..." /> : chapters && !chapters.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">This subject has no chapters yet. Add chapters and topics first.</div> : chapters && <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {totals.map(([state, count]) => <div key={state} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-black text-slate-950">{count}</p>
          <p className="mt-1"><StateBadge item={{ state }} /></p>
        </div>)}
      </div>

      <div className="space-y-3">
        {chapters.map((chapter) => {
          const expanded = open.has(chapter._id);
          const chapterTarget = { kind: "chapter", id: chapter._id, key: `c${chapter._id}`, label: `Chapter ${chapter.chapterNumber || ""} ${chapter.name}`.replace(/\s+/g, " ") };
          return <article key={chapter._id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${expanded ? "border-primary/30" : "border-slate-200"}`}>
            <div className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap sm:px-5">
              <button type="button" onClick={() => toggleOpen(chapter._id)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${expanded ? "" : "-rotate-90"}`} />
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-black text-primary-dark">{chapter.chapterNumber || "–"}</span>
                <span className="min-w-0">
                  <span className="block break-words font-black text-slate-900 sm:truncate">{chapter.name}</span>
                  <span className="block text-xs font-semibold text-slate-500">{chapter.topics.length} {chapter.topics.length === 1 ? "topic" : "topics"} · {chapter.mcqCount} MCQs</span>
                </span>
              </button>
              <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                <StateBadge item={chapter} />
                <div className="flex items-center gap-2"><span className="hidden text-xs font-bold text-slate-400 md:inline">Whole chapter</span><Controls target={chapterTarget} item={chapter} /></div>
              </div>
            </div>
            {expanded && <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/60">
              {!chapter.topics.length && <li className="p-5 text-sm text-slate-500">No topics in this chapter yet.</li>}
              {chapter.topics.map((topic) => {
                const target = { kind: "topic", id: topic._id, key: `t${topic._id}`, label: topic.name };
                return <li key={topic._id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:pl-14 sm:pr-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="rounded-lg bg-white px-2 py-1 text-xs font-black text-primary-dark ring-1 ring-slate-200">{topic.topicNumber}</span>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-bold text-slate-900 sm:truncate">{topic.name}</p>
                      <p className="text-xs text-slate-500">{topic.mcqCount} MCQs{topic.tests.length > 0 && ` · ${topic.tests.length} ${topic.tests.length === 1 ? "test" : "tests"}`}</p>
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
                    <div className="flex flex-wrap items-center gap-2">
                      {topic.state === "empty" ? <Link to={uploadLink(chapter, topic)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-black text-white hover:bg-primary-dark"><Upload className="h-3.5 w-3.5" />Add MCQs</Link> : <StateBadge item={topic} />}
                      {topic.newMcqCount > 0 && topic.tests.length > 0 && <button type="button" onClick={() => act(target, "addNew")} disabled={pending === target.key} title="These MCQs were saved after the test was built" className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-100 disabled:opacity-50"><Plus className="h-3.5 w-3.5" />Add {topic.newMcqCount} new {topic.newMcqCount === 1 ? "MCQ" : "MCQs"}</button>}
                    </div>
                    <Controls target={target} item={topic} />
                  </div>
                </li>;
              })}
              {chapter.unassignedMcqCount > 0 && <li className="px-4 py-3 text-xs text-amber-700 sm:pl-14">{chapter.unassignedMcqCount} MCQs in this chapter have no topic, so they are not in any topic test. <Link to={uploadLink(chapter)} className="font-black underline">Assign them to topics</Link></li>}
            </ul>}
          </article>;
        })}
      </div>
      <p className="text-xs leading-5 text-slate-500">Times are Pakistan time. A scheduled test goes live by itself at its time; switching it off cancels the schedule. Unpublishing never deletes a test, its MCQs or student results. To change which MCQs are in a test, use <Link to="/admin/assessments/builder" className="font-bold text-primary underline">MCQ Tests</Link>.</p>
    </>}

    {schedule && <ScheduleDialog target={schedule} busy={pending === schedule.key} onClose={() => setSchedule(null)} onConfirm={(startsAt) => act(schedule, "schedule", startsAt)} />}
  </div>;
};

export default TestPublishing;
