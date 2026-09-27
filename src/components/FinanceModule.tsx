import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Calendar,
  FileSpreadsheet,
  UserCheck,
  Award,
  Banknote,
  CreditCard,
  X,
  Trash2,
  Printer,
  Filter,
  Search,
  Users,
  CheckCircle2,
  AlertCircle,
  XCircle,
  TrendingDown,
  TrendingUp,
  PlusCircle,
  Building2,
  Zap,
  Package,
  Megaphone,
  FileText,
  Wrench,
  Wifi,
  MoreHorizontal,
  Edit3,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Receipt,
  Check,
  Download,
  Snowflake,
  AlertTriangle,
  ShieldAlert,
  HeartHandshake,
  HelpCircle,
  Smartphone,
  Send,
  ArrowDownWideNarrow,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import {
  Payment,
  Student,
  Course,
  TeacherProfile,
  Subject,
  AttendanceRecord,
  PaymentMethod,
  Expense,
  ExpenseCategory,
  SmsLog,
  SmsGatewayConfig,
  StaffMember,
  User,
} from '../types';
import { calculateTeacherSalary, calculateFreezeDeduction, roundToThousand } from '../lib/billingLogic';
import {
  getUzbekistanLocaleString,
  getUzbekistanToday,
  getUzbekistanYesterday,
  getUzbekistanISOString,
  getUzbekistanCurrentMonthPeriod,
  formatMonthPeriodLabel,
  getGeneratedMonthPeriods,
  formatDisplayDateRu,
  extractDateFromPayment,
} from '../lib/dateUtils';
import { ReceiptModal, ReceiptData } from './ReceiptModal';
import { GroupFinanceReportModal } from './GroupFinanceReportModal';
import { MonthlyFinancePdfModal } from './MonthlyFinancePdfModal';
import { EditPaymentModal } from './EditPaymentModal';
import { MassDebtSmsModal } from './MassDebtSmsModal';

export const EXPENSE_CATEGORY_CONFIG: Record<
  ExpenseCategory,
  { label: string; bg: string; text: string; border: string }
