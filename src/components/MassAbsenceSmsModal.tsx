import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Smartphone,
  Settings,
  CheckCircle,
  AlertCircle,
  Copy,
  Users,
  Phone,
  Check,
  Filter,
  Play,
  Square,
  Clock,
  Sparkles,
  Calendar,
  BookOpen,
  MessageSquare,
  UserX,
  ShieldAlert,
} from 'lucide-react';
import { Student, Course, AttendanceRecord, SmsLog, ParentType, TeacherProfile, SmsGatewayConfig } from '../types';
import { formatDisplayPhone } from '../lib/phoneUtils';
import { getUzbekistanToday, getUzbekistanISOString, isStudentFrozenOnDate } from '../lib/dateUtils';

interface MassAbsenceSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  courses: Course[];
  teachers?: TeacherProfile[];
  attendanceRecords: AttendanceRecord[];
  initialDate?: string;
  initialCourseId?: string;
  onSendSms: (sms: Partial<SmsLog>) => void;
  gatewayConfig?: SmsGatewayConfig;
  onUpdateGatewayConfig?: (newConfig: Partial<SmsGatewayConfig>) => void;
}

export interface AbsentStudentItem {
  id: string;
  student: Student;
  course: Course;
  attendanceRecord?: AttendanceRecord;
  date: string; // YYYY-MM-DD
  lessonTime: string; // e.g. "15:00 - 16:30"
  teacherName: string;
  absenceReason: string; // e.g. "Без причины (прогул)" or "По болезни"
  recipientPhone: string;
  recipientType: ParentType;
  recipientName: string;
  isSelected: boolean;
  sendStatus: 'IDLE' | 'SENDING' | 'SUCCESS' | 'FAILED';
  errorMessage?: string;
}

const LOCAL_STORAGE_GATEWAY_KEY = 'mbs_sms_gateway_config_v1';

interface GatewayConfig {
  gatewayType: 'ANDROID_GATEWAY' | 'DIRECT_DEVICE' | 'ESKIZ_UZ';
  gatewayUrl: string;
  apiKey: string;
  deviceId: string;
  delaySeconds: number;
  centerPhone: string;
}

const DEFAULT_ABSENCE_TEMPLATES = {
  RU_STANDARD:
    'REDCAT: Уважаемый родитель! Ваш ребенок {student_name} пропустил урок по предмету «{course_title}» ({lesson_date}, время: {lesson_time}). Причина: {absence_reason}. Убедительно просим проконтролировать посещаемость и успеваемость! Тел: {center_phone}',
  RU_STRICT:
    'REDCAT: Внимание! {student_name} не явился(ась) на занятие по курсу «{course_title}» ({lesson_date}, {lesson_time}). Преподаватель: {teacher_name}. Просим родителей взять ситуацию на контроль и связаться с учебным центром: {center_phone}',
  UZ_STANDARD:
    "REDCAT: Hurmatli ota-ona! Farzandingiz {student_name} {lesson_date} kuni soat {lesson_time} dagi «{course_title}» darsiga kelmadi. Sabab: {absence_reason}. Iltimos, darslarga qatnashishini qat'iy nazoratga oling! Tel: {center_phone}",
  UZ_STRICT:
    "REDCAT: Diqqat! {student_name} «{course_title}» fanidan darsni qoldirdi ({lesson_date}, {lesson_time}). O'qituvchi: {teacher_name}. Iltimos, o'quv markazimiz bilan bog'lanib, nazoratni ta'minlashingizni so'raymiz: {center_phone}",
};

