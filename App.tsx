
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Menu, Search, Loader2, Settings, Trash2, Edit3, ChevronDown, Copy, PanelLeft, AlertTriangle, Send, X } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import KanbanBoard from './components/KanbanBoard';
import { ListView } from './components/ListView';
import Timeline from './components/Timeline';
import CalendarView from './components/CalendarView';
import ProjectMapView from './components/ProjectMapView';
import TaskModal from './components/TaskModal';
import ProjectModal from './components/ProjectModal';
import FilterBar from './components/FilterBar';
import SettingsView from './components/SettingsView';
import AuthScreen from './components/AuthScreen';
import ProjectHub from './components/ProjectHub';
import BackgroundLayer from './components/BackgroundLayer';
import ReminderModal from './components/ReminderModal';
import NotificationCenter from './components/NotificationCenter';
import TrashView from './components/TrashView';
import CommandPalette from './components/CommandPalette';
import ImageGenerator from './components/ImageGenerator';
import ActiveTimerBar from './components/ActiveTimerBar';
import PageTransition from './components/PageTransition';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import { TimeTrackingProvider } from './context/TimeTrackingContext';
import { Tab, Task, TaskStatus, ActivityLog, UserSettings, Tag, User, KanbanColumn, Project, ProjectMember, ProjectRole, ActivityType } from './types';
import { logProjectActivity } from './services/activityService';
import { createTasksFromTemplate, getTemplateById } from './services/templateService';

// Firebase Imports
import { auth, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser, signOut, sendEmailVerification } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs, writeBatch, or } from 'firebase/firestore';

const THEME_KEY = 'promanage_theme_v1';
const SETTINGS_KEY = 'promanage_settings_v1';
const TAGS_KEY = 'promanage_tags_v1';
const PROJECT_KEY = 'promanage_project_v1';
const SIDEBAR_KEY = 'promanage_sidebar_open';
const SNOOZE_KEY = 'app_snooze_until';
const SUPER_ADMIN_EMAIL = 'admin@dev.com';

const TAG_COLORS = [
  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
];

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'col-1', title: 'To Do', color: 'slate' },
  { id: 'col-2', title: 'In Progress', color: 'blue' },
  { id: 'col-3', title: 'Done', color: 'emerald' },
];

// Views that are part of the Infinity Scroll Workspace
const WORKSPACE_VIEWS: Tab[] = ['dashboard', 'kanban', 'list', 'timeline', 'map', 'calendar', 'trash', 'image-gen'];

// Section Wrapper Component
const Section: React.FC<{ id: string; children: React.ReactNode; className?: string }> = ({ id, children, className = "" }) => (
  <section 
    id={id} 
    className={`h-full w-full overflow-y-auto relative bg-slate-50 dark:bg-slate-950 pt-6 px-4 md:px-6 pb-20 border-b border-slate-200 dark:border-slate-800 ${className}`}
  >
     {children}
  </section>
);

// Helper to normalize task data for state updates
const normalizeTaskData = (task: Partial<Task>): Partial<Task> => {
  const normalized = { ...task };
  const dateFields = ['startDate', 'dueDate', 'createdAt', 'updatedAt', 'deletedAt'] as const;

  dateFields.forEach(field => {
    const val = normalized[field];
    if (val) {
      if (typeof val === 'object' && 'toDate' in val && typeof val.toDate === 'function') {
         normalized[field] = val.toDate().toISOString();
      } else if (val instanceof Date) {
         normalized[field] = val.toISOString();
      }
    }
  });
  
  return normalized;
};

// Helper to ensure consistent data format throughout the app
const sanitizeFirestoreData = (data: any): any => {
  if (data === null || data === undefined) return data;
  if (data && typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeFirestoreData(item));
  }
  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitized[key] = sanitizeFirestoreData(data[key]);
      }
    }
    return sanitized;
  }
  return data;
};