> = {
  TEACHER_SALARY: {
    label: 'Зарплата учителей',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  RENT: {
    label: 'Аренда помещений',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  UTILITIES: {
    label: 'Коммунальные услуги',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  SUPPLIES: {
    label: 'Канцелярия и материалы',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  MARKETING: {
    label: 'Реклама и маркетинг',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  TAXES: {
    label: 'Налоги и сборы',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
  MAINTENANCE: {
    label: 'Ремонт и хоз. нужды',
    bg: 'bg-stone-50',
    text: 'text-stone-700',
    border: 'border-stone-200',
  },
  SOFTWARE: {
    label: 'Интернет и связь',
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
  },
  OTHER: {
    label: 'Прочие расходы',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
  },
};

interface FinanceModuleProps {
  payments: Payment[];
  expenses?: Expense[];
  students: Student[];
  courses: Course[];
  teachers: TeacherProfile[];
  subjects?: Subject[];
  attendanceRecords: AttendanceRecord[];
  onRegisterPayment: (
    paymentId: string,
    amountPaid: number,
    status: Payment['status'],
    method?: PaymentMethod,
    notes?: string,
    recordedBy?: string,
    fullPayment?: Payment
  ) => void;
  onUpdatePayment?: (payment: Payment) => void;
  onDeletePayment?: (paymentId: string) => void;
  onAddExpense?: (expense: Expense) => void;
  onUpdateExpense?: (expense: Expense) => void;
  onDeleteExpense?: (expenseId: string) => void;
  onPayTeacherSalary?: (
    teacherId: string,
    monthPeriod: string,
    amount: number,
    paymentMethod: PaymentMethod,
    notes?: string
  ) => void;
  onOpenQuickPaymentModal?: () => void;
  onSendSms?: (sms: Partial<SmsLog>) => void;
  currentUser?: User | null;
  staffMembers?: StaffMember[];
  gatewayConfig?: SmsGatewayConfig;
  onUpdateGatewayConfig?: (newConfig: Partial<SmsGatewayConfig>) => void;
}

export const FinanceModule: React.FC<FinanceModuleProps> = ({
  payments,
  expenses = [],
  students,
  courses,
  teachers,
  subjects = [],
  onRegisterPayment,
  onUpdatePayment,
  onDeletePayment,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onPayTeacherSalary,
  onOpenQuickPaymentModal,
  onSendSms,
  currentUser,
  staffMembers = [],
  gatewayConfig,
  onUpdateGatewayConfig,
}) => {
  const currentActualPeriod = getUzbekistanCurrentMonthPeriod();
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => currentActualPeriod);
  const [activeTab, setActiveTab] = useState<'payments' | 'expenses' | 'payroll'>('payments');
  const [isMassSmsOpen, setIsMassSmsOpen] = useState<boolean>(false);

  // Filters for Payments
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'ALL' | 'CASH' | 'CARD'>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID' | 'PARTIAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Date Filter for Payments: 'TODAY' | 'YESTERDAY' | 'CUSTOM' | 'ALL_MONTH'
  // When switching to or viewing PAID or PARTIAL, defaults to TODAY
  const [paymentDateFilterMode, setPaymentDateFilterMode] = useState<'TODAY' | 'YESTERDAY' | 'CUSTOM' | 'ALL_MONTH'>('TODAY');
  const [customPaymentDate, setCustomPaymentDate] = useState<string>(() => getUzbekistanToday());

  const uzToday = getUzbekistanToday();
  const uzYesterday = getUzbekistanYesterday();

  const activeFilterDate = useMemo(() => {
    if (paymentDateFilterMode === 'TODAY') return uzToday;
    if (paymentDateFilterMode === 'YESTERDAY') return uzYesterday;
    if (paymentDateFilterMode === 'CUSTOM') return customPaymentDate;
    return null; // 'ALL_MONTH'
  }, [paymentDateFilterMode, uzToday, uzYesterday, customPaymentDate]);

  // Filters for Expenses
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('ALL');
  const [expenseMethodFilter, setExpenseMethodFilter] = useState<string>('ALL');
  const [expenseSearchQuery, setExpenseSearchQuery] = useState<string>('');

  // Group Report Print Modal
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // Register Payment Modal State
  const [paymentToRegister, setPaymentToRegister] = useState<Payment | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
  const [paymentMethodInput, setPaymentMethodInput] = useState<PaymentMethod>('CARD');
  const [paymentAdminInput, setPaymentAdminInput] = useState<string>(() => currentUser?.fullName || 'Главный Администратор');
  const [paymentNotesInput, setPaymentNotesInput] = useState<string>('');

  // Edit Payment Modal State
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState<boolean>(false);
  const [paymentForRecalculateWarning, setPaymentForRecalculateWarning] = useState<Payment | null>(null);

  // Add/Edit Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseTitle, setExpenseTitle] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('RENT');
  const [expenseMonth, setExpenseMonth] = useState<string>(() => currentActualPeriod);
  const [expenseMethod, setExpenseMethod] = useState<PaymentMethod>('CASH');
  const [expenseDate, setExpenseDate] = useState<string>(getUzbekistanToday());
  const [expenseNotes, setExpenseNotes] = useState<string>('');

  // Pay Teacher Salary Modal State
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState<boolean>(false);
  const [selectedTeacherForSalary, setSelectedTeacherForSalary] = useState<TeacherProfile | null>(null);
  const [salaryPayAmount, setSalaryPayAmount] = useState<string>('');
  const [salaryPayMethod, setSalaryPayMethod] = useState<PaymentMethod>('CASH');
  const [salaryPayMonth, setSalaryPayMonth] = useState<string>(() => currentActualPeriod);
  const [salaryPayNotes, setSalaryPayNotes] = useState<string>('');

  // Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);

  // Monthly PDF Report Modal State
  const [isMonthlyPdfModalOpen, setIsMonthlyPdfModalOpen] = useState<boolean>(false);

  // Month periods list (past, current, future)
  const allPeriods = useMemo(() => {
    return Array.from(
      new Set([
        ...getGeneratedMonthPeriods(currentActualPeriod, 12, 6),
        ...payments.map((p) => p.monthPeriod).filter(Boolean),
        ...expenses.map((e) => e.monthPeriod).filter(Boolean),
      ])
    ).sort().reverse();
  }, [currentActualPeriod, payments, expenses]);

  const handleStepMonth = (direction: number) => {
    const [yearStr, monthStr] = selectedPeriod.split('-');
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
    setSelectedPeriod(`${year}-${mStr}`);
  };

  // Filter payments by selected month period for Historical Archive
  const periodPayments = useMemo(
    () => payments.filter((p) => p.monthPeriod === selectedPeriod),
    [payments, selectedPeriod]
  );

  // Unique subjects extracted from subjects collection and courses
  const availableSubjects = useMemo(() => {
    const map = new Map<string, string>();
    (subjects || []).forEach((s) => {
      if (s.name && s.name.trim()) {
        map.set(s.name.trim().toLowerCase(), s.name.trim());
      }
    });
    courses.forEach((c) => {
      if (c.subject && c.subject.trim()) {
        const trimmed = c.subject.trim();
        if (!map.has(trimmed.toLowerCase())) {
          map.set(trimmed.toLowerCase(), trimmed);
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [subjects, courses]);

  // Target courses for subject filter
  const targetCoursesToInclude = useMemo(() => {
    if (selectedSubject === 'ALL') return courses;
    const norm = selectedSubject.trim().toLowerCase();
    return courses.filter((c) => (c.subject || '').trim().toLowerCase() === norm);
  }, [courses, selectedSubject]);

  const targetCourseIdSet = useMemo(() => {
    return new Set(targetCoursesToInclude.map((c) => c.id));
  }, [targetCoursesToInclude]);

  // Subject filtered raw payments
  const courseFilteredPayments = useMemo(
    () => periodPayments.filter((p) => targetCourseIdSet.has(p.courseId)),
    [periodPayments, targetCourseIdSet]
  );

  // Combine and group payments per student + course for the selected month
  const monthAllDisplayPayments: Payment[] = useMemo(() => {
    // 1. Group actual payment records by studentId___courseId
    const groups = new Map<string, Payment[]>();
    courseFilteredPayments.forEach((p) => {
      const key = `${p.studentId}___${p.courseId}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(p);
    });

    const list: Payment[] = [];

    // Process all groups that have actual payments
    groups.forEach((groupPayments, key) => {
      const [studentId, courseId] = key.split('___');
      const st = students.find((s) => s.id === studentId);
      const paidTransactions = groupPayments.filter((p) => (p.amountPaid || 0) > 0);
      const totalPaid = paidTransactions.reduce((s, p) => s + (p.amountPaid || 0), 0);

      // If student is no longer enrolled in this course and paid nothing (0 sum):
      // Skip this group completely! No phantom debt or duplicate billing in old groups.
      if (st && !st.enrolledCourseIds.includes(courseId) && totalPaid === 0) {
        return;
      }

      // Sort transactions by paidAt descending (newest first)
      paidTransactions.sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''));

      // Use the earliest or primary payment record for baseCalculatedAmount, discount, excusedCredit, etc.
      const baseRecord = groupPayments[0];
      const finalDue = baseRecord.finalAmountDue;

      let status: Payment['status'] = 'DEBT';
      if (totalPaid >= finalDue && finalDue > 0) {
        status = 'PAID';
      } else if (totalPaid > 0 && totalPaid < finalDue) {
        status = 'PARTIAL';
      } else if (finalDue === 0 && (baseRecord.excusedCreditDeduction > 0 || baseRecord.discountApplied > 0)) {
        status = 'RECALCULATED';
      }

      const latestTransaction = paidTransactions[0] || baseRecord;

      list.push({
        ...baseRecord,
        amountPaid: totalPaid,
        status,
        paymentMethod: latestTransaction.paymentMethod || baseRecord.paymentMethod,
        paidAt: latestTransaction.paidAt || baseRecord.paidAt,
        recordedBy: latestTransaction.recordedBy || baseRecord.recordedBy,
        paymentHistory: paidTransactions,
      });
    });

    // 2. Add enrolled students who don't have any payment records yet
    targetCoursesToInclude.forEach((crs) => {
      const enrolledStudents = students.filter((s) => s.enrolledCourseIds.includes(crs.id));
      enrolledStudents.forEach((st) => {
        const key = `${st.id}___${crs.id}`;
        if (!groups.has(key)) {
          // Automatic Freeze Tuition Reduction
          const freezeCalc = calculateFreezeDeduction(st, crs, selectedPeriod);

          // Personal discount calculation
          let discountAmount = 0;
          if (st.discountType === 'PERCENTAGE') {
            discountAmount = roundToThousand((crs.monthlyPrice * (st.discountValue || 0)) / 100);
          } else if (st.discountType === 'FIXED_SUM') {
            discountAmount = roundToThousand(Math.min(crs.monthlyPrice, st.discountValue || 0));
          }

          const finalAmountDue = roundToThousand(Math.max(0, crs.monthlyPrice - discountAmount - freezeCalc.deductionAmount));
          const remainingLessons = Math.max(0, 12 - freezeCalc.frozenLessonsCount);
          const status: Payment['status'] =
            finalAmountDue === 0 && freezeCalc.deductionAmount > 0 ? 'RECALCULATED' : 'DEBT';

          list.push({
            id: `virt___${st.id}___${crs.id}___${selectedPeriod}`,
            studentId: st.id,
            courseId: crs.id,
            monthPeriod: selectedPeriod,
            isFirstMonth: false,
            remainingLessonsCount: remainingLessons,
            baseCalculatedAmount: crs.monthlyPrice,
            discountApplied: discountAmount,
            excusedCreditDeduction: freezeCalc.deductionAmount,
            finalAmountDue,
            amountPaid: 0,
            status,
            notes: freezeCalc.frozenLessonsCount > 0 ? freezeCalc.details : undefined,
            paymentHistory: [],
          });
        }
      });
    });

    return list;
  }, [courseFilteredPayments, targetCoursesToInclude, students, selectedPeriod]);

  // Combine payments depending on date filter mode
  const allDisplayPayments: Payment[] = useMemo(() => {
    // If filtering by a specific payment date (TODAY, YESTERDAY, CUSTOM) and not in UNPAID view:
    if (activeFilterDate && paymentDateFilterMode !== 'ALL_MONTH' && paymentStatusFilter !== 'UNPAID') {
      const datePayments = payments.filter((p) => {
        const pDate = extractDateFromPayment(p);
        const matchCourse = targetCourseIdSet.has(p.courseId);
        return pDate === activeFilterDate && p.amountPaid > 0 && matchCourse;
      });

      return datePayments.map((p) => {
        if (p.amountPaid >= p.finalAmountDue && p.finalAmountDue > 0 && p.status !== 'PAID') {
          return { ...p, status: 'PAID' };
        }
        if (p.amountPaid > 0 && p.amountPaid < p.finalAmountDue && p.status !== 'PARTIAL') {
          return { ...p, status: 'PARTIAL' };
        }
        return p;
      });
    }

    // Otherwise return full month display payments
    return monthAllDisplayPayments;
  }, [
    activeFilterDate,
    paymentDateFilterMode,
    paymentStatusFilter,
    payments,
    targetCourseIdSet,
    monthAllDisplayPayments,
  ]);

  // Statistics for Date Filter buttons (Today, Yesterday, Custom, Month)
  const dateFilterStats = useMemo(() => {
    const filterBySubjectAndMethod = (p: Payment) => {
      if (!targetCourseIdSet.has(p.courseId)) return false;
      if (paymentMethodFilter === 'CASH') {
        return p.paymentMethod === 'CASH';
      }
      if (paymentMethodFilter === 'CARD') {
        return p.paymentMethod === 'CARD' || !p.paymentMethod;
      }
      return true;
    };

    // 1. Today
    const todayPayments = payments.filter((p) => extractDateFromPayment(p) === uzToday && p.amountPaid > 0 && filterBySubjectAndMethod(p));
    const todayCount = todayPayments.length;
    const todaySum = todayPayments.reduce((s, p) => s + p.amountPaid, 0);
    const todayCash = todayPayments.filter((p) => p.paymentMethod === 'CASH').reduce((s, p) => s + p.amountPaid, 0);
    const todayCard = todayPayments.filter((p) => p.paymentMethod === 'CARD' || !p.paymentMethod).reduce((s, p) => s + p.amountPaid, 0);

    // 2. Yesterday
    const yesterdayPayments = payments.filter((p) => extractDateFromPayment(p) === uzYesterday && p.amountPaid > 0 && filterBySubjectAndMethod(p));
    const yesterdayCount = yesterdayPayments.length;
    const yesterdaySum = yesterdayPayments.reduce((s, p) => s + p.amountPaid, 0);

    // 3. Custom
    let customCount = 0;
    let customSum = 0;
    if (customPaymentDate) {
      const customPayments = payments.filter((p) => extractDateFromPayment(p) === customPaymentDate && p.amountPaid > 0 && filterBySubjectAndMethod(p));
      customCount = customPayments.length;
      customSum = customPayments.reduce((s, p) => s + p.amountPaid, 0);
    }

    // 4. Month count
    const monthPaidCount = periodPayments.filter((p) => p.amountPaid > 0 && filterBySubjectAndMethod(p)).length;

    return {
      todayCount,
      todaySum,
      todayCash,
      todayCard,
      yesterdayCount,
      yesterdaySum,
      customCount,
      customSum,
      monthPaidCount,
    };
  }, [payments, periodPayments, uzToday, uzYesterday, customPaymentDate, targetCourseIdSet, paymentMethodFilter]);

  // Method counts for payment filter pills
  const methodStats = useMemo(() => {
    let cashCount = 0;
    let cardCount = 0;

    allDisplayPayments.forEach((p) => {
      if (p.paymentHistory && p.paymentHistory.length > 0) {
        let hasCash = false;
        let hasCard = false;
        p.paymentHistory.forEach((h) => {
          if ((h.amountPaid || 0) > 0) {
            if (h.paymentMethod === 'CASH') hasCash = true;
            else hasCard = true;
          }
        });
        if (hasCash) cashCount += 1;
        if (hasCard) cardCount += 1;
      } else if (p.amountPaid > 0) {
        if (p.paymentMethod === 'CASH') {
          cashCount += 1;
        } else {
          cardCount += 1;
        }
      }
    });

    return { cashCount, cardCount };
  }, [allDisplayPayments]);

  // Apply Status & Payment Method Filter
  const statusFilteredPayments = useMemo(() => {
    return allDisplayPayments.filter((p) => {
      // 1. Payment Method Filter (Наличные / Карта)
      if (paymentMethodFilter === 'CASH') {
        const directCash = p.paymentMethod === 'CASH' && p.amountPaid > 0;
        const historyCash = p.paymentHistory && p.paymentHistory.some((h) => h.paymentMethod === 'CASH' && (h.amountPaid || 0) > 0);
        if (!directCash && !historyCash) return false;
      } else if (paymentMethodFilter === 'CARD') {
        const directCard = (p.paymentMethod === 'CARD' || (!p.paymentMethod && p.amountPaid > 0)) && p.amountPaid > 0;
        const historyCard = p.paymentHistory && p.paymentHistory.some((h) => (h.paymentMethod === 'CARD' || !h.paymentMethod) && (h.amountPaid || 0) > 0);
        if (!directCard && !historyCard) return false;
      }

      // 2. Payment Status Filter
      const isPaid = p.status === 'PAID' || (p.amountPaid >= p.finalAmountDue && p.finalAmountDue > 0);
      const isPartial = !isPaid && p.amountPaid > 0 && p.amountPaid < p.finalAmountDue;
      const isUnpaid = !isPaid && !isPartial;

      if (paymentStatusFilter === 'ALL') return true;
      if (paymentStatusFilter === 'PAID') return isPaid;
      if (paymentStatusFilter === 'PARTIAL') return isPartial;
      if (paymentStatusFilter === 'UNPAID') return isUnpaid;
      return true;
    });
  }, [allDisplayPayments, paymentStatusFilter, paymentMethodFilter]);

  // Apply Student Search and Sort by Payment Date (Newest Payments First)
  const filteredPayments = useMemo(() => {
    let result = statusFilteredPayments;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const stMap = new Map<string, Student>(students.map((s) => [s.id, s]));
      result = statusFilteredPayments.filter((p) => {
        const st = stMap.get(p.studentId);
        return (st?.fullName || '').toLowerCase().includes(q) || (st?.phone || '').includes(q);
      });
    }

    // Helper: calculate payment recency score (timestamp in milliseconds)
    // Higher score = paid more recently (newest payments on top)
    const getPaymentScore = (p: Payment): number => {
      // If student hasn't paid anything, score is 0
      if (!p.amountPaid || p.amountPaid <= 0) {
        return 0;
      }
      let score = 0;
      // 1. Check paidAt timestamp/date string
      if (p.paidAt) {
        const parsed = Date.parse(p.paidAt);
        if (!isNaN(parsed)) {
          score = parsed;
        }
      }
      // 2. Check if payment ID has timestamp (e.g. pay-172578... or enr-172578...)
      const idMatch = p.id.match(/^(?:pay|enr)-(\d{10,14})/);
      if (idMatch) {
        const idTimestamp = parseInt(idMatch[1], 10);
        if (!isNaN(idTimestamp)) {
          score = Math.max(score, idTimestamp);
        }
      }
      // 3. Fallback: index in raw payments array (newer payments are prepended at lower indices in state)
      if (score === 0) {
        const idx = payments.findIndex((raw) => raw.id === p.id);
        if (idx !== -1) {
          score = 1000000000000 - idx;
        } else {
          score = 1;
        }
      }
      return score;
    };

    const stMap = new Map<string, Student>(students.map((s) => [s.id, s]));
    return [...result].sort((a, b) => {
      const scoreA = getPaymentScore(a);
      const scoreB = getPaymentScore(b);

      // Those who made payments (or paid more recently) appear first
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      // If both are unpaid (or have identical scores), sort alphabetically by student name
      const nameA = stMap.get(a.studentId)?.fullName || '';
      const nameB = stMap.get(b.studentId)?.fullName || '';
      return nameA.localeCompare(nameB, 'ru');
    });
  }, [statusFilteredPayments, searchQuery, students, payments]);

  // Financial KPIs for Selected Month Period
  const kpiPayments = monthAllDisplayPayments;
  const expectedRevenue = kpiPayments.reduce((s, p) => s + p.finalAmountDue, 0);
  const collectedRevenue = periodPayments.reduce((s, p) => s + p.amountPaid, 0);
  const cashCollected = periodPayments
    .filter((p) => p.paymentMethod === 'CASH')
    .reduce((s, p) => s + p.amountPaid, 0);
  const cardCollected = periodPayments
    .filter((p) => p.paymentMethod === 'CARD' || !p.paymentMethod)
    .reduce((s, p) => s + p.amountPaid, 0);

  const debtRevenue = Math.max(0, expectedRevenue - collectedRevenue);

  // Expenses for the selected period
  const periodExpenses = useMemo(
    () => expenses.filter((e) => e.monthPeriod === selectedPeriod),
    [expenses, selectedPeriod]
  );

  const totalExpenses = periodExpenses.reduce((s, e) => s + e.amount, 0);
  const cashExpenses = periodExpenses
    .filter((e) => e.paymentMethod === 'CASH')
    .reduce((s, e) => s + e.amount, 0);
  const cardExpenses = periodExpenses
    .filter((e) => e.paymentMethod === 'CARD')
    .reduce((s, e) => s + e.amount, 0);

  const salaryExpenses = periodExpenses
    .filter((e) => e.category === 'TEACHER_SALARY')
    .reduce((s, e) => s + e.amount, 0);
  const otherExpenses = totalExpenses - salaryExpenses;

  // NET Cash Register Balance (Остаток общей кассы после вычета расходов)
  const netBalance = collectedRevenue - totalExpenses;
  const netCashBalance = cashCollected - cashExpenses;
  const netCardBalance = cardCollected - cardExpenses;

  // Filtered Expenses list - Сверху новые расходы по принципу сверху новые снизу старые по датам
  const filteredExpenses = useMemo(() => {
    return periodExpenses
      .filter((e) => {
        if (expenseCategoryFilter !== 'ALL' && e.category !== expenseCategoryFilter) return false;
        if (expenseMethodFilter !== 'ALL' && e.paymentMethod !== expenseMethodFilter) return false;
        if (expenseSearchQuery.trim()) {
          const q = expenseSearchQuery.toLowerCase().trim();
          const teacher = teachers.find((t) => t.id === e.teacherId);
          const matchTitle = e.title.toLowerCase().includes(q);
          const matchNotes = (e.notes || '').toLowerCase().includes(q);
          const matchTeacher = teacher ? teacher.fullName.toLowerCase().includes(q) : false;
          if (!matchTitle && !matchNotes && !matchTeacher) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Сверху новые расходы, снизу старые (по дате расхода expenseDate, затем createdAt/id)
        const dateA = a.expenseDate || '';
        const dateB = b.expenseDate || '';
        if (dateB !== dateA) {
          return dateB.localeCompare(dateA);
        }
        const createdA = a.createdAt || '';
        const createdB = b.createdAt || '';
        if (createdB !== createdA) {
          return createdB.localeCompare(createdA);
        }
        return b.id.localeCompare(a.id);
      });
  }, [periodExpenses, expenseCategoryFilter, expenseMethodFilter, expenseSearchQuery, teachers]);

  // Payment Handlers
  const handleOpenPaymentModal = (p: Payment) => {
    setPaymentToRegister(p);
    const remainingDebt = Math.max(0, p.finalAmountDue - p.amountPaid);
    setPaymentAmountInput(remainingDebt > 0 ? String(remainingDebt) : String(p.finalAmountDue || ''));
    setPaymentMethodInput(p.paymentMethod || 'CARD');
    setPaymentNotesInput('');
    setPaymentAdminInput(currentUser?.fullName || 'Главный Администратор');
  };

  const handleConfirmPayment = () => {
    if (!paymentToRegister) return;

    const numericVal = parseInt(paymentAmountInput, 10);
    if (!numericVal || isNaN(numericVal) || numericVal <= 0) {
      alert('Введите корректную сумму оплаты (только цифры)!');
      return;
    }

    const newTotalPaid = paymentToRegister.amountPaid + numericVal;
    let newStatus: Payment['status'] = 'PAID';
    if (newTotalPaid < paymentToRegister.finalAmountDue) {
      newStatus = 'PARTIAL';
    }

    const methodText = paymentMethodInput === 'CASH' ? 'Наличные' : 'Перевод по карте';
    const noteText = `${paymentNotesInput ? paymentNotesInput + ' | ' : ''}Внесено ${numericVal.toLocaleString('ru-RU')} сум (${methodText})`;
    const adminName = paymentAdminInput || currentUser?.fullName || 'Главный Администратор';

    // If student already has recorded payments for this month, register as a distinct new transaction
    const hasExistingPaid = paymentToRegister.amountPaid > 0;
    const targetId = hasExistingPaid
      ? `new___${paymentToRegister.studentId}___${paymentToRegister.courseId}___${paymentToRegister.monthPeriod}`
      : paymentToRegister.id;

    onRegisterPayment(
      targetId,
      numericVal,
      newStatus,
      paymentMethodInput,
      noteText,
      adminName,
      paymentToRegister
    );

    const st = students.find((s) => s.id === paymentToRegister.studentId);
    const crs = courses.find((c) => c.id === paymentToRegister.courseId);

    const rData: ReceiptData = {
      receiptId: `REC-${Date.now().toString().slice(-6)}`,
      studentName: st?.fullName || 'Ученик',
      studentPhone: st?.phone,
      courseTitle: crs?.title || 'Курс',
      amountPaid: numericVal,
      monthPeriod: formatMonthPeriodLabel(paymentToRegister.monthPeriod),
      paymentMethod: paymentMethodInput,
      dateStr: getUzbekistanLocaleString(),
      notes: paymentNotesInput || undefined,
      adminName,
    };

    setActiveReceipt(rData);
    setIsReceiptOpen(true);
    setPaymentToRegister(null);
  };

  const handlePrintExistingPaymentReceipt = (p: Payment) => {
    const st = students.find((s) => s.id === p.studentId);
    const crs = courses.find((c) => c.id === p.courseId);

    const rData: ReceiptData = {
      receiptId: p.id.toUpperCase(),
      studentName: st?.fullName || 'Ученик',
      studentPhone: st?.phone,
      courseTitle: crs?.title || 'Курс',
      amountPaid: p.amountPaid,
      monthPeriod: formatMonthPeriodLabel(p.monthPeriod),
      paymentMethod: p.paymentMethod || 'CARD',
      dateStr: p.paidAt ? formatDisplayDateRu(p.paidAt) : getUzbekistanLocaleString(),
      notes: p.notes || undefined,
      adminName: p.recordedBy || p.updatedBy || 'Администратор',
    };

    setActiveReceipt(rData);
    setIsReceiptOpen(true);
  };

  const handleOpenRecalculateWarning = (p: Payment) => {
    setPaymentForRecalculateWarning(p);
  };

  const handleConfirmRecalculateWarning = () => {
    if (paymentForRecalculateWarning) {
      const p = paymentForRecalculateWarning;
      setPaymentForRecalculateWarning(null);
      setEditingPayment(p);
      setIsEditPaymentModalOpen(true);
    }
  };

  const handleOpenEditPaymentModal = (p: Payment) => {
    setEditingPayment(p);
    setIsEditPaymentModalOpen(true);
  };

  const handleSaveEditedPayment = (updatedPayment: Payment, shouldPrintReceipt?: boolean) => {
    if (onUpdatePayment) {
      onUpdatePayment(updatedPayment);
    } else {
      onRegisterPayment(
        updatedPayment.id,
        updatedPayment.amountPaid,
        updatedPayment.status,
        updatedPayment.paymentMethod,
        updatedPayment.notes
      );
    }

    if (shouldPrintReceipt && updatedPayment.amountPaid > 0) {
      const st = students.find((s) => s.id === updatedPayment.studentId);
      const crs = courses.find((c) => c.id === updatedPayment.courseId);
      const rData: ReceiptData = {
        receiptId: updatedPayment.id.startsWith('virt-')
          ? `REC-${Date.now().toString().slice(-6)}`
          : updatedPayment.id.toUpperCase(),
        studentName: st?.fullName || 'Ученик',
        studentPhone: st?.phone,
        courseTitle: crs?.title || 'Курс',
        amountPaid: updatedPayment.amountPaid,
        monthPeriod: formatMonthPeriodLabel(updatedPayment.monthPeriod),
        paymentMethod: updatedPayment.paymentMethod || 'CARD',
        dateStr: getUzbekistanLocaleString(),
        notes: updatedPayment.notes || undefined,
        adminName: updatedPayment.recordedBy || updatedPayment.updatedBy || 'Администратор',
      };
      setActiveReceipt(rData);
      setIsReceiptOpen(true);
    }

    setIsEditPaymentModalOpen(false);
    setEditingPayment(null);
  };

  const handleDeletePaymentClick = (p: Payment) => {
    if (confirm('Вы уверены, что хотите удалить эту запись оплаты/счета?')) {
      if (onDeletePayment) {
        onDeletePayment(p.id);
      }
    }
  };

  // Expense Handlers
  const handleOpenAddExpenseModal = () => {
    setEditingExpenseId(null);
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseCategory('RENT');
    setExpenseMonth(selectedPeriod);
    setExpenseMethod('CASH');
    setExpenseDate(getUzbekistanToday());
    setExpenseNotes('');
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditExpenseModal = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setExpenseTitle(exp.title);
    setExpenseAmount(exp.amount.toString());
    setExpenseCategory(exp.category);
    setExpenseMonth(exp.monthPeriod);
    setExpenseMethod(exp.paymentMethod);
    setExpenseDate(exp.expenseDate);
    setExpenseNotes(exp.notes || '');
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(expenseAmount, 10);
    if (!expenseTitle.trim()) {
      alert('Укажите наименование расхода!');
      return;
    }
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      alert('Укажите корректную сумму расхода!');
      return;
    }

    if (editingExpenseId) {
      const existing = expenses.find((e) => e.id === editingExpenseId);
      if (existing && onUpdateExpense) {
        onUpdateExpense({
          ...existing,
          title: expenseTitle.trim(),
          amount: amountNum,
          category: expenseCategory,
          monthPeriod: expenseMonth,
          paymentMethod: expenseMethod,
          expenseDate,
          notes: expenseNotes.trim() || undefined,
        });
      }
    } else {
      const newExp: Expense = {
        id: `exp-${Date.now()}`,
        title: expenseTitle.trim(),
        amount: amountNum,
        category: expenseCategory,
        monthPeriod: expenseMonth,
        paymentMethod: expenseMethod,
        expenseDate,
        notes: expenseNotes.trim() || undefined,
        createdAt: getUzbekistanISOString(),
      };
      if (onAddExpense) {
        onAddExpense(newExp);
      }
    }

    setIsExpenseModalOpen(false);
  };

  const handleDeleteExpenseClick = (exp: Expense) => {
    if (
      confirm(
        `Вы уверены, что хотите удалить расход "${exp.title}" на сумму ${exp.amount.toLocaleString('ru-RU')} сум? Сумма будет возвращена в общую кассу.`
      )
    ) {
      if (onDeleteExpense) {
        onDeleteExpense(exp.id);
      }
    }
  };

  // Salary Payout Handlers
  const handleOpenSalaryModal = (teacher: TeacherProfile) => {
    const teacherCoursesList = courses.filter((c) => c.teacherId === teacher.id);
    const payroll = calculateTeacherSalary(teacher, teacherCoursesList, periodPayments);
    
    // Sum of already paid salary expenses for this teacher in the selected period
    const alreadyPaid = expenses
      .filter((e) => e.category === 'TEACHER_SALARY' && e.teacherId === teacher.id && e.monthPeriod === selectedPeriod)
      .reduce((s, e) => s + e.amount, 0);

    const remainingToPay = Math.max(0, payroll.totalSalary - alreadyPaid);

    setSelectedTeacherForSalary(teacher);
    setSalaryPayAmount(remainingToPay > 0 ? remainingToPay.toString() : payroll.totalSalary.toString());
    setSalaryPayMethod('CASH');
    setSalaryPayMonth(selectedPeriod);
    setSalaryPayNotes(`Зарплата за ${formatMonthPeriodLabel(selectedPeriod)} (Преподаватель: ${teacher.fullName})`);
    setIsSalaryModalOpen(true);
  };

  const handleConfirmSalaryPayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherForSalary) return;

    const amountNum = parseInt(salaryPayAmount, 10);
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      alert('Укажите корректную сумму выплаты зарплаты!');
      return;
    }

    if (onPayTeacherSalary) {
      onPayTeacherSalary(
        selectedTeacherForSalary.id,
        salaryPayMonth,
        amountNum,
        salaryPayMethod,
        salaryPayNotes.trim()
      );
    }

    alert(
      `Выплата зарплаты для ${selectedTeacherForSalary.fullName} на сумму ${amountNum.toLocaleString(
        'ru-RU'
      )} сум успешно внесена! Сумма списана из общей кассы за ${formatMonthPeriodLabel(salaryPayMonth)}.`
    );
    setIsSalaryModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Historical Period Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
        <div>
          <h1 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <span>Финансы: Общая Касса, Расходы и Зарплаты (в сум)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Учет входящих оплат учеников, списание операционных расходов и автоматическая выплата зарплат с кассы
          </p>
        </div>

        {/* Historical Financial Archive Switcher & PDF Report Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center space-x-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-slate-600 font-medium">Финансовый месяц:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-white text-slate-800 font-mono font-bold text-xs rounded-lg px-2.5 py-1.5 border border-slate-200 focus:outline-none"
            >
              {allPeriods.map((period) => {
                let suffix = '';
                if (period === currentActualPeriod) suffix = ' (Текущий)';
                else if (period > currentActualPeriod) suffix = ' (Будущий)';
                else suffix = ' (Прошлый)';
                return (
                  <option key={period} value={period}>
                    {formatMonthPeriodLabel(period)}
                    {suffix}
                  </option>
                );
              })}
            </select>

            <div className="flex items-center space-x-1 pl-1">
              <button
                type="button"
                onClick={() => handleStepMonth(-1)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold text-xs cursor-pointer"
                title="Предыдущий месяц"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => handleStepMonth(1)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold text-xs cursor-pointer"
                title="Следующий месяц"
              >
                →
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/25 transition-all shrink-0 cursor-pointer"
            title="Распечатать кассовый отчет за выбранный день или ведомость за месяц на А4"
          >
            <Printer className="w-4 h-4" />
            <span>Печать отчета (День / Месяц)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMonthlyPdfModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition-all shrink-0 cursor-pointer"
            title="Сгенерировать и скачать итоговый отчет доходов и расходов (PDF) за выбранный месяц"
          >
            <Download className="w-4 h-4" />
            <span>Скачать свод (PDF)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMassSmsOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-600/25 transition-all shrink-0 cursor-pointer border border-blue-400/30"
            title="Массовая SMS-рассылка всем должникам через телефон или шлюз"
          >
            <Smartphone className="w-4 h-4 text-amber-300" />
            <span>📱 Рассылка должникам</span>
          </button>
        </div>
      </div>

      {/* Main KPI Summary Dashboard (4 Cards: Собрано, Расходы, Чистый остаток кассы, Задолженности) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Collected Revenue */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Фактически собрано</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-1.5">
              {collectedRevenue.toLocaleString('ru-RU')} сум
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center space-x-1">
              <Banknote className="w-3 h-3 text-emerald-600" />
              <span>Нал: {cashCollected.toLocaleString('ru-RU')}</span>
            </span>
            <span className="flex items-center space-x-1">
              <CreditCard className="w-3 h-3 text-blue-600" />
              <span>Карта: {cardCollected.toLocaleString('ru-RU')}</span>
            </span>
          </div>
        </div>

        {/* 2. Total Expenses */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Всего расходов</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-rose-600 mt-1.5">
              {totalExpenses.toLocaleString('ru-RU')} сум
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Зарплаты: {salaryExpenses.toLocaleString('ru-RU')}</span>
            <span>Прочие: {otherExpenses.toLocaleString('ru-RU')}</span>
          </div>
        </div>

        {/* 3. Net Balance (Остаток в кассе) */}
        <div
          className={`border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
            netBalance >= 0
              ? 'bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border-emerald-200'
              : 'bg-gradient-to-br from-rose-50/70 to-red-50/40 border-rose-200'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Остаток в кассе (Чистая прибыль)
              </span>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  netBalance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}
              >
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div
              className={`text-2xl font-black mt-1.5 ${
                netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {netBalance.toLocaleString('ru-RU')} сум
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600 font-medium">
            <span>Наличные: {netCashBalance.toLocaleString('ru-RU')} сум</span>
            <span>Карта: {netCardBalance.toLocaleString('ru-RU')} сум</span>
          </div>
        </div>

        {/* 4. Plan & Debts */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Задолженность учеников</span>
              <button
                type="button"
                onClick={() => setIsMassSmsOpen(true)}
                className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-[10px] flex items-center space-x-1 border border-amber-200 transition-all cursor-pointer"
                title="Открыть окно массовой рассылки должникам"
              >
                <Smartphone className="w-3 h-3 text-amber-600" />
                <span>Рассылка</span>
              </button>
            </div>
            <div className="text-2xl font-black text-amber-600 mt-1.5">
              {debtRevenue.toLocaleString('ru-RU')} сум
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>План: {expectedRevenue.toLocaleString('ru-RU')} сум</span>
            <span className="text-emerald-600 font-bold">
              {expectedRevenue > 0 ? Math.round((collectedRevenue / expectedRevenue) * 100) : 0}% собрано
            </span>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation (1. Оплаты, 2. Расходы, 3. Зарплаты) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'payments'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>1. Журнал Оплаты Учеников</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'expenses'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            <span>2. Расходы и Касса ({periodExpenses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payroll')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'payroll'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>3. Расчет и Выплата Зарплат Учителей</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'expenses' && (
            <button
              type="button"
              onClick={handleOpenAddExpenseModal}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Добавить расход</span>
            </button>
          )}

          {activeTab === 'payments' && onOpenQuickPaymentModal && (
            <button
              type="button"
              onClick={onOpenQuickPaymentModal}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-emerald-200" />
              <span>💳 + Принять новый платеж</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: PAYMENTS JOURNAL */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          {/* Filters Toolbar */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Left filters: Month, Course & Payment Status */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Subject Selector (Filters all courses of this subject) */}
                <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-500">Предмет:</span>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="bg-white text-slate-800 font-bold text-xs rounded-lg px-2.5 py-1 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="ALL">Все предметы ({courses.length} курсов)</option>
                    {availableSubjects.map((sub, idx) => {
                      const count = courses.filter((c) => (c.subject || '').trim().toLowerCase() === sub.toLowerCase()).length;
                      return (
                        <option key={`${sub}-${idx}`} value={sub}>
                          {sub} ({count} {count === 1 ? 'курс' : count < 5 ? 'курса' : 'курсов'})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Payment Method Filter Pills: Все способы, Наличные, Карта */}
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPaymentMethodFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      paymentMethodFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Все способы
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethodFilter('CASH');
                      if (paymentStatusFilter === 'UNPAID') {
                        setPaymentStatusFilter('ALL');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                      paymentMethodFilter === 'CASH'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-emerald-700'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Наличные</span>
                    {methodStats.cashCount > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold leading-none ${
                          paymentMethodFilter === 'CASH'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        {methodStats.cashCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethodFilter('CARD');
                      if (paymentStatusFilter === 'UNPAID') {
                        setPaymentStatusFilter('ALL');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                      paymentMethodFilter === 'CARD'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-blue-700'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Карта</span>
                    {methodStats.cardCount > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold leading-none ${
                          paymentMethodFilter === 'CARD'
                            ? 'bg-blue-700 text-white'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        {methodStats.cardCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPaymentStatusFilter('ALL')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      paymentStatusFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Все ({allDisplayPayments.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentStatusFilter('PAID');
                      if (paymentDateFilterMode === 'ALL_MONTH') {
                        setPaymentDateFilterMode('TODAY');
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                      paymentStatusFilter === 'PAID'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-emerald-700'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      Оплачено (
                      {
                        allDisplayPayments.filter(
                          (p) => p.status === 'PAID' || (p.amountPaid >= p.finalAmountDue && p.finalAmountDue > 0)
                        ).length
                      }
                      )
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentStatusFilter('UNPAID');
                      setPaymentMethodFilter('ALL');
                      setPaymentDateFilterMode('ALL_MONTH');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                      paymentStatusFilter === 'UNPAID'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-rose-700'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>
                      Задолженность (
                      {
                        allDisplayPayments.filter(
                          (p) =>
                            (p.amountPaid < p.finalAmountDue && p.amountPaid === 0) ||
                            (p.amountPaid === 0 && p.finalAmountDue === 0 && p.status === 'RECALCULATED')
                        ).length
                      }
                      )
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentStatusFilter('PARTIAL');
                      if (paymentDateFilterMode === 'ALL_MONTH') {
                        setPaymentDateFilterMode('TODAY');
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                      paymentStatusFilter === 'PARTIAL'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-amber-700'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>
                      Частично ({allDisplayPayments.filter((p) => p.amountPaid > 0 && p.amountPaid < p.finalAmountDue).length})
                    </span>
                  </button>
                </div>

                {selectedSubject !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedSubject('ALL')}
                    className="inline-flex items-center space-x-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
                    title="Сбросить фильтр предмета"
                  >
                    <span>Предмет: {selectedSubject}</span>
                    <span className="text-xs">✕</span>
                  </button>
                )}

                {(paymentStatusFilter === 'PAID' || paymentStatusFilter === 'PARTIAL' || paymentStatusFilter === 'ALL') && (
                  <span className="hidden xl:inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2.5 py-1 rounded-lg">
                    <ArrowDownWideNarrow className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Новые оплаты сверху</span>
                  </span>
                )}
              </div>

              {/* Right filters: Student Search & Print Group Financial Report */}
              <div className="flex items-center space-x-2">
                {/* Search Box */}
                <div className="relative flex-1 sm:w-52">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по ФИО / телефону..."
                    className="w-full bg-slate-50 text-slate-800 text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Print Group Report Button */}
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center space-x-1.5 shrink-0 cursor-pointer"
                  title="Печать финансового отчета за выбранную группу или все группы"
                >
                  <Printer className="w-4 h-4" />
                  <span>Печать отчета</span>
                </button>
              </div>
            </div>

            {/* Date Filter Toolbar: Сегодня, Вчера, Весь месяц (как ранее), Выбрать дату */}
            <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center space-x-1 text-xs font-bold text-slate-500 mr-1 shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Дата оплаты:</span>
                </div>

                {/* Кнопка "Сегодня" */}
                <button
                  type="button"
                  onClick={() => setPaymentDateFilterMode('TODAY')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    paymentDateFilterMode === 'TODAY'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title={`Показать платежи за сегодня (${formatDisplayDateRu(uzToday)})`}
                >
                  <span>Сегодня ({formatDisplayDateRu(uzToday).slice(0, 5)})</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none ${
                      paymentDateFilterMode === 'TODAY'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {dateFilterStats.todayCount}
                  </span>
                </button>

                {/* Кнопка "Вчера" */}
                <button
                  type="button"
                  onClick={() => setPaymentDateFilterMode('YESTERDAY')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    paymentDateFilterMode === 'YESTERDAY'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title={`Показать платежи за вчера (${formatDisplayDateRu(uzYesterday)})`}
                >
                  <span>Вчера ({formatDisplayDateRu(uzYesterday).slice(0, 5)})</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none ${
                      paymentDateFilterMode === 'YESTERDAY'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {dateFilterStats.yesterdayCount}
                  </span>
                </button>

                {/* Кнопка "Весь месяц" (как ранее) */}
                <button
                  type="button"
                  onClick={() => setPaymentDateFilterMode('ALL_MONTH')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    paymentDateFilterMode === 'ALL_MONTH'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title="Показать все платежи и начисления за выбранный расчетный месяц (как ранее)"
                >
                  <span>Весь месяц ({formatMonthPeriodLabel(selectedPeriod)})</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none ${
                      paymentDateFilterMode === 'ALL_MONTH'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {dateFilterStats.monthPaidCount}
                  </span>
                </button>

                {/* Выбор произвольной даты через календарь */}
                <div
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl border transition-all ${
                    paymentDateFilterMode === 'CUSTOM'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-[11px] font-bold">Выбрать дату:</span>
                  <input
                    type="date"
                    value={customPaymentDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        setCustomPaymentDate(val);
                        setPaymentDateFilterMode('CUSTOM');
                        const newMonth = val.slice(0, 7);
                        if (newMonth && newMonth !== selectedPeriod) {
                          setSelectedPeriod(newMonth);
                        }
                      }
                    }}
                    className="bg-transparent text-xs font-mono font-bold text-slate-800 focus:outline-none cursor-pointer"
                  />
                  {paymentDateFilterMode === 'CUSTOM' && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none bg-emerald-600 text-white">
                      {dateFilterStats.customCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Сводка поступлений за выбранную дату */}
              {paymentDateFilterMode !== 'ALL_MONTH' && activeFilterDate && (
                <div className="flex items-center space-x-2 text-xs bg-emerald-50 text-emerald-900 px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0">
                  <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Собрано за {paymentDateFilterMode === 'TODAY' ? 'сегодня' : paymentDateFilterMode === 'YESTERDAY' ? 'вчера' : formatDisplayDateRu(activeFilterDate)}:
                    <strong className="ml-1 font-mono font-extrabold text-emerald-800">
                      {(paymentDateFilterMode === 'TODAY'
                        ? dateFilterStats.todaySum
                        : paymentDateFilterMode === 'YESTERDAY'
                        ? dateFilterStats.yesterdaySum
                        : dateFilterStats.customSum
                      ).toLocaleString('ru-RU')} сум
                    </strong>
                    {paymentDateFilterMode === 'TODAY' && dateFilterStats.todayCount > 0 && (
                      <span className="text-emerald-700 font-medium ml-1.5 text-[11px]">
                        (Нал: {dateFilterStats.todayCash.toLocaleString('ru-RU')} • Карта: {dateFilterStats.todayCard.toLocaleString('ru-RU')})
                      </span>
                    )}
                  </span>
                </div>
              )}

              {paymentDateFilterMode === 'ALL_MONTH' && (
                <div className="text-[11px] text-slate-500 italic">
                  Показаны все платежи за полный расчетный месяц {formatMonthPeriodLabel(selectedPeriod)}
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Ученик & Телефон</th>
                    <th className="py-3.5 px-4">Курс</th>
                    <th className="py-3.5 px-4">Тип Начисления</th>
                    <th className="py-3.5 px-4">Начислено</th>
                    <th className="py-3.5 px-4">Оплачено</th>
                    <th className="py-3.5 px-4">Способ</th>
                    <th className="py-3.5 px-4">
                      <div className="flex items-center space-x-1">
                        <span>Статус</span>
                        {(paymentStatusFilter === 'PAID' || paymentStatusFilter === 'PARTIAL' || paymentStatusFilter === 'ALL') && (
                          <ArrowDownWideNarrow className="w-3 h-3 text-emerald-600 shrink-0" title="Сортировка: новые оплаты сверху" />
                        )}
                      </div>
                    </th>
                    <th className="py-3.5 px-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <div className="max-w-md mx-auto space-y-3 px-4">
                          <div className="w-12 h-12 bg-emerald-50 rounded-2xl mx-auto flex items-center justify-center text-emerald-600 border border-emerald-100">
                            <Calendar className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">
                              {paymentDateFilterMode !== 'ALL_MONTH' && activeFilterDate
                                ? `За ${paymentDateFilterMode === 'TODAY' ? 'сегодня' : paymentDateFilterMode === 'YESTERDAY' ? 'вчера' : `дату ${formatDisplayDateRu(activeFilterDate)}`} оплат не найдено`
                                : 'Записи оплаты по выбранным фильтрам отсутствуют'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {paymentDateFilterMode !== 'ALL_MONTH'
                                ? 'Вы можете посмотреть оплаты за вчера, выбрать другую дату или открыть весь расчетный месяц.'
                                : 'Попробуйте сбросить поисковый запрос или выбрать другой статус оплаты.'}
                            </p>
                          </div>
                          {paymentDateFilterMode !== 'ALL_MONTH' && (
                            <button
                              type="button"
                              onClick={() => setPaymentDateFilterMode('ALL_MONTH')}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center space-x-1.5"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Показать оплаты за весь месяц ({formatMonthPeriodLabel(selectedPeriod)})</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => {
                      const st = students.find((s) => s.id === p.studentId);
                      const crs = courses.find((c) => c.id === p.courseId);
                      const freezeInfo = st && crs ? calculateFreezeDeduction(st, crs, selectedPeriod) : null;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-800">{st?.fullName || 'Ученик'}</p>
                            <p className="text-[10px] text-slate-400 font-mono">Тел: {st?.phone || '—'}</p>
                            {freezeInfo && freezeInfo.isFrozenInPeriod && (
                              <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200 mt-1">
                                <Snowflake className="w-3 h-3 text-cyan-600 shrink-0" />
                                <span>Заморозка (-{freezeInfo.frozenLessonsCount} ур.)</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-medium text-slate-700">{crs?.title || '—'}</p>
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                              {crs?.subject && (
                                <span className="inline-flex items-center text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.2 rounded">
                                  {crs.subject}
                                </span>
                              )}
                              {crs?.daysOfWeek && crs.daysOfWeek.length > 0 && (
                                <span className="text-[10px] text-slate-400 font-mono">[{crs.daysOfWeek.join(', ')}]</span>
                              )}
                            </div>

                            {/* Transferred Payment Badge */}
                            {(p.notes?.includes('Оплата переведена из группы') || p.transferredFromCourseTitle) && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                                  <RefreshCw className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>
                                    {p.notes?.match(/Оплата переведена из группы [«"][^»"]+[»"]/)?.[0] ||
                                     (p.transferredFromCourseTitle
                                       ? `Оплата переведена из группы «${p.transferredFromCourseTitle}»`
                                       : 'Оплата переведена из другой группы')}
                                  </span>
                                </span>
                              </div>
                            )}

                            {p.notes && !p.notes.includes('Оплата переведена из группы') && (
                              <p className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-2" title={p.notes}>
                                {p.notes}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {p.isFirstMonth ? (
                              <span className="text-amber-600 font-semibold block">
                                1-й месяц ({p.remainingLessonsCount}/12 ур)
                              </span>
                            ) : (
                              <span className="text-slate-600 font-medium block">
                                {p.remainingLessonsCount !== undefined ? `${p.remainingLessonsCount}/12 ур` : 'Стандартный (12 ур)'}
                              </span>
                            )}
                            {p.excusedCreditDeduction > 0 && (
                              <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200 mt-0.5">
                                <span>Вычет: -{p.excusedCreditDeduction.toLocaleString('ru-RU')} сум</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-1.5">
                              <p className="font-mono font-bold text-slate-800">
                                {p.finalAmountDue.toLocaleString('ru-RU')} сум
                              </p>
                              <button
                                type="button"
                                onClick={() => handleOpenRecalculateWarning(p)}
                                className="p-1 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-100/80 border border-blue-200 transition-colors"
                                title="Изменить сумму начисления за текущий месяц (уважительные пропуски/перерасчет)"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                            {p.discountApplied > 0 && (
                              <p className="text-[10px] text-amber-700 font-mono">
                                Скидка: -{p.discountApplied.toLocaleString('ru-RU')} сум
                              </p>
                            )}
                            {p.excusedCreditDeduction > 0 && (
                              <p className="text-[10px] text-cyan-700 font-mono">
                                Вычет: -{p.excusedCreditDeduction.toLocaleString('ru-RU')} сум
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-emerald-600">
                              {p.amountPaid.toLocaleString('ru-RU')} сум
                            </div>
                            {p.paymentHistory && p.paymentHistory.length > 1 && (
                              <div className="mt-1.5 space-y-1 bg-slate-50 border border-slate-200/80 rounded-lg p-1.5 text-[10px]">
                                <span className="font-semibold text-slate-500 block">История взносов ({p.paymentHistory.length}):</span>
                                {p.paymentHistory.map((h, hIdx) => (
                                  <div key={h.id || hIdx} className="flex items-center justify-between gap-1 text-slate-700">
                                    <span className="text-slate-500">
                                      #{hIdx + 1} ({h.paidAt ? formatDisplayDateRu(h.paidAt) : 'Взнос'}):
                                    </span>
                                    <span className="font-bold text-emerald-700 font-mono">
                                      {h.amountPaid.toLocaleString('ru-RU')}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handlePrintExistingPaymentReceipt(h)}
                                      className="text-blue-600 hover:text-blue-800 hover:underline px-1 font-semibold cursor-pointer"
                                      title="Распечатать чек этого взноса"
                                    >
                                      Чек
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {p.paymentMethod === 'CASH' ? (
                              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <Banknote className="w-3 h-3" />
                                <span>Наличные</span>
                              </span>
                            ) : p.paymentMethod === 'CARD' ? (
                              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                <CreditCard className="w-3 h-3" />
                                <span>Карта</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {p.status === 'PAID' || (p.amountPaid >= p.finalAmountDue && p.finalAmountDue > 0) ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] uppercase">
                                Оплачено
                              </span>
                            ) : p.status === 'PARTIAL' || (p.amountPaid > 0 && p.amountPaid < p.finalAmountDue) ? (
                              <div>
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">
                                  Частично
                                </span>
                                <p className="text-[10px] text-rose-600 font-bold mt-1 font-mono">
                                  Остаток: {(p.finalAmountDue - p.amountPaid).toLocaleString('ru-RU')} сум
                                </p>
                              </div>
                            ) : p.status === 'RECALCULATED' ? (
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] uppercase">
                                Перерассчитано
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px] uppercase">
                                Задолженность
                              </span>
                            )}
                            {p.paidAt && (p.amountPaid > 0 || p.status === 'PAID' || p.status === 'PARTIAL') && (
                              <p className="text-[10px] text-emerald-800 font-bold mt-1 flex items-center space-x-1">
                                <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>{formatDisplayDateRu(p.paidAt)}</span>
                              </p>
                            )}
                            {p.amountPaid > 0 && p.recordedBy && (
                              <p className="text-[10px] text-slate-600 font-medium mt-0.5 flex items-center space-x-1">
                                <UserCheck className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>Принял: <strong className="text-slate-800 font-bold">{p.recordedBy}</strong></span>
                              </p>
                            )}
                            {p.amountPaid > 0 && !p.recordedBy && p.updatedBy && (
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                Изм: {p.updatedBy}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            {p.amountPaid > 0 && (
                              <button
                                type="button"
                                onClick={() => handlePrintExistingPaymentReceipt(p)}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all border border-slate-200 inline-flex items-center space-x-1 cursor-pointer"
                                title="Распечатать чек об оплате"
                              >
                                <Printer className="w-3.5 h-3.5 text-slate-600" />
                                <span>Чек</span>
                              </button>
                            )}
                            {p.status !== 'PAID' && (
                              <button
                                onClick={() => handleOpenPaymentModal(p)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                              >
                                {p.amountPaid > 0 ? 'Внести доплату' : 'Внести оплату'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEditPaymentModal(p)}
                              className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-all border border-blue-200 inline-flex items-center space-x-1 cursor-pointer"
                              title="Редактировать оплату / начисление (исправление ошибочных оплат или сумм)"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Редактировать</span>
                            </button>
                            <button
                              onClick={() => handleDeletePaymentClick(p)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors inline-flex items-center cursor-pointer"
                              title="Удалить платеж"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXPENSES AND CASH REGISTER MODULE */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Expenses Header & Summary */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                  <TrendingDown className="w-5 h-5 text-rose-600" />
                  <span>Учет расходов и списание из кассы ({formatMonthPeriodLabel(selectedPeriod)})</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Все добавленные расходы (аренда, коммунальные, зарплаты, реклама) автоматически взымаются из собранных денег общей кассы этого месяца.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenAddExpenseModal}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 transition-all shrink-0 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Добавить расход за {formatMonthPeriodLabel(selectedPeriod)}</span>
              </button>
            </div>

            {/* Category Filter Pills & Search */}
            <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Category selector */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setExpenseCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    expenseCategoryFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Все категории ({periodExpenses.length})
                </button>

                {Object.entries(EXPENSE_CATEGORY_CONFIG).map(([catKey, conf]) => {
                  const count = periodExpenses.filter((e) => e.category === catKey).length;
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setExpenseCategoryFilter(catKey)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        expenseCategoryFilter === catKey
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : `${conf.bg} ${conf.text} ${conf.border} hover:opacity-80`
                      }`}
                    >
                      {conf.label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Payment Method filter and Search */}
              <div className="flex items-center space-x-2 shrink-0">
                <select
                  value={expenseMethodFilter}
                  onChange={(e) => setExpenseMethodFilter(e.target.value)}
                  className="bg-slate-50 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1.5 border border-slate-200 focus:outline-none"
                >
                  <option value="ALL">Все кассы / способы</option>
                  <option value="CASH">💵 Наличные из кассы</option>
                  <option value="CARD">💳 Перевод / С карты</option>
                </select>

                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={expenseSearchQuery}
                    onChange={(e) => setExpenseSearchQuery(e.target.value)}
                    placeholder="Поиск расхода..."
                    className="w-full bg-slate-50 text-slate-800 text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Дата</th>
                    <th className="py-3.5 px-4">Наименование расхода & Примечание</th>
                    <th className="py-3.5 px-4">Категория</th>
                    <th className="py-3.5 px-4">Месяц</th>
                    <th className="py-3.5 px-4">Касса списания</th>
                    <th className="py-3.5 px-4 font-bold text-rose-700">Сумма расхода</th>
                    <th className="py-3.5 px-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                        Расходы за {formatMonthPeriodLabel(selectedPeriod)} не найдены. Нажмите «+ Добавить расход», чтобы внести траты или выплаты.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => {
                      const catConf = EXPENSE_CATEGORY_CONFIG[exp.category] || EXPENSE_CATEGORY_CONFIG.OTHER;
                      const teacher = teachers.find((t) => t.id === exp.teacherId);

                      return (
                        <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-slate-600">{exp.expenseDate}</td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-900">{exp.title}</p>
                            {teacher && (
                              <p className="text-[11px] text-blue-600 font-medium">
                                Преподаватель: {teacher.fullName}
                              </p>
                            )}
                            {exp.notes && (
                              <p className="text-[10px] text-slate-400 italic mt-0.5">{exp.notes}</p>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${catConf.bg} ${catConf.text} ${catConf.border}`}
                            >
                              {catConf.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                            {formatMonthPeriodLabel(exp.monthPeriod)}
                          </td>
                          <td className="py-3.5 px-4">
                            {exp.paymentMethod === 'CASH' ? (
                              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <Banknote className="w-3 h-3" />
                                <span>Наличные из кассы</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                <CreditCard className="w-3 h-3" />
                                <span>Банковская карта</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-rose-600 text-sm">
                            -{exp.amount.toLocaleString('ru-RU')} сум
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditExpenseModal(exp)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors inline-flex items-center"
                              title="Редактировать расход"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteExpenseClick(exp)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors inline-flex items-center"
                              title="Удалить расход и вернуть средства в кассу"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TEACHER PAYROLL AND SALARY PAYOUT MODULE */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <Award className="w-5 h-5 text-blue-600" />
                  <span>Расчет и Выплата Зарплат Учителям ({formatMonthPeriodLabel(selectedPeriod)})</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Здесь администратор может внести расход по зарплате учителя. Сумма сохраняется в базу данных Firestore и автоматически взымается из собранных денег общей кассы за этот месяц.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teachers.map((t) => {
                const teacherCoursesList = courses.filter((c) => c.teacherId === t.id);
                const payroll = calculateTeacherSalary(t, teacherCoursesList, periodPayments);

                // Check salary expenses for this teacher in this month
                const teacherSalaryExpenses = expenses.filter(
                  (e) => e.category === 'TEACHER_SALARY' && e.teacherId === t.id && e.monthPeriod === selectedPeriod
                );
                const alreadyPaid = teacherSalaryExpenses.reduce((s, e) => s + e.amount, 0);
                const remainingToPay = Math.max(0, payroll.totalSalary - alreadyPaid);

                const isFullyPaid = alreadyPaid >= payroll.totalSalary && payroll.totalSalary > 0;
                const isPartiallyPaid = alreadyPaid > 0 && alreadyPaid < payroll.totalSalary;

                return (
                  <div
                    key={t.id}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 text-sm">{t.fullName}</h3>
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[10px] font-bold border border-blue-200">
                          {t.salaryModel}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 italic">{payroll.summaryText}</p>

                      <div className="border-t border-slate-200 pt-2 space-y-1 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Собрано с его групп:</span>
                          <span className="font-mono text-emerald-600 font-bold">
                            {payroll.totalCollectedFromGroups.toLocaleString('ru-RU')} сум
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="font-bold text-slate-900">Рассчитанная зарплата:</span>
                          <span className="font-bold text-blue-600 text-base">
                            {payroll.totalSalary.toLocaleString('ru-RU')} сум
                          </span>
                        </div>
                      </div>

                      {/* Payment Status & History Badge */}
                      <div className="pt-2 border-t border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-500">Статус выплаты:</span>
                          {isFullyPaid ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Выплачено полностью</span>
                            </span>
                          ) : isPartiallyPaid ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              <span>Частично выплачено</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold text-[10px] uppercase">
                              <span>Не выплачено</span>
                            </span>
                          )}
                        </div>

                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-500">Фактически выплачено:</span>
                          <span className={alreadyPaid > 0 ? 'text-emerald-700' : 'text-slate-600'}>
                            {alreadyPaid.toLocaleString('ru-RU')} сум
                          </span>
                        </div>

                        {remainingToPay > 0 && alreadyPaid > 0 && (
                          <div className="flex justify-between text-xs font-bold text-rose-600">
                            <span>Остаток к доплате:</span>
                            <span>{remainingToPay.toLocaleString('ru-RU')} сум</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button: Pay Salary */}
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <button
                        type="button"
                        onClick={() => handleOpenSalaryModal(t)}
                        className={`w-full py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-xs cursor-pointer ${
                          isFullyPaid
                            ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                        }`}
                      >
                        <Banknote className="w-4 h-4" />
                        <span>
                          {isFullyPaid
                            ? 'Внести дополнительную выплату'
                            : isPartiallyPaid
                            ? `Доплатить остаток (${remainingToPay.toLocaleString('ru-RU')} сум)`
                            : 'Выплатить зарплату (Внести расход)'}
                        </span>
                      </button>

                      {/* Small list of payments if any */}
                      {teacherSalaryExpenses.length > 0 && (
                        <div className="bg-white p-2 rounded-lg border border-slate-200 space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">История выплат за {formatMonthPeriodLabel(selectedPeriod)}:</p>
                          {teacherSalaryExpenses.map((exp) => (
                            <div key={exp.id} className="flex items-center justify-between text-[11px] text-slate-600">
                              <span>{exp.expenseDate} ({exp.paymentMethod === 'CASH' ? 'Нал' : 'Карта'}):</span>
                              <span className="font-bold text-emerald-700">
                                {exp.amount.toLocaleString('ru-RU')} сум
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <TrendingDown className="w-5 h-5 text-rose-600" />
                <span>{editingExpenseId ? 'Редактировать расход' : 'Внести новый расход'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpenseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Наименование расхода *
                </label>
                <input
                  type="text"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  placeholder="Например: Аренда помещения, Канцелярия для кабинетов..."
                  className="w-full bg-slate-50 text-slate-900 text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Сумма расхода (сум) *
                  </label>
                  <input
                    type="number"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="Например: 500000"
                    className="w-full bg-slate-50 text-slate-900 text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500 font-mono font-bold"
                    required
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    За какой месяц списать *
                  </label>
                  <select
                    value={expenseMonth}
                    onChange={(e) => setExpenseMonth(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500 font-bold"
                  >
                    {allPeriods.map((p) => (
                      <option key={p} value={p}>
                        {formatMonthPeriodLabel(p)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Категория расхода *
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
                    className="w-full bg-slate-50 text-slate-900 text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                  >
                    {Object.entries(EXPENSE_CATEGORY_CONFIG).map(([key, conf]) => (
                      <option key={key} value={key}>
                        {conf.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Касса / Способ списания *
                  </label>
                  <select
                    value={expenseMethod}
                    onChange={(e) => setExpenseMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-slate-50 text-slate-900 text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500 font-bold"
                  >
                    <option value="CASH">💵 Наличные из кассы</option>
                    <option value="CARD">💳 С банковской карты / Перевод</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Дата совершения расхода
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Примечания / Комментарий
                </label>
                <textarea
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder="Дополнительные детали расхода (номер квитанции, кому передано и т.д.)..."
                  rows={2}
                  className="w-full bg-slate-50 text-slate-900 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>
                  Эта сумма будет автоматически взыскана из общей кассы за <b>{formatMonthPeriodLabel(expenseMonth)}</b> и сохранена в базу данных.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-all shadow-md shadow-rose-600/20 cursor-pointer"
                >
                  {editingExpenseId ? 'Сохранить изменения' : 'Внести расход в кассу'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PAY TEACHER SALARY MODAL */}
      {isSalaryModalOpen && selectedTeacherForSalary && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Award className="w-5 h-5 text-blue-600" />
                <span>Выплата зарплаты преподавателю</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSalaryModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSalaryPayout} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl space-y-1">
                <p className="font-bold text-blue-900 text-sm">{selectedTeacherForSalary.fullName}</p>
                <p className="text-xs text-blue-700">Модель: {selectedTeacherForSalary.salaryModel}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  За какой финансовый месяц:
                </label>
                <select
                  value={salaryPayMonth}
                  onChange={(e) => setSalaryPayMonth(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none font-bold"
                >
                  {allPeriods.map((p) => (
                    <option key={p} value={p}>
                      {formatMonthPeriodLabel(p)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Сумма выплаты зарплаты (сум) *
                </label>
                <input
                  type="number"
                  value={salaryPayAmount}
                  onChange={(e) => setSalaryPayAmount(e.target.value)}
                  className="w-full bg-white text-slate-900 text-base font-black px-3 py-2.5 rounded-xl border-2 border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Касса списания / Способ выплаты *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSalaryPayMethod('CASH')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                      salaryPayMethod === 'CASH'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Наличные</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSalaryPayMethod('CARD')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                      salaryPayMethod === 'CARD'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Перевод на карту</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Примечание / Назначение платежа
                </label>
                <input
                  type="text"
                  value={salaryPayNotes}
                  onChange={(e) => setSalaryPayNotes(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-600">
                Сумма будет сохранена в базу данных Firestore и <b>автоматически вычтена из общей кассы</b> за {formatMonthPeriodLabel(salaryPayMonth)}.
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSalaryModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  Подтвердить выплату
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REGISTER STUDENT PAYMENT MODAL */}
      {paymentToRegister && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span>Прием оплаты от ученика</span>
              </h3>
              <button
                onClick={() => setPaymentToRegister(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
              {(paymentToRegister.notes?.includes('Оплата переведена из группы') || paymentToRegister.transferredFromCourseTitle) && (
                <div className="mb-2 bg-amber-100/80 border border-amber-300 rounded-lg p-2 text-xs text-amber-900 flex items-center gap-1.5 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>
                    {paymentToRegister.notes?.match(/Оплата переведена из группы [«"][^»"]+[»"]/)?.[0] ||
                     (paymentToRegister.transferredFromCourseTitle
                       ? `Оплата переведена из группы «${paymentToRegister.transferredFromCourseTitle}»`
                       : 'Оплата переведена из другой группы')}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Ученик:</span>
                <span className="font-bold text-slate-900">
                  {students.find((s) => s.id === paymentToRegister.studentId)?.fullName}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Курс:</span>
                <span className="font-bold text-slate-700">
                  {courses.find((c) => c.id === paymentToRegister.courseId)?.title}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Период:</span>
                <span className="font-mono font-bold text-slate-700">
                  {formatMonthPeriodLabel(paymentToRegister.monthPeriod)}
                </span>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-slate-200">
                <span className="text-slate-600 font-bold">Начислено к оплате:</span>
                <span className="font-mono font-bold text-slate-900">
                  {paymentToRegister.finalAmountDue.toLocaleString('ru-RU')} сум
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Ранее внесено:</span>
                <span className="font-mono text-emerald-600 font-bold">
                  {paymentToRegister.amountPaid.toLocaleString('ru-RU')} сум
                </span>
              </div>
              <div className="flex justify-between text-xs font-bold text-rose-600">
                <span>Остаток задолженности:</span>
                <span className="font-mono">
                  {Math.max(0, paymentToRegister.finalAmountDue - paymentToRegister.amountPaid).toLocaleString('ru-RU')} сум
                </span>
              </div>

              {paymentToRegister.paymentHistory && paymentToRegister.paymentHistory.length > 0 && (
                <div className="pt-2 border-t border-slate-200 mt-2 space-y-1">
                  <span className="text-[11px] font-bold text-slate-700 block">История предыдущих взносов:</span>
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {paymentToRegister.paymentHistory.map((h, i) => (
                      <div key={h.id || i} className="flex justify-between items-center text-[11px] bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-slate-600">
                          #{i + 1} {h.paidAt ? formatDisplayDateRu(h.paidAt) : 'Взнос'}:
                        </span>
                        <span className="font-mono font-bold text-emerald-700">
                          {h.amountPaid.toLocaleString('ru-RU')} сум ({h.paymentMethod === 'CASH' ? 'Наличные' : 'Карта'})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Вносимая сумма (сум) *
                  </label>
                  {paymentToRegister.amountPaid > 0 && paymentToRegister.finalAmountDue > paymentToRegister.amountPaid && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmountInput(String(Math.max(0, paymentToRegister.finalAmountDue - paymentToRegister.amountPaid)))}
                      className="text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      Внести весь остаток: {(paymentToRegister.finalAmountDue - paymentToRegister.amountPaid).toLocaleString('ru-RU')} сум
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  placeholder="Введите сумму (например 400000)..."
                  className="w-full bg-white text-slate-900 text-sm font-bold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Способ оплаты *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethodInput('CASH')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                      paymentMethodInput === 'CASH'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Наличные</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethodInput('CARD')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                      paymentMethodInput === 'CARD'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Перевод / Карта</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Примечание к платежу (опционально)
                </label>
                <input
                  type="text"
                  value={paymentNotesInput}
                  onChange={(e) => setPaymentNotesInput(e.target.value)}
                  placeholder="Например: Оплата через Payme, или оплата наличными администратору..."
                  className="w-full bg-slate-50 text-slate-800 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Кто принимает оплату (Администратор) *</span>
                </label>
                <select
                  value={paymentAdminInput}
                  onChange={(e) => setPaymentAdminInput(e.target.value)}
                  className="w-full bg-white text-slate-900 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {paymentAdminInput && (
                    <option value={paymentAdminInput}>
                      {paymentAdminInput}
                    </option>
                  )}
                  {currentUser?.fullName && currentUser.fullName !== paymentAdminInput && (
                    <option value={currentUser.fullName}>
                      {currentUser.fullName} (Текущий пользователь)
                    </option>
                  )}
                  {staffMembers
                    ?.filter((s) => s.role === 'ADMIN' || s.role === 'DIRECTOR')
                    .filter((s) => s.fullName !== paymentAdminInput)
                    .map((s) => (
                      <option key={s.id} value={s.fullName}>
                        {s.fullName} ({s.role === 'DIRECTOR' ? 'Директор' : 'Администратор'})
                      </option>
                    ))}
                  {paymentAdminInput !== 'Главный Администратор' && (
                    <option value="Главный Администратор">Главный Администратор</option>
                  )}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPaymentToRegister(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md shadow-emerald-600/20"
              >
                Подтвердить и выдать чек
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false);
          setActiveReceipt(null);
        }}
        receipt={activeReceipt}
      />

      {/* GROUP & DAILY FINANCE REPORT PRINT MODAL */}
      <GroupFinanceReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        selectedCourseId="ALL"
        selectedPeriod={selectedPeriod}
        courses={courses}
        students={students}
        teachers={teachers}
        payments={payments}
      />

      {/* MONTHLY SUMMARY FINANCE PDF REPORT MODAL */}
      <MonthlyFinancePdfModal
        isOpen={isMonthlyPdfModalOpen}
        onClose={() => setIsMonthlyPdfModalOpen(false)}
        selectedPeriod={selectedPeriod}
        payments={payments}
        expenses={expenses}
        students={students}
        courses={courses}
        teachers={teachers}
      />

      {/* WARNING MODAL: CONFIRM CHARGE RECALCULATION FOR THIS MONTH */}
      {paymentForRecalculateWarning && (() => {
        const targetStudent = students.find((s) => s.id === paymentForRecalculateWarning.studentId);
        const targetCourse = courses.find((c) => c.id === paymentForRecalculateWarning.courseId);
        const coursePrice = targetCourse?.monthlyPrice || paymentForRecalculateWarning.baseCalculatedAmount || 360000;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative my-8">
              {/* Close button */}
              <button
                type="button"
                onClick={() => setPaymentForRecalculateWarning(null)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Warning Icon & Heading */}
              <div className="flex items-start space-x-3.5 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-snug">
                    Предупреждение: Изменение суммы начисления
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Подтверждение перерасчета за текущий месяц
                  </p>
                </div>
              </div>

              {/* Context Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2 mb-4 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Ученик:</span>
                  <span className="font-bold text-slate-900">{targetStudent?.fullName || 'Ученик'}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Курс / Группа:</span>
                  <span className="font-bold text-slate-900">{targetCourse?.title || 'Курс'}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Период начисления:</span>
                  <span className="font-bold text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                    {formatMonthPeriodLabel(paymentForRecalculateWarning.monthPeriod)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Текущее начисление:</span>
                  <span className="font-black text-slate-900 font-mono">
                    {paymentForRecalculateWarning.finalAmountDue.toLocaleString('ru-RU')} сум
                  </span>
                </div>
              </div>

              {/* Informative Warning Text */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 mb-5 space-y-2 text-xs text-amber-950">
                <div className="flex items-start space-x-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="font-bold text-amber-900">
                    Вы хотите изменить сумму начисления за этот курс за текущий месяц ({formatMonthPeriodLabel(paymentForRecalculateWarning.monthPeriod)})?
                  </p>
                </div>
                <div className="pl-6 space-y-1 text-[11px] text-amber-900/90 leading-relaxed">
                  <p>
                    • <strong>Изоляция начисления:</strong> Измененная сумма (вычет за пропущенные по уважительной причине дни, скидка или перерасчет) применится <strong>исключительно к текущему выбранному месяцу</strong>.
                  </p>
                  <p>
                    • <strong>Последующие месяцы:</strong> Во все последующие месяцы начисление будет производиться <strong>в полном объеме</strong> по стандартному тарифу курса ({coursePrice.toLocaleString('ru-RU')} сум).
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentForRecalculateWarning(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRecalculateWarning}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all flex items-center justify-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Подтвердить и изменить сумму</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EDIT PAYMENT MODAL */}
      <EditPaymentModal
        isOpen={isEditPaymentModalOpen}
        onClose={() => {
          setIsEditPaymentModalOpen(false);
          setEditingPayment(null);
        }}
        payment={editingPayment}
        student={students.find((s) => s.id === editingPayment?.studentId)}
        course={courses.find((c) => c.id === editingPayment?.courseId)}
        onSavePayment={handleSaveEditedPayment}
        currentUser={currentUser}
        staffMembers={staffMembers}
      />

      {/* MASS DEBT SMS DISPATCH MODAL */}
      <MassDebtSmsModal
        isOpen={isMassSmsOpen}
        onClose={() => setIsMassSmsOpen(false)}
        students={students}
        courses={courses}
        payments={payments}
        selectedPeriod={selectedPeriod}
        onSendSms={(sms) => {
          if (onSendSms) {
            onSendSms(sms);
          }
        }}
        gatewayConfig={gatewayConfig}
        onUpdateGatewayConfig={onUpdateGatewayConfig}
      />
    </div>
  );
};
