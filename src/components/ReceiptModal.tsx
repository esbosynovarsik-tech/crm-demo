import React, { useState, useEffect, useRef } from 'react';
import { Printer, X, Receipt as ReceiptIcon, Type, Image as ImageIcon } from 'lucide-react';
import { PaymentMethod } from '../types';
import { printHtmlDirectly } from '../lib/printUtils';
import { formatDisplayPhone } from '../lib/phoneUtils';

export interface ReceiptData {
  receiptId: string;
  studentName: string;
  studentPhone?: string;
  courseTitle: string;
  amountPaid: number;
  monthPeriod?: string;
  finalAmountDue?: number;
  paymentMethod: PaymentMethod;
  dateStr: string;
  notes?: string;
  adminName?: string;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: ReceiptData | null;
}

// Crisp Vector SVG Logo for REDCAT optimized for 58mm Thermal Printers (POS-58L)
export const REDCATLogo: React.FC<{ className?: string; isThermalPrint?: boolean }> = ({
  className = "w-28 h-auto",
}) => {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 300 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
      >
        {/* Cat Ears Outline for REDCAT brand mark */}
        <g stroke="#000000" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Left Ear */}
          <path d="M70 70 L100 20 L130 65" strokeWidth="7" />
          {/* Head top curve */}
          <path d="M130 65 Q150 72 170 65" strokeWidth="6" />
          {/* Right Ear */}
          <path d="M170 65 L200 20 L230 70" strokeWidth="7" />
          {/* Cute Whiskers */}
          <path d="M50 100 L95 105" strokeWidth="4" />
          <path d="M50 115 L95 115" strokeWidth="4" />
          <path d="M205 105 L250 100" strokeWidth="4" />
          <path d="M205 115 L250 115" strokeWidth="4" />
        </g>

        {/* Crisp Bold REDCAT Wordmark */}
        <text
          x="150"
          y="118"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="44"
          fill="#000000"
          textAnchor="middle"
          letterSpacing="1px"
        >
          REDCAT
        </text>

        {/* EDUCATION Subtitle */}
        <text
          x="150"
          y="155"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="18"
          fill="#000000"
          textAnchor="middle"
          letterSpacing="5px"
        >
          EDUCATION
        </text>
      </svg>
    </div>
  );
};

