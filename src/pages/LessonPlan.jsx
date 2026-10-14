import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Calendar, Clock, CheckCircle2, AlertTriangle, 
  RotateCw, Filter, ChevronDown, ChevronRight, RefreshCw, 
  Printer, Download, Search, Edit3, X, Save, Layers, 
  Award, CheckCircle, FileText, BarChart3, ExternalLink
} from 'lucide-react';
import { api, getToken } from '../api';

export default function LessonPlan({ batchId }) {
  const [activeTab, setActiveTab] = useState('modules'); // 'modules' | 'schedule' | 'monthly'
  const [loading, setLoading] = useState(true);
  const [planData, setPlanData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedModules, setExpandedModules] = useState({});

  // Edit module modal state
  const [editingModule, setEditingModule] = useState(null);
  const [editForm, setEditForm] = useState({
    unit_title: '',
    goal: '',
    resources: '',
    assessment: '',
    sessions: []
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Re-plan modal state
  const [replanOpen, setReplanOpen] = useState(false);
  const [replanForm, setReplanForm] = useState({
    disruptedDate: new Date().toISOString().slice(0, 10),
    hoursDelivered: 0,
    strategy: 'shift',
    reason: ''
  });
  const [replanPreview, setReplanPreview] = useState(null);
  const [generating, setGenerating] = useState(false);

  const fetchLessonPlan = async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const [lessonsRes, sumRes] = await Promise.all([
        api.get(`/batches/${batchId}/plan/lessons`),
        api.get(`/batches/${batchId}/plan/summary`).catch(() => null)
      ]);
      setPlanData(lessonsRes);
      setSummaryData(sumRes);

      // Expand the first 2 modules by default
      if (lessonsRes?.modules?.length) {
        setExpandedModules({
          [lessonsRes.modules[0].module_id]: true,
          [lessonsRes.modules[1]?.module_id]: true
        });
      }
    } catch (err) {
      console.error('Lesson plan fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessonPlan();
  }, [batchId]);

  const toggleModule = (id) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    if (!planData?.modules) return;
    const all = {};
    planData.modules.forEach(m => { all[m.module_id] = true; });
    setExpandedModules(all);
  };

  const collapseAll = () => {
    setExpandedModules({});
  };

  const handleGeneratePlan = async () => {
    if (!confirm('Generate/Regenerate initial lesson plan based on NVQ Level 4 schedule?')) return;
    setGenerating(true);
    try {
      await api.post(`/batches/${batchId}/plan/generate`, { preview: false });
      await fetchLessonPlan();
    } catch (err) {
      alert(err.message || 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenEdit = (mod) => {
    setEditingModule(mod);
    setEditForm({
      unit_title: mod.unit_title || mod.title,
      goal: mod.goal || '',
      resources: (mod.resources || []).join('\n'),
      assessment: (mod.assessment || []).join('\n'),
      sessions: (mod.sessions || []).map(s => ({
        session_no: s.session_no,
        title: s.title,
        focus: s.focus || '',
        topics: (s.topics || []).join('\n'),
        activity: s.activity || '',
        hours: s.hours
      }))
    });
  };

  const handleSaveModuleEdit = async () => {
    if (!editingModule) return;
    setSavingEdit(true);
    try {
      const payload = {
        unit_title: editForm.unit_title,
        goal: editForm.goal,
        resources: editForm.resources.split('\n').map(s => s.trim()).filter(Boolean),
        assessment: editForm.assessment.split('\n').map(s => s.trim()).filter(Boolean),
        sessions: editForm.sessions.map((s, idx) => ({
          session_no: idx + 1,
          title: s.title,
          focus: s.focus,
          topics: s.topics.split('\n').map(t => t.trim()).filter(Boolean),
          activity: s.activity,
          hours: Number(s.hours) || 0
        }))
      };
      await api.put(`/batches/${batchId}/plan/lessons/${editingModule.module_id}`, payload);
      setEditingModule(null);
      await fetchLessonPlan();
    } catch (err) {
      alert(err.message || 'Failed to save lesson content');
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePreviewReplan = async () => {
    try {
      const res = await api.post(`/batches/${batchId}/plan/replan/preview`, {
        disruptedDate: replanForm.disruptedDate,
        hoursDelivered: Number(replanForm.hoursDelivered) || 0,
        strategy: replanForm.strategy
      });
      setReplanPreview(res);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleConfirmReplan = async () => {
    try {
      await api.post(`/batches/${batchId}/plan/replan/confirm`, {
        disruptedDate: replanForm.disruptedDate,
        hoursDelivered: Number(replanForm.hoursDelivered) || 0,
        strategy: replanForm.strategy,
        reason: replanForm.reason || 'Schedule adjustment'
      });
      setReplanOpen(false);
      setReplanPreview(null);
      await fetchLessonPlan();
    } catch (err) {
      alert(err.message);
    }
  };

  const token = getToken() || '';
  const totals = planData?.totals || {};
  const modules = planData?.modules || [];
  const days = planData?.days || [];
  const months = summaryData?.summary?.months || [];

  // Filter modules
  const filteredModules = modules.filter(m => {
    if (selectedModuleId && m.module_id !== Number(selectedModuleId)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchCode = m.code.toLowerCase().includes(q);
      const matchTitle = (m.unit_title || m.title).toLowerCase().includes(q);
      const matchGoal = (m.goal || '').toLowerCase().includes(q);
      const matchSession = (m.sessions || []).some(s => 
        s.title.toLowerCase().includes(q) || 
        (s.topics || []).some(t => t.toLowerCase().includes(q))
      );
      return matchCode || matchTitle || matchGoal || matchSession;
    }
    return true;
  });

  // Filter days
  const filteredDays = days.filter(d => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return d.date.includes(q) || d.rows.some(r => 
      r.module_code.toLowerCase().includes(q) ||
      r.module_title.toLowerCase().includes(q) ||
      (r.task_title || '').toLowerCase().includes(q)
    );
  });

  const completionPct = totals.planned > 0 
    ? Math.min(100, Math.round(((totals.delivered || 0) / totals.planned) * 100))
    : 0;

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Top Header & Global Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">NVQ-4 Lesson Plan &amp; Teaching Hours</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200">
              NVQ Level 4
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official NCS K72S004 Curriculum · ICT Technician · {totals.curriculumHours || 720} Total Hours
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download Official PDF */}
          <a
            href={`/api/print/lesson-plan?batchId=${batchId}&format=pdf&token=${token}`}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 btn-press"
          >
            <Download className="w-3.5 h-3.5" /> Download PDF
          </a>

          {/* Print Lesson Plan */}
          <a
            href={`/api/print/lesson-plan?batchId=${batchId}&format=html&token=${token}`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 btn-press"
          >
            <Printer className="w-3.5 h-3.5" /> Print Lesson Plan
          </a>

          {/* Print Timetable */}
          <a
            href={`/api/print/timetable?batchId=${batchId}&format=html&token=${token}`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" /> Timetable
          </a>

          {/* Re-plan disruption */}
          <button
            onClick={() => {
              setReplanOpen(true);
              handlePreviewReplan();
            }}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" /> Re-plan
          </button>

          {/* Regenerate Plan */}
          <button
            onClick={handleGeneratePlan}
            disabled={generating}
            className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} /> 
            {generating ? 'Generating...' : 'Regenerate'}
          </button>
        </div>
      </div>

      {/* KPI Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <BookOpen className="w-4 h-4 text-brand-600" /> Curriculum Total
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {totals.curriculumHours || 720} <span className="text-xs font-bold text-slate-400">Hours</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            16 Modules (Theory + Practical)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <Calendar className="w-4 h-4 text-indigo-600" /> Planned Sessions
          </div>
          <div className="text-2xl font-extrabold text-indigo-700 mt-1">
            {totals.planned || 0} <span className="text-xs font-bold text-slate-400">Hours</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            {totals.teachingDays || 0} Teaching Days
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <Clock className="w-4 h-4 text-emerald-600" /> Hours Taught to Date
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">
            {totals.delivered || 0} <span className="text-xs font-bold text-slate-400">Hours</span>
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Recorded from Day Log
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <Award className="w-4 h-4 text-amber-600" /> Completion Rate
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {completionPct}%
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('modules')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
              activeTab === 'modules'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> NVQ-4 Modules &amp; Lesson Content
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
              activeTab === 'schedule'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Day-by-Day Teaching Schedule
          </button>

          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
              activeTab === 'monthly'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Monthly Targets (120h)
          </button>
        </div>

        {/* Search & Filter tools */}
        <div className="flex items-center gap-2">
          {activeTab === 'modules' && (
            <div className="flex items-center gap-1.5">
              <select
                value={selectedModuleId}
                onChange={(e) => setSelectedModuleId(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">All 16 Modules</option>
                {modules.map(m => (
                  <option key={m.module_id} value={m.module_id}>
                    {m.code} - {m.unit_title || m.title}
                  </option>
                ))}
              </select>

              <button
                onClick={expandAll}
                className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
              >
                Collapse All
              </button>
            </div>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search topics, modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg pl-8 pr-2.5 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto"></div>
          <p className="text-sm text-slate-500 mt-3 font-medium">Loading lesson plan &amp; session hours...</p>
        </div>
      ) : activeTab === 'modules' ? (
        /* ═══════════════════════════════════════════════════════════════
           TAB 1: NVQ-4 LESSON MODULES & DETAILED SESSIONS
           ═══════════════════════════════════════════════════════════════ */
        <div className="space-y-4">
          {filteredModules.map(mod => {
            const isExpanded = !!expandedModules[mod.module_id];
            const modPct = mod.plannedHours > 0 
              ? Math.min(100, Math.round(((mod.deliveredHours / mod.plannedHours) * 100))) 
              : 0;

            return (
              <div 
                key={mod.module_id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all"
              >
                {/* Module Header Bar */}
                <div 
                  onClick={() => toggleModule(mod.module_id)}
                  className="p-4 bg-slate-50/70 hover:bg-slate-100/70 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <span className="px-2.5 py-1 rounded-md font-extrabold text-xs bg-slate-900 text-white shrink-0">
                      {mod.code}
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        {mod.unit_title || mod.title}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Duration: <strong>{mod.total_hours} Hours</strong> (Theory: {mod.theory_hours}h · Practical: {mod.practical_hours}h)
                        {mod.sessions.length > 0 && ` · ${mod.sessions.length} Structured Sessions`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-800">
                        {mod.deliveredHours} / {mod.plannedHours} h <span className="text-[10px] text-slate-400">taught</span>
                      </div>
                      <div className="w-24 bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div 
                          className="bg-emerald-600 h-full rounded-full" 
                          style={{ width: `${modPct}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(mod);
                      }}
                      title="Edit Goal, Resources or Session Content"
                      className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <a
                      href={`/api/print/lesson-plan?batchId=${batchId}&moduleId=${mod.module_id}&format=html&token=${token}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Print this Module's Lesson Plan"
                      className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                    </a>

                    <div className="text-slate-400">
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Module Expanded Content */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Goal Banner */}
                    <div className="bg-blue-50/70 border-l-4 border-blue-500 rounded-r-lg p-3 text-xs text-blue-900 leading-relaxed">
                      <strong>Goal / Target Competency: </strong>
                      {mod.goal || 'To equip learners with standard competencies and practical workplace skills.'}
                    </div>

                    {/* Sessions Breakdown Table */}
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                            <th className="p-3 w-48">Session &amp; Focus</th>
                            <th className="p-3">Topics Covered &amp; Practical Activity</th>
                            <th className="p-3 text-center w-28">Planned Hrs</th>
                            <th className="p-3 text-center w-28">Taught Hrs</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {mod.sessions.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-slate-400">
                                Standard curriculum topics scheduled for this module.
                              </td>
                            </tr>
                          ) : mod.sessions.map((s, sIdx) => {
                            const isDone = s.deliveredHours >= s.hours && s.hours > 0;
                            return (
                              <tr key={s.id || sIdx} className="hover:bg-slate-50/60">
                                <td className="p-3 align-top">
                                  <div className="font-bold text-slate-900">
                                    Session {s.session_no}: {s.title}
                                  </div>
                                  {s.focus && (
                                    <div className="text-[11px] font-semibold text-indigo-600 mt-1">
                                      {s.focus}
                                    </div>
                                  )}
                                  {s.firstDate && (
                                    <div className="text-[10px] text-slate-400 mt-1">
                                      📅 {s.firstDate} {s.lastDate !== s.firstDate ? `– ${s.lastDate}` : ''}
                                    </div>
                                  )}
                                </td>

                                <td className="p-3 align-top">
                                  {s.topics && s.topics.length > 0 && (
                                    <ul className="list-disc list-inside space-y-0.5 text-slate-700 leading-normal">
                                      {s.topics.map((t, tIdx) => (
                                        <li key={tIdx}>{t}</li>
                                      ))}
                                    </ul>
                                  )}
                                  {s.activity && (
                                    <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 text-[11px] font-medium leading-relaxed">
                                      <strong>Practical Activity: </strong>{s.activity}
                                    </div>
                                  )}
                                </td>

                                <td className="p-3 text-center align-top font-bold text-slate-800">
                                  {s.hours} h
                                </td>

                                <td className="p-3 text-center align-top">
                                  <span className={`inline-flex items-center gap-1 font-bold ${
                                    isDone ? 'text-emerald-700' : s.deliveredHours > 0 ? 'text-amber-700' : 'text-slate-400'
                                  }`}>
                                    {s.deliveredHours} h
                                    {isDone && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Resources & Assessment Checklist */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-slate-500" /> Resource Checklist
                        </h4>
                        {mod.resources && mod.resources.length > 0 ? (
                          <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                            {mod.resources.map((r, i) => <li key={i}>{r}</li>)}
                          </ul>
                        ) : (
                          <span className="text-slate-400 italic">Standard computer lab facilities</span>
                        )}
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-slate-500" /> Assessment Methods
                        </h4>
                        {mod.assessment && mod.assessment.length > 0 ? (
                          <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                            {mod.assessment.map((a, i) => <li key={i}>{a}</li>)}
                          </ul>
                        ) : (
                          <span className="text-slate-400 italic">Practical demonstration &amp; competency checklists</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredModules.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
              No modules match your filter.
            </div>
          )}
        </div>
      ) : activeTab === 'schedule' ? (
        /* ═══════════════════════════════════════════════════════════════
           TAB 2: DAY-BY-DAY TEACHING SCHEDULE
           ═══════════════════════════════════════════════════════════════ */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Chronological Teaching Schedule</h3>
              <p className="text-xs text-slate-500">
                {days.length} Total Teaching Days · {totals.planned || 720} Planned Hours · {totals.delivered || 0} Hours Delivered
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-600">
              Showing {filteredDays.length} of {days.length} Days
            </div>
          </div>

          <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3 w-28">Date</th>
                  <th className="p-3 w-24">Day</th>
                  <th className="p-3 w-28">Time</th>
                  <th className="p-3 w-40">Module</th>
                  <th className="p-3">Lesson &amp; Topics Covered</th>
                  <th className="p-3 text-center w-24">Planned</th>
                  <th className="p-3 text-center w-24">Delivered</th>
                  <th className="p-3 text-center w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDays.map((d, idx) => (
                  <tr key={d.date || idx} className="hover:bg-slate-50/70">
                    <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                      {d.date}
                    </td>
                    <td className="p-3 text-slate-600">{d.day}</td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">{d.time || '09:00 – 16:00'}</td>
                    <td className="p-3">
                      {d.rows.map((r, ri) => (
                        <div key={ri} className="font-bold text-slate-800">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 border text-slate-700 mr-1">
                            {r.module_code}
                          </span>
                          {r.task_code && <span className="text-[11px] text-slate-500">[{r.task_code}]</span>}
                        </div>
                      ))}
                    </td>
                    <td className="p-3">
                      {d.rows.map((r, ri) => (
                        <div key={ri} className="text-slate-700">
                          {r.lessons && r.lessons.length > 0 ? (
                            r.lessons.map((ls, lsi) => (
                              <div key={lsi} className="text-[11px]">
                                <strong>Session {ls.session_no}: {ls.title}</strong>
                                {ls.focus && <span className="text-slate-500"> ({ls.focus})</span>}
                              </div>
                            ))
                          ) : (
                            <div className="text-[11px] text-slate-600">
                              {r.task_title || r.module_title}
                            </div>
                          )}
                        </div>
                      ))}
                    </td>
                    <td className="p-3 text-center font-bold text-slate-800">
                      {d.hours} h
                    </td>
                    <td className="p-3 text-center font-bold text-emerald-700">
                      {d.delivered} h
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.status === 'taught' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        d.status === 'teacher_absent' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        d.status ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {d.status ? d.status.replace('_', ' ') : 'Scheduled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════════
           TAB 3: MONTHLY TARGET PROGRESS (120H BREAKDOWN)
           ═══════════════════════════════════════════════════════════════ */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Monthly Hours Breakdown</h3>
              <p className="text-xs text-slate-500">120 Hours Target per Month Evaluation</p>
            </div>
            <div className="text-xs font-bold text-slate-700">
              Total: {totals.planned || 720}h · End: {totals.endDate || '-'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-3">Month</th>
                  <th className="p-3">Period</th>
                  <th className="p-3 text-center">Planned Hours</th>
                  <th className="p-3 text-center">Target</th>
                  <th className="p-3 text-center">Cumulative</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Timetable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {months.map((m, i) => (
                  <tr key={i} className="hover:bg-slate-50/60">
                    <td className="p-3 font-bold text-slate-900">{m.key}</td>
                    <td className="p-3 text-slate-600">{m.from} to {m.to}</td>
                    <td className="p-3 text-center font-bold text-brand-700">{m.hours} h</td>
                    <td className="p-3 text-center text-slate-500">{m.target} h</td>
                    <td className="p-3 text-center font-semibold text-slate-800">{m.cumulative} / {m.cumulativeTarget} h</td>
                    <td className="p-3 text-center">
                      {m.behindBy > 0 ? (
                        <span className="px-2 py-0.5 rounded font-bold bg-rose-50 text-rose-700">
                          -{m.behindBy}h Behind
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded font-bold bg-emerald-50 text-emerald-700">
                          ✓ On Track
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/api/print/monthly-plan?batchId=${batchId}&from=${m.from}&to=${m.to}&format=pdf&token=${token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md font-bold text-[11px] transition-colors"
                          title="Download 5-Column Monthly Plan Calendar Grid PDF"
                        >
                          <Download className="w-3 h-3" /> PDF
                        </a>
                        <a
                          href={`/api/print/monthly-plan?batchId=${batchId}&from=${m.from}&to=${m.to}&format=html&token=${token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-bold text-[11px] transition-colors"
                          title="Print 5-Column Monthly Plan Calendar Grid"
                        >
                          <Printer className="w-3 h-3 text-slate-500" /> Print
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Module Lesson Content Modal */}
      {editingModule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Edit Lesson Plan — {editingModule.code} {editingModule.title}
                </h3>
                <p className="text-xs text-slate-500">Customize unit goals, resource lists, and structured sessions</p>
              </div>
              <button onClick={() => setEditingModule(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Unit Title:</label>
                <input
                  type="text"
                  value={editForm.unit_title}
                  onChange={(e) => setEditForm({ ...editForm, unit_title: e.target.value })}
                  className="w-full border rounded-lg p-2 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Goal / Competency:</label>
                <textarea
                  rows={2}
                  value={editForm.goal}
                  onChange={(e) => setEditForm({ ...editForm, goal: e.target.value })}
                  className="w-full border rounded-lg p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Resource Checklist (1 per line):</label>
                  <textarea
                    rows={3}
                    value={editForm.resources}
                    onChange={(e) => setEditForm({ ...editForm, resources: e.target.value })}
                    className="w-full border rounded-lg p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assessment Methods (1 per line):</label>
                  <textarea
                    rows={3}
                    value={editForm.assessment}
                    onChange={(e) => setEditForm({ ...editForm, assessment: e.target.value })}
                    className="w-full border rounded-lg p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800">Sessions ({editForm.sessions.length})</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setEditForm({
                        ...editForm,
                        sessions: [
                          ...editForm.sessions,
                          { session_no: editForm.sessions.length + 1, title: '', focus: '', topics: '', activity: '', hours: 6 }
                        ]
                      });
                    }}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold text-[11px]"
                  >
                    + Add Session
                  </button>
                </div>

                <div className="space-y-3">
                  {editForm.sessions.map((sess, idx) => (
                    <div key={idx} className="p-3 border rounded-lg bg-slate-50/60 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-600">#{idx + 1}</span>
                        <input
                          type="text"
                          placeholder="Session Title"
                          value={sess.title}
                          onChange={(e) => {
                            const copy = [...editForm.sessions];
                            copy[idx].title = e.target.value;
                            setEditForm({ ...editForm, sessions: copy });
                          }}
                          className="flex-1 border rounded px-2 py-1 font-semibold text-xs bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Focus (Elements)"
                          value={sess.focus}
                          onChange={(e) => {
                            const copy = [...editForm.sessions];
                            copy[idx].focus = e.target.value;
                            setEditForm({ ...editForm, sessions: copy });
                          }}
                          className="w-36 border rounded px-2 py-1 text-xs bg-white"
                        />
                        <input
                          type="number"
                          step="0.5"
                          placeholder="Hours"
                          value={sess.hours}
                          onChange={(e) => {
                            const copy = [...editForm.sessions];
                            copy[idx].hours = Number(e.target.value) || 0;
                            setEditForm({ ...editForm, sessions: copy });
                          }}
                          className="w-16 border rounded px-2 py-1 text-xs text-center font-bold bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const copy = editForm.sessions.filter((_, i) => i !== idx);
                            setEditForm({ ...editForm, sessions: copy });
                          }}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          ✕
                        </button>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-slate-500">Topics Covered (1 per line):</label>
                        <textarea
                          rows={2}
                          value={sess.topics}
                          onChange={(e) => {
                            const copy = [...editForm.sessions];
                            copy[idx].topics = e.target.value;
                            setEditForm({ ...editForm, sessions: copy });
                          }}
                          className="w-full border rounded p-1.5 text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-slate-500">Practical Activity:</label>
                        <input
                          type="text"
                          value={sess.activity}
                          onChange={(e) => {
                            const copy = [...editForm.sessions];
                            copy[idx].activity = e.target.value;
                            setEditForm({ ...editForm, sessions: copy });
                          }}
                          className="w-full border rounded px-2 py-1 text-xs bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button
                onClick={() => setEditingModule(null)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModuleEdit}
                disabled={savingEdit}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 btn-press"
              >
                <Save className="w-3.5 h-3.5" /> {savingEdit ? 'Saving...' : 'Save Lesson Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-plan Disruption Modal */}
      {replanOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Re-plan Calendar Disruption</h3>
              <button onClick={() => setReplanOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Disrupted Date:</label>
                <input
                  type="date"
                  value={replanForm.disruptedDate}
                  onChange={(e) => setReplanForm({ ...replanForm, disruptedDate: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hours delivered on that date:</label>
                <input
                  type="number"
                  step="0.5"
                  value={replanForm.hoursDelivered}
                  onChange={(e) => setReplanForm({ ...replanForm, hoursDelivered: Number(e.target.value) })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Re-plan:</label>
                <input
                  type="text"
                  placeholder="e.g. Teacher sick leave / Center closure"
                  value={replanForm.reason}
                  onChange={(e) => setReplanForm({ ...replanForm, reason: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Strategy:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReplanForm({ ...replanForm, strategy: 'shift' })}
                    className={`p-2.5 rounded-lg border text-xs font-semibold text-left ${
                      replanForm.strategy === 'shift' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200'
                    }`}
                  >
                    Shift Forward (Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplanForm({ ...replanForm, strategy: 'makeup' })}
                    className={`p-2.5 rounded-lg border text-xs font-semibold text-left ${
                      replanForm.strategy === 'makeup' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200'
                    }`}
                  >
                    Make-up Extra Hours
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePreviewReplan}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg border"
              >
                Calculate Impact Preview
              </button>

              {replanPreview && (
                <div className="bg-slate-50 border rounded-xl p-3 text-xs space-y-1">
                  <div className="font-semibold text-slate-800">Impact Summary:</div>
                  <div className="text-slate-600">Hours Lost: <strong>{replanPreview.hoursLost} h</strong></div>
                  <div className="text-slate-600">Old End Date: {replanPreview.oldEndDate}</div>
                  <div className="text-brand-700 font-bold">New End Date: {replanPreview.newEndDate}</div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button
                onClick={() => setReplanOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReplan}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold"
              >
                Confirm &amp; Apply New Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
