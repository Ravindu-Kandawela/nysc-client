import React, { useState, useEffect } from 'react';
import { Users, UserPlus, ClipboardPaste, Trash2, Edit2, CheckCircle2, XCircle, Phone } from 'lucide-react';
import { api } from '../api';

export default function Students({ batchId }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [singleOpen, setSingleOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editStudent, setEditStudent] = useState(null);

  const [singleForm, setSingleForm] = useState({ 
    full_name: '', reg_no: '', email: '', phone: '', parent_name: '', parent_phone: '' 
  });
  const [bulkText, setBulkText] = useState('');

  const fetchStudents = async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const res = await api.get(`/batches/${batchId}/students`);
      setStudents(res || []);
    } catch (err) {
      console.error('Students error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [batchId]);

  const handleAddSingle = async () => {
    if (!singleForm.full_name.trim()) return alert('Name is required');
    try {
      await api.post(`/batches/${batchId}/students`, singleForm);
      setSingleOpen(false);
      setSingleForm({ full_name: '', reg_no: '', email: '', phone: '', parent_name: '', parent_phone: '' });
      await fetchStudents();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddBulk = async () => {
    if (!bulkText.trim()) return alert('Please paste student list');
    try {
      await api.post(`/batches/${batchId}/students/bulk`, { text: bulkText });
      setBulkOpen(false);
      setBulkText('');
      await fetchStudents();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleDrop = async (student) => {
    const isDropping = student.status === 'active';
    if (!confirm(`${isDropping ? 'Mark dropped' : 'Reactivate'} ${student.full_name}?`)) return;
    try {
      await api.put(`/batches/${batchId}/students/${student.id}`, {
        status: isDropping ? 'dropped' : 'active'
      });
      await fetchStudents();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeletePermanent = async (student) => {
    if (!confirm(`Permanently delete ${student.full_name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/batches/${batchId}/students/${student.id}?soft=false`);
      await fetchStudents();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await api.put(`/batches/${batchId}/students/${editStudent.id}`, editStudent);
      setEditStudent(null);
      await fetchStudents();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Enrolled Students</h2>
          <p className="text-xs text-slate-500 mt-0.5">Total: {students.length} students enrolled in active batch</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setBulkOpen(true)}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 flex items-center gap-1.5"
          >
            <ClipboardPaste className="w-3.5 h-3.5" /> Bulk Paste Names
          </button>
          <button
            onClick={() => setSingleOpen(true)}
            className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Student
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b text-slate-600 font-bold uppercase tracking-wider">
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3">Full Name</th>
                <th className="p-3">Registration No.</th>
                <th className="p-3">Parent / Guardian Contact</th>
                <th className="p-3">Student Email / Phone</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((st, i) => (
                <tr key={st.id} className="hover:bg-slate-50/60">
                  <td className="p-3 text-center font-bold text-slate-400">{i + 1}</td>
                  <td className="p-3 font-bold text-slate-900">{st.full_name}</td>
                  <td className="p-3 text-slate-600">{st.reg_no || '-'}</td>
                  <td className="p-3">
                    {st.parent_phone ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800">{st.parent_name || 'Guardian'}</span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200 flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5 text-blue-500" /> {st.parent_phone}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">No parent phone</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-600">
                    <div>{st.email || '-'}</div>
                    {st.phone && <div className="text-[11px] text-slate-500 font-mono">📱 {st.phone}</div>}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      st.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {st.status}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-1">
                    <button
                      onClick={() => setEditStudent(st)}
                      className="p-1 text-slate-500 hover:text-brand-600"
                      title="Edit student"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleDrop(st)}
                      className={`p-1 ${st.status === 'active' ? 'text-amber-500 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-800'}`}
                      title={st.status === 'active' ? 'Mark as dropped' : 'Reactivate'}
                    >
                      {st.status === 'active' ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDeletePermanent(st)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                      title="Permanently delete"
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

      {/* Bulk Paste Modal */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Bulk Paste Students</h3>
              <button onClick={() => setBulkOpen(false)} className="text-slate-400">✕</button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Paste student names (one per line, e.g. "1. Student Name" or "RegNo, Name, Email"):
              </label>
              <textarea
                rows={10}
                placeholder={"1. Student Full Name\n2. Another Student Name\n..."}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="w-full border rounded-xl p-3 text-xs font-mono"
              />
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button onClick={() => setBulkOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={handleAddBulk} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold">Import Students</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Edit Student &amp; Parent Details</h3>
              <button onClick={() => setEditStudent(null)} className="text-slate-400">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name:</label>
                <input
                  type="text"
                  value={editStudent.full_name}
                  onChange={(e) => setEditStudent({ ...editStudent, full_name: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reg No:</label>
                <input
                  type="text"
                  value={editStudent.reg_no || ''}
                  onChange={(e) => setEditStudent({ ...editStudent, reg_no: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student Phone:</label>
                  <input
                    type="text"
                    placeholder="07X XXX XXXX"
                    value={editStudent.phone || ''}
                    onChange={(e) => setEditStudent({ ...editStudent, phone: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student Email:</label>
                  <input
                    type="email"
                    value={editStudent.email || ''}
                    onChange={(e) => setEditStudent({ ...editStudent, email: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              {/* Parent Details for Absentee Alerts */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-brand-600" /> Parent / Guardian Information (Absence Alerts)
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Parent / Guardian Name:</label>
                  <input
                    type="text"
                    placeholder="e.g. T.L. Gunadasa"
                    value={editStudent.parent_name || ''}
                    onChange={(e) => setEditStudent({ ...editStudent, parent_name: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Parent Mobile Phone (WhatsApp / SMS):</label>
                  <input
                    type="text"
                    placeholder="e.g. 077 123 4567"
                    value={editStudent.parent_phone || ''}
                    onChange={(e) => setEditStudent({ ...editStudent, parent_phone: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button onClick={() => setEditStudent(null)} className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Single Add Modal */}
      {singleOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Add Student</h3>
              <button onClick={() => setSingleOpen(false)} className="text-slate-400">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Kasun Chamara"
                  value={singleForm.full_name}
                  onChange={(e) => setSingleForm({ ...singleForm, full_name: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Registration No:</label>
                <input
                  type="text"
                  placeholder="e.g. NYSC/2026/012"
                  value={singleForm.reg_no}
                  onChange={(e) => setSingleForm({ ...singleForm, reg_no: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student Phone:</label>
                  <input
                    type="text"
                    placeholder="07X XXX XXXX"
                    value={singleForm.phone}
                    onChange={(e) => setSingleForm({ ...singleForm, phone: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email:</label>
                  <input
                    type="email"
                    placeholder="student@example.com"
                    value={singleForm.email}
                    onChange={(e) => setSingleForm({ ...singleForm, email: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              {/* Parent Details */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-brand-600" /> Parent / Guardian Information (Absence Alerts)
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Parent / Guardian Name:</label>
                  <input
                    type="text"
                    placeholder="e.g. T.L. Gunadasa"
                    value={singleForm.parent_name}
                    onChange={(e) => setSingleForm({ ...singleForm, parent_name: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Parent Mobile Phone (WhatsApp / SMS):</label>
                  <input
                    type="text"
                    placeholder="e.g. 077 123 4567"
                    value={singleForm.parent_phone}
                    onChange={(e) => setSingleForm({ ...singleForm, parent_phone: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button onClick={() => setSingleOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={handleAddSingle} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold">Add Student</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
