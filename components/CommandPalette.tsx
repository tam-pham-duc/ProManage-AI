
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Folder, CheckSquare, ArrowRight, X, Loader2, Command } from 'lucide-react';
import { Project, Task } from '../types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  currentUserId?: string;
  onSelectProject: (projectId: string) => void;
  onSelectTask: (task: Task) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ 
  isOpen, 
  onClose, 
  projects, 
  currentUserId,
  onSelectProject, 
  onSelectTask 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [allTasks, setAllTasks] = useState<Task[]>([]); // Cache for global search
  const [loadingTasks, setLoadingTasks] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch all tasks once when opened to enable global filtering (simulated search index)
  useEffect(() => {
    if (isOpen && currentUserId && allTasks.length === 0) {
      const fetchAllTasks = async () => {
        setLoadingTasks(true);
        try {
           const q = query(collection(db, 'tasks'), where('ownerId', '==', currentUserId));
           const snap = await getDocs(q);
           const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
           // Filter out deleted tasks
           const activeTasks = tasks.filter(t => !t.isDeleted);
           setAllTasks(activeTasks);
        } catch (e) {
           console.error("Failed to fetch tasks for search", e);
        } finally {
           setLoadingTasks(false);
        }
      };
      fetchAllTasks();
    }
  }, [isOpen, currentUserId]);

  // Focus input
  useEffect(() => {
    if (isOpen) {
        // Small timeout to ensure render
        setTimeout(() => inputRef.current?.focus(), 50);
    } else {
        setSearchQuery('');
    }
  }, [isOpen]);

  // Keyboard Trap for Escape
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filteredResults = useMemo(() => {
      if (!searchQuery.trim()) return { projects: [], tasks: [] };
      
      const lowerQuery = searchQuery.toLowerCase();
      
      const filteredProjects = projects
          .filter(p => p.name.toLowerCase().includes(lowerQuery))
          .slice(0, 5);

      const filteredTasks = allTasks
          .filter(t => t.title.toLowerCase().includes(lowerQuery))
          .slice(0, 5);

      return { projects: filteredProjects, tasks: filteredTasks };
  }, [searchQuery, projects, allTasks]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
        
        {/* Modal */}
        <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fade-in transform transition-all">
            
            {/* Input Header */}
            <div className="flex items-center px-4 py-4 border-b border-slate-100 dark:border-slate-800">
                <Search className="text-slate-400 w-6 h-6 mr-3" />
                <input 
                    ref={inputRef}
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects, tasks..."
                    className="flex-1 bg-transparent text-lg text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                />
                <button onClick={onClose} className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded ml-2 border border-slate-200 dark:border-slate-700">ESC</button>
            </div>

            {/* Results Area */}
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                {!searchQuery && (
                    <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                        <Command className="mx-auto w-12 h-12 mb-4 opacity-20" />
                        <p className="text-sm">Type to search across your workspace</p>
                    </div>
                )}

                {searchQuery && filteredResults.projects.length === 0 && filteredResults.tasks.length === 0 && (
                     <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                        {loadingTasks ? <div className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={16} /> Searching...</div> : 'No results found.'}
                     </div>
                )}

                {/* Projects Section */}
                {filteredResults.projects.length > 0 && (
                    <div>
                        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0">
                            Projects
                        </div>
                        {filteredResults.projects.map(project => (
                            <div 
                                key={project.id}
                                onClick={() => { onSelectProject(project.id); onClose(); }}
                                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                    <Folder size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{project.name}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{project.clientName || 'No Client'}</p>
                                </div>
                                <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Tasks Section */}
                {filteredResults.tasks.length > 0 && (
                    <div>
                        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0">
                            Tasks
                        </div>
                        {filteredResults.tasks.map(task => {
                            const parentProject = projects.find(p => p.id === task.projectId);
                            return (
                                <div 
                                    key={task.id}
                                    onClick={() => { onSelectTask(task); onClose(); }}
                                    className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group"
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${task.status === 'Done' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                        <CheckSquare size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{task.title}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                                            {parentProject?.name || 'Unknown Project'} • <span className={`px-1.5 rounded-sm text-[10px] ${task.priority === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{task.priority}</span>
                                        </p>
                                    </div>
                                    <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all" />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default CommandPalette;
