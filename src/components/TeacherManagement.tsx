import React, { useState } from 'react';
import {
  UserPlus,
  Key,
  BookOpen,
  DollarSign,
  Search,
  UserCheck,
  Trash2,
  Edit2,
  Plus,
  Tag,
  Check,
  Filter,
  Layers,
  Sparkles,
  Phone,
  Shield,
  Briefcase,
  Crown,
  Users,
  Eye,
  EyeOff,
  User,
  Calendar,
  Lock,
  Building,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  TeacherProfile,
  SalaryModelType,
  Course,
  Subject,
  StaffMember,
  StaffRole,
  User as UserType,
} from '../types';
import { formatDisplayPhone, formatUzbekPhoneInput } from '../lib/phoneUtils';
import { calculateAgeFromBirthDate, formatAgeWithSuffix } from '../lib/dateUtils';
import {
  SubjectManagementModal,
  getSubjectColorStyle,
  SUBJECT_CATEGORIES,
} from './SubjectManagementModal';

interface TeacherManagementProps {
  teachers: TeacherProfile[];
  courses: Course[];
  subjects: Subject[];
  staffMembers?: StaffMember[];
  currentUser?: UserType | null;
  onAddTeacher: (teacher: TeacherProfile) => void;
  onUpdateTeacher?: (teacher: TeacherProfile) => void;
  onDeleteTeacher?: (teacherId: string) => void;
  onAddStaffMember?: (staff: StaffMember) => void;
  onUpdateStaffMember?: (staff: StaffMember) => void;
  onDeleteStaffMember?: (staffId: string) => void;
  onAddSubject: (subject: Subject) => void;
  onUpdateSubject: (subject: Subject) => void;
  onDeleteSubject: (subjectId: string) => void;
  onClearSubjects?: () => void;
  onSwitchUser?: (user: UserType) => void;
}

type StaffTabType = 'ALL' | 'TEACHERS' | 'ADMINS' | 'DIRECTORS' | 'OTHER';

