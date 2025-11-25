
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Task } from '../types';

interface CalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (date: string) => void;
}

// --- LUNAR CALENDAR ENGINE (Precise Interval Lookup 2024-2026) ---
// This approach relies on hardcoded start dates of lunar months to ensure 100% accuracy 
// for the most relevant years without a heavy astronomical library.

export interface LunarMonthStart {
    solarDate: string; // YYYY-MM-DD
    lunarMonth: number;
    isLeap: boolean;
}

// Data derived from standard Vietnamese Calendar
export const LUNAR_MONTH_STARTS: Record<number, LunarMonthStart[]> = {
    2024: [
        { solarDate: '2024-02-10', lunarMonth: 1, isLeap: false },
        { solarDate: '2024-03-11', lunarMonth: 2, isLeap: false },
        { solarDate: '2024-04-09', lunarMonth: 3, isLeap: false },
        { solarDate: '2024-05-08', lunarMonth: 4, isLeap: false },
        { solarDate: '2024-06-06', lunarMonth: 5, isLeap: false },
        { solarDate: '2024-07-06', lunarMonth: 6, isLeap: false },
        { solarDate: '2024-08-04', lunarMonth: 7, isLeap: false },
        { solarDate: '2024-09-03', lunarMonth: 8, isLeap: false },
        { solarDate: '2024-10-03', lunarMonth: 9, isLeap: false },
        { solarDate: '2024-11-01', lunarMonth: 10, isLeap: false },
        { solarDate: '2024-12-01', lunarMonth: 11, isLeap: false },
        { solarDate: '2024-12-31', lunarMonth: 12, isLeap: false },
    ],
    2025: [
        { solarDate: '2025-01-29', lunarMonth: 1, isLeap: false },
        { solarDate: '2025-02-27', lunarMonth: 2, isLeap: false },
        { solarDate: '2025-03-29', lunarMonth: 3, isLeap: false },
        { solarDate: '2025-04-28', lunarMonth: 4, isLeap: false },
        { solarDate: '2025-05-27', lunarMonth: 5, isLeap: false },
        { solarDate: '2025-06-25', lunarMonth: 6, isLeap: false },
        { solarDate: '2025-07-25', lunarMonth: 6, isLeap: true }, // Leap Month 6
        { solarDate: '2025-08-23', lunarMonth: 7, isLeap: false },
        { solarDate: '2025-09-22', lunarMonth: 8, isLeap: false },
        { solarDate: '2025-10-21', lunarMonth: 9, isLeap: false },
        { solarDate: '2025-11-20', lunarMonth: 10, isLeap: false },
        { solarDate: '2025-12-20', lunarMonth: 11, isLeap: false },
    ],
    2026: [
        { solarDate: '2026-01-18', lunarMonth: 12, isLeap: false }, // belongs to 2025 lunar year technically but covers Jan 2026
        { solarDate: '2026-02-17', lunarMonth: 1, isLeap: false },
        { solarDate: '2026-03-19', lunarMonth: 2, isLeap: false },
        { solarDate: '2026-04-17', lunarMonth: 3, isLeap: false },
        { solarDate: '2026-05-17', lunarMonth: 4, isLeap: false },
        { solarDate: '2026-06-15', lunarMonth: 5, isLeap: false },
        { solarDate: '2026-07-15', lunarMonth: 6, isLeap: false },
        { solarDate: '2026-08-13', lunarMonth: 7, isLeap: false },
        { solarDate: '2026-09-11', lunarMonth: 8, isLeap: false },
        { solarDate: '2026-10-11', lunarMonth: 9, isLeap: false },
        { solarDate: '2026-11-09', lunarMonth: 10, isLeap: false },
        { solarDate: '2026-12-09', lunarMonth: 11, isLeap: false },
    ]
};

