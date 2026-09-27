// Types for REDCAT CRM Application

export type Role = 'ADMIN' | 'TEACHER' | 'DIRECTOR';

export type StaffRole = 'ADMIN' | 'DIRECTOR' | 'STAFF' | 'OTHER_STAFF';

export type SalaryModelType = 'PERCENTAGE' | 'FIXED' | 'CONTRACTUAL';

export type AbsenceCategory = 'UNEXCUSED' | 'EXCUSED';

export type ExcusedReasonType = 
  | 'SICK'                  // Заболел
  | 'TRAVELED_TO_REGION'    // Уехал в район
  | 'EXAM'                  // Сдает экзамен
  | 'FAMILY_CIRCUMSTANCES'  // Семейные обстоятельства
  | 'OTHER';                // Другая причина

export type DiscountType = 'NONE' | 'FIXED_SUM' | 'PERCENTAGE';

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'DEBT' | 'RECALCULATED';

export type ParentType = 'STUDENT' | 'SECONDARY_PHONE' | 'FATHER' | 'MOTHER';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  phone?: string;
  teacherProfileId?: string;
  staffMemberId?: string;
}

export interface StaffMember {
  id: string;
  role: StaffRole;
  firstName?: string;
  lastName?: string;
  fullName: string;
  phone?: string;
  age?: number;
  birthDate?: string;
  position?: string; // Должность для STAFF: например "SMM-специалист", "Мобилограф", "Таргетолог", "Охранник", "Уборщица"
  monthlySalary?: number; // Ежемесячная зарплата (оклад в сумах)
  login?: string; // Для ADMIN и DIRECTOR
  password?: string; // Для ADMIN и DIRECTOR
  createdAt: string;
  isActive: boolean;
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
  category?: string;
  description?: string;
  color?: string;
  createdAt?: string;
}

export interface TeacherProfile {
  id: string;
  userId: string;
  fullName: string;
  phone?: string;
  subject: string;
  subjectId?: string;
  additionalSubjectIds?: string[];
  age: number;
  birthDate: string; // YYYY-MM-DD
  salaryModel: SalaryModelType;
  fixedRate?: number;     // сум/месяц или сум/урок
  percentageRate?: number;// % от фактически собранных средств
  contractNotes?: string; // Описание условий при Договорной ставке
  login: string;
  password?: string;
}

export interface Cabinet {
  id: string;
  roomNumber: string; // "Кабинет №101"
  name?: string;
  capacity: number;
}

export interface Course {
  id: string;
  title: string;       // "Математика ЕГЭ / ОГЭ"
  subject: string;     // "Математика"
  teacherId: string;
  cabinetId?: string;
  daysOfWeek: string[]; // ["ПН", "СР", "ПТ"]
  startTime: string;   // "15:00"
  endTime: string;     // "16:30"
  monthlyPrice: number;// Полная стоимость за 1 месяц (12 уроков)
  isActive: boolean;
}

export interface CourseFreezeInfo {
  freezeDate: string;
  freezeUntil?: string; // YYYY-MM-DD
  freezeReason?: string;
}

export interface Student {
  id: string;
  fullName: string;
  birthDate?: string;  // YYYY-MM-DD
  phone: string;
  secondaryPhone?: string; // Дополнительный номер телефона ученика
  schoolName?: string; // Название школы
  grade?: string;      // Класс обучения (например: 9-А класс)
  address?: string;    // Адрес проживания
  certificatesAndBenefits?: string; // Дополнительные льготы, сертификаты по предметам
  fatherName?: string;
  fatherPhone?: string;
  motherName?: string;
  motherPhone?: string;
  discountType: DiscountType;
  discountValue: number; // сум или %
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'FROZEN';
  freezeDate?: string;
  freezeUntil?: string; // Дата окончания заморозки (YYYY-MM-DD)
  freezeReason?: string;
  courseFreezes?: Record<string, CourseFreezeInfo>; // Независимая заморозка по отдельным группам (courseId -> freeze info)
  enrolledCourseIds: string[];
  createdByAdmin?: string; // Имя создавшего администратора
  lastModifiedBy?: string; // Имя изменившего администратора
  unenrollmentHistory?: CourseUnenrollment[]; // История исключений из курсов с причинами
}

export interface CourseUnenrollment {
  courseId: string;
  courseTitle?: string;
  dropDate: string; // YYYY-MM-DD
  dropReason: string; // Обязательная причина удаления из курса
  droppedBy?: string; // Имя администратора/пользователя
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  enrollmentDate: string; // YYYY-MM-DD
  firstMonthLessonsLeft: number; // Доступно/осталось уроков в 1-й месяц
  status: 'ACTIVE' | 'COMPLETED' | 'DROPPED';
  dropReason?: string;
  dropDate?: string;
  droppedBy?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  courseId: string;
  studentId: string;
  teacherId: string;
  status: 'PRESENT' | 'ABSENT';
  absenceCategory?: AbsenceCategory;
  excusedReason?: ExcusedReasonType;
  otherReasonText?: string;
  adminComment?: string;
  markedByName?: string; // Имя преподавателя или админа, отметившего посещаемость
  markedAt: string;
}

