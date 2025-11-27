
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Task, KanbanColumn, ProjectMember, User, TaskPriority } from '../types';
import { ArrowUp, ArrowDown, Edit3, Trash2, ChevronsUpDown, X, Check, Calendar, User as UserIcon, AlertCircle, Layers } from 'lucide-react';
import { getAvatarInitials, getAvatarColor } from '../utils/avatarUtils';
import { db } from '../firebase';
import { writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { useNotification } from '../context/NotificationContext';

interface ListViewProps {
  tasks: Task[];
  columns: KanbanColumn[];
  projectMembers: ProjectMember[];
  currentUser: User | null;
  onTaskClick: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

type SortKey = 'title' | 'status' | 'priority' | 'dueDate' | 'estimatedCost';

// Helper to safely parse timestamps from various formats
const safeParseDate = (dateInput: any): number => {
    if (!dateInput) return 0;
    try {
        // Firestore Timestamp (object with seconds)
        if (typeof dateInput === 'object' && 'seconds' in dateInput) {
            return dateInput.seconds * 1000;
        }
        // Firestore Timestamp (object with toDate function)
        if (typeof dateInput === 'object' && typeof dateInput.toDate === 'function') {
            return dateInput.toDate().getTime();
        }
        // String or Date object
        const d = new Date(dateInput);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    } catch (e) {
        return 0;
    }
};

export const ListView: React.FC<ListViewProps> = ({ tasks, columns, projectMembers, currentUser, onTaskClick, onDeleteTask }) => {
  const { notify } = useNotification();
  
  // Sort State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'dueDate',
    direction: 'asc'
  });

  // Selection State
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // Bulk Action State Handlers
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [showDateInput, setShowDateInput] = useState(false);

  // Clear selection when tasks change (e.g. switching projects) or verify IDs exist
  useEffect(() => {
      const validIds = new Set<string>();
      tasks.forEach(t => {
          if (selectedTaskIds.has(t.id)) validIds.add(t.id);
      });
      if (validIds.size !== selectedTaskIds.size) {
          setSelectedTaskIds(validIds);
      }
  }, [tasks]);

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedTasks = useMemo(() => {
    // 1. Safety Filter: Remove undefined/null tasks immediately
    const validTasks = (tasks || []).filter(t => t && t.id);

    return validTasks.sort((a, b) => {
      const key = sortConfig.key;
      const direction = sortConfig.direction;

      // Handle numeric cost explicitly
      if (key === 'estimatedCost') {
         const numA = Number(a.estimatedCost) || 0;
         const numB = Number(b.estimatedCost) || 0;
         return direction === 'asc' ? numA - numB : numB - numA;
      } 
      
      // Handle Dates robustly
      if (key === 'dueDate') {
         const dateA = safeParseDate(a.dueDate);
         const dateB = safeParseDate(b.dueDate);
         
         // If dates are equal (both 0 or same), keep stable
         if (dateA === dateB) return 0;
         return direction === 'asc' ? dateA - dateB : dateB - dateA;
      }

      // String comparison (fallback for title, status, priority)
      const valA = a[key];
      const valB = b[key];
      const strA = String(valA || '').toLowerCase();
      const strB = String(valB || '').toLowerCase();

      if (strA < strB) return direction === 'asc' ? -1 : 1;
      if (strA > strB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tasks, sortConfig]);

  // --- Selection Handlers ---

  const handleSelectAll = () => {
      if (selectedTaskIds.size === sortedTasks.length && sortedTasks.length > 0) {
          setSelectedTaskIds(new Set());
      } else {
          setSelectedTaskIds(new Set(sortedTasks.map(t => t.id)));
      }
  };

  const handleSelectRow = (id: string, shiftKey: boolean) => {
      const newSelection = new Set(selectedTaskIds);

      if (shiftKey && lastSelectedId) {
          const lastIndex = sortedTasks.findIndex(t => t.id === lastSelectedId);
          const currentIndex = sortedTasks.findIndex(t => t.id === id);
          
          if (lastIndex !== -1 && currentIndex !== -1) {
              const start = Math.min(lastIndex, currentIndex);
              const end = Math.max(lastIndex, currentIndex);
              
              for (let i = start; i <= end; i++) {
                  newSelection.add(sortedTasks[i].id);
              }
          }
      } else {
          if (newSelection.has(id)) {
              newSelection.delete(id);
          } else {
              newSelection.add(id);
          }
      }

      setSelectedTaskIds(newSelection);
      setLastSelectedId(id);
  };

  // --- Bulk Update Handlers ---

  const handleBulkUpdate = async (field: string, value: any) => {
      if (selectedTaskIds.size === 0) return;
      if (!currentUser) {
          notify('error', 'You must be logged in to update tasks.');
          return;
      }

      try {
          const batch = writeBatch(db);
          selectedTaskIds.forEach(id => {
              const ref = doc(db, 'tasks', id);
              const updatePayload: any = { [field]: value, updatedAt: serverTimestamp() };
              
              // Special handling for Assignee to update multiple fields
              if (field === 'assigneeId') {
                  const member = projectMembers.find(m => m.uid === value);
                  updatePayload['assignee'] = member ? member.displayName : 'Unassigned';
                  updatePayload['assigneeAvatar'] = member?.avatar || '';
              }

              batch.update(ref, updatePayload);
          });

          await batch.commit();
          notify('success', `Updated ${selectedTaskIds.size} tasks`);
          
          // Close menus
          setShowStatusDropdown(false);
          setShowPriorityDropdown(false);
          setShowAssigneeDropdown(false);
          setShowDateInput(false);
          setSelectedTaskIds(new Set());

      } catch (error) {
          console.error("Bulk update error:", error);
          notify('error', 'Failed to update tasks');
      }
  };

  const handleBulkDelete = async () => {
      if (selectedTaskIds.size === 0) return;
      if (!window.confirm(`Are you sure you want to move ${selectedTaskIds.size} tasks to Trash?`)) return;

      try {
          const batch = writeBatch(db);
          selectedTaskIds.forEach(id => {
              const task = tasks.find(t => t.id === id);
              const ref = doc(db, 'tasks', id);
              batch.update(ref, { 
                  isDeleted: true, 
                  deletedAt: serverTimestamp(),
                  originalProjectId: task?.projectId 
              });
          });

          await batch.commit();
          notify('success', `${selectedTaskIds.size} tasks moved to Trash`);
          setSelectedTaskIds(new Set());
      } catch (error) {
          console.error("Bulk delete error:", error);
          notify('error', 'Failed to delete tasks');
      }
  };

  // --- UI Helpers ---

  const getStatusColor = (status: string) => {
    if (!status) return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    switch (status) {
      case 'Done': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'In Progress': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    if (!priority) return 'text-slate-600 dark:text-slate-400';
    switch (priority) {
      case 'High': return 'text-red-600 dark:text-red-400';
      case 'Medium': return 'text-amber-600 dark:text-amber-400';
      case 'Low': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-slate-600 dark:text-slate-400';
    }
  };

  const formatCurrency = (amount?: number) => {
    const val = Number(amount);
    if (isNaN(val)) return '-';
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    } catch (e) {
        return '-';
    }
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
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-full animate-fade-in relative">
       
       {/* Table Container */}
       <div className="overflow-x-auto flex-1 custom-scrollbar mb-16">
         <table className="w-full text-left border-collapse min-w-[900px]">
           <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 shadow-sm">
             <tr>
               <th className="px-6 py-4 w-12">
                   <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      checked={selectedTaskIds.size > 0 && selectedTaskIds.size === sortedTasks.length}
                      ref={input => {
                          if (input) {
                              input.indeterminate = selectedTaskIds.size > 0 && selectedTaskIds.size < sortedTasks.length;
                          }
                      }}
                      onChange={handleSelectAll}
                   />
               </th>
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
               if (!task || !task.id) return null;

               const dateMs = safeParseDate(task.dueDate);
               const dateDisplay = dateMs > 0 ? new Date(dateMs).toLocaleDateString() : '-';
               const assigneeName = typeof task.assignee === 'object' 
                    ? (task.assignee as any).displayName || 'Unassigned' 
                    : (task.assignee || 'Unassigned');
               const assigneeAvatar = task.assigneeAvatar;
               const isSelected = selectedTaskIds.has(task.id);

               return (
                 <tr 
                   key={task.id} 
                   onClick={(e) => {
                       // If clicking checkbox cell or action cell, don't trigger row click
                       // Handled by stopPropagation in those elements, but good to be safe
                       if (!(e.target as HTMLElement).closest('.no-row-click')) {
                           onTaskClick(task);
                       }
                   }}
                   className={`cursor-pointer transition-colors group ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/20 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                 >
                   <td className="px-6 py-4 no-row-click">
                       <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleSelectRow(task.id, (e.nativeEvent as any).shiftKey)}
                       />
                   </td>
                   
                   <td className="px-6 py-4">
                     <span className="font-bold text-slate-800 dark:text-white text-sm block truncate max-w-[250px]">{task.title || 'Untitled Task'}</span>
                   </td>
                   
                   <td className="px-6 py-4">
                     <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                       {task.status || 'To Do'}
                     </span>
                   </td>
                   
                   <td className="px-6 py-4">
                     <span className={`text-xs font-bold ${getPriorityColor(task.priority)}`}>
                       {task.priority || 'Medium'}
                     </span>
                   </td>
                   
                   <td className="px-6 py-4">
                     <div className="flex items-center gap-2">
                       <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0 ${assigneeAvatar && assigneeAvatar.startsWith('http') ? '' : getAvatarColor(assigneeName)}`}>
                         {assigneeAvatar && assigneeAvatar.startsWith('http') ? (
                           <img src={assigneeAvatar} alt={assigneeName} className="w-full h-full object-cover" />
                         ) : (
                           getAvatarInitials(assigneeName)
                         )}
                       </div>
                       <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                         {assigneeName}
                       </span>
                     </div>
                   </td>
                   
                   <td className="px-6 py-4">
                     <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                       {dateDisplay}
                     </span>
                   </td>
                   
                   <td className="px-6 py-4 text-right">
                     <span className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                       {formatCurrency(task.estimatedCost)}
                     </span>
                   </td>
                   
                   <td className="px-6 py-4 text-right no-row-click">
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
                 <td colSpan={8} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                   No tasks found.
                 </td>
               </tr>
             )}
           </tbody>
         </table>
       </div>
       
       {/* Floating Bulk Action Bar */}
       {selectedTaskIds.size > 0 && (
           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up bg-slate-900 dark:bg-slate-800 text-white px-2 py-2 rounded-full shadow-2xl flex items-center gap-2 border border-slate-700">
               <div className="px-4 py-2 bg-slate-800 dark:bg-slate-700 rounded-full text-xs font-bold flex items-center gap-2 mr-2">
                   <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-[10px]">{selectedTaskIds.size}</div>
                   Selected
               </div>

               {/* Status Dropdown */}
               <div className="relative">
                   <button 
                        onClick={() => { setShowStatusDropdown(!showStatusDropdown); setShowPriorityDropdown(false); setShowAssigneeDropdown(false); }}
                        className="p-2 hover:bg-slate-700 rounded-full text-slate-300 hover:text-white transition-colors"
                        title="Change Status"
                   >
                       <Layers size={18} />
                   </button>
                   {showStatusDropdown && (
                       <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden py-1 text-slate-900 dark:text-white">
                           {columns.length > 0 ? columns.map(col => (
                               <button key={col.id} onClick={() => handleBulkUpdate('status', col.title)} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 font-bold">{col.title}</button>
                           )) : (
                               <>
                                <button onClick={() => handleBulkUpdate('status', 'To Do')} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 font-bold">To Do</button>
                                <button onClick={() => handleBulkUpdate('status', 'In Progress')} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 font-bold">In Progress</button>
                                <button onClick={() => handleBulkUpdate('status', 'Done')} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 font-bold">Done</button>
                               </>
                           )}
                       </div>
                   )}
               </div>

               {/* Priority Dropdown */}
               <div className="relative">
                   <button 
                        onClick={() => { setShowPriorityDropdown(!showPriorityDropdown); setShowStatusDropdown(false); setShowAssigneeDropdown(false); }}
                        className="p-2 hover:bg-slate-700 rounded-full text-slate-300 hover:text-white transition-colors"
                        title="Change Priority"
                   >
                       <AlertCircle size={18} />
                   </button>
                   {showPriorityDropdown && (
                       <div className="absolute bottom-full left-0 mb-2 w-32 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden py-1 text-slate-900 dark:text-white">
                           {['High', 'Medium', 'Low'].map(p => (
                               <button key={p} onClick={() => handleBulkUpdate('priority', p)} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 font-bold">{p}</button>
                           ))}
                       </div>
                   )}
               </div>

               {/* Assignee Dropdown */}
               <div className="relative">
                   <button 
                        onClick={() => { setShowAssigneeDropdown(!showAssigneeDropdown); setShowStatusDropdown(false); setShowPriorityDropdown(false); }}
                        className="p-2 hover:bg-slate-700 rounded-full text-slate-300 hover:text-white transition-colors"
                        title="Change Assignee"
                   >
                       <UserIcon size={18} />
                   </button>
                   {showAssigneeDropdown && (
                       <div className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden py-1 text-slate-900 dark:text-white max-h-60 overflow-y-auto custom-scrollbar">
                           <button onClick={() => handleBulkUpdate('assigneeId', 'UN')} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 font-bold">Unassigned</button>
                           {projectMembers.map(m => (
                               <button key={m.uid} onClick={() => handleBulkUpdate('assigneeId', m.uid)} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 font-bold truncate">{m.displayName}</button>
                           ))}
                       </div>
                   )}
               </div>

               {/* Due Date Picker */}
               <div className="relative">
                   <button 
                        onClick={() => { setShowDateInput(!showDateInput); }}
                        className="p-2 hover:bg-slate-700 rounded-full text-slate-300 hover:text-white transition-colors"
                        title="Change Due Date"
                   >
                       <Calendar size={18} />
                   </button>
                   {showDateInput && (
                       <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700">
                           <input 
                                type="date" 
                                className="bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white text-xs rounded px-2 py-1 outline-none border border-slate-300 dark:border-slate-600"
                                onChange={(e) => { handleBulkUpdate('dueDate', e.target.value); setShowDateInput(false); }}
                           />
                       </div>
                   )}
               </div>

               <div className="w-px h-6 bg-slate-700 mx-1"></div>

               {/* Delete Button */}
               <button 
                    onClick={handleBulkDelete}
                    className="p-2 hover:bg-red-900/50 text-red-400 hover:text-red-300 rounded-full transition-colors"
                    title="Delete Selected"
               >
                   <Trash2 size={18} />
               </button>

               {/* Clear Selection */}
               <button 
                    onClick={() => setSelectedTaskIds(new Set())}
                    className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors ml-1"
                    title="Cancel Selection"
               >
                   <X size={18} />
               </button>
           </div>
       )}
       
       <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Showing {sortedTasks.length} tasks
          </span>
       </div>
    </div>
  );
};
