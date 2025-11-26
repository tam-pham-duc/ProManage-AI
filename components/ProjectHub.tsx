
import React, { useState, useMemo } from 'react';
import { Plus, Briefcase, MapPin, Clock, ArrowRight, Folder, User, Copy, Loader2, X, Search, Filter, ArrowUpDown, FolderPlus, Trash2, ChevronDown, Check, AlertCircle } from 'lucide-react';
import { Project } from '../types';
import { auth, db } from '../firebase';
import { collection, query, where, addDoc, serverTimestamp, getDocs, doc, updateDoc } from 'firebase/firestore';
import WelcomeBanner from './WelcomeBanner';
import { useNotification } from '../context/NotificationContext';

interface ProjectHubProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  userName?: string;
  onDeleteProject?: (projectId: string) => void;
  currentUserId?: string;
}

const PROJECT_STATUSES = [
  { label: 'Active', color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800', dot: 'bg-emerald-500' },
  { label: 'On Hold', color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800', dot: 'bg-amber-500' },
  { label: 'Completed', color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800', dot: 'bg-blue-500' },
  { label: 'Archived', color: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700', dot: 'bg-slate-400' }
];

const ProjectHub: React.FC<ProjectHubProps> = ({ projects, onSelectProject, onCreateProject, userName, onDeleteProject, currentUserId }) => {
  const { notify } = useNotification();
  const [isCloning, setIsCloning] = useState(false);
  const [duplicateModal, setDuplicateModal] = useState<{ isOpen: boolean; sourceProject: Project | null; newName: string }>({
    isOpen: false,
    sourceProject: null,
    newName: ''
  });
  const [activeStatusDropdown, setActiveStatusDropdown] = useState<string | null>(null);

  // --- Filter & Sort State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy] = useState('createdAt'); // 'createdAt' | 'name' | 'client'

  // --- Safe Date Helper for Sorting ---
  const getTimestamp = (dateInput: any): number => {
      if (!dateInput) return 0;
      try {
          if (typeof dateInput === 'object' && 'seconds' in dateInput) {
              return dateInput.seconds * 1000;
          }
          if (typeof dateInput.toDate === 'function') {
              return dateInput.toDate().getTime();
          }
          const d = new Date(dateInput);
          return isNaN(d.getTime()) ? 0 : d.getTime();
      } catch (e) {
          return 0;
      }
  };

  // --- Filter & Sort Logic ---
  const filteredProjects = useMemo(() => {
    return projects
      .filter(project => {
        // Status Filter
        const matchesStatus = filterStatus === 'All' || project.status === filterStatus;
        
        // Search Filter (Name or Client)
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
          project.name.toLowerCase().includes(searchLower) || 
          (project.clientName || '').toLowerCase().includes(searchLower) ||
          (project.address || '').toLowerCase().includes(searchLower);

        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'client') {
          return (a.clientName || '').localeCompare(b.clientName || '');
        }
        // Default: Date Descending (Newest first)
        const dateA = getTimestamp(a.createdAt);
        const dateB = getTimestamp(b.createdAt);
        return dateB - dateA;
      });
  }, [projects, filterStatus, sortBy, searchQuery]);

  const openDuplicateModal = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setDuplicateModal({
      isOpen: true,
      sourceProject: project,
      newName: `Copy of ${project.name}`
    });
  };

  const handleStatusUpdate = async (e: React.MouseEvent, projectId: string, newStatus: string) => {
      e.stopPropagation();
      setActiveStatusDropdown(null);
      
      const project = projects.find(p => p.id === projectId);
      if (project && project.status === newStatus) return;

      try {
          const projectRef = doc(db, 'projects', projectId);
          await updateDoc(projectRef, { status: newStatus });
          notify('success', `Project marked as ${newStatus}`);
      } catch (error) {
          console.error("Error updating status:", error);
          notify('error', "Failed to update project status.");
      }
  };

  const handleDuplicateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const { sourceProject, newName } = duplicateModal;
    const currentUser = auth.currentUser;
    
    if (!currentUser || !sourceProject || !newName.trim()) return;

    setIsCloning(true);

    try {
      // 1. Create New Project
      const projectRef = await addDoc(collection(db, 'projects'), {
        ownerId: currentUser.uid,
        name: newName,
        clientName: sourceProject.clientName,
        address: sourceProject.address,
        status: 'Active',
        createdAt: new Date().toISOString()
      });

      const newProjectId = projectRef.id;

      // 2. Fetch Source Tasks
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('projectId', '==', sourceProject.id)
      );
      const tasksSnapshot = await getDocs(tasksQuery);

      // 3. Clone Tasks
      const clonePromises = tasksSnapshot.docs.map(async (taskDoc) => {
        const taskData = taskDoc.data();
        
        const clonedTaskData = {
          ...taskData,
          projectId: newProjectId,
          ownerId: currentUser.uid,
          status: 'To Do', 
          actualCost: 0,   
          activityLog: [{ 
            id: Date.now().toString() + Math.random(), 
            action: `cloned from project "${sourceProject.name}"`, 
            timestamp: new Date().toLocaleString() 
          }],
          comments: [], 
          subtasks: (taskData.subtasks || []).map((st: any) => ({ ...st, completed: false })),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        delete (clonedTaskData as any).id; 
        return addDoc(collection(db, 'tasks'), clonedTaskData);
      });

      await Promise.all(clonePromises);

      notify('success', `Project "${newName}" duplicated successfully!`);
      setDuplicateModal({ isOpen: false, sourceProject: null, newName: '' });

    } catch (error) {
      console.error("Error duplicating project:", error);
      notify('error', "Failed to duplicate project.");
    } finally {
      setIsCloning(false);
    }
  };

  const getStatusStyle = (status: string) => {
      const found = PROJECT_STATUSES.find(s => s.label === status);
      return found || PROJECT_STATUSES[0]; // Default to active
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 animate-fade-in pb-10 h-full">
      
      <WelcomeBanner userName={userName || 'User'} isCompact={false} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Your Portfolio</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">Access and manage your active construction projects.</p>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-8 flex flex-col lg:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 w-full lg:max-w-xl">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white placeholder-slate-400 font-medium transition-all"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
           {/* Status Filter */}
           <div className="relative w-full sm:w-auto min-w-[180px]">
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
              <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-700 dark:text-slate-200 font-bold cursor-pointer appearance-none"
              >
                  <option value="All">All Statuses</option>
                  {PROJECT_STATUSES.map(s => (
                      <option key={s.label} value={s.label}>{s.label}</option>
                  ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
           </div>

           {/* Sort Dropdown */}
           <div className="relative w-full sm:w-auto min-w-[180px]">
              <ArrowUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
              <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-700 dark:text-slate-200 font-bold cursor-pointer appearance-none"
              >
                  <option value="createdAt">Newest First</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="client">Client Name</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
           </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          
          {/* Create New Project Card (Always First) */}
          <div
            onClick={onCreateProject}
            className="group flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 min-h-[280px] cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all duration-300"
          >
            <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-slate-200 dark:border-slate-700 group-hover:border-indigo-200 dark:group-hover:border-indigo-800">
                <Plus size={32} className="text-slate-400 dark:text-slate-500 group-hover:text-indigo-500" />
            </div>
            <h3 className="font-bold text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 text-lg transition-colors">Create New Project</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center max-w-[200px]">Start a new construction site, renovation, or design.</p>
          </div>

          {/* Existing Projects */}
          {filteredProjects.map(project => {
            const isOwner = currentUserId === project.ownerId;
            const createdTs = getTimestamp(project.createdAt);
            const statusStyle = getStatusStyle(project.status);
            
            return (
            <div 
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-300 cursor-pointer relative overflow-visible flex flex-col justify-between min-h-[280px]"
            >
              {/* Watermark Icon */}
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                <Folder size={80} className="text-indigo-600 dark:text-indigo-400 rotate-12" />
              </div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm group-hover:scale-110 transition-transform border border-indigo-100 dark:border-indigo-900/50">
                    <Briefcase size={22} />
                  </div>
                  
                  {/* Interactive Status Badge */}
                  <div className="relative">
                      <button
                          onClick={(e) => {
                              e.stopPropagation();
                              setActiveStatusDropdown(activeStatusDropdown === project.id ? null : project.id);
                          }}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 transition-all hover:brightness-95 ${statusStyle.color}`}
                      >
                          <div className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></div>
                          {project.status}
                          <ChevronDown size={12} className="opacity-50" />
                      </button>

                      {/* Status Dropdown */}
                      {activeStatusDropdown === project.id && (
                          <>
                            <div className="fixed inset-0 z-40 cursor-default" onClick={(e) => { e.stopPropagation(); setActiveStatusDropdown(null); }}></div>
                            <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in p-1">
                                {PROJECT_STATUSES.map(status => (
                                    <button
                                        key={status.label}
                                        onClick={(e) => handleStatusUpdate(e, project.id, status.label)}
                                        className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors ${project.status === status.label ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${status.dot}`}></div>
                                        {status.label}
                                        {project.status === status.label && <Check size={12} className="ml-auto" />}
                                    </button>
                                ))}
                            </div>
                          </>
                      )}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">{project.name}</h3>
                
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <User size={16} className="shrink-0 text-slate-400" />
                    <span className="truncate">{project.clientName || 'No Client'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <MapPin size={16} className="shrink-0 text-slate-400" />
                    <span className="truncate">{project.address || 'No Address'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between relative z-10">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 px-2 py-1 rounded-md">
                    <Clock size={12} />
                    {createdTs ? new Date(createdTs).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    {onDeleteProject && isOwner && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteProject(project.id);
                            }}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete Project"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    <button 
                        onClick={(e) => openDuplicateModal(e, project)}
                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                        title="Duplicate Project"
                      >
                        <Copy size={16} />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </div>
            </div>
          )})}
      </div>
      
      {/* Empty Search State (If grid is empty besides Create Card) */}
      {filteredProjects.length === 0 && searchQuery && (
          <div className="mt-12 text-center">
             <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={32} className="text-slate-400" />
             </div>
             <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">No projects found</h3>
             <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Try adjusting your search or filters.</p>
          </div>
      )}

      {/* Duplicate Project Modal */}
      {duplicateModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Copy size={20} className="text-indigo-500" />
                Duplicate Project
              </h2>
              <button onClick={() => setDuplicateModal({ ...duplicateModal, isOpen: false })} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={20} />
              </button>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-4 rounded-xl mb-6 text-sm flex gap-3 items-start">
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-blue-500" />
                <p>This will create a new project structure with all tasks copied from <strong>{duplicateModal.sourceProject?.name}</strong>. Task statuses will be reset to "To Do".</p>
            </div>

            <form onSubmit={handleDuplicateProject} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">New Project Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={duplicateModal.newName}
                  onChange={(e) => setDuplicateModal({ ...duplicateModal, newName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white placeholder-slate-400 font-medium"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setDuplicateModal({ ...duplicateModal, isOpen: false })}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  disabled={isCloning}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isCloning}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isCloning ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Cloning...
                    </>
                  ) : (
                    <>
                      <Copy size={18} /> Duplicate
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProjectHub;