export const MBSLogo = REDCATLogo;

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [fontSizeMode, setFontSizeMode] = useState<'LARGE_BOLD' | 'EXTRA_BOLD'>('LARGE_BOLD');
  const [showLogo, setShowLogo] = useState<boolean>(true);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const content = receiptRef.current.innerHTML;

    const printCss = `
      @page {
        size: 58mm auto;
        margin: 0mm !important;
      }
      body {
        width: 54mm;
        max-width: 54mm;
        margin: 0 auto;
        padding: 1.5mm 1mm 2mm 1mm;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        color: #000000;
        font-size: ${fontSizeMode === 'EXTRA_BOLD' ? '14px' : '13px'};
        font-weight: 800;
        line-height: 1.35;
      }
      .text-center { text-align: center; }
      .font-black { font-weight: 900; }
      .font-extrabold { font-weight: 800; }
      .font-bold { font-weight: 700; }
      .border-t-2 { border-top: 2px dashed #000000; }
      .border-t { border-top: 1px dashed #000000; }
      .my-1 { margin-top: 4px; margin-bottom: 4px; }
      .py-1 { padding-top: 3px; padding-bottom: 3px; }
    `;

    printHtmlDirectly(
      `<div style="width: 54mm; margin: 0 auto;">${content}</div>`,
      `Чек_${receipt.receiptId}`,
      printCss
    );
  };

  const methodText = receipt.paymentMethod === 'CASH' ? 'Наличные' : 'Банковская карта';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Screen Modal Container with strict max-height and flex-col for 100% visible buttons */}
      <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full max-h-[94vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
        
        {/* Modal Header (Fixed at top) */}
        <div className="flex items-center justify-between border-b border-slate-100 p-3.5 sm:p-4 shrink-0 bg-white">
          <div className="flex items-center space-x-2 text-slate-900 font-black text-sm">
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <ReceiptIcon className="w-4 h-4" />
            </div>
            <span>Печать чека (POS-58L)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center cursor-pointer transition-colors"
            title="Закрыть (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Font & Logo selector controls (Sticky at top below header) */}
        <div className="flex flex-col gap-2 bg-slate-50 border-b border-slate-200 px-3.5 py-2.5 text-xs shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 font-bold text-slate-700">
              <Type className="w-3.5 h-3.5 text-indigo-600" />
              <span>Шрифт:</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setFontSizeMode('LARGE_BOLD')}
                className={`px-2.5 py-1 rounded-lg font-black text-[11px] transition-all cursor-pointer ${
                  fontSizeMode === 'LARGE_BOLD'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Крупный жирный
              </button>
              <button
                type="button"
                onClick={() => setFontSizeMode('EXTRA_BOLD')}
                className={`px-2.5 py-1 rounded-lg font-black text-[11px] transition-all cursor-pointer ${
                  fontSizeMode === 'EXTRA_BOLD'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Максимальный
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200/70 pt-1.5">
            <div className="flex items-center space-x-1.5 font-bold text-slate-700">
              <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
              <span>Логотип:</span>
            </div>
            <button
              type="button"
              onClick={() => setShowLogo(!showLogo)}
              className={`px-2.5 py-1 rounded-lg font-black text-[11px] transition-all cursor-pointer ${
                showLogo
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-500 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {showLogo ? 'Включен ✓' : 'Скрыт'}
            </button>
          </div>
        </div>

        {/* 58mm Thermal Tape Paper Preview with SCROLLABLE AREA */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-100 flex justify-center">
          <div
            ref={receiptRef}
            id="pos58-thermal-receipt"
            className={`w-[54mm] bg-white text-black font-sans leading-snug p-2.5 shadow-sm border border-slate-300 select-text my-auto ${
              fontSizeMode === 'EXTRA_BOLD' ? 'text-[14px]' : 'text-[13px]'
            }`}
          >
            {/* Center Header with LOGO */}
            <div className="text-center pb-1">
              
              {/* REDCAT LOGO */}
              {showLogo && (
                <div className="mb-1 flex justify-center">
                  <div className="w-24 sm:w-28 mx-auto">
                    <MBSLogo isThermalPrint={true} className="w-full" />
                  </div>
                </div>
              )}

              <div className="font-black text-[16px] tracking-tight uppercase leading-none mt-0.5">
                REDCAT
              </div>
              <div className="text-[12px] font-extrabold uppercase tracking-wide mt-0.5">
                Учебный центр
              </div>
              <div className="border-t-2 border-dashed border-black my-1.5"></div>
              <div className="font-black text-[13px] uppercase">
                КВИТАНЦИЯ ОБ ОПЛАТЕ
              </div>
              <div className="text-[12px] font-extrabold mt-0.5">
                ЧЕК № {receipt.receiptId.toUpperCase()}
              </div>
              <div className="text-[12px] font-bold">
                {receipt.dateStr}
              </div>
              <div className="border-t-2 border-dashed border-black my-1.5"></div>
            </div>

            {/* Receipt Details with High Contrast & Bold Weights */}
            <div className="space-y-1.5 font-bold">
              <div>
                <span className="font-black">Ученик: </span>
                <span className="font-extrabold">{receipt.studentName}</span>
              </div>

              {receipt.studentPhone && (
                <div>
                  <span className="font-black">Тел: </span>
                  <span className="font-bold">{formatDisplayPhone(receipt.studentPhone)}</span>
                </div>
              )}

              <div>
                <span className="font-black">Курс: </span>
                <span className="font-extrabold">{receipt.courseTitle}</span>
              </div>

              {receipt.monthPeriod && (
                <div>
                  <span className="font-black">Период: </span>
                  <span className="font-bold">{receipt.monthPeriod}</span>
                </div>
              )}

              <div>
                <span className="font-black">Оплата: </span>
                <span className="font-bold">{methodText}</span>
              </div>

              {receipt.notes && (
                <div className="text-[11px] font-bold border-t border-dashed border-black pt-1 mt-1">
                  Прим: {receipt.notes}
                </div>
              )}

              {receipt.adminName && (
                <div className="text-[11px] font-bold border-t border-dashed border-black pt-1 mt-1">
                  <span className="font-black">Кассир: </span>
                  <span>{receipt.adminName}</span>
                </div>
              )}
            </div>

            {/* Total Paid High Contrast Section */}
            <div className="border-t-2 border-dashed border-black mt-2 pt-1.5">
              <div className="text-[12px] uppercase font-black">ИТОГО ОПЛАЧЕНО:</div>
              <div className="text-[18px] font-black text-center py-1 tracking-tight">
                {receipt.amountPaid.toLocaleString('ru-RU')} сум
              </div>
            </div>

            {/* Compact Clear Footer */}
            <div className="border-t-2 border-dashed border-black mt-1.5 pt-1.5 text-center font-bold space-y-1">
              <div className="text-[12px] font-extrabold">Спасибо за доверие!</div>
              <div className="text-[12px] pt-1">Подпись: ___________</div>
              <div className="text-[10px] font-black pt-0.5">- - - - - - - - - - - - - - - -</div>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer (FIXED AT BOTTOM - ALWAYS VISIBLE) */}
        <div className="flex items-center justify-end space-x-2.5 p-3.5 border-t border-slate-200 bg-white shrink-0 shadow-md">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={handlePrint}
            autoFocus
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center space-x-2 cursor-pointer transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Печать на POS-58L</span>
          </button>
        </div>

      </div>
    </div>
  );
};
