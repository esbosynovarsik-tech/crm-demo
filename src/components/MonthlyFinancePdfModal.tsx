import React, { useRef, useState } from 'react';
import {
  X,
  Printer,
  Download,
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Payment,
  Student,
  Course,
  TeacherProfile,
  Expense,
  ExpenseCategory,
} from '../types';
import { getUzbekistanLocaleString, getUzbekistanToday } from '../lib/dateUtils';
import { EXPENSE_CATEGORY_CONFIG } from './FinanceModule';

interface MonthlyFinancePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPeriod: string;
  payments: Payment[];
  expenses: Expense[];
  students: Student[];
  courses: Course[];
  teachers: TeacherProfile[];
}

const MONTH_NAMES_RU: { [key: string]: string } = {
  '01': 'Январь',
  '02': 'Февраль',
  '03': 'Март',
  '04': 'Апрель',
  '05': 'Май',
  '06': 'Июнь',
  '07': 'Июль',
  '08': 'Август',
  '09': 'Сентябрь',
  '10': 'Октябрь',
  '11': 'Ноябрь',
  '12': 'Декабрь',
};

const formatPeriodHuman = (period: string) => {
  if (!period) return '';
  const parts = period.split('-');
  if (parts.length === 2) {
    const [year, month] = parts;
    const mName = MONTH_NAMES_RU[month] || month;
    return `${mName} ${year} года`;
  }
  return period;
};

