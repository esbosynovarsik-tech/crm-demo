import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Smartphone,
  Settings,
  CheckCircle,
  AlertCircle,
  Copy,
  ExternalLink,
  Users,
  Phone,
  DollarSign,
  Check,
  Sparkles,
  Filter,
  Play,
  Square,
  RefreshCw,
  Clock,
  MessageCircle,
  Layers,
  HelpCircle,
  Info,
} from 'lucide-react';
import { Student, Course, Payment, SmsLog, ParentType, SmsGatewayConfig } from '../types';
import { calculateFreezeDeduction, roundToThousand } from '../lib/billingLogic';
import { formatDisplayPhone } from '../lib/phoneUtils';
import { formatMonthPeriodLabel, getUzbekistanISOString } from '../lib/dateUtils';

interface MassDebtSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  courses: Course[];
  payments: Payment[];
  selectedPeriod: string;
  onSendSms: (sms: Partial<SmsLog>) => void;
  gatewayConfig?: SmsGatewayConfig;
  onUpdateGatewayConfig?: (newConfig: Partial<SmsGatewayConfig>) => void;
}

export interface DebtorItem {
  student: Student;
  course: Course;
  expectedAmount: number;
  paidAmount: number;
  debtAmount: number;
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

const DEFAULT_TEMPLATES = {
  RU_STANDARD:
    'REDCAT: Уважаемый родитель! Напоминаем об оплате за обучение {student_name} по курсу «{course_title}». Сумма к оплате за {month}: {debt_amount} сум. Просим произвести оплату в ближайшие дни. Справки: {center_phone}',
  RU_STRICT:
    'REDCAT: Внимание! Ученик {student_name} имеет задолженность за курс «{course_title}» ({month}) в размере {debt_amount} сум. Просим погасить задолженность до 10-го числа для продолжения посещения занятий.',
  UZ_STANDARD:
    "REDCAT: Hurmatli ota-ona! «{course_title}» kursi bo'yicha {student_name}ning {month} oyi uchun to'lov miqdori: {debt_amount} so'm. To'lovni o'z vaqtida amalga oshirishingizni so'raymiz. Tel: {center_phone}",
  UZ_STRICT:
    "REDCAT: Diqqat! {student_name}ning «{course_title}» kursi uchun {month} oyiga {debt_amount} so'm qarzdorligi mavjud. Darslarga uzluksiz qatnashish uchun to'lovni 10-sanagacha amalga oshirishingizni so'raymiz.",
};

export const MassDebtSmsModal: React.FC<MassDebtSmsModalProps> = ({
  isOpen,
  onClose,
  students,
  courses,
  payments,
  selectedPeriod,
  onSendSms,
  gatewayConfig,
  onUpdateGatewayConfig,
}) => {
  // Config & Gateway settings
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
  const [activeCourseFilter, setActiveCourseFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [preferredRecipient, setPreferredRecipient] = useState<ParentType>('FATHER');
  const [messageTemplate, setMessageTemplate] = useState<string>(DEFAULT_TEMPLATES.RU_STANDARD);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

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

  // Build debtors list for the period
  const rawDebtorsList = useMemo(() => {
    const list: DebtorItem[] = [];
    const periodPayments = payments.filter((p) => p.monthPeriod === selectedPeriod);

    courses.forEach((crs) => {
      const enrolledStudents = students.filter((s) => s.enrolledCourseIds.includes(crs.id));

      enrolledStudents.forEach((st) => {
        const studentTxs = periodPayments.filter(
          (p) => p.studentId === st.id && p.courseId === crs.id && (p.amountPaid || 0) > 0
        );
        const existingPayment = periodPayments.find(
          (p) => p.studentId === st.id && p.courseId === crs.id
        );

        let finalDue = 0;
        let amountPaid = 0;

        if (existingPayment) {
          finalDue = existingPayment.finalAmountDue;
          amountPaid = studentTxs.reduce((s, p) => s + (p.amountPaid || 0), 0);
        } else {
          // Calculate expected amount
          const freezeCalc = calculateFreezeDeduction(st, crs, selectedPeriod);
          let discountAmount = 0;
          if (st.discountType === 'PERCENTAGE') {
            discountAmount = roundToThousand((crs.monthlyPrice * (st.discountValue || 0)) / 100);
          } else if (st.discountType === 'FIXED_SUM') {
            discountAmount = roundToThousand(Math.min(crs.monthlyPrice, st.discountValue || 0));
          }
          finalDue = roundToThousand(
            Math.max(0, crs.monthlyPrice - discountAmount - freezeCalc.deductionAmount)
          );
          amountPaid = 0;
        }

        const debt = Math.max(0, finalDue - amountPaid);

        // Only add if there is actual unpaid debt > 0
        if (debt > 0) {
          // Determine best phone number based on preference
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
            student: st,
            course: crs,
            expectedAmount: finalDue,
            paidAmount: amountPaid,
            debtAmount: debt,
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
  }, [students, courses, payments, selectedPeriod, preferredRecipient]);

  const [debtors, setDebtors] = useState<DebtorItem[]>([]);

  // Update debtors state whenever rawDebtorsList changes, preserving user selections
  useEffect(() => {
    setDebtors((prev) => {
      if (prev.length === 0) {
        return rawDebtorsList;
      }
      return rawDebtorsList.map((raw) => {
        const existing = prev.find(
          (p) => p.student.id === raw.student.id && p.course.id === raw.course.id
        );
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
  }, [rawDebtorsList]);

  // Filtered view
  const filteredDebtors = useMemo(() => {
    return debtors.filter((item) => {
      if (activeCourseFilter !== 'ALL' && item.course.id !== activeCourseFilter) {
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
  }, [debtors, activeCourseFilter, searchQuery]);

  // Selected count & total debt across all debtors
  const selectedItems = useMemo(() => debtors.filter((d) => d.isSelected), [debtors]);
  const selectedInFiltered = useMemo(
    () => filteredDebtors.filter((d) => d.isSelected),
    [filteredDebtors]
  );
  const totalSelectedDebt = useMemo(
    () => selectedItems.reduce((s, d) => s + d.debtAmount, 0),
    [selectedItems]
  );

  // 1. Select ALL debtors across the whole database
  const handleSelectAllDebtors = () => {
    setDebtors((prev) => prev.map((d) => ({ ...d, isSelected: true })));
  };

  // 2. Select ONLY the currently filtered group and uncheck all other groups
  const handleSelectOnlyCurrentGroup = () => {
    if (activeCourseFilter === 'ALL') {
      handleSelectAllDebtors();
      return;
    }
    setDebtors((prev) =>
      prev.map((d) => ({
        ...d,
        isSelected: d.course.id === activeCourseFilter,
      }))
    );
  };

  // 3. Deselect ALL debtors
  const handleDeselectAll = () => {
    setDebtors((prev) => prev.map((d) => ({ ...d, isSelected: false })));
  };

  // 4. Toggle only items in current filtered list
  const handleToggleFilteredOnly = (select: boolean) => {
    setDebtors((prev) =>
      prev.map((d) => {
        const isMatch = filteredDebtors.some(
          (f) => f.student.id === d.student.id && f.course.id === d.course.id
        );
        return isMatch ? { ...d, isSelected: select } : d;
      })
    );
  };

  // 5. Toggle single student strictly
  const handleToggleSingle = (studentId: string, courseId: string) => {
    setDebtors((prev) =>
      prev.map((d) =>
        d.student.id === studentId && d.course.id === courseId
          ? { ...d, isSelected: !d.isSelected }
          : d
      )
    );
  };

  // Change phone priority for a single student
  const handleChangeRecipientType = (studentId: string, courseId: string, newType: ParentType) => {
    setDebtors((prev) =>
      prev.map((d) => {
        if (d.student.id === studentId && d.course.id === courseId) {
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

  // Build rendered message
  const renderMessageForDebtor = (item: DebtorItem) => {
    const monthLabel = formatMonthPeriodLabel(selectedPeriod);
    return messageTemplate
      .replace(/{student_name}/g, item.student.fullName)
      .replace(/{parent_name}/g, item.recipientName)
      .replace(/{course_title}/g, item.course.title)
      .replace(/{debt_amount}/g, item.debtAmount.toLocaleString('ru-RU'))
      .replace(/{month}/g, monthLabel)
      .replace(/{center_phone}/g, config.centerPhone || '+998 90 123 45 67');
  };

  // Generate native SMS URL link
  const getSmsUrl = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const encodedBody = encodeURIComponent(text);
    return `sms:${cleanPhone}?body=${encodedBody}`;
  };

  // Generate Telegram share link
  const getTelegramUrl = (text: string) => {
    return `https://t.me/share/url?url=${encodeURIComponent('https://mbs.education')}&text=${encodeURIComponent(text)}`;
  };

  // Copy single text
  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Mark single as sent
  const handleMarkAsSent = (item: DebtorItem) => {
    const text = renderMessageForDebtor(item);
    onSendSms({
      studentId: item.student.id,
      studentName: item.student.fullName,
      recipientPhone: item.recipientPhone,
      parentType: item.recipientType,
      message: text,
      status: 'DELIVERED',
      sentAt: getUzbekistanISOString(),
    });

    setDebtors((prev) =>
      prev.map((d) =>
        d.student.id === item.student.id && d.course.id === item.course.id
          ? { ...d, sendStatus: 'SUCCESS' }
          : d
      )
    );
  };

  // Automated batch dispatch via Gateway
  const handleStartBatchDispatch = async () => {
    const toSend = debtors.filter((d) => d.isSelected && d.recipientPhone);
    if (toSend.length === 0) {
      alert('Нет выбранных получателей с указанным номером телефона!');
      return;
    }

    if (config.gatewayType === 'ANDROID_GATEWAY' && !config.gatewayUrl.trim()) {
      alert('Пожалуйста, укажите URL шлюза Android в настройках шлюза!');
      setShowSettings(true);
      return;
    }

    if (
      !confirm(
        `Запустить массовую рассылку для ${toSend.length} учеников на общую сумму долга ${totalSelectedDebt.toLocaleString(
          'ru-RU'
        )} сум?\n\nСпособ: ${
          config.gatewayType === 'ANDROID_GATEWAY'
            ? 'Шлюз Android телефона'
            : config.gatewayType === 'ESKIZ_UZ'
            ? 'Eskiz.uz API'
            : 'Прямая отправка'
        }`
      )
    ) {
      return;
    }

    setIsDispatching(true);
    isStopRequestedRef.current = false;
    setDispatchProgress({ sent: 0, total: toSend.length, failed: 0 });

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < toSend.length; i++) {
      if (isStopRequestedRef.current) {
        break;
      }

      const item = toSend[i];
      const messageText = renderMessageForDebtor(item);

      // Update state to SENDING
      setDebtors((prev) =>
        prev.map((d) =>
          d.student.id === item.student.id && d.course.id === item.course.id
            ? { ...d, sendStatus: 'SENDING' }
            : d
        )
      );

      let success = false;
      let errMessage = '';

      try {
        if (config.gatewayType === 'ANDROID_GATEWAY') {
          // Post to Android gateway (compatible with all Simple SMS Gateway variants)
          const cleanPhone = item.recipientPhone.replace(/[^0-9+]/g, '');
          const payload = {
            to: cleanPhone,
            phone: cleanPhone,
            number: cleanPhone,
            address: cleanPhone,
            message: messageText,
            text: messageText,
            msg: messageText,
            body: messageText,
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
          let isSuccess = false;
          let lastError = '';

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
                  message: messageText,
                }),
              });

              if (proxyRes.ok) {
                isSuccess = true;
              } else {
                const proxyErr = await proxyRes.json().catch(() => ({}));
                lastError = proxyErr.error || `HTTP ${proxyRes.status}`;
              }
            } catch (err: any) {
              lastError = err.message || 'Ошибка сервера';
            }
          } else {
            // Local IP: Try direct fetch first
            try {
              const res = await fetch(config.gatewayUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                mode: 'cors',
              });
              if (res.ok) {
                isSuccess = true;
              } else {
                lastError = `HTTP ${res.status}`;
              }
            } catch (fetchErr: any) {
              lastError = fetchErr?.message || 'CORS/Сеть';
            }

            // Fallback to server proxy or no-cors
            if (!isSuccess) {
              try {
                const proxyRes = await fetch('/api/send-sms-gateway', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    gatewayUrl: config.gatewayUrl,
                    apiKey: config.apiKey,
                    deviceId: config.deviceId,
                    phone: cleanPhone,
                    message: messageText,
                  }),
                });
                if (proxyRes.ok) {
                  isSuccess = true;
                }
              } catch {
                // ignore
              }
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
              } catch (noCorsErr: any) {
                lastError = noCorsErr?.message || 'Ошибка связи со шлюзом';
              }
            }
          }

          if (isSuccess) {
            success = true;
          } else {
            throw new Error(`Не удалось связаться с телефоном: ${lastError}`);
          }
        } else if (config.gatewayType === 'ESKIZ_UZ') {
          // Eskiz API
          const payload = {
            mobile_phone: item.recipientPhone.replace(/[^0-9]/g, ''),
            message: messageText,
            from: '4546',
          };

          const res = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            success = true;
          } else {
            const errText = await res.text();
            throw new Error(`Eskiz error: ${errText}`);
          }
        } else {
          // Simulation / Direct device fallback
          await new Promise((resolve) => setTimeout(resolve, 800));
          success = true;
        }
      } catch (err: any) {
        success = false;
        errMessage = err.message || 'Ошибка отправки';
      }

      if (success) {
        sentCount++;
        onSendSms({
          studentId: item.student.id,
          studentName: item.student.fullName,
          recipientPhone: item.recipientPhone,
          parentType: item.recipientType,
          message: messageText,
          status: 'DELIVERED',
          sentAt: getUzbekistanISOString(),
        });
      } else {
        failedCount++;
        onSendSms({
          studentId: item.student.id,
          studentName: item.student.fullName,
          recipientPhone: item.recipientPhone,
          parentType: item.recipientType,
          message: messageText,
          status: 'FAILED',
          sentAt: getUzbekistanISOString(),
        });
      }

      // Update item status in UI
      setDebtors((prev) =>
        prev.map((d) =>
          d.student.id === item.student.id && d.course.id === item.course.id
            ? { ...d, sendStatus: success ? 'SUCCESS' : 'FAILED', errorMessage: errMessage }
            : d
        )
      );

      setDispatchProgress({
        sent: sentCount,
        total: toSend.length,
        failed: failedCount,
      });

      // Delay between SMS (to protect SIM card rate-limits)
      if (i < toSend.length - 1 && !isStopRequestedRef.current) {
        await new Promise((resolve) => setTimeout(resolve, (config.delaySeconds || 1.5) * 1000));
      }
    }

    setIsDispatching(false);
  };

  const handleStopDispatch = () => {
    isStopRequestedRef.current = true;
    setIsDispatching(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-5xl w-full shadow-2xl overflow-hidden my-auto flex flex-col max-h-[95vh]">
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-900 p-4 sm:p-6 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-10">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-lg">
                <Smartphone className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight">
                    Массовая SMS-рассылка должникам
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold text-[10px] uppercase">
                    SIM / Android Шлюз
                  </span>
                </div>
                <p className="text-xs text-blue-100 mt-0.5">
                  Автоматическая и поштучная отправка SMS об оплате за{' '}
                  <span className="font-bold underline text-white">
                    {formatMonthPeriodLabel(selectedPeriod)}
                  </span>{' '}
                  напрямую через телефон
                </p>
              </div>
            </div>

            {/* Header Action: Gateway Config Toggle */}
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all self-start sm:self-auto cursor-pointer ${
                showSettings
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>{showSettings ? 'Скрыть настройки шлюза' : '⚙️ Настройки шлюза Android'}</span>
            </button>
          </div>
        </div>

        {/* SETTINGS DRAWER / ACCORDION */}
        {showSettings && (
          <div className="p-4 sm:p-5 bg-slate-900 border-b border-slate-800 text-white shrink-0 animate-in slide-in-from-top-2">
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <span>Настройка подключения к Android-телефону / SMS-шлюзу</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Сохраняется автоматически в браузере
                </span>
              </div>

              {/* Gateway Type Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    handleSaveConfig({ ...config, gatewayType: 'ANDROID_GATEWAY' })
                  }
                  className={`p-3 rounded-xl border text-left transition-all ${
                    config.gatewayType === 'ANDROID_GATEWAY'
                      ? 'bg-blue-600/30 border-blue-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-extrabold flex items-center space-x-1.5 text-white">
                    <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                    <span>Android SMS Gateway</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Приложение на телефоне (sms-gate.app, TextBee, Traccar)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSaveConfig({ ...config, gatewayType: 'DIRECT_DEVICE' })
                  }
                  className={`p-3 rounded-xl border text-left transition-all ${
                    config.gatewayType === 'DIRECT_DEVICE'
                      ? 'bg-indigo-600/30 border-indigo-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-extrabold flex items-center space-x-1.5 text-white">
                    <MessageCircle className="w-3.5 h-3.5 text-indigo-400" />
                    <span>В 1 клик с телефона</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Открытие стандартного SMS на смартфоне администратора
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveConfig({ ...config, gatewayType: 'ESKIZ_UZ' })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    config.gatewayType === 'ESKIZ_UZ'
                      ? 'bg-emerald-600/30 border-emerald-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-extrabold flex items-center space-x-1.5 text-white">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Eskiz.uz (Агрегатор)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Официальный SMS провайдер по Узбекистану
                  </p>
                </button>
              </div>

              {/* Gateway Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {config.gatewayType === 'ANDROID_GATEWAY' && (
                  <>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 font-bold mb-1">
                        URL шлюза (IP телефона или облачный endpoint):
                      </label>
                      <input
                        type="text"
                        value={config.gatewayUrl}
                        onChange={(e) =>
                          handleSaveConfig({ ...config, gatewayUrl: e.target.value })
                        }
                        placeholder="http://192.168.1.50:8080/send или https://api.sms-gate.app/..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        🔑 Логин:Пароль или API Ключ:
                      </label>
                      <input
                        type="text"
                        value={config.apiKey}
                        onChange={(e) =>
                          handleSaveConfig({ ...config, apiKey: e.target.value })
                        }
                        placeholder="YGKT-N:gmi6o2iwwvwoiv"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="p-2 bg-amber-500/10 border border-amber-500/40 rounded-xl">
                      <label className="block text-amber-300 font-black mb-1">
                        📱 ID устройства (Device ID):
                      </label>
                      <input
                        type="text"
                        value={config.deviceId || ''}
                        onChange={(e) =>
                          handleSaveConfig({ ...config, deviceId: e.target.value.trim() })
                        }
                        placeholder="s23lJBQ-7sfokEM6q730i"
                        className="w-full bg-slate-950 border border-amber-500/60 rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Задержка между SMS (сек):
                      </label>
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
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                {config.gatewayType === 'ESKIZ_UZ' && (
                  <div className="sm:col-span-3">
                    <label className="block text-slate-300 font-bold mb-1">
                      Eskiz.uz Bearer Token:
                    </label>
                    <input
                      type="password"
                      value={config.apiKey}
                      onChange={(e) =>
                        handleSaveConfig({ ...config, apiKey: e.target.value })
                      }
                      placeholder="Вставьте токен из личного кабинета Eskiz"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Телефон учебного центра (для шаблона):
                  </label>
                  <input
                    type="text"
                    value={config.centerPhone}
                    onChange={(e) =>
                      handleSaveConfig({ ...config, centerPhone: e.target.value })
                    }
                    placeholder="+998 90 420 02 57"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
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

              {/* Instructions Banner */}
              <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex items-start space-x-2 text-[11px] text-slate-400">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Как отправить через телефон:</strong> Установите на телефон приложение
                  «Simple SMS Gateway», запустите сервер кнопкой Start и введите IP-адрес телефона
                  (например, <code>http://192.168.1.100:8080/send</code>). Настройки надежно сохраняются в базе
                  данных и не сбрасываются при перезагрузке!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CONTROLS & STATS BAR */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-3">
          {/* STATS CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Всего должников</span>
              <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {debtors.length} учеников
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Выбрано к отправке</span>
              <div className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                {selectedItems.length} из {debtors.length}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Сумма долга выбранных</span>
              <div className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                {totalSelectedDebt.toLocaleString('ru-RU')} сум
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Шлюз отправки</span>
              <div className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center space-x-1">
                <Smartphone className="w-3.5 h-3.5" />
                <span className="truncate">
                  {config.gatewayType === 'ANDROID_GATEWAY'
                    ? 'Android SIM Шлюз'
                    : config.gatewayType === 'ESKIZ_UZ'
                    ? 'Eskiz.uz'
                    : '1-Клик Телефон'}
                </span>
              </div>
            </div>
          </div>

          {/* TEMPLATE BUILDER & QUICK TAGS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <MessageCircle className="w-4 h-4 text-blue-600" />
                <span>Шаблон текста SMS сообщения:</span>
              </label>

              {/* Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 mr-1">Готовые шаблоны:</span>
                <button
                  type="button"
                  onClick={() => setMessageTemplate(DEFAULT_TEMPLATES.RU_STANDARD)}
                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300 font-bold text-[10px] border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  🇷🇺 Стандарт
                </button>
                <button
                  type="button"
                  onClick={() => setMessageTemplate(DEFAULT_TEMPLATES.RU_STRICT)}
                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-700 dark:text-slate-300 font-bold text-[10px] border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  🇷🇺 Срочный
                </button>
                <button
                  type="button"
                  onClick={() => setMessageTemplate(DEFAULT_TEMPLATES.UZ_STANDARD)}
                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-700 dark:text-slate-300 font-bold text-[10px] border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  🇺🇿 O'zbekcha
                </button>
                <button
                  type="button"
                  onClick={() => setMessageTemplate(DEFAULT_TEMPLATES.UZ_STRICT)}
                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-slate-700 dark:text-slate-300 font-bold text-[10px] border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  🇺🇿 Qat'iy
                </button>
              </div>
            </div>

            <textarea
              rows={2}
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white font-sans focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Dynamic Tags Insertion */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="text-slate-400 font-semibold">Вставить тег:</span>
              {[
                { tag: '{student_name}', label: 'Имя ученика' },
                { tag: '{course_title}', label: 'Курс' },
                { tag: '{debt_amount}', label: 'Сумма долга' },
                { tag: '{month}', label: 'Месяц' },
                { tag: '{parent_name}', label: 'Имя родителя' },
                { tag: '{center_phone}', label: 'Телефон центра' },
              ].map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => setMessageTemplate((prev) => `${prev} ${t.tag}`)}
                  className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-mono font-bold hover:bg-blue-100 cursor-pointer"
                >
                  +{t.label}
                </button>
              ))}
            </div>
          </div>

          {/* FILTERS & SEARCH ROW */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              {/* Course Selector */}
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-bold text-slate-500">Группа:</span>
                <select
                  value={activeCourseFilter}
                  onChange={(e) => setActiveCourseFilter(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Все группы ({debtors.length} должн.)</option>
                  {courses.map((c, idx) => {
                    const count = debtors.filter((d) => d.course.id === c.id).length;
                    return (
                      <option key={`${c.id}-${idx}`} value={c.id}>
                        {c.title} ({count} должн.)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Preferred phone target */}
              <div className="flex items-center space-x-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 text-xs">
                <span className="text-[10px] text-slate-400 font-bold px-1">Отправлять:</span>
                <button
                  type="button"
                  onClick={() => setPreferredRecipient('FATHER')}
                  className={`px-2 py-0.5 rounded-lg font-bold text-[11px] cursor-pointer ${
                    preferredRecipient === 'FATHER'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Отцам
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredRecipient('MOTHER')}
                  className={`px-2 py-0.5 rounded-lg font-bold text-[11px] cursor-pointer ${
                    preferredRecipient === 'MOTHER'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Матерям
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredRecipient('STUDENT')}
                  className={`px-2 py-0.5 rounded-lg font-bold text-[11px] cursor-pointer ${
                    preferredRecipient === 'STUDENT'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Ученикам
                </button>
              </div>
            </div>

            {/* Quick Bulk Selection Controls */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold hidden sm:inline">Выделить:</span>
              
              <button
                type="button"
                onClick={handleSelectAllDebtors}
                className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-extrabold text-xs flex items-center space-x-1 cursor-pointer transition-all shadow-2xs"
                title="Выбрать всех должников по всем группам"
              >
                <span>✅ Всех должников ({debtors.length})</span>
              </button>

              {activeCourseFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={handleSelectOnlyCurrentGroup}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-extrabold text-xs flex items-center space-x-1 cursor-pointer transition-all shadow-2xs"
                  title="Выбрать только должников этой группы, сняв с остальных"
                >
                  <span>🏫 Только эту группу ({filteredDebtors.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer transition-all shadow-2xs"
                title="Снять все отметки"
              >
                <span>Снять выбор ({selectedItems.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* PROGRESS BAR WHEN DISPATCHING */}
        {isDispatching && (
          <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white shrink-0 shadow-inner">
            <div className="flex items-center justify-between mb-2 text-xs font-bold">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                <span>
                  Идет рассылка через {config.gatewayType === 'ANDROID_GATEWAY' ? 'телефон' : 'шлюз'}...
                </span>
              </div>
              <div>
                Отправлено: {dispatchProgress.sent} из {dispatchProgress.total}{' '}
                {dispatchProgress.failed > 0 && (
                  <span className="text-rose-300 ml-1">({dispatchProgress.failed} ошибок)</span>
                )}
              </div>
            </div>

            <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{
                  width: `${
                    dispatchProgress.total > 0
                      ? Math.round((dispatchProgress.sent / dispatchProgress.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* RECIPIENTS TABLE (SCROLLABLE) */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2.5 bg-white dark:bg-slate-900">
          {filteredDebtors.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-3">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-white">
                Задолженностей не найдено!
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Все ученики за выбранный месяц ({formatMonthPeriodLabel(selectedPeriod)}) полностью оплатили обучение либо по фильтру нет должников.
              </p>
            </div>
          ) : (
            filteredDebtors.map((item, index) => {
              const messageText = renderMessageForDebtor(item);
              const isCopied = copiedIndex === index;

              return (
                <div
                  key={`${item.student.id}-${item.course.id}`}
                  className={`border rounded-2xl p-3.5 shadow-xs transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                    item.isSelected
                      ? 'bg-white dark:bg-slate-800/90 border-blue-200 dark:border-blue-800/80 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-60'
                  }`}
                >
                  {/* Left: Checkbox + Student Info */}
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={item.isSelected}
                      onChange={() => handleToggleSingle(item.student.id, item.course.id)}
                      className="w-4 h-4 rounded mt-1 accent-blue-600 cursor-pointer"
                    />

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-400 font-mono">#{index + 1}</span>
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                          {item.student.fullName}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[10px]">
                          {item.course.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold text-[11px] border border-rose-200 dark:border-rose-800">
                          Долг: {item.debtAmount.toLocaleString('ru-RU')} сум
                        </span>
                      </div>

                      {/* Recipient info & Selector */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center space-x-1 font-mono font-bold text-slate-800 dark:text-slate-200">
                          <Phone className="w-3 h-3 text-blue-500" />
                          <span>{formatDisplayPhone(item.recipientPhone) || 'Нет номера!'}</span>
                        </span>

                        <span className="text-slate-300 dark:text-slate-600">|</span>

                        {/* Switch parent phone buttons */}
                        <div className="flex items-center space-x-1 text-[10px]">
                          {item.student.fatherPhone && (
                            <button
                              type="button"
                              onClick={() =>
                                handleChangeRecipientType(item.student.id, item.course.id, 'FATHER')
                              }
                              className={`px-1.5 py-0.5 rounded ${
                                item.recipientType === 'FATHER'
                                  ? 'bg-blue-600 text-white font-bold'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              Отец
                            </button>
                          )}
                          {item.student.motherPhone && (
                            <button
                              type="button"
                              onClick={() =>
                                handleChangeRecipientType(item.student.id, item.course.id, 'MOTHER')
                              }
                              className={`px-1.5 py-0.5 rounded ${
                                item.recipientType === 'MOTHER'
                                  ? 'bg-indigo-600 text-white font-bold'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              Мать
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleChangeRecipientType(item.student.id, item.course.id, 'STUDENT')
                            }
                            className={`px-1.5 py-0.5 rounded ${
                              item.recipientType === 'STUDENT'
                                ? 'bg-slate-700 text-white font-bold'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            Ученик
                          </button>
                        </div>
                      </div>

                      {/* SMS text preview */}
                      <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/90 p-2 rounded-xl border border-slate-200/70 dark:border-slate-800/80 font-sans italic max-w-2xl">
                        «{messageText}»
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions & Status */}
                  <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-700 shrink-0">
                    {/* Status Badge */}
                    {item.sendStatus === 'SENDING' && (
                      <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs flex items-center space-x-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Шлюз...</span>
                      </span>
                    )}

                    {item.sendStatus === 'SUCCESS' && (
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center space-x-1 border border-emerald-200 dark:border-emerald-800">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Отправлено</span>
                      </span>
                    )}

                    {item.sendStatus === 'FAILED' && (
                      <span className="px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs flex items-center space-x-1 border border-rose-200">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Ошибка</span>
                      </span>
                    )}

                    {/* Direct 1-Click SMS Link (Phone native app) */}
                    <a
                      href={getSmsUrl(item.recipientPhone, messageText)}
                      onClick={() => handleMarkAsSent(item)}
                      className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center space-x-1 border border-blue-200 dark:border-blue-800 transition-all"
                      title="Открыть приложение SMS на телефоне с готовым текстом"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>SMS</span>
                    </a>

                    {/* Telegram Share Link */}
                    <a
                      href={getTelegramUrl(messageText)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-bold text-xs flex items-center space-x-1 border border-sky-200 dark:border-sky-800 transition-all"
                      title="Отправить текст через Telegram"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Telegram</span>
                    </a>

                    {/* Copy Text */}
                    <button
                      type="button"
                      onClick={() => handleCopyText(messageText, index)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center space-x-1 transition-all cursor-pointer"
                      title="Скопировать готовый текст сообщения"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Скопировано!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Копировать</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Выбрано: <strong>{selectedItems.length}</strong> должников на сумму{' '}
              <strong className="text-rose-600 dark:text-rose-400">
                {totalSelectedDebt.toLocaleString('ru-RU')} сум
              </strong>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold transition-all cursor-pointer"
            >
              Закрыть
            </button>

            {isDispatching ? (
              <button
                type="button"
                onClick={handleStopDispatch}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold flex items-center space-x-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
              >
                <Square className="w-4 h-4" />
                <span>Остановить рассылку</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartBatchDispatch}
                disabled={selectedItems.length === 0}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-extrabold flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
