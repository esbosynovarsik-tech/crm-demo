import React, { useState, useMemo, useEffect } from 'react';
import {
  UserPlus,
  Phone,
  Search,
  BookPlus,
  Tag,
  Clock,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  School,
  GraduationCap,
  MapPin,
  Award,
  CheckCircle2,
  Clock3,
  Users,
  CheckCircle,
  XCircle,
  ArrowRight,
  AlertCircle,
  Check,
  Sparkles,
  DoorClosed,
  UserCheck,
  Plus,
  X,
  Layers,
  HelpCircle,
  ListPlus,
  BookOpen,
} from 'lucide-react';
import {
  Lead,
  Course,
  DiscountType,
  LeadStatus,
  TeacherProfile,
  Cabinet,
  Student,
  Subject,
} from '../types';
import { calculateFirstMonthTuition } from '../lib/billingLogic';
import { getUzbekistanISOString } from '../lib/dateUtils';
import { formatUzbekPhoneInput, formatDisplayPhone } from '../lib/phoneUtils';

interface LeadsManagementProps {
  leads: Lead[];
  courses: Course[];
  teachers?: TeacherProfile[];
  cabinets?: Cabinet[];
  students?: Student[];
  subjects?: Subject[];
  onAddLead: (lead: Lead) => void;
  onUpdateLead?: (lead: Lead) => void;
  onDeleteLead?: (leadId: string) => void;
  onClearLeads?: () => void;
  onConvertLeadToStudent?: (
    lead: Lead,
    courseIdOrCourses: string | { courseId: string; remainingLessonsCount: number }[],
    remainingLessonsCount?: number
  ) => void;
}

