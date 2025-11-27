
import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCw, AlertTriangle, Folder, CheckSquare, Clock, LayoutTemplate, FileText, Link as LinkIcon, File } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, collectionGroup } from 'firebase/firestore';
import { Project, Task, Template, ProjectDocument } from '../types';
import { useNotification } from '../context/NotificationContext';

const TrashView: React.FC = () => {
  const { notify } = useNotification();
  const [activeTab, setActiveTab] = useState<'projects' | 'tasks' | 'templates' | 'documents'>('projects');
  const [deletedProjects, setDeletedProjects] = useState<Project[]>([]);
  const [deletedTasks, setDeletedTasks] = useState<Task[]>([]);
  const [deletedTemplates, setDeletedTemplates] = useState<Template[]>([]);
  const [deletedDocs, setDeletedDocs] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper to safely parse timestamps (Universal Date Parser)
  const parseDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    try {
        // 1. Firestore Timestamp (object with seconds)
        if (typeof timestamp === 'object' && 'seconds' in timestamp) {
            return new Date(timestamp.seconds * 1000);
        }
        // 2. Firestore Timestamp (object with toDate function)
        if (typeof timestamp === 'object' && typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
        }
        // 3. Date object or String
        const d = new Date(timestamp);
        if (isNaN(d.getTime())) return null;
        return d;
    } catch (e) {
        return null;
    }
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Query Deleted Projects (Owner Only)
    const qProjects = query(
      collection(db, 'projects'),
      where('ownerId', '==', user.uid),
      where('isDeleted', '==', true)
    );

    // Query Deleted Tasks (Owner Only)
    const qTasks = query(
      collection(db, 'tasks'),
      where('ownerId', '==', user.uid),
      where('isDeleted', '==', true)
    );

    // Query Deleted Templates
    const qTemplates = query(
      collection(db, 'templates'),
      where('createdBy', '==', user.uid),
      where('isDeleted', '==', true)
    );

    // Query Deleted Documents (Across all projects using Collection Group)
    const qDocs = query(
        collectionGroup(db, 'documents'),
        where('createdBy', '==', user.uid),
        where('isDeleted', '==', true)
    );

    const unsubProjects = onSnapshot(qProjects, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      data.sort((a, b) => {
        const dateA = parseDate(a.deletedAt)?.getTime() || 0;
        const dateB = parseDate(b.deletedAt)?.getTime() || 0;
        return dateB - dateA;
      });
      setDeletedProjects(data);
    });

    const unsubTasks = onSnapshot(qTasks, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      data.sort((a, b) => {
        const dateA = parseDate(a.deletedAt)?.getTime() || 0;
        const dateB = parseDate(b.deletedAt)?.getTime() || 0;
        return dateB - dateA;
      });
      setDeletedTasks(data);
    });

    const unsubTemplates = onSnapshot(qTemplates, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Template));
      data.sort((a, b) => {
        const dateA = parseDate(a.deletedAt)?.getTime() || 0;
        const dateB = parseDate(b.deletedAt)?.getTime() || 0;
        return dateB - dateA;
      });
      setDeletedTemplates(data);
    });

    const unsubDocs = onSnapshot(qDocs, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectDocument));
        data.sort((a, b) => {
            const dateA = parseDate(a.deletedAt)?.getTime() || 0;
            const dateB = parseDate(b.deletedAt)?.getTime() || 0;
            return dateB - dateA;
        });
        setDeletedDocs(data);
        setLoading(false);
    });

    return () => {
      unsubProjects();
      unsubTasks();
      unsubTemplates();
      unsubDocs();
    };
  }, []);

  const getRetentionInfo = (deletedAt: any, type: 'project' | 'task' | 'template' | 'document') => {
    const date = parseDate(deletedAt);
    if (!date) return { days: 0, isUrgent: false };

    // 30 days for Projects/Templates/Documents, 14 days for Tasks
    const limit = type === 'task' ? 14 : 30;
    const diffTime = new Date().getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
    const remaining = limit - diffDays;

    return {
      days: Math.max(0, remaining),
      isUrgent: remaining <= 3
    };
  };

  const handleRestore = async (item: any, type: 'project' | 'task' | 'template' | 'document') => {
    try {
      let ref;
      if (type === 'document') {
          ref = doc(db, 'projects', item.projectId, 'documents', item.id);
      } else {
          const collectionName = type === 'project' ? 'projects' : type === 'task' ? 'tasks' : 'templates';
          ref = doc(db, collectionName, item.id);
      }
      
      await updateDoc(ref, {
        isDeleted: false,
        deletedAt: null
      });
      notify('success', 'Item restored successfully.');
    } catch (error) {
      console.error(error);
      notify('error', 'Failed to restore item.');
    }
  };

  const handlePermanentDelete = async (item: any, type: 'project' | 'task' | 'template' | 'document') => {
    if (!window.confirm("This action cannot be undone. Delete permanently?")) return;
    
    try {
      let ref;
      if (type === 'document') {
          ref = doc(db, 'projects', item.projectId, 'documents', item.id);
      } else {
          const collectionName = type === 'project' ? 'projects' : type === 'task' ? 'tasks' : 'templates';
          ref = doc(db, collectionName, item.id);
      }

      await deleteDoc(ref);
      notify('success', 'Item permanently deleted.');
    } catch (error) {
      console.error(error);
      notify('error', 'Failed to delete item.');
    }
  };

  const renderEmptyState = (type: string) => (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
      <Trash2 size={48} className="mb-4 opacity-20" />
      <p className="text-sm font-medium">No deleted {type} found.</p>
      <p className="text-xs opacity-60 mt-1">Items are auto-deleted after retention period.</p>
    </div>
  );

  const getDocIcon = (type: string) => {
      switch(type) {
          case 'folder': return <Folder size={24} className="text-amber-400 fill-amber-400/20" />;
          case 'wiki': return <FileText size={24} className="text-blue-500" />;
          case 'file': return <LinkIcon size={24} className="text-slate-400" />;
          default: return <File size={24} className="text-slate-400" />;
      }
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in pb-10 h-full flex flex-col">
      
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Trash2 className="text-red-500" size={32} />
            Trash Can
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Restore deleted items or remove them permanently.
          </p>
        </div>
        
        {/* Info Badge */}
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-medium border border-blue-100 dark:border-blue-800">
          <Clock size={14} />
          <span>Retention: Projects/Docs (30 days), Tasks (14 days).</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab('projects')}
          className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'projects' 
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Projects ({deletedProjects.length})
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'tasks' 
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Tasks ({deletedTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'documents' 
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Documents ({deletedDocs.length})
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-3 px-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'templates' 
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Templates ({deletedTemplates.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        
        {/* PROJECTS LIST */}
        {activeTab === 'projects' && (
          <div className="space-y-3">
            {deletedProjects.length === 0 ? renderEmptyState('projects') : (
              deletedProjects.map(project => {
                if (!project) return null;
                const retention = getRetentionInfo(project.deletedAt, 'project');
                return (
                  <div key={project.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-red-200 dark:hover:border-red-900/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400">
                        <Folder size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{project.name || 'Untitled Project'}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span>{project.clientName || 'No Client'}</span>
                          <span>•</span>
                          <span>{project.address || 'No Address'}</span>
                        </div>
                        <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${retention.isUrgent ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
                          {retention.isUrgent && <AlertTriangle size={10} />}
                          {retention.days} days remaining
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button 
                        onClick={() => handleRestore(project, 'project')}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-xs font-bold"
                      >
                        <RefreshCw size={14} /> Restore
                      </button>
                      <button 
                        onClick={() => handlePermanentDelete(project, 'project')}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete Forever"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TASKS LIST */}
        {activeTab === 'tasks' && (
          <div className="space-y-3">
            {deletedTasks.length === 0 ? renderEmptyState('tasks') : (
              deletedTasks.map(task => {
                if (!task) return null;
                const retention = getRetentionInfo(task.deletedAt, 'task');
                return (
                  <div key={task.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-red-200 dark:hover:border-red-900/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400">
                        <CheckSquare size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">{task.title || 'Untitled Task'}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">{task.status || 'No Status'}</span>
                          <span>•</span>
                          <span>{task.priority || 'Medium'} Priority</span>
                        </div>
                        <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${retention.isUrgent ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
                          {retention.isUrgent && <AlertTriangle size={10} />}
                          {retention.days} days remaining
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button 
                        onClick={() => handleRestore(task, 'task')}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-xs font-bold"
                      >
                        <RefreshCw size={14} /> Restore
                      </button>
                      <button 
                        onClick={() => handlePermanentDelete(task, 'task')}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete Forever"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* DOCUMENTS LIST */}
        {activeTab === 'documents' && (
          <div className="space-y-3">
            {deletedDocs.length === 0 ? renderEmptyState('documents') : (
              deletedDocs.map(docItem => {
                if (!docItem) return null;
                const retention = getRetentionInfo(docItem.deletedAt, 'document');
                return (
                  <div key={docItem.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-red-200 dark:hover:border-red-900/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
                        {getDocIcon(docItem.type)}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{docItem.name || 'Untitled Document'}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span className="uppercase tracking-wider font-medium">{docItem.type}</span>
                          <span>•</span>
                          <span>Deleted {parseDate(docItem.deletedAt)?.toLocaleDateString() || 'Unknown'}</span>
                        </div>
                        <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${retention.isUrgent ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
                          {retention.isUrgent && <AlertTriangle size={10} />}
                          {retention.days} days remaining
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button 
                        onClick={() => handleRestore(docItem, 'document')}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-xs font-bold"
                      >
                        <RefreshCw size={14} /> Restore
                      </button>
                      <button 
                        onClick={() => handlePermanentDelete(docItem, 'document')}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete Forever"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TEMPLATES LIST */}
        {activeTab === 'templates' && (
          <div className="space-y-3">
            {deletedTemplates.length === 0 ? renderEmptyState('templates') : (
              deletedTemplates.map(template => {
                if (!template) return null;
                const retention = getRetentionInfo(template.deletedAt, 'template');
                return (
                  <div key={template.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-red-200 dark:hover:border-red-900/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400">
                        <LayoutTemplate size={24} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{template.name || 'Untitled Template'}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span className="uppercase font-bold">{template.type || 'Unknown'}</span>
                          <span>•</span>
                          <span>
                            {parseDate(template.createdAt) 
                                ? parseDate(template.createdAt)!.toLocaleDateString() 
                                : 'Unknown Date'}
                          </span>
                        </div>
                        <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${retention.isUrgent ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
                          {retention.isUrgent && <AlertTriangle size={10} />}
                          {retention.days} days remaining
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button 
                        onClick={() => handleRestore(template, 'template')}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-xs font-bold"
                      >
                        <RefreshCw size={14} /> Restore
                      </button>
                      <button 
                        onClick={() => handlePermanentDelete(template, 'template')}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete Forever"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default TrashView;
