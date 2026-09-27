import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle,
  XCircle,
  AlertCircle,
  UserCheck,
  UserMinus,
  UserX,
  PhoneCall,
  Search,
  Filter,
  Trash2,
  Table,
  ListFilter,
  ChevronLeft,
  ChevronRight,
  Info,
  Edit2,
  X,
  GraduationCap,
  Printer,
  Snowflake,
} from 'lucide-react';
import {
  AttendanceRecord,
  Course,
  Student,
  Enrollment,
  TeacherProfile,
  AbsenceCategory,
  ExcusedReasonType,
  SmsLog,
  SmsGatewayConfig,
} from '../types';
import { AbsenceReportModal } from './AbsenceReportModal';
import { MassAbsenceSmsModal } from './MassAbsenceSmsModal';
import { getUzbekistanToday, getUzbekistanISOString, isStudentFrozenOnDate, isStudentFrozenInCourse, getUzbekistanCurrentMonthPeriod } from '../lib/dateUtils';
import { formatDisplayPhone } from '../lib/phoneUtils';
import { sortStudentsAlphabetically } from '../lib/sortingUtils';
import { Smartphone, Send } from 'lucide-react';

interface AttendanceViewProps {
  attendanceRecords: AttendanceRecord[];
  courses: Course[];
  students: Student[];
  teachers: TeacherProfile[];
  enrollments?: Enrollment[];
  onSaveAttendance?: (records: Partial<AttendanceRecord>[]) => void;
  onUpdateAdminComment?: (recordId: string, comment: string) => void;
  onDeleteAttendanceRecord?: (recordId: string) => void;
  onSendSms?: (sms: Partial<SmsLog>) => void;
  gatewayConfig?: SmsGatewayConfig;
  onUpdateGatewayConfig?: (newConfig: Partial<SmsGatewayConfig>) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  attendanceRecords,
  courses,
  students,
  teachers,
  enrollments = [],
  onSaveAttendance,
  onUpdateAdminComment,
  onDeleteAttendanceRecord,
  onSendSms,
  gatewayConfig,
  onUpdateGatewayConfig,
}) => {
  // Mode: Daily List vs Monthly Matrix
  const [viewMode, setViewMode] = useState<'DAILY' | 'MONTHLY_GRID'>('MONTHLY_GRID');

  // Daily Mode States
  const [selectedDate, setSelectedDate] = useState<string>(() => getUzbekistanToday());
  const [selectedCourseId, setSelectedCourseId] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<
    'ALL' | 'PRESENT' | 'ABSENT_ALL' | 'ABSENT_EXCUSED' | 'ABSENT_UNEXCUSED' | 'FROZEN'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Mass Absence SMS Modal State
  const [isMassAbsenceSmsOpen, setIsMassAbsenceSmsOpen] = useState<boolean>(false);

  // Monthly Grid Mode States
  const [selectedGridCourseId, setSelectedGridCourseId] = useState<string>(() => courses[0]?.id || 'c-1');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getUzbekistanCurrentMonthPeriod()); // YYYY-MM

  // Cell Editing Modal in Monthly Grid
  const [editCellModal, setEditCellModal] = useState<{
    student: Student;
    dateStr: string;
    existingRecord?: AttendanceRecord;
  } | null>(null);

  const [cellStatus, setCellStatus] = useState<'PRESENT' | 'ABSENT'>('PRESENT');
  const [cellAbsenceCategory, setCellAbsenceCategory] = useState<AbsenceCategory>('UNEXCUSED');
  const [cellExcusedReason, setCellExcusedReason] = useState<ExcusedReasonType>('SICK');
  const [cellOtherReasonText, setCellOtherReasonText] = useState<string>('');
  const [cellComment, setCellComment] = useState<string>('');

  // Selected student for detailed contact & absence modal
  const [activeStudentModal, setActiveStudentModal] = useState<{
    student: Student;
    record?: AttendanceRecord;
    course?: Course;
  } | null>(null);

  const [commentInput, setCommentInput] = useState<string>('');
  const [modalStatus, setModalStatus] = useState<'PRESENT' | 'ABSENT'>('ABSENT');
  const [modalCategory, setModalCategory] = useState<AbsenceCategory>('EXCUSED');
  const [modalExcusedReason, setModalExcusedReason] = useState<ExcusedReasonType>('SICK');
  const [modalOtherText, setModalOtherText] = useState<string>('');
  const [modalDate, setModalDate] = useState<string>(() => getUzbekistanToday());
  const [modalCourseId, setModalCourseId] = useState<string>('');

  // Print Absence Report Modal States
  const [printReportModalOpen, setPrintReportModalOpen] = useState<boolean>(false);
  const [printTargetCourseId, setPrintTargetCourseId] = useState<string>(() => courses[0]?.id || 'c-1');
  const [printTargetDate, setPrintTargetDate] = useState<string>(() => getUzbekistanToday());

  // --- Monthly Matrix Calculations ---
  const [yearStr, monthStr] = selectedMonth.split('-');
  const yearNum = parseInt(yearStr, 10) || 2026;
  const monthNum = parseInt(monthStr, 10) || 8;

  // Number of days in selected month
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getDayOfWeekShort = (day: number) => {
    const d = new Date(yearNum, monthNum - 1, day);
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return { name: days[d.getDay()], isWeekend: d.getDay() === 0 || d.getDay() === 6 };
  };

  const formatZeroPad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  // Active currently enrolled students in selected course (sorted alphabetically)
  const currentGridCourse = courses.find((c) => c.id === selectedGridCourseId);

  const activeGridStudents = useMemo(() => {
    return sortStudentsAlphabetically(
      students.filter(
        (s) => s.status !== 'INACTIVE' && (s.enrolledCourseIds || []).includes(selectedGridCourseId)
      )
    );
  }, [students, selectedGridCourseId]);

  // Removed/unenrolled students from this course with attendance or unenrollment history
  const removedGridStudents = useMemo(() => {
    return sortStudentsAlphabetically(
      students.filter((s) => {
        if ((s.enrolledCourseIds || []).includes(selectedGridCourseId)) return false;
        const hasHistory = (s.unenrollmentHistory || []).some((u) => u.courseId === selectedGridCourseId);
        const hasDroppedEnrollment = (enrollments || []).some(
          (e) => e.studentId === s.id && e.courseId === selectedGridCourseId && e.status === 'DROPPED'
        );
        const hasAttendance = attendanceRecords.some(
          (r) => r.courseId === selectedGridCourseId && r.studentId === s.id
        );
        return hasHistory || hasDroppedEnrollment || hasAttendance;
      })
    );
  }, [students, selectedGridCourseId, enrollments, attendanceRecords]);

  // Helper to retrieve removal reason, date, and author for a student in this course
  const getStudentUnenrollInfo = (st: Student, courseId: string) => {
    const hist = (st.unenrollmentHistory || []).slice().reverse().find((u) => u.courseId === courseId);
    if (hist && hist.dropReason) {
      return {
        reason: hist.dropReason,
        date: hist.dropDate,
        droppedBy: hist.droppedBy,
      };
    }

    const droppedEnrollment = (enrollments || []).find(
      (e) => e.studentId === st.id && e.courseId === courseId && e.status === 'DROPPED'
    );
    if (droppedEnrollment && droppedEnrollment.dropReason) {
      return {
        reason: droppedEnrollment.dropReason,
        date: droppedEnrollment.dropDate,
        droppedBy: droppedEnrollment.droppedBy,
      };
    }

    if (st.enrolledCourseIds && st.enrolledCourseIds.length > 0) {
      const otherCrs = courses.find((c) => st.enrolledCourseIds.includes(c.id));
      if (otherCrs) {
        return { reason: `Переведен в группу «${otherCrs.title}»` };
      }
    }

    return { reason: 'Исключен из группы' };
  };

  // Handle cell click to edit or record attendance
  const handleOpenCellEdit = (st: Student, day: number) => {
    const dateStr = `${selectedMonth}-${formatZeroPad(day)}`;
    const record = attendanceRecords.find(
      (r) => r.studentId === st.id && r.courseId === selectedGridCourseId && r.date === dateStr
    );

    setEditCellModal({
      student: st,
      dateStr,
      existingRecord: record,
    });

    if (record) {
      setCellStatus(record.status);
      setCellAbsenceCategory(record.absenceCategory || 'UNEXCUSED');
      setCellExcusedReason(record.excusedReason || 'SICK');
      setCellOtherReasonText(record.otherReasonText || '');
      setCellComment(record.adminComment || '');
    } else {
      setCellStatus('PRESENT');
      setCellAbsenceCategory('UNEXCUSED');
      setCellExcusedReason('SICK');
      setCellOtherReasonText('');
      setCellComment('');
    }
  };

  const handleSaveCellAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCellModal) return;

    const teacherForCourse = currentGridCourse?.teacherId || teachers[0]?.id || 't-1';

    const recordPayload: Partial<AttendanceRecord> = {
      id: editCellModal.existingRecord?.id,
      date: editCellModal.dateStr,
      courseId: selectedGridCourseId,
      studentId: editCellModal.student.id,
      teacherId: teacherForCourse,
      status: cellStatus,
      absenceCategory: cellStatus === 'ABSENT' ? cellAbsenceCategory : undefined,
      excusedReason: cellStatus === 'ABSENT' && cellAbsenceCategory === 'EXCUSED' ? cellExcusedReason : undefined,
      otherReasonText: cellStatus === 'ABSENT' && cellAbsenceCategory === 'EXCUSED' && cellExcusedReason === 'OTHER' ? cellOtherReasonText : undefined,
      adminComment: cellComment || undefined,
      markedAt: getUzbekistanISOString(),
    };

    onSaveAttendance?.([recordPayload]);
    setEditCellModal(null);
  };

  // --- Daily Rollcall Calculations ---
  const dateRecords = attendanceRecords.filter((r) => {
    const matchDate = r.date === selectedDate;
    const matchCourse = selectedCourseId === 'ALL' || r.courseId === selectedCourseId;
    return matchDate && matchCourse;
  });

  const presentCount = dateRecords.filter((r) => r.status === 'PRESENT').length;
  const absentExcusedCount = dateRecords.filter((r) => r.status === 'ABSENT' && r.absenceCategory === 'EXCUSED').length;
  const absentUnexcusedCount = dateRecords.filter((r) => r.status === 'ABSENT' && r.absenceCategory === 'UNEXCUSED').length;
  const absentTotalCount = dateRecords.filter((r) => r.status === 'ABSENT').length;
  const frozenCount = dateRecords.filter((r) => {
    const st = students.find((s) => s.id === r.studentId);
    return isStudentFrozenOnDate(st, r.date, r.courseId);
  }).length;

  const filteredDailyRecords = dateRecords.filter((r) => {
    const st = students.find((s) => s.id === r.studentId);
    const isFrozen = isStudentFrozenOnDate(st, r.date, r.courseId);

    if (selectedStatusFilter === 'PRESENT' && (r.status !== 'PRESENT' || isFrozen)) return false;
    if (selectedStatusFilter === 'ABSENT_ALL' && r.status !== 'ABSENT') return false;
    if (selectedStatusFilter === 'ABSENT_EXCUSED' && (r.status !== 'ABSENT' || r.absenceCategory !== 'EXCUSED')) return false;
    if (selectedStatusFilter === 'ABSENT_UNEXCUSED' && (r.status !== 'ABSENT' || r.absenceCategory !== 'UNEXCUSED')) return false;
    if (selectedStatusFilter === 'FROZEN' && !isFrozen) return false;

    if (searchQuery) {
      if (!st?.fullName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  const handleOpenContact = (st: Student, rec?: AttendanceRecord, crs?: Course) => {
    const courseId = rec?.courseId || crs?.id || st.enrolledCourseIds[0] || courses[0]?.id || '';
    const targetDate = rec?.date || selectedDate || getUzbekistanToday();

    setActiveStudentModal({ student: st, record: rec, course: crs });
    setModalCourseId(courseId);
    setModalDate(targetDate);

    if (rec) {
      setModalStatus(rec.status);
      setModalCategory(rec.absenceCategory || 'EXCUSED');
      setModalExcusedReason(rec.excusedReason || 'SICK');
      setModalOtherText(rec.otherReasonText || '');
      setCommentInput(rec.adminComment || '');
    } else {
      setModalStatus('ABSENT');
      setModalCategory('EXCUSED');
      setModalExcusedReason('SICK');
      setModalOtherText('');
      setCommentInput('');
    }
  };

  const handleSaveComment = () => {
    if (!activeStudentModal) return;

    const { student, record } = activeStudentModal;
    const teacherForCourse = courses.find((c) => c.id === modalCourseId)?.teacherId || teachers[0]?.id || 't-1';

    const recordPayload: Partial<AttendanceRecord> = {
      id: record?.id,
      date: modalDate,
      courseId: modalCourseId,
      studentId: student.id,
      teacherId: teacherForCourse,
      status: modalStatus,
      absenceCategory: modalStatus === 'ABSENT' ? modalCategory : undefined,
      excusedReason: modalStatus === 'ABSENT' && modalCategory === 'EXCUSED' ? modalExcusedReason : undefined,
      otherReasonText: modalStatus === 'ABSENT' && modalCategory === 'EXCUSED' && modalExcusedReason === 'OTHER' ? modalOtherText : undefined,
      adminComment: commentInput || undefined,
      markedAt: getUzbekistanISOString(),
    };

    onSaveAttendance?.([recordPayload]);
    alert('Отметка посещаемости и причина отсутствия успешно сохранены!');
    setActiveStudentModal(null);
  };

  const handleDeleteRecord = (id: string) => {
    if (confirm('Вы уверены, что хотите удалить эту запись о посещаемости?')) {
      if (onDeleteAttendanceRecord) {
        onDeleteAttendanceRecord(id);
      }
    }
  };

  // Function to render a student row in monthly matrix
  const renderStudentMonthlyRow = (st: Student, isRemoved: boolean) => {
    // Accumulate student monthly stats
    let stPresent = 0;
    let stExcused = 0;
    let stUnexcused = 0;
    let stFrozen = 0;
    let stTotalRecorded = 0;

    const unenrollInfo = isRemoved ? getStudentUnenrollInfo(st, selectedGridCourseId) : null;

    return (
      <tr
        key={`${isRemoved ? 'removed-' : 'active-'}${st.id}`}
        className={isRemoved ? 'bg-rose-50/20 hover:bg-rose-50/40 transition-colors' : 'hover:bg-blue-50/30 transition-colors'}
      >
        {/* Student Name Sticky Left Cell */}
        <td
          onClick={() => handleOpenContact(st, undefined, currentGridCourse)}
          className={`py-2.5 px-3 font-bold border-r sticky left-0 z-10 shadow-xs cursor-pointer transition-colors group ${
            isRemoved
              ? 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/80 text-slate-800'
              : 'bg-white border-slate-200 hover:bg-indigo-50/90 text-slate-900'
          }`}
          title="Нажмите, чтобы просмотреть все данные ученика и контакты для звонка"
        >
          <div className="flex items-center justify-between gap-1.5">
            <div
              className={`truncate max-w-[140px] font-bold flex items-center gap-1 ${
                isRemoved ? 'text-slate-800 group-hover:text-rose-700' : 'text-slate-900 group-hover:text-indigo-600'
              }`}
            >
              <span>{st.fullName}</span>
            </div>
            <span
              className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors ${
                isRemoved
                  ? 'bg-rose-100 group-hover:bg-rose-200 text-rose-600'
                  : 'bg-slate-100 group-hover:bg-indigo-100 text-slate-400 group-hover:text-indigo-600'
              }`}
            >
              <PhoneCall className="w-3 h-3" />
            </span>
          </div>

          <div className="flex items-center space-x-1 flex-wrap">
            {isStudentFrozenInCourse(st, selectedGridCourseId) && (
              <span
                className="mt-1 px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200 text-[9px] font-extrabold inline-flex items-center space-x-0.5"
                title={st.courseFreezes?.[selectedGridCourseId]?.freezeReason || st.freezeReason ? `Причина: ${st.courseFreezes?.[selectedGridCourseId]?.freezeReason || st.freezeReason}` : 'Заморожен'}
              >
                <Snowflake className="w-2.5 h-2.5 text-cyan-600" />
                <span>Заморожен</span>
              </span>
            )}
            {!isRemoved && !st.enrolledCourseIds.includes(selectedGridCourseId) && (
              <span
                className="mt-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-extrabold inline-flex items-center space-x-0.5"
                title="Ученик переведен в другую группу"
              >
                <span>Переведен</span>
              </span>
            )}
          </div>

          {/* Prominent Reason of Removal for Removed Students */}
          {isRemoved && unenrollInfo && (
            <div className="mt-1.5 p-1.5 rounded-xl bg-rose-100/90 border border-rose-200 text-[10px] leading-tight">
              <div className="flex items-center space-x-1 text-[9px] font-black text-rose-800 uppercase tracking-wide">
                <UserMinus className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                <span>Исключен{unenrollInfo.date ? ` (${unenrollInfo.date})` : ''}</span>
              </div>
              <div className="mt-0.5 text-rose-900 font-semibold break-words" title={`Причина: ${unenrollInfo.reason}`}>
                Причина: <span className="underline decoration-rose-400 font-bold">{unenrollInfo.reason}</span>
              </div>
            </div>
          )}

          <div className="text-[10px] text-slate-400 font-mono font-normal mt-0.5">
            {formatDisplayPhone(st.phone)}
          </div>
        </td>

        {/* Cells for each day */}
        {daysArray.map((day) => {
          const dateStr = `${selectedMonth}-${formatZeroPad(day)}`;
          const rec = attendanceRecords.find(
            (r) => r.studentId === st.id && r.courseId === selectedGridCourseId && r.date === dateStr
          );
          const isFrozenDate = isStudentFrozenOnDate(st, dateStr, selectedGridCourseId);

          if (isFrozenDate) {
            stFrozen++;
          } else if (rec) {
            stTotalRecorded++;
            if (rec.status === 'PRESENT') stPresent++;
            else if (rec.absenceCategory === 'EXCUSED') stExcused++;
            else stUnexcused++;
          }

          const { isWeekend } = getDayOfWeekShort(day);

          return (
            <td
              key={day}
              onClick={() => handleOpenCellEdit(st, day)}
              className={`py-1.5 px-0.5 text-center border-r border-slate-200 cursor-pointer hover:ring-2 hover:ring-indigo-500 hover:z-20 transition-all ${
                isFrozenDate
                  ? 'bg-cyan-50/80'
                  : isWeekend && !rec
                  ? isRemoved
                    ? 'bg-rose-50/30'
                    : 'bg-slate-50'
                  : isRemoved && !rec
                  ? 'bg-rose-50/10'
                  : ''
              }`}
              title={
                isFrozenDate
                  ? `${dateStr}: Заморожен (${st.freezeReason || 'Заморозка с ' + (st.freezeDate || '')})`
                  : rec
                  ? `${dateStr}: ${
                      rec.status === 'PRESENT'
                        ? 'Присутствовал'
                        : rec.absenceCategory === 'EXCUSED'
                        ? `Уважительная пропуск (${rec.excusedReason || ''})`
                        : 'Пропуск без причины'
                    }`
                  : isRemoved && unenrollInfo
                  ? `${dateStr}: Ученик исключен из группы (${unenrollInfo.reason}). Кликните для отметки.`
                  : `${dateStr}: Нет данных (кликните, чтобы отметить)`
              }
            >
              {isFrozenDate ? (
                <span className="w-6 h-6 mx-auto rounded-md bg-cyan-500 text-white flex items-center justify-center font-bold text-[10px] shadow-xs">
                  ❄
                </span>
              ) : rec ? (
                rec.status === 'PRESENT' ? (
                  <span className="w-6 h-6 mx-auto rounded-md bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    ✓
                  </span>
                ) : rec.absenceCategory === 'EXCUSED' ? (
                  <span className="w-6 h-6 mx-auto rounded-md bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    У
                  </span>
                ) : (
                  <span className="w-6 h-6 mx-auto rounded-md bg-rose-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    ✕
                  </span>
                )
              ) : isRemoved ? (
                <span className="w-6 h-6 mx-auto rounded-md text-slate-300 flex items-center justify-center font-bold text-xs hover:text-slate-500 hover:bg-slate-100">
                  —
                </span>
              ) : (
                <span className="w-6 h-6 mx-auto rounded-md text-slate-300 flex items-center justify-center font-bold text-xs hover:text-slate-500 hover:bg-slate-100">
                  •
                </span>
              )}
            </td>
          );
        })}

        {/* Summary Totals for Student */}
        <td className="py-2 px-1 text-center font-extrabold text-emerald-700 bg-emerald-50/50 border-r border-slate-200">
          {stPresent}
        </td>
        <td className="py-2 px-1 text-center font-extrabold text-amber-700 bg-amber-50/50 border-r border-slate-200">
          {stExcused}
        </td>
        <td className="py-2 px-1 text-center font-extrabold text-rose-700 bg-rose-50/50 border-r border-slate-200">
          {stUnexcused}
        </td>
        <td className="py-2 px-1 text-center font-extrabold text-cyan-800 bg-cyan-50/50 border-r border-slate-200">
          {stFrozen}
        </td>
        <td className="py-2 px-1 text-center font-extrabold text-indigo-900 bg-indigo-50/50 font-mono">
          {stTotalRecorded > 0 ? `${Math.round((stPresent / stTotalRecorded) * 100)}%` : '0%'}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Header Controls & Mode Switcher */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <CalendarIcon className="w-5 h-5 text-indigo-600" />
              <span>Журнал Посещаемости и Перекличка Групп</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Месячная ведомость всех дней группы в формате таблицы-матрицы или дневной список
            </p>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('MONTHLY_GRID')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-bold text-xs transition-all ${
                viewMode === 'MONTHLY_GRID'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>Месячная ведомость группы</span>
            </button>

            <button
              onClick={() => setViewMode('DAILY')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-bold text-xs transition-all ${
                viewMode === 'DAILY'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListFilter className="w-4 h-4" />
              <span>Дневная перекличка (по датам)</span>
            </button>
          </div>
        </div>

        {/* CONTROLS ACCORDING TO VIEW MODE */}
        {viewMode === 'MONTHLY_GRID' ? (
          /* Monthly Grid Controls */
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              {/* Group / Course Selector */}
              <div className="flex items-center space-x-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                <Filter className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-600">Группа:</span>
                <select
                  value={selectedGridCourseId}
                  onChange={(e) => setSelectedGridCourseId(e.target.value)}
                  className="bg-transparent font-bold text-xs text-slate-900 focus:outline-none"
                >
                  {courses.map((c, idx) => (
                    <option key={`${c.id}-${idx}`} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month Picker */}
              <div className="flex items-center space-x-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                <CalendarIcon className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-600">Месяц:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent font-mono font-bold text-xs text-slate-900 focus:outline-none"
                />
              </div>

              {/* Print Absence Report Button */}
              <button
                type="button"
                onClick={() => {
                  setPrintTargetCourseId(selectedGridCourseId);
                  setPrintTargetDate(selectedDate || '2026-08-08');
                  setPrintReportModalOpen(true);
                }}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Распечатать рапорт пропусков</span>
              </button>
            </div>

            {/* Legend Indicators */}
            <div className="flex items-center space-x-3 text-[11px] font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="flex items-center space-x-1">
                <span className="w-4 h-4 rounded bg-emerald-500 text-white flex items-center justify-center text-[10px]">✓</span>
                <span>Был</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-4 h-4 rounded bg-amber-500 text-white flex items-center justify-center text-[10px]">У</span>
                <span>Уважительный</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-4 h-4 rounded bg-rose-500 text-white flex items-center justify-center text-[10px]">✕</span>
                <span>Прогул</span>
              </span>
              <span className="flex items-center space-x-1 text-slate-400">
                <span className="w-4 h-4 rounded bg-slate-200 text-slate-400 flex items-center justify-center text-[10px]">•</span>
                <span>Нет данных</span>
              </span>
            </div>
          </div>
        ) : (
          /* Daily Mode Controls */
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <CalendarIcon className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-600">Дата:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent font-mono font-bold text-xs text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-600">Группа:</span>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="bg-transparent font-semibold text-xs text-slate-800 focus:outline-none"
                  >
                    <option value="ALL">Все группы и курсы</option>
                    {courses.map((c, idx) => (
                      <option key={`${c.id}-${idx}`} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter by Attendance Status (Пришел / Отсутствовал / Уважительная / Прогул) */}
                <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <ListFilter className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-600">Статус посещения:</span>
                  <select
                    value={selectedStatusFilter}
                    onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
                    className="bg-transparent font-semibold text-xs text-slate-800 focus:outline-none"
                  >
                    <option value="ALL">Все статусы (Пришли и Отсутствовали)</option>
                    <option value="PRESENT">✓ Только присутствовали (Пришли)</option>
                    <option value="ABSENT_ALL">✕ Все отсутствующие</option>
                    <option value="ABSENT_EXCUSED">• Уважительная причина</option>
                    <option value="ABSENT_UNEXCUSED">• Прогулы (без причины)</option>
                    {frozenCount > 0 && <option value="FROZEN">❄ Замороженные</option>}
                  </select>
                </div>

                {/* Print Daily Absence Report Button */}
                <button
                  type="button"
                  onClick={() => {
                    const cid = selectedCourseId !== 'ALL' ? selectedCourseId : (courses[0]?.id || '');
                    setPrintTargetCourseId(cid);
                    setPrintTargetDate(selectedDate);
                    setPrintReportModalOpen(true);
                  }}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Печать рапорта</span>
                </button>

                {/* Mass SMS to Parents of Absent Students */}
                <button
                  type="button"
                  onClick={() => setIsMassAbsenceSmsOpen(true)}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
                  title="Отправить SMS родителям отсутствующих учеников"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>📱 SMS родителям пропустивших ({absentTotalCount})</span>
                </button>
              </div>
            </div>

            {/* Interactive Quick Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
              <span className="text-xs text-slate-400 font-semibold mr-1">Быстрый фильтр:</span>

              <button
                type="button"
                onClick={() => setSelectedStatusFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedStatusFilter === 'ALL'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Все записи ({dateRecords.length})
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatusFilter('PRESENT')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                  selectedStatusFilter === 'PRESENT'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Присутствовали ({presentCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatusFilter('ABSENT_ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                  selectedStatusFilter === 'ABSENT_ALL'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Все отсутствующие ({absentTotalCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatusFilter('ABSENT_EXCUSED')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedStatusFilter === 'ABSENT_EXCUSED'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                Уважительных: {absentExcusedCount}
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatusFilter('ABSENT_UNEXCUSED')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedStatusFilter === 'ABSENT_UNEXCUSED'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                Прогулов: {absentUnexcusedCount}
              </button>

              {frozenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter('FROZEN')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                    selectedStatusFilter === 'FROZEN'
                      ? 'bg-cyan-700 text-white shadow-xs'
                      : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border border-cyan-200'
                  }`}
                >
                  <Snowflake className="w-3 h-3 text-cyan-600" />
                  <span>Замороженные ({frozenCount})</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* VIEW MODE 1: MONTHLY GRID MATRIX BY GROUP */}
      {viewMode === 'MONTHLY_GRID' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-4 p-4">
          
          {/* Group Header Info */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Ведомость посещаемости группы: <span className="text-indigo-600">{currentGridCourse?.title}</span>
              </h3>
              <p className="text-xs text-slate-500">
                Период: {selectedMonth} | Активных учеников: <strong>{activeGridStudents.length}</strong>
                {removedGridStudents.length > 0 && (
                  <span className="text-rose-600 font-medium"> (исключенных в истории: {removedGridStudents.length})</span>
                )}{' '}
                | Кликните по любой ячейке даты, чтобы отметить или изменить статус ученика
              </p>
            </div>
          </div>

          {/* Table Matrix Container */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-mono text-[11px] border-b border-slate-200">
                  {/* Fixed Left Column: Student Name */}
                  <th className="py-2.5 px-3 text-left font-bold border-r border-slate-200 min-w-[180px] sticky left-0 bg-slate-100 z-10">
                    Ученик
                  </th>

                  {/* Day Columns 1 to 31 */}
                  {daysArray.map((day) => {
                    const { name, isWeekend } = getDayOfWeekShort(day);
                    return (
                      <th
                        key={day}
                        className={`py-2 px-1 text-center font-bold border-r border-slate-200 min-w-[32px] ${
                          isWeekend ? 'bg-slate-200 text-slate-500' : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        <div>{day}</div>
                        <div className="text-[9px] font-normal text-slate-400">{name}</div>
                      </th>
                    );
                  })}

                  {/* Summary Columns */}
                  <th className="py-2 px-2 text-center font-bold bg-emerald-50 text-emerald-800 border-r border-slate-200 min-w-[50px]" title="Всего был">
                    Был
                  </th>
                  <th className="py-2 px-2 text-center font-bold bg-amber-50 text-amber-800 border-r border-slate-200 min-w-[50px]" title="Уважительный пропуск">
                    Уваж
                  </th>
                  <th className="py-2 px-2 text-center font-bold bg-rose-50 text-rose-800 border-r border-slate-200 min-w-[50px]" title="Прогул без причины">
                    Няв
                  </th>
                  <th className="py-2 px-2 text-center font-bold bg-cyan-50 text-cyan-800 border-r border-slate-200 min-w-[50px]" title="Заморозка">
                    Замор
                  </th>
                  <th className="py-2 px-2 text-center font-bold bg-indigo-50 text-indigo-900 min-w-[60px]" title="Процент посещаемости">
                    %
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-sans">
                {activeGridStudents.length === 0 && removedGridStudents.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 6} className="py-8 text-center text-slate-400 italic">
                      В этой группе пока нет зачисленных или посещавших занятия учеников.
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* 1. ACTIVE CURRENTLY ENROLLED STUDENTS */}
                    {activeGridStudents.map((st) => renderStudentMonthlyRow(st, false))}

                    {/* 2. REMOVED STUDENTS DISPLAYED SEPARATELY AT THE BOTTOM WITH REASONS */}
                    {removedGridStudents.length > 0 && (
                      <>
                        <tr className="bg-rose-100/70 border-t-2 border-b-2 border-rose-300">
                          <td
                            colSpan={daysInMonth + 6}
                            className="py-2.5 px-4 sticky left-0 z-20 bg-rose-100 text-rose-950 font-bold text-xs shadow-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center space-x-2">
                                <span className="w-5 h-5 rounded-md bg-rose-200 text-rose-800 flex items-center justify-center font-bold text-xs">
                                  <UserMinus className="w-3.5 h-3.5" />
                                </span>
                                <span className="text-xs font-black uppercase tracking-wider text-rose-900">
                                  Удаленные / исключенные из группы ученики ({removedGridStudents.length})
                                </span>
                                <span className="text-[11px] font-normal text-rose-800">
                                  — вся история посещаемости сохранена
                                </span>
                              </div>
                              <span className="text-[10px] bg-rose-200/90 text-rose-950 px-2.5 py-0.5 rounded-md font-mono font-bold border border-rose-300">
                                Выведены отдельно снизу с указанием причины удаления
                              </span>
                            </div>
                          </td>
                        </tr>

                        {removedGridStudents.map((st) => renderStudentMonthlyRow(st, true))}
                      </>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* VIEW MODE 2: DAILY LIST (ROLLCALL) */}
      {viewMode === 'DAILY' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по ФИО ученика..."
                className="w-full pl-9 pr-3 py-1.5 bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:outline-none"
              />
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Отображено: <strong>{filteredDailyRecords.length}</strong> из {dateRecords.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-50 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Ученик</th>
                  <th className="py-3 px-4">Курс / Преподаватель</th>
                  <th className="py-3 px-4">Статус</th>
                  <th className="py-3 px-4">Причина / Комментарий</th>
                  <th className="py-3 px-4">Контакты (+998)</th>
                  <th className="py-3 px-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDailyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                      Записи посещаемости с выбранными фильтрами не найдены.
                    </td>
                  </tr>
                ) : (
                  filteredDailyRecords.map((rec) => {
                    const st = students.find((s) => s.id === rec.studentId);
                    const crs = courses.find((c) => c.id === rec.courseId);
                    const tch = teachers.find((t) => t.id === rec.teacherId);
                    const isFrozenOnDate = isStudentFrozenOnDate(st, rec.date, rec.courseId);
                    const isUnenrolledFromThisCourse = crs && st && !st.enrolledCourseIds?.includes(crs.id);
                    const dropInfo = isUnenrolledFromThisCourse && crs ? getStudentUnenrollInfo(st, crs.id) : null;

                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                          <td
                            onClick={() => st && handleOpenContact(st, rec, crs)}
                            className="py-3.5 px-4 font-bold text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors group"
                            title="Нажмите, чтобы просмотреть карточку контактов ученика"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="group-hover:underline">{st?.fullName || 'Ученик удален'}</span>
                              {isFrozenOnDate && (
                                <span
                                  className="px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200 text-[10px] font-extrabold inline-flex items-center space-x-0.5"
                                  title={st?.freezeReason ? `Причина: ${st.freezeReason}` : 'Заморожен'}
                                >
                                  <Snowflake className="w-2.5 h-2.5 text-cyan-600" />
                                  <span>Заморожен</span>
                                </span>
                              )}
                              <PhoneCall className="w-3.5 h-3.5 text-indigo-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                            </div>
                            {dropInfo && (
                              <div className="mt-1 inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-medium">
                                <UserMinus className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                <span>Исключен: <strong>{dropInfo.reason}</strong></span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-slate-800">{crs?.title || '—'}</p>
                            <p className="text-[10px] text-slate-400">Преподаватель: {tch?.fullName || '—'}</p>
                          </td>
                          <td className="py-3.5 px-4">
                            {isFrozenOnDate ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-800 font-extrabold text-[10px] uppercase border border-cyan-200">
                                <Snowflake className="w-3 h-3 text-cyan-600" />
                                <span>Заморожен</span>
                              </span>
                            ) : rec.status === 'PRESENT' ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>Был на уроке</span>
                              </span>
                            ) : rec.absenceCategory === 'EXCUSED' ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[10px] uppercase">
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                <span>Уважительная</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-extrabold text-[10px] uppercase">
                                <XCircle className="w-3 h-3 text-rose-600" />
                                <span>Без причины</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            {isFrozenOnDate && (
                              <p className="text-[11px] text-cyan-700 font-bold mb-0.5">
                                Заморозка{st?.freezeReason ? `: ${st.freezeReason}` : ''} {st?.freezeDate ? `(с ${st.freezeDate})` : ''}
                              </p>
                            )}
                            {rec.status === 'ABSENT' && (
                              <p className="text-[11px] text-slate-600 font-medium">
                                {rec.excusedReason === 'SICK' && 'Заболел'}
                                {rec.excusedReason === 'TRAVELED_TO_REGION' && 'Уехал в район'}
                                {rec.excusedReason === 'EXAM' && 'Экзамен'}
                                {rec.excusedReason === 'FAMILY_CIRCUMSTANCES' && 'Семейные обст.'}
                                {rec.otherReasonText && ` (${rec.otherReasonText})`}
                              </p>
                            )}
                            {rec.adminComment && (
                              <p className="text-[10px] text-blue-600 italic bg-blue-50 px-2 py-0.5 rounded border border-blue-100 mt-1">
                                «{rec.adminComment}»
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                            {st && (
                              <div className="space-y-0.5">
                                <p>Отец: {formatDisplayPhone(st.fatherPhone)}</p>
                                <p>Мать: {formatDisplayPhone(st.motherPhone)}</p>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1">
                            {st && (
                              <button
                                onClick={() => handleOpenContact(st, rec, crs)}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-all"
                                title="Карточка звонка"
                              >
                                <PhoneCall className="w-3.5 h-3.5 inline mr-1" />
                                Обзвон
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteRecord(rec.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Удалить запись"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CELL ATTENDANCE IN MONTHLY MATRIX */}
      {editCellModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                <span>Отметка посещаемости</span>
              </h3>
              <button
                onClick={() => setEditCellModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCellAttendance} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <p className="text-slate-600">
                  Ученик: <strong className="text-slate-900">{editCellModal.student.fullName}</strong>
                </p>
                <p className="text-slate-600">
                  Дата урока: <strong className="text-indigo-600 font-mono">{editCellModal.dateStr}</strong>
                </p>
                <p className="text-slate-600">
                  Курс: <strong className="text-slate-800">{currentGridCourse?.title}</strong>
                </p>
              </div>

              {/* Status Selector */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">Статус посещения:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCellStatus('PRESENT')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center space-x-2 font-bold ${
                      cellStatus === 'PRESENT'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>✓ Был на уроке</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCellStatus('ABSENT')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center space-x-2 font-bold ${
                      cellStatus === 'ABSENT'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>✕ Отсутствовал</span>
                  </button>
                </div>
              </div>

              {/* Absence Category & Reason if Absent */}
              {cellStatus === 'ABSENT' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                  <div>
                    <label className="block font-bold text-amber-900 mb-1">Категория пропуска:</label>
                    <select
                      value={cellAbsenceCategory}
                      onChange={(e) => setCellAbsenceCategory(e.target.value as AbsenceCategory)}
                      className="w-full bg-white p-2 rounded-lg border border-amber-300 font-semibold text-slate-800"
                    >
                      <option value="UNEXCUSED">Прогул без причины</option>
                      <option value="EXCUSED">Уважительная причина (перенос урока)</option>
                    </select>
                  </div>

                  {cellAbsenceCategory === 'EXCUSED' && (
                    <div className="space-y-2">
                      <div>
                        <label className="block font-bold text-amber-900 mb-1">Причина уважительного пропуска:</label>
                        <select
                          value={cellExcusedReason}
                          onChange={(e) => setCellExcusedReason(e.target.value as ExcusedReasonType)}
                          className="w-full bg-white p-2 rounded-lg border border-amber-300 font-semibold text-slate-800"
                        >
                          <option value="SICK">Заболел (справка / предупредили)</option>
                          <option value="TRAVELED_TO_REGION">Уехал в район / область</option>
                          <option value="EXAM">Экзамен в школе/лицее</option>
                          <option value="FAMILY_CIRCUMSTANCES">Семейные обстоятельства</option>
                          <option value="OTHER">Другая причина</option>
                        </select>
                      </div>

                      {cellExcusedReason === 'OTHER' && (
                        <div>
                          <input
                            type="text"
                            value={cellOtherReasonText}
                            onChange={(e) => setCellOtherReasonText(e.target.value)}
                            placeholder="Укажите причину..."
                            className="w-full bg-white p-2 rounded-lg border border-amber-300 font-medium text-slate-800"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Admin Comment */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Примечание администратора:</label>
                <input
                  type="text"
                  value={cellComment}
                  onChange={(e) => setCellComment(e.target.value)}
                  placeholder="Заметка о причине, звонке и т.д."
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditCellModal(null)}
                  className="px-4 py-2 text-slate-500 font-bold"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Сохранить
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* STUDENT CONTACT MODAL (ПОЛНЫЙ КАРТОЧНЫЙ ПРОФИЛЬ УЧЕНИКА ДЛЯ ОБЗВОНА) */}
      {activeStudentModal && (() => {
        const { student } = activeStudentModal;
        const studentCourses = courses.filter((c) => student.enrolledCourseIds.includes(c.id));
        const studentRecords = attendanceRecords.filter((r) => r.studentId === student.id);
        const totalRecorded = studentRecords.length;
        const totalPresent = studentRecords.filter((r) => r.status === 'PRESENT').length;
        const totalExcused = studentRecords.filter((r) => r.status === 'ABSENT' && r.absenceCategory === 'EXCUSED').length;
        const totalUnexcused = studentRecords.filter((r) => r.status === 'ABSENT' && r.absenceCategory === 'UNEXCUSED').length;
        const presentPercent = totalRecorded > 0 ? Math.round((totalPresent / totalRecorded) * 100) : 0;

        const ageText = (() => {
          if (!student.birthDate) return '';
          const birth = new Date(student.birthDate);
          const now = new Date();
          let age = now.getFullYear() - birth.getFullYear();
          const m = now.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
          return age > 0 ? `${age} лет (${student.birthDate})` : student.birthDate;
        })();

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
              
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-lg shadow-md shadow-indigo-200">
                    {student.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-black text-slate-900">{student.fullName}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        student.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : student.status === 'PAUSED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {student.status === 'ACTIVE' ? 'Активен' : student.status === 'PAUSED' ? 'На паузе' : 'Неактивен'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {ageText && <span>Дата рождения: {ageText}</span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveStudentModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                  title="Закрыть"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* DIRECT CALLING CARDS (ЗВОНОК УЧЕНИКУ И РОДИТЕЛЯМ) */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Быстрый звонок (ученик / родители)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  
                  {/* Student Phone */}
                  <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex flex-col justify-between space-y-2">
                    <div>
                      <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">Ученик</span>
                      <p className="font-bold text-slate-900 text-xs truncate" title={student.fullName}>{student.fullName.split(' ')[0]}</p>
                      <p className="font-mono font-bold text-emerald-700 text-xs mt-0.5">{formatDisplayPhone(student.phone)}</p>
                    </div>
                    <a
                      href={`tel:${student.phone}`}
                      className="w-full py-2 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-all active:scale-95"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Позвонить</span>
                    </a>
                  </div>

                  {/* Father Phone */}
                  <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200/80 flex flex-col justify-between space-y-2">
                    <div>
                      <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider">Отец</span>
                      <p className="font-bold text-slate-900 text-xs truncate" title={student.fatherName}>{student.fatherName || 'Отец'}</p>
                      <p className="font-mono font-bold text-blue-700 text-xs mt-0.5">{formatDisplayPhone(student.fatherPhone)}</p>
                    </div>
                    {student.fatherPhone ? (
                      <a
                        href={`tel:${student.fatherPhone}`}
                        className="w-full py-2 px-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-all active:scale-95"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Позвонить</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic text-center py-1.5">Не указан</span>
                    )}
                  </div>

                  {/* Mother Phone */}
                  <div className="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 flex flex-col justify-between space-y-2">
                    <div>
                      <span className="text-[10px] font-extrabold text-indigo-800 uppercase tracking-wider">Мать</span>
                      <p className="font-bold text-slate-900 text-xs truncate" title={student.motherName}>{student.motherName || 'Мать'}</p>
                      <p className="font-mono font-bold text-indigo-700 text-xs mt-0.5">{formatDisplayPhone(student.motherPhone)}</p>
                    </div>
                    {student.motherPhone ? (
                      <a
                        href={`tel:${student.motherPhone}`}
                        className="w-full py-2 px-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-all active:scale-95"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Позвонить</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic text-center py-1.5">Не указан</span>
                    )}
                  </div>

                </div>
              </div>

              {/* ENROLLED COURSES */}
              <div className="space-y-1.5 text-xs">
                <h4 className="font-extrabold text-slate-600 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Группы и курсы ученика ({studentCourses.length})</span>
                </h4>
                {studentCourses.length === 0 ? (
                  <p className="text-slate-400 italic">Ученик не зачислен ни в один курс</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {studentCourses.map((c, idx) => {
                      const tch = teachers.find((t) => t.id === c.teacherId);
                      return (
                        <div key={`${c.id}-${idx}`} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                          <div>
                            <p className="font-bold text-slate-900">{c.title}</p>
                            <p className="text-[10px] text-slate-500">Преподаватель: {tch?.fullName || '—'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ATTENDANCE SUMMARY STATS */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-700 text-[11px] uppercase tracking-wider">
                    Статистика посещаемости
                  </span>
                  <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    {presentPercent}% присутствия
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Отмечено</p>
                    <p className="text-sm font-black text-slate-800 font-mono">{totalRecorded}</p>
                  </div>
                  <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-200/60">
                    <p className="text-[10px] text-emerald-800 font-bold uppercase">Был</p>
                    <p className="text-sm font-black text-emerald-700 font-mono">{totalPresent}</p>
                  </div>
                  <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-200/60">
                    <p className="text-[10px] text-amber-800 font-bold uppercase">Уважит.</p>
                    <p className="text-sm font-black text-amber-700 font-mono">{totalExcused}</p>
                  </div>
                  <div className="bg-rose-50/70 p-2 rounded-xl border border-rose-200/60">
                    <p className="text-[10px] text-rose-800 font-bold uppercase">Прогулы</p>
                    <p className="text-sm font-black text-rose-700 font-mono">{totalUnexcused}</p>
                  </div>
                </div>
              </div>

              {/* ABSENCE REASON & ATTENDANCE RECORD FORM */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Запись отметки и причины пропуска</span>
                  </h4>
                  <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {modalDate}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Course Selector */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Группа / Курс:</label>
                    <select
                      value={modalCourseId}
                      onChange={(e) => setModalCourseId(e.target.value)}
                      className="w-full bg-white p-2 rounded-xl border border-slate-200 font-semibold text-slate-800"
                    >
                      {studentCourses.length > 0 ? (
                        studentCourses.map((c, idx) => (
                          <option key={`${c.id}-${idx}`} value={c.id}>
                            {c.title}
                          </option>
                        ))
                      ) : (
                        courses.map((c, idx) => (
                          <option key={`${c.id}-${idx}`} value={c.id}>
                            {c.title}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Date Selector */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Дата занятия:</label>
                    <input
                      type="date"
                      value={modalDate}
                      onChange={(e) => setModalDate(e.target.value)}
                      className="w-full bg-white p-2 rounded-xl border border-slate-200 font-bold font-mono text-slate-800"
                    />
                  </div>
                </div>

                {/* Status Switcher */}
                <div className="space-y-1 text-xs">
                  <label className="block font-bold text-slate-700">Отметка присутствия:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setModalStatus('PRESENT')}
                      className={`py-2 px-3 rounded-xl border flex items-center justify-center space-x-1.5 font-extrabold transition-all ${
                        modalStatus === 'PRESENT'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>✓ Был на уроке</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalStatus('ABSENT')}
                      className={`py-2 px-3 rounded-xl border flex items-center justify-center space-x-1.5 font-extrabold transition-all ${
                        modalStatus === 'ABSENT'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>✕ Отсутствовал</span>
                    </button>
                  </div>
                </div>

                {/* Absence Category & Reason Details */}
                {modalStatus === 'ABSENT' && (
                  <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2.5 text-xs">
                    <div>
                      <label className="block font-bold text-amber-900 mb-1">
                        Категория пропуска:
                      </label>
                      <select
                        value={modalCategory}
                        onChange={(e) => setModalCategory(e.target.value as AbsenceCategory)}
                        className="w-full bg-white p-2 rounded-lg border border-amber-300 font-bold text-slate-800"
                      >
                        <option value="EXCUSED">Уважительная причина (перенос урока)</option>
                        <option value="UNEXCUSED">Прогул без причины</option>
                      </select>
                    </div>

                    {modalCategory === 'EXCUSED' && (
                      <div className="space-y-2">
                        <div>
                          <label className="block font-bold text-amber-900 mb-1">
                            Укажите причину пропуска:
                          </label>
                          <select
                            value={modalExcusedReason}
                            onChange={(e) => setModalExcusedReason(e.target.value as ExcusedReasonType)}
                            className="w-full bg-white p-2 rounded-lg border border-amber-300 font-bold text-slate-800"
                          >
                            <option value="SICK">🤒 Заболел (справка / предупредили)</option>
                            <option value="TRAVELED_TO_REGION">🚗 Уехал в район / область</option>
                            <option value="EXAM">📝 Экзамен в школе / лицее</option>
                            <option value="FAMILY_CIRCUMSTANCES">🏠 Семейные обстоятельства</option>
                            <option value="OTHER">💬 Другая причина</option>
                          </select>
                        </div>

                        {modalExcusedReason === 'OTHER' && (
                          <div>
                            <input
                              type="text"
                              value={modalOtherText}
                              onChange={(e) => setModalOtherText(e.target.value)}
                              placeholder="Уточните причину подробно..."
                              className="w-full bg-white p-2 rounded-lg border border-amber-300 font-medium text-slate-800"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Admin Comment / Call Note */}
                <div className="space-y-1 text-xs">
                  <label className="block font-extrabold text-slate-700">
                    Заметка администратора (по итогам звонка родителям):
                  </label>
                  <textarea
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    rows={2}
                    placeholder="Например: 'Разговаривали с мамой, ребенок заболел, принесут справку в четверг'..."
                    className="w-full bg-white text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  />
                </div>
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setPrintTargetCourseId(modalCourseId);
                    setPrintTargetDate(modalDate);
                    setPrintReportModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center space-x-1.5 transition-all"
                  title="Открыть печатную версию рапорта причин отсутствия группы"
                >
                  <Printer className="w-4 h-4 text-indigo-600" />
                  <span>Печать рапорта дня</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setActiveStudentModal(null)}
                    className="px-4 py-2 text-slate-500 font-bold text-xs hover:text-slate-800"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveComment}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-100 transition-all active:scale-95 flex items-center space-x-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Сохранить причину и отметку</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ABSENCE REPORT PRINT MODAL */}
      <AbsenceReportModal
        isOpen={printReportModalOpen}
        onClose={() => setPrintReportModalOpen(false)}
        course={courses.find((c) => c.id === printTargetCourseId) || courses[0] || null}
        dateStr={printTargetDate}
        teacher={teachers.find((t) => t.id === (courses.find((c) => c.id === printTargetCourseId)?.teacherId)) || null}
        allStudents={students}
        attendanceRecords={attendanceRecords}
      />

      {/* MASS ABSENCE SMS MODAL */}
      <MassAbsenceSmsModal
        isOpen={isMassAbsenceSmsOpen}
        onClose={() => setIsMassAbsenceSmsOpen(false)}
        students={students}
        courses={courses}
        teachers={teachers}
        attendanceRecords={attendanceRecords}
        initialDate={selectedDate}
        initialCourseId={selectedCourseId}
        onSendSms={(sms) => {
          if (onSendSms) onSendSms(sms);
        }}
        gatewayConfig={gatewayConfig}
        onUpdateGatewayConfig={onUpdateGatewayConfig}
      />

    </div>
  );
};
