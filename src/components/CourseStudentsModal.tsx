import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Users,
  User,
  Phone,
  Calendar,
  Clock,
  Building2,
  Trash2,
  Plus,
  Search,
  BookOpen,
  CheckCircle,
  AlertCircle,
  Snowflake,
  UserCheck,
  UserX,
  GraduationCap,
  Layers,
  ArrowRight,
  ArrowRightLeft,
  Sparkles,
  AlertTriangle,
  UserMinus,
  RotateCcw,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Check,
  Info,
} from 'lucide-react';
import { Course, Student, TeacherProfile, Cabinet, AttendanceRecord, Enrollment } from '../types';
import { formatDisplayPhone } from '../lib/phoneUtils';
import { sortStudentsAlphabetically } from '../lib/sortingUtils';
import { TransferStudentModal } from './TransferStudentModal';
import { FreezeStudentModal } from './FreezeStudentModal';
import {
  getUzbekistanToday,
  getUzbekistanISOString,
  getUzbekistanCurrentMonthPeriod,
  formatMonthPeriodLabel,
  isStudentFrozenOnDate,
  isStudentFrozenInCourse,
} from '../lib/dateUtils';

interface CourseStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course | null;
  courses: Course[];
  students: Student[];
  teachers: TeacherProfile[];
  cabinets: Cabinet[];
  enrollments?: Enrollment[];
  attendanceRecords?: AttendanceRecord[];
  initialTab?: 'STUDENTS' | 'ATTENDANCE';
  onUnenrollStudent: (studentId: string, courseId: string, reason: string, isPermanent?: boolean) => void;
  onEnrollStudentToCourse?: (studentId: string, courseId: string) => void;
  onTransferStudent?: (studentId: string, fromCourseId: string, toCourseId: string) => void;
  onToggleFreezeStudent?: (studentId: string, courseId?: string, reason?: string, freezeUntil?: string) => void;
  onSaveAttendance?: (records: Partial<AttendanceRecord>[]) => void;
  onNavigateToAttendance?: (courseId: string) => void;
}

const COMMON_UNENROLL_REASONS = [
  'Ошибочное добавление в группу',
  'Переезд в другой район / город',
  'Не подходит расписание / смена в школе',
  'Финансовые причины',
  'Сложная программа / не успевает',
  'Завершил обучение / сдал экзамен',
  'По семейным обстоятельствам',
  'По собственному желанию',
];

const DAY_ABBR_MAP: Record<string, number> = {
  'ВС': 0, 'Вс': 0,
  'ПН': 1, 'Пн': 1,
  'ВТ': 2, 'Вт': 2,
  'СР': 3, 'Ср': 3,
  'ЧТ': 4, 'Чт': 4,
  'ПТ': 5, 'Пт': 5,
  'СБ': 6, 'Сб': 6,
};
const DAY_NAMES_SHORT = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

