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
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 selection:bg-brand-500 selection:text-white">
      <div className="max-w-md w-full space-y-6">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 mx-auto flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-brand-500/20">
            NY
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">National Youth Services Council</h1>
          <p className="text-xs text-slate-400">Technical Training Centre – Akuressa · NVQ Level 4 ICT</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-700/80 p-6 sm:p-8 shadow-2xl space-y-5">
          <div>
            <h2 className="text-lg font-bold text-white">Teacher Login</h2>
            <p className="text-xs text-slate-400 mt-1">Access records, lesson plans, attendance & monthly reports</p>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@nysc.lk"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-brand-600/30 transition-all flex items-center justify-center gap-2 btn-press"
            >
              {loading ? 'Signing in...' : 'Sign In'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-slate-700/60 text-center">
            <button
              type="button"
              onClick={() => {
                setEmail('teacher@nysc.lk');
                setPassword('password123');
              }}
              className="text-xs text-brand-400 hover:text-brand-300 font-semibold underline"
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
