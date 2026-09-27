import React from 'react';
import {
  GraduationCap,
  UserCheck,
  ShieldAlert,
  DollarSign,
  Users,
  BookOpen,
  LogOut,
  CreditCard,
  Calendar,
  Sparkles,
  Trash2,
  Sun,
  Moon,
  MessageSquare,
  Smartphone,
} from 'lucide-react';
import { Role, TeacherProfile, User } from '../types';

interface NavbarProps {
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  selectedTeacherId: string;
  setSelectedTeacherId: (id: string) => void;
  teachers: TeacherProfile[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenQuickPaymentModal: () => void;
  currentUser?: User | null;
  onLogout?: () => void;
  onClearData?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  setCurrentRole,
  selectedTeacherId,
  setSelectedTeacherId,
  teachers,
  activeTab,
  setActiveTab,
  onOpenQuickPaymentModal,
  currentUser,
  onLogout,
  onClearData,
  theme = 'light',
  onToggleTheme,
}) => {
  return (
    <header className="bg-slate-900/95 text-white border-b border-slate-800 sticky top-0 z-50 shadow-md backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Platform Title */}
          <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer min-w-0" onClick={() => setActiveTab(currentRole === 'ADMIN' ? 'overview' : 'teacher-rollcall')}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent truncate">
                  REDCAT
                </span>
                <span className="text-[9px] sm:text-[10px] uppercase font-semibold px-1.5 sm:px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                  CMS
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 hidden sm:block truncate">Система управления учебным центром</p>
            </div>
          </div>

          {/* PINNED QUICK PAYMENT BUTTON (ADMIN ONLY) */}
          {currentRole === 'ADMIN' && (
            <button
              onClick={onOpenQuickPaymentModal}
              className="flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 border border-emerald-400/30 transition-all transform hover:scale-105 active:scale-95 shrink-0"
              title="Закрепленная панель: Быстрый прием оплаты взносов"
            >
              <CreditCard className="w-4 h-4 text-emerald-200 shrink-0" />
              <span className="hidden xs:inline">💳 Оплата взноса</span>
              <span className="xs:hidden">Оплата</span>
            </button>
          )}

          {/* Quick Role Switcher (Visible ONLY for Administrators) */}
          {(!currentUser || currentUser.role === 'ADMIN') && (
            <div className="hidden lg:flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/80">
              <button
                onClick={() => {
                  setCurrentRole('ADMIN');
                  setActiveTab('overview');
                }}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  currentRole === 'ADMIN'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Панель Администратора</span>
              </button>

              <button
                onClick={() => {
                  setCurrentRole('TEACHER');
                  setActiveTab('teacher-rollcall');
                }}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  currentRole === 'TEACHER'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Кабинет Учителя</span>
              </button>
            </div>
          )}

          {/* Right Controls */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
            
            {/* Teacher selector for Admin/Director in Teacher mode (Hidden when logged in as teacher) */}
            {currentRole === 'TEACHER' && currentUser?.role !== 'TEACHER' && (
              <div className="flex items-center space-x-2 bg-slate-800 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-700">
                <span className="text-xs text-slate-400 hidden sm:inline">Учитель:</span>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="bg-slate-900 text-slate-200 text-xs rounded-md px-2 py-1 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[130px] sm:max-w-[200px] truncate"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} ({t.subject})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Clear Virtual Data Button for Admin */}
            {currentRole === 'ADMIN' && onClearData && (
              <button
                onClick={onClearData}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs transition-all"
                title="Очистить тестовую базу данных"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Очистить базу</span>
              </button>
            )}

            {/* Day / Night Theme Toggle Switch Button */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                title={theme === 'dark' ? 'Включить дневной режим (светлая тема)' : 'Включить ночной режим (тёмная тема, мягкая для глаз)'}
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline text-amber-300">День</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-300" />
                    <span className="hidden sm:inline text-slate-300">Ночь</span>
                  </>
                )}
              </button>
            )}

            {/* Current User Badge & Logout */}
            {currentUser && (
              <div className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-800/90 pl-2 sm:pl-3 pr-1 sm:pr-1.5 py-1 rounded-xl border border-slate-700 shrink-0">
                <div className="flex items-center space-x-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium leading-none">
                      {currentUser.role === 'DIRECTOR'
                        ? 'Директор'
                        : currentUser.role === 'ADMIN'
                        ? 'Администратор'
                        : 'Преподаватель'}
                    </span>
                    <span className="text-[11px] sm:text-xs font-bold text-white max-w-[105px] xs:max-w-[140px] sm:max-w-[170px] truncate leading-tight">
                      {currentUser.fullName}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="p-1 sm:p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white transition-all cursor-pointer ml-0.5 sm:ml-1 shrink-0"
                  title="Выйти из аккаунта"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

          </div>
        </div>

        {/* Navigation Tabs Bar for Admin */}
        {currentRole === 'ADMIN' && (
          <nav className="flex items-center space-x-1 overflow-x-auto py-2 border-t border-slate-800/60 text-xs font-medium scrollbar-none">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'overview'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Главный Дашборд</span>
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'attendance'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Посещаемость</span>
            </button>

            <button
              onClick={() => setActiveTab('students')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'students'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>База Учеников & Зачисление</span>
            </button>

            <button
              onClick={() => setActiveTab('teachers')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'teachers'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Преподаватели</span>
            </button>

            <button
              onClick={() => setActiveTab('courses')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'courses'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Курсы & Группы</span>
            </button>

            <button
              onClick={() => setActiveTab('finance')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'finance'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Финансы & Зарплата</span>
            </button>

            <button
              onClick={() => setActiveTab('sms')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === 'sms'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-400" />
              <span>📱 SMS & Рассылка</span>
            </button>

            <button
              onClick={() => setActiveTab('ai-analytics')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all font-medium ${
                activeTab === 'ai-analytics'
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>🧠 ИИ Анализ</span>
            </button>
          </nav>
        )}
      </div>
    </header>
  );
};
