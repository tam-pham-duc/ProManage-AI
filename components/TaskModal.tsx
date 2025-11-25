
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Calendar, User, AlertCircle, CheckSquare, Trash2, Plus, MessageSquare, Send, Paperclip, Link as LinkIcon, ExternalLink, Tag as TagIcon, FileText, DollarSign, AtSign, Bell, Lock, Check, Clock, GitBranch, ArrowDown, Zap, Unlock, Palmtree, CheckCircle2, Play, Square, History, Pencil, Save as SaveIcon } from 'lucide-react';
import { Task, TaskStatus, TaskPriority, Subtask, Comment, ActivityLog, Attachment, Tag, KanbanColumn, ProjectMember, TimeLog } from '../types';
import RichTextEditor from './RichTextEditor';
import { useTimeTracking } from '../context/TimeTrackingContext';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useNotification } from '../context/NotificationContext';

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
}

const toDateTimeLocal = (timestamp: number) => {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  onTaskSelect
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

  const activeMembers = useMemo(() => {
      return projectMembers.filter(m => (m.status === 'active' || !m.status) && m.uid !== null);
  }, [projectMembers]);

  // Potential Dependencies: All tasks except current one (to avoid self-loop)
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

  const isFlowBlocked = useMemo(() => {
      return upstreamTasks.some(t => t.status !== 'Done');
  }, [upstreamTasks]);

  const isTracking = task && activeTimer?.taskId === task.id;

  useEffect(() => {
    if (isOpen) {
      if (task) {
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
        setEstimatedCost(task.estimatedCost?.toString() || '');
        setActualCost(task.actualCost?.toString() || '');
        setEstimatedHours(task.estimatedHours?.toString() || '');
        setEstimatedDays(task.estimatedDays?.toString() || '');
      } else {
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
    }
  }, [isOpen, task, columns, projectMembers, initialDate]);

  const filteredMembers = useMemo(() => {
    if (!mentionQuery) return activeMembers;
    return activeMembers.filter(m => 
      m.displayName.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  }, [activeMembers, mentionQuery]);

  if (!isOpen) return null;

  // Helpers...
  const parseMarkdown = (text: string) => {
    if (!text) return '<p class="text-slate-500 italic text-sm">No content.</p>';
    let html = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/^# (.*$)/gm, '<h1 class="text-lg font-bold mt-3 mb-2 text-slate-900 dark:text-white">$1</h1>')
      .replace(/^## (.*$)/gm, '<h2 class="text-base font-bold mt-2 mb-1 text-slate-800 dark:text-slate-100">$1</h2>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/@\[(.*?)\]/g, '<span class="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1 rounded">@$1</span>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 hover:underline">$1</a>')
      .replace(/^- (.*$)/gm, '<div class="flex items-start gap-2 ml-2 my-1"><span class="mt-2 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span><span class="flex-1">$1</span></div>')
      .replace(/\n/g, '<br />');
    return html;
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString();
  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Handlers modified to respect isReadOnly...
  const handleAddSubtask = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isReadOnly || !newSubtaskTitle.trim()) return;
    const newSubtask: Subtask = { id: Date.now().toString(), title: newSubtaskTitle, completed: false };
    setSubtasks([...subtasks, newSubtask]);
    setNewSubtaskTitle('');
  };

  const handleDeleteSubtask = (id: string) => {
    if (isReadOnly) return;
    setSubtasks(subtasks.filter(st => st.id !== id));
  };
  
  const handleToggleSubtask = (id: string) => {
    if (isReadOnly) return;
    const updatedSubtasks = subtasks.map(st => st.id === id ? { ...st, completed: !st.completed } : st);
    setSubtasks(updatedSubtasks);
  };

  const handleAddAttachment = () => {
    if (isReadOnly || !newFileName.trim() || !newFileUrl.trim()) return;
    const newAttachment: Attachment = { id: Date.now().toString(), fileName: newFileName, fileUrl: newFileUrl, uploadedAt: new Date().toLocaleString() };
    setAttachments([...attachments, newAttachment]);
    setNewFileName('');
    setNewFileUrl('');
  };

  const handleDeleteAttachment = (id: string) => {
      if (isReadOnly) return;
      setAttachments(attachments.filter(att => att.id !== id));
  };

  const handleAddTag = (tag: Tag) => { 
      if (isReadOnly) return;
      if (!tags.find(t => t.id === tag.id)) setTags([...tags, tag]); setTagInput(''); setShowTagDropdown(false); 
  };
  
  const handleCreateTag = () => { 
      if (isReadOnly) return;
      if (!tagInput.trim()) return; handleAddTag(onCreateTag(tagInput.trim())); 
  };
  
  const handleRemoveTag = (tagId: string) => {
      if (isReadOnly) return;
      setTags(tags.filter(t => t.id !== tagId));
  };

  const handleToggleDependency = (depTaskId: string) => {
     if (isReadOnly) return;
     if (dependencies.includes(depTaskId)) {
         setDependencies(prev => prev.filter(id => id !== depTaskId));
     } else {
         setDependencies(prev => [...prev, depTaskId]);
     }
  };

  const handleSendComment = () => {
    if (!newComment.trim()) return;
    // Comments allowed even in read-only (usually) - but for strict Guest mode, maybe not?
    if (isReadOnly) return; 
    
    setComments([...comments, { id: Date.now().toString(), user: currentUser, text: newComment, timestamp: new Date().toLocaleString() }]);
    setNewComment('');
    setShowMentionList(false);
  };

  // --- TIME LOG MANAGEMENT ---
  const handleDeleteLog = async (logId: string) => {
    if (!task) return;
    if (!window.confirm("Remove this time entry?")) return;

    const updatedLogs = (task.timeLogs || []).filter(l => l.id !== logId);
    const newTotal = updatedLogs.reduce((acc, l) => acc + l.durationSeconds, 0);

    try {
        await updateDoc(doc(db, 'tasks', task.id), {
            timeLogs: updatedLogs,
            totalTimeSeconds: newTotal
        });
        notify('success', 'Time log deleted');
    } catch (e) {
        console.error(e);
        notify('error', 'Failed to delete log');
    }
  };

  const handleEditLogClick = (log: TimeLog) => {
    setEditingLog(log);
    setEditStartTime(toDateTimeLocal(log.startTime));
    setEditEndTime(toDateTimeLocal(log.endTime));
  };

  const handleUpdateLog = async () => {
    if (!task || !editingLog) return;
    
    const start = new Date(editStartTime).getTime();
    const end = new Date(editEndTime).getTime();

    if (isNaN(start) || isNaN(end)) {
        notify('warning', 'Invalid date/time');
        return;
    }

    if (end <= start) {
        notify('warning', 'End time must be after start time');
        return;
    }

    const durationSeconds = Math.floor((end - start) / 1000);
    
    const updatedLog = { ...editingLog, startTime: start, endTime: end, durationSeconds };
    const updatedLogs = (task.timeLogs || []).map(l => l.id === editingLog.id ? updatedLog : l);
    const newTotal = updatedLogs.reduce((acc, l) => acc + l.durationSeconds, 0);

    try {
        await updateDoc(doc(db, 'tasks', task.id), {
            timeLogs: updatedLogs,
            totalTimeSeconds: newTotal
        });
        notify('success', 'Time log updated');
        setEditingLog(null);
    } catch (e) {
        console.error(e);
        notify('error', 'Failed to update log');
    }
  };

  // Mention Logic
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    const val = e.target.value;
    setNewComment(val);
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const match = textBefore.match(/(?:^|\s)@(\w*)$/);

    if (match) {
      const query = match[1];
      setMentionQuery(query);
      setShowMentionList(true);
      setMentionHighlightIndex(0);
    } else {
      setShowMentionList(false);
    }
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
        setTimeout(() => {
            if (commentInputRef.current) {
                commentInputRef.current.focus();
                const newCursorPos = prefix.length + mentionTag.length;
                commentInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);
    } else {
        setNewComment(prev => prev + `@[${memberName}] `);
    }
    setShowMentionList(false);
    setMentionQuery('');
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !showMentionList) {
        e.preventDefault();
        handleSendComment();
        return;
    }
    if (showMentionList && filteredMembers.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setMentionHighlightIndex(prev => (prev + 1) % filteredMembers.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setMentionHighlightIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            handleInsertMention(filteredMembers[mentionHighlightIndex].displayName);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setShowMentionList(false);
        }
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

  const completedCount = subtasks.filter(st => st.completed).length;
  const progressPercentage = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;
  const filteredAvailableTags = availableTags.filter(at => at.name.toLowerCase().includes(tagInput.toLowerCase()) && !tags.find(t => t.id === at.id));
  const streamItems = [...comments.map(c => ({ ...c, type: 'comment' })), ...activityLog.map(l => ({ ...l, type: 'log' }))].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const inputBaseClass = `w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white font-medium placeholder-slate-400 text-sm ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300 border border-slate-200 dark:border-slate-700 relative">
        
        {/* Edit Log Mini Modal */}
        {editingLog && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 w-80 border border-slate-200 dark:border-slate-700 animate-fade-in">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Edit Time Entry</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Start Time</label>
                            <input 
                                type="datetime-local" 
                                value={editStartTime}
                                onChange={(e) => setEditStartTime(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">End Time</label>
                            <input 
                                type="datetime-local" 
                                value={editEndTime}
                                onChange={(e) => setEditEndTime(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 mt-6">
                        <button 
                            onClick={() => setEditingLog(null)}
                            className="flex-1 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleUpdateLog}
                            className="flex-1 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <SaveIcon size={14} />
                            Save
                        </button>
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
              
              {/* Timer Control in Header */}
              {task && !isReadOnly && (
                  <button
                    onClick={() => isTracking ? stopTimer() : startTimer(task)}
                    className={`ml-4 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all border
                        ${isTracking 
                            ? 'bg-red-100 text-red-600 border-red-200 animate-pulse' 
                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200'
                        }
                    `}
                  >
                      {isTracking ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                      {isTracking ? 'STOP' : 'START TIMER'}
                      {(isTracking || (task.totalTimeSeconds || 0) > 0) && (
                          <span className="ml-1 opacity-80 font-mono">
                              {formatDuration((task.totalTimeSeconds || 0) + (isTracking ? 0 : 0))}
                          </span>
                      )}
                  </button>
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
          {task && (
              <button onClick={() => setActiveTab('flow')} className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'flow' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                  Task Flow <GitBranch size={14} className={activeTab === 'flow' ? 'text-indigo-500' : ''} />
              </button>
          )}
          {task && (
              <button onClick={() => setActiveTab('timeLogs')} className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'timeLogs' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                  Time Logs <History size={14} className={activeTab === 'timeLogs' ? 'text-indigo-500' : ''} />
              </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white dark:bg-slate-800">
          <form id="taskForm" onSubmit={handleSubmit} className="space-y-7 h-full">
            {activeTab === 'details' && (
              <>
                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Task Title</label>
                    <input type="text" required readOnly={isReadOnly} value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputBaseClass} text-lg`} placeholder="Task Name" />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <FileText size={12} /> Description
                    </label>
                    {/* If readOnly, show parsed markdown instead of editor */}
                    {isReadOnly ? (
                        <div 
                            className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl min-h-[100px] prose prose-sm dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: parseMarkdown(description) }}
                        />
                    ) : (
                        <RichTextEditor value={description} onChange={setDescription} placeholder="Add detailed description here..." />
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Status</label>
                        <select disabled={isReadOnly} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className={inputBaseClass}>
                            {columns.map(col => <option key={col.id} value={col.title}>{col.title}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Priority</label>
                        <select disabled={isReadOnly} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={inputBaseClass}>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                        </select>
                    </div>
                </div>

                {/* Dates & Assignee */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Calendar size={12} /> Start</label>
                        <input type="date" required readOnly={isReadOnly} value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputBaseClass} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertCircle size={12} /> Due</label>
                        <input type="date" required readOnly={isReadOnly} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputBaseClass} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><User size={12} /> Assignee</label>
                        <select 
                          disabled={isReadOnly}
                          value={assigneeId} 
                          onChange={(e) => {
                              const uid = e.target.value;
                              setAssigneeId(uid);
                              if (uid === 'UN') {
                                  setAssignee('Unassigned');
                                  setAssigneeAvatar('');
                              } else {
                                  const member = projectMembers.find(m => m.uid === uid);
                                  if (member) {
                                      setAssignee(member.displayName);
                                      setAssigneeAvatar(member.avatar || '');
                                  }
                              }
                          }} 
                          className={`${inputBaseClass} cursor-pointer`}
                        >
                          <option value="UN">Unassigned</option>
                          {activeMembers.map(member => (
                                <option key={member.uid!} value={member.uid!}>
                                  {member.displayName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                
                {/* Task Dependencies */}
                <div className="relative">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <LinkIcon size={12} /> Dependencies / Prerequisites
                    </label>
                    
                    <div className="flex flex-wrap gap-2 mb-2">
                       {dependencies.map(depId => {
                           const parentTask = allTasks.find(t => t.id === depId);
                           const isCompleted = parentTask?.status === 'Done';
                           return (
                               <span 
                                  key={depId} 
                                  className={`px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 border ${isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}
                                >
                                   {parentTask ? parentTask.title : 'Unknown Task'}
                                   {!isReadOnly && (
                                     <button type="button" onClick={() => handleToggleDependency(depId)} className="hover:bg-black/10 rounded-full p-0.5">
                                       <X size={12} />
                                     </button>
                                   )}
                               </span>
                           );
                       })}
                    </div>

                    {!isReadOnly && (
                       <div className="relative">
                          <button 
                              type="button" 
                              onClick={() => setShowDependencyDropdown(!showDependencyDropdown)}
                              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                          >
                             <Plus size={12} /> Add Dependency
                          </button>
                          
                          {showDependencyDropdown && (
                             <>
                                <div className="fixed inset-0 z-30" onClick={() => setShowDependencyDropdown(false)}></div>
                                <div className="absolute z-40 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                                   <div className="p-2 text-xs text-slate-400 font-medium border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">Select tasks that must be completed before this one:</div>
                                   {potentialDependencies.map(pt => {
                                       const isSelected = dependencies.includes(pt.id);
                                       return (
                                          <button 
                                             key={pt.id}
                                             type="button"
                                             onClick={() => handleToggleDependency(pt.id)}
                                             className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                                          >
                                             <div className="flex flex-col min-w-0">
                                                <span className={`font-medium truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{pt.title}</span>
                                                <span className="text-[10px] text-slate-500">{pt.status}</span>
                                             </div>
                                             {isSelected && <Check size={14} className="text-indigo-600" />}
                                          </button>
                                       );
                                   })}
                                   {potentialDependencies.length === 0 && (
                                       <div className="p-4 text-center text-sm text-slate-400">No other tasks available.</div>
                                   )}
                                </div>
                             </>
                          )}
                       </div>
                    )}
                </div>

                {/* Reminder Settings */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                       <Bell size={12} /> Remind me
                    </label>
                    <select 
                        disabled={isReadOnly}
                        value={reminderDays} 
                        onChange={(e) => setReminderDays(Number(e.target.value))} 
                        className={`${inputBaseClass} cursor-pointer`}
                    >
                        <option value={-1}>Don't remind</option>
                        <option value={0}>On Due Date</option>
                        <option value={1}>1 Day Before</option>
                        <option value={2}>2 Days Before</option>
                        <option value={7}>1 Week Before</option>
                    </select>
                </div>
                
                {/* Tags */}
                 <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><TagIcon size={12} /> Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map(tag => (
                      <span key={tag.id} className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 ${tag.colorClass}`}>
                        {tag.name}
                        {!isReadOnly && <button type="button" onClick={() => handleRemoveTag(tag.id)} className="hover:bg-black/10 rounded-full p-0.5"><X size={12} /></button>}
                      </span>
                    ))}
                  </div>
                  {!isReadOnly && (
                      <div className="relative">
                        <input type="text" value={tagInput} onChange={(e) => { setTagInput(e.target.value); setShowTagDropdown(true); }} onFocus={() => setShowTagDropdown(true)} onBlur={() => setTimeout(() => setShowTagDropdown(false), 200)} placeholder="+ Add tag" className={inputBaseClass} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateTag(); } }} />
                        {showTagDropdown && (tagInput || filteredAvailableTags.length > 0) && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                            {filteredAvailableTags.map(tag => (
                            <button key={tag.id} type="button" onClick={() => handleAddTag(tag)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${tag.colorClass.split(' ')[0]}`}></span>{tag.name}</button>
                            ))}
                            {tagInput && !filteredAvailableTags.find(t => t.name.toLowerCase() === tagInput.toLowerCase()) && (
                            <button type="button" onClick={handleCreateTag} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold">Create "{tagInput}"</button>
                            )}
                        </div>
                        )}
                    </div>
                  )}
                </div>

                {/* Time Estimation */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700/50">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1"><Clock size={12} /> Time Estimation</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="relative">
                        <input type="number" min="0" step="0.5" readOnly={isReadOnly} value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} className={inputBaseClass} placeholder="0" />
                         <span className="absolute right-4 top-3.5 text-slate-400 text-xs font-bold pointer-events-none">HRS</span>
                     </div>
                     <div className="relative">
                        <input type="number" min="0" step="0.5" readOnly={isReadOnly} value={estimatedDays} onChange={(e) => setEstimatedDays(e.target.value)} className={inputBaseClass} placeholder="0" />
                        <span className="absolute right-4 top-3.5 text-slate-400 text-xs font-bold pointer-events-none">DAYS</span>
                     </div>
                  </div>
                </div>

                {/* Financials */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700/50">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1"><DollarSign size={12} /> Financials</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="relative">
                        <span className="absolute left-4 top-3.5 text-slate-400 font-bold">$</span>
                        <input type="number" readOnly={isReadOnly} value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} className={`${inputBaseClass} pl-8`} placeholder="0.00" />
                        <label className="block text-[10px] font-bold text-slate-500 mt-1 ml-1 uppercase">Estimated</label>
                     </div>
                     <div className="relative">
                        <span className="absolute left-4 top-3.5 text-slate-400 font-bold">$</span>
                        <input type="number" readOnly={isReadOnly} value={actualCost} onChange={(e) => setActualCost(e.target.value)} className={`${inputBaseClass} pl-8`} placeholder="0.00" />
                        <label className="block text-[10px] font-bold text-slate-500 mt-1 ml-1 uppercase">Actual</label>
                     </div>
                  </div>
                </div>

                {/* Checklist */}
                <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><CheckSquare size={16} className="text-indigo-500" /> Checklist</label>
                    {subtasks.length > 0 && <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">{completedCount}/{subtasks.length} Done</span>}
                  </div>
                  {subtasks.length > 0 && (
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mb-4 overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all duration-300 ease-out" style={{ width: `${progressPercentage}%` }} />
                    </div>
                  )}
                  <div className="space-y-2 mb-4">
                    {subtasks.map((st) => (
                      <div key={st.id} className="flex items-center gap-3 group p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-600">
                        <button type="button" onClick={() => handleToggleSubtask(st.id)} disabled={isReadOnly} className={`flex-shrink-0 w-5 h-5 rounded border transition-all flex items-center justify-center ${st.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 bg-white dark:bg-slate-800'}`}>{st.completed && <CheckSquare size={14} />}</button>
                        <span className={`flex-1 text-sm font-medium transition-all ${st.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{st.title}</span>
                        {!isReadOnly && <button type="button" onClick={() => handleDeleteSubtask(st.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"><Trash2 size={16} /></button>}
                      </div>
                    ))}
                  </div>
                  {!isReadOnly && (
                    <div className="flex gap-2">
                        <input type="text" value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())} className={inputBaseClass} placeholder="Add an item..." />
                        <button type="button" onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()} className="px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl transition-colors disabled:opacity-50"><Plus size={20} /></button>
                    </div>
                  )}
                </div>

                {/* Attachments */}
                <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                  <label className="block text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3"><Paperclip size={16} className="text-indigo-500" /> Attachments</label>
                   {attachments.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {attachments.map((att) => (
                        <div key={att.id} className="flex items-center gap-3 group p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-600">
                          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0"><Paperclip size={18} /></div>
                          <div className="flex-1 min-w-0">
                             <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 truncate">{att.fileName}<ExternalLink size={12} /></a>
                             <p className="text-[10px] text-slate-400 font-medium">Uploaded {att.uploadedAt}</p>
                          </div>
                          {!isReadOnly && <button type="button" onClick={() => handleDeleteAttachment(att.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"><Trash2 size={16} /></button>}
                        </div>
                      ))}
                    </div>
                  )}
                  {!isReadOnly && (
                    <div className="flex gap-2">
                        <input type="text" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} className={`${inputBaseClass} w-1/3`} placeholder="Name" />
                        <input type="url" value={newFileUrl} onChange={(e) => setNewFileUrl(e.target.value)} className={`${inputBaseClass} flex-1`} placeholder="URL" />
                        <button type="button" onClick={handleAddAttachment} disabled={!newFileName.trim() || !newFileUrl.trim()} className="px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl transition-colors disabled:opacity-50 font-bold">Add</button>
                    </div>
                  )}
                </div>

              </>
            )}

            {activeTab === 'discussion' && (
              <div className="flex flex-col h-full min-h-[400px]">
                <div className="flex-1 space-y-6 mb-4 overflow-y-auto pr-2 custom-scrollbar">
                  {streamItems.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                      <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No activity recorded yet.</p>
                    </div>
                  ) : (
                    streamItems.map((item: any) => (
                      item.type === 'log' ? (
                        <div key={item.id} className="flex items-center gap-3 py-2 justify-center opacity-70 hover:opacity-100 transition-opacity">
                           <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                           <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{item.timestamp.split(',')[0]} • {item.action}</p>
                           <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                        </div>
                      ) : (
                        <div key={item.id} className={`flex gap-4 ${item.user === currentUser ? 'flex-row-reverse' : ''}`}>
                          <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border-2 border-white dark:border-slate-700 flex items-center justify-center text-xs font-extrabold text-indigo-700 dark:text-indigo-400 shadow-sm flex-shrink-0">
                            {item.user.substring(0, 2)}
                          </div>
                          <div className={`flex flex-col ${item.user === currentUser ? 'items-end' : 'items-start'} max-w-[85%]`}>
                             <div className="flex items-center gap-2 mb-1 px-1">
                               <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.user}</span>
                               <span className="text-xs text-slate-400">{item.timestamp}</span>
                             </div>
                             <div 
                               className={`p-3.5 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${item.user === currentUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none'}`}
                               dangerouslySetInnerHTML={{ __html: parseMarkdown(item.text) }}
                             />
                          </div>
                        </div>
                      )
                    ))
                  )}
                </div>
                
                {/* Comment Input (Hidden if Read-Only Guest) */}
                {!isReadOnly && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700 relative">
                    {showMentionList && filteredMembers.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-20 animate-fade-in">
                        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-500 flex justify-between">
                            <span>Mention Member</span>
                            <span className="text-[10px] opacity-70">↑↓ to navigate, Enter to select</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar">
                            {filteredMembers.map((m, index) => (
                            <button 
                                key={m.uid || m.email}
                                type="button"
                                onClick={() => handleInsertMention(m.displayName)}
                                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors
                                    ${index === mentionHighlightIndex 
                                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' 
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                                    }
                                `}
                            >
                                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 overflow-hidden shrink-0">
                                {m.avatar && m.avatar.startsWith('http') ? <img src={m.avatar} alt="" className="w-full h-full object-cover" /> : m.displayName.charAt(0)}
                                </div>
                                <span className="truncate font-medium">{m.displayName}</span>
                            </button>
                            ))}
                        </div>
                        </div>
                    )}

                    <div className="flex gap-2 items-end">
                        <div className="relative flex-1">
                        <textarea 
                            ref={commentInputRef}
                            value={newComment} 
                            onChange={handleCommentChange}
                            onKeyDown={handleCommentKeyDown}
                            placeholder="Write a comment... (Use @ to mention)" 
                            className={`${inputBaseClass} resize-none py-3 pr-10`} 
                            rows={1} 
                        />
                        <button 
                            type="button"
                            onClick={() => {
                                setMentionQuery('');
                                setShowMentionList(!showMentionList);
                                if (!showMentionList) setTimeout(() => commentInputRef.current?.focus(), 0);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors"
                            title="Mention someone"
                        >
                            <AtSign size={18} />
                        </button>
                        </div>
                        <button type="button" onClick={handleSendComment} disabled={!newComment.trim()} className="h-[46px] w-[46px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-md"><Send size={20} /></button>
                    </div>
                    </div>
                )}
                {isReadOnly && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700 text-center text-slate-400 text-xs italic">
                        Read-only mode: Comments are disabled.
                    </div>
                )}
              </div>
            )}

            {activeTab === 'timeLogs' && (
                <div className="flex flex-col h-full min-h-[400px] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800 p-1">
                    <div className="flex justify-between items-center mb-6 px-2">
                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <History size={20} className="text-indigo-500" />
                            Work Log History
                        </h3>
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-600">
                            Total: {formatDuration(task?.totalTimeSeconds || 0)}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">User</th>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Start</th>
                                    <th className="px-4 py-3">End</th>
                                    <th className="px-4 py-3 text-right">Duration</th>
                                    {!isReadOnly && <th className="px-4 py-3 text-center w-16">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                                {(task?.timeLogs || []).sort((a, b) => b.endTime - a.endTime).map(log => {
                                    const user = projectMembers.find(m => m.uid === log.userId);
                                    const isOwner = currentUserId === log.userId || currentUserId === task?.ownerId;

                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0">
                                                        {user?.avatar && user.avatar.startsWith('http') ? (
                                                            <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                                                        ) : (
                                                            (user?.displayName || 'U').charAt(0)
                                                        )}
                                                    </div>
                                                    <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[100px]">{user?.displayName || 'Unknown'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs">
                                                {formatDate(log.startTime)}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs whitespace-nowrap">
                                                {formatTime(log.startTime)}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs whitespace-nowrap">
                                                {formatTime(log.endTime)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="inline-block px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded font-bold text-xs font-mono">
                                                    {formatDuration(log.durationSeconds)}
                                                </span>
                                            </td>
                                            {!isReadOnly && (
                                                <td className="px-4 py-3 text-center">
                                                    {isOwner && (
                                                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={() => handleEditLogClick(log)}
                                                                className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteLog(log.id)}
                                                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                                {(!task?.timeLogs || task.timeLogs.length === 0) && (
                                    <tr>
                                        <td colSpan={isReadOnly ? 5 : 6} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 italic">
                                            No time logs recorded yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'flow' && (
                <div className="flex flex-col h-full min-h-[500px] overflow-y-auto custom-scrollbar p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl relative">
                    
                    {/* Empty State */}
                    {upstreamTasks.length === 0 && downstreamTasks.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 opacity-60">
                            <div className="bg-emerald-100 dark:bg-emerald-900/30 p-6 rounded-full mb-4">
                                <Palmtree size={48} className="text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Independent Island! 🏝️</h3>
                            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
                                This task has no dependencies or blockers. It's free to be worked on at any time!
                            </p>
                        </div>
                    )}

                    {(upstreamTasks.length > 0 || downstreamTasks.length > 0) && (
                        <div className="flex flex-col items-center gap-6 relative z-10 w-full max-w-3xl mx-auto py-8">
                            
                            {/* UPSTREAM SECTION */}
                            {upstreamTasks.length > 0 && (
                                <div className="w-full flex flex-col items-center gap-4">
                                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        Waiting For...
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-4">
                                        {upstreamTasks.map(up => (
                                            <div 
                                                key={up.id}
                                                onClick={() => onTaskSelect && onTaskSelect(up)}
                                                className={`
                                                    group relative w-48 p-3 rounded-xl border-2 transition-all cursor-pointer hover:-translate-y-1 hover:shadow-md bg-white dark:bg-slate-800
                                                    ${up.status === 'Done' 
                                                        ? 'border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-400' 
                                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                                    }
                                                `}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${up.status === 'Done' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                                                        {up.status}
                                                    </span>
                                                    {up.status === 'Done' && <CheckCircle2 size={12} className="text-emerald-500" />}
                                                </div>
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug">
                                                    {up.title}
                                                </p>
                                                
                                                {/* Connecting Line Down (Pseudo) */}
                                                <div className="absolute top-full left-1/2 w-0.5 h-6 bg-slate-300 dark:bg-slate-600 -translate-x-1/2 -z-10"></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* CONNECTOR 1 (Upstream -> Current) */}
                            {upstreamTasks.length > 0 && (
                                <div className="flex flex-col items-center -my-2 z-10">
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-sm relative z-20
                                        ${isFlowBlocked 
                                            ? 'bg-rose-50 border-rose-200 text-rose-500 dark:bg-rose-900/20 dark:border-rose-800' 
                                            : 'bg-emerald-50 border-emerald-200 text-emerald-500 dark:bg-emerald-900/20 dark:border-emerald-800'
                                        }
                                    `}>
                                        {isFlowBlocked ? <Lock size={14} /> : <Zap size={14} />}
                                    </div>
                                    <div className={`w-0.5 h-6 ${isFlowBlocked ? 'bg-slate-300 dark:bg-slate-600 border-l border-dashed border-slate-400' : 'bg-emerald-400 dark:bg-emerald-600'}`}></div>
                                </div>
                            )}

                            {/* CURRENT TASK (HERO) */}
                            <div className="w-full max-w-sm p-5 bg-white dark:bg-slate-800 rounded-2xl border-2 border-indigo-500 shadow-xl relative z-10 animate-fade-in ring-4 ring-indigo-500/10">
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                    Current Task
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white text-center mb-2">{title}</h3>
                                <div className="flex justify-center gap-2">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">{status}</span>
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">{priority} Priority</span>
                                </div>
                            </div>

                            {/* CONNECTOR 2 (Current -> Downstream) */}
                            {downstreamTasks.length > 0 && (
                                <div className="flex flex-col items-center -my-2 z-10">
                                    <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-600"></div>
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-400 shadow-sm relative z-20">
                                        <Unlock size={14} />
                                    </div>
                                    <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-600"></div>
                                </div>
                            )}

                            {/* DOWNSTREAM SECTION */}
                            {downstreamTasks.length > 0 && (
                                <div className="w-full flex flex-col items-center gap-4">
                                     <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        Unlocks Next...
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-4">
                                        {downstreamTasks.map(down => (
                                            <div 
                                                key={down.id}
                                                onClick={() => onTaskSelect && onTaskSelect(down)}
                                                className="group relative w-48 p-3 bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:-translate-y-1 hover:shadow-md transition-all cursor-pointer"
                                            >
                                                {/* Line Up (Pseudo) */}
                                                <div className="absolute bottom-full left-1/2 w-0.5 h-6 bg-slate-300 dark:bg-slate-600 -translate-x-1/2 -z-10"></div>

                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                                                        {down.status}
                                                    </span>
                                                    <ArrowDown size={12} className="text-slate-400" />
                                                </div>
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug">
                                                    {down.title}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
          </form>
        </div>

        {/* Footer */}
        {activeTab === 'details' && (
          <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 shrink-0 flex gap-3 items-center backdrop-blur-sm">
              {task && onDelete && canDelete && (
                <button type="button" onClick={() => onDelete(task.id)} className="p-3.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900"><Trash2 size={20} /></button>
              )}
              <button type="button" onClick={onClose} className="flex-1 py-3.5 px-4 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all active:scale-95">Cancel</button>
              {(!isReadOnly && canEdit) && (
                  <button type="submit" form="taskForm" className="flex-1 py-3.5 px-4 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 active:scale-95 hover:-translate-y-0.5">{task ? 'Save Changes' : 'Create Task'}</button>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskModal;
