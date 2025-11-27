
import React, { useMemo, useState, useCallback } from 'react';
import { Task } from '../types';
import { User, Calendar, AlertTriangle, ChevronLeft, ChevronRight, CheckCircle2, Clock, Link } from 'lucide-react';
import { getAvatarInitials, getAvatarColor } from '../utils/avatarUtils';

interface TimelineProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

type ViewMode = 'Day' | 'Week' | 'Month';

// Extended Task interface for internal performance use
interface ProcessedTask extends Task {
    startTs: number;
    dueTs: number;
}

interface AssigneeGroup {
  assignee: string;
  assigneeAvatar?: string;
  tasks: ProcessedTask[];
  lanes: ProcessedTask[][];
}

// Constants for rendering window
const VIEW_WINDOW = {
  Day: 30,   // Render 30 days
  Week: 12,  // Render 12 weeks
  Month: 12  // Render 12 months
};

// --- Robust Date Parsing Helper ---
const parseDate = (dateInput: any): Date | null => {
    if (!dateInput) return null;
    try {
        // 1. Already a Date object
        if (dateInput instanceof Date) {
            return isNaN(dateInput.getTime()) ? null : dateInput;
        }
        // 2. Firestore Timestamp (object with seconds)
        if (typeof dateInput === 'object' && 'seconds' in dateInput) {
            return new Date(dateInput.seconds * 1000);
        }
        // 3. Firestore Timestamp (object with toDate function)
        if (typeof dateInput === 'object' && typeof dateInput.toDate === 'function') {
            return dateInput.toDate();
        }
        // 4. String or Number
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return null;
        return d;
    } catch (e) {
        return null;
    }
};

interface TimelineTaskCardProps {
  task: ProcessedTask;
  left: number;
  width: number;
  top: number;
  isOverdue: boolean;
  isDueToday: boolean;
  status: string;
  priority: string;
  hasDependencies?: boolean;
  onClick?: (task: Task) => void;
}

const TimelineTaskCard: React.FC<TimelineTaskCardProps> = React.memo(({ 
    task, left, width, top, isOverdue, isDueToday, status, priority, hasDependencies, onClick 
}) => {
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (onClick) onClick(task);
    }
  };

  const startDateStr = new Date(task.startTs).toLocaleDateString('en-US');
  const dueDateStr = new Date(task.dueTs).toLocaleDateString('en-US');
  const ariaLabel = `Task: ${task.title}, Status: ${status}, Priority: ${priority}, From ${startDateStr} to ${dueDateStr}`;

  // Style Construction - Default Z-10 to ensure it sits below sticky sidebar (Z-40)
  let bgClass = 'z-10 bg-slate-200 border-slate-300 text-slate-700 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300';
  if (status === 'Done') bgClass = 'z-10 bg-emerald-100 border-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-300';
  else if (status === 'In Progress') bgClass = 'z-10 bg-blue-100 border-blue-200 text-blue-800 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300';
  
  // Priority Override if not Done
  if (priority === 'High' && status !== 'Done') {
      bgClass = 'z-10 bg-rose-100 border-rose-200 text-rose-800 dark:bg-rose-900/40 dark:border-rose-800 dark:text-rose-300';
  }

  // Due Today Override (High Visibility but not Panic) - Z-20
  if (isDueToday && status !== 'Done') {
      bgClass = 'bg-amber-50 border-amber-400 text-amber-800 dark:bg-amber-900/40 dark:border-amber-500 dark:text-amber-200 ring-1 ring-amber-400 z-20';
  }

  // Overdue Override (Highest Z-Index for tasks z-30, but still below Sidebar z-40)
  if (isOverdue && status !== 'Done') {
      bgClass = 'bg-red-50 border-red-500 text-red-700 dark:bg-red-900/20 dark:border-red-500 dark:text-red-300 ring-1 ring-red-500 z-30 shadow-sm';
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      title={`${task.title} (${status})`}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick(task);
      }}
      className={`
          absolute h-8 rounded-lg border flex items-center text-sm font-bold cursor-pointer hover:brightness-95 hover:scale-[1.01] transition-all shadow-sm group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-slate-800 overflow-hidden
          ${bgClass}
      `}
      style={{
          left: `${left}px`,
          width: `${width}px`,
          top: top
      }}
    >
      {/* Sticky Content Container: Ensures text stays visible on left edge when scrolling */}
      <div className="sticky left-0 z-20 flex items-center px-2 h-full max-w-full gap-1.5">
          {isOverdue ? (
              <AlertTriangle size={14} className="shrink-0 animate-pulse text-red-600 dark:text-red-400 drop-shadow-sm" aria-hidden="true" />
          ) : isDueToday ? (
              <Clock size={14} className="shrink-0 text-amber-600 dark:text-amber-400 drop-shadow-sm" aria-hidden="true" />
          ) : status === 'Done' ? (
              <CheckCircle2 size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400 opacity-90 drop-shadow-sm" aria-hidden="true" />
          ) : null}
          
          <span className="truncate font-bold drop-shadow-sm">{task.title}</span>
          
          {hasDependencies && (
              <Link size={10} className="shrink-0 opacity-60" />
          )}
      </div>
      
      {/* Hover Details (Z-50 to float above everything) */}
      <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-0 mb-2 w-max max-w-[200px] bg-slate-900 text-white text-xs p-2 rounded-md pointer-events-none z-50 shadow-xl" aria-hidden="true">
          <p className="font-bold text-sm">{task.title}</p>
          <p className="text-slate-300">{status} • {priority}</p>
          <p className="text-slate-400">{startDateStr} - {dueDateStr}</p>
          {hasDependencies && <p className="text-slate-300 flex items-center gap-1 mt-1"><Link size={10}/> Has Dependencies</p>}
          {isDueToday && <p className="text-amber-400 font-bold mt-1">Due Today</p>}
          {isOverdue && <p className="text-red-400 font-bold mt-1">Overdue</p>}
      </div>
    </div>
  );
});

