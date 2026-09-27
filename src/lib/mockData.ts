// Mock Data for REDCAT CRM (Uzbekistan +998)
import {
  Subject,
  TeacherProfile,
  Cabinet,
  Course,
  Student,
  Enrollment,
  AttendanceRecord,
  Payment,
  AuditLog,
  User,
  Lead,
  Expense,
  StaffMember,
} from '../types';

export const INITIAL_SUBJECTS: Subject[] = [];

export const INITIAL_STAFF: StaffMember[] = [];

export const INITIAL_USERS: User[] = [
  {
    id: 'u-admin-1',
    username: 'admin',
    fullName: 'Ерболов Серик Арманович',
    role: 'ADMIN',
    phone: '+998 90 123 45 67',
  },
  {
    id: 'u-teach-1',
    username: 'm.almaty',
    fullName: 'Мукашев Ерлан Болатович',
    role: 'TEACHER',
    phone: '+998 91 234 56 78',
    teacherProfileId: 't-1',
  },
  {
    id: 'u-teach-2',
    username: 'a.english',
    fullName: 'Смайлова Алия Нурлановна',
    role: 'TEACHER',
    phone: '+998 93 345 67 89',
    teacherProfileId: 't-2',
  },
];

export const INITIAL_TEACHERS: TeacherProfile[] = [
  {
    id: 't-1',
    userId: 'u-teach-1',
    fullName: 'Мукашев Ерлан Болатович',
    subject: 'Высшая и Школьная Математика',
    subjectId: 'sub-math',
    age: 38,
    birthDate: '1988-08-09',
    salaryModel: 'PERCENTAGE',
    percentageRate: 45,
    login: 'm.almaty',
  },
  {
    id: 't-2',
    userId: 'u-teach-2',
    fullName: 'Смайлова Алия Нурлановна',
    subject: 'Английский Язык (IELTS / General)',
    subjectId: 'sub-eng',
    age: 29,
    birthDate: '1997-08-08',
    salaryModel: 'FIXED',
    fixedRate: 2800000, // сум
    login: 'a.english',
  },
];

export const INITIAL_CABINETS: Cabinet[] = [
  { id: 'cab-1', roomNumber: 'Кабинет № 1', name: 'Аудитория Математики', capacity: 20 },
  { id: 'cab-2', roomNumber: 'Кабинет № 2', name: 'Кабинет Права и Истории', capacity: 24 },
  { id: 'cab-3', roomNumber: 'Кабинет № 3', name: 'Аудитория Истории', capacity: 22 },
  { id: 'cab-4', roomNumber: 'Кабинет № 4', name: 'Лингафонный Кабинет', capacity: 18 },
  { id: 'cab-5', roomNumber: 'Кабинет № 5', name: 'Кабинет Русского Языка', capacity: 20 },
  { id: 'cab-6', roomNumber: 'Кабинет № 6', name: 'Кабинет Физики и Точных Наук', capacity: 16 },
];

export const INITIAL_COURSES: Course[] = [
  {
    id: 'c-1',
    title: 'Математика (Профильный уровень)',
    subject: 'Математика',
    teacherId: 't-1',
    cabinetId: 'cab-1',
    daysOfWeek: ['ПН', 'СР', 'ПТ'],
    startTime: '15:00',
    endTime: '16:30',
    monthlyPrice: 360000, // сум
    isActive: true,
  },
  {
    id: 'c-2',
    title: 'IELTS Academic Intensive',
    subject: 'Английский язык',
    teacherId: 't-2',
    cabinetId: 'cab-2',
    daysOfWeek: ['ВТ', 'ЧТ', 'СБ'],
    startTime: '16:30',
    endTime: '18:00',
    monthlyPrice: 420000, // сум
    isActive: true,
  },
];

export const INITIAL_STUDENTS: Student[] = [
  {
    id: 's-1',
    fullName: 'Аманжолов Санжар Нурланович',
    birthDate: '2008-04-12',
    phone: '+998 90 987 65 43',
    schoolName: 'Школа №12',
    grade: '10-А класс',
    address: 'г. Нукус, мкр. 22, д. 15',
    certificatesAndBenefits: 'IELTS 6.5, Сертификат B2 по математике',
    fatherName: 'Аманжолов Нурлан Серикович',
    fatherPhone: '+998 90 111 22 33',
    motherName: 'Аманжолова Гульнара Бериковна',
    motherPhone: '+998 91 222 33 44',
    discountType: 'NONE',
    discountValue: 0,
    status: 'ACTIVE',
    enrolledCourseIds: ['c-1'],
  },
];

export const INITIAL_ENROLLMENTS: Enrollment[] = [
  { id: 'en-1', studentId: 's-1', courseId: 'c-1', enrollmentDate: '2026-08-01', firstMonthLessonsLeft: 12, status: 'ACTIVE' },
];

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  {
    id: 'att-1',
    date: '2026-08-01',
    courseId: 'c-1',
    studentId: 's-1',
    teacherId: 't-1',
    status: 'PRESENT',
    markedAt: '2026-08-01T15:00:00',
  },
  {
    id: 'att-2',
    date: '2026-08-03',
    courseId: 'c-1',
    studentId: 's-1',
    teacherId: 't-1',
    status: 'PRESENT',
    markedAt: '2026-08-03T15:00:00',
  },
  {
    id: 'att-3',
    date: '2026-08-05',
    courseId: 'c-1',
    studentId: 's-1',
    teacherId: 't-1',
    status: 'ABSENT',
    absenceCategory: 'EXCUSED',
    excusedReason: 'SICK',
    adminComment: 'Мама позвонила, предупредила о простуде',
    markedAt: '2026-08-05T15:00:00',
  },
  {
    id: 'att-4',
    date: '2026-08-08',
    courseId: 'c-1',
    studentId: 's-1',
    teacherId: 't-1',
    status: 'PRESENT',
    markedAt: '2026-08-08T15:05:00',
  },
];

export const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'pay-1',
    studentId: 's-1',
    courseId: 'c-1',
    monthPeriod: '2026-08',
    isFirstMonth: false,
    remainingLessonsCount: 12,
    baseCalculatedAmount: 360000,
    discountApplied: 0,
    excusedCreditDeduction: 0,
    finalAmountDue: 360000,
    amountPaid: 360000,
    status: 'PAID',
    paymentMethod: 'CARD',
    paidAt: '2026-08-02',
    notes: 'Перевод по карте (Uzcard)',
  },
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    userName: 'Ерболов Серик (Администратор)',
    userRole: 'ADMIN',
    actionType: 'SYSTEM_INIT',
    targetEntity: 'System',
    details: 'Инициализация системы REDCAT CRM',
    createdAt: '2026-08-08T10:00:00',
  },
];

export const INITIAL_SMS_LOGS: any[] = [];

export const INITIAL_LEADS: Lead[] = [];

export const INITIAL_EXPENSES: Expense[] = [];
