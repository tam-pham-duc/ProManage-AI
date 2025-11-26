
import React from 'react';
import { X, Edit2, Trash2, Link as LinkIcon, Calendar, User, AlertTriangle, CheckCircle2, Clock, XCircle, AlertOctagon, ExternalLink, AlertCircle } from 'lucide-react';
import { Issue, Task, ProjectMember } from '../types';
import { getAvatarInitials, getAvatarColor } from '../utils/avatarUtils';

interface IssueDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  issue: Issue | null;
  onEdit: (issue: Issue) => void;
  onDelete: (issueId: string) => void;
  onTaskClick: (task: Task) => void;
  tasks: Task[];
  projectMembers: ProjectMember[];
  isReadOnly?: boolean;
}

const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  isOpen,
  onClose,
  issue,
  onEdit,
  onDelete,
  onTaskClick,
  tasks,
  projectMembers,
  isReadOnly
}) => {
  if (!isOpen || !issue) return null;

  const relatedTask = tasks.find(t => t.id === issue.relatedTaskId);
  const reporter = projectMembers.find(m => m.uid === issue.reporterId);
  const assignee = projectMembers.find(m => m.uid === issue.assigneeId);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      case 'High': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
      case 'Medium': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'Low': return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Open': return <AlertCircle size={16} className="text-red-600 dark:text-red-400" />;
      case 'Investigating': return <Clock size={16} className="text-blue-600 dark:text-blue-400" />;
      case 'Resolved': return <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />;
      case "Won't Fix": return <XCircle size={16} className="text-slate-500 dark:text-slate-400" />;
      default: return <AlertOctagon size={16} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start bg-white dark:bg-slate-800 sticky top-0 z-10">
          <div className="flex-1 pr-8">
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wide ${getSeverityColor(issue.severity)}`}>
                {issue.severity}
              </span>
              <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 px-2.5 py-0.5 rounded-full border border-slate-100 dark:border-slate-600">
                {getStatusIcon(issue.status)}
                <span>{issue.status}</span>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-snug break-words">
              {issue.title}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          
          {/* Description - Document Style */}
          <div className="mb-8">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              Description
            </h3>
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-100 dark:border-slate-700/50">
              {issue.description ? (
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: issue.description }}
                />
              ) : (
                <p className="text-slate-400 italic text-sm">No description provided.</p>
              )}
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Reporter & Date */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Reported By</h4>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${getAvatarColor(issue.reporterName)}`}>
                    {getAvatarInitials(issue.reporterName)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{issue.reporterName || 'Unknown'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Calendar size={10} />
                      {issue.createdAt ? new Date(issue.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown Date'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Assignee & Task */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Assigned To</h4>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${assignee ? (assignee.avatar && assignee.avatar.startsWith('http') ? '' : getAvatarColor(assignee.displayName)) : 'bg-slate-300'}`}>
                    {assignee ? (
                      assignee.avatar && assignee.avatar.startsWith('http') ? (
                        <img src={assignee.avatar} alt={assignee.displayName} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        getAvatarInitials(assignee.displayName)
                      )
                    ) : (
                      <User size={14} />
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {assignee ? assignee.displayName : 'Unassigned'}
                  </p>
                </div>
              </div>

              {relatedTask && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Related Task</h4>
                  <button 
                    onClick={() => { onClose(); onTaskClick(relatedTask); }}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50 dark:bg-indigo-900/10 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-colors text-left group shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 bg-white dark:bg-slate-800 rounded-md text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-900/50">
                        <LinkIcon size={14} />
                      </div>
                      <span className="text-sm font-bold text-indigo-900 dark:text-indigo-100 truncate group-hover:underline">
                        {relatedTask.title}
                      </span>
                    </div>
                    <ExternalLink size={14} className="text-indigo-400 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center gap-4">
          {!isReadOnly && (
            <button 
              onClick={() => { 
                if (window.confirm("Are you sure you want to delete this issue permanently?")) {
                  onDelete(issue.id);
                  onClose();
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-100 dark:hover:border-red-900/30 transition-colors text-sm"
            >
              <Trash2 size={16} />
              Delete Issue
            </button>
          )}
          
          <div className="flex gap-3 ml-auto">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-colors text-sm"
            >
              Close
            </button>
            {!isReadOnly && (
              <button 
                onClick={() => { onClose(); onEdit(issue); }}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-all active:scale-95 text-sm"
              >
                <Edit2 size={16} />
                Edit Issue
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default IssueDetailModal;
