
import React, { useState } from 'react';
import { Issue, IssueStatus, Task, ProjectMember } from '../types';
import { AlertTriangle, Plus, Search, CheckCircle2, XCircle, Clock, AlertOctagon, MoreHorizontal, Link as LinkIcon, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { getAvatarInitials, getAvatarColor } from '../utils/avatarUtils';
import IssueModal from './IssueModal';
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
}

const IssuesView: React.FC<IssuesViewProps> = ({
  issues,
  projectId,
  tasks,
  projectMembers,
  currentUserId,
  isReadOnly
}) => {
  const { notify } = useNotification();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | undefined>(undefined);
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
      if (!window.confirm("Are you sure you want to delete this issue?")) return;
      try {
          await deleteDoc(doc(db, 'projects', projectId, 'issues', id));
          notify('success', 'Issue deleted');
      } catch (e) {
          console.error(e);
          notify('error', 'Failed to delete issue');
      }
  };

  const handleStatusChange = async (id: string, newStatus: IssueStatus) => {
      if (isReadOnly) return;
      try {
          await updateDoc(doc(db, 'projects', projectId, 'issues', id), { status: newStatus });
          notify('success', `Status updated to ${newStatus}`);
      } catch (e) {
          notify('error', 'Update failed');
      }
  };

  const getSeverityBadge = (severity: string) => {
      switch(severity) {
          case 'Critical': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">Critical</span>;
          case 'High': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800">High</span>;
          case 'Medium': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">Medium</span>;
          case 'Low': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">Low</span>;
          default: return null;
      }
  };

  const getStatusIcon = (status: string) => {
      switch(status) {
          case 'Open': return <AlertCircle size={16} className="text-red-500" />;
          case 'Investigating': return <Clock size={16} className="text-orange-500" />;
          case 'Resolved': return <CheckCircle2 size={16} className="text-emerald-500" />;
          case "Won't Fix": return <XCircle size={16} className="text-slate-400" />;
          default: return null;
      }
  };

  const safeDate = (timestamp: any) => {
      if (!timestamp) return '-';
      try {
          return new Date(timestamp.seconds * 1000).toLocaleDateString();
      } catch { return '-'; }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      
      {/* Header */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 bg-red-50/30 dark:bg-red-900/5">
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
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                 />
             </div>
             {!isReadOnly && (
                 <button 
                    onClick={() => { setEditingIssue(undefined); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
                 >
                     <Plus size={16} /> Report
                 </button>
             )}
         </div>
      </div>

      {/* Filters */}
      <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex gap-2 overflow-x-auto">
          {['All', 'Open', 'Investigating', 'Resolved', "Won't Fix"].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${filterStatus === st ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                  {st}
              </button>
          ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
                  <tr>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-[40%]">Issue</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Related Task</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Assignee</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredIssues.length === 0 ? (
                      <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400">No issues found.</td>
                      </tr>
                  ) : (
                      filteredIssues.map(issue => {
                          const relatedTask = tasks.find(t => t.id === issue.relatedTaskId);
                          const assignee = projectMembers.find(m => m.uid === issue.assigneeId);
                          const reporter = projectMembers.find(m => m.uid === issue.reporterId);

                          return (
                              <tr key={issue.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                  <td className="px-6 py-4">
                                      <div className="flex items-start gap-3">
                                          {getStatusIcon(issue.status)}
                                          <div>
                                              <div className="flex items-center gap-2 mb-1">
                                                  <span className="font-bold text-slate-900 dark:text-white text-sm">{issue.title}</span>
                                                  {getSeverityBadge(issue.severity)}
                                              </div>
                                              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                  Opened {safeDate(issue.createdAt)} by {reporter?.displayName || 'Unknown'}
                                              </div>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4">
                                      {relatedTask ? (
                                          <div className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded max-w-fit">
                                              <LinkIcon size={12} />
                                              <span className="truncate max-w-[150px]">{relatedTask.title}</span>
                                          </div>
                                      ) : (
                                          <span className="text-xs text-slate-400">-</span>
                                      )}
                                  </td>
                                  <td className="px-6 py-4">
                                      {assignee ? (
                                          <div className="flex items-center gap-2" title={assignee.displayName}>
                                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${getAvatarColor(assignee.displayName)}`}>
                                                  {getAvatarInitials(assignee.displayName)}
                                              </div>
                                              <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{assignee.displayName}</span>
                                          </div>
                                      ) : (
                                          <span className="text-xs text-slate-400 italic">Unassigned</span>
                                      )}
                                  </td>
                                  <td className="px-6 py-4">
                                      <select 
                                        value={issue.status}
                                        onChange={(e) => handleStatusChange(issue.id, e.target.value as IssueStatus)}
                                        disabled={isReadOnly}
                                        className={`text-xs font-bold bg-transparent border border-slate-200 dark:border-slate-600 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                                            issue.status === 'Resolved' ? 'text-emerald-600' : issue.status === 'Open' ? 'text-red-600' : 'text-slate-600 dark:text-slate-300'
                                        }`}
                                      >
                                          <option value="Open">Open</option>
                                          <option value="Investigating">Investigating</option>
                                          <option value="Resolved">Resolved</option>
                                          <option value="Won't Fix">Won't Fix</option>
                                      </select>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                      {!isReadOnly && (
                                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button 
                                                onClick={() => { setEditingIssue(issue); setIsModalOpen(true); }}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
                                              >
                                                  <Edit2 size={16} />
                                              </button>
                                              <button 
                                                onClick={() => handleDelete(issue.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
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
    </div>
  );
};

export default IssuesView;
