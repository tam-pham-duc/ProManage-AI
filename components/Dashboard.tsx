
import React, { useMemo, useState, useEffect } from 'react';
import { 
  Briefcase, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  MoreHorizontal,
  Plus,
  PieChart,
  DollarSign,
  TrendingDown,
  Wallet,
  MessageSquare,
  FileText,
  ArrowRight,
  Paperclip,
  AlertTriangle,
  MoveRight,
  Calendar,
  ChevronDown,
  Download,
  Printer,
  FileSpreadsheet,
  X
} from 'lucide-react';
import { MetricCardProps, Task, Project, Tab, KanbanColumn, ActivityLog } from '../types';
import WelcomeBanner from './WelcomeBanner';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface DashboardProps {
  tasks: Task[];
  projects?: Project[];
  columns?: KanbanColumn[]; // Added columns for dynamic chart
  currentProject?: Project;
  onAddTask?: () => void;
  onTaskClick?: (task: Task) => void;
  onNavigate?: (tab: Tab, filterStatus?: string) => void;
  onStatusChange?: (taskId: string, newStatus: string) => void;
  userName?: string;
}

// --- Helper: Smart Time Formatting ---
const formatSmartTime = (timestampStr: string | any) => {
    if (!timestampStr) return 'Just now';
    
    try {
        let date: Date;
        // Handle Firestore Timestamp (has seconds)
        if (timestampStr && typeof timestampStr === 'object' && 'seconds' in timestampStr) {
             date = new Date(timestampStr.seconds * 1000);
        } 
        // Handle Firestore Timestamp object (has toDate)
        else if (timestampStr && typeof timestampStr.toDate === 'function') {
            date = timestampStr.toDate();
        } 
        // Handle Date object or String
        else {
            date = new Date(timestampStr);
        }

        // Invalid Date Check
        if (isNaN(date.getTime())) return 'Just now';

        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        
        if (diffHours < 24) {
            if (diffHours < 1) {
                const minutes = Math.floor(diffMs / (1000 * 60));
                return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
            }
            return `${Math.floor(diffHours)}h ago`;
        } else if (diffHours < 48) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    } catch (e) {
        return 'Just now';
    }
};

// --- Helper: Safe Date Parser ---
const safeParseDate = (dateInput: any): number => {
    if (!dateInput) return 0;
    try {
        if (typeof dateInput === 'object' && 'seconds' in dateInput) {
            return dateInput.seconds * 1000;
        }
        if (typeof dateInput.toDate === 'function') {
            return dateInput.toDate().getTime();
        }
        const d = new Date(dateInput);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    } catch (e) {
        return 0;
    }
};

// --- Sticky Note Component ---
const StickyNote: React.FC = () => {
  const [note, setNote] = useState(() => {
    try {
      return localStorage.getItem('app_quick_note') || '';
    } catch (e) {
      return '';
    }
  });

  useEffect(() => {
    localStorage.setItem('app_quick_note', note);
  }, [note]);

  return (
    <div className="bg-yellow-100 dark:bg-yellow-900/80 rounded-xl shadow-lg hover:shadow-xl transform -rotate-1 hover:rotate-0 transition-all duration-300 p-6 h-full min-h-[280px] flex flex-col border border-yellow-300 dark:border-yellow-800 group relative print:hidden">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-yellow-200 dark:border-yellow-800">
         <span className="text-sm font-bold text-yellow-900 dark:text-yellow-100 flex items-center gap-2 font-mono">
            📝 Quick Notes
         </span>
         <button
           onClick={() => setNote('')}
           className="text-xs font-bold text-yellow-800 dark:text-yellow-200 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded hover:bg-yellow-300/50 dark:hover:bg-yellow-800/50"
         >
            Clear
         </button>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Type your fleeting ideas here..."
        className="flex-1 w-full bg-transparent border-none outline-none resize-none font-mono text-sm text-slate-900 dark:text-white placeholder-yellow-700/50 dark:placeholder-yellow-500/50 custom-scrollbar leading-relaxed"
      />
    </div>
  );
};

