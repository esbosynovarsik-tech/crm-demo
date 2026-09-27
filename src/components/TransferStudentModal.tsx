import React, { useState, useMemo } from 'react';
import { ArrowRightLeft, X, BookOpen, User, GraduationCap, AlertCircle, Filter } from 'lucide-react';
import { Student, Course, TeacherProfile, Role } from '../types';

interface TransferStudentModalProps {
  student: Student;
  currentCourseId?: string;
  courses: Course[];
  teachers?: TeacherProfile[];
  userRole?: Role;
  teacherProfileId?: string;
  onClose: () => void;
  onTransfer: (studentId: string, fromCourseId: string, toCourseId: string) => void;
}

export const TransferStudentModal: React.FC<TransferStudentModalProps> = ({
  student,
  currentCourseId,
  courses,
  teachers = [],
  userRole,
  teacherProfileId,
  onClose,
  onTransfer,
}) => {
  const fromCourseId = currentCourseId || student.enrolledCourseIds[0] || '';
  const fromCourse = courses.find((c) => c.id === fromCourseId);

  // Determine which teacher owns the source course
  const currentTeacherId = fromCourse?.teacherId || teacherProfileId;
  const currentTeacher = teachers.find((t) => t.id === currentTeacherId);
  const isTeacherUser = userRole === 'TEACHER';

  // Toggle for Admins/Directors to see all courses if needed; for Teachers it's strictly enforced
  const [filterOnlyTeacherCourses, setFilterOnlyTeacherCourses] = useState<boolean>(true);

  // Available target courses filtered by teacher's groups
  const targetCourses = useMemo(() => {
    return courses.filter((c) => {
      // Cannot transfer to the same course
      if (c.id === fromCourseId) return false;
      // Cannot transfer to a course where student is already enrolled
      if (student.enrolledCourseIds.includes(c.id)) return false;

      // If filtering by teacher's own groups (always true for teachers, default true for admins)
      if (filterOnlyTeacherCourses && currentTeacherId) {
        return c.teacherId === currentTeacherId;
      }

      return true;
    });
  }, [courses, fromCourseId, student.enrolledCourseIds, filterOnlyTeacherCourses, currentTeacherId]);

  const [selectedTargetCourseId, setSelectedTargetCourseId] = useState<string>(
    targetCourses[0]?.id || ''
  );

  // Synchronize selected option if target courses change
  React.useEffect(() => {
    if (targetCourses.length > 0 && !targetCourses.some((c) => c.id === selectedTargetCourseId)) {
      setSelectedTargetCourseId(targetCourses[0].id);
    } else if (targetCourses.length === 0) {
      setSelectedTargetCourseId('');
    }
  }, [targetCourses, selectedTargetCourseId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetCourseId) {
      alert('Пожалуйста, выберите целевую группу для перевода.');
      return;
    }
    onTransfer(student.id, fromCourseId, selectedTargetCourseId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Перевод ученика в другую группу</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentTeacher ? `Перевод между группами преподавателя ${currentTeacher.fullName}` : 'Смена учебной группы'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Student Info Card */}
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-3.5 rounded-2xl flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-sm">
              <User className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Ученик</p>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{student.fullName}</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{student.phone}</p>
            </div>
          </div>

          {/* Current Group & Teacher */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Исходная (текущая) группа:
            </label>
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 p-3 rounded-xl text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{fromCourse ? `${fromCourse.title} (${fromCourse.daysOfWeek.join('/')})` : 'Без привязанной группы'}</span>
              </div>
              {currentTeacher && (
                <div className="flex items-center space-x-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-900/40 px-2 py-0.5 rounded-md">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>{currentTeacher.fullName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Teacher constraint notice or Admin toggle */}
          {currentTeacher && (
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300 font-medium">
                <Filter className="w-3.5 h-3.5 text-indigo-500" />
                <span>Только группы этого учителя ({currentTeacher.fullName})</span>
              </div>

              {!isTeacherUser ? (
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterOnlyTeacherCourses}
                    onChange={(e) => setFilterOnlyTeacherCourses(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-500">Фильтр</span>
                </label>
              ) : (
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">
                  Только свои группы
                </span>
              )}
            </div>
          )}

          {/* Target Group Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Выберите новую группу для перевода:
            </label>

            {targetCourses.length === 0 ? (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-3.5 rounded-xl flex items-start space-x-2.5 text-rose-800 dark:text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Нет других доступных групп для перевода!</p>
                  <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5">
                    {currentTeacher
                      ? `У преподавателя ${currentTeacher.fullName} нет других созданных групп, в которые ученик еще не зачислен.`
                      : 'В системе отсутствуют другие активные группы.'}
                  </p>
                </div>
              </div>
            ) : (
              <select
                value={selectedTargetCourseId}
                onChange={(e) => setSelectedTargetCourseId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {targetCourses.map((c) => {
                  const teacher = teachers.find((t) => t.id === c.teacherId);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.title} — {c.daysOfWeek.join('/')} ({c.startTime}-{c.endTime}) {teacher ? `[${teacher.fullName}]` : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Submit Actions */}
          <div className="flex items-center space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={targetCourses.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Подтвердить перевод</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
