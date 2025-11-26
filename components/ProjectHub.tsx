
import React, { useState, useMemo } from 'react';
import { Plus, Briefcase, MapPin, Clock, ArrowRight, Folder, User, Copy, Loader2, X, Search, Filter, ArrowUpDown, FolderPlus, Trash2 } from 'lucide-react';
import { Project } from '../types';
import { auth, db } from '../firebase';
import { collection, query, where, addDoc, serverTimestamp, getDocs, doc } from 'firebase/firestore';
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

const ProjectHub: React.FC<ProjectHubProps> = ({ projects, onSelectProject, onCreateProject, userName, onDeleteProject, currentUserId }) => {
  const { notify } = useNotification();
  const [isCloning, setIsCloning] = useState(false);
  const [duplicateModal, setDuplicateModal] = useState<{ isOpen: boolean; sourceProject: Project | null; newName: string }>({
    isOpen: false,
    sourceProject: null,
    newName: ''
  });

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

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-10 h-full">
      
      <WelcomeBanner userName={userName || 'User'} isCompact={false} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Your Portfolio</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">Access and manage your active construction projects.</p>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-center">
        {/* Search */}
        <div className="relative flex-1 w-full">
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
        <div className="flex items-center gap-3 w-full md:w-auto">
           {/* Status Filter */}
           <div className="relative flex-1 md:flex-none">
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
              <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full md:w-48 pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-700 dark:text-slate-200 font-bold cursor-pointer appearance-none"
              >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="Archived">Archived</option>
              </select>
           </div>

           {/* Sort Dropdown */}
           <div className="relative flex-1 md:flex-none">
              <ArrowUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
              <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full md:w-48 pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-700 dark:text-slate-200 font-bold cursor-pointer appearance-none"
              >
                  <option value="createdAt">Newest First</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="client">Client Name</option>
              </select>
           </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Create New Project Card (Always First) */}
          <div
            onClick={onCreateProject}
            className="group flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 min-h-[240px] cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all duration-300"
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
            
            return (
            <div 
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-300 cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <Folder size={64} className="text-indigo-600 dark:text-indigo-400 rotate-12" />
              </div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm group-hover:scale-110 transition-transform">
                    <Briefcase size={24} />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${project.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {project.status}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">{project.name}</h3>
                
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <User size={16} className="shrink-0" />
                    <span className="truncate">{project.clientName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <MapPin size={16} className="shrink-0" />
                    <span className="truncate">{project.address}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Clock size={12} />
                    Created {createdTs ? new Date(createdTs).toLocaleDateString() : 'Unknown'}
                  </span>
                  <div className="flex items-center gap-2">
                    {onDeleteProject && isOwner && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteProject(project.id);
                            }}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors z-20"
                            title="Delete Project"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                    <button 
                        onClick={(e) => openDuplicateModal(e, project)}
                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors z-20"
                        title="Duplicate Project"
                      >
                        <Copy size={18} />
                    </button>
                    <button className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )})}
      </div>
      
      {/* Empty Search State (If grid is empty besides Create Card) */}
      {filteredProjects.length === 0 && searchQuery && (
          <div className="mt-8 text-center text-slate-500 dark:text-slate-400 italic">
             No existing projects match your search.
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
              <button onClick={() => setDuplicateModal({ ...duplicateModal, isOpen: false })} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={24} />
              </button>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              This will create a new project with all the tasks from <span className="font-bold text-slate-900 dark:text-white">{duplicateModal.sourceProject?.name}</span>. 
              Tasks will be reset to "To Do" status.
            </p>

            <form onSubmit={handleDuplicateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">New Project Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={duplicateModal.newName}
                  onChange={(e) => setDuplicateModal({ ...duplicateModal, newName: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white placeholder-slate-400"
                  required
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setDuplicateModal({ ...duplicateModal, isOpen: false })}
                  className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  disabled={isCloning}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isCloning}
                  className="flex-1 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {isCloning ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Cloning...
                    </>
                  ) : (
                    'Duplicate'
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
