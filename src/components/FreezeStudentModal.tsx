import React, { useState, useEffect } from 'react';
import { Snowflake, Sun, X, User, AlertCircle, Calendar, Clock, BookOpen, CheckCircle2 } from 'lucide-react';
import { Student, Course } from '../types';
import { getUzbekistanToday, isStudentFrozenInCourse } from '../lib/dateUtils';

interface FreezeStudentModalProps {
  student: Student;
  courseId?: string;
  courseTitle?: string;
  availableCourses?: Course[];
  onClose: () => void;
  onToggleFreeze: (studentId: string, courseId?: string, reason?: string, freezeUntil?: string) => void;
}

export const FreezeStudentModal: React.FC<FreezeStudentModalProps> = ({
  student,
  courseId,
  courseTitle,
  availableCourses = [],
  onClose,
  onToggleFreeze,
}) => {
  // If specific courseId was passed, target that course.
  // Otherwise, default to first frozen enrolled course (so user can easily unfreeze it), or 'ALL'
  const enrolledCourses = availableCourses.filter((c) =>
    (student.enrolledCourseIds || []).includes(c.id)
  );

  const defaultScope = () => {
    if (courseId) return courseId;
    if (enrolledCourses.length === 1) return enrolledCourses[0].id;
    const firstFrozen = enrolledCourses.find((c) => isStudentFrozenInCourse(student, c.id));
    if (firstFrozen) return firstFrozen.id;
    return 'ALL';
  };

  const [selectedCourseScope, setSelectedCourseScope] = useState<string>(defaultScope);

  const activeTargetCourseId = selectedCourseScope === 'ALL' ? undefined : selectedCourseScope;
  const activeCourseObj = availableCourses.find((c) => c.id === activeTargetCourseId);
  const displayGroupName = courseTitle || activeCourseObj?.title;

  // Determine if student is frozen in this target scope
  const isFrozen = activeTargetCourseId
    ? isStudentFrozenInCourse(student, activeTargetCourseId)
    : (student.status === 'FROZEN' || isStudentFrozenInCourse(student));

  const existingFreezeInfo = activeTargetCourseId
    ? student.courseFreezes?.[activeTargetCourseId]
    : undefined;

  const todayStr = getUzbekistanToday();

  // Default freeze date (+7 days)
  const defaultUntil = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  };

  const [reason, setReason] = useState(
    existingFreezeInfo?.freezeReason || student.freezeReason || 'По болезни / Личным обстоятельствам'
  );
  const [freezeUntil, setFreezeUntil] = useState(
    existingFreezeInfo?.freezeUntil || student.freezeUntil || defaultUntil()
  );

  useEffect(() => {
    const info = activeTargetCourseId
      ? student.courseFreezes?.[activeTargetCourseId]
      : (student.freezeUntil ? { freezeUntil: student.freezeUntil, freezeReason: student.freezeReason } : undefined);

    if (info?.freezeReason) {
      setReason(info.freezeReason);
    }
    if (info?.freezeUntil) {
      setFreezeUntil(info.freezeUntil);
    }
  }, [selectedCourseScope, activeTargetCourseId, student]);

  const handleSetDaysAhead = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setFreezeUntil(d.toISOString().split('T')[0]);
  };

  const handleSetEndOfMonth = () => {
    const d = new Date();
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    setFreezeUntil(endOfMonth.toISOString().split('T')[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFrozen && !freezeUntil) {
      alert('Пожалуйста, выберите дату, до какого числа заморозить ученика!');
      return;
    }
    onToggleFreeze(
      student.id,
      activeTargetCourseId,
      isFrozen ? undefined : reason,
      isFrozen ? undefined : freezeUntil
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
              isFrozen
                ? 'bg-amber-50 border border-amber-200 text-amber-600'
                : 'bg-cyan-50 border border-cyan-200 text-cyan-600'
            }`}
          >
            {isFrozen ? <Sun className="w-5 h-5" /> : <Snowflake className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">
              {isFrozen ? 'Разморозка ученика' : 'Заморозка ученика'}
            </h3>
            <p className="text-xs text-slate-500">
              {displayGroupName ? (
                <span>В группе «{displayGroupName}» (независимо от других групп)</span>
              ) : (
                <span>Приостановка занятий с авто-разморозкой</span>
              )}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Student Card */}
          <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
              <User className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Ученик</p>
              <h4 className="text-sm font-bold text-slate-900">{student.fullName}</h4>
              <p className="text-[11px] text-slate-500">{student.phone}</p>
            </div>
          </div>

          {/* Group selector if modal opened globally without a preset courseId */}
          {!courseId && enrolledCourses.length > 1 && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Выберите группу для действия:</span>
              </label>
              <select
                value={selectedCourseScope}
                onChange={(e) => setSelectedCourseScope(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {enrolledCourses.map((c) => {
                  const frozenInC = isStudentFrozenInCourse(student, c.id);
                  const cf = student.courseFreezes?.[c.id];
                  return (
                    <option key={c.id} value={c.id}>
                      {c.title} — {frozenInC ? `❄ Заморожен${cf?.freezeUntil ? ` (до ${cf.freezeUntil})` : ''}` : '✓ Активен'}
                    </option>
                  );
                })}
                <option value="ALL">Во всех группах сразу</option>
              </select>

              {/* Status chips for enrolled courses */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {enrolledCourses.map((c) => {
                  const isFr = isStudentFrozenInCourse(student, c.id);
                  const cf = student.courseFreezes?.[c.id];
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setSelectedCourseScope(c.id)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1 border transition-all cursor-pointer ${
                        selectedCourseScope === c.id
                          ? 'ring-2 ring-cyan-500 shadow-xs '
                          : ''
                      }${
                        isFr
                          ? 'bg-cyan-50 border-cyan-300 text-cyan-850'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      }`}
                    >
                      {isFr ? <Snowflake className="w-3 h-3 text-cyan-600 shrink-0" /> : <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />}
                      <span>{c.title}: {isFr ? `Заморожен${cf?.freezeUntil ? ` до ${cf.freezeUntil}` : ''}` : 'Активен'}</span>
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-slate-500">
                💡 Заморозка или разморозка в одной группе работает независимо и не влияет на другие группы.
              </p>
            </div>
          )}

          {/* If specific course passed, highlight independent group freeze note */}
          {displayGroupName && (
            <div className="bg-cyan-50/70 border border-cyan-200/80 p-2.5 rounded-xl flex items-center space-x-2 text-xs text-cyan-900">
              <Snowflake className="w-4 h-4 text-cyan-600 shrink-0" />
              <span>
                Действие применяется к группе <strong>«{displayGroupName}»</strong>.
              </span>
            </div>
          )}

          {!isFrozen ? (
            <>
              {/* Calendar Date Picker: Freeze Until */}
              <div className="bg-cyan-50/70 border border-cyan-200 p-3.5 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-cyan-950 flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-cyan-600" />
                    <span>Заморозить до какого числа (включительно) *</span>
                  </label>
                </div>

                <input
                  type="date"
                  min={todayStr}
                  value={freezeUntil}
                  onChange={(e) => setFreezeUntil(e.target.value)}
                  className="w-full bg-white border border-cyan-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  required
                />

                {/* Quick duration presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSetDaysAhead(7)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-cyan-100/60 border border-cyan-200 text-cyan-800 rounded-lg transition-colors cursor-pointer"
                  >
                    +7 дней
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDaysAhead(14)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-cyan-100/60 border border-cyan-200 text-cyan-800 rounded-lg transition-colors cursor-pointer"
                  >
                    +14 дней
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDaysAhead(30)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-cyan-100/60 border border-cyan-200 text-cyan-800 rounded-lg transition-colors cursor-pointer"
                  >
                    +1 месяц
                  </button>
                  <button
                    type="button"
                    onClick={handleSetEndOfMonth}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-cyan-100/60 border border-cyan-200 text-cyan-800 rounded-lg transition-colors cursor-pointer"
                  >
                    До конца месяца
                  </button>
                </div>

                <p className="text-[11px] text-cyan-900 leading-relaxed pt-1 flex items-start space-x-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Авто-разморозка:</strong> После окончания указанной даты система автоматически разморозит ученика в группе.
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Причина заморозки:
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Например: Болезнь, Уехал в район, Семейные обстоятельства..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  required
                />
              </div>
            </>
          ) : (
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-900 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  Ученик сейчас заморожен {displayGroupName ? `в группе «${displayGroupName}»` : ''}!
                </p>
                {(existingFreezeInfo?.freezeDate || student.freezeDate) && (
                  <p className="text-[11px] text-amber-800">
                    Дата начала заморозки: <strong>{existingFreezeInfo?.freezeDate || student.freezeDate}</strong>
                  </p>
                )}
                {(existingFreezeInfo?.freezeUntil || student.freezeUntil) && (
                  <p className="text-[11px] text-amber-900 bg-amber-100/70 px-2 py-1 rounded-lg border border-amber-200 font-medium">
                    Заморожен до: <strong>{existingFreezeInfo?.freezeUntil || student.freezeUntil}</strong> (включительно)
                  </p>
                )}
                {(existingFreezeInfo?.freezeReason || student.freezeReason) && (
                  <p className="text-[11px] text-amber-800 italic">
                    Причина: {existingFreezeInfo?.freezeReason || student.freezeReason}
                  </p>
                )}
                <p className="text-[11px] text-amber-800 pt-1">
                  Нажмите «Разморозить», чтобы досрочно вернуть ученика к занятиям в этой группе.
                </p>
              </div>
            </div>
          )}

          {/* Submit Action */}
          <div className="flex items-center space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 text-white cursor-pointer ${
                isFrozen
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                  : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/20'
              }`}
            >
              {isFrozen ? (
                <>
                  <Sun className="w-4 h-4" />
                  <span>Разморозить {displayGroupName ? 'в группе' : 'ученика'}</span>
                </>
              ) : (
                <>
                  <Snowflake className="w-4 h-4" />
                  <span>Заморозить до {freezeUntil}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