export type PaymentMethod = 'CASH' | 'CARD';

export interface Payment {
  id: string;
  studentId: string;
  courseId: string;
  monthPeriod: string; // "2026-08"
  isFirstMonth: boolean;
  remainingLessonsCount: number; // Кол-во уроков в первом месяце (default 12)
  baseCalculatedAmount: number;  // (Price / 12) * remainingLessonsCount
  discountApplied: number;       // Скидка UZS
  excusedCreditDeduction: number; // Вычет за уважительные пропуски прошлых уроков
  finalAmountDue: number;        // Окончательная сумма
  amountPaid: number;            // Фактически оплачено
  status: PaymentStatus;
  paymentMethod?: PaymentMethod; // Наличные или Перевод по карте
  paidAt?: string;
  recordedBy?: string;           // Имя администратора/директора, принявшего оплату
  updatedBy?: string;            // Имя администратора/директора, отредактировавшего оплату
  notes?: string;
  transferredFromCourseId?: string;    // ID курса, откуда была переведена оплата
  transferredFromCourseTitle?: string; // Название курса, откуда была переведена оплата
  paymentHistory?: Payment[];    // История отдельных частичных взносов за месяц
}

export interface TeacherPayroll {
  id: string;
  teacherId: string;
  monthPeriod: string;
  calculatedAmount: number;
  totalCollectedRef: number;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  paidAt?: string;
  breakdown: {
    model: SalaryModelType;
    details: string;
    courseBreakdown: { courseTitle: string; studentCount: number; collected: number; teacherCut: number }[];
  };
}

export type ExpenseCategory =
  | 'TEACHER_SALARY' // Зарплата преподавателя
  | 'RENT'           // Аренда помещения
  | 'UTILITIES'      // Коммунальные услуги (свет, вода, отопление)
  | 'SUPPLIES'       // Канцелярия и учебные материалы
  | 'MARKETING'      // Реклама и продвижение
  | 'TAXES'          // Налоги и сборы
  | 'MAINTENANCE'    // Ремонт и хоз. расходы
  | 'SOFTWARE'       // Интернет и ПО / Связь
  | 'OTHER';         // Прочие расходы

export interface Expense {
  id: string;
  title: string;                 // Наименование расхода (например: "Аренда за август", "Зарплата учителя Каримов С.")
  amount: number;                // Сумма в сумах
  monthPeriod: string;           // "2026-08" (за какой месяц)
  category: ExpenseCategory;     // Категория расхода
  paymentMethod: PaymentMethod;  // 'CASH' | 'CARD'
  expenseDate: string;           // YYYY-MM-DD
  teacherId?: string;            // ID учителя (при зарплате)
  notes?: string;                // Примечание
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userName: string;
  userRole: Role;
  actionType: string;
  targetEntity: string;
  details: string;
  createdAt: string;
}

export interface SmsLog {
  id: string;
  studentId: string;
  studentName: string;
  recipientPhone: string;
  parentType: ParentType;
  message: string;
  status: 'DELIVERED' | 'FAILED';
  sentAt: string;
}

export type LeadStatus = 'WAITING_GROUP' | 'NEW' | 'PARTIALLY_ENROLLED' | 'ENROLLED' | 'CANCELLED';

export interface SmsGatewayConfig {
  id: string;
  gatewayType: 'ANDROID_GATEWAY' | 'DIRECT_DEVICE' | 'ESKIZ_UZ';
  gatewayUrl: string;
  apiKey?: string;
  deviceId?: string;
  delaySeconds: number;
  centerPhone: string;
  updatedAt?: string;
}

export interface Lead {
  id: string;
  fullName: string;
  phone: string;
  secondaryPhone?: string;
  birthDate?: string;
  targetSubject?: string;        // Желаемый предмет (строка для обратной совместимости)
  targetSubjects?: string[];     // Список всех выбранных желаемых предметов (например: ["Математика", "Физика"])
  preferredSchedule?: string;    // Желаемые дни и время (например: ПН-СР-ПТ после 15:00)
  schoolName?: string;           // Название школы
  grade?: string;                // Класс обучения
  address?: string;              // Адрес проживания
  certificatesAndBenefits?: string; // Льготы, сертификаты
  fatherName?: string;
  fatherPhone?: string;
  motherName?: string;
  motherPhone?: string;
  discountType?: DiscountType;
  discountValue?: number;
  notes?: string;                // Примечания администратора к заявке
  status: LeadStatus;            // Статус: Ожидает группу / Частично зачислен / Зачислен / Отменен
  createdAt: string;             // Дата подачи заявки
  enrolledCourseId?: string;     // ID курса (обратная совместимость)
  enrolledCourseIds?: string[];  // Список ID курсов, куда уже зачислен ученик
  enrolledStudentId?: string;    // ID созданного ученика
}
