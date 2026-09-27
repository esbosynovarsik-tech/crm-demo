import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Phone,
  Search,
  BookPlus,
  Tag,
  Clock,
  Filter,
  Trash2,
  CreditCard,
  ArrowRightLeft,
  Snowflake,
  Sun,
  School,
  GraduationCap,
  MapPin,
  Award,
  Pencil,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { Student, Course, DiscountType, Enrollment, Payment, Lead, TeacherProfile, Cabinet, Subject } from '../types';
import { calculateFirstMonthTuition } from '../lib/billingLogic';
import { getUzbekistanToday, getUzbekistanCurrentMonthPeriod, isStudentFrozenInCourse } from '../lib/dateUtils';
import { checkStudentDuplicate } from '../lib/studentValidation';
import { formatUzbekPhoneInput, formatDisplayPhone } from '../lib/phoneUtils';
import { sortStudentsAlphabetically } from '../lib/sortingUtils';
import { TransferStudentModal } from './TransferStudentModal';
import { FreezeStudentModal } from './FreezeStudentModal';
import { LeadsManagement } from './LeadsManagement';
import { StudentExcelImportModal } from './StudentExcelImportModal';
import { FileSpreadsheet } from 'lucide-react';

interface StudentRegistryProps {
  students: Student[];
  courses: Course[];
  payments: Payment[];
  teachers?: TeacherProfile[];
  cabinets?: Cabinet[];
  leads?: Lead[];
  subjects?: Subject[];
  onAddStudent: (student: Student) => void;
  onImportStudents?: (newStudents: Student[]) => Promise<void> | void;
  onUpdateStudent?: (student: Student) => void;
  onEnrollStudent: (enrollment: Enrollment, firstMonthPayment: Payment) => void;
  onDeleteStudent?: (studentId: string) => void;
  onOpenPaymentForStudent?: (student: Student) => void;
  onTransferStudent?: (studentId: string, fromCourseId: string, toCourseId: string) => void;
  onToggleFreezeStudent?: (studentId: string, courseId?: string, reason?: string, freezeUntil?: string) => void;
  onAddLead?: (lead: Lead) => void;
  onUpdateLead?: (lead: Lead) => void;
  onDeleteLead?: (leadId: string) => void;
  onClearLeads?: () => void;
  onConvertLeadToStudent?: (
    lead: Lead,
    courseIdOrCourses: string | { courseId: string; remainingLessonsCount: number }[],
    remainingLessonsCount?: number
  ) => void;
}

