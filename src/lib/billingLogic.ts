// Business Logic Functions for REDCAT CRM
import { TeacherProfile, Payment, DiscountType, Course, Student } from '../types';

/**
 * Округление суммы до 1 000 сум (последние 3 цифры всегда "000"),
 * чтобы избежать расчетов с мелкими купюрами (например: 166 665 -> 167 000 сум).
 */
export function roundToThousand(amount: number): number {
  if (!amount || isNaN(amount) || amount <= 0) return 0;
  return Math.round(amount / 1000) * 1000;
}

/**
 * Проверка, является ли определенный день недели учебным днем для курса.
 * Поддерживает форматы:
 * - "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"
 * - Нечетные дни (ПН, СР, ПТ) / Четные дни (ВТ, ЧТ, СБ)
 * - Полные названия дней ("Понедельник", "Вторник", etc.)
 * - Английские ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")
 */
export function isCourseLessonDay(courseDays: string[] = [], date: Date): boolean {
  const dayNum = date.getDay(); // 0 = ВС, 1 = ПН, 2 = ВТ, 3 = СР, 4 = ЧТ, 5 = ПТ, 6 = СБ

  if (!courseDays || courseDays.length === 0) {
    // По умолчанию: нечетные дни (ПН, СР, ПТ = 1, 3, 5)
    return dayNum === 1 || dayNum === 3 || dayNum === 5;
  }

  const normalized = courseDays.map((d) => String(d).toUpperCase().trim());

  // Проверка на "НЕЧЕТНЫЕ ДНИ" (ПН, СР, ПТ)
  if (normalized.some((d) => d.includes('НЕЧЕТ') || d.includes('ODD'))) {
    if (dayNum === 1 || dayNum === 3 || dayNum === 5) return true;
  }

  // Проверка на "ЧЕТНЫЕ ДНИ" (ВТ, ЧТ, СБ)
  if (normalized.some((d) => d.includes('ЧЕТ') || d.includes('EVEN'))) {
    if (dayNum === 2 || dayNum === 4 || dayNum === 6) return true;
  }

  // Проверка по дням недели:
  if (dayNum === 1 && normalized.some((d) => d === 'ПН' || d === 'ПОНЕДЕЛЬНИК' || d === 'MON' || d === 'MONDAY')) return true;
  if (dayNum === 2 && normalized.some((d) => d === 'ВТ' || d === 'ВТОРНИК' || d === 'TUE' || d === 'TUESDAY')) return true;
  if (dayNum === 3 && normalized.some((d) => d === 'СР' || d === 'СРЕДА' || d === 'WED' || d === 'WEDNESDAY')) return true;
  if (dayNum === 4 && normalized.some((d) => d === 'ЧТ' || d === 'ЧЕТВЕРГ' || d === 'THU' || d === 'THURSDAY')) return true;
  if (dayNum === 5 && normalized.some((d) => d === 'ПТ' || d === 'ПЯТНИЦА' || d === 'FRI' || d === 'FRIDAY')) return true;
  if (dayNum === 6 && normalized.some((d) => d === 'СБ' || d === 'СУББОТА' || d === 'SAT' || d === 'SATURDAY')) return true;
  if (dayNum === 0 && normalized.some((d) => d === 'ВС' || d === 'ВОСКРЕСЕНЬЕ' || d === 'SUN' || d === 'SUNDAY')) return true;

  return false;
}

/**
 * Расчет количества пропущенных уроков и суммы вычета из-за заморозки ученика:
 * Например, если ученика заморозили на 1 неделю, и в эту неделю у курса было 3 урока
 * (например, по четным дням ВТ, ЧТ, СБ), оплата автоматически уменьшается на 3 урока.
 * Все суммы округляются до 1 000 сум (оканчиваются на 000).
 */
