import React from 'react';
import { Printer, X, Building2, Calendar, Users, PhoneCall, AlertCircle, CheckCircle2, ShieldCheck, Snowflake } from 'lucide-react';
import { Course, TeacherProfile, Student, AttendanceRecord } from '../types';
import { getUzbekistanLocaleString, isStudentFrozenOnDate } from '../lib/dateUtils';

interface AbsenceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course | null;
  dateStr: string;
  teacher: TeacherProfile | null;
  allStudents: Student[];
  attendanceRecords: AttendanceRecord[];
}

export const AbsenceReportModal: React.FC<AbsenceReportModalProps> = ({
  isOpen,
  onClose,
  course,
  dateStr,
  teacher,
  allStudents,
  attendanceRecords,
}) => {
  if (!isOpen || !course) return null;

  const handlePrint = () => {
    window.print();
  };

  // Records for this course and date
  const dayRecords = attendanceRecords.filter(
    (r) => r.courseId === course.id && r.date === dateStr
  );

  // Group Students (including transferred students who have attendance records on dateStr)
  const courseStudents = allStudents.filter(
    (s) =>
      s.enrolledCourseIds.includes(course.id) ||
      dayRecords.some((r) => r.studentId === s.id)
  );

  // Map each student to their attendance info
  const studentRows = courseStudents.map((st) => {
    const rec = dayRecords.find((r) => r.studentId === st.id);
    const isFrozen = isStudentFrozenOnDate(st, dateStr, course.id);
    return {
      student: st,
      record: rec,
      isFrozen,
      status: isFrozen ? 'FROZEN' : (rec ? rec.status : 'UNMARKED'),
      category: rec?.absenceCategory,
      reason: rec?.excusedReason,
      otherText: rec?.otherReasonText,
      comment: rec?.adminComment,
    };
  });

  const absentRows = studentRows.filter((r) => r.status === 'ABSENT');
  const presentRows = studentRows.filter((r) => r.status === 'PRESENT');
  const frozenRows = studentRows.filter((r) => r.isFrozen);
  const unmarkedRows = studentRows.filter((r) => r.status === 'UNMARKED');

  const excusedCount = absentRows.filter((r) => r.category === 'EXCUSED').length;
  const unexcusedCount = absentRows.filter((r) => r.category === 'UNEXCUSED').length;

  const getReasonText = (row: typeof studentRows[0]) => {
    if (row.isFrozen) return `❄ Заморожен (${row.student.freezeReason || 'Заморозка c ' + (row.student.freezeDate || dateStr)})`;
    if (row.status === 'PRESENT') return '—';
    if (row.status === 'UNMARKED') return 'Не отмечался';
    if (row.category === 'UNEXCUSED') return 'Прогул (без причины)';

    switch (row.reason) {
      case 'SICK':
        return '🤒 Заболел (справка / предупредили)';
      case 'TRAVELED_TO_REGION':
        return '🚗 Уехал в район / область';
      case 'EXAM':
        return '📝 Экзамен в школе / лицее';
      case 'FAMILY_CIRCUMSTANCES':
        return '🏠 Семейные обстоятельства';
      case 'OTHER':
        return row.otherText ? `💬 ${row.otherText}` : '💬 Другая причина';
      default:
        return 'Уважительная причина';
    }
  };

  const formattedDate = (() => {
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}.${m}.${y}`;
    } catch {
      return dateStr;
    }
  })();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 my-8 max-h-[90vh] overflow-y-auto printable-area">
        
        {/* Modal Controls (Hidden when printing) */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 print:hidden">
          <div className="flex items-center space-x-2 text-slate-800 font-extrabold text-sm">
            <Printer className="w-5 h-5 text-indigo-600" />
            <span>Печать рапорта о причинах отсутствия</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-200 flex items-center space-x-1.5 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Распечатать рапорт</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs"
            >
              ✕
            </button>
          </div>
        </div>

        {/* PRINTABLE REPORT DOCUMENT */}
        <div className="bg-white p-6 border border-slate-200 rounded-xl space-y-5 text-slate-900 print:border-none print:p-0 print:shadow-none">
          
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-2 font-black text-lg text-slate-900 tracking-tight">
                <Building2 className="w-6 h-6 text-indigo-600 inline print:text-black" />
                <span>REDCAT</span>
              </div>
              <p className="text-xs text-slate-500 print:text-slate-700">Учебный центр и Академия навыков</p>
              <h1 className="text-base font-black text-slate-900 uppercase tracking-wide mt-2">
                ВЕДОМОСТЬ / РАПОРТ ПРИЧИН ОТСУТСТВИЯ УЧЕНИКОВ
              </h1>
            </div>

            <div className="text-right space-y-1">
              <div className="inline-block bg-slate-100 print:bg-slate-200 text-slate-800 font-mono text-xs font-bold px-3 py-1 rounded-lg">
                ДАТА: {formattedDate}
              </div>
              <p className="text-[10px] text-slate-400 print:text-slate-600 font-mono mt-1">
                Сформировано: {getUzbekistanLocaleString()}
              </p>
            </div>
          </div>

          {/* Group & Teacher Meta Info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 print:bg-slate-100 p-3 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Группа / Курс:</span>
              <span className="font-extrabold text-slate-900">{course.title}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Преподаватель:</span>
              <span className="font-bold text-slate-800">{teacher?.fullName || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Кабинет / Время:</span>
              <span className="font-bold text-slate-800">{course.scheduleDays} • {course.scheduleTime}</span>
            </div>
          </div>

          {/* Attendance Stats Summary */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 bg-slate-50 print:bg-slate-100 border border-slate-200 rounded-lg">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">По списку</span>
              <span className="font-mono font-black text-slate-900 text-sm">{courseStudents.length}</span>
            </div>
            <div className="p-2 bg-emerald-50 print:bg-emerald-100/50 border border-emerald-200 rounded-lg">
              <span className="text-[10px] text-emerald-800 font-bold uppercase block">Присутствовали</span>
              <span className="font-mono font-black text-emerald-700 text-sm">{presentRows.length}</span>
            </div>
            <div className="p-2 bg-amber-50 print:bg-amber-100/50 border border-amber-200 rounded-lg">
              <span className="text-[10px] text-amber-800 font-bold uppercase block">Уважительных</span>
              <span className="font-mono font-black text-amber-700 text-sm">{excusedCount}</span>
            </div>
            <div className="p-2 bg-rose-50 print:bg-rose-100/50 border border-rose-200 rounded-lg">
              <span className="text-[10px] text-rose-800 font-bold uppercase block">Прогулов</span>
              <span className="font-mono font-black text-rose-700 text-sm">{unexcusedCount}</span>
            </div>
          </div>

          {/* TABLE 1: ABSENT STUDENTS DETAILS (ОТСУТСТВОВАВШИЕ УЧЕНИКИ) */}
          <div className="space-y-2">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 pb-1">
              <AlertCircle className="w-4 h-4 text-rose-600 print:text-black" />
              <span>1. Список отсутствовавших учеников с указанием причин и телефонов ({absentRows.length})</span>
            </h2>

            {absentRows.length === 0 ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-800 font-bold">
                ✓ В этот день все ученики присутствовали на занятии!
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 print:bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                    <th className="py-2 px-2 border-r border-slate-300 w-8 text-center">№</th>
                    <th className="py-2 px-3 border-r border-slate-300">ФИО Ученика</th>
                    <th className="py-2 px-3 border-r border-slate-300">Контакты (Ученик / Родители)</th>
                    <th className="py-2 px-3 border-r border-slate-300">Категория</th>
                    <th className="py-2 px-3 border-r border-slate-300">Причина пропуска</th>
                    <th className="py-2 px-3">Заметка администратора</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {absentRows.map((r, idx) => (
                    <tr key={r.student.id} className="hover:bg-slate-50">
                      <td className="py-2 px-2 border-r border-slate-300 text-center font-bold font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-300 font-extrabold text-slate-900">
                        {r.student.fullName}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-300 font-mono text-[11px]">
                        <div>Уч: {r.student.phone}</div>
                        {r.student.fatherPhone && <div>Отец ({r.student.fatherName || 'Отец'}): {r.student.fatherPhone}</div>}
                        {r.student.motherPhone && <div>Мать ({r.student.motherName || 'Мать'}): {r.student.motherPhone}</div>}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-300 font-bold">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                          r.category === 'EXCUSED'
                            ? 'bg-amber-100 text-amber-900 print:bg-slate-200'
                            : 'bg-rose-100 text-rose-900 print:bg-slate-200'
                        }`}>
                          {r.category === 'EXCUSED' ? 'Уважительная' : 'Прогул'}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-300 font-medium">
                        {getReasonText(r)}
                      </td>
                      <td className="py-2 px-3 font-medium italic text-slate-700">
                        {r.comment || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* TABLE 2: FULL GROUP ROSTER SUMMARY */}
          <div className="space-y-2 pt-2">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 pb-1">
              <Users className="w-4 h-4 text-indigo-600 print:text-black" />
              <span>2. Полный сводный список всех учеников группы ({courseStudents.length})</span>
            </h2>

            <table className="w-full text-left text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 print:bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                  <th className="py-1.5 px-2 border-r border-slate-300 w-8 text-center">№</th>
                  <th className="py-1.5 px-3 border-r border-slate-300">ФИО Ученика</th>
                  <th className="py-1.5 px-3 border-r border-slate-300">Телефон</th>
                  <th className="py-1.5 px-3 border-r border-slate-300 text-center">Статус</th>
                  <th className="py-1.5 px-3">Примечание / Причина</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {studentRows.map((r, idx) => (
                  <tr key={r.student.id} className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 border-r border-slate-300 text-center font-mono font-bold">{idx + 1}</td>
                    <td className="py-1.5 px-3 border-r border-slate-300 font-bold text-slate-900">{r.student.fullName}</td>
                    <td className="py-1.5 px-3 border-r border-slate-300 font-mono text-[11px]">{r.student.phone}</td>
                    <td className="py-1.5 px-3 border-r border-slate-300 text-center font-extrabold">
                      {r.isFrozen ? (
                        <span className="text-cyan-800 print:text-black">❄ Заморожен</span>
                      ) : r.status === 'PRESENT' ? (
                        <span className="text-emerald-700 print:text-black">✓ Был</span>
                      ) : r.status === 'ABSENT' ? (
                        <span className="text-rose-700 print:text-black">✕ Отсутствовал</span>
                      ) : (
                        <span className="text-slate-400">Нет отметки</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 font-medium text-slate-700">
                      {r.isFrozen ? getReasonText(r) : r.status === 'ABSENT' ? getReasonText(r) : r.comment || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SIGNATURES BLOCK */}
          <div className="pt-6 border-t border-slate-300 mt-6 grid grid-cols-2 gap-8 text-xs font-semibold text-slate-800">
            <div>
              <p>Ответственный администратор: ___________________</p>
              <p className="text-[10px] text-slate-400 print:text-slate-600 mt-1">ФИО и Подпись</p>
            </div>
            <div>
              <p>Преподаватель группы: ___________________</p>
              <p className="text-[10px] text-slate-400 print:text-slate-600 mt-1">ФИО и Подпись</p>
            </div>
          </div>

          {/* FOOTER */}
          <div className="text-center pt-2 text-[9px] text-slate-400 print:text-slate-600 font-mono">
            REDCAT CRM • Официальный документ учета посещаемости и обзвона
          </div>

        </div>

        {/* Modal Print Action Footer (Hidden when printing) */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
          >
            Закрыть
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center space-x-2 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Распечатать рапорт</span>
          </button>
        </div>

      </div>
    </div>
  );
};
