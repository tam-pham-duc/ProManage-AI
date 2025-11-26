
import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, Database, FileJson, User, Sliders, LayoutTemplate, LogOut, Loader2, KanbanSquare, Trash2, GripVertical, Plus, X, Camera, Save, ShieldCheck, RefreshCcw, Activity, Eye, FileText, Briefcase, CheckSquare, Check, Edit2, Volume2, VolumeX, CalendarDays, CreditCard, MapPin, Tags, Cloud, AlertTriangle, HardDrive } from 'lucide-react';
import { Task, UserSettings, KanbanColumn, Template, Project } from '../types';
import { auth, db } from '../firebase';
import { signOut, updateProfile, updatePassword } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, doc, updateDoc, setDoc, getDocs, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { useNotification } from '../context/NotificationContext';
import { clearDevData, generateDemoData } from '../services/demoDataService';
import HealthCheckModal from './HealthCheckModal';
import ColorPicker from './ColorPicker';
import { TAG_PALETTE, getColorById } from '../utils/colors';
import { sanitizeFirestoreData } from '../utils/dataUtils';

interface SettingsViewProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  userSettings: UserSettings;
  setUserSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onLogout: () => void;
  columns?: KanbanColumn[];
  onAddColumn?: (title: string, color: string) => void;
  onEditColumn?: (columnId: string, title: string, color: string) => void;
  onDeleteColumn?: (columnId: string) => void;
  project?: Project | null;
  onUpdateProject?: (projectData: Partial<Project>) => Promise<void>;
}

type SettingsTab = 'general' | 'preferences' | 'project' | 'data' | 'templates';

const SUPER_ADMIN_EMAIL = 'admin@dev.com';

// Default Statuses if none exist
const DEFAULT_STATUSES = [
  { id: 'active', label: 'Active', color: 'emerald-1' },
  { id: 'hold', label: 'On Hold', color: 'amber-1' },
  { id: 'completed', label: 'Completed', color: 'blue-1' },
  { id: 'archived', label: 'Archived', color: 'slate-1' }
];

const safeParseDate = (dateInput: any): Date | null => {
    if (!dateInput) return null;
    try {
        if (typeof dateInput === 'object' && 'seconds' in dateInput) {
            return new Date(dateInput.seconds * 1000);
        }
        if (typeof dateInput === 'object' && typeof dateInput.toDate === 'function') {
            return dateInput.toDate();
        }
        const d = new Date(dateInput);
        return isNaN(d.getTime()) ? null : d;
    } catch (e) {
        return null;
    }
};

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
      </div>
    );
  } else if (type === 'project') {
    const projectData = content.project || {};
    const tasksData = content.tasks || [];
    
    return (
        <div className="flex flex-col h-full p-2">
             <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-200 px-4 py-2 rounded-lg text-xs font-bold text-center border border-indigo-200 dark:border-indigo-800 shrink-0 mb-6 flex items-center justify-center gap-2">
                <Eye size={14} /> Read-Only Project Template Preview
            </div>

            <div className="shrink-0 mb-6">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{template.name}</h3>
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
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
  }
  return <div className="p-4 text-center text-slate-500">Preview not available</div>;
};

