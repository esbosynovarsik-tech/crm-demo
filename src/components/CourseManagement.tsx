import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Clock,
  Calendar,
  Building2,
  User,
  Trash2,
  Edit2,
  X,
  AlertTriangle,
  Users,
  Check,
  LayoutGrid,
  Eye,
  Tag,
  ClipboardCheck,
} from 'lucide-react';
import { Course, Cabinet, TeacherProfile, Subject, Student, Enrollment, AttendanceRecord } from '../types';
import { ScheduleView } from './ScheduleView';
import { CourseStudentsModal } from './CourseStudentsModal';
import { sortCoursesByCabinet, sortCabinets } from '../lib/sortingUtils';

interface CourseManagementProps {
  courses: Course[];
  cabinets: Cabinet[];
  teachers: TeacherProfile[];
  subjects?: Subject[];
  students?: Student[];
  enrollments?: Enrollment[];
  attendanceRecords?: AttendanceRecord[];
  onAddCourse: (course: Course) => void;
  onUpdateCourse: (course: Course) => void;
  onDeleteCourse: (courseId: string) => void;
  onAddCabinet: (cabinet: Cabinet) => void;
  onUpdateCabinet?: (cabinet: Cabinet) => void;
  onDeleteCabinet?: (cabinetId: string) => void;
  onUnenrollStudent?: (studentId: string, courseId: string, reason?: string, isPermanent?: boolean) => void;
  onEnrollStudentToCourse?: (studentId: string, courseId: string) => void;
  onTransferStudent?: (studentId: string, fromCourseId: string, toCourseId: string) => void;
  onToggleFreezeStudent?: (studentId: string, courseId?: string, reason?: string, freezeUntil?: string) => void;
  onSaveAttendance?: (records: Partial<AttendanceRecord>[]) => void;
  onNavigateToAttendance?: (courseId: string) => void;
}

