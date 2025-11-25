
import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { X, Calendar, User, AlertCircle, CheckSquare, Trash2, Plus, MessageSquare, Send, Paperclip, Link as LinkIcon, ExternalLink, Tag as TagIcon, FileText, DollarSign, AtSign, Bell, Lock, Check, Clock, GitBranch, ArrowDown, Zap, Unlock, Palmtree, CheckCircle2, Play, Square, History, Pencil, Save as SaveIcon, MoveRight, UserPlus, AlertTriangle, AlertOctagon, Smile, ArrowRight, Ban, LayoutTemplate, Loader2, Download, ChevronDown } from 'lucide-react';
import { Task, TaskStatus, TaskPriority, Subtask, Comment, ActivityLog, Attachment, Tag, KanbanColumn, ProjectMember, TimeLog } from '../types';
import RichTextEditor from './RichTextEditor';
import { useTimeTracking } from '../context/TimeTrackingContext';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useNotification } from '../context/NotificationContext';
import { saveTaskAsTemplate, getTemplates } from '../services/templateService';
import { getAvatarInitials, getAvatarColor } from '../utils/avatarUtils';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Partial<Task>) => void;
  onDelete?: (taskId: string) => void;
  task?: Task;
  currentUser: string;
  currentUserId?: string;
  availableTags: Tag[];
  onCreateTag: (name: string) => Tag;
  columns: KanbanColumn[];
  projectMembers?: ProjectMember[];
  initialDate?: string;
  
  // Permissions
  isReadOnly?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  
  // Dependency Data
  allTasks?: Task[];
  
  // Navigation
  onTaskSelect?: (task: Task) => void;
  
  // Events
  onTaskComment?: (taskId: string, text: string) => void;
}