export const MonthlyFinancePdfModal: React.FC<MonthlyFinancePdfModalProps> = ({
  isOpen,
  onClose,
  selectedPeriod,
  payments,
  expenses,
  students,
  courses,
  teachers,
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen) return null;

  // Payments for selected period
  const periodPayments = payments.filter((p) => p.monthPeriod === selectedPeriod);

  // Expected and Collected Revenue
  const collectedRevenue = periodPayments.reduce((s, p) => s + p.amountPaid, 0);
  const cashCollected = periodPayments
    .filter((p) => p.paymentMethod === 'CASH')
    .reduce((s, p) => s + p.amountPaid, 0);
  const cardCollected = periodPayments
    .filter((p) => p.paymentMethod === 'CARD' || !p.paymentMethod)
    .reduce((s, p) => s + p.amountPaid, 0);

  // Virtual calculations for total expected and debts
  let expectedRevenue = 0;
  courses.forEach((crs) => {
    const enrolledStudents = students.filter((s) => s.enrolledCourseIds.includes(crs.id));
    enrolledStudents.forEach((st) => {
      const p = periodPayments.find((pm) => pm.studentId === st.id && pm.courseId === crs.id);
      expectedRevenue += p ? p.finalAmountDue : crs.monthlyPrice;
    });
  });

  const totalDebt = Math.max(0, expectedRevenue - collectedRevenue);

  // Expenses for selected period
  const periodExpenses = expenses.filter((e) => e.monthPeriod === selectedPeriod);
  const totalExpenses = periodExpenses.reduce((s, e) => s + e.amount, 0);
  const cashExpenses = periodExpenses
    .filter((e) => e.paymentMethod === 'CASH')
    .reduce((s, e) => s + e.amount, 0);
  const cardExpenses = periodExpenses
    .filter((e) => e.paymentMethod === 'CARD')
    .reduce((s, e) => s + e.amount, 0);

  // Net Profit / Cash Balance
  const netBalance = collectedRevenue - totalExpenses;
  const netCashBalance = cashCollected - cashExpenses;
  const netCardBalance = cardCollected - cardExpenses;

  // Expenses breakdown by Category
  const expenseCategories: ExpenseCategory[] = [
    'TEACHER_SALARY',
    'RENT',
    'UTILITIES',
    'SUPPLIES',
    'MARKETING',
    'TAXES',
    'MAINTENANCE',
    'OTHER',
  ];

  const categoryBreakdown = expenseCategories
    .map((cat) => {
      const catExpenses = periodExpenses.filter((e) => e.category === cat);
      const catSum = catExpenses.reduce((s, e) => s + e.amount, 0);
      const count = catExpenses.length;
      const percentage = totalExpenses > 0 ? (catSum / totalExpenses) * 100 : 0;
      return {
        category: cat,
        label: EXPENSE_CATEGORY_CONFIG[cat]?.label || cat,
        count,
        sum: catSum,
        percentage,
      };
    })
    .filter((c) => c.sum > 0);

  // Course Income breakdown
  const courseBreakdown = courses.map((crs) => {
    const teacher = teachers.find((t) => t.id === crs.teacherId);
    const enrolledStudents = students.filter((s) => s.enrolledCourseIds.includes(crs.id));
    const crsPayments = periodPayments.filter((p) => p.courseId === crs.id);
    const paidSum = crsPayments.reduce((s, p) => s + p.amountPaid, 0);
    const expectedSum = enrolledStudents.reduce((s, st) => {
      const p = crsPayments.find((pm) => pm.studentId === st.id);
      return s + (p ? p.finalAmountDue : crs.monthlyPrice);
    }, 0);
    const debtSum = Math.max(0, expectedSum - paidSum);

    return {
      course: crs,
      teacherName: teacher?.fullName || 'Преподаватель не назначен',
      studentsCount: enrolledStudents.length,
      paidSum,
      expectedSum,
      debtSum,
    };
  });

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);

    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`REDCAT_Finance_Report_${selectedPeriod}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Ошибка при генерации PDF. Попробуйте нажать кнопку "Печать".');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[92vh]">
        {/* Modal Toolbar (Hidden during print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 rounded-t-2xl print:hidden">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Финансовый отчет: Доходы и Расходы
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Период: {formatPeriodHuman(selectedPeriod)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-slate-700 font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Печать</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Создание PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Скачать PDF файл</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Report Document */}
        <div className="p-6 sm:p-8 overflow-y-auto font-sans text-slate-900 bg-white">
          <div ref={reportRef} className="space-y-6 bg-white p-2 text-slate-900">
            {/* Header Document */}
            <div className="border-b-2 border-slate-900 pb-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-900 text-white flex items-center justify-center font-black text-xl shadow-md">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-slate-950">
                      REDCAT
                    </h1>
                    <p className="text-xs text-slate-600 font-medium">
                      Учебный центр и Курсы подготовки
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="inline-block bg-slate-100 text-slate-900 font-mono text-xs font-extrabold px-3 py-1 rounded-lg border border-slate-300">
                    ИТОГОВЫЙ ФИНАНСОВЫЙ ОТЧЕТ
                  </span>
                  <p className="text-xs font-bold text-slate-800 mt-1.5">
                    Период: {formatPeriodHuman(selectedPeriod)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Сформирован: {getUzbekistanLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Summary KPI Highlights */}
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
                1. Главные финансовые итоги за месяц
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                  <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                    Всего доходов (собрано)
                  </p>
                  <p className="text-base font-black text-emerald-950 mt-1 font-mono">
                    {collectedRevenue.toLocaleString('ru-RU')} сум
                  </p>
                  <p className="text-[10px] text-emerald-700 mt-0.5">
                    Наличные: {cashCollected.toLocaleString('ru-RU')} | Карта: {cardCollected.toLocaleString('ru-RU')}
                  </p>
                </div>

                <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl">
                  <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">
                    Всего расходов
                  </p>
                  <p className="text-base font-black text-rose-950 mt-1 font-mono">
                    {totalExpenses.toLocaleString('ru-RU')} сум
                  </p>
                  <p className="text-[10px] text-rose-700 mt-0.5">
                    Наличные: {cashExpenses.toLocaleString('ru-RU')} | Карта: {cardExpenses.toLocaleString('ru-RU')}
                  </p>
                </div>

                <div
                  className={`p-3.5 rounded-xl border ${
                    netBalance >= 0
                      ? 'bg-blue-50 border-blue-200 text-blue-950'
                      : 'bg-amber-50 border-amber-200 text-amber-950'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                    Чистая прибыль / Сальдо
                  </p>
                  <p className="text-base font-black mt-1 font-mono">
                    {netBalance.toLocaleString('ru-RU')} сум
                  </p>
                  <p className="text-[10px] opacity-80 mt-0.5">
                    Касса: {netCashBalance.toLocaleString('ru-RU')} | Расчетный: {netCardBalance.toLocaleString('ru-RU')}
                  </p>
                </div>

                <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-xl">
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                    Задолженность учеников
                  </p>
                  <p className="text-base font-black text-amber-950 mt-1 font-mono">
                    {totalDebt.toLocaleString('ru-RU')} сум
                  </p>
                  <p className="text-[10px] text-amber-700 mt-0.5">
                    План сборов: {expectedRevenue.toLocaleString('ru-RU')} сум
                  </p>
                </div>
              </div>
            </div>

            {/* Table 1: Category Expenses Summary */}
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                2. Структура расходов по статьям
              </h2>
              <table className="w-full text-xs text-left border-collapse border border-slate-300">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-300">
                  <tr>
                    <th className="py-2 px-3 border-r border-slate-300">№</th>
                    <th className="py-2 px-3 border-r border-slate-300">Статья расходов</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-center">Операций</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-right">Сумма (сум)</th>
                    <th className="py-2 px-3 text-right">Доля в расходах</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {categoryBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 px-3 text-center text-slate-400 italic">
                        За выбранный месяц расходы не зарегистрированы
                      </td>
                    </tr>
                  ) : (
                    categoryBreakdown.map((item, idx) => (
                      <tr key={`${item.category}-${idx}`} className="hover:bg-slate-50">
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-500 font-mono text-center">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-900">
                          {item.label}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-center font-mono">
                          {item.count}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold text-rose-700">
                          {item.sum.toLocaleString('ru-RU')} сум
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700">
                          {item.percentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                    <td colSpan={3} className="py-2 px-3 text-right border-r border-slate-300">
                      ИТОГО РАСХОДОВ:
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-rose-800 border-r border-slate-300">
                      {totalExpenses.toLocaleString('ru-RU')} сум
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-900">
                      100.0%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Table 2: Detailed Expenses Register */}
            {periodExpenses.length > 0 && (
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                  3. Реестр всех списаний и расходов
                </h2>
                <table className="w-full text-[11px] text-left border-collapse border border-slate-300">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[9px] border-b border-slate-300">
                    <tr>
                      <th className="py-1.5 px-2.5 border-r border-slate-300">Дата</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-300">Наименование расхода</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-300">Категория</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-300 text-center">Оплата</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-300 text-right">Сумма (сум)</th>
                      <th className="py-1.5 px-2.5">Примечание</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {periodExpenses.map((exp) => {
                      const teacher = teachers.find((t) => t.id === exp.teacherId);
                      return (
                        <tr key={exp.id} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2.5 border-r border-slate-200 font-mono text-slate-600 whitespace-nowrap">
                            {exp.expenseDate || exp.createdAt?.split('T')[0] || '—'}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-slate-200 font-bold text-slate-900">
                            {exp.title}
                            {teacher && (
                              <span className="block text-[10px] text-blue-700 font-normal">
                                Получатель: {teacher.fullName}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-slate-200 text-slate-700">
                            {EXPENSE_CATEGORY_CONFIG[exp.category]?.label || exp.category}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-slate-200 text-center font-semibold">
                            {exp.paymentMethod === 'CASH' ? 'Наличные' : 'Карта'}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-slate-200 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                            {exp.amount.toLocaleString('ru-RU')}
                          </td>
                          <td className="py-1.5 px-2.5 text-slate-500 italic max-w-[180px] truncate">
                            {exp.notes || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table 3: Groups Revenue Breakdown */}
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                4. Доходы и оплаты по учебным группам
              </h2>
              <table className="w-full text-xs text-left border-collapse border border-slate-300">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-300">
                  <tr>
                    <th className="py-2 px-3 border-r border-slate-300">Курс / Группа</th>
                    <th className="py-2 px-3 border-r border-slate-300">Преподаватель</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-center">Учеников</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-right">Начислено</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-right">Собрано</th>
                    <th className="py-2 px-3 text-right">Долг</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {courseBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-3 px-3 text-center text-slate-400 italic">
                        Курсы в системе не созданы
                      </td>
                    </tr>
                  ) : (
                    courseBreakdown.map((row, rowIdx) => (
                      <tr key={`${row.course.id}-${rowIdx}`} className="hover:bg-slate-50">
                        <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-900">
                          {row.course.title}
                          <span className="block text-[10px] text-slate-500 font-normal">
                            {row.course.subject} ({row.course.monthlyPrice.toLocaleString('ru-RU')} сум/мес)
                          </span>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                          {row.teacherName}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-center font-mono font-bold">
                          {row.studentsCount}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right font-mono text-slate-700">
                          {row.expectedSum.toLocaleString('ru-RU')}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold text-emerald-700">
                          {row.paidSum.toLocaleString('ru-RU')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-700">
                          {row.debtSum.toLocaleString('ru-RU')}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                    <td colSpan={3} className="py-2 px-3 text-right border-r border-slate-300">
                      ИТОГО ПО ВСЕМ КУРСАМ:
                    </td>
                    <td className="py-2 px-3 text-right font-mono border-r border-slate-300">
                      {expectedRevenue.toLocaleString('ru-RU')} сум
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-800 border-r border-slate-300">
                      {collectedRevenue.toLocaleString('ru-RU')} сум
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-amber-800">
                      {totalDebt.toLocaleString('ru-RU')} сум
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Signatures & Seal Section */}
            <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-xs">
              <div>
                <p className="font-bold text-slate-900">Директор учебного центра REDCAT:</p>
                <div className="mt-8 border-b border-slate-400 w-48"></div>
                <p className="text-[10px] text-slate-500 mt-1">(подпись / ФИО)</p>
              </div>

              <div>
                <p className="font-bold text-slate-900">Главный бухгалтер / Администратор:</p>
                <div className="mt-8 border-b border-slate-400 w-48"></div>
                <p className="text-[10px] text-slate-500 mt-1">(подпись / ФИО)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
