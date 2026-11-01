import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock, LogIn, LogOut, Save, Trash2, ChevronLeft, ChevronRight,
  CalendarDays, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { api } from '../api';

const CAP = 6.5;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n) => String(n).padStart(2, '0');
const ymOf = (dateStr) => dateStr.slice(0, 7);
const daysInMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
const toMin = (t) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
/** Actual worked hours (1 decimal) or null */
const worked = (tin, tout) => {
  const a = toMin(tin), b = toMin(tout);
  if (a === null || b === null || b <= a) return null;
  return Math.round(((b - a) / 60) * 10) / 10;
};
/** Report hours: actual if below 6.5, else 6.5 */
const counted = (tin, tout) => {
  const w = worked(tin, tout);
  return w === null ? null : Math.min(CAP, w);
};
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function MyAttendance() {
  const [today, setToday] = useState({ date: localToday(), time: '' });
  const [todayRec, setTodayRec] = useState(null);
  const [month, setMonth] = useState(ymOf(localToday()));
  const [records, setRecords] = useState({}); // date -> saved record
  const [offDays, setOffDays] = useState({}); // date -> { name, type }
  const [drafts, setDrafts] = useState({});   // date -> { time_in, time_out, note }
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const loadToday = async () => {
    try {
      const res = await api.get('/teacher-attendance/today');
      setToday(res.today);
      setTodayRec(res.record);
    } catch (e) {
      console.warn(e.message);
    }
  };

  const loadMonth = async (ym = month) => {
    setLoading(true);
    try {
      const from = `${ym}-01`;
      const to = `${ym}-${pad(daysInMonth(ym))}`;
      const [res, holList] = await Promise.all([
        api.get(`/teacher-attendance?from=${from}&to=${to}`),
        api.get('/holidays').catch(() => [])
      ]);
      const offMap = { ...(res.offDays || {}) };
      (Array.isArray(holList) ? holList : []).forEach(h => {
        if (h.is_off && h.hdate >= from && h.hdate <= to) {
          offMap[h.hdate] = { name: h.name, type: h.type };
        }
      });
      const map = {};
      (res.rows || []).forEach(r => {
        if (!offMap[r.date]) map[r.date] = r;
      });
      setOffDays(offMap);
      setRecords(map);
      setDrafts({});
    } catch (e) {
      flash('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadToday(); }, []);
  useEffect(() => { loadMonth(month); }, [month]);

  const clock = async (action) => {
    setBusy(action);
    try {
      const res = await api.post('/teacher-attendance/clock', { action });
      setTodayRec(res.record);
      setToday(res.today);
      flash('ok', action === 'in' ? `In time marked: ${res.record.time_in}` : `Out time marked: ${res.record.time_out}`);
      if (ymOf(res.today.date) === month) loadMonth(month);
    } catch (e) {
      flash('error', e.message);
    } finally {
      setBusy('');
    }
  };

  const days = useMemo(() => {
    const n = daysInMonth(month);
    return Array.from({ length: n }, (_, i) => {
      const date = `${month}-${pad(i + 1)}`;
      const [y, m, d] = date.split('-').map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      return { date, dow, weekend: dow === 0 || dow === 6 };
    });
  }, [month]);

  const valueOf = (date) => {
    const d = drafts[date];
    const r = records[date];
    return {
      time_in: d ? d.time_in : (r?.time_in || ''),
      time_out: d ? d.time_out : (r?.time_out || ''),
      note: d ? d.note : (r?.note || '')
    };
  };

  const setDraft = (date, patch) => {
    setDrafts(prev => ({ ...prev, [date]: { ...valueOf(date), ...patch } }));
  };

  const saveDay = async (date) => {
    const v = valueOf(date);
    if (v.time_in && v.time_out && toMin(v.time_out) <= toMin(v.time_in)) {
      flash('error', `${date}: Out time must be after In time`);
      return;
    }
    setBusy(date);
    try {
      const res = await api.put(`/teacher-attendance/${date}`, v);
      setRecords(prev => {
        const next = { ...prev };
        if (res.record) next[date] = res.record; else delete next[date];
        return next;
      });
      setDrafts(prev => { const n = { ...prev }; delete n[date]; return n; });
      if (date === today.date) setTodayRec(res.record);
      flash('ok', `Saved ${date}`);
    } catch (e) {
      flash('error', e.message);
    } finally {
      setBusy('');
    }
  };

  const clearDay = async (date) => {
    if (!records[date]) {
      setDrafts(prev => { const n = { ...prev }; delete n[date]; return n; });
      return;
    }
    if (!window.confirm(`Remove attendance for ${date}?`)) return;
    setBusy(date);
    try {
      await api.delete(`/teacher-attendance/${date}`);
      setRecords(prev => { const n = { ...prev }; delete n[date]; return n; });
      setDrafts(prev => { const n = { ...prev }; delete n[date]; return n; });
      if (date === today.date) setTodayRec(null);
    } catch (e) {
      flash('error', e.message);
    } finally {
      setBusy('');
    }
  };

  const saveAll = async () => {
    const dates = Object.keys(drafts);
    if (dates.length === 0) return;
    setBusy('all');
    let ok = 0;
    for (const date of dates) {
      const v = drafts[date];
      if (v.time_in && v.time_out && toMin(v.time_out) <= toMin(v.time_in)) continue;
      try {
        await api.put(`/teacher-attendance/${date}`, v);
        ok++;
      } catch (e) { /* reported below */ }
    }
    setBusy('');
    flash(ok === dates.length ? 'ok' : 'error', `Saved ${ok} of ${dates.length} day(s)`);
    loadMonth(month);
    loadToday();
  };

  const fillWeekdays = () => {
    const patch = {};
    days.forEach(d => {
      if (d.weekend || offDays[d.date] || records[d.date] || drafts[d.date]) return;
      if (d.date > today.date) return;
      patch[d.date] = { time_in: '09:00', time_out: '15:30', note: '' };
    });
    if (Object.keys(patch).length === 0) {
      flash('error', 'No empty teaching weekdays to fill');
      return;
    }
    setDrafts(prev => ({ ...prev, ...patch }));
    flash('ok', `Filled ${Object.keys(patch).length} teaching weekdays (09:00 - 15:30, holidays skipped). Adjust & press "Save All".`);
  };

  const totals = useMemo(() => {
    let daysMarked = 0, countedSum = 0, workedSum = 0;
    days.forEach(d => {
      if (offDays[d.date]) return;
      const v = valueOf(d.date);
      const c = counted(v.time_in, v.time_out);
      if (c !== null) {
        daysMarked++;
        countedSum += c;
        workedSum += worked(v.time_in, v.time_out);
      }
    });
    return {
      daysMarked,
      counted: Math.round(countedSum * 10) / 10,
      worked: Math.round(workedSum * 10) / 10
    };
  }, [days, records, drafts, offDays]);

  const todayWorked = worked(todayRec?.time_in, todayRec?.time_out);
  const todayCounted = counted(todayRec?.time_in, todayRec?.time_out);
  const dirtyCount = Object.keys(drafts).length;
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      <div>
        <h2 className="text-xl font-bold text-slate-900">My Attendance (In / Out)</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Instructor daily attendance. Used for <strong>ගත කළ කාලය</strong> and <strong>ගතවූ පැය ගණන</strong> in the monthly report
          (hours above {CAP}h are shown as {CAP}h).
        </p>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
          msg.type === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-700'
        }`}>
          {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {/* Today card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-brand-600 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Today · {today.date}
            </div>
            <div className="mt-2 flex flex-wrap gap-6 text-sm">
              <div>
                <div className="text-[11px] text-slate-500 font-semibold">IN</div>
                <div className="text-2xl font-black text-slate-900">{todayRec?.time_in || '--:--'}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-semibold">OUT</div>
                <div className="text-2xl font-black text-slate-900">{todayRec?.time_out || '--:--'}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-semibold">REPORT HOURS</div>
                <div className={`text-2xl font-black ${todayCounted !== null && todayCounted < CAP ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {todayCounted !== null ? `${todayCounted}h` : '-'}
                </div>
                {todayWorked !== null && todayWorked > CAP && (
                  <div className="text-[10px] text-slate-400">worked {todayWorked}h</div>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => clock('in')}
              disabled={!!busy}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-sm flex items-center gap-2 btn-press"
            >
              <LogIn className="w-4 h-4" /> {todayRec?.time_in ? 'Update In' : 'Mark In'}
            </button>
            <button
              onClick={() => clock('out')}
              disabled={!!busy}
              className="px-5 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-sm flex items-center gap-2 btn-press"
            >
              <LogOut className="w-4 h-4" /> {todayRec?.time_out ? 'Update Out' : 'Mark Out'}
            </button>
          </div>
        </div>
      </div>

      {/* Monthly manual entry */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-brand-600" />
            <button onClick={() => setMonth(shiftMonth(month, -1))} className="p-1.5 rounded-lg hover:bg-slate-100" title="Previous month">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white"
            />
            <button onClick={() => setMonth(shiftMonth(month, 1))} className="p-1.5 rounded-lg hover:bg-slate-100" title="Next month">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMonth(shiftMonth(ymOf(today.date), -1))}
              className="ml-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 hover:bg-slate-50"
            >
              Last Month
            </button>
            <button
              onClick={() => setMonth(ymOf(today.date))}
              className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 hover:bg-slate-50"
            >
              This Month
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fillWeekdays}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 hover:bg-slate-50"
              title="Pre-fill empty weekdays with 09:00 - 15:30 (not saved until you press Save All)"
            >
              Fill empty weekdays
            </button>
            <button
              onClick={saveAll}
              disabled={dirtyCount === 0 || busy === 'all'}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> {busy === 'all' ? 'Saving...' : `Save All${dirtyCount ? ` (${dirtyCount})` : ''}`}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Days Marked</div>
            <div className="text-xl font-black text-slate-900">{totals.daysMarked}</div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="text-[11px] font-bold text-emerald-700 uppercase">Report Hours (≤{CAP}/day)</div>
            <div className="text-xl font-black text-emerald-700">{totals.counted}h</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Actual Worked</div>
            <div className="text-xl font-black text-slate-900">{totals.worked}h</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-700 font-bold">
                <th className="p-2">Date ({monthLabel})</th>
                <th className="p-2">In</th>
                <th className="p-2">Out</th>
                <th className="p-2">Note</th>
                <th className="p-2 text-right">Report Hours</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400">Loading...</td></tr>
              ) : days.map(d => {
                const off = offDays[d.date];
                if (off) {
                  return (
                    <tr key={d.date} className="bg-rose-50/60 text-rose-700">
                      <td className="p-2 whitespace-nowrap font-bold">
                        {d.date} <span className="text-rose-400 font-normal">{WEEKDAYS[d.dow]}</span>
                      </td>
                      <td colSpan={3} className="p-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          Holiday / Class Off: {off.name}
                        </span>
                      </td>
                      <td className="p-2 text-right font-semibold text-rose-500">Off</td>
                      <td className="p-2 text-right text-slate-300">—</td>
                    </tr>
                  );
                }
                const v = valueOf(d.date);
                const w = worked(v.time_in, v.time_out);
                const c = counted(v.time_in, v.time_out);
                const dirty = !!drafts[d.date];
                const invalid = v.time_in && v.time_out && w === null;
                return (
                  <tr key={d.date} className={`${d.weekend ? 'bg-slate-50/70 text-slate-400' : ''} ${d.date === today.date ? 'ring-1 ring-inset ring-brand-300' : ''}`}>
                    <td className="p-2 whitespace-nowrap font-semibold">
                      {d.date} <span className="text-slate-400 font-normal">{WEEKDAYS[d.dow]}</span>
                    </td>
                    <td className="p-2">
                      <input
                        type="time"
                        value={v.time_in}
                        onChange={(e) => setDraft(d.date, { time_in: e.target.value })}
                        className="border border-slate-300 rounded-md px-1.5 py-0.5 text-xs bg-white"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="time"
                        value={v.time_out}
                        onChange={(e) => setDraft(d.date, { time_out: e.target.value })}
                        className={`border rounded-md px-1.5 py-0.5 text-xs bg-white ${invalid ? 'border-rose-400' : 'border-slate-300'}`}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={v.note}
                        placeholder="optional"
                        onChange={(e) => setDraft(d.date, { note: e.target.value })}
                        className="border border-slate-300 rounded-md px-1.5 py-0.5 text-xs bg-white w-full min-w-[100px]"
                      />
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {invalid ? (
                        <span className="text-rose-600 font-bold">Out ≤ In</span>
                      ) : c !== null ? (
                        <span className={`font-bold ${c < CAP ? 'text-amber-600' : 'text-emerald-700'}`}>
                          {c}h{w > CAP && <span className="text-[10px] text-slate-400 font-normal"> ({w}h)</span>}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => saveDay(d.date)}
                        disabled={!dirty || busy === d.date}
                        className="p-1.5 rounded-md text-brand-600 hover:bg-brand-50 disabled:opacity-30"
                        title="Save"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => clearDay(d.date)}
                        disabled={(!records[d.date] && !dirty) || busy === d.date}
                        className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                        title="Clear"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