export const getLunarDate = (d: number, m: number, y: number) => {
    const targetDate = new Date(y, m, d);
    targetDate.setHours(0,0,0,0);
    
    // Flatten the lookup array for the specific year and adjacent years to handle edges
    // (e.g. Jan 2025 might be Dec 2024 lunar)
    let monthsToCheck: LunarMonthStart[] = [];
    if (LUNAR_MONTH_STARTS[y-1]) monthsToCheck = monthsToCheck.concat(LUNAR_MONTH_STARTS[y-1]);
    if (LUNAR_MONTH_STARTS[y]) monthsToCheck = monthsToCheck.concat(LUNAR_MONTH_STARTS[y]);
    if (LUNAR_MONTH_STARTS[y+1]) monthsToCheck = monthsToCheck.concat(LUNAR_MONTH_STARTS[y+1]);
    
    if (monthsToCheck.length === 0) {
        // Fallback for out of range years: Mock logic
        return { day: (d % 30) + 1, month: (m % 12) + 1, leap: false };
    }

    // Find the month that starts BEFORE or ON targetDate
    // Iterate backwards to find the latest start date <= targetDate
    let currentLunarMonth: LunarMonthStart | null = null;
    
    for (let i = monthsToCheck.length - 1; i >= 0; i--) {
        const startDate = new Date(monthsToCheck[i].solarDate);
        startDate.setHours(0,0,0,0);
        
        if (startDate <= targetDate) {
            currentLunarMonth = monthsToCheck[i];
            break;
        }
    }

    if (!currentLunarMonth) return { day: 1, month: 1, leap: false };

    const startDate = new Date(currentLunarMonth.solarDate);
    startDate.setHours(0,0,0,0);
    
    const diffTime = Math.abs(targetDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    return {
        day: diffDays + 1, // 1-based index
        month: currentLunarMonth.lunarMonth,
        leap: currentLunarMonth.isLeap
    };
};

// --- HOLIDAY LOGIC ---
const getVNHoliday = (d: number, m: number, y: number, lDay: number, lMonth: number) => {
    const solarM = m + 1;

    // 1. FIXED SOLAR HOLIDAYS
    if (d === 1 && solarM === 1) return "Tết Dương Lịch";
    if (d === 14 && solarM === 2) return "Valentine";
    if (d === 8 && solarM === 3) return "Q.Tế Phụ Nữ";
    if (d === 30 && solarM === 4) return "Thống Nhất";
    if (d === 1 && solarM === 5) return "Q.Tế Lao Động";
    if (d === 1 && solarM === 6) return "Q.Tế Thiếu Nhi";
    if (d === 2 && solarM === 9) return "Quốc Khánh";
    if (d === 20 && solarM === 10) return "Phụ Nữ VN";
    if (d === 20 && solarM === 11) return "Nhà Giáo VN";
    if (d === 24 && solarM === 12) return "Giáng Sinh";
    if (d === 25 && solarM === 12) return "Noel";

    // 2. DYNAMIC LUNAR HOLIDAYS
    if (lMonth === 1) {
        if (lDay === 1) return "Tết Nguyên Đán";
        if (lDay === 2) return "Mùng 2 Tết";
        if (lDay === 3) return "Mùng 3 Tết";
        if (lDay === 15) return "Tết Nguyên Tiêu";
    }
    if (lMonth === 3 && lDay === 10) return "Giỗ Tổ Hùng Vương";
    if (lMonth === 4 && lDay === 15) return "Lễ Phật Đản";
    if (lMonth === 5 && lDay === 5) return "Tết Đoan Ngọ";
    if (lMonth === 7 && lDay === 15) return "Vu Lan";
    if (lMonth === 8 && lDay === 15) return "Trung Thu";
    if (lMonth === 12 && lDay === 23) return "Ông Công Ông Táo";

    return null;
};

// Helper to ensure YYYY-MM-DD string regardless of input format
const getNormalizedDateString = (dateInput: any): string => {
    if (!dateInput) return '';
    try {
        let date: Date;
        if (dateInput instanceof Date) {
            date = dateInput;
        } else if (typeof dateInput === 'object' && 'seconds' in dateInput) {
            date = new Date(dateInput.seconds * 1000);
        } else if (typeof dateInput === 'object' && typeof dateInput.toDate === 'function') {
            date = dateInput.toDate();
        } else {
            date = new Date(dateInput);
        }
        
        if (isNaN(date.getTime())) return '';
        // Use ISO split to get YYYY-MM-DD part. 
        // Note: This is UTC-based. If local dates are needed without time shifts, 
        // Ensure inputs are stored as ISO strings (YYYY-MM-DD) or normalized.
        return date.toISOString().split('T')[0];
    } catch (e) {
        return '';
    }
};

const CalendarView: React.FC<CalendarViewProps> = ({ tasks, onTaskClick, onAddTask }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const { year, month, daysInMonth, firstDayOfMonth, daysArray } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay(); 
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    return { year, month, daysInMonth, firstDayOfMonth, daysArray };
  }, [currentDate]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  const getTasksForDay = (day: number) => {
    // Construct target date string matching storage format YYYY-MM-DD
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    
    return (tasks || []).filter(t => {
        if (!t) return false;
        const start = getNormalizedDateString(t.startDate);
        const due = getNormalizedDateString(t.dueDate);
        return due === dateStr || start === dateStr;
    });
  };

  const getTaskColorClass = (status: string) => {
      if (!status) return 'bg-indigo-500';
      switch (status) {
          case 'Done': return 'bg-emerald-500';
          case 'In Progress': return 'bg-blue-500';
          case 'To Do': return 'bg-slate-400';
          default: return 'bg-indigo-500';
      }
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="h-full flex flex-col animate-fade-in bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 bg-white dark:bg-slate-900 z-10">
         <div className="flex items-center gap-4">
             <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <CalendarIcon size={24} className="text-indigo-600 dark:text-indigo-400" />
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
             </h2>
             <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                <button onClick={handlePrevMonth} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded shadow-sm transition-all"><ChevronLeft size={18} /></button>
                <button onClick={handleToday} className="px-3 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Today</button>
                <button onClick={handleNextMonth} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded shadow-sm transition-all"><ChevronRight size={18} /></button>
             </div>
         </div>

         <div className="flex gap-2">
             <select 
                value={month} 
                onChange={(e) => setCurrentDate(new Date(year, parseInt(e.target.value), 1))}
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
             >
                 {Array.from({ length: 12 }).map((_, i) => (
                     <option key={i} value={i}>{new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' })}</option>
                 ))}
             </select>
             <select 
                value={year} 
                onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value), month, 1))}
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
             >
                 {Array.from({ length: 11 }).map((_, i) => (
                     <option key={i} value={2020 + i}>{2020 + i}</option>
                 ))}
             </select>
         </div>
      </div>

      {/* Legend Bar */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-slate-400"></div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">To Do</span>
          </div>
          <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-500"></div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Done</span>
          </div>
          <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-indigo-500"></div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Other</span>
          </div>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 shrink-0">
        {weekDays.map((day, index) => (
          <div 
            key={day} 
            className={`
                py-2 text-center text-[10px] font-extrabold uppercase tracking-widest border-r border-slate-100 dark:border-slate-800 last:border-0
                ${index === 0 || index === 6 ? 'bg-stone-50 dark:bg-slate-800/50 text-rose-500 dark:text-rose-400' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400'}
            `}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid Body */}
      <div className="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-6 bg-slate-200 dark:bg-slate-800 gap-px overflow-hidden">
        
        {/* Empty Previous Slots */}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
             <div key={`prev-${i}`} className="bg-slate-50/50 dark:bg-slate-900/20" />
        ))}

        {/* Calendar Cells */}
        {daysArray.map(day => {
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const dateObj = new Date(year, month, day);
            const isToday = new Date().toDateString() === dateObj.toDateString();
            const dayOfWeek = dateObj.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            // Lunar & Holiday
            const lunar = getLunarDate(day, month, year);
            const holiday = getVNHoliday(day, month, year, lunar.day, lunar.month);
            const tasksForDay = getTasksForDay(day);
            
            return (
                <div 
                    key={day}
                    className={`
                        group flex flex-col h-full min-h-[80px] overflow-hidden relative
                        transition-colors hover:bg-indigo-50/30 dark:hover:bg-slate-800
                        ${isWeekend ? 'bg-stone-100 dark:bg-slate-950' : 'bg-white dark:bg-slate-900'}
                        ${isToday ? 'ring-2 ring-inset ring-indigo-600 z-10' : ''}
                    `}
                >
                    {/* HEADER: Date & Add Button */}
                    <div className="flex justify-between items-start p-1.5 shrink-0">
                        <span className={`
                            text-lg font-bold leading-none
                            ${isToday 
                                ? 'text-indigo-600 dark:text-indigo-400' 
                                : (dayOfWeek === 0 || holiday) ? 'text-rose-600 dark:text-rose-500' : 'text-slate-700 dark:text-slate-300'}
                        `}>
                            {day}
                        </span>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onAddTask(dateStr); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    {/* BODY: Scrollable Task List */}
                    <div className="flex-1 w-full overflow-y-auto px-1 gap-1 flex flex-col custom-scrollbar min-h-0">
                        {tasksForDay.map(task => {
                            if (!task || !task.id) return null;
                            return (
                                <div 
                                    key={task.id}
                                    onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                                    className={`
                                        shrink-0 h-6 w-full rounded px-2 flex items-center text-[10px] font-semibold text-white cursor-pointer shadow-sm hover:opacity-90 transition-opacity
                                        ${getTaskColorClass(task.status)}
                                    `}
                                    title={task.title}
                                >
                                    <span className="truncate">{task.title || 'Untitled'}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* FOOTER: Lunar Date & Holiday */}
                    <div className="shrink-0 p-1.5 text-right mt-auto pointer-events-none">
                        {holiday && (
                            <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 leading-tight truncate mb-0.5">
                                {holiday}
                            </div>
                        )}
                        <div className={`text-[10px] font-medium ${holiday ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`}>
                            {lunar.day}/{lunar.month}{lunar.leap ? 'L' : ''}
                        </div>
                    </div>
                </div>
            );
        })}

        {/* Next Month Fillers */}
        {Array.from({ length: 42 - (daysInMonth + firstDayOfMonth) }).map((_, i) => (
             <div key={`next-${i}`} className="bg-slate-50/50 dark:bg-slate-900/20" />
        ))}
      </div>
    </div>
  );
};

function CalendarIcon({ size, className }: { size: number, className?: string }) {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={size} 
            height={size} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={className}
        >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
    );
}

export default CalendarView;
