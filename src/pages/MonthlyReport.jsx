import React, { useState, useEffect } from 'react';
import { 
  FileText, Printer, CheckCircle2, AlertTriangle, 
  Calendar, Save, Download, RefreshCw, Clock, 
  DollarSign, CheckCheck, ChevronRight, Layers, Award
} from 'lucide-react';
import { api, getToken } from '../api';

export default function MonthlyReport({ batchId }) {
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  // 1. Fetch standard monthly periods for batch
  useEffect(() => {
    if (!batchId) return;
    api.get(`/reports/periods?batchId=${batchId}`)
      .then(p => {
        if (Array.isArray(p) && p.length > 0) {
          setPeriods(p);
          // Default to the first period (Month 1) or most active
          setFrom(p[0].from);
          setTo(p[0].to);
          setSelectedPeriodIdx(0);
        } else {
          // Fallback to batch start date + 30 days
          api.get(`/batches/${batchId}`).then(b => {
            if (b && b.start_date) {
              setFrom(b.start_date);
              const d = new Date(b.start_date + 'T00:00:00');
              d.setDate(d.getDate() + 30);
              setTo(d.toISOString().slice(0, 10));
            }
          });
        }
      })
      .catch(err => console.warn('Periods fetch error:', err));
  }, [batchId]);

  // 2. Fetch report data when from & to dates change
  const fetchReport = async () => {
    if (!batchId || !from || !to) return;
    setLoading(true);
    try {
      const data = await api.get(`/reports/monthly?batchId=${batchId}&from=${from}&to=${to}`);
      setReportData(data);
    } catch (err) {
      console.error('Report fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (from && to) {
      fetchReport();
    }
  }, [batchId, from, to]);

  const handlePeriodSelect = (p, idx) => {
    setSelectedPeriodIdx(idx);
    setFrom(p.from);
    setTo(p.to);
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await api.post('/reports/monthly/confirm', { batchId, from, to });
      setConfirmedSuccess(true);
      setTimeout(() => setConfirmedSuccess(false), 3000);
    } catch (err) {
      alert(err.message || 'Failed to confirm report snapshot');
    } finally {
      setConfirming(false);
    }
  };

  const token = getToken() || '';
  const salary = reportData?.salary;

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Official NYSC Monthly Progress Report</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              උපදේශක සටහන්
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Two-page Sinhala government form for instructor teaching progress &amp; 120-hour salary verification
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download Official PDF */}
          <a
            href={`/api/print/monthly-report?batchId=${batchId}&from=${from}&to=${to}&format=pdf&token=${token}`}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 btn-press"
            title="Download Official 2-Page Progress Report PDF (උපදේශක සටහන්)"
          >
            <Download className="w-3.5 h-3.5" /> Download Report PDF
          </a>

          {/* Print Official Form */}
          <a
            href={`/api/print/monthly-report?batchId=${batchId}&from=${from}&to=${to}&format=html&token=${token}`}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 btn-press"
            title="Print Official 2-Page Progress Report Form"
          >
            <Printer className="w-3.5 h-3.5" /> Print Report Form
          </a>

          {/* Download Monthly Plan Calendar Grid (Monthly Plan October.pdf format) */}
          <a
            href={`/api/print/monthly-plan?batchId=${batchId}&from=${from}&to=${to}&format=pdf&token=${token}`}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 btn-press"
            title="Download 5-Column Monthly Plan Calendar Grid PDF"
          >
            <Download className="w-3.5 h-3.5" /> Monthly Plan Grid (PDF)
          </a>

          {/* Print Monthly Plan Calendar Grid */}
          <a
            href={`/api/print/monthly-plan?batchId=${batchId}&from=${from}&to=${to}&format=html&token=${token}`}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            title="Print 5-Column Monthly Plan Calendar Grid"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" /> Plan Grid Print
          </a>

          {/* Save / Confirm Snapshot */}
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> {confirming ? 'Saving...' : 'Confirm & Archive'}
          </button>
        </div>
      </div>

      {/* Salary & 120 Hours Qualification Card */}
      {salary && (
        <div className={`p-5 rounded-2xl border transition-all ${
          salary.isEligible 
            ? 'bg-gradient-to-r from-emerald-50 via-teal-50/60 to-white border-emerald-300 shadow-xs'
            : 'bg-gradient-to-r from-amber-50 via-orange-50/60 to-white border-amber-300 shadow-xs'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  salary.isEligible 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-amber-600 text-white'
                }`}>
                  {salary.isEligible ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {salary.isEligible 
                    ? (salary.isInitialPartialMonth ? 'Initial Startup Target Met (ආරම්භක ඉලක්කය සම්පූර්ණයි)' : 'Salary Target Met (පැය 120 සම්පූර්ණයි)')
                    : 'Target Deficit / In Progress (පැය 120 සම්පූර්ණ වී නොමැත)'}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {salary.teachingDays} Teaching Days Recorded
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-900">
                {salary.achievedHours} <span className="text-xs font-bold text-slate-500">Hours Taught</span> / {salary.targetHours} <span className="text-xs font-bold text-slate-500">Hours Target</span>
                {salary.diff !== 0 && (
                  <span className={`ml-2 text-xs font-extrabold ${salary.diff > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    ({salary.diff > 0 ? `+${salary.diff}h Surplus` : `${salary.diff}h Deficit`})
                  </span>
                )}
              </h3>

              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                {salary.explanation}
              </p>
            </div>

            {/* Quick 120h Progress Gauge */}
            <div className="min-w-[200px] bg-white/80 p-3 rounded-xl border border-slate-200/80 shadow-2xs text-center">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Salary Requirement</div>
              <div className="text-2xl font-black mt-0.5 text-slate-900">
                {Math.round((salary.achievedHours / salary.targetHours) * 100)}%
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 mt-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    salary.isEligible ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((salary.achievedHours / salary.targetHours) * 100))}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 mt-1 font-semibold">
                {salary.isInitialPartialMonth ? 'Initial Startup Period: 26 Hours (4 Teaching Days)' : 'Official Head Office Standard: 120 Hours/Month'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Month Selector Tabs & Period Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-brand-600" /> Select Monthly Salary Cycle:
          </span>
          <button
            onClick={fetchReport}
            className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh from Day Log
          </button>
        </div>

        {/* Quick Month Tabs */}
        {periods.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {periods.map((p, idx) => {
              const isSelected = selectedPeriodIdx === idx && from === p.from && to === p.to;
              return (
                <button
                  key={idx}
                  onClick={() => handlePeriodSelect(p, idx)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50/80 ring-2 ring-brand-500/20'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{p.title}</span>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
                      p.isEligible 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : p.taughtHours > 0 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {p.taughtHours}h
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 whitespace-nowrap">
                    {p.from.slice(5)} to {p.to.slice(5)}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Manual Date Range Inputs & Sum Check */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-600">Custom Dates:</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setSelectedPeriodIdx(-1);
                setFrom(e.target.value);
              }}
              className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setSelectedPeriodIdx(-1);
                setTo(e.target.value);
              }}
              className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white"
            />
          </div>

          {reportData && (
            <div className="flex items-center gap-2">
              {reportData.hoursMatch ? (
                <span className="px-3 py-1 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sum Check Passed (Page 1: {reportData.page1.totals.totalThisMonthHours}h = Page 2: {reportData.page2.totalHours}h)
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Sum Mismatch (P1: {reportData.page1.totals.totalThisMonthHours}h vs P2: {reportData.page2.totalHours}h)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {confirmedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold text-center animate-in fade-in">
          ✓ Monthly report snapshot confirmed and archived successfully!
        </div>
      )}

      {/* Warnings */}
      {reportData?.warnings?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-amber-800">
            <AlertTriangle className="w-4 h-4" /> Attention Required:
          </div>
          {reportData.warnings.map((w, i) => (
            <div key={i} className="text-amber-700 pl-6">• {w.message}</div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto"></div>
          <p className="text-sm text-slate-500 mt-3 font-medium">Generating official monthly progress report...</p>
        </div>
      ) : reportData && (
        <div className="space-y-6">
          {/* Page 1 Preview (Landscape Table) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <div className="border-b pb-3 mb-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-brand-600 uppercase">Page 1 (Landscape)</span>
                <h3 className="text-base font-bold text-slate-900">මාසික ප්‍රගති වාර්තාව (මොඩියුලර් සාරාංශය)</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  විෂය නිර්දේශයට අදාළ පැය ගණන හා මාසික ඉගැන්වීම් ප්‍රගතිය
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
                Official Sinhala NYSC Form
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="p-2 w-8 text-center">#</th>
                    <th className="p-2">මොඩියුලය (Module)</th>
                    <th className="p-2 text-right">මුළු පැය (Total)</th>
                    <th className="p-2 text-right">පෙර මස (Prev)</th>
                    <th className="p-2 text-right">අදාළ මස (This Month)</th>
                    <th className="p-2 text-right">මෙතෙක් එකතුව (To Date)</th>
                    <th className="p-2 text-right">ඉතිරි (Remaining)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.page1.rows.map((r, i) => (
                    <tr key={r.module_id} className="hover:bg-slate-50/50">
                      <td className="p-2 text-center text-slate-400">{i + 1}</td>
                      <td className="p-2 font-semibold text-slate-900">
                        {r.code} - {r.title}
                      </td>
                      <td className="p-2 text-right font-medium">{r.total_hours} h</td>
                      <td className="p-2 text-right text-slate-500">{r.prev_hours > 0 ? `${r.prev_hours} h` : '-'}</td>
                      <td className="p-2 text-right font-bold text-brand-700">{r.this_month_hours > 0 ? `${r.this_month_hours} h` : '-'}</td>
                      <td className="p-2 text-right font-semibold text-slate-800">{r.to_date_hours > 0 ? `${r.to_date_hours} h` : '-'}</td>
                      <td className="p-2 text-right text-slate-400">{r.remaining_hours} h</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300">
                    <td colSpan={2} className="p-2 text-right">එකතුව (Total Hours):</td>
                    <td className="p-2 text-right">{reportData.page1.totals.totalCurriculumHours} h</td>
                    <td className="p-2 text-right">{reportData.page1.totals.totalPrevHours} h</td>
                    <td className="p-2 text-right text-brand-700 font-extrabold">{reportData.page1.totals.totalThisMonthHours} h</td>
                    <td className="p-2 text-right">{reportData.page1.totals.totalToDateHours} h</td>
                    <td className="p-2 text-right">{reportData.page1.totals.remainingHours} h</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-3 p-3 bg-slate-50 rounded-lg flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>අදාළ මස සම්පූර්ණ කළ මුළු පැය ගණන: <strong className="text-brand-700">{reportData.page1.totals.totalThisMonthHours} Hours</strong></span>
              <span>ඉලක්කය: <strong>120 Hours</strong> ({salary?.isEligible ? 'සම්පූර්ණයි ✓' : 'අඩුයි ⚠️'})</span>
            </div>
          </div>

          {/* Page 2 Preview (Portrait Daily Diary Rows) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <div className="border-b pb-3 mb-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-brand-600 uppercase">Page 2 (Portrait)</span>
                <h3 className="text-base font-bold text-slate-900">දෛනික දිනසටහන් වගුව (Daily Work Diary Rows)</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  දිනපතා ඉගැන්වූ මාතෘකා, ප්‍රායෝගික ක්‍රියාකාරකම් හා පැය විස්තරය
                </p>
              </div>
              <span className="text-xs font-bold text-slate-700">
                {reportData.page2.rows.length} Teaching Days · {reportData.page2.totalHours} Total Hours
              </span>
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-200 text-slate-700 font-bold">
                    <th className="p-2.5 w-24">දිනය (Date)</th>
                    <th className="p-2.5">දිනකෘත්‍යය / විස්තරය (Summary)</th>
                    <th className="p-2.5">ක්‍රියාකාරකම් (Activities)</th>
                    <th className="p-2.5 text-center w-28">කාලය (Time)</th>
                    <th className="p-2.5 text-right w-20">පැය (Hours)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.page2.rows.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-slate-400">මෙම කාලසීමාව සඳහා දිනසටහන් නොමැත</td></tr>
                  ) : (
                    reportData.page2.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">{r.date}</td>
                        <td className="p-2.5 text-slate-800">{r.summary}</td>
                        <td className="p-2.5 text-slate-600">{r.activities}</td>
                        <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">{r.time_text}</td>
                        <td className="p-2.5 text-right font-bold text-slate-900">{r.hours} h</td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300">
                    <td colSpan={4} className="p-2.5 text-right">මුළු එකතුව (Total Hours on Page 2):</td>
                    <td className="p-2.5 text-right text-brand-700 font-extrabold">{reportData.page2.totalHours} h</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
