import React, { useState, useEffect, useMemo } from 'react';
import { Search, DollarSign, CheckCircle2, User, Phone, CreditCard, Banknote, BookOpen, X, Printer, AlertCircle, UserCheck } from 'lucide-react';
import { Student, Course, Payment, PaymentMethod, Enrollment, StaffMember, User as AppUser } from '../types';
import {
  getUzbekistanLocaleString,
  getUzbekistanCurrentMonthPeriod,
  formatMonthPeriodLabel,
  getGeneratedMonthPeriods,
} from '../lib/dateUtils';
import { formatDisplayPhone } from '../lib/phoneUtils';
import { sortStudentsAlphabetically } from '../lib/sortingUtils';
import { ReceiptModal, ReceiptData } from './ReceiptModal';

interface QuickPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  courses: Course[];
  payments: Payment[];
  enrollments?: Enrollment[];
  preselectedStudent?: Student | null;
  onRegisterPayment: (
    paymentId: string,
    amountPaid: number,
    status: Payment['status'],
    method: PaymentMethod,
    notes?: string,
    recordedBy?: string
  ) => void;
  onSubmitPayment?: (
    studentId: string,
    courseId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    monthPeriod?: string,
    recordedBy?: string
  ) => void;
  currentUser?: AppUser | null;
  staffMembers?: StaffMember[];
}

