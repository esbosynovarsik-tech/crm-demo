import React, { useState, useMemo, useRef } from 'react';
import {
  Printer,
  X,
  Building2,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Users,
  Filter,
  CreditCard,
  Banknote,
  FileText,
  Clock,
  Download,
  Loader2,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Course, Student, Payment, TeacherProfile, PaymentMethod } from '../types';
import {
  getUzbekistanLocaleString,
  getUzbekistanToday,
  getUzbekistanCurrentMonthPeriod,
  formatMonthPeriodLabel,
  getGeneratedMonthPeriods,
} from '../lib/dateUtils';
import { printHtmlDirectly } from '../lib/printUtils';

interface GroupFinanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPeriod: string;
  selectedCourseId: string;
  courses: Course[];
  students: Student[];
  payments: Payment[];
  teachers: TeacherProfile[];
}

type PeriodMode = 'DAY' | 'MONTH' | 'RANGE';
type ReportFormat = 'TRANSACTIONS' | 'GROUP_STATEMENT';

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

const formatMonthPeriodHuman = (period: string) => {
  if (!period) return '';
  const parts = period.split('-');
  if (parts.length === 2) {
    const [year, month] = parts;
    const mName = MONTH_NAMES_RU[month] || month;
    return `${mName} ${year} г.`;
  }
  return period;
};

const formatDateRu = (dateStr: string) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
};

