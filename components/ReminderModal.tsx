
import React, { useState, useRef, useEffect } from 'react';
import { X, Coffee, CheckCircle2, Clock, Calendar, ArrowRight, BellOff, ChevronDown, ChevronUp } from 'lucide-react';
import { Task } from '../types';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onSnooze?: (untilTimestamp: number) => void;
}

const ReminderModal: React.FC<ReminderModalProps> = ({ isOpen, onClose, tasks, onTaskClick, onSnooze }) => {
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowSnoozeOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // Calculate due message for a task
  const getDueMessage = (dateStr: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(dateStr);
    due.setHours(0,0,0,0);
    
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} days`;
    if (diffDays === 0) return 'Due Today';
    if (diffDays === 1) return 'Due Tomorrow';
    return `Due in ${diffDays} days`;
  };

  const handleSnoozeSelection = (type: '30min' | '1hour' | '4hours' | 'tomorrow' | 'never') => {
      if (!onSnooze) return;

      let timestamp = Date.now();
      
      switch (type) {
          case '30min':
              timestamp += 30 * 60 * 1000;
              break;
          case '1hour':
              timestamp += 60 * 60 * 1000;
              break;
          case '4hours':
              timestamp += 4 * 60 * 60 * 1000;
              break;
          case 'tomorrow':
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              tomorrow.setHours(9, 0, 0, 0);
              timestamp = tomorrow.getTime();
              // If we are already past tomorrow 9AM (unlikely unless tz weirdness), make sure it's future
              if (timestamp < Date.now()) timestamp += 24 * 60 * 60 * 1000;
              break;
          case 'never':
              // Snooze for 1 year
              timestamp += 365 * 24 * 60 * 60 * 1000;
              break;
      }

      onSnooze(timestamp);
      setShowSnoozeOptions(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
        
        {/* Header */}
        <div className="bg-indigo-600 p-6 text-white flex justify-between items-start relative overflow-hidden">
           <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2 text-indigo-200 font-bold text-xs uppercase tracking-wider">
                 <Coffee size={16} /> Gentle Reminder
              </div>
              <h2 className="text-2xl font-bold">Upcoming Tasks</h2>
              <p className="text-indigo-100 text-sm mt-1">You have {tasks.length} tasks requiring attention.</p>
           </div>
           <button onClick={onClose} className="text-white/60 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors relative z-10">
              <X size={20} />
           </button>

           {/* Decorative bg circles */}
           <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
           <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
        </div>

        {/* Body */}
        <div className="p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
           {tasks.map(task => (
              <div 
                key={task.id}
                onClick={() => onTaskClick && onTaskClick(task)}
                className="p-3 m-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer group transition-all relative overflow-hidden"
              >
                 <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{task.title}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${new Date(task.dueDate) < new Date() ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                        {getDueMessage(task.dueDate)}
                    </span>
                 </div>
                 <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(task.dueDate).toLocaleDateString()}</span>
                    <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-indigo-500" />
                 </div>
              </div>
           ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex gap-3 items-center">
           <button 
             onClick={onClose}
             className="flex-1 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm flex items-center justify-center gap-2"
           >
             <CheckCircle2 size={16} className="text-emerald-500" />
             Got it
           </button>

           <div className="relative flex-1" ref={menuRef}>
              <button 
                onClick={() => setShowSnoozeOptions(!showSnoozeOptions)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-200 dark:shadow-indigo-900/30 transition-colors flex items-center justify-center gap-2"
              >
                <Clock size={16} />
                Remind me later
                {showSnoozeOptions ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>

              {/* Snooze Dropdown */}
              {showSnoozeOptions && (
                 <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fade-in z-20">
                    <div className="p-2 space-y-1">
                       <button onClick={() => handleSnoozeSelection('30min')} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 flex justify-between">
                          <span>In 30 minutes</span>
                          <span className="text-xs text-slate-400">30m</span>
                       </button>
                       <button onClick={() => handleSnoozeSelection('1hour')} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 flex justify-between">
                          <span>In 1 hour</span>
                          <span className="text-xs text-slate-400">1h</span>
                       </button>
                       <button onClick={() => handleSnoozeSelection('4hours')} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 flex justify-between">
                          <span>In 4 hours</span>
                          <span className="text-xs text-slate-400">4h</span>
                       </button>
                       <button onClick={() => handleSnoozeSelection('tomorrow')} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 flex justify-between">
                          <span>Tomorrow Morning</span>
                          <span className="text-xs text-slate-400">9:00 AM</span>
                       </button>
                       <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                       <button onClick={() => handleSnoozeSelection('never')} className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
                          <BellOff size={14} /> Don't remind me again
                       </button>
                    </div>
                 </div>
              )}
           </div>
        </div>

      </div>
    </div>
  );
};

export default ReminderModal;
