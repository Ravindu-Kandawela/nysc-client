import React, { useState, useEffect } from 'react';
import { Plus, Award, Calendar, Users, Clock, Check, Edit2, Trash2 } from 'lucide-react';
import { api } from '../api';

export default function Batches({ onBatchCreated }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [form, setForm] = useState({
    name: '',
    start_date: new Date().toISOString().slice(0, 10),
    planned_months: 6,
    hours_per_day: 6.5,
    start_time: '09:00:00',
    end_time: '16:00:00'
  });

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await api.get('/batches');
      setBatches(res || []);
    } catch (err) {
      console.error('Batches load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleCreate = async () => {
    if (!form.name || !form.start_date) {
      alert('Name and start date are required');
      return;
    }
    try {
      const res = await api.post('/batches', form);
      setCreateOpen(false);
      await fetchBatches();
      if (onBatchCreated) onBatchCreated(res.id);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenEdit = (batch) => {
    setEditForm({
      id: batch.id,
      name: batch.name,
      start_date: batch.start_date ? batch.start_date.slice(0, 10) : '',
      planned_months: batch.planned_months || 6,
      target_hours_per_month: batch.target_hours_per_month || 120,
      status: batch.status || 'active'
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.name || !editForm.start_date) {
      alert('Name and start date are required');
      return;
    }
    try {
      await api.put(`/batches/${editForm.id}`, editForm);
      setEditOpen(false);
      await fetchBatches();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteBatch = async (batch) => {
    if (!confirm(`Are you sure you want to delete batch "${batch.name}"? This will delete all its lessons, attendance, and student data.`)) return;
    try {
      await api.delete(`/batches/${batch.id}`);
      await fetchBatches();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Course Batches</h2>
          <p className="text-xs text-slate-500 mt-0.5">NVQ-4 ICT Technician Training Batches</p>
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Create Batch
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {batches.map(b => (
          <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wider">
                  {b.ncs_code}
                </span>
                <h3 className="font-bold text-slate-900 text-base mt-0.5">{b.name}</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {b.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Starts: <strong>{b.start_date}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-400" />
                <span>Students: <strong>{b.active_students || 0}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Duration: <strong>{b.planned_months} Months</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-slate-400" />
                <span>Delivered: <strong>{b.total_delivered_hours || 0} h</strong></span>
              </div>
            </div>

            <div className="pt-3 border-t text-xs flex justify-between items-center text-slate-500">
              <div className="flex items-center gap-2">
                <span>Plan: <strong>v{b.current_plan_version || 1}</strong></span>
                <span className="text-brand-600 font-semibold">· 6.5 h/day</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenEdit(b)}
                  className="p-1.5 text-slate-600 hover:text-brand-600 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Edit Batch"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => handleDeleteBatch(b)}
                  className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Delete Batch"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Create New Batch</h3>
              <button onClick={() => setCreateOpen(false)} className="text-slate-400">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Name:</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date:</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Months):</label>
                  <input
                    type="number"
                    value={form.planned_months}
                    onChange={(e) => setForm({ ...form, planned_months: Number(e.target.value) })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Daily Hours:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={form.hours_per_day}
                    onChange={(e) => setForm({ ...form, hours_per_day: Number(e.target.value) })}
                    className="w-full border rounded-lg p-2 text-sm font-bold text-brand-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time:</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Time:</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button onClick={() => setCreateOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold">Create Batch</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Batch Modal */}
      {editOpen && editForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Edit Batch</h3>
              <button onClick={() => setEditOpen(false)} className="text-slate-400">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Name:</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date:</label>
                <input
                  type="date"
                  value={editForm.start_date}
                  onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Planned Months:</label>
                  <input
                    type="number"
                    value={editForm.planned_months}
                    onChange={(e) => setEditForm({ ...editForm, planned_months: Number(e.target.value) })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status:</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm font-semibold"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Target Hours:</label>
                <input
                  type="number"
                  value={editForm.target_hours_per_month}
                  onChange={(e) => setEditForm({ ...editForm, target_hours_per_month: Number(e.target.value) })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button onClick={() => setEditOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
