import React, { useState, useEffect, useRef } from 'react';
import { Clock, Plus, CheckSquare, DollarSign, Paperclip, MessageSquare, MoreHorizontal, X, Eye, Layout, Check, AlertCircle, AlarmClock, Hourglass, Ban, Play, Square, Timer, Trash2, Edit2, Palette } from 'lucide-react';
import { motion } from 'framer-motion';
import { Task, TaskStatus, KanbanColumn as IKanbanColumn } from '../types';
import { useTimeTracking } from '../context/TimeTrackingContext';
import { getAvatarInitials, getAvatarColor } from '../utils/avatarUtils';

interface KanbanBoardProps {
  tasks: Task[];
  columns: IKanbanColumn[];
  onAddTask: () => void;
  onDropTask: (taskId: string, newStatus: TaskStatus) => void;
  onTaskClick: (task: Task) => void;
  onAddColumn?: (title: string, color: string) => void;
  onEditColumn?: (columnId: string, title: string, color: string) => void;
  onDeleteColumn?: (columnId: string) => void;
  isReadOnly?: boolean;
  allTasks?: Task[];
  onDeleteTask?: (taskId: string) => void;
}

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isReadOnly?: boolean;
  allTasks?: Task[];
  onDelete?: (taskId: string) => void;
}

const COLOR_OPTIONS = [
    { name: 'slate', class: 'bg-slate-500' },
    { name: 'blue', class: 'bg-blue-500' },
    { name: 'emerald', class: 'bg-emerald-500' },
    { name: 'indigo', class: 'bg-indigo-500' },
    { name: 'purple', class: 'bg-purple-500' },
    { name: 'rose', class: 'bg-rose-500' },
    { name: 'amber', class: 'bg-amber-500' },
    { name: 'cyan', class: 'bg-cyan-500' },
];

