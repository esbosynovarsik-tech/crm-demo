import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  PhoneCall,
  Search,
  Smartphone,
  Copy,
  ExternalLink,
  Check,
  Filter,
  Sparkles,
  UserX,
  DollarSign,
  Trash2,
  BookOpen,
} from 'lucide-react';
import { SmsLog, Student, ParentType, Course, Payment, AttendanceRecord, TeacherProfile, SmsGatewayConfig } from '../types';
import { getUzbekistanISOString, getUzbekistanToday, getUzbekistanCurrentMonthPeriod } from '../lib/dateUtils';
import { formatDisplayPhone } from '../lib/phoneUtils';
import { MassDebtSmsModal } from './MassDebtSmsModal';
import { MassAbsenceSmsModal } from './MassAbsenceSmsModal';

interface SmsModuleProps {
  smsLogs: SmsLog[];
  students: Student[];
  courses?: Course[];
  payments?: Payment[];
  attendanceRecords?: AttendanceRecord[];
  teachers?: TeacherProfile[];
  onSendSms: (sms: Partial<SmsLog>) => void;
  onClearSmsLogs?: () => void;
  gatewayConfig?: SmsGatewayConfig;
  onUpdateGatewayConfig?: (newConfig: Partial<SmsGatewayConfig>) => void;
}