export function calculateFreezeDeduction(
  student: Student,
  course: Course,
  monthPeriod: string, // YYYY-MM (e.g. "2026-08")
  totalStandardLessons: number = 12
): {
  isFrozenInPeriod: boolean;
  frozenLessonsCount: number;
  pricePerLesson: number;
  deductionAmount: number;
  freezeStartDate: string | null;
  freezeEndDate: string | null;
  details: string;
} {
  const pricePerLesson = roundToThousand(course.monthlyPrice / totalStandardLessons);

  // Проверяем заморозку ДЛЯ КОНКРЕТНОГО КУРСА:
  const courseFreeze = student.courseFreezes?.[course.id];
  const hasCourseFreeze = Boolean(courseFreeze && (courseFreeze.freezeDate || courseFreeze.freezeUntil));

  // Если у ученика определена структура courseFreezes, проверяем строго эту группу!
  // Глобальный статус FROZEN применяется только для старых записей, где вообще нет поля courseFreezes
  const isLegacyFrozen = (student.courseFreezes === undefined || student.courseFreezes === null) && Boolean(
    student.status === 'FROZEN' || student.freezeDate || student.freezeUntil
  );

  const hasFreezeInfo = hasCourseFreeze || isLegacyFrozen;

  if (!hasFreezeInfo) {
    return {
      isFrozenInPeriod: false,
      frozenLessonsCount: 0,
      pricePerLesson,
      deductionAmount: 0,
      freezeStartDate: null,
      freezeEndDate: null,
      details: 'Ученик не был заморожен в этот период',
    };
  }

  // Определяем границы выбранного месяца
  const [yearStr, monthStr] = (monthPeriod || '2026-08').split('-');
  const year = parseInt(yearStr, 10) || 2026;
  const month = parseInt(monthStr, 10) || 8;
  const lastDayOfMonth = new Date(year, month, 0).getDate();

  const monthStartStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEndStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

  // Начало и конец заморозки для ДАННОЙ группы
  let freezeStart = courseFreeze?.freezeDate || student.freezeDate || monthStartStr;
  let freezeEnd = courseFreeze?.freezeUntil || student.freezeUntil || (student.status === 'FROZEN' ? monthEndStr : freezeStart);

  if (freezeStart > freezeEnd) {
    const temp = freezeStart;
    freezeStart = freezeEnd;
    freezeEnd = temp;
  }

  // Пересечение диапазона заморозки с выбранным месяцем
  const effectiveStart = freezeStart > monthStartStr ? freezeStart : monthStartStr;
  const effectiveEnd = freezeEnd < monthEndStr ? freezeEnd : monthEndStr;

  if (effectiveStart > effectiveEnd) {
    return {
      isFrozenInPeriod: false,
      frozenLessonsCount: 0,
      pricePerLesson,
      deductionAmount: 0,
      freezeStartDate: freezeStart,
      freezeEndDate: freezeEnd,
      details: 'Срок заморозки не пересекается с выбранным месяцем',
    };
  }

  // Проходим по каждому дню периода заморозки внутри этого месяца и считаем уроки курса
  let frozenLessonsCount = 0;
  const [sY, sM, sD] = effectiveStart.split('-').map(Number);
  const [eY, eM, eD] = effectiveEnd.split('-').map(Number);

  const curr = new Date(sY, sM - 1, sD);
  const end = new Date(eY, eM - 1, eD);

  while (curr <= end) {
    if (isCourseLessonDay(course.daysOfWeek, curr)) {
      frozenLessonsCount++;
    }
    curr.setDate(curr.getDate() + 1);
  }

  // Ограничиваем максимальное кол-во уроков в месяце
  frozenLessonsCount = Math.min(frozenLessonsCount, totalStandardLessons);
  const deductionAmount = roundToThousand((course.monthlyPrice / totalStandardLessons) * frozenLessonsCount);

  return {
    isFrozenInPeriod: frozenLessonsCount > 0 || student.status === 'FROZEN',
    frozenLessonsCount,
    pricePerLesson,
    deductionAmount,
    freezeStartDate: effectiveStart,
    freezeEndDate: effectiveEnd,
    details:
      frozenLessonsCount > 0
        ? `Заморозка с ${effectiveStart} по ${effectiveEnd}: пропущено ${frozenLessonsCount} ур. (вычет -${deductionAmount.toLocaleString('ru-RU')} сум)`
        : `Заморозка с ${effectiveStart} по ${effectiveEnd}: уроков курса в этот период не выпало`,
  };
}

/**
 * Правило расчета первого месяца (Правило 10-го числа):
 * 1. Если ученик начал ходить ДО 10-го числа включительно (день месяца <= 10)
 *    или остаток уроков = 12 (полный месяц):
 *    Базовая сумма ВСЕГДА строго равна полной цене курса (course.monthlyPrice),
 *    без деления на 12 и переумножения, чтобы исключить погрешности округления.
 * 2. Если ученик начал ходить ПОСЛЕ 10-го числа (день месяца > 10 и уроков < 12):
 *    Сумма рассчитывается пропорционально оставшимся урокам: (monthlyPrice / 12) * remainingLessons.
 *    И округляется до 1 000 сум (оканчивается на 000).
 * 3. К полученной сумме применяются скидки и льготы.
 */
