import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#181b20] flex flex-col items-center justify-center p-4 selection:bg-brand-500 selection:text-white">
      <div className="max-w-md w-full space-y-6">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center text-slate-100 text-xl font-serif font-bold tracking-wider shadow-sm">
            NY
          </div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">National Youth Services Council</h1>
          <p className="text-xs text-slate-400">Technical Training Centre – Akuressa · NVQ Level 4 ICT</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xl space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Instructor Portal Sign In</h2>
            <p className="text-xs text-slate-500 mt-0.5">Access academic records, lesson plans, attendance &amp; monthly reports</p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@nysc.lk"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-semibold text-sm rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 btn-press"
            >
              {loading ? 'Signing in...' : 'Sign In'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => {
                setEmail('teacher@nysc.lk');
                setPassword('password123');
              }}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium underline"
            >
              Fill Default Teacher Credentials
            </button>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-500">
          TVEC National Competency Standard K72S004 · Akuressa TTC
        </div>
      </div>
    </div>
  );
}
