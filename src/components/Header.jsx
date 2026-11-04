import React from 'react';
import { useLocation } from 'react-router-dom';
import { Calendar, GraduationCap, ChevronDown } from 'lucide-react';

const PAGE_TITLES = {
  '/': 'Daily Overview & Schedule',
  '/attendance': 'Student Attendance Register',
  '/my-attendance': 'Instructor Attendance (In / Out)',
  '/plan': 'Master Lesson Plan & Work Plan',
  '/checklists': 'Continuous Assessment Checklists',
  '/diary': 'Daily Teaching Work Diary',
  '/assignments': 'Practical Assignments & Submissions',
  '/monthly-report': 'Monthly Progress Report (උපදේශක සටහන්)',
  '/batches': 'Batch & Intake Configuration',
  '/students': 'Trainee Register',
  '/holidays': 'Public & Custom Holiday Calendar',
  '/settings': 'Centre & Instructor Settings'
};

export default function Header({ batches = [], activeBatchId, onSelectBatch }) {
  const location = useLocation();
  const activeBatch = batches.find(b => b.id === Number(activeBatchId)) || batches[0];
  const currentTitle = PAGE_TITLES[location.pathname] || 'NYSC Training Records';
  const todayStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <header className="bg-white/95 backdrop-blur-xs border-b border-slate-200/90 px-4 py-2.5 md:px-6 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-semibold text-slate-800 truncate hidden sm:inline">
          {currentTitle}
        </span>
        <span className="text-slate-300 hidden sm:inline">/</span>

        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-xs font-medium text-slate-500">Intake:</span>
        </div>

        {batches.length > 0 ? (
          <div className="relative">
            <select
              value={activeBatchId || ''}
              onChange={(e) => onSelectBatch(Number(e.target.value))}
              className="appearance-none bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-xs rounded-md pl-2.5 pr-7 py-1.5 border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer transition-colors"
            >
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.active_students || 0} trainees)
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        ) : (
          <span className="text-xs font-medium text-slate-500">No active batches</span>
        )}

        {activeBatch && (
          <span className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            Active Batch
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/80 tabular-nums">
        <Calendar className="w-3.5 h-3.5 text-slate-400" />
        <span>{todayStr}</span>
      </div>
    </header>
  );
}
