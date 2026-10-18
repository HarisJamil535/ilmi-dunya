import { useContext, useState } from 'react';
import { ArrowRight, Building2, GraduationCap, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { showStudentToast } from '../../shared/studentNotifications';

const sorted = items => [...items].sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));

export default function StudyPathSelector({ options }) {
  const context = useContext(AppContext);
  const boards = sorted(options?.boards || context.boards);
  const classes = sorted(options?.classes || context.classes);
  const groups = sorted(options?.groups || context.groups);
  const [boardId, setBoardId] = useState('');
  const [classId, setClassId] = useState('');
  const [groupId, setGroupId] = useState('');
  const navigate = useNavigate();
  const submit = event => {
    event.preventDefault();
    const board = boards.find(item => item._id === boardId);
    const grade = classes.find(item => item._id === classId);
    const group = groups.find(item => item._id === groupId);
    if (!board || !grade || (!group && groupId !== 'all')) {
      showStudentToast({ type: 'warning', title: 'Choose your study path', message: 'Select your board, class and group to continue.' });
      return;
    }
    const params = new URLSearchParams({ boardId, classId,
      board: board.name.replace(/\s*board/i, '').trim().toLowerCase(),
      class: String(grade.classNumber || grade.name).replace(/class\s*/i, '').trim(),
    });
    if (group) { params.set('groupId', groupId); params.set('group', group.name); }
    navigate(`/subjects?${params}`);
  };
  return <form className="study-path" onSubmit={submit} noValidate aria-label="Choose your study path">
    <div className="study-path-fields">
      <label><span><Building2 size={18} /> Board</span><select aria-label="Board" value={boardId} onChange={event => { setBoardId(event.target.value); setClassId(''); setGroupId(''); }} required>
        <option value="">Choose your board</option>{boards.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}
      </select></label>
      <label><span><GraduationCap size={18} /> Class</span><select aria-label="Class" value={classId} disabled={!boardId} onChange={event => { setClassId(event.target.value); setGroupId(''); }} required>
        <option value="">Choose your class</option>{classes.map(item => <option key={item._id} value={item._id}>Class {String(item.classNumber || item.name).replace(/class\s*/i, '').trim()}</option>)}
      </select></label>
      <label><span><Users size={18} /> Group</span><select aria-label="Group" value={groupId} disabled={!classId} onChange={event => setGroupId(event.target.value)} required>
        <option value="">Choose your group</option><option value="all">All groups</option>{groups.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}
      </select></label>
    </div>
    <button className="study-path-submit" type="submit">Start learning <ArrowRight size={18} /></button>
  </form>;
}