export function calculateFirstMonthTuition(
  monthlyPrice: number,
  remainingLessons: number,
  totalStandardLessons: number = 12,
  discountType: DiscountType = 'NONE',
  discountValue: number = 0,
  startDayOfMonth?: number
): {
  baseMonthlyPrice: number;
  pricePerLesson: number;
  proportionalPrice: number;
  discountAmount: number;
  finalAmountDue: number;
  isFullMonth: boolean;
} {
  const safeLessons = Math.max(0, Math.min(remainingLessons, totalStandardLessons));
  const pricePerLesson = roundToThousand(monthlyPrice / totalStandardLessons);

  // Правило 10-го числа:
  // До 10-го числа включительно или если выбрано 12 уроков -> полная сумма курса
  const isFullMonth = (startDayOfMonth !== undefined && startDayOfMonth <= 10) || safeLessons >= totalStandardLessons;

  const proportionalPrice = isFullMonth
    ? monthlyPrice
    : roundToThousand((monthlyPrice / totalStandardLessons) * safeLessons);

  let discountAmount = 0;
  if (discountType === 'PERCENTAGE') {
    discountAmount = roundToThousand((proportionalPrice * (discountValue || 0)) / 100);
  } else if (discountType === 'FIXED_SUM') {
    discountAmount = roundToThousand(Math.min(proportionalPrice, discountValue || 0));
  }

  const finalAmountDue = roundToThousand(Math.max(0, proportionalPrice - discountAmount));

  return {
    baseMonthlyPrice: monthlyPrice,
    pricePerLesson,
    proportionalPrice,
    discountAmount,
    finalAmountDue,
    isFullMonth,
  };
}

/**
 * Расчет оплаты последующих месяцев с учетом уважительных пропусков:
 * - Пропуск БЕЗ причины: Оплата НЕ возвращается, урок считается проведенным, задолженность полная.
 * - Пропуск С причиной (уважительная): Стоимость урока автоматически вычитается / переносится в счет оплаты за следующий месяц.
 * Урок = MonthlyPrice / 12 (с округлением до 1 000 сум).
 */
export function calculateAdjustedTuition(
  monthlyPrice: number,
  excusedAbsencesCount: number,
  isFirstMonth: boolean = false,
  remainingLessonsCount: number = 12,
  discountType: DiscountType = 'NONE',
  discountValue: number = 0,
  totalStandardLessons: number = 12,
  startDayOfMonth?: number
): {
  baseMonthlyPrice: number;
  pricePerLesson: number;
  rawAmount: number;
  discountAmount: number;
  excusedDeduction: number;
  finalAmountDue: number;
} {
  const pricePerLesson = roundToThousand(monthlyPrice / totalStandardLessons);
  
  // Исходная база
  let rawAmount = monthlyPrice;
  if (isFirstMonth) {
    const isFull = (startDayOfMonth !== undefined && startDayOfMonth <= 10) || remainingLessonsCount >= totalStandardLessons;
    rawAmount = isFull
      ? monthlyPrice
      : roundToThousand((monthlyPrice / totalStandardLessons) * Math.max(0, Math.min(remainingLessonsCount, totalStandardLessons)));
  }

  // Расчет вычета за уважительные пропуски
  const excusedDeduction = roundToThousand((monthlyPrice / totalStandardLessons) * Math.max(0, excusedAbsencesCount));

  // Расчет персональной скидки
  let discountAmount = 0;
  if (discountType === 'PERCENTAGE') {
    discountAmount = roundToThousand((rawAmount * (discountValue || 0)) / 100);
  } else if (discountType === 'FIXED_SUM') {
    discountAmount = roundToThousand(Math.min(rawAmount, discountValue || 0));
  }

  // Окончательная сумма
  const finalAmountDue = roundToThousand(Math.max(0, rawAmount - discountAmount - excusedDeduction));

  return {
    baseMonthlyPrice: monthlyPrice,
    pricePerLesson,
    rawAmount,
    discountAmount,
    excusedDeduction,
    finalAmountDue,
  };
}

/**
 * Модуль расчета зарплаты преподавателей:
 * Автоматический расчет выплаты учителю за месяц на основе его модели:
 * - PERCENTAGE (% от фактически собранных средств с учеников его групп)
 * - FIXED (Фиксированная ставка за месяц или суммирование за уроки)
 * - CONTRACTUAL (Договорная ставка / гибкие условия)
 */
