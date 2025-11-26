
import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Save, User, Link, Loader2 } from 'lucide-react';
import { Issue, IssueSeverity, IssueStatus, Task, ProjectMember } from '../types';
import RichTextEditor from './RichTextEditor';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useNotification } from '../context/NotificationContext';

interface IssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  issue?: Issue;
  projectId: string;
  currentUserId: string;
  projectMembers: ProjectMember[];
  tasks: Task[];
}

const IssueModal: React.FC<IssueModalProps> = ({
  isOpen,
  onClose,
  issue,
  projectId,
  currentUserId,
  projectMembers,
  tasks
}) => {
  const { notify } = useNotification();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<IssueStatus>('Open');
  const [severity, setSeverity] = useState<IssueSeverity>('Medium');
  const [assigneeId, setAssigneeId] = useState<string>('UN');
  const [relatedTaskId, setRelatedTaskId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset or Load Data
  useEffect(() => {
    if (isOpen) {
      if (issue) {
        setTitle(issue.title);
        setDescription(issue.description);
        setStatus(issue.status);
        setSeverity(issue.severity);
        setAssigneeId(issue.assigneeId || 'UN');
        setRelatedTaskId(issue.relatedTaskId || '');
      } else {
        setTitle('');
        setDescription('');
        setStatus('Open');
        setSeverity('Medium');
        setAssigneeId('UN');
        setRelatedTaskId('');
      }
    }
  }, [isOpen, issue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      notify('error', 'Issue Title is required.');
      return;
    }

    setIsSaving(true);
    try {
      const reporterName = projectMembers.find(m => m.uid === currentUserId)?.displayName || 'Unknown';
      const assigneeName = projectMembers.find(m => m.uid === assigneeId)?.displayName;

      const payload: any = {
        title,
        description,
        status,
        severity,
        reporterId: currentUserId,
        reporterName,
        projectId,
        assigneeId: assigneeId === 'UN' ? null : assigneeId,
        assigneeName: assigneeId === 'UN' ? null : assigneeName,
        relatedTaskId: relatedTaskId || null,
      };

      if (issue) {
        // Update
        const ref = doc(db, 'projects', projectId, 'issues', issue.id);
        // Only update resolvedAt if changing to Resolved status
        if (status === 'Resolved' && issue.status !== 'Resolved') {
            payload.resolvedAt = serverTimestamp();
        } else if (status !== 'Resolved') {
            payload.resolvedAt = null;
        }
        await updateDoc(ref, payload);
        notify('success', 'Issue updated');
      } else {
        // Create
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, 'projects', projectId, 'issues'), payload);
        notify('success', 'Issue reported');
      }
      onClose();
    } catch (err) {
      console.error(err);
      notify('error', 'Failed to save issue');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-red-50/50 dark:bg-red-900/10">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" />
            {issue ? 'Edit Issue' : 'Report Issue'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Summary <span className="text-red-500">*</span></label>
            <input 
              autoFocus
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white placeholder-slate-400 font-medium"
              placeholder="Brief summary of the issue..."
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
             <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Severity</label>
                <select 
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white cursor-pointer"
                >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Status</label>
                <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value as IssueStatus)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white cursor-pointer"
                >
                    <option value="Open">Open</option>
                    <option value="Investigating">Investigating</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Won't Fix">Won't Fix</option>
                </select>
             </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Description</label>
            <RichTextEditor value={description} onChange={setDescription} placeholder="Steps to reproduce, expected behavior..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
             <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><User size={14}/> Assignee</label>
                <select 
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white cursor-pointer"
                >
                    <option value="UN">Unassigned</option>
                    {projectMembers.map(m => (
                        <option key={m.uid} value={m.uid!}>{m.displayName}</option>
                    ))}
                </select>
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Link size={14}/> Related Task</label>
                <select 
                    value={relatedTaskId}
                    onChange={(e) => setRelatedTaskId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white cursor-pointer"
                >
                    <option value="">None</option>
                    {tasks.map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                </select>
             </div>
          </div>
        </form>

        <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                Cancel
            </button>
            <button onClick={handleSubmit} disabled={isSaving} className="px-6 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 dark:shadow-red-900/30 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70">
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Save Issue
            </button>
        </div>

      </div>
    </div>
  );
};

export default IssueModal;
