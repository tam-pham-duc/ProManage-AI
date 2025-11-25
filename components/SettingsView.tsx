
import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, Database, AlertTriangle, FileJson, User, Sliders, LayoutTemplate, PlusCircle, LogOut, Loader2, KanbanSquare, Trash2, GripVertical, Plus, X, Camera, Lock, Save, ShieldCheck, RefreshCcw, Activity, Eye, FileText, Briefcase, CheckSquare, Check } from 'lucide-react';
import { Task, UserSettings, Tab, TaskPriority, KanbanColumn, Template } from '../types';
import { auth, db } from '../firebase';
import { signOut, updateProfile, updatePassword } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, doc, updateDoc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { useNotification } from '../context/NotificationContext';
import { clearDevData, generateDemoData } from '../services/demoDataService';
import HealthCheckModal from './HealthCheckModal';
import Avatar from './Avatar';

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

const TemplatePreview: React.FC<{ template: Template }> = ({ template }) => {
  const { type, content } = template;

  if (type === 'task') {
    return (
      <div className="space-y-6 p-2">
        <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-lg text-xs font-bold text-center border border-amber-200 dark:border-amber-800 flex items-center justify-center gap-2">
           <Eye size={14} /> Read-Only Task Template Preview
        </div>
        
        <div>
            <div className="flex justify-between items-start mb-3">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{content.title}</h3>
                <div className="flex gap-2">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                        {content.status || 'To Do'}
                    </span>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${content.priority === 'High' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' : content.priority === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'}`}>
                        {content.priority}
                    </span>
                </div>
            </div>
            
            {content.tags && content.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {content.tags.map((tag: any) => (
                        <span key={tag.id} className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${tag.colorClass || 'bg-slate-100 text-slate-600'}`}>
                            {tag.name}
                        </span>
                    ))}
                </div>
            )}

            <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-sm text-slate-700 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: content.description || '<p class="italic text-slate-400">No description provided.</p>' }} />
            </div>
        </div>

        {content.subtasks && content.subtasks.length > 0 && (
            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CheckSquare size={14} /> Checklist ({content.subtasks.length})
                </h4>
                <div className="space-y-2">
                    {content.subtasks.map((st: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg opacity-80">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${st.completed ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                {st.completed && <Check size={10} className="text-white" />}
                            </div>
                            <span className={`text-sm ${st.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}>{st.title}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Est. Cost</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">${content.estimatedCost || 0}</span>
            </div>
            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Est. Hours</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{content.estimatedHours || 0}h</span>
            </div>
        </div>
      </div>
    );
  } else if (type === 'project') {
    const projectData = content.project || {};
    const tasksData = content.tasks || [];
    const totalCost = tasksData.reduce((sum: number, t: any) => sum + (Number(t.estimatedCost) || 0), 0);

    return (
        <div className="flex flex-col h-full p-2">
             <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-200 px-4 py-2 rounded-lg text-xs font-bold text-center border border-indigo-200 dark:border-indigo-800 shrink-0 mb-6 flex items-center justify-center gap-2">
                <Eye size={14} /> Read-Only Project Template Preview
            </div>

            <div className="shrink-0 mb-6">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{template.name}</h3>
                {projectData.clientName && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300">
                        <User size={12} /> {projectData.clientName}
                    </div>
                )}
                {template.description && <p className="text-sm text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">{template.description}</p>}
            </div>

            <div className="flex-1 overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Briefcase size={14} /> Included Tasks ({tasksData.length})
                    </h4>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                    {tasksData.map((t: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                            <div className="min-w-0 flex-1 mr-4">
                                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{t.title}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${t.priority === 'High' ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600'}`}>
                                        {t.priority}
                                    </span>
                                    <span className="text-[10px] text-slate-400">{t.status}</span>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="block text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                                    ${Number(t.estimatedCost || 0).toLocaleString()}
                                </span>
                                <span className="text-[10px] text-slate-400">Est. Cost</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center rounded-b-xl">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Budget</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${totalCost.toLocaleString()}</span>
                </div>
            </div>
        </div>
    )
  }
  return <div className="p-4 text-center text-slate-500">Preview not available</div>;
};

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
  const templateFileInputRef = useRef<HTMLInputElement>(null);
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

  const handleExportTemplate = (template: Template) => {
      try {
          const payload = {
              version: 1,
              type: template.type,
              data: template.content,
              meta: { 
                  name: template.name, 
                  description: template.description || '' 
              }
          };
          const dataStr = JSON.stringify(payload, null, 2);
          const blob = new Blob([dataStr], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_template.json`;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          notify('success', "Template exported successfully.");
      } catch (e) {
          console.error(e);
          notify('error', "Failed to export template.");
      }
  };

  const handleImportTemplateClick = () => {
      templateFileInputRef.current?.click();
  };

  const handleImportTemplate = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
          const content = e.target?.result as string;
          try {
              const parsed = JSON.parse(content);
              
              // Basic Validation
              if (!parsed.version || !parsed.type || !parsed.data) {
                  throw new Error("Invalid template format.");
              }

              const currentUser = auth.currentUser;
              if (!currentUser) throw new Error("User not authenticated");

              await addDoc(collection(db, 'templates'), {
                  name: parsed.meta?.name || "Imported Template",
                  description: parsed.meta?.description || "",
                  type: parsed.type,
                  content: parsed.data,
                  createdBy: currentUser.uid,
                  createdAt: serverTimestamp(),
                  isDeleted: false
              });

              notify('success', "Template imported successfully.");
              
              // Refresh list if on templates tab (will happen automatically via useEffect if we reset activeTab or similar, 
              // but for now we just let the user reload or switch tabs as the useEffect runs on activeTab change)
              if (activeTab === 'templates') {
                  // Re-trigger fetch
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
              }
          } catch (e: any) {
              console.error("Import Template Error:", e);
              notify('error', e.message || "Failed to import template.");
          }
          
          if (templateFileInputRef.current) {
              templateFileInputRef.current.value = '';
          }
      };
      reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sliders size={20} className="text-indigo-500" />
                    Settings & Configuration
                </h2>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors">
                    <X size={24} />
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Navigation */}
                <div className="w-64 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-700 flex flex-col p-4 gap-2">
                    <button onClick={() => setActiveTab('general')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${activeTab === 'general' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}>
                        <User size={18} /> General
                    </button>
                    <button onClick={() => setActiveTab('preferences')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${activeTab === 'preferences' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}>
                        <KanbanSquare size={18} /> Preferences
                    </button>
                    <button onClick={() => setActiveTab('data')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${activeTab === 'data' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}>
                        <Database size={18} /> Data Management
                    </button>
                    <button onClick={() => setActiveTab('templates')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${activeTab === 'templates' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}>
                        <LayoutTemplate size={18} /> Templates
                    </button>
                    
                    <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <LogOut size={18} /> Sign Out
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white dark:bg-slate-800">
                    
                    {/* GENERAL TAB */}
                    {activeTab === 'general' && (
                        <div className="max-w-2xl space-y-8 animate-fade-in">
                            {/* Profile Section */}
                            <section>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">Profile Settings</h3>
                                <div className="flex gap-6 items-start">
                                    <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                                        <Avatar src={avatarPreview} name={profileName} className="w-24 h-24 text-3xl" />
                                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Camera className="text-white" size={24} />
                                        </div>
                                        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Display Name</label>
                                            <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Job Title</label>
                                            <input type="text" value={profileTitle} onChange={(e) => setProfileTitle(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white" />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div className="h-px bg-slate-200 dark:border-slate-700"></div>

                            {/* Password Section */}
                            <section>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2"><Lock size={18} /> Security</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">New Password</label>
                                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white" placeholder="Leave blank to keep current" />
                                    </div>
                                    {newPassword && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Confirm Password</label>
                                            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white" />
                                        </div>
                                    )}
                                </div>
                            </section>

                            <div className="h-px bg-slate-200 dark:border-slate-700"></div>

                            {/* Theme Section */}
                            <section className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white">Appearance</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Toggle between light and dark mode.</p>
                                </div>
                                <button onClick={toggleDarkMode} className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ${isDarkMode ? 'translate-x-7' : 'translate-x-1'}`}></div>
                                </button>
                            </section>

                            <div className="pt-4">
                                <button onClick={handleSaveProfile} disabled={isSavingProfile} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 transition-all flex items-center gap-2 disabled:opacity-50">
                                    {isSavingProfile ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    )}

                    {/* PREFERENCES TAB */}
                    {activeTab === 'preferences' && (
                        <div className="max-w-2xl space-y-8 animate-fade-in">
                            <section>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">Kanban Columns</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Customize the stages of your workflow.</p>
                                
                                <div className="space-y-3 mb-6">
                                    {columns.map((col) => (
                                        <div key={col.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="cursor-grab text-slate-400 hover:text-slate-600"><GripVertical size={16} /></div>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{col.title}</span>
                                                <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-slate-500 capitalize">{col.color}</span>
                                            </div>
                                            {/* Prevent deleting default columns if desired, or check tasks count */}
                                            {onDeleteColumn && (
                                                <button onClick={() => onDeleteColumn(col.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">New Column Name</label>
                                        <input type="text" value={newColumnTitle} onChange={(e) => setNewColumnTitle(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="e.g. Review" />
                                    </div>
                                    <div className="w-32 space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Color</label>
                                        <select value={newColumnColor} onChange={(e) => setNewColumnColor(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm cursor-pointer">
                                            <option value="blue">Blue</option>
                                            <option value="emerald">Green</option>
                                            <option value="purple">Purple</option>
                                            <option value="amber">Orange</option>
                                            <option value="rose">Red</option>
                                            <option value="slate">Gray</option>
                                        </select>
                                    </div>
                                    <button onClick={handleAddColumnClick} disabled={!newColumnTitle.trim()} className="px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
                                        Add
                                    </button>
                                </div>
                            </section>
                        </div>
                    )}

                    {/* DATA TAB */}
                    {activeTab === 'data' && (
                        <div className="max-w-2xl space-y-8 animate-fade-in">
                            <section>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Import / Export</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <button onClick={handleExport} className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors group text-left">
                                        <Download size={24} className="text-slate-400 group-hover:text-indigo-500 mb-3" />
                                        <div className="font-bold text-slate-900 dark:text-white">Export Data</div>
                                        <p className="text-xs text-slate-500 mt-1">Download all tasks as JSON backup.</p>
                                    </button>
                                    <button onClick={handleImportClick} className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors group text-left relative">
                                        {isImporting ? <Loader2 className="animate-spin text-indigo-500 mb-3" size={24} /> : <Upload size={24} className="text-slate-400 group-hover:text-indigo-500 mb-3" />}
                                        <div className="font-bold text-slate-900 dark:text-white">Import Data</div>
                                        <p className="text-xs text-slate-500 mt-1">Restore tasks from backup file.</p>
                                        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
                                    </button>
                                </div>
                            </section>

                            <div className="h-px bg-slate-200 dark:border-slate-700"></div>

                            <section>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Tools & Maintenance</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400"><Briefcase size={20} /></div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 dark:text-white">Load Demo Template</h4>
                                                <p className="text-xs text-slate-500">Adds sample "House Construction" tasks.</p>
                                            </div>
                                        </div>
                                        <button onClick={handleLoadTemplate} className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
                                            Load
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400"><Activity size={20} /></div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 dark:text-white">System Health Check</h4>
                                                <p className="text-xs text-slate-500">Run diagnostics on data integrity.</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setIsHealthCheckOpen(true)} className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
                                            Run
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400"><RefreshCcw size={20} /></div>
                                            <div>
                                                <h4 className="font-bold text-red-900 dark:text-red-100">Factory Reset</h4>
                                                <p className="text-xs text-red-700 dark:text-red-300">Clear all data and regenerate demo set.</p>
                                            </div>
                                        </div>
                                        <button onClick={handleFactoryReset} disabled={isResetting} className="px-4 py-2 bg-white dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 rounded-lg text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                                            {isResetting ? <Loader2 className="animate-spin" size={14} /> : 'Reset'}
                                        </button>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {/* TEMPLATES TAB */}
                    {activeTab === 'templates' && (
                        <div className="h-full flex flex-col animate-fade-in">
                            <div className="flex justify-between items-center mb-6 shrink-0">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Template Library</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage reusable project and task structures.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handleImportTemplateClick} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors">
                                        <Upload size={14} /> Import JSON
                                    </button>
                                    <input ref={templateFileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportTemplate} />
                                </div>
                            </div>

                            {/* Filter Tabs */}
                            <div className="flex gap-4 mb-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
                                <button onClick={() => { setActiveTemplateType('project'); setPreviewTemplate(null); }} className={`pb-2 text-sm font-bold transition-colors border-b-2 ${activeTemplateType === 'project' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500'}`}>Projects</button>
                                <button onClick={() => { setActiveTemplateType('task'); setPreviewTemplate(null); }} className={`pb-2 text-sm font-bold transition-colors border-b-2 ${activeTemplateType === 'task' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500'}`}>Tasks</button>
                            </div>

                            <div className="flex-1 flex gap-6 overflow-hidden">
                                {/* Template List */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                                    {isLoadingTemplates ? (
                                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500" size={24} /></div>
                                    ) : templates.filter(t => t.type === activeTemplateType).length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                            <LayoutTemplate size={32} className="mx-auto mb-3 opacity-30" />
                                            <p>No {activeTemplateType} templates found.</p>
                                        </div>
                                    ) : (
                                        templates.filter(t => t.type === activeTemplateType).map(t => (
                                            <div 
                                                key={t.id} 
                                                onClick={() => setPreviewTemplate(t)}
                                                className={`p-4 rounded-xl border cursor-pointer transition-all group relative ${previewTemplate?.id === t.id ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-200' : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{t.name}</h4>
                                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description || 'No description'}</p>
                                                    </div>
                                                    {/* Actions */}
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 absolute top-3 right-3">
                                                        <button onClick={(e) => { e.stopPropagation(); handleExportTemplate(t); }} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded"><Download size={14} /></button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} className="p-1.5 text-slate-400 hover:text-red-600 rounded"><Trash2 size={14} /></button>
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
                                                    <Clock size={12} /> {new Date(t.createdAt?.toDate ? t.createdAt.toDate() : t.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Preview Panel */}
                                {previewTemplate && (
                                    <div className="w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-4 overflow-y-auto custom-scrollbar shrink-0 animate-slide-in">
                                        <TemplatePreview template={previewTemplate} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>

        <HealthCheckModal isOpen={isHealthCheckOpen} onClose={() => setIsHealthCheckOpen(false)} />
    </div>
  );
};

export default SettingsView;