const toDateTimeLocal = (timestamp: number) => {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatMessageTime = (timestampStr: string) => {
    try {
        const date = new Date(timestampStr);
        if (isNaN(date.getTime())) return timestampStr;
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const isThisYear = date.getFullYear() === now.getFullYear();

        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (isToday) return timeStr;
        if (isThisYear) return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
        return `${date.toLocaleDateString()} ${timeStr}`;
    } catch (e) {
        return timestampStr;
    }
};

const MiniTaskCard: React.FC<{ 
    task: Task; 
    type: 'upstream' | 'downstream' | 'current'; 
    onClick?: () => void;
    id?: string;
}> = ({ task, type, onClick, id }) => {
    const isCompleted = task.status === 'Done';
    const isCurrent = type === 'current';
    
    let containerClass = 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800';
    let statusColor = 'text-slate-500';
    let icon = <Clock size={14} className="text-slate-400" />;

    if (isCurrent) {
        containerClass = 'border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900/30 bg-white dark:bg-slate-800 shadow-xl scale-105 z-20';
        statusColor = 'text-indigo-600 dark:text-indigo-400';
        if (isCompleted) {
             containerClass = 'border-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-900/30 bg-white dark:bg-slate-800 shadow-xl scale-105 z-20';
             statusColor = 'text-emerald-600 dark:text-emerald-400';
             icon = <CheckCircle2 size={16} className="text-emerald-500" />;
        }
    } else if (type === 'upstream') {
        if (!isCompleted) {
            containerClass = 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10';
            statusColor = 'text-rose-600 dark:text-rose-400';
            icon = <AlertCircle size={14} className="text-rose-500" />;
        } else {
            containerClass = 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10';
            statusColor = 'text-emerald-600 dark:text-emerald-400';
            icon = <CheckCircle2 size={14} className="text-emerald-500" />;
        }
    } else {
        // Downstream (Blocking)
        containerClass = 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 opacity-90';
        if (isCompleted) {
             icon = <CheckCircle2 size={14} className="text-emerald-500" />;
        } else {
             icon = <Lock size={14} className="text-slate-400" />;
        }
    }

    return (
        <div 
            id={id}
            onClick={onClick}
            className={`
                relative p-3 rounded-xl border shadow-sm w-48 transition-all duration-300 group cursor-pointer
                ${containerClass}
                ${!isCurrent ? 'hover:scale-105 hover:shadow-md hover:z-10' : ''}
            `}
        >
            <div className="flex justify-between items-start mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/50 dark:bg-black/20 ${statusColor}`}>
                    {task.status}
                </span>
                {icon}
            </div>
            
            <h5 className={`font-bold text-xs leading-snug mb-2 line-clamp-2 ${isCurrent ? 'text-sm text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                {task.title}
            </h5>

            <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center gap-1.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-300 overflow-hidden border border-white dark:border-slate-600 ${task.assigneeAvatar ? '' : 'bg-slate-200 dark:bg-slate-700'}`}>
                        {task.assigneeAvatar ? <img src={task.assigneeAvatar} className="w-full h-full object-cover" /> : task.assignee.charAt(0)}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[80px]">{task.assignee}</span>
                </div>
                {task.priority === 'High' && !isCompleted && (
                    <AlertTriangle size={12} className="text-rose-500 animate-pulse" />
                )}
            </div>
        </div>
    );
};

const TaskDependencyVisualizer: React.FC<{
    task: Task;
    upstreamTasks: Task[];
    downstreamTasks: Task[];
    onTaskSelect?: (task: Task) => void;
}> = ({ task, upstreamTasks, downstreamTasks, onTaskSelect }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [paths, setPaths] = useState<React.ReactElement[]>([]);

    useEffect(() => {
        const calculatePaths = () => {
            if (!containerRef.current) return;
            
            const containerRect = containerRef.current.getBoundingClientRect();
            const newPaths: React.ReactElement[] = [];

            const currentEl = document.getElementById(`node-current-${task.id}`);
            if (!currentEl) return;
            
            const currentRect = currentEl.getBoundingClientRect();
            const currentX = currentRect.left + currentRect.width / 2 - containerRect.left;
            const currentTopY = currentRect.top - containerRect.top;
            const currentBottomY = currentRect.bottom - containerRect.top;

            // 1. Draw Lines from Upstream (Prereqs) -> Current
            upstreamTasks.forEach(t => {
                const el = document.getElementById(`node-up-${t.id}`);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    const startX = rect.left + rect.width / 2 - containerRect.left;
                    const startY = rect.bottom - containerRect.top;
                    
                    const endX = currentX;
                    const endY = currentTopY;

                    const cp1x = startX;
                    const cp1y = startY + (endY - startY) / 2;
                    const cp2x = endX;
                    const cp2y = endY - (endY - startY) / 2;

                    const isDone = t.status === 'Done';
                    const color = isDone ? '#10b981' : '#f43f5e';
                    
                    const pathD = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
                    
                    const midX = (startX + endX) / 2;
                    const midY = (startY + endY) / 2;

                    newPaths.push(
                        <g key={`link-up-${t.id}`}>
                            <path 
                                d={pathD} 
                                fill="none" 
                                stroke={color} 
                                strokeWidth="2" 
                                strokeDasharray={isDone ? "none" : "5,5"}
                                className="transition-all duration-500 ease-in-out"
                            />
                            <foreignObject x={midX - 10} y={midY - 10} width="20" height="20">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shadow-sm border ${isDone ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-rose-100 border-rose-200 text-rose-600'}`}>
                                    {isDone ? <Check size={12} strokeWidth={3} /> : <Lock size={10} />}
                                </div>
                            </foreignObject>
                        </g>
                    );
                }
            });

            // 2. Draw Lines from Current -> Downstream (Blocking)
            downstreamTasks.forEach(t => {
                const el = document.getElementById(`node-down-${t.id}`);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    const endX = rect.left + rect.width / 2 - containerRect.left;
                    const endY = rect.top - containerRect.top;
                    
                    const startX = currentX;
                    const startY = currentBottomY;

                    const cp1x = startX;
                    const cp1y = startY + (endY - startY) / 2;
                    const cp2x = endX;
                    const cp2y = endY - (endY - startY) / 2;

                    const isCurrentDone = task.status === 'Done';
                    const color = isCurrentDone ? '#94a3b8' : '#f43f5e'; 
                    
                    const pathD = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
                    
                    const midX = (startX + endX) / 2;
                    const midY = (startY + endY) / 2;

                    newPaths.push(
                        <g key={`link-down-${t.id}`}>
                            <path 
                                d={pathD} 
                                fill="none" 
                                stroke={color} 
                                strokeWidth="2" 
                                strokeDasharray={isCurrentDone ? "none" : "5,5"}
                                className="transition-all duration-500 ease-in-out"
                            />
                            {!isCurrentDone && (
                                <foreignObject x={midX - 10} y={midY - 10} width="20" height="20">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center shadow-sm border bg-rose-100 border-rose-200 text-rose-600">
                                        <Lock size={10} />
                                    </div>
                                </foreignObject>
                            )}
                        </g>
                    );
                }
            });

            setPaths(newPaths);
        };

        setTimeout(calculatePaths, 100);
        window.addEventListener('resize', calculatePaths);
        return () => window.removeEventListener('resize', calculatePaths);
    }, [task, upstreamTasks, downstreamTasks]);

    return (
        <div ref={containerRef} className="relative w-full min-h-[600px] py-8 bg-slate-50 dark:bg-slate-900/50 rounded-xl overflow-hidden">
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                {paths}
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-between h-full gap-16">
                <div className="flex flex-col items-center w-full px-4">
                    <div className="mb-4 text-center">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow-sm border border-slate-100 dark:border-slate-700">
                            Prerequisites
                        </span>
                    </div>
                    {upstreamTasks.length > 0 ? (
                        <div className="flex flex-wrap justify-center gap-6">
                            {upstreamTasks.map(t => (
                                <MiniTaskCard 
                                    key={t.id} 
                                    id={`node-up-${t.id}`}
                                    task={t} 
                                    type="upstream" 
                                    onClick={() => onTaskSelect && onTaskSelect(t)} 
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-sm text-slate-400 italic py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl px-8 bg-slate-50/50 dark:bg-slate-800/50">
                            No prerequisites
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center">
                    <div className="mb-4 text-center">
                        <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-800">
                            Current Focus
                        </span>
                    </div>
                    <div id={`node-current-${task.id}`}>
                        <MiniTaskCard 
                            task={task} 
                            type="current" 
                        />
                    </div>
                </div>

                <div className="flex flex-col items-center w-full px-4">
                    <div className="mb-4 text-center">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow-sm border border-slate-100 dark:border-slate-700">
                            Blocking
                        </span>
                    </div>
                    {downstreamTasks.length > 0 ? (
                        <div className="flex flex-wrap justify-center gap-6">
                            {downstreamTasks.map(t => (
                                <MiniTaskCard 
                                    key={t.id} 
                                    id={`node-down-${t.id}`}
                                    task={t} 
                                    type="downstream" 
                                    onClick={() => onTaskSelect && onTaskSelect(t)} 
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-sm text-slate-400 italic py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl px-8 bg-slate-50/50 dark:bg-slate-800/50">
                            End of chain
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const TaskModal: React.FC<TaskModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  onDelete,
  task, 
  currentUser,
  currentUserId,
  availableTags,
  onCreateTag,
  columns,
  projectMembers = [],
  initialDate,
  isReadOnly = false,
  canEdit = true,
  canDelete = true,
  allTasks = [],
  onTaskSelect,
  onTaskComment
}) => {
  const { notify } = useNotification();
  const { activeTimer, startTimer, stopTimer, formatDuration } = useTimeTracking();
  const [activeTab, setActiveTab] = useState<'details' | 'discussion' | 'flow' | 'timeLogs'>('details');
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('To Do');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reminderDays, setReminderDays] = useState<number>(1);
  
  // Assignee State
  const [assignee, setAssignee] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [assigneeAvatar, setAssigneeAvatar] = useState('');
  
  const [estimatedCost, setEstimatedCost] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [estimatedDays, setEstimatedDays] = useState('');
  
  // Subtask State
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Discussion State
  const [comments, setComments] = useState<Comment[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [newComment, setNewComment] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Mention State
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // Attachment State
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newFileName, setNewFileName] = useState('');
  const [newFileUrl, setNewFileUrl] = useState('');

  // Tags State
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  // Dependencies State
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [showDependencyDropdown, setShowDependencyDropdown] = useState(false);

  // Time Log Edit State
  const [editingLog, setEditingLog] = useState<TimeLog | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  // Manual Time Log State
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  
  // Template Loading State
  const [taskTemplates, setTaskTemplates] = useState<any[]>([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  const prevTaskIdRef = useRef<string | undefined>(undefined);

  const activeMembers = useMemo(() => {
      return projectMembers.filter(m => (m.status === 'active' || !m.status) && m.uid !== null);
  }, [projectMembers]);

  // Potential Dependencies
  const potentialDependencies = useMemo(() => {
     return allTasks.filter(t => t.id !== task?.id);
  }, [allTasks, task]);

  // --- Derived Flow Data ---
  const upstreamTasks = useMemo(() => {
     if (!task || !task.dependencies) return [];
     return task.dependencies.map(id => allTasks.find(t => t.id === id)).filter(Boolean) as Task[];
  }, [task, allTasks]);

  const downstreamTasks = useMemo(() => {
      if (!task) return [];
      return allTasks.filter(t => t.dependencies?.includes(task.id));
  }, [task, allTasks]);

  const isTracking = task && activeTimer?.taskId === task.id;

  // Reset Edit State
  useEffect(() => {
    if (!isOpen) {
      setEditingLog(null);
      setIsSavingTemplate(false);
      setShowTemplateMenu(false);
      setManualStartTime('');
      setManualEndTime('');
      setManualNotes('');
    }
  }, [isOpen]);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === 'discussion') {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }
  }, [activeTab, comments, activityLog]);

  // --- FIX 1: Reactive State Synchronization ---
  useEffect(() => {
    if (isOpen && task) {
        setStatus(prevStatus => task.status !== prevStatus ? task.status : prevStatus);
        setPriority(prev => task.priority !== prev ? task.priority : prev);
        setStartDate(prev => task.startDate !== prev ? task.startDate : prev);
        setDueDate(prev => task.dueDate !== prev ? task.dueDate : prev);
        
        if (task.assigneeId !== assigneeId) {
            setAssignee(task.assignee);
            setAssigneeId(task.assigneeId || '');
            setAssigneeAvatar(task.assigneeAvatar || '');
        }

        setSubtasks(task.subtasks || []);
        setDependencies(task.dependencies || []);
        setTags(task.tags || []);
        
        setEstimatedCost(task.estimatedCost?.toString() || '');
        setActualCost(task.actualCost?.toString() || '');
        setEstimatedHours(task.estimatedHours?.toString() || '');
        setEstimatedDays(task.estimatedDays?.toString() || '');
    }
  }, [task, isOpen]);

  // --- Initialization Logic (Switching Tasks) ---
  useEffect(() => {
    if (isOpen) {
      const isNewTask = !task;
      const isDifferentTask = task?.id !== prevTaskIdRef.current;

      if (isNewTask || isDifferentTask) {
          if (task) {
            // Load Initial Data
            setTitle(task.title);
            setDescription(task.description || '');
            setStatus(task.status);
            setPriority(task.priority);
            setStartDate(task.startDate);
            setDueDate(task.dueDate);
            setReminderDays(task.reminderDays !== undefined ? task.reminderDays : 1);
            
            setAssignee(task.assignee);
            setAssigneeId(task.assigneeId || '');
            setAssigneeAvatar(task.assigneeAvatar || '');
            
            if (!task.assigneeId && task.assignee && task.assignee !== 'UN' && projectMembers.length > 0) {
              const found = projectMembers.find(m => m.displayName === task.assignee);
              if (found && found.uid) {
                  setAssigneeId(found.uid);
                  setAssigneeAvatar(found.avatar || '');
              }
            }

            setSubtasks(task.subtasks || []);
            setComments(task.comments || []);
            setActivityLog(task.activityLog || []);
            setAttachments(task.attachments || []);
            setTags(task.tags || []);
            setDependencies(task.dependencies || []);
          } else {
            // Default values for New Task
            setTitle('');
            setDescription('');
            setStatus(columns.length > 0 ? columns[0].title : 'To Do');
            setPriority('Medium');
            const defaultDate = initialDate || new Date().toISOString().split('T')[0];
            setStartDate(defaultDate);
            setDueDate(initialDate || '');
            setReminderDays(1);
            setAssignee('Unassigned');
            setAssigneeId('UN');
            setAssigneeAvatar('');
            setSubtasks([]);
            setComments([]);
            setActivityLog([]);
            setAttachments([]);
            setTags([]);
            setDependencies([]);
            setEstimatedCost('');
            setActualCost('');
            setEstimatedHours('');
            setEstimatedDays('');
            
            // Fetch Task Templates if new task
            getTemplates('task').then(setTaskTemplates);
          }
          
          setNewSubtaskTitle('');
          setNewComment('');
          setNewFileName('');
          setNewFileUrl('');
          setTagInput('');
          setShowTagDropdown(false);
          setShowMentionList(false);
          setMentionQuery('');
          setMentionHighlightIndex(0);
          setActiveTab('details');
          setShowDependencyDropdown(false);
          setEditingLog(null);
          setManualStartTime('');
          setManualEndTime('');
          setManualNotes('');

          prevTaskIdRef.current = task?.id;
      }
    }
  }, [isOpen, task, columns, projectMembers, initialDate]);

  // ... (Validation & Handlers: addSubtask, deleteSubtask, attachments, tags, dependencies, comments, logs - mostly same) ...
  // ... Keeping logic blocks collapsed for brevity unless changes needed ...

  const filteredMembers = useMemo(() => {
    if (!mentionQuery) return activeMembers;
    return activeMembers.filter(m => 
      m.displayName.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  }, [activeMembers, mentionQuery]);

  const handleAddSubtask = (e?: React.FormEvent) => { e?.preventDefault(); if (isReadOnly || !newSubtaskTitle.trim()) return; setSubtasks([...subtasks, { id: Date.now().toString(), title: newSubtaskTitle, completed: false }]); setNewSubtaskTitle(''); };
  const handleDeleteSubtask = (id: string) => { if (isReadOnly) return; setSubtasks(subtasks.filter(st => st.id !== id)); };
  const handleToggleSubtask = (id: string) => { if (isReadOnly) return; setSubtasks(subtasks.map(st => st.id === id ? { ...st, completed: !st.completed } : st)); };
  const handleAddAttachment = () => { if (isReadOnly || !newFileName.trim() || !newFileUrl.trim()) return; setAttachments([...attachments, { id: Date.now().toString(), fileName: newFileName, fileUrl: newFileUrl, uploadedAt: new Date().toLocaleString() }]); setNewFileName(''); setNewFileUrl(''); };
  const handleDeleteAttachment = (id: string) => { if (isReadOnly) return; setAttachments(attachments.filter(att => att.id !== id)); };
  const handleAddTag = (tag: Tag) => { if (isReadOnly) return; if (!tags.find(t => t.id === tag.id)) setTags([...tags, tag]); setTagInput(''); setShowTagDropdown(false); };
  const handleCreateTag = () => { if (isReadOnly) return; if (!tagInput.trim()) return; handleAddTag(onCreateTag(tagInput.trim())); };
  const handleRemoveTag = (tagId: string) => { if (isReadOnly) return; setTags(tags.filter(t => t.id !== tagId)); };
  const handleToggleDependency = (depTaskId: string) => { if (isReadOnly) return; if (dependencies.includes(depTaskId)) { setDependencies(prev => prev.filter(id => id !== depTaskId)); } else { setDependencies(prev => [...prev, depTaskId]); } };
  
  const handleSendComment = async () => { 
    if (!newComment.trim()) return; 
    if (isReadOnly) return; 
    
    const comment: Comment = { 
        id: Date.now().toString(), 
        user: currentUser, // this is username string
        text: newComment, 
        timestamp: new Date().toISOString() 
    };
    
    const updatedComments = [...comments, comment];
    setComments(updatedComments); 
    
    if (task) {
        try {
            await updateDoc(doc(db, 'tasks', task.id), {
                comments: arrayUnion(comment)
            });
            
            // Trigger notification/activity log
            if (onTaskComment) onTaskComment(task.id, newComment);
        } catch(e) {
            console.error("Failed to save comment", e);
        }
    }
    
    setNewComment(''); 
    setShowMentionList(false); 
  };
  
  const handleDeleteLog = async (logId: string) => {
    if (!task) return;
    if (!window.confirm("Delete this time entry?")) return;
    try {
        const currentLogs = task.timeLogs || [];
        const newLogsArray = currentLogs.filter(l => l.id !== logId);
        const newTotalSeconds = newLogsArray.reduce((acc, l) => acc + l.durationSeconds, 0);
        await updateDoc(doc(db, 'tasks', task.id), { timeLogs: newLogsArray, totalTimeSeconds: newTotalSeconds });
        notify('success', 'Time log deleted');
        if (editingLog?.id === logId) setEditingLog(null);
    } catch (e) { console.error(e); notify('error', 'Failed to delete log'); }
  };

  const handleEditLogClick = (log: TimeLog) => { setEditingLog(log); setEditStartTime(toDateTimeLocal(log.startTime)); setEditEndTime(toDateTimeLocal(log.endTime)); };
  const handleUpdateLog = async () => {
    if (!task || !editingLog) return;
    const start = new Date(editStartTime).getTime();
    const end = new Date(editEndTime).getTime();
    if (isNaN(start) || isNaN(end)) { notify('warning', 'Invalid date/time'); return; }
    if (end <= start) { notify('warning', 'End time must be after start time'); return; }
    const durationSeconds = Math.floor((end - start) / 1000);
    const updatedLog = { ...editingLog, startTime: start, endTime: end, durationSeconds };
    const updatedLogs = (task.timeLogs || []).map(l => l.id === editingLog.id ? updatedLog : l);
    const newTotal = updatedLogs.reduce((acc, l) => acc + l.durationSeconds, 0);
    try {
        await updateDoc(doc(db, 'tasks', task.id), { timeLogs: updatedLogs, totalTimeSeconds: newTotal });
        notify('success', 'Time log updated');
        setEditingLog(null); 
    } catch (e) { console.error(e); notify('error', 'Failed to update log'); }
  };

  const handleAddManualLog = async () => {
    if (!task || !currentUser || isReadOnly) return;
    if (!manualStartTime || !manualEndTime) { notify('warning', 'Please select start and end times'); return; }
    
    const start = new Date(manualStartTime).getTime();
    const end = new Date(manualEndTime).getTime();
    
    if (isNaN(start) || isNaN(end)) { notify('warning', 'Invalid dates'); return; }
    if (end <= start) { notify('warning', 'End time must be after start time'); return; }
    
    const durationSeconds = Math.floor((end - start) / 1000);
    
    const newLog: TimeLog = {
        id: Date.now().toString(),
        userId: currentUserId || 'unknown',
        startTime: start,
        endTime: end,
        durationSeconds: durationSeconds,
        notes: manualNotes.trim()
    };

    try {
        await updateDoc(doc(db, 'tasks', task.id), {
            totalTimeSeconds: (task.totalTimeSeconds || 0) + durationSeconds,
            timeLogs: arrayUnion(newLog)
        });
        
        // Reset form
        setManualStartTime('');
        setManualEndTime('');
        setManualNotes('');
        notify('success', 'Time log added manually');
    } catch (e) {
        console.error(e);
        notify('error', 'Failed to add time log');
    }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    const val = e.target.value;
    setNewComment(val);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const match = textBefore.match(/(?:^|\s)@(\w*)$/);
    if (match) { setMentionQuery(match[1]); setShowMentionList(true); setMentionHighlightIndex(0); } else { setShowMentionList(false); }
  };

  const handleInsertMention = (memberName: string) => {
    if (!commentInputRef.current) return;
    const cursorPos = commentInputRef.current.selectionStart;
    const textBefore = newComment.slice(0, cursorPos);
    const textAfter = newComment.slice(cursorPos);
    const match = textBefore.match(/(?:^|\s)@(\w*)$/);
    if (match) {
        const matchIndex = match.index! + (match[0].startsWith(' ') ? 1 : 0);
        const prefix = newComment.slice(0, matchIndex);
        const mentionTag = `@[${memberName}] `;
        const newText = prefix + mentionTag + textAfter;
        setNewComment(newText);
        setTimeout(() => { if (commentInputRef.current) { commentInputRef.current.focus(); const newCursorPos = prefix.length + mentionTag.length; commentInputRef.current.setSelectionRange(newCursorPos, newCursorPos); } }, 0);
    } else { setNewComment(prev => prev + `@[${memberName}] `); }
    setShowMentionList(false);
    setMentionQuery('');
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !showMentionList) { e.preventDefault(); handleSendComment(); return; }
    if (showMentionList && filteredMembers.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setMentionHighlightIndex(prev => (prev + 1) % filteredMembers.length); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionHighlightIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length); }
        else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleInsertMention(filteredMembers[mentionHighlightIndex].displayName); }
        else if (e.key === 'Escape') { e.preventDefault(); setShowMentionList(false); }
    }
  };

  const handleSaveAsTemplate = async () => {
      if (!task || !currentUserId) return;
      const templateName = prompt("Template Name:", task.title);
      if (!templateName) return;

      setIsSavingTemplate(true);
      try {
          await saveTaskAsTemplate(task, templateName, currentUserId);
          notify('success', "Task saved as template!");
      } catch (e) {
          console.error(e);
          notify('error', "Failed to save template.");
      } finally {
          setIsSavingTemplate(false);
      }
  };

  const handleApplyTemplate = (template: any) => {
      if (!template || !template.content) return;
      
      const content = template.content;
      
      if (window.confirm("This will overwrite current fields (Title, Desc, Subtasks, etc). Continue?")) {
          setTitle(content.title || '');
          setDescription(content.description || '');
          setPriority(content.priority || 'Medium');
          setTags(content.tags || []);
          setSubtasks(content.subtasks || []);
          if (content.estimatedCost) setEstimatedCost(content.estimatedCost.toString());
          if (content.estimatedHours) setEstimatedHours(content.estimatedHours.toString());
          
          notify('success', `Template "${template.name}" loaded.`);
          setShowTemplateMenu(false);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !canEdit) return;
    onSubmit({
      title, description, status, priority, startDate, dueDate, 
      assignee: assignee || 'Unassigned',
      assigneeId: assigneeId || 'UN',
      assigneeAvatar: assigneeAvatar,
      subtasks, comments, activityLog, attachments, tags,
      dependencies,
      estimatedCost: parseFloat(estimatedCost) || 0, 
      actualCost: parseFloat(actualCost) || 0,
      estimatedHours: parseFloat(estimatedHours) || 0,
      estimatedDays: parseFloat(estimatedDays) || 0,
      reminderDays: reminderDays
    });
  };

  const streamItems = [
    ...comments.map(c => ({ ...c, source: 'comment', type: 'comment', timestamp: c.timestamp })),
    ...activityLog.map(l => ({ ...l, source: 'log', timestamp: l.timestamp }))
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const inputBaseClass = `w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white font-medium placeholder-slate-400 text-sm ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`;
  const filteredAvailableTags = availableTags.filter(at => at.name.toLowerCase().includes(tagInput.toLowerCase()) && !tags.find(t => t.id === at.id));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300 border border-slate-200 dark:border-slate-700 relative">
        
        {/* Edit Log Mini Modal Overlay */}
        {editingLog && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 w-80 border border-slate-200 dark:border-slate-700 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Edit Time Entry</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Start Time</label>
                            <input type="datetime-local" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">End Time</label>
                            <input type="datetime-local" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-6">
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingLog(null); }} className="flex-1 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUpdateLog(); }} className="flex-1 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center justify-center gap-2"><SaveIcon size={14} /> Save</button>
                    </div>
                </div>
            </div>
        )}

        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/80 shrink-0 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <div className="w-2 h-6 bg-indigo-500 rounded-full shadow-sm"></div>
                  {task ? 'Edit Task' : 'New Task'}
                  {isReadOnly && <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md flex items-center gap-1"><Lock size={10} /> Read Only</span>}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-4 font-medium">ID: {task?.id || 'Draft'}</p>
              </div>
              
              {/* Template Loader (Create Mode Only) */}
              {!task && !isReadOnly && taskTemplates.length > 0 && (
                  <div className="relative ml-4">
                      <button 
                        onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                        className="flex items-center gap-1 text-xs font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                        title="Load Template"
                      >
                          <LayoutTemplate size={14} /> Load Template <ChevronDown size={12} />
                      </button>
                      
                      {showTemplateMenu && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setShowTemplateMenu(false)}></div>
                            <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-40 overflow-hidden max-h-60 overflow-y-auto">
                                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/50 text-xs font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">Available Templates</div>
                                {taskTemplates.map(t => (
                                    <button 
                                        key={t.id}
                                        onClick={() => handleApplyTemplate(t)}
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors truncate"
                                    >
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                          </>
                      )}
                  </div>
              )}

              {task && !isReadOnly && (
                  <>
                    <button onClick={() => isTracking ? stopTimer() : startTimer(task)} className={`ml-4 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all border ${isTracking ? 'bg-red-100 text-red-600 border-red-200 animate-pulse' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200'}`}>
                        {isTracking ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                        {isTracking ? 'STOP' : 'START TIMER'}
                        {(isTracking || (task.totalTimeSeconds || 0) > 0) && (<span className="ml-1 opacity-80 font-mono">{formatDuration((task.totalTimeSeconds || 0) + (isTracking ? 0 : 0))}</span>)}
                    </button>
                    
                    <button 
                        onClick={handleSaveAsTemplate}
                        disabled={isSavingTemplate}
                        className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                        title="Save as Template"
                    >
                        {isSavingTemplate ? <Loader2 size={18} className="animate-spin" /> : <LayoutTemplate size={18} />}
                    </button>
                  </>
              )}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors">
                <X size={22} />
            </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 gap-6">
          <button onClick={() => setActiveTab('details')} className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Details</button>
          <button onClick={() => setActiveTab('discussion')} className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'discussion' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Discussion <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-xs text-slate-700 dark:text-slate-300 font-bold">{comments.length}</span></button>
          {task && (<button onClick={() => setActiveTab('flow')} className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'flow' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Task Flow <GitBranch size={14} className={activeTab === 'flow' ? 'text-indigo-500' : ''} /></button>)}
          {task && (<button onClick={() => setActiveTab('timeLogs')} className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'timeLogs' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>Time Logs <History size={14} className={activeTab === 'timeLogs' ? 'text-indigo-500' : ''} /></button>)}
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white dark:bg-slate-800">
          <form id="taskForm" onSubmit={handleSubmit} className="space-y-7 h-full">
            {activeTab === 'details' && (
              <>
                <div><label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Task Title</label><input type="text" required readOnly={isReadOnly} value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputBaseClass} text-lg`} placeholder="Task Name" /></div>
                <div><label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><FileText size={12} /> Description</label>{isReadOnly ? (<div className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl min-h-[100px] prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: description }} />) : (<RichTextEditor value={description} onChange={setDescription} placeholder="Add detailed description here..." />)}</div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div><label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Status</label><select disabled={isReadOnly} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className={inputBaseClass}>{columns.map(col => <option key={col.id} value={col.title}>{col.title}</option>)}</select></div>
                    <div><label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Priority</label><select disabled={isReadOnly} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={inputBaseClass}><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option></select></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div><label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Calendar size={12} /> Start</label><input type="date" required readOnly={isReadOnly} value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputBaseClass} /></div>
                    <div><label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertCircle size={12} /> Due</label><input type="date" required readOnly={isReadOnly} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputBaseClass} /></div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><User size={12} /> Assignee</label>
                        <select disabled={isReadOnly} value={assigneeId} onChange={(e) => { const uid = e.target.value; setAssigneeId(uid); if (uid === 'UN') { setAssignee('Unassigned'); setAssigneeAvatar(''); } else { const member = projectMembers.find(m => m.uid === uid); if (member) { setAssignee(member.displayName); setAssigneeAvatar(member.avatar || ''); } } }} className={`${inputBaseClass} cursor-pointer`}>
                          <option value="UN">Unassigned</option>
                          {activeMembers.map(member => (<option key={member.uid!} value={member.uid!}>{member.displayName}</option>))}
                        </select>
                    </div>
                </div>
                
                <div className="relative">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><LinkIcon size={12} /> Dependencies / Prerequisites</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                       {dependencies.map(depId => {
                           const parentTask = allTasks.find(t => t.id === depId);
                           const isCompleted = parentTask?.status === 'Done';
                           return (
                               <span key={depId} className={`px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 border ${isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                                   {parentTask ? parentTask.title : 'Unknown Task'}
                                   {!isReadOnly && <button type="button" onClick={() => handleToggleDependency(depId)} className="hover:bg-black/10 rounded-full p-0.5"><X size={12} /></button>}
                               </span>
                           );
                       })}
                    </div>
                    {!isReadOnly && (
                       <div className="relative">
                          <button type="button" onClick={() => setShowDependencyDropdown(!showDependencyDropdown)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"><Plus size={12} /> Add Dependency</button>
                          {showDependencyDropdown && (
                             <>
                                <div className="fixed inset-0 z-30" onClick={() => setShowDependencyDropdown(false)}></div>
                                <div className="absolute z-40 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                                   <div className="p-2 text-xs text-slate-400 font-medium border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">Select tasks that must be completed before this one:</div>
                                   {potentialDependencies.map(pt => {
                                       const isSelected = dependencies.includes(pt.id);
                                       return (
                                          <button key={pt.id} type="button" onClick={() => handleToggleDependency(pt.id)} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                                             <div className="flex flex-col min-w-0"><span className={`font-medium truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{pt.title}</span><span className="text-[10px] text-slate-500">{pt.status}</span></div>
                                             {isSelected && <Check size={14} className="text-indigo-600" />}
                                          </button>
                                       );
                                   })}
                                   {potentialDependencies.length === 0 && <div className="p-4 text-center text-sm text-slate-400">No other tasks available.</div>}
                                </div>
                             </>
                          )}
                       </div>
                    )}
                </div>

                <div><label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Bell size={12} /> Remind me</label><select disabled={isReadOnly} value={reminderDays} onChange={(e) => setReminderDays(Number(e.target.value))} className={`${inputBaseClass} cursor-pointer`}><option value={-1}>Don't remind</option><option value={0}>On Due Date</option><option value={1}>1 Day Before</option><option value={2}>2 Days Before</option><option value={7}>1 Week Before</option></select></div>
                
                 <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><TagIcon size={12} /> Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map(tag => (<span key={tag.id} className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 ${tag.colorClass}`}>{tag.name}{!isReadOnly && <button type="button" onClick={() => handleRemoveTag(tag.id)} className="hover:bg-black/10 rounded-full p-0.5"><X size={12} /></button>}</span>))}
                  </div>
                  {!isReadOnly && (
                      <div className="relative">
                        <input type="text" value={tagInput} onChange={(e) => { setTagInput(e.target.value); setShowTagDropdown(true); }} onFocus={() => setShowTagDropdown(true)} onBlur={() => setTimeout(() => setShowTagDropdown(false), 200)} placeholder="+ Add tag" className={inputBaseClass} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateTag(); } }} />
                        {showTagDropdown && (tagInput || filteredAvailableTags.length > 0) && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                            {filteredAvailableTags.map(tag => (<button key={tag.id} type="button" onClick={() => handleAddTag(tag)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${tag.colorClass.split(' ')[0]}`}></span>{tag.name}</button>))}
                            {tagInput && !filteredAvailableTags.find(t => t.name.toLowerCase() === tagInput.toLowerCase()) && (<button type="button" onClick={handleCreateTag} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold">Create "{tagInput}"</button>)}
                        </div>)}
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><CheckSquare size={16} className="text-indigo-500" /> Checklist</label>
                    {subtasks.length > 0 && <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">{subtasks.filter(st => st.completed).length}/{subtasks.length} Done</span>}
                  </div>
                  {subtasks.length > 0 && (<div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mb-4 overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-300 ease-out" style={{ width: `${subtasks.length > 0 ? Math.round((subtasks.filter(st => st.completed).length / subtasks.length) * 100) : 0}%` }} /></div>)}
                  <div className="space-y-2 mb-4">
                    {subtasks.map((st) => (<div key={st.id} className="flex items-center gap-3 group p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-600"><button type="button" onClick={() => handleToggleSubtask(st.id)} disabled={isReadOnly} className={`flex-shrink-0 w-5 h-5 rounded border transition-all flex items-center justify-center ${st.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 bg-white dark:bg-slate-800'}`}>{st.completed && <CheckSquare size={14} />}</button><span className={`flex-1 text-sm font-medium transition-all ${st.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{st.title}</span>{!isReadOnly && <button type="button" onClick={() => handleDeleteSubtask(st.id)} className="text-slate-400 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"><Trash2 size={16} /></button>}</div>))}
                  </div>
                  {!isReadOnly && (<div className="flex gap-2"><input type="text" value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())} className={inputBaseClass} placeholder="Add an item..." /><button type="button" onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()} className="px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl transition-colors disabled:opacity-50"><Plus size={20} /></button></div>)}
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                  <label className="block text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3"><Paperclip size={16} className="text-indigo-500" /> Attachments</label>
                   {attachments.length > 0 && (<div className="space-y-2 mb-4">{attachments.map((att) => (<div key={att.id} className="flex items-center gap-3 group p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-600"><div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg"><FileText size={16} /></div><div className="flex-1 min-w-0"><a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="block text-sm font-medium text-slate-700 dark:text-slate-200 truncate hover:text-indigo-600 dark:hover:text-indigo-400">{att.fileName}</a><p className="text-[10px] text-slate-400">{att.uploadedAt}</p></div>{!isReadOnly && <button type="button" onClick={() => handleDeleteAttachment(att.id)} className="text-slate-400 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"><Trash2 size={16} /></button>}</div>))}</div>)}
                   {!isReadOnly && (<div className="flex gap-2 items-end"><div className="flex-1 space-y-2"><input type="text" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} className={inputBaseClass} placeholder="File Name" /><input type="text" value={newFileUrl} onChange={(e) => setNewFileUrl(e.target.value)} className={inputBaseClass} placeholder="File URL (e.g. https://...)" /></div><button type="button" onClick={handleAddAttachment} disabled={!newFileName.trim() || !newFileUrl.trim()} className="px-4 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl transition-colors disabled:opacity-50"><Plus size={20} /></button></div>)}
                </div>
              </>
            )}

            {activeTab === 'discussion' && (
                <div className="h-full flex flex-col min-h-[400px]">
                    <div className="flex-1 overflow-y-auto space-y-4 mb-4 custom-scrollbar pr-2">
                        {streamItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                                <MessageSquare size={32} className="mb-2" />
                                <p className="text-sm">No activity yet. Start the discussion!</p>
                            </div>
                        ) : (
                            streamItems.map((item, idx) => {
                                const isComment = item.source === 'comment';
                                const isMe = item.user === currentUser; // Assuming currentUser matches username for simplicity, otherwise check ID
                                
                                if (isComment) {
                                    return (
                                        <div key={item.id} className={`flex gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            {!isMe && (
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getAvatarColor(item.user)}`}>
                                                    {getAvatarInitials(item.user)}
                                                </div>
                                            )}
                                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${isMe ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-slate-100 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200 rounded-bl-sm'}`}>
                                                <div className="font-bold text-xs mb-1 opacity-80">{item.user}</div>
                                                <div className="whitespace-pre-wrap">{item.text}</div>
                                                <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                    {formatMessageTime(item.timestamp)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                } else {
                                    // Activity Log
                                    return (
                                        <div key={item.id} className="flex items-center justify-center gap-2 my-4">
                                            <div className="h-px bg-slate-200 dark:bg-slate-700 w-12"></div>
                                            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-700">
                                                {item.userName || 'System'} {item.action} • {formatMessageTime(item.timestamp)}
                                            </span>
                                            <div className="h-px bg-slate-200 dark:bg-slate-700 w-12"></div>
                                        </div>
                                    );
                                }
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    
                    {!isReadOnly && (
                        <div className="relative pt-2 border-t border-slate-100 dark:border-slate-700">
                            {showMentionList && filteredMembers.length > 0 && (
                                <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-40 overflow-y-auto z-50">
                                    {filteredMembers.map((m, i) => (
                                        <button
                                            key={m.uid || i}
                                            onMouseDown={(e) => { e.preventDefault(); handleInsertMention(m.displayName); }}
                                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${i === mentionHighlightIndex ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                        >
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${m.avatar ? '' : getAvatarColor(m.displayName)}`}>
                                                {m.avatar ? <img src={m.avatar} className="w-full h-full object-cover rounded-full" /> : getAvatarInitials(m.displayName)}
                                            </div>
                                            {m.displayName}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2 items-end bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                                <textarea 
                                    ref={commentInputRef}
                                    value={newComment}
                                    onChange={handleCommentChange}
                                    onKeyDown={handleCommentKeyDown}
                                    placeholder="Type a message... Use @ to mention"
                                    className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-white resize-none max-h-32 min-h-[40px] py-2 px-1 custom-scrollbar"
                                    rows={1}
                                />
                                <div className="flex flex-col gap-1 pb-1">
                                    <button 
                                        type="button" 
                                        onClick={() => handleInsertMention('')} 
                                        className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                        title="Mention someone"
                                    >
                                        <AtSign size={16} />
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={handleSendComment}
                                        disabled={!newComment.trim()}
                                        className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                                    >
                                        <Send size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'flow' && task && (
                <div className="h-full overflow-y-auto custom-scrollbar">
                    <TaskDependencyVisualizer 
                        task={task} 
                        upstreamTasks={upstreamTasks} 
                        downstreamTasks={downstreamTasks} 
                        onTaskSelect={onTaskSelect}
                    />
                </div>
            )}

            {activeTab === 'timeLogs' && (
                <div className="h-full flex flex-col">
                    {/* Stats Header */}
                    <div className="flex gap-4 mb-6">
                        <div className="flex-1 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30 flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">Total Time</span>
                            <span className="text-2xl font-mono font-bold text-indigo-700 dark:text-indigo-300">
                                {useTimeTracking ? (
                                    // Need to access helper from context or utils
                                    // Since we can't access hook outside, we rely on prop or util
                                    // For now simplified calculation display
                                    `${Math.floor((task.totalTimeSeconds || 0) / 3600)}h ${Math.floor(((task.totalTimeSeconds || 0) % 3600) / 60)}m`
                                ) : '0h 0m'}
                            </span>
                        </div>
                        <div className="flex-1 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Est. Hours</span>
                            <span className="text-2xl font-mono font-bold text-slate-700 dark:text-slate-300">
                                {task.estimatedHours || 0}h
                            </span>
                        </div>
                    </div>

                    {/* Log List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar mb-6 space-y-2 pr-1">
                        {(!task.timeLogs || task.timeLogs.length === 0) && (
                            <div className="text-center py-8 text-slate-400">No time logs recorded yet.</div>
                        )}
                        {task.timeLogs && [...task.timeLogs].sort((a,b) => b.startTime - a.startTime).map(log => (
                            <div key={log.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors group">
                                <div>
                                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                        {new Date(log.startTime).toLocaleDateString()} • {Math.floor(log.durationSeconds / 60)}m
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex gap-2">
                                        <span>{new Date(log.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(log.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        {log.notes && <span className="italic text-slate-400 border-l border-slate-300 pl-2">{log.notes}</span>}
                                    </div>
                                </div>
                                {!isReadOnly && (
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditLogClick(log)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-600"><Pencil size={14} /></button>
                                        <button onClick={() => handleDeleteLog(log.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Manual Add Form */}
                    {!isReadOnly && (
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 -mx-6 px-6 -mb-6 pb-6">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Add Manual Entry</h4>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <input type="datetime-local" value={manualStartTime} onChange={(e) => setManualStartTime(e.target.value)} className={inputBaseClass} />
                                <input type="datetime-local" value={manualEndTime} onChange={(e) => setManualEndTime(e.target.value)} className={inputBaseClass} />
                            </div>
                            <div className="flex gap-3">
                                <input type="text" value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} placeholder="Notes (optional)" className={`${inputBaseClass} flex-1`} />
                                <button onClick={handleAddManualLog} disabled={!manualStartTime || !manualEndTime} className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-colors">Add</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Hidden Submit Button for Form submission via Enter key if needed */}
            <button type="submit" className="hidden" />
          </form>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 shrink-0 backdrop-blur-sm flex justify-between items-center">
            <div>
                {!isReadOnly && canDelete && onDelete && task && (
                    <button 
                        type="button"
                        onClick={() => onDelete(task.id)}
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors flex items-center gap-2"
                        title="Delete Task"
                    >
                        <Trash2 size={18} />
                    </button>
                )}
            </div>
            <div className="flex gap-3">
                <button 
                    type="button" 
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                    Cancel
                </button>
                {!isReadOnly && canEdit && (
                    <button 
                        type="button"
                        onClick={handleSubmit}
                        className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <Check size={18} strokeWidth={3} />
                        Save Changes
                    </button>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default TaskModal;
