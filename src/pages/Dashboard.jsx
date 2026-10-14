import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckSquare, BookMarked, AlertTriangle, Clock, 
  Calendar, CheckCircle2, ChevronRight, XCircle, 
  HelpCircle, ArrowRight, ShieldAlert, Sparkles
} from 'lucide-react';
import { api } from '../api';

export default function Dashboard({ batchId }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [todayLog, setTodayLog] = useState(null);
  const [unresolved, setUnresolved] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [resolving, setResolving] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusForm, setStatusForm] = useState({
    status: 'teacher_absent',
    reason: '',
    hours_delivered: 0,
    strategy: 'shift'
  });
  const [replanPreview, setReplanPreview] = useState(null);

  const today = new Date().toISOString().slice(0, 10);

  const fetchData = async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      // 1. Plan summary
      const sumRes = await api.get(`/batches/${batchId}/plan/summary`);
      setSummary(sumRes);

      // 2. Today's sessions
      const planRes = await api.get(`/batches/${batchId}/plan?from=${today}&to=${today}`);
      setTodaySessions(planRes.sessions || []);

      // 3. Today's day log
      try {
        const logRes = await api.get(`/batches/${batchId}/day-log?from=${today}&to=${today}`);
        setTodayLog(Array.isArray(logRes) ? logRes[0] || null : null);
      } catch { setTodayLog(null); }

      // 4. Unresolved days
      try {
        const unRes = await api.get(`/batches/${batchId}/day-log/unresolved-days`);
        setUnresolved(Array.isArray(unRes) ? unRes : []);
      } catch { setUnresolved([]); }

      // 5. Next 4 upcoming days
      const upRes = await api.get(`/batches/${batchId}/plan?from=${today}`);
      const uniqueDays = [];
      const seenDates = new Set();
      for (const s of (upRes.sessions || [])) {
        if (s.sdate > today && !seenDates.has(s.sdate)) {
          seenDates.add(s.sdate);
          uniqueDays.push(s);
          if (uniqueDays.length >= 4) break;
        }
      }
      setUpcoming(uniqueDays);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [batchId]);

  const handleBulkResolve = async () => {
    if (unresolved.length === 0) return;
    setResolving(true);
    try {
      const dates = unresolved.map(u => u.sdate);
      await api.post(`/batches/${batchId}/day-log/unresolved-days/resolve-bulk`, {
        dates,
        status: 'taught'
      });
      await fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setResolving(false);
    }
  };

  const handlePreviewReplan = async (status, hours) => {
    try {
      const res = await api.post(`/batches/${batchId}/plan/replan/preview`, {
        disruptedDate: today,
        hoursDelivered: Number(hours) || 0,
        strategy: statusForm.strategy
      });
      setReplanPreview(res);
    } catch (e) {
      console.warn('Replan preview error:', e.message);
    }
  };

  const handleConfirmDisruption = async () => {
    try {
      await api.post(`/batches/${batchId}/plan/replan/confirm`, {
        disruptedDate: today,
        status: statusForm.status,
        reason: statusForm.reason || 'Disruption recorded',
        hoursDelivered: Number(statusForm.hours_delivered) || 0,
        strategy: statusForm.strategy
      });
      setStatusModalOpen(false);
      setReplanPreview(null);
      await fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  const curriculumHours = summary?.summary?.totalHours || 720;
  const deliveredHours = summary?.total_delivered || 0;
  const curriculumPercent = Math.min(100, Math.round((deliveredHours / curriculumHours) * 100));

  // Current month target (120h)
  const currentMonthData = summary?.summary?.months?.[0];
  const targetPerMonth = currentMonthData?.target || 120;
  const monthHours = currentMonthData?.hours || 0;

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Unresolved Past Days Banner */}
      {unresolved.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-amber-900 text-sm">
                  {unresolved.length} Past Teaching Day{unresolved.length > 1 ? 's' : ''} Need Resolution
                </h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  Dates: {unresolved.slice(0, 3).map(u => u.sdate).join(', ')}{unresolved.length > 3 ? '...' : ''}. 
                  No attendance or day status has been logged yet.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleBulkResolve}
                disabled={resolving}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              >
                {resolving ? 'Resolving...' : '✓ Bulk: Taught as Planned'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Cards Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Hours */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Curriculum Delivered</span>
            <Clock className="w-4 h-4 text-brand-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{deliveredHours}</span>
            <span className="text-sm font-medium text-slate-500">/ {curriculumHours} Hours</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div 
              className="bg-brand-600 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${curriculumPercent}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex justify-between">
            <span>{curriculumPercent}% completed</span>
            <span>{Math.max(0, curriculumHours - deliveredHours)}h remaining</span>
          </div>
        </div>

        {/* Monthly Target */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Current Month Hours</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{monthHours}</span>
            <span className="text-sm font-medium text-slate-500">/ {targetPerMonth}h target</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${monthHours >= targetPerMonth ? 'bg-emerald-500' : 'bg-brand-500'}`}
              style={{ width: `${Math.min(100, Math.round((monthHours / targetPerMonth) * 100))}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex justify-between">
            <span>Target: 120h / month</span>
            <span className={monthHours >= targetPerMonth ? 'text-emerald-600 font-semibold' : 'text-slate-600'}>
              {monthHours >= targetPerMonth ? 'Target Met ✓' : `${Math.round((monthHours/targetPerMonth)*100)}% of target`}
            </span>
          </div>
        </div>

        {/* Projected End Date */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Projected Course End</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {summary?.summary?.endDate || 'Not planned'}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Duration: 6 Months (Monday–Friday 6.5h/day)
          </p>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            Status: On Track (0 Shortfalls)
          </div>
        </div>
      </div>

      {/* Today's Teaching Sessions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="text-xs font-semibold text-brand-600 uppercase tracking-wider">Today's Schedule</div>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              Planned Teaching for Today ({today})
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/attendance')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5" /> Mark Attendance
            </button>
            <button
              onClick={() => navigate('/diary')}
              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <BookMarked className="w-3.5 h-3.5" /> Work Diary
            </button>
            <button
              onClick={() => {
                setStatusModalOpen(true);
                handlePreviewReplan('teacher_absent', 0);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors"
            >
              Change Day Status
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {todaySessions.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">No teaching sessions planned for today.</p>
              <p className="text-xs text-slate-400 mt-1">Today may be a weekend, holiday, or before the batch start date.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaySessions.map((session, idx) => (
                <div 
                  key={session.id || idx}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-brand-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-lg bg-brand-50 text-brand-700 font-bold text-xs flex items-center justify-center shrink-0 border border-brand-100">
                      #{session.seq}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {session.module_code}
                        </span>
                        {session.task_code && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            Task {session.task_code}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {session.topic_text || session.module_title}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {session.hours} Hours
                    </span>
                    <span className="px-2 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider bg-slate-50 text-slate-500 border border-slate-200">
                      {session.kind}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Days Preview */}
      {upcoming.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-slate-900 text-sm">Upcoming Teaching Days</h4>
            <button 
              onClick={() => navigate('/plan')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              Full Plan <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {upcoming.map((u, i) => (
              <div key={i} className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                <div className="text-xs font-bold text-slate-700">{u.sdate}</div>
                <div className="text-xs text-brand-700 font-semibold mt-1">
                  {u.module_code} {u.task_code ? `· ${u.task_code}` : ''}
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {u.topic_text || u.module_title}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day Status / Disruption Dialog */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Record Day Disruption & Re-plan</h3>
              <button 
                onClick={() => setStatusModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">What happened today?</label>
                <select
                  value={statusForm.status}
                  onChange={(e) => {
                    const st = e.target.value;
                    const h = st === 'partial' ? 3 : 0;
                    setStatusForm({ ...statusForm, status: st, hours_delivered: h });
                    handlePreviewReplan(st, h);
                  }}
                  className="w-full border rounded-lg p-2 text-sm"
                >
                  <option value="teacher_absent">Teacher Absent (Leave / Sick / Official Duty)</option>
                  <option value="institute_closed">Institute Closed (Weather / Event / Closure)</option>
                  <option value="partial">Partial Day (Taught fewer hours than planned)</option>
                  <option value="assessment_day">Assessment Day</option>
                  <option value="substitute">Substitute Teacher Taught</option>
                </select>
              </div>

              {statusForm.status === 'partial' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hours actually delivered:</label>
                  <input
                    type="number"
                    step="0.5"
                    value={statusForm.hours_delivered}
                    onChange={(e) => {
                      const h = Number(e.target.value);
                      setStatusForm({ ...statusForm, hours_delivered: h });
                      handlePreviewReplan(statusForm.status, h);
                    }}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Notes:</label>
                <input
                  type="text"
                  placeholder="e.g. Official meeting at district centre"
                  value={statusForm.reason}
                  onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Re-planning Strategy:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStatusForm({ ...statusForm, strategy: 'shift' });
                      handlePreviewReplan(statusForm.status, statusForm.hours_delivered);
                    }}
                    className={`p-2.5 rounded-lg border text-xs font-semibold text-left transition-colors ${
                      statusForm.strategy === 'shift' 
                        ? 'border-brand-600 bg-brand-50 text-brand-700' 
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>Shift Forward (Default)</div>
                    <div className="text-[11px] font-normal text-slate-500 mt-0.5">Pushes remaining sessions forward</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStatusForm({ ...statusForm, strategy: 'makeup' });
                      handlePreviewReplan(statusForm.status, statusForm.hours_delivered);
                    }}
                    className={`p-2.5 rounded-lg border text-xs font-semibold text-left transition-colors ${
                      statusForm.strategy === 'makeup' 
                        ? 'border-brand-600 bg-brand-50 text-brand-700' 
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>Make-up Hours</div>
                    <div className="text-[11px] font-normal text-slate-500 mt-0.5">Extra hours on next 6 days</div>
                  </button>
                </div>
              </div>

              {replanPreview && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                  <div className="font-semibold text-slate-800">Re-plan Impact:</div>
                  <div className="text-slate-600">Hours Lost: <strong>{replanPreview.hoursLost} h</strong></div>
                  <div className="text-slate-600">Old End Date: {replanPreview.oldEndDate}</div>
                  <div className="text-brand-700 font-bold">New End Date: {replanPreview.newEndDate}</div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button
                onClick={() => setStatusModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisruption}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold"
              >
                Confirm & Re-plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
