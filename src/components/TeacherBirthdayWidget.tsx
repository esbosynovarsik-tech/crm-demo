import React from 'react';
import { Cake, Sparkles, Gift, ArrowRight } from 'lucide-react';
import { TeacherProfile } from '../types';
import { checkTeacherBirthdayStatus } from '../lib/billingLogic';

interface TeacherBirthdayWidgetProps {
  teachers: TeacherProfile[];
  onNavigateToTeachers?: () => void;
}

export const TeacherBirthdayWidget: React.FC<TeacherBirthdayWidgetProps> = ({
  teachers,
  onNavigateToTeachers,
}) => {
  const teacherBirthdayItems = teachers
    .map((t) => ({
      teacher: t,
      status: checkTeacherBirthdayStatus(t.birthDate),
    }))
    .filter((item) => item.status.isToday || item.status.isUpcoming)
    .sort((a, b) => a.status.daysLeft - b.status.daysLeft);

  if (teacherBirthdayItems.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-600/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden mb-6">
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-amber-500 text-slate-950 rounded-xl shadow-md shadow-amber-500/20 shrink-0">
            <Cake className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>Напоминание о Днях Рождения Учителей</span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Автоматическое уведомление администрации о личных праздниках коллектива
            </p>
          </div>
        </div>

        {onNavigateToTeachers && (
          <button
            onClick={onNavigateToTeachers}
            className="self-start sm:self-center flex items-center space-x-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
          >
            <span>Карточки учителей</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        {teacherBirthdayItems.map(({ teacher, status }) => (
          <div
            key={teacher.id}
            className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
              status.isToday
                ? 'bg-amber-500/20 border-amber-500 text-amber-950 dark:text-amber-100 shadow-sm'
                : 'bg-slate-900/40 dark:bg-slate-900/80 border-amber-500/20 text-slate-800 dark:text-slate-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center font-bold text-amber-500 text-sm border border-amber-500/30">
                <Gift className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold leading-snug">{teacher.fullName}</p>
                <p className="text-[11px] opacity-80">{teacher.subject}</p>
              </div>
            </div>

            <div className="text-right shrink-0">
              {status.isToday ? (
                <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] animate-bounce">
                  СЕГОДНЯ 🎉
                </span>
              ) : (
                <div className="text-right">
                  <span className="text-[11px] font-semibold text-amber-500 block">
                    {status.formattedDate}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    через {status.daysLeft} дн.
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
