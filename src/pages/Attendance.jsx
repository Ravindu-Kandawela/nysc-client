import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, Clock, AlertCircle, Calendar, Save, CheckCheck, Printer, 
  BarChart3, ChevronLeft, ChevronRight, Download, Search, Users, 
  TrendingUp, X, MessageCircle, Send, Phone, Copy, Bell, Edit2, ExternalLink, Smartphone, Shield 
} from 'lucide-react';
import { api } from '../api';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_NAMES_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export default function Attendance({ batchId }) {
  const [tab, setTab] = useState('daily'); // 'daily' | 'monthly' | 'overall'
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const [dayLog, setDayLog] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Monthly grid state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyData, setMonthlyData] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const printRef = useRef(null);

  // Overall summary state
  const [overallData, setOverallData] = useState([]);
  const [overallLoading, setOverallLoading] = useState(false);
  const [overallFrom, setOverallFrom] = useState('');
  const [overallTo, setOverallTo] = useState('');
  const [overallSearch, setOverallSearch] = useState('');
  const [overallSort, setOverallSort] = useState('order'); // 'order' | 'pct-asc' | 'pct-desc' | 'name'
  const LOW_THRESHOLD = 80;

  // ── Absent Parent Alert States ──
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertData, setAlertData] = useState(null);
  const [alertLang, setAlertLang] = useState('si'); // 'si' | 'en' | 'combined'
  const [copiedToast, setCopiedToast] = useState(null);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editParentPhone, setEditParentPhone] = useState('');
  const [editParentName, setEditParentName] = useState('');
  const [notifiedMap, setNotifiedMap] = useState({});
  const [iphoneInfo, setIphoneInfo] = useState(null);
  const [showIphoneGuide, setShowIphoneGuide] = useState(false);
  const [copiedUrlToast, setCopiedUrlToast] = useState(false);
  const [copiedOicUrlToast, setCopiedOicUrlToast] = useState(false);
  const [copiedOicMsgToast, setCopiedOicMsgToast] = useState(false);
  const [smsTab, setSmsTab] = useState('parents'); // 'parents' | 'oic'
  const [oicSummaryData, setOicSummaryData] = useState(null);

  const fetchAlertData = async () => {
    if (!batchId) return;
    setAlertLoading(true);
    try {
      const res = await api.get(`/batches/${batchId}/attendance/absent-alerts?date=${date}`);
      setAlertData(res);
      const map = {};
      (res.absentees || []).forEach(a => {
        if (a.notified) {
          map[a.id] = a.last_notified_at ? a.last_notified_at.slice(11, 16) : 'Sent';
        }
      });
      setNotifiedMap(map);

      // Fetch local IP for iPhone Shortcut
      try {
        const info = await api.get('/auto-sms/info');
        setIphoneInfo(info);
      } catch (e) { /* ignore */ }

      // Fetch OIC Daily Attendance Summary
      try {
        const oic = await api.get(`/auto-sms/oic-summary?batchId=${batchId}&date=${date}`);
        setOicSummaryData(oic);
      } catch (e) { /* ignore */ }
    } catch (err) {
      console.error('Failed to fetch absent alerts:', err);
    } finally {
      setAlertLoading(false);
    }
  };

  useEffect(() => {
    if (alertModalOpen) {
      fetchAlertData();
    }
  }, [alertModalOpen, batchId, date]);

  const handleSendWhatsApp = async (st, langKey = alertLang) => {
    const url = langKey === 'si' ? st.links.whatsapp_si : langKey === 'en' ? st.links.whatsapp_en : st.links.whatsapp_combined;
    if (!url) {
      alert(`Parent phone number is missing for ${st.full_name}. Please add a phone number first.`);
      setEditingStudentId(st.id);
      setEditParentPhone('');
      setEditParentName(st.parent_name || '');
      return;
    }
    window.open(url, '_blank');
    try {
      await api.post(`/batches/${batchId}/attendance/absent-alerts/log`, {
        student_id: st.id,
        date,
        channel: 'whatsapp',
        recipient_phone: st.parent_phone_formatted,
        message_text: st.messages[langKey]
      });
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setNotifiedMap(prev => ({ ...prev, [st.id]: nowTime }));
    } catch (err) {
      console.error('Failed to log WhatsApp alert:', err);
    }
  };

  const handleSendSMS = async (st, langKey = alertLang) => {
    const url = langKey === 'en' ? st.links.sms_en : st.links.sms_si;
    if (!url) {
      alert(`Parent phone number is missing for ${st.full_name}.`);
      return;
    }
    window.location.href = url;
    try {
      await api.post(`/batches/${batchId}/attendance/absent-alerts/log`, {
        student_id: st.id,
        date,
        channel: 'sms',
        recipient_phone: st.parent_phone_formatted,
        message_text: st.messages[langKey]
      });
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setNotifiedMap(prev => ({ ...prev, [st.id]: nowTime }));
    } catch (err) {
      console.error('Failed to log SMS alert:', err);
    }
  };

  const handleSendAllWhatsApp = () => {
    if (!alertData || !alertData.absentees) return;
    const withPhone = alertData.absentees.filter(a => a.parent_phone_formatted);
    if (withPhone.length === 0) {
      alert('No parent phone numbers available for absent students.');
      return;
    }
    withPhone.forEach((st, idx) => {
      setTimeout(() => {
        handleSendWhatsApp(st, alertLang);
      }, idx * 1200);
    });
  };

  const handleSaveParentPhone = async (studentId) => {
    if (!editParentPhone.trim()) {
      alert('Please enter a valid phone number');
      return;
    }
    try {
      await api.post(`/batches/${batchId}/attendance/absent-alerts/quick-update-parent`, {
        student_id: studentId,
        parent_name: editParentName || undefined,
        parent_phone: editParentPhone.trim()
      });
      setEditingStudentId(null);
      fetchAlertData();
      fetchAttendance();
    } catch (err) {
      alert('Failed to save parent phone: ' + err.message);
    }
  };

  const handleCopyNumbers = () => {
    if (!alertData || !alertData.absentees) return;
    const nums = alertData.absentees
      .map(a => a.parent_phone || a.phone)
      .filter(Boolean)
      .join(', ');
    if (!nums) {
      alert('No phone numbers available to copy');
      return;
    }
    navigator.clipboard.writeText(nums);
    setCopiedToast('numbers');
    setTimeout(() => setCopiedToast(null), 3000);
  };

  const handleCopyNotice = () => {
    if (!alertData || !alertData.absentees) return;
    const template = alertData.absentees.map(a => 
      `• ${a.full_name} (${a.reg_no || 'NVQ4'}): ${a.parent_phone || 'No phone'}`
    ).join('\n');
    const fullText = `[NYSC AKURESSA - ABSENTEE PARENT ALERTS - ${date}]\n\n${template}`;
    navigator.clipboard.writeText(fullText);
    setCopiedToast('notice');
    setTimeout(() => setCopiedToast(null), 3000);
  };

  // ── Daily Attendance ──
  const fetchAttendance = async () => {
    if (!batchId) return;
    setLoading(true);
    setSavedSuccess(false);
    try {
      const res = await api.get(`/batches/${batchId}/attendance?date=${date}`);
      setStudents(res.attendance || []);
      setDayLog(res.day_log);
    } catch (err) {
      console.error('Attendance fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'daily') fetchAttendance();
  }, [batchId, date, tab]);

  // ── Monthly Grid ──
  const fetchMonthlyGrid = async () => {
    if (!batchId) return;
    setMonthlyLoading(true);
    try {
      const res = await api.get(`/batches/${batchId}/attendance/monthly-grid?month=${selectedMonth}`);
      setMonthlyData(res);
    } catch (err) {
      console.error('Monthly grid error:', err);
    } finally {
      setMonthlyLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'monthly') fetchMonthlyGrid();
  }, [batchId, selectedMonth, tab]);

  // ── Overall Summary ──
  const fetchOverall = async () => {
    if (!batchId) return;
    setOverallLoading(true);
    try {
      const qs = overallFrom && overallTo ? `?from=${overallFrom}&to=${overallTo}` : '';
      const res = await api.get(`/batches/${batchId}/attendance/summary${qs}`);
      setOverallData(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Overall summary error:', err);
    } finally {
      setOverallLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== 'overall') return;
    // Only refetch when range is fully set or fully cleared
    if ((overallFrom && overallTo) || (!overallFrom && !overallTo)) fetchOverall();
  }, [batchId, tab, overallFrom, overallTo]);

  const overallStats = (() => {
    const totals = overallData.reduce((acc, s) => {
      acc.present += s.present_days;
      acc.absent += s.absent_days;
      acc.late += s.late_days;
      acc.excused += s.excused_days;
      acc.marked += s.total_days;
      return acc;
    }, { present: 0, absent: 0, late: 0, excused: 0, marked: 0 });
    const classDays = overallData.reduce((m, s) => Math.max(m, s.total_days), 0);
    const overallPct = totals.marked > 0 ? Math.round(((totals.present + totals.late) / totals.marked) * 100) : 0;
    const lowCount = overallData.filter(s => s.total_days > 0 && s.attendance_percentage < LOW_THRESHOLD).length;
    return { ...totals, classDays, overallPct, lowCount };
  })();

  const overallRows = overallData
    .filter(s => {
      const q = overallSearch.trim().toLowerCase();
      if (!q) return true;
      return s.full_name.toLowerCase().includes(q) || (s.reg_no || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (overallSort === 'pct-asc') return a.attendance_percentage - b.attendance_percentage;
      if (overallSort === 'pct-desc') return b.attendance_percentage - a.attendance_percentage;
      if (overallSort === 'name') return a.full_name.localeCompare(b.full_name);
      return 0; // keep server sort_order
    });

  const pctTone = (pct, hasData) => {
    if (!hasData) return { bar: 'bg-slate-300', text: 'text-slate-400', chip: 'bg-slate-100 text-slate-500 border-slate-200' };
    if (pct >= 90) return { bar: 'bg-emerald-500', text: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (pct >= LOW_THRESHOLD) return { bar: 'bg-amber-500', text: 'text-amber-700', chip: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { bar: 'bg-rose-500', text: 'text-rose-700', chip: 'bg-rose-50 text-rose-700 border-rose-200' };
  };

  const handleStatusChange = (studentId, status) => {
    setStudents(prev => prev.map(s => s.student_id === studentId ? { ...s, status } : s));
  };

  const handleNoteChange = (studentId, note) => {
    setStudents(prev => prev.map(s => s.student_id === studentId ? { ...s, note } : s));
  };

  const handleAllPresent = () => {
    setStudents(prev => prev.map(s => ({ ...s, status: 'P' })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const records = students.map(s => ({
        student_id: s.student_id,
        status: s.status,
        note: s.note
      }));
      await api.put(`/batches/${batchId}/attendance/${date}`, { records });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const navigateMonth = (dir) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handlePrintMonthly = () => {
    window.print();
  };

  const [downloading, setDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setDownloading(true);
    try {
      const gridEl = printRef.current.querySelector('.monthly-grid-container');
      if (!gridEl) return;

      const canvas = await html2canvas(gridEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: gridEl.scrollWidth + 40,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Add title
      const monthName = MONTH_NAMES[parseInt(selectedMonth.split('-')[1]) - 1];
      const yearStr = selectedMonth.split('-')[0];
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.text(`Monthly Attendance Register - ${monthName} ${yearStr}`, pageWidth / 2, 10, { align: 'center' });

      // Fit image
      const margin = 6;
      const topOffset = 15;
      const availW = pageWidth - margin * 2;
      const availH = pageHeight - topOffset - margin;
      const imgRatio = canvas.width / canvas.height;
      let imgW = availW;
      let imgH = imgW / imgRatio;
      if (imgH > availH) {
        imgH = availH;
        imgW = imgH * imgRatio;
      }

      pdf.addImage(imgData, 'PNG', margin, topOffset, imgW, imgH);
      pdf.save(`Attendance_${monthName}_${yearStr}.pdf`);
    } catch (err) {
      console.error('PDF download error:', err);
      alert('Failed to generate PDF. Please try Print instead.');
    } finally {
      setDownloading(false);
    }
  };

  const presentCount = students.filter(s => s.status === 'P').length;
  const absentCount = students.filter(s => s.status === 'A').length;
  const lateCount = students.filter(s => s.status === 'L').length;
  const excusedCount = students.filter(s => s.status === 'E').length;

  // Helper: get day type for coloring
  const getDayType = (dayNum) => {
    if (!monthlyData) return 'normal';
    const [y, m] = selectedMonth.split('-').map(Number);
    const dateObj = new Date(y, m - 1, dayNum);
    const dow = dateObj.getDay(); // 0=Sun, 6=Sat
    
    // Check holidays first
    const holiday = monthlyData.holidays[dayNum];
    if (holiday && holiday.is_off) return 'holiday';
    
    // Saturdays and Sundays
    if (dow === 0 || dow === 6) return 'weekend';
    
    // Holiday that is NOT off (still teaching)
    if (holiday && !holiday.is_off) return 'holiday-teaching';
    
    return 'normal';
  };

  const getDayTooltip = (dayNum) => {
    if (!monthlyData) return '';
    const holiday = monthlyData.holidays[dayNum];
    if (holiday) return holiday.name;
    const [y, m] = selectedMonth.split('-').map(Number);
    const dateObj = new Date(y, m - 1, dayNum);
    return DAY_NAMES[dateObj.getDay()];
  };

  const getStatusSymbol = (status) => {
    if (!status) return '';
    return status;
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'P': return 'att-present';
      case 'A': return 'att-absent';
      case 'L': return 'att-late';
      case 'E': return 'att-excused';
      default: return '';
    }
  };

  return (
    <div className="space-y-5 pb-24 md:pb-12">
      {/* Top Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Attendance Register</h2>
          <p className="text-xs text-slate-500 mt-0.5">Daily marking & monthly attendance sheet</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              onClick={() => setTab('daily')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                tab === 'daily' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily Register
            </button>
            <button
              onClick={() => setTab('monthly')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                tab === 'monthly' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Sheet
            </button>
            <button
              onClick={() => setTab('overall')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                tab === 'overall' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overall
            </button>
          </div>
        </div>
      </div>

      {tab === 'overall' ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <label className="text-xs font-bold text-slate-700">From</label>
              <input
                id="overall-from"
                type="date"
                value={overallFrom}
                onChange={(e) => setOverallFrom(e.target.value)}
                className="border border-slate-300 rounded-lg px-2.5 py-1 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <label className="text-xs font-bold text-slate-700">To</label>
              <input
                id="overall-to"
                type="date"
                value={overallTo}
                onChange={(e) => setOverallTo(e.target.value)}
                className="border border-slate-300 rounded-lg px-2.5 py-1 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {(overallFrom || overallTo) ? (
                <button
                  onClick={() => { setOverallFrom(''); setOverallTo(''); }}
                  className="px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Whole batch
                </button>
              ) : (
                <span className="text-[11px] text-slate-500">Showing entire batch to date</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  id="overall-search"
                  type="text"
                  placeholder="Search student..."
                  value={overallSearch}
                  onChange={(e) => setOverallSearch(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg pl-8 pr-2.5 py-1.5 w-40 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <select
                id="overall-sort"
                value={overallSort}
                onChange={(e) => setOverallSort(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="order">Register order</option>
                <option value="pct-asc">Lowest % first</option>
                <option value="pct-desc">Highest % first</option>
                <option value="name">Name A–Z</option>
              </select>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 btn-press"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 no-print">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500"><TrendingUp className="w-3.5 h-3.5" /> Overall Attendance</div>
              <div className={`text-2xl font-bold mt-1 ${pctTone(overallStats.overallPct, overallStats.marked > 0).text}`}>{overallStats.overallPct}%</div>
              <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                <div className={`h-full rounded-full ${pctTone(overallStats.overallPct, overallStats.marked > 0).bar}`} style={{ width: `${overallStats.overallPct}%` }} />
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500"><Calendar className="w-3.5 h-3.5" /> Days Marked</div>
              <div className="text-2xl font-bold mt-1 text-slate-900">{overallStats.classDays}</div>
              <div className="text-[11px] text-slate-500 mt-1">{overallStats.marked} total records</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500"><Users className="w-3.5 h-3.5" /> Students</div>
              <div className="text-2xl font-bold mt-1 text-slate-900">{overallData.length}</div>
              <div className="text-[11px] mt-1 flex gap-2 font-semibold">
                <span className="text-emerald-600">P {overallStats.present}</span>
                <span className="text-rose-600">A {overallStats.absent}</span>
                <span className="text-amber-600">L {overallStats.late}</span>
                <span className="text-blue-600">E {overallStats.excused}</span>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500"><AlertCircle className="w-3.5 h-3.5" /> Below {LOW_THRESHOLD}%</div>
              <div className={`text-2xl font-bold mt-1 ${overallStats.lowCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{overallStats.lowCount}</div>
              <div className="text-[11px] text-slate-500 mt-1">students need attention</div>
            </div>
          </div>

          {/* Summary table */}
          {overallLoading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto"></div>
              <p className="text-sm text-slate-500 mt-3">Loading overall attendance...</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden monthly-grid-container">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h3 className="font-bold text-slate-900 text-sm">Overall Attendance Summary</h3>
                <p className="text-[11px] text-slate-500">
                  {overallFrom && overallTo ? `${overallFrom} to ${overallTo}` : 'Entire batch to date'} · {overallStats.classDays} days marked · Batch average {overallStats.overallPct}%
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" id="attendance-overall-table">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 text-left font-bold w-10">#</th>
                      <th className="px-3 py-2 text-left font-bold">Student</th>
                      <th className="px-3 py-2 text-left font-bold">Reg No</th>
                      <th className="px-2 py-2 text-center font-bold text-emerald-700">P</th>
                      <th className="px-2 py-2 text-center font-bold text-rose-700">A</th>
                      <th className="px-2 py-2 text-center font-bold text-amber-700">L</th>
                      <th className="px-2 py-2 text-center font-bold text-blue-700">E</th>
                      <th className="px-2 py-2 text-center font-bold">Marked</th>
                      <th className="px-3 py-2 text-left font-bold min-w-[160px]">Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overallRows.map((s, idx) => {
                      const hasData = s.total_days > 0;
                      const tone = pctTone(s.attendance_percentage, hasData);
                      return (
                        <tr key={s.student_id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-3 py-2 text-slate-400 font-semibold">{idx + 1}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900">{s.full_name}</td>
                          <td className="px-3 py-2 text-slate-500">{s.reg_no || '-'}</td>
                          <td className="px-2 py-2 text-center font-bold text-emerald-700">{s.present_days}</td>
                          <td className="px-2 py-2 text-center font-bold text-rose-700">{s.absent_days}</td>
                          <td className="px-2 py-2 text-center font-bold text-amber-700">{s.late_days}</td>
                          <td className="px-2 py-2 text-center font-bold text-blue-700">{s.excused_days}</td>
                          <td className="px-2 py-2 text-center text-slate-600">{s.total_days}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${tone.bar}`} style={{ width: `${hasData ? s.attendance_percentage : 0}%` }} />
                              </div>
                              <span className={`px-1.5 py-0.5 rounded border text-[11px] font-bold min-w-[44px] text-center ${tone.chip}`}>
                                {hasData ? `${s.attendance_percentage}%` : '—'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {overallRows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-10 text-center text-slate-500">No students found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500 no-print">
                % = (Present + Late) ÷ days marked. Green ≥ 90%, amber ≥ {LOW_THRESHOLD}%, red below {LOW_THRESHOLD}%.
              </div>
            </div>
          )}
        </div>
      ) : tab === 'daily' ? (
        <>
          {/* Date Picker & Action Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <label className="text-xs font-bold text-slate-700">Date:</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2.5 py-1 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {dayLog && (
                <span className="text-xs px-2.5 py-1 rounded-md font-medium bg-slate-100 text-slate-700 border">
                  Day: {dayLog.status} ({dayLog.hours_delivered}h)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAllPresent}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 btn-press"
              >
                <CheckCheck className="w-4 h-4" /> All Present
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 btn-press"
              >
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          </div>

          {/* Quick Metrics Chips */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-center">
              <div className="text-lg font-bold text-emerald-700">{presentCount}</div>
              <div className="text-[11px] font-medium text-emerald-600">Present (P)</div>
            </div>
            <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-center">
              <div className="text-lg font-bold text-rose-700">{absentCount}</div>
              <div className="text-[11px] font-medium text-rose-600">Absent (A)</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-center">
              <div className="text-lg font-bold text-amber-700">{lateCount}</div>
              <div className="text-[11px] font-medium text-amber-600">Late (L)</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg text-center">
              <div className="text-lg font-bold text-blue-700">{excusedCount}</div>
              <div className="text-[11px] font-medium text-blue-600">Excused (E)</div>
            </div>
          </div>

          {/* Absentee Alert Banner (9:00 AM Parent Alerting) */}
          {absentCount > 0 && (
            <div className="bg-gradient-to-r from-rose-50 via-red-50/70 to-amber-50 border border-rose-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 font-bold shadow-xs">
                  <Bell className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">
                      {absentCount} Students Absent Today (9:00 AM Roll Call)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      දෙමාපිය දැනුම්දීම්
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Send 100% free automated WhatsApp &amp; SMS alerts to parents of students absent as of 9:00 AM.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAlertModalOpen(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 btn-press"
              >
                <MessageCircle className="w-4 h-4" /> Notify Parents (Free)
              </button>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold text-center animate-in fade-in">
              ✓ Attendance saved successfully!
            </div>
          )}

          {/* Students List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100">
            {students.map((student, idx) => (
              <div 
                key={student.student_id}
                className="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-xs font-semibold text-slate-400 text-right shrink-0">
                    {idx + 1}.
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900 text-sm">{student.full_name}</h4>
                      {student.status === 'A' && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800">
                          ABSENT
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>{student.reg_no ? `Reg: ${student.reg_no}` : 'No Reg No.'}</span>
                      {student.parent_phone ? (
                        <span className="text-slate-600 font-medium flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" /> Parent: {student.parent_phone}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStudentId(student.student_id);
                            setEditParentPhone('');
                            setEditParentName('');
                            setAlertModalOpen(true);
                          }}
                          className="text-amber-600 hover:text-amber-700 font-medium underline"
                        >
                          + Add Parent Phone
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-center">
                  {/* Quick WhatsApp Alert for Absent Students */}
                  {student.status === 'A' && (
                    <button
                      type="button"
                      onClick={() => setAlertModalOpen(true)}
                      title="Send Free Parent WhatsApp Alert"
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Alert Parent</span>
                    </button>
                  )}

                  <input
                    type="text"
                    placeholder="Note..."
                    value={student.note || ''}
                    onChange={(e) => handleNoteChange(student.student_id, e.target.value)}
                    className="text-xs border border-slate-200 rounded-md px-2 py-1 w-24 sm:w-32 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />

                  {/* P / A / L / E Buttons */}
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 shrink-0">
                    {[
                      { code: 'P', label: 'P', color: 'bg-emerald-600 text-white shadow-xs', inactive: 'hover:text-emerald-700' },
                      { code: 'A', label: 'A', color: 'bg-rose-600 text-white shadow-xs', inactive: 'hover:text-rose-700' },
                      { code: 'L', label: 'L', color: 'bg-amber-600 text-white shadow-xs', inactive: 'hover:text-amber-700' },
                      { code: 'E', label: 'E', color: 'bg-blue-600 text-white shadow-xs', inactive: 'hover:text-blue-700' }
                    ].map(btn => (
                      <button
                        key={btn.code}
                        type="button"
                        onClick={() => handleStatusChange(student.student_id, btn.code)}
                        className={`w-9 h-8 rounded-md text-xs font-bold transition-all btn-press ${
                          student.status === btn.code ? btn.color : `text-slate-600 ${btn.inactive}`
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* ═══════════════════════════════════════════════════════════════
           MONTHLY ATTENDANCE SHEET (Grid like the PDF format)
           ═══════════════════════════════════════════════════════════════ */
        <div ref={printRef}>
          {/* Month Navigation (hidden in print) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 mb-4 no-print">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <div className="text-center min-w-[160px]">
                <h3 className="font-bold text-slate-900 text-base">
                  {MONTH_NAMES[parseInt(selectedMonth.split('-')[1]) - 1]} {selectedMonth.split('-')[0]}
                </h3>
                <p className="text-[11px] text-slate-500">Monthly Attendance Register</p>
              </div>
              <button
                onClick={() => navigateMonth(1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Legend */}
              <div className="flex items-center gap-3 text-[10px] font-semibold mr-3">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block"></span>
                  Sat/Sun/Holiday
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block"></span>
                  Off Day
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  P
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                  A
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                  L
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                  E
                </span>
              </div>

              <button
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 btn-press"
              >
                <Download className="w-3.5 h-3.5" /> {downloading ? 'Generating...' : 'Download PDF'}
              </button>

              <button
                onClick={handlePrintMonthly}
                className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 btn-press"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
          </div>

          {/* Print Header (only visible in print) */}
          <div className="print-only-header" style={{ display: 'none' }}>
            <h2 style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
              Monthly Attendance Register
            </h2>
            <p style={{ textAlign: 'center', fontSize: '13px', marginBottom: '2px' }}>
              {MONTH_NAMES[parseInt(selectedMonth.split('-')[1]) - 1]} {selectedMonth.split('-')[0]}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '10px', marginBottom: '8px', fontWeight: '600' }}>
              <span>P = Present</span>
              <span>A = Absent</span>
              <span>L = Late</span>
              <span>E = Excused</span>
              <span style={{ color: '#dc2626' }}>■ = Weekend/Holiday</span>
              <span style={{ color: '#d97706' }}>■ = Off Day</span>
            </div>
          </div>

          {monthlyLoading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto"></div>
              <p className="text-sm text-slate-500 mt-3">Loading attendance data...</p>
            </div>
          ) : monthlyData ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden monthly-grid-container">
              <div className="overflow-x-auto">
                <table className="attendance-grid-table" id="attendance-monthly-grid">
                  <thead>
                    {/* Day numbers row */}
                    <tr className="att-header-row">
                      <th className="att-th-fixed att-th-num">#</th>
                      <th className="att-th-fixed att-th-name">Student Name</th>
                      <th className="att-th-fixed att-th-reg">Reg No</th>
                      {Array.from({ length: monthlyData.days_in_month }, (_, i) => {
                        const dayNum = i + 1;
                        const dayType = getDayType(dayNum);
                        const [y, m] = selectedMonth.split('-').map(Number);
                        const dateObj = new Date(y, m - 1, dayNum);
                        const dowShort = DAY_NAMES_SHORT[dateObj.getDay()];
                        return (
                          <th
                            key={dayNum}
                            className={`att-th-day ${
                              dayType === 'weekend' ? 'att-weekend' : 
                              dayType === 'holiday' ? 'att-holiday' : 
                              dayType === 'holiday-teaching' ? 'att-holiday-teaching' : ''
                            }`}
                            title={getDayTooltip(dayNum)}
                          >
                            <div className="att-day-num">{dayNum}</div>
                            <div className="att-day-name">{dowShort}</div>
                          </th>
                        );
                      })}
                      <th className="att-th-summary">P</th>
                      <th className="att-th-summary">A</th>
                      <th className="att-th-summary">L</th>
                      <th className="att-th-summary">E</th>
                      <th className="att-th-summary att-th-pct">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.grid.map((student, idx) => (
                      <tr key={student.student_id} className="att-data-row">
                        <td className="att-td-num">{idx + 1}</td>
                        <td className="att-td-name" title={student.full_name}>{student.full_name}</td>
                        <td className="att-td-reg">{student.reg_no || '-'}</td>
                        {Array.from({ length: monthlyData.days_in_month }, (_, i) => {
                          const dayNum = i + 1;
                          const status = student.days[dayNum];
                          const dayType = getDayType(dayNum);
                          return (
                            <td
                              key={dayNum}
                              className={`att-td-day ${
                                dayType === 'weekend' ? 'att-weekend' : 
                                dayType === 'holiday' ? 'att-holiday' : 
                                dayType === 'holiday-teaching' ? 'att-holiday-teaching' : ''
                              } ${status ? getStatusColor(status) : ''}`}
                              title={`Day ${dayNum}: ${status || (dayType !== 'normal' ? getDayTooltip(dayNum) : 'No record')}`}
                            >
                              {getStatusSymbol(status)}
                            </td>
                          );
                        })}
                        <td className="att-td-summary att-summary-p">{student.present}</td>
                        <td className="att-td-summary att-summary-a">{student.absent}</td>
                        <td className="att-td-summary att-summary-l">{student.late}</td>
                        <td className="att-td-summary att-summary-e">{student.excused}</td>
                        <td className="att-td-summary att-summary-pct">
                          {student.total_marked > 0 
                            ? Math.round(((student.present + student.late) / student.total_marked) * 100) 
                            : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer legend for screen */}
              <div className="p-3 border-t border-slate-200 bg-slate-50 no-print">
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-medium text-slate-600">
                  <span>Total Students: <strong>{monthlyData.grid.length}</strong></span>
                  {Object.entries(monthlyData.holidays).length > 0 && (
                    <span>
                      Holidays this month: {Object.entries(monthlyData.holidays).map(([day, h]) => (
                        <span key={day} className="ml-1 px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-[9px] font-bold">
                          {day} - {h.name}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Select a batch to view monthly attendance</p>
            </div>
          )}
        </div>
      )}

      {/* Print styles embedded */}
      <style>{`
        /* ═══════════════════════════════════════════════
           ATTENDANCE GRID TABLE STYLES
           ═══════════════════════════════════════════════ */
        .attendance-grid-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          table-layout: fixed;
        }

        /* Header row */
        .att-header-row {
          background: #f1f5f9;
        }
        .att-header-row th {
          border: 1px solid #cbd5e1;
          padding: 2px 1px;
          text-align: center;
          font-weight: 700;
          font-size: 10px;
          color: #334155;
          vertical-align: middle;
        }

        .att-th-fixed {
          position: sticky;
          left: 0;
          z-index: 2;
          background: #f1f5f9;
        }
        .att-th-num {
          width: 28px;
          min-width: 28px;
          left: 0;
        }
        .att-th-name {
          width: 140px;
          min-width: 140px;
          left: 28px;
          text-align: left !important;
          padding-left: 6px !important;
        }
        .att-th-reg {
          width: 72px;
          min-width: 72px;
          left: 168px;
          font-size: 9px;
        }

        .att-th-day {
          width: 26px;
          min-width: 26px;
          max-width: 26px;
        }
        .att-day-num {
          font-size: 11px;
          font-weight: 800;
          line-height: 1.1;
        }
        .att-day-name {
          font-size: 8px;
          font-weight: 600;
          color: #64748b;
          line-height: 1;
        }

        .att-th-summary {
          width: 28px;
          min-width: 28px;
          font-size: 9px;
          background: #e2e8f0;
        }
        .att-th-pct {
          width: 34px;
          min-width: 34px;
        }

        /* Weekend & Holiday header styling */
        .att-weekend {
          background-color: #fee2e2 !important;
        }
        .att-holiday {
          background-color: #fee2e2 !important;
        }
        .att-holiday-teaching {
          background-color: #fef3c7 !important;
        }

        /* Data rows */
        .att-data-row {
          transition: background-color 0.15s;
        }
        .att-data-row:hover {
          background-color: #f8fafc;
        }
        .att-data-row:nth-child(even) {
          background-color: #fafbfc;
        }
        .att-data-row:nth-child(even):hover {
          background-color: #f1f5f9;
        }

        .att-data-row td {
          border: 1px solid #e2e8f0;
          padding: 3px 2px;
          text-align: center;
          font-size: 11px;
          vertical-align: middle;
        }

        .att-td-num {
          font-weight: 600;
          color: #94a3b8;
          font-size: 10px;
          position: sticky;
          left: 0;
          background: inherit;
          z-index: 1;
        }
        .att-data-row:nth-child(odd) .att-td-num { background: #ffffff; }
        .att-data-row:nth-child(even) .att-td-num { background: #fafbfc; }

        .att-td-name {
          text-align: left;
          padding-left: 6px !important;
          font-weight: 600;
          color: #1e293b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          position: sticky;
          left: 28px;
          background: inherit;
          z-index: 1;
        }
        .att-data-row:nth-child(odd) .att-td-name { background: #ffffff; }
        .att-data-row:nth-child(even) .att-td-name { background: #fafbfc; }

        .att-td-reg {
          font-size: 9px;
          color: #64748b;
          position: sticky;
          left: 168px;
          background: inherit;
          z-index: 1;
        }
        .att-data-row:nth-child(odd) .att-td-reg { background: #ffffff; }
        .att-data-row:nth-child(even) .att-td-reg { background: #fafbfc; }

        .att-td-day {
          font-weight: 700;
          font-size: 10px;
          min-width: 26px;
          max-width: 26px;
        }

        /* Status cell colors */
        .att-present { color: #059669; }
        .att-absent { color: #dc2626; }
        .att-late { color: #d97706; }
        .att-excused { color: #2563eb; }

        /* Summary columns */
        .att-td-summary {
          font-weight: 700;
          font-size: 10px;
          background: #f8fafc !important;
        }
        .att-summary-p { color: #059669; }
        .att-summary-a { color: #dc2626; }
        .att-summary-l { color: #d97706; }
        .att-summary-e { color: #2563eb; }
        .att-summary-pct { 
          color: #334155; 
          font-weight: 800;
          font-size: 10px;
        }

        /* ═══════════════════════════════════════════════
           PRINT STYLES
           ═══════════════════════════════════════════════ */
        @media print {
          body * {
            visibility: hidden;
          }
          .monthly-grid-container,
          .monthly-grid-container *,
          .print-only-header,
          .print-only-header * {
            visibility: visible !important;
          }
          .monthly-grid-container {
            position: absolute;
            top: 60px;
            left: 0;
            right: 0;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .print-only-header {
            display: block !important;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
          }
          .no-print {
            display: none !important;
          }

          .attendance-grid-table {
            font-size: 9px;
          }
          .att-th-day, .att-td-day {
            width: 20px !important;
            min-width: 20px !important;
            max-width: 20px !important;
          }
          .att-th-name, .att-td-name {
            width: 110px !important;
            min-width: 110px !important;
          }
          .att-th-fixed, .att-td-num, .att-td-name, .att-td-reg {
            position: static;
          }

          .att-weekend,
          .att-holiday {
            background-color: #fee2e2 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .att-holiday-teaching {
            background-color: #fef3c7 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .att-present { color: #059669 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .att-absent { color: #dc2626 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .att-late { color: #d97706 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .att-excused { color: #2563eb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          .att-data-row:nth-child(even) {
            background: #fafbfc !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .att-header-row, .att-header-row th {
            background: #f1f5f9 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .att-th-summary, .att-td-summary {
            background: #f1f5f9 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          @page {
            size: A4 landscape;
            margin: 0;
          }

          .monthly-grid-container {
            margin: 6mm;
          }
          .print-only-header {
            margin: 6mm 6mm 0 6mm;
          }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════
          PARENT ABSENCE NOTIFICATION MODAL (100% Free WhatsApp & SMS)
          ═══════════════════════════════════════════════════════════════ */}
      {alertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 sm:px-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Parent Absence Notification Center</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      100% Free
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Pre-9:00 AM Absentee Alerts via Direct WhatsApp &amp; Mobile SMS · Date: {date}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAlertModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-bar / Quick Controls */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
              {/* Language Selection */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600">Language:</span>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setAlertLang('si')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                      alertLang === 'si' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    සිංහල (Sinhala)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlertLang('en')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                      alertLang === 'en' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlertLang('combined')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                      alertLang === 'combined' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Bilingual (දෙබස්)
                  </button>
                </div>
              </div>

              {/* Bulk Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowIphoneGuide(prev => !prev)}
                  className={`px-2.5 py-1.5 font-bold rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
                    showIphoneGuide ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                  }`}
                  title="Configure 100% Free Automated SMS from iPhone"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  {showIphoneGuide ? 'Hide iPhone Setup' : '📱 iPhone Auto-SMS (Zero Clicks)'}
                </button>

                <button
                  type="button"
                  onClick={handleSendAllWhatsApp}
                  disabled={!alertData?.absentees?.some(a => a.parent_phone_formatted)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors btn-press"
                  title="Open WhatsApp chat for all absent parents one by one"
                >
                  <Send className="w-3.5 h-3.5" /> Send All via WhatsApp
                </button>

                <button
                  type="button"
                  onClick={handleCopyNumbers}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold rounded-lg shadow-2xs flex items-center gap-1 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  {copiedToast === 'numbers' ? '✓ Copied Numbers!' : 'Copy Numbers'}
                </button>

                <button
                  type="button"
                  onClick={handleCopyNotice}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold rounded-lg shadow-2xs flex items-center gap-1 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  {copiedToast === 'notice' ? '✓ Copied Notice!' : 'Copy Notice'}
                </button>
              </div>
            </div>

            {/* Modal Navigation Tabs: Parent SMS vs OIC Daily Summary */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-6 pt-2.5 gap-2">
              <button
                type="button"
                onClick={() => setSmsTab('parents')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  smsTab === 'parents'
                    ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>1. දෙමාපිය දැනුම්දීම් (Parent Absent SMS)</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-bold">
                  {alertData?.absentees?.length || 0} Absent
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSmsTab('oic')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  smsTab === 'oic'
                    ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>2. මධ්‍යස්ථාන භාර නිලධාරී (OIC Daily Report)</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded-full font-bold">
                  ම.භා.නි
                </span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {smsTab === 'parents' && (
                <>
                  {/* iPhone Zero-Click Automated SMS Setup Guide */}
                  {showIphoneGuide && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white shadow-lg space-y-3 border border-indigo-500/40 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 flex items-center justify-center font-bold">
                        📱
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white">iPhone 9:00 AM Automated SMS (Zero Clicks)</h4>
                        <p className="text-[11px] text-indigo-200">
                          Sends real carrier SMS from your iPhone automatically at 9:00 AM without touching the phone
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      100% FREE
                    </span>
                  </div>

                  {/* Endpoint URL Copy Box */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                      <span>Your iPhone Shortcut Feed URL:</span>
                      <a
                        href={iphoneInfo?.endpointUrl || `http://${window.location.hostname}:5000/api/auto-sms/today`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[10px]"
                      >
                        <ExternalLink className="w-2.5 h-2.5" /> Test Feed
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={iphoneInfo?.endpointUrl || `http://${window.location.hostname}:5000/api/auto-sms/today`}
                        className="w-full text-xs bg-slate-900 text-emerald-400 font-mono px-2.5 py-1.5 rounded-lg border border-slate-700 select-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const url = iphoneInfo?.endpointUrl || `http://${window.location.hostname}:5000/api/auto-sms/today`;
                          navigator.clipboard.writeText(url);
                          setCopiedUrlToast(true);
                          setTimeout(() => setCopiedUrlToast(false), 3000);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shrink-0 transition-colors"
                      >
                        {copiedUrlToast ? '✓ Copied!' : 'Copy URL'}
                      </button>
                    </div>
                  </div>

                  {/* 4 Simple Setup Steps */}
                  <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                    <div className="font-bold text-white text-[11px] uppercase tracking-wider mb-1">
                      Quick 1-Minute Setup on your iPhone (Shortcuts App):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] leading-relaxed">
                      <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                        <strong className="text-indigo-300">1. Create Automation:</strong><br />
                        Open iPhone <strong>Shortcuts (කෙටිමං)</strong> app ➔ tap <strong>Automation</strong> tab ➔ <strong>New Automation (+)</strong>.
                      </div>
                      <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                        <strong className="text-indigo-300">2. Set 9:00 AM Trigger:</strong><br />
                        Choose <strong>Time of Day ➔ 9:00 AM</strong> ➔ Mon to Fri. Select <strong>"Run Immediately"</strong> &amp; turn off "Notify When Run".
                      </div>
                      <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                        <strong className="text-indigo-300">3. Fetch Absent List:</strong><br />
                        Add action <strong>"Get Contents of URL"</strong> ➔ paste the URL above.
                      </div>
                      <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                        <strong className="text-indigo-300">4. Send Message:</strong><br />
                        Action <strong>Repeat with Each</strong> in <code>items</code> ➔ <strong>Send Message</strong> to <code>phone</code> (Set <strong>"Show When Run" to OFF</strong>).
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {alertLoading ? (
                <div className="py-16 text-center text-slate-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto"></div>
                  <p className="mt-3 text-sm font-semibold">Scanning attendance and absent records...</p>
                </div>
              ) : !alertData || alertData.absentees.length === 0 ? (
                <div className="py-16 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                  <CheckCheck className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <h4 className="text-base font-bold text-slate-800">No Absent Students Recorded Today</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    All students are marked Present (P), Late (L), or Excused (E). If someone is missing, mark them 'A' in the register above.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
                    <span>{alertData.absentees.length} Absent Students Found</span>
                    <span>Class Start Time: 09:00 AM</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {alertData.absentees.map((st, i) => {
                      const isNotified = !!notifiedMap[st.id] || st.notified;
                      const notifiedTime = notifiedMap[st.id] || (st.last_notified_at ? st.last_notified_at.slice(11, 16) : null);
                      const isEditing = editingStudentId === st.id;

                      return (
                        <div
                          key={st.id}
                          className={`p-4 rounded-xl border transition-all ${
                            isNotified 
                              ? 'bg-emerald-50/40 border-emerald-300' 
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            {/* Student & Parent Info */}
                            <div className="space-y-1 min-w-[240px]">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center">
                                  {i + 1}
                                </span>
                                <h4 className="text-sm font-bold text-slate-900">{st.full_name}</h4>
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-slate-100 text-slate-600">
                                  {st.reg_no || 'NVQ 4'}
                                </span>
                              </div>

                              {/* Parent Contact Info */}
                              <div className="pl-7">
                                {isEditing ? (
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <input
                                      type="text"
                                      placeholder="Parent Name"
                                      value={editParentName}
                                      onChange={(e) => setEditParentName(e.target.value)}
                                      className="text-xs border border-slate-300 rounded px-2 py-1 w-32 font-semibold"
                                    />
                                    <input
                                      type="text"
                                      placeholder="07X XXX XXXX"
                                      value={editParentPhone}
                                      onChange={(e) => setEditParentPhone(e.target.value)}
                                      className="text-xs border border-slate-300 rounded px-2 py-1 w-32 font-semibold"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveParentPhone(st.id)}
                                      className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingStudentId(null)}
                                      className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs font-semibold"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="text-slate-600">
                                      Parent: <strong className="text-slate-800">{st.parent_name || 'Guardian'}</strong>
                                    </span>
                                    {st.parent_phone ? (
                                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200 flex items-center gap-1 text-[11px]">
                                        <Phone className="w-3 h-3 text-blue-500" /> {st.parent_phone}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[11px]">
                                        ⚠️ Phone Missing
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingStudentId(st.id);
                                        setEditParentName(st.parent_name || '');
                                        setEditParentPhone(st.parent_phone || st.phone || '');
                                      }}
                                      className="text-[11px] text-brand-600 hover:text-brand-700 font-bold flex items-center gap-0.5 ml-1"
                                    >
                                      <Edit2 className="w-3 h-3" /> Edit
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Actions & Status */}
                            <div className="flex flex-wrap items-center gap-2 pl-7 md:pl-0">
                              {isNotified && (
                                <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200 flex items-center gap-1">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  Notified {notifiedTime ? `@ ${notifiedTime}` : ''}
                                </span>
                              )}

                              {/* Send WhatsApp (Free) */}
                              <button
                                type="button"
                                onClick={() => handleSendWhatsApp(st, alertLang)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors btn-press ${
                                  st.has_phone 
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                    : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                }`}
                                title="Open WhatsApp chat with pre-written message (Free)"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                {isNotified ? 'Re-send WhatsApp' : 'Send WhatsApp (Free)'}
                              </button>

                              {/* Send SMS (Free Carrier Intent) */}
                              <button
                                type="button"
                                onClick={() => handleSendSMS(st, alertLang)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                                title="Open native SMS app on device"
                              >
                                <Smartphone className="w-3.5 h-3.5 text-slate-500" /> SMS
                              </button>
                            </div>
                          </div>

                          {/* Message Preview Accordion */}
                          <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-[11px] text-slate-600 bg-slate-50/70 p-2 rounded-lg font-mono whitespace-pre-line leading-relaxed">
                            {st.messages[alertLang]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

                </>
              )}

              {smsTab === 'oic' && (
                <div className="space-y-4 animate-in fade-in">
                  {/* OIC Recipient & Stats Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white shadow-lg space-y-4 border border-indigo-500/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/25 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                          <Shield className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white flex items-center gap-2">
                            <span>{oicSummaryData?.oic_title || 'මධ්‍යස්ථාන භාර නිලධාරී'} ({oicSummaryData?.oic_name || 'නම ඇතුළත් කර නැත'})</span>
                          </div>
                          <div className="text-xs text-indigo-200 flex items-center gap-1.5 mt-0.5">
                            <Phone className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{oicSummaryData?.phone || 'දුරකථන අංකය ඇතුළත් කර නැත (Settings වලින් සකසන්න)'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {oicSummaryData?.phone && (
                          <a
                            href={`sms:${oicSummaryData.phone}?body=${encodeURIComponent(oicSummaryData?.message || '')}`}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                          >
                            <Smartphone className="w-3.5 h-3.5" /> Send SMS Now
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(oicSummaryData?.message || '');
                            setCopiedOicMsgToast(true);
                            setTimeout(() => setCopiedOicMsgToast(false), 3000);
                          }}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg border border-white/10 flex items-center gap-1.5 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" /> {copiedOicMsgToast ? '✓ Copied!' : 'Copy Message'}
                        </button>
                      </div>
                    </div>

                    {/* 4 Attendance Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                        <div className="text-[11px] text-slate-300 font-medium">මුළු ලියාපදිංචි</div>
                        <div className="text-xl font-black text-white mt-0.5">{oicSummaryData?.total_students || 0}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                        <div className="text-[11px] text-emerald-300 font-medium">පැමිණි සිසුන්</div>
                        <div className="text-xl font-black text-emerald-400 mt-0.5">{oicSummaryData?.present_count || 0}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                        <div className="text-[11px] text-rose-300 font-medium">නොපැමිණි සිසුන්</div>
                        <div className="text-xl font-black text-rose-400 mt-0.5">{oicSummaryData?.absent_count || 0}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-center">
                        <div className="text-[11px] text-indigo-300 font-medium">පැමිණීමේ අනුපාතය</div>
                        <div className="text-xl font-black text-indigo-300 mt-0.5">{oicSummaryData?.attendance_percentage || 0}%</div>
                      </div>
                    </div>

                    {/* Sinhala Message Preview */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                        ම.භා.නි වෙත යැවෙන සිංහල කෙටි පණිවුඩය (SMS Message Preview):
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 font-mono text-xs text-slate-200 whitespace-pre-line leading-relaxed select-all">
                        {oicSummaryData?.message}
                      </div>
                    </div>
                  </div>

                  {/* iPhone 9:00 AM Shortcut Box for OIC */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                          📱
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-800">
                            iPhone 9:00 AM Automatic SMS to OIC (ම.භා.නි)
                          </h4>
                          <p className="text-xs text-slate-500">
                            දිනපතා පෙරවරු 9.00 ට ඔබගේ iPhone එකෙන්ම මෙම පණිවුඩය මධ්‍යස්ථාන භාර නිලධාරී තුමා වෙත ස්වයංක්‍රීයව යැවීමට මෙම ලින්ක් එක භාවිතා කරන්න:
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                        OIC FEED
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value="https://nysc-server.onrender.com/api/auto-sms/oic-summary"
                        className="w-full text-xs bg-slate-50 text-indigo-700 font-mono px-3 py-2 rounded-lg border border-slate-300 select-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText('https://nysc-server.onrender.com/api/auto-sms/oic-summary');
                          setCopiedOicUrlToast(true);
                          setTimeout(() => setCopiedOicUrlToast(false), 3000);
                        }}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5"
                      >
                        {copiedOicUrlToast ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy URL</>}
                      </button>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1 border border-slate-200">
                      <div className="font-bold text-slate-800">iPhone Shortcut සකස් කරගන්නා ආකාරය (පියවර 3):</div>
                      <p>1. iPhone <strong>Shortcuts</strong> ඇප් එකේ <strong>Automation</strong> ➔ <strong>New Automation (+)</strong> ➔ <strong>9:00 AM (Mon-Fri)</strong> තෝරන්න.</p>
                      <p>2. Action 1: <strong>Get Contents of URL</strong> ➔ ඉහත ලින්ක් එක Paste කරන්න.</p>
                      <p>3. Action 2: <strong>Get Dictionary Value</strong> (Key: <code>message</code> in <code>Contents of URL</code>), Action 3: <strong>Send Message</strong> (Recipients: <code>{oicSummaryData?.phone || 'OIC Phone Number'}</code>). "Show When Run" <strong>OFF</strong> කරන්න.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Free Method Explanation Card */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-blue-950">
                  <span>💡</span> 100% Free Messaging Solution for NYSC Instructors:
                </div>
                <p className="leading-relaxed text-blue-800 text-[11px]">
                  • <strong>WhatsApp Direct (wa.me)</strong> opens WhatsApp Web or App directly to the parent's phone with the complete official Sinhala/English alert ready to send. No Twilio or paid API subscription required.<br />
                  • <strong>Device SMS Intent</strong> opens your phone's native SMS messaging app with pre-filled text so you can use your carrier's local free SMS package.<br />
                  • All dispatch actions are logged automatically in the system audit trail.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 px-6 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
              <span className="text-slate-500">
                Instructor: <strong>{alertData?.teacher_contact?.name || 'ICT Instructor'}</strong> ({alertData?.teacher_contact?.phone || 'NYSC'})
              </span>
              <button
                type="button"
                onClick={() => setAlertModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
