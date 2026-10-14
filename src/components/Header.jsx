import React from 'react';
import { Calendar, GraduationCap, ChevronDown } from 'lucide-react';

export default function Header({ batches = [], activeBatchId, onSelectBatch }) {
  const activeBatch = batches.find(b => b.id === Number(activeBatchId)) || batches[0];
  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 md:px-6 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-brand-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Batch:</span>
        </div>

        {batches.length > 0 ? (
          <div className="relative">
            <select
              value={activeBatchId || ''}
              onChange={(e) => onSelectBatch(Number(e.target.value))}
              className="appearance-none bg-slate-100 hover:bg-slate-200/80 text-slate-900 font-semibold text-sm rounded-lg pl-3 pr-8 py-1.5 border border-slate-300/80 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer transition-colors"
            >
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.active_students || 0} students)
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        ) : (
          <span className="text-sm font-medium text-slate-500">No active batches</span>
        )}

        {activeBatch && (
          <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Active
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
        <Calendar className="w-3.5 h-3.5 text-slate-400" />
        <span>{todayStr}</span>
      </div>
    </header>
  );
}
