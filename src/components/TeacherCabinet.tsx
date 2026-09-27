import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  UserCheck,
  AlertCircle,
  FileText,
  Check,
  Users,
  Printer,
  ArrowLeft,
  ChevronRight,
  Phone,
  BookOpen,
  ArrowRightLeft,
  Snowflake,
  Sun,
  Bell,
  BellRing,
  Smartphone,
  ShieldAlert,
  Sparkles,
  Info,
  ChevronDown,
} from 'lucide-react';
import {
  TeacherProfile,
  Course,
  Cabinet,
  Student,
  AttendanceRecord,
  AbsenceCategory,
  ExcusedReasonType,
} from '../types';
import { formatDateRU } from '../lib/billingLogic';
import {
  getUzbekistanToday,
  getUzbekistanISOString,
  isStudentFrozenOnDate,
  isStudentFrozenInCourse,
} from '../lib/dateUtils';
import { formatDisplayPhone } from '../lib/phoneUtils';
import { sortStudentsAlphabetically } from '../lib/sortingUtils';
import { AbsenceReportModal } from './AbsenceReportModal';
import { TransferStudentModal } from './TransferStudentModal';
import { FreezeStudentModal } from './FreezeStudentModal';

interface TeacherCabinetProps {
  teacher: TeacherProfile;
  courses: Course[];
  cabinets?: Cabinet[];
  students: Student[];
  attendanceRecords: AttendanceRecord[];
  onSaveAttendance?: (records: Partial<AttendanceRecord>[]) => void;
  teachers?: TeacherProfile[];
  onSelectTeacher?: (teacherId: string) => void;
  onTransferStudent?: (studentId: string, fromCourseId: string, toCourseId: string) => void;
  onToggleFreezeStudent?: (studentId: string, courseId?: string, reason?: string, freezeUntil?: string) => void;
}

