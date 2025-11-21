
import React, { useState, useEffect, useRef } from 'react';
import { Clock, Plus, CheckSquare, DollarSign, Paperclip, MessageSquare, MoreHorizontal, X, Eye, Layout, Check } from 'lucide-react';
import { Task, TaskStatus, KanbanColumn as IKanbanColumn } from '../types';

interface KanbanBoardProps {
  tasks: Task[];
  columns: IKanbanColumn[];
  onAddTask: () => void;
  onDropTask: (taskId: string, newStatus: TaskStatus) => void;
  onTaskClick: (task: Task) => void;
  onAddColumn?: (title: string, color: string) => void;
}

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onDragStart, onDragEnd, isDragging }) => {
  const priorityStyles = {
    High: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
    Medium: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    Low: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
  };

  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'Done';
  
  const subtasks = task.subtasks || [];
  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter(st => st.completed).length;
  const progress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;
  
  const attachmentCount = task.attachments?.length || 0;
  const commentCount = task.comments?.length || 0;

  return (
    <div 
      draggable={true}
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`
        bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group relative select-none flex flex-col justify-between min-h-[140px]
        ${isDragging ? 'opacity-60 rotate-2 scale-95 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : 'hover:-translate-y-1'}
      `}
    >
      {/* Top Section: Content Wrapper */}
      <div>
        {/* Header: Tags & Priority */}
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex flex-wrap gap-1.5 flex-1">
             {task.tags && task.tags.length > 0 ? (
                task.tags.map(tag => (
                  <span key={tag.id} className={`px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide ${tag.colorClass}`}>
                    {tag.name}
                  </span>
                ))
             ) : (
               <span className="h-4"></span> // Spacer to maintain height if no tags
             )}
          </div>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${priorityStyles[task.priority]}`}>
            {task.priority}
          </span>
        </div>

        {/* Title */}
        <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 text-sm leading-relaxed text-left line-clamp-3 mt-0">
          {task.title}
        </h4>
        
        {/* Progress Bar */}
        {totalSubtasks > 0 && (
          <div className="mb-3 group/progress">
            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
              <div className="flex items-center gap-1">
                 <CheckSquare size={10} />
                 <span>{Math.round(progress)}%</span>
              </div>
              <span>{completedSubtasks}/{totalSubtasks}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${completedSubtasks === totalSubtasks ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer: Meta Data */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-50 dark:border-slate-700/50 mt-auto">
        <div className="flex items-center gap-2">
          {/* Assignee Avatar */}
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-[10px] font-bold shadow-sm ring-2 ring-white dark:ring-slate-800 overflow-hidden">
            {task.assigneeAvatar && task.assigneeAvatar.startsWith('http') ? (
              <img src={task.assigneeAvatar} alt={task.assignee} className="w-full h-full object-cover" />
            ) : (
              // Fallback to initials if no avatar URL
              task.assignee === 'Unassigned' || task.assignee === 'UN' ? 'UN' : task.assignee.substring(0, 2).toUpperCase()
            )}
          </div>
          
          {/* Meta Icons */}
          {(attachmentCount > 0 || commentCount > 0) && (
             <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-[10px]">
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
        
        {/* Date or Cost */}
        <div className="flex items-center gap-2">
           {task.estimatedCost && task.estimatedCost > 0 && (
             <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
               ${task.estimatedCost.toLocaleString()}
             </div>
           )}
           <div className={`flex items-center gap-1 text-[10px] font-medium ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
             <Clock size={12} />
             <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
           </div>
        </div>
      </div>
    </div>
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
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ 
  column, 
  tasks, 
  onAddTask, 
  onTaskClick, 
  draggedTaskId,
  onDragStart,
  onDragEnd,
  onDropTask
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const getColorStyles = (color: string) => {
     const map: Record<string, any> = {
         slate: { bg: 'bg-slate-50 dark:bg-slate-900/20', border: 'border-slate-400', text: 'text-slate-700 dark:text-slate-200' },
         blue: { bg: 'bg-blue-50/50 dark:bg-blue-900/10', border: 'border-blue-500', text: 'text-blue-700 dark:text-blue-200' },
         emerald: { bg: 'bg-emerald-50/50 dark:bg-emerald-900/10', border: 'border-emerald-500', text: 'text-emerald-700 dark:text-emerald-200' },
         indigo: { bg: 'bg-indigo-50/50 dark:bg-indigo-900/10', border: 'border-indigo-500', text: 'text-indigo-700 dark:text-indigo-200' },
         purple: { bg: 'bg-purple-50/50 dark:bg-purple-900/10', border: 'border-purple-500', text: 'text-purple-700 dark:text-purple-200' },
         rose: { bg: 'bg-rose-50/50 dark:bg-rose-900/10', border: 'border-rose-500', text: 'text-rose-700 dark:text-rose-200' },
         amber: { bg: 'bg-amber-50/50 dark:bg-amber-900/10', border: 'border-amber-500', text: 'text-amber-700 dark:text-amber-200' },
     };
     return map[color] || map['slate'];
  };

  const styles = getColorStyles(column.color);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); if (draggedTaskId) setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = (e: React.DragEvent) => { 
      e.preventDefault(); 
      setIsDragOver(false); 
      if (draggedTaskId) onDropTask(draggedTaskId, column.title); 
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        flex-1 min-w-[320px] rounded-2xl p-4 flex flex-col h-full transition-all duration-300 border-t-4
        ${styles.bg} ${styles.border}
        ${isDragOver ? 'bg-opacity-100 ring-2 ring-indigo-400/50 shadow-xl scale-[1.01]' : 'border border-slate-100 dark:border-slate-800'}
      `}
    >
      <div className="flex items-center justify-between mb-5 px-1">
        <div className="flex items-center gap-2">
          <h3 className={`font-bold text-lg tracking-tight ${styles.text}`}>{column.title}</h3>
          <span className="bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-full text-xs font-bold text-slate-500 dark:text-slate-400 shadow-sm border border-slate-100 dark:border-slate-700">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
           <button 
             onClick={onAddTask}
             className={`p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-indigo-600`}
           >
             <Plus size={18} />
           </button>
        </div>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar pb-4">
        {tasks.map(task => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => onTaskClick(task)}
            isDragging={draggedTaskId === task.id}
          />
        ))}
        {tasks.length === 0 && (
          <div className={`
            h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-all
            ${isDragOver ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700/50'}
          `}>
            <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center">
              <Plus size={20} className="text-slate-300 dark:text-slate-600" />
            </div>
            <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
               {isDragOver ? 'Drop item here' : 'No tasks'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const HIDDEN_COLUMNS_KEY = 'promanage_hidden_columns_v1';

const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, columns, onAddTask, onDropTask, onTaskClick, onAddColumn }) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  
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

  // Close dropdown when clicking outside
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
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragEnd = () => setDraggedTaskId(null);

  const handleAddSubmit = () => {
    if (newColumnTitle.trim() && onAddColumn) {
      onAddColumn(newColumnTitle.trim(), 'slate');
      setNewColumnTitle('');
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
    <div className="h-full flex flex-col animate-fade-in relative">
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
                                // Prevent hiding the last visible column
                                const isDisabled = isVisible && (columns.length - hiddenColumns.length) <= 1;

                                return (
                                    <button
                                        key={col.id}
                                        onClick={() => !isDisabled && toggleColumnVisibility(col.id)}
                                        disabled={isDisabled}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'}`}
                                    >
                                        <span className={`font-medium ${isVisible ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>{col.title}</span>
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

            <button 
                onClick={onAddTask}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 font-semibold text-sm shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
            >
                <Plus size={18} strokeWidth={2.5} />
                Create Task
            </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-x-auto custom-scrollbar pb-2">
        <div className="flex gap-6 h-full min-w-max px-1">
          {columns.map(col => {
            // Filter Logic: Don't render hidden columns
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
                />
            );
          })}

          {/* Add New Column Section */}
          {onAddColumn && (
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
