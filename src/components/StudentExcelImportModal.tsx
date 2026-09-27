import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Users,
  FileCheck,
  Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, DiscountType } from '../types';
import { formatUzbekPhoneInput, formatDisplayPhone } from '../lib/phoneUtils';
import { checkStudentDuplicate } from '../lib/studentValidation';

interface StudentExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingStudents: Student[];
  onImportStudents: (newStudents: Student[]) => Promise<void> | void;
}

interface ParsedStudentRow {
  rowIndex: number;
  fullName: string;
  birthDate: string;
  phone: string;
  secondaryPhone: string;
  schoolName: string;
  grade: string;
  address: string;
  certificatesAndBenefits: string;
  fatherName: string;
  fatherPhone: string;
  motherName: string;
  motherPhone: string;
  discountType: DiscountType;
  discountValue: number;
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
}

export const StudentExcelImportModal: React.FC<StudentExcelImportModalProps> = ({
  isOpen,
  onClose,
  existingStudents,
  onImportStudents,
}) => {
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // 1. Download Excel Template strictly for Student Base Registration
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Фамилия (Обязательно)': 'Алимов',
        'Имя (Обязательно)': 'Сардор',
        'Отчество': 'Бахтиярович',
        'Дата рождения (ГГГГ-ММ-ДД)': '2009-05-15',
        'Основной телефон ученика': '+998 90 123 45 67',
        'Дополнительный телефон': '+998 91 234 56 78',
        'Школа / Лицей': 'Школа №12',
        'Класс': '9-А',
        'Адрес проживания': 'г. Ташкент, Чиланзар 12',
        'Льготы / Сертификаты': 'Кандидат IELTS',
        'ФИО Отца': 'Алимов Бахтияр',
        'Телефон отца': '+998 90 345 67 89',
        'ФИО Матери': 'Алимова Нигора',
        'Телефон матери': '+998 90 456 78 90',
        'Скидка тип (NONE / PERCENTAGE / FIXED_SUM)': 'NONE',
        'Скидка значение (% или сумма)': 0,
      },
      {
        'Фамилия (Обязательно)': 'Каримова',
        'Имя (Обязательно)': 'Малика',
        'Отчество': 'Рустамовна',
        'Дата рождения (ГГГГ-ММ-ДД)': '2010-08-20',
        'Основной телефон ученика': '+998 93 987 65 43',
        'Дополнительный телефон': '',
        'Школа / Лицей': 'Президентская школа',
        'Класс': '8-Б',
        'Адрес проживания': 'Юнусабад 4',
        'Льготы / Сертификаты': 'Победитель олимпиады',
        'ФИО Отца': 'Каримов Рустам',
        'Телефон отца': '+998 90 777 88 99',
        'ФИО Матери': 'Каримова Дильноза',
        'Телефон матери': '+998 93 555 44 33',
        'Скидка тип (NONE / PERCENTAGE / FIXED_SUM)': 'PERCENTAGE',
        'Скидка значение (% или сумма)': 10,
      },
      {
        'Фамилия (Обязательно)': 'Юсупов',
        'Имя (Обязательно)': 'Жасур',
        'Отчество': 'Анварович',
        'Дата рождения (ГГГГ-ММ-ДД)': '2011-11-03',
        'Основной телефон ученика': '+998 97 555 12 34',
        'Дополнительный телефон': '',
        'Школа / Лицей': 'Лицей Интерхаус',
        'Класс': '7-В',
        'Адрес проживания': 'Мирзо-Улугбекский р-н',
        'Льготы / Сертификаты': '',
        'ФИО Отца': 'Юсупов Анвар',
        'Телефон отца': '+998 90 111 22 33',
        'ФИО Матери': 'Юсупова Гульнора',
        'Телефон матери': '+998 90 222 33 44',
        'Скидка тип (NONE / PERCENTAGE / FIXED_SUM)': 'NONE',
        'Скидка значение (% или сумма)': 0,
      },
    ];

    const wb = XLSX.utils.book_new();
    const wsTemplate = XLSX.utils.json_to_sheet(templateData);

    // Auto Column Widths
    wsTemplate['!cols'] = [
      { wch: 24 }, // Фамилия
      { wch: 20 }, // Имя
      { wch: 20 }, // Отчество
      { wch: 26 }, // Дата рождения
      { wch: 26 }, // Основной телефон
      { wch: 24 }, // Доп телефон
      { wch: 24 }, // Школа
      { wch: 14 }, // Класс
      { wch: 30 }, // Адрес
      { wch: 26 }, // Льготы
      { wch: 24 }, // ФИО Отца
      { wch: 22 }, // Телефон отца
      { wch: 24 }, // ФИО Матери
      { wch: 22 }, // Телефон матери
      { wch: 38 }, // Тип скидки
      { wch: 30 }, // Значение скидки
    ];

    XLSX.utils.book_append_sheet(wb, wsTemplate, 'База Учеников (Заполнять здесь)');
    XLSX.writeFile(wb, 'REDCAT_Шаблон_Базы_Учеников.xlsx');
  };

  // 2. Parse Uploaded Excel File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFileName(file.name);
    setImportSuccessCount(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        const rawData: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const seenNamesPhones = new Set<string>();

        const parsed: ParsedStudentRow[] = rawData.map((row, index) => {
          const errors: string[] = [];

          // Parse names
          const lastName = String(row['Фамилия (Обязательно)'] || row['Фамилия'] || '').trim();
          const firstName = String(row['Имя (Обязательно)'] || row['Имя'] || '').trim();
          const middleName = String(row['Отчество'] || '').trim();

          let fullName = '';
          if (lastName || firstName) {
            fullName = [lastName, firstName, middleName].filter(Boolean).join(' ');
          } else {
            fullName = String(
              row['ФИО Ученика (Обязательно)'] ||
                row['ФИО'] ||
                row['ФИО Ученика'] ||
                row['FullName'] ||
                ''
            ).trim();
          }

          if (!fullName) {
            errors.push('Не указана Фамилия или Имя ученика');
          }

          // Dates
          let birthDate = String(
            row['Дата рождения (ГГГГ-ММ-ДД)'] || row['Дата рождения'] || row['BirthDate'] || '2009-03-10'
          ).trim();
          if (birthDate.length > 10) birthDate = birthDate.substring(0, 10);
          if (!birthDate) birthDate = '2009-03-10';

          // Phones
          const rawPhone = String(
            row['Основной телефон ученика'] ||
              row['Телефон ученика'] ||
              row['Телефон'] ||
              row['Phone'] ||
              ''
          );
          const rawSecondary = String(row['Дополнительный телефон'] || row['Доп телефон'] || '');
          const rawMotherPhone = String(row['Телефон матери'] || row['Мать'] || '');
          const rawFatherPhone = String(row['Телефон отца'] || row['Отец'] || '');

          const phone = formatUzbekPhoneInput(rawPhone, false);
          const secondaryPhone = formatUzbekPhoneInput(rawSecondary, true);
          const motherPhone = formatUzbekPhoneInput(rawMotherPhone, true);
          const fatherPhone = formatUzbekPhoneInput(rawFatherPhone, true);

          // Details
          const schoolName = String(row['Школа / Лицей'] || row['Школа'] || '').trim();
          const grade = String(row['Класс'] || '').trim();
          const address = String(row['Адрес проживания'] || row['Адрес'] || '').trim();
          const certificatesAndBenefits = String(
            row['Льготы / Сертификаты'] || row['Сертификаты'] || row['Льготы'] || ''
          ).trim();
          const fatherName = String(row['ФИО Отца'] || row['Отец ФИО'] || '').trim();
          const motherName = String(row['ФИО Матери'] || row['Мать ФИО'] || '').trim();

          // Discount parsing
          const rawDiscountType = String(
            row['Скидка тип (NONE / PERCENTAGE / FIXED_SUM)'] ||
              row['Тип скидки'] ||
              row['Скидка тип'] ||
              'NONE'
          )
            .trim()
            .toUpperCase();

          let discountType: DiscountType = 'NONE';
          if (
            rawDiscountType.includes('PERCENT') ||
            rawDiscountType.includes('ПРОЦЕНТ') ||
            rawDiscountType.includes('%')
          ) {
            discountType = 'PERCENTAGE';
          } else if (
            rawDiscountType.includes('FIXED') ||
            rawDiscountType.includes('СУММА') ||
            rawDiscountType.includes('ФИКС')
          ) {
            discountType = 'FIXED_SUM';
          }

          const discountValue =
            parseFloat(
              String(row['Скидка значение (% или сумма)'] || row['Скидка'] || row['Размер скидки'] || '0')
            ) || 0;

          // Duplicate check
          let isDuplicate = false;
          if (fullName) {
            const dupCheck = checkStudentDuplicate(existingStudents, fullName, phone);
            if (dupCheck.isDuplicate) {
              isDuplicate = true;
              errors.push('Уже есть в базе центра (дубликат)');
            }

            const fileKey = `${fullName.toLowerCase()}_${phone}`;
            if (seenNamesPhones.has(fileKey)) {
              isDuplicate = true;
              errors.push('Повторяется в самом Excel файле');
            } else {
              seenNamesPhones.add(fileKey);
            }
          }

          return {
            rowIndex: index + 2,
            fullName,
            birthDate,
            phone,
            secondaryPhone,
            schoolName,
            grade,
            address,
            certificatesAndBenefits,
            fatherName,
            fatherPhone,
            motherName,
            motherPhone,
            discountType,
            discountValue,
            isValid: errors.length === 0,
            isDuplicate,
            errors,
          };
        });

        // Filter out completely empty rows
        const filtered = parsed.filter(
          (p) => p.fullName || p.phone || p.motherPhone || p.fatherPhone || p.schoolName
        );

        setParsedRows(filtered);
      } catch (err: any) {
        alert('Ошибка при чтении Excel файла: ' + (err.message || 'Неверный формат'));
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // 3. Confirm Import strictly to Main Database
  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert('Нет корректных строк для импорта.');
      return;
    }

    setIsSaving(true);
    try {
      const generatedStudents: Student[] = validRows.map((r, idx) => {
        const studentId = `s-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`;
        return {
          id: studentId,
          fullName: r.fullName,
          birthDate: r.birthDate || '2009-03-10',
          phone: r.phone ? (r.phone.startsWith('+') ? r.phone : `+${r.phone}`) : '+998 90 ',
          secondaryPhone: r.secondaryPhone ? (r.secondaryPhone.startsWith('+') ? r.secondaryPhone : `+${r.secondaryPhone}`) : undefined,
          schoolName: r.schoolName || undefined,
          grade: r.grade || undefined,
          address: r.address || undefined,
          certificatesAndBenefits: r.certificatesAndBenefits || undefined,
          fatherName: r.fatherName || undefined,
          fatherPhone: r.fatherPhone ? (r.fatherPhone.startsWith('+') ? r.fatherPhone : `+${r.fatherPhone}`) : undefined,
          motherName: r.motherName || undefined,
          motherPhone: r.motherPhone ? (r.motherPhone.startsWith('+') ? r.motherPhone : `+${r.motherPhone}`) : undefined,
          discountType: r.discountType,
          discountValue: r.discountValue,
          status: 'ACTIVE',
          enrolledCourseIds: [], // Added directly to main student base; enrollment is done in group management
        };
      });

      await onImportStudents(generatedStudents);
      setImportSuccessCount(generatedStudents.length);
      setParsedRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      alert('Ошибка при сохранении: ' + (err.message || 'Сбой базы данных'));
    } finally {
      setIsSaving(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white flex items-center space-x-2">
                <span>Массовый импорт учеников в основную базу</span>
              </h2>
              <p className="text-xs text-slate-400">
                Заполните анкеты регистрации учеников в одной таблице Excel и добавьте сотни учеников в один клик
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Step 1 & 2 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Download Template */}
            <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">
                    1
                  </span>
                  <span>Скачайте чистый шаблон Excel</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  В таблице собраны только данные регистрации ученика: <strong>ФИО, дата рождения, телефоны ученика и родителей, школа, класс, адрес, льготы и персональная скидка</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-slate-800 hover:bg-emerald-600/90 text-white font-extrabold text-xs rounded-xl border border-slate-700 hover:border-emerald-500 transition-all shadow-md active:scale-98 cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>📥 Скачать шаблон таблицы (.xlsx)</span>
              </button>
            </div>

            {/* Step 2: Upload Filled Excel */}
            <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-blue-400 font-bold text-sm">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs">
                    2
                  </span>
                  <span>Загрузите заполненный файл</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Выберите файл с вашего устройства. Система мгновенно проверит номера телефонов (+998), отсеет дубликаты и занесет учеников в общую базу.
                </p>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="excel-file-input"
                />
                <label
                  htmlFor="excel-file-input"
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all active:scale-98 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {isProcessing
                      ? 'Обработка файла...'
                      : fileName
                      ? `Выбран: ${fileName}`
                      : '📁 Выбрать файл для загрузки'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Success Banner */}
          {importSuccessCount !== null && (
            <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center space-x-3 text-emerald-300">
              <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-400" />
              <div>
                <h4 className="font-bold text-sm">Импорт успешно завершен!</h4>
                <p className="text-xs text-emerald-400/90">
                  В основную базу учеников успешно добавлено <strong>{importSuccessCount}</strong> человек.
                </p>
              </div>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-200 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Предпросмотр данных ({parsedRows.length} строк)</span>
                </h3>
                <div className="flex items-center space-x-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold">
                    ✓ Готовы к импорту: {validCount}
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold">
                      ⚠ С ошибками/дубликаты: {invalidCount}
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/80 max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 sticky top-0 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">ФИО Ученика</th>
                      <th className="p-3">Телефоны</th>
                      <th className="p-3">Школа / Класс</th>
                      <th className="p-3">Родители</th>
                      <th className="p-3">Скидка / Льготы</th>
                      <th className="p-3">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={
                          row.isValid
                            ? 'hover:bg-slate-900/50'
                            : 'bg-rose-500/10 hover:bg-rose-500/15 text-rose-200'
                        }
                      >
                        <td className="p-3 text-slate-500 font-mono">{row.rowIndex}</td>
                        <td className="p-3 font-bold text-white">
                          <div>{row.fullName || '—'}</div>
                          {row.address && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              📍 {row.address}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-300 font-mono text-[11px]">
                          <div>Уч: {formatDisplayPhone(row.phone) || '—'}</div>
                          {row.secondaryPhone && (
                            <div className="text-[10px] text-blue-400">
                              Доп: {formatDisplayPhone(row.secondaryPhone)}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-300">
                          <div>{row.schoolName || '—'}</div>
                          {row.grade && <div className="text-[10px] text-slate-400">{row.grade}</div>}
                        </td>
                        <td className="p-3 text-slate-300 text-[11px]">
                          {row.fatherName && <div>О: {row.fatherName} ({formatDisplayPhone(row.fatherPhone)})</div>}
                          {row.motherName && <div>М: {row.motherName} ({formatDisplayPhone(row.motherPhone)})</div>}
                          {!row.fatherName && !row.motherName && <span className="text-slate-500">—</span>}
                        </td>
                        <td className="p-3 text-slate-300">
                          <div>
                            {row.discountType === 'PERCENTAGE'
                              ? `-${row.discountValue}%`
                              : row.discountType === 'FIXED_SUM'
                              ? `-${row.discountValue.toLocaleString('ru-RU')} сум`
                              : 'Без скидки'}
                          </div>
                          {row.certificatesAndBenefits && (
                            <div className="text-[10px] text-amber-400">
                              {row.certificatesAndBenefits}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {row.isValid ? (
                            <span className="inline-flex items-center space-x-1 text-emerald-400 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Готов к записи</span>
                            </span>
                          ) : (
                            <div className="text-rose-400 text-[11px] space-y-0.5">
                              {row.errors.map((err, i) => (
                                <div key={i} className="flex items-center space-x-1">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span>{err}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {parsedRows.length > 0 && (
              <span>
                Будет зарегистрировано в базу: <strong className="text-white">{validCount}</strong> из{' '}
                {parsedRows.length} учеников
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
            >
              Отмена
            </button>

            {parsedRows.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={validCount === 0 || isSaving}
                className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all active:scale-98 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Сохранение в базу...</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    <span>📥 Зарегистрировать {validCount} учеников в базу</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