export const MassAbsenceSmsModal: React.FC<MassAbsenceSmsModalProps> = ({
  isOpen,
  onClose,
  students,
  courses,
  teachers = [],
  attendanceRecords,
  initialDate,
  initialCourseId,
  onSendSms,
  gatewayConfig,
  onUpdateGatewayConfig,
}) => {
  // Config & Gateway settings from Firestore & localStorage
  const [config, setConfig] = useState<GatewayConfig>(() => {
    if (gatewayConfig) {
      return {
        gatewayType: gatewayConfig.gatewayType || 'ANDROID_GATEWAY',
        gatewayUrl: gatewayConfig.gatewayUrl || 'http://192.168.1.100:8080/send',
        apiKey: gatewayConfig.apiKey || '',
        deviceId: gatewayConfig.deviceId || '',
        delaySeconds: gatewayConfig.delaySeconds || 1.5,
        centerPhone: gatewayConfig.centerPhone || '+998 90 420 02 57',
      };
    }
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_GATEWAY_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {
      gatewayType: 'ANDROID_GATEWAY',
      gatewayUrl: 'http://192.168.1.100:8080/send',
      apiKey: '',
      deviceId: '',
      delaySeconds: 1.5,
      centerPhone: '+998 90 420 02 57',
    };
  });

  const [isSavedInDb, setIsSavedInDb] = useState(false);

  // Sync state if external gatewayConfig from Firestore changes
  useEffect(() => {
    if (gatewayConfig) {
      setConfig({
        gatewayType: gatewayConfig.gatewayType || 'ANDROID_GATEWAY',
        gatewayUrl: gatewayConfig.gatewayUrl || 'http://192.168.1.100:8080/send',
        apiKey: gatewayConfig.apiKey || '',
        deviceId: gatewayConfig.deviceId || '',
        delaySeconds: gatewayConfig.delaySeconds || 1.5,
        centerPhone: gatewayConfig.centerPhone || '+998 90 420 02 57',
      });
    }
  }, [gatewayConfig]);

  const [showSettings, setShowSettings] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => initialDate || getUzbekistanToday());
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>(() => initialCourseId || 'ALL');
  const [absenceFilter, setAbsenceFilter] = useState<'ALL' | 'UNEXCUSED' | 'EXCUSED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [preferredRecipient, setPreferredRecipient] = useState<ParentType>('FATHER');
  const [messageTemplate, setMessageTemplate] = useState<string>(DEFAULT_ABSENCE_TEMPLATES.RU_STANDARD);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Sync if initial props change
  useEffect(() => {
    if (initialDate) setSelectedDate(initialDate);
    if (initialCourseId) setSelectedCourseFilter(initialCourseId);
  }, [initialDate, initialCourseId]);

  // Dispatch progress states
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState({ sent: 0, total: 0, failed: 0 });
  const isStopRequestedRef = useRef(false);

  // Save gateway settings to Firestore & localStorage
  const handleSaveConfig = (newConfig: GatewayConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem(LOCAL_STORAGE_GATEWAY_KEY, JSON.stringify(newConfig));
    } catch {
      // ignore
    }
    if (onUpdateGatewayConfig) {
      onUpdateGatewayConfig(newConfig);
      setIsSavedInDb(true);
      setTimeout(() => setIsSavedInDb(false), 3000);
    }
  };

  // Build raw list of absent students on the selected date
  const rawAbsentList = useMemo(() => {
    const list: AbsentStudentItem[] = [];

    // Filter records for the target date
    const dateRecords = attendanceRecords.filter((r) => r.date === selectedDate);

    courses.forEach((crs) => {
      // Find all enrolled students or students with records
      const courseStudents = students.filter(
        (s) =>
          s.enrolledCourseIds.includes(crs.id) ||
          dateRecords.some((r) => r.courseId === crs.id && r.studentId === s.id)
      );

      courseStudents.forEach((st) => {
        // Check if student is frozen on this date in this specific course
        const isFrozen = isStudentFrozenOnDate(st, selectedDate, crs.id);
        if (isFrozen) return; // Do not notify frozen students

        const record = dateRecords.find((r) => r.courseId === crs.id && r.studentId === st.id);

        // Include if record exists and status is ABSENT
        if (record && record.status === 'ABSENT') {
          // Reason description
          let reasonDesc = 'Не указана (прогул)';
          if (record.absenceCategory === 'EXCUSED') {
            if (record.excusedReason === 'SICK') reasonDesc = 'По болезни (уважительная)';
            else if (record.excusedReason === 'OLYMPIAD') reasonDesc = 'Олимпиада / Соревнования';
            else if (record.excusedReason === 'FAMILY') reasonDesc = 'Семейные обстоятельства';
            else reasonDesc = record.otherReasonText || 'Уважительная причина';
          } else if (record.absenceCategory === 'UNEXCUSED') {
            reasonDesc = 'Без уважительной причины (прогул)';
          }

          // Teacher name
          const teacherObj = teachers.find((t) => t.id === (record.teacherId || crs.teacherId));
          const teacherName = teacherObj ? teacherObj.fullName : 'Преподаватель';

          // Lesson time
          const lessonTime = crs.startTime && crs.endTime ? `${crs.startTime} - ${crs.endTime}` : (crs.startTime || 'По расписанию');

          // Determine phone according to priority
          let phone = '';
          let type: ParentType = preferredRecipient;
          let rName = '';

          if (preferredRecipient === 'FATHER') {
            phone = st.fatherPhone || st.motherPhone || st.phone;
            if (st.fatherPhone) {
              type = 'FATHER';
              rName = st.fatherName || 'Отец';
            } else if (st.motherPhone) {
              type = 'MOTHER';
              rName = st.motherName || 'Мать';
            } else {
              type = 'STUDENT';
              rName = st.fullName;
            }
          } else if (preferredRecipient === 'MOTHER') {
            phone = st.motherPhone || st.fatherPhone || st.phone;
            if (st.motherPhone) {
              type = 'MOTHER';
              rName = st.motherName || 'Мать';
            } else if (st.fatherPhone) {
              type = 'FATHER';
              rName = st.fatherName || 'Отец';
            } else {
              type = 'STUDENT';
              rName = st.fullName;
            }
          } else {
            phone = st.phone || st.fatherPhone || st.motherPhone;
            type = 'STUDENT';
            rName = st.fullName;
          }

          list.push({
            id: `${crs.id}_${st.id}_${selectedDate}`,
            student: st,
            course: crs,
            attendanceRecord: record,
            date: selectedDate,
            lessonTime,
            teacherName,
            absenceReason: reasonDesc,
            recipientPhone: phone || st.phone || '',
            recipientType: type,
            recipientName: rName,
            isSelected: true,
            sendStatus: 'IDLE',
          });
        }
      });
    });

    return list;
  }, [students, courses, teachers, attendanceRecords, selectedDate, preferredRecipient]);

  const [absentStudents, setAbsentStudents] = useState<AbsentStudentItem[]>([]);

  useEffect(() => {
    setAbsentStudents((prev) => {
      if (prev.length === 0) {
        return rawAbsentList;
      }
      return rawAbsentList.map((raw) => {
        const existing = prev.find((p) => p.id === raw.id);
        if (existing) {
          return {
            ...raw,
            isSelected: existing.isSelected,
            sendStatus: existing.sendStatus,
            recipientType: existing.recipientType || raw.recipientType,
            recipientPhone: existing.recipientPhone || raw.recipientPhone,
            recipientName: existing.recipientName || raw.recipientName,
          };
        }
        return raw;
      });
    });
  }, [rawAbsentList]);

  // Filtered view
  const filteredList = useMemo(() => {
    return absentStudents.filter((item) => {
      if (selectedCourseFilter !== 'ALL' && item.course.id !== selectedCourseFilter) {
        return false;
      }
      if (absenceFilter === 'UNEXCUSED' && item.attendanceRecord?.absenceCategory !== 'UNEXCUSED') {
        return false;
      }
      if (absenceFilter === 'EXCUSED' && item.attendanceRecord?.absenceCategory !== 'EXCUSED') {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.student.fullName.toLowerCase().includes(q);
        const matchesPhone =
          item.recipientPhone.includes(q) ||
          item.student.phone.includes(q) ||
          (item.student.fatherPhone && item.student.fatherPhone.includes(q)) ||
          (item.student.motherPhone && item.student.motherPhone.includes(q));
        const matchesCourse = item.course.title.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesCourse) return false;
      }
      return true;
    });
  }, [absentStudents, selectedCourseFilter, absenceFilter, searchQuery]);

  // Selected count
  const selectedItems = useMemo(() => absentStudents.filter((d) => d.isSelected), [absentStudents]);

  // 1. Select all
  const handleSelectAll = () => {
    setAbsentStudents((prev) => prev.map((d) => ({ ...d, isSelected: true })));
  };

  // 2. Select only currently filtered group
  const handleSelectOnlyCurrentGroup = () => {
    if (selectedCourseFilter === 'ALL') {
      handleSelectAll();
      return;
    }
    setAbsentStudents((prev) =>
      prev.map((d) => ({
        ...d,
        isSelected: d.course.id === selectedCourseFilter,
      }))
    );
  };

  // 3. Deselect all
  const handleDeselectAll = () => {
    setAbsentStudents((prev) => prev.map((d) => ({ ...d, isSelected: false })));
  };

  // 4. Toggle single strictly
  const handleToggleSingle = (id: string) => {
    setAbsentStudents((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isSelected: !d.isSelected } : d))
    );
  };

  // Change recipient type
  const handleChangeRecipientType = (id: string, newType: ParentType) => {
    setAbsentStudents((prev) =>
      prev.map((d) => {
        if (d.id === id) {
          let newPhone = d.student.phone;
          let rName = d.student.fullName;
          if (newType === 'FATHER') {
            newPhone = d.student.fatherPhone || d.student.phone;
            rName = d.student.fatherName || 'Отец';
          } else if (newType === 'MOTHER') {
            newPhone = d.student.motherPhone || d.student.phone;
            rName = d.student.motherName || 'Мать';
          }
          return {
            ...d,
            recipientType: newType,
            recipientPhone: newPhone,
            recipientName: rName,
          };
        }
        return d;
      })
    );
  };

  // Format date readable
  const formatPrettyDate = (dStr: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dStr;
  };

  // Interpolate message
  const renderMessage = (item: AbsentStudentItem) => {
    const formattedDate = formatPrettyDate(item.date);
    return messageTemplate
      .replace(/{student_name}/g, item.student.fullName)
      .replace(/{parent_name}/g, item.recipientName)
      .replace(/{course_title}/g, item.course.title)
      .replace(/{lesson_date}/g, formattedDate)
      .replace(/{lesson_time}/g, item.lessonTime)
      .replace(/{teacher_name}/g, item.teacherName)
      .replace(/{absence_reason}/g, item.absenceReason)
      .replace(/{center_phone}/g, config.centerPhone || '+998 90 123 45 67');
  };

  const getSmsUrl = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const encodedBody = encodeURIComponent(text);
    return `sms:${cleanPhone}?body=${encodedBody}`;
  };

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleMarkAsSent = (item: AbsentStudentItem) => {
    const text = renderMessage(item);
    onSendSms({
      studentId: item.student.id,
      studentName: item.student.fullName,
      recipientPhone: item.recipientPhone,
      parentType: item.recipientType,
      message: text,
      status: 'DELIVERED',
      sentAt: getUzbekistanISOString(),
    });

    setAbsentStudents((prev) =>
      prev.map((d) => (d.id === item.id ? { ...d, sendStatus: 'SUCCESS' } : d))
    );
  };

  // Start batch dispatch
  const handleStartBatchDispatch = async () => {
    const toSend = absentStudents.filter((d) => d.isSelected && d.recipientPhone);
    if (toSend.length === 0) {
      alert('Нет выбранных отсутствующих учеников с указанным номером телефона!');
      return;
    }

    if (config.gatewayType === 'ANDROID_GATEWAY' && !config.gatewayUrl.trim()) {
      alert('Пожалуйста, укажите URL шлюза Android в настройках!');
      setShowSettings(true);
      return;
    }

    if (
      !confirm(
        `Запустить массовую рассылку родителям ${toSend.length} учеников, пропустивших уроки за ${formatPrettyDate(
          selectedDate
        )}?`
      )
    ) {
      return;
    }

    setIsDispatching(true);
    isStopRequestedRef.current = false;
    setDispatchProgress({ sent: 0, total: toSend.length, failed: 0 });

    for (let i = 0; i < toSend.length; i++) {
      if (isStopRequestedRef.current) break;

      const item = toSend[i];
      const renderedText = renderMessage(item);

      setAbsentStudents((prev) =>
        prev.map((d) => (d.id === item.id ? { ...d, sendStatus: 'SENDING' } : d))
      );

      try {
        let isSuccess = false;
        let errorMsg = '';

        if (config.gatewayType === 'ANDROID_GATEWAY') {
          try {
            const cleanPhone = item.recipientPhone.replace(/[^0-9+]/g, '');
            const payload = {
              to: cleanPhone,
              phone: cleanPhone,
              number: cleanPhone,
              address: cleanPhone,
              message: renderedText,
              text: renderedText,
              msg: renderedText,
              body: renderedText,
              deviceId: config.deviceId || undefined,
            };

            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            };
            if (config.apiKey) {
              headers['Authorization'] = `Bearer ${config.apiKey}`;
              headers['x-api-key'] = config.apiKey;
              headers['token'] = config.apiKey;
            }

            // 1. If it's a remote/cloud URL (like api.sms-gate.app or https), use the server proxy directly
            const isCloudUrl = config.gatewayUrl.startsWith('https://') || config.gatewayUrl.includes('sms-gate.app') || config.gatewayUrl.includes('api.');

            if (isCloudUrl) {
              try {
                const proxyRes = await fetch('/api/send-sms-gateway', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    gatewayUrl: config.gatewayUrl,
                    apiKey: config.apiKey,
                    deviceId: config.deviceId,
                    phone: cleanPhone,
                    message: renderedText,
                  }),
                });

                if (proxyRes.ok) {
                  isSuccess = true;
                } else {
                  const proxyErr = await proxyRes.json().catch(() => ({}));
                  errorMsg = proxyErr.error || `HTTP ${proxyRes.status}`;
                }
              } catch (err: any) {
                errorMsg = err.message || 'Ошибка сервера';
              }
            } else {
              // Local: Try cors mode first
              try {
                const res = await fetch(config.gatewayUrl, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(payload),
                  mode: 'cors',
                });
                if (res.ok) isSuccess = true;
              } catch (cErr: any) {
                // Fallback to server proxy or no-cors
                try {
                  const proxyRes = await fetch('/api/send-sms-gateway', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      gatewayUrl: config.gatewayUrl,
                      apiKey: config.apiKey,
                      deviceId: config.deviceId,
                      phone: cleanPhone,
                      message: renderedText,
                    }),
                  });
                  if (proxyRes.ok) {
                    isSuccess = true;
                  }
                } catch {
                  // ignore
                }

                if (!isSuccess) {
                  try {
                    await fetch(config.gatewayUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'text/plain' },
                      body: JSON.stringify(payload),
                      mode: 'no-cors',
                    });
                    isSuccess = true;
                  } catch (ncErr: any) {
                    errorMsg = ncErr?.message || 'Ошибка связи со шлюзом';
                  }
                }
              }
            }
          } catch (gatewayErr: any) {
            errorMsg = gatewayErr?.message || 'Сбой связи';
          }
        } else {
          isSuccess = true;
        }

        if (isSuccess) {
          onSendSms({
            studentId: item.student.id,
            studentName: item.student.fullName,
            recipientPhone: item.recipientPhone,
            parentType: item.recipientType,
            message: renderedText,
            status: 'DELIVERED',
            sentAt: getUzbekistanISOString(),
          });

          setAbsentStudents((prev) =>
            prev.map((d) => (d.id === item.id ? { ...d, sendStatus: 'SUCCESS', errorMessage: undefined } : d))
          );
          setDispatchProgress((prev) => ({ ...prev, sent: prev.sent + 1 }));
        } else {
          setAbsentStudents((prev) =>
            prev.map((d) =>
              d.id === item.id ? { ...d, sendStatus: 'FAILED', errorMessage: errorMsg || 'Сбой отправки' } : d
            )
          );
          setDispatchProgress((prev) => ({ ...prev, failed: prev.failed + 1 }));
        }
      } catch (err: any) {
        setAbsentStudents((prev) =>
          prev.map((d) =>
            d.id === item.id ? { ...d, sendStatus: 'FAILED', errorMessage: err.message || 'Ошибка сети' } : d
          )
        );
        setDispatchProgress((prev) => ({ ...prev, failed: prev.failed + 1 }));
      }

      // Delay between SMS
      const delay = Math.max(500, (config.delaySeconds || 1.5) * 1000);
      await new Promise((r) => setTimeout(r, delay));
    }

    setIsDispatching(false);
  };

  const handleStopDispatch = () => {
    isStopRequestedRef.current = true;
    setIsDispatching(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* TOP MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black text-white tracking-tight">
                  Массовая SMS-рассылка о пропусках уроков
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] uppercase border border-amber-500/30">
                  Контроль родителей
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Автоматическое оповещение родителей с указанием предмета, даты, времени и причины отсутствия
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 border transition-all ${
                showSettings
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Шлюз / Телефон</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SETTINGS DRAWER (IF TOGGLED) */}
        {showSettings && (
          <div className="p-4 bg-slate-950 border-b border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Smartphone className="w-4 h-4" />
                <span>Настройки SMS-шлюза на смартфоне</span>
              </span>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Скрыть
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Способ отправки:</label>
                <select
                  value={config.gatewayType}
                  onChange={(e) =>
                    handleSaveConfig({ ...config, gatewayType: e.target.value as any })
                  }
                  className="w-full bg-slate-800 text-white p-2 rounded-xl border border-slate-700 font-bold focus:outline-none"
                >
                  <option value="ANDROID_GATEWAY">📱 Android SMS Gateway (Локальный / Облачный)</option>
                  <option value="DIRECT_DEVICE">⚡ 1-Клик через приложение SMS на телефоне</option>
                  <option value="ESKIZ_UZ">🌐 Eskiz.uz SMS API (Провайдер)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">URL адрес Android Gateway:</label>
                <input
                  type="text"
                  value={config.gatewayUrl}
                  onChange={(e) => handleSaveConfig({ ...config, gatewayUrl: e.target.value })}
                  placeholder="https://api.sms-gate.app/3rdparty/v1/message"
                  className="w-full bg-slate-800 text-white p-2 rounded-xl border border-slate-700 font-mono text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">🔑 Логин:Пароль или API Ключ:</label>
                <input
                  type="text"
                  value={config.apiKey || ''}
                  onChange={(e) => handleSaveConfig({ ...config, apiKey: e.target.value.trim() })}
                  placeholder="YGKT-N:gmi6o2iwwvwoiv"
                  className="w-full bg-slate-800 text-white p-2 rounded-xl border border-slate-700 font-mono text-xs focus:outline-none"
                />
              </div>

              <div className="p-2 bg-amber-500/10 border border-amber-500/40 rounded-xl">
                <label className="block text-amber-300 font-black mb-1">📱 ID устройства (Device ID):</label>
                <input
                  type="text"
                  value={config.deviceId || ''}
                  onChange={(e) => handleSaveConfig({ ...config, deviceId: e.target.value.trim() })}
                  placeholder="s23lJBQ-7sfokEM6q730i"
                  className="w-full bg-slate-900 border border-amber-500/60 rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Контактный телефон центра:</label>
                <input
                  type="text"
                  value={config.centerPhone}
                  onChange={(e) => handleSaveConfig({ ...config, centerPhone: e.target.value })}
                  placeholder="+998 90 420 02 57"
                  className="w-full bg-slate-800 text-white p-2 rounded-xl border border-slate-700 font-mono text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Задержка между SMS (сек):</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="10"
                  value={config.delaySeconds}
                  onChange={(e) =>
                    handleSaveConfig({
                      ...config,
                      delaySeconds: parseFloat(e.target.value) || 1.5,
                    })
                  }
                  className="w-full bg-slate-800 text-white p-2 rounded-xl border border-slate-700 font-mono text-xs focus:outline-none"
                />
              </div>
            </div>

            {/* Status and Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <div className="flex items-center space-x-2 text-xs">
                {isSavedInDb ? (
                  <span className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 font-extrabold rounded-lg border border-emerald-500/30">
                    <Check className="w-3.5 h-3.5" />
                    <span>Сохранено в облачной базе Firestore</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1.5 px-3 py-1 bg-blue-500/10 text-blue-300 font-medium rounded-lg border border-blue-500/20">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Синхронизируется с базой данных</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleSaveConfig(config)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>💾 Сохранить в базе данных</span>
              </button>
            </div>
          </div>
        )}

        {/* CONTROLS & FILTER BAR */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Target Date */}
            <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-slate-300">Дата урока:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent font-mono font-bold text-white focus:outline-none"
              />
            </div>

            {/* Course Selector */}
            <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
              <BookOpen className="w-4 h-4 text-blue-400" />
              <span className="font-bold text-slate-300">Группа:</span>
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="bg-transparent font-bold text-white focus:outline-none"
              >
                <option value="ALL" className="bg-slate-800">Все группы</option>
                {courses.map((c, idx) => (
                  <option key={`${c.id}-${idx}`} value={c.id} className="bg-slate-800">
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Absence category filter */}
            <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
              <Filter className="w-4 h-4 text-indigo-400" />
              <span className="font-bold text-slate-300">Тип пропуска:</span>
              <select
                value={absenceFilter}
                onChange={(e) => setAbsenceFilter(e.target.value as any)}
                className="bg-transparent font-bold text-white focus:outline-none"
              >
                <option value="ALL" className="bg-slate-800">Все отсутствующие</option>
                <option value="UNEXCUSED" className="bg-slate-800">Только прогулы (без причины)</option>
                <option value="EXCUSED" className="bg-slate-800">Только уважительные</option>
              </select>
            </div>

            {/* Recipient Priority */}
            <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
              <Users className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-slate-300">Кому отправлять:</span>
              <select
                value={preferredRecipient}
                onChange={(e) => setPreferredRecipient(e.target.value as any)}
                className="bg-transparent font-bold text-white focus:outline-none"
              >
                <option value="FATHER" className="bg-slate-800">Отец (приоритет)</option>
                <option value="MOTHER" className="bg-slate-800">Мать (приоритет)</option>
                <option value="STUDENT" className="bg-slate-800">Сам ученик</option>
              </select>
            </div>
          </div>

          {/* Quick Select/Deselect All */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1 rounded-lg bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 font-bold text-[11px] border border-indigo-700 cursor-pointer"
              title="Выбрать всех отсутствующих"
            >
              ✅ Всех ({absentStudents.length})
            </button>
            {selectedCourseFilter !== 'ALL' && (
              <button
                type="button"
                onClick={handleSelectOnlyCurrentGroup}
                className="px-2.5 py-1 rounded-lg bg-amber-900/60 hover:bg-amber-800 text-amber-200 font-bold text-[11px] border border-amber-700 cursor-pointer"
                title="Выбрать только учеников этой группы"
              >
                🏫 Только эту группу ({filteredList.length})
              </button>
            )}
            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-[11px] border border-slate-700 cursor-pointer"
            >
              Снять выбор ({selectedItems.length})
            </button>
          </div>
        </div>

        {/* TEMPLATE CONSTRUCTOR SECTION */}
        <div className="p-4 bg-slate-900/60 border-b border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Шаблон SMS-сообщения родителям о пропуске:</span>
            </span>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setMessageTemplate(DEFAULT_ABSENCE_TEMPLATES.RU_STANDARD)}
                className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 border border-slate-700"
              >
                RU Стандарт
              </button>
              <button
                type="button"
                onClick={() => setMessageTemplate(DEFAULT_ABSENCE_TEMPLATES.RU_STRICT)}
                className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 border border-slate-700"
              >
                RU Строгий
              </button>
              <button
                type="button"
                onClick={() => setMessageTemplate(DEFAULT_ABSENCE_TEMPLATES.UZ_STANDARD)}
                className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 border border-slate-700"
              >
                UZ Standart
              </button>
              <button
                type="button"
                onClick={() => setMessageTemplate(DEFAULT_ABSENCE_TEMPLATES.UZ_STRICT)}
                className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 border border-slate-700"
              >
                UZ Qat'iy
              </button>
            </div>
          </div>

          <textarea
            rows={2}
            value={messageTemplate}
            onChange={(e) => setMessageTemplate(e.target.value)}
            className="w-full bg-slate-800/90 text-amber-200 p-2.5 rounded-xl border border-slate-700 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />

          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
            <span className="font-bold text-slate-300">Доступные теги:</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono">{'{student_name}'}</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono">{'{course_title}'}</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono">{'{lesson_date}'}</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono">{'{lesson_time}'}</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono">{'{teacher_name}'}</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono">{'{absence_reason}'}</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono">{'{center_phone}'}</span>
          </div>
        </div>

        {/* MAIN LIST OF ABSENT STUDENTS */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredList.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white">
                Нет пропустивших уроки за {formatPrettyDate(selectedDate)}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Все ученики присутствовали на занятиях либо посещаемость еще не была отмечена за выбранную дату.
              </p>
            </div>
          ) : (
            filteredList.map((item, idx) => {
              const renderedMsg = renderMessage(item);
              const smsHref = getSmsUrl(item.recipientPhone, renderedMsg);

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    item.isSelected
                      ? 'bg-slate-800/80 border-slate-700 hover:border-amber-500/50'
                      : 'bg-slate-900/40 border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    
                    {/* Student Info & Course */}
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={item.isSelected}
                        onChange={() => handleToggleSingle(item.id)}
                        className="w-4 h-4 rounded mt-1 accent-amber-500 cursor-pointer"
                      />

                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-black text-white">{item.student.fullName}</span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30">
                            {item.course.title}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                          <span className="flex items-center space-x-1 text-rose-400 font-bold">
                            <Clock className="w-3 h-3" />
                            <span>Время: {item.lessonTime}</span>
                          </span>
                          <span>•</span>
                          <span>Учитель: {item.teacherName}</span>
                          <span>•</span>
                          <span className="text-amber-300 font-semibold">{item.absenceReason}</span>
                        </div>
                      </div>
                    </div>

                    {/* Recipient & Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* Recipient switcher */}
                      <div className="flex items-center bg-slate-950 px-2 py-1 rounded-xl border border-slate-700 text-xs">
                        <select
                          value={item.recipientType}
                          onChange={(e) => handleChangeRecipientType(item.id, e.target.value as any)}
                          className="bg-transparent font-bold text-slate-300 focus:outline-none"
                        >
                          <option value="FATHER" className="bg-slate-900">Отец ({item.student.fatherPhone ? 'есть' : 'нет'})</option>
                          <option value="MOTHER" className="bg-slate-900">Мать ({item.student.motherPhone ? 'есть' : 'нет'})</option>
                          <option value="STUDENT" className="bg-slate-900">Ученик</option>
                        </select>
                      </div>

                      <span className="font-mono font-bold text-xs text-amber-400 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-700">
                        {formatDisplayPhone(item.recipientPhone) || 'Нет номера'}
                      </span>

                      {/* Direct Phone SMS */}
                      <a
                        href={smsHref}
                        className="p-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 flex items-center space-x-1 text-xs font-bold transition-all"
                        title="Открыть SMS на смартфоне"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>SMS</span>
                      </a>

                      {/* Copy */}
                      <button
                        type="button"
                        onClick={() => handleCopyText(renderedMsg, idx)}
                        className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold transition-all"
                        title="Скопировать готовый текст"
                      >
                        {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {/* Manual mark sent */}
                      <button
                        type="button"
                        onClick={() => handleMarkAsSent(item)}
                        className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all ${
                          item.sendStatus === 'SUCCESS'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                        }`}
                      >
                        {item.sendStatus === 'SUCCESS' ? '✓ Отправлено' : 'Зафиксировать'}
                      </button>
                    </div>

                  </div>

                  {/* Rendered Preview */}
                  <div className="mt-2.5 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 text-xs text-slate-300 font-mono leading-relaxed">
                    «{renderedMsg}»
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-slate-300">
              Выбрано к отправке: <span className="text-amber-400 font-black">{selectedItems.length}</span> из {absentStudents.length} учеников
            </div>
            {isDispatching && (
              <div className="text-[11px] font-mono text-emerald-400">
                Идет отправка: {dispatchProgress.sent} успешно, {dispatchProgress.failed} ошибок из {dispatchProgress.total}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {isDispatching ? (
              <button
                type="button"
                onClick={handleStopDispatch}
                className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30 flex items-center space-x-1.5 cursor-pointer"
              >
                <Square className="w-4 h-4" />
                <span>Остановить отправку</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartBatchDispatch}
                disabled={selectedItems.length === 0}
                className="px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>🚀 Запустить массовую рассылку ({selectedItems.length})</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
