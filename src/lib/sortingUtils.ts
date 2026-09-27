import { Course, Cabinet, Student } from '../types';

/**
 * Extracts a numeric value from cabinet room number / name (e.g. "Кабинет № 1" -> 1, "Кабинет 102" -> 102, "2" -> 2).
 * Falls back to 999999 if no number found so non-numbered cabinets appear at the end.
 */
export function extractCabinetNumber(roomOrName?: string): number {
  if (!roomOrName) return 999999;
  const match = roomOrName.match(/\d+/);
  return match ? parseInt(match[0], 10) : 999999;
}

/**
 * Sorts cabinets by room number ascending (1, 2, 3, 4...).
 */
export function sortCabinets(cabinets: Cabinet[]): Cabinet[] {
  return [...cabinets].sort((a, b) => {
    const numA = extractCabinetNumber(a.roomNumber || a.name);
    const numB = extractCabinetNumber(b.roomNumber || b.name);
    if (numA !== numB) {
      return numA - numB;
    }
    const strA = a.roomNumber || a.name || '';
    const strB = b.roomNumber || b.name || '';
    return strA.localeCompare(strB, 'ru', { numeric: true });
  });
}

/**
 * Sorts courses primarily by Cabinet number (Cabinet 1, Cabinet 2, Cabinet 3...),
 * then by Start Time (e.g. 09:00, 14:00, 16:30), then by Title.
 */
export function sortCoursesByCabinet(courses: Course[], cabinets: Cabinet[] = []): Course[] {
  const cabinetMap = new Map<string, Cabinet>();
  cabinets.forEach((c) => cabinetMap.set(c.id, c));

  return [...courses].sort((a, b) => {
    const cabA = a.cabinetId ? cabinetMap.get(a.cabinetId) : undefined;
    const cabB = b.cabinetId ? cabinetMap.get(b.cabinetId) : undefined;

    const numA = cabA ? extractCabinetNumber(cabA.roomNumber || cabA.name) : 999999;
    const numB = cabB ? extractCabinetNumber(cabB.roomNumber || cabB.name) : 999999;

    if (numA !== numB) {
      return numA - numB;
    }

    // If same cabinet or both don't have cabinet numbers, compare cabinet string
    const strA = cabA?.roomNumber || cabA?.name || 'zzz';
    const strB = cabB?.roomNumber || cabB?.name || 'zzz';
    const cabComp = strA.localeCompare(strB, 'ru', { numeric: true });
    if (cabComp !== 0) return cabComp;

    // Next compare start time
    const timeA = a.startTime || '';
    const timeB = b.startTime || '';
    const timeComp = timeA.localeCompare(timeB);
    if (timeComp !== 0) return timeComp;

    // Finally compare title
    return (a.title || '').localeCompare(b.title || '', 'ru');
  });
}

/**
 * Sorts students alphabetically by Full Name.
 */
export function sortStudentsAlphabetically(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    return (a.fullName || '').localeCompare(b.fullName || '', 'ru', { sensitivity: 'base' });
  });
}
