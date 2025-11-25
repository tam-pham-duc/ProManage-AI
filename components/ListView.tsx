
import React, { useState, useMemo } from 'react';
import { Task } from '../types';
import { ArrowUp, ArrowDown, Edit3, Trash2, ChevronsUpDown, User } from 'lucide-react';
import { getAvatarInitials, getAvatarColor } from '../utils/avatarUtils';

interface ListViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

type SortKey = 'title' | 'status' | 'priority' | 'dueDate' | 'estimatedCost';

export const ListView: React.FC<ListViewProps> = ({ tasks, onTaskClick, onDeleteTask }) => {
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'dueDate',
    direction: 'asc'
  });

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === bValue) return 0;
      
      let comparison = 0;
      
      // Handle specific types
      if (sortConfig.key === 'estimatedCost') {
         comparison = (Number(aValue) || 0) - (Number(bValue) || 0);
      } else if (sortConfig.key === 'dueDate') {
         comparison = new Date(aValue as string).getTime() - new Date(bValue as string).getTime();
      } else {
         // String comparison
         comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [tasks, sortConfig]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Done': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'In Progress': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'text-red-600 dark:text-red-400';
      case 'Medium': return 'text-amber-600 dark:text-amber-400';
      case 'Low': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-slate-600 dark:text-slate-400';
    }
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const renderHeader = (key: SortKey, label: string, className = "") => (
    <th 
      className={`px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors select-none group ${className}`}
      onClick={() => handleSort(key)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        <span className="text-slate-400 dark:text-slate-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400">
          {sortConfig.key === key ? (
            sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
          ) : (
            <ChevronsUpDown size={12} />
          )}
        </span>
      </div>
    </th>
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-full animate-fade-in">
       
       {/* Table Container */}
       <div className="overflow-x-auto flex-1 custom-scrollbar">
         <table className="w-full text-left border-collapse min-w-[800px]">
           <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 shadow-sm">
             <tr>
               {renderHeader('title', 'Task Name', 'w-1/3')}
               {renderHeader('status', 'Status')}
               {renderHeader('priority', 'Priority')}
               <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assignee</th>
               {renderHeader('dueDate', 'Due Date')}
               {renderHeader('estimatedCost', 'Est. Cost', 'text-right')}
               <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
             {sortedTasks.map(task => {
               // SAFETY GUARD: Check for valid task to prevent crash
               if (!task) return null;

               return (
                 <tr 
                   key={task.id} 
                   onClick={() => onTaskClick(task)} 
                   className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors group"
                 >
                   <td className="px-6 py-4">
                     <span className="font-bold text-slate-800 dark:text-white text-sm">{task.title}</span>
                   </td>
                   
                   <td className="px-6 py-4">
                     <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                       {task.status}
                     </span>
                   </td>
                   
                   <td className="px-6 py-4">
                     <span className={`text-xs font-bold ${getPriorityColor(task.priority)}`}>
                       {task.priority}
                     </span>
                   </td>
                   
                   <td className="px-6 py-4">
                     <div className="flex items-center gap-2">
                       <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden ${task.assigneeAvatar && task.assigneeAvatar.startsWith('http') ? '' : getAvatarColor(task.assignee)}`}>
                         {task.assigneeAvatar && task.assigneeAvatar.startsWith('http') ? (
                           <img src={task.assigneeAvatar} alt={task.assignee} className="w-full h-full object-cover" />
                         ) : (
                           getAvatarInitials(task.assignee)
                         )}
                       </div>
                       <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                         {task.assignee === 'Unassigned' || task.assignee === 'UN' ? 'Unassigned' : task.assignee}
                       </span>
                     </div>
                   </td>
                   
                   <td className="px-6 py-4">
                     <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                       {new Date(task.dueDate).toLocaleDateString()}
                     </span>
                   </td>
                   
                   <td className="px-6 py-4 text-right">
                     <span className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                       {formatCurrency(task.estimatedCost)}
                     </span>
                   </td>
                   
                   <td className="px-6 py-4 text-right">
                     <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button 
                          onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          title="Edit Task"
                       >
                         <Edit3 size={16} />
                       </button>
                       <button 
                          onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete Task"
                       >
                         <Trash2 size={16} />
                       </button>
                     </div>
                   </td>
                 </tr>
               );
             })}
             
             {sortedTasks.length === 0 && (
               <tr>
                 <td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                   No tasks found.
                 </td>
               </tr>
             )}
           </tbody>
         </table>
       </div>
       
       <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Showing {sortedTasks.length} tasks
          </span>
       </div>
    </div>
  );
};
