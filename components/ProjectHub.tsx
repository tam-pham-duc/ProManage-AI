
import React, { useState } from 'react';
import { Plus, Briefcase, MapPin, Clock, ArrowRight, Folder, User, Copy, Loader2, X } from 'lucide-react';
import { Project } from '../types';
import { auth, db } from '../firebase';
import { collection, query, where, addDoc, serverTimestamp, getDocs, doc } from 'firebase/firestore';
import WelcomeBanner from './WelcomeBanner';

interface ProjectHubProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
  userName?: string;
}

const ProjectHub: React.FC<ProjectHubProps> = ({ projects, onSelectProject, userName }) => {
  // Duplicate Modal State
  const [isCloning, setIsCloning] = useState(false);
  const [duplicateModal, setDuplicateModal] = useState<{ isOpen: boolean; sourceProject: Project | null; newName: string }>({
    isOpen: false,
    sourceProject: null,
    newName: ''
  });

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

      alert(`Project "${newName}" duplicated successfully!`);
      setDuplicateModal({ isOpen: false, sourceProject: null, newName: '' });

    } catch (error) {
      console.error("Error duplicating project:", error);
      alert("Failed to duplicate project.");
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-10">
      
      <WelcomeBanner userName={userName || 'User'} isCompact={false} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Your Portfolio</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">Access and manage your active construction projects.</p>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map(project => (
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

               <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{project.name}</h3>
               
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
                   Created {new Date(project.createdAt || Date.now()).toLocaleDateString()}
                 </span>
                 <div className="flex items-center gap-2">
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
        ))}
      </div>

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