export const GroupFinanceReportModal: React.FC<GroupFinanceReportModalProps> = ({
  isOpen,
  onClose,
  selectedPeriod: initialPeriod,
  selectedCourseId: initialCourseId,
  courses,
  students,
  payments,
  teachers,
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Period Mode State: DAY (За выбранный день) vs MONTH (За месяц) vs RANGE (За период)
  const [periodMode, setPeriodMode] = useState<PeriodMode>('DAY');
  
  // Selected Day (defaults to today in Uzbekistan)
  const [selectedDay, setSelectedDay] = useState<string>(getUzbekistanToday());
  
  // Selected Month
  const currentActualMonth = getUzbekistanCurrentMonthPeriod();
  const [selectedMonth, setSelectedMonth] = useState<string>(initialPeriod || currentActualMonth);
  
  // Date Range
  const [rangeFrom, setRangeFrom] = useState<string>(getUzbekistanToday());
  const [rangeTo, setRangeTo] = useState<string>(getUzbekistanToday());

  // Filters
  const [courseFilter, setCourseFilter] = useState<string>(initialCourseId || 'ALL');
  const [methodFilter, setMethodFilter] = useState<'ALL' | PaymentMethod>('ALL');
  
  // Report Format: TRANSACTIONS (Реестр фактических оплат) vs GROUP_STATEMENT (Ведомость начислений по группе)
  const [reportFormat, setReportFormat] = useState<ReportFormat>('TRANSACTIONS');

  // Set quick date helpers
  const handleSetQuickDay = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setSelectedDay(`${yyyy}-${mm}-${dd}`);
  };

  // 1. FILTER ACTUAL TRANSACTIONS / PAYMENTS
  const filteredTransactions = useMemo(() => {
    const list = payments.filter((p) => {
      // Must have actual payment amount > 0 for cash/transaction report
      if (!p.amountPaid || p.amountPaid <= 0) return false;

      // Course Filter
      if (courseFilter !== 'ALL' && p.courseId !== courseFilter) return false;

      // Method Filter
      if (methodFilter !== 'ALL') {
        const actualMethod = p.paymentMethod || 'CARD';
        if (actualMethod !== methodFilter) return false;
      }

      // Date filtering
      if (periodMode === 'DAY') {
        if (p.paidAt) {
          return p.paidAt.startsWith(selectedDay);
        }
        return p.monthPeriod === selectedDay.substring(0, 7);
      } else if (periodMode === 'MONTH') {
        return p.monthPeriod === selectedMonth;
      } else if (periodMode === 'RANGE') {
        const pDate = p.paidAt ? p.paidAt.substring(0, 10) : p.monthPeriod;
        return pDate >= rangeFrom && pDate <= rangeTo;
      }

      return true;
    });

    return [...list].sort((a, b) => {
      const timeA = a.paidAt ? (Date.parse(a.paidAt) || 0) : 0;
      const timeB = b.paidAt ? (Date.parse(b.paidAt) || 0) : 0;
      return timeB - timeA;
    });
  }, [payments, periodMode, selectedDay, selectedMonth, rangeFrom, rangeTo, courseFilter, methodFilter]);

  // Transaction Totals
  const totalTransactionsCount = filteredTransactions.length;
  const totalTransactionsSum = filteredTransactions.reduce((s, p) => s + p.amountPaid, 0);
  const totalCashSum = filteredTransactions
    .filter((p) => p.paymentMethod === 'CASH')
    .reduce((s, p) => s + p.amountPaid, 0);
  const totalCardSum = filteredTransactions
    .filter((p) => p.paymentMethod === 'CARD' || !p.paymentMethod)
    .reduce((s, p) => s + p.amountPaid, 0);

  // 2. GROUP STATEMENT (For monthly student tuition roster)
  const targetCourses = courseFilter === 'ALL'
    ? courses
    : courses.filter((c) => c.id === courseFilter);

  const selectedCourseObj = courses.find((c) => c.id === courseFilter);

  interface StatementRow {
    student: Student;
    course: Course;
    teacherName: string;
    finalAmountDue: number;
    amountPaid: number;
    debtAmount: number;
    status: 'PAID' | 'PARTIAL' | 'DEBT';
    paymentMethodText: string;
    paidAt?: string;
  }

  const statementRows: StatementRow[] = useMemo(() => {
    const rows: StatementRow[] = [];
    const monthPayments = payments.filter((p) => p.monthPeriod === selectedMonth);

    targetCourses.forEach((crs) => {
      const teacher = teachers.find((t) => t.id === crs.teacherId);
      const enrolledStudents = students.filter((s) => s.enrolledCourseIds.includes(crs.id));

      enrolledStudents.forEach((st) => {
        const studentTransactions = monthPayments.filter(
          (pm) => pm.studentId === st.id && pm.courseId === crs.id && (pm.amountPaid || 0) > 0
        );
        const totalAmountPaid = studentTransactions.reduce((s, pm) => s + (pm.amountPaid || 0), 0);
        const baseDoc = monthPayments.find((pm) => pm.studentId === st.id && pm.courseId === crs.id);

        const finalAmountDue = baseDoc ? baseDoc.finalAmountDue : crs.monthlyPrice;
        const amountPaid = totalAmountPaid;
        const debtAmount = Math.max(0, finalAmountDue - amountPaid);

        let status: 'PAID' | 'PARTIAL' | 'DEBT' = 'DEBT';
        if (amountPaid >= finalAmountDue && finalAmountDue > 0) {
          status = 'PAID';
        } else if (amountPaid > 0) {
          status = 'PARTIAL';
        }

        const sortedTransactions = [...studentTransactions].sort(
          (a, b) => (b.paidAt || '').localeCompare(a.paidAt || '')
        );
        const latestTransaction = sortedTransactions[0] || baseDoc;

        let paymentMethodText = '—';
        if (latestTransaction?.paymentMethod === 'CASH') paymentMethodText = 'Наличные';
        if (latestTransaction?.paymentMethod === 'CARD') paymentMethodText = 'Карта';

        if (methodFilter !== 'ALL' && amountPaid > 0) {
          const hasMatchingMethod = studentTransactions.some((tx) => (tx.paymentMethod || 'CARD') === methodFilter);
          if (!hasMatchingMethod) return;
        }

        rows.push({
          student: st,
          course: crs,
          teacherName: teacher?.fullName || '—',
          finalAmountDue,
          amountPaid,
          debtAmount,
          status,
          paymentMethodText,
          paidAt: latestTransaction?.paidAt,
        });
      });
    });

    return rows;
  }, [targetCourses, courses, students, payments, selectedMonth, teachers, methodFilter]);

  const statementTotalExpected = statementRows.reduce((s, r) => s + r.finalAmountDue, 0);
  const statementTotalPaid = statementRows.reduce((s, r) => s + r.amountPaid, 0);
  const statementTotalDebt = statementRows.reduce((s, r) => s + r.debtAmount, 0);

  // Human Readable Period Title
  const periodLabelText = useMemo(() => {
    if (periodMode === 'DAY') {
      return `за день: ${formatDateRu(selectedDay)}`;
    } else if (periodMode === 'MONTH') {
      return `за месяц: ${formatMonthPeriodHuman(selectedMonth)}`;
    } else {
      return `за период: с ${formatDateRu(rangeFrom)} по ${formatDateRu(rangeTo)}`;
    }
  }, [periodMode, selectedDay, selectedMonth, rangeFrom, rangeTo]);

  if (!isOpen) return null;

  // Ultra-reliable Isolated Printing to prevent blank pages
  const handlePrint = () => {
    if (!reportRef.current) return;
    const reportHtml = reportRef.current.innerHTML;

    const printCss = `
      @page {
        size: A4 portrait;
        margin: 5mm 6mm 5mm 6mm;
      }
      body {
        padding: 4mm 5mm;
        font-size: 9pt;
        line-height: 1.25;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 6px;
      }
      th, td {
        border: 1px solid #000000;
        padding: 3px 5px;
        font-size: 8.5pt;
        line-height: 1.2;
      }
      th {
        background-color: #f2f2f2;
        font-weight: bold;
        text-align: left;
      }
      .bg-slate-200, .bg-slate-100 {
        background-color: #f2f2f2 !important;
      }
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      .font-bold { font-weight: bold; }
      .font-black { font-weight: 900; }
      .font-mono { font-family: monospace; }
      .border-b-2 { border-bottom: 2px solid #000000; }
      .border-t-2 { border-top: 2px solid #000000; }
      .border-t { border-top: 1px solid #000000; }
    `;

    printHtmlDirectly(
      `<div class="printable-container">${reportHtml}</div>`,
      `Отчет_${reportFormat}_${periodMode}_${selectedDay}`,
      printCss
    );
  };

  // Direct PDF Download
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
      const imgWidth = 210;
      const pageHeight = 295;
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

      const fileName = `Финансовый_отчет_${reportFormat}_${periodMode === 'DAY' ? selectedDay : selectedMonth}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Error generating PDF report:', err);
      alert('Ошибка при генерации PDF. Попробуйте нажать кнопку «Печать отчета».');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Screen Modal Container with scrollable content */}
      <div className="bg-white border border-slate-200 rounded-3xl max-w-5xl w-full max-h-[95vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
        
        {/* Modal Top Header (Fixed at top) */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 shrink-0 bg-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 leading-none">
                Печать отчета об оплатах (Касса и Ведомости)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Выберите конкретный день, месяц или диапазон дат для компактной распечатки на А4
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl border border-indigo-200 flex items-center space-x-1.5 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              title="Скачать файл PDF на устройство"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Скачать PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 cursor-pointer transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Распечатать отчет (А4)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-xs cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Interactive Controls & Filters Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-3 shrink-0 text-xs">
          {/* Row 1: Period Mode Selector & Date Inputs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            {/* Period Mode Switcher */}
            <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setPeriodMode('DAY')}
                className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer flex items-center space-x-1.5 ${
                  periodMode === 'DAY'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>📅 За выбранный день</span>
              </button>

              <button
                type="button"
                onClick={() => setPeriodMode('MONTH')}
                className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer flex items-center space-x-1.5 ${
                  periodMode === 'MONTH'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>📆 За месяц</span>
              </button>

              <button
                type="button"
                onClick={() => setPeriodMode('RANGE')}
                className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer flex items-center space-x-1.5 ${
                  periodMode === 'RANGE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>📊 За период (Даты)</span>
              </button>
            </div>

            {/* Date / Month Picker based on Mode */}
            <div className="flex flex-wrap items-center gap-2">
              {periodMode === 'DAY' && (
                <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="font-bold text-slate-600">Дата дня:</span>
                  <input
                    type="date"
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <div className="flex items-center space-x-1 pl-1">
                    <button
                      type="button"
                      onClick={() => handleSetQuickDay(0)}
                      className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                        selectedDay === getUzbekistanToday()
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Сегодня
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetQuickDay(-1)}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                    >
                      Вчера
                    </button>
                  </div>
                </div>
              )}

              {periodMode === 'MONTH' && (
                <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="font-bold text-slate-600">Месяц:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {getGeneratedMonthPeriods(currentActualMonth, 12, 6).map((m) => (
                      <option key={m} value={m}>
                        {formatMonthPeriodLabel(m)} {m === currentActualMonth ? '★ (Текущий)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {periodMode === 'RANGE' && (
                <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="font-bold text-slate-600">С:</span>
                  <input
                    type="date"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    className="font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                  />
                  <span className="font-bold text-slate-600">По:</span>
                  <input
                    type="date"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                    className="font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                  />
                </div>
              )}
            </div>

          </div>

          {/* Row 2: Secondary Filters & Report Format Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
            
            {/* Format Selector */}
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-500">Вид отчета:</span>
              <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setReportFormat('TRANSACTIONS')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    reportFormat === 'TRANSACTIONS'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  💵 Реестр фактических платежей ({filteredTransactions.length})
                </button>

                <button
                  type="button"
                  onClick={() => setReportFormat('GROUP_STATEMENT')}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    reportFormat === 'GROUP_STATEMENT'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📋 Ведомость группы (План/Долг)
                </button>
              </div>
            </div>

            {/* Course & Method Dropdowns */}
            <div className="flex items-center space-x-2">
              {/* Group Selector */}
              <div className="flex items-center space-x-1 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 font-bold">Группа:</span>
                <select
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="bg-slate-50 text-slate-800 font-bold text-xs rounded-lg px-2 py-0.5 border border-slate-200 focus:outline-none"
                >
                  <option value="ALL">Все группы (Курсы)</option>
                  {courses.map((c, idx) => (
                    <option key={`${c.id}-${idx}`} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method Selector */}
              <div className="flex items-center space-x-1 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-bold">Способ:</span>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value as any)}
                  className="bg-slate-50 text-slate-800 font-bold text-xs rounded-lg px-2 py-0.5 border border-slate-200 focus:outline-none"
                >
                  <option value="ALL">Все (Нал + Карта)</option>
                  <option value="CASH">Только Наличные</option>
                  <option value="CARD">Только Карта</option>
                </select>
              </div>
            </div>

          </div>
        </div>

        {/* PRINTABLE COMPACT A4 DOCUMENT CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex justify-center">
          <div
            ref={reportRef}
            id="printable-finance-report"
            className="w-full max-w-4xl bg-white text-black p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200"
          >
            {/* 1. DOCUMENT HEADER (Ultra Compact in 2 Rows) */}
            <div className="border-b-2 border-black pb-2 flex justify-between items-start">
              <div>
                <div className="flex items-center space-x-2 font-black text-base uppercase tracking-tight text-black">
                  <Building2 className="w-5 h-5 inline" />
                  <span>REDCAT — УЧЕБНЫЙ ЦЕНТР</span>
                </div>
                <div className="text-[11px] font-black uppercase tracking-wide mt-0.5 text-black">
                  {reportFormat === 'TRANSACTIONS' 
                    ? `КАССОВЫЙ РЕЕСТР ПОСТУПЛЕНИЯ ОПЛАТ ${periodLabelText.toUpperCase()}`
                    : `ФИНАНСОВАЯ ВЕДОМОСТЬ ПО КУРСАМ ${periodLabelText.toUpperCase()}`
                  }
                </div>
              </div>

              <div className="text-right text-[10px] font-mono font-bold text-black space-y-0.5">
                <div>Сформировано: {getUzbekistanLocaleString()}</div>
                <div>Группа: {selectedCourseObj ? selectedCourseObj.title : 'Все группы центра'}</div>
              </div>
            </div>

            {/* 2. SUMMARY KPI STRIP (Ultra Compact 1-line Summary for Paper Optimization) */}
            <div className="my-2 p-2 bg-slate-100 border border-slate-400 text-[11px] text-black font-bold flex flex-wrap items-center justify-between gap-2">
              {reportFormat === 'TRANSACTIONS' ? (
                <>
                  <div>
                    Всего платежей: <span className="font-black text-black font-mono">{totalTransactionsCount} шт.</span>
                  </div>
                  <div>
                    ИТОГО СОБРАНО: <span className="font-black text-black font-mono">{totalTransactionsSum.toLocaleString('ru-RU')} сум</span>
                  </div>
                  <div>
                    Наличные: <span className="font-mono">{totalCashSum.toLocaleString('ru-RU')} сум</span>
                  </div>
                  <div>
                    Карта/Перевод: <span className="font-mono">{totalCardSum.toLocaleString('ru-RU')} сум</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    Всего учеников: <span className="font-black font-mono">{statementRows.length} чел.</span>
                  </div>
                  <div>
                    План: <span className="font-black font-mono">{statementTotalExpected.toLocaleString('ru-RU')} сум</span>
                  </div>
                  <div>
                    Собрано: <span className="font-black font-mono">{statementTotalPaid.toLocaleString('ru-RU')} сум</span>
                  </div>
                  <div>
                    Остаток долга: <span className="font-black font-mono">{statementTotalDebt.toLocaleString('ru-RU')} сум</span>
                  </div>
                </>
              )}
            </div>

            {/* 3. DENSE HIGH-CONTRAST DATA TABLE */}
            {reportFormat === 'TRANSACTIONS' ? (
              /* FORMAT A: TRANSACTIONS / PAYMENTS REGISTER */
              <div className="mt-2">
                {filteredTransactions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 italic border border-dashed border-slate-300 rounded-lg">
                    За выбранный день/период ({periodLabelText}) поступивших платежей не найдено.
                  </div>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse border border-black">
                    <thead>
                      <tr className="bg-slate-200 text-black font-bold border-b border-black">
                        <th className="py-1 px-1.5 text-center w-7 border-r border-black">№</th>
                        <th className="py-1 px-2 border-r border-black w-24">Дата / Время</th>
                        <th className="py-1 px-2 border-r border-black">ФИО Ученика</th>
                        <th className="py-1 px-2 border-r border-black w-24">Телефон</th>
                        <th className="py-1 px-2 border-r border-black">Курс / Группа</th>
                        <th className="py-1 px-2 border-r border-black w-20 text-center">Способ</th>
                        <th className="py-1 px-2 border-r border-black text-right w-24">Сумма (сум)</th>
                        <th className="py-1 px-2">Чек / Примечание</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {filteredTransactions.map((p, idx) => {
                        const st = students.find((s) => s.id === p.studentId);
                        const crs = courses.find((c) => c.id === p.courseId);

                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-1 px-1.5 text-center font-bold font-mono border-r border-black">
                              {idx + 1}
                            </td>
                            <td className="py-1 px-2 font-mono text-[10px] border-r border-black whitespace-nowrap">
                              {formatDateRu(p.paidAt || p.monthPeriod)}
                            </td>
                            <td className="py-1 px-2 font-extrabold border-r border-black">
                              {st?.fullName || 'Ученик'}
                            </td>
                            <td className="py-1 px-2 font-mono text-[10px] border-r border-black whitespace-nowrap">
                              {st?.phone || '—'}
                            </td>
                            <td className="py-1 px-2 font-medium border-r border-black">
                              {crs?.title || '—'}
                            </td>
                            <td className="py-1 px-2 text-center font-bold text-[10px] border-r border-black whitespace-nowrap">
                              {p.paymentMethod === 'CASH' ? 'Наличные' : 'Карта'}
                            </td>
                            <td className="py-1 px-2 font-mono font-black text-right border-r border-black whitespace-nowrap">
                              {p.amountPaid.toLocaleString('ru-RU')}
                            </td>
                            <td className="py-1 px-2 text-[10px] font-medium text-slate-700">
                              {p.notes || `Чек ${p.id.toUpperCase().slice(-6)}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-200 text-black font-black border-t-2 border-black text-[11px]">
                        <td colSpan={6} className="py-1 px-2 text-right uppercase border-r border-black">
                          ИТОГО ПО КАССОВОМУ ОТЧЕТУ:
                        </td>
                        <td className="py-1 px-2 font-mono text-right border-r border-black whitespace-nowrap">
                          {totalTransactionsSum.toLocaleString('ru-RU')} сум
                        </td>
                        <td className="py-1 px-2 text-[10px]">
                          Нал: {totalCashSum.toLocaleString('ru-RU')} | Карта: {totalCardSum.toLocaleString('ru-RU')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            ) : (
              /* FORMAT B: GROUP STATEMENT ROSTER */
              <div className="mt-2">
                {statementRows.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 italic border border-dashed border-slate-300 rounded-lg">
                    В выбранных группах отсутствуют зачисленные ученики.
                  </div>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse border border-black">
                    <thead>
                      <tr className="bg-slate-200 text-black font-bold border-b border-black">
                        <th className="py-1 px-1.5 text-center w-7 border-r border-black">№</th>
                        <th className="py-1 px-2 border-r border-black">ФИО Ученика</th>
                        <th className="py-1 px-2 border-r border-black w-24">Телефон</th>
                        <th className="py-1 px-2 border-r border-black">Группа / Курс</th>
                        <th className="py-1 px-2 border-r border-black text-right w-24">К оплате</th>
                        <th className="py-1 px-2 border-r border-black text-right w-24">Оплачено</th>
                        <th className="py-1 px-2 border-r border-black text-right w-24">Долг</th>
                        <th className="py-1 px-2 text-center w-20">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {statementRows.map((r, idx) => (
                        <tr key={`${r.student.id}-${r.course.id}`} className="hover:bg-slate-50">
                          <td className="py-1 px-1.5 text-center font-bold font-mono border-r border-black">
                            {idx + 1}
                          </td>
                          <td className="py-1 px-2 font-extrabold border-r border-black">
                            {r.student.fullName}
                          </td>
                          <td className="py-1 px-2 font-mono text-[10px] border-r border-black whitespace-nowrap">
                            {r.student.phone}
                          </td>
                          <td className="py-1 px-2 font-medium border-r border-black">
                            {r.course.title}
                          </td>
                          <td className="py-1 px-2 font-mono font-bold text-right border-r border-black">
                            {r.finalAmountDue.toLocaleString('ru-RU')}
                          </td>
                          <td className="py-1 px-2 font-mono font-black text-right border-r border-black">
                            {r.amountPaid.toLocaleString('ru-RU')}
                          </td>
                          <td className="py-1 px-2 font-mono font-bold text-right border-r border-black">
                            {r.debtAmount > 0 ? r.debtAmount.toLocaleString('ru-RU') : '0'}
                          </td>
                          <td className="py-1 px-2 text-center font-bold text-[10px]">
                            {r.status === 'PAID' ? '✓ ОПЛАЧЕНО' : r.status === 'PARTIAL' ? '⚠️ ЧАСТИЧНО' : '✕ ДОЛГ'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-200 text-black font-black border-t-2 border-black text-[11px]">
                        <td colSpan={4} className="py-1 px-2 text-right uppercase border-r border-black">
                          ИТОГО ПО ВЕДОМОСТИ:
                        </td>
                        <td className="py-1 px-2 font-mono text-right border-r border-black whitespace-nowrap">
                          {statementTotalExpected.toLocaleString('ru-RU')}
                        </td>
                        <td className="py-1 px-2 font-mono text-right border-r border-black whitespace-nowrap">
                          {statementTotalPaid.toLocaleString('ru-RU')}
                        </td>
                        <td className="py-1 px-2 font-mono text-right border-r border-black whitespace-nowrap">
                          {statementTotalDebt.toLocaleString('ru-RU')}
                        </td>
                        <td className="py-1 px-2 text-center text-[10px]">
                          {statementTotalExpected > 0 ? Math.round((statementTotalPaid / statementTotalExpected) * 100) : 0}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}

            {/* 4. COMPACT 1-ROW SIGNATURE & FOOTER BLOCK */}
            <div className="pt-4 border-t border-black mt-4 flex justify-between items-end text-[11px] font-bold text-black">
              <div>
                <span>Кассир / Администратор: _____________________ (подпись)</span>
              </div>
              <div className="text-right">
                <span>Руководитель центра: _____________________ (подпись)</span>
              </div>
            </div>

            <div className="text-center pt-2 text-[9px] font-mono text-black">
              REDCAT CRM • Официальный финансовый документ • Страница отчета
            </div>

          </div>
        </div>

        {/* Modal Bottom Footer (Fixed) */}
        <div className="flex items-center justify-between p-3.5 border-t border-slate-200 bg-white shrink-0 shadow-md">
          <div className="text-xs text-slate-500 font-medium">
            💡 Нажмите <b>«Распечатать отчет»</b> или <b>«Скачать PDF»</b> для получения официального документа А4.
          </div>
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Закрыть
            </button>
            <button
              type="button"
              onClick={handlePrint}
              autoFocus
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center space-x-2 cursor-pointer transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Распечатать отчет (А4)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
