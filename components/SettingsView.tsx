
import React, { useRef, useState } from 'react';
import { Download, Upload, Database, AlertTriangle, FileJson, User, Sliders, LayoutTemplate, PlusCircle, LogOut, Loader2, KanbanSquare, Trash2, GripVertical, Plus, X } from 'lucide-react';
import { Task, UserSettings, Tab, TaskPriority, KanbanColumn } from '../types';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface SettingsViewProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  userSettings: UserSettings;
  setUserSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onLogout: () => void;
  columns?: KanbanColumn[];
  onAddColumn?: (title: string, color: string) => void;
  onDeleteColumn?: (columnId: string) => void;
  onClose: () => void; // New prop for closing settings
}

type SettingsTab = 'general' | 'preferences' | 'data';

const HOUSE_TEMPLATE_DATA = [
  { 
    title: "Site Preparation & Excavation", 
    priority: "High" as TaskPriority, 
    estimatedCost: 5000, 
    days: 3,
    subtasks: ["Clear vegetation", "Level ground", "Dig foundation trenches"] 
  },
  { 
    title: "Foundation Pouring", 
    priority: "High" as TaskPriority, 
    estimatedCost: 12000, 
    days: 5,
    subtasks: ["Install rebar", "Build formwork", "Pour concrete", "Curing period"] 
  },
  { 
    title: "Framing - First Floor", 
    priority: "High" as TaskPriority, 
    estimatedCost: 15000, 
    days: 7,
    subtasks: ["Sill plates", "Floor joists", "Subflooring", "Wall studs"] 
  },
  { 
    title: "Framing - Second Floor & Roof", 
    priority: "Medium" as TaskPriority, 
    estimatedCost: 18000, 
    days: 10,
    subtasks: ["Second floor joists", "Wall studs", "Roof trusses", "Sheathing"] 
  },
  { 
    title: "Window & Door Installation", 
    priority: "Medium" as TaskPriority, 
    estimatedCost: 8000, 
    days: 4,
    subtasks: ["Install flashing", "Mount windows", "Hang exterior doors"] 
  },
  { 
    title: "Rough-in Plumbing & Electrical", 
    priority: "High" as TaskPriority, 
    estimatedCost: 10000, 
    days: 6,
    subtasks: ["Run water lines", "Install drain pipes", "Run electrical wiring", "Install boxes"] 
  },
  { 
    title: "Insulation & Drywall", 
    priority: "Medium" as TaskPriority, 
    estimatedCost: 9000, 
    days: 8,
    subtasks: ["Install batt insulation", "Hang drywall sheets", "Tape and mud joints"] 
  },
  { 
    title: "Interior Finishes", 
    priority: "Low" as TaskPriority, 
    estimatedCost: 12000, 
    days: 10,
    subtasks: ["Paint walls", "Install flooring", "Install trim/baseboards", "Install cabinets"] 
  }
];