// --- MEMOIZED ROW COMPONENT ---
interface TimelineRowProps {
  group: AssigneeGroup;
  timelineStartTimestamp: number;
  windowEndTimestamp: number;
  pixelsPerDay: number;
  nowTs: number;
  todayDateString: string;
  onTaskClick?: (task: Task) => void;
}

const TimelineRow: React.FC<TimelineRowProps> = React.memo(({ group, timelineStartTimestamp, windowEndTimestamp, pixelsPerDay, nowTs, todayDateString, onTaskClick }) => {
  
  // Helper to calculate positioning numbers (returns primitives)
  const getTaskCoords = (task: ProcessedTask, laneIdx: number) => {
      const diffTime = task.startTs - timelineStartTimestamp;
      const startOffsetDays = diffTime / (1000 * 60 * 60 * 24);
      
      const durationTime = Math.abs(task.dueTs - task.startTs);
      const durationDays = Math.ceil(durationTime / (1000 * 60 * 60 * 24)) + 1;

      const left = startOffsetDays * pixelsPerDay;
      const width = Math.max(durationDays * pixelsPerDay, 4);
      const top = (laneIdx * 38) + 6;
      
      const isOverdue = task.dueTs < nowTs && task.status !== 'Done';
      
      // Check Due Today: Compare task due date string with today's date string
      const dueDateStr = new Date(task.dueTs).toDateString();
      const isDueToday = dueDateStr === todayDateString && task.status !== 'Done';

      return { left, width, top, isOverdue, isDueToday };
  };

  return (
    // Row Container: Relative + z-10 establishes a stacking context for the row
    <div className="flex border-b border-slate-100 dark:border-slate-700/50 relative z-10 group/row" role="row">
        {/* Sticky Left Column: Assignee Info */}
        {/* z-40 ensures it sits above the tasks (z-10/z-20/z-30) within this row context */}
        {/* Solid background required to cover tasks sliding underneath */}
        <div 
            className="sticky left-0 z-40 w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)] transition-colors focus:outline-none" 
            role="rowheader"
            tabIndex={0}
            aria-label={`${group.assignee}, ${group.tasks.length} tasks`}
        >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shadow-sm overflow-hidden ${group.assigneeAvatar && group.assigneeAvatar.startsWith('http') ? '' : getAvatarColor(group.assignee)}`}>
                {group.assigneeAvatar && group.assigneeAvatar.startsWith('http') ? (
                  <img src={group.assigneeAvatar} alt="" className="w-full h-full object-cover" aria-hidden="true" />
                ) : (
                  getAvatarInitials(group.assignee)
                )}
            </div>
            <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{group.assignee}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{group.tasks.length} tasks</p>
            </div>
        </div>

        {/* Task Lanes */}
        <div className="relative flex-1 py-2 transition-colors group-hover/row:bg-slate-50/20 dark:group-hover/row:bg-slate-700/10" style={{ height: Math.max(group.lanes.length * 40, 60) + 'px' }}>
            {group.lanes.map((lane, laneIdx) => (
                lane.map(task => {
                    // SAFETY GUARD: Prevent crashes from corrupted task data
                    if (!task || !task.id) return null;
                    if (!task.startTs || !task.dueTs) return null;

                    // CULLING OPTIMIZATION:
                    // Only render task if it overlaps with the current view window.
                    if (task.dueTs < timelineStartTimestamp || task.startTs > windowEndTimestamp) {
                        return null;
                    }

                    const coords = getTaskCoords(task, laneIdx);
                    const hasDependencies = !!(task.dependencies && task.dependencies.length > 0);

                    return (
                        <TimelineTaskCard 
                          key={task.id} 
                          task={task}
                          left={coords.left}
                          width={coords.width}
                          top={coords.top}
                          isOverdue={coords.isOverdue}
                          isDueToday={coords.isDueToday}
                          status={task.status}
                          priority={task.priority}
                          hasDependencies={hasDependencies}
                          onClick={onTaskClick} 
                        />
                    );
                })
            ))}
        </div>
    </div>
  );
});


const Timeline: React.FC<TimelineProps> = ({ tasks, onTaskClick }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('Day');
  
  // Initialize start date to Today (start of day)
  const [timelineStartDate, setTimelineStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  
  // Memoize timestamp for passing to pure components
  const timelineStartTimestamp = useMemo(() => timelineStartDate.getTime(), [timelineStartDate]);
  const nowTs = useMemo(() => Date.now(), []);
  const todayDateString = useMemo(() => new Date().toDateString(), []);

  // --- Optimization: Pre-process tasks to use timestamps with SAFETY ---
  const processedTasks = useMemo(() => {
      return tasks.map(t => {
          if (!t) return null;

          // Strict Parse Using Helper
          const startDateObj = parseDate(t.startDate);
          const dueDateObj = parseDate(t.dueDate);

          // Guard Clause: Skip invalid dates immediately
          if (!startDateObj || !dueDateObj) return null;

          return {
              ...t,
              startTs: startDateObj.getTime(),
              dueTs: dueDateObj.getTime()
          } as ProcessedTask;
      }).filter((t): t is ProcessedTask => t !== null);
  }, [tasks]);

  // Cell dimensions
  const cellWidth = useMemo(() => {
    if (viewMode === 'Day') return 60;
    if (viewMode === 'Week') return 120; 
    if (viewMode === 'Month') return 100; 
    return 60;
  }, [viewMode]);

  const pixelsPerDay = useMemo(() => {
      if (viewMode === 'Day') return 60;
      if (viewMode === 'Week') return 120 / 7;
      if (viewMode === 'Month') return 100 / 30; // Approx
      return 60;
  }, [viewMode]);

  // --- Navigation Handlers ---
  const handleNavigate = (direction: 'prev' | 'next') => {
      const newDate = new Date(timelineStartDate);
      const multiplier = direction === 'next' ? 1 : -1;

      if (viewMode === 'Day') {
          newDate.setDate(newDate.getDate() + (7 * multiplier));
      } else if (viewMode === 'Week') {
          newDate.setDate(newDate.getDate() + (7 * 4 * multiplier));
      } else if (viewMode === 'Month') {
          newDate.setMonth(newDate.getMonth() + (3 * multiplier));
      }
      setTimelineStartDate(newDate);
  };

  const handleToday = () => {
      const today = new Date();
      today.setHours(0,0,0,0);
      setTimelineStartDate(today);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newMonth = parseInt(e.target.value);
      const d = new Date(timelineStartDate);
      d.setMonth(newMonth);
      setTimelineStartDate(d);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newYear = parseInt(e.target.value);
      const d = new Date(timelineStartDate);
      d.setFullYear(newYear);
      setTimelineStartDate(d);
  };

  // --- Grid Generation (Strict English) ---
  const headers = useMemo(() => {
     const headers = [];
     const today = new Date();
     today.setHours(0,0,0,0);
     const todayTs = today.getTime();

     if (viewMode === 'Day') {
         for (let i = 0; i < VIEW_WINDOW.Day; i++) {
             const d = new Date(timelineStartDate);
             d.setDate(d.getDate() + i);
             
             headers.push({
                 label: d.getDate().toString(),
                 subLabel: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
                 width: cellWidth,
                 isWeekend: d.getDay() === 0 || d.getDay() === 6,
                 isToday: d.getTime() === todayTs
             });
         }
     } else if (viewMode === 'Week') {
         for (let i = 0; i < VIEW_WINDOW.Week; i++) {
             const d = new Date(timelineStartDate);
             d.setDate(d.getDate() + (i * 7));
             
             const weekEnd = new Date(d);
             weekEnd.setDate(d.getDate() + 6);
             const isCurrentWeek = today >= d && today <= weekEnd;

             const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
             const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
             const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

             headers.push({
                 label: `W${weekNum}`,
                 subLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric'}),
                 width: cellWidth,
                 isToday: isCurrentWeek,
                 isWeekend: false
             });
         }
     } else if (viewMode === 'Month') {
         for (let i = 0; i < VIEW_WINDOW.Month; i++) {
             const d = new Date(timelineStartDate);
             d.setDate(1);
             d.setMonth(timelineStartDate.getMonth() + i);
             d.setFullYear(timelineStartDate.getFullYear() + Math.floor((timelineStartDate.getMonth() + i) / 12));

             const isCurrentMonth = today.getMonth() === d.getMonth() && today.getFullYear() === d.getFullYear();

             headers.push({
                 label: d.toLocaleDateString('en-US', { month: 'short' }),
                 subLabel: d.getFullYear().toString(),
                 width: cellWidth,
                 isToday: isCurrentMonth,
                 isWeekend: false
             });
         }
     }
     return headers;
  }, [timelineStartDate, viewMode, cellWidth]);

  // Window End Timestamp
  const windowEndTimestamp = useMemo(() => {
      const end = new Date(timelineStartDate);
      if (viewMode === 'Day') end.setDate(end.getDate() + VIEW_WINDOW.Day);
      else if (viewMode === 'Week') end.setDate(end.getDate() + (VIEW_WINDOW.Week * 7));
      else if (viewMode === 'Month') end.setMonth(end.getMonth() + VIEW_WINDOW.Month);
      return end.getTime();
  }, [timelineStartDate, viewMode]);

  // --- Group Tasks (OPTIMIZED: Decoupled from View Window) ---
  const groupedTasks: AssigneeGroup[] = useMemo(() => {
      // We process ALL tasks for the project here.
      const groups: Record<string, ProcessedTask[]> = {};
      const avatars: Record<string, string> = {};
      
      processedTasks.forEach(task => {
          const key = task.assignee || 'Unassigned';
          if (!groups[key]) groups[key] = [];
          groups[key].push(task);
          if (task.assigneeAvatar && !avatars[key]) {
              avatars[key] = task.assigneeAvatar;
          }
      });

      const sortedAssignees = Object.keys(groups).sort((a, b) => {
          if (a === 'Unassigned' || a === 'UN') return 1;
          if (b === 'Unassigned' || b === 'UN') return -1;
          return a.localeCompare(b);
      });

      return sortedAssignees.map(assignee => {
          const groupTasks = groups[assignee].sort((a, b) => a.startTs - b.startTs);
          const lanes: ProcessedTask[][] = [];

          groupTasks.forEach(task => {
              let placed = false;
              for (let lane of lanes) {
                  const lastTask = lane[lane.length - 1];
                  // FIX: Ensure next task starts strictly after the previous task's due date is fully over
                  // Adding a small buffer (24h) ensures they don't overlap visually on the same day cell
                  // Using > comparison logic against dueTs where dueTs is the day *start* of the due date
                  if (task.startTs > lastTask.dueTs) {
                      lane.push(task);
                      placed = true;
                      break;
                  }
              }
              if (!placed) {
                  lanes.push([task]);
              }
          });
          
          let displayName = assignee;
          if (assignee === 'UN') displayName = 'Unassigned';

          return {
              assignee: displayName,
              assigneeAvatar: avatars[assignee],
              tasks: groupTasks,
              lanes: lanes
          };
      });
  }, [processedTasks]);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = Array.from({ length: 8 }, (_, i) => 2023 + i);

  return (
    <div className="flex flex-col h-full animate-fade-in bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      
      {/* Top Controls Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col xl:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-800 relative z-50">
        
        {/* Left: Date Navigation */}
        <div className="flex items-center gap-3 w-full xl:w-auto justify-center xl:justify-start">
            <button 
                onClick={handleToday}
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors"
            >
                Today
            </button>
            
            <div className="flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-1">
                <button 
                    onClick={() => handleNavigate('prev')} 
                    className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded-md text-slate-500 dark:text-slate-400 transition-all shadow-sm"
                    aria-label="Previous time period"
                >
                    <ChevronLeft size={16} />
                </button>
                
                {/* Month/Year Dropdowns */}
                <div className="flex items-center px-2 gap-2">
                    <select 
                        value={timelineStartDate.getMonth()}
                        onChange={handleMonthChange}
                        className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors appearance-none"
                    >
                        {months.map((m, i) => <option key={i} value={i} className="bg-white dark:bg-slate-800">{m}</option>)}
                    </select>
                    <select 
                        value={timelineStartDate.getFullYear()}
                        onChange={handleYearChange}
                        className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors appearance-none"
                    >
                        {years.map(y => <option key={y} value={y} className="bg-white dark:bg-slate-800">{y}</option>)}
                    </select>
                </div>

                <button 
                    onClick={() => handleNavigate('next')} 
                    className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded-md text-slate-500 dark:text-slate-400 transition-all shadow-sm"
                    aria-label="Next time period"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
        
        {/* Right: View Switcher & Legend */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto justify-center xl:justify-end">
            
            {/* Legend */}
            <div className="flex flex-wrap justify-center items-center gap-3 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 py-1.5 px-3 rounded-lg border border-slate-100 dark:border-slate-700" aria-hidden="true">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                    <span>To Do</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-400"></div>
                    <span>In Progress</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                    <span>Done</span>
                </div>
                 <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-1 ring-amber-400/50"></div>
                    <span>Due Today</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full border-2 border-red-500 bg-red-50 dark:bg-red-900/50"></div>
                    <span>Overdue</span>
                </div>
            </div>

            {/* Switcher */}
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg shrink-0" role="group" aria-label="View mode switcher">
                {(['Day', 'Week', 'Month'] as ViewMode[]).map(mode => (
                    <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        aria-pressed={viewMode === mode}
                        className={`
                            px-3 py-1 text-xs font-bold rounded-md transition-all
                            ${viewMode === mode 
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }
                        `}
                    >
                        {mode}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* SINGLE SCROLLABLE CONTAINER */}
      <div className="flex-1 overflow-auto custom-scrollbar relative bg-white dark:bg-slate-800 isolate" role="grid">
         <div className="min-w-fit">
            
            {/* --- 1. HEADER ROW --- */}
            {/* z-30 ensures the Date Header floats above task content but plays nice with stacking context */}
            <div className="flex sticky top-0 z-30 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm" role="row">
               
               {/* Sticky Corner: Team Member Label */}
               {/* z-50 ensures this top-left corner floats above everything, including the sticky left column (z-40) */}
               <div className="sticky left-0 z-50 w-64 shrink-0 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex items-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]" role="columnheader">
                   Team Member
               </div>
               
               {/* Date Cells */}
               <div className="flex" role="row">
                   {headers.map((header, idx) => (
                       <div 
                          key={idx} 
                          className={`
                              shrink-0 border-r border-slate-200 dark:border-slate-700 flex flex-col justify-center items-center py-2
                              ${header.isToday ? 'bg-blue-50/80 dark:bg-blue-900/20' : (header.isWeekend ? 'bg-slate-100/50 dark:bg-slate-800/50' : '')}
                          `}
                          style={{ width: header.width }}
                          role="columnheader"
                       >
                           <span className={`
                              text-xs font-bold 
                              ${header.isToday ? 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 rounded-full' : 'text-slate-700 dark:text-slate-200'}
                           `}>
                              {header.label}
                           </span>
                           <span className={`text-[10px] uppercase mt-0.5 ${header.isToday ? 'text-blue-500 dark:text-blue-400 font-bold' : 'text-slate-400'}`}>
                              {header.subLabel}
                           </span>
                       </div>
                   ))}
               </div>
            </div>

            {/* --- 2. BODY ROWS --- */}
            <div className="relative z-0">
                {/* Full Grid Background Lines (Absolute) */}
                <div className="absolute inset-0 flex pl-64 pointer-events-none z-0">
                     {headers.map((header, idx) => (
                         <div 
                            key={idx} 
                            className={`
                                shrink-0 border-r border-slate-100 dark:border-slate-700/50 h-full 
                                ${header.isToday 
                                    ? 'bg-blue-50 dark:bg-blue-900/10 border-l-2 border-l-blue-300 dark:border-l-blue-500 border-r-blue-200 dark:border-r-blue-900' 
                                    : (header.isWeekend ? 'bg-slate-50/50 dark:bg-slate-900/30' : '')
                                }
                            `}
                            style={{ width: header.width }}
                         />
                     ))}
                </div>

                {/* Rows content */}
                {groupedTasks.map((group) => (
                    <TimelineRow 
                      key={group.assignee}
                      group={group}
                      timelineStartTimestamp={timelineStartTimestamp}
                      windowEndTimestamp={windowEndTimestamp}
                      pixelsPerDay={pixelsPerDay}
                      onTaskClick={onTaskClick}
                      nowTs={nowTs}
                      todayDateString={todayDateString}
                    />
                ))}

                {groupedTasks.length === 0 && (
                     <div className="p-12 text-center text-slate-400 dark:text-slate-500 ml-64">
                         <Calendar size={48} className="mx-auto mb-4 opacity-20" aria-hidden="true" />
                         <p>No tasks scheduled for this period.</p>
                     </div>
                 )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default Timeline;