export const LeadsManagement: React.FC<LeadsManagementProps> = ({
  leads,
  courses,
  teachers = [],
  cabinets = [],
  students = [],
  subjects = [],
  onAddLead,
  onUpdateLead,
  onDeleteLead,
  onClearLeads,
  onConvertLeadToStudent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');

  // Modals state
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [enrollLeadModal, setEnrollLeadModal] = useState<Lead | null>(null);

  // Form states for Lead (Multi-Subject Support)
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [birthDate, setBirthDate] = useState('2009-03-10');
  const [targetSubject, setTargetSubject] = useState<string>('');
  const targetSubjects = useMemo(
    () => (targetSubject.trim() ? [targetSubject.trim()] : []),
    [targetSubject]
  );
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [preferredSchedule, setPreferredSchedule] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState('');
  const [address, setAddress] = useState('');
  const [certificatesAndBenefits, setCertificatesAndBenefits] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [fatherPhone, setFatherPhone] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('NONE');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<LeadStatus>('WAITING_GROUP');

  // Form error and toast notifications
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => setSuccessToast(null), 4000);
    return () => clearTimeout(timer);
  }, [successToast]);

  // Existing Student Autocomplete & Pre-fill state
  const [selectedExistingStudentId, setSelectedExistingStudentId] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [showStudentPickerDropdown, setShowStudentPickerDropdown] = useState<boolean>(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);

  // Enrollment Modal states (Multi-Course & Selective Enrollment)
  // Map of courseId -> remainingLessonsCount (defaults to 12)
  const [selectedCoursesMap, setSelectedCoursesMap] = useState<Record<string, number>>({});
  const [enrollSearch, setEnrollSearch] = useState<string>('');
  const [enrollSubjectTab, setEnrollSubjectTab] = useState<string>('ALL'); // 'ALL' or specific subject name

  // Matching existing students for dropdown search bar
  const filteredExistingStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return students.slice(0, 10);
    const q = studentSearchQuery.toLowerCase();
    const cleanDigits = studentSearchQuery.replace(/\D/g, '');
    return students.filter((s) => {
      const matchName = s.fullName.toLowerCase().includes(q);
      const sDigits = (s.phone || '').replace(/\D/g, '');
      const matchPhone = cleanDigits.length >= 3 && sDigits.includes(cleanDigits);
      return matchName || matchPhone;
    }).slice(0, 10);
  }, [students, studentSearchQuery]);

  // Live matching when user types into fullName or phone input directly
  const matchedStudentsFromInput = useMemo(() => {
    if (selectedExistingStudentId) return [];
    const cleanName = fullName.trim().toLowerCase();
    const cleanDigits = phone.replace(/\D/g, '');
    if (cleanName.length < 3 && cleanDigits.length < 6) return [];

    return students.filter((s) => {
      const matchName = cleanName.length >= 3 && s.fullName.toLowerCase().includes(cleanName);
      const sDigits = (s.phone || '').replace(/\D/g, '');
      const matchPhone = cleanDigits.length >= 6 && sDigits.includes(cleanDigits);
      return matchName || matchPhone;
    }).slice(0, 4);
  }, [students, fullName, phone, selectedExistingStudentId]);

  // Active courses of selected existing student
  const existingStudentActiveCourses = useMemo(() => {
    if (!selectedExistingStudentId) return [];
    const st = students.find((s) => s.id === selectedExistingStudentId);
    if (!st) return [];
    return courses.filter((c) => (st.enrolledCourseIds || []).includes(c.id));
  }, [students, courses, selectedExistingStudentId]);

  // Select existing student and auto-fill all data
  const handleSelectExistingStudent = (st: Student) => {
    setSelectedExistingStudentId(st.id);
    setFullName(st.fullName);
    setPhone(formatUzbekPhoneInput(st.phone, false));
    setSecondaryPhone(st.secondaryPhone ? formatUzbekPhoneInput(st.secondaryPhone, true) : '');
    setBirthDate(st.birthDate || '2009-03-10');
    setSchoolName(st.schoolName || '');
    setGrade(st.grade || '');
    setAddress(st.address || '');
    setCertificatesAndBenefits(st.certificatesAndBenefits || '');
    setFatherName(st.fatherName || '');
    setFatherPhone(st.fatherPhone ? formatUzbekPhoneInput(st.fatherPhone, true) : '');
    setMotherName(st.motherName || '');
    setMotherPhone(st.motherPhone ? formatUzbekPhoneInput(st.motherPhone, true) : '');
    setDiscountType(st.discountType || 'NONE');
    setDiscountValue(st.discountValue || 0);

    const stCourses = courses.filter((c) => (st.enrolledCourseIds || []).includes(c.id));
    const courseTitles = stCourses.map((c) => c.title).join(', ');
    const noteText = courseTitles
      ? `Действующий ученик из базы (текущие курсы: ${courseTitles}). Запись на новый предмет до открытия группы.`
      : 'Действующий ученик из базы. Запись на новый предмет до открытия группы.';

    setNotes((prev) => (prev ? `${prev} | ${noteText}` : noteText));
    setShowStudentPickerDropdown(false);
    setStudentSearchQuery('');
  };

  const handleResetExistingStudent = () => {
    setSelectedExistingStudentId(null);
    setStudentSearchQuery('');
    setShowStudentPickerDropdown(false);
  };

  // Helper to get normalized subjects array from a lead
  const getLeadSubjects = (lead: Lead): string[] => {
    if (lead.targetSubjects && lead.targetSubjects.length > 0) {
      return lead.targetSubjects.filter(Boolean);
    }
    if (lead.targetSubject) {
      return lead.targetSubject
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  };

  // Available Subjects: strictly from Subjects Database (база предметов)
  const availableSubjectNames = useMemo(() => {
    const set = new Set<string>();
    (subjects || []).forEach((s) => {
      if (s.name && s.name.trim()) set.add(s.name.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [subjects]);

  // Count leads for each subject from the database
  const subjectLeadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((lead) => {
      const subs = getLeadSubjects(lead);
      subs.forEach((sub) => {
        const trimmed = sub.trim();
        if (trimmed) {
          const matched = availableSubjectNames.find(
            (sName) => sName.toLowerCase() === trimmed.toLowerCase()
          );
          if (matched) {
            counts[matched] = (counts[matched] || 0) + 1;
          } else {
            counts[trimmed] = (counts[trimmed] || 0) + 1;
          }
        }
      });
    });
    return counts;
  }, [leads, availableSubjectNames]);

  const handleOpenAddLeadModal = () => {
    setEditingLeadId(null);
    setSelectedExistingStudentId(null);
    setStudentSearchQuery('');
    setShowStudentPickerDropdown(false);
    setFormError(null);
    setFullName('');
    setPhone('+998 ');
    setSecondaryPhone('');
    setBirthDate('2009-03-10');
    setTargetSubject('');
    setCustomSubjectInput('');
    setPreferredSchedule('');
    setSchoolName('');
    setGrade('');
    setAddress('');
    setCertificatesAndBenefits('');
    setFatherName('');
    setFatherPhone('');
    setMotherName('');
    setMotherPhone('');
    setDiscountType('NONE');
    setDiscountValue(0);
    setNotes('');
    setStatus('WAITING_GROUP');
    setShowAddLeadModal(true);
  };

  const handleOpenEditLeadModal = (lead: Lead) => {
    setEditingLeadId(lead.id);
    setSelectedExistingStudentId(lead.enrolledStudentId || null);
    setStudentSearchQuery('');
    setShowStudentPickerDropdown(false);
    setFormError(null);
    setFullName(lead.fullName || '');
    setPhone(formatUzbekPhoneInput(lead.phone || '', false));
    setSecondaryPhone(lead.secondaryPhone ? formatUzbekPhoneInput(lead.secondaryPhone, true) : '');
    setBirthDate(lead.birthDate || '2009-03-10');
    const subs = getLeadSubjects(lead);
    setTargetSubject(subs[0] || lead.targetSubject || '');
    setCustomSubjectInput('');
    setPreferredSchedule(lead.preferredSchedule || '');
    setSchoolName(lead.schoolName || '');
    setGrade(lead.grade || '');
    setAddress(lead.address || '');
    setCertificatesAndBenefits(lead.certificatesAndBenefits || '');
    setFatherName(lead.fatherName || '');
    setFatherPhone(lead.fatherPhone ? formatUzbekPhoneInput(lead.fatherPhone, true) : '');
    setMotherName(lead.motherName || '');
    setMotherPhone(lead.motherPhone ? formatUzbekPhoneInput(lead.motherPhone, true) : '');
    setDiscountType(lead.discountType || 'NONE');
    setDiscountValue(lead.discountValue || 0);
    setNotes(lead.notes || '');
    setStatus(lead.status || 'WAITING_GROUP');
    setShowAddLeadModal(true);
  };

  // Select single subject for the lead
  const handleSelectSubject = (sName: string) => {
    const trimmed = sName.trim();
    setFormError(null);
    if (targetSubject.toLowerCase() === trimmed.toLowerCase()) {
      setTargetSubject('');
    } else {
      setTargetSubject(trimmed);
      setCustomSubjectInput('');
    }
  };

  const handleAddCustomSubject = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customSubjectInput.trim();
    if (!trimmed) return;
    setFormError(null);
    setTargetSubject(trimmed);
    setCustomSubjectInput('');
  };

  const handleSaveLead = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const formattedTargetSubjectString = (targetSubject.trim() || customSubjectInput.trim()).trim();

    if (!fullName.trim()) {
      setFormError('Пожалуйста, укажите ФИО ученика!');
      return;
    }

    const cleanDigits = phone.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 9) {
      setFormError('Пожалуйста, укажите корректный номер телефона ученика (например, +998 90 123 45 67)!');
      return;
    }

    if (!formattedTargetSubjectString) {
      setFormError('Пожалуйста, выберите предмет для заявки из списка или укажите в поле «Свой предмет»!');
      return;
    }

    const isFictionalOrEmpty = (str: string) => {
      const s = str.trim();
      if (!s) return true;
      if (/^иванов/i.test(s) || /^иванова/i.test(s) || s.toLowerCase() === 'не указано') return true;
      return false;
    };
    const isValidParentPhone = (ph: string) => {
      const digits = ph.replace(/\D/g, '');
      return digits.length >= 9;
    };

    const cleanSecondaryPhone = secondaryPhone.trim() || undefined;
    const cleanFatherName = isFictionalOrEmpty(fatherName) ? undefined : fatherName.trim();
    const cleanFatherPhone = isValidParentPhone(fatherPhone) ? fatherPhone.trim() : undefined;
    const cleanMotherName = isFictionalOrEmpty(motherName) ? undefined : motherName.trim();
    const cleanMotherPhone = isValidParentPhone(motherPhone) ? motherPhone.trim() : undefined;

    if (editingLeadId) {
      const existing = leads.find((l) => l.id === editingLeadId);
      if (existing) {
        const updated: Lead = {
          ...existing,
          fullName: fullName.trim(),
          phone: phone.trim(),
          secondaryPhone: cleanSecondaryPhone,
          birthDate,
          targetSubject: formattedTargetSubjectString,
          targetSubjects: [formattedTargetSubjectString],
          preferredSchedule: preferredSchedule.trim() || undefined,
          schoolName: schoolName.trim() || undefined,
          grade: grade.trim() || undefined,
          address: address.trim() || undefined,
          certificatesAndBenefits: certificatesAndBenefits.trim() || undefined,
          fatherName: cleanFatherName,
          fatherPhone: cleanFatherPhone,
          motherName: cleanMotherName,
          motherPhone: cleanMotherPhone,
          discountType,
          discountValue,
          notes: notes.trim() || undefined,
          status,
          enrolledStudentId: selectedExistingStudentId || existing.enrolledStudentId || undefined,
        };
        if (onUpdateLead) {
          onUpdateLead(updated);
        } else {
          onAddLead(updated);
        }
        setSuccessToast(`Данные заявки по предмету "${formattedTargetSubjectString}" для "${fullName.trim()}" успешно сохранены!`);
      }
    } else {
      const newLead: Lead = {
        id: `lead-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fullName: fullName.trim(),
        phone: phone.trim(),
        secondaryPhone: cleanSecondaryPhone,
        birthDate,
        targetSubject: formattedTargetSubjectString,
        targetSubjects: [formattedTargetSubjectString],
        preferredSchedule: preferredSchedule.trim() || undefined,
        schoolName: schoolName.trim() || undefined,
        grade: grade.trim() || undefined,
        address: address.trim() || undefined,
        certificatesAndBenefits: certificatesAndBenefits.trim() || undefined,
        fatherName: cleanFatherName,
        fatherPhone: cleanFatherPhone,
        motherName: cleanMotherName,
        motherPhone: cleanMotherPhone,
        discountType,
        discountValue,
        notes: notes.trim() || undefined,
        status: status || 'WAITING_GROUP',
        createdAt: getUzbekistanISOString(),
        enrolledCourseIds: [],
        enrolledStudentId: selectedExistingStudentId || undefined,
      };
      onAddLead(newLead);
      setSuccessToast(`Новая заявка по предмету "${formattedTargetSubjectString}" для "${fullName.trim()}" успешно сохранена!`);
    }

    // Reset filters so the new lead is immediately visible
    setSearchTerm('');
    setStatusFilter('ALL');
    setSubjectFilter('ALL');
    setShowAddLeadModal(false);
  };

  // Helper to save current single subject lead and immediately start adding another subject for the same student
  const handleSaveAndAddAnotherSubject = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const savedSubject = (targetSubject.trim() || customSubjectInput.trim()).trim();

    if (!fullName.trim()) {
      setFormError('Пожалуйста, укажите ФИО ученика!');
      return;
    }

    const cleanDigits = phone.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 9) {
      setFormError('Пожалуйста, укажите корректный номер телефона ученика (например, +998 90 123 45 67)!');
      return;
    }

    if (!savedSubject) {
      setFormError('Пожалуйста, выберите предмет для текущей заявки!');
      return;
    }

    const cleanSecondaryPhone = secondaryPhone.trim() || undefined;
    const isFictionalOrEmpty2 = (str: string) => {
      const s = str.trim();
      if (!s) return true;
      if (/^иванов/i.test(s) || /^иванова/i.test(s) || s.toLowerCase() === 'не указано') return true;
      return false;
    };
    const isValidParentPhone2 = (ph: string) => {
      const digits = ph.replace(/\D/g, '');
      return digits.length >= 9;
    };

    const cleanFatherName = isFictionalOrEmpty2(fatherName) ? undefined : fatherName.trim();
    const cleanFatherPhone = isValidParentPhone2(fatherPhone) ? fatherPhone.trim() : undefined;
    const cleanMotherName = isFictionalOrEmpty2(motherName) ? undefined : motherName.trim();
    const cleanMotherPhone = isValidParentPhone2(motherPhone) ? motherPhone.trim() : undefined;

    const newLead: Lead = {
      id: `lead-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fullName: fullName.trim(),
      phone: phone.trim(),
      secondaryPhone: cleanSecondaryPhone,
      birthDate,
      targetSubject: savedSubject,
      targetSubjects: [savedSubject],
      preferredSchedule: preferredSchedule.trim() || undefined,
      schoolName: schoolName.trim() || undefined,
      grade: grade.trim() || undefined,
      address: address.trim() || undefined,
      certificatesAndBenefits: certificatesAndBenefits.trim() || undefined,
      fatherName: cleanFatherName,
      fatherPhone: cleanFatherPhone,
      motherName: cleanMotherName,
      motherPhone: cleanMotherPhone,
      discountType,
      discountValue,
      notes: notes.trim() || undefined,
      status: 'WAITING_GROUP',
      createdAt: getUzbekistanISOString(),
      enrolledCourseIds: [],
      enrolledStudentId: selectedExistingStudentId || undefined,
    };
    onAddLead(newLead);

    // Keep student contact details, but reset subject and schedule for next lead
    setTargetSubject('');
    setCustomSubjectInput('');
    setPreferredSchedule('');
    setSuccessToast(`Заявка по предмету "${savedSubject}" для "${fullName.trim()}" сохранена! Выберите следующий предмет.`);
  };

  const handleDeleteLeadClick = (lead: Lead) => {
    setLeadToDelete(lead);
  };

  // OPEN ENROLLMENT MODAL WITH SELECTIVE MULTI-SUBJECT ENROLLMENT
  const handleOpenEnrollModal = (lead: Lead) => {
    setEnrollLeadModal(lead);
    setEnrollSearch('');

    const leadSubs = getLeadSubjects(lead);
    // Find matching courses for the first subject if any
    const firstSub = leadSubs[0];
    const initialMap: Record<string, number> = {};

    // Auto-select first matching course as a convenient starting suggestion
    if (firstSub) {
      setEnrollSubjectTab(firstSub);
      const matchingCourses = courses.filter((c) =>
        c.subject.toLowerCase().includes(firstSub.toLowerCase()) ||
        firstSub.toLowerCase().includes(c.subject.toLowerCase())
      );
      if (matchingCourses.length > 0) {
        initialMap[matchingCourses[0].id] = 12;
      }
    } else {
      setEnrollSubjectTab('ALL');
      if (courses.length > 0) {
        initialMap[courses[0].id] = 12;
      }
    }

    setSelectedCoursesMap(initialMap);
  };

  // Toggle course selection in enroll modal
  const handleToggleCourseForEnroll = (courseId: string) => {
    setSelectedCoursesMap((prev) => {
      const updated = { ...prev };
      if (updated[courseId] !== undefined) {
        delete updated[courseId];
      } else {
        updated[courseId] = 12;
      }
      return updated;
    });
  };

  // Update remaining lessons for a specific course in enroll modal
  const handleSetCourseLessons = (courseId: string, lessons: number) => {
    setSelectedCoursesMap((prev) => ({
      ...prev,
      [courseId]: Math.max(1, Math.min(12, lessons)),
    }));
  };

  // Confirm selective enrollment
  const handleConfirmEnrollLead = () => {
    const selectedEntries = Object.entries(selectedCoursesMap);
    if (!enrollLeadModal || selectedEntries.length === 0) {
      alert('Пожалуйста, выберите хотя бы одну группу для зачисления ученика!');
      return;
    }

    const itemsToEnroll = selectedEntries.map(([courseId, lessons]) => ({
      courseId,
      remainingLessonsCount: lessons,
    }));

    if (onConvertLeadToStudent) {
      onConvertLeadToStudent(enrollLeadModal, itemsToEnroll);
    }
    setEnrollLeadModal(null);
  };

  // Filtered Leads in main table - Sort newest orders at the top
  const filteredLeads = useMemo(() => {
    return leads
      .filter((l) => {
        const term = searchTerm.toLowerCase();
        const subs = getLeadSubjects(l);
        const matchesSearch =
          !term ||
          l.fullName.toLowerCase().includes(term) ||
          (l.phone && l.phone.includes(searchTerm)) ||
          (l.secondaryPhone && l.secondaryPhone.includes(searchTerm)) ||
          (l.targetSubject && l.targetSubject.toLowerCase().includes(term)) ||
          subs.some((s) => s.toLowerCase().includes(term)) ||
          (l.schoolName && l.schoolName.toLowerCase().includes(term)) ||
          (l.grade && l.grade.toLowerCase().includes(term)) ||
          (l.notes && l.notes.toLowerCase().includes(term));

        const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter;

        const matchesSubject =
          subjectFilter === 'ALL' ||
          subs.some(
            (s) =>
              s.trim().toLowerCase() === subjectFilter.trim().toLowerCase() ||
              s.trim().toLowerCase().includes(subjectFilter.trim().toLowerCase())
          ) ||
          (l.targetSubject &&
            l.targetSubject.toLowerCase().includes(subjectFilter.trim().toLowerCase()));

        return matchesSearch && matchesStatus && matchesSubject;
      })
      .sort((a, b) => {
        // Newest orders on top, oldest at the bottom
        const dateA = a.createdAt || '';
        const dateB = b.createdAt || '';
        if (dateB !== dateA) {
          return dateB.localeCompare(dateA);
        }
        return b.id.localeCompare(a.id);
      });
  }, [leads, searchTerm, statusFilter, subjectFilter]);

  // Stats
  const waitingCount = leads.filter((l) => l.status === 'WAITING_GROUP').length;
  const newCount = leads.filter((l) => l.status === 'NEW').length;
  const partiallyEnrolledCount = leads.filter((l) => l.status === 'PARTIALLY_ENROLLED').length;
  const enrolledCount = leads.filter((l) => l.status === 'ENROLLED').length;

  // Selected Lead Details in Enrollment Modal
  const modalLeadSubjects = enrollLeadModal ? getLeadSubjects(enrollLeadModal) : [];
  const modalEnrolledCourseIds = enrollLeadModal?.enrolledCourseIds || (enrollLeadModal?.enrolledCourseId ? [enrollLeadModal.enrolledCourseId] : []);

  // Filter available courses inside enrollment modal
  const availableEnrollmentCourses = useMemo(() => {
    if (!enrollLeadModal) return [];

    const search = enrollSearch.toLowerCase().trim();

    return courses.filter((c) => {
      const teacher = teachers.find((t) => t.id === c.teacherId);
      const teacherName = teacher?.fullName || '';

      const cabinet = cabinets.find((cab) => cab.id === c.cabinetId);
      const cabinetName = cabinet?.roomNumber || '';

      const matchesSearch =
        !search ||
        c.title.toLowerCase().includes(search) ||
        c.subject.toLowerCase().includes(search) ||
        teacherName.toLowerCase().includes(search) ||
        cabinetName.toLowerCase().includes(search) ||
        c.daysOfWeek.join(' ').toLowerCase().includes(search);

      // Subject Filter Tab
      let matchesTab = true;
      if (enrollSubjectTab !== 'ALL') {
        matchesTab =
          c.subject.toLowerCase().includes(enrollSubjectTab.toLowerCase()) ||
          enrollSubjectTab.toLowerCase().includes(c.subject.toLowerCase());
      }

      return matchesSearch && matchesTab;
    });
  }, [courses, enrollLeadModal, enrollSearch, enrollSubjectTab, teachers, cabinets]);

  // Financial Calculations for all selected courses in Enroll modal
  const todayDayOfMonth = new Date().getDate();
  const selectedCoursesList = useMemo(() => {
    return Object.entries(selectedCoursesMap).map(([courseId, lessons]) => {
      const lessonsCount = Number(lessons) || 12;
      const courseObj = courses.find((c) => c.id === courseId);
      const calc = courseObj && enrollLeadModal
        ? calculateFirstMonthTuition(
            courseObj.monthlyPrice,
            lessonsCount,
            12,
            enrollLeadModal.discountType || 'NONE',
            enrollLeadModal.discountValue || 0,
            todayDayOfMonth
          )
        : null;
      return {
        courseId,
        course: courseObj,
        lessons: lessonsCount,
        calc,
      };
    }).filter((item) => !!item.course && !!item.calc);
  }, [selectedCoursesMap, courses, enrollLeadModal, todayDayOfMonth]);

  const totalFullPrice = selectedCoursesList.reduce((sum, item) => sum + (item.course?.monthlyPrice || 0), 0);
  const totalDiscount = selectedCoursesList.reduce((sum, item) => sum + (item.calc?.discountAmount || 0), 0);
  const totalFinalAmountDue = selectedCoursesList.reduce((sum, item) => sum + (item.calc?.finalAmountDue || 0), 0);

  return (
    <div className="space-y-5 relative">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-5 right-5 z-[100] max-w-md bg-emerald-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2.5 animate-in slide-in-from-top-4 border border-emerald-500">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <span className="leading-snug">{successToast}</span>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="ml-auto text-emerald-200 hover:text-white pl-2 text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Всего заявок</p>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">{leads.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-amber-200 p-4 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Ожидают группу</p>
            <p className="text-xl font-extrabold text-amber-900 mt-0.5">{waitingCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock3 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-cyan-200 p-4 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-700">Частично зачислены</p>
            <p className="text-xl font-extrabold text-cyan-900 mt-0.5">{partiallyEnrolledCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-emerald-200 p-4 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Зачислены полностью</p>
            <p className="text-xl font-extrabold text-emerald-900 mt-0.5">{enrolledCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Header Controls & Filters */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <Clock3 className="w-5 h-5 text-amber-500" />
              <span>Лиды и Предзаписи (Мульти-предметная запись)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ученики могут записаться сразу на несколько предметов (например, Математика + Физика + Английский). Зачисление можно производить выборочно на любой предмет.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {leads.length > 0 && onClearLeads && (
              <button
                type="button"
                onClick={() => {
                  const inputPass = prompt('Для подтверждения очистки базы предзаписей введите пароль безопасности:');
                  if (inputPass === '123456789') {
                    onClearLeads();
                  } else if (inputPass !== null) {
                    alert('Неверный пароль безопасности! Очистка отменена.');
                  }
                }}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-all shrink-0 cursor-pointer"
                title="Очистить все предзаписи"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Очистить базу</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenAddLeadModal}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-md shadow-amber-500/20 transition-all shrink-0 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Добавить Лид / Запись</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск по ФИО и телефону ученика..."
              className="w-full bg-slate-50 text-xs text-slate-800 pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-700 font-bold focus:outline-none"
            >
              <option value="ALL">Все статусы заявок</option>
              <option value="WAITING_GROUP">⏳ Ожидают группу ({waitingCount})</option>
              <option value="PARTIALLY_ENROLLED">⚡ Частично зачислены ({partiallyEnrolledCount})</option>
              <option value="NEW">🔔 Новые обращения ({newCount})</option>
              <option value="ENROLLED">✓ Зачислены полностью ({enrolledCount})</option>
              <option value="CANCELLED">✕ Отмененные</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <Tag className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-700 font-bold focus:outline-none"
            >
              <option value="ALL">Все предметы (Все записи: {leads.length})</option>
              {availableSubjectNames.map((sName) => (
                <option key={sName} value={sName}>
                  {sName} ({subjectLeadCounts[sName] || 0})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Filter by Subject: All records or by specific subjects */}
        <div className="pt-2.5 border-t border-slate-100 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs font-extrabold text-slate-800">
                Фильтрация по предметам:
              </span>
              <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                (нажмите на предмет для просмотра или «Все записи»)
              </span>
            </div>

            {subjectFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSubjectFilter('ALL')}
                className="text-[11px] text-amber-600 hover:text-amber-700 hover:underline font-bold flex items-center space-x-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Сбросить фильтр предметов</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-200">
            {/* All records button */}
            <button
              type="button"
              onClick={() => setSubjectFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer shrink-0 ${
                subjectFilter === 'ALL'
                  ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-400/40'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>Все записи</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                  subjectFilter === 'ALL'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {leads.length}
              </span>
            </button>

            {/* Subject buttons */}
            {availableSubjectNames.map((sName) => {
              const isSelected = subjectFilter.toLowerCase() === sName.toLowerCase();
              const count = subjectLeadCounts[sName] || 0;

              return (
                <button
                  key={sName}
                  type="button"
                  onClick={() => setSubjectFilter(isSelected ? 'ALL' : sName)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-400/40'
                      : count > 0
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200/80'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/70'
                  }`}
                  title={`Показать записи по предмету: ${sName}`}
                >
                  <span>{sName}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : count > 0
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Subject Filter Banner */}
      {subjectFilter !== 'ALL' && (
        <div className="bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-2xs animate-in fade-in">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Показаны записи по предмету:</span>
            <span className="px-2.5 py-0.5 bg-amber-500 text-white rounded-lg font-extrabold text-xs shadow-2xs">
              {subjectFilter}
            </span>
            <span className="text-amber-800 font-medium">
              (найдено: {filteredLeads.length} из {leads.length})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSubjectFilter('ALL')}
            className="px-3 py-1 bg-white hover:bg-amber-100 text-amber-800 font-bold rounded-lg border border-amber-300 transition-all cursor-pointer shadow-2xs shrink-0"
          >
            Показать все записи ({leads.length})
          </button>
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Ученик / Лид</th>
                <th className="py-3.5 px-4">Предмет Заявки & График</th>
                <th className="py-3.5 px-4">Школа, Класс & Адрес</th>
                <th className="py-3.5 px-4">Контакты (+998)</th>
                <th className="py-3.5 px-4">Заметки / Пожелания</th>
                <th className="py-3.5 px-4 text-center">Статус</th>
                <th className="py-3.5 px-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                    {subjectFilter !== 'ALL' ? (
                      <div className="space-y-3 max-w-md mx-auto">
                        <p className="text-sm font-semibold text-slate-600">
                          По предмету «{subjectFilter}» не найдено ни одной заявки.
                        </p>
                        <button
                          type="button"
                          onClick={() => setSubjectFilter('ALL')}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-xs cursor-pointer inline-flex items-center space-x-1.5"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Показать все записи ({leads.length})</span>
                        </button>
                      </div>
                    ) : (
                      'Заявки лидов не найдены. Нажмите «+ Добавить Лид / Запись», чтобы зарегистрировать интерес ученика.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const subs = getLeadSubjects(lead);
                  const enrolledCourseIds = lead.enrolledCourseIds || (lead.enrolledCourseId ? [lead.enrolledCourseId] : []);
                  const enrolledCourseObjects = courses.filter((c) => enrolledCourseIds.includes(c.id));
                  const cleanLeadPhone = (lead.phone || '').replace(/\D/g, '');
                  const existingStudent = students.find(
                    (s) =>
                      s.id === lead.enrolledStudentId ||
                      (cleanLeadPhone.length >= 7 && (s.phone || '').replace(/\D/g, '') === cleanLeadPhone)
                  );
                  const existingStudentCourses = existingStudent
                    ? courses.filter((c) => (existingStudent.enrolledCourseIds || []).includes(c.id))
                    : [];

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Name & Age */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5">
                            <p className="font-bold text-slate-900 text-sm">{lead.fullName}</p>
                            {existingStudent && (
                              <span
                                className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold shrink-0"
                                title={`Действующий ученик центра (ID: ${existingStudent.id})`}
                              >
                                <UserCheck className="w-3 h-3 text-blue-600" />
                                <span>Из базы</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Д/р: {lead.birthDate || 'Не указана'}
                          </p>
                          {existingStudentCourses.length > 0 && (
                            <p className="text-[10px] text-blue-700 bg-blue-50/70 px-1.5 py-0.5 rounded border border-blue-200 font-medium">
                              Текущие курсы: {existingStudentCourses.map((c) => c.title).join(', ')}
                            </p>
                          )}
                          {lead.certificatesAndBenefits && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
                              <Award className="w-3 h-3 text-purple-600" />
                              <span className="truncate max-w-[140px]">{lead.certificatesAndBenefits}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Multi-Subject Badges & Schedule */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {subs.length === 0 ? (
                              <span className="text-slate-400 italic text-[11px]">Предмет не указан</span>
                            ) : (
                              subs.map((sName, sIdx) => {
                                const isSubjectEnrolled = enrolledCourseObjects.some(
                                  (ec) =>
                                    ec.subject.toLowerCase().includes(sName.toLowerCase()) ||
                                    sName.toLowerCase().includes(ec.subject.toLowerCase())
                                );
                                const isCurrentFilter = subjectFilter.toLowerCase() === sName.toLowerCase();

                                return (
                                  <button
                                    key={`${sName}-${sIdx}`}
                                    type="button"
                                    onClick={() => setSubjectFilter(isCurrentFilter ? 'ALL' : sName)}
                                    title={`Нажмите, чтобы фильтровать по предмету "${sName}"`}
                                    className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg border font-extrabold text-[11px] transition-all cursor-pointer ${
                                      isCurrentFilter
                                        ? 'ring-2 ring-amber-500 bg-amber-500 text-white border-amber-600 shadow-2xs'
                                        : isSubjectEnrolled
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 shadow-2xs'
                                        : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                                    }`}
                                  >
                                    {isSubjectEnrolled ? (
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Clock className="w-3 h-3 text-amber-500" />
                                    )}
                                    <span>{sName}</span>
                                  </button>
                                );
                              })
                            )}
                          </div>

                          {enrolledCourseObjects.length > 0 && (
                            <div className="text-[10px] text-emerald-700 font-medium flex flex-wrap gap-1 items-center">
                              <span>Зачислен в:</span>
                              {enrolledCourseObjects.map((ec, ecIdx) => (
                                <span
                                  key={`${lead.id}-${ec.id}-${ecIdx}`}
                                  className="px-1.5 py-0.2 rounded bg-emerald-100/70 border border-emerald-300 font-bold"
                                >
                                  {ec.title}
                                </span>
                              ))}
                            </div>
                          )}

                          {lead.preferredSchedule && (
                            <p className="text-[11px] text-slate-500 flex items-center space-x-1 font-medium">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{lead.preferredSchedule}</span>
                            </p>
                          )}
                        </div>
                      </td>

                      {/* School & Address */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 text-slate-600">
                          {lead.schoolName || lead.grade ? (
                            <p className="font-semibold text-slate-800 flex items-center space-x-1">
                              <School className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span>
                                {lead.schoolName || 'Школа'} {lead.grade ? `(${lead.grade})` : ''}
                              </span>
                            </p>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Школа не указана</span>
                          )}
                          {lead.address && (
                            <p className="text-[11px] text-slate-500 flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[150px]">{lead.address}</span>
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Contacts */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1 text-slate-600">
                          <p className="font-bold text-slate-800 font-mono text-[11px] flex items-center space-x-1">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{formatDisplayPhone(lead.phone)}</span>
                          </p>
                          {lead.secondaryPhone && (
                            <p
                              className="text-[10px] text-blue-700 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 inline-block"
                              title="Дополнительный номер"
                            >
                              Доп: {formatDisplayPhone(lead.secondaryPhone)}
                            </p>
                          )}
                          {lead.fatherPhone && (
                            <p className="text-[10px] text-slate-500 font-mono">
                              Отец: {formatDisplayPhone(lead.fatherPhone)}
                            </p>
                          )}
                          {lead.motherPhone && (
                            <p className="text-[10px] text-slate-500 font-mono">
                              Мать: {formatDisplayPhone(lead.motherPhone)}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-[11px] text-slate-600 line-clamp-2 italic">
                          {lead.notes || '—'}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {lead.status === 'WAITING_GROUP' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[11px]">
                            <Clock3 className="w-3 h-3 text-amber-600" />
                            <span>Ждет группу</span>
                          </span>
                        )}
                        {lead.status === 'PARTIALLY_ENROLLED' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-800 font-extrabold text-[11px]">
                            <Layers className="w-3 h-3 text-cyan-600" />
                            <span>
                              Зачислен ({enrolledCourseObjects.length}/{subs.length})
                            </span>
                          </span>
                        )}
                        {lead.status === 'NEW' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-extrabold text-[11px]">
                            <span>Новый</span>
                          </span>
                        )}
                        {lead.status === 'ENROLLED' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Зачислен</span>
                          </span>
                        )}
                        {lead.status === 'CANCELLED' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-extrabold text-[11px]">
                            <span>Отменен</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEnrollModal(lead)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
                            title="Выбрать предмет и зачислить ученика в группу"
                          >
                            <BookPlus className="w-3.5 h-3.5" />
                            <span>{enrolledCourseObjects.length > 0 ? '+ Зачислить еще' : 'Зачислить'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditLeadModal(lead)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Редактировать лида"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteLeadClick(lead)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Удалить заявку"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT LEAD MODAL WITH MULTI-SUBJECT SELECTION */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <Clock3 className="w-5 h-5 text-amber-500" />
                <span>
                  {editingLeadId
                    ? 'Редактирование Лида / Предзаписи'
                    : 'Новый Лид / Запись на несколько курсов'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddLeadModal(false)}
                className="text-slate-400 hover:text-slate-600 font-mono text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="space-y-4 text-xs">
              {/* Form Validation Error Banner */}
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex items-center space-x-2.5 font-bold animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Top Section: Search & Auto-fill from Existing Students */}
              {selectedExistingStudentId ? (
                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 shadow-2xs">
                  <div className="flex items-start space-x-2.5">
                    <UserCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-emerald-950 text-xs">
                          Ученик выбран из базы данных центра: {fullName}
                        </span>
                        <span className="px-1.5 py-0.2 bg-emerald-200/80 text-emerald-800 rounded font-bold text-[10px]">
                          ID: {selectedExistingStudentId}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        Все личные данные, телефон, школа и контакты родителей автоматически подставлены.
                      </p>
                      {existingStudentActiveCourses.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[10px] font-bold text-emerald-900">Уже обучается на:</span>
                          {existingStudentActiveCourses.map((c, cIdx) => (
                            <span
                              key={`${c.id}-${cIdx}`}
                              className="text-[10px] bg-white border border-emerald-300 text-emerald-800 px-2 py-0.5 rounded-md font-semibold"
                            >
                              {c.title}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-emerald-700 italic pt-0.5">
                        👉 Выберите ниже новый желаемый предмет, на который ученик хочет записаться (в лист ожидания новой группы).
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetExistingStudent}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-white hover:bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-xl transition-all shrink-0 cursor-pointer self-end sm:self-start"
                  >
                    ✕ Сбросить автозаполнение
                  </button>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-200 rounded-2xl p-3.5 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="font-extrabold text-blue-950 text-xs">
                        Ученик уже есть в базе центра? (Автозаполнение на другой предмет)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-blue-700 bg-white border border-blue-200 px-2 py-0.5 rounded-md">
                      В реестре: {students.length} уч.
                    </span>
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={studentSearchQuery}
                      onChange={(e) => {
                        setStudentSearchQuery(e.target.value);
                        setShowStudentPickerDropdown(true);
                      }}
                      onFocus={() => setShowStudentPickerDropdown(true)}
                      placeholder="Быстрый поиск по ФИО или номеру телефона для автозаполнения..."
                      className="w-full bg-white text-slate-900 font-medium text-xs pl-9 pr-8 py-2 rounded-xl border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                    />
                    {studentSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setStudentSearchQuery('');
                          setShowStudentPickerDropdown(false);
                        }}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        ✕
                      </button>
                    )}

                    {/* Dropdown with results */}
                    {showStudentPickerDropdown && filteredExistingStudents.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {filteredExistingStudents.map((st) => {
                          const stCourses = courses.filter((c) => (st.enrolledCourseIds || []).includes(c.id));
                          return (
                            <div
                              key={st.id}
                              onClick={() => handleSelectExistingStudent(st)}
                              className="p-2.5 hover:bg-blue-50/80 transition-all cursor-pointer flex items-center justify-between gap-2"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-slate-900 text-xs">{st.fullName}</span>
                                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    {formatDisplayPhone(st.phone)}
                                  </span>
                                </div>
                                {stCourses.length > 0 && (
                                  <p className="text-[10px] text-slate-500">
                                    Текущие курсы:{' '}
                                    <strong className="text-slate-700">
                                      {stCourses.map((c) => c.title).join(', ')}
                                    </strong>
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg shrink-0 transition-all shadow-2xs"
                              >
                                Выбрать ➔
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section 1: Lead Details & Single-Subject Selection */}
              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/80 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-amber-950 text-xs flex items-center space-x-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-600" />
                    <span>Предмет заявки и ученик</span>
                  </h4>
                  <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md font-bold">
                    {targetSubject ? `Предмет: ${targetSubject}` : 'Предмет не выбран'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">ФИО Ученика *</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Введите ФИО ученика..."
                      className="w-full bg-white text-slate-900 font-semibold p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Основной телефон ученика (+998) *
                    </label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(formatUzbekPhoneInput(e.target.value, false))}
                      placeholder="+998 90 123 45 67"
                      className="w-full bg-white text-slate-900 font-mono font-bold p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Live matching suggestion banner if matching students detected */}
                  {matchedStudentsFromInput.length > 0 && !selectedExistingStudentId && (
                    <div className="col-span-1 sm:col-span-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl p-3 space-y-2 animate-in fade-in">
                      <div className="flex items-center space-x-2 text-amber-900">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="font-bold text-xs">
                          Найдено совпадение в базе действующих учеников:
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800">
                        Ученик уже есть в системе. Нажмите на карточку ниже для мгновенного автозаполнения:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {matchedStudentsFromInput.map((st) => {
                          const stCourses = courses.filter((c) => (st.enrolledCourseIds || []).includes(c.id));
                          return (
                            <div
                              key={st.id}
                              onClick={() => handleSelectExistingStudent(st)}
                              className="bg-white p-2.5 rounded-lg border border-amber-300 hover:border-amber-500 hover:bg-amber-50/50 cursor-pointer transition-all flex items-center justify-between shadow-2xs"
                            >
                              <div className="space-y-0.5">
                                <p className="font-bold text-slate-900 text-xs">{st.fullName}</p>
                                <p className="text-[10px] text-slate-500 font-mono">{formatDisplayPhone(st.phone)}</p>
                                {stCourses.length > 0 && (
                                  <p className="text-[10px] text-blue-600 truncate max-w-[180px]">
                                    {stCourses.map((c) => c.title).join(', ')}
                                  </p>
                                )}
                              </div>
                              <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                                Автозаполнить ⚡
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Дополнительный телефон (необязательно)
                    </label>
                    <input
                      type="text"
                      value={secondaryPhone}
                      onChange={(e) => setSecondaryPhone(formatUzbekPhoneInput(e.target.value, true))}
                      placeholder="+998 91 234 56 78 (2-й номер)"
                      className="w-full bg-white text-slate-900 font-mono p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Удобное время / график</label>
                    <input
                      type="text"
                      value={preferredSchedule}
                      onChange={(e) => setPreferredSchedule(e.target.value)}
                      placeholder="ПН-СР-ПТ после 16:00, ВТ-ЧТ-СБ..."
                      className="w-full bg-white text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* SINGLE-SUBJECT SELECTOR INTERFACE */}
                <div className="pt-2 border-t border-amber-200/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-slate-800 font-extrabold text-xs">
                        Желаемый предмет (для каждого предмета отдельная заявка) *
                      </label>
                      <p className="text-[10px] text-slate-500">
                        Выберите один предмет из списка курсов центра или укажите свой
                      </p>
                    </div>
                    {targetSubject && (
                      <button
                        type="button"
                        onClick={() => setTargetSubject('')}
                        className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                      >
                        Сбросить выбор
                      </button>
                    )}
                  </div>

                  {/* Selected Subject Banner */}
                  {targetSubject ? (
                    <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl shadow-xs border border-amber-600 animate-in zoom-in-95">
                      <div className="flex items-center space-x-2">
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span className="text-xs font-semibold">Выбранный предмет:</span>
                        <strong className="text-sm font-black bg-amber-700/60 px-2 py-0.5 rounded-lg">
                          {targetSubject}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTargetSubject('')}
                        className="hover:bg-amber-700 p-1 rounded-lg text-amber-100 hover:text-white transition-colors cursor-pointer"
                        title="Изменить предмет"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-white/80 border border-dashed border-amber-300 rounded-xl text-center text-amber-800/90 italic text-[11px]">
                      Выберите предмет кликом по кнопке ниже или укажите индивидуальное название
                    </div>
                  )}

                  {/* Available Subject Buttons Quick Toggle (Single Select) */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Предметы центра (нажмите для выбора):
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                      {availableSubjectNames.map((sName) => {
                        const isSelected =
                          targetSubject.toLowerCase() === sName.toLowerCase();
                        return (
                          <button
                            key={sName}
                            type="button"
                            onClick={() => handleSelectSubject(sName)}
                            className={`px-3 py-1.5 rounded-xl border font-bold text-xs transition-all cursor-pointer flex items-center space-x-1.5 ${
                              isSelected
                                ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-400'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                            }`}
                          >
                            {isSelected ? (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            ) : (
                              <Tag className="w-3 h-3 text-slate-400" />
                            )}
                            <span>{sName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Add Custom Subject Input */}
                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="text"
                      value={customSubjectInput}
                      onChange={(e) => setCustomSubjectInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomSubject();
                        }
                      }}
                      placeholder="Или укажите свой предмет (например: Китайский язык, Ментальная арифметика)..."
                      className="flex-1 bg-white text-slate-900 p-2 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCustomSubject()}
                      disabled={!customSubjectInput.trim()}
                      className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center space-x-1 shrink-0 ${
                        customSubjectInput.trim()
                          ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Выбрать</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Дата рождения</label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full bg-white text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Статус заявки</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as LeadStatus)}
                      className="w-full bg-white text-slate-900 font-bold p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="WAITING_GROUP">⏳ Ждет открытия группы</option>
                      <option value="PARTIALLY_ENROLLED">⚡ Частично зачислен</option>
                      <option value="NEW">🔔 Новое обращение</option>
                      <option value="ENROLLED">✓ Зачислен на курс(ы)</option>
                      <option value="CANCELLED">✕ Отменен</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: School, Grade, Address, Certificates */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                  <School className="w-3.5 h-3.5 text-blue-600" />
                  <span>Школа, адрес и сертификаты / льготы (необязательно)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Название школы</label>
                    <input
                      type="text"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="Школа №15, Лицей КГУ"
                      className="w-full bg-white text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">В каком классе учится</label>
                    <input
                      type="text"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder="9-А класс"
                      className="w-full bg-white text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Адрес проживания</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="г. Нукус, ул. Каракалпакстан, д. 42"
                      className="w-full bg-white text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Сертификаты и льготы</label>
                    <input
                      type="text"
                      value={certificatesAndBenefits}
                      onChange={(e) => setCertificatesAndBenefits(e.target.value)}
                      placeholder="Олимпиады, IELTS B1, второй ребенок..."
                      className="w-full bg-white text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Parents Contacts */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>Контакты родителей (необязательно)</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">Заполните, если есть</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">ФИО Отца</label>
                    <input
                      type="text"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      placeholder="Не указано (оставьте пустым, если нет)"
                      className="w-full bg-white text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Телефон Отца (+998)</label>
                    <input
                      type="text"
                      value={fatherPhone}
                      onChange={(e) => setFatherPhone(formatUzbekPhoneInput(e.target.value, true))}
                      placeholder="+998 90 777 88 99"
                      className="w-full bg-white text-slate-900 font-mono p-2.5 rounded-xl border border-slate-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">ФИО Матери</label>
                    <input
                      type="text"
                      value={motherName}
                      onChange={(e) => setMotherName(e.target.value)}
                      placeholder="Не указано (оставьте пустым, если нет)"
                      className="w-full bg-white text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Телефон Матери (+998)</label>
                    <input
                      type="text"
                      value={motherPhone}
                      onChange={(e) => setMotherPhone(formatUzbekPhoneInput(e.target.value, true))}
                      placeholder="+998 91 888 99 00"
                      className="w-full bg-white text-slate-900 font-mono p-2.5 rounded-xl border border-slate-200 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Discount & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Персональная скидка / льгота</label>
                  <div className="flex space-x-2">
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                      className="w-1/2 bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none font-semibold"
                    >
                      <option value="NONE">Без скидки</option>
                      <option value="PERCENTAGE">% Процентная</option>
                      <option value="FIXED_SUM">Фиксированная (сум)</option>
                    </select>

                    {discountType !== 'NONE' && (
                      <input
                        type="number"
                        min={0}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(Number(e.target.value))}
                        placeholder={discountType === 'PERCENTAGE' ? '10%' : '50 000'}
                        className="w-1/2 bg-slate-50 text-slate-900 font-bold p-2.5 rounded-xl border border-slate-200 focus:outline-none"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Заметки администратора</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Например: перезвонить когда откроется группа по субботам"
                    className="w-full bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl font-bold cursor-pointer text-xs"
                >
                  Отмена
                </button>
                <div className="flex items-center space-x-2">
                  {!editingLeadId && (
                    <button
                      type="button"
                      onClick={handleSaveAndAddAnotherSubject}
                      className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold rounded-xl text-xs transition-all cursor-pointer active:scale-95 flex items-center space-x-1"
                      title="Сохранить эту заявку и сразу выбрать следующий предмет для этого же ученика"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-600" />
                      <span>Сохранить и добавить еще предмет</span>
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-xl shadow-md shadow-amber-500/20 cursor-pointer text-xs transition-all active:scale-95"
                  >
                    {editingLeadId ? 'Сохранить изменения' : 'Создать заявку (лид)'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SELECTIVE ENROLLMENT MODAL (ВЫБОРОЧНОЕ ЗАЧИСЛЕНИЕ НА ЛЮБОЙ ПРЕДМЕТ / ГРУППУ) */}
      {enrollLeadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 max-h-[95vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center space-x-2">
                  <BookPlus className="w-5 h-5 text-emerald-600" />
                  <span>Выборочное зачисление в группы: {enrollLeadModal.fullName}</span>
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                  <span>
                    Телефон: <strong className="text-slate-900 font-mono">{enrollLeadModal.phone}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Желаемые предметы ({modalLeadSubjects.length}):
                  </span>
                  <div className="inline-flex flex-wrap gap-1">
                    {modalLeadSubjects.map((sub, sIdx) => {
                      const isEnrolled = modalEnrolledCourseIds.some((cid) => {
                        const crs = courses.find((c) => c.id === cid);
                        return crs && crs.subject.toLowerCase().includes(sub.toLowerCase());
                      });
                      return (
                        <span
                          key={`${sub}-${sIdx}`}
                          className={`px-2 py-0.5 rounded-md font-extrabold text-[11px] ${
                            isEnrolled
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {isEnrolled ? '✓ ' : '⏳ '}
                          {sub}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEnrollLeadModal(null)}
                className="text-slate-400 hover:text-slate-600 font-mono text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              {/* Filter Tabs & Subject Filter for Selective Enrollment */}
              <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-bold mr-1">Фильтр по предмету:</span>
                    <button
                      type="button"
                      onClick={() => setEnrollSubjectTab('ALL')}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        enrollSubjectTab === 'ALL'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Все группы ({courses.length})
                    </button>

                    {/* Filter buttons for each of the lead's desired subjects */}
                    {modalLeadSubjects.map((sub) => {
                      const matchingCount = courses.filter((c) =>
                        c.subject.toLowerCase().includes(sub.toLowerCase()) ||
                        sub.toLowerCase().includes(c.subject.toLowerCase())
                      ).length;
                      const isSelectedTab = enrollSubjectTab.toLowerCase() === sub.toLowerCase();

                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setEnrollSubjectTab(sub)}
                          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                            isSelectedTab
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>
                            {sub} ({matchingCount})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Search input inside modal */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={enrollSearch}
                    onChange={(e) => setEnrollSearch(e.target.value)}
                    placeholder="Поиск группы по названию, предмету, учителю, расписанию (ПН-СР-ПТ) или кабинету..."
                    className="w-full bg-white text-xs text-slate-800 pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Available Groups Grid (Click card or checkbox to select/unselect) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-slate-900 text-xs flex items-center space-x-1.5">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>Выберите одну или несколько групп для зачисления (выборочно):</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Найдено групп: <strong>{availableEnrollmentCourses.length}</strong> | Выбрано для зачисления: <strong>{Object.keys(selectedCoursesMap).length}</strong>
                  </span>
                </div>

                {availableEnrollmentCourses.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                    <p className="font-bold text-xs">Нет групп, соответствующих заданным критериям фильтрации.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Попробуйте выбрать «Все группы» или сбросить поисковый запрос.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[280px] overflow-y-auto p-1">
                    {availableEnrollmentCourses.map((crs, crsIdx) => {
                      const isSelected = selectedCoursesMap[crs.id] !== undefined;
                      const teacher = teachers.find((t) => t.id === crs.teacherId);
                      const cabinet = cabinets.find((cab) => cab.id === crs.cabinetId);
                      const enrolledCount = students.filter((s) =>
                        s.enrolledCourseIds.includes(crs.id)
                      ).length;
                      const capacity = cabinet?.capacity || 15;
                      const freeSeats = Math.max(0, capacity - enrolledCount);
                      const isFull = freeSeats === 0;

                      const isAlreadyEnrolled = modalEnrolledCourseIds.includes(crs.id);

                      const isMatchingWish = modalLeadSubjects.some(
                        (sub) =>
                          crs.subject.toLowerCase().includes(sub.toLowerCase()) ||
                          crs.title.toLowerCase().includes(sub.toLowerCase()) ||
                          sub.toLowerCase().includes(crs.subject.toLowerCase())
                      );

                      return (
                        <div
                          key={`${crs.id}-${crsIdx}`}
                          onClick={() => handleToggleCourseForEnroll(crs.id)}
                          className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between space-y-2.5 ${
                            isSelected
                              ? 'bg-emerald-50/70 border-emerald-500 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20'
                              : isAlreadyEnrolled
                              ? 'bg-slate-50/70 border-slate-300'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          {/* Top Row: Title, Subject badge & Match tag */}
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center space-x-2">
                                <div
                                  className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                                    isSelected
                                      ? 'bg-emerald-600 text-white'
                                      : 'border border-slate-300 bg-white'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <h4 className="font-extrabold text-slate-900 text-xs">
                                  {crs.title}
                                </h4>
                              </div>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px] shrink-0">
                                {crs.subject}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              {isMatchingWish && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                                  <Sparkles className="w-3 h-3 text-amber-600" />
                                  <span>Совпадает с желаемым предметом</span>
                                </span>
                              )}
                              {isAlreadyEnrolled && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-800 text-[10px] font-bold">
                                  <CheckCircle2 className="w-3 h-3 text-cyan-600" />
                                  <span>Уже зачислен ранее</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Teacher, Schedule & Cabinet */}
                          <div className="space-y-1 text-[11px] text-slate-600">
                            <p className="flex items-center space-x-1.5 font-medium">
                              <UserCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span>
                                Учитель: <strong className="text-slate-800">{teacher?.fullName || 'Не назначен'}</strong>
                              </span>
                            </p>
                            <p className="flex items-center space-x-1.5 font-medium">
                              <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span>
                                {crs.daysOfWeek.join(', ')} • {crs.startTime} - {crs.endTime}
                              </span>
                            </p>
                            <p className="flex items-center space-x-1.5 font-medium">
                              <DoorClosed className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{cabinet?.roomNumber || 'Кабинет №101'}</span>
                            </p>
                          </div>

                          {/* Capacity & Price */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                              {isFull ? (
                                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-extrabold text-[10px]">
                                  🔴 Заполнено ({enrolledCount}/{capacity})
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                                  🟢 Свободно: {freeSeats} из {capacity} мест
                                </span>
                              )}
                            </div>

                            <span className="font-mono font-extrabold text-slate-900 text-xs">
                              {crs.monthlyPrice.toLocaleString('ru-RU')} сум/мес
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SELECTED COURSES LIST & INDIVIDUAL LESSON SLIDERS (12 Lessons Rule) */}
              {selectedCoursesList.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-slate-900 text-xs flex items-center space-x-1.5">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span>Параметры зачисления и расчет 1-го месяца (Правило 12 уроков):</span>
                    </h4>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full font-bold">
                      Выбрано курсов: {selectedCoursesList.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {selectedCoursesList.map((item, itemIdx) => {
                      if (!item.course || !item.calc) return null;
                      return (
                        <div
                          key={`${item.courseId}-${itemIdx}`}
                          className="bg-white border border-slate-200 p-3 rounded-xl space-y-2.5 shadow-2xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div>
                              <p className="font-bold text-slate-900 text-xs">
                                {item.course.title} ({item.course.subject})
                              </p>
                              <p className="text-[11px] text-slate-500">
                                Расписание: {item.course.daysOfWeek.join(', ')} • {item.course.startTime}-{item.course.endTime}
                              </p>
                            </div>
                            <span className="font-mono font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md text-xs self-start sm:self-auto">
                              {item.lessons} из 12 уроков
                            </span>
                          </div>

                          <div className="flex items-center space-x-3">
                            <input
                              type="range"
                              min={1}
                              max={12}
                              value={item.lessons}
                              onChange={(e) =>
                                handleSetCourseLessons(item.courseId, Number(e.target.value))
                              }
                              className="flex-1 accent-emerald-600 cursor-pointer"
                            />
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Тариф (12 ур.):</span>
                              <span className="font-mono font-semibold">
                                {item.course.monthlyPrice.toLocaleString('ru-RU')} сум
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">За {item.lessons} ур.:</span>
                              <span className="font-mono font-semibold">
                                {item.calc.proportionalPrice.toLocaleString('ru-RU')} сум
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Скидка:</span>
                              <span className="font-mono font-semibold text-amber-700">
                                {item.calc.discountAmount > 0
                                  ? `-${item.calc.discountAmount.toLocaleString('ru-RU')} сум`
                                  : '0 сум'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">К оплате за 1-й мес.:</span>
                              <span className="font-mono font-extrabold text-emerald-700">
                                {item.calc.finalAmountDue.toLocaleString('ru-RU')} сум
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary Financial Breakdown */}
                  <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between text-slate-700">
                      <span>Итого полная стоимость выбранных курсов (за 12 уроков):</span>
                      <span className="font-mono font-bold">{totalFullPrice.toLocaleString('ru-RU')} сум</span>
                    </div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-amber-800 font-semibold">
                        <span>Суммарная скидка ученика:</span>
                        <span className="font-mono">-{totalDiscount.toLocaleString('ru-RU')} сум</span>
                      </div>
                    )}
                    <div className="border-t border-emerald-200/80 pt-2 flex justify-between items-center">
                      <span className="font-extrabold text-slate-900 text-sm">
                        Общая сумма к оплате за первый месяц ({selectedCoursesList.length} курс.):
                      </span>
                      <span className="font-black text-emerald-800 text-base sm:text-lg font-mono">
                        {totalFinalAmountDue.toLocaleString('ru-RU')} сум
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-slate-100 shrink-0">
              <span className="text-[11px] text-slate-500">
                {selectedCoursesList.length > 0
                  ? `Выбрано для зачисления: ${selectedCoursesList.length} ${
                      selectedCoursesList.length === 1 ? 'группа' : 'группы'
                    }`
                  : 'Выберите хотя бы одну группу в каталоге выше'}
              </span>

              <div className="flex items-center space-x-2 self-end">
                <button
                  type="button"
                  onClick={() => setEnrollLeadModal(null)}
                  className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={selectedCoursesList.length === 0}
                  onClick={handleConfirmEnrollLead}
                  className={`px-5 py-2.5 font-extrabold rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer ${
                    selectedCoursesList.length > 0
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-95'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <BookPlus className="w-4 h-4" />
                  <span>
                    {selectedCoursesList.length > 1
                      ? `Зачислить на ${selectedCoursesList.length} выбранных курса`
                      : 'Зачислить в группу и перенести в Базу'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Lead Confirmation Modal */}
      {leadToDelete && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  Удалить заявку?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Лид: <strong className="text-slate-800 dark:text-slate-200">{leadToDelete.fullName}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Вы уверены, что хотите безвозвратно удалить заявку/лид «{leadToDelete.fullName}» из базы предзаписей?
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setLeadToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteLead && leadToDelete) {
                    onDeleteLead(leadToDelete.id);
                  }
                  setLeadToDelete(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-rose-600/20 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Да, удалить</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