export const TeacherCabinet: React.FC<TeacherCabinetProps> = ({
  teacher,
  courses,
  cabinets = [],
  students,
  attendanceRecords,
  onSaveAttendance,
  teachers,
  onSelectTeacher,
  onTransferStudent,
  onToggleFreezeStudent,
}) => {
  // Courses belonging to current teacher
  const teacherCourses = courses.filter(
    (c) =>
      c.teacherId === teacher.id ||
      c.teacherId === teacher.userId ||
      (c.teacherId && teacher.id && c.teacherId.trim() === teacher.id.trim())
  );

  // Determine current day & parity in Uzbekistan
  const todayDateStr = useMemo(() => getUzbekistanToday(), []);
  const todayDayInfo = useMemo(() => {
    const todayIndex = new Date().getDay(); // 0: ВС, 1: ПН, 2: ВТ, 3: СР, 4: ЧТ, 5: ПТ, 6: СБ
    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const dayCodes = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
    const isOdd = todayIndex === 1 || todayIndex === 3 || todayIndex === 5;
    const isEven = todayIndex === 2 || todayIndex === 4 || todayIndex === 6;

    return {
      index: todayIndex,
      name: dayNames[todayIndex] || 'Понедельник',
      code: dayCodes[todayIndex] || 'ПН',
      isOdd,
      isEven,
      parityLabel: isOdd ? 'Нечетный день (ПН, СР, ПТ)' : isEven ? 'Четный день (ВТ, ЧТ, СБ)' : 'Воскресенье',
    };
  }, []);

  // Parity Day Filter for Teacher Cabinet (Defaults to TODAY_PARITY on entrance)
  const [dayFilter, setDayFilter] = useState<'TODAY_PARITY' | 'ODD' | 'EVEN' | 'ALL'>('TODAY_PARITY');

  // Selected course ID. If null -> Shows Group Selection Grid
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'rollcall' | 'history'>('rollcall');
  const [selectedDate, setSelectedDate] = useState<string>(() => getUzbekistanToday());

  // Notification states
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem(`notif_teacher_${teacher.id}`) !== 'false';
  });
  const [lastReminderTimestamp, setLastReminderTimestamp] = useState<string | null>(null);
  const [showNotifSettingsModal, setShowNotifSettingsModal] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);

  // Filtered courses based on Day Parity selection
  const displayedCourses = useMemo(() => {
    if (dayFilter === 'ALL') {
      return teacherCourses;
    }
    if (dayFilter === 'ODD') {
      return teacherCourses.filter((c) =>
        c.daysOfWeek.some((d) => ['ПН', 'СР', 'ПТ'].includes(d))
      );
    }
    if (dayFilter === 'EVEN') {
      return teacherCourses.filter((c) =>
        c.daysOfWeek.some((d) => ['ВТ', 'ЧТ', 'СБ'].includes(d))
      );
    }
    // 'TODAY_PARITY': If today is odd -> show odd; if even -> show even; else show all
    if (todayDayInfo.isOdd) {
      return teacherCourses.filter((c) =>
        c.daysOfWeek.some((d) => ['ПН', 'СР', 'ПТ'].includes(d))
      );
    }
    if (todayDayInfo.isEven) {
      return teacherCourses.filter((c) =>
        c.daysOfWeek.some((d) => ['ВТ', 'ЧТ', 'СБ'].includes(d))
      );
    }
    return teacherCourses;
  }, [teacherCourses, dayFilter, todayDayInfo]);

  // Unmarked courses for today (to send 30-min reminders)
  const unmarkedCoursesToday = useMemo(() => {
    return teacherCourses.filter((crs) => {
      // Is course scheduled for today?
      const isScheduledToday = crs.daysOfWeek.includes(todayDayInfo.code);
      if (!isScheduledToday) return false;

      // Has attendance been saved for today?
      const enrolled = students.filter((s) => s.enrolledCourseIds.includes(crs.id));
      const marked = attendanceRecords.filter(
        (r) => r.courseId === crs.id && r.date === todayDateStr
      );

      // Overdue if not all students are marked
      return marked.length < enrolled.length || enrolled.length === 0;
    });
  }, [teacherCourses, students, attendanceRecords, todayDayInfo, todayDateStr]);

  // Modals for student transfer and freeze
  const [transferModalStudent, setTransferModalStudent] = useState<Student | null>(null);
  const [freezeModalStudent, setFreezeModalStudent] = useState<Student | null>(null);

  // Currently selected course object
  const currentCourse = teacherCourses.find((c) => c.id === selectedCourseId);

  // Enrolled students for current selected course (sorted alphabetically)
  const courseStudents = useMemo(() => {
    if (!selectedCourseId) return [];
    return sortStudentsAlphabetically(
      students.filter((s) => s.enrolledCourseIds.includes(selectedCourseId))
    );
  }, [selectedCourseId, students]);

  // Roll call state map
  const [rollCallState, setRollCallState] = useState<
    Record<
      string,
      {
        status: 'PRESENT' | 'ABSENT';
        absenceCategory?: AbsenceCategory;
        excusedReason?: ExcusedReasonType;
        otherReasonText?: string;
      }
    >
  >({});

  // Ref to track which course & date the rollCallState was initialized for
  const activeCourseDateRef = useRef<string>('');

  // Sync roll call state when selectedCourseId or selectedDate changes.
  // CRITICAL FIX: Never overwrite in-progress student marks when background sync or attendanceRecords update!
  useEffect(() => {
    if (!selectedCourseId) {
      activeCourseDateRef.current = '';
      return;
    }

    const currentKey = `${selectedCourseId}_${selectedDate}`;
    const isNewCourseOrDate = activeCourseDateRef.current !== currentKey;
    const enrolledStudents = students.filter((s) => s.enrolledCourseIds.includes(selectedCourseId));

    if (isNewCourseOrDate) {
      // First time entering this course & date: initialize full roll call state from existing records
      activeCourseDateRef.current = currentKey;
      const initialState: Record<string, any> = {};

      enrolledStudents.forEach((st) => {
        const existing = attendanceRecords.find(
          (r) =>
            r.courseId === selectedCourseId &&
            r.studentId === st.id &&
            r.date === selectedDate
        );

        if (existing) {
          initialState[st.id] = {
            status: existing.status,
            absenceCategory: existing.absenceCategory,
            excusedReason: existing.excusedReason,
            otherReasonText: existing.otherReasonText,
          };
        } else {
          initialState[st.id] = { status: 'PRESENT' };
        }
      });

      setRollCallState(initialState);
    } else {
      // If we are ALREADY inside this course & date:
      // NEVER wipe out existing student marks in rollCallState!
      // Only supplement any newly enrolled student who is missing from rollCallState.
      setRollCallState((prev) => {
        let hasNewStudents = false;
        const updated = { ...prev };

        enrolledStudents.forEach((st) => {
          if (!updated[st.id]) {
            hasNewStudents = true;
            const existing = attendanceRecords.find(
              (r) =>
                r.courseId === selectedCourseId &&
                r.studentId === st.id &&
                r.date === selectedDate
            );
            updated[st.id] = existing
              ? {
                  status: existing.status,
                  absenceCategory: existing.absenceCategory,
                  excusedReason: existing.excusedReason,
                  otherReasonText: existing.otherReasonText,
                }
              : { status: 'PRESENT' };
          }
        });

        return hasNewStudents ? updated : prev;
      });
    }
  }, [selectedCourseId, selectedDate, attendanceRecords, students]);

  // Quick Action Modal for ergonomic student attendance marking (4 choices)
  const [quickActionStudent, setQuickActionStudent] = useState<Student | null>(null);
  const [quickActionStep, setQuickActionStep] = useState<'CHOICES' | 'EXCUSED_TEMPLATE'>('CHOICES');
  const [quickExcusedReason, setQuickExcusedReason] = useState<ExcusedReasonType>('SICK');
  const [quickOtherReasonText, setQuickOtherReasonText] = useState('');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // -------------------------------------------------------------
  // RECURRING 30-MINUTE TEACHER REMINDER NOTIFICATION SYSTEM
  // -------------------------------------------------------------
  const fireNotificationReminder = (isTest = false) => {
    if (unmarkedCoursesToday.length === 0 && !isTest) return;

    const now = new Date();
    const timeString = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    setLastReminderTimestamp(timeString);
    setReminderCount((c) => c + 1);

    // Browser / Phone Push Notification
    if ('Notification' in window && Notification.permission === 'granted' && notificationsEnabled) {
      const courseTitles = isTest
        ? 'Тестовый урок'
        : unmarkedCoursesToday.map((c) => c.title).join(', ');

      try {
        new Notification('🔔 Внимание: Урок не отмечен!', {
          body: `Преподаватель ${teacher.fullName}, вы не заполнили перекличку за сегодня (${courseTitles}). Пожалуйста, отметьте посещаемость!`,
          icon: '/favicon.ico',
          tag: 'teacher-attendance-reminder',
        });
      } catch (err) {
        console.log('Push notification error:', err);
      }
    }
  };

  // Request notification permissions
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem(`notif_teacher_${teacher.id}`, 'true');
        fireNotificationReminder(true);
        alert('Уведомления успешно подключены! Каждые 30 минут вам будет приходить пуш-напоминание на телефон/браузер, если урок не отмечен.');
      } else {
        alert('Разрешение на уведомления отклонено. Пожалуйста, разрешите уведомления в настройках браузера/телефона.');
      }
    } else {
      alert('Ваш браузер не поддерживает Push-уведомления.');
    }
  };

  // Every 30 minutes interval for unmarked lessons
  useEffect(() => {
    if (!notificationsEnabled) return;

    // Check on mount (slight delay)
    const initialTimer = setTimeout(() => {
      if (unmarkedCoursesToday.length > 0) {
        fireNotificationReminder();
      }
    }, 4000);

    // 30 minute interval (30 * 60 * 1000 ms)
    const interval = setInterval(() => {
      if (unmarkedCoursesToday.length > 0) {
        fireNotificationReminder();
      }
    }, 30 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [unmarkedCoursesToday, notificationsEnabled]);

  // Attendance handlers with immediate persistence and local state update
  const handleToggleStatus = (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    const isPresent = status === 'PRESENT';
    const recordPayload: Partial<AttendanceRecord> = {
      date: selectedDate,
      courseId: selectedCourseId!,
      studentId,
      teacherId: teacher.id,
      status,
      absenceCategory: isPresent ? undefined : 'UNEXCUSED',
      excusedReason: undefined,
      otherReasonText: undefined,
      markedAt: getUzbekistanISOString(),
    };

    setRollCallState((prev) => ({
      ...prev,
      [studentId]: isPresent
        ? { status: 'PRESENT' }
        : { status: 'ABSENT', absenceCategory: 'UNEXCUSED' },
    }));

    if (selectedCourseId) {
      onSaveAttendance?.([recordPayload]);
    }
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, any> = {};
    const recordsToSave: Partial<AttendanceRecord>[] = [];
    const isoNow = getUzbekistanISOString();

    courseStudents.forEach((st) => {
      updated[st.id] = { status: 'PRESENT' };
      if (selectedCourseId) {
        recordsToSave.push({
          date: selectedDate,
          courseId: selectedCourseId,
          studentId: st.id,
          teacherId: teacher.id,
          status: 'PRESENT',
          absenceCategory: undefined,
          excusedReason: undefined,
          otherReasonText: undefined,
          markedAt: isoNow,
        });
      }
    });

    setRollCallState(updated);
    if (recordsToSave.length > 0) {
      onSaveAttendance?.(recordsToSave);
    }
  };

  const handleOpenStudentActionModal = (st: Student) => {
    setQuickActionStudent(st);
    setQuickActionStep('CHOICES');
    const cur = rollCallState[st.id];
    if (cur?.excusedReason) {
      setQuickExcusedReason(cur.excusedReason);
      setQuickOtherReasonText(cur.otherReasonText || '');
    } else {
      setQuickExcusedReason('SICK');
      setQuickOtherReasonText('');
    }
  };

  // Choice 1: "Без причины" (Immediately saves and closes modal)
  const handleSelectUnexcused = (studentId: string) => {
    const recordPayload: Partial<AttendanceRecord> = {
      date: selectedDate,
      courseId: selectedCourseId!,
      studentId,
      teacherId: teacher.id,
      status: 'ABSENT',
      absenceCategory: 'UNEXCUSED',
      excusedReason: undefined,
      otherReasonText: undefined,
      markedAt: getUzbekistanISOString(),
    };

    setRollCallState((prev) => ({
      ...prev,
      [studentId]: {
        status: 'ABSENT',
        absenceCategory: 'UNEXCUSED',
      },
    }));

    if (selectedCourseId) {
      onSaveAttendance?.([recordPayload]);
    }
    setQuickActionStudent(null);
  };

  // Choice 2: "С причиной" confirmation (Saves and closes modal)
  const handleConfirmQuickExcused = (studentId: string) => {
    const recordPayload: Partial<AttendanceRecord> = {
      date: selectedDate,
      courseId: selectedCourseId!,
      studentId,
      teacherId: teacher.id,
      status: 'ABSENT',
      absenceCategory: 'EXCUSED',
      excusedReason: quickExcusedReason,
      otherReasonText: quickExcusedReason === 'OTHER' ? quickOtherReasonText.trim() : undefined,
      markedAt: getUzbekistanISOString(),
    };

    setRollCallState((prev) => ({
      ...prev,
      [studentId]: {
        status: 'ABSENT',
        absenceCategory: 'EXCUSED',
        excusedReason: quickExcusedReason,
        otherReasonText: quickExcusedReason === 'OTHER' ? quickOtherReasonText.trim() : undefined,
      },
    }));

    if (selectedCourseId) {
      onSaveAttendance?.([recordPayload]);
    }
    setQuickActionStudent(null);
  };

  // Choice 3: "Перевод в другую группу"
  const handleSelectTransfer = (st: Student) => {
    setQuickActionStudent(null);
    setTransferModalStudent(st);
  };

  // Choice 4: "Заморозка"
  const handleSelectFreeze = (st: Student) => {
    setQuickActionStudent(null);
    setFreezeModalStudent(st);
  };

  // Revert back to Present
  const handleSelectPresent = (studentId: string) => {
    const recordPayload: Partial<AttendanceRecord> = {
      date: selectedDate,
      courseId: selectedCourseId!,
      studentId,
      teacherId: teacher.id,
      status: 'PRESENT',
      absenceCategory: undefined,
      excusedReason: undefined,
      otherReasonText: undefined,
      markedAt: getUzbekistanISOString(),
    };

    setRollCallState((prev) => ({
      ...prev,
      [studentId]: {
        status: 'PRESENT',
      },
    }));

    if (selectedCourseId) {
      onSaveAttendance?.([recordPayload]);
    }
    setQuickActionStudent(null);
  };

  const handleSaveRollCall = () => {
    if (!selectedCourseId) return;

    const newRecords: Partial<AttendanceRecord>[] = courseStudents
      .filter((st) => rollCallState[st.id] !== undefined)
      .map((st) => {
        const state = rollCallState[st.id];
        return {
          date: selectedDate,
          courseId: selectedCourseId,
          studentId: st.id,
          teacherId: teacher.id,
          status: state.status,
          absenceCategory: state.absenceCategory,
          excusedReason: state.excusedReason,
          otherReasonText: state.otherReasonText,
          markedAt: getUzbekistanISOString(),
        };
      });

    onSaveAttendance?.(newRecords);
    alert('Перекличка группы успешно сохранена!');
    // Redirect immediately to main screen showing all groups
    setSelectedCourseId(null);
  };

  const handleSetToday = () => {
    setSelectedDate(todayDateStr);
  };

  const rollCallValues = Object.values(rollCallState) as { status: 'PRESENT' | 'ABSENT' }[];
  const presentCount = rollCallValues.filter((s) => s.status === 'PRESENT').length;
  const absentCount = rollCallValues.filter((s) => s.status === 'ABSENT').length;

  return (
    <div className="space-y-4 sm:space-y-5 pb-20 sm:pb-8">
      
      {/* 30-MINUTE UNMARKED LESSON ALERT BANNER (Compact & Minimalist) */}
      {unmarkedCoursesToday.length > 0 && (
        <div className="bg-amber-500 text-slate-950 p-2.5 sm:p-3 rounded-xl shadow-sm border border-amber-400 flex flex-col xs:flex-row items-stretch xs:items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="p-1.5 bg-slate-950 text-amber-400 rounded-lg shrink-0 animate-pulse">
              <BellRing className="w-4 h-4" />
            </div>
            <div className="min-w-0 text-xs flex-1">
              <div className="flex items-center space-x-1.5 flex-wrap">
                <span className="font-black">
                  Не отмечен урок!
                </span>
                <span className="bg-slate-950 text-amber-300 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                  {unmarkedCoursesToday.length} гр.
                </span>
              </div>
              <p className="text-[11px] text-slate-900 truncate font-medium">
                {unmarkedCoursesToday.map((c) => c.title).join(', ')}
                {lastReminderTimestamp && (
                  <span className="ml-1 opacity-75">({lastReminderTimestamp})</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0 self-end xs:self-auto">
            <button
              type="button"
              onClick={() => {
                setSelectedCourseId(unmarkedCoursesToday[0].id);
                setSelectedDate(todayDateStr);
              }}
              className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 text-amber-400 font-bold text-xs rounded-lg shadow-xs transition-all flex items-center space-x-1 cursor-pointer active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Заполнить</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNotifSettingsModal(true)}
              className="p-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-slate-950 font-bold rounded-lg transition-all cursor-pointer"
              title="Настройки напоминаний"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TEACHER PROFILE BAR (Compact Minimalist Header) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 sm:p-3.5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 font-black text-xs sm:text-base flex items-center justify-center shrink-0 shadow-inner">
            {teacher.fullName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-1.5 flex-wrap">
              <h1 className="text-sm sm:text-base font-black tracking-tight truncate">
                {teacher.fullName}
              </h1>
              <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                {teacher.subject}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
              {teacher.phone && (
                <span className="font-mono text-slate-300 flex items-center space-x-1">
                  <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>{formatDisplayPhone(teacher.phone)}</span>
                </span>
              )}
              <span className="text-slate-600">•</span>
              <span>
                Групп: <strong className="text-white">{teacherCourses.length}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Group Switcher & Notification Button */}
        <div className="flex items-center space-x-1.5 shrink-0 w-full sm:w-auto">
          <select
            value={selectedCourseId || ''}
            onChange={(e) => setSelectedCourseId(e.target.value || null)}
            className="flex-1 sm:flex-initial bg-slate-800 text-white font-bold text-xs rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer sm:max-w-[240px] truncate"
          >
            <option value="">-- Все группы ({teacherCourses.length}) --</option>
            {teacherCourses.map((c, idx) => (
              <option key={`${c.id}-${idx}`} value={c.id}>
                {c.title} ({c.daysOfWeek.join('/')})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowNotifSettingsModal(true)}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer shrink-0 ${
              notificationsEnabled
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
            }`}
            title="Уведомления на телефон"
          >
            <Bell className="w-3.5 h-3.5 text-emerald-400" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          </button>
        </div>
      </div>

      {/* COMPACT SEGMENTED TABS & DATE TOOLBAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-100/90 dark:bg-slate-900/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
        
        {/* Tab 1: Rollcall vs Tab 2: History */}
        <div className="flex items-center space-x-1 bg-slate-200/70 dark:bg-slate-800/80 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('rollcall')}
            className={`flex items-center justify-center space-x-1.5 flex-1 sm:flex-initial px-3 py-1.5 rounded-md font-extrabold text-xs transition-all cursor-pointer ${
              activeTab === 'rollcall'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Перекличка</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center justify-center space-x-1.5 flex-1 sm:flex-initial px-3 py-1.5 rounded-md font-extrabold text-xs transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>История</span>
          </button>
        </div>

        {/* Date Selector for Rollcall */}
        {activeTab === 'rollcall' && (
          <div className="flex items-center justify-between sm:justify-start space-x-1.5 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 font-bold text-xs focus:outline-none cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={handleSetToday}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer shrink-0 ${
                selectedDate === todayDateStr
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Сегодня
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: ROLLCALL */}
      {activeTab === 'rollcall' && (
        <>
          {/* GROUP SELECTION GRID (Shown when no specific course is selected) */}
          {!selectedCourseId ? (
            <div className="space-y-3">
              
              {/* COMPACT TOGGLE BAR: СЕГОДНЯ / ВСЕ ДНИ */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-2xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-1.5 sm:space-x-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    График:
                  </span>
                  
                  {/* Кнопка "Сегодня" */}
                  <button
                    type="button"
                    onClick={() => setDayFilter('TODAY_PARITY')}
                    className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer ${
                      dayFilter === 'TODAY_PARITY'
                        ? 'bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-950 shrink-0" />
                    <span className="hidden sm:inline">
                      Сегодня ({todayDayInfo.name} {todayDayInfo.isOdd ? 'ПН,СР,ПТ' : todayDayInfo.isEven ? 'ВТ,ЧТ,СБ' : ''})
                    </span>
                    <span className="sm:hidden">
                      Сегодня ({todayDayInfo.isOdd ? 'ПН,СР,ПТ' : todayDayInfo.isEven ? 'ВТ,ЧТ,СБ' : ''})
                    </span>
                  </button>

                  {/* Кнопка "Все дни" */}
                  <button
                    type="button"
                    onClick={() => setDayFilter('ALL')}
                    className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer ${
                      dayFilter === 'ALL'
                        ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-500'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>Все дни ({teacherCourses.length})</span>
                  </button>
                </div>

                <span className="text-xs text-slate-500 font-bold px-1 hidden sm:inline">
                  Групп: <strong className="text-slate-900 dark:text-white font-black">{displayedCourses.length}</strong> из {teacherCourses.length}
                </span>
              </div>

              {/* Group Cards Header */}
              <div className="flex items-center justify-between text-xs sm:text-sm px-1 pt-0.5">
                <span className="font-black text-slate-900 dark:text-white text-base sm:text-lg">
                  Мои группы ({displayedCourses.length})
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-bold text-xs">
                  Нажмите на группу для отметки учеников
                </span>
              </div>

              {displayedCourses.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 shadow-2xs">
                  <BookOpen className="w-8 h-8 mx-auto text-slate-400 mb-1.5" />
                  <p className="text-xs font-bold">В этом графике у вас уроков нет.</p>
                  <button
                    type="button"
                    onClick={() => setDayFilter('ALL')}
                    className="mt-2 px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-lg cursor-pointer hover:bg-indigo-100"
                  >
                    Показать все мои группы ({teacherCourses.length})
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {displayedCourses.map((crs, idx) => {
                    const enrolledCount = students.filter((s) =>
                      s.enrolledCourseIds.includes(crs.id)
                    ).length;

                    // Check if attendance is already saved for this group on selectedDate
                    const markedForCourse = attendanceRecords.filter(
                      (r) => r.courseId === crs.id && r.date === selectedDate
                    );
                    const isFullyMarked = markedForCourse.length >= enrolledCount && enrolledCount > 0;
                    const isOddCourse = crs.daysOfWeek.some((d) => ['ПН', 'СР', 'ПТ'].includes(d));

                    // Accurate Cabinet label resolver
                    const formatCabinet = (cabId?: string) => {
                      if (!cabId) return null;
                      const found = cabinets.find(
                        (c) =>
                          c.id === cabId ||
                          c.id.toLowerCase() === cabId.toLowerCase() ||
                          c.roomNumber === cabId ||
                          c.name === cabId
                      );
                      if (found) {
                        return found.roomNumber + (found.name ? ` (${found.name})` : '');
                      }
                      if (cabId.startsWith('cab-') || cabId.startsWith('c-')) {
                        const num = cabId.replace(/\D/g, '');
                        return num ? `Кабинет № ${num}` : `Кабинет`;
                      }
                      return cabId.startsWith('Кабинет') || cabId.startsWith('Каб') ? cabId : `Каб: ${cabId}`;
                    };
                    const cabLabel = formatCabinet(crs.cabinetId);

                    return (
                      <div
                        key={`${crs.id}-${idx}`}
                        onClick={() => setSelectedCourseId(crs.id)}
                        className="bg-white dark:bg-slate-900 border-2 border-slate-200/90 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3.5 active:scale-[0.99]"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors tracking-tight">
                              {crs.title}
                            </h3>
                            <span
                              className={`px-2.5 py-1 font-black text-xs rounded-lg shrink-0 ${
                                isOddCourse
                                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              }`}
                            >
                              {isOddCourse ? 'ПН/СР/ПТ' : 'ВТ/ЧТ/СБ'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:text-base text-slate-700 dark:text-slate-200 font-bold">
                            <span className="flex items-center space-x-1.5">
                              <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                              <strong className="text-slate-900 dark:text-white font-black text-sm sm:text-base">
                                {crs.startTime} - {crs.endTime}
                              </strong>
                            </span>
                            <span className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300">
                              <Users className="w-4 h-4 text-slate-400 shrink-0" />
                              <span>{enrolledCount} уч.</span>
                            </span>
                            {cabLabel && (
                              <span className="flex items-center space-x-1 text-slate-700 dark:text-slate-200 font-bold text-sm sm:text-base">
                                <span>🏛️</span>
                                <span>{cabLabel}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Footer Status Bar & Action */}
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                          {isFullyMarked ? (
                            <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-extrabold text-xs rounded-lg flex items-center space-x-1">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Отмечено</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-extrabold text-xs rounded-lg flex items-center space-x-1">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>Не отмечен</span>
                            </span>
                          )}

                          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform flex items-center space-x-1">
                            <span>Перейти</span>
                            <ChevronRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* STEP 2: ROLL CALL FOR SELECTED GROUP (Compact Minimalist View) */
            <div className="space-y-3">
              
              {/* Back button & Group Header Banner */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-2xs space-y-2">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedCourseId(null)}
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-lg flex items-center space-x-1 transition-all shrink-0 active:scale-95 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Назад</span>
                    </button>

                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                        {currentCourse?.title}
                      </h2>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-bold truncate mt-0.5">
                        {currentCourse?.daysOfWeek.join(', ')} • {currentCourse?.startTime}-{currentCourse?.endTime} • {courseStudents.length} уч.
                        {(() => {
                          if (!currentCourse?.cabinetId) return '';
                          const found = cabinets.find(
                            (c) =>
                              c.id === currentCourse.cabinetId ||
                              c.id.toLowerCase() === currentCourse.cabinetId.toLowerCase() ||
                              c.roomNumber === currentCourse.cabinetId ||
                              c.name === currentCourse.cabinetId
                          );
                          const name = found
                            ? found.roomNumber + (found.name ? ` (${found.name})` : '')
                            : currentCourse.cabinetId.startsWith('cab-') || currentCourse.cabinetId.startsWith('c-')
                            ? `Кабинет № ${currentCourse.cabinetId.replace(/\D/g, '')}`
                            : currentCourse.cabinetId;
                          return name ? ` • 🏛️ ${name}` : '';
                        })()}
                      </p>
                    </div>
                  </div>

                  {/* Top Action Buttons */}
                  <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={handleMarkAllPresent}
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-lg transition-all hidden md:flex items-center space-x-1 cursor-pointer"
                      title="Отметить всех присутствующими"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Все "Присутствовал"</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPrintModalOpen(true)}
                      className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-lg transition-all flex items-center space-x-1 cursor-pointer"
                      title="Распечатать рапорт"
                    >
                      <Printer className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="hidden sm:inline">Рапорт</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveRollCall}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg shadow-xs transition-all flex items-center space-x-1.5 active:scale-95 cursor-pointer"
                      title="Сохранить и вернуться ко всем группам"
                    >
                      <Check className="w-4 h-4" />
                      <span>Готово</span>
                    </button>
                  </div>
                </div>

                {/* Counter Summary Pills */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-1.5 text-xs">
                  <div className="flex items-center space-x-1.5">
                    <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-[11px] rounded-md flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Присутствуют: {presentCount}</span>
                    </span>

                    <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold text-[11px] rounded-md flex items-center space-x-1">
                      <XCircle className="w-3 h-3 text-rose-600" />
                      <span>Отсутствуют: {absentCount}</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleMarkAllPresent}
                    className="text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:underline cursor-pointer"
                  >
                    Все присутствуют
                  </button>
                </div>
              </div>

              {/* STUDENTS ROLL CALL LIST */}
              {courseStudents.length === 0 ? (
                <div className="p-6 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 shadow-2xs">
                  <Users className="w-8 h-8 mx-auto text-slate-400 mb-1.5" />
                  <p className="text-xs font-bold">В этой группе пока нет зачисленных учеников.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {courseStudents.map((st, idx) => {
                    const state = rollCallState[st.id] || { status: 'PRESENT' };
                    const isPresent = state.status === 'PRESENT';
                    const isAbsent = state.status === 'ABSENT';
                    const isFrozen = isStudentFrozenInCourse(st, selectedCourseId || undefined);
                    const isFrozenToday = isStudentFrozenOnDate(st, selectedDate, selectedCourseId || undefined);

                    return (
                      <div
                        key={st.id}
                        className={`bg-white dark:bg-slate-900 border rounded-xl p-2.5 sm:p-3 shadow-2xs transition-all ${
                          isFrozenToday || isFrozen
                            ? 'border-cyan-300 dark:border-cyan-800 bg-cyan-50/20'
                            : isPresent
                            ? 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'
                            : state.absenceCategory === 'EXCUSED'
                            ? 'border-amber-300 dark:border-amber-800 bg-amber-50/20'
                            : 'border-rose-300 dark:border-rose-800 bg-rose-50/20'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          
                          {/* Student Info & Contacts */}
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center space-x-1.5 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                                  {st.fullName}
                                </h4>
                                {(isFrozenToday || isFrozen) && (
                                  <span
                                    className="px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-[9px] font-extrabold flex items-center space-x-0.5 shrink-0"
                                    title={st.freezeReason ? `Причина: ${st.freezeReason}` : 'Ученик заморожен'}
                                  >
                                    <Snowflake className="w-2.5 h-2.5 text-cyan-600 dark:text-cyan-400" />
                                    <span>Заморожен</span>
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {st.phone && (
                                  <a
                                    href={`tel:${st.phone}`}
                                    className="hover:text-indigo-600 font-mono font-bold"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {formatDisplayPhone(st.phone)}
                                  </a>
                                )}
                                {(st.fatherPhone || st.motherPhone) && (
                                  <span className="text-slate-400 font-mono font-medium">
                                    Род: {formatDisplayPhone(st.fatherPhone || st.motherPhone || '')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* COMPACT STATUS BUTTON (OPENS THE 4-OPTION ACTION WINDOW) */}
                          <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-auto">
                            {isFrozenToday || isFrozen ? (
                              <button
                                type="button"
                                onClick={() => handleOpenStudentActionModal(st)}
                                className="px-3 py-1.5 rounded-xl bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 font-bold text-xs flex items-center space-x-1.5 shadow-2xs hover:bg-cyan-200 dark:hover:bg-cyan-900 cursor-pointer transition-all active:scale-95"
                                title="Ученик заморожен. Нажмите для меню действий"
                              >
                                <Snowflake className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                                <span>Заморожен</span>
                                <ChevronDown className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                              </button>
                            ) : isPresent ? (
                              <button
                                type="button"
                                onClick={() => handleOpenStudentActionModal(st)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer transition-all active:scale-95"
                                title="Присутствует. Нажмите для отметки пропуска, перевода или заморозки"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                                <span>Присутствует</span>
                                <ChevronDown className="w-3 h-3 text-emerald-200" />
                              </button>
                            ) : state.absenceCategory === 'EXCUSED' ? (
                              <button
                                type="button"
                                onClick={() => handleOpenStudentActionModal(st)}
                                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer transition-all active:scale-95"
                                title="Уважительная причина. Нажмите для изменения"
                              >
                                <AlertCircle className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                                <span className="truncate max-w-[130px] sm:max-w-[200px]">
                                  {state.excusedReason === 'SICK'
                                    ? 'Заболел'
                                    : state.excusedReason === 'TRAVELED_TO_REGION'
                                    ? 'Уехал в район'
                                    : state.excusedReason === 'EXAM'
                                    ? 'Экзамен'
                                    : state.excusedReason === 'FAMILY_CIRCUMSTANCES'
                                    ? 'Семья'
                                    : state.otherReasonText || 'С причиной'}
                                </span>
                                <ChevronDown className="w-3 h-3 text-slate-950" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenStudentActionModal(st)}
                                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer transition-all active:scale-95"
                                title="Без причины. Нажмите для изменения"
                              >
                                <XCircle className="w-3.5 h-3.5 text-rose-200" />
                                <span>Без причины</span>
                                <ChevronDown className="w-3 h-3 text-rose-200" />
                              </button>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* BOTTOM COMPLETION BAR */}
              {courseStudents.length > 0 && (
                <div className="pt-4 pb-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                    Итог группы: <strong className="text-emerald-600 dark:text-emerald-400">{presentCount} присутствуют</strong>, <strong className="text-rose-600 dark:text-rose-400">{absentCount} отсутствуют</strong>
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveRollCall}
                    className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    <span>Готово (Сохранить отметку)</span>
                  </button>
                </div>
              )}

              {/* FIXED MOBILE BOTTOM SAVE ACTION BAR */}
              <div className="fixed bottom-0 left-0 right-0 p-2.5 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md z-40 sm:hidden flex items-center justify-between gap-2 shadow-2xl">
                <div className="text-white text-xs min-w-0">
                  <p className="font-extrabold truncate">{currentCourse?.title}</p>
                  <p className="text-[10px] text-emerald-400 font-medium">✓ {presentCount} • ✕ {absentCount}</p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveRollCall}
                  className="px-4 py-2 bg-emerald-600 active:bg-emerald-500 text-white font-black text-xs rounded-lg shadow-md flex items-center space-x-1 shrink-0 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Готово</span>
                </button>
              </div>

            </div>
          )}
        </>
      )}

      {/* TAB 2: ATTENDANCE HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 text-white">
          <h2 className="text-sm font-bold flex items-center space-x-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Журнал посещаемости преподавателя ({teacher.fullName})</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Дата</th>
                  <th className="py-3 px-4">Курс</th>
                  <th className="py-3 px-4">Ученик</th>
                  <th className="py-3 px-4">Статус</th>
                  <th className="py-3 px-4">Тип Пропуска</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {attendanceRecords
                  .filter((r) => teacherCourses.some((c) => c.id === r.courseId))
                  .map((rec) => {
                    const st = students.find((s) => s.id === rec.studentId);
                    const crs = courses.find((c) => c.id === rec.courseId);
                    const isFrozenOnRecDate = isStudentFrozenOnDate(st, rec.date, rec.courseId);

                    return (
                      <tr key={rec.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono">{formatDateRU(rec.date)}</td>
                        <td className="py-3 px-4 font-semibold text-white">{crs?.title}</td>
                        <td className="py-3 px-4 font-bold">
                          <span>{st?.fullName}</span>
                          {isFrozenOnRecDate && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-extrabold inline-flex items-center space-x-1">
                              <Snowflake className="w-2.5 h-2.5 text-cyan-400" />
                              <span>Заморожен</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isFrozenOnRecDate ? (
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-[11px] border border-cyan-500/30 inline-flex items-center space-x-1">
                              <Snowflake className="w-3 h-3 text-cyan-400" />
                              <span>Заморожен</span>
                            </span>
                          ) : rec.status === 'PRESENT' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[11px] border border-emerald-500/30">
                              Присутствовал
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold text-[11px] border border-rose-500/30">
                              Отсутствовал
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isFrozenOnRecDate ? (
                            <span className="text-cyan-300 font-medium">
                              Заморозка{st?.freezeReason ? `: ${st.freezeReason}` : ''} {st?.freezeDate ? `(с ${st.freezeDate})` : ''}
                            </span>
                          ) : rec.status === 'ABSENT' ? (
                            rec.absenceCategory === 'EXCUSED' ? (
                              <span className="text-amber-400 font-medium">
                                Уважительная:{' '}
                                {rec.excusedReason === 'SICK'
                                  ? 'Заболел'
                                  : rec.excusedReason === 'TRAVELED_TO_REGION'
                                  ? 'Уехал в район'
                                  : rec.excusedReason === 'EXAM'
                                  ? 'Экзамен'
                                  : rec.excusedReason === 'FAMILY_CIRCUMSTANCES'
                                  ? 'Семья'
                                  : rec.otherReasonText || 'Другая'}
                              </span>
                            ) : (
                              <span className="text-slate-400">Без причины</span>
                            )
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NOTIFICATION SETTINGS MODAL */}
      {showNotifSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 text-white shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-black">Уведомления на телефон преподавателя</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNotifSettingsModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300">Статус авто-напоминаний:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !notificationsEnabled;
                      setNotificationsEnabled(next);
                      localStorage.setItem(`notif_teacher_${teacher.id}`, String(next));
                    }}
                    className={`px-3 py-1 rounded-lg font-black text-xs transition-all cursor-pointer ${
                      notificationsEnabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {notificationsEnabled ? 'ВКЛЮЧЕНО ✓' : 'ОТКЛЮЧЕНО'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Интервал повтора: <strong>каждые 30 минут</strong> до тех пор, пока урок за сегодня не будет отмечен.
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <span className="font-bold text-slate-300 block">Номер телефона для связи:</span>
                <p className="text-indigo-400 font-mono font-bold text-sm">
                  {teacher.phone || 'Номер не указан в профиле'}
                </p>
                <p className="text-[10px] text-slate-500">
                  Уведомления поступают через Web Push и SMS шлюз центра на мобильных устройствах.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={requestNotificationPermission}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center space-x-1.5"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Включить Push на телефоне</span>
                </button>

                <button
                  type="button"
                  onClick={() => fireNotificationReminder(true)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl cursor-pointer flex items-center space-x-1.5"
                >
                  <Bell className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Тест уведомления</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowNotifSettingsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ACTION MODAL FOR STUDENT ATTENDANCE (4 CHOICES) */}
      {quickActionStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm sm:max-w-md w-full p-4 sm:p-5 text-white shadow-2xl space-y-4 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-mono tracking-wider text-indigo-400 font-bold">
                  {currentCourse?.title || 'Отметка ученика'}
                </p>
                <h3 className="text-base font-black text-white truncate mt-0.5">
                  {quickActionStudent.fullName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Текущий статус:{' '}
                  {(() => {
                    const isFrozen = isStudentFrozenInCourse(quickActionStudent, selectedCourseId || undefined);
                    if (isFrozen) return <span className="text-cyan-300 font-bold">Заморожен</span>;
                    const cur = rollCallState[quickActionStudent.id];
                    if (!cur || cur.status === 'PRESENT') return <span className="text-emerald-400 font-bold">Присутствует</span>;
                    if (cur.absenceCategory === 'EXCUSED') {
                      return (
                        <span className="text-amber-400 font-bold">
                          С причиной (
                          {cur.excusedReason === 'SICK'
                            ? 'Заболел'
                            : cur.excusedReason === 'TRAVELED_TO_REGION'
                            ? 'Уехал в район'
                            : cur.excusedReason === 'EXAM'
                            ? 'Экзамен'
                            : cur.excusedReason === 'FAMILY_CIRCUMSTANCES'
                            ? 'Семья'
                            : cur.otherReasonText || 'Уважительная'}
                          )
                        </span>
                      );
                    }
                    return <span className="text-rose-400 font-bold">Без причины</span>;
                  })()}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setQuickActionStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {quickActionStep === 'CHOICES' ? (
              /* SCREEN 1: 4 MAIN CHOICES */
              <div className="space-y-2.5">
                {/* Option to restore PRESENT if previously marked absent */}
                {rollCallState[quickActionStudent.id]?.status === 'ABSENT' && (
                  <button
                    type="button"
                    onClick={() => handleSelectPresent(quickActionStudent.id)}
                    className="w-full p-2.5 sm:p-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-between cursor-pointer transition-all group active:scale-[0.99]"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-left">
                        <span className="block font-black text-white text-sm">Вернуть: Присутствует</span>
                        <span className="text-[11px] text-emerald-300/80 font-normal">Ученик на занятии</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}

                {/* 1. БЕЗ ПРИЧИНЫ */}
                <button
                  type="button"
                  onClick={() => handleSelectUnexcused(quickActionStudent.id)}
                  className="w-full p-2.5 sm:p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/60 text-white font-bold text-xs flex items-center justify-between cursor-pointer transition-all group active:scale-[0.99]"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                      <XCircle className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="text-left">
                      <span className="block font-black text-rose-300 text-sm">1. Без причины</span>
                      <span className="text-[11px] text-slate-400 font-normal">Не явился без предупреждения</span>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 text-[11px] font-bold shrink-0">
                    В 1 клик
                  </span>
                </button>

                {/* 2. С ПРИЧИНОЙ */}
                <button
                  type="button"
                  onClick={() => setQuickActionStep('EXCUSED_TEMPLATE')}
                  className="w-full p-2.5 sm:p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/60 text-white font-bold text-xs flex items-center justify-between cursor-pointer transition-all group active:scale-[0.99]"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-left">
                      <span className="block font-black text-amber-300 text-sm">2. С причиной</span>
                      <span className="text-[11px] text-slate-400 font-normal">Заболел, уехал в район, экзамен и др.</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* 3. ПЕРЕВОД В ДРУГУЮ ГРУППУ */}
                {onTransferStudent && (
                  <button
                    type="button"
                    onClick={() => handleSelectTransfer(quickActionStudent)}
                    className="w-full p-2.5 sm:p-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-500/60 text-white font-bold text-xs flex items-center justify-between cursor-pointer transition-all group active:scale-[0.99]"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
                        <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="text-left">
                        <span className="block font-black text-indigo-300 text-sm">3. Перевод в другую группу</span>
                        <span className="text-[11px] text-slate-400 font-normal">Перевести в параллель или другой курс</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}

                {/* 4. ЗАМОРОЗКА */}
                {onToggleFreezeStudent && (
                  <button
                    type="button"
                    onClick={() => handleSelectFreeze(quickActionStudent)}
                    className="w-full p-2.5 sm:p-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/60 text-white font-bold text-xs flex items-center justify-between cursor-pointer transition-all group active:scale-[0.99]"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                        <Snowflake className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="text-left">
                        <span className="block font-black text-cyan-300 text-sm">4. Заморозка</span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          {isStudentFrozenInCourse(quickActionStudent, selectedCourseId || undefined)
                            ? 'Ученик заморожен (управление заморозкой)'
                            : 'Приостановить обучение ученика'}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
              </div>
            ) : (
              /* SCREEN 2: EXCUSED REASON TEMPLATES */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">
                    Выберите причину отсутствия:
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuickActionStep('CHOICES')}
                    className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    ← Назад
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'SICK', emoji: '🏥', label: 'Заболел', desc: 'Справка / больничный' },
                    { id: 'TRAVELED_TO_REGION', emoji: '🚗', label: 'Уехал в район', desc: 'Выезд / в отъезде' },
                    { id: 'EXAM', emoji: '📝', label: 'Сдает экзамен', desc: 'В школе / колледже / ВУЗе' },
                    { id: 'FAMILY_CIRCUMSTANCES', emoji: '👨‍👩‍👦', label: 'Семейные обстоятельства', desc: 'По семейным причинам' },
                    { id: 'OTHER', emoji: '✍️', label: 'Другая причина', desc: 'Ввести текст вручную' },
                  ].map((tmpl) => {
                    const isSelected = quickExcusedReason === tmpl.id;
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => setQuickExcusedReason(tmpl.id as ExcusedReasonType)}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-sm ring-1 ring-amber-400'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className="text-base">{tmpl.emoji}</span>
                          <div>
                            <span className="block font-bold text-xs text-white">{tmpl.label}</span>
                            <span className="text-[10px] text-slate-400">{tmpl.desc}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs">
                            ✓
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {quickExcusedReason === 'OTHER' && (
                  <div className="pt-1">
                    <label className="block text-[11px] text-slate-300 font-bold mb-1">
                      Укажите причину:
                    </label>
                    <input
                      type="text"
                      value={quickOtherReasonText}
                      onChange={(e) => setQuickOtherReasonText(e.target.value)}
                      placeholder="Например: Посещение врача"
                      className="w-full bg-slate-950 text-xs text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      autoFocus
                    />
                  </div>
                )}

                {/* ACTION BUTTON: ГОТОВО */}
                <div className="pt-2 flex items-center space-x-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setQuickActionStep('CHOICES')}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmQuickExcused(quickActionStudent.id)}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    <span>Готово</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABSENCE REPORT PRINT MODAL */}
      <AbsenceReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        course={currentCourse || courses[0] || null}
        dateStr={selectedDate}
        teacher={teacher}
        allStudents={students}
        attendanceRecords={attendanceRecords}
      />

      {/* TRANSFER STUDENT MODAL */}
      {transferModalStudent && onTransferStudent && (
        <TransferStudentModal
          student={transferModalStudent}
          currentCourseId={selectedCourseId || undefined}
          courses={courses}
          teachers={teachers || [teacher]}
          userRole="TEACHER"
          teacherProfileId={teacher.id}
          onClose={() => setTransferModalStudent(null)}
          onTransfer={(sId, fromId, toId) => {
            onTransferStudent(sId, fromId, toId);
            setTransferModalStudent(null);
          }}
        />
      )}

      {/* FREEZE / UNFREEZE STUDENT MODAL */}
      {freezeModalStudent && onToggleFreezeStudent && (
        <FreezeStudentModal
          student={freezeModalStudent}
          courseId={selectedCourseId || undefined}
          courseTitle={currentCourse?.title}
          availableCourses={teacherCourses}
          onClose={() => setFreezeModalStudent(null)}
          onToggleFreeze={(sId, targetCourseId, reason, freezeUntil) => {
            onToggleFreezeStudent(sId, targetCourseId || selectedCourseId || undefined, reason, freezeUntil);
            setFreezeModalStudent(null);
          }}
        />
      )}

    </div>
  );
};
