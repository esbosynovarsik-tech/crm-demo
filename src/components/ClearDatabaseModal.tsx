import React, { useState } from 'react';
import { ShieldAlert, Lock, AlertTriangle, X, Check, Trash2, Eye, EyeOff } from 'lucide-react';

interface ClearDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}

const REQUIRED_ADMIN_PASSWORD = '123456789';

export const ClearDatabaseModal: React.FC<ClearDatabaseModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Очистка базы данных',
  description = 'Вы собираетесь полностью очистить базу данных. Все списки учеников, курсов, оплат и посещаемости будут безвозвратно удалены.',
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() !== REQUIRED_ADMIN_PASSWORD) {
      setError('Неверный пароль безопасности! Доступ запрещен.');
      return;
    }

    setError('');
    setPassword('');
    onConfirm();
    onClose();
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-rose-500/40 rounded-3xl max-w-md w-full p-6 space-y-5 text-white shadow-2xl shadow-rose-950/50 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-rose-300">{title}</h3>
              <p className="text-xs text-slate-400 font-medium">Защита от случайного удаления</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Text */}
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-3.5 space-y-1.5">
          <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Внимание! Необратимая операция</span>
          </div>
          <p className="text-[12px] text-slate-300 leading-relaxed font-medium">
            {description}
          </p>
        </div>

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              <span>Введите пароль подтверждения:</span>
            </label>
            
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Введите пароль администратора"
                autoFocus
                className="w-full bg-slate-950 text-white font-mono text-sm font-bold px-3.5 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-xs font-bold text-rose-400 mt-1 flex items-center space-x-1 animate-in fade-in">
                <span>✕</span>
                <span>{error}</span>
              </p>
            )}
          </div>

          <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!password.trim()}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl shadow-lg shadow-rose-600/30 flex items-center space-x-2 cursor-pointer transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>Подтвердить и очистить</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
