
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Calendar, User, Clock, Tag, Paperclip, CheckSquare, Link, MessageSquare, Trash2, AlertCircle, DollarSign, Calculator, Loader2, Send, ChevronDown } from 'lucide-react';
import { Task, TaskStatus, Tag as TagType, Subtask, Comment, Attachment, KanbanColumn, ProjectMember, Issue } from '../types';
import RichTextEditor from './RichTextEditor';
import { useNotification } from '../context/NotificationContext';
import { useCelebration } from '../hooks/useCelebration';
import { getAvatarInitials, getAvatarColor } from '../utils/avatarUtils';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Partial<Task>) => void;
  onDelete?: (taskId: string) => void;
  task?: Task;
  currentUser: string;
  currentUserId: string;
  availableTags: TagType[];
  onCreateTag: (name: string) => TagType;
  columns: KanbanColumn[];
  projectMembers: ProjectMember[];
  initialDate?: string;
  isReadOnly?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  allTasks?: Task[];
  onTaskSelect?: (task: Task) => void;
  onTaskComment?: (taskId: string, text: string) => void;
  issues?: Issue[];
}

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
  projectMembers,
  initialDate,
  isReadOnly = false,
  canEdit = true,
  canDelete = false,
  allTasks = [],
  onTaskSelect,
  onTaskComment,
  issues = []
}) => {
  const { notify } = useNotification();
  const { triggerCelebration } = useCelebration();

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('To Do');
  const [priority, setPriority] = useState('Medium');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState('');
  const [assigneeId, setAssigneeId] = useState('UN');
  const [assigneeAvatar, setAssigneeAvatar] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [estimatedDays, setEstimatedDays] = useState('');
  const [reminderDays, setReminderDays] = useState(1);

  // Collections State
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [dependencies, setDependencies] = useState<string[]>([]);

  // Local UI State
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [newFileUrl, setNewFileUrl] = useState('');
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'subtasks' | 'comments' | 'attachments' | 'links'>('details');

  // Refs
  const commentEndRef = useRef<HTMLDivElement>(null);

  // Load/Reset Data
  useEffect(() => {
    if (isOpen) {
      if (task) {
        setTitle(task.title);
        setDescription(task.description || '');
        setStatus(task.status);
        setPriority(task.priority);
        setStartDate(task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '');
        setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
        setAssignee(task.assignee);
        setAssigneeId(task.assigneeId || 'UN');
        setAssigneeAvatar(task.assigneeAvatar || '');
        setEstimatedCost(task.estimatedCost?.toString() || '');
        setActualCost(task.actualCost?.toString() || '');
        setEstimatedHours(task.estimatedHours?.toString() || '');
        setEstimatedDays(task.estimatedDays?.toString() || '');
        setReminderDays(task.reminderDays !== undefined ? task.reminderDays : 1);
        setSubtasks(task.subtasks || []);
        setComments(task.comments || []);
        setAttachments(task.attachments || []);
        setTags(task.tags || []);
        setDependencies(task.dependencies || []);
      } else {
        // Default / New Task
        setTitle('');
        setDescription('');
        setStatus(columns[0]?.title || 'To Do');
        setPriority('Medium');
        setStartDate(initialDate || new Date().toISOString().split('T')[0]);
        setDueDate('');
        setAssignee('Unassigned');
        setAssigneeId('UN');
        setAssigneeAvatar('');
        setEstimatedCost('');
        setActualCost('');
        setEstimatedHours('');
        setEstimatedDays('');
        setReminderDays(1);
        setSubtasks([]);
        setComments([]);
        setAttachments([]);
        setTags([]);
        setDependencies([]);
      }
      setActiveTab('details');
    }
  }, [isOpen, task, initialDate, columns]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !canEdit) return;
    
    if (!title.trim()) {
        notify('error', 'Task Title is required.');
        return;
    }

    // Celebration Logic: If task status changed TO "Done"
    if (status === 'Done' && task && task.status !== 'Done') {
        triggerCelebration();
    }

    // Auto-save pending attachment if details are entered but "Add" wasn't clicked
    let finalAttachments = [...attachments];
    if (newFileName.trim() && newFileUrl.trim()) {
        finalAttachments.push({
            id: Date.now().toString(),
            fileName: newFileName.trim(),
            fileUrl: newFileUrl.trim(),
            uploadedAt: new Date().toLocaleString()
        });
    }

    onSubmit({
      title, description, status, priority, startDate, dueDate, 
      assignee: assignee || 'Unassigned',
      assigneeId: assigneeId || 'UN',
      assigneeAvatar: assigneeAvatar,
      subtasks, comments, 
      attachments: finalAttachments, 
      tags,
      dependencies,
      estimatedCost: parseFloat(estimatedCost) || 0, 
      actualCost: parseFloat(actualCost) || 0,
      estimatedHours: parseFloat(estimatedHours) || 0,
      estimatedDays: parseFloat(estimatedDays) || 0,
      reminderDays: reminderDays
    });
  };

  // Handlers for subtasks
  const handleAddSubtask = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && newSubtask.trim()) {
          e.preventDefault();
          setSubtasks([...subtasks, { id: Date.now().toString(), title: newSubtask.trim(), completed: false }]);
          setNewSubtask('');
      }
  };

  const toggleSubtask = (id: string) => {
      setSubtasks(subtasks.map(st => st.id === id ? { ...st, completed: !st.completed } : st));
  };

  const deleteSubtask = (id: string) => {
      setSubtasks(subtasks.filter(st => st.id !== id));
  };

  // Handlers for comments
  const handleAddComment = () => {
      if (!newComment.trim()) return;
      const comment: Comment = {
          id: Date.now().toString(),
          user: currentUser,
          userId: currentUserId,
          text: newComment.trim(),
          timestamp: new Date().toISOString()
      };
      setComments([...comments, comment]);
      
      if (task && onTaskComment) {
          onTaskComment(task.id, newComment.trim());
      }
      
      setNewComment('');
      // Scroll to bottom
      setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Handlers for attachments
  const handleAddAttachment = () => {
      if (newFileName.trim() && newFileUrl.trim()) {
          setAttachments([...attachments, {
              id: Date.now().toString(),
              fileName: newFileName.trim(),
              fileUrl: newFileUrl.trim(),
              uploadedAt: new Date().toLocaleString()
          }]);
          setNewFileName('');
          setNewFileUrl('');
      }
  };

  const removeAttachment = (id: string) => {
      setAttachments(attachments.filter(a => a.id !== id));
  };

  // Handlers for tags
  const toggleTag = (tag: TagType) => {
      if (tags.find(t => t.id === tag.id)) {
          setTags(tags.filter(t => t.id !== tag.id));
      } else {
          setTags([...tags, tag]);
      }
  };

  const handleCreateNewTag = () => {
      if (newTagName.trim()) {
          const newTag = onCreateTag(newTagName.trim());
          setTags([...tags, newTag]);
          setNewTagName('');
      }
  };

  // Handlers for dependencies
  const toggleDependency = (taskId: string) => {
      if (dependencies.includes(taskId)) {
          setDependencies(dependencies.filter(id => id !== taskId));
      } else {
          setDependencies([...dependencies, taskId]);
      }
  };

  const handleAssigneeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedId = e.target.value;
      setAssigneeId(selectedId);
      if (selectedId === 'UN') {
          setAssignee('Unassigned');
          setAssigneeAvatar('');
      } else {
          const member = projectMembers.find(m => m.uid === selectedId);
          if (member) {
              setAssignee(member.displayName);
              setAssigneeAvatar(member.avatar || '');
          }
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 overflow-hidden">
                <div className={`p-2 rounded-lg ${isReadOnly ? 'bg-slate-100 text-slate-500' : 'bg-indigo-100 text-indigo-600'} dark:bg-opacity-20`}>
                    <CheckSquare size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">{task ? 'Edit Task' : 'New Task'}</h2>
                    {task && <p className="text-xs text-slate-500 font-mono">{task.id}</p>}
                </div>
            </div>
            <div className="flex gap-2">
                {canDelete && task && onDelete && (
                    <button 
                        type="button"
                        onClick={() => { if(window.confirm('Delete task?')) onDelete(task.id); }}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete Task"
                    >
                        <Trash2 size={20} />
                    </button>
                )}
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    <X size={24} />
                </button>
            </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Main Form Area */}
            <form id="taskForm" onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                    
                    {/* Title */}
                    <div>
                        <input 
                            type="text" 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Task Title"
                            className="w-full text-2xl font-bold text-slate-900 dark:text-white bg-transparent outline-none placeholder-slate-300 dark:placeholder-slate-600"
                            readOnly={!canEdit}
                            autoFocus={!task}
                        />
                    </div>

                    {/* Tabs Navigation */}
                    <div className="flex border-b border-slate-100 dark:border-slate-700 gap-4 overflow-x-auto">
                        {(['details', 'subtasks', 'comments', 'attachments', 'links'] as const).map(tab => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors capitalize whitespace-nowrap ${activeTab === tab ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                {tab}
                                {tab === 'comments' && comments.length > 0 && ` (${comments.length})`}
                                {tab === 'subtasks' && subtasks.length > 0 && ` (${subtasks.filter(s => s.completed).length}/${subtasks.length})`}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="min-h-[200px]">
                        {activeTab === 'details' && (
                            <div className="space-y-4">
                                <RichTextEditor value={description} onChange={setDescription} placeholder="Add details..." />
                                
                                {/* Tags Section */}
                                <div className="flex flex-wrap items-center gap-2 mt-4">
                                    {tags.map(tag => (
                                        <span key={tag.id} className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${tag.colorClass} border border-transparent`}>
                                            {tag.name}
                                            {canEdit && <button type="button" onClick={() => toggleTag(tag)} className="hover:text-red-500"><X size={12}/></button>}
                                        </span>
                                    ))}
                                    {canEdit && (
                                        <div className="relative">
                                            <button type="button" onClick={() => setIsTagMenuOpen(!isTagMenuOpen)} className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 flex items-center gap-1">
                                                <Tag size={12} /> Add Tag
                                            </button>
                                            {isTagMenuOpen && (
                                                <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 p-2">
                                                    <div className="flex gap-1 mb-2">
                                                        <input 
                                                            type="text" 
                                                            value={newTagName} 
                                                            onChange={(e) => setNewTagName(e.target.value)} 
                                                            className="flex-1 px-2 py-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded"
                                                            placeholder="New tag..."
                                                        />
                                                        <button type="button" onClick={handleCreateNewTag} disabled={!newTagName.trim()} className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"><Save size={12}/></button>
                                                    </div>
                                                    <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                                                        {availableTags.map(tag => (
                                                            <button 
                                                                key={tag.id} 
                                                                type="button" 
                                                                onClick={() => { toggleTag(tag); setIsTagMenuOpen(false); }}
                                                                className="w-full text-left px-2 py-1 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                                            >
                                                                <div className={`w-2 h-2 rounded-full ${tag.colorClass.split(' ')[0].replace('bg-', 'bg-')}`}></div>
                                                                {tag.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'subtasks' && (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={newSubtask}
                                        onChange={(e) => setNewSubtask(e.target.value)}
                                        onKeyDown={handleAddSubtask}
                                        placeholder="Add a subtask..."
                                        className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        readOnly={!canEdit}
                                    />
                                </div>
                                <div className="space-y-2">
                                    {subtasks.map(st => (
                                        <div key={st.id} className="flex items-center gap-3 group p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                                            <button 
                                                type="button" 
                                                onClick={() => canEdit && toggleSubtask(st.id)}
                                                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${st.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 text-transparent hover:border-indigo-500'}`}
                                            >
                                                <CheckSquare size={14} />
                                            </button>
                                            <span className={`flex-1 text-sm ${st.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {st.title}
                                            </span>
                                            {canEdit && (
                                                <button type="button" onClick={() => deleteSubtask(st.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {subtasks.length === 0 && <p className="text-center text-slate-400 text-sm italic py-4">No subtasks yet.</p>}
                                </div>
                            </div>
                        )}

                        {activeTab === 'comments' && (
                            <div className="flex flex-col h-full">
                                <div className="space-y-4 mb-4">
                                    {comments.map(comment => (
                                        <div key={comment.id} className="flex gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${getAvatarColor(comment.user)}`}>
                                                {getAvatarInitials(comment.user)}
                                            </div>
                                            <div className="flex-1 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg rounded-tl-none">
                                                <div className="flex justify-between items-baseline mb-1">
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white">{comment.user}</span>
                                                    <span className="text-[10px] text-slate-400">{new Date(comment.timestamp).toLocaleString()}</span>
                                                </div>
                                                <p className="text-sm text-slate-700 dark:text-slate-300">{comment.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={commentEndRef} />
                                </div>
                                <div className="flex gap-2 mt-auto">
                                    <input 
                                        type="text" 
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                        placeholder="Write a comment..."
                                        className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                    />
                                    <button type="button" onClick={handleAddComment} disabled={!newComment.trim()} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                                        <Send size={18} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'attachments' && (
                            <div className="space-y-4">
                                {canEdit && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <input type="text" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} placeholder="File Name" className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none" />
                                        <div className="flex gap-2">
                                            <input type="text" value={newFileUrl} onChange={(e) => setNewFileUrl(e.target.value)} placeholder="File URL (https://...)" className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none" />
                                            <button type="button" onClick={handleAddAttachment} className="px-3 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Add</button>
                                        </div>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    {attachments.map(att => (
                                        <div key={att.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl group">
                                            <div className="p-2 bg-white dark:bg-slate-700 rounded-lg text-indigo-500"><Paperclip size={18}/></div>
                                            <div className="flex-1 min-w-0">
                                                <a href={att.fileUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate block">{att.fileName}</a>
                                                <p className="text-[10px] text-slate-400">{att.uploadedAt}</p>
                                            </div>
                                            {canEdit && (
                                                <button type="button" onClick={() => removeAttachment(att.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'links' && (
                            <div className="space-y-4">
                                <p className="text-xs text-slate-500 uppercase font-bold">Blocking Dependencies</p>
                                {canEdit && (
                                    <div className="relative group">
                                        <select 
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    toggleDependency(e.target.value);
                                                    e.target.value = '';
                                                }
                                            }}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none appearance-none cursor-pointer"
                                        >
                                            <option value="">+ Add Dependency</option>
                                            {allTasks.filter(t => t.id !== task?.id).map(t => (
                                                <option key={t.id} value={t.id} disabled={dependencies.includes(t.id)}>{t.title}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    {dependencies.map(depId => {
                                        const depTask = allTasks.find(t => t.id === depId);
                                        if (!depTask) return null;
                                        return (
                                            <div key={depId} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${depTask.status === 'Done' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                                    <span className={`text-sm ${depTask.status === 'Done' ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{depTask.title}</span>
                                                </div>
                                                {canEdit && <button type="button" onClick={() => toggleDependency(depId)} className="text-slate-400 hover:text-red-500"><X size={14}/></button>}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </form>

            {/* Right Sidebar (Properties) */}
            <div className="w-full lg:w-80 bg-slate-50/50 dark:bg-slate-900/50 border-l border-slate-100 dark:border-slate-700 p-6 space-y-6 overflow-y-auto custom-scrollbar">
                
                {/* Status & Priority */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                        <select 
                            value={status} 
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                            disabled={!canEdit}
                        >
                            {columns.map(col => <option key={col.id} value={col.title}>{col.title}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                        <select 
                            value={priority} 
                            onChange={(e) => setPriority(e.target.value as any)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                            disabled={!canEdit}
                        >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                    </div>
                </div>

                {/* Dates */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                        <div className="relative">
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                readOnly={!canEdit}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                        <div className="relative">
                            <input 
                                type="date" 
                                value={dueDate} 
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                readOnly={!canEdit}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Clock size={12}/> Reminder</label>
                        <select 
                            value={reminderDays}
                            onChange={(e) => setReminderDays(parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none cursor-pointer"
                            disabled={!canEdit}
                        >
                            <option value={-1}>None</option>
                            <option value={0}>Same Day</option>
                            <option value={1}>1 Day Before</option>
                            <option value={2}>2 Days Before</option>
                            <option value={7}>1 Week Before</option>
                        </select>
                    </div>
                </div>

                {/* Assignee */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assignee</label>
                    <div className="relative">
                        <select 
                            value={assigneeId} 
                            onChange={handleAssigneeChange}
                            className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium outline-none appearance-none cursor-pointer"
                            disabled={!canEdit}
                        >
                            <option value="UN">Unassigned</option>
                            {projectMembers.map(m => (
                                <option key={m.uid} value={m.uid!}>{m.displayName}</option>
                            ))}
                        </select>
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            {assigneeAvatar && assigneeAvatar.startsWith('http') ? (
                                <img src={assigneeAvatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold ${getAvatarColor(assignee)}`}>
                                    {getAvatarInitials(assignee)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tracking */}
                <div className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase">Tracking</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] text-slate-400 block mb-1 flex items-center gap-1"><DollarSign size={10}/> Est. Cost</label>
                            <input type="number" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-sm font-mono outline-none" placeholder="0.00" readOnly={!canEdit} />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-400 block mb-1 flex items-center gap-1"><DollarSign size={10}/> Act. Cost</label>
                            <input type="number" value={actualCost} onChange={(e) => setActualCost(e.target.value)} className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-sm font-mono outline-none" placeholder="0.00" readOnly={!canEdit} />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-400 block mb-1 flex items-center gap-1"><Clock size={10}/> Est. Hours</label>
                            <input type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-sm font-mono outline-none" placeholder="0" readOnly={!canEdit} />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-400 block mb-1 flex items-center gap-1"><Calendar size={10}/> Est. Days</label>
                            <input type="number" value={estimatedDays} onChange={(e) => setEstimatedDays(e.target.value)} className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded text-sm font-mono outline-none" placeholder="0" readOnly={!canEdit} />
                        </div>
                    </div>
                </div>

                {/* Issues Alert (Read Only in Task Modal) */}
                {issues.length > 0 && (
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                        <h4 className="text-xs font-bold text-red-500 uppercase flex items-center gap-1 mb-2">
                            <AlertCircle size={12} /> Related Issues ({issues.length})
                        </h4>
                        <div className="space-y-2">
                            {issues.map(issue => (
                                <div key={issue.id} className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded text-xs">
                                    <p className="font-bold text-red-700 dark:text-red-300 truncate">{issue.title}</p>
                                    <p className="text-red-500/80">{issue.status} • {issue.severity}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm">
                Cancel
            </button>
            {canEdit && (
                <button 
                    type="submit"
                    form="taskForm" 
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-all active:scale-95 text-sm"
                >
                    <Save size={18} />
                    Save Task
                </button>
            )}
        </div>

      </div>
    </div>
  );
};

export default TaskModal;
