
import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastData;
  onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const duration = toast.duration || 3000;
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const timer = setTimeout(() => {
      setIsExiting(true);
      // Allow animation to play out before actual removal
      setTimeout(() => onRemove(toast.id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onRemove, toast.id, isPaused]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const icons = {
    success: <CheckCircle2 size={20} className="text-emerald-500" />,
    error: <AlertCircle size={20} className="text-rose-500" />,
    info: <Info size={20} className="text-blue-500" />,
    warning: <AlertTriangle size={20} className="text-amber-500" />
  };

  const borderClass = {
    success: 'border-l-emerald-500',
    error: 'border-l-rose-500',
    info: 'border-l-blue-500',
    warning: 'border-l-amber-500'
  };

  const progressClass = {
    success: 'bg-emerald-500',
    error: 'bg-rose-500',
    info: 'bg-blue-500',
    warning: 'bg-amber-500'
  };

  return (
    <div 
      className={`
        relative w-80 bg-white dark:bg-slate-800 shadow-lg rounded-lg overflow-hidden mb-3 flex flex-col
        transition-all duration-300 transform ease-in-out border-l-4 border-r border-y border-r-slate-100 border-y-slate-100 dark:border-r-slate-700 dark:border-y-slate-700
        ${borderClass[toast.type]}
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="alert"
    >
      <div className="p-4 flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>
        <div className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug break-words">
          {toast.message}
        </div>
        <button 
          onClick={handleDismiss} 
          className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <X size={16} />
        </button>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full h-1 bg-slate-100 dark:bg-slate-700">
         <div 
           className={`h-full ${progressClass[toast.type]}`}
           style={{ 
             width: '100%',
             animation: isPaused ? 'none' : `shrink ${duration}ms linear forwards`
           }}
         />
      </div>
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default Toast;
