import React, { useState, useEffect } from 'react';
import { 
  Check, Printer, Award, UserCheck, ChevronRight, CheckSquare, 
  Calendar, AlertCircle, AlertTriangle, Plus, Trash2, Edit3, X, 
  RefreshCw, Undo2, ShieldAlert, CheckCircle2, Settings, Sparkles, Search
} from 'lucide-react';
import { api, getToken } from '../api';

export default function Checklists({ batchId }) {
  const [tab, setTab] = useState('grid'); // 'grid' | 'analysis' | 'progress'
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [checklistData, setChecklistData] = useState(null);
  const [progressSummary, setProgressSummary] = useState(null);
  const [planAnalysis, setPlanAnalysis] = useState(null);
  const [saving, setSaving] = useState(false);
  const [absentWarning, setAbsentWarning] = useState(null); // string message
  const [successNotice, setSuccessNotice] = useState(null);

  // Auto-Fill state
  const [autoFillScope, setAutoFillScope] = useState('task'); // 'task' | 'module' | 'all_taught'
  const [autoFillStrategy, setAutoFillStrategy] = useState('manual_or_plan_end'); // 'manual_or_plan_end' | 'plan_end' | 'plan_start'
  const [autoFillUpToDate, setAutoFillUpToDate] = useState('2026-10-30');
  const [autoFillPreview, setAutoFillPreview] = useState(null);
  const [autoFillLoading, setAutoFillLoading] = useState(false);

  // Manage Steps / Criteria Modal state
  const [showManageSteps, setShowManageSteps] = useState(false);
  const [editingTaskInfo, setEditingTaskInfo] = useState({ code: '', title: '' });
  const [newStepForm, setNewStepForm] = useState({ code: '', title: '', sort_order: '' });
  const [editingStepId, setEditingStepId] = useState(null);
  const [editingStepForm, setEditingStepForm] = useState({ code: '', title: '', sort_order: '' });

  // Custom date edit modal state
  const [dateEditStudent, setDateEditStudent] = useState(null); // { studentId, studentName, currentDate }
  const [customCompetentDate, setCustomCompetentDate] = useState('');
  const [printPaperSize, setPrintPaperSize] = useState('legal'); // 'legal' (1-page all names) | 'a4' (2-page classic)

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
    if (!batchId) return;
    setLoading(true);
    try {
      if (tab === 'grid') {
        if (!selectedTaskId) return;
        const data = await api.get(`/batches/${batchId}/checklists/${selectedTaskId}?date=${assessmentDate}`);
        setChecklistData(data);
        if (data && data.task) {
          setEditingTaskInfo({ code: data.task.code, title: data.task.title });
        }
      } else if (tab === 'analysis') {
        const analysis = await api.get(`/batches/${batchId}/checklists/analyze/plan`);
        setPlanAnalysis(analysis);
        if (analysis?.maxAttendanceDate) {
          setAutoFillUpToDate(analysis.maxAttendanceDate);
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

    // Strict Rule: If student is marked absent on assessmentDate, they CANNOT be marked achieved on that date
    if (newVal && isAbsent) {
      const suggested = checklistData?.suggestedDates?.[student.id];
      const hint = suggested?.date
        ? ` Tip: Click "Auto-Fill Missing (Plan + Closest Present)" or switch Assessment Date to ${suggested.date} (closest Present day for ${student.full_name}).`
        : '';
      setAbsentWarning(`Cannot assess ${student.full_name} on ${assessmentDate}: Student was marked ABSENT.${hint}`);
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

  // Mark all steps achieved for one student (supports fallback to closest present date if absent on current date)
  const handleAllStepsAchieved = async (student) => {
    if (!checklistData) return;
    const isAbsent = checklistData?.attendanceMap?.[student.id] === 'A';
    let targetDate = assessmentDate;

    if (isAbsent) {
      const suggested = checklistData?.suggestedDates?.[student.id];
      if (suggested?.date) {
        const confirmFallback = window.confirm(
          `${student.full_name} was ABSENT on ${assessmentDate}.\n\nWould you like to mark ${student.full_name} on their closest Present day (${suggested.date}) instead?`
        );
        if (!confirmFallback) return;
        targetDate = suggested.date;
      } else {
        setAbsentWarning(`Cannot assess ${student.full_name}: Student is marked ABSENT on ${assessmentDate} and no closest present date was found.`);
        return;
      }
    }

    setAbsentWarning(null);

    const updates = checklistData.steps.map(st => ({
      student_id: student.id,
      step_id: st.id,
      attempt: 1,
      achieved: true,
      assessed_on: targetDate
    }));

    try {
      await api.put(`/batches/${batchId}/checklists/${selectedTaskId}`, { updates });
      await api.put(`/batches/${batchId}/checklists/${selectedTaskId}/competency`, {
        student_id: student.id,
        competent: true,
        competent_date: targetDate
      });
      setSuccessNotice(`All steps and competency marked for ${student.full_name} on ${targetDate}!`);
      setTimeout(() => setSuccessNotice(null), 3500);
      fetchChecklist();
    } catch (err) {
      setAbsentWarning(err.message);
      fetchChecklist();
    }
  };

  // Bulk action: Mark all present students achieved on selected assessmentDate
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

  // Smart Auto-Fill for Current Task (uses Lesson Plan Date if Present, or Closest Present Date if Absent; never changes existing manual marks)
  const handleAutoFillCurrentTask = async (targetTaskId = selectedTaskId, taskLabel = null) => {
    if (!batchId || !targetTaskId) return;
    setAutoFillLoading(true);
    try {
      // First get preview to show exact breakdown in confirmation dialog
      const prev = await api.post(`/batches/${batchId}/checklists/auto-fill`, {
        scope: 'task',
        taskId: targetTaskId,
        strategy: autoFillStrategy,
        preview: true
      });

      if (prev.studentsFilledCount === 0) {
        alert(
          prev.existingPreservedCount > 0
            ? `All ${prev.existingPreservedCount} students already have manual marks for this task! Nothing to auto-fill.`
            : 'No unmarked students or lesson plan dates found for this task.'
        );
        return;
      }

      const fallbackLines = prev.items
        .filter(i => i.action === 'auto_fill' && i.absent_on_plan_date)
        .map(i => `  • ${i.full_name}: Absent on ${i.plan_date} → Closest Present ${i.chosen_date}`)
        .slice(0, 10);

      const msg = [
        `Auto-Fill Missing Checklist Marks${taskLabel ? ` for ${taskLabel}` : ''}:`,
        ``,
        `• Existing manual students preserved (untouched): ${prev.existingPreservedCount}`,
        `• Unmarked students to fill: ${prev.studentsFilledCount}`,
        `   - Present on Lesson Plan Date: ${prev.planDateMatchesCount}`,
        `   - Absent on Plan Date → Closest Present Date: ${prev.closestPresentFallbackCount}`,
        fallbackLines.length > 0 ? `\nClosest Present Date Assignments:\n${fallbackLines.join('\n')}` : '',
        `\nProceed? (Existing manual marks will NOT be changed)`
      ].filter(Boolean).join('\n');

      if (!window.confirm(msg)) return;

      const res = await api.post(`/batches/${batchId}/checklists/auto-fill`, {
        scope: 'task',
        taskId: targetTaskId,
        strategy: autoFillStrategy,
        preview: false
      });

      setSuccessNotice(
        `Auto-filled ${res.studentsFilledCount} missing students (${res.planDateMatchesCount} on Lesson Plan date, ${res.closestPresentFallbackCount} on closest Present date). ${res.existingPreservedCount} manual records kept untouched!`
      );
      setTimeout(() => setSuccessNotice(null), 5000);
      fetchChecklist();
    } catch (err) {
      alert(err.message || 'Auto-fill failed');
    } finally {
      setAutoFillLoading(false);
    }
  };

  // Preview or Execute Batch Auto-Fill in Analysis Tab
  const handleRunAutoFill = async (isPreview = true) => {
    if (!batchId) return;
    if (!isPreview) {
      if (!window.confirm(
        `Confirm Auto-Fill (${autoFillScope === 'all_taught' ? `All Taught Tasks up to ${autoFillUpToDate}` : autoFillScope === 'module' ? 'Selected Module' : 'Selected Task'})?\n\n` +
        `• Existing manual student checklist marks will NOT be changed.\n` +
        `• Missing students Present on the Lesson Plan date will be marked on that date.\n` +
        `• Missing students Absent on the Lesson Plan date will be marked on their closest Present day.`
      )) {
        return;
      }
    }

    setAutoFillLoading(true);
    try {
      const res = await api.post(`/batches/${batchId}/checklists/auto-fill`, {
        scope: autoFillScope,
        taskId: selectedTaskId,
        moduleId: selectedModuleId,
        upToDate: autoFillUpToDate,
        strategy: autoFillStrategy,
        preview: isPreview
      });
      setAutoFillPreview(res);

      if (!isPreview) {
        setSuccessNotice(
          `Successfully auto-filled ${res.studentsFilledCount} student-task checklists across ${res.tasksProcessed} tasks! (${res.existingPreservedCount} existing manual marks preserved untouched)`
        );
        setTimeout(() => setSuccessNotice(null), 6000);
        fetchChecklist();
      }
    } catch (err) {
      alert(err.message || 'Failed to run auto-fill');
    } finally {
      setAutoFillLoading(false);
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
  const planInfo = checklistData?.planInfo;

  return (
    <div className="space-y-5 pb-24 md:pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Continuous Assessment Checklists</h2>
          <p className="text-xs text-slate-500 mt-0.5">NVQ Level 4 Performance Criteria, Lesson Plan Date Sync & Attendance Validation</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
              onClick={() => setTab('analysis')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 ${
                tab === 'analysis' ? 'bg-indigo-600 text-white' : 'text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Lesson Plan Analysis & Auto-Fill
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
            <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-0.5 shadow-xs">
              <select
                value={printPaperSize}
                onChange={(e) => setPrintPaperSize(e.target.value)}
                title="Select Checklist Print Format (Legal 1-Page All Names or Classic A4 2-Page Split)"
                className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-transparent border-r border-slate-200 outline-none cursor-pointer"
              >
                <option value="legal">📄 Legal (1 Page - All Names)</option>
                <option value="a4">📄 A4 (2 Pages - Classic)</option>
              </select>
              <a
                href={`/api/print/checklist?batchId=${batchId}&taskId=${selectedTaskId}&paperSize=${printPaperSize}&format=html&token=${getToken() || ''}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-md flex items-center gap-1.5 transition-colors ml-0.5"
              >
                <Printer className="w-3.5 h-3.5 text-brand-600" /> Print ({printPaperSize.toUpperCase()})
              </a>
            </div>
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
                  {planInfo?.plan_end && (
                    <button
                      type="button"
                      onClick={() => setAssessmentDate(planInfo.plan_end)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                      title={`Set date to Lesson Plan date (${planInfo.plan_start === planInfo.plan_end ? planInfo.plan_end : `${planInfo.plan_start} – ${planInfo.plan_end}`})`}
                    >
                      Use Plan Date ({planInfo.plan_end})
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowManageSteps(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 flex items-center gap-1.5 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-600" /> Edit Steps / Criteria
                </button>

                <button
                  onClick={() => handleAutoFillCurrentTask(selectedTaskId)}
                  disabled={autoFillLoading || !checklistData}
                  title="Automatically fill only unmarked students using Lesson Plan date if Present, or their closest Present date if Absent. Keeps existing manual marks untouched!"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Auto-Fill Missing (Plan + Closest Present)
                </button>

                <button
                  onClick={handleMarkAllPresent}
                  disabled={saving || !checklistData}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <CheckSquare className="w-3.5 h-3.5" /> Mark Present on {assessmentDate}
                </button>
              </div>
            </div>

            {/* Attendance & Lesson Plan Info Bar */}
            {checklistData && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-3">
                  {planInfo?.plan_start && (
                    <span className="px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      📅 Lesson Plan: {planInfo.plan_start === planInfo.plan_end ? planInfo.plan_start : `${planInfo.plan_start} → ${planInfo.plan_end}`} ({planInfo.plan_hours}h)
                    </span>
                  )}
                  <span className="text-slate-500 font-semibold">
                    Attendance on {assessmentDate}:
                  </span>
                  <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    ✓ {presentCount} Present
                  </span>
                  {absentCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                      🚫 {absentCount} Absent on {assessmentDate}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium">0 Absent</span>
                  )}
                </div>

                <div className="text-[11px] text-slate-500">
                  Tip: Use <strong>Auto-Fill Missing</strong> to keep manual marks and assign absent students to their closest Present day.
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
                        const isComp = checklistData.competencies?.[st.id]?.competent;
                        const compDate = checklistData.competencies?.[st.id]?.competent_date;
                        const suggested = checklistData.suggestedDates?.[st.id];
                        return (
                          <th 
                            key={st.id} 
                            colSpan={2}
                            className={`p-2 text-center border-r border-slate-200 max-w-[125px] min-w-[100px] ${
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

                            {/* Suggested / Existing Date Info */}
                            {!isComp && suggested?.date && (
                              <div className="mt-1 text-[9px] font-semibold text-indigo-600" title={suggested.absentOnPlanDate ? `Absent on Lesson Plan date (${suggested.primaryPlanDate}) → Closest Present day: ${suggested.date}` : `Present on Lesson Plan date: ${suggested.date}`}>
                                {suggested.absentOnPlanDate ? `Closest P: ${suggested.date.slice(5)}` : `Plan: ${suggested.date.slice(5)}`}
                              </div>
                            )}
                            {isComp && compDate && (
                              <div className="mt-1 text-[9px] font-bold text-emerald-700">
                                ✓ {compDate}
                              </div>
                            )}

                            {/* Quick student actions */}
                            <div className="flex items-center justify-center gap-1.5 mt-1">
                              <button
                                onClick={() => handleAllStepsAchieved(st)}
                                title={isAbsent && suggested?.date ? `Absent on ${assessmentDate} — click to mark on closest Present day (${suggested.date})` : 'Mark all steps achieved'}
                                className="text-[10px] font-semibold underline text-brand-600 hover:text-brand-800"
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
                                title={isAbsent ? `Cannot evaluate on ${assessmentDate}: ${st.full_name} is marked ABSENT` : `Click to toggle Attempt 1 for ${st.full_name}`}
                                className={`text-center border-r border-slate-200 select-none transition-colors ${
                                  a1 
                                    ? 'bg-emerald-50 text-emerald-700 font-black hover:bg-emerald-100 cursor-pointer text-xs' 
                                    : isAbsent 
                                      ? 'bg-rose-50/30 text-rose-300 cursor-not-allowed hover:bg-rose-100/50' 
                                      : 'hover:bg-slate-100 text-slate-300 cursor-pointer'
                                }`}
                              >
                                {a1 ? 'C' : isAbsent ? '—' : '·'}
                              </td>

                              {/* Attempt 2 */}
                              <td 
                                onClick={() => handleToggleCell(st, step.id, 2, a2)}
                                title={isAbsent ? `Cannot evaluate on ${assessmentDate}: ${st.full_name} is marked ABSENT` : `Click to toggle Attempt 2 for ${st.full_name}`}
                                className={`text-center border-r border-slate-200 select-none transition-colors ${
                                  a2 
                                    ? 'bg-emerald-50 text-emerald-700 font-black hover:bg-emerald-100 cursor-pointer text-xs' 
                                    : isAbsent 
                                      ? 'bg-rose-50/30 text-rose-300 cursor-not-allowed hover:bg-rose-100/50' 
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
                            title={isAbsent && !isComp ? `Cannot mark competent on ${assessmentDate}: ${st.full_name} was ABSENT` : 'Click to toggle Competency'}
                            className={`p-2 text-center border-r border-slate-200 select-none transition-colors ${
                              isComp 
                                ? 'bg-emerald-100 text-emerald-800 font-bold hover:bg-emerald-200 cursor-pointer' 
                                : isAbsent
                                  ? 'bg-rose-50/40 text-rose-300 cursor-not-allowed'
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
      ) : tab === 'analysis' ? (
        /* Lesson Plan Analysis & Smart Auto-Fill Tab */
        <div className="space-y-5">
          {/* Summary Banner */}
          {planAnalysis && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Manual Records Check</div>
                <div className="text-lg font-black text-emerald-600 mt-1">
                  {planAnalysis.conflictsCount === 0 ? '✓ 0 Attendance Conflicts' : `${planAnalysis.conflictsCount} Conflicts`}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Every manually marked student was Present on their competency date.
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Fully Completed Tasks</div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {planAnalysis.tasks.filter(t => t.status === 'complete').length} Task ({planAnalysis.totalStudents}/{planAnalysis.totalStudents})
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  All {planAnalysis.totalStudents} active students marked on Lesson Plan date.
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Partially Marked (M01–M03)</div>
                <div className="text-lg font-black text-amber-600 mt-1">
                  {planAnalysis.tasks.filter(t => t.status === 'partial_manual').length} Tasks (9/{planAnalysis.totalStudents} marked)
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  9 students manually marked; {planAnalysis.totalStudents - 9} students remaining per task.
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Taught & Unmarked (M04–M08)</div>
                <div className="text-lg font-black text-indigo-600 mt-1">
                  {planAnalysis.tasks.filter(t => t.status === 'taught_unmarked').length} Tasks (0/{planAnalysis.totalStudents} marked)
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Taught up to {planAnalysis.maxAttendanceDate}; ready to auto-fill.
                </div>
              </div>
            </div>
          )}

          {/* Smart Auto-Fill Control Card */}
          <div className="bg-indigo-50/70 rounded-xl border border-indigo-200 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Smart Auto-Fill Checklists from Lesson Plan & Student Attendance
                </h3>
                <p className="text-xs text-indigo-800 mt-0.5">
                  Automatically ticks missing student checklists on the task&apos;s Lesson Plan date if the student was <strong>Present</strong>, or selects the <strong>closest Present day</strong> if the student was Absent. <strong>Existing manual marks are never changed.</strong>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-indigo-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">1. Auto-Fill Scope:</label>
                <select
                  value={autoFillScope}
                  onChange={(e) => { setAutoFillScope(e.target.value); setAutoFillPreview(null); }}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white"
                >
                  <option value="task">Selected Task Only</option>
                  <option value="module">Selected Module ({modules.find(m => String(m.module_id) === String(selectedModuleId))?.code || 'Module'})</option>
                  <option value="all_taught">All Taught Tasks up to Date</option>
                </select>
              </div>

              {autoFillScope === 'all_taught' ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">2. Taught Up To Date:</label>
                  <input
                    type="date"
                    value={autoFillUpToDate}
                    onChange={(e) => { setAutoFillUpToDate(e.target.value); setAutoFillPreview(null); }}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white"
                  />
                </div>
              ) : autoFillScope === 'module' ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">2. Target Module:</label>
                  <select
                    value={selectedModuleId}
                    onChange={(e) => { setSelectedModuleId(e.target.value); setAutoFillPreview(null); }}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white"
                  >
                    {modules.map(m => (
                      <option key={m.module_id} value={m.module_id}>{m.code} - {m.title}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">2. Target Task:</label>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => { setSelectedTaskId(e.target.value); setAutoFillPreview(null); }}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white"
                  >
                    {tasks.map(t => (
                      <option key={t.id} value={t.id}>Task {t.code}: {t.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">3. Lesson Plan Date Rule:</label>
                <select
                  value={autoFillStrategy}
                  onChange={(e) => { setAutoFillStrategy(e.target.value); setAutoFillPreview(null); }}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white"
                >
                  <option value="manual_or_plan_end">Match My Custom/Manual Task Date + Plan End + Closest Present</option>
                  <option value="plan_end">Task Completion Date (Plan End) + Closest Present</option>
                  <option value="plan_start">Task Start Date (Plan Start) + Closest Present</option>
                </select>
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => handleRunAutoFill(true)}
                  disabled={autoFillLoading}
                  className="flex-1 py-1.5 px-3 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-300 font-bold text-xs rounded-lg flex items-center justify-center gap-1 shadow-xs"
                >
                  <Search className="w-3.5 h-3.5" /> Preview
                </button>
                <button
                  type="button"
                  onClick={() => handleRunAutoFill(false)}
                  disabled={autoFillLoading}
                  className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Auto-Fill Now
                </button>
              </div>
            </div>

            {/* Preview Results Box */}
            {autoFillPreview && (
              <div className="bg-white rounded-xl border border-indigo-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="font-bold text-xs text-slate-900">
                    {autoFillPreview.preview ? '🔍 Auto-Fill Preview (No changes saved yet)' : '✅ Auto-Fill Completed'}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                      {autoFillPreview.tasksProcessed} Tasks
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                      ✓ {autoFillPreview.existingPreservedCount} Manual Kept Untouched
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                      📅 {autoFillPreview.planDateMatchesCount} Filled on Lesson Plan Date
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200">
                      ↪ {autoFillPreview.closestPresentFallbackCount} Absent on Plan Date → Closest Present Date
                    </span>
                  </div>
                </div>

                {/* Show table of students who were absent on lesson plan date and assigned closest present date */}
                {autoFillPreview.items?.filter(i => i.action === 'auto_fill').length > 0 && (
                  <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="p-2">Task</th>
                          <th className="p-2">Student</th>
                          <th className="p-2">Lesson Plan Date</th>
                          <th className="p-2">Assigned Checklist Date</th>
                          <th className="p-2">Attendance Rule Applied</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {autoFillPreview.items
                          .filter(i => i.action === 'auto_fill')
                          .slice(0, 150)
                          .map((item, idx) => (
                            <tr key={`${item.task_id}-${item.student_id}-${idx}`} className={item.absent_on_plan_date ? 'bg-amber-50/40' : ''}>
                              <td className="p-2 font-bold text-slate-800">{item.module_code} · {item.task_code}</td>
                              <td className="p-2 font-semibold text-slate-800">{item.full_name}</td>
                              <td className="p-2 text-slate-500">{item.plan_date}</td>
                              <td className="p-2 font-bold text-indigo-700">{item.chosen_date}</td>
                              <td className="p-2">
                                {item.absent_on_plan_date ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                    Absent on {item.plan_date} → Closest Present ({item.chosen_date})
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                                    ✓ Present on Lesson Plan Date
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Task-by-Task Lesson Plan vs Manual Checklist Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Task-by-Task Lesson Plan vs. Manual Checklist Analysis</h3>
                <p className="text-xs text-slate-500">Comparing scheduled Lesson Plan dates with your current manual student checklist marks</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                    <th className="p-3">Module & Task</th>
                    <th className="p-3">Lesson Plan Dates</th>
                    <th className="p-3 text-center">Manual Marked</th>
                    <th className="p-3">Manual Dates Used</th>
                    <th className="p-3 text-center">Missing Students</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {planAnalysis?.tasks?.map(t => (
                    <tr key={t.task_id} className="hover:bg-slate-50/60">
                      <td className="p-3">
                        <span className="font-bold text-brand-700 mr-1.5">{t.module_code} · {t.task_code}</span>
                        <span className="font-semibold text-slate-800">{t.task_title}</span>
                      </td>
                      <td className="p-3 font-medium text-slate-700">
                        {t.plan_start ? (
                          <span>
                            {t.plan_start === t.plan_end ? t.plan_start : `${t.plan_start} → ${t.plan_end}`}
                            <span className="text-slate-400 ml-1">({t.plan_hours}h)</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Not scheduled</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${
                          t.competent_count === t.total_students
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.competent_count > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-500'
                        }`}>
                          {t.competent_count} / {t.total_students}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 font-mono text-[11px]">
                        {t.manual_dates_used?.length > 0 ? t.manual_dates_used.join(', ') : '—'}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-700">
                        {t.missing_count > 0 ? `${t.missing_count} unmarked` : '✓ Done'}
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {t.missing_count > 0 && t.plan_start && (
                            <button
                              onClick={() => handleAutoFillCurrentTask(t.task_id, `${t.module_code} ${t.task_code}`)}
                              disabled={autoFillLoading}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[11px]"
                            >
                              Auto-Fill {t.missing_count}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedModuleId(t.module_id);
                              setTimeout(() => setSelectedTaskId(t.task_id), 50);
                              if (t.plan_end) setAssessmentDate(t.plan_end);
                              setTab('grid');
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[11px]"
                          >
                            Open Grid
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