export const CourseStudentsModal: React.FC<CourseStudentsModalProps> = ({
  isOpen,
  onClose,
  course,
  courses,
  students,
  teachers,
  cabinets,
  enrollments = [],
  attendanceRecords = [],
  initialTab = 'STUDENTS',
  onUnenrollStudent,
  onEnrollStudentToCourse,
  onTransferStudent,
  onToggleFreezeStudent,
  onSaveAttendance,
  onNavigateToAttendance,
}) => {
  const [activeTab, setActiveTab] = useState<'STUDENTS' | 'ATTENDANCE'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Searchable Student Enrollment State
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [enrollSearchQuery, setEnrollSearchQuery] = useState('');
  const [selectedStudentToEnroll, setSelectedStudentToEnroll] = useState<string>('');
  
  // Student action modals state
  const [studentToTransfer, setStudentToTransfer] = useState<Student | null>(null);
  const [freezeModalStudent, setFreezeModalStudent] = useState<Student | null>(null);

  // Mandatory Reason Unenroll Modal State
  const [unenrollTargetStudent, setUnenrollTargetStudent] = useState<Student | null>(null);
  const [unenrollReason, setUnenrollReason] = useState<string>('');
  const [unenrollError, setUnenrollError] = useState<string>('');
  const [showDroppedStudents, setShowDroppedStudents] = useState<boolean>(true);

  // Attendance Tab State
  const [selectedAttendanceMonth, setSelectedAttendanceMonth] = useState<string>(() =>
    getUzbekistanCurrentMonthPeriod()
  );
  const [quickMarkDate, setQuickMarkDate] = useState<string>(() => getUzbekistanToday());
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Sync active tab with initialTab when changed
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Safe teacher and cabinet lookups
  const teacher = useMemo(() => {
    if (!course) return undefined;
    return teachers.find((t) => t.id === course.teacherId || t.userId === course.teacherId);
  }, [teachers, course]);

  const cabinet = useMemo(() => {
    if (!course) return undefined;
    return cabinets.find((c) => c.id === course.cabinetId);
  }, [cabinets, course]);

  // Students currently enrolled in THIS course (sorted alphabetically)
  const enrolledStudents = useMemo(() => {
    if (!course) return [];
    return sortStudentsAlphabetically(
      students.filter((s) => s.status !== 'INACTIVE' && s.enrolledCourseIds?.includes(course.id))
    );
  }, [students, course]);

  // Filtered by search (maintains alphabetical order)
  const filteredEnrolledStudents = useMemo(() => {
    return enrolledStudents.filter((st) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        st.fullName.toLowerCase().includes(q) ||
        st.phone.includes(q) ||
        (st.schoolName && st.schoolName.toLowerCase().includes(q))
      );
    });
  }, [enrolledStudents, searchQuery]);

  // Students available to be added to this course (not enrolled yet, sorted alphabetically)
  const availableStudentsToAdd = useMemo(() => {
    if (!course) return [];
    return sortStudentsAlphabetically(
      students.filter(
        (s) => !s.enrolledCourseIds?.includes(course.id) && s.status !== 'INACTIVE'
      )
    );
  }, [students, course]);

  // Filtered available students based on search input (FIO / phone)
  const filteredAvailableStudents = useMemo(() => {
    const q = enrollSearchQuery.toLowerCase().trim();
    if (!q) return availableStudentsToAdd;
    return availableStudentsToAdd.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        (s.schoolName && s.schoolName.toLowerCase().includes(q))
    );
  }, [availableStudentsToAdd, enrollSearchQuery]);

  // The currently selected student object for enrollment preview
  const selectedStudentObj = useMemo(() => {
    if (!selectedStudentToEnroll) return null;
    return students.find((s) => s.id === selectedStudentToEnroll) || null;
  }, [students, selectedStudentToEnroll]);

  // Students who were previously dropped/unenrolled from THIS course
  const droppedStudents = useMemo(() => {
    if (!course) return [];
    return sortStudentsAlphabetically(
      students.filter((s) => {
        if (s.enrolledCourseIds?.includes(course.id)) return false;
        const hasHistory = (s.unenrollmentHistory || []).some((u) => u.courseId === course.id);
        const hasDroppedEnrollment = enrollments.some(
          (e) => e.studentId === s.id && e.courseId === course.id && e.status === 'DROPPED'
        );
        const hasAttendance = attendanceRecords.some(
          (r) => r.courseId === course.id && r.studentId === s.id
        );
        return hasHistory || hasDroppedEnrollment || hasAttendance;
      })
    );
  }, [students, course, enrollments, attendanceRecords]);

  // Lesson dates for this course in the selected month
  const lessonDatesInMonth = useMemo(() => {
    if (!course) return [];
    const [yStr, mStr] = selectedAttendanceMonth.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    if (!year || !month) return [];

    const daysInMonth = new Date(year, month, 0).getDate();
    const targetDays = new Set(
      (course.daysOfWeek || []).map((d) => DAY_ABBR_MAP[d]).filter((n) => n !== undefined)
    );

    const dates: { dateStr: string; dayNum: number; dayAbbr: string; isToday: boolean }[] = [];
    const todayStr = getUzbekistanToday();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dayOfWeek = dateObj.getDay();
      const dateStr = `${yStr}-${mStr.padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasExistingRecords = attendanceRecords.some(
        (r) => r.courseId === course.id && r.date === dateStr
      );

      // Include if it falls on course schedule day or has actual records
      if (targetDays.has(dayOfWeek) || hasExistingRecords) {
        dates.push({
          dateStr,
          dayNum: d,
          dayAbbr: DAY_NAMES_SHORT[dayOfWeek],
          isToday: dateStr === todayStr,
        });
      }
    }

    return dates;
  }, [course, selectedAttendanceMonth, attendanceRecords]);

  // Keep quickMarkDate aligned with valid dates
  useEffect(() => {
    const today = getUzbekistanToday();
    const hasToday = lessonDatesInMonth.some((d) => d.dateStr === today);
    if (hasToday) {
      setQuickMarkDate(today);
    } else if (lessonDatesInMonth.length > 0) {
      const past = lessonDatesInMonth.filter((d) => d.dateStr <= today);
      if (past.length > 0) {
        setQuickMarkDate(past[past.length - 1].dateStr);
      } else {
        setQuickMarkDate(lessonDatesInMonth[0].dateStr);
      }
    }
  }, [lessonDatesInMonth]);

  // Group Attendance Statistics for the month
  const groupAttendanceStats = useMemo(() => {
    const dates = lessonDatesInMonth;
    const todayStr = getUzbekistanToday();
    const pastOrTodayLessonDates = dates.filter((d) => d.dateStr <= todayStr);

    let totalPresent = 0;
    let totalExcused = 0;
    let totalUnexcused = 0;
    let totalFrozen = 0;

    enrolledStudents.forEach((st) => {
      dates.forEach((d) => {
        const rec = attendanceRecords.find(
          (r) => r.courseId === course?.id && r.studentId === st.id && r.date === d.dateStr
        );
        const isFrozen = isStudentFrozenOnDate(st, d.dateStr, course?.id);

        if (rec?.status === 'PRESENT') {
          totalPresent++;
        } else if (rec?.status === 'ABSENT') {
          if (rec.absenceCategory === 'EXCUSED') {
            totalExcused++;
          } else {
            totalUnexcused++;
          }
        } else if (isFrozen) {
          totalFrozen++;
        }
      });
    });

    const totalMarked = totalPresent + totalExcused + totalUnexcused;
    const attendanceRate = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : 100;

    return {
      totalScheduledLessons: dates.length,
      conductedLessonsCount: pastOrTodayLessonDates.length,
      totalPresent,
      totalExcused,
      totalUnexcused,
      totalFrozen,
      attendanceRate,
    };
  }, [lessonDatesInMonth, enrolledStudents, attendanceRecords, course]);

  // Return null if modal is closed or no course selected AFTER all hooks have executed
  if (!isOpen || !course) return null;

  const handleOpenUnenrollModal = (student: Student) => {
    setUnenrollTargetStudent(student);
    setUnenrollReason('');
    setUnenrollError('');
  };

  const handleConfirmUnenroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unenrollTargetStudent || !course) return;

    const trimmed = unenrollReason.trim();
    if (!trimmed) {
      setUnenrollError('Причина исключения обязательна для заполнения. Пожалуйста, укажите причину.');
      return;
    }

    onUnenrollStudent(unenrollTargetStudent.id, course.id, trimmed);
    setUnenrollTargetStudent(null);
    setUnenrollReason('');
    setUnenrollError('');
  };

  const handleAddStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentToEnroll) {
      alert('Пожалуйста, выберите ученика для зачисления в группу');
      return;
    }

    if (onEnrollStudentToCourse) {
      onEnrollStudentToCourse(selectedStudentToEnroll, course.id);
      setSelectedStudentToEnroll('');
      setEnrollSearchQuery('');
      setIsAddingStudent(false);
      setActionNotice('Ученик успешно зачислен в группу!');
      setTimeout(() => setActionNotice(null), 3500);
    }
  };

  const handlePrevMonth = () => {
    const [yStr, mStr] = selectedAttendanceMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) - 1;
    if (m < 1) {
      m = 12;
      y--;
    }
    setSelectedAttendanceMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [yStr, mStr] = selectedAttendanceMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + 1;
    if (m > 12) {
      m = 1;
      y++;
    }
    setSelectedAttendanceMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  const handleToggleCellAttendance = (studentId: string, dateStr: string) => {
    if (!onSaveAttendance || !course) return;

    const existing = attendanceRecords.find(
      (r) => r.courseId === course.id && r.studentId === studentId && r.date === dateStr
    );

    const isoNow = getUzbekistanISOString();

    if (!existing) {
      // 1st click: Mark PRESENT
      onSaveAttendance([
        {
          courseId: course.id,
          studentId,
          teacherId: course.teacherId,
          date: dateStr,
          status: 'PRESENT',
          markedAt: isoNow,
        },
      ]);
    } else if (existing.status === 'PRESENT') {
      // 2nd click: Mark ABSENT UNEXCUSED
      onSaveAttendance([
        {
          ...existing,
          status: 'ABSENT',
          absenceCategory: 'UNEXCUSED',
          markedAt: isoNow,
        },
      ]);
    } else if (existing.status === 'ABSENT' && existing.absenceCategory === 'UNEXCUSED') {
      // 3rd click: Mark ABSENT EXCUSED
      onSaveAttendance([
        {
          ...existing,
          status: 'ABSENT',
          absenceCategory: 'EXCUSED',
          excusedReason: 'SICK',
          markedAt: isoNow,
        },
      ]);
    } else {
      // 4th click: Return to PRESENT
      onSaveAttendance([
        {
          ...existing,
          status: 'PRESENT',
          absenceCategory: undefined,
          excusedReason: undefined,
          markedAt: isoNow,
        },
      ]);
    }
  };

  const handleMarkAllPresentOnDate = (dateStr: string) => {
    if (!onSaveAttendance || !course || enrolledStudents.length === 0) return;

    const isoNow = getUzbekistanISOString();
    const updates: Partial<AttendanceRecord>[] = enrolledStudents.map((st) => {
      const existing = attendanceRecords.find(
        (r) => r.courseId === course.id && r.studentId === st.id && r.date === dateStr
      );
      return {
        ...(existing || {}),
        courseId: course.id,
        studentId: st.id,
        teacherId: course.teacherId,
        date: dateStr,
        status: 'PRESENT',
        absenceCategory: undefined,
        excusedReason: undefined,
        markedAt: isoNow,
      };
    });

    onSaveAttendance(updates);
    setActionNotice(`Все ученики (${enrolledStudents.length}) отмечены присутствующими на дату ${dateStr}`);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const capacity = cabinet?.capacity || 16;
  const occupancyPercent = Math.min(100, Math.round((enrolledStudents.length / capacity) * 100));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-5xl w-full shadow-2xl overflow-hidden my-auto flex flex-col max-h-[94vh]">
        
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-5 sm:p-6 text-white relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            title="Закрыть окно"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-white/20 text-white font-black text-[11px] uppercase tracking-wider">
              {course.subject}
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-400/30 text-emerald-100 font-bold text-xs border border-emerald-300/30">
              {course.monthlyPrice.toLocaleString('ru-RU')} сум / мес
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
            {course.title}
          </h2>

          {/* Course Meta Info Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 text-xs text-blue-100">
            <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/15">
              <span className="text-[10px] text-blue-200 block">Преподаватель</span>
              <span className="font-bold text-white text-xs truncate block">
                {teacher?.fullName || 'Не назначен'}
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/15">
              <span className="text-[10px] text-blue-200 block">Дни занятий</span>
              <span className="font-bold text-white text-xs block">
                {course.daysOfWeek.join(', ')}
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/15">
              <span className="text-[10px] text-blue-200 block">Время проведения</span>
              <span className="font-bold text-white text-xs block">
                {course.startTime} - {course.endTime}
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/15">
              <span className="text-[10px] text-blue-200 block">Аудитория</span>
              <span className="font-bold text-white text-xs block">
                {cabinet?.roomNumber || 'Кабинет №1'} ({capacity} мест)
              </span>
            </div>
          </div>
        </div>

        {/* MODAL TABS NAVIGATION BAR */}
        <div className="bg-slate-100 dark:bg-slate-800 px-4 sm:px-6 py-2.5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('STUDENTS')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'STUDENTS'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Ученики группы ({enrolledStudents.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ATTENDANCE')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                activeTab === 'ATTENDANCE'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ClipboardCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Посещаемость группы</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {activeTab === 'STUDENTS' && onEnrollStudentToCourse && (
              <button
                type="button"
                onClick={() => {
                  setIsAddingStudent(!isAddingStudent);
                  if (!isAddingStudent) {
                    setSelectedStudentToEnroll('');
                    setEnrollSearchQuery('');
                  }
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isAddingStudent
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'
                }`}
              >
                {isAddingStudent ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Отмена</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Зачислить ученика</span>
                  </>
                )}
              </button>
            )}

            {activeTab === 'ATTENDANCE' && onNavigateToAttendance && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToAttendance(course.id);
                }}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1 cursor-pointer"
                title="Перейти в расширенный журнал посещаемости всей школы"
              >
                <span>Общий журнал школы →</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Notice Alert */}
        {actionNotice && (
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border-b border-emerald-200 dark:border-emerald-800 px-4 py-2 flex items-center space-x-2 text-emerald-800 dark:text-emerald-200 text-xs font-semibold animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: STUDENTS LIST & SEARCHABLE ENROLLMENT                              */}
        {/* ========================================================================= */}
        {activeTab === 'STUDENTS' && (
          <>
            {/* SUBHEADER: STATS & SEARCH */}
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Студенты группы</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold text-xs">
                        {enrolledStudents.length} {enrolledStudents.length === 1 ? 'ученик' : enrolledStudents.length >= 2 && enrolledStudents.length <= 4 ? 'ученика' : 'учеников'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Заполняемость аудитории: <span className="font-bold text-slate-700 dark:text-slate-200">{enrolledStudents.length} из {capacity}</span> ({occupancyPercent}%)
                    </p>
                  </div>
                </div>

                {/* Quick Switch to Attendance button for prompt discoverability */}
                <button
                  type="button"
                  onClick={() => setActiveTab('ATTENDANCE')}
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center space-x-1.5 border border-emerald-200 dark:border-emerald-800 transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
                >
                  <ClipboardCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Посещаемость этой группы →</span>
                </button>
              </div>

              {/* CONVENIENT SEARCHABLE ENROLLMENT FORM (User Request #2) */}
              {isAddingStudent && onEnrollStudentToCourse && (
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border-2 border-blue-300 dark:border-blue-800 shadow-md animate-in fade-in space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                        Быстрый поиск и зачисление ученика в эту группу
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Доступно вне этой группы: <strong>{availableStudentsToAdd.length}</strong>
                    </span>
                  </div>

                  {/* Selected Student Confirmation Preview */}
                  {selectedStudentObj ? (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-emerald-950 dark:text-emerald-200 truncate">
                            Выбран: {selectedStudentObj.fullName}
                          </div>
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                            {formatDisplayPhone(selectedStudentObj.phone)} • {selectedStudentObj.schoolName || 'Школа не указана'} {selectedStudentObj.grade ? `(${selectedStudentObj.grade})` : ''}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedStudentToEnroll('')}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 text-xs font-bold border border-emerald-200 dark:border-emerald-800 shrink-0 cursor-pointer"
                      >
                        ✕ Сменить
                      </button>
                    </div>
                  ) : (
                    /* Search input by FIO / Phone */
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-4 h-4 text-blue-600 dark:text-blue-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          autoFocus
                          value={enrollSearchQuery}
                          onChange={(e) => setEnrollSearchQuery(e.target.value)}
                          placeholder="Введите ФИО (фамилию, имя) или телефон ученика для поиска..."
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-blue-200 dark:border-blue-900 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {enrollSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setEnrollSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Filtered suggestions list */}
                      <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {filteredAvailableStudents.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500">
                            {enrollSearchQuery ? (
                              <span>Ученик с ФИО «<strong>{enrollSearchQuery}</strong>» не найден среди свободных учеников</span>
                            ) : (
                              <span>Нет доступных учеников для добавления</span>
                            )}
                          </div>
                        ) : (
                          filteredAvailableStudents.slice(0, 15).map((st) => (
                            <div
                              key={st.id}
                              onClick={() => setSelectedStudentToEnroll(st.id)}
                              className="p-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer flex items-center justify-between gap-2 transition-colors"
                            >
                              <div className="flex items-center space-x-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0">
                                  {st.fullName.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {st.fullName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-2">
                                    <span>{formatDisplayPhone(st.phone)}</span>
                                    {st.schoolName && <span>• {st.schoolName}</span>}
                                    {isStudentFrozenInCourse(st, course.id) && (
                                      <span className="px-1.5 py-0.2 rounded bg-sky-100 text-sky-700 text-[10px] font-bold">
                                        Заморожен
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStudentToEnroll(st.id);
                                }}
                                className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0 cursor-pointer"
                              >
                                Выбрать →
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Enroll Submit Action Button */}
                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingStudent(false);
                        setSelectedStudentToEnroll('');
                        setEnrollSearchQuery('');
                      }}
                      className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer"
                    >
                      Отмена
                    </button>

                    <button
                      type="button"
                      onClick={handleAddStudentSubmit}
                      disabled={!selectedStudentToEnroll}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Зачислить в группу</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Roster Search bar */}
              {enrolledStudents.length > 3 && (
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Быстрый поиск ученика в списке по имени или телефону..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {/* STUDENTS LIST (SCROLLABLE) */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 bg-white dark:bg-slate-900">
              {enrolledStudents.length === 0 ? (
                <div className="text-center py-10 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 flex items-center justify-center text-blue-500 mx-auto mb-3">
                    <Users className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    В этой группе пока нет зачисленных учеников
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    Нажмите кнопку «+ Зачислить ученика», чтобы быстро найти ученика по ФИО и добавить в этот курс.
                  </p>
                  {onEnrollStudentToCourse && (
                    <button
                      type="button"
                      onClick={() => setIsAddingStudent(true)}
                      className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs inline-flex items-center space-x-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Зачислить первого ученика</span>
                    </button>
                  )}
                </div>
              ) : filteredEnrolledStudents.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400">
                  Ученики по запросу «{searchQuery}» не найдены
                </div>
              ) : (
                filteredEnrolledStudents.map((st, index) => {
                  const studentRecords = attendanceRecords.filter(
                    (r) => r.courseId === course.id && r.studentId === st.id
                  );
                  const presentCount = studentRecords.filter((r) => r.status === 'PRESENT').length;
                  const absentCount = studentRecords.filter((r) => r.status === 'ABSENT').length;

                  // Other enrolled courses for multi-badge
                  const otherCourses = courses.filter(
                    (c) => c.id !== course.id && st.enrolledCourseIds?.includes(c.id)
                  );

                  return (
                    <div
                      key={st.id}
                      className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-slate-800/60 shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      {/* Left: Info */}
                      <div className="flex items-start space-x-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-black text-xs flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-800 mt-0.5">
                          {index + 1}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                              {st.fullName}
                            </span>

                            {(() => {
                              const isFrozenInGroup = isStudentFrozenInCourse(st, course.id);
                              const freezeInfo = st.courseFreezes?.[course.id];
                              const freezeUntilDate = freezeInfo?.freezeUntil || (isFrozenInGroup ? st.freezeUntil : undefined);

                              if (isFrozenInGroup) {
                                return (
                                  <span className="px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 font-bold text-[10px] border border-cyan-200 dark:border-cyan-800 flex items-center space-x-1">
                                    <Snowflake className="w-3 h-3 text-cyan-600" />
                                    <span>Заморожен{freezeUntilDate ? ` до ${freezeUntilDate}` : ''}</span>
                                  </span>
                                );
                              }
                              return (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] border border-emerald-200 dark:border-emerald-800 flex items-center space-x-1">
                                  <UserCheck className="w-3 h-3 text-emerald-600" />
                                  <span>Активен</span>
                                </span>
                              );
                            })()}

                            {st.discountValue > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold text-[10px] border border-amber-200 dark:border-amber-800">
                                Скидка {st.discountValue} {st.discountType === 'PERCENTAGE' ? '%' : 'сум'}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center space-x-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {formatDisplayPhone(st.phone)}
                              </span>
                            </span>

                            {st.schoolName && (
                              <span className="flex items-center space-x-1">
                                <GraduationCap className="w-3 h-3 text-slate-400" />
                                <span>
                                  {st.schoolName} {st.grade ? `(${st.grade})` : ''}
                                </span>
                              </span>
                            )}

                            {(presentCount > 0 || absentCount > 0) && (
                              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                Посещений: <strong className="text-emerald-700 dark:text-emerald-400">{presentCount}</strong> | Пропусков: <strong className="text-rose-600 dark:text-rose-400">{absentCount}</strong>
                              </span>
                            )}
                          </div>

                          {/* Other Enrolled Courses Multi-Badge */}
                          {otherCourses.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[10px] text-slate-400 font-bold">Также ходит на:</span>
                              {otherCourses.map((oc, ocIdx) => (
                                <span
                                  key={`${st.id}-${oc.id}-${ocIdx}`}
                                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold border border-slate-200 dark:border-slate-600"
                                >
                                  {oc.title}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions (Transfer, Freeze, Unenroll) - User Request #1 */}
                      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700 shrink-0">
                        {/* 1. Transfer Button */}
                        {onTransferStudent && (
                          <button
                            type="button"
                            onClick={() => setStudentToTransfer(st)}
                            className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-bold text-xs flex items-center space-x-1.5 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer"
                            title="Перевести ученика в другую группу"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Перевод</span>
                          </button>
                        )}

                        {/* 2. Freeze Button (NEW User Request #1) */}
                        {onToggleFreezeStudent && (
                          <button
                            type="button"
                            onClick={() => setFreezeModalStudent(st)}
                            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center space-x-1.5 border transition-all cursor-pointer ${
                              isStudentFrozenInCourse(st, course.id)
                                ? 'bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
                                : 'bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                            }`}
                            title={
                              isStudentFrozenInCourse(st, course.id)
                                ? 'Ученик заморожен в этой группе (нажмите для изменения или разморозки)'
                                : 'Заморозить ученика в этой группе'
                            }
                          >
                            <Snowflake className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            <span>{isStudentFrozenInCourse(st, course.id) ? 'Заморожен' : 'Заморозить'}</span>
                          </button>
                        )}

                        {/* 3. Unenroll Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenUnenrollModal(st)}
                          className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 hover:text-rose-700 font-bold text-xs flex items-center space-x-1.5 border border-rose-200 dark:border-rose-800 transition-all cursor-pointer"
                          title="Исключить ученика из этого курса с обязательным указанием причины"
                        >
                          <UserMinus className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          <span>Исключить</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* DROPPED / UNENROLLED STUDENTS SECTION */}
              {droppedStudents.length > 0 && (
                <div className="mt-8 pt-6 border-t-2 border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-400">
                      <UserX className="w-4 h-4" />
                      <h4 className="text-xs font-black uppercase tracking-wider">
                        Исключенные из этого курса ученики ({droppedStudents.length})
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDroppedStudents(!showDroppedStudents)}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold"
                    >
                      {showDroppedStudents ? 'Скрыть архив' : 'Показать архив'}
                    </button>
                  </div>

                  {showDroppedStudents && (
                    <div className="space-y-2">
                      {droppedStudents.map((st) => {
                        const hist = (st.unenrollmentHistory || [])
                          .slice()
                          .reverse()
                          .find((u) => u.courseId === course.id);

                        return (
                          <div
                            key={st.id}
                            className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                  {st.fullName}
                                </span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {formatDisplayPhone(st.phone)}
                                </span>
                              </div>
                              {hist?.dropReason && (
                                <div className="text-[11px] text-rose-700 dark:text-rose-400 font-medium mt-0.5">
                                  Причина: «{hist.dropReason}»
                                  {hist.dropDate && <span className="text-slate-400 ml-1.5">({hist.dropDate})</span>}
                                </div>
                              )}
                            </div>

                            {onEnrollStudentToCourse && (
                              <button
                                type="button"
                                onClick={() => {
                                  onEnrollStudentToCourse(st.id, course.id);
                                  setActionNotice(`Ученик ${st.fullName} восстановлен в группу`);
                                  setTimeout(() => setActionNotice(null), 3000);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 transition-all flex items-center space-x-1 shrink-0 self-start sm:self-auto cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Восстановить в курс</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: COURSE ATTENDANCE JOURNAL (User Request #3)                        */}
        {/* ========================================================================= */}
        {activeTab === 'ATTENDANCE' && (
          <div className="flex flex-col flex-1 overflow-hidden bg-white dark:bg-slate-900">
            {/* Controls Bar: Month Selection & Quick Attendance Marker */}
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Month Navigator */}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                    title="Предыдущий месяц"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xs text-center min-w-[150px]">
                    <span className="text-xs font-black text-slate-900 dark:text-white capitalize block">
                      {formatMonthPeriodLabel(selectedAttendanceMonth)}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {lessonDatesInMonth.length} занятий по графику
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                    title="Следующий месяц"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {selectedAttendanceMonth !== getUzbekistanCurrentMonthPeriod() && (
                    <button
                      type="button"
                      onClick={() => setSelectedAttendanceMonth(getUzbekistanCurrentMonthPeriod())}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                    >
                      Текущий месяц
                    </button>
                  )}
                </div>

                {/* 1-Click Fast Marker Action */}
                {onSaveAttendance && enrolledStudents.length > 0 && lessonDatesInMonth.length > 0 && (
                  <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                    <select
                      value={quickMarkDate}
                      onChange={(e) => setQuickMarkDate(e.target.value)}
                      className="text-xs font-bold bg-transparent text-slate-800 dark:text-slate-200 px-2 py-1 outline-none cursor-pointer"
                    >
                      {lessonDatesInMonth.map((d) => (
                        <option key={d.dateStr} value={d.dateStr} className="text-slate-900 dark:text-slate-100">
                          {d.dateStr} ({d.dayAbbr}){d.isToday ? ' — Сегодня' : ''}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleMarkAllPresentOnDate(quickMarkDate)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer"
                      title="Отметить всех учеников группы как присутствующих на выбранную дату"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Отметить всех ✓</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Monthly Group Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold block">Посещаемость группы</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {groupAttendanceStats.attendanceRate}%
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold block">Всего присутствий</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    {groupAttendanceStats.totalPresent}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold block">Пропусков (уваж / неуваж)</span>
                  <span className="text-base font-black text-rose-600 dark:text-rose-400">
                    <span className="text-amber-600">{groupAttendanceStats.totalExcused}</span> / {groupAttendanceStats.totalUnexcused}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold block">Уроков в месяце</span>
                  <span className="text-base font-black text-blue-600 dark:text-blue-400">
                    {groupAttendanceStats.conductedLessonsCount} из {groupAttendanceStats.totalScheduledLessons}
                  </span>
                </div>
              </div>
            </div>

            {/* Attendance Matrix Table (Scrollable) */}
            <div className="flex-1 overflow-auto p-4 sm:p-5">
              {enrolledStudents.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-xs">
                  В группе нет учеников для отображения посещаемости.
                </div>
              ) : lessonDatesInMonth.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-xs">
                  В этом месяце нет уроков по расписанию ({course.daysOfWeek.join(', ')}).
                </div>
              ) : (
                <div className="inline-block min-w-full align-middle border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                      <tr>
                        <th className="py-3 px-3 w-8 text-center sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">
                          #
                        </th>
                        <th className="py-3 px-3 min-w-[180px] sticky left-8 bg-slate-50 dark:bg-slate-800 z-10 border-r border-slate-200 dark:border-slate-700">
                          Ученик (ФИО)
                        </th>
                        {lessonDatesInMonth.map((d) => (
                          <th
                            key={d.dateStr}
                            className={`py-2 px-2 text-center min-w-[44px] ${
                              d.isToday
                                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'
                                : ''
                            }`}
                          >
                            <div className="text-[11px] font-black">{d.dayNum}</div>
                            <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                              {d.dayAbbr}
                            </div>
                          </th>
                        ))}
                        <th className="py-3 px-3 text-center bg-slate-100 dark:bg-slate-800/80 font-black border-l border-slate-200 dark:border-slate-700">
                          Присутств.
                        </th>
                        <th className="py-3 px-3 text-center bg-slate-100 dark:bg-slate-800/80 font-black">
                          Пропусков
                        </th>
                        <th className="py-3 px-3 text-center bg-slate-100 dark:bg-slate-800/80 font-black">
                          %
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                      {enrolledStudents.map((st, sIdx) => {
                        let studentPresent = 0;
                        let studentExcused = 0;
                        let studentUnexcused = 0;

                        return (
                          <tr key={st.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="py-2.5 px-3 text-center text-[11px] text-slate-400 sticky left-0 bg-white dark:bg-slate-900 z-10">
                              {sIdx + 1}
                            </td>

                            <td className="py-2.5 px-3 font-bold sticky left-8 bg-white dark:bg-slate-900 z-10 border-r border-slate-200 dark:border-slate-700 truncate max-w-[200px]">
                              <div className="flex items-center space-x-1.5 truncate">
                                <span className="truncate">{st.fullName}</span>
                                {isStudentFrozenInCourse(st, course.id) && (
                                  <Snowflake className="w-3 h-3 text-cyan-500 shrink-0" title="Заморожен в этой группе" />
                                )}
                              </div>
                            </td>

                            {lessonDatesInMonth.map((d) => {
                              const rec = attendanceRecords.find(
                                (r) => r.courseId === course.id && r.studentId === st.id && r.date === d.dateStr
                              );
                              const isFrozen = isStudentFrozenOnDate(st, d.dateStr, course.id);

                              if (rec?.status === 'PRESENT') {
                                studentPresent++;
                              } else if (rec?.status === 'ABSENT') {
                                if (rec.absenceCategory === 'EXCUSED') {
                                  studentExcused++;
                                } else {
                                  studentUnexcused++;
                                }
                              }

                              return (
                                <td
                                  key={d.dateStr}
                                  onClick={() => handleToggleCellAttendance(st.id, d.dateStr)}
                                  className={`py-2 px-1 text-center cursor-pointer transition-colors select-none ${
                                    d.isToday ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                                  } hover:bg-blue-100 dark:hover:bg-blue-900/40`}
                                  title="Нажмите для смены статуса (✓ Присутствовал / Н Неуваж. / У Уваж.)"
                                >
                                  {isFrozen && !rec ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 text-xs font-black">
                                      ❄
                                    </span>
                                  ) : rec?.status === 'PRESENT' ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                                      ✓
                                    </span>
                                  ) : rec?.status === 'ABSENT' ? (
                                    rec.absenceCategory === 'EXCUSED' ? (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-xs font-black">
                                        У
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-black">
                                        Н
                                      </span>
                                    )
                                  ) : (
                                    <span className="inline-flex items-center justify-center w-6 h-6 text-slate-300 dark:text-slate-600 font-bold">
                                      —
                                    </span>
                                  )}
                                </td>
                              );
                            })}

                            <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400 border-l border-slate-200 dark:border-slate-700">
                              {studentPresent}
                            </td>

                            <td className="py-2.5 px-3 text-center font-bold text-rose-600 dark:text-rose-400">
                              <span className="text-amber-600">{studentExcused}</span> / {studentUnexcused}
                            </td>

                            <td className="py-2.5 px-3 text-center font-black">
                              {studentPresent + studentExcused + studentUnexcused > 0
                                ? `${Math.round(
                                    (studentPresent /
                                      (studentPresent + studentExcused + studentUnexcused)) *
                                      100
                                  )}%`
                                : '100%'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Attendance Table Legend */}
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center space-x-1">
                    <span className="w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold inline-flex items-center justify-center text-xs">
                      ✓
                    </span>
                    <span>Присутствовал</span>
                  </span>

                  <span className="flex items-center space-x-1">
                    <span className="w-5 h-5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold inline-flex items-center justify-center text-xs">
                      Н
                    </span>
                    <span>Неуважительный пропуск</span>
                  </span>

                  <span className="flex items-center space-x-1">
                    <span className="w-5 h-5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold inline-flex items-center justify-center text-xs">
                      У
                    </span>
                    <span>Уважительный пропуск</span>
                  </span>

                  <span className="flex items-center space-x-1">
                    <span className="w-5 h-5 rounded bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 font-bold inline-flex items-center justify-center text-xs">
                      ❄
                    </span>
                    <span>Заморозка</span>
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 italic">
                  💡 Нажмите на любую ячейку в таблице для быстрой смены отметки ученика
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {activeTab === 'STUDENTS'
              ? `Всего в группе: ${enrolledStudents.length} учеников`
              : `Уроков в месяце: ${lessonDatesInMonth.length}`}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-bold text-xs transition-all shadow-xs cursor-pointer"
          >
            Закрыть
          </button>
        </div>

      </div>

      {/* MANDATORY UNENROLL REASON MODAL */}
      {unenrollTargetStudent && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setUnenrollTargetStudent(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Исключение ученика из группы
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ученик: <strong className="text-slate-800 dark:text-slate-200">{unenrollTargetStudent.fullName}</strong>
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmUnenroll} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Укажите обязательную причину исключения: <span className="text-rose-500">*</span>
                </label>

                {/* Common quick reason pills */}
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {COMMON_UNENROLL_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setUnenrollReason(reason)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        unenrollReason === reason
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>

                <textarea
                  required
                  rows={3}
                  value={unenrollReason}
                  onChange={(e) => {
                    setUnenrollReason(e.target.value);
                    if (unenrollError) setUnenrollError('');
                  }}
                  placeholder="Введите причину исключения или выберите из вариантов выше..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />

                {unenrollError && (
                  <p className="text-xs font-bold text-rose-600 mt-1 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{unenrollError}</span>
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    onUnenrollStudent(unenrollTargetStudent.id, course.id, 'Удален навсегда по ошибке', true);
                    setUnenrollTargetStudent(null);
                    setUnenrollReason('');
                    setUnenrollError('');
                  }}
                  className="w-full sm:w-auto px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors cursor-pointer border border-rose-200 dark:border-rose-800 flex items-center justify-center space-x-1.5"
                  title="Окончательно удалить ученика из группы без сохранения в истории исключений"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Удалить навсегда (ошибка)</span>
                </button>

                <div className="w-full sm:w-auto flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setUnenrollTargetStudent(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={!unenrollReason.trim()}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md cursor-pointer ${
                      unenrollReason.trim()
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <UserMinus className="w-4 h-4" />
                    <span>Исключить с причиной</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSFER STUDENT MODAL */}
      {studentToTransfer && onTransferStudent && (
        <TransferStudentModal
          student={studentToTransfer}
          currentCourseId={course.id}
          courses={courses}
          teachers={teachers}
          onClose={() => setStudentToTransfer(null)}
          onTransfer={(studentId, fromCourseId, toCourseId) => {
            onTransferStudent(studentId, fromCourseId, toCourseId);
            setStudentToTransfer(null);
          }}
        />
      )}

      {/* FREEZE STUDENT MODAL (User Request #1) */}
      {freezeModalStudent && onToggleFreezeStudent && (
        <FreezeStudentModal
          student={freezeModalStudent}
          courseId={course.id}
          courseTitle={course.title}
          availableCourses={courses}
          onClose={() => setFreezeModalStudent(null)}
          onToggleFreeze={(studentId, targetCourseId, reason, freezeUntil) => {
            onToggleFreezeStudent(studentId, targetCourseId || course.id, reason, freezeUntil);
            setFreezeModalStudent(null);
          }}
        />
      )}

    </div>
  );
};
