import React, { useState, useEffect } from 'react';
import { BookMarked, Sparkles, Check, Edit2, Calendar, Clock, CheckCircle } from 'lucide-react';
import { api } from '../api';

export default function WorkDiary({ batchId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchEntries = async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const res = await api.get(`/batches/${batchId}/diary`);
      setEntries(res || []);
    } catch (err) {
      console.error('Diary fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [batchId]);

  const handleDraftToday = async () => {
    const today = new Date().toISOString().slice(0, 10);
    setDrafting(true);
    try {
      await api.post(`/batches/${batchId}/diary/generate`, { date: today });
      await fetchEntries();
    } catch (err) {
      alert(err.message);
    } finally {
      setDrafting(false);
    }
  };

  const handleOpenEdit = (entry) => {
    setEditingEntry(entry);
    setEditForm({
      summary_text: entry.summary_text || '',
      activities_text: entry.activities_text || 'න්‍යායාත්මක හා ප්‍රායෝගික ක්‍රියාකාරකම්',
      time_text: entry.time_text || '09:00 - 16:00',
      hours_delivered: entry.hours_delivered || 0,
      remarks: entry.remarks || '',
      students_present: entry.students_present || 0,
      students_total: entry.students_total || 0,
      status: entry.status || 'draft'
    });
  };

  const handleSaveEdit = async () => {
    try {
      await api.put(`/batches/${batchId}/diary/${editingEntry.ddate}`, editForm);
      setEditingEntry(null);
      await fetchEntries();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleConfirm = async (date) => {
    try {
      await api.post(`/batches/${batchId}/diary/${date}/confirm`, {});
      await fetchEntries();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-5 pb-24 md:pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Instructor Work Diary</h2>
          <p className="text-xs text-slate-500 mt-0.5">Daily teaching logs · Auto-drafted from plan</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDraftToday}
            disabled={drafting}
            className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" /> {drafting ? 'Drafting...' : 'Auto-Draft Today'}
          </button>
        </div>
      </div>

      {/* Entries List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100">
        {entries.length === 0 ? (
          <div className="text-center py-12">
            <BookMarked className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">No diary entries recorded yet.</p>
            <p className="text-xs text-slate-400 mt-1">Click "Auto-Draft Today" or mark attendance to generate entries.</p>
          </div>
        ) : (
          entries.map(entry => (
            <div 
              key={entry.id}
              className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{entry.ddate}</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    entry.status === 'confirmed' 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {entry.status === 'confirmed' ? '✓ Confirmed' : 'Draft'}
                  </span>
                  <span className="text-xs text-slate-400">· {entry.time_text}</span>
                </div>

                <p className="text-xs text-slate-700 font-medium">{entry.summary_text}</p>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                  <span>Activities: {entry.activities_text}</span>
                  {entry.students_present !== null && (
                    <span>Students: {entry.students_present}/{entry.students_total} present</span>
                  )}
                  {entry.remarks && <span className="text-amber-700">Remarks: {entry.remarks}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <span className="px-2.5 py-1 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {entry.hours_delivered} h
                </span>

                <button
                  onClick={() => handleOpenEdit(entry)}
                  className="p-1.5 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Edit entry"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                {entry.status === 'draft' && (
                  <button
                    onClick={() => handleConfirm(entry.ddate)}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-xs font-semibold"
                  >
                    Confirm
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Edit Diary Entry ({editingEntry.ddate})</h3>
              <button onClick={() => setEditingEntry(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Module / Short Description / Summary:
                </label>
                <textarea
                  rows={2}
                  value={editForm.summary_text}
                  onChange={(e) => setEditForm({ ...editForm, summary_text: e.target.value })}
                  className="w-full border rounded-lg p-2 text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Activities (Theory / Practical / OJT):
                </label>
                <input
                  type="text"
                  value={editForm.activities_text}
                  onChange={(e) => setEditForm({ ...editForm, activities_text: e.target.value })}
                  className="w-full border rounded-lg p-2 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Time Spent:</label>
                  <input
                    type="text"
                    value={editForm.time_text}
                    onChange={(e) => setEditForm({ ...editForm, time_text: e.target.value })}
                    className="w-full border rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hours Delivered:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editForm.hours_delivered}
                    onChange={(e) => setEditForm({ ...editForm, hours_delivered: Number(e.target.value) })}
                    className="w-full border rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks:</label>
                <input
                  type="text"
                  placeholder="Optional remarks..."
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  className="w-full border rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status:</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full border rounded-lg p-2 text-xs"
                >
                  <option value="draft">Draft</option>
                  <option value="confirmed">Confirmed</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button
                onClick={() => setEditingEntry(null)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
