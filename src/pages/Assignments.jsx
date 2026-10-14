import React, { useState, useEffect } from 'react';
import { Send, Plus, Users, Clock, CheckCircle2, AlertCircle, FileText, ExternalLink, Edit2, Trash2, Paperclip, Copy, Check, Share2, MessageSquare } from 'lucide-react';
import { api, API_ORIGIN } from '../api';

export default function Assignments({ batchId }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [modules, setModules] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [assignmentDetail, setAssignmentDetail] = useState(null);
  const [sending, setSending] = useState(false);

  // Share links modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareData, setShareData] = useState({ title: '', due_at: '', recipients: [], message: '', has_smtp: false, emails_sent: 0 });
  const [copiedId, setCopiedId] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // New assignment form state & file
  const [form, setForm] = useState({
    title: '',
    module_id: '',
    instructions: '',
    drive_link: '',
    due_at: '',
    max_marks: 100
  });
  const [attachmentFile, setAttachmentFile] = useState(null);

  // Edit assignment state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editAttachmentFile, setEditAttachmentFile] = useState(null);

  // Grade form
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [gradingRecipient, setGradingRecipient] = useState(null);
  const [gradeForm, setGradeForm] = useState({
    result: 'correct',
    marks: 100,
    feedback: ''
  });

  const fetchAssignments = async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const res = await api.get(`/batches/${batchId}/assignments`);
      setAssignments(res || []);

      const bRes = await api.get(`/batches/${batchId}`);
      setModules(bRes.modules || []);
      if (bRes.modules?.length > 0 && !form.module_id) {
        setForm(f => ({ ...f, module_id: bRes.modules[0].module_id }));
      }
    } catch (err) {
      console.error('Assignments error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [batchId]);

  const loadDetail = async (id) => {
    try {
      const detail = await api.get(`/assignments/${id}`);
      setAssignmentDetail(detail);
      setSelectedAssignment(id);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreate = async () => {
    if (!form.title || !form.due_at) {
      alert('Title and due date are required');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('module_id', form.module_id);
      fd.append('instructions', form.instructions || '');
      fd.append('drive_link', form.drive_link || '');
      fd.append('due_at', form.due_at);
      fd.append('max_marks', form.max_marks || 100);
      if (attachmentFile) {
        fd.append('attachment', attachmentFile);
      }

      await api.post(`/batches/${batchId}/assignments`, fd);
      setCreateOpen(false);
      setAttachmentFile(null);
      setForm({ title: '', module_id: modules[0]?.module_id || '', instructions: '', drive_link: '', due_at: '', max_marks: 100 });
      await fetchAssignments();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenEdit = (assignment) => {
    setEditForm({
      id: assignment.id,
      title: assignment.title,
      module_id: assignment.module_id,
      instructions: assignment.instructions || '',
      drive_link: assignment.drive_link || '',
      due_at: assignment.due_at ? assignment.due_at.slice(0, 16) : '',
      max_marks: assignment.max_marks || 100,
      attachment_name: assignment.attachment_name,
      attachment_path: assignment.attachment_path,
      remove_attachment: false
    });
    setEditAttachmentFile(null);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.title || !editForm.due_at) {
      alert('Title and due date are required');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('title', editForm.title);
      fd.append('module_id', editForm.module_id);
      fd.append('instructions', editForm.instructions || '');
      fd.append('drive_link', editForm.drive_link || '');
      fd.append('due_at', editForm.due_at);
      fd.append('max_marks', editForm.max_marks || 100);
      if (editAttachmentFile) {
        fd.append('attachment', editAttachmentFile);
      } else if (editForm.remove_attachment) {
        fd.append('remove_attachment', 'true');
      }

      await api.put(`/assignments/${editForm.id}`, fd);
      setEditOpen(false);
      await fetchAssignments();
      if (selectedAssignment === editForm.id) {
        await loadDetail(editForm.id);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteAssignment = async (id) => {
    if (!confirm('Are you sure you want to delete this assignment and all associated student submissions? This cannot be undone.')) return;
    try {
      await api.delete(`/assignments/${id}`);
      if (selectedAssignment === id) {
        setSelectedAssignment(null);
        setAssignmentDetail(null);
      }
      await fetchAssignments();
    } catch (err) {
      alert(err.message);
    }
  };

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyAllWhatsApp = () => {
    if (!shareData.recipients || shareData.recipients.length === 0) return;
    const lines = [
      `📋 *Assignment: ${shareData.title}*`,
      `📅 *Due Date:* ${shareData.due_at || 'As scheduled'}`,
      `\n*Student Submission Links:*`
    ];
    shareData.recipients.forEach((r, idx) => {
      lines.push(`${idx + 1}. ${r.student_name}: ${r.link}`);
    });
    lines.push(`\n_Technical Training Centre – Akuressa | National Youth Services Council_`);
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handleSend = async (assignmentId) => {
    setSending(true);
    try {
      const res = await api.post(`/assignments/${assignmentId}/send`, {});
      await loadDetail(assignmentId);
      await fetchAssignments();

      const current = assignments.find(a => a.id === assignmentId) || assignmentDetail?.assignment || {};
      setShareData({
        title: current.title || 'Assignment',
        due_at: current.due_at ? current.due_at.slice(0, 16) : '',
        recipients: res.recipients || [],
        message: res.message,
        has_smtp: res.has_smtp,
        emails_sent: res.emails_sent
      });
      setShareModalOpen(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleOpenGrade = (recipient) => {
    setGradingRecipient(recipient);
    setGradeForm({
      result: recipient.grade_result || 'correct',
      marks: recipient.grade_marks !== null ? recipient.grade_marks : 100,
      feedback: recipient.grade_feedback || ''
    });
    setGradeModalOpen(true);
  };

  const handleSaveGrade = async () => {
    try {
      await api.post(`/assignments/submissions/${gradingRecipient.submission_id}/grade`, gradeForm);
      setGradeModalOpen(false);
      await loadDetail(selectedAssignment);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Module Assignments</h2>
          <p className="text-xs text-slate-500 mt-0.5">Email unique submission links & digital grading</p>
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Create Assignment
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Assignments List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            All Assignments ({assignments.length})
          </div>

          <div className="space-y-2">
            {assignments.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-400">
                No assignments created yet.
              </div>
            ) : (
              assignments.map(a => (
                <div
                  key={a.id}
                  onClick={() => loadDetail(a.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedAssignment === a.id
                      ? 'bg-brand-50/70 border-brand-500 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-700">{a.module_code}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      a.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {a.status}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm mt-1">{a.title}</h4>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>Due: {a.due_at.slice(0, 10)}</span>
                    <span>{a.submission_count || 0}/{a.recipient_count || 0} Submitted</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Details & Status Table */}
        <div className="lg:col-span-2">
          {assignmentDetail ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-xs font-bold text-brand-600">
                    {assignmentDetail.assignment.module_code} · {assignmentDetail.assignment.module_title}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    {assignmentDetail.assignment.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Due: <strong>{assignmentDetail.assignment.due_at}</strong> · Max Marks: {assignmentDetail.assignment.max_marks}
                  </p>
                  {assignmentDetail.assignment.instructions && (
                    <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-3 text-slate-700 whitespace-pre-wrap">
                      {assignmentDetail.assignment.instructions}
                    </div>
                  )}

                  {assignmentDetail.assignment.attachment_path && (
                    <div className="mt-3">
                      <a
                        href={`${API_ORIGIN || ''}/uploads/${assignmentDetail.assignment.attachment_path}`}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 text-xs transition-colors"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                        {assignmentDetail.assignment.attachment_name || 'Download Attached Worksheet'}
                      </a>
                    </div>
                  )}

                  {assignmentDetail.assignment.drive_link && (
                    <div className="mt-2">
                      <a
                        href={assignmentDetail.assignment.drive_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-200 text-xs transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                        Open Google Drive Worksheet
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenEdit(assignmentDetail.assignment)}
                    className="px-2.5 py-1.5 text-slate-600 hover:text-brand-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1"
                    title="Edit assignment"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>

                  <button
                    onClick={() => handleDeleteAssignment(assignmentDetail.assignment.id)}
                    className="px-2.5 py-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                    title="Delete assignment"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>

                  {assignmentDetail.recipients?.length > 0 && (
                    <button
                      onClick={() => {
                        setShareData({
                          title: assignmentDetail.assignment.title,
                          due_at: assignmentDetail.assignment.due_at ? assignmentDetail.assignment.due_at.slice(0, 16) : '',
                          recipients: assignmentDetail.recipients,
                          message: `${assignmentDetail.recipients.length} student submission links generated`,
                          has_smtp: false,
                          emails_sent: 0
                        });
                        setShareModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-2xs"
                      title="View and copy student submission links"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Share Links
                    </button>
                  )}

                  <button
                    onClick={() => handleSend(assignmentDetail.assignment.id)}
                    disabled={sending}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> {sending ? 'Sending...' : 'Send to Students'}
                  </button>
                </div>
              </div>

              {/* Recipients Status Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-slate-900 text-sm">Student Submission Status</h4>
                  {assignmentDetail.recipients?.length > 0 && (
                    <button
                      onClick={() => {
                        setShareData({
                          title: assignmentDetail.assignment.title,
                          due_at: assignmentDetail.assignment.due_at ? assignmentDetail.assignment.due_at.slice(0, 16) : '',
                          recipients: assignmentDetail.recipients,
                          message: `${assignmentDetail.recipients.length} student links ready to share`,
                          has_smtp: false,
                          emails_sent: 0
                        });
                        setShareModalOpen(true);
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> Copy WhatsApp Links
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b text-slate-600 font-bold uppercase tracking-wider">
                        <th className="p-2.5">Student</th>
                        <th className="p-2.5">Submission Link</th>
                        <th className="p-2.5 text-center">Status</th>
                        <th className="p-2.5">Submission Time</th>
                        <th className="p-2.5 text-center">Grade</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assignmentDetail.recipients.map(r => (
                        <tr key={r.recipient_id} className="hover:bg-slate-50/60">
                          <td className="p-2.5 font-semibold text-slate-900">
                            {r.student_name}
                            <div className="text-[10px] text-slate-400 font-normal">
                              {r.student_reg_no || ''} {r.student_email ? `· ${r.student_email}` : '· (No Email)'}
                            </div>
                          </td>

                          <td className="p-2.5">
                            {r.link ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => copyToClipboard(r.link, r.recipient_id)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors"
                                  title="Copy student link"
                                >
                                  {copiedId === r.recipient_id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span className="text-emerald-700 font-bold">Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-slate-500" />
                                      <span>Copy Link</span>
                                    </>
                                  )}
                                </button>
                                <a
                                  href={r.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50"
                                  title="Open student submission page"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Click 'Send to Students'</span>
                            )}
                          </td>

                          <td className="p-2.5 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  r.derived_status === 'Graded' ? 'bg-emerald-50 text-emerald-700' :
                                  r.derived_status === 'Submitted' ? 'bg-blue-50 text-blue-700' :
                                  r.derived_status === 'Late' ? 'bg-rose-50 text-rose-700' :
                                  r.derived_status === 'Opened' ? 'bg-amber-50 text-amber-700' :
                                  r.derived_status === 'Sent' ? 'bg-emerald-50 text-emerald-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}
                                title={r.email_error || ''}
                              >
                                {r.derived_status === 'Sent' ? 'Sent via Email' : r.derived_status}
                              </span>
                              {r.email_error && r.derived_status !== 'Graded' && r.derived_status !== 'Submitted' && (
                                <span className="text-[9px] text-slate-400 mt-0.5 max-w-[120px] truncate" title={r.email_error}>
                                  {r.student_email ? 'Direct link ready' : 'No email address'}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-2.5 text-slate-600">
                            {r.submitted_at ? r.submitted_at.replace('T', ' ').slice(0, 16) : '-'}
                          </td>

                          <td className="p-2.5 text-center font-bold">
                            {r.grade_result ? (
                              <span className="capitalize text-emerald-700">{r.grade_result} ({r.grade_marks}m)</span>
                            ) : '-'}
                          </td>

                          <td className="p-2.5 text-right">
                            {r.submission_id && (
                              <button
                                onClick={() => handleOpenGrade(r)}
                                className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded font-semibold text-[11px]"
                              >
                                Grade
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">Select an assignment to view submissions and grade</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Assignment Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Create New Assignment</h3>
              <button onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Module:</label>
                <select
                  value={form.module_id}
                  onChange={(e) => setForm({ ...form, module_id: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                >
                  {modules.map(m => (
                    <option key={m.module_id} value={m.module_id}>{m.code} - {m.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assignment Title:</label>
                <input
                  type="text"
                  placeholder="e.g. Assembling PC Component Practical Lab"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Instructions:</label>
                <textarea
                  rows={3}
                  placeholder="Provide detailed instructions, submission format requirements..."
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date & Time:</label>
                  <input
                    type="datetime-local"
                    value={form.due_at}
                    onChange={(e) => setForm({ ...form, due_at: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Max Marks:</label>
                  <input
                    type="number"
                    value={form.max_marks}
                    onChange={(e) => setForm({ ...form, max_marks: Number(e.target.value) })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google Drive Worksheet Link (Optional):
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/.../view"
                  value={form.drive_link}
                  onChange={(e) => setForm({ ...form, drive_link: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Paste a public Google Drive share link for direct cloud downloads</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Attach Worksheet / Material (Optional PDF, DOCX, etc.):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    onChange={(e) => setAttachmentFile(e.target.files[0] || null)}
                    className="w-full border rounded-lg p-1.5 text-xs file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                  />
                  {attachmentFile && (
                    <button
                      type="button"
                      onClick={() => setAttachmentFile(null)}
                      className="text-xs text-rose-500 font-bold hover:underline shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button onClick={() => setCreateOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold">Create Assignment</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {editOpen && editForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Edit Assignment</h3>
              <button onClick={() => setEditOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Module:</label>
                <select
                  value={editForm.module_id}
                  onChange={(e) => setEditForm({ ...editForm, module_id: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                >
                  {modules.map(m => (
                    <option key={m.module_id} value={m.module_id}>{m.code} - {m.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assignment Title:</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Instructions:</label>
                <textarea
                  rows={3}
                  value={editForm.instructions}
                  onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date & Time:</label>
                  <input
                    type="datetime-local"
                    value={editForm.due_at}
                    onChange={(e) => setEditForm({ ...editForm, due_at: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Max Marks:</label>
                  <input
                    type="number"
                    value={editForm.max_marks}
                    onChange={(e) => setEditForm({ ...editForm, max_marks: Number(e.target.value) })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google Drive Worksheet Link (Optional):
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/.../view"
                  value={editForm.drive_link}
                  onChange={(e) => setEditForm({ ...editForm, drive_link: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Attached File / Worksheet:
                </label>
                {editForm.attachment_name && !editForm.remove_attachment && (
                  <div className="mb-2 p-2 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between text-xs">
                    <span className="font-semibold text-indigo-800">Current: {editForm.attachment_name}</span>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, remove_attachment: true })}
                      className="text-rose-600 hover:underline font-bold"
                    >
                      Remove
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    onChange={(e) => {
                      setEditAttachmentFile(e.target.files[0] || null);
                      setEditForm({ ...editForm, remove_attachment: false });
                    }}
                    className="w-full border rounded-lg p-1.5 text-xs file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                  />
                  {editAttachmentFile && (
                    <button
                      type="button"
                      onClick={() => setEditAttachmentFile(null)}
                      className="text-xs text-rose-500 font-bold hover:underline shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button onClick={() => setEditOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Grade Modal */}
      {gradeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Grade Student Submission</h3>
              <button onClick={() => setGradeModalOpen(false)} className="text-slate-400">✕</button>
            </div>

            <div className="text-xs bg-slate-50 p-3 rounded-lg border space-y-1">
              <div>Student: <strong>{gradingRecipient?.student_name}</strong></div>
              <div>Submitted at: {gradingRecipient?.submitted_at} {gradingRecipient?.is_late ? '(LATE)' : ''}</div>
              {gradingRecipient?.text_answer && (
                <div className="mt-2 pt-2 border-t text-slate-700">
                  <strong>Student Answer:</strong>
                  <p className="mt-1 whitespace-pre-wrap">{gradingRecipient.text_answer}</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Evaluation Result:</label>
                <select
                  value={gradeForm.result}
                  onChange={(e) => setGradeForm({ ...gradeForm, result: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm font-semibold"
                >
                  <option value="correct">Correct (Full Marks)</option>
                  <option value="partly">Partly Correct</option>
                  <option value="incorrect">Incorrect</option>
                  <option value="redo">Redo Required</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Marks:</label>
                <input
                  type="number"
                  value={gradeForm.marks}
                  onChange={(e) => setGradeForm({ ...gradeForm, marks: Number(e.target.value) })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Instructor Feedback:</label>
                <textarea
                  rows={2}
                  placeholder="Optional comments for student..."
                  value={gradeForm.feedback}
                  onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button onClick={() => setGradeModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600">Cancel</button>
              <button onClick={handleSaveGrade} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold">Save Grade</button>
            </div>
          </div>
        </div>
      )}

      {/* Share Assignment Links Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-indigo-600" /> Share Assignment Links
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {shareData.title} · Due: {shareData.due_at || 'As scheduled'}
                </p>
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Notification alert banner */}
            <div className={`p-3 rounded-xl border text-xs shrink-0 ${
              shareData.has_smtp && shareData.emails_sent > 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-indigo-50 border-indigo-200 text-indigo-900'
            }`}>
              <div className="font-bold flex items-center gap-1.5 mb-1">
                {shareData.has_smtp && shareData.emails_sent > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-indigo-600" />
                )}
                <span>{shareData.message || 'Submission links generated successfully'}</span>
              </div>
              <p className="text-[11px] text-slate-600">
                You can copy any student's individual link below, or copy all links formatted for your <strong>WhatsApp / Viber batch group</strong>.
              </p>
            </div>

            {/* WhatsApp Bulk Copy Button */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 shrink-0">
              <div>
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600" /> WhatsApp Batch Message
                </div>
                <div className="text-[11px] text-slate-500">Copy all student submission links formatted in one message</div>
              </div>
              <button
                onClick={copyAllWhatsApp}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
              >
                {copiedAll ? (
                  <>
                    <Check className="w-4 h-4" /> Copied WhatsApp Text!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy All for WhatsApp
                  </>
                )}
              </button>
            </div>

            {/* Recipients List */}
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Individual Student Links ({shareData.recipients?.length || 0})
              </div>
              <div className="divide-y divide-slate-100 border rounded-xl overflow-hidden">
                {shareData.recipients?.map((r, i) => (
                  <div key={r.student_id || r.recipient_id || i} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {r.student_name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {r.email || 'No email registered'} {r.link ? `· ${r.link}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.link && (
                        <>
                          <button
                            onClick={() => copyToClipboard(r.link, r.student_id || r.recipient_id || i)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            {copiedId === (r.student_id || r.recipient_id || i) ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-700 font-bold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-500" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>

                          <a
                            href={r.link}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
                            title="Open submission page"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end shrink-0">
              <button
                onClick={() => setShareModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
