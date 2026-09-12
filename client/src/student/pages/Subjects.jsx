import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axios';
import SubjectCard from '../components/SubjectCard';
import SideBar from '../components/SideBar';

const Subjects = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract all three filter parameters from URL
  const grade = searchParams.get('class');
  const board = searchParams.get('board');
  const group = searchParams.get('group'); // <--- Added group extraction

  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSubjects = async () => {
      if (!board || !grade) return;

      setIsLoading(true);
      setError(null);

      try {
        // Construct query string including group if present
        let query = `/subjects?board=${board}&class=${grade}`;
        if (group) {
          query += `&group=${group}`;
        }

        const response = await axiosInstance.get(query);
        const data = response.data.subjects || response.data || [];
        setSubjects(data);
      } catch (err) {
        console.error('Failed to fetch subjects from database:', err);
        setError('Failed to load subjects. Please try again.');
        setSubjects([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubjects();
  }, [board, grade, group]); // <--- Added group to dependency array

  const handleSubjectClick = (subject) => {
    const subjectName = typeof subject === 'string' ? subject : subject.name;
    const subjectId = subject._id;

    const urlFriendlySubject = subjectName.toLowerCase().replace(/\s+/g, '-');
    let targetUrl = `/chapters?subjectId=${subjectId}&subject=${urlFriendlySubject}&class=${grade}&board=${board}`;
    if (group) {
      targetUrl += `&group=${group}`;
    }

    navigate(targetUrl);
  };

  return (
    <main className="flex gap-6 h-[calc(100vh-64px)] bg-[#F8FAFC]">
      <SideBar />

      <div className="flex flex-col flex-1 overflow-y-auto gap-6 pt-10 px-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-[#0F172A] font-extrabold text-2xl lg:text-[2rem] leading-tight tracking-tight mb-1 max-w-2xl">
            Following are all Subjects of{" "}
            <span className="text-[#4F46E5] relative inline-block capitalize">
              {board} Board
              <svg className="absolute -bottom-1 left-0 w-full" height="4" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden>
                <path d="M0 3 Q50 0 100 3" stroke="#4F46E5" strokeWidth="2" fill="none" strokeOpacity="0.35" />
              </svg>
            </span>
            {", "}Class{" "}
            <span className="text-[#4F46E5]">{grade}<sup className="text-[#4F46E5]">th</sup></span>
            {group && <span className="text-slate-500 capitalize font-medium text-xl"> ({group})</span>}
          </h1>

          <p className="text-[#64748B] text-[14px] lg:text-[15px] leading-relaxed max-w-xl font-medium">
            Select a subject to view related study materials, past papers, and video lectures.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-[#64748B]">
            <p className="font-semibold text-base">Loading subjects from database...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl max-w-md">
            {error}
          </div>
        ) : subjects.length === 0 ? (
          <div className="py-16 text-center text-slate-500 max-w-md">
            <p className="font-semibold text-lg text-slate-700">No subjects found</p>
            <p className="text-sm mt-1">
              No subjects matched {board} Board Class {grade} {group ? `(${group} Group)` : ''}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1200px]">
            {subjects.map((subject) => (
              <SubjectCard
                key={subject._id || subject.name}
                subj={subject.name || subject}
                onClick={() => handleSubjectClick(subject)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default Subjects;