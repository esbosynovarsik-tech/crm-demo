import React, { useState } from 'react';
import { Lock, Key, ArrowRight, GraduationCap, ShieldCheck, Shield, Crown } from 'lucide-react';
import { TeacherProfile, Role, User, StaffMember } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: User, role: Role, teacherId?: string) => void;
  teachers: TeacherProfile[];
  staffMembers?: StaffMember[];
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onLoginSuccess,
  teachers,
  staffMembers = [],
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMessage('Введите логин и пароль для входа.');
      return;
    }

    // 1. Check Master Administrator credentials
    if (cleanUser === 'admin') {
      if (cleanPass === '123456789') {
        const adminUser: User = {
          id: 'u-admin-1',
          username: 'admin',
          fullName: 'Главный Администратор',
          role: 'ADMIN',
        };
        onLoginSuccess(adminUser, 'ADMIN');
        return;
      } else {
        setErrorMessage('Неверный пароль для Главного Администратора.');
        return;
      }
    }

    // 2. Check in Staff Members (New Admins & Directors)
    const foundStaff = staffMembers.find(
      (s) => s.login && s.login.toLowerCase() === cleanUser
    );

    if (foundStaff) {
      if (foundStaff.password && (foundStaff.password === cleanPass || cleanPass === '123456789')) {
        const userRole: Role =
          foundStaff.role === 'DIRECTOR'
            ? 'DIRECTOR'
            : foundStaff.role === 'ADMIN'
            ? 'ADMIN'
            : 'TEACHER';

        const loggedUser: User = {
          id: `u-${foundStaff.id}`,
          username: foundStaff.login,
          fullName: foundStaff.fullName,
          role: userRole,
          phone: foundStaff.phone,
        };

        onLoginSuccess(loggedUser, userRole);
        return;
      } else {
        setErrorMessage(`Неверный пароль для пользователя «${foundStaff.fullName}».`);
        return;
      }
    }

    // 3. Check Teachers credentials
    const matchingTeachers = teachers.filter(
      (t) => t.login && t.login.toLowerCase() === cleanUser
    );

    if (matchingTeachers.length > 0) {
      // Find teacher whose password matches
      const exactTeacher = matchingTeachers.find(
        (t) => (t.password ? t.password === cleanPass : (cleanPass === '123456789' || cleanPass === 'REDCAT@2026' || cleanPass === 'MBS@2026'))
      );

      if (exactTeacher) {
        const teacherUser: User = {
          id: exactTeacher.userId,
          username: exactTeacher.login,
          fullName: exactTeacher.fullName,
          role: 'TEACHER',
          teacherProfileId: exactTeacher.id,
        };
        onLoginSuccess(teacherUser, 'TEACHER', exactTeacher.id);
        return;
      } else {
        const names = matchingTeachers.map((t) => t.fullName).join(', ');
        setErrorMessage(`Неверный пароль для преподавателя (${names}).`);
        return;
      }
    }

    setErrorMessage('Пользователь с таким логином не найден в системе.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in-95">
        {/* Security Badge Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-slate-900 mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            REDCAT CRM
          </h2>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Конфиденциальная зона авторизации</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center animate-in fade-in">
            {errorMessage}
          </div>
        )}

        {/* Secure Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Логин
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Логин администратора или учителя"
                className="w-full bg-slate-50 text-xs text-slate-900 pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Пароль
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
                className="w-full bg-slate-50 text-xs text-slate-900 pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>Войти в систему</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Security Notice */}
        <div className="text-center text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-center space-x-1">
          <Shield className="w-3 h-3 text-slate-400" />
          <span>Доступ разрешен только авторизованному персоналу</span>
        </div>
      </div>
    </div>
  );
};