const SettingsView: React.FC<SettingsViewProps> = ({ 
  isOpen,
  onClose,
  tasks, 
  userSettings,
  setUserSettings,
  isDarkMode,
  toggleDarkMode,
  onLogout,
  columns = [],
  onAddColumn,
  onEditColumn,
  onDeleteColumn,
  project,
  onUpdateProject
}) => {
  const { notify } = useNotification();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // --- General Tab State ---
  const [profileName, setProfileName] = useState(userSettings.userName);
  const [profileTitle, setProfileTitle] = useState(userSettings.userTitle);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(auth.currentUser?.photoURL || null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // --- Project Tab State ---
  const [projectName, setProjectName] = useState('');
  const [projectClient, setProjectClient] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const [isSavingProject, setIsSavingProject] = useState(false);

  // --- Data Tab State ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateFileInputRef = useRef<HTMLInputElement>(null);
  const userRestoreInputRef = useRef<HTMLInputElement>(null);
  
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState('');
  
  const [isResetting, setIsResetting] = useState(false);
  const [isHealthCheckOpen, setIsHealthCheckOpen] = useState(false);
  
  // --- Templates Tab State ---
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTemplateType, setActiveTemplateType] = useState<'project' | 'task'>('project');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  // --- Kanban Column Local State ---
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [newColumnColor, setNewColumnColor] = useState('blue-1');

  // --- Project Status Local State ---
  const [projectStatuses, setProjectStatuses] = useState<any[]>(DEFAULT_STATUSES);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('slate-1');

  // --- INITIALIZATION EFFECTS (Split to prevent bugs) ---

  // 1. Tab State Management (Only reset when opening)
  useEffect(() => {
    if (isOpen) {
      setActiveTab('general');
    }
  }, [isOpen]);

  // 2. User Data Sync
  useEffect(() => {
    if (isOpen) {
      setProfileName(userSettings.userName);
      setProfileTitle(userSettings.userTitle);
      if (auth.currentUser?.photoURL) {
          setAvatarPreview(auth.currentUser.photoURL);
      }
      if (auth.currentUser?.email === SUPER_ADMIN_EMAIL) {
          setIsAdmin(true);
      }
    }
  }, [isOpen, userSettings]);

  // 3. Project Data Sync
  useEffect(() => {
    if (isOpen && project) {
        setProjectName(project.name);
        setProjectClient(project.clientName);
        setProjectAddress(project.address);
    }
  }, [isOpen, project]);

  // 4. Statuses Sync
  useEffect(() => {
    if (!isOpen) return;
    
    const user = auth.currentUser;
    if (user) {
        const userRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.projectStatuses && Array.isArray(data.projectStatuses)) {
                    setProjectStatuses(data.projectStatuses);
                }
            }
        });
        return () => unsubscribe();
    }
  }, [isOpen]);

  // Fetch Templates Effect
  useEffect(() => {
    if (activeTab === 'templates' && isOpen) {
        const fetchTemplates = async () => {
            setIsLoadingTemplates(true);
            try {
                const snap = await getDocs(collection(db, 'templates'));
                const data = snap.docs
                    .map(d => ({ id: d.id, ...d.data() } as Template))
                    .filter(t => !t.isDeleted)
                    .sort((a, b) => {
                         const dateA = safeParseDate(a.createdAt)?.getTime() || 0;
                         const dateB = safeParseDate(b.createdAt)?.getTime() || 0;
                         return dateB - dateA;
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
  }, [activeTab, isOpen]);

  // --- Profile Handlers ---
  const handleAvatarClick = () => { avatarInputRef.current?.click(); };

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
    setIsSavingProfile(true);

    try {
        const user = auth.currentUser;
        if (!user) throw new Error("No user logged in");

        // 1. Basic Info Update
        await updateProfile(user, { displayName: profileName, photoURL: avatarPreview });
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
            username: profileName,
            jobTitle: profileTitle,
            avatar: avatarPreview || null,
        }, { merge: true });

        setUserSettings(prev => ({ ...prev, userName: profileName, userTitle: profileTitle }));
        notify('success', "Profile information updated.");

        // 2. Password Update (Distinct block)
        if (newPassword) {
            if (newPassword !== confirmPassword) {
                notify('error', "Passwords do not match. Password not changed.");
            } else if (newPassword.length < 6) {
                notify('error', "Password must be 6+ chars. Password not changed.");
            } else {
                try {
                    await updatePassword(user, newPassword);
                    notify('success', "Password updated successfully.");
                    setNewPassword('');
                    setConfirmPassword('');
                } catch (pwError: any) {
                    console.error(pwError);
                    notify('error', "Failed to update password. Requires recent login.");
                }
            }
        }
    } catch (error: any) {
        console.error("Error updating profile:", error);
        notify('error', "Failed to update profile info.");
    } finally {
        setIsSavingProfile(false);
    }
  };

  const handleSaveProject = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!project || !onUpdateProject) return;
      
      setIsSavingProject(true);
      try {
          await onUpdateProject({
              name: projectName,
              clientName: projectClient,
              address: projectAddress
          });
          notify('success', "Project settings updated.");
      } catch (e) {
          console.error(e);
          notify('error', "Failed to update project settings.");
      } finally {
          setIsSavingProject(false);
      }
  };

  // --- Data Management Handlers (User Backup/Restore) ---
  const handleUserBackup = async () => {
      setIsBackingUp(true);
      try {
          const user = auth.currentUser;
          if (!user) return;

          // Fetch user's projects
          const projQ = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
          const projSnap = await getDocs(projQ);
          // Sanitizing here to avoid circular reference errors (DocumentReference) and normalize Timestamps
          const projects = projSnap.docs.map(d => ({ id: d.id, ...sanitizeFirestoreData(d.data()) }));

          // Fetch user's tasks
          const taskQ = query(collection(db, 'tasks'), where('ownerId', '==', user.uid));
          const taskSnap = await getDocs(taskQ);
          const tasks = taskSnap.docs.map(d => ({ id: d.id, ...sanitizeFirestoreData(d.data()) }));

          const backupData = {
              meta: {
                  version: "1.0",
                  date: new Date().toISOString(),
                  user: user.uid,
                  type: "full_user_backup"
              },
              projects,
              tasks
          };

          const dataStr = JSON.stringify(backupData, null, 2);
          const blob = new Blob([dataStr], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `promanage_backup_${new Date().toISOString().split('T')[0]}.json`;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          notify('success', `Backup downloaded: ${projects.length} Projects, ${tasks.length} Tasks`);

      } catch (e) {
          console.error("Backup failed:", e);
          notify('error', 'Backup failed. Please try again.');
      } finally {
          setIsBackingUp(false);
      }
  };

  const handleUserRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!window.confirm("This will merge data from the file into your account. Existing items with matching IDs will be updated. Continue?")) {
          if (userRestoreInputRef.current) userRestoreInputRef.current.value = '';
          return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
          const content = e.target?.result as string;
          setIsRestoring(true);
          setRestoreProgress('Parsing file...');

          try {
              const data = JSON.parse(content);
              if (!data.projects || !Array.isArray(data.projects) || !data.tasks || !Array.isArray(data.tasks)) {
                  throw new Error("Invalid backup file format.");
              }

              const projects = data.projects;
              const tasks = data.tasks;
              const totalItems = projects.length + tasks.length;
              
              setRestoreProgress(`Starting restore of ${totalItems} items...`);

              // Helper for batch processing
              const processBatch = async (items: any[], collectionName: string) => {
                  const chunks = [];
                  for (let i = 0; i < items.length; i += 400) {
                      chunks.push(items.slice(i, i + 400));
                  }

                  let processedCount = 0;
                  for (const chunk of chunks) {
                      const batch = writeBatch(db);
                      chunk.forEach((item: any) => {
                          const ref = doc(db, collectionName, item.id);
                          // Ensure sensitive fields are sanitized if needed, or trust backup
                          batch.set(ref, item, { merge: true });
                      });
                      await batch.commit();
                      processedCount += chunk.length;
                      setRestoreProgress(`Restored ${processedCount} / ${items.length} ${collectionName}...`);
                  }
              };

              await processBatch(projects, 'projects');
              await processBatch(tasks, 'tasks');

              notify('success', `Restore complete! ${totalItems} items processed.`);
              setTimeout(() => window.location.reload(), 1500); // Refresh to load data

          } catch (err: any) {
              console.error("Restore failed:", err);
              notify('error', `Restore failed: ${err.message}`);
          } finally {
              setIsRestoring(false);
              setRestoreProgress('');
              if (userRestoreInputRef.current) userRestoreInputRef.current.value = '';
          }
      };
      reader.readAsText(file);
  };

  // --- Admin Data Handlers ---
  const handleFactoryReset = async () => {
      if (!window.confirm("WARNING: This will wipe ALL data. Continue?")) return;
      setIsResetting(true);
      try {
          const uid = auth.currentUser?.uid;
          if (uid) {
              await clearDevData(uid);
              await generateDemoData(uid);
              notify('success', "System reset complete.");
              setTimeout(() => window.location.reload(), 1000);
          }
      } catch (e) {
          notify('error', "Reset failed.");
      } finally {
          setIsResetting(false);
      }
  };

  // --- Column Handlers ---
  const handleAddColumnClick = () => {
    if (newColumnTitle.trim() && onAddColumn) {
        onAddColumn(newColumnTitle.trim(), newColumnColor);
        setNewColumnTitle('');
        setNewColumnColor('blue-1');
    }
  };

  // --- Project Status Handlers ---
  const handleAddStatus = async () => {
      if (!newStatusLabel.trim() || !auth.currentUser) return;
      const newStatuses = [...projectStatuses, { id: Date.now().toString(), label: newStatusLabel.trim(), color: newStatusColor }];
      setProjectStatuses(newStatuses);
      setNewStatusLabel('');
      setNewStatusColor('slate-1');
      try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), { projectStatuses: newStatuses });
          notify('success', 'Status added');
      } catch (e) {
          notify('error', 'Failed to save status');
      }
  };

  const handleDeleteStatus = async (id: string) => {
      if (projectStatuses.length <= 1) {
          notify('warning', 'At least one status is required');
          return;
      }
      if (!auth.currentUser) return;
      const newStatuses = projectStatuses.filter(s => s.id !== id);
      setProjectStatuses(newStatuses);
      try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), { projectStatuses: newStatuses });
          notify('success', 'Status deleted');
      } catch (e) {
          notify('error', 'Failed to delete status');
      }
  };

  const handleStatusColorChange = async (statusId: string, newColor: string) => {
      if (!auth.currentUser) return;
      const newStatuses = projectStatuses.map(s => s.id === statusId ? { ...s, color: newColor } : s);
      setProjectStatuses(newStatuses);
      try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), { projectStatuses: newStatuses });
      } catch (e) {
          console.error(e);
      }
  };

  // --- Template Handlers ---
  const handleDeleteTemplate = async (id: string) => {
      if(!window.confirm("Delete this template?")) return;
      try {
          await updateDoc(doc(db, 'templates', id), { isDeleted: true, deletedAt: serverTimestamp() });
          setTemplates(prev => prev.filter(t => t.id !== id));
          notify('success', 'Template deleted');
      } catch (e) {
          notify('error', 'Failed to delete template');
      }
  };

  const handleExportTemplate = (template: Template) => {
      const payload = { version: 1, type: template.type, data: template.content, meta: { name: template.name, description: template.description } };
      const dataStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${template.name.replace(/[^a-z0-9]/gi, '_')}_template.json`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const handleImportTemplate = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
          const content = e.target?.result as string;
          try {
              const parsed = JSON.parse(content);
              if (!parsed.data) throw new Error("Invalid template");
              await addDoc(collection(db, 'templates'), {
                  name: parsed.meta?.name || "Imported Template",
                  description: parsed.meta?.description || "",
                  type: parsed.type || 'project',
                  content: parsed.data,
                  createdBy: auth.currentUser?.uid,
                  createdAt: serverTimestamp(),
                  isDeleted: false
              });
              notify('success', "Template imported.");
              // Refresh
              const snap = await getDocs(collection(db, 'templates'));
              setTemplates(snap.docs.map(d => ({id: d.id, ...d.data()} as Template)).filter(t => !t.isDeleted));
          } catch (err) {
              notify('error', "Import failed.");
          } finally {
              if (templateFileInputRef.current) templateFileInputRef.current.value = '';
          }
      };
      reader.readAsText(file);
  };

  const filteredTemplates = templates.filter(t => t.type === activeTemplateType);

  // Preference Toggle Helper
  const updatePref = (key: keyof UserSettings, value: any) => {
      setUserSettings(prev => ({ ...prev, [key]: value }));
  };

  // Tabs config
  const tabs = [
    { id: 'general', label: 'General', icon: User },
    { id: 'preferences', label: 'Preferences', icon: Sliders },
  ];
  if (project) {
      tabs.push({ id: 'project', label: 'Project', icon: Briefcase });
  }
  tabs.push({ id: 'templates', label: 'Templates', icon: LayoutTemplate });
  
  // Data Management is now available to all users
  tabs.push({ id: 'data', label: 'Data Control', icon: Database });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
        <div className="bg-white dark:bg-slate-800 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-[85vh]">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800 shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Global preferences and configuration.</p>
                </div>
                <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                    <X size={24} />
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-64 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as SettingsTab)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'}`}
                            >
                                <Icon size={18} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800">
                
                {/* --- TAB 1: GENERAL --- */}
                {activeTab === 'general' && (
                    <div className="max-w-xl space-y-8 animate-fade-in">
                    <form onSubmit={handleSaveProfile} className="space-y-8">
                        <div className="flex items-center gap-6">
                        <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg overflow-hidden border-4 border-white dark:border-slate-700">
                            {avatarPreview ? <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" /> : profileName.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="text-white" size={24} /></div>
                            <input type="file" ref={avatarInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Profile Information</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Update your photo and personal details.</p>
                        </div>
                        </div>

                        <div className="space-y-5">
                        <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Display Name</label><input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white" required /></div>
                        <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Job Title</label><input type="text" value={profileTitle} onChange={(e) => setProfileTitle(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white" /></div>
                        </div>

                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-6"></div>

                        <div className="space-y-5">
                            <div className="flex items-center gap-2 mb-2"><ShieldCheck className="text-indigo-600 dark:text-indigo-400" size={20} /><h3 className="text-lg font-bold text-slate-900 dark:text-white">Security</h3></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">New Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white" placeholder="Min 6 chars" /></div>
                                <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Confirm</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white" /></div>
                            </div>
                        </div>

                        <div className="pt-6 flex items-center justify-between border-t border-slate-100 dark:border-slate-700">
                            <button type="button" onClick={() => { signOut(auth); onLogout(); }} className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold hover:text-red-700 dark:hover:text-red-300 transition-colors px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"><LogOut size={16} /> Log Out</button>
                            <button type="submit" disabled={isSavingProfile} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 disabled:opacity-70">{isSavingProfile ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Save Changes</button>
                        </div>
                    </form>
                    </div>
                )}

                {/* --- TAB 2: PREFERENCES --- */}
                {activeTab === 'preferences' && (
                    <div className="max-w-4xl space-y-8 animate-fade-in">
                    {/* Section A: Visual & Region */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><CalendarDays size={18} className="text-indigo-500" /> Visual & Region</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Date Format</label>
                                <select 
                                    value={userSettings.dateFormat || 'MM/DD/YYYY'} 
                                    onChange={(e) => updatePref('dateFormat', e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                                    <option value="DD/MM/YYYY">DD/MM/YYYY (World)</option>
                                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Card Density</label>
                                <div className="flex gap-2 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
                                    <button 
                                        onClick={() => updatePref('cardDensity', 'comfortable')} 
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${userSettings.cardDensity === 'comfortable' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500'}`}
                                    >Comfortable</button>
                                    <button 
                                        onClick={() => updatePref('cardDensity', 'compact')} 
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${userSettings.cardDensity === 'compact' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500'}`}
                                    >Compact</button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Dark Mode</span>
                            <button onClick={toggleDarkMode} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                        </div>
                    </div>

                    {/* Section B: Behavior */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><Activity size={18} className="text-emerald-500" /> Behavior</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Start Page</label>
                                <select 
                                    value={userSettings.defaultView || 'dashboard'} 
                                    onChange={(e) => updatePref('defaultView', e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none capitalize"
                                >
                                    <option value="dashboard">Dashboard</option>
                                    <option value="kanban">Kanban Board</option>
                                    <option value="timeline">Timeline</option>
                                    <option value="calendar">Calendar</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-600">
                                <div className="flex items-center gap-3">
                                    {userSettings.soundEnabled ? <Volume2 size={18} className="text-indigo-500" /> : <VolumeX size={18} className="text-slate-400" />}
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Sound Effects</span>
                                </div>
                                <button onClick={() => updatePref('soundEnabled', !userSettings.soundEnabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${userSettings.soundEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${userSettings.soundEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                            </div>
                        </div>
                    </div>

                    {/* Section C: Kanban Columns */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><KanbanSquare size={18} className="text-purple-500" /> Kanban Columns</h3>
                        <div className="space-y-3 mb-4">
                            {columns.map((col) => {
                                return (
                                <div key={col.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl group">
                                    <GripVertical size={16} className="text-slate-400 cursor-grab" />
                                    <ColorPicker 
                                        selectedColorId={col.color} 
                                        onChange={(newColor) => onEditColumn && onEditColumn(col.id, col.title, newColor)} 
                                    />
                                    <input 
                                        type="text" 
                                        defaultValue={col.title} 
                                        onBlur={(e) => onEditColumn && onEditColumn(col.id, e.target.value, col.color)}
                                        className="flex-1 bg-transparent outline-none text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400 border-b border-transparent focus:border-indigo-500 px-2 py-1 transition-colors"
                                        placeholder="Column Name"
                                    />
                                    {onDeleteColumn && (
                                        <button 
                                            onClick={() => onDeleteColumn(col.id)} 
                                            className="p-2 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            )})}
                        </div>
                        {onAddColumn && (
                            <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl">
                                <Plus size={16} className="text-slate-400 ml-1" />
                                <ColorPicker selectedColorId={newColumnColor} onChange={setNewColumnColor} />
                                <input type="text" value={newColumnTitle} onChange={(e) => setNewColumnTitle(e.target.value)} placeholder="New Column Name" className="flex-1 bg-transparent outline-none text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400" onKeyDown={(e) => e.key === 'Enter' && handleAddColumnClick()} />
                                <button onClick={handleAddColumnClick} disabled={!newColumnTitle.trim()} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50">Add</button>
                            </div>
                        )}
                    </div>

                    {/* Section D: Project Statuses */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><Tags size={18} className="text-amber-500" /> Project Statuses</h3>
                        <div className="space-y-3 mb-4">
                            {projectStatuses.map((status) => {
                                return (
                                    <div key={status.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl">
                                        <ColorPicker selectedColorId={status.color} onChange={(newColor) => handleStatusColorChange(status.id, newColor)} />
                                        <span className="flex-1 font-medium text-sm text-slate-700 dark:text-slate-200">{status.label}</span>
                                        <button onClick={() => handleDeleteStatus(status.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl">
                            <Plus size={16} className="text-slate-400 ml-1" />
                            <ColorPicker selectedColorId={newStatusColor} onChange={setNewStatusColor} />
                            <input type="text" value={newStatusLabel} onChange={(e) => setNewStatusLabel(e.target.value)} placeholder="New Status Name" className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder-slate-400" onKeyDown={(e) => e.key === 'Enter' && handleAddStatus()} />
                            <button onClick={handleAddStatus} disabled={!newStatusLabel.trim()} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50">Add</button>
                        </div>
                    </div>

                    </div>
                )}

                {/* --- TAB 3: PROJECT --- */}
                {activeTab === 'project' && project && (
                    <div className="max-w-xl space-y-8 animate-fade-in">
                        <form onSubmit={handleSaveProject} className="space-y-6">
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                        <Briefcase size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-indigo-900 dark:text-indigo-200">Current Project Settings</h3>
                                        <p className="text-xs text-indigo-700 dark:text-indigo-300">Editing: {project.name}</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Project Name</label>
                                <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white" required />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Client Name</label>
                                <input type="text" value={projectClient} onChange={(e) => setProjectClient(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white" />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1"><MapPin size={14}/> Site Address</label>
                                <input type="text" value={projectAddress} onChange={(e) => setProjectAddress(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white" />
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                                <button type="submit" disabled={isSavingProject} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 disabled:opacity-70">
                                    {isSavingProject ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 
                                    Save Project Details
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* --- TAB 4: TEMPLATES --- */}
                {activeTab === 'templates' && (
                    <div className="max-w-4xl mx-auto animate-fade-in h-full flex flex-col">
                        <div className="flex items-center justify-between mb-6 shrink-0">
                            <div><h2 className="text-xl font-bold text-slate-900 dark:text-white">Template Manager</h2><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your saved project and task templates.</p></div>
                            <div className="flex items-center gap-3">
                                <input type="file" ref={templateFileInputRef} className="hidden" accept=".json" onChange={handleImportTemplate} />
                                <button onClick={() => templateFileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm"><Upload size={14} /> Import</button>
                                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                                    <button onClick={() => setActiveTemplateType('project')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTemplateType === 'project' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Project</button>
                                    <button onClick={() => setActiveTemplateType('task')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTemplateType === 'task' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Task</button>
                                </div>
                            </div>
                        </div>

                        {isLoadingTemplates ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400"><Loader2 className="animate-spin mb-2" size={32} /><p className="text-sm">Loading templates...</p></div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar pb-4">
                                {filteredTemplates.length === 0 ? (
                                    <div className="col-span-full flex flex-col items-center justify-center h-64 text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700"><LayoutTemplate size={48} className="mb-4 opacity-20" /><p className="text-sm font-medium">No {activeTemplateType} templates found.</p></div>
                                ) : (
                                    filteredTemplates.map(template => (
                                        <div key={template.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className={`p-2 rounded-lg ${template.type === 'project' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'}`}>{template.type === 'project' ? <Briefcase size={20} /> : <CheckSquare size={20} />}</div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleExportTemplate(template)} className="p-1.5 text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"><Download size={16} /></button>
                                                    <button onClick={() => setPreviewTemplate(template)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Eye size={16} /></button>
                                                    <button onClick={() => handleDeleteTemplate(template.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1 line-clamp-1">{template.name}</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2 h-8">{template.description || 'No description.'}</p>
                                            <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-[10px] text-slate-400">
                                                <span>{safeParseDate(template.createdAt)?.toLocaleDateString()}</span>
                                                <span className="uppercase font-bold tracking-wider">{template.type}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                        {previewTemplate && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4" onClick={() => setPreviewTemplate(null)}>
                                <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50"><h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2"><FileJson size={20} className="text-indigo-500" /> Template Preview</h3><button onClick={() => setPreviewTemplate(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button></div>
                                    <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-slate-900"><TemplatePreview template={previewTemplate} /></div>
                                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/50"><button onClick={() => setPreviewTemplate(null)} className="px-4 py-2 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 rounded-lg text-sm font-bold transition-colors shadow-sm">Close</button></div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- TAB 5: DATA MANAGEMENT (ALL USERS) --- */}
                {activeTab === 'data' && (
                    <div className="max-w-xl space-y-8 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Data Management</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Manage your personal data, backups, and imports.</p>
                            
                            <div className="space-y-4">
                                {/* Backup & Restore Section */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                                                <Cloud size={20} />
                                            </div>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Backup Data</h3>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 min-h-[32px]">
                                            Download a copy of all your projects and tasks.
                                        </p>
                                        <button 
                                            onClick={handleUserBackup} 
                                            disabled={isBackingUp}
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                                        >
                                            {isBackingUp ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                                            Download JSON
                                        </button>
                                    </div>

                                    <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                                <HardDrive size={20} />
                                            </div>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Restore Data</h3>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 min-h-[32px]">
                                            Import projects from a backup file.
                                        </p>
                                        {isRestoring ? (
                                            <div className="w-full py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-500 flex items-center justify-center gap-2 animate-pulse">
                                                <Loader2 className="animate-spin" size={14} />
                                                {restoreProgress || 'Restoring...'}
                                            </div>
                                        ) : (
                                            <>
                                                <input 
                                                    type="file" 
                                                    accept=".json" 
                                                    ref={userRestoreInputRef} 
                                                    onChange={handleUserRestore} 
                                                    className="hidden" 
                                                />
                                                <button 
                                                    onClick={() => userRestoreInputRef.current?.click()} 
                                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    <Upload size={14} />
                                                    Upload File
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="h-px bg-slate-100 dark:bg-slate-700 my-6"></div>

                                {/* Admin Tools - Only Visible to Admin */}
                                {isAdmin && (
                                    <div className="p-5 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/50 ring-1 ring-red-500/20">
                                        <div className="flex items-start gap-4">
                                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg shadow-sm text-red-600 dark:text-red-400"><RefreshCcw size={24} /></div>
                                            <div className="flex-1">
                                            <h3 className="font-bold text-red-700 dark:text-red-400 text-sm flex items-center gap-2">Developer Zone <span className="text-[10px] bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300 px-1.5 py-0.5 rounded uppercase">Admin Only</span></h3>
                                            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1 mb-4">Advanced system tools for database maintenance and diagnostics.</p>
                                            <div className="flex flex-wrap gap-3">
                                                <button onClick={handleFactoryReset} disabled={isResetting} className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white border border-transparent rounded-lg text-xs font-medium hover:bg-red-700 transition-colors shadow-sm active:scale-95 disabled:opacity-70">{isResetting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Factory Reset</button>
                                                <button onClick={() => setIsHealthCheckOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white border border-transparent rounded-lg text-xs font-medium hover:bg-slate-900 transition-colors shadow-sm active:scale-95"><Activity size={14} /> Run System Health Check</button>
                                            </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                </div>
            </div>

            <HealthCheckModal isOpen={isHealthCheckOpen} onClose={() => setIsHealthCheckOpen(false)} />
        </div>
    </div>
  );
};

export default SettingsView;
