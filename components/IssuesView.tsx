
import React, { useState } from 'react';
import { Issue, IssueStatus, Task, ProjectMember } from '../types';
import { AlertTriangle, Plus, Search, CheckCircle2, XCircle, Clock, AlertOctagon, Link as LinkIcon, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { getAvatarInitials, getAvatarColor } from '../utils/avatarUtils';
import IssueModal from './IssueModal';
import IssueDetailModal from './IssueDetailModal';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNotification } from '../context/NotificationContext';

interface IssuesViewProps {
  issues: Issue[];
  projectId: string;
  tasks: Task[];
  projectMembers: ProjectMember[];
  currentUserId: string;
  isReadOnly?: boolean;
  onTaskClick?: (task: Task) => void;
}

const IssuesView: React.FC<IssuesViewProps> = ({
  issues,
  projectId,
  tasks,
  projectMembers,
  currentUserId,
  isReadOnly,
  onTaskClick
}) => {
  const { notify } = useNotification();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | undefined>(undefined);
  
  // State for Detail View
  const [viewingIssue, setViewingIssue] = useState<Issue | null>(null);
  
  const [filterStatus, setFilterStatus] = useState<string>('All');

  const filteredIssues = issues.filter(issue => {
      const matchesSearch = issue.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'All' || issue.status === filterStatus;
      return matchesSearch && matchesStatus;
  }).sort((a, b) => {
      // Sort by Severity (Critical -> High -> Medium -> Low) then Date
      const severityWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      const diff = severityWeight[b.severity] - severityWeight[a.severity];
      if (diff !== 0) return diff;
      return new Date(b.createdAt?.seconds * 1000).getTime() - new Date(a.createdAt?.seconds * 1000).getTime();
  });

  const handleDelete = async (id: string) => {
      if (isReadOnly) return;
      try {
          await deleteDoc(doc(db, 'projects', projectId, 'issues', id));
          notify('success', 'Issue deleted');
      } catch (e) {
          console.error(e);
          notify('error', 'Failed to delete issue');
      }
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>, id: string) => {
      e.stopPropagation(); // Prevent row click
      if (isReadOnly) return;
      try {
          await updateDoc(doc(db, 'projects', projectId, 'issues', id), { status: e.target.value });
          notify('success', `Status updated`);
      } catch (e) {
          notify('error', 'Update failed');
      }
  };

  const handleDetailEdit = (issue: Issue) => {
      setViewingIssue(null);
      setEditingIssue(issue);
      setIsModalOpen(true);
  };

  const handleOpenRelatedTask = (e: React.MouseEvent, taskId: string) => {
      e.stopPropagation(); // CRITICAL: Prevent opening the Issue Detail row
      const targetTask = tasks.find(t => t.id === taskId);
      if (targetTask) {
          if (onTaskClick) onTaskClick(targetTask); // Open the existing Task Modal
      } else {
          notify('error', "Task not found or has been deleted.");
      }
  };

  const stripHtml = (html: string) => {
      const tmp = document.createElement("DIV");
      tmp.innerHTML = html || "";
      return tmp.textContent || tmp.innerText || "";
  };

  const getSeverityBadge = (severity: string) => {
      switch(severity) {
          case 'Critical': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/50 dark:bg-black/20 text-red-700 dark:text-red-300 border border-red-200/50 dark:border-red-800/50">Critical</span>;
          case 'High': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/50 dark:bg-black/20 text-orange-700 dark:text-orange-300 border border-orange-200/50 dark:border-orange-800/50">High</span>;
          case 'Medium': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/50 dark:bg-black/20 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">Medium</span>;
          case 'Low': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/50 dark:bg-black/20 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50">Low</span>;
          default: return null;
      }
  };

  const getStatusIcon = (status: string) => {
      switch(status) {
          case 'Open': return <AlertCircle size={18} className="text-red-600 dark:text-red-400" />;
          case 'Investigating': return <Clock size={18} className="text-blue-600 dark:text-blue-400" />;
          case 'Resolved': return <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />;
          case "Won't Fix": return <XCircle size={18} className="text-slate-500 dark:text-slate-400" />;
          default: return null;
      }
  };

  const getStatusTheme = (status: string) => {
      switch(status) {
          case 'Open': 
              return 'bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 border-l-4 border-red-500';
          case 'Investigating': 
              return 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/10 dark:hover:bg-blue-900/20 border-l-4 border-blue-500';
          case 'Resolved': 
              return 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20 border-l-4 border-emerald-500';
          case "Won't Fix": 
              return 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/30 dark:hover:bg-slate-800/50 border-l-4 border-slate-400';
          default: 
              return 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border-l-4 border-transparent';
      }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
        case 'Open': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
        case 'Investigating': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
        case 'Resolved': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
        case "Won't Fix": return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
        default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const safeDate = (timestamp: any) => {
      if (!timestamp) return '-';
      try {
          return new Date(timestamp.seconds * 1000).toLocaleDateString();
      } catch { return '-'; }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      
      {/* Header */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 z-20">
         <div className="flex items-center gap-3">
             <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
                 <AlertOctagon size={24} />
             </div>
             <div>
                 <h2 className="text-xl font-bold text-slate-900 dark:text-white">Issues List</h2>
                 <p className="text-xs text-slate-500 dark:text-slate-400">Track bugs, risks, and impediments.</p>
             </div>
         </div>
         
         <div className="flex gap-3 w-full sm:w-auto">
             <div className="relative flex-1 sm:w-64">
                 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                    type="text" 
                    placeholder="Search issues..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white placeholder-slate-400"
                 />
             </div>
             {!isReadOnly && (
                 <button 
                    onClick={() => { setEditingIssue(undefined); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm hover:shadow-red-200 dark:hover:shadow-red-900/20 active:scale-95"
                 >
                     <Plus size={16} /> Report
                 </button>
             )}
         </div>
      </div>

      {/* Filters */}
      <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-2 overflow-x-auto z-10">
          {['All', 'Open', 'Investigating', 'Resolved', "Won't Fix"].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-colors border ${filterStatus === st ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              >
                  {st}
              </button>
          ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar p-4 bg-slate-50 dark:bg-slate-950/50">
          <table className="w-full text-left border-separate border-spacing-y-2">
              <thead className="hidden sm:table-header-group sticky top-0 z-10">
                  <tr>
                      <th className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider w-[25%]">Issue</th>
                      <th className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell w-[25%]">Description</th>
                      <th className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Related Task</th>
                      <th className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Assignee</th>
                      <th className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
              </thead>
              <tbody>
                  {filteredIssues.length === 0 ? (
                      <tr>
                          <td colSpan={6} className="px-6 py-16 text-center text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                              <div className="flex flex-col items-center justify-center">
                                  <AlertTriangle size={32} className="mb-2 opacity-20" />
                                  <p>No issues found.</p>
                              </div>
                          </td>
                      </tr>
                  ) : (
                      filteredIssues.map(issue => {
                          const relatedTask = tasks.find(t => t.id === issue.relatedTaskId);
                          const assignee = projectMembers.find(m => m.uid === issue.assigneeId);
                          const reporter = projectMembers.find(m => m.uid === issue.reporterId);
                          const plainDescription = stripHtml(issue.description);

                          return (
                              <tr 
                                  key={issue.id} 
                                  onClick={() => setViewingIssue(issue)}
                                  className={`${getStatusTheme(issue.status)} transition-all duration-200 shadow-sm group relative rounded-r-lg overflow-hidden cursor-pointer`}
                              >
                                  <td className="px-4 py-3 first:rounded-l-sm last:rounded-r-lg sm:rounded-none sm:first:rounded-l-none sm:last:rounded-r-lg">
                                      <div className="flex items-start gap-3">
                                          <div className="mt-0.5 shrink-0">{getStatusIcon(issue.status)}</div>
                                          <div className="min-w-0">
                                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                  <span className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight">{issue.title}</span>
                                                  {getSeverityBadge(issue.severity)}
                                              </div>
                                              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate">
                                                  Opened {safeDate(issue.createdAt)} by {reporter?.displayName || 'Unknown'}
                                              </div>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-4 py-3 hidden md:table-cell align-middle">
                                      <p className="truncate max-w-xs text-sm text-gray-500 dark:text-gray-400" title={plainDescription}>
                                          {plainDescription || '-'}
                                      </p>
                                  </td>
                                  <td className="px-4 py-3 hidden sm:table-cell align-middle">
                                      {relatedTask ? (
                                          <button 
                                            onClick={(e) => handleOpenRelatedTask(e, issue.relatedTaskId!)}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 hover:text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800 dark:hover:bg-indigo-900/50 transition-colors max-w-full"
                                            title="View Task Details"
                                          >
                                              <LinkIcon size={12} className="shrink-0" />
                                              <span className="truncate max-w-[120px]">{relatedTask.title}</span>
                                          </button>
                                      ) : (
                                          <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                                      )}
                                  </td>
                                  <td className="px-4 py-3 hidden sm:table-cell align-middle">
                                      {assignee ? (
                                          <div className="flex items-center gap-2" title={assignee.displayName}>
                                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm border border-white/20 ${getAvatarColor(assignee.displayName)}`}>
                                                  {getAvatarInitials(assignee.displayName)}
                                              </div>
                                              <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[100px]">{assignee.displayName}</span>
                                          </div>
                                      ) : (
                                          <span className="text-xs text-gray-400 dark:text-gray-500 italic">Unassigned</span>
                                      )}
                                  </td>
                                  <td className="px-4 py-3 hidden sm:table-cell align-middle">
                                      <select 
                                        value={issue.status}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleStatusChange(e, issue.id)}
                                        disabled={isReadOnly}
                                        className={`text-xs font-bold rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-colors border ${getStatusBadgeStyle(issue.status)}`}
                                      >
                                          <option value="Open">Open</option>
                                          <option value="Investigating">Investigating</option>
                                          <option value="Resolved">Resolved</option>
                                          <option value="Won't Fix">Won't Fix</option>
                                      </select>
                                  </td>
                                  <td className="px-4 py-3 text-right align-middle rounded-r-lg">
                                      {!isReadOnly && (
                                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); setEditingIssue(issue); setIsModalOpen(true); }}
                                                className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-black/30 rounded-lg transition-colors"
                                                title="Edit"
                                              >
                                                  <Edit2 size={16} />
                                              </button>
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete issue?')) handleDelete(issue.id); }}
                                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-white dark:hover:bg-black/30 rounded-lg transition-colors"
                                                title="Delete"
                                              >
                                                  <Trash2 size={16} />
                                              </button>
                                          </div>
                                      )}
                                  </td>
                              </tr>
                          );
                      })
                  )}
              </tbody>
          </table>
      </div>

      <IssueModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectId={projectId}
        issue={editingIssue}
        currentUserId={currentUserId}
        projectMembers={projectMembers}
        tasks={tasks}
      />

      {/* Read-Only Detail Preview Modal */}
      <IssueDetailModal
        isOpen={!!viewingIssue}
        onClose={() => setViewingIssue(null)}
        issue={viewingIssue}
        onEdit={handleDetailEdit}
        onDelete={(id) => handleDelete(id)}
        onTaskClick={(task) => { setViewingIssue(null); if(onTaskClick) onTaskClick(task); }}
        tasks={tasks}
        projectMembers={projectMembers}
        isReadOnly={isReadOnly}
      />
    </div>
  );
};

export default IssuesView;
