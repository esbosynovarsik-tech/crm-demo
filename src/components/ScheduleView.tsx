import React, { useState, useMemo } from 'react';
import {
  Building2,
  User,
  LayoutGrid,
  List,
  Plus,
  Clock,
  Calendar,
  Users,
  Search,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  DoorClosed,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
  Sparkles,
  Layers,
  Settings,
  Filter,
  Columns,
  SlidersHorizontal,
} from 'lucide-react';
import { Course, Cabinet, TeacherProfile, Student, Enrollment, Subject } from '../types';
import { sortCabinets } from '../lib/sortingUtils';

export interface ScheduleViewProps {
  courses: Course[];
  cabinets: Cabinet[];
  teachers: TeacherProfile[];
  students?: Student[];
  enrollments?: Enrollment[];
  subjects?: Subject[];
  onAddCourse: (course: Course) => void;
  onUpdateCourse: (course: Course) => void;
  onDeleteCourse: (courseId: string) => void;
  onAddCabinet?: (cabinet: Cabinet) => void;
  onOpenAddModalWithPrefill?: (prefill: {
    day: string;
    startTime: string;
    endTime: string;
    cabinetId: string;
    teacherId: string;
  }) => void;
  onOpenEditModal?: (course: Course) => void;
  onOpenStudentsModal?: (course: Course) => void;
}

// 30-minute schedule slots between 08:00 and 21:00
const TIME_SLOTS = [
  { start: '08:00', end: '08:30', label: '08:00 - 08:30' },
  { start: '08:30', end: '09:00', label: '08:30 - 09:00' },
  { start: '09:00', end: '09:30', label: '09:00 - 09:30' },
  { start: '09:30', end: '10:00', label: '09:30 - 10:00' },
  { start: '10:00', end: '10:30', label: '10:00 - 10:30' },
  { start: '10:30', end: '11:00', label: '10:30 - 11:00' },
  { start: '11:00', end: '11:30', label: '11:00 - 11:30' },
  { start: '11:30', end: '12:00', label: '11:30 - 12:00' },
  { start: '12:00', end: '12:30', label: '12:00 - 12:30' },
  { start: '12:30', end: '13:00', label: '12:30 - 13:00' },
  { start: '13:00', end: '13:30', label: '13:00 - 13:30' },
  { start: '13:30', end: '14:00', label: '13:30 - 14:00' },
  { start: '14:00', end: '14:30', label: '14:00 - 14:30' },
  { start: '14:30', end: '15:00', label: '14:30 - 15:00' },
  { start: '15:00', end: '15:30', label: '15:00 - 15:30' },
  { start: '15:30', end: '16:00', label: '15:30 - 16:00' },
  { start: '16:00', end: '16:30', label: '16:00 - 16:30' },
  { start: '16:30', end: '17:00', label: '16:30 - 17:00' },
  { start: '17:00', end: '17:30', label: '17:00 - 17:30' },
  { start: '17:30', end: '18:00', label: '17:30 - 18:00' },
  { start: '18:00', end: '18:30', label: '18:00 - 18:30' },
  { start: '18:30', end: '19:00', label: '18:30 - 19:00' },
  { start: '19:00', end: '19:30', label: '19:00 - 19:30' },
  { start: '19:30', end: '20:00', label: '19:30 - 20:00' },
  { start: '20:00', end: '20:30', label: '20:00 - 20:30' },
  { start: '20:30', end: '21:00', label: '20:30 - 21:00' },
];

const DAYS_OF_WEEK = [
  { code: 'ПН', title: 'Понедельник', short: 'ПН', parity: 'ODD' },
  { code: 'ВТ', title: 'Вторник', short: 'ВТ', parity: 'EVEN' },
  { code: 'СР', title: 'Среда', short: 'СР', parity: 'ODD' },
  { code: 'ЧТ', title: 'Четверг', short: 'ЧТ', parity: 'EVEN' },
  { code: 'ПТ', title: 'Пятница', short: 'ПТ', parity: 'ODD' },
  { code: 'СБ', title: 'Суббота', short: 'СБ', parity: 'EVEN' },
  { code: 'ВС', title: 'Воскресенье', short: 'ВС', parity: 'ALL' },
];

