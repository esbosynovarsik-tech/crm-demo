import React, { useState, useEffect } from 'react';
import {
  X,
  Edit3,
  CreditCard,
  Banknote,
  DollarSign,
  User as UserIcon,
  UserCheck,
  Calendar,
  AlertCircle,
  Snowflake,
  Check,
  CheckCircle2,
  Printer,
  Sparkles,
  HelpCircle,
  ShieldAlert,
  Clock,
  HeartHandshake,
  RefreshCw,
} from 'lucide-react';
import { Payment, Student, Course, PaymentMethod, PaymentStatus, StaffMember, User } from '../types';
import { calculateFreezeDeduction, roundToThousand } from '../lib/billingLogic';
import { getUzbekistanToday, getUzbekistanISOString } from '../lib/dateUtils';

interface EditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  student?: Student;
  course?: Course;
  onSavePayment: (updatedPayment: Payment, shouldPrintReceipt?: boolean) => void;
  currentUser?: User | null;
  staffMembers?: StaffMember[];
}

export const EditPaymentModal: React.FC<EditPaymentModalProps> = ({
  isOpen,
  onClose,
  payment,
  student,
  course,
  onSavePayment,
  currentUser,
  staffMembers,
}) => {
  const currentCoursePrice = course?.monthlyPrice || payment?.baseCalculatedAmount || 360000;
  const singleLessonCost = Math.round(currentCoursePrice / 12);

  // Freeze deduction analysis for this student and course in the payment's month period
  const freezeInfo = student && course && payment
    ? calculateFreezeDeduction(student, course, payment.monthPeriod)
    : null;

  // Form State
  const [baseAmount, setBaseAmount] = useState<number>(payment?.baseCalculatedAmount || currentCoursePrice);
  const [finalAmountDue, setFinalAmountDue] = useState<number>(payment?.finalAmountDue || 0);
  const [amountPaid, setAmountPaid] = useState<number>(payment?.amountPaid || 0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(payment?.paymentMethod || 'CARD');
  const [status, setStatus] = useState<PaymentStatus>(payment?.status || 'PENDING');
  const [paidAt, setPaidAt] = useState<string>(payment?.paidAt ? payment.paidAt.slice(0, 10) : (payment && payment.amountPaid > 0 ? getUzbekistanToday() : ''));
  const [recordedBy, setRecordedBy] = useState<string>(payment?.recordedBy || currentUser?.fullName || 'Главный Администратор');
  const [remainingLessons, setRemainingLessons] = useState<number>(payment?.remainingLessonsCount ?? 12);
  const [discountApplied, setDiscountApplied] = useState<number>(payment?.discountApplied || 0);
  const [excusedDeduction, setExcusedDeduction] = useState<number>(payment?.excusedCreditDeduction || 0);
  const [missedExcusedLessons, setMissedExcusedLessons] = useState<number>(0);
  const [notes, setNotes] = useState<string>(payment?.notes || '');
  const [shouldPrintReceipt, setShouldPrintReceipt] = useState<boolean>(false);

  // Sync state when payment changes
  useEffect(() => {
    if (payment) {
      setBaseAmount(payment.baseCalculatedAmount || currentCoursePrice);
      setFinalAmountDue(payment.finalAmountDue);
      setAmountPaid(payment.amountPaid);
      setPaymentMethod(payment.paymentMethod || 'CARD');
      setStatus(payment.status);
      setPaidAt(payment.paidAt ? payment.paidAt.slice(0, 10) : (payment.amountPaid > 0 ? getUzbekistanToday() : ''));
      setRecordedBy(payment.recordedBy || currentUser?.fullName || 'Главный Администратор');
      const remLessons = payment.remainingLessonsCount ?? 12;
      setRemainingLessons(remLessons);
      setDiscountApplied(payment.discountApplied || 0);
      setExcusedDeduction(payment.excusedCreditDeduction || 0);
      setMissedExcusedLessons(12 - remLessons > 0 ? 12 - remLessons : 0);
      setNotes(payment.notes || '');
      setShouldPrintReceipt(false);
    }
  }, [payment, currentCoursePrice, currentUser]);

  // Handler to auto-calculate final amount due based on deductions & discount
  const handleRecalculateDue = (
    newBase: number = baseAmount,
    newDiscount: number = discountApplied,
    newDeduction: number = excusedDeduction
  ) => {
    const calcDue = roundToThousand(Math.max(0, newBase - newDiscount - newDeduction));
    setFinalAmountDue(calcDue);

    // Auto adjust status if needed
    if (amountPaid >= calcDue && calcDue > 0) {
      setStatus('PAID');
    } else if (amountPaid > 0 && amountPaid < calcDue) {
      setStatus('PARTIAL');
    } else if (amountPaid === 0 && calcDue > 0) {
      setStatus('DEBT');
    } else if (calcDue === 0 && (newDeduction > 0 || newDiscount > 0)) {
      setStatus('RECALCULATED');
    }
  };

  // Quick apply excused missed lessons deduction
  const handleApplyExcusedMissedLessons = (count: number, reasonLabel?: string) => {
    setMissedExcusedLessons(count);
    const calculatedDeduction = roundToThousand(singleLessonCost * count);
    setExcusedDeduction(calculatedDeduction);
    const newLessons = Math.max(0, 12 - count);
    setRemainingLessons(newLessons);

    const deductionNote = reasonLabel 
      ? `Уважительный пропуск: -${count} ур. (${calculatedDeduction.toLocaleString('ru-RU')} сум, ${reasonLabel})`
      : `Уважительный пропуск: -${count} ур. (-${calculatedDeduction.toLocaleString('ru-RU')} сум)`;

    setNotes((prev) => {
      if (!prev) return deductionNote;
      if (prev.includes('Уважительный пропуск')) {
        return prev.replace(/Уважительный пропуск:[^|]*/, deductionNote);
      }
      return `${prev} | ${deductionNote}`;
    });

    handleRecalculateDue(baseAmount, discountApplied, calculatedDeduction);
  };

  // Quick apply freeze deduction
  const handleApplyFreezeDeduction = () => {
    if (!freezeInfo || freezeInfo.deductionAmount <= 0) return;
    const newDeduction = freezeInfo.deductionAmount;
    setExcusedDeduction(newDeduction);
    const newLessons = Math.max(0, 12 - freezeInfo.frozenLessonsCount);
    setRemainingLessons(newLessons);
    setMissedExcusedLessons(freezeInfo.frozenLessonsCount);
    const updatedNotes = notes
      ? `${notes} | ${freezeInfo.details}`
      : freezeInfo.details;
    setNotes(updatedNotes);
    handleRecalculateDue(baseAmount, discountApplied, newDeduction);
  };

  // Quick button: Pay Full
  const handleSetPaidFull = () => {
    setAmountPaid(finalAmountDue);
    setStatus('PAID');
    if (!paidAt) setPaidAt(getUzbekistanToday());
  };

  // Quick button: Reset to 0
  const handleSetPaidZero = () => {
    setAmountPaid(0);
    setStatus('DEBT');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const numBase = Number(baseAmount) || 0;
    const numDue = Number(finalAmountDue) || 0;
    const numPaid = Number(amountPaid) || 0;

    // Strict status determination: if paid amount meets or exceeds due amount, it is PAID
    let finalStatus = status;
    if (numPaid >= numDue && numDue > 0) {
      finalStatus = 'PAID';
    } else if (numPaid > 0 && numPaid < numDue) {
      finalStatus = 'PARTIAL';
    } else if (numPaid === 0 && numDue > 0) {
      finalStatus = 'DEBT';
    } else if (numDue === 0 && numPaid === 0 && (excusedDeduction > 0 || discountApplied > 0)) {
      finalStatus = 'RECALCULATED';
    }

    const updatedPayment: Payment = {
      ...payment,
      baseCalculatedAmount: numBase,
      finalAmountDue: numDue,
      amountPaid: numPaid,
      paymentMethod,
      status: finalStatus,
      paidAt: numPaid > 0
        ? (paidAt
            ? (paidAt === payment?.paidAt?.slice(0, 10) ? payment.paidAt : paidAt)
            : getUzbekistanISOString())
        : undefined,
      recordedBy: numPaid > 0 ? (recordedBy.trim() || undefined) : undefined,
      remainingLessonsCount: Number(remainingLessons) || 12,
      discountApplied: Number(discountApplied) || 0,
      excusedCreditDeduction: Number(excusedDeduction) || 0,
      notes: notes.trim() || undefined,
    };

    onSavePayment(updatedPayment, shouldPrintReceipt && updatedPayment.amountPaid > 0);
    onClose();
  };

  if (!isOpen || !payment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-hidden">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 relative max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header - Fixed */}
        <div className="p-5 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Редактирование оплаты / начисления
              </h3>
              <p className="text-xs text-slate-500">
                Период: <strong className="text-blue-700 font-mono font-bold">{payment.monthPeriod}</strong> | Корректировка оплат и перерасчет
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 overflow-y-auto space-y-4 flex-1 overscroll-contain">
            {/* Student & Course Info Card */}
            <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Ученик</p>
                  <h4 className="text-sm font-bold text-slate-900">{student?.fullName || 'Ученик'}</h4>
                  <p className="text-xs text-slate-500">Тел: {student?.phone || '—'}</p>
                </div>
              </div>

              <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Курс / Группа</p>
                <p className="text-xs font-bold text-slate-800">{course?.title || 'Курс'}</p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Период: <strong className="text-blue-700 font-bold">{payment.monthPeriod}</strong> | Базовый тариф: {currentCoursePrice.toLocaleString('ru-RU')} сум/мес
                </p>
              </div>
            </div>

            {/* Transferred Payment Notice Banner */}
            {(payment.notes?.includes('Оплата переведена из группы') || payment.transferredFromCourseTitle) && (
              <div className="bg-amber-100/90 border border-amber-300 p-3 rounded-2xl text-xs text-amber-950 flex items-start space-x-2.5">
                <RefreshCw className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-900">Перенос оплаты: </span>
                  <span className="text-amber-800">
                    {payment.notes?.match(/Оплата переведена из группы [«"][^»"]+[»"]/)?.[0] ||
                     (payment.transferredFromCourseTitle
                       ? `Оплата переведена из группы «${payment.transferredFromCourseTitle}»`
                       : 'Оплата переведена из другой группы')}
                  </span>
                </div>
              </div>
            )}

            {/* Crucial Scope Notice Banner */}
            <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-2xl text-xs text-amber-950 flex items-start space-x-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-900">Правило начисления: </span>
                <span className="text-amber-800">
                  Любое изменение суммы начисления за этот курс сохраняется <strong>строго за текущий месяц ({payment.monthPeriod})</strong>. Все последующие месяцы будут автоматически начисляться в полном объеме ({currentCoursePrice.toLocaleString('ru-RU')} сум).
                </span>
              </div>
            </div>

        {/* Excused Absences Fast-Recalculation Panel */}
        <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200/80 p-3.5 rounded-2xl mb-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <HeartHandshake className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-blue-900">
                Перерасчет за уважительные пропуски уроков (болезнь / справка):
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded-lg border border-blue-200">
              1 урок = {singleLessonCost.toLocaleString('ru-RU')} сум
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-medium text-slate-600 mr-1">Пропущено:</span>
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleApplyExcusedMissedLessons(num)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all border ${
                  missedExcusedLessons === num
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-100/70'
                }`}
              >
                -{num} ур. (-{(singleLessonCost * num).toLocaleString('ru-RU')} сум)
              </button>
            ))}
            {missedExcusedLessons > 0 && (
              <button
                type="button"
                onClick={() => handleApplyExcusedMissedLessons(0)}
                className="px-2 py-1 rounded-xl text-[11px] font-medium bg-white text-slate-500 border border-slate-200 hover:bg-slate-100"
              >
                Сбросить
              </button>
            )}
          </div>

          {/* Quick Reason presets */}
          {missedExcusedLessons > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-blue-100/80">
              <span className="text-[10px] text-slate-500 font-semibold">Причина:</span>
              <button
                type="button"
                onClick={() => handleApplyExcusedMissedLessons(missedExcusedLessons, 'Болезнь / медицинская справка')}
                className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-white hover:bg-blue-100 border border-blue-200 text-blue-700"
              >
                🏥 Мед. справка (болезнь)
              </button>
              <button
                type="button"
                onClick={() => handleApplyExcusedMissedLessons(missedExcusedLessons, 'Семейные обстоятельства')}
                className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-white hover:bg-blue-100 border border-blue-200 text-blue-700"
              >
                👨‍👩‍👦 Семейные обстоятельства
              </button>
              <button
                type="button"
                onClick={() => handleApplyExcusedMissedLessons(missedExcusedLessons, 'Официальный отъезд / олимпиада')}
                className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-white hover:bg-blue-100 border border-blue-200 text-blue-700"
              >
                🏆 Олимпиада / отъезд
              </button>
            </div>
          )}
        </div>

        {/* Freeze Notice & Quick Adjustment Banner */}
        {freezeInfo && freezeInfo.isFrozenInPeriod && (
          <div className="bg-cyan-50 border border-cyan-200 p-3.5 rounded-2xl text-xs text-cyan-950 mb-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start space-x-2">
                <Snowflake className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-cyan-900">
                    Ученик был заморожен в период {payment.monthPeriod}!
                  </p>
                  <p className="text-[11px] text-cyan-800">
                    {freezeInfo.details}
                  </p>
                  {course?.daysOfWeek && course.daysOfWeek.length > 0 && (
                    <p className="text-[10px] text-cyan-700 font-mono mt-0.5">
                      Дни уроков курса: [{course.daysOfWeek.join(', ')}]
                    </p>
                  )}
                </div>
              </div>

              {freezeInfo.deductionAmount > 0 && excusedDeduction !== freezeInfo.deductionAmount && (
                <button
                  type="button"
                  onClick={handleApplyFreezeDeduction}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-xs shrink-0 transition-all flex items-center space-x-1"
                  title="Автоматически уменьшить оплату на пропущенные уроки"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Применить вычет (-{freezeInfo.frozenLessonsCount} ур.)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {payment.paymentHistory && payment.paymentHistory.length > 1 && (
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>История взносов ученика за {payment.monthPeriod} ({payment.paymentHistory.length} оплаты):</span>
              </span>
              <span className="text-xs font-mono font-bold text-emerald-600">
                Всего: {payment.amountPaid.toLocaleString('ru-RU')} сум
              </span>
            </div>
            <div className="space-y-1.5 pt-1">
              {payment.paymentHistory.map((hist, idx) => (
                <div
                  key={hist.id || idx}
                  className="flex items-center justify-between text-xs bg-white p-2 rounded-xl border border-slate-200 font-mono"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      #{idx + 1}
                    </span>
                    <span className="text-slate-600">
                      {hist.paidAt ? hist.paidAt.slice(0, 10) : (hist.createdAt ? hist.createdAt.slice(0, 10) : '—')}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                      {hist.paymentMethod === 'CASH' ? 'Наличные' : 'Карта'}
                    </span>
                    {hist.recordedBy && (
                      <span className="text-[10px] text-slate-400 font-sans">
                        (принял: {hist.recordedBy})
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-emerald-700">
                    +{hist.amountPaid.toLocaleString('ru-RU')} сум
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Amounts Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Final Amount Due Field (Prominent) */}
            <div className="bg-blue-50/60 border-2 border-blue-400/80 p-3.5 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-blue-950 flex items-center space-x-1.5">
                  <DollarSign className="w-4 h-4 text-blue-700" />
                  <span>Начислено за {payment.monthPeriod} (Итог, сум) *</span>
                </label>
              </div>
              <input
                type="number"
                min="0"
                step="1000"
                value={finalAmountDue}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setFinalAmountDue(val);
                  if (amountPaid >= val && val > 0) {
                    setStatus('PAID');
                  } else if (amountPaid > 0 && amountPaid < val) {
                    setStatus('PARTIAL');
                  } else if (amountPaid === 0 && val > 0) {
                    setStatus('DEBT');
                  } else if (val === 0 && amountPaid === 0) {
                    setStatus('RECALCULATED');
                  }
                }}
                className="w-full bg-white border border-blue-300 rounded-xl px-3.5 py-2 text-base font-black text-blue-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                placeholder="360000"
                required
              />
              <p className="text-[10px] text-blue-700/90">
                Сумма к оплате за текущий месяц с учетом всех вычетов
              </p>
            </div>

            {/* Amount Paid Field */}
            <div className="bg-emerald-50/60 border border-emerald-200 p-3.5 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-emerald-950 flex items-center space-x-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Фактически внесено (сум) *</span>
                </label>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={handleSetPaidFull}
                    className="text-[10px] bg-white border border-emerald-300 text-emerald-700 px-1.5 py-0.5 rounded font-bold hover:bg-emerald-100"
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    onClick={handleSetPaidZero}
                    className="text-[10px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-medium hover:bg-slate-100"
                  >
                    0 сум
                  </button>
                </div>
              </div>
              <input
                type="number"
                min="0"
                step="1000"
                value={amountPaid}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setAmountPaid(val);
                  if (val >= finalAmountDue && finalAmountDue > 0) {
                    setStatus('PAID');
                  } else if (val > 0 && val < finalAmountDue) {
                    setStatus('PARTIAL');
                  } else if (val === 0) {
                    setStatus('DEBT');
                  }
                }}
                className="w-full bg-white border border-emerald-300 rounded-xl px-3.5 py-2 text-sm font-bold text-emerald-700 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0"
                required
              />
            </div>
          </div>

          {/* Payment Method & Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Payment Method */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Способ оплаты:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Наличные</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('CARD')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                    paymentMethod === 'CARD'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Карта (Перевод)</span>
                </button>
              </div>
            </div>

            {/* Payment Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Статус платежа:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PaymentStatus)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PAID">Оплачено полностью (PAID)</option>
                <option value="PARTIAL">Частичная оплата (PARTIAL)</option>
                <option value="DEBT">Задолженность (DEBT)</option>
                <option value="RECALCULATED">Перерассчитано (RECALCULATED)</option>
              </select>
            </div>
          </div>

          {/* Date, Admin & Lessons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Payment Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Дата оплаты:</span>
              </label>
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Recorded By Administrator */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                <span>Принял оплату:</span>
              </label>
              <select
                value={recordedBy}
                onChange={(e) => setRecordedBy(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer truncate"
              >
                {recordedBy && (
                  <option value={recordedBy}>
                    {recordedBy}
                  </option>
                )}
                {currentUser?.fullName && currentUser.fullName !== recordedBy && (
                  <option value={currentUser.fullName}>
                    {currentUser.fullName} (Текущий)
                  </option>
                )}
                {staffMembers
                  ?.filter((s) => s.role === 'ADMIN' || s.role === 'DIRECTOR')
                  .filter((s) => s.fullName !== recordedBy)
                  .map((s) => (
                    <option key={s.id} value={s.fullName}>
                      {s.fullName} ({s.role === 'DIRECTOR' ? 'Директор' : 'Админ'})
                    </option>
                  ))}
                {recordedBy !== 'Главный Администратор' && (
                  <option value="Главный Администратор">Главный Администратор</option>
                )}
              </select>
            </div>

            {/* Remaining Lessons */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Остаток уроков (из 12):
              </label>
              <input
                type="number"
                min="0"
                max="12"
                value={remainingLessons}
                onChange={(e) => setRemainingLessons(Number(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Detailed Calculations Accordion / Inputs (Discounts & Freeze Deduction) */}
          <div className="border border-slate-200 p-3 rounded-2xl space-y-2.5 bg-slate-50/50">
            <p className="text-[11px] font-bold text-slate-600 flex items-center space-x-1">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>Детализация скидок и вычетов (в сумах):</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Базовый тариф курса:
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={baseAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setBaseAmount(val);
                    handleRecalculateDue(val, discountApplied, excusedDeduction);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Скидка / Льгота (сум):
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={discountApplied}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setDiscountApplied(val);
                    handleRecalculateDue(baseAmount, val, excusedDeduction);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-amber-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Вычет за пропуски / уважит.:
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={excusedDeduction}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setExcusedDeduction(val);
                    handleRecalculateDue(baseAmount, discountApplied, val);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-cyan-700"
                />
              </div>
            </div>
          </div>

          {/* Notes / Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Примечание к перерасчету / причина корректировки:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Например: Пропустил 2 урока по болезни (мед. справка)..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Print Receipt Option */}
          {amountPaid > 0 && (
            <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={shouldPrintReceipt}
                onChange={(e) => setShouldPrintReceipt(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Распечатать квитанцию (чек) после сохранения изменений</span>
            </label>
          )}
        </div>

        {/* Submit Actions Footer - Fixed at bottom */}
        <div className="p-4 bg-slate-50/90 border-t border-slate-100 flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-white transition-colors"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all flex items-center justify-center space-x-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Сохранить начисление за {payment.monthPeriod}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
  );
};
