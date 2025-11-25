
import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, Database, AlertTriangle, FileJson, User, Sliders, LayoutTemplate, PlusCircle, LogOut, Loader2, KanbanSquare, Trash2, GripVertical, Plus, X, Camera, Lock, Save, ShieldCheck, RefreshCcw, Activity, Eye, FileText, Briefcase, CheckSquare } from 'lucide-react';
import { Task, UserSettings, Tab, TaskPriority, KanbanColumn } from '../types';
import { auth, db } from '../firebase';
import { signOut, updateProfile, updatePassword } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, doc, updateDoc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { useNotification } from '../context/NotificationContext';
import { clearDevData, generateDemoData } from '../services/demoDataService';
import HealthCheckModal from './HealthCheckModal';

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
  onClose: () => void; 
}

type SettingsTab = 'general' | 'preferences' | 'data' | 'templates';

// Define Template Interface locally
interface Template {
  id: string;
  name: string;
  type: 'project' | 'task';
  description?: string;
  createdAt: any;
  content: any;
  isDeleted?: boolean;
}

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
  const { notify } = useNotification();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  
  // --- General Tab State ---
  const [profileName, setProfileName] = useState(userSettings.userName);
  const [profileTitle, setProfileTitle] = useState(userSettings.userTitle);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(auth.currentUser?.photoURL || null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // --- Data Tab State ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isHealthCheckOpen, setIsHealthCheckOpen] = useState(false);
  
  // --- Templates Tab State ---
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTemplateType, setActiveTemplateType] = useState<'project' | 'task'>('project');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  // --- Kanban Column Local State ---
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [newColumnColor, setNewColumnColor] = useState('blue');

  // Sync local state if props change (optional, mostly for initial load)
  useEffect(() => {
    setProfileName(userSettings.userName);
    setProfileTitle(userSettings.userTitle);
    if (auth.currentUser?.photoURL) {
        setAvatarPreview(auth.currentUser.photoURL);
    }
  }, [userSettings]);

  // Fetch Templates Effect
  useEffect(() => {
    if (activeTab === 'templates') {
        const fetchTemplates = async () => {
            setIsLoadingTemplates(true);
            try {
                // Fetching all and filtering client side to allow for index-free simplicity initially
                // In production, use compound query: where('isDeleted', '==', false)
                const snap = await getDocs(collection(db, 'templates'));
                const data = snap.docs
                    .map(d => ({ id: d.id, ...d.data() } as Template))
                    .filter(t => !t.isDeleted)
                    .sort((a, b) => {
                         const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                         const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                         return dateB.getTime() - dateA.getTime();
                    });
                setTemplates(data);
            } catch (e) {
                console.error(e);
                notify('error', 'Failed to load templates');
            } finally {
                setIsLoadingTemplates(false);
            }
        };
        fetchTemplates();
    }
  }, [activeTab]);

  const handleLogout = async () => {
    try {
        await signOut(auth);
        onLogout(); 
    } catch (error) {
        console.error("Error signing out:", error);
    }
  };

  // --- Profile Handlers ---

  const handleAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        notify('warning', "Image is too large. Please choose under 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Part 1: Validation (Check password first)
    if (newPassword) {
        if (newPassword !== confirmPassword) {
            notify('error', "Passwords do not match.");
            return;
        }
        if (newPassword.length < 6) {
            notify('error', "Password must be at least 6 characters.");
            return;
        }
    }

    setIsSavingProfile(true);

    try {
        const user = auth.currentUser;
        if (!user) throw new Error("No user logged in");

        // Part 2: Update Basic Info (Always Run)
        
        // A. Update Auth Profile
        await updateProfile(user, {
            displayName: profileName,
            photoURL: avatarPreview
        });

        // B. Update Firestore User Document (Use setDoc with merge to prevent errors)
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
            username: profileName,
            jobTitle: profileTitle,
            avatar: avatarPreview || null,
        }, { merge: true });

        // C. Update Local State
        setUserSettings(prev => ({
            ...prev,
            userName: profileName,
            userTitle: profileTitle
        }));

        // Part 3: Update Password (Conditional)
        if (newPassword) {
            await updatePassword(user, newPassword);
        }

        notify('success', "Profile updated successfully!");
        setNewPassword('');
        setConfirmPassword('');
        
    } catch (error: any) {
        console.error("Error updating profile:", error);
        if (error.code === 'auth/requires-recent-login') {
            notify('warning', "For security, please log out and log back in to change your password.", 5000);
        } else {
            notify('error', error.message || "Failed to update profile.");
        }
    } finally {
        setIsSavingProfile(false);
    }
  };

  // --- Data Handlers ---

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
    notify('success', "Export started");
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
          notify('error', "Invalid backup file format.");
          return;
        }

        if (window.confirm(`Importing will add ${parsedData.length} tasks to your database. Proceed?`)) {
            setIsImporting(true);
            const currentUser = auth.currentUser;
            if (!currentUser) {
                notify('error', "You must be logged in to import tasks.");
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
            notify('success', `Successfully imported ${count} tasks!`);
        }
      } catch (error) {
        console.error("Import error:", error);
        notify('error', "Failed to import data.");
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
    if (!window.confirm("This will add standard tasks for a Wood-frame House project. Continue?")) {
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
        notify('success', "Template loaded successfully!");
    } catch (e) {
        console.error("Error loading template", e);
        notify('error', "Failed to load template tasks.");
    }
  };

  const handleFactoryReset = async () => {
      if (!window.confirm("FACTORY RESET WARNING: This will delete ALL projects and tasks associated with this account and regenerate standard demo data. This action cannot be undone. Are you sure?")) {
          return;
      }

      setIsResetting(true);
      try {
          const uid = auth.currentUser?.uid;
          if (!uid) throw new Error("No user ID found");

          await clearDevData(uid);
          await generateDemoData(uid);
          
          notify('success', "Factory reset complete. Reloading...");
          setTimeout(() => {
              window.location.reload();
          }, 1500);
      } catch (e) {
          console.error("Factory Reset Failed", e);
          notify('error', "Reset failed. Check console.");
          setIsResetting(false);
      }
  };

  const handleAddColumnClick = () => {
    if (newColumnTitle.trim() && onAddColumn) {
        onAddColumn(newColumnTitle.trim(), newColumnColor);
        setNewColumnTitle('');
        setNewColumnColor('blue');
    }
  };

  // --- Template Handlers ---
  const handleDeleteTemplate = async (id: string) => {
      if(!window.confirm("Are you sure you want to move this template to trash?")) return;
      try {
          await updateDoc(doc(db, 'templates', id), {
              isDeleted: true,
              deletedAt: serverTimestamp()
          });
          setTemplates(prev => prev.filter(t => t.id !== id));
          notify('success', 'Template moved to Trash');
      } catch (e) {
          console.error(e);
          notify('error', 'Failed to delete template');
      }
  };

  const filteredTemplates = templates.filter(t => t.type === activeTemplateType);

  const tabs = [
    { id: 'general', label: 'General', icon: User },
    { id: 'preferences', label: 'Preferences', icon: Sliders },
    { id: 'templates', label: 'Templates', icon: LayoutTemplate },
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
              <form onSubmit={handleSaveProfile} className="space-y-8">
                {/* Profile Header with Avatar */}
                <div className="flex items-center gap-6">
                  <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg overflow-hidden border-4 border-white dark:border-slate-700">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        profileName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
                      )}
                    </div>
                    {/* Camera Overlay */}
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="text-white" size={24} />
                    </div>
                    <input 
                        type="file" 
                        ref={avatarInputRef} 
                        onChange={handleAvatarChange} 
                        className="hidden" 
                        accept="image/*" 
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Profile Information</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Update your photo and personal details.</p>
                  </div>
                </div>

                {/* Editable Fields */}
                <div className="space-y-5">
                   <div>
                     <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Display Name</label>
                     <input 
                       type="text" 
                       value={profileName}
                       onChange={(e) => setProfileName(e.target.value)}
                       className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-all"
                       required
                     />
                   </div>

                   <div>
                     <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Job Title</label>
                     <input 
                       type="text" 
                       value={profileTitle}
                       onChange={(e) => setProfileTitle(e.target.value)}
                       className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-all"
                       placeholder="e.g. Project Manager"
                     />
                   </div>
                </div>

                <div className="h-px bg-slate-100 dark:bg-slate-700 my-6"></div>

                {/* Account Security */}
                <div className="space-y-5">
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="text-indigo-600 dark:text-indigo-400" size={20} />
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Account Security</h3>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
                        <div className="relative">
                            <input 
                                type="email" 
                                value={auth.currentUser?.email || ''}
                                disabled
                                className="w-full pl-4 pr-10 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 cursor-not-allowed font-medium"
                            />
                            <Lock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5">Contact admin to change email.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">New Password</label>
                            <input 
                                type="password" 
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-all"
                                placeholder="••••••••"
                                autoComplete="new-password"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Confirm Password</label>
                            <input 
                                type="password" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-all ${confirmPassword && newPassword !== confirmPassword ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}
                                placeholder="••••••••"
                                autoComplete="new-password"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-6 flex items-center justify-between border-t border-slate-100 dark:border-slate-700">
                    <button 
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold hover:text-red-700 dark:hover:text-red-300 transition-colors px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
                    >
                        <LogOut size={16} />
                        Log Out
                    </button>

                    <button 
                        type="submit"
                        disabled={isSavingProfile}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-all active:scale-95 disabled:opacity-70"
                    >
                        {isSavingProfile ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Save Changes
                    </button>
                </div>
              </form>
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

          {/* Tab: Templates */}
          {activeTab === 'templates' && (
            <div className="max-w-4xl mx-auto animate-fade-in h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Template Manager</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your saved project and task templates.</p>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                        <button 
                            onClick={() => setActiveTemplateType('project')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTemplateType === 'project' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                        >
                            Project Templates
                        </button>
                        <button 
                            onClick={() => setActiveTemplateType('task')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTemplateType === 'task' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                        >
                            Task Templates
                        </button>
                    </div>
                </div>

                {isLoadingTemplates ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Loader2 className="animate-spin mb-2" size={32} />
                        <p className="text-sm">Loading templates...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar pb-4">
                        {filteredTemplates.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center h-64 text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                <LayoutTemplate size={48} className="mb-4 opacity-20" />
                                <p className="text-sm font-medium">No {activeTemplateType} templates found.</p>
                                <p className="text-xs mt-1">Save a {activeTemplateType} as a template to see it here.</p>
                            </div>
                        ) : (
                            filteredTemplates.map(template => (
                                <div key={template.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`p-2 rounded-lg ${template.type === 'project' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'}`}>
                                            {template.type === 'project' ? <Briefcase size={20} /> : <CheckSquare size={20} />}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => setPreviewTemplate(template)}
                                                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title="Preview"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteTemplate(template.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1 line-clamp-1">{template.name}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2 h-8">{template.description || 'No description provided.'}</p>
                                    
                                    <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-[10px] text-slate-400">
                                        <span>{new Date(template.createdAt?.toDate ? template.createdAt.toDate() : template.createdAt).toLocaleDateString()}</span>
                                        <span className="uppercase font-bold tracking-wider">{template.type}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Preview Modal Overlay */}
                {previewTemplate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4" onClick={() => setPreviewTemplate(null)}>
                        <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                    <FileJson size={20} className="text-indigo-500" />
                                    Template Preview: {previewTemplate.name}
                                </h3>
                                <button onClick={() => setPreviewTemplate(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 bg-slate-50 dark:bg-black/20">
                                <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all">
                                    {JSON.stringify(previewTemplate.content, null, 2)}
                                </pre>
                            </div>
                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                <button onClick={() => setPreviewTemplate(null)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold transition-colors">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
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
                           <h3 className="font-bold text-slate-900 dark:text-white text-sm">Standard House Template</h3>
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

                   {/* Developer Zone - Only for Admin */}
                   {auth.currentUser?.email === 'admin@dev.com' && (
                       <div className="p-5 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/50 ring-1 ring-red-500/20">
                          <div className="flex items-start gap-4">
                             <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg shadow-sm text-red-600 dark:text-red-400">
                               <RefreshCcw size={24} />
                             </div>
                             <div className="flex-1">
                               <h3 className="font-bold text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                                   Developer Zone
                                   <span className="text-[10px] bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300 px-1.5 py-0.5 rounded uppercase">Admin Only</span>
                               </h3>
                               <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1 mb-4">
                                 Advanced system tools for database maintenance and diagnostics.
                               </p>
                               <div className="flex flex-wrap gap-3">
                                   <button
                                     onClick={handleFactoryReset}
                                     disabled={isResetting}
                                     className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white border border-transparent rounded-lg text-xs font-medium hover:bg-red-700 transition-colors shadow-sm active:scale-95 disabled:opacity-70"
                                   >
                                     {isResetting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                     Factory Reset
                                   </button>
                                   <button
                                     onClick={() => setIsHealthCheckOpen(true)}
                                     className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white border border-transparent rounded-lg text-xs font-medium hover:bg-slate-900 transition-colors shadow-sm active:scale-95"
                                   >
                                     <Activity size={14} />
                                     Run System Health Check
                                   </button>
                               </div>
                             </div>
                          </div>
                       </div>
                   )}

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

      <HealthCheckModal 
        isOpen={isHealthCheckOpen} 
        onClose={() => setIsHealthCheckOpen(false)} 
      />
    </div>
  );
};

export default SettingsView;
