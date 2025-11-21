
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Calendar, User, AlertCircle, CheckSquare, Trash2, Plus, MessageSquare, Send, Paperclip, Link as LinkIcon, ExternalLink, Tag as TagIcon, FileText, DollarSign, AtSign, Bell } from 'lucide-react';
import { Task, TaskStatus, TaskPriority, Subtask, Comment, ActivityLog, Attachment, Tag, KanbanColumn, ProjectMember } from '../types';
import RichTextEditor from './RichTextEditor';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Partial<Task>) => void;
  onDelete?: (taskId: string) => void;
  task?: Task;
  currentUser: string;
  availableTags: Tag[];
  onCreateTag: (name: string) => Tag;
  columns: KanbanColumn[];
  projectMembers?: ProjectMember[];
  initialDate?: string; // New prop for pre-filling dates
}

const TaskModal: React.FC<TaskModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  onDelete,
  task, 
  currentUser,
  availableTags,
  onCreateTag,
  columns,
  projectMembers = [],
  initialDate
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'discussion'>('details');
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('To Do');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reminderDays, setReminderDays] = useState<number>(1); // Default 1 day before
  
  // Assignee State
  const [assignee, setAssignee] = useState(''); // Display Name
  const [assigneeId, setAssigneeId] = useState(''); // UID
  const [assigneeAvatar, setAssigneeAvatar] = useState(''); // Avatar URL
  
  const [estimatedCost, setEstimatedCost] = useState('');
  const [actualCost, setActualCost] = useState('');
  
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

  // Filter active members only for assignment
  const activeMembers = useMemo(() => {
      return projectMembers.filter(m => (m.status === 'active' || !m.status) && m.uid !== null); // Support legacy without status and ensure UID exists
  }, [projectMembers]);

  // Reset or Populate form
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
        
        // Load Assignee
        setAssignee(task.assignee);
        setAssigneeId(task.assigneeId || '');
        setAssigneeAvatar(task.assigneeAvatar || '');
        
        // Fallback logic: if no ID but name exists, try to find in members to update logic
        if (!task.assigneeId && task.assignee && task.assignee !== 'UN' && projectMembers.length > 0) {
           // Try to match by initials or display name (imperfect but helpful)
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
        setEstimatedCost(task.estimatedCost?.toString() || '');
        setActualCost(task.actualCost?.toString() || '');
      } else {
        setTitle('');
        setDescription('');
        setStatus(columns.length > 0 ? columns[0].title : 'To Do');
        setPriority('Medium');
        // Use initialDate if provided, otherwise today
        const defaultDate = initialDate || new Date().toISOString().split('T')[0];
        setStartDate(defaultDate);
        setDueDate(initialDate || ''); // Only set due date if initialDate exists, otherwise blank forces user choice
        setReminderDays(1);
        setAssignee('Unassigned');
        setAssigneeId('UN');
        setAssigneeAvatar('');
        setSubtasks([]);
        setComments([]);
        setActivityLog([]);
        setAttachments([]);
        setTags([]);
        setEstimatedCost('');
        setActualCost('');
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
    }
  }, [isOpen, task, columns, projectMembers, initialDate]);

  // Filtered Members for Mentions (Allow mentioning anyone, even pending if needed, but usually active)
  const filteredMembers = useMemo(() => {
    if (!mentionQuery) return activeMembers;
    return activeMembers.filter(m => 
      m.displayName.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  }, [activeMembers, mentionQuery]);

  if (!isOpen) return null;

  // Keep legacy markdown parser for Comments/Activity Logs
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

  const handleAddSubtask = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const newSubtask: Subtask = { id: Date.now().toString(), title: newSubtaskTitle, completed: false };
    setSubtasks([...subtasks, newSubtask]);
    setNewSubtaskTitle('');
  };

  const handleDeleteSubtask = (id: string) => setSubtasks(subtasks.filter(st => st.id !== id));
  const handleToggleSubtask = (id: string) => {
    const updatedSubtasks = subtasks.map(st => st.id === id ? { ...st, completed: !st.completed } : st);
    setSubtasks(updatedSubtasks);
  };

  const handleAddAttachment = () => {
    if (!newFileName.trim() || !newFileUrl.trim()) return;
    const newAttachment: Attachment = { id: Date.now().toString(), fileName: newFileName, fileUrl: newFileUrl, uploadedAt: new Date().toLocaleString() };
    setAttachments([...attachments, newAttachment]);
    setNewFileName('');
    setNewFileUrl('');
  };

  const handleDeleteAttachment = (id: string) => setAttachments(attachments.filter(att => att.id !== id));

  const handleAddTag = (tag: Tag) => { if (!tags.find(t => t.id === tag.id)) setTags([...tags, tag]); setTagInput(''); setShowTagDropdown(false); };
  const handleCreateTag = () => { if (!tagInput.trim()) return; handleAddTag(onCreateTag(tagInput.trim())); };
  const handleRemoveTag = (tagId: string) => setTags(tags.filter(t => t.id !== tagId));

  const handleSendComment = () => {
    if (!newComment.trim()) return;
    setComments([...comments, { id: Date.now().toString(), user: currentUser, text: newComment, timestamp: new Date().toLocaleString() }]);
    setNewComment('');
    setShowMentionList(false);
  };

  // --- Mention Logic ---
  
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewComment(val);

    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    // Regex to find an @ symbol at the end of the text or preceded by a space
    const match = textBefore.match(/(?:^|\s)@(\w*)$/);

    if (match) {
      const query = match[1];
      setMentionQuery(query);
      setShowMentionList(true);
      setMentionHighlightIndex(0); // Reset highlight
    } else {
      setShowMentionList(false);
    }
  };

  const handleInsertMention = (memberName: string) => {
    if (!commentInputRef.current) return;
    
    const cursorPos = commentInputRef.current.selectionStart;
    const textBefore = newComment.slice(0, cursorPos);
    const textAfter = newComment.slice(cursorPos);
    
    // Find the trigger @... to replace
    const match = textBefore.match(/(?:^|\s)@(\w*)$/);
    
    if (match) {
        // Calculate where the @ started
        const matchIndex = match.index! + (match[0].startsWith(' ') ? 1 : 0);
        const prefix = newComment.slice(0, matchIndex);
        
        const mentionTag = `@[${memberName}] `;
        const newText = prefix + mentionTag + textAfter;
        
        setNewComment(newText);
        
        // Restore focus and move cursor
        setTimeout(() => {
            if (commentInputRef.current) {
                commentInputRef.current.focus();
                const newCursorPos = prefix.length + mentionTag.length;
                commentInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);
    } else {
        // Manual button click case (append)
        setNewComment(prev => prev + `@[${memberName}] `);
    }
    
    setShowMentionList(false);
    setMentionQuery('');
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (if list not open)
    if (e.key === 'Enter' && !e.shiftKey && !showMentionList) {
        e.preventDefault();
        handleSendComment();
        return;
    }

    // Mention List Navigation
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
    onSubmit({
      title, description, status, priority, startDate, dueDate, 
      assignee: assignee || 'Unassigned',
      assigneeId: assigneeId || 'UN',
      assigneeAvatar: assigneeAvatar,
      subtasks, comments, activityLog, attachments, tags,
      estimatedCost: parseFloat(estimatedCost) || 0, 
      actualCost: parseFloat(actualCost) || 0,
      reminderDays: reminderDays
    });
  };

  const completedCount = subtasks.filter(st => st.completed).length;
  const progressPercentage = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;
  const filteredAvailableTags = availableTags.filter(at => at.name.toLowerCase().includes(tagInput.toLowerCase()) && !tags.find(t => t.id === at.id));
  const streamItems = [...comments.map(c => ({ ...c, type: 'comment' })), ...activityLog.map(l => ({ ...l, type: 'log' }))].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const inputBaseClass = "w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white font-medium placeholder-slate-400 text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300 border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/80 shrink-0 backdrop-blur-sm">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <div className="w-2 h-6 bg-indigo-500 rounded-full shadow-sm"></div>
                {task ? 'Edit Task' : 'New Task'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-4 font-medium">ID: {task?.id || 'Draft'}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors">
                <X size={22} />
            </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 gap-6">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('discussion')}
            className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'discussion' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            Discussion 
            <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-xs text-slate-700 dark:text-slate-300 font-bold">{comments.length}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white dark:bg-slate-800">
          <form id="taskForm" onSubmit={handleSubmit} className="space-y-7">
            {activeTab === 'details' && (
              <>
                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Task Title</label>
                    <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputBaseClass} text-lg`} placeholder="Task Name" />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <FileText size={12} /> Description
                    </label>
                    {/* Rich Text Editor Replacement */}
                    <RichTextEditor 
                        value={description} 
                        onChange={setDescription} 
                        placeholder="Add detailed description here..." 
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className={inputBaseClass}>
                            {columns.map(col => (
                                <option key={col.id} value={col.title}>{col.title}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Priority</label>
                        <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={inputBaseClass}>
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
                        <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputBaseClass} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertCircle size={12} /> Due</label>
                        <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputBaseClass} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><User size={12} /> Assignee</label>
                        <select 
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

                {/* Reminder Settings */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                       <Bell size={12} /> Remind me
                    </label>
                    <select 
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
                        <button type="button" onClick={() => handleRemoveTag(tag.id)} className="hover:bg-black/10 rounded-full p-0.5"><X size={12} /></button>
                      </span>
                    ))}
                  </div>
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
                </div>

                {/* Financials */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700/50">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1"><DollarSign size={12} /> Financials</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="relative">
                        <span className="absolute left-4 top-3.5 text-slate-400 font-bold">$</span>
                        <input type="number" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} className={`${inputBaseClass} pl-8`} placeholder="0.00" />
                        <label className="block text-[10px] font-bold text-slate-500 mt-1 ml-1 uppercase">Estimated</label>
                     </div>
                     <div className="relative">
                        <span className="absolute left-4 top-3.5 text-slate-400 font-bold">$</span>
                        <input type="number" value={actualCost} onChange={(e) => setActualCost(e.target.value)} className={`${inputBaseClass} pl-8`} placeholder="0.00" />
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
                        <button type="button" onClick={() => handleToggleSubtask(st.id)} className={`flex-shrink-0 w-5 h-5 rounded border transition-all flex items-center justify-center ${st.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 bg-white dark:bg-slate-800'}`}>{st.completed && <CheckSquare size={14} />}</button>
                        <span className={`flex-1 text-sm font-medium transition-all ${st.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{st.title}</span>
                        <button type="button" onClick={() => handleDeleteSubtask(st.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())} className={inputBaseClass} placeholder="Add an item..." />
                    <button type="button" onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()} className="px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl transition-colors disabled:opacity-50"><Plus size={20} /></button>
                  </div>
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
                          <button type="button" onClick={() => handleDeleteAttachment(att.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                      <input type="text" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} className={`${inputBaseClass} w-1/3`} placeholder="Name" />
                      <input type="url" value={newFileUrl} onChange={(e) => setNewFileUrl(e.target.value)} className={`${inputBaseClass} flex-1`} placeholder="URL" />
                      <button type="button" onClick={handleAddAttachment} disabled={!newFileName.trim() || !newFileUrl.trim()} className="px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl transition-colors disabled:opacity-50 font-bold">Add</button>
                  </div>
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
                               <span className="text-[10px] text-slate-400">{item.timestamp}</span>
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
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700 relative">
                   {/* Smart Mention Popup */}
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
                            setMentionQuery(''); // Clear query for full list
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
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        {activeTab === 'details' && (
          <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 shrink-0 flex gap-3 items-center backdrop-blur-sm">
              {task && onDelete && (
                <button type="button" onClick={() => onDelete(task.id)} className="p-3.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900"><Trash2 size={20} /></button>
              )}
              <button type="button" onClick={onClose} className="flex-1 py-3.5 px-4 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all active:scale-95">Cancel</button>
              <button type="submit" form="taskForm" className="flex-1 py-3.5 px-4 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 active:scale-95 hover:-translate-y-0.5">{task ? 'Save Changes' : 'Create Task'}</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskModal;