const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onDragStart, onDragEnd, isDragging, isReadOnly, allTasks = [], onDelete }) => {
  const { activeTimer, startTimer, stopTimer, formatDuration } = useTimeTracking();
  
  const isActive = activeTimer?.taskId === task.id;

  // --- Flash Effect State ---
  const prevStatusRef = useRef(task.status);
  const [isJustDropped, setIsJustDropped] = useState(false);

  useEffect(() => {
      if (prevStatusRef.current !== task.status) {
          setIsJustDropped(true);
          const timer = setTimeout(() => setIsJustDropped(false), 1000); // 1s flash
          prevStatusRef.current = task.status;
          return () => clearTimeout(timer);
      }
  }, [task.status]);

  // Date Logic
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(task.dueDate);
  const dueDateAtMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  
  // Deadline Calculation
  const getDeadlineStatus = () => {
      if (task.status === 'Done') return null;
      
      const diffTime = dueDateAtMidnight.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return 'overdue';
      if (diffDays === 0) return 'today';
      if (diffDays > 0 && diffDays <= 2) return 'soon';
      return null;
  };

  const deadlineStatus = getDeadlineStatus();
  
  const isOverdue = deadlineStatus === 'overdue';
  const isDueToday = deadlineStatus === 'today';
  
  const subtasks = task.subtasks || [];
  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter(st => st.completed).length;
  const progress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;
  
  const attachmentCount = task.attachments?.length || 0;
  const commentCount = task.comments?.length || 0;

  // Dependency Block Logic
  const isBlocked = React.useMemo(() => {
      if (!task.dependencies || task.dependencies.length === 0) return false;
      if (task.status === 'Done') return false;
      
      // Find if ANY parent task is NOT done
      return task.dependencies.some(depId => {
          const parent = allTasks.find(t => t.id === depId);
          return parent && parent.status !== 'Done';
      });
  }, [task.dependencies, task.status, allTasks]);

  // Get titles of blocking tasks for tooltip
  const blockingTaskTitles = React.useMemo(() => {
     if (!isBlocked || !task.dependencies) return '';
     const titles = task.dependencies
        .map(id => {
            const t = allTasks.find(at => at.id === id);
            if (t && t.status !== 'Done') return t.title;
            return null;
        })
        .filter(Boolean)
        .join(', ');
     return titles;
  }, [isBlocked, task.dependencies, allTasks]);

  // --- STEP 71: Pastel Priority Themes ---
  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'High':
        return {
          container: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 border-l-red-500',
          title: 'text-red-900 dark:text-red-100',
          meta: 'text-red-700 dark:text-red-300'
        };
      case 'Medium':
        return {
          container: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 border-l-amber-500',
          title: 'text-amber-900 dark:text-amber-100',
          meta: 'text-amber-700 dark:text-amber-300'
        };
      case 'Low':
        return {
          container: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 border-l-blue-500',
          title: 'text-blue-900 dark:text-blue-100',
          meta: 'text-blue-700 dark:text-blue-300'
        };
      default:
        return {
          container: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 border-l-slate-400',
          title: 'text-slate-900 dark:text-white',
          meta: 'text-slate-500 dark:text-slate-400'
        };
    }
  };

  const theme = getPriorityStyles(task.priority);

  // Overdue/Today overrides
  let statusIndicatorClass = "";
  if (isOverdue) {
      statusIndicatorClass = "ring-2 ring-red-500 ring-offset-1 dark:ring-offset-slate-900";
  } else if (isDueToday) {
      statusIndicatorClass = "ring-2 ring-amber-500 ring-offset-1 dark:ring-offset-slate-900";
  }

  const handleTimerClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isActive) {
          stopTimer();
      } else {
          startTimer(task);
      }
  };

  // Fix for ghost card: Use class based opacity instead of inline styles for cleaner reset
  const dragClass = isDragging ? 'opacity-50 cursor-grabbing' : 'opacity-100 cursor-pointer hover:shadow-md hover:z-10';

  return (
    <motion.div 
      layout
      layoutId={task.id}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      draggable={!isReadOnly && !isBlocked}
      onDragStart={(e) => !isReadOnly && !isBlocked && onDragStart(e as unknown as React.DragEvent, task.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`
        p-4 rounded-xl border-y border-r border-l-[4px] shadow-sm transition-shadow duration-200 group relative select-none flex flex-col justify-between min-h-[120px]
        ${dragClass}
        ${isBlocked 
            ? 'bg-stripes-gray border-slate-300 dark:border-slate-600 opacity-90 border-l-slate-500' 
            : theme.container}
        ${statusIndicatorClass}
        ${isReadOnly ? 'cursor-default' : ''}
        ${isJustDropped ? 'ring-2 ring-yellow-400 ring-offset-2 shadow-[0_0_15px_rgba(250,204,21,0.5)] z-20' : ''}
      `}
      title={isBlocked ? `Blocked by: ${blockingTaskTitles}` : ''}
    >
      {/* Quick Delete Button */}
      {!isReadOnly && onDelete && !isDragging && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="absolute top-2 right-2 z-30 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-full text-slate-500 hover:bg-red-500 hover:text-white shadow-sm bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm transform scale-90 hover:scale-100"
            title="Quick Delete"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
      )}

      {/* Blocked Overlay / Icon with Tooltip */}
      {isBlocked && !isDragging && (
          <div className="absolute -top-2 -right-2 z-30 group/blocked">
              <div className="bg-white dark:bg-slate-800 rounded-full p-1.5 shadow-md border border-red-200 dark:border-red-900 cursor-help transition-transform hover:scale-110 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Ban size={16} className="text-red-500" />
              </div>
              
              {/* Detailed Tooltip */}
              <div className="absolute right-0 top-8 w-64 p-3 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/50 rounded-xl shadow-xl opacity-0 invisible group-hover/blocked:opacity-100 group-hover/blocked:visible transition-all duration-200 z-50 pointer-events-none translate-y-2 group-hover/blocked:translate-y-0 text-left">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                      <Ban size={14} className="text-red-500" />
                      <span className="text-xs font-bold text-red-600 dark:text-red-400">
                          Blocked by {task.dependencies?.filter(id => allTasks.find(t => t.id === id && t.status !== 'Done')).length} task(s)
                      </span>
                  </div>
                  <ul className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                      {task.dependencies?.map(depId => {
                          const parent = allTasks.find(t => t.id === depId);
                          if (parent && parent.status !== 'Done') {
                               return (
                                  <li key={depId} className="flex items-start gap-2 text-xs">
                                      <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                                          parent.status === 'In Progress' ? 'bg-blue-500' : 'bg-slate-400'
                                      }`}></div>
                                      <div>
                                          <p className="font-semibold text-slate-700 dark:text-slate-200 line-clamp-2">{parent.title}</p>
                                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{parent.status} • {parent.assignee}</p>
                                      </div>
                                  </li>
                               );
                          }
                          return null;
                      })}
                  </ul>
                   <div className="absolute top-[-5px] right-3 w-2.5 h-2.5 bg-white dark:bg-slate-800 border-t border-l border-red-100 dark:border-red-900/50 transform rotate-45"></div>
              </div>
          </div>
      )}

      {/* Content Wrapper */}
      <div className={isBlocked ? 'opacity-60 grayscale-[0.5]' : ''}>
        {/* Row 1: Title & Priority */}
        <div className="flex justify-between items-start gap-2 mb-2">
            <h4 className={`flex-1 font-bold text-base leading-snug text-left line-clamp-3 ${theme.title}`}>
              {task.title}
            </h4>
            
            <div className="flex items-center gap-2 shrink-0">
                {deadlineStatus === 'overdue' && (
                    <AlertCircle size={16} className="text-red-500 animate-pulse" title="Overdue!" />
                )}
                {deadlineStatus === 'today' && (
                    <AlarmClock size={16} className="text-amber-500" title="Due Today" />
                )}
                {deadlineStatus === 'soon' && (
                    <Hourglass size={16} className="text-blue-500" title="Due Soon" />
                )}

                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-lg border border-black/5 dark:border-white/10 bg-white/60 dark:bg-black/20 ${theme.meta}`}>
                  {task.priority}
                </span>
            </div>
        </div>

        {/* Row 2: Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
            {task.tags && task.tags.length > 0 ? (
            task.tags.map(tag => (
                <span key={tag.id} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${tag.colorClass} border border-black/5 dark:border-white/5`}>
                {tag.name}
                </span>
            ))
            ) : (
                <div className="h-1"></div>
            )}
        </div>
        
        {/* Progress Bar */}
        {totalSubtasks > 0 && (
          <div className="mb-3 group/progress">
            <div className={`flex items-center justify-between text-[10px] mb-1 font-medium opacity-80 ${theme.meta}`}>
              <div className="flex items-center gap-1">
                 <CheckSquare size={10} />
                 <span>{Math.round(progress)}%</span>
              </div>
              <span>{completedSubtasks}/{totalSubtasks}</span>
            </div>
            <div className="h-1.5 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${completedSubtasks === totalSubtasks ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Row 3: Footer */}
      <div className={`flex items-center justify-between pt-3 border-t border-black/5 dark:border-white/5 mt-auto ${theme.meta} ${isBlocked ? 'opacity-60' : ''}`}>
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ring-1 ring-black/10 dark:ring-white/10 overflow-hidden ${task.assigneeAvatar && task.assigneeAvatar.startsWith('http') ? '' : getAvatarColor(task.assignee)}`}>
            {task.assigneeAvatar && task.assigneeAvatar.startsWith('http') ? (
              <img src={task.assigneeAvatar} alt={task.assignee} className="w-full h-full object-cover" />
            ) : (
              getAvatarInitials(task.assignee)
            )}
          </div>
          
          {(attachmentCount > 0 || commentCount > 0) && (
             <div className="flex items-center gap-2 text-[10px] font-medium opacity-70">
                {attachmentCount > 0 && (
                   <div className="flex items-center gap-0.5">
                      <Paperclip size={10} />
                      <span>{attachmentCount}</span>
                   </div>
                )}
                {commentCount > 0 && (
                   <div className="flex items-center gap-0.5">
                      <MessageSquare size={10} />
                      <span>{commentCount}</span>
                   </div>
                )}
             </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
           {!isReadOnly && (
               <button
                  onClick={handleTimerClick}
                  className={`p-1 rounded-md transition-colors flex items-center gap-1 text-[10px] font-bold border
                    ${isActive 
                        ? 'bg-red-100 text-red-600 border-red-200 animate-pulse' 
                        : 'bg-white/50 hover:bg-white text-slate-500 border-transparent hover:border-slate-200 hover:text-indigo-600'
                    }
                  `}
                  title={isActive ? "Stop Timer" : "Start Timer"}
               >
                   {isActive ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                   {(isActive || (task.totalTimeSeconds || 0) > 0) && (
                       <span>{isActive ? 'REC' : formatDuration(task.totalTimeSeconds || 0)}</span>
                   )}
               </button>
           )}

           <div className={`flex items-center gap-1 text-[10px] font-bold ${isOverdue ? 'text-red-600 dark:text-red-400 animate-pulse' : isDueToday ? 'text-amber-600 dark:text-amber-400' : 'opacity-80'}`}>
             {isOverdue ? <AlertCircle size={12} /> : <Clock size={12} />}
             <span>
                {isDueToday ? 'Today' : new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
             </span>
           </div>
        </div>
      </div>
      <style>{`
        .bg-stripes-gray {
            background-color: #f3f4f6;
            background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, #e5e7eb 10px, #e5e7eb 20px);
        }
        .dark .bg-stripes-gray {
            background-color: #1e293b;
            background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, #334155 10px, #334155 20px);
        }
      `}</style>
    </motion.div>
  );
};

interface KanbanColumnProps {
  column: IKanbanColumn;
  tasks: Task[];
  onAddTask: () => void;
  onTaskClick: (task: Task) => void;
  draggedTaskId: string | null;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  onDropTask: (taskId: string, newStatus: TaskStatus) => void;
  isReadOnly?: boolean;
  allTasks?: Task[];
  onDeleteTask?: (taskId: string) => void;
  onEditColumn?: (columnId: string, title: string, color: string) => void;
  onDeleteColumn?: (columnId: string) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ 
  column, 
  tasks, 
  onAddTask, 
  onTaskClick, 
  draggedTaskId,
  onDragStart, 
  onDragEnd,
  onDropTask,
  isReadOnly,
  allTasks = [],
  onDeleteTask,
  onEditColumn,
  onDeleteColumn
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title);
  const [editColor, setEditColor] = useState(column.color);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
              setShowMenu(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Helper: Theme Generator ---
  const getColumnTheme = (title: string, assignedColor?: string) => {
    // Priority to assigned color if available and not default slate (unless title suggests otherwise but we want user choice to rule)
    let mode = assignedColor || 'slate';

    // If no assigned color, use heuristics (backward compatibility)
    if (!assignedColor) {
        const t = title.toLowerCase();
        if (t.includes('done') || t.includes('complete') || t.includes('closed')) mode = 'emerald';
        else if (t.includes('progress') || t.includes('active') || t.includes('doing')) mode = 'blue';
        else if (t.includes('review') || t.includes('qa') || t.includes('test')) mode = 'purple';
        else if (t.includes('hold') || t.includes('block') || t.includes('wait')) mode = 'rose';
        else if (t.includes('todo') || t.includes('to do') || t.includes('open') || t.includes('backlog')) mode = 'slate';
        else mode = 'cyan';
    }

    switch (mode) {
        case 'blue':
        case 'indigo':
            return {
                container: 'border-blue-500 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/10',
                header: 'text-blue-900 dark:text-blue-100',
                badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                addButton: 'hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-400 hover:text-blue-600',
                ring: 'ring-blue-400/50'
            };
        case 'emerald':
        case 'green':
            return {
                container: 'border-emerald-500 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10',
                header: 'text-emerald-900 dark:text-emerald-100',
                badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
                addButton: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-400 hover:text-emerald-600',
                ring: 'ring-emerald-400/50'
            };
        case 'purple':
        case 'violet':
            return {
                container: 'border-purple-500 dark:border-purple-500 bg-purple-50/50 dark:bg-purple-900/10',
                header: 'text-purple-900 dark:text-purple-100',
                badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
                addButton: 'hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-400 hover:text-purple-600',
                ring: 'ring-purple-400/50'
            };
        case 'rose':
        case 'red':
            return {
                container: 'border-rose-500 dark:border-rose-500 bg-rose-50/50 dark:bg-rose-900/10',
                header: 'text-rose-900 dark:text-rose-100',
                badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
                addButton: 'hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-400 hover:text-rose-600',
                ring: 'ring-rose-400/50'
            };
        case 'amber':
        case 'orange':
             return {
                container: 'border-amber-500 dark:border-amber-500 bg-amber-50/50 dark:bg-amber-900/10',
                header: 'text-amber-900 dark:text-amber-100',
                badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                addButton: 'hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-400 hover:text-amber-600',
                ring: 'ring-amber-400/50'
            };
        case 'cyan':
        case 'teal':
            return {
                container: 'border-cyan-500 dark:border-cyan-500 bg-cyan-50/50 dark:bg-cyan-900/10',
                header: 'text-cyan-900 dark:text-cyan-100',
                badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
                addButton: 'hover:bg-cyan-100 dark:hover:bg-cyan-900/30 text-cyan-400 hover:text-cyan-600',
                ring: 'ring-cyan-400/50'
            };
        case 'slate':
        default:
            return {
                container: 'border-slate-400 dark:border-slate-500 bg-slate-50/80 dark:bg-slate-900/30',
                header: 'text-slate-700 dark:text-slate-300',
                badge: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                addButton: 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600',
                ring: 'ring-slate-400/50'
            };
    }
  };

  const theme = getColumnTheme(column.title, column.color);

  const handleDragOver = (e: React.DragEvent) => {
      if (isReadOnly) return;
      e.preventDefault();
  };
  
  const handleDragEnter = (e: React.DragEvent) => { 
      if (isReadOnly) return;
      e.preventDefault(); 
      if (draggedTaskId) setIsDragOver(true); 
  };
  
  const handleDragLeave = (e: React.DragEvent) => { 
      if (isReadOnly) return;
      e.preventDefault(); 
      setIsDragOver(false); 
  };
  
  const handleDrop = (e: React.DragEvent) => { 
      if (isReadOnly) return;
      e.preventDefault(); 
      setIsDragOver(false); 
      if (draggedTaskId) {
          onDropTask(draggedTaskId, column.title);
          onDragEnd();
      } 
  };

  const handleSaveEdit = () => {
      if (onEditColumn && editTitle.trim()) {
          onEditColumn(column.id, editTitle.trim(), editColor);
          setIsEditing(false);
      }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        flex-1 min-w-[320px] rounded-2xl p-4 flex flex-col h-full transition-all duration-300 border-t-4 border-x border-b border-x-transparent border-b-transparent relative
        ${theme.container}
        ${isDragOver ? `bg-opacity-100 ring-2 ${theme.ring} shadow-xl scale-[1.01]` : ''}
      `}
    >
      {isEditing ? (
          <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <input 
                  type="text" 
                  value={editTitle} 
                  onChange={(e) => setEditTitle(e.target.value)} 
                  className="w-full text-sm font-bold mb-2 bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none text-slate-900 dark:text-white pb-1"
                  autoFocus
              />
              <div className="flex gap-1 mb-3 flex-wrap">
                  {COLOR_OPTIONS.map(c => (
                      <button 
                          key={c.name}
                          onClick={() => setEditColor(c.name)}
                          className={`w-4 h-4 rounded-full ${c.class} ${editColor === c.name ? 'ring-2 ring-offset-1 ring-slate-400 dark:ring-offset-slate-900' : 'opacity-70 hover:opacity-100'}`}
                      />
                  ))}
              </div>
              <div className="flex gap-2">
                  <button onClick={handleSaveEdit} className="flex-1 bg-indigo-600 text-white text-xs py-1.5 rounded hover:bg-indigo-700">Save</button>
                  <button onClick={() => setIsEditing(false)} className="px-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded hover:bg-slate-200 dark:hover:bg-slate-600">Cancel</button>
              </div>
          </div>
      ) : (
        <div className="flex items-center justify-between mb-5 px-1 relative">
            <div className="flex items-center gap-2">
            <h3 className={`font-bold text-lg tracking-tight ${theme.header}`}>{column.title}</h3>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm ${theme.badge}`}>
                {tasks.length}
            </span>
            </div>
            <div className="flex items-center gap-1">
            {!isReadOnly && (
                <>
                    <button 
                        onClick={onAddTask}
                        className={`p-1.5 rounded-lg transition-colors ${theme.addButton}`}
                    >
                        <Plus size={18} />
                    </button>
                    
                    <div className="relative" ref={menuRef}>
                        <button 
                            onClick={() => setShowMenu(!showMenu)}
                            className={`p-1.5 rounded-lg transition-colors ${theme.addButton}`}
                        >
                            <MoreHorizontal size={18} />
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-fade-in">
                                <button 
                                    onClick={() => { setIsEditing(true); setShowMenu(false); }}
                                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                                >
                                    <Edit2 size={12} /> Edit Column
                                </button>
                                {onDeleteColumn && (
                                    <button 
                                        onClick={() => { onDeleteColumn && onDeleteColumn(column.id); setShowMenu(false); }}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                    >
                                        <Trash2 size={12} /> Delete
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
            </div>
        </div>
      )}

      <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar pb-4">
        {tasks.map(task => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => onTaskClick(task)}
            isDragging={draggedTaskId === task.id}
            isReadOnly={isReadOnly}
            allTasks={allTasks}
            onDelete={onDeleteTask}
          />
        ))}
        {tasks.length === 0 && (
          <div className={`
            h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-all
            ${isDragOver ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-slate-300/50 dark:border-slate-700/50'}
          `}>
            <div className="w-10 h-10 rounded-full bg-white/50 dark:bg-slate-800/50 shadow-sm flex items-center justify-center">
              <Plus size={20} className="text-slate-400 dark:text-slate-600" />
            </div>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-500">
               {isDragOver ? 'Drop item here' : 'No tasks'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const HIDDEN_COLUMNS_KEY = 'promanage_hidden_columns_v1';

const KanbanBoard: React.FC<KanbanBoardProps> = ({ 
    tasks, 
    columns, 
    onAddTask, 
    onDropTask, 
    onTaskClick, 
    onAddColumn, 
    onEditColumn,
    onDeleteColumn,
    isReadOnly = false, 
    allTasks = [], 
    onDeleteTask 
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [newColumnColor, setNewColumnColor] = useState('slate');
  
  // Column Visibility State
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() => {
      try {
          const saved = localStorage.getItem(HIDDEN_COLUMNS_KEY);
          return saved ? JSON.parse(saved) : [];
      } catch (e) {
          return [];
      }
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify(hiddenColumns));
  }, [hiddenColumns]);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
              setShowColumnMenu(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    if (isReadOnly) return;
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    
    // Small delay to ensure the browser creates the drag preview from the un-dimmed element
    setTimeout(() => {
        setDraggedTaskId(taskId);
    }, 0);
  };

  const handleDragEnd = () => {
      setDraggedTaskId(null);
  };

  const handleAddSubmit = () => {
    if (newColumnTitle.trim() && onAddColumn) {
      onAddColumn(newColumnTitle.trim(), newColumnColor);
      setNewColumnTitle('');
      setNewColumnColor('slate');
      setIsAddingColumn(false);
    }
  };

  const toggleColumnVisibility = (columnId: string) => {
      setHiddenColumns(prev => {
          if (prev.includes(columnId)) {
              return prev.filter(id => id !== columnId);
          } else {
              return [...prev, columnId];
          }
      });
  };

  const handleResetVisibility = () => {
      setHiddenColumns([]);
      setShowColumnMenu(false);
  };

  return (
    <div className="h-full flex flex-col animate-fade-in relative z-0">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Kanban Board</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">Drag and drop tasks to update their status.</p>
        </div>
        <div className="flex items-center gap-3">
            {/* Column Visibility Dropdown */}
            <div className="relative" ref={columnMenuRef}>
                <button 
                    onClick={() => setShowColumnMenu(!showColumnMenu)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-bold transition-all shadow-sm
                        ${showColumnMenu || hiddenColumns.length > 0
                            ? 'bg-slate-100 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' 
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }
                    `}
                >
                    <Layout size={18} />
                    <span className="hidden sm:inline">Columns</span>
                    {hiddenColumns.length > 0 && (
                         <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-md text-xs">
                             {columns.length - hiddenColumns.length}/{columns.length}
                         </span>
                    )}
                </button>

                {showColumnMenu && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-fade-in">
                        <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Show Columns</span>
                            {hiddenColumns.length > 0 && (
                                <button onClick={handleResetVisibility} className="text-[10px] font-bold text-indigo-600 hover:underline">Reset</button>
                            )}
                        </div>
                        <div className="p-2 max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                            {columns.map(col => {
                                const isVisible = !hiddenColumns.includes(col.id);
                                const isDisabled = isVisible && (columns.length - hiddenColumns.length) <= 1;

                                return (
                                    <button
                                        key={col.id}
                                        onClick={() => !isDisabled && toggleColumnVisibility(col.id)}
                                        disabled={isDisabled}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full bg-${col.color}-500`}></div>
                                            <span className={`font-medium ${isVisible ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>{col.title}</span>
                                        </div>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isVisible ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-transparent'}`}>
                                            {isVisible && <Check size={14} strokeWidth={3} />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {!isReadOnly && (
                <button 
                    onClick={onAddTask}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 font-semibold text-sm shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                >
                    <Plus size={18} strokeWidth={2.5} />
                    Create Task
                </button>
            )}
        </div>
      </div>
      
      <div className="flex-1 overflow-x-auto custom-scrollbar pb-2">
        <div className="flex gap-6 h-full min-w-max px-1">
          {columns.map(col => {
            if (hiddenColumns.includes(col.id)) return null;

            return (
                <KanbanColumn 
                key={col.id} 
                column={col}
                tasks={tasks.filter(t => t.status === col.title)} 
                onAddTask={onAddTask}
                onTaskClick={onTaskClick}
                draggedTaskId={draggedTaskId}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDropTask={onDropTask}
                isReadOnly={isReadOnly}
                allTasks={allTasks}
                onDeleteTask={onDeleteTask}
                onEditColumn={onEditColumn}
                onDeleteColumn={onDeleteColumn}
                />
            );
          })}

          {/* Add New Column Section */}
          {onAddColumn && !isReadOnly && (
             <div className="w-[320px] flex-shrink-0 h-full rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700/60 flex flex-col p-4">
                {isAddingColumn ? (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 animate-fade-in">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">New Section</h3>
                        <input 
                           autoFocus
                           type="text" 
                           value={newColumnTitle}
                           onChange={(e) => setNewColumnTitle(e.target.value)}
                           placeholder="Section Name"
                           className="w-full px-3 py-2 mb-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                           onKeyDown={(e) => {
                               if (e.key === 'Enter') handleAddSubmit();
                               if (e.key === 'Escape') setIsAddingColumn(false);
                           }}
                        />
                        
                        <div className="flex gap-2 mb-4 flex-wrap">
                            {COLOR_OPTIONS.map(c => (
                                <button 
                                    key={c.name}
                                    onClick={() => setNewColumnColor(c.name)}
                                    className={`w-6 h-6 rounded-full ${c.class} transition-transform hover:scale-110 ${newColumnColor === c.name ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-800' : ''}`}
                                    title={c.name}
                                />
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button 
                                onClick={handleAddSubmit}
                                disabled={!newColumnTitle.trim()}
                                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                            >
                                Add
                            </button>
                            <button 
                                onClick={() => setIsAddingColumn(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={() => setIsAddingColumn(true)}
                        className="w-full h-12 rounded-xl flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                        <Plus size={20} />
                        Add Section
                    </button>
                )}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KanbanBoard;