import { useMemo, useState } from "react";
import CustomSelect from "../../shared/CustomSelect";

const label = (text) => <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">{text}</span>;
const NONE = "none";

// Board, then group, then class, then subject. Each list only shows what has subjects under the choices above it.
export default function SubjectPicker({ catalog, value, onChange }) {
  const current = catalog.subjects.find((s) => s._id === value);
  const [board, setBoard] = useState(current?.board || "");
  const [group, setGroup] = useState(current ? current.group || NONE : "");
  const [klass, setKlass] = useState(current?.class || "");
  const named = (list, ids) => list.filter((item) => ids.has(item._id)).map((item) => ({ value: item._id, label: item.name }));

  const inBoard = useMemo(() => catalog.subjects.filter((s) => !board || s.board === board), [catalog, board]);
  const inGroup = useMemo(() => inBoard.filter((s) => !group || (group === NONE ? !s.group : s.group === group)), [inBoard, group]);
  const inClass = useMemo(() => inGroup.filter((s) => !klass || s.class === klass), [inGroup, klass]);
  const boards = named(catalog.boards, new Set(catalog.subjects.map((s) => s.board)));
  const groups = [...named(catalog.groups, new Set(inBoard.map((s) => s.group).filter(Boolean))), ...(inBoard.some((s) => !s.group) ? [{ value: NONE, label: "No group (all students)" }] : [])];
  const classes = named(catalog.classes, new Set(inGroup.map((s) => s.class)));
  const subjects = inClass.map((s) => ({ value: s._id, label: s.name }));

  // When a list has only one choice it is chosen for the teacher.
  const pickBoard = (next) => {
    setBoard(next); setGroup(""); setKlass("");
    const left = catalog.subjects.filter((s) => !next || s.board === next);
    const gs = new Set(left.map((s) => s.group || NONE));
    if (gs.size === 1) setGroup([...gs][0]);
  };
  const pickGroup = (next) => {
    setGroup(next); setKlass("");
    const cs = new Set(inBoard.filter((s) => !next || (next === NONE ? !s.group : s.group === next)).map((s) => s.class));
    if (cs.size === 1) setKlass([...cs][0]);
  };
  const pickClass = (next) => {
    setKlass(next);
    const left = inGroup.filter((s) => !next || s.class === next);
    if (left.length === 1) onChange(left[0]._id);
  };

  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <div>{label("Board")}<CustomSelect value={board} onChange={pickBoard} options={boards} placeholder="All boards" searchable /></div>
    <div>{label("Group")}<CustomSelect value={group} onChange={pickGroup} options={groups} placeholder={groups.length ? "All groups" : "No groups"} disabled={!groups.length} /></div>
    <div>{label("Class")}<CustomSelect value={klass} onChange={pickClass} options={classes} placeholder="All classes" searchable /></div>
    <div>{label("Subject")}<CustomSelect value={value} onChange={(next) => next && onChange(next)} options={subjects} placeholder={subjects.length ? "Choose subject" : "No subjects"} disabled={!subjects.length} searchable allowClear={false} /></div>
  </div>;
}
