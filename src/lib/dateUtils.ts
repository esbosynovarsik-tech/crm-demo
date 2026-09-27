/**
 * Date and Time utilities synchronized for Uzbekistan (Asia/Tashkent, UTC+5)
 */

export const UZ_TIMEZONE = 'Asia/Tashkent';

/**
 * Returns current date in Uzbekistan in 'YYYY-MM-DD' format.
 */
export function getUzbekistanToday(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: UZ_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '01';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Returns current date and time in Uzbekistan in ISO-like format: 'YYYY-MM-DDTHH:mm:ss'
 */
export function getUzbekistanISOString(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: UZ_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

/**
 * Returns localized date & time string formatted for Uzbekistan (ru-RU format with Tashkent timezone)
 * Example: "10.08.2026, 14:05:30"
 */
export function getUzbekistanLocaleString(): string {
  return new Date().toLocaleString('ru-RU', { timeZone: UZ_TIMEZONE });
}

/**
 * Checks if a student is frozen on a specific date (YYYY-MM-DD), optionally in a specific course.
 * Supports independent freezing per course.
 */
export function isStudentFrozenOnDate(
  student?: {
    status: string;
    freezeDate?: string;
    freezeUntil?: string;
    courseFreezes?: Record<string, { freezeDate: string; freezeUntil?: string; freezeReason?: string }>;
  } | null,
  dateStr?: string,
  courseId?: string
): boolean {
  if (!student || !dateStr) return false;

  // 1. If checking a specific course:
  if (courseId) {
    if (student.courseFreezes !== undefined && student.courseFreezes !== null) {
      const courseFreeze = student.courseFreezes[courseId];
      if (courseFreeze) {
        const freezeStart = courseFreeze.freezeDate || '1970-01-01';
        const freezeEnd = courseFreeze.freezeUntil;
        if (dateStr < freezeStart) return false;
        if (freezeEnd && dateStr > freezeEnd) return false;
        return true;
      }
      // If courseFreezes object exists, and course is NOT in it -> definitely NOT frozen in this course!
      return false;
    }

    // Fallback for legacy records without courseFreezes field:
    if (student.status !== 'FROZEN') return false;
    const freezeStart = student.freezeDate || '1970-01-01';
    const freezeEnd = student.freezeUntil;
    if (dateStr < freezeStart) return false;
    if (freezeEnd && dateStr > freezeEnd) return false;
    return true;
  }

  // 2. If NO courseId was specified (global check across student):
  if (student.courseFreezes !== undefined && student.courseFreezes !== null) {
    const courseFreezeEntries = Object.values(student.courseFreezes);
    if (courseFreezeEntries.length > 0) {
      return courseFreezeEntries.some((cf) => {
        const freezeStart = cf.freezeDate || '1970-01-01';
        const freezeEnd = cf.freezeUntil;
        if (dateStr < freezeStart) return false;
        if (freezeEnd && dateStr > freezeEnd) return false;
        return true;
      });
    }
    return false;
  }

  // Fallback to legacy global student freeze status
  if (student.status !== 'FROZEN') return false;
  const freezeStart = student.freezeDate || '1970-01-01';
  const freezeEnd = student.freezeUntil;
  if (dateStr < freezeStart) return false;
  if (freezeEnd && dateStr > freezeEnd) return false;
  return true;
}

/**
 * Checks whether a student is frozen in a specific course today or on a specific date.
 */
export function isStudentFrozenInCourse(
  student?: {
    status: string;
    freezeDate?: string;
    freezeUntil?: string;
    courseFreezes?: Record<string, { freezeDate: string; freezeUntil?: string; freezeReason?: string }>;
  } | null,
  courseId?: string,
  onDate?: string
): boolean {
  const checkDate = onDate || getUzbekistanToday();
  return isStudentFrozenOnDate(student, checkDate, courseId);
}

/**
 * Automatically calculates age in full years given a birthDate ('YYYY-MM-DD').
 * Compares against today's date in Uzbekistan.
 */
export function calculateAgeFromBirthDate(birthDateStr?: string): number {
  if (!birthDateStr || birthDateStr.trim().length < 4) return 0;
  const parts = birthDateStr.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return 0;
  }
  const [bYear, bMonth, bDay] = parts;
  const todayStr = getUzbekistanToday(); // 'YYYY-MM-DD'
  const [tYear, tMonth, tDay] = todayStr.split('-').map(Number);

  let age = tYear - bYear;
  if (tMonth < bMonth || (tMonth === bMonth && tDay < bDay)) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * Returns formatted Russian age string, e.g. "28 лет", "21 год", "23 года".
 */
export function formatAgeWithSuffix(age: number): string {
  if (!age || age <= 0) return '—';
  const mod100 = age % 100;
  const mod10 = age % 10;
  if (mod100 >= 11 && mod100 <= 19) return `${age} лет`;
  if (mod10 === 1) return `${age} год`;
  if (mod10 >= 2 && mod10 <= 4) return `${age} года`;
  return `${age} лет`;
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

/**
 * Returns current month period in Uzbekistan in 'YYYY-MM' format, e.g. '2026-09'.
 */
export function getUzbekistanCurrentMonthPeriod(): string {
  const today = getUzbekistanToday();
  return today.slice(0, 7);
}

/**
 * Returns human-readable Russian label for 'YYYY-MM' period, e.g. "Август 2026".
 */
export function formatMonthPeriodLabel(periodStr?: string): string {
  if (!periodStr || !periodStr.includes('-')) return periodStr || '';
  const [year, month] = periodStr.split('-');
  const name = MONTH_NAMES_RU[month] || month;
  return `${name} ${year}`;
}

/**
 * Generates an array of 'YYYY-MM' periods centered around a base period (or current month).
 */
export function getGeneratedMonthPeriods(basePeriod?: string, pastMonths = 12, futureMonths = 6): string[] {
  const target = basePeriod || getUzbekistanCurrentMonthPeriod();
  const [yStr, mStr] = target.split('-');
  const baseYear = parseInt(yStr, 10) || 2026;
  const baseMonth = parseInt(mStr, 10) || 9;

  const periods: string[] = [];
  for (let offset = -pastMonths; offset <= futureMonths; offset++) {
    let year = baseYear;
    let month = baseMonth + offset;
    while (month < 1) {
      month += 12;
      year -= 1;
    }
    while (month > 12) {
      month -= 12;
      year += 1;
    }
    const mFormatted = month < 10 ? `0${month}` : `${month}`;
    periods.push(`${year}-${mFormatted}`);
  }
  return Array.from(new Set(periods)).sort();
}

/**
 * Formats a date string ('YYYY-MM-DD' or ISO) to Russian readable format: 'DD.MM.YYYY' (and HH:mm if time is present).
 * E.g. '2026-09-04' -> '04.09.2026', '2026-09-08T14:35:10' -> '08.09.2026 14:35'
 */
export function formatDisplayDateRu(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (dateStr.includes('T')) {
      const time = dateStr.split('T')[1]?.slice(0, 5);
      if (time && time !== '00:00') {
        return `${day}.${month}.${year} в ${time}`;
      }
    }
    return `${day}.${month}.${year}`;
  }
  return dateStr;
}

/**
 * Returns yesterday's date in Uzbekistan in 'YYYY-MM-DD' format.
 */
export function getUzbekistanYesterday(): string {
  const today = getUzbekistanToday();
  const [y, m, d] = today.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  const prevY = date.getUTCFullYear();
  const prevM = String(date.getUTCMonth() + 1).padStart(2, '0');
  const prevD = String(date.getUTCDate()).padStart(2, '0');
  return `${prevY}-${prevM}-${prevD}`;
}

/**
 * Robustly extracts 'YYYY-MM-DD' payment date from a payment object
 */
export function extractDateFromPayment(p?: { paidAt?: string; id?: string } | null): string | null {
  if (!p) return null;
  if (p.paidAt) {
    const match = p.paidAt.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const parsed = Date.parse(p.paidAt);
    if (!isNaN(parsed)) {
      return new Date(parsed).toLocaleDateString('en-CA', { timeZone: UZ_TIMEZONE });
    }
  }
  if (p.id) {
    const match = p.id.match(/^pay-(\d{10,13})/);
    if (match) {
      const ts = parseInt(match[1], 10);
      if (!isNaN(ts)) {
        return new Date(ts).toLocaleDateString('en-CA', { timeZone: UZ_TIMEZONE });
      }
    }
  }
  return null;
}



