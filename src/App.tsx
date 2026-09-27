/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Role,
  TeacherProfile,
  Course,
  Cabinet,
  Student,
  Enrollment,
  CourseUnenrollment,
  AttendanceRecord,
  Payment,
  AuditLog,
  SmsLog,
  User,
  PaymentMethod,
  Lead,
  LeadStatus,
  Expense,
  Subject,
  StaffMember,
  SmsGatewayConfig,
} from './types';
import {
  INITIAL_TEACHERS,
  INITIAL_COURSES,
  INITIAL_CABINETS,
  INITIAL_STUDENTS,
  INITIAL_ENROLLMENTS,
  INITIAL_ATTENDANCE,
  INITIAL_PAYMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SMS_LOGS,
  INITIAL_LEADS,
  INITIAL_EXPENSES,
  INITIAL_SUBJECTS,
  INITIAL_STAFF,
} from './lib/mockData';
import {
  subscribeCollection,
  saveToFirestore,
  deleteFromFirestore,
  saveBatchToFirestore,
  getOfflineCollection,
  subscribeQuotaExceeded,
} from './lib/firebase';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import {
  getUzbekistanToday,
  getUzbekistanCurrentMonthPeriod,
  getUzbekistanISOString,
  getUzbekistanLocaleString,
  isStudentFrozenInCourse,
  formatMonthPeriodLabel,
} from './lib/dateUtils';
import { calculateFirstMonthTuition } from './lib/billingLogic';
import { checkStudentDuplicate } from './lib/studentValidation';
import {
  sortCoursesByCabinet,
  sortStudentsAlphabetically,
  sortCabinets,
} from './lib/sortingUtils';

