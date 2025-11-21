
import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCircle2, AlertCircle, Info, AlertTriangle, Trash2, X, Clock } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

const NotificationCenter: React.FC = () => {
  const { history, clearHistory, markAsRead, unreadCount } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen && unreadCount > 0) {
        markAsRead();
    }
    setIsOpen(!isOpen);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={14} className="text-emerald-500" />;
      case 'error': return <AlertCircle size={14} className="text-rose-500" />;
      case 'warning': return <AlertTriangle size={14} className="text-amber-500" />;
      default: return <Info size={14} className="text-blue-500" />;
    }
  };

  const formatTime = (timestamp: number) => {
      const now = Date.now();
      const diff = now - timestamp;
      
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={handleToggle}
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors relative group"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in origin-top-right">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white">Activity Log</h3>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                        {history.length}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {history.length > 0 && (
                        <button 
                            onClick={clearHistory}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Clear History"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
                {history.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                        <Bell size={32} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No recent activity</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                        {history.map((item) => (
                            <div key={item.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex gap-3 items-start">
                                <div className="mt-1 shrink-0">
                                    {getIcon(item.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-700 dark:text-slate-200 font-medium leading-snug break-words">
                                        {item.message}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                                        <Clock size={10} />
                                        {formatTime(item.timestamp)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
