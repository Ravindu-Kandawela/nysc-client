import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, CheckCircle2, AlertCircle, Upload, Send, FileCheck, ExternalLink } from 'lucide-react';
import { API_BASE } from '../api';

export default function PublicAssignment() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionReceipt, setSubmissionReceipt] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/public/${token}`)
      .then(async res => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to load assignment');
        }
        return res.json();
      })
      .then(res => {
        setData(res);
        if (res.submission) {
          setSubmitted(true);
          setSubmissionReceipt(res.submission);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!textAnswer.trim() && !file) {
      alert('Please provide a text answer or attach a file');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('text_answer', textAnswer);
      if (file) formData.append('file', file);

      const res = await fetch(`${API_BASE}/public/${token}/submit`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Submission failed');
      }

      const receipt = await res.json();
      setSubmitted(true);
      setSubmissionReceipt(receipt);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg border border-slate-200">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Assignment Link Error</h2>
          <p className="text-sm text-slate-600 mt-2">{error}</p>
          <p className="text-xs text-slate-400 mt-4">Please contact your teacher if you believe this is a mistake.</p>
        </div>
      </div>
    );
  }

  const { assignment, student } = data;
  const isPastDue = new Date() > new Date(assignment.due_at);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 flex justify-center">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header Branding */}
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-3 py-1 rounded-full border border-brand-100">
            NYSC Akuressa · NVQ Level 4 ICT
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-3">{assignment.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{assignment.module}</p>
        </div>

        {/* Student Welcome & Due Banner */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Student:</div>
            <div className="font-bold text-slate-900 text-sm">{student.name}</div>
            <div className="text-xs text-slate-400">{student.reg_no || 'NVQ Trainee'}</div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-500">Due Date:</div>
            <div className="font-bold text-slate-900 text-sm">{assignment.due_at}</div>
            <div className={`text-xs font-semibold mt-0.5 ${isPastDue ? 'text-rose-600' : 'text-emerald-600'}`}>
              {isPastDue ? '⚠️ Past Due' : 'Active'}
            </div>
          </div>
        </div>

        {/* Instructions */}
        {assignment.instructions && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
            <h3 className="font-bold text-slate-900 text-sm">Instructions</h3>
            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
              {assignment.instructions}
            </p>
          </div>
        )}

        {/* Teacher's Attachment */}
        {assignment.attachment_url && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <FileCheck className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-indigo-950">Teacher's Attached Worksheet / File</div>
                <div className="text-[11px] text-indigo-700 font-medium">{assignment.attachment_name || 'Attached Document'}</div>
              </div>
            </div>
            <a
              href={assignment.attachment_url}
              download
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors shrink-0"
            >
              Download File
            </a>
          </div>
        )}

        {/* Google Drive Worksheet Resource */}
        {assignment.drive_link && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <ExternalLink className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-emerald-950">Google Drive Worksheet / Resource</div>
                <div className="text-[11px] text-emerald-700 font-medium">Cloud Document (Google Drive)</div>
              </div>
            </div>
            <a
              href={assignment.drive_link}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
            >
              Open Google Drive
            </a>
          </div>
        )}

        {/* Submission Form / Receipt */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          {submitted ? (
            <div className="text-center py-4 space-y-3">
              <FileCheck className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-slate-900 text-lg">Assignment Submitted!</h3>
              <p className="text-xs text-slate-600">
                Your work has been safely recorded in the system.
              </p>
              {submissionReceipt?.is_late && (
                <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  Submitted Late
                </div>
              )}
              {assignment.allow_resubmit && (
                <div className="pt-4 border-t">
                  <button
                    onClick={() => setSubmitted(false)}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-800 underline"
                  >
                    Submit a revised answer
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="font-bold text-slate-900 text-base">Your Submission</h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Answer / Notes:
                </label>
                <textarea
                  rows={6}
                  placeholder="Type your answer, report, or explanation here..."
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Attach File (Screenshots, documents, lab results - Optional):
                </label>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> {submitting ? 'Submitting...' : 'Submit Assignment'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