import { Navbar } from './components/Navbar';
import { AdminDashboard } from './components/AdminDashboard';
import { TeacherManagement } from './components/TeacherManagement';
import { CourseManagement } from './components/CourseManagement';
import { StudentRegistry } from './components/StudentRegistry';
import { FinanceModule } from './components/FinanceModule';
import { TeacherCabinet } from './components/TeacherCabinet';
import { AttendanceView } from './components/AttendanceView';
import { AiAnalyticsModule } from './components/AiAnalyticsModule';
import { SmsModule } from './components/SmsModule';
import { QuickPaymentModal } from './components/QuickPaymentModal';
import { LoginModal } from './components/LoginModal';
import { ClearDatabaseModal } from './components/ClearDatabaseModal';

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('mbs_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Active Role and Navigation
  const [currentRole, setCurrentRole] = useState<Role>(() => {
    const savedUser = localStorage.getItem('mbs_current_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.role === 'TEACHER') return 'TEACHER';
      } catch (e) {
        // ignore
      }
    }
    return 'ADMIN';
  });

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    const savedUser = localStorage.getItem('mbs_current_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.role === 'TEACHER' && parsed.teacherProfileId) {
          return parsed.teacherProfileId;
        }
      } catch (e) {
        // ignore
      }
    }
    return 't-1';
  });

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isQuickPaymentOpen, setIsQuickPaymentOpen] = useState<boolean>(false);
  const [preselectedStudentForPayment, setPreselectedStudentForPayment] = useState<Student | null>(null);

  // Day / Night Theme State (Soft, eye-friendly dark mode)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('mbs_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('mbs_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // App State with Firebase Firestore synchronization & offline backup
  const [teachers, setTeachers] = useState<TeacherProfile[]>(() => getOfflineCollection('teachers'));
  const [courses, setCourses] = useState<Course[]>(() => getOfflineCollection('courses'));
  const [cabinets, setCabinets] = useState<Cabinet[]>(() => getOfflineCollection('cabinets'));
  const [students, setStudents] = useState<Student[]>(() => getOfflineCollection('students'));
  const [enrollments, setEnrollments] = useState<Enrollment[]>(() => getOfflineCollection('enrollments'));
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => getOfflineCollection('attendance'));
  const [payments, setPayments] = useState<Payment[]>(() => getOfflineCollection('payments'));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => getOfflineCollection('auditLogs'));
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>(() => getOfflineCollection('smsLogs'));
  const [leads, setLeads] = useState<Lead[]>(() => getOfflineCollection('leads'));
  const [expenses, setExpenses] = useState<Expense[]>(() => getOfflineCollection('expenses'));
  const [subjects, setSubjects] = useState<Subject[]>(() => getOfflineCollection('subjects'));
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(() => getOfflineCollection('staff'));

  // Firestore Quota status tracking
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(false);
  const [isQuotaBannerDismissed, setIsQuotaBannerDismissed] = useState<boolean>(false);

  useEffect(() => {
    return subscribeQuotaExceeded((exceeded) => {
      setIsQuotaExceeded(exceeded);
    });
  }, []);

  // Persistent SMS Gateway Settings (Synced with Firestore & localStorage)
  const [smsGatewayConfig, setSmsGatewayConfig] = useState<SmsGatewayConfig>(() => {
    try {
      const saved = localStorage.getItem('mbs_sms_gateway_config_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.centerPhone || parsed.centerPhone.includes('391 61 61')) {
          parsed.centerPhone = '+998 90 420 02 57';
        }
        return parsed;
      }
    } catch {}
    return {
      id: 'sms_gateway',
      gatewayType: 'ANDROID_GATEWAY',
      gatewayUrl: 'http://192.168.1.100:8080/send',
      apiKey: '',
      deviceId: '',
      delaySeconds: 1.5,
      centerPhone: '+998 90 420 02 57',
    };
  });

  // Automatically sorted lists ensuring:
  // 1. Students are always in alphabetical order (even new students)
  // 2. Courses are always sorted by cabinet (Cabinet 1, Cabinet 2, etc.) and time
  // 3. Cabinets are ordered by room number (1, 2, 3...)
  const sortedCourses = React.useMemo(() => {
    const courseMap = new Map<string, Course>();
    courses.forEach((c) => {
      if (c && c.id) courseMap.set(c.id, c);
    });
    const cabinetMap = new Map<string, Cabinet>();
    cabinets.forEach((cb) => {
      if (cb && cb.id) cabinetMap.set(cb.id, cb);
    });
    return sortCoursesByCabinet(Array.from(courseMap.values()), Array.from(cabinetMap.values()));
  }, [courses, cabinets]);

  const sortedStudents = React.useMemo(() => {
    const studentMap = new Map<string, Student>();
    students.forEach((s) => {
      if (s && s.id) studentMap.set(s.id, s);
    });
    return sortStudentsAlphabetically(Array.from(studentMap.values()));
  }, [students]);

  const sortedCabinets = React.useMemo(() => {
    const cabinetMap = new Map<string, Cabinet>();
    cabinets.forEach((cb) => {
      if (cb && cb.id) cabinetMap.set(cb.id, cb);
    });
    return sortCabinets(Array.from(cabinetMap.values()));
  }, [cabinets]);

  // Real-time Firestore Listeners across devices with performance limits and deduplication
  useEffect(() => {
    const unsubTeachers = subscribeCollection('teachers', (loaded: TeacherProfile[]) => {
      const unique = Array.from(new Map((loaded || []).filter((t) => t && t.id).map((t) => [t.id, t])).values());
      setTeachers(unique);
    });
    const unsubCourses = subscribeCollection('courses', (loaded: Course[]) => {
      const unique = Array.from(new Map((loaded || []).filter((c) => c && c.id).map((c) => [c.id, c])).values());
      setCourses(unique);
    });
    const unsubCabinets = subscribeCollection('cabinets', (loaded: Cabinet[]) => {
      const unique = Array.from(new Map((loaded || []).filter((cb) => cb && cb.id).map((cb) => [cb.id, cb])).values());
      setCabinets(unique);
    });
    const unsubStudents = subscribeCollection('students', (loaded: Student[]) => {
      const unique = Array.from(new Map((loaded || []).filter((s) => s && s.id).map((s) => [s.id, s])).values());
      const sanitized = unique.map((s) => {
        const cleanCourseIds = Array.from(new Set((s.enrolledCourseIds || []).filter(Boolean)));
        return {
          ...s,
          enrolledCourseIds: cleanCourseIds,
        };
      });
      setStudents(sanitized);
    });
    const unsubEnrollments = subscribeCollection('enrollments', (loaded: Enrollment[]) => {
      const unique = Array.from(new Map((loaded || []).filter((e) => e && e.id).map((e) => [e.id, e])).values());
      setEnrollments(unique);
    });
    const unsubAttendance = subscribeCollection('attendance', setAttendanceRecords);
    const unsubPayments = subscribeCollection('payments', (loadedPayments: Payment[]) => {
      // Deduplicate strictly by document ID so all separate payment transactions are preserved
      const uniqueById = Array.from(
        new Map((loadedPayments || []).filter((p) => p && p.id).map((p) => [p.id, p])).values()
      );
      setPayments(uniqueById);
    });
    const unsubAudit = subscribeCollection('auditLogs', setAuditLogs, 200);
    const unsubSms = subscribeCollection('smsLogs', setSmsLogs, 300);
    const unsubExpenses = subscribeCollection('expenses', setExpenses, 1000);
    const unsubStaff = subscribeCollection('staff', setStaffMembers);
    const unsubSubjects = subscribeCollection('subjects', (loadedSubjects: Subject[]) => {
      const cleanSubjects = (loadedSubjects || []).filter(
        (s) => !s.id.startsWith('sub-') || s.createdAt !== '2026-01-01'
      );
      const unique = Array.from(new Map(cleanSubjects.filter((s) => s && s.id).map((s) => [s.id, s])).values());
      setSubjects(unique);
    });
    const unsubLeads = subscribeCollection('leads', (loadedLeads: Lead[]) => {
      const cleanLeads = (loadedLeads || []).filter(
        (l) => l.id !== 'lead-1' && l.id !== 'lead-2'
      );
      const unique = Array.from(new Map(cleanLeads.filter((l) => l && l.id).map((l) => [l.id, l])).values());
      const sanitized = unique.map((l) => {
        const cleanCourseIds = Array.from(new Set((l.enrolledCourseIds || []).filter(Boolean)));
        return {
          ...l,
          enrolledCourseIds: cleanCourseIds,
        };
      });
      setLeads(sanitized);
    });

    const unsubSettings = subscribeCollection('settings', (loadedSettings: any[]) => {
      const gw = loadedSettings?.find((s) => s.id === 'sms_gateway');
      if (gw) {
        const updatedGw = {
          ...gw,
          centerPhone: (!gw.centerPhone || gw.centerPhone.includes('391 61 61')) ? '+998 90 420 02 57' : gw.centerPhone,
        };
        setSmsGatewayConfig(updatedGw);
        try {
          localStorage.setItem('mbs_sms_gateway_config_v1', JSON.stringify(updatedGw));
        } catch {}
      }
    });

    return () => {
      unsubTeachers();
      unsubCourses();
      unsubCabinets();
      unsubStudents();
      unsubEnrollments();
      unsubAttendance();
      unsubPayments();
      unsubAudit();
      unsubSms();
      unsubExpenses();
      unsubStaff();
      unsubSubjects();
      unsubLeads();
      unsubSettings();
    };
  }, []);

  const handleUpdateSmsGatewayConfig = async (newConfig: Partial<SmsGatewayConfig>) => {
    const updated: SmsGatewayConfig = {
      ...smsGatewayConfig,
      ...newConfig,
      id: 'sms_gateway',
      updatedAt: getUzbekistanISOString(),
    };
    setSmsGatewayConfig(updated);
    try {
      localStorage.setItem('mbs_sms_gateway_config_v1', JSON.stringify(updated));
    } catch {}
    try {
      await saveToFirestore('settings', updated);
    } catch (err) {
      console.error('Failed to save SMS gateway config to Firestore:', err);
    }
  };

  // Auto unfreeze expired students & expired course freezes
  useEffect(() => {
    if (students.length === 0) return;
    const today = getUzbekistanToday();

    students.forEach((st) => {
      let needsUpdate = false;
      const updatedCourseFreezes = { ...(st.courseFreezes || {}) };

      // Check per-course freeze expiration
      if (st.courseFreezes && Object.keys(st.courseFreezes).length > 0) {
        const expiredCourseNames: string[] = [];
        Object.entries(st.courseFreezes).forEach(([cId, freezeData]) => {
          const cf = freezeData as { freezeDate: string; freezeUntil?: string; freezeReason?: string };
          if (cf.freezeUntil && cf.freezeUntil < today) {
            delete updatedCourseFreezes[cId];
            needsUpdate = true;
            const cTitle = courses.find((c) => c.id === cId)?.title || cId;
            expiredCourseNames.push(cTitle);
          }
        });

        if (needsUpdate) {
          const enrolled = st.enrolledCourseIds || [];
          const frozenCount = enrolled.filter((cId) => !!updatedCourseFreezes[cId]).length;
          const activeCount = enrolled.filter((cId) => !updatedCourseFreezes[cId]).length;
          const newStatus = (enrolled.length > 0 && frozenCount > 0 && activeCount === 0) ? 'FROZEN' : 'ACTIVE';

          const remaining = Object.values(updatedCourseFreezes) as { freezeDate: string; freezeUntil?: string; freezeReason?: string }[];
          const rep = remaining[0];
          const updatedStudent: Student = {
            ...st,
            status: newStatus,
            courseFreezes: updatedCourseFreezes,
            freezeDate: remaining.length > 0 ? rep?.freezeDate : undefined,
            freezeUntil: remaining.length > 0 ? rep?.freezeUntil : undefined,
            freezeReason: remaining.length > 0 ? rep?.freezeReason : undefined,
          };
          saveToFirestore('students', updatedStudent);
          setStudents((prev) => prev.map((s) => (s.id === st.id ? updatedStudent : s)));
          logAction(
            'Система',
            'ADMIN',
            'STUDENT_AUTO_UNFREEZE',
            `Автоматически разморожен ученик ${st.fullName} в группах: ${expiredCourseNames.join(', ')} (срок заморозки истек)`
          );
        }
      } else if (st.status === 'FROZEN' && st.freezeUntil && st.freezeUntil < today) {
        // Legacy global freeze auto-unfreeze
        const unfreezeStudent: Student = {
          ...st,
          status: 'ACTIVE',
          courseFreezes: {},
          freezeDate: undefined,
          freezeUntil: undefined,
          freezeReason: undefined,
        };
        saveToFirestore('students', unfreezeStudent);
        setStudents((prev) => prev.map((s) => (s.id === st.id ? unfreezeStudent : s)));
        logAction(
          'Система',
          'ADMIN',
          'STUDENT_AUTO_UNFREEZE',
          `Автоматически разморожен ученик ${st.fullName} (срок заморозки до ${st.freezeUntil} истек)`
        );
      }
    });
  }, [students, courses]);

  // Auto-synchronize and verify students in groups vs general student database (`students`).
  // Guarantees that any student enrolled in a group (from leads, active enrollments, or attendance/payments)
  // Auto-synchronize and verify students, leads, and enrollments.
  // 1. Fully enrolled leads (or leads already added to general student database) are permanently removed from leads database.
  // 2. Students' `enrolledCourseIds` is the sole source of truth for course membership.
  // 3. Reconcile active enrollments so dropped students match reality.
  useEffect(() => {
    if (!leads) return;

    let hasStudentChanges = false;
    let currentStudents = [...students];
    const leadsToDelete: string[] = [];

    // 1. Clean up Enrolled Leads:
    // Only leads that have already been explicitly marked ENROLLED are removed from the active leads database.
    // Active leads waiting for groups (WAITING_GROUP, NEW, PARTIALLY_ENROLLED) are NEVER deleted.
    leads.forEach((lead) => {
      if (lead.status === 'ENROLLED') {
        leadsToDelete.push(lead.id);
      }
    });

    if (hasStudentChanges) {
      setStudents(currentStudents);
    }

    if (leadsToDelete.length > 0) {
      leadsToDelete.forEach((id) => deleteFromFirestore('leads', id));
      setLeads((prev) => prev.filter((l) => !leadsToDelete.includes(l.id)));
    }

    // 2. Check Enrollments: Reconcile active enrollments with student membership
    const enrollmentsToUpdate: Enrollment[] = [];
    const enrollmentsToDelete: string[] = [];

    if (enrollments && enrollments.length > 0) {
      enrollments.forEach((e) => {
        if (e.status !== 'ACTIVE') return;

        const st = currentStudents.find((s) => s.id === e.studentId);
        if (st) {
          // If the student does NOT have this course in their enrolledCourseIds:
          // The student has been dropped/unenrolled from this course.
          // Mark this active enrollment as DROPPED so it matches reality.
          if (!st.enrolledCourseIds || !st.enrolledCourseIds.includes(e.courseId)) {
            const dropReason = (st.unenrollmentHistory || []).slice().reverse().find((u) => u.courseId === e.courseId)?.dropReason || 'Исключен из группы';
            const dropDate = (st.unenrollmentHistory || []).slice().reverse().find((u) => u.courseId === e.courseId)?.dropDate || getUzbekistanToday();
            enrollmentsToUpdate.push({
              ...e,
              status: 'DROPPED',
              dropReason,
              dropDate,
            });
          }
        } else {
          // Student was completely removed from the database. Clean up orphaned enrollment.
          enrollmentsToDelete.push(e.id);
        }
      });
    }

    if (enrollmentsToUpdate.length > 0) {
      enrollmentsToUpdate.forEach((e) => saveToFirestore('enrollments', e));
      setEnrollments((prev) =>
        prev.map((e) => {
          const match = enrollmentsToUpdate.find((u) => u.id === e.id);
          return match ? { ...e, ...match } : e;
        })
      );
    }

    if (enrollmentsToDelete.length > 0) {
      enrollmentsToDelete.forEach((id) => deleteFromFirestore('enrollments', id));
      setEnrollments((prev) => prev.filter((e) => !enrollmentsToDelete.includes(e.id)));
    }
  }, [leads, enrollments, students]);

  // Auto-migration & reconciliation for transferred students and phantom debts:
  // 1. Removes all empty/phantom debt records (amountPaid === 0) for groups students no longer attend.
  // 2. Transfers existing paid amounts (amountPaid > 0) to active groups if student was transferred, with note "Оплата переведена из группы «...»".
  const hasRunPaymentMigration = React.useRef(false);

  useEffect(() => {
    if (!students || students.length === 0 || !payments || payments.length === 0 || !courses || courses.length === 0) {
      return;
    }
    if (hasRunPaymentMigration.current) return;

    const paymentsToDelete: string[] = [];
    const paymentsToUpdate: Payment[] = [];

    payments.forEach((p) => {
      const st = students.find((s) => s.id === p.studentId);
      if (!st) return;

      const isEnrolledInCourse = st.enrolledCourseIds && st.enrolledCourseIds.includes(p.courseId);
      const historyPaid = (p.paymentHistory || []).reduce((sum, h) => sum + (h.amountPaid || 0), 0);
      const totalPaid = (p.amountPaid || 0) + historyPaid;

      // If student is NOT enrolled in this course:
      if (!isEnrolledInCourse) {
        if (totalPaid === 0) {
          // Phantom debt for group where student no longer studies: delete!
          paymentsToDelete.push(p.id);
        } else if (st.enrolledCourseIds && st.enrolledCourseIds.length > 0) {
          // Real payment made for an old group: find target active course
          const oldCourse = courses.find((c) => c.id === p.courseId);
          const oldCourseTitle = oldCourse?.title || 'Прежняя группа';

          // Check if unenrollment history specifies where they were transferred to
          const transferRecord = (st.unenrollmentHistory || [])
            .slice()
            .reverse()
            .find((u) => u.courseId === p.courseId && u.dropReason?.includes('Переведен в группу'));

          let targetCourseId = st.enrolledCourseIds[0];
          if (transferRecord && transferRecord.dropReason) {
            const matchGroup = courses.find(
              (c) => transferRecord.dropReason!.includes(c.title) && st.enrolledCourseIds.includes(c.id)
            );
            if (matchGroup) targetCourseId = matchGroup.id;
          }

          const transferNote = `Оплата переведена из группы «${oldCourseTitle}»`;
          const existingNotes = (p.notes || '').trim();
          const newNotes = existingNotes
            ? existingNotes.includes('Оплата переведена из группы')
              ? existingNotes
              : `${existingNotes} | ${transferNote}`
            : transferNote;

          paymentsToUpdate.push({
            ...p,
            courseId: targetCourseId,
            transferredFromCourseId: p.courseId,
            transferredFromCourseTitle: oldCourseTitle,
            notes: newNotes,
            paymentHistory: (p.paymentHistory || []).map((h) => ({
              ...h,
              courseId: targetCourseId,
              transferredFromCourseId: p.courseId,
              transferredFromCourseTitle: oldCourseTitle,
              notes: h.notes
                ? h.notes.includes('Оплата переведена из группы')
                  ? h.notes
                  : `${h.notes} | ${transferNote}`
                : transferNote,
            })),
          });
        }
      }
    });

    if (paymentsToDelete.length > 0 || paymentsToUpdate.length > 0) {
      hasRunPaymentMigration.current = true;
      paymentsToDelete.forEach((id) => deleteFromFirestore('payments', id));
      paymentsToUpdate.forEach((p) => saveToFirestore('payments', p));
      setPayments((prev) => {
        const withoutDeleted = prev.filter((p) => !paymentsToDelete.includes(p.id));
        return withoutDeleted.map((p) => {
          const matched = paymentsToUpdate.find((up) => up.id === p.id);
          return matched || p;
        });
      });
    }
  }, [students, payments, courses]);

  // Clear database password protected modal state
  const [isClearDbModalOpen, setIsClearDbModalOpen] = useState(false);

  // Clear all data handler from cloud database (after password verification)
  const handleClearData = async () => {
    teachers.forEach((t) => deleteFromFirestore('teachers', t.id));
    courses.forEach((c) => deleteFromFirestore('courses', c.id));
    cabinets.forEach((c) => deleteFromFirestore('cabinets', c.id));
    students.forEach((s) => deleteFromFirestore('students', s.id));
    enrollments.forEach((e) => deleteFromFirestore('enrollments', e.id));
    attendanceRecords.forEach((a) => deleteFromFirestore('attendance', a.id));
    payments.forEach((p) => deleteFromFirestore('payments', p.id));
    auditLogs.forEach((l) => deleteFromFirestore('auditLogs', l.id));
    smsLogs.forEach((s) => deleteFromFirestore('smsLogs', s.id));
    expenses.forEach((e) => deleteFromFirestore('expenses', e.id));
    subjects.forEach((s) => deleteFromFirestore('subjects', s.id));
    staffMembers.forEach((s) => deleteFromFirestore('staff', s.id));
    leads.forEach((l) => deleteFromFirestore('leads', l.id));
    deleteFromFirestore('leads', 'lead-1');
    deleteFromFirestore('leads', 'lead-2');

    setStudents([]);
    setTeachers([]);
    setCourses([]);
    setCabinets([]);
    setEnrollments([]);
    setPayments([]);
    setAttendanceRecords([]);
    setAuditLogs([]);
    setSmsLogs([]);
    setExpenses([]);
    setSubjects([]);
    setStaffMembers([]);
    setLeads([]);
    localStorage.clear();
    alert('Облачная база данных Firestore успешно очищена!');
  };

  // Sync session user
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('mbs_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('mbs_current_user');
    }
  }, [currentUser]);

  // Strict role and teacher profile enforcement for Teacher users
  useEffect(() => {
    if (currentUser?.role === 'TEACHER') {
      setCurrentRole('TEACHER');
      if (currentUser.teacherProfileId) {
        setSelectedTeacherId(currentUser.teacherProfileId);
      }
    }
  }, [currentUser, currentRole, selectedTeacherId]);

  // Helper to get active user display name for logging and auditing
  const getActorName = (overrideName?: string): string => {
    if (overrideName && overrideName !== 'Администратор') return overrideName;
    if (currentUser?.fullName) return currentUser.fullName;
    if (currentRole === 'DIRECTOR') return 'Директор';
    if (currentRole === 'TEACHER') return 'Преподаватель';
    return 'Главный Администратор';
  };

  const getActorRole = (overrideRole?: Role): Role => {
    if (overrideRole) return overrideRole;
    if (currentUser?.role) return currentUser.role;
    return currentRole;
  };

  // Handle Login & Logout
  const handleLoginSuccess = (user: User, role?: Role) => {
    const effectiveRole = role || user.role;
    setCurrentUser(user);
    setCurrentRole(effectiveRole);
    if (effectiveRole === 'TEACHER' && user.teacherProfileId) {
      setSelectedTeacherId(user.teacherProfileId);
      setActiveTab('teacher-rollcall');
    } else {
      setActiveTab('overview');
    }
    logAction(user.fullName, effectiveRole, 'USER_LOGIN', `Пользователь вошел в систему`);
  };

  const handleLogout = () => {
    if (currentUser) {
      logAction(currentUser.fullName, currentUser.role, 'USER_LOGOUT', `Пользователь вышел из системы`);
    }
    setCurrentUser(null);
  };

  // Helper for adding Audit Log with automatic authorship
  const logAction = (
    userName?: string,
    userRole?: Role,
    actionType: string = 'ACTION',
    details: string = ''
  ) => {
    const authorName = getActorName(userName);
    const authorRole = getActorRole(userRole);
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userName: authorName,
      userRole: authorRole,
      actionType,
      targetEntity: 'System',
      details,
      createdAt: getUzbekistanLocaleString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    saveToFirestore('auditLogs', newLog);
  };

  // Handlers for Staff (Администраторы, Директора, Прочий персонал)
  const handleAddStaffMember = (newStaff: StaffMember) => {
    setStaffMembers((prev) => [...prev, newStaff]);
    saveToFirestore('staff', newStaff);
    const roleTitle =
      newStaff.role === 'ADMIN'
        ? 'Администратор'
        : newStaff.role === 'DIRECTOR'
        ? 'Директор'
        : `Сотрудник (${newStaff.position || 'Персонал'})`;
    logAction(
      getActorName(),
      getActorRole(),
      'STAFF_CREATE',
      `Добавлен сотрудник: ${newStaff.fullName} [${roleTitle}]`
    );
  };

  const handleUpdateStaffMember = (updatedStaff: StaffMember) => {
    setStaffMembers((prev) =>
      prev.map((s) => (s.id === updatedStaff.id ? updatedStaff : s))
    );
    saveToFirestore('staff', updatedStaff);
    logAction(
      getActorName(),
      getActorRole(),
      'STAFF_UPDATE',
      `Обновлен профиль сотрудника: ${updatedStaff.fullName}`
    );
  };

  const handleDeleteStaffMember = (staffId: string) => {
    const staff = staffMembers.find((s) => s.id === staffId);
    setStaffMembers((prev) => prev.filter((s) => s.id !== staffId));
    deleteFromFirestore('staff', staffId);
    logAction(
      getActorName(),
      getActorRole(),
      'STAFF_DELETE',
      `Удален сотрудник: ${staff?.fullName || staffId}`
    );
  };

  // Handlers for Teachers
  const handleAddTeacher = (newTeacher: TeacherProfile) => {
    setTeachers((prev) => [...prev, newTeacher]);
    setSelectedTeacherId(newTeacher.id);
    saveToFirestore('teachers', newTeacher);
    logAction(getActorName(), getActorRole(), 'TEACHER_CREATE', `Создан учитель ${newTeacher.fullName} (Предмет: ${newTeacher.subject})`);
  };

  const handleUpdateTeacher = (updatedTeacher: TeacherProfile) => {
    setTeachers((prev) => prev.map((t) => (t.id === updatedTeacher.id ? updatedTeacher : t)));
    saveToFirestore('teachers', updatedTeacher);
    logAction(getActorName(), getActorRole(), 'TEACHER_UPDATE', `Обновлен учитель ${updatedTeacher.fullName}`);
  };

  const handleDeleteTeacher = (teacherId: string) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    setTeachers((prev) => prev.filter((t) => t.id !== teacherId));
    deleteFromFirestore('teachers', teacherId);
    logAction(getActorName(), getActorRole(), 'TEACHER_DELETE', `Удален учитель ${teacher?.fullName || teacherId}`);
  };

  // Handlers for Subjects (База предметов)
  const handleAddSubject = (newSubject: Subject) => {
    setSubjects((prev) => [...prev, newSubject]);
    saveToFirestore('subjects', newSubject);
    logAction(getActorName(), getActorRole(), 'SUBJECT_CREATE', `Внесен предмет в базу: ${newSubject.name} (${newSubject.category || 'Общий'})`);
  };

  const handleUpdateSubject = (updatedSubject: Subject) => {
    setSubjects((prev) => prev.map((s) => (s.id === updatedSubject.id ? updatedSubject : s)));
    saveToFirestore('subjects', updatedSubject);
    logAction(getActorName(), getActorRole(), 'SUBJECT_UPDATE', `Обновлен предмет в базе: ${updatedSubject.name}`);
  };

  const handleDeleteSubject = (subjectId: string) => {
    const targetSubject = subjects.find((s) => s.id === subjectId);
    setSubjects((prev) => prev.filter((s) => s.id !== subjectId));
    deleteFromFirestore('subjects', subjectId);
    logAction(getActorName(), getActorRole(), 'SUBJECT_DELETE', `Удален предмет из базы: ${targetSubject?.name || subjectId}`);
  };

  const handleClearSubjects = () => {
    const inputPass = prompt('Для подтверждения очистки базы предметов введите пароль безопасности главного администратора:');
    if (inputPass !== '123456789') {
      if (inputPass !== null) alert('Неверный пароль безопасности! Очистка отменена.');
      return;
    }
    subjects.forEach((s) => deleteFromFirestore('subjects', s.id));
    setSubjects([]);
    logAction(getActorName(), getActorRole(), 'SUBJECT_CLEAR', 'База предметов была очищена');
    alert('База предметов успешно очищена.');
  };

  // Handlers for Courses
  const handleAddCourse = (newCourse: Course) => {
    setCourses((prev) => [...prev.filter((c) => c.id !== newCourse.id), newCourse]);
    if (newCourse.teacherId) {
      setSelectedTeacherId(newCourse.teacherId);
    }
    saveToFirestore('courses', newCourse);
    logAction(getActorName(), getActorRole(), 'COURSE_CREATE', `Создан курс ${newCourse.title}`);
  };

  const handleUpdateCourse = (updatedCourse: Course) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c))
    );
    saveToFirestore('courses', updatedCourse);
    logAction(getActorName(), getActorRole(), 'COURSE_UPDATE', `Обновлены параметры курса ${updatedCourse.title}`);
  };

  const handleDeleteCourse = (courseId: string) => {
    const courseToDelete = courses.find((c) => c.id === courseId);
    setCourses((prev) => prev.filter((c) => c.id !== courseId));
    deleteFromFirestore('courses', courseId);
    logAction(getActorName(), getActorRole(), 'COURSE_DELETE', `Удален курс ${courseToDelete?.title || courseId}`);
  };

  const handleAddCabinet = (newCabinet: Cabinet) => {
    setCabinets((prev) => [...prev.filter((cb) => cb.id !== newCabinet.id), newCabinet]);
    saveToFirestore('cabinets', newCabinet);
    logAction(getActorName(), getActorRole(), 'CABINET_CREATE', `Создан кабинет ${newCabinet.roomNumber}`);
  };

  const handleUpdateCabinet = (updatedCabinet: Cabinet) => {
    setCabinets((prev) => prev.map((c) => (c.id === updatedCabinet.id ? updatedCabinet : c)));
    saveToFirestore('cabinets', updatedCabinet);
    logAction(getActorName(), getActorRole(), 'CABINET_UPDATE', `Обновлен кабинет ${updatedCabinet.roomNumber}`);
  };

  const handleDeleteCabinet = (cabinetId: string) => {
    const cab = cabinets.find((c) => c.id === cabinetId);
    setCabinets((prev) => prev.filter((c) => c.id !== cabinetId));
    deleteFromFirestore('cabinets', cabinetId);
    // Unassign courses from deleted cabinet
    setCourses((prev) =>
      prev.map((c) => (c.cabinetId === cabinetId ? { ...c, cabinetId: '' } : c))
    );
    logAction(getActorName(), getActorRole(), 'CABINET_DELETE', `Удален кабинет ${cab?.roomNumber || cabinetId}`);
  };

  // Handlers for Leads (Предзаписи / Лиды / Заказы)
  const handleAddLead = (newLead: Lead) => {
    setLeads((prev) => [newLead, ...prev.filter((l) => l.id !== newLead.id)]);
    saveToFirestore('leads', newLead);
    logAction(getActorName(), getActorRole(), 'LEAD_CREATE', `Добавлен новый лид/предзапись ${newLead.fullName} (${newLead.targetSubject})`);
  };

  const handleUpdateLead = (updatedLead: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
    saveToFirestore('leads', updatedLead);
    logAction(getActorName(), getActorRole(), 'LEAD_UPDATE', `Обновлен лид ${updatedLead.fullName}`);
  };

  const handleDeleteLead = (leadId: string) => {
    const targetLead = leads.find((l) => l.id === leadId);
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    deleteFromFirestore('leads', leadId);
    logAction(getActorName(), getActorRole(), 'LEAD_DELETE', `Удален лид ${targetLead?.fullName || leadId}`);
  };

  const handleClearLeads = () => {
    leads.forEach((l) => deleteFromFirestore('leads', l.id));
    deleteFromFirestore('leads', 'lead-1');
    deleteFromFirestore('leads', 'lead-2');
    setLeads([]);
    logAction(getActorName(), getActorRole(), 'LEAD_DELETE', 'Очищена база предзаписей (лидов)');
  };

  const handleConvertLeadToStudent = (
    lead: Lead,
    courseIdOrItems: string | { courseId: string; remainingLessonsCount: number }[],
    singleRemainingLessonsCount: number = 12
  ) => {
    const itemsToEnroll: { courseId: string; remainingLessonsCount: number }[] =
      typeof courseIdOrItems === 'string'
        ? [{ courseId: courseIdOrItems, remainingLessonsCount: singleRemainingLessonsCount }]
        : courseIdOrItems;

    if (!itemsToEnroll || itemsToEnroll.length === 0) {
      alert('Не выбрано ни одного курса для зачисления!');
      return;
    }

    const courseIds = itemsToEnroll.map((item) => item.courseId);
    const validCourses = courses.filter((c) => courseIds.includes(c.id));

    if (validCourses.length === 0) {
      alert('Выбранные курсы не найдены в базе!');
      return;
    }

    // 1. Check duplicate student or get existing student
    const studentById = lead.enrolledStudentId ? students.find((s) => s.id === lead.enrolledStudentId) : null;
    const dupCheck = checkStudentDuplicate(students, lead.fullName, lead.phone || '');
    const matchedExistingStudent = studentById || (dupCheck.isDuplicate ? dupCheck.existingStudent : null);
    const isExistingStudent = !!matchedExistingStudent;
    const studentIdToUse = isExistingStudent
      ? matchedExistingStudent.id
      : (lead.enrolledStudentId || `st-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);

    const existingEnrolled = isExistingStudent ? (matchedExistingStudent.enrolledCourseIds || []) : [];
    const mergedCourseIds = Array.from(new Set([...existingEnrolled, ...courseIds]));

    const studentToSave: Student = isExistingStudent
      ? {
          ...matchedExistingStudent,
          enrolledCourseIds: mergedCourseIds,
          status: 'ACTIVE',
        }
      : {
          id: studentIdToUse,
          fullName: lead.fullName,
          birthDate: lead.birthDate || '',
          phone: lead.phone,
          secondaryPhone: lead.secondaryPhone || undefined,
          schoolName: lead.schoolName || undefined,
          grade: lead.grade || undefined,
          address: lead.address || undefined,
          certificatesAndBenefits: lead.certificatesAndBenefits || undefined,
          fatherName: (lead.fatherName && !lead.fatherName.toLowerCase().includes('иванов') && lead.fatherName.toLowerCase() !== 'не указано') ? lead.fatherName : undefined,
          fatherPhone: (lead.fatherPhone && lead.fatherPhone.replace(/\D/g, '').length >= 9) ? lead.fatherPhone : undefined,
          motherName: (lead.motherName && !lead.motherName.toLowerCase().includes('иванова') && lead.motherName.toLowerCase() !== 'не указано') ? lead.motherName : undefined,
          motherPhone: (lead.motherPhone && lead.motherPhone.replace(/\D/g, '').length >= 9) ? lead.motherPhone : undefined,
          discountType: lead.discountType || 'NONE',
          discountValue: lead.discountValue || 0,
          enrolledCourseIds: mergedCourseIds,
          status: 'ACTIVE',
        };

    // 2. Create enrollments & calculate first month tuition for each course
    const enrollmentDate = getUzbekistanToday();
    const startDayOfMonth = parseInt(enrollmentDate.split('-')[2], 10) || 1;

    const newEnrollments: Enrollment[] = [];
    const newPayments: Payment[] = [];

    itemsToEnroll.forEach((item) => {
      const targetCourse = courses.find((c) => c.id === item.courseId);
      if (!targetCourse) return;

      const remainingLessons = item.remainingLessonsCount || 12;
      const newEnrollment: Enrollment = {
        id: `enr-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        studentId: studentIdToUse,
        courseId: item.courseId,
        enrollmentDate: enrollmentDate,
        firstMonthLessonsLeft: remainingLessons,
        status: 'ACTIVE',
      };
      newEnrollments.push(newEnrollment);

      const firstMonthCalculation = calculateFirstMonthTuition(
        targetCourse.monthlyPrice,
        remainingLessons,
        12,
        lead.discountType || 'NONE',
        lead.discountValue || 0,
        startDayOfMonth
      );

      const isFullMonth = firstMonthCalculation.isFullMonth;

      const firstMonthPayment: Payment = {
        id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        studentId: studentIdToUse,
        courseId: item.courseId,
        monthPeriod: enrollmentDate.substring(0, 7), // YYYY-MM
        isFirstMonth: true,
        remainingLessonsCount: isFullMonth ? 12 : remainingLessons,
        baseCalculatedAmount: firstMonthCalculation.proportionalPrice,
        discountApplied: firstMonthCalculation.discountAmount,
        excusedCreditDeduction: 0,
        finalAmountDue: firstMonthCalculation.finalAmountDue,
        amountPaid: 0,
        status: isFullMonth ? 'DEBT' : 'PARTIAL',
        paymentMethod: 'CASH',
        recordedBy: getActorName(),
        notes: isFullMonth
          ? `Полная оплата за 1-й месяц (зачисление ${enrollmentDate}, до 10-го числа). Скидка: ${firstMonthCalculation.discountAmount} сум`
          : `Первый месяц (Зачислено после 10-го числа, ${remainingLessons}/12 уроков). Скидка: ${firstMonthCalculation.discountAmount} сум`,
      };
      newPayments.push(firstMonthPayment);
    });

    // 3. Save student, enrollments, and payments
    if (isExistingStudent) {
      setStudents((prev) => prev.map((s) => (s.id === studentIdToUse ? studentToSave : s)));
    } else {
      setStudents((prev) => [...prev, studentToSave]);
    }
    saveToFirestore('students', studentToSave);

    setEnrollments((prev) => [...prev, ...newEnrollments]);
    saveBatchToFirestore('enrollments', newEnrollments);

    setPayments((prev) => [...newPayments, ...prev]);
    saveBatchToFirestore('payments', newPayments);

    // 4. Update lead status to ENROLLED or PARTIALLY_ENROLLED
    const leadTargetSubjects = lead.targetSubjects && lead.targetSubjects.length > 0
      ? lead.targetSubjects
      : (lead.targetSubject ? lead.targetSubject.split(',').map(s => s.trim()).filter(Boolean) : []);

    const previouslyEnrolledCourses = lead.enrolledCourseIds || (lead.enrolledCourseId ? [lead.enrolledCourseId] : []);
    const updatedEnrolledCourseIds = Array.from(new Set([...previouslyEnrolledCourses, ...courseIds]));

    const allEnrolledCourseObjs = courses.filter((c) => updatedEnrolledCourseIds.includes(c.id));
    const enrolledSubjects = allEnrolledCourseObjs.map((c) => c.subject.toLowerCase());

    const allSubjectsCovered =
      leadTargetSubjects.length > 0 &&
      leadTargetSubjects.every((sub) =>
        enrolledSubjects.some((es) => es.includes(sub.toLowerCase()) || sub.toLowerCase().includes(es))
      );

    const newLeadStatus: LeadStatus =
      allSubjectsCovered || updatedEnrolledCourseIds.length >= Math.max(1, leadTargetSubjects.length)
        ? 'ENROLLED'
        : 'PARTIALLY_ENROLLED';

    // If lead is fully enrolled, permanently delete from leads database
    if (newLeadStatus === 'ENROLLED' || allSubjectsCovered) {
      deleteFromFirestore('leads', lead.id);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    } else {
      const updatedLead: Lead = {
        ...lead,
        status: newLeadStatus,
        enrolledCourseId: updatedEnrolledCourseIds[0] || courseIds[0],
        enrolledCourseIds: updatedEnrolledCourseIds,
        enrolledStudentId: studentIdToUse,
      };
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? updatedLead : l)));
      saveToFirestore('leads', updatedLead);
    }

    const courseTitles = validCourses.map((c) => `"${c.title}"`).join(', ');
    logAction(
      getActorName(),
      getActorRole(),
      'LEAD_CONVERTED',
      `Лид ${lead.fullName} зачислен на курс(ы): ${courseTitles} и добавлен в общую базу учеников.`
    );
  };

  // Handlers for Students
  const handleAddStudent = (newStudent: Student) => {
    // Check duplicate: Full Name + Phone
    const dup = checkStudentDuplicate(students, newStudent.fullName, newStudent.phone || '');
    if (dup.isDuplicate) {
      alert(
        `🚫 Ошибка добавления: Ученик «${newStudent.fullName}» с номером телефона «${newStudent.phone || '—'}» уже зарегистрирован в базе!\n\nДублирование заблокировано.`
      );
      return;
    }
    setStudents((prev) => [...prev.filter((s) => s.id !== newStudent.id), newStudent]);
    saveToFirestore('students', newStudent);
    logAction(getActorName(), getActorRole(), 'STUDENT_REGISTER', `Зарегистрирован ученик ${newStudent.fullName}`);
  };

  const handleBulkImportStudents = async (newStudentsList: Student[]) => {
    if (!newStudentsList || newStudentsList.length === 0) return;
    
    // Batch save to firestore and update local state
    setStudents((prev) => [...prev, ...newStudentsList]);
    
    for (const st of newStudentsList) {
      await saveToFirestore('students', st);
    }
    
    logAction(
      getActorName(),
      getActorRole(),
      'STUDENT_REGISTER',
      `Массовый импорт из Excel: добавлено ${newStudentsList.length} учеников`
    );
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    // Check duplicate: Full Name + Phone (excluding current student id)
    const dup = checkStudentDuplicate(students, updatedStudent.fullName, updatedStudent.phone || '', updatedStudent.id);
    if (dup.isDuplicate) {
      alert(
        `🚫 Ошибка обновления: Ученик «${updatedStudent.fullName}» с номером телефона «${updatedStudent.phone || '—'}» уже зарегистрирован в базе!\n\nДублирование заблокировано.`
      );
      return;
    }
    setStudents((prev) => prev.map((s) => (s.id === updatedStudent.id ? updatedStudent : s)));
    saveToFirestore('students', updatedStudent);
    logAction(getActorName(), getActorRole(), 'STUDENT_UPDATE', `Обновлены данные ученика ${updatedStudent.fullName}`);
  };

  const handleDeleteStudent = (studentId: string) => {
    const st = students.find((s) => s.id === studentId);
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    deleteFromFirestore('students', studentId);

    const relatedEnrollments = enrollments.filter((e) => e.studentId === studentId);
    relatedEnrollments.forEach((e) => deleteFromFirestore('enrollments', e.id));

    const relatedPayments = payments.filter((p) => p.studentId === studentId);
    relatedPayments.forEach((p) => deleteFromFirestore('payments', p.id));

    setEnrollments((prev) => prev.filter((e) => e.studentId !== studentId));
    setPayments((prev) => prev.filter((p) => p.studentId !== studentId));

    // Also reset any associated lead (match by ID, phone digits, or normalized name)
    const cleanStudentPhone = st ? (st.phone || '').replace(/\D/g, '') : '';
    const cleanStudentName = st ? st.fullName.trim().toLowerCase() : '';

    const matchingLeads = leads.filter((l) => {
      if (l.enrolledStudentId === studentId) return true;
      const cleanLeadPhone = (l.phone || '').replace(/\D/g, '');
      if (cleanStudentPhone && cleanLeadPhone && cleanLeadPhone === cleanStudentPhone) return true;
      if (cleanStudentName && l.fullName.trim().toLowerCase() === cleanStudentName) return true;
      return false;
    });

    matchingLeads.forEach((lead) => {
      const updatedLead: Lead = {
        ...lead,
        enrolledStudentId: undefined,
        enrolledCourseId: undefined,
        enrolledCourseIds: [],
        status: 'WAITING_GROUP',
      };
      saveToFirestore('leads', updatedLead);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? updatedLead : l)));
    });

    logAction(getActorName(), getActorRole(), 'STUDENT_DELETE', `Удален ученик ${st?.fullName || studentId}`);
  };

  const handleUnenrollStudentFromCourse = async (
    studentId: string,
    courseId: string,
    reason?: string,
    isPermanentDelete: boolean = false
  ) => {
    const targetStudent = students.find((s) => s.id === studentId);
    if (!targetStudent) return;
    const course = courses.find((c) => c.id === courseId);
    const dropReason = reason?.trim() || (isPermanentDelete ? 'Удален из группы администратором' : 'Исключен из группы');
    const actor = getActorName();
    const today = getUzbekistanToday();

    const updatedCourseIds = (targetStudent.enrolledCourseIds || []).filter((id) => id !== courseId);
    const previousHistory = (targetStudent.unenrollmentHistory || []).filter((u) => u.courseId !== courseId);

    const newHistory = isPermanentDelete
      ? previousHistory
      : [
          ...previousHistory,
          {
            courseId,
            courseTitle: course?.title || 'Курс',
            dropDate: today,
            dropReason,
            droppedBy: actor,
          },
        ];

    const updatedStudent: Student = {
      ...targetStudent,
      enrolledCourseIds: updatedCourseIds,
      unenrollmentHistory: newHistory,
      lastModifiedBy: actor,
    };

    setStudents((prev) => prev.map((s) => (s.id === studentId ? updatedStudent : s)));
    await saveToFirestore('students', updatedStudent);

    // Update or delete related enrollments
    const relatedEnrollments = enrollments.filter(
      (e) => e.studentId === studentId && e.courseId === courseId
    );

    if (isPermanentDelete) {
      relatedEnrollments.forEach((e) => deleteFromFirestore('enrollments', e.id));
      setEnrollments((prev) => prev.filter((e) => !(e.studentId === studentId && e.courseId === courseId)));
    } else {
      if (relatedEnrollments.length > 0) {
        relatedEnrollments.forEach((e) => {
          const droppedEnrollment: Enrollment = {
            ...e,
            status: 'DROPPED',
            dropReason,
            dropDate: today,
            droppedBy: actor,
          };
          saveToFirestore('enrollments', droppedEnrollment);
        });
        setEnrollments((prev) =>
          prev.map((e) =>
            e.studentId === studentId && e.courseId === courseId
              ? { ...e, status: 'DROPPED', dropReason, dropDate: today, droppedBy: actor }
              : e
          )
        );
      } else {
        // Create explicit dropped enrollment record in Firestore so history is preserved
        const droppedEnrollment: Enrollment = {
          id: `enr-drop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          studentId,
          courseId,
          enrollmentDate: today,
          firstMonthLessonsLeft: 0,
          status: 'DROPPED',
          dropReason,
          dropDate: today,
          droppedBy: actor,
        };
        saveToFirestore('enrollments', droppedEnrollment);
        setEnrollments((prev) => [...prev, droppedEnrollment]);
      }
    }

    // Permanently remove any associated lead from Firestore leads collection
    const cleanStudentPhone = (targetStudent.phone || '').replace(/\D/g, '');
    const cleanStudentName = targetStudent.fullName.trim().toLowerCase();

    const matchingLeads = leads.filter((l) => {
      if (l.enrolledStudentId === studentId) return true;
      const cleanLeadPhone = (l.phone || '').replace(/\D/g, '');
      if (cleanStudentPhone && cleanLeadPhone && cleanLeadPhone === cleanStudentPhone) return true;
      if (cleanStudentName && l.fullName.trim().toLowerCase() === cleanStudentName) return true;
      return false;
    });

    matchingLeads.forEach((lead) => {
      deleteFromFirestore('leads', lead.id);
    });
    if (matchingLeads.length > 0) {
      setLeads((prev) => prev.filter((l) => !matchingLeads.some((ml) => ml.id === l.id)));
    }

    logAction(
      actor,
      getActorRole(),
      isPermanentDelete ? 'STUDENT_REMOVED_FROM_COURSE' : 'STUDENT_UNENROLLED_FROM_COURSE',
      `Ученик ${targetStudent.fullName} ${isPermanentDelete ? 'удален из курса' : 'исключен из курса'} "${course?.title || courseId}". Причина: ${dropReason}`
    );
  };

  const handleQuickEnrollStudentToCourse = (studentId: string, courseId: string) => {
    const targetStudent = students.find((s) => s.id === studentId);
    const targetCourse = courses.find((c) => c.id === courseId);
    if (!targetStudent || !targetCourse) return;

    if (targetStudent.enrolledCourseIds.includes(courseId)) {
      alert(`Ученик уже зачислен в группу "${targetCourse.title}"`);
      return;
    }

    const updatedStudent: Student = {
      ...targetStudent,
      enrolledCourseIds: Array.from(new Set([...(targetStudent.enrolledCourseIds || []), courseId])),
      unenrollmentHistory: (targetStudent.unenrollmentHistory || []).filter((u) => u.courseId !== courseId),
      status: targetStudent.status === 'INACTIVE' ? 'ACTIVE' : targetStudent.status,
    };

    const existingDroppedEnrollment = enrollments.find(
      (e) => e.studentId === studentId && e.courseId === courseId
    );
    if (existingDroppedEnrollment) {
      const reactivatedEnrollment: Enrollment = {
        ...existingDroppedEnrollment,
        status: 'ACTIVE',
        enrollmentDate: getUzbekistanToday(),
        firstMonthLessonsLeft: 12,
        dropReason: undefined,
        dropDate: undefined,
        droppedBy: undefined,
      };
      saveToFirestore('enrollments', reactivatedEnrollment);
      setEnrollments((prev) =>
        prev.map((e) => (e.id === existingDroppedEnrollment.id ? reactivatedEnrollment : e))
      );
    } else {
      const newEnrollment: Enrollment = {
        id: `enr-${Date.now()}`,
        studentId,
        courseId,
        enrollmentDate: getUzbekistanToday(),
        firstMonthLessonsLeft: 12,
        status: 'ACTIVE',
      };
      setEnrollments((prev) => [...prev, newEnrollment]);
      saveToFirestore('enrollments', newEnrollment);
    }

    setStudents((prev) => prev.map((s) => (s.id === studentId ? updatedStudent : s)));
    saveToFirestore('students', updatedStudent);

    logAction(
      getActorName(),
      getActorRole(),
      'STUDENT_ENROLLED_TO_COURSE',
      `Ученик ${targetStudent.fullName} зачислен в группу "${targetCourse.title}"`
    );

    alert(`Ученик "${targetStudent.fullName}" успешно зачислен в группу "${targetCourse.title}"!`);
  };

  const handleEnrollStudent = (newEnrollment: Enrollment, firstMonthPayment: Payment) => {
    const stampedPayment: Payment = {
      ...firstMonthPayment,
      paidAt: firstMonthPayment.amountPaid > 0 ? (firstMonthPayment.paidAt || getUzbekistanISOString()) : undefined,
      recordedBy: firstMonthPayment.recordedBy || getActorName(),
    };

    setEnrollments((prev) => [...prev, newEnrollment]);
    saveToFirestore('enrollments', newEnrollment);

    setPayments((prev) => [stampedPayment, ...prev]);
    saveToFirestore('payments', stampedPayment);

    const targetStudent = students.find((s) => s.id === newEnrollment.studentId);
    if (targetStudent) {
      const updatedStudent = {
        ...targetStudent,
        enrolledCourseIds: Array.from(new Set([...(targetStudent.enrolledCourseIds || []), newEnrollment.courseId])),
      };
      setStudents((prev) =>
        prev.map((s) => (s.id === newEnrollment.studentId ? updatedStudent : s))
      );
      saveToFirestore('students', updatedStudent);
    }

    logAction(
      getActorName(),
      getActorRole(),
      'ENROLLMENT_SUCCESS',
      `Зачислен ${targetStudent?.fullName || ''}. Расчет 1-го месяца (${stampedPayment.remainingLessonsCount}/12 уроков): ${stampedPayment.finalAmountDue.toLocaleString('ru-RU')} сум`
    );
  };

  const handleToggleFreezeStudent = (
    studentId: string,
    param2?: string, // courseId OR reason
    param3?: string, // reason OR freezeUntil
    param4?: string  // freezeUntil
  ) => {
    const st = students.find((s) => s.id === studentId);
    if (!st) return;

    // Determine whether param2 is a courseId or legacy reason
    let targetCourseId: string | undefined = undefined;
    let reason: string | undefined = undefined;
    let freezeUntil: string | undefined = undefined;

    const isParam2Course =
      !!param2 &&
      param2 !== 'ALL' &&
      (courses.some((c) => c.id === param2) ||
        (st.enrolledCourseIds && st.enrolledCourseIds.includes(param2)));

    if (param2 === 'ALL') {
      targetCourseId = undefined;
      reason = param3;
      freezeUntil = param4;
    } else if (isParam2Course) {
      targetCourseId = param2;
      reason = param3;
      freezeUntil = param4;
    } else {
      // Legacy call: (studentId, reason, freezeUntil)
      reason = param2;
      freezeUntil = param3;
    }

    // Initialize courseFreezes map:
    // 1. If student already has courseFreezes, preserve them.
    // 2. If student had legacy global freeze (status === 'FROZEN') and no courseFreezes yet,
    // initialize ALL enrolled courses with the legacy freeze data so that unfreezing one course leaves all other courses frozen!
    let updatedCourseFreezes: Record<string, { freezeDate: string; freezeUntil?: string; freezeReason?: string }> = {};
    if (st.courseFreezes && Object.keys(st.courseFreezes).length > 0) {
      updatedCourseFreezes = { ...st.courseFreezes };
    } else if (st.status === 'FROZEN') {
      (st.enrolledCourseIds || []).forEach((cId) => {
        updatedCourseFreezes[cId] = {
          freezeDate: st.freezeDate || getUzbekistanToday(),
          freezeUntil: st.freezeUntil,
          freezeReason: st.freezeReason || 'Временная заморозка',
        };
      });
    }

    let actionText = '';
    let newStatus = st.status;

    if (targetCourseId) {
      // Per-course freeze/unfreeze
      // Use isStudentFrozenInCourse to accurately determine current state for this course
      const isCurrentlyFrozenInCourse = isStudentFrozenInCourse(st, targetCourseId);
      const courseName = courses.find((c) => c.id === targetCourseId)?.title || targetCourseId;

      if (isCurrentlyFrozenInCourse) {
        // UNFREEZE ONLY this specific course
        delete updatedCourseFreezes[targetCourseId];
        actionText = `Разморожен в группе "${courseName}"`;
      } else {
        // FREEZE this specific course
        updatedCourseFreezes[targetCourseId] = {
          freezeDate: getUzbekistanToday(),
          freezeUntil: freezeUntil || undefined,
          freezeReason: reason || 'Временная заморозка',
        };
        actionText = `Заморожен в группе "${courseName}"`;
      }

      // Check remaining active vs frozen courses
      const enrolledCourses = st.enrolledCourseIds || [];
      const frozenCount = enrolledCourses.filter((cId) => !!updatedCourseFreezes[cId]).length;
      const activeCount = enrolledCourses.filter((cId) => !updatedCourseFreezes[cId]).length;

      newStatus = (enrolledCourses.length > 0 && frozenCount > 0 && activeCount === 0) ? 'FROZEN' : 'ACTIVE';
    } else {
      // Global freeze/unfreeze toggle across all enrolled groups
      const isCurrentlyFrozen = st.status === 'FROZEN' || Object.keys(updatedCourseFreezes).length > 0;
      if (isCurrentlyFrozen) {
        // Unfreeze all
        updatedCourseFreezes = {};
        newStatus = 'ACTIVE';
        actionText = 'Разморожен во всех группах';
      } else {
        // Freeze all
        (st.enrolledCourseIds || []).forEach((cId) => {
          updatedCourseFreezes[cId] = {
            freezeDate: getUzbekistanToday(),
            freezeUntil: freezeUntil || undefined,
            freezeReason: reason || 'Временная заморозка',
          };
        });
        newStatus = 'FROZEN';
        actionText = 'Заморожен во всех группах';
      }
    }

    // Keep representative freeze metadata on student root for backward compatibility
    const remainingFreezes = Object.values(updatedCourseFreezes);
    const repFreeze = remainingFreezes[0];

    const updatedStudent: Student = {
      ...st,
      status: newStatus,
      courseFreezes: updatedCourseFreezes,
      freezeDate: remainingFreezes.length > 0 ? (repFreeze?.freezeDate || getUzbekistanToday()) : undefined,
      freezeUntil: remainingFreezes.length > 0 ? repFreeze?.freezeUntil : undefined,
      freezeReason: remainingFreezes.length > 0 ? (repFreeze?.freezeReason || reason || 'Временная заморозка') : undefined,
    };

    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? updatedStudent : s))
    );
    saveToFirestore('students', updatedStudent);

    const untilText = freezeUntil ? ` до ${freezeUntil}` : '';
    const userDisplay = getActorName();
    logAction(
      userDisplay,
      getActorRole(),
      'STUDENT_FREEZE',
      `${actionText} ${st.fullName}${untilText}${reason ? ` (${reason})` : ''}`
    );
  };

  const handleTransferStudent = (studentId: string, fromCourseId: string, toCourseId: string) => {
    const st = students.find((s) => s.id === studentId);
    if (!st) return;

    const fromCourse = courses.find((c) => c.id === fromCourseId);
    const toCourse = courses.find((c) => c.id === toCourseId);

    if (!toCourse) return;

    let updatedCourseIds = st.enrolledCourseIds.filter((id) => id !== fromCourseId);
    if (!updatedCourseIds.includes(toCourseId)) {
      updatedCourseIds.push(toCourseId);
    }

    const userDisplay = getActorName();
    const today = getUzbekistanToday();
    const transferUnenrollment: CourseUnenrollment = {
      courseId: fromCourseId,
      courseTitle: fromCourse?.title || 'Прежний курс',
      dropDate: today,
      dropReason: `Переведен в группу «${toCourse.title}»`,
      droppedBy: userDisplay,
    };
    const prevHistory = (st.unenrollmentHistory || []).filter((u) => u.courseId !== fromCourseId);

    const updatedStudent: Student = {
      ...st,
      enrolledCourseIds: updatedCourseIds,
      unenrollmentHistory: [...prevHistory, transferUnenrollment],
    };

    setStudents((prev) => prev.map((s) => (s.id === studentId ? updatedStudent : s)));
    saveToFirestore('students', updatedStudent);

    // Update old course enrollment to DROPPED
    setEnrollments((prev) =>
      prev.map((e) =>
        e.studentId === studentId && e.courseId === fromCourseId
          ? {
              ...e,
              status: 'DROPPED',
              dropReason: `Переведен в группу «${toCourse.title}»`,
              dropDate: today,
              droppedBy: userDisplay,
            }
          : e
      )
    );

    const existingEnrollment = enrollments.find(
      (e) => e.studentId === studentId && e.courseId === toCourseId
    );
    if (!existingEnrollment) {
      const newEnrollment: Enrollment = {
        id: `enr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        studentId,
        courseId: toCourseId,
        enrollmentDate: getUzbekistanToday(),
        firstMonthLessonsLeft: 12,
        status: 'ACTIVE',
      };
      setEnrollments((prev) => [...prev, newEnrollment]);
      saveToFirestore('enrollments', newEnrollment);
    }

    // --- AUTOMATIC PAYMENTS TRANSFER & PHANTOM DEBTS CLEANUP ---
    const oldGroupName = fromCourse?.title || 'Прежняя группа';
    const transferComment = `Оплата переведена из группы «${oldGroupName}»`;

    // Find all payment records of this student in the old course
    const studentOldPayments = payments.filter(
      (p) => p.studentId === studentId && p.courseId === fromCourseId
    );

    const paymentsToDelete: string[] = [];
    const paymentsToUpdate: Payment[] = [];

    studentOldPayments.forEach((p) => {
      const historyPaid = (p.paymentHistory || []).reduce((sum, h) => sum + (h.amountPaid || 0), 0);
      const totalPaid = (p.amountPaid || 0) + historyPaid;

      if (totalPaid > 0 || (p.amountPaid || 0) > 0) {
        // Real payment: transfer to the new course and record transfer comment
        const existingNotes = (p.notes || '').trim();
        const updatedNotes = existingNotes
          ? existingNotes.includes('Оплата переведена из группы')
            ? existingNotes
            : `${existingNotes} | ${transferComment}`
          : transferComment;

        const updatedPayment: Payment = {
          ...p,
          courseId: toCourseId,
          transferredFromCourseId: fromCourseId,
          transferredFromCourseTitle: oldGroupName,
          notes: updatedNotes,
          paymentHistory: (p.paymentHistory || []).map((h) => ({
            ...h,
            courseId: toCourseId,
            transferredFromCourseId: fromCourseId,
            transferredFromCourseTitle: oldGroupName,
            notes: h.notes
              ? h.notes.includes('Оплата переведена из группы')
                ? h.notes
                : `${h.notes} | ${transferComment}`
              : transferComment,
          })),
        };

        paymentsToUpdate.push(updatedPayment);
        saveToFirestore('payments', updatedPayment);
      } else {
        // Zero-sum / phantom debt in the old group: DELETE from DB so student is no longer debtor in former group
        paymentsToDelete.push(p.id);
        deleteFromFirestore('payments', p.id);
      }
    });

    if (paymentsToDelete.length > 0 || paymentsToUpdate.length > 0) {
      setPayments((prev) => {
        const withoutDeleted = prev.filter((p) => !paymentsToDelete.includes(p.id));
        return withoutDeleted.map((p) => {
          const matched = paymentsToUpdate.find((up) => up.id === p.id);
          return matched || p;
        });
      });
    }

    logAction(
      userDisplay,
      getActorRole(),
      'STUDENT_TRANSFER',
      `Перевод ученика ${st.fullName} из группы "${fromCourse?.title || 'Без группы'}" в группу "${toCourse.title}" (перенесены оплаты: ${paymentsToUpdate.length}, удалены фиктивные долги: ${paymentsToDelete.length})`
    );
  };

  const handleSaveAttendance = (records: Partial<AttendanceRecord>[]) => {
    const recordsToSave: AttendanceRecord[] = [];
    const markerName = getActorName();
    setAttendanceRecords((prev) => {
      const updated = [...prev];
      records.forEach((rec) => {
        const index = updated.findIndex(
          (r) =>
            (rec.id && r.id === rec.id) ||
            (r.courseId === rec.courseId &&
              r.studentId === rec.studentId &&
              r.date === rec.date)
        );
        if (index >= 0) {
          const item = {
            ...updated[index],
            ...rec,
            status: rec.status !== undefined ? rec.status : updated[index].status,
            absenceCategory: rec.absenceCategory,
            excusedReason: rec.excusedReason,
            otherReasonText: rec.otherReasonText,
            adminComment: rec.adminComment !== undefined ? rec.adminComment : updated[index].adminComment,
            markedByName: rec.markedByName || updated[index].markedByName || markerName,
            markedAt: getUzbekistanISOString(),
          } as AttendanceRecord;
          updated[index] = item;
          recordsToSave.push(item);
        } else {
          const item = {
            id: rec.id || `att-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            date: rec.date || getUzbekistanToday(),
            courseId: rec.courseId || '',
            studentId: rec.studentId || '',
            teacherId: rec.teacherId || '',
            status: rec.status || 'PRESENT',
            absenceCategory: rec.absenceCategory,
            excusedReason: rec.excusedReason,
            otherReasonText: rec.otherReasonText,
            adminComment: rec.adminComment,
            markedByName: rec.markedByName || markerName,
            markedAt: getUzbekistanISOString(),
          } as AttendanceRecord;
          updated.push(item);
          recordsToSave.push(item);
        }
      });
      return updated;
    });

    saveBatchToFirestore('attendance', recordsToSave);

    const activeTeacher = teachers.find((t) => t.id === selectedTeacherId);
    logAction(
      getActorName(activeTeacher?.fullName),
      getActorRole(),
      'ROLLCALL_SAVE',
      `Сохранена отметка посещаемости / причина отсутствия на дату ${records[0]?.date || getUzbekistanToday()}`
    );
  };

  const handleUpdateAdminComment = (recordId: string, comment: string) => {
    const targetRecord = attendanceRecords.find((r) => r.id === recordId);
    if (targetRecord) {
      const updatedRecord = { ...targetRecord, adminComment: comment };
      setAttendanceRecords((prev) =>
        prev.map((r) => (r.id === recordId ? updatedRecord : r))
      );
      saveToFirestore('attendance', updatedRecord);
    }
    logAction(getActorName(), getActorRole(), 'ADMIN_COMMENT', `Добавлен комментарий по пропуску: "${comment}"`);
  };

  // Payment Handlers
  const handleRegisterPayment = (
    paymentId: string,
    transactionAmount: number, // The amount paid in this specific payment/installment
    status: Payment['status'],
    method: PaymentMethod = 'CARD',
    notes?: string,
    recordedBy?: string,
    fullPayment?: Payment
  ) => {
    const actorName = (recordedBy && recordedBy.trim()) || getActorName();
    const methodTitle = method === 'CASH' ? 'Наличные' : 'Перевод по карте';

    // 1. Resolve studentId, courseId, monthPeriod
    let studentId = fullPayment?.studentId || '';
    let courseId = fullPayment?.courseId || '';
    let monthPeriod = fullPayment?.monthPeriod || '';

    const target = payments.find((p) => p.id === paymentId);
    if (target) {
      studentId = studentId || target.studentId;
      courseId = courseId || target.courseId;
      monthPeriod = monthPeriod || target.monthPeriod;
    }

    if (!studentId && paymentId) {
      if (paymentId.startsWith('virt___') || paymentId.startsWith('new___')) {
        const parts = paymentId.split('___');
        studentId = parts[1] || '';
        courseId = parts[2] || '';
        monthPeriod = parts[3] || '';
      } else if (paymentId.startsWith('virt-')) {
        const parts = paymentId.split('-');
        studentId = parts[1] || '';
        courseId = parts[2] || '';
        monthPeriod = parts.slice(3).join('-');
      }
    }

    monthPeriod = monthPeriod || getUzbekistanCurrentMonthPeriod();

    // 2. Find all existing payments for this student + course + month
    const existingForMonth = payments.filter(
      (p) => p.studentId === studentId && p.courseId === courseId && p.monthPeriod === monthPeriod
    );
    const paidTransactions = existingForMonth.filter((p) => (p.amountPaid || 0) > 0);
    const zeroPayment = existingForMonth.find((p) => (p.amountPaid || 0) === 0);

    const crs = courses.find((c) => c.id === courseId);
    const duePrice = fullPayment?.finalAmountDue ?? (existingForMonth[0]?.finalAmountDue ?? (target?.finalAmountDue ?? (crs?.monthlyPrice || transactionAmount)));

    const previousPaidTotal = paidTransactions.reduce((s, p) => s + (p.amountPaid || 0), 0);
    const newPaidTotal = previousPaidTotal + transactionAmount;

    let effectiveStatus: Payment['status'] = status;
    if (newPaidTotal >= duePrice && duePrice > 0) {
      effectiveStatus = 'PAID';
    } else if (newPaidTotal > 0 && newPaidTotal < duePrice) {
      effectiveStatus = 'PARTIAL';
    }

    // 3. CASE A: Student already has paid installments for this month (e.g. 500k previously paid, now paying 50k top-up)
    // We MUST record this as a NEW SEPARATE payment in the database!
    if (paidTransactions.length > 0) {
      const newPaymentId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newPayment: Payment = {
        id: newPaymentId,
        studentId,
        courseId,
        monthPeriod,
        isFirstMonth: fullPayment?.isFirstMonth ?? existingForMonth[0]?.isFirstMonth ?? false,
        remainingLessonsCount: fullPayment?.remainingLessonsCount ?? existingForMonth[0]?.remainingLessonsCount ?? 12,
        baseCalculatedAmount: fullPayment?.baseCalculatedAmount ?? existingForMonth[0]?.baseCalculatedAmount ?? duePrice,
        discountApplied: fullPayment?.discountApplied ?? existingForMonth[0]?.discountApplied ?? 0,
        excusedCreditDeduction: fullPayment?.excusedCreditDeduction ?? existingForMonth[0]?.excusedCreditDeduction ?? 0,
        finalAmountDue: duePrice,
        amountPaid: transactionAmount, // The exact newly paid installment (e.g. 50 000 сум)
        status: effectiveStatus,
        paymentMethod: method,
        recordedBy: actorName,
        paidAt: getUzbekistanISOString(),
        notes: notes || `Доплата за ${formatMonthPeriodLabel(monthPeriod)}: ${transactionAmount.toLocaleString('ru-RU')} сум (${methodTitle})`,
      };

      // If the month is now fully paid, update previous partial payments' status to PAID so they reflect that the debt is settled
      const updatedPrevious: Payment[] = [];
      if (effectiveStatus === 'PAID') {
        paidTransactions.forEach((prevPay) => {
          if (prevPay.status !== 'PAID') {
            const updated = { ...prevPay, status: 'PAID' as const };
            updatedPrevious.push(updated);
            saveToFirestore('payments', updated);
          }
        });
      }

      setPayments((prev) => {
        const updatedMap = new Map(updatedPrevious.map((u) => [u.id, u]));
        const updatedList = prev.map((p) => updatedMap.get(p.id) || p);
        return [newPayment, ...updatedList];
      });
      saveToFirestore('payments', newPayment);

    // 4. CASE B: Student has an empty/placeholder bill record with amountPaid === 0
    } else if (zeroPayment || (target && target.amountPaid === 0)) {
      const targetDoc = zeroPayment || target!;
      const updatedPayment: Payment = {
        ...targetDoc,
        amountPaid: transactionAmount,
        status: effectiveStatus,
        paymentMethod: method,
        recordedBy: actorName,
        updatedBy: actorName,
        paidAt: getUzbekistanISOString(),
        notes: notes || targetDoc.notes || `Оплата по счету: ${transactionAmount.toLocaleString('ru-RU')} сум (${methodTitle})`,
      };

      setPayments((prev) => prev.map((p) => (p.id === updatedPayment.id ? updatedPayment : p)));
      saveToFirestore('payments', updatedPayment);

    // 5. CASE C: First payment created from scratch / virtual row
    } else {
      const newPaymentId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newPayment: Payment = {
        id: newPaymentId,
        studentId,
        courseId,
        monthPeriod,
        isFirstMonth: fullPayment?.isFirstMonth ?? false,
        remainingLessonsCount: fullPayment?.remainingLessonsCount ?? 12,
        baseCalculatedAmount: fullPayment?.baseCalculatedAmount ?? duePrice,
        discountApplied: fullPayment?.discountApplied ?? 0,
        excusedCreditDeduction: fullPayment?.excusedCreditDeduction ?? 0,
        finalAmountDue: duePrice,
        amountPaid: transactionAmount,
        status: effectiveStatus,
        paymentMethod: method,
        recordedBy: actorName,
        paidAt: getUzbekistanISOString(),
        notes: notes || `Оплата за ${formatMonthPeriodLabel(monthPeriod)}: ${transactionAmount.toLocaleString('ru-RU')} сум (${methodTitle})`,
      };

      setPayments((prev) => [newPayment, ...prev]);
      saveToFirestore('payments', newPayment);
    }

    logAction(
      actorName,
      getActorRole(),
      'PAYMENT_RECEIVED',
      `Внесена оплата ${transactionAmount.toLocaleString('ru-RU')} сум (${methodTitle}) за период ${monthPeriod}. Принял: ${actorName}`
    );
  };

  const handleUpdatePayment = (updatedPayment: Payment) => {
    const isVirtual = updatedPayment.id.startsWith('virt-') || updatedPayment.id.startsWith('virt___');
    const actorName = getActorName();

    const numDue = Number(updatedPayment.finalAmountDue) || 0;
    const numPaid = Number(updatedPayment.amountPaid) || 0;
    let computedStatus = updatedPayment.status;
    if (numPaid >= numDue && numDue > 0) {
      computedStatus = 'PAID';
    } else if (numPaid > 0 && numPaid < numDue) {
      computedStatus = 'PARTIAL';
    } else if (numPaid === 0 && numDue > 0) {
      computedStatus = 'DEBT';
    } else if (numDue === 0 && numPaid === 0 && (updatedPayment.excusedCreditDeduction > 0 || updatedPayment.discountApplied > 0)) {
      computedStatus = 'RECALCULATED';
    }

    const realPayment: Payment = isVirtual
      ? {
          ...updatedPayment,
          id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          status: computedStatus,
          recordedBy: updatedPayment.recordedBy || actorName,
          updatedBy: actorName,
          paidAt: updatedPayment.amountPaid > 0 ? (updatedPayment.paidAt || getUzbekistanISOString()) : undefined,
        }
      : {
          ...updatedPayment,
          status: computedStatus,
          recordedBy: updatedPayment.recordedBy || actorName,
          updatedBy: actorName,
          paidAt: updatedPayment.amountPaid > 0 ? (updatedPayment.paidAt || getUzbekistanISOString()) : undefined,
        };

    setPayments((prev) => {
      const exists = prev.some((p) => p.id === realPayment.id);
      if (exists) {
        return prev.map((p) => (p.id === realPayment.id ? realPayment : p));
      }
      return [realPayment, ...prev];
    });

    saveToFirestore('payments', realPayment);
    const st = students.find((s) => s.id === realPayment.studentId);
    const crs = courses.find((c) => c.id === realPayment.courseId);
    logAction(
      actorName,
      getActorRole(),
      'PAYMENT_UPDATE',
      `Отредактирован платеж для ${st?.fullName || 'Ученика'} (${crs?.title || 'Курс'}, период ${realPayment.monthPeriod}): Сумма ${realPayment.amountPaid.toLocaleString('ru-RU')} сум (${realPayment.status}). Редактировал: ${actorName}`
    );
  };

  const handleDeletePayment = (paymentId: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    deleteFromFirestore('payments', paymentId);
    logAction(getActorName(), getActorRole(), 'PAYMENT_DELETE', `Удалена запись счета/оплаты ${paymentId}`);
  };

  // Expense Handlers (Расходы и Зарплаты)
  const handleAddExpense = (newExpense: Expense) => {
    setExpenses((prev) => [newExpense, ...prev]);
    saveToFirestore('expenses', newExpense);
    logAction(
      getActorName(),
      getActorRole(),
      'EXPENSE_ADD',
      `Внесен расход "${newExpense.title}" на сумму ${newExpense.amount.toLocaleString('ru-RU')} сум (${newExpense.monthPeriod}, ${newExpense.paymentMethod === 'CASH' ? 'Наличные' : 'Карта'})`
    );
  };

  const handleUpdateExpense = (updatedExpense: Expense) => {
    setExpenses((prev) => prev.map((e) => (e.id === updatedExpense.id ? updatedExpense : e)));
    saveToFirestore('expenses', updatedExpense);
    logAction(
      getActorName(),
      getActorRole(),
      'EXPENSE_UPDATE',
      `Обновлен расход "${updatedExpense.title}" на сумму ${updatedExpense.amount.toLocaleString('ru-RU')} сум`
    );
  };

  const handleDeleteExpense = (expenseId: string) => {
    const exp = expenses.find((e) => e.id === expenseId);
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    deleteFromFirestore('expenses', expenseId);
    logAction(
      getActorName(),
      getActorRole(),
      'EXPENSE_DELETE',
      `Удален расход "${exp?.title || expenseId}" на сумму ${exp?.amount.toLocaleString('ru-RU') || 0} сум (средства возвращены в кассу)`
    );
  };

  const handlePayTeacherSalary = (
    teacherId: string,
    monthPeriod: string,
    amount: number,
    paymentMethod: PaymentMethod,
    notes?: string
  ) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    const teacherName = teacher?.fullName || 'Преподаватель';
    const newExpense: Expense = {
      id: `exp-sal-${teacherId}-${monthPeriod}-${Date.now()}`,
      title: `Зарплата учителя: ${teacherName}`,
      amount,
      monthPeriod,
      category: 'TEACHER_SALARY',
      paymentMethod,
      expenseDate: getUzbekistanToday(),
      teacherId,
      notes: notes || `Выплата зарплаты за ${monthPeriod} преподавателю ${teacherName}`,
      createdAt: getUzbekistanISOString(),
    };

    setExpenses((prev) => [newExpense, ...prev]);
    saveToFirestore('expenses', newExpense);

    const methodTitle = paymentMethod === 'CASH' ? 'Наличные' : 'Перевод по карте';
    logAction(
      getActorName(),
      getActorRole(),
      'TEACHER_SALARY_PAID',
      `Выплачена зарплата учителю ${teacherName} на сумму ${amount.toLocaleString('ru-RU')} сум (${methodTitle}) за период ${monthPeriod}. Сумма списана из общей кассы.`
    );
  };

  // SMS Handler
  const handleSendSms = (smsData: Partial<SmsLog>) => {
    const newSms: SmsLog = {
      id: smsData.id || `sms-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      studentId: smsData.studentId || '',
      studentName: smsData.studentName || '',
      recipientPhone: smsData.recipientPhone || '',
      parentType: smsData.parentType || 'FATHER',
      message: smsData.message || '',
      status: smsData.status || 'DELIVERED',
      sentAt: smsData.sentAt || getUzbekistanISOString(),
    };

    setSmsLogs((prev) => [newSms, ...prev]);
    saveToFirestore('smsLogs', newSms);
    logAction(
      getActorName(),
      getActorRole(),
      'SMS_SENT',
      `Отправлено SMS (${newSms.recipientPhone}) для ${newSms.studentName || 'Получателя'}`
    );
  };

  const handleClearSmsLogs = async () => {
    if (smsLogs.length === 0) return;
    const count = smsLogs.length;
    if (
      !confirm(
        `Вы действительно хотите безвозвратно очистить всю базу отправленных SMS-сообщений (${count} шт.)?`
      )
    ) {
      return;
    }

    const currentLogs = [...smsLogs];
    setSmsLogs([]);
    for (const log of currentLogs) {
      await deleteFromFirestore('smsLogs', log.id);
    }

    logAction(
      getActorName(),
      getActorRole(),
      'SMS_CLEAR_HISTORY',
      `Очищена база отправленных SMS-сообщений (${count} шт.)`
    );
  };

  // Quick Payment Handler
  const handleQuickPaymentSubmit = (
    studentId: string,
    courseId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    targetMonthPeriod: string = getUzbekistanCurrentMonthPeriod(),
    recordedBy?: string
  ) => {
    const existingPayments = payments.filter(
      (p) => p.studentId === studentId && p.courseId === courseId && p.monthPeriod === targetMonthPeriod
    );
    const paidTransactions = existingPayments.filter((p) => (p.amountPaid || 0) > 0);
    const zeroPayment = existingPayments.find((p) => (p.amountPaid || 0) === 0);

    const targetId = paidTransactions.length > 0
      ? `new___${studentId}___${courseId}___${targetMonthPeriod}`
      : (zeroPayment?.id || `virt___${studentId}___${courseId}___${targetMonthPeriod}`);

    handleRegisterPayment(
      targetId,
      amount,
      'PAID',
      paymentMethod,
      undefined,
      recordedBy
    );
  };

  // Selected Teacher for Teacher View (Strict binding for teacher role)
  const activeTeacherObj =
    currentUser?.role === 'TEACHER' && currentUser.teacherProfileId
      ? teachers.find((t) => t.id === currentUser.teacherProfileId) || teachers[0]
      : teachers.find((t) => t.id === selectedTeacherId) || teachers[0];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 font-sans antialiased selection:bg-blue-600 selection:text-white w-full transition-colors duration-200">
      
      {/* Login Modal Overlay if not authenticated */}
      <LoginModal
        isOpen={!currentUser}
        teachers={teachers}
        staffMembers={staffMembers}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Sticky Navbar with Day / Night toggle */}
      <Navbar
        currentRole={currentRole}
        setCurrentRole={setCurrentRole}
        selectedTeacherId={selectedTeacherId}
        setSelectedTeacherId={setSelectedTeacherId}
        teachers={teachers}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickPaymentModal={() => {
          setPreselectedStudentForPayment(null);
          setIsQuickPaymentOpen(true);
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
        onClearData={() => setIsClearDbModalOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-3.5 sm:py-6 w-full">
        {/* Firestore Quota Limit Exceeded Banner */}
        {isQuotaExceeded && !isQuotaBannerDismissed && (
          <div className="mb-4 sm:mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Достигнут лимит бесплатных запросов чтения Firestore (Free daily read quota exceeded)
                </h4>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                  База данных исчерпала суточную квоту бесплатного тарифа (Spark Free Tier). Приложение автоматически переключилось на автономный кэш устройства — все данные сохранены и доступны. Квота сбрасывается ежедневно, либо вы можете подключить биллинг в консоли Firebase для перехода на тариф Blaze.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
              <a
                href="https://console.firebase.google.com/project/phonic-appliance-ppt51/firestore/databases/ai-studio-mbseducationcms-240e3028-2d99-4d33-a506-2b4842bb34f4/data?openUpgradeDialog=true"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-colors"
              >
                <span>Перейти в Firebase</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => setIsQuotaBannerDismissed(true)}
                className="p-1.5 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-200/60 dark:hover:bg-amber-900/60 transition-colors"
                title="Скрыть предупреждение"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        
        {/* ROLE: ADMINISTRATOR OR DIRECTOR */}
        {(currentRole === 'ADMIN' || currentRole === 'DIRECTOR') && (
          <div>
            {activeTab === 'overview' && (
              <AdminDashboard
                teachers={teachers}
                courses={sortedCourses}
                students={sortedStudents}
                attendanceRecords={attendanceRecords}
                payments={payments}
                expenses={expenses}
                onUpdateAdminComment={handleUpdateAdminComment}
                onNavigateTab={setActiveTab}
              />
            )}

            {activeTab === 'students' && (
              <StudentRegistry
                students={sortedStudents}
                courses={sortedCourses}
                teachers={teachers}
                cabinets={sortedCabinets}
                payments={payments}
                leads={leads}
                subjects={subjects}
                onAddStudent={handleAddStudent}
                onImportStudents={handleBulkImportStudents}
                onUpdateStudent={handleUpdateStudent}
                onEnrollStudent={handleEnrollStudent}
                onDeleteStudent={handleDeleteStudent}
                onOpenPaymentForStudent={(st) => {
                  setPreselectedStudentForPayment(st);
                  setIsQuickPaymentOpen(true);
                }}
                onTransferStudent={handleTransferStudent}
                onToggleFreezeStudent={handleToggleFreezeStudent}
                onAddLead={handleAddLead}
                onUpdateLead={handleUpdateLead}
                onDeleteLead={handleDeleteLead}
                onClearLeads={handleClearLeads}
                onConvertLeadToStudent={handleConvertLeadToStudent}
              />
            )}

            {activeTab === 'teachers' && (
              <TeacherManagement
                teachers={teachers}
                courses={sortedCourses}
                subjects={subjects}
                staffMembers={staffMembers}
                currentUser={currentUser}
                onAddTeacher={handleAddTeacher}
                onUpdateTeacher={handleUpdateTeacher}
                onDeleteTeacher={handleDeleteTeacher}
                onAddStaffMember={handleAddStaffMember}
                onUpdateStaffMember={handleUpdateStaffMember}
                onDeleteStaffMember={handleDeleteStaffMember}
                onAddSubject={handleAddSubject}
                onUpdateSubject={handleUpdateSubject}
                onDeleteSubject={handleDeleteSubject}
                onClearSubjects={handleClearSubjects}
              />
            )}

            {activeTab === 'courses' && (
              <CourseManagement
                courses={sortedCourses}
                cabinets={sortedCabinets}
                teachers={teachers}
                subjects={subjects}
                students={sortedStudents}
                enrollments={enrollments}
                attendanceRecords={attendanceRecords}
                onAddCourse={handleAddCourse}
                onUpdateCourse={handleUpdateCourse}
                onDeleteCourse={handleDeleteCourse}
                onAddCabinet={handleAddCabinet}
                onUpdateCabinet={handleUpdateCabinet}
                onDeleteCabinet={handleDeleteCabinet}
                onUnenrollStudent={handleUnenrollStudentFromCourse}
                onEnrollStudentToCourse={handleQuickEnrollStudentToCourse}
                onTransferStudent={handleTransferStudent}
                onToggleFreezeStudent={handleToggleFreezeStudent}
                onSaveAttendance={handleSaveAttendance}
                onNavigateToAttendance={(courseId) => {
                  setActiveTab('attendance');
                }}
              />
            )}

            {activeTab === 'attendance' && (
              <AttendanceView
                attendanceRecords={attendanceRecords}
                students={sortedStudents}
                courses={sortedCourses}
                teachers={teachers}
                enrollments={enrollments}
                onSaveAttendance={handleSaveAttendance}
                onUpdateAdminComment={handleUpdateAdminComment}
                onSendSms={handleSendSms}
                gatewayConfig={smsGatewayConfig}
                onUpdateGatewayConfig={handleUpdateSmsGatewayConfig}
              />
            )}

            {activeTab === 'finance' && (
              <FinanceModule
                payments={payments}
                expenses={expenses}
                students={sortedStudents}
                courses={sortedCourses}
                teachers={teachers}
                subjects={subjects}
                attendanceRecords={attendanceRecords}
                onRegisterPayment={handleRegisterPayment}
                onUpdatePayment={handleUpdatePayment}
                onDeletePayment={handleDeletePayment}
                onAddExpense={handleAddExpense}
                onUpdateExpense={handleUpdateExpense}
                onDeleteExpense={handleDeleteExpense}
                onPayTeacherSalary={handlePayTeacherSalary}
                onOpenQuickPaymentModal={() => {
                  setPreselectedStudentForPayment(null);
                  setIsQuickPaymentOpen(true);
                }}
                onSendSms={handleSendSms}
                currentUser={currentUser}
                staffMembers={staffMembers}
                gatewayConfig={smsGatewayConfig}
                onUpdateGatewayConfig={handleUpdateSmsGatewayConfig}
              />
            )}

            {activeTab === 'sms' && (
              <SmsModule
                smsLogs={smsLogs}
                students={sortedStudents}
                courses={sortedCourses}
                payments={payments}
                attendanceRecords={attendanceRecords}
                teachers={teachers}
                onSendSms={handleSendSms}
                onClearSmsLogs={handleClearSmsLogs}
                gatewayConfig={smsGatewayConfig}
                onUpdateGatewayConfig={handleUpdateSmsGatewayConfig}
              />
            )}

            {activeTab === 'ai-analytics' && (
              <AiAnalyticsModule
                students={sortedStudents}
                leads={leads}
                courses={sortedCourses}
                teachers={teachers}
                cabinets={sortedCabinets}
                payments={payments}
                expenses={expenses}
                attendanceRecords={attendanceRecords}
                subjects={subjects}
                auditLogs={auditLogs}
              />
            )}
          </div>
        )}

        {/* ROLE: TEACHER */}
        {currentRole === 'TEACHER' && activeTeacherObj && (
          <TeacherCabinet
            teacher={activeTeacherObj}
            courses={sortedCourses}
            cabinets={sortedCabinets}
            students={sortedStudents}
            attendanceRecords={attendanceRecords}
            onSaveAttendance={handleSaveAttendance}
            teachers={teachers}
            onSelectTeacher={setSelectedTeacherId}
            onTransferStudent={handleTransferStudent}
            onToggleFreezeStudent={handleToggleFreezeStudent}
          />
        )}

      </main>

      {/* Pinned Quick Payment Modal */}
      <QuickPaymentModal
        isOpen={isQuickPaymentOpen}
        onClose={() => {
          setIsQuickPaymentOpen(false);
          setPreselectedStudentForPayment(null);
        }}
        students={sortedStudents}
        courses={sortedCourses}
        payments={payments}
        enrollments={enrollments}
        preselectedStudent={preselectedStudentForPayment}
        onRegisterPayment={handleRegisterPayment}
        onSubmitPayment={handleQuickPaymentSubmit}
        currentUser={currentUser}
        staffMembers={staffMembers}
      />

      {/* Protected Clear Database Modal (Password Required: 123456789) */}
      <ClearDatabaseModal
        isOpen={isClearDbModalOpen}
        onClose={() => setIsClearDbModalOpen(false)}
        onConfirm={handleClearData}
      />

    </div>
  );
}