export const StudentRegistry: React.FC<StudentRegistryProps> = ({
  students,
  courses,
  payments,
  teachers = [],
  cabinets = [],
  leads = [],
  subjects = [],
  onAddStudent,
  onUpdateStudent,
  onEnrollStudent,
  onDeleteStudent,
  onOpenPaymentForStudent,
  onTransferStudent,
  onToggleFreezeStudent,
  onAddLead,
  onUpdateLead,
  onDeleteLead,
  onClearLeads,
  onConvertLeadToStudent,
  onImportStudents,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'STUDENTS' | 'LEADS'>('STUDENTS');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourseId, setFilterCourseId] = useState<string>('ALL');

  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [showEnrollModal, setShowEnrollModal] = useState<Student | null>(null);
  const [transferModalStudent, setTransferModalStudent] = useState<Student | null>(null);
  const [freezeModalStudent, setFreezeModalStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Student Form State (Uzbekistan +998 format) - Separate Last Name and First Name (No patronymic)
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [birthDate, setBirthDate] = useState('2009-03-10');
  const [phone, setPhone] = useState('+998 ');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState('');
  const [address, setAddress] = useState('');
  const [certificatesAndBenefits, setCertificatesAndBenefits] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [fatherPhone, setFatherPhone] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('NONE');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Combined full name for student duplicate check and save
  const currentFullName = `${lastName.trim()} ${firstName.trim()}`.trim();

  // Real-time Duplicate Student Validation (Checks matching Full Name + Phone)
  const duplicateValidation = useMemo(() => {
    return checkStudentDuplicate(students, currentFullName, phone, editingStudentId);
  }, [students, currentFullName, phone, editingStudentId]);

  // Enrollment State for Modal
  const [selectedCourseForEnroll, setSelectedCourseForEnroll] = useState<string>(
    courses[0]?.id || ''
  );
  const [enrollmentStartDate, setEnrollmentStartDate] = useState<string>(getUzbekistanToday());
  const [remainingLessons, setRemainingLessons] = useState<number>(12); // Default 12 lessons

  const handleOpenAddStudentModal = () => {
    setEditingStudentId(null);
    setLastName('');
    setFirstName('');
    setBirthDate('2009-03-10');
    setPhone('+998 ');
    setSecondaryPhone('');
    setSchoolName('');
    setGrade('');
    setAddress('');
    setCertificatesAndBenefits('');
    setFatherName('');
    setFatherPhone('');
    setMotherName('');
    setMotherPhone('');
    setDiscountType('NONE');
    setDiscountValue(0);
    setShowAddStudentModal(true);
  };

  const handleOpenEditStudentModal = (st: Student) => {
    setEditingStudentId(st.id);
    const parts = (st.fullName || '').trim().split(/\s+/);
    setLastName(parts[0] || '');
    setFirstName(parts.slice(1).join(' ') || '');
    setBirthDate(st.birthDate || '2009-03-10');
    setPhone(formatUzbekPhoneInput(st.phone || '', false));
    setSecondaryPhone(st.secondaryPhone ? formatUzbekPhoneInput(st.secondaryPhone, true) : '');
    setSchoolName(st.schoolName || '');
    setGrade(st.grade || '');
    setAddress(st.address || '');
    setCertificatesAndBenefits(st.certificatesAndBenefits || '');
    setFatherName(st.fatherName || '');
    setFatherPhone(st.fatherPhone ? formatUzbekPhoneInput(st.fatherPhone, true) : '');
    setMotherName(st.motherName || '');
    setMotherPhone(st.motherPhone ? formatUzbekPhoneInput(st.motherPhone, true) : '');
    setDiscountType(st.discountType || 'NONE');
    setDiscountValue(st.discountValue || 0);
    setShowAddStudentModal(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lastName.trim() || !firstName.trim()) {
      alert('Заполните обязательные поля: Фамилия и Имя Ученика!');
      return;
    }

    const trimmedFullName = `${lastName.trim()} ${firstName.trim()}`;

    // Check for exact duplicate (same Full Name + same Phone number)
    const dupCheck = checkStudentDuplicate(students, trimmedFullName, phone, editingStudentId);
    if (dupCheck.isDuplicate) {
      alert(
        `🚫 Ошибка регистрации: Дублирование ученика невозможно!\n\nУченик с ФИО «${dupCheck.existingStudent?.fullName}» и номером телефона «${dupCheck.existingStudent?.phone || '—'}» уже зарегистрирован в базе данных центра.\n\nПовторная регистрация одного и того же ученика заблокирована во избежание дублирования.`
      );
      return;
    }

    const isFictionalOrEmpty = (str: string) => {
      const s = str.trim();
      if (!s) return true;
      if (/^иванов/i.test(s) || /^иванова/i.test(s) || s.toLowerCase() === 'не указано') return true;
      return false;
    };
    const isValidParentPhone = (ph: string) => {
      const digits = ph.replace(/\D/g, '');
      return digits.length >= 9;
    };

    const cleanSecondaryPhone = secondaryPhone.trim() || undefined;
    const cleanFatherName = isFictionalOrEmpty(fatherName) ? undefined : fatherName.trim();
    const cleanFatherPhone = isValidParentPhone(fatherPhone) ? fatherPhone.trim() : undefined;
    const cleanMotherName = isFictionalOrEmpty(motherName) ? undefined : motherName.trim();
    const cleanMotherPhone = isValidParentPhone(motherPhone) ? motherPhone.trim() : undefined;

    if (editingStudentId) {
      const existing = students.find((s) => s.id === editingStudentId);
      if (existing) {
        const updatedStudent: Student = {
          ...existing,
          fullName: trimmedFullName,
          birthDate,
          phone: phone.trim() || '+998 90 ',
          secondaryPhone: cleanSecondaryPhone,
          schoolName: schoolName.trim() || undefined,
          grade: grade.trim() || undefined,
          address: address.trim() || undefined,
          certificatesAndBenefits: certificatesAndBenefits.trim() || undefined,
          fatherName: cleanFatherName,
          fatherPhone: cleanFatherPhone,
          motherName: cleanMotherName,
          motherPhone: cleanMotherPhone,
          discountType,
          discountValue,
        };
        if (onUpdateStudent) {
          onUpdateStudent(updatedStudent);
        } else {
          onAddStudent(updatedStudent);
        }
        alert(`Данные ученика "${trimmedFullName}" успешно обновлены!`);
      }
    } else {
      const newStudent: Student = {
        id: `s-${Date.now()}`,
        fullName: trimmedFullName,
        birthDate,
        phone: phone.trim() || '+998 90 ',
        secondaryPhone: cleanSecondaryPhone,
        schoolName: schoolName.trim() || undefined,
        grade: grade.trim() || undefined,
        address: address.trim() || undefined,
        certificatesAndBenefits: certificatesAndBenefits.trim() || undefined,
        fatherName: cleanFatherName,
        fatherPhone: cleanFatherPhone,
        motherName: cleanMotherName,
        motherPhone: cleanMotherPhone,
        discountType,
        discountValue,
        status: 'ACTIVE',
        enrolledCourseIds: [],
      };

      onAddStudent(newStudent);
      alert(`Ученик "${trimmedFullName}" успешно зарегистрирован в базе!`);
    }

    setShowAddStudentModal(false);
  };

  const handleDeleteStudentClick = (st: Student) => {
    setStudentToDelete(st);
  };

  // 12 LESSONS RULE & 10th OF MONTH CALCULATOR FOR ENROLLMENT MODAL
  const selectedCourseObj = courses.find((c) => c.id === selectedCourseForEnroll);
  const startDayOfMonth = parseInt(enrollmentStartDate.split('-')[2], 10) || 1;
  
  const calculationPreview = selectedCourseObj
    ? calculateFirstMonthTuition(
        selectedCourseObj.monthlyPrice,
        remainingLessons,
        12,
        showEnrollModal?.discountType || 'NONE',
        showEnrollModal?.discountValue || 0,
        startDayOfMonth
      )
    : null;

  const handleConfirmEnrollment = () => {
    if (!showEnrollModal || !selectedCourseObj || !calculationPreview) return;

    const newEnrollment: Enrollment = {
      id: `en-${Date.now()}`,
      studentId: showEnrollModal.id,
      courseId: selectedCourseObj.id,
      enrollmentDate: enrollmentStartDate || getUzbekistanToday(),
      firstMonthLessonsLeft: remainingLessons,
      status: 'ACTIVE',
    };

    // Автоматический расчет первого месяца по правилу 10-го числа
    const isFull = calculationPreview.isFullMonth;
    const firstMonthPayment: Payment = {
      id: `pay-${Date.now()}`,
      studentId: showEnrollModal.id,
      courseId: selectedCourseObj.id,
      monthPeriod: enrollmentStartDate.slice(0, 7) || getUzbekistanCurrentMonthPeriod(),
      isFirstMonth: true,
      remainingLessonsCount: isFull ? 12 : remainingLessons,
      baseCalculatedAmount: calculationPreview.proportionalPrice,
      discountApplied: calculationPreview.discountAmount,
      excusedCreditDeduction: 0,
      finalAmountDue: calculationPreview.finalAmountDue,
      amountPaid: 0,
      status: isFull ? 'DEBT' : 'PARTIAL',
      notes: isFull
        ? `Полная оплата за 1-й месяц (зачисление ${enrollmentStartDate}, до 10-го числа). Скидка: ${calculationPreview.discountAmount} сум`
        : `Перерасчет 1-го месяца (${remainingLessons} из 12 уроков, зачисление ${enrollmentStartDate}). Скидка: ${calculationPreview.discountAmount} сум`,
    };

    onEnrollStudent(newEnrollment, firstMonthPayment);
    alert(
      `Ученик ${showEnrollModal.fullName} успешно зачислен на курс "${selectedCourseObj.title}"! Сумма к оплате за 1-й месяц: ${calculationPreview.finalAmountDue.toLocaleString('ru-RU')} сум.`
    );
    setShowEnrollModal(null);
  };

  // Filtering and alphabetical sorting (только по ФИО и личным контактам ученика, исключая родителей)
  const filteredStudents = useMemo(() => {
    const list = students.filter((s) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        s.fullName.toLowerCase().includes(term) ||
        (s.phone && s.phone.includes(searchTerm)) ||
        (s.secondaryPhone && s.secondaryPhone.includes(searchTerm)) ||
        (s.schoolName && s.schoolName.toLowerCase().includes(term)) ||
        (s.grade && s.grade.toLowerCase().includes(term)) ||
        (s.address && s.address.toLowerCase().includes(term));

      const matchesCourse =
        filterCourseId === 'ALL' || s.enrolledCourseIds.includes(filterCourseId);

      return matchesSearch && matchesCourse;
    });

    return sortStudentsAlphabetically(list);
  }, [students, searchTerm, filterCourseId]);

  const waitingLeadsCount = leads.filter((l) => l.status === 'WAITING_GROUP').length;

  return (
    <div className="space-y-6">
      
      {/* SubTab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-2.5 rounded-2xl shadow-xs">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('STUDENTS')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeSubTab === 'STUDENTS'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>База Учеников</span>
            <span
              className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeSubTab === 'STUDENTS'
                  ? 'bg-blue-700 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {students.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('LEADS')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeSubTab === 'LEADS'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Лиды и Предзаписи (Заказы)</span>
            <span
              className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeSubTab === 'LEADS'
                  ? 'bg-amber-600 text-white'
                  : waitingLeadsCount > 0
                  ? 'bg-amber-100 text-amber-800 font-bold border border-amber-300'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {waitingLeadsCount > 0 ? `${waitingLeadsCount} ждут` : leads.length}
            </span>
          </button>
        </div>

        {activeSubTab === 'STUDENTS' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowExcelImportModal(true)}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-700/20 transition-all shrink-0 cursor-pointer"
              title="Импортировать список учеников из файла Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>📊 Импорт из Excel</span>
            </button>
            <button
              onClick={handleOpenAddStudentModal}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all shrink-0 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Зарегистрировать ученика</span>
            </button>
          </div>
        )}
      </div>

      {activeSubTab === 'LEADS' ? (
        <LeadsManagement
          leads={leads}
          courses={courses}
          teachers={teachers}
          cabinets={cabinets}
          students={students}
          subjects={subjects}
          onAddLead={onAddLead || (() => {})}
          onUpdateLead={onUpdateLead}
          onDeleteLead={onDeleteLead}
          onClearLeads={onClearLeads}
          onConvertLeadToStudent={onConvertLeadToStudent}
        />
      ) : (
        <>
          {/* Filters & Search */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Поиск по ФИО и контактам ученика (+998)..."
            className="w-full bg-white text-xs text-slate-800 pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterCourseId}
            onChange={(e) => setFilterCourseId(e.target.value)}
            className="w-full bg-white text-xs text-slate-700 font-medium focus:outline-none"
          >
            <option value="ALL">Все группы и курсы</option>
            {courses.map((c, idx) => (
              <option key={`${c.id}-${idx}`} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Student Registry Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">ФИО / Школа и Класс</th>
                <th className="py-3.5 px-4">Адрес / Сертификаты и Льготы</th>
                <th className="py-3.5 px-4">Контакты Отца (+998)</th>
                <th className="py-3.5 px-4">Контакты Матери (+998)</th>
                <th className="py-3.5 px-4">Персональная Льгота</th>
                <th className="py-3.5 px-4">Зачисленные Курсы</th>
                <th className="py-3.5 px-4 text-center">Статус Оплаты</th>
                <th className="py-3.5 px-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                    Ученики в базе не найдены. Нажмите «Зарегистрировать нового ученика», чтобы добавить.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => {
                  const stPayments = payments.filter((p) => p.studentId === st.id);
                  const enrolledCourses = (st.enrolledCourseIds || []).map((cId) => courses.find((c) => c.id === cId)).filter(Boolean) as Course[];
                  const periodCourseKeys = new Set<string>();
                  stPayments.forEach((p) => {
                    periodCourseKeys.add(`${p.courseId}___${p.monthPeriod}`);
                  });
                  const currentMonthStr = new Date().toISOString().substring(0, 7);
                  enrolledCourses.forEach((c) => {
                    periodCourseKeys.add(`${c.id}___${currentMonthStr}`);
                  });

                  let anyDebt = false;
                  let anyPartial = false;
                  let totalExpectedAll = 0;
                  let totalPaidAll = 0;

                  periodCourseKeys.forEach((key) => {
                    const [cId, mPeriod] = key.split('___');
                    const txs = stPayments.filter((p) => p.courseId === cId && p.monthPeriod === mPeriod && (p.amountPaid || 0) > 0);
                    const paid = txs.reduce((s, p) => s + (p.amountPaid || 0), 0);
                    const baseDoc = stPayments.find((p) => p.courseId === cId && p.monthPeriod === mPeriod);
                    const crs = courses.find((c) => c.id === cId);
                    const due = baseDoc ? baseDoc.finalAmountDue : (crs?.monthlyPrice || 0);

                    totalExpectedAll += due;
                    totalPaidAll += paid;

                    if (due > 0 && paid === 0) anyDebt = true;
                    else if (due > 0 && paid < due) anyPartial = true;
                  });

                  const hasDebt = anyDebt;
                  const isPartialOrFirstMonth = !anyDebt && anyPartial;
                  const isAllPaid = totalExpectedAll > 0 && totalPaidAll >= totalExpectedAll && !anyDebt && !anyPartial;

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                      
                      {/* Student Info, School & Grade */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <p className="font-bold text-slate-800 text-sm">{st.fullName}</p>
                          {(() => {
                            const enrolled = st.enrolledCourseIds || [];
                            const frozenCourseIds = enrolled.filter((cId) => isStudentFrozenInCourse(st, cId));
                            const isLegacyFrozen = st.status === 'FROZEN' && (!st.courseFreezes || Object.keys(st.courseFreezes).length === 0);

                            if (frozenCourseIds.length === 0 && !isLegacyFrozen) return null;

                            if (isLegacyFrozen || (enrolled.length > 0 && frozenCourseIds.length >= enrolled.length)) {
                              return (
                                <span
                                  className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-850 border border-cyan-300 text-[10px] font-bold flex items-center space-x-1 shrink-0"
                                  title={`Заморожен во всех группах: ${st.freezeReason || 'без причины'}${st.freezeUntil ? ` (до ${st.freezeUntil})` : ''}`}
                                >
                                  <Snowflake className="w-3 h-3 text-cyan-600" />
                                  <span>Заморожен{st.freezeUntil ? ` до ${st.freezeUntil}` : ''}</span>
                                </span>
                              );
                            }

                            return (
                              <span
                                className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-bold flex items-center space-x-1 shrink-0"
                                title={`Заморожен в ${frozenCourseIds.length} из ${enrolled.length} групп: ${frozenCourseIds.map((cId) => courses.find((c) => c.id === cId)?.title || cId).join(', ')}`}
                              >
                                <Snowflake className="w-3 h-3 text-amber-600" />
                                <span>Заморожен ({frozenCourseIds.length}/{enrolled.length} групп)</span>
                              </span>
                            );
                          })()}
                        </div>

                        {(st.schoolName || st.grade) && (
                          <div className="flex items-center space-x-1.5 text-[11px] text-blue-700 font-semibold mt-1">
                            <School className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>
                              {st.schoolName || 'Школа не указана'}
                              {st.grade ? ` (${st.grade})` : ''}
                            </span>
                          </div>
                        )}

                        <div className="text-[11px] text-slate-500 font-mono mt-1 space-y-0.5">
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <span className="text-slate-700 font-semibold">Тел:</span>
                            <span className="text-slate-900 font-bold">{formatDisplayPhone(st.phone)}</span>
                            {st.secondaryPhone && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[10px] border border-blue-200" title="Дополнительный номер ученика">
                                Доп: {formatDisplayPhone(st.secondaryPhone)}
                              </span>
                            )}
                          </div>
                          {st.birthDate && <p className="text-[10px] text-slate-400">Род. {st.birthDate}</p>}
                        </div>
                      </td>

                      {/* Address & Certificates/Benefits */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        {st.address ? (
                          <p className="text-[11px] text-slate-700 flex items-start space-x-1 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                            <span className="truncate" title={st.address}>{st.address}</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">Адрес не указан</p>
                        )}

                        {st.certificatesAndBenefits ? (
                          <div className="mt-1 flex items-start space-x-1 text-[11px] text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200 font-medium">
                            <Award className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span className="truncate" title={st.certificatesAndBenefits}>
                              {st.certificatesAndBenefits}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 block mt-0.5">Нет сертификатов</span>
                        )}
                      </td>

                      {/* Father Info */}
                      <td className="py-3.5 px-4">
                        {st.fatherName || st.fatherPhone ? (
                          <>
                            <p className="font-semibold text-slate-700">{st.fatherName || 'Не указано'}</p>
                            {st.fatherPhone && <p className="text-[11px] text-blue-600 font-mono">{formatDisplayPhone(st.fatherPhone)}</p>}
                          </>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Не указано</span>
                        )}
                      </td>

                      {/* Mother Info */}
                      <td className="py-3.5 px-4">
                        {st.motherName || st.motherPhone ? (
                          <>
                            <p className="font-semibold text-slate-700">{st.motherName || 'Не указано'}</p>
                            {st.motherPhone && <p className="text-[11px] text-indigo-600 font-mono">{formatDisplayPhone(st.motherPhone)}</p>}
                          </>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Не указано</span>
                        )}
                      </td>

                      {/* Personal Discount / Benefit */}
                      <td className="py-3.5 px-4">
                        {st.discountType === 'NONE' ? (
                          <span className="text-slate-400">Без скидки</span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                            <Tag className="w-3 h-3" />
                            <span>
                              {st.discountType === 'PERCENTAGE'
                                ? `-${st.discountValue}%`
                                : `-${st.discountValue.toLocaleString('ru-RU')} сум`}
                            </span>
                          </span>
                        )}
                      </td>

                      {/* Enrolled Courses */}
                      <td className="py-3.5 px-4">
                        {(st.enrolledCourseIds || []).length === 0 ? (
                          <span className="text-slate-400 italic">Не зачислен</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {Array.from(new Set<string>(st.enrolledCourseIds || [])).map((cId, cIdx) => {
                              const crs = courses.find((c) => c.id === cId);
                              const isCourseFrozen = isStudentFrozenInCourse(st, cId);
                              const freezeInfo = st.courseFreezes?.[cId];
                              return (
                                <span
                                  key={`${st.id}-${cId}-${cIdx}`}
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono inline-flex items-center space-x-1 border ${
                                    isCourseFrozen
                                      ? 'bg-cyan-50 text-cyan-800 border-cyan-300 font-bold'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                  title={
                                    isCourseFrozen
                                      ? `Заморожен в этой группе${freezeInfo?.freezeUntil ? ` до ${freezeInfo.freezeUntil}` : ''}${freezeInfo?.freezeReason ? ` (${freezeInfo.freezeReason})` : ''}`
                                      : 'Активен в группе'
                                  }
                                >
                                  {isCourseFrozen && <Snowflake className="w-2.5 h-2.5 text-cyan-600 shrink-0" />}
                                  <span>{crs?.title || cId}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-4 text-center">
                        {hasDebt ? (
                          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[11px] font-extrabold inline-block">
                            🔴 Задолженность
                          </span>
                        ) : isPartialOrFirstMonth ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-extrabold inline-block">
                            🟡 Частично / 1-й мес.
                          </span>
                        ) : isAllPaid ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold inline-block">
                            🟢 Оплачено
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Новый ученик</span>
                        )}
                      </td>

                      {/* Actions: Edit, Pay, Transfer, Freeze, Enroll, Delete */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleOpenEditStudentModal(st)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors inline-flex items-center"
                            title="Редактировать анкету ученика"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {onOpenPaymentForStudent && (
                            <button
                              onClick={() => onOpenPaymentForStudent(st)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white border border-emerald-200 font-semibold text-xs transition-all inline-flex items-center space-x-1"
                              title="Внести/принять оплату курса"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Оплата</span>
                            </button>
                          )}

                          {onTransferStudent && (
                            <button
                              onClick={() => setTransferModalStudent(st)}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200 font-semibold text-xs transition-all inline-flex items-center space-x-1"
                              title="Перевести ученика в другую группу"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>Перевод</span>
                            </button>
                          )}

                          {onToggleFreezeStudent && (
                            (() => {
                              const isFiltered = filterCourseId !== 'ALL';
                              const isFrozenInView = isFiltered
                                ? isStudentFrozenInCourse(st, filterCourseId)
                                : (st.status === 'FROZEN' || isStudentFrozenInCourse(st));

                              return (
                                <button
                                  onClick={() => setFreezeModalStudent(st)}
                                  className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs transition-all inline-flex items-center space-x-1 border ${
                                    isFrozenInView
                                      ? 'bg-amber-50 hover:bg-amber-600 text-amber-700 hover:text-white border-amber-200'
                                      : 'bg-cyan-50 hover:bg-cyan-600 text-cyan-700 hover:text-white border-cyan-200'
                                  }`}
                                  title={
                                    isFiltered
                                      ? (isFrozenInView ? 'Разморозить в этой группе' : 'Заморозить в этой группе')
                                      : (isFrozenInView ? 'Разморозить ученика' : 'Заморозить ученика')
                                  }
                                >
                                  {isFrozenInView ? (
                                    <>
                                      <Sun className="w-3.5 h-3.5" />
                                      <span>Разморозка</span>
                                    </>
                                  ) : (
                                    <>
                                      <Snowflake className="w-3.5 h-3.5" />
                                      <span>Заморозка</span>
                                    </>
                                  )}
                                </button>
                              );
                            })()
                          )}

                          <button
                            onClick={() => setShowEnrollModal(st)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 font-semibold text-xs transition-all inline-flex items-center space-x-1"
                            title="Зачислить на дополнительный курс"
                          >
                            <BookPlus className="w-3.5 h-3.5" />
                            <span>Зачислить</span>
                          </button>

                          <button
                            onClick={() => handleDeleteStudentClick(st)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors inline-flex items-center"
                            title="Удалить ученика из базы"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* REGISTER / EDIT STUDENT MODAL */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <span>
                  {editingStudentId ? 'Редактирование анкеты ученика' : 'Регистрация нового ученика (+998)'}
                </span>
              </h3>
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4 text-xs">
              
              {/* Personal Info: Separate LastName and FirstName (No Patronymic) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-300 font-semibold">Данные Ученика (Фамилия и Имя) *</span>
                  {editingStudentId && (
                    <span className="text-[10px] text-blue-400 font-normal">
                      Редактирование ID: {editingStudentId}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">
                      Фамилия Ученика *
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Например: Жумагулов"
                      className={`w-full bg-slate-950 text-white p-2.5 rounded-xl border focus:outline-none transition-all ${
                        duplicateValidation.status === 'EXACT_DUPLICATE'
                          ? 'border-rose-500 ring-2 ring-rose-500/40'
                          : duplicateValidation.status === 'NAME_MATCH_PHONE_PENDING'
                          ? 'border-amber-500 ring-2 ring-amber-500/30'
                          : duplicateValidation.status === 'NAME_MATCH_DIFFERENT_PHONE'
                          ? 'border-emerald-500'
                          : 'border-slate-700 focus:ring-1 focus:ring-indigo-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">
                      Имя Ученика *
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Например: Нурсултан"
                      className={`w-full bg-slate-950 text-white p-2.5 rounded-xl border focus:outline-none transition-all ${
                        duplicateValidation.status === 'EXACT_DUPLICATE'
                          ? 'border-rose-500 ring-2 ring-rose-500/40'
                          : duplicateValidation.status === 'NAME_MATCH_PHONE_PENDING'
                          ? 'border-amber-500 ring-2 ring-amber-500/30'
                          : duplicateValidation.status === 'NAME_MATCH_DIFFERENT_PHONE'
                          ? 'border-emerald-500'
                          : 'border-slate-700 focus:ring-1 focus:ring-indigo-500'
                      }`}
                    />
                  </div>
                </div>

                {/* REAL-TIME NAME MATCH & DUPLICATE BANNER (DIRECTLY BELOW NAME INPUTS) */}
                {duplicateValidation.status === 'EXACT_DUPLICATE' && (
                  <div className="mt-2 p-3.5 rounded-xl bg-rose-950/90 border-2 border-rose-500 text-rose-200 flex items-start space-x-3 shadow-lg shadow-rose-950/50 animate-in fade-in duration-200">
                    <div className="w-8 h-8 rounded-lg bg-rose-600/30 text-rose-300 flex items-center justify-center shrink-0 mt-0.5 font-bold border border-rose-500/50">
                      <AlertTriangle className="w-5 h-5 text-rose-400" />
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-extrabold text-rose-300 uppercase tracking-wider text-[11px]">
                          🚫 Ученик уже есть в базе — Дубликат заблокирован
                        </span>
                      </div>
                      <p className="text-rose-100 text-[11px] leading-relaxed">
                        Ученик с таким ФИО (<strong>{duplicateValidation.existingStudent?.fullName}</strong>) и номером телефона (<strong>{formatDisplayPhone(duplicateValidation.existingStudent?.phone)}</strong>) уже зарегистрирован в базе учебного центра!
                      </p>
                      <p className="text-[10px] text-rose-300/90 font-medium">
                        Повторная регистрация одного и того же ученика невозможна во избежание дублирования платежей и посещаемости.
                      </p>
                    </div>
                  </div>
                )}

                {duplicateValidation.status === 'NAME_MATCH_PHONE_PENDING' && (
                  <div className="mt-2 p-3 rounded-xl bg-amber-950/80 border border-amber-500/70 text-amber-200 flex items-start space-x-2.5 shadow-sm animate-in fade-in duration-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed space-y-0.5">
                      <p className="font-bold text-amber-300">
                        ⚠️ Внимание: Ученик с таким ФИО уже есть в базе!
                      </p>
                      <p className="text-amber-100 text-[11px]">
                        Найден в базе: <strong>{duplicateValidation.existingStudent?.fullName}</strong> (телефон: <strong>{formatDisplayPhone(duplicateValidation.existingStudent?.phone)}</strong>).
                      </p>
                      <p className="text-[10px] text-amber-300/90 font-medium">
                        💡 Если это однофамилец/тёзка с другим номером — укажите его номер телефона ниже, и регистрация будет разрешена. Если номер совпадёт, система заблокирует дубликат.
                      </p>
                    </div>
                  </div>
                )}

                {duplicateValidation.status === 'NAME_MATCH_DIFFERENT_PHONE' && (
                  <div className="mt-2 p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/70 text-emerald-200 flex items-start space-x-2.5 shadow-sm animate-in fade-in duration-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed space-y-0.5">
                      <p className="font-bold text-emerald-300">
                        ✅ Однофамилец / Тёзка (Регистрация разрешена)
                      </p>
                      <p className="text-emerald-100 text-[11px]">
                        В базе уже есть <strong>{duplicateValidation.existingStudent?.fullName}</strong>, но номер телефона отличается ({formatDisplayPhone(duplicateValidation.existingStudent?.phone)} ≠ {formatDisplayPhone(phone)}). Добавление разрешено.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Дата рождения</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full bg-slate-950 text-white p-2.5 rounded-xl border border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Основной телефон ученика (+998)
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(formatUzbekPhoneInput(e.target.value, false))}
                    placeholder="+998 90 123 45 67"
                    className={`w-full bg-slate-950 text-white p-2.5 rounded-xl border font-mono transition-colors ${
                      duplicateValidation.status === 'EXACT_DUPLICATE'
                        ? 'border-rose-500 ring-2 ring-rose-500/30'
                        : duplicateValidation.status === 'NAME_MATCH_DIFFERENT_PHONE'
                        ? 'border-emerald-500'
                        : 'border-slate-700'
                    }`}
                  />
                </div>
              </div>

              {/* SECONDARY PHONE (OPTIONAL) */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 text-blue-400">
                    <Phone className="w-3.5 h-3.5" />
                    <span>Дополнительный телефон ученика / опекуна (необязательно):</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">2-й номер</span>
                </label>
                <input
                  type="text"
                  value={secondaryPhone}
                  onChange={(e) => setSecondaryPhone(formatUzbekPhoneInput(e.target.value, true))}
                  placeholder="Например: +998 91 234 56 78 (второй номер ученика)"
                  className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-700 font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  Укажите дополнительный номер ученика, если у него две SIM-карты или для связи с опекуном.
                </p>
              </div>

              {/* SCHOOL AND GRADE FIELDS (NEW) */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <span className="font-bold text-blue-400 uppercase text-[10px] tracking-wider flex items-center space-x-1.5">
                  <School className="w-3.5 h-3.5 text-blue-400" />
                  <span>Школа и Класс обучения (необязательно)</span>
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Название школы / лицея:</label>
                    <input
                      type="text"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="Например: Школа №12 / Президентская школа"
                      className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">В каком классе учится:</label>
                    <input
                      type="text"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder="Например: 9-А класс / 11 класс"
                      className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* RESIDENTIAL ADDRESS FIELD (NEW) */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <label className="block text-slate-300 font-bold mb-1 flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>Адрес проживания ученика (необязательно):</span>
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Например: г. Нукус, мкр. 22, д. 15, кв. 4"
                  className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-700"
                />
              </div>

              {/* ADDITIONAL CERTIFICATES AND BENEFITS (NEW) */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <label className="block text-slate-300 font-bold mb-1 flex items-center space-x-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>Дополнительные льготы и сертификаты по предметам (необязательно):</span>
                </label>
                <input
                  type="text"
                  value={certificatesAndBenefits}
                  onChange={(e) => setCertificatesAndBenefits(e.target.value)}
                  placeholder="Например: IELTS 7.0, Сертификат B2 по математике, Доп. льгота"
                  className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-700"
                />
              </div>

              {/* FATHER CONTACTS */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-400 uppercase text-[10px] tracking-wider">
                    Данные Отца (необязательно)
                  </span>
                  <span className="text-[10px] text-slate-500">Заполните, если есть</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">ФИО Отца:</label>
                    <input
                      type="text"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      placeholder="Не указано (оставьте пустым, если нет отца)"
                      className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Телефон Отца (+998):</label>
                    <input
                      type="text"
                      value={fatherPhone}
                      onChange={(e) => setFatherPhone(formatUzbekPhoneInput(e.target.value, true))}
                      placeholder="+998 90 123 45 67"
                      className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-700 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* MOTHER CONTACTS */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-400 uppercase text-[10px] tracking-wider">
                    Данные Матери (необязательно)
                  </span>
                  <span className="text-[10px] text-slate-500">Заполните, если есть</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">ФИО Матери:</label>
                    <input
                      type="text"
                      value={motherName}
                      onChange={(e) => setMotherName(e.target.value)}
                      placeholder="Не указано (оставьте пустым, если нет матери)"
                      className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Телефон Матери (+998):</label>
                    <input
                      type="text"
                      value={motherPhone}
                      onChange={(e) => setMotherPhone(formatUzbekPhoneInput(e.target.value, true))}
                      placeholder="+998 91 234 56 78"
                      className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-700 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Personal Benefits and Discounts Field */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <label className="block text-slate-300 font-bold mb-1">
                  Персональные фин. льготы и скидки ученика:
                </label>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDiscountType('NONE')}
                    className={`p-2 rounded-lg text-center border font-semibold ${
                      discountType === 'NONE'
                        ? 'bg-indigo-600/30 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Без скидки
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscountType('PERCENTAGE')}
                    className={`p-2 rounded-lg text-center border font-semibold ${
                      discountType === 'PERCENTAGE'
                        ? 'bg-indigo-600/30 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Процент (%)
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscountType('FIXED_SUM')}
                    className={`p-2 rounded-lg text-center border font-semibold ${
                      discountType === 'FIXED_SUM'
                        ? 'bg-indigo-600/30 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Фикс. Сумма (сум)
                  </button>
                </div>

                {discountType !== 'NONE' && (
                  <div className="pt-2">
                    <label className="block text-slate-400 mb-1">
                      Значение скидки ({discountType === 'PERCENTAGE' ? '%' : 'сум'}):
                    </label>
                    <input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                      className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-700"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <div>
                  {duplicateValidation.isDuplicate && (
                    <span className="text-[11px] text-rose-400 font-bold flex items-center space-x-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Дубликат: сохранение заблокировано</span>
                    </span>
                  )}
                </div>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddStudentModal(false)}
                    className="px-4 py-2 text-slate-400 hover:text-white"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={duplicateValidation.isDuplicate}
                    title={
                      duplicateValidation.isDuplicate
                        ? 'Невозможно сохранить: ученик с таким ФИО и номером уже зарегистрирован'
                        : undefined
                    }
                    className={`px-5 py-2.5 rounded-xl font-bold transition-all ${
                      duplicateValidation.isDuplicate
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60 shadow-none'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 cursor-pointer'
                    }`}
                  >
                    {editingStudentId ? 'Сохранить изменения' : 'Зарегистрировать'}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ENROLLMENT MODAL */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <BookPlus className="w-5 h-5 text-indigo-400" />
                  <span>Зачисление ученика на курс</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ученик: <strong className="text-white">{showEnrollModal.fullName}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowEnrollModal(null)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Выберите курс для зачисления:
                  </label>
                  <select
                    value={selectedCourseForEnroll}
                    onChange={(e) => setSelectedCourseForEnroll(e.target.value)}
                    className="w-full bg-slate-950 text-white font-semibold p-2.5 rounded-xl border border-slate-700 focus:outline-none"
                  >
                    {courses.map((c, idx) => (
                      <option key={`${c.id}-${idx}`} value={c.id}>
                        {c.title} ({c.monthlyPrice.toLocaleString('ru-RU')} сум/мес)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Дата первого урока / начала занятий:
                  </label>
                  <input
                    type="date"
                    value={enrollmentStartDate}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setEnrollmentStartDate(newDate);
                      const day = parseInt(newDate.split('-')[2], 10) || 1;
                      if (day <= 10) {
                        setRemainingLessons(12);
                      }
                    }}
                    className="w-full bg-slate-950 text-white font-semibold p-2.5 rounded-xl border border-slate-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* Status Banner: Rule of 10th day */}
              {startDayOfMonth <= 10 ? (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-start space-x-2 text-emerald-300">
                  <span className="text-base">🟢</span>
                  <div>
                    <p className="font-bold">Начало занятий до 10-го числа ({startDayOfMonth}-е число)</p>
                    <p className="text-[11px] text-emerald-400/90 mt-0.5">
                      При зачислении до 10-го числа начисляется <strong>полная месячная сумма курса</strong> без деления на 12 уроков.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl flex items-start space-x-2 text-amber-300">
                  <span className="text-base">🟠</span>
                  <div>
                    <p className="font-bold">Начало занятий после 10-го числа ({startDayOfMonth}-е число)</p>
                    <p className="text-[11px] text-amber-400/90 mt-0.5">
                      Действует перерасчет пропорционально количеству оставшихся уроков в этом месяце.
                    </p>
                  </div>
                </div>
              )}

              {/* 12 Lessons Rule Input (Only active / relevant when after 10th or manually adjusted) */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-200 flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Количество уроков к оплате за 1-й месяц:</span>
                  </label>
                  <span className="font-mono font-bold text-amber-400 text-sm">
                    {remainingLessons} / 12 уроков
                  </span>
                </div>

                <input
                  type="range"
                  min={1}
                  max={12}
                  value={remainingLessons}
                  onChange={(e) => setRemainingLessons(Number(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-900"
                />

                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>1 урок</span>
                  <span>6 уроков</span>
                  <span>12 уроков (Полный месяц)</span>
                </div>
              </div>

              {/* Live Calculation Preview Card */}
              {calculationPreview && selectedCourseObj && (
                <div className="bg-indigo-950/30 border border-indigo-500/30 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between text-slate-300">
                    <span>Базовая цена курса:</span>
                    <span className="font-mono font-bold">{selectedCourseObj.monthlyPrice.toLocaleString('ru-RU')} сум</span>
                  </div>
                  {calculationPreview.isFullMonth ? (
                    <div className="flex justify-between text-emerald-400 text-xs">
                      <span>Режим начисления:</span>
                      <span className="font-bold">Полный месяц (100% стоимости)</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-slate-300">
                        <span>Цена 1 урока ({selectedCourseObj.monthlyPrice.toLocaleString('ru-RU')} / 12):</span>
                        <span className="font-mono">{calculationPreview.pricePerLesson.toLocaleString('ru-RU')} сум</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Перерасчет за {remainingLessons} уроков:</span>
                        <span className="font-mono">{calculationPreview.proportionalPrice.toLocaleString('ru-RU')} сум</span>
                      </div>
                    </>
                  )}
                  {calculationPreview.discountAmount > 0 && (
                    <div className="flex justify-between text-amber-400 font-semibold">
                      <span>Примененная скидка/льгота:</span>
                      <span className="font-mono">-{calculationPreview.discountAmount.toLocaleString('ru-RU')} сум</span>
                    </div>
                  )}
                  <div className="border-t border-indigo-500/20 pt-2 flex justify-between items-center">
                    <span className="font-bold text-white text-sm">Итого к оплате за 1-й месяц:</span>
                    <span className="font-bold text-emerald-400 text-lg">
                      {calculationPreview.finalAmountDue.toLocaleString('ru-RU')} сум
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEnrollment}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30"
                >
                  Подтвердить зачисление
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Transfer Student Modal */}
      {transferModalStudent && onTransferStudent && (
        <TransferStudentModal
          student={transferModalStudent}
          currentCourseId={filterCourseId !== 'ALL' ? filterCourseId : undefined}
          courses={courses}
          teachers={teachers}
          onClose={() => setTransferModalStudent(null)}
          onTransfer={(sId, fromId, toId) => {
            onTransferStudent(sId, fromId, toId);
            setTransferModalStudent(null);
          }}
        />
      )}

      {/* Freeze / Unfreeze Student Modal */}
      {freezeModalStudent && onToggleFreezeStudent && (
        <FreezeStudentModal
          student={freezeModalStudent}
          courseId={filterCourseId !== 'ALL' ? filterCourseId : undefined}
          availableCourses={courses}
          onClose={() => setFreezeModalStudent(null)}
          onToggleFreeze={(sId, targetCourseId, reason, freezeUntil) => {
            onToggleFreezeStudent(sId, targetCourseId, reason, freezeUntil);
            setFreezeModalStudent(null);
          }}
        />
      )}

      {/* Excel Bulk Import Modal */}
      {showExcelImportModal && (
        <StudentExcelImportModal
          isOpen={showExcelImportModal}
          onClose={() => setShowExcelImportModal(false)}
          existingStudents={students}
          onImportStudents={async (newStudents) => {
            if (onImportStudents) {
              await onImportStudents(newStudents);
            } else {
              newStudents.forEach((st) => onAddStudent(st));
            }
          }}
        />
      )}

      {/* Delete Student Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  Удалить ученика?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <strong className="text-slate-800 dark:text-slate-200">{studentToDelete.fullName}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Вы уверены, что хотите безвозвратно удалить ученика «{studentToDelete.fullName}» из базы учебного центра?
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteStudent && studentToDelete) {
                    onDeleteStudent(studentToDelete.id);
                  }
                  setStudentToDelete(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-rose-600/20 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Да, удалить</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
