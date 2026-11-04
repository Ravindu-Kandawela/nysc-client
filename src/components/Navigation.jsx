import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Calendar, CheckSquare, BookOpen, CheckCircle, 
  Menu, X, Users, BookMarked, CalendarDays, 
  FileText, Settings, LogOut, Send, Award, Clock
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
    { to: '/my-attendance', label: 'My Attendance (In/Out)', icon: Clock },
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
      <aside className="hidden md:flex flex-col w-60 bg-[#181b20] text-slate-300 h-screen sticky top-0 border-r border-slate-800/80 shrink-0 select-none">
        <div className="px-4 py-4 border-b border-slate-800/80 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-100 font-serif font-bold text-sm tracking-wider">
            NY
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-slate-100 text-sm leading-tight truncate">NYSC Akuressa</h1>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">NVQ Level 4 · ICT Records</p>
          </div>
        </div>

        <div className="px-2.5 py-3 flex-1 overflow-y-auto overscroll-contain space-y-5">
          <div>
            <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase px-2.5 pb-1.5">
              Daily Operations
            </div>
            <nav className="space-y-0.5">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors ${
                    isActive 
                      ? 'bg-slate-800/90 text-white font-semibold border-l-2 border-slate-200 pl-2' 
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 font-medium'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0 opacity-85" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div>
            <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase px-2.5 pb-1.5">
              Records &amp; Administration
            </div>
            <nav className="space-y-0.5">
              {moreItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors ${
                    isActive 
                      ? 'bg-slate-800/90 text-white font-semibold border-l-2 border-slate-200 pl-2' 
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 font-medium'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0 opacity-85" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-auto px-4 py-3 border-t border-slate-800/80 flex items-center justify-between text-xs shrink-0 bg-[#14171b]">
          <div className="min-w-0">
            <div className="font-medium text-slate-200 truncate max-w-[145px]">{user?.name || 'Instructor'}</div>
            <div className="text-[11px] text-slate-500 truncate max-w-[145px]">{user?.email || 'Akuressa TTC'}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
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