const SOLID_COLOR_PALETTES = [
  {
    bg: 'bg-emerald-600',
    border: 'border-emerald-700',
    text: 'text-white',
    subtext: 'text-emerald-100',
    badge: 'bg-emerald-700/60 text-white',
    name: 'green',
  },
  {
    bg: 'bg-yellow-400',
    border: 'border-yellow-500',
    text: 'text-slate-950 font-extrabold',
    subtext: 'text-slate-900 font-medium',
    badge: 'bg-yellow-500 text-slate-950 font-bold',
    name: 'yellow',
  },
  {
    bg: 'bg-red-600',
    border: 'border-red-700',
    text: 'text-white',
    subtext: 'text-red-100',
    badge: 'bg-red-700/60 text-white',
    name: 'red',
  },
  {
    bg: 'bg-cyan-400',
    border: 'border-cyan-500',
    text: 'text-slate-950 font-extrabold',
    subtext: 'text-slate-900 font-medium',
    badge: 'bg-cyan-500 text-slate-950 font-bold',
    name: 'cyan',
  },
  {
    bg: 'bg-purple-600',
    border: 'border-purple-700',
    text: 'text-white',
    subtext: 'text-purple-100',
    badge: 'bg-purple-700/60 text-white',
    name: 'purple',
  },
  {
    bg: 'bg-orange-500',
    border: 'border-orange-600',
    text: 'text-white',
    subtext: 'text-orange-100',
    badge: 'bg-orange-600/60 text-white',
    name: 'orange',
  },
  {
    bg: 'bg-blue-600',
    border: 'border-blue-700',
    text: 'text-white',
    subtext: 'text-blue-100',
    badge: 'bg-blue-700/60 text-white',
    name: 'blue',
  },
  {
    bg: 'bg-rose-500',
    border: 'border-rose-600',
    text: 'text-white',
    subtext: 'text-rose-100',
    badge: 'bg-rose-600/60 text-white',
    name: 'rose',
  },
  {
    bg: 'bg-teal-500',
    border: 'border-teal-600',
    text: 'text-white',
    subtext: 'text-teal-100',
    badge: 'bg-teal-600/60 text-white',
    name: 'teal',
  },
];

function timeToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10) || 0);
  return h * 60 + m;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  courses,
  cabinets,
  teachers,
  students = [],
  enrollments = [],
  subjects = [],
  onAddCourse,
  onUpdateCourse,
  onDeleteCourse,
  onAddCabinet,
  onOpenAddModalWithPrefill,
  onOpenEditModal,
  onOpenStudentsModal,
}) => {
  // Current day index in Uzbekistan
  const todayDayCode = useMemo(() => {
    const todayIndex = new Date().getDay(); // 0: ВС, 1: ПН, 2: ВТ, 3: СР, 4: ЧТ, 5: ПТ, 6: СБ
    const dayMap = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
    return dayMap[todayIndex] || 'ВТ';
  }, []);

  // Parity / Day filter tab: 'ALL' | 'ODD' | 'EVEN' | specific day code ('ПН'...'ВС')
  const [dayFilter, setDayFilter] = useState<string>('ALL');

  // Specific day for matrix grid (defaults to today's day)
  const [selectedMatrixDay, setSelectedMatrixDay] = useState<string>(todayDayCode);

  // View Mode: 'WEEK_BOARD' (Compact Weekly Grid) | 'MATRIX' (Time Slot Matrix) | 'LIST' (Compact List)
  const [viewMode, setViewMode] = useState<'WEEK_BOARD' | 'MATRIX' | 'LIST'>('WEEK_BOARD');

  // Matrix grouping mode: 'CABINET' | 'TEACHER'
  const [matrixColMode, setMatrixColMode] = useState<'CABINET' | 'TEACHER'>('CABINET');

  // Density mode: 'COMPACT' | 'NORMAL'
  const [density, setDensity] = useState<'COMPACT' | 'NORMAL'>('COMPACT');

  // Filters
  const [selectedCabinetFilter, setSelectedCabinetFilter] = useState<string>('ALL');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [timeRangeFilter, setTimeRangeFilter] = useState<'ALL' | 'MORNING' | 'AFTERNOON'>('ALL');

  // Fullscreen toggle
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Modal Details
  const [selectedCourseForDetails, setSelectedCourseForDetails] = useState<Course | null>(null);

  // Default cabinets list fallback (sorted by room number)
  const displayCabinets = useMemo(() => {
    if (cabinets && cabinets.length > 0) return sortCabinets(cabinets);
    return sortCabinets([
      { id: 'cab-1', roomNumber: 'Кабинет № 1', name: 'Аудитория 1', capacity: 16 },
      { id: 'cab-2', roomNumber: 'Кабинет № 2', name: 'Аудитория 2', capacity: 16 },
      { id: 'cab-3', roomNumber: 'Кабинет № 3', name: 'Аудитория 3', capacity: 20 },
      { id: 'cab-4', roomNumber: 'Кабинет № 4', name: 'Аудитория 4', capacity: 20 },
      { id: 'cab-5', roomNumber: 'Кабинет № 5', name: 'Аудитория 5', capacity: 14 },
    ]);
  }, [cabinets]);

  // Color mapping
  const courseColorMap = useMemo(() => {
    const map = new Map<string, typeof SOLID_COLOR_PALETTES[0]>();
    const teacherMap = new Map<string, number>();
    let colorIndex = 0;

    teachers.forEach((t) => {
      teacherMap.set(t.id, colorIndex % SOLID_COLOR_PALETTES.length);
      colorIndex++;
    });

    courses.forEach((c) => {
      const idx = teacherMap.has(c.teacherId)
        ? teacherMap.get(c.teacherId)!
        : Math.abs(c.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) %
          SOLID_COLOR_PALETTES.length;
      map.set(c.id, SOLID_COLOR_PALETTES[idx]);
    });

    return map;
  }, [teachers, courses]);

  // Filtered courses based on current search and cabinet/teacher filters
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (!c.isActive) return false;

      // Search filter
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const teacher = teachers.find((t) => t.id === c.teacherId);
        const cabinet = displayCabinets.find((cb) => cb.id === c.cabinetId);
        const matches =
          c.title.toLowerCase().includes(q) ||
          c.subject.toLowerCase().includes(q) ||
          (teacher && teacher.fullName.toLowerCase().includes(q)) ||
          (cabinet && cabinet.roomNumber.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Cabinet filter
      if (selectedCabinetFilter !== 'ALL' && c.cabinetId !== selectedCabinetFilter) {
        return false;
      }

      // Teacher filter
      if (selectedTeacherFilter !== 'ALL' && c.teacherId !== selectedTeacherFilter) {
        return false;
      }

      // Day Parity / Day filter
      if (dayFilter === 'ODD') {
        const isOdd = c.daysOfWeek.some((d) => ['ПН', 'СР', 'ПТ'].includes(d));
        if (!isOdd) return false;
      } else if (dayFilter === 'EVEN') {
        const isEven = c.daysOfWeek.some((d) => ['ВТ', 'ЧТ', 'СБ'].includes(d));
        if (!isEven) return false;
      } else if (dayFilter !== 'ALL') {
        if (!c.daysOfWeek.includes(dayFilter)) return false;
      }

      return true;
    });
  }, [
    courses,
    searchFilter,
    selectedCabinetFilter,
    selectedTeacherFilter,
    dayFilter,
    teachers,
    displayCabinets,
  ]);

  // Visible matrix time slots
  const visibleTimeSlots = useMemo(() => {
    if (timeRangeFilter === 'MORNING') {
      return TIME_SLOTS.filter((s) => timeToMinutes(s.start) < timeToMinutes('13:30'));
    }
    if (timeRangeFilter === 'AFTERNOON') {
      return TIME_SLOTS.filter((s) => timeToMinutes(s.start) >= timeToMinutes('13:00'));
    }
    return TIME_SLOTS;
  }, [timeRangeFilter]);

  // Student count helper (synchronous with student registry)
  const getCourseStudentCount = (courseId: string) => {
    if (students && students.length > 0) {
      return students.filter(
        (s) => s.status !== 'INACTIVE' && (s.enrolledCourseIds || []).includes(courseId)
      ).length;
    }
    if (enrollments && enrollments.length > 0) {
      return enrollments.filter((e) => e.courseId === courseId && e.status === 'ACTIVE').length;
    }
    return 0;
  };

  // Matrix column list (filtered)
  const activeMatrixColumns = useMemo(() => {
    if (matrixColMode === 'CABINET') {
      if (selectedCabinetFilter !== 'ALL') {
        return displayCabinets.filter((c) => c.id === selectedCabinetFilter);
      }
      return displayCabinets;
    } else {
      if (selectedTeacherFilter !== 'ALL') {
        return teachers.filter((t) => t.id === selectedTeacherFilter);
      }
      return teachers;
    }
  }, [matrixColMode, displayCabinets, teachers, selectedCabinetFilter, selectedTeacherFilter]);

  // Find course starting at slot for matrix
  const getCourseStartingAtSlot = (
    slotStart: string,
    slotEnd: string,
    columnId: string,
    mode: 'CABINET' | 'TEACHER'
  ): { course: Course; spanSlots: number } | null => {
    const slotStartMin = timeToMinutes(slotStart);
    const slotEndMin = timeToMinutes(slotEnd);

    const matched = courses.find((c) => {
      if (!c.isActive || !c.daysOfWeek.includes(selectedMatrixDay)) return false;

      const targetColMatch =
        mode === 'CABINET'
          ? c.cabinetId === columnId || (!c.cabinetId && displayCabinets[0]?.id === columnId)
          : c.teacherId === columnId;

      if (!targetColMatch) return false;

      const cStartMin = timeToMinutes(c.startTime);
      return cStartMin >= slotStartMin && cStartMin < slotEndMin;
    });

    if (!matched) return null;

    const cStartMin = timeToMinutes(matched.startTime);
    const cEndMin = timeToMinutes(matched.endTime);
    const durationMin = Math.max(30, cEndMin - cStartMin);
    const spanSlots = Math.max(1, Math.round(durationMin / 30));

    return { course: matched, spanSlots };
  };

  const isSlotCoveredByEarlierCourse = (
    slotStart: string,
    columnId: string,
    mode: 'CABINET' | 'TEACHER'
  ): boolean => {
    const currentMin = timeToMinutes(slotStart);

    return courses.some((c) => {
      if (!c.isActive || !c.daysOfWeek.includes(selectedMatrixDay)) return false;

      const targetColMatch =
        mode === 'CABINET'
          ? c.cabinetId === columnId || (!c.cabinetId && displayCabinets[0]?.id === columnId)
          : c.teacherId === columnId;

      if (!targetColMatch) return false;

      const cStartMin = timeToMinutes(c.startTime);
      const cEndMin = timeToMinutes(c.endTime);
      return cStartMin < currentMin && cEndMin > currentMin;
    });
  };

  const handleEmptySlotClick = (slotStart: string, slotEnd: string, colId: string) => {
    const targetCab = displayCabinets.find((cb) => cb.id === colId);
    const targetTeacher = teachers.find((t) => t.id === colId);

    const startMin = timeToMinutes(slotStart);
    const endMin = startMin + 90;
    const endH = Math.floor(endMin / 60);
    const endM = endMin % 60;
    const calcEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    if (onOpenAddModalWithPrefill) {
      onOpenAddModalWithPrefill({
        day: selectedMatrixDay,
        startTime: slotStart,
        endTime: calcEndTime,
        cabinetId: targetCab?.id || displayCabinets[0]?.id || '',
        teacherId: targetTeacher?.id || teachers[0]?.id || '',
      });
    }
  };

  // Group courses by day for Weekly Compact Board
  const weeklyBoardDays = [
    { code: 'ПН', title: 'Понедельник', badge: 'Нечетный' },
    { code: 'ВТ', title: 'Вторник', badge: 'Четный' },
    { code: 'СР', title: 'Среда', badge: 'Нечетный' },
    { code: 'ЧТ', title: 'Четверг', badge: 'Четный' },
    { code: 'ПТ', title: 'Пятница', badge: 'Нечетный' },
    { code: 'СБ', title: 'Суббота', badge: 'Четный' },
  ];

  return (
    <div
      className={`space-y-3.5 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-slate-100 p-3 sm:p-5 overflow-y-auto'
          : 'relative'
      }`}
    >
      {/* TOP CONTROL BAR: High efficiency navigation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs space-y-3">
        
        {/* Row 1: Day Parity Filter Tabs & Quick Mode Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          
          {/* Parity & Day Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setDayFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                dayFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Все дни
            </button>

            <button
              type="button"
              onClick={() => setDayFilter('ODD')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center space-x-1 cursor-pointer ${
                dayFilter === 'ODD'
                  ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/20'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Нечетные (ПН, СР, ПТ)</span>
            </button>

            <button
              type="button"
              onClick={() => setDayFilter('EVEN')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center space-x-1 cursor-pointer ${
                dayFilter === 'EVEN'
                  ? 'bg-blue-600 text-white shadow-xs shadow-blue-600/20'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span>Четные (ВТ, ЧТ, СБ)</span>
            </button>

            {/* Individual Day buttons */}
            <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />

            {DAYS_OF_WEEK.map((d) => {
              const isSelected = dayFilter === d.code;
              const isToday = todayDayCode === d.code;
              const count = courses.filter((c) => c.isActive && c.daysOfWeek?.includes(d.code)).length;

              return (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => {
                    setDayFilter(d.code);
                    setSelectedMatrixDay(d.code);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center space-x-1 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs scale-105'
                      : isToday
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title={`${d.title}${isToday ? ' (Сегодня)' : ''}`}
                >
                  <span>{d.short}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Side: View Mode Toggles */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* View Mode Tabs */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('WEEK_BOARD')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  viewMode === 'WEEK_BOARD'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Компактная недельная сетка занятий (вместительная и удобная)"
              >
                <Columns className="w-3.5 h-3.5 text-indigo-600" />
                <span>Неделя</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('MATRIX')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  viewMode === 'MATRIX'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Сетка по времени и кабинетам"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                <span>Матрица</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('LIST')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  viewMode === 'LIST'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Список групп"
              >
                <List className="w-3.5 h-3.5 text-slate-600" />
                <span>Список</span>
              </button>
            </div>

            {/* Density Toggle (for matrix) */}
            {viewMode === 'MATRIX' && (
              <button
                type="button"
                onClick={() => setDensity(density === 'COMPACT' ? 'NORMAL' : 'COMPACT')}
                className={`p-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  density === 'COMPACT'
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
                title="Переключить плотность сетки (компактно / обычно)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{density === 'COMPACT' ? 'Компактная' : 'Обычная'}</span>
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              title={isFullscreen ? 'Свернуть' : 'На весь экран'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

        </div>

        {/* Row 2: Search and Cabinet/Teacher Filters (Keeps grid clean and narrow) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Search */}
            <div className="relative min-w-[180px] sm:min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск курса, учителя, кабинета..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-slate-50 text-slate-800 font-medium pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
              />
            </div>

            {/* Filter by Cabinet */}
            <select
              value={selectedCabinetFilter}
              onChange={(e) => setSelectedCabinetFilter(e.target.value)}
              className="bg-slate-50 text-slate-800 font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">🏢 Все кабинеты ({displayCabinets.length})</option>
              {displayCabinets.map((cab) => (
                <option key={cab.id} value={cab.id}>
                  {cab.roomNumber} {cab.name ? `(${cab.name})` : ''}
                </option>
              ))}
            </select>

            {/* Filter by Teacher */}
            <select
              value={selectedTeacherFilter}
              onChange={(e) => setSelectedTeacherFilter(e.target.value)}
              className="bg-slate-50 text-slate-800 font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">👨‍🏫 Все преподаватели ({teachers.length})</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} ({t.subject})
                </option>
              ))}
            </select>

            {/* Time range filter (for matrix) */}
            {viewMode === 'MATRIX' && (
              <select
                value={timeRangeFilter}
                onChange={(e) => setTimeRangeFilter(e.target.value as any)}
                className="bg-slate-50 text-slate-800 font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">⏰ 08:00 - 21:00 (Весь день)</option>
                <option value="MORNING">🌅 08:00 - 13:30 (Утренняя смена)</option>
                <option value="AFTERNOON">☀️ 13:00 - 21:00 (Дневная/Вечерняя)</option>
              </select>
            )}
          </div>

          {/* Quick stats counter */}
          <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-semibold">
            <span>Активных уроков в выборке: <strong className="text-indigo-600 font-black">{filteredCourses.length}</strong></span>
          </div>

        </div>

      </div>

      {/* VIEW MODE 1: WEEKLY COMPACT BOARD (Most ergonomic and convenient view without horizontal scroll) */}
      {viewMode === 'WEEK_BOARD' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 items-start">
          {weeklyBoardDays.map((day) => {
            const isToday = todayDayCode === day.code;
            const dayLessons = filteredCourses
              .filter((c) => c.daysOfWeek?.includes(day.code))
              .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

            return (
              <div
                key={day.code}
                className={`bg-white border rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[360px] ${
                  isToday ? 'border-amber-400 ring-2 ring-amber-300/50' : 'border-slate-200'
                }`}
              >
                {/* Day Header */}
                <div
                  className={`p-2.5 border-b flex items-center justify-between ${
                    isToday
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : day.badge === 'Нечетный'
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950 font-bold'
                      : 'bg-blue-50/80 border-blue-200 text-blue-950 font-bold'
                  }`}
                >
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-black uppercase">{day.code}</span>
                    <span className="text-[11px] font-semibold opacity-85">• {day.title.slice(0, 3)}</span>
                    {isToday && (
                      <span className="text-[9px] bg-slate-950 text-amber-400 font-bold px-1.5 py-0.2 rounded-full uppercase">
                        Сегодня
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-white/70 px-1.5 py-0.5 rounded-md">
                    {dayLessons.length}
                  </span>
                </div>

                {/* Lessons List in Day Column */}
                <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[700px]">
                  {dayLessons.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-1">
                      <span className="text-slate-300 text-lg">☕</span>
                      <span className="text-[11px]">Нет уроков</span>
                    </div>
                  ) : (
                    dayLessons.map((course, cIdx) => {
                      const teacher = teachers.find((t) => t.id === course.teacherId);
                      const cabinet = displayCabinets.find((cb) => cb.id === course.cabinetId);
                      const color = courseColorMap.get(course.id) || SOLID_COLOR_PALETTES[0];
                      const studentCount = getCourseStudentCount(course.id);

                      return (
                        <div
                          key={`${day.code}-${course.id}-${cIdx}`}
                          onClick={() => setSelectedCourseForDetails(course)}
                          className={`p-2.5 rounded-xl border shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-1.5 select-none ${color.bg} ${color.border} active:scale-[0.98]`}
                        >
                          {/* Time & Room Badge */}
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-[11px] font-black tracking-tight ${color.text}`}>
                              {course.startTime} - {course.endTime}
                            </span>
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${color.badge} shrink-0`}
                            >
                              {cabinet?.roomNumber || 'Каб 1'}
                            </span>
                          </div>

                          {/* Course Subject & Title */}
                          <div>
                            <h4 className={`text-xs font-black leading-tight line-clamp-1 ${color.text}`}>
                              {course.subject || course.title}
                            </h4>
                            {course.title !== course.subject && (
                              <p className={`text-[10px] opacity-90 line-clamp-1 ${color.subtext}`}>
                                {course.title}
                              </p>
                            )}
                          </div>

                          {/* Teacher & Students */}
                          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-black/10">
                            <span className={`line-clamp-1 font-medium ${color.subtext}`}>
                              {teacher?.fullName.split(' ')[0] || 'Учитель'}
                            </span>
                            <span className={`font-mono font-bold ${color.text}`}>
                              👥 {studentCount}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Quick Add button at bottom of day */}
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenAddModalWithPrefill) {
                      onOpenAddModalWithPrefill({
                        day: day.code,
                        startTime: '15:00',
                        endTime: '16:30',
                        cabinetId: displayCabinets[0]?.id || '',
                        teacherId: teachers[0]?.id || '',
                      });
                    }
                  }}
                  className="p-2 border-t border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 text-[11px] font-bold transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить</span>
                </button>

              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: MATRIX GRID (Refined with compact column widths and clean layout) */}
      {viewMode === 'MATRIX' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          
          {/* Day selection header for Matrix */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-600">День сетки:</span>
              <div className="flex items-center space-x-1">
                {DAYS_OF_WEEK.map((d) => (
                  <button
                    key={d.code}
                    type="button"
                    onClick={() => setSelectedMatrixDay(d.code)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      selectedMatrixDay === d.code
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {d.short}
                  </button>
                ))}
              </div>
            </div>

            {/* Matrix Grouping Mode */}
            <div className="flex items-center space-x-1 bg-white p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setMatrixColMode('CABINET')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                  matrixColMode === 'CABINET'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                По кабинетам
              </button>
              <button
                type="button"
                onClick={() => setMatrixColMode('TEACHER')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                  matrixColMode === 'TEACHER'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                По учителям
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                  <th className="w-24 sm:w-28 py-2 px-2.5 border-r border-slate-200 text-center font-bold text-slate-500 bg-slate-50 sticky left-0 z-20">
                    Время
                  </th>
                  {matrixColMode === 'CABINET'
                    ? activeMatrixColumns.map((col: any) => (
                        <th
                          key={col.id}
                          className={`py-2 px-2 border-r border-slate-200 text-center font-bold text-slate-800 last:border-r-0 ${
                            density === 'COMPACT' ? 'min-w-[125px]' : 'min-w-[160px]'
                          }`}
                        >
                          <div className="flex items-center justify-center space-x-1">
                            <DoorClosed className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate">{col.roomNumber}</span>
                          </div>
                          {col.name && (
                            <span className="block text-[10px] text-slate-400 font-normal truncate">
                              {col.name}
                            </span>
                          )}
                        </th>
                      ))
                    : activeMatrixColumns.map((col: any) => (
                        <th
                          key={col.id}
                          className={`py-2 px-2 border-r border-slate-200 text-center font-bold text-slate-800 last:border-r-0 ${
                            density === 'COMPACT' ? 'min-w-[135px]' : 'min-w-[170px]'
                          }`}
                        >
                          <div className="flex items-center justify-center space-x-1">
                            <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate">{col.fullName}</span>
                          </div>
                          <span className="block text-[10px] text-blue-600 font-medium truncate">
                            {col.subject}
                          </span>
                        </th>
                      ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {visibleTimeSlots.map((slot) => {
                  return (
                    <tr
                      key={slot.label}
                      className={`hover:bg-slate-50/40 transition-colors ${
                        density === 'COMPACT' ? 'h-[44px]' : 'h-[52px]'
                      }`}
                    >
                      <td className="py-1.5 px-2 border-r border-slate-200 text-slate-500 font-mono text-[11px] font-semibold text-center whitespace-nowrap bg-slate-50/60 sticky left-0 z-10">
                        {slot.start}
                      </td>

                      {activeMatrixColumns.map((col: any) => {
                        const colId = col.id;

                        const match = getCourseStartingAtSlot(
                          slot.start,
                          slot.end,
                          colId,
                          matrixColMode
                        );

                        if (isSlotCoveredByEarlierCourse(slot.start, colId, matrixColMode)) {
                          return null;
                        }

                        if (match) {
                          const { course, spanSlots } = match;
                          const teacher = teachers.find((t) => t.id === course.teacherId);
                          const cabinet = displayCabinets.find((cb) => cb.id === course.cabinetId);
                          const color = courseColorMap.get(course.id) || SOLID_COLOR_PALETTES[0];
                          const studentCount = getCourseStudentCount(course.id);

                          return (
                            <td
                              key={colId}
                              rowSpan={spanSlots}
                              className="p-1 border-r border-slate-200 align-top last:border-r-0"
                            >
                              <div
                                onClick={() => setSelectedCourseForDetails(course)}
                                className={`w-full h-full min-h-[40px] p-2 rounded-xl ${color.bg} ${color.border} border shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-1 select-none`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className={`text-[10px] font-black ${color.text}`}>
                                    {course.startTime} - {course.endTime}
                                  </span>
                                  <span className={`text-[9px] font-bold ${color.badge} px-1 rounded`}>
                                    👥 {studentCount}
                                  </span>
                                </div>

                                <div>
                                  <h4 className={`text-xs font-black leading-tight line-clamp-1 ${color.text}`}>
                                    {course.subject || course.title}
                                  </h4>
                                  <p className={`text-[10px] line-clamp-1 opacity-90 ${color.subtext}`}>
                                    {matrixColMode === 'CABINET' ? teacher?.fullName : cabinet?.roomNumber}
                                  </p>
                                </div>
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={colId}
                            onClick={() => handleEmptySlotClick(slot.start, slot.end, colId)}
                            className="p-1 border-r border-slate-200 text-center align-middle hover:bg-indigo-50/40 cursor-pointer group transition-colors last:border-r-0"
                            title={`Нажмите, чтобы занять ${slot.label}`}
                          >
                            <span className="text-slate-300 group-hover:hidden select-none font-mono text-xs">
                              ·
                            </span>
                            <div className="hidden group-hover:flex items-center justify-center space-x-1 text-indigo-600 text-[10px] font-bold py-0.5">
                              <Plus className="w-3 h-3" />
                              <span>Занять</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE 3: COMPACT LIST VIEW */}
      {viewMode === 'LIST' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredCourses.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-white border border-slate-200 rounded-2xl p-6">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700">В выборке уроков нет</h3>
              <p className="text-xs text-slate-400 mt-1">
                Попробуйте сбросить фильтры поиска или выбрать другой день
              </p>
            </div>
          ) : (
            filteredCourses.map((course, idx) => {
              const teacher = teachers.find((t) => t.id === course.teacherId);
              const cabinet = displayCabinets.find((cb) => cb.id === course.cabinetId);
              const color = courseColorMap.get(course.id) || SOLID_COLOR_PALETTES[0];
              const studentCount = getCourseStudentCount(course.id);

              return (
                <div
                  key={`${course.id}-${idx}`}
                  onClick={() => setSelectedCourseForDetails(course)}
                  className={`p-3.5 rounded-2xl border shadow-xs hover:shadow-md cursor-pointer transition-all ${color.bg} ${color.border} flex flex-col justify-between space-y-2.5`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black tracking-wide ${color.text}`}>
                      ⏰ {course.startTime} - {course.endTime}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${color.badge}`}>
                      {cabinet?.roomNumber || 'Кабинет № 1'}
                    </span>
                  </div>

                  <div>
                    <h3 className={`text-sm font-black ${color.text}`}>{course.subject}</h3>
                    <p className={`text-xs opacity-90 ${color.subtext}`}>{course.title}</p>
                  </div>

                  <div className="space-y-1 text-xs">
                    <p className={`flex items-center space-x-1.5 ${color.subtext}`}>
                      <User className="w-3.5 h-3.5" />
                      <span>{teacher?.fullName || 'Преподаватель не назначен'}</span>
                    </p>
                    <p className={`flex items-center space-x-1.5 ${color.subtext}`}>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Дни: {course.daysOfWeek.join(', ')}</span>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-black/10 flex items-center justify-between text-xs">
                    <span className={`font-bold ${color.text}`}>
                      👥 Учеников: {studentCount}
                    </span>
                    <span className={`font-bold ${color.text}`}>
                      {course.monthlyPrice.toLocaleString('ru-RU')} сум
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* QUICK COURSE DETAILS & ACTIONS MODAL */}
      {selectedCourseForDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                    {selectedCourseForDetails.title}
                  </h3>
                  <span className="text-xs text-blue-600 font-bold">
                    {selectedCourseForDetails.subject}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCourseForDetails(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Breakdown */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block mb-0.5 text-[11px]">Время и Дни</span>
                <span className="font-extrabold text-slate-800 text-xs block">
                  {selectedCourseForDetails.startTime} - {selectedCourseForDetails.endTime}
                </span>
                <span className="text-[11px] text-blue-600 font-semibold">
                  {selectedCourseForDetails.daysOfWeek.join(', ')}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block mb-0.5 text-[11px]">Аудитория</span>
                <span className="font-extrabold text-slate-800 text-xs block">
                  {displayCabinets.find((c) => c.id === selectedCourseForDetails.cabinetId)?.roomNumber || 'Кабинет № 1'}
                </span>
                <span className="text-[11px] text-slate-500">
                  Вместимость: {displayCabinets.find((c) => c.id === selectedCourseForDetails.cabinetId)?.capacity || 16} мест
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block mb-0.5 text-[11px]">Преподаватель</span>
                <span className="font-bold text-slate-800 block truncate">
                  {teachers.find((t) => t.id === selectedCourseForDetails.teacherId)?.fullName || 'Не назначен'}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 block mb-0.5 text-[11px]">Оплата в месяц</span>
                <span className="font-bold text-emerald-700 text-xs block">
                  {selectedCourseForDetails.monthlyPrice.toLocaleString('ru-RU')} сум
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Вы уверены, что хотите удалить группу "${selectedCourseForDetails.title}"?`)) {
                    onDeleteCourse(selectedCourseForDetails.id);
                    setSelectedCourseForDetails(null);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Удалить</span>
              </button>

              <div className="flex items-center space-x-2">
                {onOpenStudentsModal && (
                  <button
                    type="button"
                    onClick={() => {
                      const c = selectedCourseForDetails;
                      setSelectedCourseForDetails(null);
                      onOpenStudentsModal(c);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center space-x-1.5 border border-blue-200 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>Студенты ({students?.filter((s) => s.enrolledCourseIds?.includes(selectedCourseForDetails.id)).length || 0})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const c = selectedCourseForDetails;
                    setSelectedCourseForDetails(null);
                    if (onOpenEditModal) {
                      onOpenEditModal(c);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Редактировать</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