// --- Upcoming Deadlines Component ---
interface UpcomingDeadlinesProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: string) => void;
  columns?: KanbanColumn[];
}

const UpcomingDeadlines: React.FC<UpcomingDeadlinesProps> = ({ tasks, onTaskClick, onStatusChange, columns = [] }) => {
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    const deadlines = useMemo(() => {
        return (tasks || [])
            .filter(t => t && t.status !== 'Done' && t.dueDate)
            .sort((a, b) => {
                const dateA = safeParseDate(a.dueDate);
                const dateB = safeParseDate(b.dueDate);
                // Sort ascending (soonest first), push invalid dates to end
                if (dateA === 0) return 1;
                if (dateB === 0) return -1;
                return dateA - dateB;
            })
            .slice(0, 5);
    }, [tasks]);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm p-6 flex flex-col h-full transition-all duration-300 hover:shadow-md print:shadow-none print:border-slate-200 print:bg-white">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 print:text-black">
                    <Calendar size={20} className="text-indigo-500 print:text-black" />
                    Upcoming Deadlines
                </h2>
                <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-full print:hidden">
                    {deadlines.length}
                </span>
            </div>
            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1 print:overflow-visible">
                {deadlines.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm text-center">
                        <CheckCircle2 size={24} className="mb-2 opacity-20" />
                        <p>All caught up!</p>
                    </div>
                )}
                {deadlines.map(task => {
                    if (!task || !task.id) return null;
                    const dueDateTs = safeParseDate(task.dueDate);
                    const isOverdue = dueDateTs < Date.now();
                    const isToday = new Date(dueDateTs).toDateString() === new Date().toDateString();
                    const displayDate = new Date(dueDateTs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    
                    return (
                        <div
                            key={task.id}
                            onClick={() => onTaskClick && onTaskClick(task)}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer transition-all group relative print:bg-white print:border-slate-200"
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mr-2 print:text-black">
                                    {task.title}
                                </h4>
                                {isOverdue ? (
                                    <AlertTriangle size={14} className="text-red-500 shrink-0 animate-pulse print:text-red-600 print:animate-none" />
                                ) : isToday ? (
                                    <Clock size={14} className="text-amber-500 shrink-0 print:text-black" />
                                ) : null}
                            </div>
                            <div className="flex justify-between items-center text-xs relative z-10">
                                <span className={`font-medium ${isOverdue ? 'text-red-600 dark:text-red-400' : isToday ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {displayDate}
                                </span>
                                
                                <div className="relative print:hidden">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveDropdown(activeDropdown === task.id ? null : task.id);
                                        }}
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 hover:brightness-95 transition-all border border-transparent hover:border-black/10 dark:hover:border-white/20 ${
                                            task.priority === 'High' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300' : 
                                            task.priority === 'Medium' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300' : 
                                            'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                                        }`}
                                        title="Click to change status"
                                    >
                                        {task.priority}
                                        <ChevronDown size={10} className="opacity-60" />
                                    </button>

                                    {/* Status Dropdown */}
                                    {activeDropdown === task.id && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); }}></div>
                                            <div className="absolute right-0 bottom-full mb-1 w-36 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-fade-in">
                                                <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    Move to...
                                                </div>
                                                <div className="max-h-32 overflow-y-auto custom-scrollbar p-1">
                                                    {columns.map(col => (
                                                        <button
                                                            key={col.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (onStatusChange) onStatusChange(task.id, col.title);
                                                                setActiveDropdown(null);
                                                            }}
                                                            className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-medium flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${task.status === col.title ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-700 dark:text-slate-300'}`}
                                                        >
                                                            {col.title}
                                                            {task.status === col.title && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {/* Print Only Priority Text */}
                                <div className="hidden print:block text-[10px] font-bold text-slate-600">
                                    {task.priority}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

// --- Donut Chart Component ---
interface ChartSegment {
  label: string;
  value: number;
  colorClass: string;
}

const DonutChart: React.FC<{ data: ChartSegment[]; total: number; onNavigate?: (status: string) => void }> = ({ data, total, onNavigate }) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  const doneCount = data.find(d => d.label === 'Done')?.value || 0;
  const percentage = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  if (total === 0) {
    return (
      <div className="relative w-48 h-48 flex items-center justify-center mx-auto">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="transparent" stroke="currentColor" strokeWidth="12" className="text-slate-200 dark:text-slate-700"/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
           <span className="text-xs font-medium">No Data</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-48 h-48 flex items-center justify-center mx-auto group">
      <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 drop-shadow-md print:drop-shadow-none">
        {/* Background Track */}
        <circle cx="50" cy="50" r={radius} fill="transparent" stroke="currentColor" strokeWidth="12" className="text-slate-200 dark:text-slate-700 print:text-slate-200" />
        
        {/* Data Segments */}
        {data.map((segment, index) => {
            const strokeDasharray = `${(segment.value / total) * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedOffset;
            accumulatedOffset += (segment.value / total) * circumference;
            
            if (segment.value === 0) return null;

            return (
                <circle
                    key={index}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className={`${segment.colorClass} transition-all duration-1000 ease-out hover:opacity-80 cursor-pointer`}
                    onClick={() => onNavigate && onNavigate(segment.label)}
                />
            );
        })}
      </svg>
      
      {/* Center Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in pointer-events-none">
         <span className="text-3xl font-bold text-slate-800 dark:text-white transition-all duration-300 group-hover:scale-110 print:text-black">{percentage}%</span>
         <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Complete</span>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<MetricCardProps> = ({ title, value, change, icon: Icon, color, onClick }) => {
  const colorStyles = {
    blue: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 print:border-blue-200 print:text-blue-700 print:bg-blue-50",
    green: "bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 print:border-green-200 print:text-green-700 print:bg-green-50",
    purple: "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800 print:border-purple-200 print:text-purple-700 print:bg-purple-50",
    red: "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 print:border-red-200 print:text-red-700 print:bg-red-50",
    orange: "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800 print:border-orange-200 print:text-orange-700 print:bg-orange-50"
  };

  return (
    <div 
      onClick={onClick}
      className={`
        bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm 
        transition-all duration-300 group
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1 hover:border-indigo-200 dark:hover:border-indigo-700' : ''}
        print:shadow-none print:border-slate-300 print:bg-white
      `}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors print:text-slate-600">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900 dark:text-white print:text-black">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl shadow-sm ${colorStyles[color]} group-hover:scale-110 transition-transform print:shadow-none`}>
          <Icon size={22} strokeWidth={2.5} />
        </div>
      </div>
      {change && (
        <div className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 w-fit px-2 py-1 rounded-full print:bg-emerald-100 print:text-emerald-800">
          <TrendingUp size={14} />
          <span>{change} from last month</span>
        </div>
      )}
    </div>
  );
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

// --- PRINT HEADER COMPONENT ---
const PrintHeader: React.FC<{ projectName: string; clientName: string; userName: string }> = ({ projectName, clientName, userName }) => {
    return (
        <div className="hidden print:block mb-8 border-b-2 border-slate-800 pb-4">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight mb-2">Project Progress Report</h1>
                    <div className="space-y-1">
                        <div className="text-xl font-bold text-slate-700">{projectName}</div>
                        {clientName && <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Client: {clientName}</div>}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-sm text-slate-500">Generated on</div>
                    <div className="font-bold text-slate-800">{new Date().toLocaleDateString()}</div>
                    <div className="text-xs text-slate-400 mt-1">by {userName}</div>
                </div>
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ tasks, projects = [], columns = [], currentProject, onAddTask, onTaskClick, onNavigate, onStatusChange, userName }) => {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [activities, setActivities] = useState<ActivityLog[]>([]); // Raw activity logs

  // Process activities to attach current task details
  // This prevents stale closures and excessive re-subscriptions when tasks update
  const processedActivities = useMemo(() => {
      return activities.map(activity => ({
          ...activity,
          // Attach the current task object if found, to allow navigation
          task: tasks.find(t => t.id === activity.taskId),
          // Ensure project name is consistent with current context
          projectName: currentProject?.name || ''
      }));
  }, [activities, tasks, currentProject]);

  // CSV Export Logic
  const handleExportCSV = () => {
      if (!currentProject || tasks.length === 0) return;

      const headers = [
          "ID", "Title", "Status", "Priority", "Assignee", 
          "Start Date", "Due Date", "Estimated Cost", "Actual Cost", "Variance", "Description"
      ];

      const csvRows = [headers.join(',')];

      tasks.forEach(task => {
          const variance = (task.estimatedCost || 0) - (task.actualCost || 0);
          // Escape quotes by replacing " with "" and wrap fields in quotes
          const escape = (text: string | undefined) => {
              if (!text) return '""';
              return `"${text.replace(/"/g, '""')}"`;
          };

          const row = [
              escape(task.id),
              escape(task.title),
              escape(task.status),
              escape(task.priority),
              escape(task.assignee),
              escape(task.startDate),
              escape(task.dueDate),
              task.estimatedCost || 0,
              task.actualCost || 0,
              variance,
              escape(task.description?.replace(/\n/g, ' ')) // Remove newlines for CSV safety
          ];
          csvRows.push(row.join(','));
      });

      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${currentProject.name.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExportMenuOpen(false);
  };

  const handlePrintReport = () => {
      setIsExportMenuOpen(false);
      setTimeout(() => {
          window.print();
      }, 100);
  };

  const stats = useMemo(() => {
    const safeTasks = tasks || [];
    const total = safeTasks.length;
    const inProgress = safeTasks.filter(t => t && t.status === 'In Progress').length;
    const completed = safeTasks.filter(t => t && t.status === 'Done').length;
    const todo = safeTasks.filter(t => t && t.status === 'To Do').length;
    const overdue = safeTasks.filter(t => {
      if (!t || !t.dueDate) return false;
      const dueDateTs = safeParseDate(t.dueDate);
      const isOverdue = dueDateTs < Date.now();
      return isOverdue && t.status !== 'Done';
    }).length;

    return { total, inProgress, completed, todo, overdue };
  }, [tasks]);

  const financials = useMemo(() => {
    if (!tasks) return { totalBudget: 0, totalSpent: 0, variance: 0 };
    const totalBudget = tasks.reduce((sum, t) => sum + (t?.estimatedCost || 0), 0);
    const totalSpent = tasks.reduce((sum, t) => sum + (t?.actualCost || 0), 0);
    const variance = totalBudget - totalSpent;
    return { totalBudget, totalSpent, variance };
  }, [tasks]);

  // --- Dynamic Chart Data Calculation ---
  const chartData: ChartSegment[] = useMemo(() => {
    const getColorClass = (colorName: string) => {
        const map: Record<string, string> = {
            slate: 'text-slate-500 print:text-slate-500',
            blue: 'text-blue-500 print:text-blue-600',
            emerald: 'text-emerald-500 print:text-emerald-600',
            indigo: 'text-indigo-500 print:text-indigo-600',
            purple: 'text-purple-500 print:text-purple-600',
            rose: 'text-rose-500 print:text-rose-600',
            amber: 'text-amber-500 print:text-amber-600'
        };
        return map[colorName] || 'text-slate-500';
    };

    if (columns.length > 0) {
        return columns.map(col => ({
            label: col.title,
            value: tasks?.filter(t => t && t.status === col.title).length || 0,
            colorClass: getColorClass(col.color)
        }));
    }

    return [
        { label: 'Done', value: stats.completed, colorClass: 'text-emerald-500 print:text-emerald-600' },
        { label: 'In Progress', value: stats.inProgress, colorClass: 'text-blue-500 print:text-blue-600' },
        { label: 'To Do', value: stats.todo, colorClass: 'text-slate-300 dark:text-slate-600 print:text-slate-400' },
    ];
  }, [tasks, columns, stats]);


  // --- Activity Feed Real-time Listener ---
  useEffect(() => {
      if (!currentProject) {
          setActivities([]);
          return;
      }

      const q = query(
          collection(db, 'projects', currentProject.id, 'activities'),
          orderBy('timestamp', 'desc'),
          limit(20)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
          const fetchedActivities = snapshot.docs.map(doc => {
              const data = doc.data();
              // Safely parse Timestamp
              let timestamp = 'Just now';
              if (data.timestamp) {
                  if (typeof data.timestamp.toDate === 'function') {
                      timestamp = data.timestamp.toDate().toISOString();
                  } else if (typeof data.timestamp === 'object' && 'seconds' in data.timestamp) {
                      timestamp = new Date(data.timestamp.seconds * 1000).toISOString();
                  } else if (typeof data.timestamp === 'string') {
                      timestamp = data.timestamp;
                  }
              }

              return {
                  id: doc.id,
                  ...data,
                  timestamp,
                  // Explicitly map fields used in interface
                  userId: data.userId,
                  userName: data.userName,
                  userAvatar: data.userAvatar,
                  taskId: data.taskId,
                  taskTitle: data.taskTitle,
                  action: data.action,
                  type: data.type,
                  details: data.details
              } as ActivityLog;
          });
          setActivities(fetchedActivities);
      });

      return () => unsubscribe();
  }, [currentProject?.id]); // Only re-run if the project ID changes, NOT when tasks update


  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in text-center space-y-8">
        <div className="relative">
            <div className="w-28 h-28 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center animate-pulse">
              <Briefcase size={48} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-800 p-2 rounded-full shadow-lg border border-slate-100 dark:border-slate-700">
                <Plus size={20} className="text-green-500" />
            </div>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight mb-3">Welcome to ProManage AI</h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto text-lg leading-relaxed">
            Your project board is empty. Create your first task to start tracking progress, costs, and timelines.
          </p>
        </div>
        <button 
          onClick={onAddTask}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-indigo-200 dark:shadow-indigo-900/40 hover:bg-indigo-700 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center gap-3 text-lg"
        >
          <Plus size={24} strokeWidth={3} />
          Create First Task
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-8">
      
      <PrintHeader 
        projectName={currentProject?.name || "Dashboard"} 
        clientName={currentProject?.clientName || ""} 
        userName={userName || "User"} 
      />

      <div className="print:hidden">
        <WelcomeBanner userName={userName || 'User'} isCompact={true} />
      </div>

      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight print:text-black">Project Overview</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1 font-medium text-sm print:text-slate-600">Performance metrics and recent updates.</p>
        </div>
        
        {/* Export / Report Button */}
        <div className="relative print:hidden">
            <button 
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl shadow-sm transition-colors font-bold text-sm"
            >
                <Download size={16} />
                Export / Report
                <ChevronDown size={14} className="text-slate-400" />
            </button>

            {isExportMenuOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-fade-in">
                        <div className="p-1">
                            <button 
                                onClick={handleExportCSV}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <FileSpreadsheet size={16} className="text-green-600" />
                                Export to CSV
                            </button>
                            <button 
                                onClick={handlePrintReport}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <Printer size={16} className="text-slate-600 dark:text-slate-400" />
                                Print Report (PDF)
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4 print:gap-4">
        <SummaryCard 
          title="Total Tasks" 
          value={stats.total} 
          change="+12%"
          icon={Briefcase} 
          color="blue" 
          onClick={() => onNavigate && onNavigate('kanban')}
        />
        <SummaryCard 
          title="In Progress" 
          value={stats.inProgress} 
          icon={Clock} 
          color="purple" 
          onClick={() => onNavigate && onNavigate('kanban', 'In Progress')}
        />
        <SummaryCard 
          title="Completed" 
          value={stats.completed} 
          change="+5%"
          icon={CheckCircle2} 
          color="green" 
          onClick={() => onNavigate && onNavigate('kanban', 'Done')}
        />
        <SummaryCard 
          title="Overdue" 
          value={stats.overdue} 
          icon={AlertCircle} 
          color="red" 
          onClick={() => onNavigate && onNavigate('timeline')}
        />
      </div>

      {/* Financial Overview */}
      <div>
         <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2 print:text-black print:mb-2">
            <DollarSign className="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 p-1 rounded-lg print:hidden" size={24} />
            Financial Overview
         </h2>
         <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4">
            <SummaryCard 
              title="Total Budget" 
              value={formatCurrency(financials.totalBudget)} 
              icon={Wallet} 
              color="blue" 
            />
            <SummaryCard 
              title="Total Spent" 
              value={formatCurrency(financials.totalSpent)} 
              icon={TrendingDown} 
              color="orange" 
            />
             <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 print:shadow-none print:border-slate-300 print:bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 print:text-slate-600">Variance</p>
                  <h3 className={`text-3xl font-bold ${financials.variance >= 0 ? 'text-emerald-600 dark:text-emerald-400 print:text-emerald-700' : 'text-red-600 dark:text-red-400 print:text-red-700'}`}>
                    {formatCurrency(financials.variance)}
                  </h3>
                </div>
                <div className={`p-3 rounded-xl ${financials.variance >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'} print:bg-transparent`}>
                  <TrendingUp size={22} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                 <span className={`w-2 h-2 rounded-full ${financials.variance >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                 {financials.variance >= 0 ? 'Under Budget (Good)' : 'Over Budget (Attention)'}
              </div>
            </div>
         </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:grid-cols-3 print:gap-4">
        {/* Donut Chart Section */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm p-8 transition-colors duration-300 flex flex-col justify-between print:shadow-none print:border-slate-300 print:bg-white print:col-span-2">
          <div className="flex items-center justify-between mb-6">
             <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 print:text-black">
                <PieChart size={24} className="text-indigo-500 print:text-black" />
                Project Status
             </h2>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-around gap-12 h-full">
             <DonutChart 
                data={chartData} 
                total={stats.total} 
                onNavigate={(status) => onNavigate && onNavigate('kanban', status)}
             />
             
             {/* Legend */}
             <div className="grid grid-cols-1 gap-4 w-full max-w-xs">
                {chartData.map((segment, idx) => (
                   <div 
                    key={idx} 
                    onClick={() => onNavigate && onNavigate('kanban', segment.label)}
                    className="flex items-center justify-between group p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-indigo-100 dark:hover:border-slate-600 print:p-1"
                   >
                      <div className="flex items-center gap-3">
                         <div className={`w-4 h-4 rounded-full shadow-sm ${segment.colorClass.replace('text-', 'bg-')} print:print-color-adjust-exact`}></div>
                         <span className="font-semibold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors print:text-black">{segment.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                         <span className="font-bold text-slate-900 dark:text-white print:text-black">{segment.value}</span>
                         <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md w-12 text-center print:border print:border-slate-200">
                            {stats.total > 0 ? Math.round((segment.value / stats.total) * 100) : 0}%
                         </span>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        </div>

        {/* Upcoming Deadlines (New) */}
        <div className="lg:col-span-1 print:col-span-1">
          <UpcomingDeadlines tasks={tasks} onTaskClick={onTaskClick} onStatusChange={onStatusChange} columns={columns} />
        </div>
      </div>

      {/* Row 3: Activity Stream and Sticky Note */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:block">
        
        {/* Rich Activity Timeline */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden transition-all duration-300 flex flex-col print:shadow-none print:border-slate-300 print:bg-white print:break-inside-avoid">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20 print:bg-white">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded text-indigo-600 dark:text-indigo-400 print:hidden">
                    <Clock size={18} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white print:text-black">Recent Activity</h2>
            </div>
            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors print:hidden">
                <MoreHorizontal size={20} />
            </button>
            </div>
            
            <div className="p-6 max-h-[500px] overflow-y-auto custom-scrollbar print:max-h-none print:overflow-visible">
            <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-8">
                {processedActivities.map((item: any) => {
                    if (!item) return null;
                    let Icon = Clock;
                    let iconBg = 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
                    let borderColor = 'border-slate-100 dark:border-slate-700';

                    if (item.type === 'comment') {
                        Icon = MessageSquare;
                        iconBg = 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
                        borderColor = 'border-blue-100 dark:border-blue-900/30';
                    } else if (item.type === 'status_change' || (item.action && (item.action.includes('Done') || item.action.includes('completed')))) {
                        Icon = CheckCircle2;
                        iconBg = 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400';
                        borderColor = 'border-emerald-100 dark:border-emerald-900/30';
                    } else if (item.type === 'create') {
                        Icon = Plus;
                        iconBg = 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400';
                        borderColor = 'border-indigo-100 dark:border-indigo-900/30';
                    } else if (item.type === 'attachment') {
                        Icon = Paperclip;
                        iconBg = 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
                        borderColor = 'border-amber-100 dark:border-amber-900/30';
                    } else if (item.type === 'priority_change' || item.type === 'alert') {
                        Icon = AlertTriangle;
                        iconBg = 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
                        borderColor = 'border-red-100 dark:border-red-900/30';
                    } else if (item.type === 'move') {
                        Icon = MoveRight;
                        iconBg = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
                    }

                    return (
                        <div 
                            key={item.id} 
                            onClick={() => item.task && onTaskClick && onTaskClick(item.task)}
                            className={`relative pl-6 group hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 -ml-2 rounded-lg transition-colors print:break-inside-avoid ${item.task ? 'cursor-pointer' : ''}`}
                        >
                        {/* Node Icon */}
                        <div className={`absolute -left-[25px] top-2 w-8 h-8 rounded-full border-4 border-white dark:border-slate-800 flex items-center justify-center shadow-sm z-10 ${iconBg} print:border-slate-200`}>
                            <Icon size={14} strokeWidth={2.5} />
                        </div>

                        <div className="flex flex-col gap-1">
                            {/* Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                                <div className="text-sm text-slate-900 dark:text-white leading-snug print:text-black">
                                    <span className="font-bold hover:underline">{item.userName || 'System'}</span> 
                                    <span className="text-slate-500 dark:text-slate-400 mx-1.5">{item.action}</span>
                                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors print:text-black">{item.taskTitle}</span>
                                </div>
                                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-700/50 print:border-slate-300">
                                    {formatSmartTime(item.timestamp)}
                                </span>
                            </div>
                            
                            {/* Sub-Header: Project Badge */}
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase tracking-wide max-w-[150px] truncate print:border print:border-slate-200">
                                    {item.projectName}
                                </span>
                            </div>

                            {/* Context Preview */}
                            {item.details && (
                                <div className={`mt-2 p-3 rounded-lg border ${borderColor} bg-slate-50/50 dark:bg-slate-800/50 text-sm transition-colors group-hover:bg-white dark:group-hover:bg-slate-700 print:bg-white print:border-slate-200`}>
                                    {item.type === 'comment' ? (
                                        <p className="text-slate-600 dark:text-slate-300 italic text-xs leading-relaxed">
                                            "{item.details.length > 80 ? item.details.substring(0, 80) + '...' : item.details}"
                                        </p>
                                    ) : item.type === 'attachment' ? (
                                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 print:text-black">
                                            <FileText size={14} />
                                            {item.details}
                                            <ArrowRight size={12} className="ml-auto opacity-50" />
                                        </div>
                                    ) : (
                                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                            {item.details}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                        </div>
                    );
                })}
            </div>
            
            {processedActivities.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <Clock size={48} className="mx-auto mb-3 opacity-20" />
                    <p>No recent activity.</p>
                </div>
            )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 print:hidden">
            <button className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 w-full text-center transition-colors py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl">
                View Full History
            </button>
            </div>
        </div>

        {/* Sticky Note Widget */}
        <div className="lg:col-span-1 print:hidden">
          <StickyNote />
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
