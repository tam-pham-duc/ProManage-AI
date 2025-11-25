
import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  KanbanSquare, 
  CalendarClock, 
  Settings, 
  X,
  Plus,
  Moon,
  Sun,
  Calendar,
  ChevronDown,
  Briefcase,
  Check,
  Layers,
  GitGraph,
  Trash2,
  Download
} from 'lucide-react';
import { Tab, Project, ProjectRole } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  onAddTask: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  userName: string;
  userTitle: string;
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  onCreateProject: () => void;
  isDesktopOpen: boolean;
  currentUserRole?: ProjectRole; // Added role prop
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isMobileOpen, 
  setIsMobileOpen, 
  onAddTask,
  isDarkMode,
  toggleDarkMode,
  userName,
  userTitle,
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  isDesktopOpen,
  currentUserRole
}) => {
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isInstallable, handleInstall } = usePWAInstall();

  const currentProject = projects.find(p => p.id === selectedProjectId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'kanban', label: 'Kanban Board', icon: KanbanSquare },
    { id: 'timeline', label: 'Timeline', icon: CalendarClock },
    { id: 'map', label: 'Project Map', icon: GitGraph },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (tab: Tab) => {
    if (tab === 'dashboard' && !selectedProjectId) {
      setActiveTab('projects');
    } else {
      setActiveTab(tab);
    }
    setIsMobileOpen(false);
  };

  const handleProjectSelect = (projectId: string | null) => {
    onSelectProject(projectId);
    setIsProjectDropdownOpen(false);
  };

  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    : 'U';

  // Helper to get badge color based on role
  const getRoleBadgeColor = (role?: ProjectRole) => {
      switch(role) {
          case 'admin': return 'bg-purple-500 text-white';
          case 'guest': return 'bg-slate-500 text-white';
          case 'member': return 'bg-blue-500 text-white';
          default: return 'hidden';
      }
  };

  return (
    <>
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-40 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col
        transition-all duration-300 ease-in-out whitespace-nowrap print:hidden
        
        w-72 transform
        ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        
        md:translate-x-0 md:static md:h-screen
        ${isDesktopOpen ? 'md:w-72' : 'md:w-0 md:overflow-hidden md:border-r-0'}
      `}>
        
        <div className="w-72 flex flex-col h-full">
            
            {/* Sidebar Header: Project Switcher */}
            <div className="p-4 mb-2">
                <div className="relative" ref={dropdownRef}>
                    <button 
                        onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                        className="w-full bg-slate-800 hover:bg-slate-700 transition-colors rounded-xl p-3 flex items-center justify-between border border-slate-700 group"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shrink-0">
                            <span className="font-bold text-sm">{currentProject ? currentProject.name.charAt(0) : 'P'}</span>
                            </div>
                            <div className="flex flex-col items-start min-w-0 text-left">
                                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Project</span>
                                <span className="font-bold text-white truncate w-full text-sm">{currentProject ? currentProject.name : 'Select Project'}</span>
                            </div>
                        </div>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isProjectDropdownOpen && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                            <div className="max-h-60 overflow-y-auto custom-scrollbar py-1">
                                <button 
                                    onClick={() => handleProjectSelect(null)}
                                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-slate-700 transition-colors ${!selectedProjectId ? 'bg-slate-700/50 text-white' : 'text-slate-300'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Layers size={16} />
                                        <span className="text-sm font-medium">All Projects</span>
                                    </div>
                                    {!selectedProjectId && <Check size={14} className="text-indigo-400" />}
                                </button>
                                
                                <div className="h-px bg-slate-700 my-1 mx-2"></div>
                                
                                <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Your Projects</div>
                                
                                {projects.map(project => (
                                    <button
                                        key={project.id}
                                        onClick={() => handleProjectSelect(project.id)}
                                        className={`w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-slate-700 transition-colors ${selectedProjectId === project.id ? 'bg-slate-700/50 text-white' : 'text-slate-300'}`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Briefcase size={16} className="shrink-0" />
                                            <span className="text-sm font-medium truncate">{project.name}</span>
                                        </div>
                                        {selectedProjectId === project.id && <Check size={14} className="text-indigo-400 shrink-0" />}
                                    </button>
                                ))}
                            </div>
                            <div className="p-2 border-t border-slate-700 bg-slate-800/50">
                                <button 
                                    onClick={() => { onCreateProject(); setIsProjectDropdownOpen(false); }}
                                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-xs font-bold transition-colors"
                                >
                                    <Plus size={14} /> Create New Project
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="px-5 mb-6">
            <button
                onClick={() => {
                onAddTask();
                setIsMobileOpen(false);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 px-4 rounded-2xl font-bold shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!selectedProjectId || currentUserRole === 'guest'} 
            >
                <Plus size={20} strokeWidth={3} />
                New Task
            </button>
            </div>

            <nav className="flex-1 py-2 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
            {navItems.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                
                const isDisabled = !selectedProjectId && item.id !== 'settings' && item.id !== 'dashboard';
                
                return (
                <button
                    key={item.id}
                    onClick={() => !isDisabled && handleNavClick(item.id as Tab)}
                    disabled={isDisabled}
                    className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium
                    ${isActive 
                        ? 'bg-slate-800 text-white shadow-inner shadow-black/20' 
                        : isDisabled 
                            ? 'text-slate-600 cursor-not-allowed' 
                            : 'hover:bg-slate-800/50 hover:text-white text-slate-400'
                    }
                    `}
                >
                    <Icon 
                    size={20} 
                    strokeWidth={isActive ? 2.5 : 2} 
                    className={`transition-colors ${isActive ? 'text-indigo-400' : isDisabled ? 'text-slate-700' : 'text-slate-500 group-hover:text-indigo-300'}`} 
                    />
                    <span>{item.label}</span>
                </button>
                );
            })}
            </nav>

            {/* Trash Can Divider and Item */}
            <div className="px-4 pb-2">
                <div className="h-px bg-slate-800 my-2"></div>
                
                {isInstallable && (
                    <button
                        onClick={handleInstall}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold shadow-lg hover:shadow-indigo-500/25 transition-all duration-200 transform hover:-translate-y-0.5"
                    >
                        <Download size={18} />
                        <span>Install App</span>
                    </button>
                )}

                <button
                    onClick={() => handleNavClick('trash')}
                    className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium
                        ${activeTab === 'trash' 
                            ? 'bg-red-900/20 text-red-400' 
                            : 'text-slate-500 hover:bg-slate-800/50 hover:text-red-400'
                        }
                    `}
                >
                    <Trash2 
                        size={20} 
                        strokeWidth={activeTab === 'trash' ? 2.5 : 2}
                        className={`transition-colors ${activeTab === 'trash' ? 'text-red-400' : 'text-slate-500 group-hover:text-red-400'}`}
                    />
                    <span>Trash Can</span>
                </button>
            </div>

            <div className="p-5 border-t border-slate-800 bg-slate-900/50 space-y-4">
            <button 
                onClick={toggleDarkMode}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors bg-slate-800/30"
            >
                <div className="flex items-center gap-3">
                {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
                <span className="text-sm font-medium">{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
                </div>
                <div className={`w-9 h-5 rounded-full relative transition-colors ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-600'}`}>
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform duration-300 shadow-sm`} style={{ left: isDarkMode ? '20px' : '4px' }}></div>
                </div>
            </button>

            <div className="flex items-center gap-3 p-3 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-700" onClick={() => setActiveTab('settings')}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-400 to-purple-400 border border-white/10 shadow-lg shadow-black/20 shrink-0 flex items-center justify-center text-white font-bold text-sm ring-1 ring-black/20 relative">
                    {initials}
                    {/* Role Badge */}
                    {selectedProjectId && currentUserRole && (
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center text-[8px] ${getRoleBadgeColor(currentUserRole)}`} title={currentUserRole}>
                            {currentUserRole.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
                <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{userName}</p>
                <div className="flex items-center gap-1.5">
                    <p className="text-xs text-slate-400 truncate font-medium">{userTitle}</p>
                    {selectedProjectId && currentUserRole && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-sm uppercase font-bold tracking-wider ${currentUserRole === 'admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-700 text-slate-400'}`}>
                            {currentUserRole}
                        </span>
                    )}
                </div>
                </div>
            </div>
            </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;