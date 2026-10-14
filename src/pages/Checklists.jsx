import React, { useState, useEffect } from 'react';
import { 
  Check, Printer, Award, UserCheck, ChevronRight, CheckSquare, 
  Calendar, AlertCircle, AlertTriangle, Plus, Trash2, Edit3, X, 
  RefreshCw, Undo2, ShieldAlert, CheckCircle2, Settings
} from 'lucide-react';
import { api, getToken } from '../api';

export default function Checklists({ batchId }) {
  const [tab, setTab] = useState('grid'); // 'grid' | 'progress'
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [checklistData, setChecklistData] = useState(null);
  const [progressSummary, setProgressSummary] = useState(null);
  const [saving, setSaving] = useState(false);
  const [absentWarning, setAbsentWarning] = useState(null); // string message
  const [successNotice, setSuccessNotice] = useState(null);

  // Manage Steps / Criteria Modal state
  const [showManageSteps, setShowManageSteps] = useState(false);
  const [editingTaskInfo, setEditingTaskInfo] = useState({ code: '', title: '' });
  const [newStepForm, setNewStepForm] = useState({ code: '', title: '', sort_order: '' });
  const [editingStepId, setEditingStepId] = useState(null);
  const [editingStepForm, setEditingStepForm] = useState({ code: '', title: '', sort_order: '' });

  // Custom date edit modal state
  const [dateEditStudent, setDateEditStudent] = useState(null); // { studentId, studentName, currentDate }
  const [customCompetentDate, setCustomCompetentDate] = useState('');

  // Load modules
  useEffect(() => {
    if (!batchId) return;
    api.get(`/batches/${batchId}`).then(res => {
      const checklistMods = (res.modules || []).filter(m => m.has_checklist === 1);
      setModules(checklistMods);
      if (checklistMods.length > 0) {
        setSelectedModuleId(checklistMods[0].module_id);
      }
    });
  }, [batchId]);

  // Load tasks for selected module
  useEffect(() => {
    if (!selectedModuleId) return;
    api.get(`/ncs/modules/${selectedModuleId}/tasks`).then(res => {
      setTasks(res);
      if (res.length > 0) {
        setSelectedTaskId(res[0].id);
      }
    });
  }, [selectedModuleId]);

  // Load checklist data
  const fetchChecklist = async () => {
    if (!batchId || !selectedTaskId) return;
    setLoading(true);
    try {
      if (tab === 'grid') {
        const data = await api.get(`/batches/${batchId}/checklists/${selectedTaskId}?date=${assessmentDate}`);
        setChecklistData(data);
        if (data && data.task) {
          setEditingTaskInfo({ code: data.task.code, title: data.task.title });
        }
      } else {
        const prog = await api.get(`/batches/${batchId}/checklists/progress/summary`);
        setProgressSummary(prog);
      }
    } catch (err) {
      console.error('Checklist load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklist();
  }, [batchId, selectedTaskId, tab, assessmentDate]);

  // Step Cell Toggle
  const handleToggleCell = async (student, stepId, attempt, currentVal) => {
    const isAbsent = checklistData?.attendanceMap?.[student.id] === 'A';
    const newVal = !currentVal;

    // Strict Rule: If student is marked absent on assessmentDate, they CANNOT be marked achieved
    if (newVal && isAbsent) {
      setAbsentWarning(`Cannot assess ${student.full_name}: Student was marked ABSENT on ${assessmentDate}. Absent students cannot be added to the checklist.`);
      return;
    }

    setAbsentWarning(null);

    // Optimistic UI update
    setChecklistData(prev => {
      const copy = { ...prev };
      if (!copy.results[student.id]) copy.results[student.id] = {};
      if (!copy.results[student.id][stepId]) copy.results[student.id][stepId] = {};
      copy.results[student.id][stepId][attempt] = {
        achieved: newVal,
        assessed_on: assessmentDate
      };
      return copy;
    });

    try {
      await api.put(`/batches/${batchId}/checklists/${selectedTaskId}`, {
        updates: [{
          student_id: student.id,
          step_id: stepId,
          attempt,
          achieved: newVal,
          assessed_on: assessmentDate
        }]
      });
    } catch (err) {
      setAbsentWarning(err.message || 'Failed to update cell');
      fetchChecklist();
    }
  };

  // Mark all steps achieved for one student
  const handleAllStepsAchieved = async (student) => {
    if (!checklistData) return;
    const isAbsent = checklistData?.attendanceMap?.[student.id] === 'A';

    if (isAbsent) {
      setAbsentWarning(`Cannot assess ${student.full_name}: Student is marked ABSENT on ${assessmentDate}. Absent students cannot be added to the checklist.`);
      return;
    }

    setAbsentWarning(null);

    const updates = checklistData.steps.map(st => ({
      student_id: student.id,
      step_id: st.id,
      attempt: 1,
      achieved: true,
      assessed_on: assessmentDate
    }));

    try {
      await api.put(`/batches/${batchId}/checklists/${selectedTaskId}`, { updates });
      await api.put(`/batches/${batchId}/checklists/${selectedTaskId}/competency`, {
        student_id: student.id,
        competent: true,
        competent_date: assessmentDate
      });
      setSuccessNotice(`All steps and competency marked for ${student.full_name}!`);
      setTimeout(() => setSuccessNotice(null), 3000);
      fetchChecklist();
    } catch (err) {
      setAbsentWarning(err.message);
      fetchChecklist();
    }
  };

  // Bulk action: Mark all present students achieved
  const handleMarkAllPresent = async () => {
    if (!checklistData) return;
    const presentStudents = checklistData.students.filter(
      st => checklistData.attendanceMap?.[st.id] !== 'A'
    );
    const absentCount = checklistData.students.length - presentStudents.length;

    if (presentStudents.length === 0) {
      alert('All students are marked absent on this date!');
      return;
    }

    if (!window.confirm(`Mark all ${presentStudents.length} present students as Achieved on ${assessmentDate}? (${absentCount} absent students will be skipped)`)) {
      return;
    }

    setSaving(true);
    try {
      const updates = [];
      for (const st of presentStudents) {
        checklistData.steps.forEach(step => {
          updates.push({
            student_id: st.id,
            step_id: step.id,
            attempt: 1,
            achieved: true,
            assessed_on: assessmentDate
          });
        });
      }

      await api.put(`/batches/${batchId}/checklists/${selectedTaskId}`, { updates });
      for (const st of presentStudents) {
        await api.put(`/batches/${batchId}/checklists/${selectedTaskId}/competency`, {
          student_id: st.id,
          competent: true,
          competent_date: assessmentDate
        });
      }

      setSuccessNotice(`Successfully marked ${presentStudents.length} present students! (${absentCount} absent students skipped)`);
      setTimeout(() => setSuccessNotice(null), 4000);
      fetchChecklist();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Reset student marks
  const handleResetStudent = async (student) => {
    if (!window.confirm(`Reset/clear all checklist evaluations and competency for ${student.full_name}?`)) {
      return;
    }

    try {
      await api.post(`/batches/${batchId}/checklists/${selectedTaskId}/clear-student`, {
        student_id: student.id
      });
      setSuccessNotice(`Cleared marks for ${student.full_name}`);
      setTimeout(() => setSuccessNotice(null), 3000);
      fetchChecklist();
    } catch (err) {
      alert(err.message);
    }
  };

  // Toggle Competent
  const handleToggleCompetent = async (student, currentCompetent) => {
    const isAbsent = checklistData?.attendanceMap?.[student.id] === 'A';
    const newVal = !currentCompetent;

    if (newVal && isAbsent) {
      setAbsentWarning(`Cannot mark ${student.full_name} competent: Student is marked ABSENT on ${assessmentDate}. Absent students cannot be evaluated on days they did not attend.`);
      return;
    }

    setAbsentWarning(null);

    try {
      await api.put(`/batches/${batchId}/checklists/${selectedTaskId}/competency`, {
        student_id: student.id,
        competent: newVal,
        competent_date: newVal ? assessmentDate : null
      });
      fetchChecklist();
    } catch (err) {
      setAbsentWarning(err.message);
    }
  };

  // Save custom date achieved
  const handleSaveCustomDate = async (e) => {
    e.preventDefault();
    if (!dateEditStudent) return;
    try {
      await api.put(`/batches/${batchId}/checklists/${selectedTaskId}/competency`, {
        student_id: dateEditStudent.studentId,
        competent: !!customCompetentDate,
        competent_date: customCompetentDate || null
      });
      setDateEditStudent(null);
      fetchChecklist();
    } catch (err) {
      alert(err.message);
    }
  };

  // Step Management Handlers
  const handleAddStep = async (e) => {
    e.preventDefault();
    if (!newStepForm.code || !newStepForm.title) return;
    try {
      await api.post(`/batches/${batchId}/checklists/${selectedTaskId}/steps`, newStepForm);
      setNewStepForm({ code: '', title: '', sort_order: '' });
      fetchChecklist();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateStep = async (stepId) => {
    try {
      await api.put(`/batches/${batchId}/checklists/${selectedTaskId}/steps/${stepId}`, editingStepForm);
      setEditingStepId(null);
      fetchChecklist();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteStep = async (stepId, stepCode) => {
    if (!window.confirm(`Delete step ${stepCode}? Any student evaluations for this step will also be removed.`)) {
      return;
    }
    try {
      await api.delete(`/batches/${batchId}/checklists/${selectedTaskId}/steps/${stepId}`);
      fetchChecklist();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateTaskInfo = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/batches/${batchId}/checklists/${selectedTaskId}/info`, editingTaskInfo);
      setSuccessNotice('Task code and title updated successfully!');
      setTimeout(() => setSuccessNotice(null), 3000);
      fetchChecklist();
    } catch (err) {
      alert(err.message);
    }
  };

  // Compute attendance stats for the date
  const presentCount = checklistData?.students?.filter(s => checklistData.attendanceMap?.[s.id] !== 'A').length || 0;
  const absentCount = checklistData?.students?.filter(s => checklistData.attendanceMap?.[s.id] === 'A').length || 0;

  return (
    <div className="space-y-5 pb-24 md:pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Continuous Assessment Checklists</h2>
          <p className="text-xs text-slate-500 mt-0.5">NVQ Level 4 Performance Criteria, Attendance Validation & Competency</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              onClick={() => setTab('grid')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                tab === 'grid' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Task Checklist
            </button>
            <button
              onClick={() => setTab('progress')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                tab === 'progress' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overall Progress
            </button>
          </div>

          {selectedTaskId && (
            <a
              href={`/api/print/checklist?batchId=${batchId}&taskId=${selectedTaskId}&format=html&token=${getToken() || ''}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print Sheet
            </a>
          )}
        </div>
      </div>

      {/* Warnings & Notices */}
      {absentWarning && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{absentWarning}</span>
          </div>
          <button onClick={() => setAbsentWarning(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
          <button onClick={() => setSuccessNotice(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {tab === 'grid' ? (
        <>
          {/* Controls Bar: Module, Task, Assessment Date & Attendance Status */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Module selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Module:</span>
                  <select
                    value={selectedModuleId}
                    onChange={(e) => setSelectedModuleId(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    {modules.map(m => (
                      <option key={m.module_id} value={m.module_id}>
                        {m.code} - {m.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Task selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Task:</span>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none max-w-xs"
                  >
                    {tasks.map(t => (
                      <option key={t.id} value={t.id}>
                        Task {t.code}: {t.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assessment Date Picker */}
                <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  <Calendar className="w-3.5 h-3.5 text-brand-600" />
                  <span className="text-xs font-bold text-slate-700">Assessment Date:</span>
                  <input
                    type="date"
                    value={assessmentDate}
                    onChange={(e) => setAssessmentDate(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-0.5 text-xs font-bold bg-white text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setAssessmentDate(new Date().toISOString().slice(0, 10))}
                    className="text-[11px] font-bold text-brand-600 hover:text-brand-800 underline"
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowManageSteps(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 flex items-center gap-1.5 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-600" /> Edit Steps / Criteria
                </button>

                <button
                  onClick={handleMarkAllPresent}
                  disabled={saving || !checklistData}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <CheckSquare className="w-3.5 h-3.5" /> Mark All Present Achieved
                </button>
              </div>
            </div>

            {/* Attendance Status Bar for selected date */}
            {checklistData && (
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-semibold">
                    Attendance on {assessmentDate}:
                  </span>
                  <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    ✓ {presentCount} Present
                  </span>
                  {absentCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                      🚫 {absentCount} Absent (Cannot be assessed)
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium">0 Absent</span>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 italic">
                  * Absent students are automatically protected and locked from being evaluated.
                </div>
              </div>
            )}
          </div>

          {/* Checklist Table */}
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 font-semibold">
              Loading checklist and verifying student attendance...
            </div>
          ) : checklistData ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-brand-700">
                    {checklistData.task.module_code} · Task {checklistData.task.code}: {checklistData.task.title}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {checklistData.steps.length} Criteria / Steps · {checklistData.students.length} Active Students
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200">
                      <th className="p-2.5 w-72 min-w-[260px] border-r border-slate-200">
                        Performance Criteria / Steps
                      </th>
                      {checklistData.students.map(st => {
                        const isAbsent = checklistData.attendanceMap?.[st.id] === 'A';
                        return (
                          <th 
                            key={st.id} 
                            colSpan={2}
                            className={`p-2 text-center border-r border-slate-200 max-w-[120px] min-w-[95px] ${
                              isAbsent ? 'bg-rose-50/70' : ''
                            }`}
                          >
                            <div className="truncate font-bold text-slate-900" title={st.full_name}>
                              {st.full_name}
                            </div>

                            {/* Attendance status pill */}
                            <div className="mt-1">
                              {isAbsent ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
                                  🚫 Absent
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                                  ✓ Present
                                </span>
                              )}
                            </div>

                            {/* Quick student actions */}
                            <div className="flex items-center justify-center gap-1.5 mt-1">
                              <button
                                onClick={() => handleAllStepsAchieved(st)}
                                title={isAbsent ? `Cannot evaluate: ${st.full_name} is absent` : 'Mark all steps achieved'}
                                className={`text-[10px] font-semibold underline ${
                                  isAbsent ? 'text-slate-400 cursor-not-allowed' : 'text-brand-600 hover:text-brand-800'
                                }`}
                              >
                                All Pass
                              </button>
                              <span className="text-slate-300">·</span>
                              <button
                                onClick={() => handleResetStudent(st)}
                                title="Reset all marks for this student"
                                className="text-[10px] text-slate-500 hover:text-rose-600 font-semibold underline"
                              >
                                Reset
                              </button>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px]">
                      <th className="p-1 border-r border-slate-200 text-right pr-2">Attempt</th>
                      {checklistData.students.map(st => {
                        const isAbsent = checklistData.attendanceMap?.[st.id] === 'A';
                        return (
                          <React.Fragment key={`att-${st.id}`}>
                            <th className={`p-1 text-center w-9 border-r border-slate-200 ${isAbsent ? 'bg-rose-50/40 text-rose-400' : ''}`}>1</th>
                            <th className={`p-1 text-center w-9 border-r border-slate-200 ${isAbsent ? 'bg-rose-50/40 text-rose-400' : ''}`}>2</th>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {checklistData.steps.map(step => (
                      <tr key={step.id} className="hover:bg-slate-50/50">
                        <td className="p-2.5 border-r border-slate-200">
                          <span className="font-bold text-brand-700 mr-1.5">{step.code}</span>
                          <span className="text-slate-700">{step.title}</span>
                        </td>
                        {checklistData.students.map(st => {
                          const isAbsent = checklistData.attendanceMap?.[st.id] === 'A';
                          const a1 = checklistData.results?.[st.id]?.[step.id]?.[1]?.achieved;
                          const a2 = checklistData.results?.[st.id]?.[step.id]?.[2]?.achieved;
                          return (
                            <React.Fragment key={`cell-${st.id}-${step.id}`}>
                              {/* Attempt 1 */}
                              <td 
                                onClick={() => handleToggleCell(st, step.id, 1, a1)}
                                title={isAbsent ? `Cannot evaluate: ${st.full_name} is marked ABSENT` : `Click to toggle Attempt 1 for ${st.full_name}`}
                                className={`text-center border-r border-slate-200 select-none transition-colors ${
                                  isAbsent 
                                    ? 'bg-rose-50/30 text-rose-300 cursor-not-allowed hover:bg-rose-100/50' 
                                    : a1 
                                      ? 'bg-emerald-50 text-emerald-700 font-black hover:bg-emerald-100 cursor-pointer text-xs' 
                                      : 'hover:bg-slate-100 text-slate-300 cursor-pointer'
                                }`}
                              >
                                {a1 ? 'C' : isAbsent ? '—' : '·'}
                              </td>

                              {/* Attempt 2 */}
                              <td 
                                onClick={() => handleToggleCell(st, step.id, 2, a2)}
                                title={isAbsent ? `Cannot evaluate: ${st.full_name} is marked ABSENT` : `Click to toggle Attempt 2 for ${st.full_name}`}
                                className={`text-center border-r border-slate-200 select-none transition-colors ${
                                  isAbsent 
                                    ? 'bg-rose-50/30 text-rose-300 cursor-not-allowed hover:bg-rose-100/50' 
                                    : a2 
                                      ? 'bg-emerald-50 text-emerald-700 font-black hover:bg-emerald-100 cursor-pointer text-xs' 
                                      : 'hover:bg-slate-100 text-slate-300 cursor-pointer'
                                }`}
                              >
                                {a2 ? 'C' : isAbsent ? '—' : '·'}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Competent Row */}
                    <tr className="bg-slate-50/80 font-bold border-t-2 border-slate-300">
                      <td className="p-2.5 border-r border-slate-200 text-slate-900">
                        Task Competent
                      </td>
                      {checklistData.students.map(st => {
                        const isAbsent = checklistData.attendanceMap?.[st.id] === 'A';
                        const isComp = checklistData.competencies?.[st.id]?.competent;
                        return (
                          <td 
                            key={`comp-${st.id}`}
                            colSpan={2}
                            onClick={() => handleToggleCompetent(st, isComp)}
                            title={isAbsent ? `Cannot mark competent: ${st.full_name} was ABSENT` : 'Click to toggle Competency'}
                            className={`p-2 text-center border-r border-slate-200 select-none transition-colors ${
                              isAbsent
                                ? 'bg-rose-50/40 text-rose-300 cursor-not-allowed'
                                : isComp 
                                  ? 'bg-emerald-100 text-emerald-800 font-bold hover:bg-emerald-200 cursor-pointer' 
                                  : 'hover:bg-slate-200/50 text-slate-400 cursor-pointer'
                            }`}
                          >
                            {isComp ? 'C Competent' : isAbsent ? 'Locked' : 'Mark'}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Date Achieved Row */}
                    <tr className="text-[11px] text-slate-500 bg-slate-50/40">
                      <td className="p-2 border-r border-slate-200 font-semibold">
                        Date Achieved (Click to Edit)
                      </td>
                      {checklistData.students.map(st => {
                        const date = checklistData.competencies?.[st.id]?.competent_date;
                        return (
                          <td 
                            key={`date-${st.id}`} 
                            colSpan={2}
                            onClick={() => {
                              setDateEditStudent({
                                studentId: st.id,
                                studentName: st.full_name,
                                currentDate: date || assessmentDate
                              });
                              setCustomCompetentDate(date || assessmentDate);
                            }}
                            title="Click to edit date achieved"
                            className="p-2 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-100 text-brand-600 font-semibold"
                          >
                            {date || '-'}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        /* Overall Progress Tab */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Student Competency Progress</h3>
            <span className="text-xs text-slate-500">Across All 12 Checklist Modules</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                  <th className="p-3 w-10">#</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3 text-center">Competent Tasks</th>
                  <th className="p-3 text-center">Total Tasks</th>
                  <th className="p-3 text-right">Completion %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {progressSummary?.progress?.map((p, idx) => (
                  <tr key={p.student_id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-800">{p.full_name}</td>
                    <td className="p-3 text-center font-bold text-brand-600">{p.competent_tasks}</td>
                    <td className="p-3 text-center text-slate-500">{p.total_tasks}</td>
                    <td className="p-3 text-right">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        p.percentage >= 80 ? 'bg-emerald-50 text-emerald-700' :
                        p.percentage >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {p.percentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Manage Steps / Criteria */}
      {showManageSteps && checklistData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Manage Performance Criteria & Steps</h3>
                <p className="text-xs text-slate-400">
                  {checklistData.task.module_code} · Task {checklistData.task.code}
                </p>
              </div>
              <button onClick={() => setShowManageSteps(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-6">
              {/* Task Details Edit */}
              <form onSubmit={handleUpdateTaskInfo} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="font-bold text-xs text-slate-800">Edit Task Code & Title</div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Task Code:</label>
                    <input
                      type="text"
                      value={editingTaskInfo.code}
                      onChange={(e) => setEditingTaskInfo({ ...editingTaskInfo, code: e.target.value })}
                      className="w-full border rounded-lg p-2 text-xs font-bold"
                      required
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Task Title:</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editingTaskInfo.title}
                        onChange={(e) => setEditingTaskInfo({ ...editingTaskInfo, title: e.target.value })}
                        className="w-full border rounded-lg p-2 text-xs"
                        required
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-lg shrink-0"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Add New Step Form */}
              <form onSubmit={handleAddStep} className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3">
                <div className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-600" /> Add New Performance Criterion / Step
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Step Code:</label>
                    <input
                      type="text"
                      placeholder="e.g. A1.5"
                      value={newStepForm.code}
                      onChange={(e) => setNewStepForm({ ...newStepForm, code: e.target.value })}
                      className="w-full border rounded-lg p-2 text-xs font-bold bg-white"
                      required
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Criterion Description:</label>
                    <input
                      type="text"
                      placeholder="Enter performance criterion description..."
                      value={newStepForm.title}
                      onChange={(e) => setNewStepForm({ ...newStepForm, title: e.target.value })}
                      className="w-full border rounded-lg p-2 text-xs bg-white"
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs"
                    >
                      + Add Step
                    </button>
                  </div>
                </div>
              </form>

              {/* Existing Steps List */}
              <div className="space-y-2">
                <div className="font-bold text-xs text-slate-800">Existing Performance Steps ({checklistData.steps.length})</div>
                <div className="space-y-2">
                  {checklistData.steps.map(step => (
                    <div 
                      key={step.id}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 hover:border-slate-300"
                    >
                      {editingStepId === step.id ? (
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            type="text"
                            value={editingStepForm.code}
                            onChange={(e) => setEditingStepForm({ ...editingStepForm, code: e.target.value })}
                            className="border rounded p-1.5 text-xs font-bold"
                          />
                          <input
                            type="text"
                            value={editingStepForm.title}
                            onChange={(e) => setEditingStepForm({ ...editingStepForm, title: e.target.value })}
                            className="sm:col-span-2 border rounded p-1.5 text-xs"
                          />
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleUpdateStep(step.id)}
                              className="px-2 py-1 bg-brand-600 text-white font-bold text-xs rounded"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingStepId(null)}
                              className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <span className="font-bold text-xs text-brand-700 mr-2">{step.code}</span>
                            <span className="text-xs text-slate-800">{step.title}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingStepId(step.id);
                                setEditingStepForm({ code: step.code, title: step.title, sort_order: step.sort_order });
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                              title="Edit step"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteStep(step.id, step.code)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                              title="Delete step"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowManageSteps(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Date Achieved for Student */}
      {dateEditStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveCustomDate} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4 animate-fadeIn">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Set Date Achieved</h3>
              <p className="text-xs text-slate-500 mt-0.5">{dateEditStudent.studentName}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date Competent:</label>
              <input
                type="date"
                value={customCompetentDate}
                onChange={(e) => setCustomCompetentDate(e.target.value)}
                className="w-full border rounded-lg p-2 text-xs font-bold"
              />
              <p className="text-[11px] text-slate-400 mt-1">Leave empty to mark as Not Competent.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDateEditStudent(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-xs"
              >
                Save Date
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
