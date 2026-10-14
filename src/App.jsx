import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Navigation from './components/Navigation';
import Header from './components/Header';

import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import LessonPlan from './pages/LessonPlan';
import Checklists from './pages/Checklists';
import WorkDiary from './pages/WorkDiary';
import Assignments from './pages/Assignments';
import PublicAssignment from './pages/PublicAssignment';
import MonthlyReport from './pages/MonthlyReport';
import Batches from './pages/Batches';
import Students from './pages/Students';
import Holidays from './pages/Holidays';
import Settings from './pages/Settings';
import Login from './pages/Login';

import { getToken, api } from './api';

function ProtectedLayout({ batches, activeBatchId, onSelectBatch }) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Navigation />
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          batches={batches} 
          activeBatchId={activeBatchId} 
          onSelectBatch={onSelectBatch} 
        />
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [batches, setBatches] = useState([]);
  const [activeBatchId, setActiveBatchId] = useState(() => {
    return localStorage.getItem('nysc_active_batch') || null;
  });

  const loadBatches = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await api.get('/batches');
      setBatches(res || []);
      if (res && res.length > 0) {
        if (!activeBatchId || !res.some(b => b.id === Number(activeBatchId))) {
          setActiveBatchId(res[0].id);
          localStorage.setItem('nysc_active_batch', res[0].id);
        }
      }
    } catch (e) {
      console.warn('Batch fetch error:', e.message);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleSelectBatch = (id) => {
    setActiveBatchId(id);
    localStorage.setItem('nysc_active_batch', id);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/a/:token" element={<PublicAssignment />} />

        {/* Protected Teacher Routes */}
        <Route element={
          <ProtectedLayout 
            batches={batches} 
            activeBatchId={activeBatchId} 
            onSelectBatch={handleSelectBatch} 
          />
        }>
          <Route path="/" element={<Dashboard batchId={activeBatchId} />} />
          <Route path="/attendance" element={<Attendance batchId={activeBatchId} />} />
          <Route path="/plan" element={<LessonPlan batchId={activeBatchId} />} />
          <Route path="/checklists" element={<Checklists batchId={activeBatchId} />} />
          <Route path="/diary" element={<WorkDiary batchId={activeBatchId} />} />
          <Route path="/assignments" element={<Assignments batchId={activeBatchId} />} />
          <Route path="/monthly-report" element={<MonthlyReport batchId={activeBatchId} />} />
          <Route path="/batches" element={<Batches onBatchCreated={(id) => { loadBatches(); handleSelectBatch(id); }} />} />
          <Route path="/students" element={<Students batchId={activeBatchId} />} />
          <Route path="/holidays" element={<Holidays />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