const SettingsView: React.FC<SettingsViewProps> = ({ 
  tasks, 
  userSettings,
  setUserSettings,
  isDarkMode,
  toggleDarkMode,
  onLogout,
  columns = [],
  onAddColumn,
  onDeleteColumn,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('preferences'); // Default to preferences to show new feature
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  // Kanban Column Local State
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [newColumnColor, setNewColumnColor] = useState('blue');

  const handleLogout = async () => {
    try {
        await signOut(auth);
        onLogout(); 
    } catch (error) {
        console.error("Error signing out:", error);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(tasks, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `promanage_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        const parsedData = JSON.parse(content);
        
        if (!Array.isArray(parsedData)) {
          alert("Invalid backup file format. The file must contain an array of tasks.");
          return;
        }

        if (window.confirm(`Importing will add ${parsedData.length} tasks to your database. Proceed?`)) {
            setIsImporting(true);
            const currentUser = auth.currentUser;
            if (!currentUser) {
                alert("You must be logged in to import tasks.");
                setIsImporting(false);
                return;
            }

            let count = 0;
            for (const task of parsedData) {
                const { id, ...taskData } = task; 
                await addDoc(collection(db, 'tasks'), {
                    ...taskData,
                    ownerId: currentUser.uid,
                    createdAt: serverTimestamp(),
                    importedAt: new Date().toISOString()
                });
                count++;
            }
            alert(`Successfully imported ${count} tasks!`);
        }
      } catch (error) {
        console.error("Import error:", error);
        alert("Failed to import data. See console for details.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleLoadTemplate = async () => {
    if (!window.confirm("This will add standard tasks for a Wood-frame House project to your database. Continue?")) {
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const today = new Date();
    let currentOffset = 0;

    try {
        for (const templateItem of HOUSE_TEMPLATE_DATA) {
            const startDate = new Date(today);
            startDate.setDate(today.getDate() + currentOffset);
            
            const dueDate = new Date(startDate);
            dueDate.setDate(startDate.getDate() + templateItem.days);
            
            currentOffset += templateItem.days;

            await addDoc(collection(db, 'tasks'), {
                ownerId: currentUser.uid,
                title: templateItem.title,
                status: columns[0]?.title || 'To Do',
                priority: templateItem.priority,
                startDate: startDate.toISOString().split('T')[0],
                dueDate: dueDate.toISOString().split('T')[0],
                assignee: 'UN',
                estimatedCost: templateItem.estimatedCost,
                actualCost: 0,
                description: `# ${templateItem.title}\n\nStandard task for wood-frame construction.`,
                subtasks: templateItem.subtasks.map(st => ({
                    id: Math.random().toString(36).substr(2, 9),
                    title: st,
                    completed: false
                })),
                comments: [],
                activityLog: [{
                    id: Date.now().toString(),
                    action: 'created from template',
                    timestamp: new Date().toLocaleString()
                }],
                attachments: [],
                tags: [{ id: 'template-tag', name: 'Construction', colorClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' }],
                createdAt: serverTimestamp()
            });
        }
        alert("Template tasks created successfully!");
    } catch (e) {
        console.error("Error loading template", e);
        alert("Failed to load template tasks.");
    }
  };

  const handleAddColumnClick = () => {
    if (newColumnTitle.trim() && onAddColumn) {
        onAddColumn(newColumnTitle.trim(), newColumnColor);
        setNewColumnTitle('');
        setNewColumnColor('blue');
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: User },
    { id: 'preferences', label: 'Preferences', icon: Sliders },
    { id: 'data', label: 'Data Management', icon: Database },
  ];

  const colorOptions = [
    { name: 'slate', class: 'bg-slate-500' },
    { name: 'blue', class: 'bg-blue-500' },
    { name: 'emerald', class: 'bg-emerald-500' },
    { name: 'indigo', class: 'bg-indigo-500' },
    { name: 'purple', class: 'bg-purple-500' },
    { name: 'rose', class: 'bg-rose-500' },
    { name: 'amber', class: 'bg-amber-500' },
  ];

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6 h-[calc(100vh-140px)] flex flex-col">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">Manage your account and application preferences.</p>
        </div>
        <button 
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Close Settings"
        >
            <X size={24} />
        </button>
      </div>

      <div className="flex flex-col md:flex-row bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-900/50 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 p-4">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                    }
                  `}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800">
          
          {/* Tab: General */}
          {activeTab === 'general' && (
            <div className="max-w-xl space-y-8 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Profile Information</h2>
                <div className="space-y-6">
                   <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                        {userSettings.userName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Profile Picture</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Generated automatically from your name.</p>
                      </div>
                   </div>

                   <div>
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Display Name</label>
                     <input 
                       type="text" 
                       value={userSettings.userName}
                       readOnly
                       className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 cursor-not-allowed"
                     />
                   </div>

                   <div>
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Job Title</label>
                     <input 
                       type="text" 
                       value={userSettings.userTitle}
                       readOnly
                       className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 cursor-not-allowed"
                     />
                   </div>

                   <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-700">
                      <button 
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium hover:text-red-700 dark:hover:text-red-300 transition-colors px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <LogOut size={18} />
                        Log Out
                      </button>
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Preferences */}
          {activeTab === 'preferences' && (
            <div className="max-w-2xl space-y-8 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">App Preferences</h2>
                
                <div className="space-y-8 divide-y divide-slate-100 dark:divide-slate-700">
                  
                  {/* Default View */}
                  <div className="pt-4 first:pt-0">
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Start Page</label>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {['dashboard', 'kanban', 'timeline'].map((view) => (
                          <button
                            key={view}
                            onClick={() => setUserSettings(prev => ({ ...prev, defaultView: view as Tab }))}
                            className={`
                              px-4 py-3 rounded-lg border text-sm font-medium capitalize transition-all
                              ${userSettings.defaultView === view 
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500' 
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                              }
                            `}
                          >
                            {view}
                          </button>
                        ))}
                     </div>
                  </div>

                  {/* Kanban Columns Settings */}
                  <div className="pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <KanbanSquare className="text-indigo-500" size={20} />
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">Kanban Columns</h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Customize the stages of your workflow.</p>

                    <div className="space-y-3 mb-6">
                       {columns.map((col, index) => (
                         <div key={col.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl group">
                            <GripVertical size={16} className="text-slate-400 cursor-grab" />
                            <div className={`w-4 h-4 rounded-full bg-${col.color}-500 shadow-sm`}></div>
                            <span className="flex-1 font-medium text-sm text-slate-700 dark:text-slate-200">{col.title}</span>
                            {onDeleteColumn && (
                                <button 
                                    onClick={() => onDeleteColumn(col.id)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete Column"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                         </div>
                       ))}
                    </div>

                    {/* Add Column Form */}
                    {onAddColumn && (
                        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl">
                            <Plus size={16} className="text-slate-400 ml-1" />
                            <input 
                                type="text" 
                                value={newColumnTitle}
                                onChange={(e) => setNewColumnTitle(e.target.value)}
                                placeholder="New Column Name" 
                                className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder-slate-400"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddColumnClick()}
                            />
                            <div className="flex gap-1">
                                {colorOptions.map(c => (
                                    <button 
                                        key={c.name}
                                        onClick={() => setNewColumnColor(c.name)}
                                        className={`w-5 h-5 rounded-full ${c.class} transition-transform hover:scale-110 ${newColumnColor === c.name ? 'ring-2 ring-offset-1 dark:ring-offset-slate-800 ring-slate-400' : ''}`}
                                    />
                                ))}
                            </div>
                            <button 
                                onClick={handleAddColumnClick}
                                disabled={!newColumnTitle.trim()}
                                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                Add
                            </button>
                        </div>
                    )}
                  </div>

                  {/* Dark Mode */}
                  <div className="pt-6 flex items-center justify-between">
                    <div>
                       <h3 className="text-sm font-medium text-slate-900 dark:text-white">Dark Mode</h3>
                       <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Switch between light and dark themes.</p>
                    </div>
                    <button 
                      onClick={toggleDarkMode}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* Tab: Data Management */}
          {activeTab === 'data' && (
            <div className="max-w-xl space-y-8 animate-fade-in">
               <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Data Management</h2>
                
                <div className="space-y-4">
                   {/* Project Templates */}
                   <div className="p-5 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                      <div className="flex items-start gap-4">
                         <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-indigo-500">
                           <LayoutTemplate size={24} />
                         </div>
                         <div className="flex-1">
                           <h3 className="font-bold text-slate-900 dark:text-white text-sm">Project Templates</h3>
                           <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 mb-4">
                             Quickly populate your board with standard tasks for a Wood-frame House.
                           </p>
                           <button
                             onClick={handleLoadTemplate}
                             className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white border border-transparent rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 dark:shadow-indigo-900/20 active:scale-95"
                           >
                             <PlusCircle size={16} />
                             Load House Template
                           </button>
                         </div>
                      </div>
                   </div>

                   <div className="h-px bg-slate-100 dark:bg-slate-700 my-6"></div>

                   {/* Export */}
                   <div className="p-5 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700">
                      <div className="flex items-start gap-4">
                         <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-slate-400">
                           <FileJson size={24} />
                         </div>
                         <div className="flex-1">
                           <h3 className="font-bold text-slate-900 dark:text-white text-sm">Export Backup</h3>
                           <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                             Download all your tasks and settings as a JSON file.
                           </p>
                           <button
                             onClick={handleExport}
                             className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                           >
                             <Download size={16} />
                             Download JSON
                           </button>
                         </div>
                      </div>
                   </div>

                   {/* Import */}
                   <div className="p-5 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                      <div className="flex items-start gap-4">
                         <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-amber-500">
                           <AlertTriangle size={24} />
                         </div>
                         <div className="flex-1">
                           <h3 className="font-bold text-slate-900 dark:text-white text-sm">Import Data</h3>
                           <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 mb-4">
                             Restore from a backup file. <span className="font-bold">This will append tasks to the cloud database.</span>
                           </p>
                           <input 
                              type="file" 
                              accept=".json" 
                              ref={fileInputRef} 
                              onChange={handleFileChange} 
                              className="hidden" 
                            />
                           <button
                             onClick={handleImportClick}
                             disabled={isImporting}
                             className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                           >
                             {isImporting ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                             Select File
                           </button>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SettingsView;
