import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  UserCheck,
  BookOpen,
  AlertTriangle,
  CreditCard,
  PlusCircle,
  FileSpreadsheet,
  Award,
  Calendar,
  Smartphone,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  TeacherProfile,
  Course,
  Student,
  AttendanceRecord,
  Payment,
  Expense,
} from '../types';
import { roundToThousand, calculateFreezeDeduction } from '../lib/billingLogic';
import {
  getUzbekistanCurrentMonthPeriod,
  formatMonthPeriodLabel,
  getGeneratedMonthPeriods,
} from '../lib/dateUtils';

interface AdminDashboardProps {
  teachers: TeacherProfile[];
  courses: Course[];
  students: Student[];
  attendanceRecords: AttendanceRecord[];
  payments: Payment[];
  expenses?: Expense[];
  onNavigateTab: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  teachers,
  courses,
  students,
  attendanceRecords,
  payments,
  expenses = [],
  onNavigateTab,
}) => {
  const currentActualMonth = getUzbekistanCurrentMonthPeriod();
  const [selectedMonthPeriod, setSelectedMonthPeriod] = useState<string>(() => currentActualMonth);
  const currentMonthPeriod = selectedMonthPeriod;

  // Month periods list
  const availablePeriods = useMemo(() => {
    return Array.from(
      new Set([
        ...getGeneratedMonthPeriods(currentActualMonth, 6, 6),
        ...payments.map((p) => p.monthPeriod).filter(Boolean),
        ...expenses.map((e) => e.monthPeriod).filter(Boolean),
      ])
    ).sort().reverse();
  }, [currentActualMonth, payments, expenses]);

  const handleStepMonth = (direction: number) => {
    const [yearStr, monthStr] = selectedMonthPeriod.split('-');
    let year = parseInt(yearStr, 10) || 2026;
    let month = parseInt(monthStr, 10) || 9;

    month += direction;
    if (month > 12) {
      month = 1;
      year += 1;
    } else if (month < 1) {
      month = 12;
      year -= 1;
    }
    const mStr = month < 10 ? `0${month}` : `${month}`;
    setSelectedMonthPeriod(`${year}-${mStr}`);
  };

  // Synchronized calculation with FinanceModule: includes recorded payments + enrolled students without explicit payment records
  const {
    totalExpectedRevenue,
    totalCollectedRevenue,
    totalDebtAmount,
    debtStudentsCount,
    totalCurrentExpenses,
    netCashInRegister,
  } = useMemo(() => {
    const periodPayments = payments.filter((p) => p.monthPeriod === currentMonthPeriod);
    
    // Group transactions by studentId___courseId so multiple installment payments don't duplicate expected revenue
    const groupedTransactions = new Map<string, Payment[]>();
    periodPayments.forEach((p) => {
      const key = `${p.studentId}___${p.courseId}`;
      if (!groupedTransactions.has(key)) {
        groupedTransactions.set(key, []);
      }
      groupedTransactions.get(key)!.push(p);
    });

    const combinedRecordedPayments: Payment[] = [];
    groupedTransactions.forEach((txList, key) => {
      const [studentId, courseId] = key.split('___');
      const st = students.find((s) => s.id === studentId);
      const totalPaid = txList.reduce((s, p) => s + (p.amountPaid || 0), 0);

      // If student is no longer enrolled in this course and paid nothing (0 sum):
      // Ignore phantom debt from former/dropped group so totals are strictly for active groups!
      if (st && !st.enrolledCourseIds.includes(courseId) && totalPaid === 0) {
        return;
      }

      const sortedTxs = [...txList].sort(
        (a, b) => (b.paidAt || '').localeCompare(a.paidAt || '')
      );
      const latestTx = sortedTxs[0];
      const finalDue = latestTx.finalAmountDue;

      let status: Payment['status'] = 'DEBT';
      if (totalPaid >= finalDue && finalDue > 0) {
        status = 'PAID';
      } else if (totalPaid > 0) {
        status = 'PARTIAL';
      } else if (finalDue === 0 && (latestTx.excusedCreditDeduction || 0) > 0) {
        status = 'RECALCULATED';
      }

      combinedRecordedPayments.push({
        ...latestTx,
        amountPaid: totalPaid,
        status,
        paymentHistory: txList.filter((tx) => (tx.amountPaid || 0) > 0),
      });
    });

    const allDisplayPayments: Payment[] = [...combinedRecordedPayments];

    // Add expected charges for all enrolled students in active courses (identically to FinanceModule)
    courses.forEach((crs) => {
      const enrolledStudents = students.filter((s) => s.enrolledCourseIds.includes(crs.id));
      enrolledStudents.forEach((st) => {
        const exists = allDisplayPayments.some((p) => p.studentId === st.id && p.courseId === crs.id);
        if (!exists) {
          // Freeze tuition reduction
          const freezeCalc = calculateFreezeDeduction(st, crs, currentMonthPeriod);

          // Personal discounts
          let discountAmount = 0;
          if (st.discountType === 'PERCENTAGE') {
            discountAmount = roundToThousand((crs.monthlyPrice * (st.discountValue || 0)) / 100);
          } else if (st.discountType === 'FIXED_SUM') {
            discountAmount = roundToThousand(Math.min(crs.monthlyPrice, st.discountValue || 0));
          }

          const finalAmountDue = roundToThousand(
            Math.max(0, crs.monthlyPrice - discountAmount - freezeCalc.deductionAmount)
          );
          const remainingLessons = Math.max(0, 12 - freezeCalc.frozenLessonsCount);
          const status: Payment['status'] =
            finalAmountDue === 0 && freezeCalc.deductionAmount > 0 ? 'RECALCULATED' : 'DEBT';

          allDisplayPayments.push({
            id: `virt-${st.id}-${crs.id}-${currentMonthPeriod}`,
            studentId: st.id,
            courseId: crs.id,
            monthPeriod: currentMonthPeriod,
            isFirstMonth: false,
            remainingLessonsCount: remainingLessons,
            baseCalculatedAmount: crs.monthlyPrice,
            discountApplied: discountAmount,
            excusedCreditDeduction: freezeCalc.deductionAmount,
            finalAmountDue,
            amountPaid: 0,
            status,
            notes: freezeCalc.frozenLessonsCount > 0 ? freezeCalc.details : undefined,
          });
        }
      });
    });

    const expected = allDisplayPayments.reduce((s, p) => s + p.finalAmountDue, 0);
    const collected = periodPayments.reduce((s, p) => s + p.amountPaid, 0);
    const currentExpenses = expenses.filter((e) => e.monthPeriod === currentMonthPeriod);
    const totalExp = currentExpenses.reduce((s, e) => s + e.amount, 0);
    const netCash = collected - totalExp;
    const debtAmount = Math.max(0, expected - collected);

    // Unique count of debtors with unpaid balance
    const debtorStudentIds = new Set(
      allDisplayPayments
        .filter((p) => p.amountPaid < p.finalAmountDue)
        .map((p) => p.studentId)
    );

    return {
      totalExpectedRevenue: expected,
      totalCollectedRevenue: collected,
      totalDebtAmount: debtAmount,
      debtStudentsCount: debtorStudentIds.size,
      totalCurrentExpenses: totalExp,
      netCashInRegister: netCash,
    };
  }, [payments, courses, students, expenses, currentMonthPeriod]);

  return (
    <div className="space-y-6">
      
      {/* MONTH / PERIOD SELECTOR HEADER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-extrabold text-slate-900">
                Финансовые показатели за: {formatMonthPeriodLabel(selectedMonthPeriod)}
              </h2>
              {selectedMonthPeriod === currentActualMonth && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wide">
                  Текущий месяц
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Касса, задолженности и расходы синхронизированы в реальном времени
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleStepMonth(-1)}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title="Предыдущий месяц"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <select
            value={selectedMonthPeriod}
            onChange={(e) => setSelectedMonthPeriod(e.target.value)}
            className="bg-white text-slate-800 font-mono font-bold text-xs rounded-lg px-3 py-1.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {availablePeriods.map((period) => {
              let suffix = '';
              if (period === currentActualMonth) suffix = ' (Текущий)';
              else if (period > currentActualMonth) suffix = ' (Будущий)';
              else suffix = ' (Прошлый)';
              return (
                <option key={period} value={period}>
                  {formatMonthPeriodLabel(period)}
                  {suffix}
                </option>
              );
            })}
          </select>

          <button
            type="button"
            onClick={() => handleStepMonth(1)}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title="Следующий месяц"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {selectedMonthPeriod !== currentActualMonth && (
            <button
              type="button"
              onClick={() => setSelectedMonthPeriod(currentActualMonth)}
              className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs border border-blue-200 transition-colors cursor-pointer"
            >
              К текущему
            </button>
          )}
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Collected Amount & Net Cash */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Касса (Собрано)</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-600 tracking-tight">
              {totalCollectedRevenue.toLocaleString('ru-RU')} сум
            </span>
            <div className="flex items-center space-x-2 mt-2">
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((totalCollectedRevenue / (totalExpectedRevenue || 1)) * 100)
                    )}%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-slate-500 font-bold">
                {Math.round((totalCollectedRevenue / (totalExpectedRevenue || 1)) * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Expenses & Net Profit */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Остаток в кассе (Чистыми)</span>
            <div className={`p-2 rounded-xl border ${netCashInRegister >= 0 ? 'bg-teal-50 text-teal-600 border-teal-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-black tracking-tight ${netCashInRegister >= 0 ? 'text-teal-600' : 'text-rose-600'}`}>
              {netCashInRegister.toLocaleString('ru-RU')} сум
            </span>
            <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wide">
              Расходы: {totalCurrentExpenses.toLocaleString('ru-RU')} сум
            </p>
          </div>
        </div>

        {/* Total Debts */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Сумма задолженностей</span>
              <button
                type="button"
                onClick={() => onNavigateTab('sms')}
                className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 transition-all cursor-pointer"
                title="Перейти к SMS-рассылке должникам"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-rose-500 tracking-tight">
                {totalDebtAmount.toLocaleString('ru-RU')} сум
              </span>
              <p className="text-[10px] font-bold text-rose-500 mt-1 uppercase tracking-wide">
                {debtStudentsCount} должников
              </p>
            </div>
          </div>
        </div>

        {/* Active Students & Groups */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Контингент центра</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight">{students.length}</span>
            <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wide">
              в {courses.length} активных группах
            </p>
          </div>
        </div>

      </div>

      {/* QUICK ACTIONS & SHORTCUTS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <button
          onClick={() => onNavigateTab('attendance')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400/80 text-left shadow-xs hover:shadow-md transition-all group space-y-2"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            <Calendar className="w-5 h-5" />
          </div>
          <h3 className="font-extrabold text-sm text-slate-900">1. Посещаемость</h3>
          <p className="text-xs text-slate-500">
            Перекличка, причины отсутствия, обзвон (+998)
          </p>
        </button>

        <button
          onClick={() => onNavigateTab('students')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400/80 text-left shadow-xs hover:shadow-md transition-all group space-y-2"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-extrabold text-sm text-slate-900">2. База Учеников</h3>
          <p className="text-xs text-slate-500">
            Регистрация, зачисление с пропорцией 12 уроков
          </p>
        </button>

        <button
          onClick={() => onNavigateTab('finance')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400/80 text-left shadow-xs hover:shadow-md transition-all group space-y-2"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <h3 className="font-extrabold text-sm text-slate-900">3. Финансы & Касса</h3>
          <p className="text-xs text-slate-500">
            Оплаты, кассовый отчет, зарплата учителей
          </p>
        </button>

        <button
          onClick={() => onNavigateTab('sms')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-amber-400/80 text-left shadow-xs hover:shadow-md transition-all group space-y-2"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold group-hover:bg-amber-500 group-hover:text-white transition-colors">
            <Smartphone className="w-5 h-5" />
          </div>
          <h3 className="font-extrabold text-sm text-slate-900">4. SMS-Рассылка</h3>
          <p className="text-xs text-slate-500">
            Массовые SMS должникам через телефон/шлюз
          </p>
        </button>

      </div>

      {/* OVERVIEW TABLES GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* COURSES SUMMARY */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>Активные курсы и группы ({courses.length})</span>
            </h3>
            <button
              onClick={() => onNavigateTab('courses')}
              className="text-xs text-blue-600 hover:underline font-bold"
            >
              Управление
            </button>
          </div>

          <div className="space-y-2.5">
            {courses.map((crs, idx) => {
              const tch = teachers.find((t) => t.id === crs.teacherId);
              const enrolledStudentsCount = students.filter((s) =>
                s.enrolledCourseIds.includes(crs.id)
              ).length;

              return (
                <div
                  key={`${crs.id}-${idx}`}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{crs.title}</p>
                    <p className="text-slate-500 text-[11px]">
                      Преподаватель: {tch?.fullName || '—'}
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <p className="font-bold text-slate-800">{crs.monthlyPrice.toLocaleString('ru-RU')} сум</p>
                    <p className="text-[10px] text-slate-500">{enrolledStudentsCount} учеников</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* TEACHERS SUMMARY */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span>Преподаватели центра ({teachers.length})</span>
            </h3>
            <button
              onClick={() => onNavigateTab('teachers')}
              className="text-xs text-indigo-600 hover:underline font-bold"
            >
              Управление
            </button>
          </div>

          <div className="space-y-2.5">
            {teachers.map((t) => {
              const teacherCoursesCount = courses.filter((c) => c.teacherId === t.id).length;

              return (
                <div
                  key={t.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{t.fullName}</p>
                    <p className="text-slate-500 text-[11px]">{t.subject}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-mono font-bold text-[10px]">
                      {t.salaryModel === 'PERCENTAGE'
                        ? `${t.percentageRate}% от сбора`
                        : `${t.fixedRate?.toLocaleString('ru-RU')} сум`}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">{teacherCoursesCount} групп</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
