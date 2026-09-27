import { Student } from '../types';

/**
 * Normalizes full name by lowercasing and trimming excessive whitespace.
 */
export const normalizeFullName = (name: string): string => {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Normalizes phone number to just digits.
 */
export const normalizePhoneDigits = (phone: string): string => {
  return (phone || '').replace(/\D/g, '');
};

/**
 * Extracts the significant subscriber digits of an Uzbekistan phone number (typically last 9 digits).
 * E.g. "+998 90 123 45 67" -> "901234567"
 * E.g. "901234567" -> "901234567"
 * E.g. "998901234567" -> "901234567"
 */
export const getSignificantPhoneDigits = (phone: string): string => {
  const digits = normalizePhoneDigits(phone);
  if (digits.length >= 9) {
    return digits.slice(-9);
  }
  return digits;
};

export type DuplicateCheckResult = {
  isDuplicate: boolean;
  hasNameMatch: boolean;
  status: 'UNIQUE' | 'EXACT_DUPLICATE' | 'NAME_MATCH_DIFFERENT_PHONE' | 'NAME_MATCH_PHONE_PENDING' | 'EMPTY';
  existingStudent?: Student;
  allNameMatches?: Student[];
  message?: string;
};

/**
 * Checks whether a student with the given fullName and phone number already exists.
 * - If BOTH fullName AND phone match an existing student -> DUPLICATE (blocked).
 * - If fullName matches BUT phone is different -> ALLOWED (homonym/namesake).
 * - If fullName matches and phone is not fully entered yet -> WARNS about existing student.
 * - If editing, excludeStudentId is ignored in the comparison.
 */
export const checkStudentDuplicate = (
  students: Student[],
  fullName: string,
  phone: string,
  excludeStudentId?: string | null
): DuplicateCheckResult => {
  const normName = normalizeFullName(fullName);
  const inputPhoneDigits = getSignificantPhoneDigits(phone);

  // If name has less than 3 characters, treat as empty
  if (!normName || normName.length < 3) {
    return { isDuplicate: false, hasNameMatch: false, status: 'EMPTY' };
  }

  const otherStudents = excludeStudentId
    ? students.filter((s) => s.id !== excludeStudentId)
    : students;

  // Find any other students with matching normalized name
  const nameMatchingStudents = otherStudents.filter(
    (s) => normalizeFullName(s.fullName) === normName
  );

  if (nameMatchingStudents.length === 0) {
    return { isDuplicate: false, hasNameMatch: false, status: 'UNIQUE' };
  }

  // Exact duplicate: Same name AND same phone number
  const exactDuplicate = nameMatchingStudents.find((s) => {
    const existingPhoneDigits = getSignificantPhoneDigits(s.phone || '');
    
    // Both have valid phone numbers (at least 7 digits) and they are identical
    if (inputPhoneDigits.length >= 7 && existingPhoneDigits.length >= 7) {
      return inputPhoneDigits === existingPhoneDigits;
    }

    // If both have empty/no phone
    if (inputPhoneDigits.length === 0 && existingPhoneDigits.length === 0) {
      return true;
    }

    return false;
  });

  if (exactDuplicate) {
    return {
      isDuplicate: true,
      hasNameMatch: true,
      status: 'EXACT_DUPLICATE',
      existingStudent: exactDuplicate,
      allNameMatches: nameMatchingStudents,
      message: `Ученик с ФИО «${exactDuplicate.fullName}» и номером телефона «${exactDuplicate.phone || '—'}» уже зарегистрирован в базе! Повторное добавление невозможно.`,
    };
  }

  // Name matched, and phone is entered and clearly different
  if (inputPhoneDigits.length >= 7) {
    const firstHomonym = nameMatchingStudents[0];
    return {
      isDuplicate: false,
      hasNameMatch: true,
      status: 'NAME_MATCH_DIFFERENT_PHONE',
      existingStudent: firstHomonym,
      allNameMatches: nameMatchingStudents,
      message: `В базе уже есть ученик с таким ФИО («${firstHomonym.fullName}»), но номер телефона отличается (${firstHomonym.phone || '—'}). Регистрация однофамильца / тёзки разрешена.`,
    };
  }

  // Name matched, but phone number is still being typed or not yet provided
  const firstMatch = nameMatchingStudents[0];
  return {
    isDuplicate: false,
    hasNameMatch: true,
    status: 'NAME_MATCH_PHONE_PENDING',
    existingStudent: firstMatch,
    allNameMatches: nameMatchingStudents,
    message: `Внимание: Ученик с ФИО «${firstMatch.fullName}» уже есть в базе данных (тел: ${firstMatch.phone || '—'}).`,
  };
};