export const QuickPaymentModal: React.FC<QuickPaymentModalProps> = ({
  isOpen,
  onClose,
  students,
  courses,
  payments,
  enrollments = [],
  preselectedStudent = null,
  onRegisterPayment,
  onSubmitPayment,
  currentUser,
  staffMembers,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const currentActualMonth = getUzbekistanCurrentMonthPeriod();
  const [selectedMonthPeriod, setSelectedMonthPeriod] = useState<string>(() => currentActualMonth);
  const [payAmountInput, setPayAmountInput] = useState<string>(''); // Clean input, no auto-fill or 0
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CARD');
  const [selectedAdmin, setSelectedAdmin] = useState<string>(() => currentUser?.fullName || 'Главный Администратор');
  const [payNotes, setPayNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);

  useEffect(() => {
    if (currentUser?.fullName) {
      setSelectedAdmin(currentUser.fullName);
    }
  }, [currentUser]);

  const availablePeriods = useMemo(() => {
    return getGeneratedMonthPeriods(currentActualMonth, 8, 4);
  }, [currentActualMonth]);

  // Filter students by search term (Full Name, student phone, father phone, mother phone - sorted alphabetically)
  const matchingStudents = useMemo(() => {
    if (searchTerm.trim() === '') {
      return sortStudentsAlphabetically(students).slice(0, 10);
    }
    const q = searchTerm.toLowerCase();
    const filtered = students.filter((s) =>
      s.fullName.toLowerCase().includes(q) ||
      s.phone.includes(searchTerm) ||
      (s.secondaryPhone && s.secondaryPhone.includes(searchTerm))
    );
    return sortStudentsAlphabetically(filtered);
  }, [students, searchTerm]);

  // List of courses the selected student currently attends
  // List of courses the selected student currently attends (ONLY active courses they are currently enrolled in)
  const studentAttendingCourses = useMemo(() => {
    if (!selectedStudent) return [];
    
    const attendingCourseIds = new Set<string>();
    
    // 1. From student's enrolledCourseIds
    (selectedStudent.enrolledCourseIds || []).forEach((id) => attendingCourseIds.add(id));
    
    // 2. From active enrollments
    if (enrollments && enrollments.length > 0) {
      enrollments
        .filter((e) => e.studentId === selectedStudent.id && e.status === 'ACTIVE')
        .forEach((e) => attendingCourseIds.add(e.courseId));
    }
      
    // Only return courses the student is currently enrolled in and which are not archived
    return courses.filter((c) => attendingCourseIds.has(c.id) && c.isActive !== false);
  }, [selectedStudent, courses, enrollments]);

  // Unpaid past debts for this student (periods before current actual month)
  const studentPastDebts = useMemo(() => {
    if (!selectedStudent) return [];
    return payments.filter(
      (p) =>
        p.studentId === selectedStudent.id &&
        selectedStudent.enrolledCourseIds?.includes(p.courseId) &&
        p.monthPeriod < currentActualMonth &&
        (p.status === 'DEBT' || p.status === 'PARTIAL' || p.amountPaid < p.finalAmountDue)
    );
  }, [selectedStudent, payments, currentActualMonth]);

  const handleSelectStudent = (st: Student) => {
    setSelectedStudent(st);
    const stPayments = payments.filter((p) => p.studentId === st.id);
    
    // Determine student's courses (strictly current enrolled active courses)
    const attendingIds = new Set<string>(st.enrolledCourseIds || []);
    if (enrollments && enrollments.length > 0) {
      enrollments
        .filter((e) => e.studentId === st.id && e.status === 'ACTIVE')
        .forEach((e) => attendingIds.add(e.courseId));
    }
    
    const stCourses = courses.filter((c) => attendingIds.has(c.id) && c.isActive !== false);
    const targetCourseId = stCourses.length > 0 ? stCourses[0].id : '';
    setSelectedCourseId(targetCourseId);

    // Keep selectedMonthPeriod default to current actual month (synchronized with real date)
    const monthToUse = selectedMonthPeriod || currentActualMonth;
    setSelectedMonthPeriod(monthToUse);

    // Find bill strictly for this course and month period
    const matchingBill = targetCourseId
      ? stPayments.find((p) => p.courseId === targetCourseId && p.monthPeriod === monthToUse)
      : null;
    setSelectedPayment(matchingBill || null);

    // Automatically suggest remaining debt or standard price for the selected current course
    if (targetCourseId) {
      const coursePayments = payments.filter(
        (p) => p.studentId === st.id && p.courseId === targetCourseId && p.monthPeriod === monthToUse && (p.amountPaid || 0) > 0
      );
      const totalPaid = coursePayments.reduce((s, p) => s + (p.amountPaid || 0), 0);
      const crs = courses.find((c) => c.id === targetCourseId);
      const finalDue = matchingBill ? matchingBill.finalAmountDue : (crs?.monthlyPrice || 0);
      const remainingDebt = Math.max(0, finalDue - totalPaid);
      if (remainingDebt > 0) {
        setPayAmountInput(String(remainingDebt));
      } else if (totalPaid === 0 && finalDue > 0) {
        setPayAmountInput(String(finalDue));
      } else {
        setPayAmountInput('');
      }
    } else {
      setPayAmountInput('');
    }

    setSuccessMessage('');
    setReceiptData(null);
  };

  useEffect(() => {
    if (preselectedStudent && isOpen) {
      handleSelectStudent(preselectedStudent);
    }
  }, [preselectedStudent, isOpen]);

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    if (!selectedStudent) return;

    // Do NOT overwrite selectedMonthPeriod with past month! Keep current/chosen month
    const monthToUse = selectedMonthPeriod || currentActualMonth;
    const coursePayments = payments.filter(
      (p) => p.studentId === selectedStudent.id && p.courseId === courseId && p.monthPeriod === monthToUse && (p.amountPaid || 0) > 0
    );
    const totalPaid = coursePayments.reduce((s, p) => s + (p.amountPaid || 0), 0);
    const existingBill = payments.find(
      (p) => p.studentId === selectedStudent.id && p.courseId === courseId && p.monthPeriod === monthToUse
    );
    const crs = courses.find((c) => c.id === courseId);
    const finalDue = existingBill ? existingBill.finalAmountDue : (crs?.monthlyPrice || 0);
    const remainingDebt = Math.max(0, finalDue - totalPaid);

    setSelectedPayment(existingBill || null);
    if (remainingDebt > 0) {
      setPayAmountInput(String(remainingDebt));
    } else if (totalPaid === 0 && finalDue > 0) {
      setPayAmountInput(String(finalDue));
    } else {
      setPayAmountInput('');
    }
  };

  const handleSelectMonthPeriod = (newMonth: string) => {
    setSelectedMonthPeriod(newMonth);
    if (!selectedStudent || !selectedCourseId) return;

    const coursePayments = payments.filter(
      (p) => p.studentId === selectedStudent.id && p.courseId === selectedCourseId && p.monthPeriod === newMonth && (p.amountPaid || 0) > 0
    );
    const totalPaid = coursePayments.reduce((s, p) => s + (p.amountPaid || 0), 0);
    const matchedBill = payments.find(
      (p) => p.studentId === selectedStudent.id && p.courseId === selectedCourseId && p.monthPeriod === newMonth
    );
    const crs = courses.find((c) => c.id === selectedCourseId);
    const finalDue = matchedBill ? matchedBill.finalAmountDue : (crs?.monthlyPrice || 0);
    const remainingDebt = Math.max(0, finalDue - totalPaid);

    setSelectedPayment(matchedBill || null);
    if (remainingDebt > 0) {
      setPayAmountInput(String(remainingDebt));
    } else if (totalPaid === 0 && finalDue > 0) {
      setPayAmountInput(String(finalDue));
    } else {
      setPayAmountInput('');
    }
  };

  // Restrict sum input to digits only
  const handleAmountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const digitsOnly = rawVal.replace(/\D/g, '');
    setPayAmountInput(digitsOnly);
  };

  const handleProcessPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert('Выберите ученика для оплаты!');
      return;
    }
    if (!selectedCourseId) {
      alert('Выберите курс для оплаты!');
      return;
    }

    const numericAmount = parseInt(payAmountInput, 10);
    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      alert('Введите корректную сумму оплаты (только цифры)!');
      return;
    }

    const methodText = payMethod === 'CASH' ? 'Наличные' : 'Перевод по карте';
    const courseObj = courses.find((c) => c.id === selectedCourseId);
    const courseTitle = courseObj?.title || 'Курс';
    const formattedMonth = formatMonthPeriodLabel(selectedMonthPeriod);

    if (onSubmitPayment) {
      onSubmitPayment(selectedStudent.id, selectedCourseId, numericAmount, payMethod, selectedMonthPeriod, selectedAdmin);
    } else if (onRegisterPayment) {
      const coursePayments = payments.filter(
        (p) => p.studentId === selectedStudent.id && p.courseId === selectedCourseId && p.monthPeriod === selectedMonthPeriod && (p.amountPaid || 0) > 0
      );
      const targetId = coursePayments.length > 0
        ? `new___${selectedStudent.id}___${selectedCourseId}___${selectedMonthPeriod}`
        : (selectedPayment?.id || `virt___${selectedStudent.id}___${selectedCourseId}___${selectedMonthPeriod}`);
      const updatedNotes = `${payNotes ? payNotes + ' | ' : ''}За период: ${formattedMonth} | Оплачено ${numericAmount.toLocaleString('ru-RU')} сум (${methodText})`;
      onRegisterPayment(targetId, numericAmount, 'PAID', payMethod, updatedNotes, selectedAdmin);
    }

    const newReceipt: ReceiptData = {
      receiptId: `REC-${Date.now().toString().slice(-6)}`,
      studentName: selectedStudent.fullName,
      studentPhone: selectedStudent.phone,
      courseTitle,
      amountPaid: numericAmount,
      monthPeriod: formattedMonth,
      paymentMethod: payMethod,
      dateStr: getUzbekistanLocaleString(),
      adminName: selectedAdmin,
      notes: payNotes || undefined,
    };

    setReceiptData(newReceipt);
    setSuccessMessage(
      `Успешно! Принята оплата ${numericAmount.toLocaleString('ru-RU')} сум (${methodText}) за курс "${courseTitle}" от ученика ${selectedStudent.fullName}.`
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Быстрый Прием Оплаты Взносов</h2>
              <p className="text-xs text-slate-500">
                Поиск ученика по ФИО/Телефону и зачисление оплаты (Наличные / Перевод по карте)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Success Alert */}
        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold space-y-3 animate-in fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            {receiptData && (
              <div className="pt-2 border-t border-emerald-200 flex items-center justify-between">
                <span className="text-[11px] text-emerald-700">Готов чек об оплате. Можно распечатать:</span>
                <button
                  type="button"
                  onClick={() => setIsReceiptOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm flex items-center space-x-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Распечатать чек</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Search Student */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            1. Поиск ученика в базе (по ФИО или номеру телефона)
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedStudent(null);
                setSuccessMessage('');
                setReceiptData(null);
              }}
              placeholder="Введите ФИО или личный телефон ученика..."
              className="w-full bg-slate-50 text-xs text-slate-800 pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Student Search Dropdown Suggestions */}
          {!selectedStudent && (
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto shadow-xs">
              {matchingStudents.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Ученики по данному запросу не найдены. Проверьте правильность ФИО или телефона.
                </div>
              ) : (
                matchingStudents.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => handleSelectStudent(st)}
                    className="p-3 hover:bg-blue-50/60 cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs font-bold text-slate-800">{st.fullName}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mt-1 font-mono">
                        <span className="flex items-center space-x-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>Ученик: {formatDisplayPhone(st.phone)}</span>
                        </span>
                        {st.fatherPhone && <span>| Отец ({st.fatherName || 'Отец'}): {formatDisplayPhone(st.fatherPhone)}</span>}
                        {st.motherPhone && <span>| Мать ({st.motherName || 'Мать'}): {formatDisplayPhone(st.motherPhone)}</span>}
                      </div>
                    </div>
                    <button className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] shadow-xs">
                      Выбрать
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Step 2: Selected Student & Courses Payment Form */}
        {selectedStudent && (
          <form onSubmit={handleProcessPayment} className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in">
            
            {/* Selected Student Summary Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Выбранный ученик:</span>
                <h4 className="text-sm font-black text-slate-900">{selectedStudent.fullName}</h4>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Тел: {formatDisplayPhone(selectedStudent.phone)} | Род. Отец: {formatDisplayPhone(selectedStudent.fatherPhone)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedStudent(null);
                  setSelectedPayment(null);
                  setPayAmountInput('');
                  setSuccessMessage('');
                  setReceiptData(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-700 underline self-start sm:self-center"
              >
                Изменить ученика
              </button>
            </div>

            {/* Select Course Payment Account */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Выберите курс для оплаты ({studentAttendingCourses.length})
                </label>
                {studentAttendingCourses.length > 0 && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ✓ Курсы выбранного ученика
                  </span>
                )}
              </div>

              {studentAttendingCourses.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Ученик еще не зачислен ни на один курс</span>
                  </div>
                  <p className="text-amber-700">
                    Выберите курс из общего списка для первичного приема оплаты или зачислите ученика в реестре:
                  </p>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => handleSelectCourse(e.target.value)}
                    className="w-full bg-white text-slate-900 font-bold p-2.5 rounded-xl border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Выберите курс --</option>
                    {courses.map((crs, idx) => (
                      <option key={`${crs.id}-${idx}`} value={crs.id}>
                        {crs.title} ({crs.monthlyPrice.toLocaleString('ru-RU')} сум)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {studentAttendingCourses.map((crs, idx) => {
                    const coursePayments = payments.filter(
                      (p) => p.studentId === selectedStudent.id && p.courseId === crs.id && p.monthPeriod === selectedMonthPeriod && (p.amountPaid || 0) > 0
                    );
                    const totalPaid = coursePayments.reduce((s, p) => s + (p.amountPaid || 0), 0);
                    const existingBill = payments.find(
                      (p) => p.studentId === selectedStudent.id && p.courseId === crs.id && p.monthPeriod === selectedMonthPeriod
                    );
                    const isSelected = selectedCourseId === crs.id;
                    const finalDue = existingBill ? existingBill.finalAmountDue : crs.monthlyPrice;
                    const debt = Math.max(0, finalDue - totalPaid);
                    const pastDebt = payments.find(
                      (p) =>
                        p.studentId === selectedStudent.id &&
                        p.courseId === crs.id &&
                        p.monthPeriod < selectedMonthPeriod &&
                        (p.status === 'DEBT' || p.status === 'PARTIAL' || p.amountPaid < p.finalAmountDue)
                    );

                    const currentStatus = totalPaid >= finalDue && finalDue > 0
                      ? 'PAID'
                      : totalPaid > 0
                      ? 'PARTIAL'
                      : (existingBill?.status || 'DEBT');

                    return (
                      <div
                        key={`${crs.id}-${idx}`}
                        onClick={() => handleSelectCourse(crs.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <BookOpen className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-bold text-slate-800">{crs.title}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                              Зачислен
                            </span>
                            {pastDebt && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-300">
                                Долг за {formatMonthPeriodLabel(pastDebt.monthPeriod)}
                              </span>
                            )}
                          </div>
                          
                          {existingBill || totalPaid > 0 ? (
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              currentStatus === 'PAID'
                                ? 'bg-emerald-100 text-emerald-700'
                                : currentStatus === 'PARTIAL'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}>
                              {currentStatus === 'PAID' ? 'Оплачено' : currentStatus === 'PARTIAL' ? 'Частично' : 'Задолженность'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-500">
                              Стоимость: {crs.monthlyPrice.toLocaleString('ru-RU')} сум
                            </span>
                          )}
                        </div>

                        {(existingBill || totalPaid > 0) && (
                          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-100 font-mono">
                            <span className="text-slate-500">
                              К оплате ({formatMonthPeriodLabel(selectedMonthPeriod)}): <strong className="text-slate-800">{finalDue.toLocaleString('ru-RU')} сум</strong>
                            </span>
                            <span className="text-slate-500">
                              Оплачено{coursePayments.length > 1 ? ` (${coursePayments.length} взн.)` : ''}: <strong className="text-emerald-600">{totalPaid.toLocaleString('ru-RU')} сум</strong>
                            </span>
                            <span className="text-slate-500">
                              Остаток долга: <strong className={debt > 0 ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                                {debt.toLocaleString('ru-RU')} сум
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 3: Enter Payment Details */}
            {selectedCourseId && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  3. Сумма и период оплаты
                </label>

                {/* Month Period Selection */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800">
                      За какой месяц проводится оплата (Период):
                    </label>
                    <span className="text-[10px] font-extrabold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded border border-blue-200">
                      Реальный текущий месяц: {formatMonthPeriodLabel(currentActualMonth)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={selectedMonthPeriod}
                      onChange={(e) => handleSelectMonthPeriod(e.target.value)}
                      className="bg-white text-slate-900 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                    >
                      {availablePeriods.map((period) => {
                        let suffix = '';
                        if (period === currentActualMonth) suffix = ' (Текущий реальный месяц - по умолчанию)';
                        else if (period < currentActualMonth) suffix = ' (Прошлый период / долг)';
                        else suffix = ' (Будущий период / предоплата)';
                        return (
                          <option key={period} value={period}>
                            📅 {formatMonthPeriodLabel(period)} {suffix}
                          </option>
                        );
                      })}
                    </select>

                    <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs">
                      <span className="text-[11px] text-slate-500 whitespace-nowrap">Или выбрать:</span>
                      <input
                        type="month"
                        value={selectedMonthPeriod}
                        onChange={(e) => {
                          if (e.target.value) handleSelectMonthPeriod(e.target.value);
                        }}
                        className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none w-full cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Past Debts Alert Banner */}
                  {studentPastDebts.length > 0 && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <div className="text-[11px] text-amber-900">
                          <span className="font-bold">Обнаружен долг за прошлый период: </span>
                          {studentPastDebts.map((d) => (
                            <span key={d.id} className="font-semibold mr-1">
                              {formatMonthPeriodLabel(d.monthPeriod)} ({(d.finalAmountDue - d.amountPaid).toLocaleString('ru-RU')} сум)
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {studentPastDebts.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              setSelectedCourseId(d.courseId);
                              handleSelectMonthPeriod(d.monthPeriod);
                            }}
                            className="text-[10px] font-bold px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all cursor-pointer shadow-2xs"
                          >
                            Оплатить за {formatMonthPeriodLabel(d.monthPeriod)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Method Selector (Cash vs Card Transfer) */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPayMethod('CASH')}
                    className={`p-3 rounded-xl border flex items-center justify-center space-x-2 font-bold text-xs transition-all ${
                      payMethod === 'CASH'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>💵 Наличные</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayMethod('CARD')}
                    className={`p-3 rounded-xl border flex items-center justify-center space-x-2 font-bold text-xs transition-all ${
                      payMethod === 'CARD'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>💳 Перевод по карте</span>
                  </button>
                </div>

                {/* Payment summary & quick buttons */}
                {(() => {
                  const coursePayments = payments.filter(
                    (p) => p.studentId === selectedStudent.id && p.courseId === selectedCourseId && p.monthPeriod === selectedMonthPeriod && (p.amountPaid || 0) > 0
                  );
                  const totalPaid = coursePayments.reduce((s, p) => s + (p.amountPaid || 0), 0);
                  const existingBill = payments.find(
                    (p) => p.studentId === selectedStudent.id && p.courseId === selectedCourseId && p.monthPeriod === selectedMonthPeriod
                  );
                  const courseObj = courses.find((c) => c.id === selectedCourseId);
                  const finalDue = existingBill ? existingBill.finalAmountDue : (courseObj?.monthlyPrice || 0);
                  const remainingDebt = Math.max(0, finalDue - totalPaid);

                  return (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">К оплате за {formatMonthPeriodLabel(selectedMonthPeriod)}:</span>
                        <span className="font-mono font-bold text-slate-800">{finalDue.toLocaleString('ru-RU')} сум</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Ранее внесено{coursePayments.length > 0 ? ` (${coursePayments.length} взн.)` : ''}:</span>
                        <span className="font-mono font-bold text-emerald-600">{totalPaid.toLocaleString('ru-RU')} сум</span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                        <span className="font-bold text-slate-700">Остаток долга:</span>
                        <span className={`font-mono font-bold ${remainingDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {remainingDebt.toLocaleString('ru-RU')} сум
                        </span>
                      </div>
                      {remainingDebt > 0 && totalPaid > 0 && (
                        <div className="pt-1 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setPayAmountInput(String(remainingDebt))}
                            className="text-[11px] font-bold px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Внести остаток: {remainingDebt.toLocaleString('ru-RU')} сум
                          </button>
                          <button
                            type="button"
                            onClick={() => setPayAmountInput(String(finalDue))}
                            className="text-[11px] font-bold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Вся сумма: {finalDue.toLocaleString('ru-RU')} сум
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Amount Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Сумма вносимой оплаты (только цифры):
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={payAmountInput}
                      onChange={handleAmountInputChange}
                      placeholder="Введите сумму в сум (например: 600000)..."
                      className="w-full bg-slate-50 text-slate-900 font-mono font-bold text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-4 top-2.5 text-xs font-bold text-slate-400">сум</span>
                  </div>
                </div>

                {/* Optional Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Примечание к квитанции (опционально)
                  </label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="Например: Чек #4091 или оплата от отца"
                    className="w-full bg-slate-50 text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>

                {/* Admin who accepts the payment */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Кто принимает оплату (Администратор) *</span>
                  </label>
                  <select
                    value={selectedAdmin}
                    onChange={(e) => setSelectedAdmin(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {selectedAdmin && (
                      <option value={selectedAdmin}>
                        {selectedAdmin}
                      </option>
                    )}
                    {currentUser?.fullName && currentUser.fullName !== selectedAdmin && (
                      <option value={currentUser.fullName}>
                        {currentUser.fullName} (Текущий пользователь)
                      </option>
                    )}
                    {staffMembers
                      ?.filter((s) => s.role === 'ADMIN' || s.role === 'DIRECTOR')
                      .filter((s) => s.fullName !== selectedAdmin)
                      .map((s) => (
                        <option key={s.id} value={s.fullName}>
                          {s.fullName} ({s.role === 'DIRECTOR' ? 'Директор' : 'Администратор'})
                        </option>
                      ))}
                    {selectedAdmin !== 'Главный Администратор' && (
                      <option value="Главный Администратор">Главный Администратор</option>
                    )}
                  </select>
                </div>

                {/* Submit Payment Button */}
                <div className="flex justify-end space-x-3 pt-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                  >
                    Закрыть
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center space-x-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Провести платеж {payAmountInput ? `(${parseInt(payAmountInput, 10).toLocaleString('ru-RU')} сум)` : ''}</span>
                  </button>
                </div>

              </div>
            )}

          </form>
        )}

      </div>

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receipt={receiptData}
      />
    </div>
  );
};
