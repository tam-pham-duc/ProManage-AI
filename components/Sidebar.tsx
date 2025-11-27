
import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  KanbanSquare, 
  CalendarClock, 
  Settings, 
  X,
  Plus,
  FolderPlus,
  Moon,
  Sun,
  Calendar,
  ChevronDown,
  Briefcase,
  Check,
  Layers,
  GitGraph,
  Trash2,
  List,
  Search,
  AlertCircle,
  Flag,
  PieChart,
  FolderOpen
} from 'lucide-react';
import { Tab, Project, ProjectRole } from '../types';
import { getAvatarInitials, getAvatarColor } from '../utils/avatarUtils';

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
  userAvatar?: string;
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  onCreateProject: () => void;
  isDesktopOpen: boolean;
  currentUserRole?: ProjectRole; 
  userEmail?: string;
  onOpenSettings?: () => void;
  openIssuesCount?: number;
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
  userAvatar,
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  isDesktopOpen,
  currentUserRole,
  userEmail,
  onOpenSettings,
  openIssuesCount = 0
}) => {
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentProject = projects.find(p => p.id === selectedProjectId);
  const isSuperAdmin = userEmail === 'admin@dev.com';

  // Filter projects based on search
  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear search when dropdown closes
  useEffect(() => {
    if (!isProjectDropdownOpen) {
      const timer = setTimeout(() => setProjectSearch(''), 300);
      return () => clearTimeout(timer);
    }
  }, [isProjectDropdownOpen]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'kanban', label: 'Kanban Board', icon: KanbanSquare },
    { id: 'list', label: 'List View', icon: List },
    { id: 'timeline', label: 'Timeline', icon: CalendarClock },
    { id: 'milestones', label: 'Milestones', icon: Flag },
    { id: 'map', label: 'Project Map', icon: GitGraph },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'issues', label: 'Issues List', icon: AlertCircle, badge: openIssuesCount },
    { id: 'documents', label: 'Documents', icon: FolderOpen },
    { id: 'time-reports', label: 'Time Reports', icon: PieChart },
  ];

  const handleNavClick = (tab: Tab) => {
    // Just trigger the prop callback. The parent App.tsx handles whether to scroll or switch view.
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
        ${isDesktopOpen ? 'md:w-72' : 'md:w-20'}
        ${!isDesktopOpen ? 'md:overflow-visible' : ''} 
      `}>
        
        <div className="w-full flex flex-col h-full">
            
            {/* Sidebar Header: Project Switcher */}
            <div className={`transition-all duration-300 ${isDesktopOpen ? 'p-4 mb-2' : 'p-2 mb-4 mt-2 flex justify-center'}`}>
                <div className="relative" ref={dropdownRef}>
                    <button 
                        onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                        className={`
                            bg-slate-800 hover:bg-slate-700 transition-colors rounded-xl border border-slate-700 group
                            ${isDesktopOpen ? 'w-full p-3 flex items-center justify-between' : 'w-12 h-12 flex items-center justify-center p-0'}
                        `}
                        title={!isDesktopOpen ? currentProject?.name || "Select Project" : undefined}
                    >
                        <div className={`
                            rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shrink-0
                            ${isDesktopOpen ? 'w-8 h-8' : 'w-8 h-8'}
                        `}>
                            <span className="font-bold text-sm">{currentProject ? currentProject.name.charAt(0) : 'P'}</span>
                        </div>
                        
                        {isDesktopOpen && (
                            <>
                                <div className="flex flex-col items-start min-w-0 text-left flex-1 ml-3">
                                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Project</span>
                                    <span className="font-bold text-white truncate w-full text-sm">{currentProject ? currentProject.name : 'Select Project'}</span>
                                </div>
                                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
                            </>
                        )}
                    </button>

                    {/* Dropdown Menu */}
                    {isProjectDropdownOpen && (
                        <div className={`
                            absolute top-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in
                            ${isDesktopOpen ? 'left-0 w-full' : 'left-0 w-64 origin-top-left'} 
                        `}>
                            
                            {/* Search Bar */}
                            <div className="p-2 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                    <input 
                                        type="text"
                                        placeholder="Find project..."
                                        value={projectSearch}
                                        onChange={(e) => setProjectSearch(e.target.value)}
                                        className="w-full bg-slate-900/50 border border-slate-600 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </div>

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
                                
                                {filteredProjects.length > 0 ? (
                                    filteredProjects.map(project => (
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
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-center text-xs text-slate-500 italic">
                                        No projects found
                                    </div>
                                )}
                            </div>
                            <div className="p-2 border-t border-slate-700 bg-slate-800/50">
                                <button 
                                    onClick={() => { onCreateProject(); setIsProjectDropdownOpen(false); }}
                                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-xs font-bold transition-colors"
                                >
                                    <FolderPlus size={14} /> Create New Project
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className={`transition-all duration-300 ${isDesktopOpen ? 'px-5 mb-6' : 'px-2 mb-6 flex justify-center'}`}>
            {!selectedProjectId ? (
                <button
                    onClick={() => {
                        onCreateProject();
                        setIsMobileOpen(false);
                    }}
                    className={`
                        bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold shadow-lg shadow-indigo-900/40 flex items-center justify-center transition-all transform hover:scale-[1.02] active:scale-95
                        ${isDesktopOpen ? 'w-full py-3.5 px-4 gap-2' : 'w-12 h-12 p-0'}
                    `}
                    title={!isDesktopOpen ? "Create New Project" : undefined}
                >
                    <FolderPlus size={20} strokeWidth={2.5} />
                    {isDesktopOpen && <span>Create New Project</span>}
                </button>
            ) : (
                <button
                    onClick={() => {
                    onAddTask();
                    setIsMobileOpen(false);
                    }}
                    className={`
                        bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold shadow-lg shadow-indigo-900/40 flex items-center justify-center transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                        ${isDesktopOpen ? 'w-full py-3.5 px-4 gap-2' : 'w-12 h-12 p-0'}
                    `}
                    disabled={currentUserRole === 'guest'} 
                    title={!isDesktopOpen ? "New Task" : undefined}
                >
                    <Plus size={20} strokeWidth={3} />
                    {isDesktopOpen && <span>New Task</span>}
                </button>
            )}
            </div>

            <nav className="flex-1 py-2 px-2 space-y-1.5 overflow-y-auto custom-scrollbar overflow-x-hidden">
            {navItems.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                
                // Allow Dashboard and Time Reports to be active without a selected project
                const isDisabled = !selectedProjectId && item.id !== 'dashboard' && item.id !== 'time-reports';
                
                return (
                <button
                    key={item.id}
                    onClick={() => !isDisabled && handleNavClick(item.id as Tab)}
                    disabled={isDisabled}
                    className={`
                        relative w-full flex items-center rounded-xl transition-all duration-200 group font-medium
                        ${isDesktopOpen ? 'px-4 py-3 justify-start gap-3' : 'justify-center py-3 px-0'}
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
                    
                    {isDesktopOpen && <span>{item.label}</span>}
                    
                    {/* Badge for Issues */}
                    {item.badge && item.badge > 0 && (
                        isDesktopOpen ? (
                            <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                {item.badge}
                            </span>
                        ) : (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-slate-900"></span>
                        )
                    )}

                    {/* Mini Mode Tooltip */}
                    {!isDesktopOpen && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-xl border border-slate-700">
                            {item.label}
                        </div>
                    )}
                </button>
                );
            })}
            </nav>

            {/* Trash Can Divider and Item */}
            <div className="px-2 pb-2">
                <div className="h-px bg-slate-800 my-2 mx-2"></div>
                
                {/* Settings Button */}
                <button
                    onClick={() => {
                        if (onOpenSettings) {
                            onOpenSettings();
                            setIsMobileOpen(false);
                        }
                    }}
                    className={`
                        relative w-full flex items-center rounded-xl transition-all duration-200 group font-medium text-slate-400 hover:bg-slate-800/50 hover:text-white
                        ${isDesktopOpen ? 'px-4 py-3 justify-start gap-3' : 'justify-center py-3 px-0'}
                    `}
                >
                    <Settings 
                        size={20} 
                        strokeWidth={2} 
                        className={`transition-colors text-slate-500 group-hover:text-indigo-300`} 
                    />
                    {isDesktopOpen && <span>Settings</span>}
                    {!isDesktopOpen && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-xl border border-slate-700">
                            Settings
                        </div>
                    )}
                </button>

                <button
                    onClick={() => handleNavClick('trash')}
                    className={`
                        relative w-full flex items-center rounded-xl transition-all duration-200 group font-medium
                        ${isDesktopOpen ? 'px-4 py-3 justify-start gap-3' : 'justify-center py-3 px-0'}
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
                    {isDesktopOpen && <span>Trash Can</span>}
                    {!isDesktopOpen && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-xl border border-slate-700">
                            Trash Can
                        </div>
                    )}
                </button>
            </div>

            <div className={`border-t border-slate-800 bg-slate-900/50 space-y-4 ${isDesktopOpen ? 'p-5' : 'p-2 py-4 flex flex-col items-center'}`}>
            <button 
                onClick={toggleDarkMode}
                className={`
                    flex items-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors bg-slate-800/30
                    ${isDesktopOpen ? 'w-full justify-between px-4 py-2.5' : 'justify-center w-10 h-10 p-0'}
                `}
                title={!isDesktopOpen ? "Toggle Dark Mode" : undefined}
            >
                {isDesktopOpen ? (
                    <>
                        <div className="flex items-center gap-3">
                            {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
                            <span className="text-sm font-medium">{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
                        </div>
                        <div className={`w-9 h-5 rounded-full relative transition-colors ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-600'}`}>
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform duration-300 shadow-sm`} style={{ left: isDarkMode ? '20px' : '4px' }}></div>
                        </div>
                    </>
                ) : (
                    isDarkMode ? <Moon size={18} /> : <Sun size={18} />
                )}
            </button>

            <div 
                className={`
                    flex items-center hover:bg-slate-800 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-700
                    ${isDesktopOpen ? 'gap-3 p-3' : 'justify-center w-10 h-10 p-0'}
                `} 
                onClick={onOpenSettings}
                title={!isDesktopOpen ? userName : undefined}
            >
                <div className="relative shrink-0">
                    {userAvatar && userAvatar.startsWith('http') ? (
                        <img 
                            src={userAvatar} 
                            alt={userName} 
                            className="w-10 h-10 rounded-full object-cover border border-white/10 shadow-sm"
                        />
                    ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border border-white/10 shadow-sm ${getAvatarColor(userName)}`}>
                            <span className="font-bold text-sm">{getAvatarInitials(userName)}</span>
                        </div>
                    )}
                    
                    {/* Role Badge */}
                    {isSuperAdmin ? (
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-900 flex items-center justify-center text-[8px] bg-red-600 text-white font-extrabold`} title="Super Admin">
                            R
                        </div>
                    ) : selectedProjectId && currentUserRole ? (
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center text-[8px] ${getRoleBadgeColor(currentUserRole)}`} title={currentUserRole}>
                            {currentUserRole.charAt(0).toUpperCase()}
                        </div>
                    ) : null}
                </div>
                
                {isDesktopOpen && (
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate flex items-center gap-1">
                            {userName}
                            {isSuperAdmin && <span className="text-[9px] px-1 py-0.5 rounded bg-red-900/50 text-red-400 uppercase">ROOT</span>}
                        </p>
                        <div className="flex items-center gap-1.5">
                            <p className="text-xs text-slate-400 truncate font-medium">{userTitle}</p>
                            {selectedProjectId && currentUserRole && !isSuperAdmin && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-sm uppercase font-bold tracking-wider ${currentUserRole === 'admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-700 text-slate-400'}`}>
                                    {currentUserRole}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
            </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
