import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Upload, Check, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../api';

export default function Holidays() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [form, setForm] = useState({
    hdate: '',
    name: '',
    type: 'public',
    is_off: 1,
    verified: 1
  });
  const [csvText, setCsvText] = useState('');

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const res = await api.get('/holidays');
      setHolidays(res || []);
    } catch (err) {
      console.error('Holidays error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleToggleOff = async (h) => {
    try {
      const newOff = h.is_off ? 0 : 1;
      await api.put(`/holidays/${h.id}`, { is_off: newOff });
      setHolidays(prev => prev.map(item => item.id === h.id ? { ...item, is_off: newOff } : item));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this holiday?')) return;
    try {
      await api.delete(`/holidays/${id}`);
      setHolidays(prev => prev.filter(h => h.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAdd = async () => {
    if (!form.hdate || !form.name) return alert('Date and Name are required');
    try {
      await api.post('/holidays', form);
      setAddOpen(false);
      setForm({ hdate: '', name: '', type: 'public', is_off: 1, verified: 1 });
      await fetchHolidays();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleImport = async () => {
    if (!csvText.trim()) return alert('Paste CSV text');
    try {
      await api.post('/holidays/import', { csvText });
      setImportOpen(false);
      setCsvText('');
      await fetchHolidays();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Sri Lanka Holidays</h2>
          <p className="text-xs text-slate-500 mt-0.5">User-managed calendar · Holidays that are OFF push teaching days</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Holiday
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b text-slate-600 font-bold uppercase tracking-wider">
                <th className="p-3 w-28">Date</th>
                <th className="p-3">Holiday Name</th>
                <th className="p-3">Type</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Verified</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {holidays.map(h => (
                <tr key={h.id} className="hover:bg-slate-50/60">
                  <td className="p-3 font-bold text-slate-900">{h.hdate}</td>
                  <td className="p-3 font-semibold text-slate-800">{h.name}</td>
                  <td className="p-3 text-slate-500 capitalize">{h.type.replace('_', ' ')}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleToggleOff(h)}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-colors ${
                        h.is_off ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {h.is_off ? 'No Class (OFF)' : 'Still Teaching'}
                    </button>
                  </td>
                  <td className="p-3 text-center">
                    {h.verified ? (
                      <span className="text-emerald-600 font-bold">✓ Verified</span>
                    ) : (
                      <span className="text-amber-600 font-medium">Pending</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleDelete(h.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Holiday Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Add Holiday</h3>
              <button onClick={() => setAddOpen(false)} className="text-slate-400">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date:</label>
                <input
                  type="date"
                  value={form.hdate}
                  onChange={(e) => setForm({ ...form, hdate: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Esala Poya Day"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Type:</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                >
                  <option value="public">Public Holiday</option>
                  <option value="poya">Full Moon Poya Day</option>
                  <option value="bank">Bank Holiday</option>
                  <option value="institute_closure">Institute Special Closure</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={handleAdd} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold">Add Holiday</button>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Import Holidays CSV</h3>
              <button onClick={() => setImportOpen(false)} className="text-slate-400">✕</button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Paste lines in format `YYYY-MM-DD, Holiday Name, type`:
              </label>
              <textarea
                rows={6}
                placeholder="2026-10-25, Vap Full Moon Poya Day, poya&#10;2026-11-08, Deepavali Festival Day, public"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full border rounded-xl p-3 text-xs font-mono"
              />
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button onClick={() => setImportOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={handleImport} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold">Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