export const TeacherManagement: React.FC<TeacherManagementProps> = ({
  teachers,
  courses,
  subjects,
  staffMembers = [],
  currentUser,
  onAddTeacher,
  onUpdateTeacher = (_t: TeacherProfile) => {},
  onDeleteTeacher = (_id: string) => {},
  onAddStaffMember = (_staff: StaffMember) => {},
  onUpdateStaffMember = (_staff: StaffMember) => {},
  onDeleteStaffMember = (_id: string) => {},
  onAddSubject,
  onUpdateSubject,
  onDeleteSubject,
  onClearSubjects,
  onSwitchUser,
}) => {
  // Navigation tab
  const [activeTab, setActiveTab] = useState<StaffTabType>('ALL');

  // Modals state
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [showAddDirectorModal, setShowAddDirectorModal] = useState(false);
  const [showAddOtherStaffModal, setShowAddOtherStaffModal] = useState(false);
  const [showEditTeacherModal, setShowEditTeacherModal] = useState(false);
  const [showEditStaffModal, setShowEditStaffModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);

  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('ALL');

  // -------------------------------------------------------------
  // Form State: Add Administrator (Фамилия отдельно, Имя отдельно)
  // -------------------------------------------------------------
  const [adminLastName, setAdminLastName] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminPhone, setAdminPhone] = useState('+998 ');
  const [adminBirthDate, setAdminBirthDate] = useState('1998-03-20');
  const [adminMonthlySalary, setAdminMonthlySalary] = useState<number>(3500000);
  const [adminLogin, setAdminLogin] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // -------------------------------------------------------------
  // Form State: Add Director (ФИО, Телефон, Дата рожд, Логин, Пароль, ЗП)
  // -------------------------------------------------------------
  const [directorFullName, setDirectorFullName] = useState('');
  const [directorPhone, setDirectorPhone] = useState('+998 ');
  const [directorBirthDate, setDirectorBirthDate] = useState('1986-06-15');
  const [directorMonthlySalary, setDirectorMonthlySalary] = useState<number>(6000000);
  const [directorLogin, setDirectorLogin] = useState('');
  const [directorPassword, setDirectorPassword] = useState('');
  const [showDirectorPassword, setShowDirectorPassword] = useState(false);

  // -------------------------------------------------------------
  // Form State: Add Other Staff (ФИО, Должность, Зарплата, Дата рожд, Телефон)
  // -------------------------------------------------------------
  const [staffFullName, setStaffFullName] = useState('');
  const [staffPosition, setStaffPosition] = useState('SMM-специалист');
  const [staffMonthlySalary, setStaffMonthlySalary] = useState<number>(2500000);
  const [staffBirthDate, setStaffBirthDate] = useState('2000-01-10');
  const [staffPhone, setStaffPhone] = useState('+998 ');

  // -------------------------------------------------------------
  // Form State: Edit Staff Member
  // -------------------------------------------------------------
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editStaffFullName, setEditStaffFullName] = useState('');
  const [editStaffPosition, setEditStaffPosition] = useState('');
  const [editStaffMonthlySalary, setEditStaffMonthlySalary] = useState<number>(3000000);
  const [editStaffBirthDate, setEditStaffBirthDate] = useState('1998-01-01');
  const [editStaffPhone, setEditStaffPhone] = useState('+998 ');
  const [editStaffLogin, setEditStaffLogin] = useState('');
  const [editStaffPassword, setEditStaffPassword] = useState('');
  const [showEditStaffPassword, setShowEditStaffPassword] = useState(false);

  // -------------------------------------------------------------
  // Form State: Add Teacher
  // -------------------------------------------------------------
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [customSubjectName, setCustomSubjectName] = useState('');
  const [birthDate, setBirthDate] = useState('1995-05-15');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [salaryModel, setSalaryModel] = useState<SalaryModelType>('PERCENTAGE');
  const [percentageRate, setPercentageRate] = useState<number>(40);
  const [fixedRate, setFixedRate] = useState<number>(2800000);
  const [contractNotes, setContractNotes] = useState('');

  // -------------------------------------------------------------
  // Form State: Edit Teacher
  // -------------------------------------------------------------
  const [editingTeacher, setEditingTeacher] = useState<TeacherProfile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('+998 ');
  const [editSubjectId, setEditSubjectId] = useState('');
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('1995-05-15');
  const [editLogin, setEditLogin] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditTeacherPassword, setShowEditTeacherPassword] = useState(false);
  const [editSalaryModel, setEditSalaryModel] = useState<SalaryModelType>('PERCENTAGE');
  const [editPercentageRate, setEditPercentageRate] = useState(40);
  const [editFixedRate, setEditFixedRate] = useState(2800000);
  const [editContractNotes, setEditContractNotes] = useState('');

  // Common position chips for other staff
  const STAFF_POSITION_SUGGESTIONS = [
    'SMM-специалист',
    'Мобилограф',
    'Таргетолог',
    'Охранник',
    'Уборщица / Клининг',
    'Методист',
    'Бухгалтер',
    'IT-специалист',
    'Оператор call-центра',
  ];

  // Helper generators
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = 'REDCAT@';
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  /**
   * Checks if a candidate login is already occupied across the entire system.
   */
  const checkIsLoginTaken = (
    candidateLogin: string,
    excludeTeacherId?: string,
    excludeStaffId?: string
  ): { isTaken: boolean; ownerName?: string; ownerRole?: string } => {
    const clean = candidateLogin.trim().toLowerCase();
    if (!clean) return { isTaken: false };

    if (clean === 'admin') {
      return {
        isTaken: true,
        ownerName: 'Главный Администратор',
        ownerRole: 'Главный Администратор',
      };
    }

    for (const t of teachers) {
      if (excludeTeacherId && t.id === excludeTeacherId) continue;
      if (t.login && t.login.trim().toLowerCase() === clean) {
        return { isTaken: true, ownerName: t.fullName, ownerRole: 'Преподаватель' };
      }
    }

    for (const s of staffMembers) {
      if (excludeStaffId && s.id === excludeStaffId) continue;
      if (s.login && s.login.trim().toLowerCase() === clean) {
        const roleTitle =
          s.role === 'ADMIN'
            ? 'Администратор'
            : s.role === 'DIRECTOR'
            ? 'Директор'
            : 'Сотрудник';
        return { isTaken: true, ownerName: s.fullName, ownerRole: roleTitle };
      }
    }

    return { isTaken: false };
  };

  const handleOpenAddAdmin = () => {
    setAdminLastName('');
    setAdminFirstName('');
    setAdminPhone('+998 ');
    setAdminBirthDate('1998-03-20');
    setAdminMonthlySalary(3500000);
    const randNum = Math.floor(100 + Math.random() * 900);
    setAdminLogin(`admin_${randNum}`);
    setAdminPassword(generateRandomPassword());
    setShowAdminPassword(true);
    setShowAddAdminModal(true);
  };

  const handleOpenAddDirector = () => {
    setDirectorFullName('');
    setDirectorPhone('+998 ');
    setDirectorBirthDate('1986-06-15');
    setDirectorMonthlySalary(6000000);
    setDirectorLogin(`director_${Math.floor(100 + Math.random() * 900)}`);
    setDirectorPassword(generateRandomPassword());
    setShowDirectorPassword(true);
    setShowAddDirectorModal(true);
  };

  const handleOpenAddOtherStaff = () => {
    setStaffFullName('');
    setStaffPosition('SMM-специалист');
    setStaffMonthlySalary(2500000);
    setStaffBirthDate('2000-01-10');
    setStaffPhone('+998 ');
    setShowAddOtherStaffModal(true);
  };

  const handleOpenAddTeacher = () => {
    setFullName('');
    setPhone('+998 ');
    if (subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
      setCustomSubjectName(subjects[0].name);
    } else {
      setSelectedSubjectId('');
      setCustomSubjectName('');
    }
    setBirthDate('1995-05-15');
    setSalaryModel('PERCENTAGE');
    setPercentageRate(40);
    setFixedRate(2800000);
    setContractNotes('');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setLogin(`teach_${Math.floor(100 + Math.random() * 900)}`);
    setPassword(`REDCAT@${randomNum}`);
    setShowTeacherPassword(true);
    setShowAddTeacherModal(true);
  };

  // Submit Add Admin
  const handleSubmitNewAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const lName = adminLastName.trim();
    const fName = adminFirstName.trim();
    const cleanLog = adminLogin.trim();
    const cleanPass = adminPassword.trim();

    if (!lName || !fName || !cleanLog || !cleanPass) {
      alert('Заполните все обязательные поля: Фамилия, Имя, Логин и Пароль!');
      return;
    }

    const dupCheck = checkIsLoginTaken(cleanLog);
    if (dupCheck.isTaken) {
      alert(
        `🚫 Ошибка: Логин «${cleanLog}» уже занят (${dupCheck.ownerRole}: ${dupCheck.ownerName})!\n\nПожалуйста, укажите уникальный логин.`
      );
      return;
    }

    const fullStaffName = `${lName} ${fName}`;
    const calculatedAge = calculateAgeFromBirthDate(adminBirthDate);

    const newAdmin: StaffMember = {
      id: `staff-adm-${Date.now()}`,
      lastName: lName,
      firstName: fName,
      fullName: fullStaffName,
      role: 'ADMIN',
      position: 'Администратор',
      phone: adminPhone.trim().length > 5 ? adminPhone.trim() : undefined,
      birthDate: adminBirthDate,
      age: calculatedAge,
      monthlySalary: adminMonthlySalary,
      login: cleanLog,
      password: cleanPass,
      createdAt: new Date().toISOString().slice(0, 10),
      isActive: true,
    };

    onAddStaffMember(newAdmin);
    alert(
      `✅ Администратор «${fullStaffName}» успешно зарегистрирован!\n\nЛогин: ${cleanLog}\nПароль: ${cleanPass}\nДата рождения: ${adminBirthDate} (${formatAgeWithSuffix(calculatedAge)})\nОклад: ${adminMonthlySalary.toLocaleString('ru-RU')} сум/мес\n\nНовый администратор имеет полный доступ. Все его действия будут фиксироваться в журнале с указанием имени «${fullStaffName}».`
    );
    setShowAddAdminModal(false);
  };

  // Submit Add Director
  const handleSubmitNewDirector = (e: React.FormEvent) => {
    e.preventDefault();
    const fName = directorFullName.trim();
    const cleanLog = directorLogin.trim();
    const cleanPass = directorPassword.trim();

    if (!fName || !cleanLog || !cleanPass) {
      alert('Заполните все обязательные поля: ФИО, Логин и Пароль!');
      return;
    }

    const dupCheck = checkIsLoginTaken(cleanLog);
    if (dupCheck.isTaken) {
      alert(
        `🚫 Ошибка: Логин «${cleanLog}» уже занят (${dupCheck.ownerRole}: ${dupCheck.ownerName})!\n\nПожалуйста, укажите уникальный логин.`
      );
      return;
    }

    const calculatedAge = calculateAgeFromBirthDate(directorBirthDate);

    const newDirector: StaffMember = {
      id: `staff-dir-${Date.now()}`,
      fullName: fName,
      role: 'DIRECTOR',
      position: 'Директор учебного центра',
      phone: directorPhone.trim().length > 5 ? directorPhone.trim() : undefined,
      birthDate: directorBirthDate,
      age: calculatedAge,
      monthlySalary: directorMonthlySalary,
      login: cleanLog,
      password: cleanPass,
      createdAt: new Date().toISOString().slice(0, 10),
      isActive: true,
    };

    onAddStaffMember(newDirector);
    alert(
      `✅ Директор «${fName}» успешно зарегистрирован!\n\nЛогин: ${cleanLog}\nПароль: ${cleanPass}\nДата рождения: ${directorBirthDate} (${formatAgeWithSuffix(calculatedAge)})\nОклад: ${directorMonthlySalary.toLocaleString('ru-RU')} сум/мес`
    );
    setShowAddDirectorModal(false);
  };

  // Submit Add Other Staff
  const handleSubmitNewOtherStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const fName = staffFullName.trim();
    const pos = staffPosition.trim();
    if (!fName || !pos) {
      alert('Заполните обязательные поля: ФИО и Должность!');
      return;
    }

    const calculatedAge = calculateAgeFromBirthDate(staffBirthDate);

    const newStaff: StaffMember = {
      id: `staff-oth-${Date.now()}`,
      fullName: fName,
      role: 'OTHER_STAFF',
      position: pos,
      phone: staffPhone.trim().length > 5 ? staffPhone.trim() : undefined,
      birthDate: staffBirthDate,
      age: calculatedAge,
      monthlySalary: staffMonthlySalary,
      createdAt: new Date().toISOString().slice(0, 10),
      isActive: true,
    };

    onAddStaffMember(newStaff);
    alert(
      `✅ Сотрудник «${fName}» (${pos}) успешно добавлен в штат!\nДата рождения: ${staffBirthDate} (${formatAgeWithSuffix(calculatedAge)})\nОклад: ${staffMonthlySalary.toLocaleString('ru-RU')} сум/мес.`
    );
    setShowAddOtherStaffModal(false);
  };

  // Submit Add Teacher
  const handleSubmitNewTeacher = (e: React.FormEvent) => {
    e.preventDefault();

    let finalSubjectName = customSubjectName.trim();
    let finalSubjectId = selectedSubjectId;

    if (selectedSubjectId && selectedSubjectId !== 'CUSTOM') {
      const foundSub = subjects.find((s) => s.id === selectedSubjectId);
      if (foundSub) {
        finalSubjectName = foundSub.name;
        finalSubjectId = foundSub.id;
      }
    }

    const cleanLog = login.trim();
    const cleanPass = password.trim() || 'REDCAT@2026';

    if (!fullName.trim() || !finalSubjectName || !cleanLog) {
      alert('Заполните все обязательные поля (ФИО, предмет и логин)!');
      return;
    }

    const dupCheck = checkIsLoginTaken(cleanLog);
    if (dupCheck.isTaken) {
      alert(
        `🚫 Ошибка: Логин «${cleanLog}» уже занят (${dupCheck.ownerRole}: ${dupCheck.ownerName})!\n\nПожалуйста, укажите уникальный логин.`
      );
      return;
    }

    const calculatedAge = calculateAgeFromBirthDate(birthDate);

    const newTeacher: TeacherProfile = {
      id: `t-${Date.now()}`,
      userId: `u-${Date.now()}`,
      fullName: fullName.trim(),
      phone: phone.trim().length > 5 ? phone.trim() : undefined,
      subject: finalSubjectName,
      subjectId: finalSubjectId !== 'CUSTOM' ? finalSubjectId : undefined,
      age: calculatedAge,
      birthDate,
      salaryModel,
      percentageRate: salaryModel === 'PERCENTAGE' ? percentageRate : undefined,
      fixedRate: salaryModel === 'FIXED' ? fixedRate : undefined,
      contractNotes: salaryModel === 'CONTRACTUAL' ? contractNotes : undefined,
      login: cleanLog,
      password: cleanPass,
    };

    onAddTeacher(newTeacher);
    alert(
      `✅ Преподаватель «${fullName}» успешно добавлен!\nПредмет: ${finalSubjectName}\nЛогин: ${cleanLog}\nПароль: ${cleanPass}\nДата рождения: ${birthDate} (${formatAgeWithSuffix(calculatedAge)})`
    );
    setShowAddTeacherModal(false);
  };

  // Edit Staff Handler
  const handleOpenEditStaff = (staff: StaffMember) => {
    setEditingStaff(staff);
    setEditStaffFullName(staff.fullName);
    setEditStaffPosition(staff.position || '');
    setEditStaffMonthlySalary(staff.monthlySalary || 0);
    setEditStaffBirthDate(staff.birthDate || '1998-01-01');
    setEditStaffPhone(staff.phone ? formatDisplayPhone(staff.phone) : '+998 ');
    setEditStaffLogin(staff.login || '');
    setEditStaffPassword(staff.password || '');
    setShowEditStaffPassword(false);
    setShowEditStaffModal(true);
  };

  const handleSubmitEditStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    const cleanLog = editStaffLogin.trim();
    if (cleanLog) {
      const dupCheck = checkIsLoginTaken(cleanLog, undefined, editingStaff.id);
      if (dupCheck.isTaken) {
        alert(
          `🚫 Ошибка: Логин «${cleanLog}» уже занят (${dupCheck.ownerRole}: ${dupCheck.ownerName})!\n\nПожалуйста, укажите уникальный логин.`
        );
        return;
      }
    }

    const calculatedAge = calculateAgeFromBirthDate(editStaffBirthDate);

    const updated: StaffMember = {
      ...editingStaff,
      fullName: editStaffFullName.trim(),
      position: editStaffPosition.trim(),
      monthlySalary: editStaffMonthlySalary,
      birthDate: editStaffBirthDate,
      age: calculatedAge,
      phone: editStaffPhone.trim().length > 5 ? editStaffPhone.trim() : undefined,
      login: cleanLog || undefined,
      password: editStaffPassword.trim() || undefined,
    };

    onUpdateStaffMember(updated);
    alert(`Данные сотрудника «${updated.fullName}» успешно обновлены!`);
    setShowEditStaffModal(false);
  };

  const handleDeleteStaffClick = (staff: StaffMember) => {
    if (confirm(`Вы уверены, что хотите удалить сотрудника «${staff.fullName}» (${staff.position})?`)) {
      onDeleteStaffMember(staff.id);
    }
  };

  // Edit Teacher Handlers
  const handleOpenEditTeacher = (teacher: TeacherProfile) => {
    setEditingTeacher(teacher);
    setEditFullName(teacher.fullName);
    setEditPhone(teacher.phone ? formatDisplayPhone(teacher.phone) : '+998 ');

    const matchedSubject = subjects.find(
      (s) => s.id === teacher.subjectId || s.name.toLowerCase() === teacher.subject.toLowerCase()
    );
    setEditSubjectId(matchedSubject ? matchedSubject.id : 'CUSTOM');
    setEditSubjectName(teacher.subject);
    setEditBirthDate(teacher.birthDate || '1995-05-15');
    setEditLogin(teacher.login || '');
    setEditPassword(teacher.password || 'REDCAT@2026');
    setShowEditTeacherPassword(false);
    setEditSalaryModel(teacher.salaryModel);
    setEditPercentageRate(teacher.percentageRate || 40);
    setEditFixedRate(teacher.fixedRate || 2800000);
    setEditContractNotes(teacher.contractNotes || '');
    setShowEditTeacherModal(true);
  };

  const handleSubmitEditTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;

    let finalSubjectName = editSubjectName.trim();
    let finalSubjectId = editSubjectId;

    if (editSubjectId && editSubjectId !== 'CUSTOM') {
      const foundSub = subjects.find((s) => s.id === editSubjectId);
      if (foundSub) {
        finalSubjectName = foundSub.name;
        finalSubjectId = foundSub.id;
      }
    }

    const cleanLog = editLogin.trim();
    const cleanPass = editPassword.trim();

    if (!editFullName.trim() || !finalSubjectName || !cleanLog) {
      alert('Заполните все обязательные поля (ФИО, предмет и логин)!');
      return;
    }

    const dupCheck = checkIsLoginTaken(cleanLog, editingTeacher.id);
    if (dupCheck.isTaken) {
      alert(
        `🚫 Ошибка: Логин «${cleanLog}» уже занят (${dupCheck.ownerRole}: ${dupCheck.ownerName})!\n\nПожалуйста, укажите уникальный логин.`
      );
      return;
    }

    const calculatedAge = calculateAgeFromBirthDate(editBirthDate);

    const updated: TeacherProfile = {
      ...editingTeacher,
      fullName: editFullName.trim(),
      phone: editPhone.trim().length > 5 ? editPhone.trim() : undefined,
      subject: finalSubjectName,
      subjectId: finalSubjectId !== 'CUSTOM' ? finalSubjectId : undefined,
      birthDate: editBirthDate,
      age: calculatedAge,
      login: cleanLog,
      password: cleanPass || 'REDCAT@2026',
      salaryModel: editSalaryModel,
      percentageRate: editSalaryModel === 'PERCENTAGE' ? editPercentageRate : undefined,
      fixedRate: editSalaryModel === 'FIXED' ? editFixedRate : undefined,
      contractNotes: editSalaryModel === 'CONTRACTUAL' ? editContractNotes : undefined,
    };

    if (onUpdateTeacher) {
      onUpdateTeacher(updated);
    }
    alert(
      `✅ Профиль преподавателя «${updated.fullName}» успешно обновлен!\nЛогин: ${cleanLog}\nПароль: ${cleanPass || 'REDCAT@2026'}\nДата рождения: ${editBirthDate} (${formatAgeWithSuffix(calculatedAge)})`
    );
    setShowEditTeacherModal(false);
  };

  const handleDeleteTeacherClick = (t: TeacherProfile) => {
    if (confirm(`Вы уверены, что хотите удалить преподавателя "${t.fullName}" из системы?`)) {
      if (onDeleteTeacher) {
        onDeleteTeacher(t.id);
      }
    }
  };

  // Filtered lists
  const adminMembers = staffMembers.filter((s) => s.role === 'ADMIN');
  const directorMembers = staffMembers.filter((s) => s.role === 'DIRECTOR');
  const otherStaffMembers = staffMembers.filter((s) => s.role === 'OTHER_STAFF');

  const filteredTeachers = teachers.filter((t) => {
    if (selectedSubjectFilter !== 'ALL') {
      const matchesId = t.subjectId === selectedSubjectFilter;
      const targetSub = subjects.find((s) => s.id === selectedSubjectFilter);
      const matchesName = targetSub && t.subject.toLowerCase() === targetSub.name.toLowerCase();
      if (!matchesId && !matchesName) return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      return (
        t.fullName.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.login.toLowerCase().includes(q)
      );
    }

    return true;
  });

  const filteredStaff = staffMembers.filter((s) => {
    if (activeTab === 'ADMINS' && s.role !== 'ADMIN') return false;
    if (activeTab === 'DIRECTORS' && s.role !== 'DIRECTOR') return false;
    if (activeTab === 'OTHER' && s.role !== 'OTHER_STAFF') return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      return (
        s.fullName.toLowerCase().includes(q) ||
        (s.position && s.position.toLowerCase().includes(q)) ||
        (s.login && s.login.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
      );
    }

    return true;
  });

  // Calculate monthly total payroll fund
  const totalStaffSalaryFund =
    staffMembers.reduce((acc, s) => acc + (s.monthlySalary || 0), 0) +
    teachers.reduce((acc, t) => acc + (t.salaryModel === 'FIXED' ? t.fixedRate || 0 : 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-white flex items-center space-x-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <span>Штатное расписание и персонал центра</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Управление преподавателями, администраторами, директорами и сотрудниками с фиксацией авторства действий
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center space-x-3 text-xs bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800 shrink-0">
            <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
              <Briefcase className="w-4 h-4 text-emerald-400" />
              <span>Штат: <strong className="text-white font-bold">{teachers.length + staffMembers.length} чел.</strong></span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
              <DollarSign className="w-4 h-4 text-amber-400" />
              <span>ФОТ окладов: <strong className="text-amber-300 font-bold">{totalStaffSalaryFund.toLocaleString('ru-RU')} сум</strong></span>
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-800/80">
          {/* 1. Add Teacher */}
          <button
            type="button"
            onClick={handleOpenAddTeacher}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Добавить Преподавателя</span>
          </button>

          {/* 2. Add Administrator */}
          <button
            type="button"
            onClick={handleOpenAddAdmin}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Shield className="w-4 h-4 text-blue-200" />
            <span>+ Добавить Администратора</span>
          </button>

          {/* 3. Add Director */}
          <button
            type="button"
            onClick={handleOpenAddDirector}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition-all cursor-pointer"
          >
            <Crown className="w-4 h-4 text-purple-200" />
            <span>+ Добавить Директора</span>
          </button>

          {/* 4. Add Other Staff */}
          <button
            type="button"
            onClick={handleOpenAddOtherStaff}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <Briefcase className="w-4 h-4 text-emerald-200" />
            <span>+ Другой персонал</span>
          </button>

          {/* 5. Subjects Database */}
          <button
            type="button"
            onClick={() => setShowSubjectModal(true)}
            className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white font-bold text-xs border border-slate-700 transition-all cursor-pointer ml-auto"
          >
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>База предметов ({subjects.length})</span>
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === 'ALL'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Все сотрудники ({teachers.length + staffMembers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('TEACHERS')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === 'TEACHERS'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
          <span>Преподаватели ({teachers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ADMINS')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === 'ADMINS'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-blue-400" />
          <span>Администраторы ({adminMembers.length + 1})</span>
        </button>

        <button
          onClick={() => setActiveTab('DIRECTORS')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === 'DIRECTORS'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Crown className="w-3.5 h-3.5 text-purple-400" />
          <span>Руководство / Директор ({directorMembers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('OTHER')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === 'OTHER'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
          <span>Другой персонал ({otherStaffMembers.length})</span>
        </button>
      </div>

      {/* Search & Subject Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Поиск по ФИО, должности, телефону или логину..."
            className="w-full bg-slate-900 text-xs text-white pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Subject Filter (visible when viewing teachers) */}
        {(activeTab === 'ALL' || activeTab === 'TEACHERS') && (
          <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 shrink-0">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-400">Предмет:</span>
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="bg-slate-950 text-white text-xs font-bold rounded-lg px-2.5 py-1 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">Все предметы ({teachers.length})</option>
              {subjects.map((s) => {
                const count = teachers.filter(
                  (t) => t.subjectId === s.id || t.subject.toLowerCase() === s.name.toLowerCase()
                ).length;
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 1: ADMINISTRATORS & DIRECTORS & OTHER STAFF LIST       */}
      {/* ------------------------------------------------------------- */}
      {activeTab !== 'TEACHERS' && (
        <div className="space-y-4">
          {activeTab === 'ALL' && (
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Shield className="w-4 h-4 text-blue-400" />
                <span>Администрация и Персонал ({filteredStaff.length + (activeTab === 'ALL' || activeTab === 'ADMINS' ? 1 : 0)})</span>
              </h2>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Main Default Admin Card (if matching) */}
            {(activeTab === 'ALL' || activeTab === 'ADMINS') && !searchTerm && (
              <div className="bg-slate-900 border border-blue-900/40 rounded-2xl p-5 space-y-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 font-extrabold text-lg flex items-center justify-center shrink-0 shadow-inner">
                        <Shield className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-bold text-white leading-snug">Главный Администратор</h3>
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-extrabold text-[10px] border border-blue-500/30">
                            MASTER ADMIN
                          </span>
                        </div>
                        <div className="mt-1 flex items-center space-x-1.5">
                          <span className="text-[11px] text-slate-400">Логин: <strong className="text-white font-mono">admin</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Уровень доступа:</span>
                      <span className="font-bold text-emerald-400">Полный доступ (Superadmin)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Аудит действий:</span>
                      <span className="font-medium text-slate-200">Главный администратор</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Системный аккаунт</span>
                  <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Активен</span>
                  </span>
                </div>
              </div>
            )}

            {/* Created Staff Members */}
            {filteredStaff.map((staff) => {
              const isAdm = staff.role === 'ADMIN';
              const isDir = staff.role === 'DIRECTOR';

              const roleBadge = isAdm ? (
                <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-extrabold text-[10px] border border-blue-500/30 flex items-center space-x-1">
                  <Shield className="w-3 h-3" />
                  <span>Администратор</span>
                </span>
              ) : isDir ? (
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-extrabold text-[10px] border border-purple-500/30 flex items-center space-x-1">
                  <Crown className="w-3 h-3" />
                  <span>Директор</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px] border border-emerald-500/30 flex items-center space-x-1">
                  <Briefcase className="w-3 h-3" />
                  <span>{staff.position || 'Персонал'}</span>
                </span>
              );

              const avatarBg = isAdm
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                : isDir
                ? 'bg-purple-600/20 text-purple-400 border-purple-500/30'
                : 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30';

              return (
                <div
                  key={staff.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-4 shadow-xs transition-all relative overflow-hidden flex flex-col justify-between"
                >
                    <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-12 h-12 rounded-2xl border font-extrabold text-lg flex items-center justify-center shrink-0 shadow-inner ${avatarBg}`}
                        >
                          {staff.fullName.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white leading-snug">{staff.fullName}</h3>
                          <div className="mt-1 flex items-center space-x-1.5 flex-wrap gap-y-1">
                            {roleBadge}
                            {(staff.birthDate || staff.age) && (
                              <span className="text-[10px] text-slate-400 font-medium bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                🎂 {staff.birthDate ? formatAgeWithSuffix(calculateAgeFromBirthDate(staff.birthDate)) : `${staff.age} лет`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditStaff(staff)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-all"
                          title="Редактировать"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStaffClick(staff)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-all"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Staff info details */}
                    <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                      {staff.birthDate && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Дата рождения:</span>
                          <span className="font-mono text-slate-200">
                            {staff.birthDate} ({formatAgeWithSuffix(calculateAgeFromBirthDate(staff.birthDate))})
                          </span>
                        </div>
                      )}

                      {staff.phone && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Телефон:</span>
                          <span className="font-mono text-white">{formatDisplayPhone(staff.phone)}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Ежемес. оклад:</span>
                        <span className="font-bold text-amber-400">
                          {(staff.monthlySalary || 0).toLocaleString('ru-RU')} сум
                        </span>
                      </div>

                      {staff.login && (
                        <div className="flex items-center justify-between border-t border-slate-800 pt-1">
                          <span className="text-slate-400">Логин для входа:</span>
                          <span className="font-mono text-indigo-300 font-bold bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-800/50">
                            {staff.login}
                          </span>
                        </div>
                      )}

                      {staff.password && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Пароль:</span>
                          <span className="font-mono text-slate-300 font-semibold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            {staff.password}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Switch user / Authorship tester button */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">
                      Добавлен: {staff.createdAt || 'Недавно'}
                    </span>

                    {(isAdm || isDir) && onSwitchUser && (
                      <button
                        type="button"
                        onClick={() =>
                          onSwitchUser({
                            id: `u-${staff.id}`,
                            username: staff.login || staff.fullName,
                            fullName: staff.fullName,
                            role: staff.role === 'DIRECTOR' ? 'DIRECTOR' : 'ADMIN',
                            phone: staff.phone,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white font-bold transition-all flex items-center space-x-1"
                      >
                        <UserCheck className="w-3 h-3 text-indigo-400" />
                        <span>Работать от его имени</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECTION 2: TEACHERS LIST                                       */}
      {/* ------------------------------------------------------------- */}
      {(activeTab === 'ALL' || activeTab === 'TEACHERS') && (
        <div className="space-y-4">
          {activeTab === 'ALL' && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>Преподаватели ({filteredTeachers.length})</span>
              </h2>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeachers.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 italic bg-slate-900 rounded-2xl border border-slate-800">
                Преподаватели по заданным критериям не найдены.
              </div>
            ) : (
              filteredTeachers.map((t) => {
                const teacherCoursesList = courses.filter((c) => c.teacherId === t.id);
                const matchedSubject = subjects.find(
                  (s) => s.id === t.subjectId || s.name.toLowerCase() === t.subject.toLowerCase()
                );
                const subjectColorStyle = getSubjectColorStyle(matchedSubject?.color);
                const isDupLogin = teachers.filter((o) => o.login.toLowerCase() === t.login.toLowerCase()).length > 1;

                return (
                  <div
                    key={t.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs hover:border-slate-700 transition-all relative overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-extrabold text-lg flex items-center justify-center shrink-0 shadow-inner">
                            {t.fullName.charAt(0)}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white leading-snug">{t.fullName}</h3>

                            {/* Subject Badge & Age */}
                            <div className="mt-1 flex items-center space-x-1.5 flex-wrap gap-y-1">
                              <span
                                className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${subjectColorStyle.bg} ${subjectColorStyle.text} ${subjectColorStyle.border}`}
                              >
                                <Tag className="w-3 h-3" />
                                <span>{t.subject}</span>
                              </span>
                              {(t.birthDate || t.age) && (
                                <span className="text-[10px] text-slate-400 font-medium bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                  🎂 {t.birthDate ? formatAgeWithSuffix(calculateAgeFromBirthDate(t.birthDate)) : `${t.age} лет`}
                                </span>
                              )}
                              {isDupLogin && (
                                <span className="inline-flex items-center space-x-1 text-[10px] text-amber-400 bg-amber-950/60 border border-amber-800 px-1.5 py-0.5 rounded font-bold">
                                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                                  <span>Повтор логина</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditTeacher(t)}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-all"
                            title="Редактировать профиль учителя (логин, пароль, ставка)"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTeacherClick(t)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-all"
                            title="Удалить учителя"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Details Box */}
                      <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                        {t.birthDate && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Дата рождения:</span>
                            <span className="font-mono text-slate-200">
                              {t.birthDate} ({formatAgeWithSuffix(calculateAgeFromBirthDate(t.birthDate))})
                            </span>
                          </div>
                        )}

                        {t.phone && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Телефон:</span>
                            <span className="font-mono text-white">{formatDisplayPhone(t.phone)}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Условия оплаты:</span>
                          <span className="font-bold text-amber-400">
                            {t.salaryModel === 'PERCENTAGE' && `${t.percentageRate || 40}% от сборов`}
                            {t.salaryModel === 'FIXED' && `${(t.fixedRate || 0).toLocaleString('ru-RU')} сум (фикс)`}
                            {t.salaryModel === 'CONTRACTUAL' && 'Договорная'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Ведет групп / курсов:</span>
                          <span className="font-semibold text-white">
                            {teacherCoursesList.length} групп
                          </span>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-800 pt-1">
                          <span className="text-slate-400">Логин учителя:</span>
                          <span className="font-mono text-indigo-300 font-bold bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-800/50">
                            {t.login}
                          </span>
                        </div>

                        {t.password && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Пароль:</span>
                            <span className="font-mono text-slate-300 font-semibold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                              {t.password}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span>ID: {t.id}</span>
                      {onSwitchUser && (
                        <button
                          type="button"
                          onClick={() =>
                            onSwitchUser({
                              id: `u-${t.id}`,
                              username: t.login,
                              fullName: t.fullName,
                              role: 'TEACHER',
                              phone: t.phone,
                              teacherProfileId: t.id,
                            })
                          }
                          className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white font-bold transition-all"
                        >
                          Войти в кабинет
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: ADD ADMINISTRATOR (Фамилия отдельно, Имя отдельно)    */}
      {/* ------------------------------------------------------------- */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Добавить нового администратора</h3>
                  <p className="text-[11px] text-slate-400">
                    Полный доступ к системе с фиксацией авторства действий
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddAdminModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitNewAdmin} className="space-y-4 text-xs">
              {/* Surname & Name separately */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Фамилия администратора *
                  </label>
                  <input
                    type="text"
                    required
                    value={adminLastName}
                    onChange={(e) => setAdminLastName(e.target.value)}
                    placeholder="Например: Иванов"
                    className="w-full bg-slate-950 text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Имя администратора *
                  </label>
                  <input
                    type="text"
                    required
                    value={adminFirstName}
                    onChange={(e) => setAdminFirstName(e.target.value)}
                    placeholder="Например: Иван"
                    className="w-full bg-slate-950 text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Phone & Date of Birth */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Номер телефона</label>
                  <input
                    type="tel"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(formatUzbekPhoneInput(e.target.value))}
                    placeholder="+998 90 123 45 67"
                    className="w-full bg-slate-950 text-white font-mono p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">Дата рождения *</label>
                    <span className="text-[10px] text-blue-400 font-bold">
                      🎂 {formatAgeWithSuffix(calculateAgeFromBirthDate(adminBirthDate))}
                    </span>
                  </div>
                  <input
                    type="date"
                    required
                    value={adminBirthDate}
                    onChange={(e) => setAdminBirthDate(e.target.value)}
                    className="w-full bg-slate-950 text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Monthly Salary */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Ежемесячная заработная плата (сум) *
                </label>
                <input
                  type="number"
                  required
                  step={50000}
                  value={adminMonthlySalary}
                  onChange={(e) => setAdminMonthlySalary(Number(e.target.value))}
                  placeholder="3500000"
                  className="w-full bg-slate-950 text-white font-bold p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Credentials Box */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-blue-400" />
                    <span>Данные для входа в систему *</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminPassword(generateRandomPassword());
                      setShowAdminPassword(true);
                    }}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-bold"
                  >
                    🎲 Новый пароль
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Логин *</label>
                    <input
                      type="text"
                      required
                      value={adminLogin}
                      onChange={(e) => setAdminLogin(e.target.value)}
                      placeholder="admin_ivan"
                      className={`w-full bg-slate-900 text-white font-mono p-2 rounded-lg border ${
                        checkIsLoginTaken(adminLogin).isTaken
                          ? 'border-rose-500 ring-1 ring-rose-500'
                          : 'border-slate-700'
                      }`}
                    />
                    {checkIsLoginTaken(adminLogin).isTaken && (
                      <p className="text-[10px] text-rose-400 mt-1 font-semibold">
                        ⚠️ Логин занят ({checkIsLoginTaken(adminLogin).ownerName})
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Пароль *</label>
                    <div className="relative">
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        required
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full bg-slate-900 text-white font-mono p-2 rounded-lg border border-slate-700 pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-2 top-2.5 text-slate-400 hover:text-white"
                      >
                        {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informational tip */}
              <div className="p-3 bg-blue-950/40 border border-blue-800/60 rounded-xl text-[11px] text-blue-200">
                💡 <strong>Полный доступ:</strong> У данного администратора будет полный доступ к разделам базы. Все оформляемые им платежи, зачисления и корректировки будут отмечаться его именем в журнале аудита.
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold shadow-lg shadow-blue-600/30"
                >
                  Зарегистрировать администратора
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: ADD DIRECTOR (ФИО, Телефон, Логин, Пароль, Дата рожд) */}
      {/* ------------------------------------------------------------- */}
      {showAddDirectorModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Добавить Директора</h3>
                  <p className="text-[11px] text-slate-400">
                    Руководитель центра со сводным доступом к финансам и отчетам
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddDirectorModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitNewDirector} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  ФИО Директора *
                </label>
                <input
                  type="text"
                  required
                  value={directorFullName}
                  onChange={(e) => setDirectorFullName(e.target.value)}
                  placeholder="Например: Каримов Сардор Давронович"
                  className="w-full bg-slate-950 text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Номер телефона *</label>
                  <input
                    type="tel"
                    required
                    value={directorPhone}
                    onChange={(e) => setDirectorPhone(formatUzbekPhoneInput(e.target.value))}
                    placeholder="+998 90 123 45 67"
                    className="w-full bg-slate-950 text-white font-mono p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">Дата рождения</label>
                    <span className="text-[10px] text-purple-400 font-bold">
                      🎂 {formatAgeWithSuffix(calculateAgeFromBirthDate(directorBirthDate))}
                    </span>
                  </div>
                  <input
                    type="date"
                    value={directorBirthDate}
                    onChange={(e) => setDirectorBirthDate(e.target.value)}
                    className="w-full bg-slate-950 text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Ежемесячный оклад / ставка (сум)
                </label>
                <input
                  type="number"
                  step={50000}
                  value={directorMonthlySalary}
                  onChange={(e) => setDirectorMonthlySalary(Number(e.target.value))}
                  placeholder="6000000"
                  className="w-full bg-slate-950 text-white font-bold p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Director Credentials */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-purple-400" />
                    <span>Данные для входа Директора *</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectorPassword(generateRandomPassword());
                      setShowDirectorPassword(true);
                    }}
                    className="text-[10px] text-purple-400 hover:text-purple-300 font-bold"
                  >
                    🎲 Новый пароль
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Логин *</label>
                    <input
                      type="text"
                      required
                      value={directorLogin}
                      onChange={(e) => setDirectorLogin(e.target.value)}
                      placeholder="director_karimov"
                      className={`w-full bg-slate-900 text-white font-mono p-2 rounded-lg border ${
                        checkIsLoginTaken(directorLogin).isTaken
                          ? 'border-rose-500 ring-1 ring-rose-500'
                          : 'border-slate-700'
                      }`}
                    />
                    {checkIsLoginTaken(directorLogin).isTaken && (
                      <p className="text-[10px] text-rose-400 mt-1 font-semibold">
                        ⚠️ Логин занят ({checkIsLoginTaken(directorLogin).ownerName})
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Пароль *</label>
                    <div className="relative">
                      <input
                        type={showDirectorPassword ? 'text' : 'password'}
                        required
                        value={directorPassword}
                        onChange={(e) => setDirectorPassword(e.target.value)}
                        className="w-full bg-slate-900 text-white font-mono p-2 rounded-lg border border-slate-700 pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDirectorPassword(!showDirectorPassword)}
                        className="absolute right-2 top-2.5 text-slate-400 hover:text-white"
                      >
                        {showDirectorPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddDirectorModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold shadow-lg shadow-purple-600/30"
                >
                  Добавить Директора
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: ADD OTHER STAFF (ФИО, Должность, ЗП, Дата рожд, Тел) */}
      {/* ------------------------------------------------------------- */}
      {showAddOtherStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Добавить другой персонал</h3>
                  <p className="text-[11px] text-slate-400">
                    SMM, мобилографы, клининг, охрана (логин/пароль не требуются)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddOtherStaffModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitNewOtherStaff} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  ФИО сотрудника *
                </label>
                <input
                  type="text"
                  required
                  value={staffFullName}
                  onChange={(e) => setStaffFullName(e.target.value)}
                  placeholder="Например: Рахимова Нигора Анваровна"
                  className="w-full bg-slate-950 text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Должность сотрудника *
                </label>
                <input
                  type="text"
                  required
                  value={staffPosition}
                  onChange={(e) => setStaffPosition(e.target.value)}
                  placeholder="Например: SMM-специалист или Мобилограф"
                  className="w-full bg-slate-950 text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                {/* Quick position suggestion pills */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {STAFF_POSITION_SUGGESTIONS.map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setStaffPosition(pos)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                        staffPosition === pos
                          ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Ежемесячная заработная плата (сум) *
                  </label>
                  <input
                    type="number"
                    required
                    step={50000}
                    value={staffMonthlySalary}
                    onChange={(e) => setStaffMonthlySalary(Number(e.target.value))}
                    placeholder="2500000"
                    className="w-full bg-slate-950 text-white font-bold p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">Дата рождения</label>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      🎂 {formatAgeWithSuffix(calculateAgeFromBirthDate(staffBirthDate))}
                    </span>
                  </div>
                  <input
                    type="date"
                    value={staffBirthDate}
                    onChange={(e) => setStaffBirthDate(e.target.value)}
                    className="w-full bg-slate-950 text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Номер телефона</label>
                <input
                  type="tel"
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(formatUzbekPhoneInput(e.target.value))}
                  placeholder="+998 90 123 45 67"
                  className="w-full bg-slate-950 text-white font-mono p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-[11px] text-emerald-200">
                ℹ️ Для вспомогательного персонала логин и пароль не генерируются. Сотрудник учитывается в расчете ежемесячного зарплатного фонда центра.
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddOtherStaffModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold shadow-lg shadow-emerald-600/30"
                >
                  Добавить в штат
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: EDIT STAFF MEMBER (Admin / Director / Other Staff)    */}
      {/* ------------------------------------------------------------- */}
      {showEditStaffModal && editingStaff && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Редактирование данных сотрудника</h3>
                  <p className="text-[11px] text-slate-400">
                    {editingStaff.role === 'ADMIN' ? 'Администратор' : editingStaff.role === 'DIRECTOR' ? 'Директор' : 'Персонал'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditStaffModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitEditStaff} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">ФИО сотрудника *</label>
                <input
                  type="text"
                  required
                  value={editStaffFullName}
                  onChange={(e) => setEditStaffFullName(e.target.value)}
                  className="w-full bg-slate-950 text-white p-2.5 rounded-xl border border-slate-700"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Должность *</label>
                <input
                  type="text"
                  required
                  value={editStaffPosition}
                  onChange={(e) => setEditStaffPosition(e.target.value)}
                  className="w-full bg-slate-950 text-white p-2.5 rounded-xl border border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Ежемесячная ЗП (сум)</label>
                  <input
                    type="number"
                    value={editStaffMonthlySalary}
                    onChange={(e) => setEditStaffMonthlySalary(Number(e.target.value))}
                    className="w-full bg-slate-950 text-white font-bold p-2.5 rounded-xl border border-slate-700"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">Дата рождения</label>
                    <span className="text-[10px] text-indigo-400 font-bold">
                      🎂 {formatAgeWithSuffix(calculateAgeFromBirthDate(editStaffBirthDate))}
                    </span>
                  </div>
                  <input
                    type="date"
                    value={editStaffBirthDate}
                    onChange={(e) => setEditStaffBirthDate(e.target.value)}
                    className="w-full bg-slate-950 text-white p-2.5 rounded-xl border border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Номер телефона</label>
                <input
                  type="tel"
                  value={editStaffPhone}
                  onChange={(e) => setEditStaffPhone(formatUzbekPhoneInput(e.target.value))}
                  className="w-full bg-slate-950 text-white font-mono p-2.5 rounded-xl border border-slate-700"
                />
              </div>

              {(editingStaff.role === 'ADMIN' || editingStaff.role === 'DIRECTOR') && (
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-bold flex items-center space-x-1">
                      <Key className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Учетные данные</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditStaffPassword(generateRandomPassword());
                        setShowEditStaffPassword(true);
                      }}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
                    >
                      🎲 Новый пароль
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 text-[10px]">Логин</label>
                      <input
                        type="text"
                        value={editStaffLogin}
                        onChange={(e) => setEditStaffLogin(e.target.value)}
                        className={`w-full bg-slate-900 text-white font-mono p-2 rounded-lg border ${
                          checkIsLoginTaken(editStaffLogin, undefined, editingStaff.id).isTaken
                            ? 'border-rose-500 ring-1 ring-rose-500'
                            : 'border-slate-700'
                        }`}
                      />
                      {checkIsLoginTaken(editStaffLogin, undefined, editingStaff.id).isTaken && (
                        <p className="text-[10px] text-rose-400 mt-1 font-semibold">
                          ⚠️ Логин занят
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px]">Пароль</label>
                      <div className="relative">
                        <input
                          type={showEditStaffPassword ? 'text' : 'password'}
                          value={editStaffPassword}
                          onChange={(e) => setEditStaffPassword(e.target.value)}
                          className="w-full bg-slate-900 text-white font-mono p-2 rounded-lg border border-slate-700 pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditStaffPassword(!showEditStaffPassword)}
                          className="absolute right-2 top-2 text-slate-400 hover:text-white"
                        >
                          {showEditStaffPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditStaffModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold shadow-lg shadow-indigo-600/30"
                >
                  Сохранить изменения
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 5: ADD TEACHER (Преподаватель)                           */}
      {/* ------------------------------------------------------------- */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Зачислить нового учителя</h3>
                  <p className="text-[11px] text-slate-400">
                    Привязка к предмету, расчет возраста по дате рождения и генерация кабинета
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddTeacherModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitNewTeacher} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">ФИО Преподавателя *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Алимов Фарход"
                    className="w-full bg-slate-950 text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Номер телефона</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatUzbekPhoneInput(e.target.value))}
                    placeholder="+998 90 123 45 67"
                    className="w-full bg-slate-950 text-white font-mono p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Date of Birth */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">Дата рождения *</label>
                  <span className="text-[10px] text-indigo-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    🎂 Возраст: {formatAgeWithSuffix(calculateAgeFromBirthDate(birthDate))}
                  </span>
                </div>
                <input
                  type="date"
                  required
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full bg-slate-950 text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Subject Selection from Database */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-200 font-bold flex items-center space-x-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Предмет преподавания (из базы) *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSubjectModal(true)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
                  >
                    + Управление базой
                  </button>
                </div>

                <select
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    if (e.target.value !== 'CUSTOM') {
                      const found = subjects.find((s) => s.id === e.target.value);
                      if (found) setCustomSubjectName(found.name);
                    }
                  }}
                  className="w-full bg-slate-900 text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="">-- Выберите предмет ({subjects.length} доступно) --</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} {sub.category ? `(${sub.category})` : ''}
                    </option>
                  ))}
                  <option value="CUSTOM">✍️ Другой предмет (ввести вручную)...</option>
                </select>

                {selectedSubjectId === 'CUSTOM' && (
                  <input
                    type="text"
                    required
                    value={customSubjectName}
                    onChange={(e) => setCustomSubjectName(e.target.value)}
                    placeholder="Введите название предмета..."
                    className="w-full bg-slate-900 text-white p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>

              {/* Salary Model */}
              <div className="space-y-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <label className="block text-slate-300 font-bold mb-1">Модель оплаты труда:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSalaryModel('PERCENTAGE')}
                    className={`p-2 rounded-xl text-center border font-semibold transition-all ${
                      salaryModel === 'PERCENTAGE'
                        ? 'bg-indigo-600/30 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Процент (%)
                  </button>

                  <button
                    type="button"
                    onClick={() => setSalaryModel('FIXED')}
                    className={`p-2 rounded-xl text-center border font-semibold transition-all ${
                      salaryModel === 'FIXED'
                        ? 'bg-indigo-600/30 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Фикса (Ставка)
                  </button>

                  <button
                    type="button"
                    onClick={() => setSalaryModel('CONTRACTUAL')}
                    className={`p-2 rounded-xl text-center border font-semibold transition-all ${
                      salaryModel === 'CONTRACTUAL'
                        ? 'bg-indigo-600/30 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Договорная
                  </button>
                </div>

                {salaryModel === 'PERCENTAGE' && (
                  <div className="pt-2">
                    <label className="block text-slate-400 mb-1">
                      Процент % от фактически собранных средств:
                    </label>
                    <input
                      type="number"
                      value={percentageRate}
                      onChange={(e) => setPercentageRate(Number(e.target.value))}
                      className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-700"
                    />
                  </div>
                )}

                {salaryModel === 'FIXED' && (
                  <div className="pt-2">
                    <label className="block text-slate-400 mb-1">Фиксированная ставка в месяц (сум):</label>
                    <input
                      type="number"
                      value={fixedRate}
                      onChange={(e) => setFixedRate(Number(e.target.value))}
                      className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-700"
                    />
                  </div>
                )}
              </div>

              {/* Login credentials */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Учетные данные учителя *</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPassword(generateRandomPassword());
                      setShowTeacherPassword(true);
                    }}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
                  >
                    🎲 Новый пароль
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Логин *</label>
                    <input
                      type="text"
                      required
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      className={`w-full bg-slate-900 text-white font-mono p-2 rounded-lg border ${
                        checkIsLoginTaken(login).isTaken
                          ? 'border-rose-500 ring-1 ring-rose-500'
                          : 'border-slate-700'
                      }`}
                    />
                    {checkIsLoginTaken(login).isTaken && (
                      <p className="text-[10px] text-rose-400 mt-1 font-semibold">
                        ⚠️ Логин занят ({checkIsLoginTaken(login).ownerName})
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Пароль *</label>
                    <div className="relative">
                      <input
                        type={showTeacherPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-900 text-white font-mono p-2 rounded-lg border border-slate-700 pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTeacherPassword(!showTeacherPassword)}
                        className="absolute right-2 top-2.5 text-slate-400 hover:text-white"
                      >
                        {showTeacherPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddTeacherModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold shadow-lg shadow-indigo-600/30"
                >
                  Зачислить учителя
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 6: EDIT TEACHER (с возможностью смены логина и пароля)   */}
      {/* ------------------------------------------------------------- */}
      {showEditTeacherModal && editingTeacher && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Редактирование профиля преподавателя</h3>
                  <p className="text-[11px] text-slate-400">
                    Изменение данных, даты рождения, предмета, логина и пароля
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditTeacherModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitEditTeacher} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">ФИО Преподавателя *</label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full bg-slate-950 text-white p-2.5 rounded-xl border border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Номер телефона</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(formatUzbekPhoneInput(e.target.value))}
                    className="w-full bg-slate-950 text-white font-mono p-2.5 rounded-xl border border-slate-700"
                  />
                </div>
              </div>

              {/* Date of Birth */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">Дата рождения *</label>
                  <span className="text-[10px] text-indigo-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    🎂 Возраст: {formatAgeWithSuffix(calculateAgeFromBirthDate(editBirthDate))}
                  </span>
                </div>
                <input
                  type="date"
                  required
                  value={editBirthDate}
                  onChange={(e) => setEditBirthDate(e.target.value)}
                  className="w-full bg-slate-950 text-white p-2.5 rounded-xl border border-slate-700"
                />
              </div>

              {/* Subject Selection */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <label className="block text-slate-200 font-bold flex items-center space-x-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Предмет преподавания *</span>
                </label>

                <select
                  value={editSubjectId}
                  onChange={(e) => {
                    setEditSubjectId(e.target.value);
                    if (e.target.value !== 'CUSTOM') {
                      const found = subjects.find((s) => s.id === e.target.value);
                      if (found) setEditSubjectName(found.name);
                    }
                  }}
                  className="w-full bg-slate-900 text-white p-2.5 rounded-xl border border-slate-700 font-medium"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} {sub.category ? `(${sub.category})` : ''}
                    </option>
                  ))}
                  <option value="CUSTOM">-- Другой предмет (ввести вручную) --</option>
                </select>

                {editSubjectId === 'CUSTOM' && (
                  <input
                    type="text"
                    required
                    value={editSubjectName}
                    onChange={(e) => setEditSubjectName(e.target.value)}
                    className="w-full bg-slate-900 text-white p-2.5 rounded-xl border border-slate-700"
                  />
                )}
              </div>

              {/* Edit Login & Password */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Учетные данные для входа в кабинет *</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditPassword(generateRandomPassword());
                      setShowEditTeacherPassword(true);
                    }}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
                  >
                    🎲 Сгенерировать новый пароль
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Логин *</label>
                    <input
                      type="text"
                      required
                      value={editLogin}
                      onChange={(e) => setEditLogin(e.target.value)}
                      className={`w-full bg-slate-900 text-white font-mono p-2 rounded-lg border ${
                        checkIsLoginTaken(editLogin, editingTeacher.id).isTaken
                          ? 'border-rose-500 ring-1 ring-rose-500'
                          : 'border-slate-700'
                      }`}
                    />
                    {checkIsLoginTaken(editLogin, editingTeacher.id).isTaken && (
                      <p className="text-[10px] text-rose-400 mt-1 font-semibold">
                        ⚠️ Логин занят ({checkIsLoginTaken(editLogin, editingTeacher.id).ownerName})
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Пароль *</label>
                    <div className="relative">
                      <input
                        type={showEditTeacherPassword ? 'text' : 'password'}
                        required
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="w-full bg-slate-900 text-white font-mono p-2 rounded-lg border border-slate-700 pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditTeacherPassword(!showEditTeacherPassword)}
                        className="absolute right-2 top-2.5 text-slate-400 hover:text-white"
                      >
                        {showEditTeacherPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Salary Model */}
              <div className="space-y-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <label className="block text-slate-300 font-bold mb-1">Модель оплаты:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditSalaryModel('PERCENTAGE')}
                    className={`p-2 rounded-xl text-center border font-semibold transition-all ${
                      editSalaryModel === 'PERCENTAGE'
                        ? 'bg-indigo-600/30 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Процент (%)
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditSalaryModel('FIXED')}
                    className={`p-2 rounded-xl text-center border font-semibold transition-all ${
                      editSalaryModel === 'FIXED'
                        ? 'bg-indigo-600/30 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Фикса (Ставка)
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditSalaryModel('CONTRACTUAL')}
                    className={`p-2 rounded-xl text-center border font-semibold transition-all ${
                      editSalaryModel === 'CONTRACTUAL'
                        ? 'bg-indigo-600/30 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Договорная
                  </button>
                </div>

                {editSalaryModel === 'PERCENTAGE' && (
                  <div className="pt-2">
                    <label className="block text-slate-400 mb-1">
                      Процент % от фактически собранных средств:
                    </label>
                    <input
                      type="number"
                      value={editPercentageRate}
                      onChange={(e) => setEditPercentageRate(Number(e.target.value))}
                      className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-700"
                    />
                  </div>
                )}

                {editSalaryModel === 'FIXED' && (
                  <div className="pt-2">
                    <label className="block text-slate-400 mb-1">
                      Фиксированная ставка в месяц (сум):
                    </label>
                    <input
                      type="number"
                      value={editFixedRate}
                      onChange={(e) => setEditFixedRate(Number(e.target.value))}
                      className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-700"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditTeacherModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold shadow-lg shadow-indigo-600/30"
                >
                  Сохранить изменения
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL SUBJECTS DIRECTORY MODAL */}
      <SubjectManagementModal
        isOpen={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        subjects={subjects}
        teachers={teachers}
        courses={courses}
        onAddSubject={onAddSubject}
        onUpdateSubject={onUpdateSubject}
        onDeleteSubject={onDeleteSubject}
        onClearSubjects={onClearSubjects}
      />
    </div>
  );
};