const App: React.FC = () => {
  const { notify } = useNotification();
  
  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); 
  const [isSeeding, setIsSeeding] = useState(false);

  // --- Project State ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    return localStorage.getItem(PROJECT_KEY);
  });

  // --- Project Modal State ---
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);

  // --- Global Search State ---
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // --- Global Settings Modal State ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // --- User Settings State ---
  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      const parsed = saved ? JSON.parse(saved) : {};
      return {
        userName: parsed.userName || 'Guest',
        userTitle: parsed.userTitle || 'Viewer',
        defaultView: parsed.defaultView || 'dashboard',
        dateFormat: parsed.dateFormat || 'MM/DD/YYYY',
        cardDensity: parsed.cardDensity || 'comfortable',
        soundEnabled: parsed.soundEnabled !== undefined ? parsed.soundEnabled : true,
        kanbanDisplay: parsed.kanbanDisplay || {
            showId: false,
            showAvatar: true,
            showPriority: true,
            showTags: true
        }
      };
    } catch (e) {
      return { 
          userName: 'Guest', 
          userTitle: 'Viewer', 
          defaultView: 'dashboard',
          dateFormat: 'MM/DD/YYYY',
          cardDensity: 'comfortable',
          soundEnabled: true,
          kanbanDisplay: { showId: false, showAvatar: true, showPriority: true, showTags: true }
      };
    }
  });

  // --- Main App State ---
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    try {
      return userSettings.defaultView; 
    } catch (e) {
      return 'dashboard';
    }
  });

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_KEY);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [initialTaskDate, setInitialTaskDate] = useState<string | undefined>(undefined);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>(DEFAULT_COLUMNS);

  // Reminder State
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderTasks, setReminderTasks] = useState<Task[]>([]);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved ? JSON.parse(saved) : false;
    } catch (e) {
      return false;
    }
  });

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Available Tags State
  const [availableTags, setAvailableTags] = useState<Tag[]>(() => {
    try {
      const saved = localStorage.getItem(TAGS_KEY);
      return saved ? JSON.parse(saved) : [
        { id: 'tag1', name: 'Design', colorClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
        { id: 'tag2', name: 'Development', colorClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
        { id: 'tag3', name: 'Bug', colorClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
        { id: 'tag4', name: 'Research', colorClass: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' },
      ];
    } catch (e) {
      return [];
    }
  });

  // Banner State
  const [showBanner, setShowBanner] = useState(true);

  // Scroll Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // --- Permission Logic Hook ---
  const currentProject = projects.find(p => p.id === selectedProjectId);
  
  const userRole = useMemo<ProjectRole>(() => {
      if (currentUser?.email === SUPER_ADMIN_EMAIL) return 'admin'; // Super Admin God Mode
      if (!currentProject || !currentUser) return 'guest';
      // If owner, assume admin
      if (currentProject.ownerId === currentUser.id) return 'admin';
      
      const member = currentProject.members?.find(m => m.uid === currentUser.id);
      return member?.role || 'guest';
  }, [currentProject, currentUser]);

  // --- Global Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K for Global Search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Theme Effect ---
  useEffect(() => { 
      localStorage.setItem(THEME_KEY, JSON.stringify(isDarkMode));
      if (isDarkMode) {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  }, [isDarkMode]);

  // --- Firebase Auth Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const expiry = localStorage.getItem('session_expiry');
        if (expiry && Date.now() > parseInt(expiry)) {
            signOut(auth).then(() => {
                localStorage.removeItem('session_expiry');
                notify('warning', 'Session expired. Please login again.');
                return;
            });
        }

        const userRef = doc(db, 'users', firebaseUser.uid);
        const unsubUser = onSnapshot(userRef, (docSnap) => {
           if (docSnap.exists()) {
               const data = docSnap.data();
               const sanitizedData = sanitizeFirestoreData(data);
               const user: User = {
                 id: firebaseUser.uid,
                 username: firebaseUser.displayName || 'User',
                 email: firebaseUser.email || '',
                 password: '',
                 jobTitle: sanitizedData.jobTitle || 'Project Member',
                 avatar: sanitizedData.avatar || firebaseUser.photoURL || undefined,
                 kanbanColumns: sanitizedData.kanbanColumns
               };
               setCurrentUser(user);
               setUserSettings(prev => ({
                   ...prev,
                   userName: user.username,
                   userTitle: user.jobTitle || 'Member'
               }));
               if (sanitizedData.kanbanColumns && Array.isArray(sanitizedData.kanbanColumns)) {
                 setColumns(sanitizedData.kanbanColumns);
               } else {
                 setColumns(DEFAULT_COLUMNS);
               }
           } else {
              setCurrentUser({
                  id: firebaseUser.uid,
                  username: firebaseUser.displayName || 'User',
                  email: firebaseUser.email || '',
                  password: ''
              });
              setColumns(DEFAULT_COLUMNS);
           }
           setLoading(false);
        });
        return () => unsubUser();
      } else {
        setCurrentUser(null);
        setLoading(false);
        setSelectedProjectId(null);
        localStorage.removeItem(PROJECT_KEY);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Projects Listener ---
  useEffect(() => {
    if (!currentUser) {
        setProjects([]);
        return;
    }

    let q;
    if (currentUser.email === SUPER_ADMIN_EMAIL) {
        q = query(collection(db, 'projects'));
    } else {
        q = query(
            collection(db, 'projects'),
            or(
                where('ownerId', '==', currentUser.id),
                where('memberUIDs', 'array-contains', currentUser.id)
            )
        );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedProjects: Project[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...sanitizeFirestoreData(data) };
        }) as Project[];
        
        const activeProjects = fetchedProjects.filter(p => !p.isDeleted);
        
        activeProjects.sort((a, b) => {
           const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
           const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
           return dateB - dateA;
        });
        setProjects(activeProjects);
        if (selectedProjectId && !activeProjects.find(p => p.id === selectedProjectId)) {
            setSelectedProjectId(null);
        }
    });
    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.email]);

  // --- Tasks Listener ---
  useEffect(() => {
    if (!currentUser || !selectedProjectId) {
        setTasks([]);
        return;
    }
    const q = query(collection(db, 'tasks'), where('projectId', '==', selectedProjectId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedTasks: Task[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...sanitizeFirestoreData(data) };
        }) as Task[];
        
        const activeTasks = fetchedTasks.filter(t => !t.isDeleted);
        
        setTasks(activeTasks);
    }, (error) => {
        console.error("Error fetching tasks:", error);
    });
    return () => unsubscribe();
  }, [currentUser?.id, selectedProjectId]);

  // --- Sync editingTask with Tasks ---
  useEffect(() => {
    if (editingTask && isTaskModalOpen) {
      const updated = tasks.find(t => t.id === editingTask.id);
      if (updated) {
        setEditingTask(updated);
      }
    }
  }, [tasks, isTaskModalOpen]);

  // --- Reminder Logic ---
  useEffect(() => {
    if (tasks.length === 0) return;
    
    const checkReminders = () => {
        const snoozeUntil = localStorage.getItem(SNOOZE_KEY);
        if (snoozeUntil && Date.now() < parseInt(snoozeUntil)) return;
        if (!snoozeUntil) {
            const shownSession = sessionStorage.getItem('promanage_reminder_shown');
            if (shownSession) return;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueTasks = tasks.filter(t => {
            if (t.status === 'Done') return false;
            const reminderSetting = t.reminderDays !== undefined ? t.reminderDays : 1;
            if (reminderSetting === -1) return false;
            const dueDate = new Date(t.dueDate);
            dueDate.setHours(0,0,0,0);
            const diffTime = dueDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= reminderSetting;
        });
        if (dueTasks.length > 0) {
            setReminderTasks(dueTasks);
            setIsReminderModalOpen(true);
            sessionStorage.setItem('promanage_reminder_shown', 'true');
            localStorage.removeItem(SNOOZE_KEY);
        }
    };
    const timer = setTimeout(checkReminders, 1000);
    return () => clearTimeout(timer);
  }, [tasks]); 

  // --- Persistence Effects ---
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings)); }, [userSettings]);
  useEffect(() => { localStorage.setItem(TAGS_KEY, JSON.stringify(availableTags)); }, [availableTags]);
  useEffect(() => { localStorage.setItem(SIDEBAR_KEY, JSON.stringify(isSidebarOpen)); }, [isSidebarOpen]);
  useEffect(() => { 
      if (selectedProjectId) localStorage.setItem(PROJECT_KEY, selectedProjectId); 
      else localStorage.removeItem(PROJECT_KEY);
  }, [selectedProjectId]);

  // --- Scroll Logic (Programmatic Only) ---
  useEffect(() => {
    if (selectedProjectId && scrollContainerRef.current) {
        const section = document.getElementById(activeTab);
        if (section) {
            scrollContainerRef.current.scrollTo({
                top: section.offsetTop,
                behavior: 'smooth'
            });
        }
    }
  }, [activeTab, selectedProjectId]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const handleLogout = async () => {
    try {
        await signOut(auth);
        setActiveTab('dashboard'); 
        setSelectedProjectId(null);
        sessionStorage.removeItem('promanage_reminder_shown'); 
        sessionStorage.removeItem('promanage_cleanup_done');
        localStorage.removeItem(SNOOZE_KEY);
        notify('info', 'Logged out successfully');
    } catch (error) {
        console.error("Logout failed", error);
    }
  };

  // --- Navigation Handler ---
  const handleNavigation = (tab: Tab) => {
      setActiveTab(tab);
      if (tab === 'projects') {
          setSelectedProjectId(null); // Go back to hub
      }
  };

  const handleSelectProject = (projectId: string | null) => {
      setSelectedProjectId(projectId);
      setActiveTab('dashboard'); // Reset to top of scroll
      setIsProjectSettingsOpen(false);
  };

  const handleGlobalTaskSelect = (task: Task) => {
      if (task.projectId && task.projectId !== selectedProjectId) {
          setSelectedProjectId(task.projectId);
          notify('info', `Switched to project for task: ${task.title}`);
      }
      setEditingTask(task);
      setInitialTaskDate(undefined);
      setIsTaskModalOpen(true);
  };

  const handleSnooze = (untilTimestamp: number) => {
      localStorage.setItem(SNOOZE_KEY, untilTimestamp.toString());
      setIsReminderModalOpen(false);
      notify('info', 'Reminders snoozed');
  };

  const handleResendVerification = async () => {
      if (auth.currentUser && !auth.currentUser.emailVerified) {
          try {
              await sendEmailVerification(auth.currentUser);
              notify('success', 'Verification email sent!');
          } catch (e: any) {
              if (e.code === 'auth/too-many-requests') {
                  notify('warning', 'Please wait before requesting another email.');
              } else {
                  notify('error', 'Failed to send verification email.');
              }
          }
      }
  };

  const handleCreateProject = async (projectData: Partial<Project>, templateId?: string) => {
      if (!currentUser) return;
      try {
          let members: ProjectMember[] = projectData.members || [];
          if (!members.find(m => m.uid === currentUser.id)) {
              members.unshift({
                  uid: currentUser.id,
                  email: currentUser.email,
                  displayName: currentUser.username,
                  role: 'admin',
                  status: 'active',
                  avatar: currentUser.avatar
              });
          }
          const memberUIDs = members.map(m => m.uid).filter((uid): uid is string => uid !== null);

          const docRef = await addDoc(collection(db, 'projects'), {
              ownerId: currentUser.id,
              name: projectData.name || 'New Project',
              clientName: projectData.clientName || '',
              address: projectData.address || '',
              status: 'Active',
              members: members,
              memberUIDs: memberUIDs,
              createdAt: serverTimestamp()
          });
          
          await logProjectActivity(
              docRef.id, 
              'project-init', 
              projectData.name || 'New Project', 
              'created project', 
              currentUser, 
              'Initialized new project workspace', 
              'create'
          );

          if (templateId) {
              const template = await getTemplateById(templateId);
              if (template && template.content && template.content.tasks) {
                  await createTasksFromTemplate(docRef.id, template.content, currentUser.id);
                  notify('success', 'Applied template tasks to project');
              }
          }

          setIsProjectModalOpen(false);
          handleSelectProject(docRef.id);
          notify('success', `Project "${projectData.name}" created!`);
      } catch (e) {
          console.error("Error creating project:", e);
          notify('error', "Failed to create project");
      }
  };

  const handleUpdateProject = async (projectData: Partial<Project>) => {
      if (!selectedProjectId) return;
      // Permission check handled by caller or server rules, but good to double check if current user can edit
      // Assuming simple logic: if you are admin role you can edit. 
      if (userRole !== 'admin') {
          notify('error', "Only admins can update project settings.");
          return;
      }
      
      try {
          const projectRef = doc(db, 'projects', selectedProjectId);
          // We only update specific fields if passed
          const updatePayload: any = {};
          if (projectData.name) updatePayload.name = projectData.name;
          if (projectData.clientName) updatePayload.clientName = projectData.clientName;
          if (projectData.address) updatePayload.address = projectData.address;
          if (projectData.members) {
              updatePayload.members = projectData.members;
              updatePayload.memberUIDs = projectData.members.map(m => m.uid).filter((uid): uid is string => uid !== null);
          }

          await updateDoc(projectRef, updatePayload);
          
          if (currentUser && currentProject) {
              await logProjectActivity(
                  selectedProjectId,
                  'project-update',
                  projectData.name || currentProject.name,
                  'updated project',
                  currentUser,
                  'Updated project settings',
                  'update'
              );
          }

          // If projectToEdit matches, close modal
          if (projectToEdit?.id === selectedProjectId) {
              setIsProjectModalOpen(false);
              setProjectToEdit(null);
          }
          
      } catch (e) {
          console.error("Error updating project:", e);
          throw e; // Let SettingsView handle error/success toast
      }
  };

  const handleDeleteProject = async (projectIdToDelete?: string) => {
      const id = projectIdToDelete || selectedProjectId;
      if (!id) return;
      
      const projectToDelete = projects.find(p => p.id === id);
      if (!projectToDelete) return;
      
      if (!currentUser || (projectToDelete.ownerId !== currentUser.id && currentUser.email !== SUPER_ADMIN_EMAIL)) {
          notify('warning', "Only the project owner can delete this project.");
          return;
      }

      if (!window.confirm("Move Project and ALL tasks to Trash?")) return;

      try {
          const batch = writeBatch(db);
          const tasksQuery = query(collection(db, 'tasks'), where('projectId', '==', id));
          const tasksSnap = await getDocs(tasksQuery);

          const projectRef = doc(db, 'projects', id);
          batch.update(projectRef, { 
              isDeleted: true, 
              deletedAt: serverTimestamp() 
          });

          tasksSnap.docs.forEach((taskDoc) => {
             batch.update(taskDoc.ref, { 
                 isDeleted: true, 
                 deletedAt: serverTimestamp(),
                 originalProjectId: id
             });
          });

          await batch.commit();
          
          if (selectedProjectId === id) {
              setSelectedProjectId(null);
          }
          
          setIsProjectModalOpen(false);
          setIsProjectSettingsOpen(false);
          setProjectToEdit(null);
          
          notify('success', "Project moved to Trash.");
      } catch (e) {
          console.error("Delete Project Error:", e);
          notify('error', "Failed to move project to trash.");
      }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority = filterPriority === 'All' || task.priority === filterPriority;
      const matchesStatus = filterStatus === 'All' || task.status === filterStatus;
      return matchesSearch && matchesPriority && matchesStatus;
    });
  }, [tasks, searchQuery, filterPriority, filterStatus]);

  const resetFilters = () => {
    setSearchQuery('');
    setFilterPriority('All');
    setFilterStatus('All');
  };

  const handleSaveTask = async (taskData: Partial<Task>) => { 
      if (!currentUser || !selectedProjectId) return;
      const safeTaskData = normalizeTaskData(taskData);

      if (editingTask) {
          const previousTasks = [...tasks];
          setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...safeTaskData } : t));
          
          try {
             const taskRef = doc(db, 'tasks', editingTask.id);
             await updateDoc(taskRef, { ...safeTaskData, updatedAt: serverTimestamp() });
             
             const changes: string[] = [];
             let type: ActivityType = 'update';
             
             if (safeTaskData.status && safeTaskData.status !== editingTask.status) {
                 changes.push(`Moved to ${safeTaskData.status}`);
                 type = 'status_change';
             }
             if (safeTaskData.priority && safeTaskData.priority !== editingTask.priority) {
                 changes.push(`Priority to ${safeTaskData.priority}`);
                 type = 'priority_change';
             }
             if (safeTaskData.assignee && safeTaskData.assignee !== editingTask.assignee) {
                 changes.push(`Assigned to ${safeTaskData.assignee}`);
                 type = 'assign';
             }

             if (changes.length > 0) {
                 await logProjectActivity(
                     selectedProjectId,
                     editingTask.id,
                     safeTaskData.title || editingTask.title,
                     'updated task',
                     currentUser,
                     changes.join(', '),
                     type
                 );
             }

             notify('success', "Task updated");
          } catch (e) { 
              console.error("Save failed:", e);
              setTasks(previousTasks);
              notify('error', 'Update failed'); 
          }
      } else {
          try {
             const newTaskPayload = {
                 ...safeTaskData, 
                 projectId: selectedProjectId, 
                 ownerId: currentUser.id,
                 status: safeTaskData.status || 'To Do',
                 priority: safeTaskData.priority || 'Medium',
                 createdAt: serverTimestamp(),
                 updatedAt: serverTimestamp(),
                 isDeleted: false
             };

             const newDocRef = await addDoc(collection(db, 'tasks'), newTaskPayload);
             
             await logProjectActivity(
                 selectedProjectId,
                 newDocRef.id,
                 safeTaskData.title || 'New Task',
                 'created task',
                 currentUser,
                 'Added to board',
                 'create'
             );

             notify('success', 'Task created');
          } catch (e) { 
              console.error("Create task failed:", e);
              notify('error', 'Create failed'); 
          }
      }
      setIsTaskModalOpen(false);
      setEditingTask(undefined);
  };

  const handleTaskComment = async (taskId: string, text: string) => {
      if (!currentUser || !selectedProjectId) return;
      const task = tasks.find(t => t.id === taskId);
      if (task) {
          await logProjectActivity(
              selectedProjectId,
              taskId,
              task.title,
              'commented',
              currentUser,
              text,
              'comment'
          );
      }
  };

  const handleDeleteTask = async (taskId: string) => { 
      const taskToDelete = tasks.find(t => t.id === taskId) || (editingTask?.id === taskId ? editingTask : undefined);
      
      if (!taskToDelete) return;

      const isOwner = currentUser && taskToDelete.ownerId === currentUser.id;
      const isAdmin = userRole === 'admin'; 
      
      if (!isOwner && !isAdmin) {
          notify('error', "Permission denied.");
          return;
      }

      if (!window.confirm("Move task to Trash?")) return;

      try {
          setTasks(prev => prev.filter(t => t.id !== taskId));

          const taskRef = doc(db, 'tasks', taskId);
          await updateDoc(taskRef, { 
              isDeleted: true, 
              deletedAt: serverTimestamp(),
              originalProjectId: taskToDelete.projectId 
          });
          
          if (selectedProjectId) {
              await logProjectActivity(
                  selectedProjectId,
                  taskId,
                  taskToDelete.title,
                  'deleted task',
                  currentUser!,
                  'Moved to trash',
                  'update'
              );
          }

          setIsTaskModalOpen(false);
          setEditingTask(undefined);
          notify('success', 'Task moved to Trash');
      } catch (e) { 
          console.error("Delete Task Error:", e);
          notify('error', 'Failed to delete task'); 
      }
  };

  const handleDropTask = async (taskId: string, newStatus: TaskStatus) => {
      if (!taskId || !newStatus) return;
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return;
      
      const task = tasks[taskIndex];
      if (task.status === newStatus) return; 

      const originalTasks = [...tasks];

      try {
          const updatedTask: Task = { 
              ...task, 
              status: newStatus,
              updatedAt: new Date().toISOString() 
          };
          
          const newTasks = [...tasks];
          newTasks[taskIndex] = updatedTask;
          
          setTasks(newTasks);

          const taskRef = doc(db, 'tasks', taskId);
          
          await updateDoc(taskRef, { 
              status: newStatus, 
              updatedAt: serverTimestamp() 
          });

          if (currentUser && selectedProjectId) {
              logProjectActivity(
                  selectedProjectId,
                  taskId,
                  task.title,
                  'moved task',
                  currentUser,
                  `Moved to ${newStatus}`,
                  'move'
              ).catch(err => console.warn("Activity log failed silently:", err));
          }

      } catch (e) {
          console.error("Drag update failed:", e);
          setTasks(originalTasks);
          notify('error', 'Failed to update task status. Reverting changes.');
      }
  };
  
  const handleAddColumn = async (title: string, color: string) => { 
      if(!currentUser) return;
      const newCols = [...columns, {id: Date.now().toString(), title, color}];
      setColumns(newCols);
      await updateDoc(doc(db, 'users', currentUser.id), { kanbanColumns: newCols });
  };

  const handleEditColumn = async (columnId: string, newTitle: string, newColor: string) => {
      if (!currentUser) return;
      
      const newCols = columns.map(col => {
          if (col.id === columnId) {
              return { ...col, title: newTitle, color: newColor };
          }
          return col;
      });
      
      const oldColumn = columns.find(c => c.id === columnId);
      if (oldColumn && oldColumn.title !== newTitle) {
          const updatedTasks = tasks.map(t => {
              if (t.status === oldColumn.title) {
                  return { ...t, status: newTitle };
              }
              return t;
          });
          setTasks(updatedTasks);

          const tasksToUpdate = tasks.filter(t => t.status === oldColumn.title);
          if (tasksToUpdate.length > 0) {
              const batch = writeBatch(db);
              tasksToUpdate.forEach(t => {
                  const taskRef = doc(db, 'tasks', t.id);
                  batch.update(taskRef, { status: newTitle });
              });
              try {
                  await batch.commit();
              } catch (e) {
                  console.error("Failed to batch update task statuses", e);
                  notify('error', 'Failed to update tasks for renamed column');
              }
          }
      }

      setColumns(newCols);
      await updateDoc(doc(db, 'users', currentUser.id), { kanbanColumns: newCols });
      notify('success', 'Column updated');
  };

  const handleDeleteColumn = async (id: string) => { 
      if(!currentUser) return;
      const colToDelete = columns.find(c => c.id === id);
      if (colToDelete) {
          const hasTasks = tasks.some(t => t.status === colToDelete.title);
          if (hasTasks) {
              notify('warning', `Cannot delete "${colToDelete.title}" because it contains tasks. Move them first.`);
              return;
          }
      }

      const newCols = columns.filter(c => c.id !== id);
      setColumns(newCols);
      await updateDoc(doc(db, 'users', currentUser.id), { kanbanColumns: newCols });
      notify('success', 'Column deleted');
  };

  const handleCreateTag = (name: string) => {
      const newTag = { id: Date.now().toString(), name, colorClass: TAG_COLORS[0] };
      setAvailableTags([...availableTags, newTag]);
      return newTag;
  };
  
  const openNewTaskModal = (date?: string) => {
      if (!selectedProjectId) { notify('info', "Select a project"); return; }
      setEditingTask(undefined); 
      setInitialTaskDate(date); 
      setIsTaskModalOpen(true);
  };
  const openEditTaskModal = (task: Task) => { setEditingTask(task); setIsTaskModalOpen(true); };

  const modalPermissions = useMemo(() => {
      if (!currentUser) return { canEdit: false, canDelete: false, isReadOnly: true };
      if (currentUser.email === SUPER_ADMIN_EMAIL) return { canEdit: true, canDelete: true, isReadOnly: false };
      
      if (!editingTask) return { canEdit: userRole !== 'guest', canDelete: true, isReadOnly: userRole === 'guest' };
      const isOwner = editingTask.createdBy === currentUser.id || editingTask.ownerId === currentUser.id;
      const isAdmin = userRole === 'admin';
      return { canEdit: userRole !== 'guest' || isOwner || isAdmin, canDelete: isAdmin || isOwner, isReadOnly: userRole === 'guest' && !isOwner };
  }, [editingTask, userRole, currentUser]);

  // Determine Content to Render based on Navigation state
  const renderContent = () => {
    if (!selectedProjectId && activeTab !== 'projects' && activeTab !== 'trash') {
         return <PageTransition key="hub-root" className="overflow-y-auto custom-scrollbar p-4 md:p-6"><ProjectHub projects={projects} onSelectProject={handleSelectProject} userName={userSettings.userName} onCreateProject={() => { setProjectToEdit(null); setIsProjectModalOpen(true); }} onDeleteProject={handleDeleteProject} currentUserId={currentUser?.id} /></PageTransition>;
    }

    if (activeTab === 'projects') {
        return (
          <PageTransition key="projects" className="overflow-y-auto custom-scrollbar p-4 md:p-6">
            <ProjectHub projects={projects} onSelectProject={handleSelectProject} userName={userSettings.userName} onCreateProject={() => { setProjectToEdit(null); setIsProjectModalOpen(true); }} onDeleteProject={handleDeleteProject} currentUserId={currentUser?.id} />
          </PageTransition>
        );
    }

    // PROJECT WORKSPACE: ELEVATOR STACK
    // Render all main views in a single scrollable container
    return (
        <div 
            id="main-scroll-container" 
            ref={scrollContainerRef} 
            className="flex-1 h-full w-full overflow-hidden relative scroll-smooth bg-slate-50 dark:bg-slate-950"
        >
            <Section id="dashboard">
                <Dashboard tasks={tasks} projects={projects} columns={columns} currentProject={currentProject} onAddTask={() => openNewTaskModal()} onTaskClick={openEditTaskModal} onNavigate={(tab, status) => { if(status) { setFilterStatus(status); } handleNavigation(tab); }} userName={userSettings.userName} onStatusChange={handleDropTask} />
            </Section>

            <Section id="kanban">
                <div className="flex flex-col h-full min-h-[800px]">
                    <FilterBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} filterPriority={filterPriority} setFilterPriority={setFilterPriority} filterStatus={filterStatus} setFilterStatus={setFilterStatus} onReset={resetFilters} columns={columns} />
                    <KanbanBoard tasks={filteredTasks} columns={columns} onAddTask={() => openNewTaskModal()} onDropTask={handleDropTask} onTaskClick={openEditTaskModal} onAddColumn={handleAddColumn} onEditColumn={handleEditColumn} onDeleteColumn={handleDeleteColumn} isReadOnly={userRole === 'guest'} allTasks={tasks} onDeleteTask={handleDeleteTask} />
                </div>
            </Section>

            <Section id="list">
                <div className="flex flex-col h-full min-h-[600px]">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 px-2">List View</h2>
                    <ListView tasks={filteredTasks} onTaskClick={openEditTaskModal} onDeleteTask={handleDeleteTask} />
                </div>
            </Section>

            <Section id="timeline">
                <div className="flex flex-col h-full min-h-[600px]">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 px-2">Timeline</h2>
                    <Timeline tasks={filteredTasks} onTaskClick={openEditTaskModal} />
                </div>
            </Section>

            <Section id="map">
                <div className="flex flex-col h-full min-h-[800px]">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 px-2">Project Map</h2>
                    <ProjectMapView tasks={filteredTasks} onTaskClick={openEditTaskModal} />
                </div>
            </Section>

            <Section id="calendar">
                <div className="flex flex-col h-full min-h-[700px]">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 px-2">Calendar</h2>
                    <CalendarView tasks={filteredTasks} onTaskClick={openEditTaskModal} onAddTask={openNewTaskModal} />
                </div>
            </Section>

            <Section id="image-gen">
                <ImageGenerator />
            </Section>

            <Section id="trash">
                <TrashView />
            </Section>
        </div>
    );
  };

  if (loading) return <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}><Loader2 size={48} className="text-indigo-600 animate-spin" /></div>;
  if (isSeeding) return <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}><Loader2 size={64} className="text-indigo-600 animate-spin" /><h2 className="text-2xl font-bold animate-pulse">Setting up Demo Environment...</h2><p className="text-slate-500">Generating projects, tasks, and analytics data.</p></div>;
  if (!currentUser) return (
    <NotificationProvider>
      <div className={isDarkMode ? 'dark' : ''}>
        <AuthScreen onLoginSuccess={() => {}} onSeedingStart={() => setIsSeeding(true)} onSeedingEnd={() => setIsSeeding(false)} />
      </div>
    </NotificationProvider>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-300 relative">
      
      <Sidebar 
        activeTab={activeTab} setActiveTab={handleNavigation}
        isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen}
        onAddTask={() => openNewTaskModal()} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode}
        userName={userSettings.userName} userTitle={userSettings.userTitle}
        userAvatar={currentUser.avatar}
        projects={projects} selectedProjectId={selectedProjectId} onSelectProject={handleSelectProject}
        onCreateProject={() => { setProjectToEdit(null); setIsProjectModalOpen(true); }}
        isDesktopOpen={isSidebarOpen}
        currentUserRole={userRole}
        userEmail={currentUser.email}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden relative transition-all duration-300">
        <div className="absolute inset-0 z-0 print:hidden">
          <BackgroundLayer activeTab={activeTab} isDarkMode={isDarkMode} />
        </div>

        {/* Updated Dismissable Verification Banner */}
        {auth.currentUser && !auth.currentUser.emailVerified && showBanner && (
          <div className="flex items-center justify-between px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-b border-yellow-200 dark:border-yellow-800 relative z-50 print:hidden">
              <div className="flex items-center gap-3">
                  <AlertTriangle size={18} className="text-yellow-600 dark:text-yellow-400" />
                  <span className="text-sm font-medium">Your email is not verified. Please check your inbox.</span>
              </div>
              <div className="flex items-center gap-3">
                  <button 
                      onClick={handleResendVerification}
                      className="text-xs font-bold bg-yellow-200 hover:bg-yellow-300 dark:bg-yellow-800 dark:hover:bg-yellow-700 text-yellow-900 dark:text-yellow-100 px-3 py-1.5 rounded transition-colors flex items-center gap-1"
                  >
                      <Send size={12} /> Resend Link
                  </button>
                  <button 
                      onClick={() => setShowBanner(false)}
                      className="p-1 rounded hover:bg-yellow-200 dark:hover:bg-yellow-800 text-yellow-700 dark:text-yellow-300 transition-colors"
                  >
                      <X size={18} />
                  </button>
              </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between sticky top-0 z-40 h-16 relative print:hidden">
          <div className="flex items-center gap-3">
              <button onClick={() => setIsMobileOpen(true)} className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><Menu size={24} /></button>
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden md:flex p-2 -ml-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}><PanelLeft size={20} /></button>
              {currentProject && (
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{currentProject.name}</h2>
                    {currentProject.clientName && <p className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden md:block">{currentProject.clientName}</p>}
                </div>
              )}
          </div>
          
          <div className="flex items-center gap-2 relative">
              {/* Global Search Trigger */}
              <button 
                  onClick={() => setIsSearchOpen(true)}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg text-sm font-medium transition-colors mr-2 border border-transparent hover:border-slate-300 dark:hover:border-slate-600"
              >
                  <Search size={14} />
                  <span className="hidden lg:inline">Search...</span>
                  <span className="text-[10px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded shadow-sm font-mono">Ctrl+K</span>
              </button>
              <button onClick={() => setIsSearchOpen(true)} className="md:hidden p-2 text-slate-500 dark:text-slate-400"><Search size={20} /></button>

              <NotificationCenter />

              {selectedProjectId && (
                <div className="relative">
                  {userRole === 'admin' && (
                      <button onClick={() => setIsProjectSettingsOpen(!isProjectSettingsOpen)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors" title="Project Settings"><Settings size={20} /></button>
                  )}
                  {isProjectSettingsOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsProjectSettingsOpen(false)}></div>
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                          <button onClick={() => { setProjectToEdit(currentProject || null); setIsProjectModalOpen(true); setIsProjectSettingsOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><Edit3 size={16} /> Project Settings</button>
                          {(currentProject?.ownerId === currentUser.id || currentUser.email === SUPER_ADMIN_EMAIL) && (
                              <button onClick={() => handleDeleteProject(currentProject.id)} className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"><Trash2 size={16} /> Delete Project</button>
                          )}
                      </div>
                    </>
                  )}
                </div>
              )}
          </div>
        </div>

        {/* Main Content Area - Replaced Grid Stack with Flex for Infinity Scroll or Single Page */}
        <div className="flex-1 relative z-10 overflow-hidden">
          {renderContent()}
        </div>
        
        {/* Floating Active Timer */}
        <ActiveTimerBar />
      </main>

      {/* Global Command Palette */}
      <CommandPalette 
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        projects={projects}
        currentUserId={currentUser.id}
        onSelectProject={handleSelectProject}
        onSelectTask={handleGlobalTaskSelect}
      />

      <TaskModal 
        isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} onSubmit={handleSaveTask}
        onDelete={handleDeleteTask} task={editingTask}
        currentUser={currentUser.username} currentUserId={currentUser.id} availableTags={availableTags} onCreateTag={handleCreateTag}
        columns={columns} projectMembers={currentProject?.members || []} initialDate={initialTaskDate}
        isReadOnly={modalPermissions.isReadOnly} canEdit={modalPermissions.canEdit} canDelete={modalPermissions.canDelete}
        allTasks={tasks} onTaskSelect={openEditTaskModal}
        onTaskComment={handleTaskComment}
      />

      <ProjectModal
        isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)}
        onSubmit={projectToEdit ? handleUpdateProject : handleCreateProject}
        project={projectToEdit} currentUser={{ uid: currentUser.id, email: currentUser.email, displayName: currentUser.username }}
        currentUserRole={userRole} onDelete={handleDeleteProject}
      />

      <ReminderModal 
        isOpen={isReminderModalOpen} onClose={() => setIsReminderModalOpen(false)}
        tasks={reminderTasks} onTaskClick={openEditTaskModal} onSnooze={handleSnooze}
      />

      <SettingsView 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        tasks={filteredTasks} 
        setTasks={setTasks} 
        userSettings={userSettings} 
        setUserSettings={setUserSettings} 
        isDarkMode={isDarkMode} 
        toggleDarkMode={toggleDarkMode} 
        onLogout={handleLogout} 
        columns={columns} 
        onAddColumn={handleAddColumn} 
        onEditColumn={handleEditColumn} 
        onDeleteColumn={handleDeleteColumn}
        project={currentProject}
        onUpdateProject={handleUpdateProject}
      />
    </div>
  );
};

const MainApp = () => {
  return (
    <NotificationProvider>
      <TimeTrackingProvider>
        <App />
      </TimeTrackingProvider>
    </NotificationProvider>
  );
}

export default MainApp;
