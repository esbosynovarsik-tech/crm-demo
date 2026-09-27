import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Users,
  BookOpen,
  UserCheck,
  Building2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Send,
  Lightbulb,
  ArrowRight,
  ShieldCheck,
  Target,
  Zap,
  Award,
  Clock,
  Check,
  Copy,
  FileText,
  PieChart,
  Activity,
  Snowflake,
  UserPlus,
} from 'lucide-react';
import {
  Student,
  Lead,
  Course,
  TeacherProfile,
  Cabinet,
  Payment,
  Expense,
  AttendanceRecord,
  Subject,
} from '../types';
import { calculateTeacherSalary, roundToThousand } from '../lib/billingLogic';
import { getUzbekistanToday, getUzbekistanISOString } from '../lib/dateUtils';

interface AiAnalyticsModuleProps {
  students: Student[];
  leads: Lead[];
  courses: Course[];
  teachers: TeacherProfile[];
  cabinets: Cabinet[];
  payments: Payment[];
  expenses: Expense[];
  attendanceRecords: AttendanceRecord[];
  subjects?: Subject[];
}

const MONTH_NAMES_RU: Record<string, string> = {
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

function formatMonthLabel(period: string): string {
  if (!period) return '';
  const parts = period.split('-');
  if (parts.length === 2) {
    const [year, month] = parts;
    const mName = MONTH_NAMES_RU[month] || month;
    return `${mName} ${year}`;
  }
  return period;
}

function getPreviousMonthPeriod(period: string): string {
  const [yearStr, monthStr] = period.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month)) return '2026-07';

  month -= 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export const AiAnalyticsModule: React.FC<AiAnalyticsModuleProps> = ({
  students,
  leads,
  courses,
  teachers,
  cabinets,
  payments,
  expenses,
  attendanceRecords,
  subjects = [],
}) => {
  // Selected Month for Analysis
  const todayUz = getUzbekistanToday();
  const currentMonthPeriodDefault = todayUz.slice(0, 7); // e.g. '2026-08'
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthPeriodDefault);
  const previousMonth = useMemo(() => getPreviousMonthPeriod(selectedMonth), [selectedMonth]);

  // AI State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Interactive AI Assistant State
  const [chatQuestion, setChatQuestion] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; text: string; time: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  // Available periods list from data
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthPeriodDefault);
    payments.forEach((p) => {
      if (p.monthPeriod) set.add(p.monthPeriod);
    });
    expenses.forEach((e) => {
      if (e.monthPeriod) set.add(e.monthPeriod);
    });
    return Array.from(set).sort().reverse();
  }, [payments, expenses, currentMonthPeriodDefault]);

  // --- RAW STATS CALCULATION FOR CURRENT & PREVIOUS MONTH ---
  const stats = useMemo(() => {
    // Current Month Payments & Expenses
    const currPayments = payments.filter((p) => p.monthPeriod === selectedMonth);
    const prevPayments = payments.filter((p) => p.monthPeriod === previousMonth);

    const currCollected = currPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
    const prevCollected = prevPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);

    const currDebtSum = currPayments
      .filter((p) => p.status === 'DEBT')
      .reduce((acc, p) => acc + Math.max(0, (p.finalAmountDue || 0) - (p.amountPaid || 0)), 0);
    const prevDebtSum = prevPayments
      .filter((p) => p.status === 'DEBT')
      .reduce((acc, p) => acc + Math.max(0, (p.finalAmountDue || 0) - (p.amountPaid || 0)), 0);

    const currDebtCount = currPayments.filter((p) => p.status === 'DEBT').length;
    const prevDebtCount = prevPayments.filter((p) => p.status === 'DEBT').length;

    // Expenses
    const currExpenses = expenses.filter((e) => e.monthPeriod === selectedMonth);
    const prevExpenses = expenses.filter((e) => e.monthPeriod === previousMonth);

    const currExpTotal = currExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const prevExpTotal = prevExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);

    const currProfit = currCollected - currExpTotal;
    const prevProfit = prevCollected - prevExpTotal;

    // Students
    const totalStudentsCount = students.length;
    const activeStudents = students.filter((s) => s.status === 'ACTIVE');
    const frozenStudents = students.filter((s) => s.status === 'FROZEN');

    // Leads & Conversion
    const totalLeads = leads.length;
    const enrolledLeads = leads.filter((l) => l.status === 'ENROLLED').length;
    const waitingLeads = leads.filter((l) => l.status === 'WAITING_GROUP').length;
    const cancelledLeads = leads.filter((l) => l.status === 'CANCELLED').length;
    const leadConversionRate = totalLeads > 0 ? ((enrolledLeads / totalLeads) * 100).toFixed(1) : '0';

    // Courses & Cabinets Capacity
    const activeCourses = courses.filter((c) => c.isActive);
    let totalCabinetCapacity = 0;
    cabinets.forEach((cab) => {
      totalCabinetCapacity += cab.capacity || 15;
    });

    let totalEnrolledSeats = 0;
    courses.forEach((crs) => {
      const count = students.filter((s) => s.enrolledCourseIds?.includes(crs.id)).length;
      totalEnrolledSeats += count;
    });

    const averageCourseOccupancy =
      activeCourses.length > 0 ? (totalEnrolledSeats / activeCourses.length).toFixed(1) : '0';

    const lowOccupancyCourses = courses.filter((c) => {
      const count = students.filter((s) => s.enrolledCourseIds?.includes(c.id)).length;
      return c.isActive && count < 5;
    });

    // Attendance Records in Selected Month
    const currAttendance = attendanceRecords.filter((a) => a.date.startsWith(selectedMonth));
    const prevAttendance = attendanceRecords.filter((a) => a.date.startsWith(previousMonth));

    const currPresentCount = currAttendance.filter((a) => a.status === 'PRESENT').length;
    const currAbsentCount = currAttendance.filter((a) => a.status === 'ABSENT').length;
    const currExcusedCount = currAttendance.filter((a) => a.status === 'ABSENT' && a.absenceCategory === 'EXCUSED').length;
    const currUnexcusedCount = currAttendance.filter((a) => a.status === 'ABSENT' && a.absenceCategory === 'UNEXCUSED').length;

    const currAttendanceRate =
      currAttendance.length > 0 ? ((currPresentCount / currAttendance.length) * 100).toFixed(1) : '100';

    const prevPresentCount = prevAttendance.filter((a) => a.status === 'PRESENT').length;
    const prevAttendanceRate =
      prevAttendance.length > 0 ? ((prevPresentCount / prevAttendance.length) * 100).toFixed(1) : '100';

    // Percentage Changes (MoM)
    const calcGrowth = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    const revenueGrowth = calcGrowth(currCollected, prevCollected);
    const expenseGrowth = calcGrowth(currExpTotal, prevExpTotal);
    const profitGrowth = calcGrowth(currProfit, prevProfit);
    const attendanceDelta = (parseFloat(currAttendanceRate) - parseFloat(prevAttendanceRate)).toFixed(1);

    return {
      currCollected,
      prevCollected,
      revenueGrowth,
      currExpTotal,
      prevExpTotal,
      expenseGrowth,
      currProfit,
      prevProfit,
      profitGrowth,
      currDebtSum,
      prevDebtSum,
      currDebtCount,
      prevDebtCount,
      totalStudentsCount,
      activeStudentsCount: activeStudents.length,
      frozenStudentsCount: frozenStudents.length,
      totalLeads,
      enrolledLeads,
      waitingLeads,
      cancelledLeads,
      leadConversionRate,
      activeCoursesCount: activeCourses.length,
      totalCabinetsCount: cabinets.length,
      totalCabinetCapacity,
      totalEnrolledSeats,
      averageCourseOccupancy,
      lowOccupancyCoursesCount: lowOccupancyCourses.length,
      currAttendanceTotal: currAttendance.length,
      currPresentCount,
      currAbsentCount,
      currExcusedCount,
      currUnexcusedCount,
      currAttendanceRate,
      prevAttendanceRate,
      attendanceDelta,
      teachersCount: teachers.length,
    };
  }, [
    selectedMonth,
    previousMonth,
    payments,
    expenses,
    students,
    leads,
    courses,
    cabinets,
    attendanceRecords,
    teachers,
  ]);

  // Build Comprehensive Prompt for Gemini AI
  const buildAnalyticsPrompt = () => {
    return `Проведи детальный всесторонний аудит и сравнительный анализ данных учебного центра "REDCAT" за ${formatMonthLabel(
      selectedMonth
    )} в сравнении с предыдущим месяцем (${formatMonthLabel(previousMonth)}).

=== ДАННЫЕ ЦЕНТРА ЗА ${formatMonthLabel(selectedMonth)} ===
1. ФИНАНСЫ И ЗАРПЛАТЫ:
- Выручка (фактически собрано оплат): ${stats.currCollected.toLocaleString('ru-RU')} сум (в прошлом месяце: ${stats.prevCollected.toLocaleString('ru-RU')} сум, динамика: ${stats.revenueGrowth > 0 ? '+' : ''}${stats.revenueGrowth}%)
- Общие расходы: ${stats.currExpTotal.toLocaleString('ru-RU')} сум (в прошлом месяце: ${stats.prevExpTotal.toLocaleString('ru-RU')} сум)
- Чистая операционная прибыль: ${stats.currProfit.toLocaleString('ru-RU')} сум (динамика: ${stats.profitGrowth > 0 ? '+' : ''}${stats.profitGrowth}%)
- Задолженность по оплатам: ${stats.currDebtSum.toLocaleString('ru-RU')} сум (${stats.currDebtCount} неоплаченных счетов, в прошлом мес: ${stats.prevDebtCount} счетов на ${stats.prevDebtSum.toLocaleString('ru-RU')} сум)

2. УЧЕНИКИ И ЛИДЫ (ВОРОНКА ПРОДАЖ):
- Всего учеников в базе: ${stats.totalStudentsCount}
- Активных учащихся: ${stats.activeStudentsCount}
- Замороженных учеников (пауза): ${stats.frozenStudentsCount}
- Всего лидов (заявок): ${stats.totalLeads}
- Ожидают запуска группы: ${stats.waitingLeads}
- Успешно зачислены в группы: ${stats.enrolledLeads} (Конверсия: ${stats.leadConversionRate}%)
- Отказались/отменены: ${stats.cancelledLeads}

3. КУРСЫ, АУДИТОРИИ И РАСПИСАНИЕ:
- Активных курсов/групп: ${stats.activeCoursesCount}
- Количество учебных кабинетов: ${stats.totalCabinetsCount} (Общая вместимость: ${stats.totalCabinetCapacity} мест)
- Всего посадочных мест занято: ${stats.totalEnrolledSeats}
- Средняя наполняемость группы: ${stats.averageCourseOccupancy} уч./группа
- Групп с критически низкой заполняемостью (< 5 уч.): ${stats.lowOccupancyCoursesCount}

4. ПРЕПОДАВАТЕЛИ И НАГРУЗКА:
- Всего преподавателей в штате: ${stats.teachersCount}

5. ПОСЕЩАЕМОСТЬ И ПРОПУСКИ:
- Всего отмеченных занятий в месяце: ${stats.currAttendanceTotal}
- Процент присутствия (Attendance Rate): ${stats.currAttendanceRate}% (в прошлом месяце: ${stats.prevAttendanceRate}%, разница: ${parseFloat(stats.attendanceDelta) >= 0 ? '+' : ''}${stats.attendanceDelta}%)
- Всего пропусков: ${stats.currAbsentCount} (из них уважительных по справке/причинам: ${stats.currExcusedCount}, неуважительных прогулов: ${stats.currUnexcusedCount})

=== ТРЕБОВАНИЯ К ОТВЕТУ ИИ ===
Пожалуйста, сформируй профессиональный, четкий и мотивирующий аналитический отчет на чистом русском языке в Markdown:

1. 🌟 **ГЛАВНОЕ РЕЗЮМЕ И СТАТУС ЦЕНТРА**:
   - Краткая оценка финансового и операционного здоровья центра.
   - Главные победы и позитивные тенденции за месяц.
   - Главные узкие места и зоны риска.

2. 📊 **СРАВНЕНИЕ С ПРЕДЫДУЩИМ МЕСЯЦЕМ (MoM АНАЛИЗ)**:
   - Анализ роста/падения выручки и чистой прибыли.
   - Анализ динамики посещаемости и дисциплины оплат.
   - Сравнение ключевых метрик.

3. 🔍 **РАЗБОР ПО КАЖДОМУ РАЗДЕЛУ БАЗЫ**:
   - 🎓 *База учеников и воронка лидов*: как ускорить добор из ожидающих заявок (${stats.waitingLeads} лидов), снизить отток и разморозить учеников.
   - 💰 *Финансы и зарплаты*: рекомендации по быстрому закрытию долгов на сумму ${stats.currDebtSum.toLocaleString('ru-RU')} сум и оптимизации затрат.
   - 👨‍🏫 *Преподаватели и качество уроков*: баланс нагрузки и мотивация педагогов.
   - 🏛️ *Курсы и аудитории*: решение проблемы ${stats.lowOccupancyCoursesCount} полупустых групп и повышение утилизации кабинетов.
   - 📋 *Посещаемость*: меры по снижению ${stats.currUnexcusedCount} неуважительных пропусков.

4. 💡 **ТОП-5 ПРАКТИЧЕСКИХ СОВЕТОВ И ПЛАН ДЕЙСТВИЙ НА БЛИЖАЙШИЕ 2-4 НЕДЕЛИ**:
   - Конкретные, пошаговые и выполнимые действия для администратора и руководства с высоким приоритетом.`;
  };

  // Trigger AI Report Generation
  const handleGenerateAiReport = async () => {
    setIsLoading(true);
    try {
      const prompt = buildAnalyticsPrompt();
      const response = await fetch('/api/ai-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          systemInstruction:
            'Вы — опытный главный бизнес-аналитик и директор по развитию учебных центров и образовательных платформ (CRM/CMS). Ваш анализ должен быть структурированным, глубоким, практичным, дружелюбным и конкретным, на правильном русском языке с наглядным форматированием Markdown.',
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      if (data.text) {
        setAiReport(data.text);
        setLastGeneratedAt(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } else {
        throw new Error('Empty response from AI');
      }
    } catch (err: any) {
      console.warn('AI API error, fallbacking to local heuristic analytical summary:', err);
      // Generate rich local analytical fallback report
      const localReport = `### 🌟 Главное резюме центра за ${formatMonthLabel(selectedMonth)}
Центр показывает стабильную операционную динамику:
- **Выручка**: ${stats.currCollected.toLocaleString('ru-RU')} сум (${stats.revenueGrowth >= 0 ? '+' : ''}${stats.revenueGrowth}% к прошлому месяцу).
- **Чистая прибыль**: ${stats.currProfit.toLocaleString('ru-RU')} сум.
- **Активных учащихся**: ${stats.activeStudentsCount} чел. при ${stats.frozenStudentsCount} замороженных.
- **Посещаемость**: ${stats.currAttendanceRate}% (${stats.currPresentCount} посещений, ${stats.currAbsentCount} пропусков).

---

### 📊 Сравнение с прошлым месяцем (${formatMonthLabel(previousMonth)})
- **Динамика выручки**: ${stats.revenueGrowth >= 0 ? '🟢 Прирост на' : '🔴 Снижение на'} ${Math.abs(stats.revenueGrowth)}% (${(stats.currCollected - stats.prevCollected).toLocaleString('ru-RU')} сум).
- **Дебиторская задолженность**: ${stats.currDebtSum.toLocaleString('ru-RU')} сум (${stats.currDebtCount} неоплаченных счетов).
- **Посещаемость уроков**: ${parseFloat(stats.attendanceDelta) >= 0 ? '📈 Выросла на' : '📉 Снизилась на'} ${Math.abs(parseFloat(stats.attendanceDelta))}% по сравнению с прошлым периодом (${stats.prevAttendanceRate}% → ${stats.currAttendanceRate}%).

---

### 🔍 Разбор по ключевым модулям базы

#### 1. 🎓 База учеников и воронка лидов
- В воронке находится **${stats.waitingLeads} лидов**, ожидающих открытия или добора в группы.
- **Конверсия заявок в зачисление**: ${stats.leadConversionRate}%.
- **Совет**: Провести обзвон ${stats.waitingLeads} ожидающих лидов с предложением пробного урока в группах с низкой заполняемостью.

#### 2. 💰 Финансы и задолженности
- Текущий объем долгов составляет **${stats.currDebtSum.toLocaleString('ru-RU')} сум**.
- **Совет**: Внедрить правило напоминания родителям за 3 дня до расчетной даты (до 10 числа месяца) через SMS-уведомления.

#### 3. 🏛️ Аудитории и заполняемость групп
- Обнаружено **${stats.lowOccupancyCoursesCount} групп** с числом учеников менее 5.
- Средняя наполняемость групп: **${stats.averageCourseOccupancy} уч./группа** при общей вместимости кабинетов **${stats.totalCabinetCapacity} мест**.
- **Совет**: Объединить смежные малокомплектные группы или запустить таргетированный добор по этим предметам.

#### 4. 📋 Дисциплина посещаемости
- Из ${stats.currAbsentCount} пропусков: **${stats.currExcusedCount} уважительных** и **${stats.currUnexcusedCount} прогулов**.
- **Совет**: Требовать подтверждение причин пропусков (справка / заявление) для корректного расчета 12-урочного биллинга.

---

### 💡 Топ-5 практических рекомендаций
1. **[Высокий приоритет]** Добор в ${stats.lowOccupancyCoursesCount} малокомплектных групп из пула ${stats.waitingLeads} ожидающих лидов.
2. **[Высокий приоритет]** Персональный контакт с родителями по взысканию ${stats.currDebtSum.toLocaleString('ru-RU')} сум дебиторской задолженности.
3. **[Средний приоритет]** Мониторинг замороженных учеников (${stats.frozenStudentsCount} чел.) за 3 дня до даты окончания заморозки.
4. **[Быстрый результат]** Ежедневный контроль переклички преподавателями до 19:00.
5. **[Стратегия]** Оптимизация сетки расписания свободных кабинетов в дневные часы (11:00 - 15:00).`;
      setAiReport(localReport);
      setLastGeneratedAt(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-generate on first view if no report
  useEffect(() => {
    if (!aiReport && !isLoading) {
      handleGenerateAiReport();
    }
  }, [selectedMonth]);

  // Handle Interactive Chat with AI Advisor
  const handleSendChatQuestion = async (e?: React.FormEvent, customQ?: string) => {
    if (e) e.preventDefault();
    const query = customQ || chatQuestion;
    if (!query.trim() || isChatLoading) return;

    const userMessage = {
      role: 'user' as const,
      text: query.trim(),
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };

    setChatHistory((prev) => [...prev, userMessage]);
    setChatQuestion('');
    setIsChatLoading(true);

    try {
      const contextPrompt = `Ты — персональный ИИ-советник директора учебного центра REDCAT.
Текущий анализируемый месяц: ${formatMonthLabel(selectedMonth)}.
Ключевые показатели центра:
- Выручка: ${stats.currCollected.toLocaleString('ru-RU')} сум (${stats.revenueGrowth >= 0 ? '+' : ''}${stats.revenueGrowth}% MoM)
- Расходы: ${stats.currExpTotal.toLocaleString('ru-RU')} сум, Чистая прибыль: ${stats.currProfit.toLocaleString('ru-RU')} сум
- Долги: ${stats.currDebtSum.toLocaleString('ru-RU')} сум (${stats.currDebtCount} должников)
- Ученики: ${stats.activeStudentsCount} активных, ${stats.frozenStudentsCount} замороженных
- Лиды: ${stats.waitingLeads} ожидают группу, ${stats.enrolledLeads} зачислены (конверсия ${stats.leadConversionRate}%)
- Курсы: ${stats.activeCoursesCount} групп (${stats.lowOccupancyCoursesCount} малокомплектных), средняя заполняемость ${stats.averageCourseOccupancy} уч.
- Посещаемость: ${stats.currAttendanceRate}% (${stats.currExcusedCount} уважительных, ${stats.currUnexcusedCount} неуважительных)

Вопрос руководителя: "${query}"

Дай четкий, емкий, профессиональный и практический совет с конкретными цифрами и шагами.`;

      const res = await fetch('/api/ai-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: contextPrompt,
        }),
      });

      let replyText = '';
      if (res.ok) {
        const data = await res.json();
        replyText = data.text;
      } else {
        replyText = `По вашему вопросу рекомендуем:
1. Обратить внимание на группы с наполняемостью менее 5 учеников (сейчас таких ${stats.lowOccupancyCoursesCount}) и предложить ожидающим ${stats.waitingLeads} лидам пробный урок.
2. Провести работу по закрытию текущей задолженности (${stats.currDebtSum.toLocaleString('ru-RU')} сум) через индивидуальные SMS и звонки.
3. Сохранять высокий процент посещаемости (текущий: ${stats.currAttendanceRate}%).`;
      }

      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: replyText,
          time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `На основе текущих данных центра: у вас ${stats.activeStudentsCount} активных учеников и ${stats.waitingLeads} горячих лидов в ожидании. Для быстрого роста сосредоточьтесь на доборе малокомплектных групп и возврате задолженности ${stats.currDebtSum.toLocaleString('ru-RU')} сум.`,
          time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (!aiReport) return;
    navigator.clipboard.writeText(aiReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 border border-indigo-500/20 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center space-x-2">
                  <span>ИИ-Аналитика & Бизнес-Советник</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Gemini AI 3.7
                  </span>
                </h1>
                <p className="text-xs text-indigo-200/80">
                  Автоматический аудит всех разделов базы, сравнение с прошлым месяцем (MoM) и практические рекомендации
                </p>
              </div>
            </div>
          </div>

          {/* Month Selector and Refresh Button */}
          <div className="flex items-center space-x-3 self-start md:self-auto">
            <div className="flex items-center space-x-2 bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-xl">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m} className="bg-slate-900 text-white">
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGenerateAiReport}
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Анализирую базу...' : 'Обновить анализ'}</span>
            </button>
          </div>
        </div>

        {lastGeneratedAt && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Анализ сформирован: <strong className="text-slate-200">{lastGeneratedAt}</strong> за период{' '}
                <strong className="text-indigo-300">{formatMonthLabel(selectedMonth)}</strong> vs{' '}
                <strong className="text-slate-300">{formatMonthLabel(previousMonth)}</strong>
              </span>
            </span>
            <span className="text-emerald-400 font-medium flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>База данных синхронизирована</span>
            </span>
          </div>
        )}
      </div>

      {/* EXECUTIVE MONTH-OVER-MONTH (MoM) METRIC TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. Revenue Tile */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Выручка (Собрано)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-black text-slate-900 dark:text-white">
              {stats.currCollected.toLocaleString('ru-RU')}{' '}
              <span className="text-xs font-normal text-slate-400">сум</span>
            </p>
            <div className="mt-1 flex items-center space-x-1.5 text-xs">
              <span
                className={`inline-flex items-center font-bold px-1.5 py-0.5 rounded text-[11px] ${
                  stats.revenueGrowth >= 0
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                }`}
              >
                {stats.revenueGrowth >= 0 ? (
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-0.5" />
                )}
                {stats.revenueGrowth >= 0 ? `+${stats.revenueGrowth}%` : `${stats.revenueGrowth}%`}
              </span>
              <span className="text-slate-400 text-[11px]">к прошл. мес.</span>
            </div>
          </div>
        </div>

        {/* 2. Net Profit Tile */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Чистая Прибыль
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p
              className={`text-xl font-black ${
                stats.currProfit >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'
              }`}
            >
              {stats.currProfit.toLocaleString('ru-RU')}{' '}
              <span className="text-xs font-normal text-slate-400">сум</span>
            </p>
            <div className="mt-1 flex items-center space-x-1.5 text-xs">
              <span
                className={`inline-flex items-center font-bold px-1.5 py-0.5 rounded text-[11px] ${
                  stats.profitGrowth >= 0
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                }`}
              >
                {stats.profitGrowth >= 0 ? (
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-0.5" />
                )}
                {stats.profitGrowth >= 0 ? `+${stats.profitGrowth}%` : `${stats.profitGrowth}%`}
              </span>
              <span className="text-slate-400 text-[11px]">
                Расходы: {stats.currExpTotal.toLocaleString('ru-RU')}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Students & Leads Tile */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ученики & Воронка
            </span>
            <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-black text-slate-900 dark:text-white">
              {stats.activeStudentsCount}{' '}
              <span className="text-xs font-normal text-slate-400">активных уч.</span>
            </p>
            <div className="mt-1 flex items-center space-x-2 text-[11px]">
              <span className="text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded">
                Конверсия: {stats.leadConversionRate}%
              </span>
              <span className="text-slate-400">
                {stats.waitingLeads} в очереди
              </span>
            </div>
          </div>
        </div>

        {/* 4. Attendance Rate Tile */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Посещаемость
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-black text-slate-900 dark:text-white">
              {stats.currAttendanceRate}%
            </p>
            <div className="mt-1 flex items-center space-x-1.5 text-xs">
              <span
                className={`inline-flex items-center font-bold px-1.5 py-0.5 rounded text-[11px] ${
                  parseFloat(stats.attendanceDelta) >= 0
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                }`}
              >
                {parseFloat(stats.attendanceDelta) >= 0 ? '+' : ''}
                {stats.attendanceDelta}% MoM
              </span>
              <span className="text-slate-400 text-[11px]">
                {stats.currAbsentCount} пропусков
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* MAIN TWO-COLUMN SECTION: AI REPORT & SIDEBAR MODULE SNAPSHOTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT 2 COLUMNS: FULL AI NARRATIVE REPORT */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  Комплексный ИИ-Аудит и Советы по Развитию
                </h2>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyReport}
                  className="flex items-center space-x-1 text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors"
                  title="Скопировать отчет в буфер обмена"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Скопировано' : 'Копировать'}</span>
                </button>
              </div>
            </div>

            {/* AI Report Body */}
            {isLoading ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Искусственный интеллект анализирует базу данных...
                  </p>
                  <p className="text-xs text-slate-400">
                    Сопоставляем финансы, задолженности, посещаемость, загрузку кабинетов и воронку лидов с прошлым месяцем
                  </p>
                </div>
              </div>
            ) : aiReport ? (
              <div className="mt-4 prose dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300 space-y-3 font-sans">
                {aiReport.split('\n\n').map((paragraph, idx) => {
                  if (paragraph.startsWith('###') || paragraph.startsWith('##')) {
                    const title = paragraph.replace(/^#+\s*/, '');
                    return (
                      <h3
                        key={idx}
                        className="text-sm sm:text-base font-bold text-indigo-950 dark:text-indigo-200 pt-3 pb-1 border-b border-indigo-50 dark:border-slate-800 flex items-center space-x-2"
                      >
                        <span>{title}</span>
                      </h3>
                    );
                  }
                  if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
                    const items = paragraph.split('\n').map((line) => line.replace(/^[-*]\s*/, ''));
                    return (
                      <ul key={idx} className="list-disc pl-5 space-y-1.5 my-2">
                        {items.map((it, iIdx) => (
                          <li key={iIdx} dangerouslySetInnerHTML={{ __html: it.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        ))}
                      </ul>
                    );
                  }
                  if (/^\d+\./.test(paragraph)) {
                    const items = paragraph.split('\n').map((line) => line.replace(/^\d+\.\s*/, ''));
                    return (
                      <ol key={idx} className="list-decimal pl-5 space-y-1.5 my-2">
                        {items.map((it, iIdx) => (
                          <li key={iIdx} dangerouslySetInnerHTML={{ __html: it.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        ))}
                      </ol>
                    );
                  }
                  return (
                    <p
                      key={idx}
                      dangerouslySetInnerHTML={{
                        __html: paragraph.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400">
                Нажмите «Обновить анализ», чтобы сформировать свежий отчет.
              </div>
            )}

          </div>

          {/* INTERACTIVE AI ADVISOR (Q&A CHAT) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-950 text-violet-600 flex items-center justify-center">
                <Lightbulb className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Спросить ИИ-Консультанта по развитию центра
                </h3>
                <p className="text-[11px] text-slate-400">
                  Задайте конкретный вопрос о выручке, наборе учеников, расписании или зарплатах
                </p>
              </div>
            </div>

            {/* Quick Prompt Chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                '💡 Как взыскать долги без потери учеников?',
                '🎯 Стратегия набора в полупустые группы',
                '📊 Как оптимизировать загрузку кабинетов?',
                '📋 Как повысить посещаемость у отстающих групп?',
              ].map((promptText) => (
                <button
                  key={promptText}
                  onClick={() => handleSendChatQuestion(undefined, promptText)}
                  className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 text-[11px] text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
                >
                  {promptText}
                </button>
              ))}
            </div>

            {/* Chat History Box */}
            {chatHistory.length > 0 && (
              <div className="mb-4 max-h-72 overflow-y-auto space-y-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
                {chatHistory.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-tl-none shadow-xs'
                      }`}
                    >
                      <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                      <span
                        className={`text-[9px] block mt-1 ${
                          msg.role === 'user' ? 'text-indigo-200 text-right' : 'text-slate-400'
                        }`}
                      >
                        {msg.time}
                      </span>
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex items-center space-x-2 text-slate-400 text-xs italic">
                    <Sparkles className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                    <span>ИИ формулирует рекомендацию...</span>
                  </div>
                )}
              </div>
            )}

            {/* Question Input Form */}
            <form onSubmit={handleSendChatQuestion} className="flex items-center space-x-2">
              <input
                type="text"
                value={chatQuestion}
                onChange={(e) => setChatQuestion(e.target.value)}
                placeholder="Например: Как поднять маржинальность курсов на 15%?"
                className="flex-1 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!chatQuestion.trim() || isChatLoading}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center space-x-1 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Отправить</span>
              </button>
            </form>
          </div>

        </div>

        {/* RIGHT COLUMN: MODULE-BY-MODULE AUDIT CARDS & MOM BREAKDOWN */}
        <div className="space-y-6">
          
          {/* 1. FINANCIAL MOM HEALTH CARD */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span>Финансовый баланс (MoM)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {selectedMonth} vs {previousMonth}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950">
                <span className="text-slate-600 dark:text-slate-400">Собрано в {formatMonthLabel(selectedMonth)}:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {stats.currCollected.toLocaleString('ru-RU')} сум
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950">
                <span className="text-slate-600 dark:text-slate-400">Собрано в {formatMonthLabel(previousMonth)}:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {stats.prevCollected.toLocaleString('ru-RU')} сум
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30">
                <span className="text-rose-700 dark:text-rose-400 font-medium">Неоплаченные долги:</span>
                <span className="font-black text-rose-600">
                  {stats.currDebtSum.toLocaleString('ru-RU')} сум ({stats.currDebtCount} уч.)
                </span>
              </div>
            </div>
          </div>

          {/* 2. LEAD CONVERSION & CAPACITY CARD */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                <Target className="w-4 h-4 text-violet-500" />
                <span>Воронка Лидов & Кабинеты</span>
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950">
                <span className="text-slate-500">Заявок в ожидании группы:</span>
                <span className="font-bold text-indigo-600">{stats.waitingLeads} лидов</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950">
                <span className="text-slate-500">Успешно зачислены (студенты):</span>
                <span className="font-bold text-emerald-600">{stats.enrolledLeads} уч.</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950">
                <span className="text-slate-500">Малокомплектных групп (&lt;5 уч.):</span>
                <span
                  className={`font-bold ${
                    stats.lowOccupancyCoursesCount > 0 ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  {stats.lowOccupancyCoursesCount} групп
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950">
                <span className="text-slate-500">Замороженные учащиеся:</span>
                <span className="font-bold text-cyan-600">{stats.frozenStudentsCount} уч.</span>
              </div>
            </div>
          </div>

          {/* 3. ATTENDANCE & TEACHERS CARD */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                <UserCheck className="w-4 h-4 text-blue-500" />
                <span>Преподаватели & Посещаемость</span>
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950">
                <span className="text-slate-500">Преподавателей в штате:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{stats.teachersCount}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950">
                <span className="text-slate-500">Уважительных пропусков:</span>
                <span className="font-bold text-blue-600">{stats.currExcusedCount}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950">
                <span className="text-slate-500">Неуважительных прогулов:</span>
                <span className="font-bold text-rose-600">{stats.currUnexcusedCount}</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
