import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Calendar, CheckSquare, BookOpen, CheckCircle, 
  Menu, X, Users, BookMarked, CalendarDays, 
  FileText, Settings, LogOut, Send, Award
} from 'lucide-react';
import { api, getUser } from '../api';

export default function Navigation() {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();

  const handleLogout = () => {
    api.logout();
  };

  const navItems = [
    { to: '/', label: 'Today', icon: Calendar, end: true },
    { to: '/attendance', label: 'Attendance', icon: CheckSquare },
    { to: '/plan', label: 'Lesson Plan', icon: BookOpen },
    { to: '/checklists', label: 'Checklists', icon: CheckCircle },
  ];

  const moreItems = [
    { to: '/diary', label: 'Work Diary', icon: BookMarked },
    { to: '/assignments', label: 'Assignments', icon: Send },
    { to: '/monthly-report', label: 'Monthly Report (NYSC)', icon: FileText },
    { to: '/batches', label: 'Batches', icon: Award },
    { to: '/students', label: 'Students', icon: Users },
    { to: '/holidays', label: 'Holidays', icon: CalendarDays },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const isMoreActive = moreItems.some(item => location.pathname.startsWith(item.to));

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-300 min-h-screen border-r border-slate-800 shrink-0">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-lg shadow-brand-500/20">
            NY
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">NYSC Akuressa</h1>
            <p className="text-xs text-slate-400">ICT NVQ-4 Teacher System</p>
          </div>
        </div>

        <div className="p-3">
          <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase px-3 py-2">
            Daily Operations
          </div>
          <nav className="space-y-1">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30' 
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase px-3 pt-5 pb-2">
            Records & Curriculum
          </div>
          <nav className="space-y-1">
            {moreItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30' 
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-slate-800 flex items-center justify-between text-xs">
          <div>
            <div className="font-medium text-white truncate max-w-[140px]">{user?.name || 'Instructor'}</div>
            <div className="text-slate-500 truncate max-w-[140px]">{user?.email || 'Akuressa TTC'}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 flex items-center justify-around shadow-lg">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
              isActive ? 'text-brand-600 font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <item.icon className="w-5 h-5 mb-0.5" />
            <span>{item.label}</span>
          </NavLink>
        ))}

        <button
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
            isMoreActive ? 'text-brand-600 font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile "More" Drawer / Modal */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-white rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Menu & Records</h3>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-6">
              {moreItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 p-3 rounded-xl border text-sm font-medium transition-all ${
                    isActive
                      ? 'border-brand-500 bg-brand-50 text-brand-700 font-semibold'
                      : 'border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <item.icon className="w-4 h-4 text-brand-600 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Logged in as <strong>{user?.name || 'Teacher'}</strong>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