export const SmsModule: React.FC<SmsModuleProps> = ({
  smsLogs,
  students,
  courses = [],
  payments = [],
  attendanceRecords = [],
  teachers = [],
  onSendSms,
  onClearSmsLogs,
  gatewayConfig,
  onUpdateGatewayConfig,
}) => {
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => students[0]?.id || '');
  const [parentType, setParentType] = useState<ParentType>('FATHER');
  const [messageTemplate, setMessageTemplate] = useState<
    'ABSENCE' | 'DEBT' | 'CUSTOM'
  >('ABSENCE');
  const [customText, setCustomText] = useState('');
  const [searchLogQuery, setSearchLogQuery] = useState('');
  
  // Modals state
  const [isMassDebtSmsOpen, setIsMassDebtSmsOpen] = useState(false);
  const [isMassAbsenceSmsOpen, setIsMassAbsenceSmsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Filter students for single SMS picker
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (selectedGroupFilter !== 'ALL' && !s.enrolledCourseIds.includes(selectedGroupFilter)) {
        return false;
      }
      if (studentSearchQuery.trim()) {
        const q = studentSearchQuery.toLowerCase();
        const matchesName = s.fullName.toLowerCase().includes(q);
        const matchesPhone =
          s.phone.includes(q) ||
          (s.fatherPhone && s.fatherPhone.includes(q)) ||
          (s.motherPhone && s.motherPhone.includes(q));
        if (!matchesName && !matchesPhone) return false;
      }
      return true;
    });
  }, [students, selectedGroupFilter, studentSearchQuery]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId) || filteredStudents[0];

  const getRecipientPhone = () => {
    if (!selectedStudent) return '';
    if (parentType === 'FATHER') return selectedStudent.fatherPhone || selectedStudent.phone;
    if (parentType === 'MOTHER') return selectedStudent.motherPhone || selectedStudent.phone;
    return selectedStudent.phone;
  };

  const getComputedMessage = () => {
    if (!selectedStudent) return '';
    if (messageTemplate === 'ABSENCE') {
      return `REDCAT: Уважаемый родитель! Ваш ребенок ${selectedStudent.fullName} отсутствовал на уроке. Просим связаться с учебным центром для уточнения причины и взять посещаемость на контроль.`;
    }
    if (messageTemplate === 'DEBT') {
      return `REDCAT: Напоминаем о необходимости произвести оплату за обучение ученика ${selectedStudent.fullName}. Подробности у администратора.`;
    }
    return customText;
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const phone = getRecipientPhone();
    const text = getComputedMessage();

    if (!phone || !text) {
      alert('Заполните номер получателя и текст SMS!');
      return;
    }

    onSendSms({
      studentId: selectedStudent?.id || '',
      studentName: selectedStudent?.fullName || '',
      recipientPhone: phone,
      parentType,
      message: text,
      status: 'DELIVERED',
      sentAt: getUzbekistanISOString(),
    });

    alert(`SMS успешно зафиксировано для отправки (${phone})!`);
  };

  // Filter logs and sort by newest first (reverse chronological order)
  const sortedAndFilteredLogs = useMemo(() => {
    const filtered = smsLogs.filter((log) => {
      if (!searchLogQuery.trim()) return true;
      const q = searchLogQuery.toLowerCase();
      return (
        log.studentName.toLowerCase().includes(q) ||
        log.recipientPhone.includes(q) ||
        log.message.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      const timeA = new Date(a.sentAt || 0).getTime() || 0;
      const timeB = new Date(b.sentAt || 0).getTime() || 0;
      return timeB - timeA; // Newest first
    });
  }, [smsLogs, searchLogQuery]);

  const currentPhone = getRecipientPhone();
  const currentMsg = getComputedMessage();
  const directSmsUrl = `sms:${currentPhone.replace(/[^0-9+]/g, '')}?body=${encodeURIComponent(currentMsg)}`;

  // Calculate today's absent students count for quick badge
  const todayStr = getUzbekistanToday();
  const todayAbsentCount = attendanceRecords.filter(
    (r) => r.date === todayStr && r.status === 'ABSENT'
  ).length;

  return (
    <div className="space-y-6">
      {/* 2 MASS CAMPAIGN HERO CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* CARD 1: MASS ABSENCE NOTIFICATION */}
        <div className="bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl flex flex-col justify-between space-y-4 relative overflow-hidden">
          <div className="space-y-2 z-10">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white text-slate-950 font-black text-[11px] uppercase tracking-wider shadow-sm">
              <UserX className="w-3.5 h-3.5 text-amber-700" />
              <span>Контроль посещаемости</span>
            </div>
            <h2 className="text-xl font-black tracking-tight leading-snug">
              Рассылка родителям о пропусках уроков
            </h2>
            <p className="text-xs text-amber-100 leading-relaxed">
              Автоматическое формирование персональных SMS для родителей отсутствующих учеников с указанием ФИО, даты, предмета, времени урока и просьбой проконтролировать.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 z-10">
            <span className="text-xs font-bold text-amber-200">
              Сегодня пропусков: <span className="text-white font-black text-sm">{todayAbsentCount}</span>
            </span>
            <button
              type="button"
              onClick={() => setIsMassAbsenceSmsOpen(true)}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-white hover:bg-amber-50 text-slate-950 font-black text-xs shadow-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Send className="w-4 h-4 text-amber-600" />
              <span>📱 Оповестить о пропусках</span>
            </button>
          </div>

          {/* Decorative ambient background */}
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* CARD 2: MASS DEBT NOTIFICATION */}
        <div className="bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl flex flex-col justify-between space-y-4 relative overflow-hidden">
          <div className="space-y-2 z-10">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wider shadow-sm">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Финансовый контроль</span>
            </div>
            <h2 className="text-xl font-black tracking-tight leading-snug">
              Рассылка должникам об оплате обучения
            </h2>
            <p className="text-xs text-blue-100 leading-relaxed">
              Массовая отправка персональных SMS родителям учеников с задолженностью за выбранный расчетный период (с выбором конкретной группы или всех должников базы).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 z-10">
            <span className="text-xs font-bold text-blue-200">
              Расчет по 12 урокам в месяц
            </span>
            <button
              type="button"
              onClick={() => setIsMassDebtSmsOpen(true)}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-xl shadow-amber-400/25 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Send className="w-4 h-4 text-slate-950" />
              <span>💰 Напомнить о долгах</span>
            </button>
          </div>

          {/* Decorative ambient background */}
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        </div>

      </div>

      {/* 2-COLUMN MAIN CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SMS Single Sender Form */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm lg:col-span-1">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Одиночное SMS родителю</span>
          </h2>

          <form onSubmit={handleSend} className="space-y-4 text-xs">
            
            {/* Filter by Group & Search */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-slate-700 dark:text-slate-300 font-bold">
                  Выберите группу и ученика:
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  Найдено: {filteredStudents.length}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="relative">
                  <select
                    value={selectedGroupFilter}
                    onChange={(e) => {
                      setSelectedGroupFilter(e.target.value);
                      const inGroup = students.filter((st) =>
                        e.target.value === 'ALL' ? true : st.enrolledCourseIds.includes(e.target.value)
                      );
                      if (inGroup.length > 0) {
                        setSelectedStudentId(inGroup[0].id);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">Все группы ({students.length})</option>
                    {courses.map((c, idx) => {
                      const cCount = students.filter((s) => s.enrolledCourseIds.includes(c.id)).length;
                      return (
                        <option key={`${c.id}-${idx}`} value={c.id}>
                          {c.title} ({cCount})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder="Поиск по имени..."
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white pl-7 pr-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <select
                value={selectedStudent?.id || ''}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              >
                {filteredStudents.length === 0 ? (
                  <option value="">Учеников не найдено</option>
                ) : (
                  filteredStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({formatDisplayPhone(s.fatherPhone || s.motherPhone || s.phone) || 'без номера'})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Кому отправить:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setParentType('FATHER')}
                  className={`p-2 rounded-xl text-center border font-bold transition-all cursor-pointer ${
                    parentType === 'FATHER'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Отец
                </button>
                <button
                  type="button"
                  onClick={() => setParentType('MOTHER')}
                  className={`p-2 rounded-xl text-center border font-bold transition-all cursor-pointer ${
                    parentType === 'MOTHER'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Мать
                </button>
                <button
                  type="button"
                  onClick={() => setParentType('STUDENT')}
                  className={`p-2 rounded-xl text-center border font-bold transition-all cursor-pointer ${
                    parentType === 'STUDENT'
                      ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Ученик
                </button>
              </div>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 font-mono font-bold mt-1.5">
                Номер: {formatDisplayPhone(currentPhone) || 'Не указан'}
              </p>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Шаблон сообщения:
              </label>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setMessageTemplate('ABSENCE')}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    messageTemplate === 'ABSENCE'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-bold'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  ⚠️ Пропуск занятия (отсутствие)
                </button>

                <button
                  type="button"
                  onClick={() => setMessageTemplate('DEBT')}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    messageTemplate === 'DEBT'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200 font-bold'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  💳 Напоминание об оплате
                </button>

                <button
                  type="button"
                  onClick={() => setMessageTemplate('CUSTOM')}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    messageTemplate === 'CUSTOM'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-bold'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  ✏️ Произвольный текст
                </button>
              </div>
            </div>

            {messageTemplate === 'CUSTOM' ? (
              <textarea
                rows={3}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Введите текст сообщения для родителя..."
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white p-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 italic text-xs leading-relaxed">
                «{currentMsg}»
              </div>
            )}

            {/* Quick Actions (Direct Phone SMS & Copy) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={directSmsUrl}
                className="py-2.5 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center space-x-1.5 border border-blue-200 dark:border-blue-800 transition-all text-center"
                title="Открыть SMS на телефоне"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Открыть SMS</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(currentMsg);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Зафиксировать отправку в журнал</span>
            </button>

          </form>
        </div>

        {/* SMS Logs History */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  История отправленных SMS ({smsLogs.length})
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Поиск по номеру, имени..."
                    value={searchLogQuery}
                    onChange={(e) => setSearchLogQuery(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {onClearSmsLogs && (
                  <button
                    type="button"
                    onClick={onClearSmsLogs}
                    disabled={smsLogs.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 font-bold text-xs flex items-center space-x-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                    title="Очистить историю отправленных SMS-сообщений"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Очистить историю</span>
                  </button>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto pr-1">
              {sortedAndFilteredLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  {smsLogs.length === 0
                    ? 'История SMS пуста. Отправьте первое сообщение или запустите рассылку.'
                    : 'По вашему поисковому запросу ничего не найдено.'}
                </div>
              ) : (
                sortedAndFilteredLogs.map((log) => (
                  <div key={log.id} className="py-3.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {log.studentName}{' '}
                        <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          ({log.parentType === 'FATHER' ? 'Отец' : log.parentType === 'MOTHER' ? 'Мать' : 'Ученик'})
                        </span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">{log.sentAt}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 leading-relaxed">
                      «{log.message}»
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {formatDisplayPhone(log.recipientPhone)}
                      </span>
                      {log.status === 'DELIVERED' ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center space-x-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>ДОСТАВЛЕНО</span>
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 font-extrabold flex items-center space-x-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>ОШИБКА</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Mass Debt SMS Modal */}
      <MassDebtSmsModal
        isOpen={isMassDebtSmsOpen}
        onClose={() => setIsMassDebtSmsOpen(false)}
        students={students}
        courses={courses}
        payments={payments}
        selectedPeriod={getUzbekistanCurrentMonthPeriod()}
        onSendSms={onSendSms}
        gatewayConfig={gatewayConfig}
        onUpdateGatewayConfig={onUpdateGatewayConfig}
      />

      {/* Mass Absence SMS Modal */}
      <MassAbsenceSmsModal
        isOpen={isMassAbsenceSmsOpen}
        onClose={() => setIsMassAbsenceSmsOpen(false)}
        students={students}
        courses={courses}
        teachers={teachers}
        attendanceRecords={attendanceRecords}
        onSendSms={onSendSms}
        gatewayConfig={gatewayConfig}
        onUpdateGatewayConfig={onUpdateGatewayConfig}
      />
    </div>
  );
};