export function calculateTeacherSalary(
  teacher: TeacherProfile,
  teacherCourses: Course[],
  monthPayments: Payment[],
  lessonsHeldCount: number = 12
): {
  totalSalary: number;
  model: TeacherProfile['salaryModel'];
  totalCollectedFromGroups: number;
  summaryText: string;
  courseBreakdown: { courseTitle: string; studentPaymentsCount: number; collected: number; teacherShare: number }[];
} {
  const teacherCourseIds = new Set(teacherCourses.map((c) => c.id));
  
  // Фильтруем платежи учеников, относящиеся к курсам данного учителя
  const relevantPayments = monthPayments.filter((p) => teacherCourseIds.has(p.courseId));
  
  // Сумма фактически собранных денег
  const totalCollectedFromGroups = relevantPayments.reduce((sum, p) => sum + p.amountPaid, 0);

  let totalSalary = 0;
  let summaryText = '';
  const courseBreakdown: { courseTitle: string; studentPaymentsCount: number; collected: number; teacherShare: number }[] = [];

  if (teacher.salaryModel === 'PERCENTAGE') {
    const rate = teacher.percentageRate || 40; // по умолчанию 40%
    
    teacherCourses.forEach((course) => {
      const coursePayments = relevantPayments.filter((p) => p.courseId === course.id);
      const courseCollected = coursePayments.reduce((s, p) => s + p.amountPaid, 0);
      // Точный расчет зарплаты учителя без округления до тысяч
      const teacherShare = Math.round((courseCollected * rate) / 100);
      
      courseBreakdown.push({
        courseTitle: course.title,
        studentPaymentsCount: coursePayments.length,
        collected: courseCollected,
        teacherShare,
      });
    });

    totalSalary = courseBreakdown.reduce((s, item) => s + item.teacherShare, 0);
    summaryText = `Процентная модель (${rate}% от фактически собранной оплаты ${totalCollectedFromGroups.toLocaleString('ru-RU')} сум)`;
  } 
  else if (teacher.salaryModel === 'FIXED') {
    const fixedRate = teacher.fixedRate || 150000;
    
    teacherCourses.forEach((course) => {
      const coursePayments = relevantPayments.filter((p) => p.courseId === course.id);
      const courseCollected = coursePayments.reduce((s, p) => s + p.amountPaid, 0);
      // Точное распределение фиксированной ставки без округления до тысяч
      const share = Math.round(fixedRate / Math.max(1, teacherCourses.length));
      
      courseBreakdown.push({
        courseTitle: course.title,
        studentPaymentsCount: coursePayments.length,
        collected: courseCollected,
        teacherShare: share,
      });
    });

    totalSalary = fixedRate;
    summaryText = `Фиксированная окладная ставка (${fixedRate.toLocaleString('ru-RU')} сум/мес за ${lessonsHeldCount} проведенных уроков)`;
  } 
  else { // CONTRACTUAL (Договорная)
    const baseContractRate = teacher.fixedRate || 120000;
    const bonusPerStudent = 2000;
    
    teacherCourses.forEach((course) => {
      const coursePayments = relevantPayments.filter((p) => p.courseId === course.id);
      const courseCollected = coursePayments.reduce((s, p) => s + p.amountPaid, 0);
      const bonus = coursePayments.length * bonusPerStudent;
      // Точный расчет договорной ставки без округления до тысяч
      const share = Math.round(baseContractRate / Math.max(1, teacherCourses.length) + bonus);

      courseBreakdown.push({
        courseTitle: course.title,
        studentPaymentsCount: coursePayments.length,
        collected: courseCollected,
        teacherShare: share,
      });
    });

    totalSalary = courseBreakdown.reduce((s, item) => s + item.teacherShare, 0);
    summaryText = `Договорная гибкая ставка: Базовый фикс + бонус за записанных учеников (${teacher.contractNotes || 'Персональный договор'})`;
  }

  return {
    totalSalary,
    model: teacher.salaryModel,
    totalCollectedFromGroups,
    summaryText,
    courseBreakdown,
  };
}

/**
 * Помощник формата даты
 */
export function formatDateRU(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Проверка дня рождения учителя на сегодня и ближайшие 7 дней
 */
export function checkTeacherBirthdayStatus(birthDateStr: string): {
  isToday: boolean;
  isUpcoming: boolean;
  daysLeft: number;
  formattedDate: string;
} {
  if (!birthDateStr) return { isToday: false, isUpcoming: false, daysLeft: -1, formattedDate: '' };
  
  const now = new Date();
  const birthDate = new Date(birthDateStr);
  
  const currentYear = now.getFullYear();
  const nextBday = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
  
  // Если день рождения в этом году уже прошёл, берём следующий год
  if (nextBday < new Date(currentYear, now.getMonth(), now.getDate() - 1)) {
    nextBday.setFullYear(currentYear + 1);
  }
  
  const diffTime = nextBday.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const formattedDate = birthDate.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });

  return {
    isToday: daysLeft === 0,
    isUpcoming: daysLeft > 0 && daysLeft <= 10,
    daysLeft,
    formattedDate,
  };
}