export const CourseManagement: React.FC<CourseManagementProps> = ({
  courses,
  cabinets,
  teachers,
  subjects = [],
  students = [],
  enrollments = [],
  attendanceRecords = [],
  onAddCourse,
  onUpdateCourse,
  onDeleteCourse,
  onAddCabinet,
  onUpdateCabinet,
  onDeleteCabinet,
  onUnenrollStudent = () => {},
  onEnrollStudentToCourse,
  onTransferStudent,
  onToggleFreezeStudent,
  onSaveAttendance,
  onNavigateToAttendance,
}) => {
  const [activeViewTab, setActiveViewTab] = useState<'SCHEDULE' | 'COURSES_LIST'>('SCHEDULE');
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [showCabinetsModal, setShowCabinetsModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedCourseForStudents, setSelectedCourseForStudents] = useState<Course | null>(null);
  const [studentsModalTab, setStudentsModalTab] = useState<'STUDENTS' | 'ATTENDANCE'>('STUDENTS');

  // Cabinet Management State
  const [editingCabinet, setEditingCabinet] = useState<Cabinet | null>(null);
  const [cabRoomNumber, setCabRoomNumber] = useState('');
  const [cabName, setCabName] = useState('');
  const [cabCapacity, setCabCapacity] = useState(15);
  const [showCabinetForm, setShowCabinetForm] = useState(false);

  // Distinct subjects collected from catalog, teachers and courses
  const allDistinctSubjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; category: string }>();

    // 1. From subjects database
    (subjects || []).forEach((s) => {
      if (s.name && s.name.trim()) {
        map.set(s.name.toLowerCase().trim(), {
          id: s.id,
          name: s.name.trim(),
          category: s.category || 'Предметы центра',
        });
      }
    });

    // 2. From teachers
    (teachers || []).forEach((t) => {
      if (t.subject && t.subject.trim() && !map.has(t.subject.toLowerCase().trim())) {
        map.set(t.subject.toLowerCase().trim(), {
          id: `t-sub-${t.id}`,
          name: t.subject.trim(),
          category: 'Предметы преподавателей',
        });
      }
    });

    // 3. From courses
    (courses || []).forEach((c) => {
      if (c.subject && c.subject.trim() && !map.has(c.subject.toLowerCase().trim())) {
        map.set(c.subject.toLowerCase().trim(), {
          id: `c-sub-${c.id}`,
          name: c.subject.trim(),
          category: 'Действующие курсы',
        });
      }
    });

    return Array.from(map.values());
  }, [subjects, teachers, courses]);

  // Always sort courses by cabinet (Cabinet 1, Cabinet 2, etc.) and time
  const sortedCoursesList = useMemo(() => {
    const courseMap = new Map<string, Course>();
    courses.forEach((c) => {
      if (c && c.id) courseMap.set(c.id, c);
    });
    return sortCoursesByCabinet(Array.from(courseMap.values()), cabinets);
  }, [courses, cabinets]);

  // New Course Form State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || '');
  const [cabinetId, setCabinetId] = useState(cabinets[0]?.id || '');
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(['ПН', 'СР', 'ПТ']);
  const [startTime, setStartTime] = useState('15:00');
  const [endTime, setEndTime] = useState('16:30');
  const [monthlyPrice, setMonthlyPrice] = useState<number>(360000);

  // Edit Course Form State
  const [editTitle, setEditTitle] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editCustomSubjectInput, setEditCustomSubjectInput] = useState('');
  const [editTeacherId, setEditTeacherId] = useState('');
  const [editCabinetId, setEditCabinetId] = useState('');
  const [editDaysOfWeek, setEditDaysOfWeek] = useState<string[]>([]);
  const [editStartTime, setEditStartTime] = useState('15:00');
  const [editEndTime, setEditEndTime] = useState('16:30');
  const [editMonthlyPrice, setEditMonthlyPrice] = useState<number>(360000);

  const handleOpenAddCourseModal = () => {
    setTitle('');
    const defaultSub = subjects[0]?.name || teachers[0]?.subject || (allDistinctSubjects[0]?.name || '');
    setSubject(defaultSub);
    setCustomSubjectInput('');
    setTeacherId(teachers[0]?.id || '');
    setCabinetId(cabinets[0]?.id || '');
    setDaysOfWeek(['ПН', 'СР', 'ПТ']);
    setStartTime('15:00');
    setEndTime('16:30');
    setMonthlyPrice(360000);
    setShowAddCourseModal(true);
  };

  const handleOpenAddModalWithPrefill = (prefill: {
    day: string;
    startTime: string;
    endTime: string;
    cabinetId: string;
    teacherId: string;
  }) => {
    setTitle('');
    const targetTeacher = teachers.find((t) => t.id === prefill.teacherId) || teachers[0];
    const defaultSub = targetTeacher?.subject || subjects[0]?.name || '';
    setSubject(defaultSub);
    setCustomSubjectInput('');
    setTeacherId(prefill.teacherId || teachers[0]?.id || '');
    setCabinetId(prefill.cabinetId || cabinets[0]?.id || '');
    setDaysOfWeek([prefill.day]);
    setStartTime(prefill.startTime);
    setEndTime(prefill.endTime);
    setMonthlyPrice(360000);
    setShowAddCourseModal(true);
  };

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSubject = subject === '__CUSTOM__' ? customSubjectInput.trim() : subject.trim();
    if (!title || !finalSubject || !teacherId) {
      alert('Заполните все обязательные поля (название, предмет и преподаватель)');
      return;
    }

    const newCourse: Course = {
      id: `c-${Date.now()}`,
      title,
      subject: finalSubject,
      teacherId,
      cabinetId: cabinetId || undefined,
      daysOfWeek,
      startTime,
      endTime,
      monthlyPrice,
      isActive: true,
    };

    onAddCourse(newCourse);
    alert(`Курс "${title}" (${finalSubject}) успешно добавлен!`);
    setShowAddCourseModal(false);
    setTitle('');
  };

  const handleOpenEditModal = (course: Course) => {
    setEditingCourse(course);
    setEditTitle(course.title);
    
    // Check if course subject is in known subjects list
    const isKnown = allDistinctSubjects.some(
      (s) => s.name.toLowerCase() === (course.subject || '').toLowerCase()
    );
    if (isKnown) {
      setEditSubject(course.subject);
      setEditCustomSubjectInput('');
    } else if (course.subject) {
      setEditSubject('__CUSTOM__');
      setEditCustomSubjectInput(course.subject);
    } else {
      setEditSubject('');
      setEditCustomSubjectInput('');
    }

    setEditTeacherId(course.teacherId);
    setEditCabinetId(course.cabinetId || cabinets[0]?.id || '');
    setEditDaysOfWeek(course.daysOfWeek);
    setEditStartTime(course.startTime);
    setEditEndTime(course.endTime);
    setEditMonthlyPrice(course.monthlyPrice);
  };

  const handleSaveEditedCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;

    const finalSubject = editSubject === '__CUSTOM__' ? editCustomSubjectInput.trim() : editSubject.trim();
    if (!editTitle || !finalSubject || !editTeacherId) {
      alert('Заполните все обязательные поля');
      return;
    }

    const updated: Course = {
      ...editingCourse,
      title: editTitle,
      subject: finalSubject,
      teacherId: editTeacherId,
      cabinetId: editCabinetId || undefined,
      daysOfWeek: editDaysOfWeek,
      startTime: editStartTime,
      endTime: editEndTime,
      monthlyPrice: editMonthlyPrice,
    };

    onUpdateCourse(updated);
    alert(`Курс "${editTitle}" успешно обновлен!`);
    setEditingCourse(null);
  };

  const handleDeleteCourseClick = (course: Course) => {
    if (window.confirm(`Вы уверены, что хотите удалить группу/курс "${course.title}"?`)) {
      onDeleteCourse(course.id);
      alert(`Курс "${course.title}" удален!`);
    }
  };

  // Cabinet Handlers
  const handleOpenNewCabinetForm = () => {
    setEditingCabinet(null);
    setCabRoomNumber('');
    setCabName('');
    setCabCapacity(16);
    setShowCabinetForm(true);
  };

  const handleOpenEditCabinetForm = (cab: Cabinet) => {
    setEditingCabinet(cab);
    setCabRoomNumber(cab.roomNumber);
    setCabName(cab.name || '');
    setCabCapacity(cab.capacity || 16);
    setShowCabinetForm(true);
  };

  const handleSaveCabinet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cabRoomNumber.trim()) {
      alert('Укажите номер или название кабинета');
      return;
    }

    if (editingCabinet) {
      const updated: Cabinet = {
        ...editingCabinet,
        roomNumber: cabRoomNumber.trim(),
        name: cabName.trim() || undefined,
        capacity: Number(cabCapacity) || 16,
      };
      if (onUpdateCabinet) {
        onUpdateCabinet(updated);
      } else {
        onAddCabinet(updated);
      }
      alert(`Кабинет "${cabRoomNumber}" успешно обновлен!`);
    } else {
      const newCabinet: Cabinet = {
        id: `cab-${Date.now()}`,
        roomNumber: cabRoomNumber.trim(),
        name: cabName.trim() || undefined,
        capacity: Number(cabCapacity) || 16,
      };
      onAddCabinet(newCabinet);
      alert(`Кабинет "${cabRoomNumber}" успешно добавлен!`);
    }

    setShowCabinetForm(false);
    setEditingCabinet(null);
    setCabRoomNumber('');
    setCabName('');
  };

  const handleDeleteCabinetClick = (cab: Cabinet) => {
    const assignedCourses = courses.filter((c) => c.cabinetId === cab.id);
    const msg = assignedCourses.length > 0
      ? `Внимание! К кабинету "${cab.roomNumber}" привязано ${assignedCourses.length} групп (${assignedCourses.map((c) => c.title).join(', ')}). Вы уверены, что хотите удалить этот кабинет? Группы будут откреплены.`
      : `Вы уверены, что хотите удалить кабинет "${cab.roomNumber}"?`;

    if (window.confirm(msg)) {
      if (onDeleteCabinet) {
        onDeleteCabinet(cab.id);
      }
      alert(`Кабинет "${cab.roomNumber}" удален!`);
    }
  };

  const ODD_DAYS = ['ПН', 'СР', 'ПТ'];
  const EVEN_DAYS = ['ВТ', 'ЧТ', 'СБ'];

  const isOddDaysSelected = (days: string[]) => {
    return days.length === ODD_DAYS.length && ODD_DAYS.every((d) => days.includes(d));
  };

  const isEvenDaysSelected = (days: string[]) => {
    return days.length === EVEN_DAYS.length && EVEN_DAYS.every((d) => days.includes(d));
  };

  const handleSelectOddDays = (isEdit = false) => {
    if (isEdit) {
      setEditDaysOfWeek([...ODD_DAYS]);
    } else {
      setDaysOfWeek([...ODD_DAYS]);
    }
  };

  const handleSelectEvenDays = (isEdit = false) => {
    if (isEdit) {
      setEditDaysOfWeek([...EVEN_DAYS]);
    } else {
      setDaysOfWeek([...EVEN_DAYS]);
    }
  };

  const toggleDayOfWeek = (day: string, isEdit = false) => {
    if (isEdit) {
      if (editDaysOfWeek.includes(day)) {
        setEditDaysOfWeek(editDaysOfWeek.filter((d) => d !== day));
      } else {
        setEditDaysOfWeek([...editDaysOfWeek, day]);
      }
    } else {
      if (daysOfWeek.includes(day)) {
        setDaysOfWeek(daysOfWeek.filter((d) => d !== day));
      } else {
        setDaysOfWeek([...daysOfWeek, day]);
      }
    }
  };

  return (
    <div className="space-y-5">
      
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
        <div>
          <h1 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span>Управление Курсами, Группами и Расписанием</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Сетка расписания аудиторий по 30 минут, распределение кабинетов, редактирование групп и учет стоимости
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => {
              setShowCabinetForm(false);
              setEditingCabinet(null);
              setShowCabinetsModal(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs transition-all"
          >
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Кабинеты ({cabinets.length})</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddCourseModal}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Создать курс / группу</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs: [Расписание (Сетка)] vs [Список курсов и групп] */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-1">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setActiveViewTab('SCHEDULE')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeViewTab === 'SCHEDULE'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-600 ring-offset-1'
                : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Расписание (Сетка занятий)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveViewTab('COURSES_LIST')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeViewTab === 'COURSES_LIST'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-600 ring-offset-1'
                : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Все курсы и группы ({courses.length})</span>
          </button>
        </div>

        <span className="text-xs text-slate-400 font-medium hidden md:inline">
          {activeViewTab === 'SCHEDULE' ? 'Интерактивная сетка по кабинетам и времени' : 'Карточки курсов и настройки'}
        </span>
      </div>

      {/* RENDER VIEW: SCHEDULE GRID vs COURSES LIST */}
      {activeViewTab === 'SCHEDULE' ? (
        <ScheduleView
          courses={courses}
          cabinets={cabinets}
          teachers={teachers}
          subjects={subjects}
          students={students}
          enrollments={enrollments}
          onAddCourse={onAddCourse}
          onUpdateCourse={onUpdateCourse}
          onDeleteCourse={onDeleteCourse}
          onAddCabinet={onAddCabinet}
          onOpenAddModalWithPrefill={handleOpenAddModalWithPrefill}
          onOpenEditModal={handleOpenEditModal}
          onOpenStudentsModal={(c) => setSelectedCourseForStudents(c)}
        />
      ) : (
        /* Course Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCoursesList.map((course, idx) => {
            const teacher = teachers.find(
              (t) => t.id === course.teacherId || t.userId === course.teacherId
            );
            const cabinet = cabinets.find((cb) => cb.id === course.cabinetId);
            const courseStudents = students.filter(
              (s) => s.status !== 'INACTIVE' && s.enrolledCourseIds?.includes(course.id)
            );

            return (
              <div
                key={`${course.id}-${idx}`}
                className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-5 space-y-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-extrabold text-blue-600 tracking-wider">
                      {course.subject}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
                      {course.monthlyPrice.toLocaleString('ru-RU')} сум / мес
                    </span>
                  </div>
                  <h3
                    onClick={() => setSelectedCourseForStudents(course)}
                    className="text-sm font-bold text-slate-900 mt-1 leading-snug hover:text-blue-600 cursor-pointer transition-colors"
                    title="Нажмите, чтобы просмотреть список учеников"
                  >
                    {course.title}
                  </h3>
                </div>

                <div className="space-y-2 text-xs divide-y divide-slate-100 pt-1">
                  
                  <div className="flex items-center justify-between py-1 text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>Преподаватель:</span>
                    </span>
                    <span className="font-semibold text-slate-800">{teacher?.fullName || 'Не назначен'}</span>
                  </div>

                  <div className="flex items-center justify-between py-1 text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      <span>Дни занятий:</span>
                    </span>
                    <div className="flex space-x-1">
                      {course.daysOfWeek.map((d) => (
                        <span
                          key={d}
                          className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[10px] font-bold"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Время проведения:</span>
                    </span>
                    <span className="font-mono text-slate-700">
                      {course.startTime} - {course.endTime}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Аудитория:</span>
                    </span>
                    <span className="font-medium text-slate-700">
                      {cabinet?.roomNumber || 'Кабинет №101'}
                    </span>
                  </div>

                </div>

                {/* Prominent Student Roster & Attendance Trigger Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCourseForStudents(course);
                      setStudentsModalTab('STUDENTS');
                    }}
                    className="py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-between border border-blue-200 transition-all cursor-pointer shadow-2xs"
                    title="Список учеников группы, зачисление, перевод и исключение"
                  >
                    <span className="flex items-center space-x-1.5 min-w-0">
                      <Users className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="truncate">Ученики ({courseStudents.length})</span>
                    </span>
                    <span className="text-[10px] font-extrabold text-blue-700 bg-white px-1.5 py-0.5 rounded border border-blue-200/60 shadow-2xs shrink-0 ml-1">
                      →
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCourseForStudents(course);
                      setStudentsModalTab('ATTENDANCE');
                    }}
                    className="py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-between border border-emerald-200 transition-all cursor-pointer shadow-2xs"
                    title="Посещаемость этой группы"
                  >
                    <span className="flex items-center space-x-1.5 min-w-0">
                      <ClipboardCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">Посещаемость</span>
                    </span>
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200/60 shadow-2xs shrink-0 ml-1">
                      Журнал
                    </span>
                  </button>
                </div>

                {/* Edit & Delete Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
                  <button
                    onClick={() => handleOpenEditModal(course)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold transition-all border border-slate-200"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Изменить</span>
                  </button>
                  <button
                    onClick={() => handleDeleteCourseClick(course)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-all border border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Удалить</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* EDIT COURSE MODAL */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <span>Редактирование группы / курса</span>
              </h3>
              <button
                onClick={() => setEditingCourse(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedCourse} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Название курса *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-bold">Предмет *</label>
                    <span className="text-[10px] text-slate-400 font-semibold">{allDistinctSubjects.length} предм.</span>
                  </div>
                  <select
                    required
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 font-semibold p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Выберите предмет --</option>
                    {allDistinctSubjects.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} {s.category ? `(${s.category})` : ''}
                      </option>
                    ))}
                    <option value="__CUSTOM__">✍️ Ввести другой предмет (вручную)...</option>
                  </select>
                  {editSubject === '__CUSTOM__' && (
                    <input
                      type="text"
                      required
                      value={editCustomSubjectInput}
                      onChange={(e) => setEditCustomSubjectInput(e.target.value)}
                      placeholder="Введите наименование предмета"
                      className="mt-2 w-full bg-blue-50/60 text-slate-900 font-semibold p-2.5 rounded-xl border border-blue-300"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Преподаватель *</label>
                  <select
                    value={editTeacherId}
                    onChange={(e) => setEditTeacherId(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200 font-medium"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName} ({t.subject})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Days of week selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-bold">
                    Дни проведения уроков:
                  </label>
                  <span className="text-[11px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {editDaysOfWeek.length > 0 ? editDaysOfWeek.join(', ') : 'Не выбрано'}
                  </span>
                </div>

                {/* Quick Preset Buttons: Нечётные дни & Чётные дни */}
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  <button
                    type="button"
                    id="edit-course-odd-days-btn"
                    onClick={() => handleSelectOddDays(true)}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all border cursor-pointer ${
                      isOddDaysSelected(editDaysOfWeek)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                        : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <span>⚡ Нечётные дни (ПН, СР, ПТ)</span>
                  </button>

                  <button
                    type="button"
                    id="edit-course-even-days-btn"
                    onClick={() => handleSelectEvenDays(true)}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all border cursor-pointer ${
                      isEvenDaysSelected(editDaysOfWeek)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                        : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <span>⚡ Чётные дни (ВТ, ЧТ, СБ)</span>
                  </button>
                </div>

                {/* Manual day toggles */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-extrabold text-slate-400 mr-1 px-1">Ручной выбор:</span>
                  {['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map((day) => (
                    <button
                      key={day}
                      type="button"
                      id={`edit-day-toggle-${day}`}
                      onClick={() => toggleDayOfWeek(day, true)}
                      className={`flex-1 min-w-[34px] py-1 px-2 rounded-lg font-bold text-xs transition-all text-center cursor-pointer ${
                        editDaysOfWeek.includes(day)
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time & Cabinet */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Начало</label>
                  <input
                    type="text"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 font-mono p-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Конец</label>
                  <input
                    type="text"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 font-mono p-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Кабинет</label>
                  <select
                    value={editCabinetId}
                    onChange={(e) => setEditCabinetId(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 p-2 rounded-xl border border-slate-200"
                  >
                    {cabinets.map((cb) => (
                      <option key={cb.id} value={cb.id}>
                        {cb.roomNumber}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Стоимость за месяц (сум):
                </label>
                <input
                  type="number"
                  required
                  value={editMonthlyPrice}
                  onChange={(e) => setEditMonthlyPrice(Number(e.target.value))}
                  className="w-full bg-slate-50 text-slate-900 font-bold p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20"
                >
                  Сохранить изменения
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ADD COURSE MODAL */}
      {showAddCourseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <span>Добавление нового учебного курса</span>
              </h3>
              <button
                onClick={() => setShowAddCourseModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Название курса *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: ОГЭ Математика 9 класс"
                  className="w-full bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-bold">Предмет *</label>
                    <span className="text-[10px] text-slate-400 font-semibold">{allDistinctSubjects.length} доступно</span>
                  </div>
                  <select
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 font-semibold p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Выберите предмет ({allDistinctSubjects.length}) --</option>
                    {allDistinctSubjects.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} {s.category ? `(${s.category})` : ''}
                      </option>
                    ))}
                    <option value="__CUSTOM__">✍️ Ввести другой предмет (вручную)...</option>
                  </select>
                  {subject === '__CUSTOM__' && (
                    <input
                      type="text"
                      required
                      placeholder="Введите название предмета"
                      value={customSubjectInput}
                      onChange={(e) => setCustomSubjectInput(e.target.value)}
                      className="mt-2 w-full bg-blue-50/60 text-slate-900 font-semibold p-2.5 rounded-xl border border-blue-300"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Преподаватель *</label>
                  <select
                    value={teacherId}
                    onChange={(e) => {
                      setTeacherId(e.target.value);
                      const t = teachers.find((teach) => teach.id === e.target.value);
                      if (t && (!subject || subject === '__CUSTOM__')) {
                        setSubject(t.subject);
                      }
                    }}
                    className="w-full bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName} ({t.subject})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Days of week selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-bold">
                    Дни проведения уроков:
                  </label>
                  <span className="text-[11px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {daysOfWeek.length > 0 ? daysOfWeek.join(', ') : 'Не выбрано'}
                  </span>
                </div>

                {/* Quick Preset Buttons: Нечётные дни & Чётные дни */}
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  <button
                    type="button"
                    id="add-course-odd-days-btn"
                    onClick={() => handleSelectOddDays(false)}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all border cursor-pointer ${
                      isOddDaysSelected(daysOfWeek)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                        : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <span>⚡ Нечётные дни (ПН, СР, ПТ)</span>
                  </button>

                  <button
                    type="button"
                    id="add-course-even-days-btn"
                    onClick={() => handleSelectEvenDays(false)}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all border cursor-pointer ${
                      isEvenDaysSelected(daysOfWeek)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                        : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <span>⚡ Чётные дни (ВТ, ЧТ, СБ)</span>
                  </button>
                </div>

                {/* Manual day toggles */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-extrabold text-slate-400 mr-1 px-1">Ручной выбор:</span>
                  {['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map((day) => (
                    <button
                      key={day}
                      type="button"
                      id={`add-day-toggle-${day}`}
                      onClick={() => toggleDayOfWeek(day)}
                      className={`flex-1 min-w-[34px] py-1 px-2 rounded-lg font-bold text-xs transition-all text-center cursor-pointer ${
                        daysOfWeek.includes(day)
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time & Cabinet */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Начало</label>
                  <input
                    type="text"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 font-mono p-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Конец</label>
                  <input
                    type="text"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 font-mono p-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Кабинет</label>
                  <select
                    value={cabinetId}
                    onChange={(e) => setCabinetId(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 p-2 rounded-xl border border-slate-200"
                  >
                    {cabinets.map((cb) => (
                      <option key={cb.id} value={cb.id}>
                        {cb.roomNumber}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Полная стоимость за 1 календарный месяц (в сум):
                </label>
                <input
                  type="number"
                  required
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(Number(e.target.value))}
                  className="w-full bg-slate-50 text-slate-900 font-bold p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCourseModal(false)}
                  className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20"
                >
                  Создать курс
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* CABINETS MANAGEMENT MODAL (View, Edit, Deduplicate, Delete, Add) */}
      {showCabinetsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Управление Кабинетами и Аудиториями
                  </h3>
                  <p className="text-xs text-slate-500">
                    Всего кабинетов: <strong>{cabinets.length}</strong> | Просмотр, исправление ошибок/дубликатов и добавление
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowCabinetsModal(false);
                  setShowCabinetForm(false);
                  setEditingCabinet(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cabinet Add/Edit Inline Form */}
            {showCabinetForm ? (
              <form onSubmit={handleSaveCabinet} className="bg-blue-50/60 border border-blue-200 p-4 rounded-xl space-y-3 animate-in fade-in text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                    <Edit2 className="w-4 h-4 text-blue-600" />
                    <span>{editingCabinet ? `Редактирование: ${editingCabinet.roomNumber}` : 'Добавление нового кабинета'}</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCabinetForm(false);
                      setEditingCabinet(null);
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Номер / Название *
                    </label>
                    <input
                      type="text"
                      required
                      value={cabRoomNumber}
                      onChange={(e) => setCabRoomNumber(e.target.value)}
                      placeholder="Кабинет №101"
                      className="w-full bg-white text-slate-900 font-semibold p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Название аудитории
                    </label>
                    <input
                      type="text"
                      value={cabName}
                      onChange={(e) => setCabName(e.target.value)}
                      placeholder="Аудитория Математики"
                      className="w-full bg-white text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Вместимость (мест)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={cabCapacity}
                      onChange={(e) => setCabCapacity(Number(e.target.value))}
                      className="w-full bg-white text-slate-900 font-bold p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-blue-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCabinetForm(false);
                      setEditingCabinet(null);
                    }}
                    className="px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-xs transition-all"
                  >
                    {editingCabinet ? 'Сохранить изменения' : 'Создать кабинет'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Список всех аудиторий учебного центра. Если были ошибочно добавлены дубликаты, их можно изменить или удалить.
                </span>
                <button
                  type="button"
                  onClick={handleOpenNewCabinetForm}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Новый кабинет</span>
                </button>
              </div>
            )}

            {/* Cabinets Table / Cards */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {cabinets.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic text-xs">
                  Кабинеты еще не созданы. Нажмите «+ Новый кабинет», чтобы добавить аудиторию.
                </div>
              ) : (
                <table className="w-full text-xs text-left text-slate-700">
                  <thead className="bg-slate-50 text-slate-400 uppercase font-mono text-[10px] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3.5">Кабинет</th>
                      <th className="py-2.5 px-3.5">Название</th>
                      <th className="py-2.5 px-3.5">Вместимость</th>
                      <th className="py-2.5 px-3.5">Привязанные группы</th>
                      <th className="py-2.5 px-3.5 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cabinets.map((cab) => {
                      const assignedCourses = courses.filter((c) => c.cabinetId === cab.id);
                      // Check duplicate detection
                      const duplicateCount = cabinets.filter(
                        (c) => c.roomNumber.trim().toLowerCase() === cab.roomNumber.trim().toLowerCase()
                      ).length;
                      const isDuplicate = duplicateCount > 1;

                      return (
                        <tr key={cab.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3.5 font-bold text-slate-900">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-blue-700">{cab.roomNumber}</span>
                              {isDuplicate && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[9px] flex items-center space-x-0.5" title="Обнаружен дубликат с таким же номером!">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  <span>Дубликат</span>
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3.5 text-slate-700 font-medium">
                            {cab.name || <span className="text-slate-300 italic">—</span>}
                          </td>

                          <td className="py-3 px-3.5 text-slate-600 font-semibold">
                            <span className="flex items-center space-x-1">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <span>{cab.capacity || 16} мест</span>
                            </span>
                          </td>

                          <td className="py-3 px-3.5">
                            {assignedCourses.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {assignedCourses.map((c, cIdx) => (
                                  <span
                                    key={`${cab.id}-${c.id}-${cIdx}`}
                                    className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-semibold"
                                  >
                                    {c.title}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Свободен (нет групп)</span>
                            )}
                          </td>

                          <td className="py-3 px-3.5 text-right space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCabinetForm(cab)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200 text-xs font-bold transition-all"
                              title="Редактировать кабинет"
                            >
                              <Edit2 className="w-3.5 h-3.5 inline mr-1" />
                              Изменить
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCabinetClick(cab)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Удалить кабинет"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-400">
                Совет: При удалении кабинета группы не удаляются, а лишь открепляются от кабинета.
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowCabinetsModal(false);
                  setShowCabinetForm(false);
                  setEditingCabinet(null);
                }}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all"
              >
                Готово / Закрыть
              </button>
            </div>

          </div>
        </div>
      )}

      {/* COURSE STUDENTS ROSTER & ATTENDANCE MODAL */}
      <CourseStudentsModal
        isOpen={!!selectedCourseForStudents}
        onClose={() => setSelectedCourseForStudents(null)}
        course={selectedCourseForStudents}
        courses={courses}
        students={students}
        teachers={teachers}
        cabinets={cabinets}
        enrollments={enrollments}
        attendanceRecords={attendanceRecords}
        initialTab={studentsModalTab}
        onUnenrollStudent={onUnenrollStudent}
        onEnrollStudentToCourse={onEnrollStudentToCourse}
        onTransferStudent={onTransferStudent}
        onToggleFreezeStudent={onToggleFreezeStudent}
        onSaveAttendance={onSaveAttendance}
        onNavigateToAttendance={onNavigateToAttendance}
      />

    </div>
  );
};
