
import React, { useState, useEffect, useMemo } from 'react';
import { Menu, Search, Loader2, Settings, Trash2, Edit3, ChevronDown, Copy, PanelLeft } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import KanbanBoard from './components/KanbanBoard';
import Timeline from './components/Timeline';
import CalendarView from './components/CalendarView';
import ImageGenerator from './components/ImageGenerator';
import TaskModal from './components/TaskModal';
import ProjectModal from './components/ProjectModal';
import FilterBar from './components/FilterBar';
import SettingsView from './components/SettingsView';
import AuthScreen from './components/AuthScreen';
import ProjectHub from './components/ProjectHub';
import DevToolbar from './components/DevToolbar';
import BackgroundLayer from './components/BackgroundLayer';
import ReminderModal from './components/ReminderModal';
import NotificationCenter from './components/NotificationCenter';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import { Tab, Task, TaskStatus, ActivityLog, UserSettings, Tag, User, KanbanColumn, Project, ProjectMember, ProjectRole } from './types';

// Firebase Imports
import { auth, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs, writeBatch, or } from 'firebase/firestore';

const THEME_KEY = 'promanage_theme_v1';
const SETTINGS_KEY = 'promanage_settings_v1';
const TAGS_KEY = 'promanage_tags_v1';
const PROJECT_KEY = 'promanage_project_v1';
const SIDEBAR_KEY = 'promanage_sidebar_open';
const SNOOZE_KEY = 'app_snooze_until';

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

const ProManageApp: React.FC = () => {
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

  // --- User Settings State ---
  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? JSON.parse(saved) : {
        userName: 'Guest',
        userTitle: 'Viewer',
        defaultView: 'dashboard'
      };
    } catch (e) {
      return { userName: 'Guest', userTitle: 'Viewer', defaultView: 'dashboard' };
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

  // --- Permission Logic Hook ---
  const currentProject = projects.find(p => p.id === selectedProjectId);
  
  const userRole = useMemo<ProjectRole>(() => {
      if (!currentProject || !currentUser) return 'guest';
      // If owner, assume admin
      if (currentProject.ownerId === currentUser.id) return 'admin';
      
      const member = currentProject.members?.find(m => m.uid === currentUser.id);
      return member?.role || 'guest';
  }, [currentProject, currentUser]);

  // --- Firebase Auth Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
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
                 avatar: firebaseUser.photoURL || undefined,
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
    const q = query(
        collection(db, 'projects'),
        or(
            where('ownerId', '==', currentUser.id),
            where('memberUIDs', 'array-contains', currentUser.id)
        )
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedProjects: Project[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return { id: doc.id, ...sanitizeFirestoreData(data) };
        }) as Project[];
        
        fetchedProjects.sort((a, b) => {
           const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
           const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
           return dateB - dateA;
        });
        setProjects(fetchedProjects);
        if (selectedProjectId && !fetchedProjects.find(p => p.id === selectedProjectId)) {
            setSelectedProjectId(null);
        }
    });
    return () => unsubscribe();
  }, [currentUser?.id]);

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
        setTasks(fetchedTasks);
    }, (error) => {
        console.error("Error fetching tasks:", error);
    });
    return () => unsubscribe();
  }, [currentUser?.id, selectedProjectId]);

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
  useEffect(() => { localStorage.setItem(THEME_KEY, JSON.stringify(isDarkMode)); }, [isDarkMode]);
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings)); }, [userSettings]);
  useEffect(() => { localStorage.setItem(TAGS_KEY, JSON.stringify(availableTags)); }, [availableTags]);
  useEffect(() => { localStorage.setItem(SIDEBAR_KEY, JSON.stringify(isSidebarOpen)); }, [isSidebarOpen]);
  useEffect(() => { 
      if (selectedProjectId) localStorage.setItem(PROJECT_KEY, selectedProjectId); 
      else localStorage.removeItem(PROJECT_KEY);
  }, [selectedProjectId]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const handleLogout = () => {
    setActiveTab('dashboard'); 
    setSelectedProjectId(null);
    sessionStorage.removeItem('promanage_reminder_shown'); 
    localStorage.removeItem(SNOOZE_KEY);
    notify('info', 'Logged out successfully');
  };

  const handleSelectProject = (projectId: string | null) => {
      setSelectedProjectId(projectId);
      setActiveTab('dashboard');
      setIsProjectSettingsOpen(false);
  };

  const handleSnooze = (untilTimestamp: number) => {
      localStorage.setItem(SNOOZE_KEY, untilTimestamp.toString());
      setIsReminderModalOpen(false);
      notify('info', 'Reminders snoozed');
  };

  const handleDashboardNavigation = (tab: Tab, filterStatus?: string) => {
    setActiveTab(tab);
    if (filterStatus) {
        setFilterStatus(filterStatus);
        setFilterPriority('All');
        setSearchQuery('');
    }
  };

  // --- Project CRUD Handlers ---
  const handleCreateProject = async (projectData: Partial<Project>) => {
      if (!currentUser) return;
      try {
          // Logic ensures current user is Admin even if invitations were sent in wizard
          let members: ProjectMember[] = projectData.members || [];
          
          // Check if current user is in the list, if not add them as admin
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
          setIsProjectModalOpen(false);
          handleSelectProject(docRef.id);
          notify('success', `Project "${projectData.name}" created!`);
      } catch (e) {
          console.error("Error creating project:", e);
          notify('error', "Failed to create project");
      }
  };

  const handleUpdateProject = async (projectData: Partial<Project>) => {
      if (!projectToEdit) return;
      if (userRole !== 'admin') {
          notify('error', "Only admins can update project settings.");
          return;
      }

      try {
          const projectRef = doc(db, 'projects', projectToEdit.id);
          let updatedMembers = projectData.members || projectToEdit.members || [];
          const memberUIDs = updatedMembers.map(m => m.uid).filter((uid): uid is string => uid !== null);

          await updateDoc(projectRef, {
              name: projectData.name,
              clientName: projectData.clientName,
              address: projectData.address,
              members: updatedMembers,
              memberUIDs: memberUIDs
          });
          setIsProjectModalOpen(false);
          setProjectToEdit(null);
          notify('success', "Project updated successfully");
      } catch (e) {
          console.error("Error updating project:", e);
          notify('error', "Failed to update project");
      }
  };

  const handleDeleteProject = async (projectIdToDelete?: string) => {
      // Use the passed ID or fall back to the selected project
      const id = projectIdToDelete || selectedProjectId;
      if (!id) return;

      const project = projects.find(p => p.id === id);
      
      if (!project) return;
      
      // Only Owner can delete
      if (project.ownerId !== currentUser?.id) {
          notify('warning', "Only the project owner can delete this project.");
          return;
      }

      // Secure Confirmation
      const isConfirmed = window.confirm("This will delete the project and ALL its tasks. This cannot be undone.");
      if (!isConfirmed) return;

      try {
          const batch = writeBatch(db);
          
          // 1. Delete Project Document
          const projectRef = doc(db, 'projects', project.id);
          batch.delete(projectRef);
          
          // 2. Delete All Associated Tasks
          const tasksQuery = query(collection(db, 'tasks'), where('projectId', '==', project.id));
          const tasksSnap = await getDocs(tasksQuery);
          tasksSnap.forEach(doc => batch.delete(doc.ref));
          
          // Commit Batch
          await batch.commit();
          
          // 3. Cleanup State & Redirect
          if (selectedProjectId === project.id) {
            setSelectedProjectId(null);
            setActiveTab('projects'); // Return to Hub
          }
          
          setIsProjectModalOpen(false);
          setIsProjectSettingsOpen(false);
          setProjectToEdit(null);
          
          notify('success', "Project and all associated data deleted.");
      } catch (e) {
          console.error("Error deleting project:", e);
          notify('error', "Failed to delete project");
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

  const handleAddColumn = async (title: string, color: string) => {
    if (!currentUser) return;
    const newColumn: KanbanColumn = { id: `col-${Date.now()}`, title, color };
    const updatedColumns = [...columns, newColumn];
    setColumns(updatedColumns);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, { kanbanColumns: updatedColumns });
      notify('success', `Column "${title}" added`);
    } catch (e) {
      console.error("Error adding column:", e);
      notify('error', "Failed to save column setting");
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!currentUser) return;
    const columnToDelete = columns.find(c => c.id === columnId);
    if (!columnToDelete) return;

    const hasTasks = tasks.some(t => t.status === columnToDelete.title);
    if (hasTasks) {
      notify('warning', `Cannot delete column "${columnToDelete.title}" because it contains tasks.`);
      return;
    }

    const updatedColumns = columns.filter(c => c.id !== columnId);
    setColumns(updatedColumns);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, { kanbanColumns: updatedColumns });
      notify('success', "Column deleted");
    } catch (e) {
      console.error("Error deleting column:", e);
    }
  };

  const handleCreateTag = (name: string) => {
    const randomColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    const newTag: Tag = { id: Date.now().toString(), name: name, colorClass: randomColor };
    setAvailableTags(prev => [...prev, newTag]);
    return newTag;
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (!currentUser) return;
    
    // Permissions check for editing
    if (editingTask) {
        const isOwner = editingTask.createdBy === currentUser.id || editingTask.ownerId === currentUser.id;
        const canEdit = userRole !== 'guest' || isOwner;
        if (!canEdit) {
            notify('error', "You do not have permission to edit this task.");
            return;
        }
    } else {
        // Create permission check
        if (userRole === 'guest') {
            notify('error', "Guests cannot create tasks.");
            return;
        }
    }

    const timestamp = new Date().toISOString();
    const newActivityLog: ActivityLog[] = [];

    try {
        if (editingTask) {
            if (taskData.status && taskData.status !== editingTask.status) {
                newActivityLog.push({ 
                    id: Date.now().toString() + Math.random(), 
                    action: 'changed status', 
                    details: `From ${editingTask.status} → ${taskData.status}`,
                    timestamp, userName: currentUser.username, userId: currentUser.id, type: 'status_change'
                });
            }
            if (taskData.priority && taskData.priority !== editingTask.priority) {
                newActivityLog.push({ 
                    id: Date.now().toString() + Math.random(), 
                    action: 'changed priority', 
                    details: `From ${editingTask.priority} → ${taskData.priority}`,
                    timestamp, userName: currentUser.username, userId: currentUser.id, type: 'priority_change'
                });
            }
            if (taskData.assignee && taskData.assignee !== editingTask.assignee) {
               newActivityLog.push({
                  id: Date.now().toString() + Math.random(),
                  action: 'assigned task',
                  details: `Assigned to ${taskData.assignee}`,
                  timestamp, userName: currentUser.username, userId: currentUser.id, type: 'assign'
               });
            }
            if (taskData.attachments && taskData.attachments.length > (editingTask.attachments?.length || 0)) {
               newActivityLog.push({
                   id: Date.now().toString() + Math.random(),
                   action: 'uploaded attachment',
                   details: 'Added a new file',
                   timestamp, userName: currentUser.username, userId: currentUser.id, type: 'attachment'
               });
            }

            const finalActivityLog = [...(taskData.activityLog || []), ...newActivityLog];
            const taskRef = doc(db, 'tasks', editingTask.id);
            await updateDoc(taskRef, { ...taskData, activityLog: finalActivityLog, updatedAt: serverTimestamp() });
            notify('success', "Task updated");

        } else {
            if (!selectedProjectId) {
                notify('warning', "Please select a project first");
                return;
            }
            const newTaskData = {
                ownerId: currentUser.id,
                createdBy: currentUser.id, // Store creator for ownership rules
                projectId: selectedProjectId, 
                title: taskData.title || 'New Task',
                status: taskData.status || columns[0]?.title || 'To Do',
                priority: taskData.priority || 'Medium',
                startDate: taskData.startDate || new Date().toISOString().split('T')[0],
                dueDate: taskData.dueDate || new Date().toISOString().split('T')[0],
                reminderDays: taskData.reminderDays !== undefined ? taskData.reminderDays : 1,
                assignee: taskData.assignee || 'Unassigned',
                subtasks: taskData.subtasks || [],
                comments: [],
                activityLog: [{ 
                    id: Date.now().toString(), 
                    action: 'created this task', 
                    timestamp, userName: currentUser.username, userId: currentUser.id, type: 'create'
                }],
                attachments: taskData.attachments || [],
                tags: taskData.tags || [],
                estimatedCost: taskData.estimatedCost || 0,
                actualCost: taskData.actualCost || 0,
                description: taskData.description || '',
                createdAt: serverTimestamp()
            };
            await addDoc(collection(db, 'tasks'), newTaskData);
            notify('success', "Task created successfully");
        }
        setIsTaskModalOpen(false);
        setEditingTask(undefined);
        setInitialTaskDate(undefined);
    } catch (error) {
        console.error("Error saving task:", error);
        notify('error', "Failed to save task");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!currentUser) return;
    const taskToDelete = tasks.find(t => t.id === taskId);
    
    // Check Permission
    const isOwner = taskToDelete?.createdBy === currentUser.id || taskToDelete?.ownerId === currentUser.id;
    const canDelete = userRole === 'admin' || isOwner;

    if (!canDelete) {
        notify('error', "You do not have permission to delete this task.");
        return;
    }

    if (!window.confirm("Are you sure you want to delete this task permanently?")) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      setIsTaskModalOpen(false);
      setEditingTask(undefined);
      notify('success', "Task deleted");
    } catch (error) {
      console.error("Error deleting task:", error);
      notify('error', "Failed to delete task");
    }
  };

  const handleDropTask = async (taskId: string, newStatus: TaskStatus) => {
    if (!currentUser) return;
    if (userRole === 'guest') {
        notify('warning', "Guests cannot move tasks.");
        return;
    }

    const timestamp = new Date().toISOString();
    try {
        const taskToUpdate = tasks.find(t => t.id === taskId);
        if (!taskToUpdate || taskToUpdate.status === newStatus) return;
        
        const newLog = { 
            id: Date.now().toString() + Math.random(), 
            action: 'changed status', 
            details: `Moved to ${newStatus}`,
            timestamp, userName: currentUser.username, userId: currentUser.id, type: 'move' as const
        };
        const updatedLogs = [...(taskToUpdate.activityLog || []), newLog];
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, { status: newStatus, activityLog: updatedLogs, updatedAt: serverTimestamp() });
    } catch (error) {
        console.error("Error updating task status:", error);
    }
  };

  const openNewTaskModal = (date?: string) => {
    if (!selectedProjectId) {
        notify('info', "Please select or create a project first");
        return;
    }
    if (userRole === 'guest') {
        notify('warning', "Guests cannot create tasks.");
        return;
    }
    setEditingTask(undefined);
    setInitialTaskDate(date);
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (task: Task) => {
    setEditingTask(task);
    setInitialTaskDate(undefined);
    setIsTaskModalOpen(true);
  };

  // Calculate permissions for currently edited task
  const modalPermissions = useMemo(() => {
      if (!currentUser) return { canEdit: false, canDelete: false, isReadOnly: true };
      
      if (!editingTask) {
          // Creating new task
          return { 
              canEdit: userRole !== 'guest', 
              canDelete: true, // Irrelevant for new
              isReadOnly: userRole === 'guest' 
          };
      }

      const isOwner = editingTask.createdBy === currentUser.id || editingTask.ownerId === currentUser.id;
      const isAdmin = userRole === 'admin';
      
      // Rules:
      // Edit: Not Guest OR Owner OR Admin
      // Delete: Admin OR Owner
      return {
          canEdit: userRole !== 'guest' || isOwner || isAdmin,
          canDelete: isAdmin || isOwner,
          isReadOnly: userRole === 'guest' && !isOwner
      };
  }, [editingTask, userRole, currentUser]);

  const renderContent = () => {
    if (!selectedProjectId && activeTab !== 'projects' && activeTab !== 'settings') {
         return <ProjectHub 
                  projects={projects} 
                  onSelectProject={handleSelectProject} 
                  userName={userSettings.userName} 
                  onCreateProject={() => { setProjectToEdit(null); setIsProjectModalOpen(true); }}
                  onDeleteProject={handleDeleteProject}
                  currentUserId={currentUser?.id}
                />;
    }
    const NoResultsState = () => (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl animate-fade-in bg-white dark:bg-slate-800/50">
        <Search size={48} className="mb-4 opacity-20" />
        <p className="text-lg font-medium text-slate-500 dark:text-slate-400">No tasks found</p>
        <button onClick={resetFilters} className="text-indigo-600 dark:text-indigo-400 hover:underline mt-2">Clear filters</button>
      </div>
    );

    switch (activeTab) {
      case 'dashboard': return (
        <Dashboard 
            tasks={tasks} projects={projects} columns={columns}
            onAddTask={() => openNewTaskModal()} onTaskClick={openEditTaskModal}
            onNavigate={handleDashboardNavigation} userName={userSettings.userName}
            onStatusChange={handleDropTask}
        />
      );
      case 'image-gen': return <ImageGenerator />;
      case 'projects': return (
        <ProjectHub 
            projects={projects} 
            onSelectProject={handleSelectProject} 
            userName={userSettings.userName} 
            onCreateProject={() => { setProjectToEdit(null); setIsProjectModalOpen(true); }}
            onDeleteProject={handleDeleteProject}
            currentUserId={currentUser?.id}
        />
      );
      case 'kanban': return (
        <div className="flex flex-col h-full">
            <FilterBar 
              searchQuery={searchQuery} setSearchQuery={setSearchQuery} 
              filterPriority={filterPriority} setFilterPriority={setFilterPriority} 
              filterStatus={filterStatus} setFilterStatus={setFilterStatus} 
              onReset={resetFilters} columns={columns}
            />
            {filteredTasks.length === 0 && tasks.length > 0 ? <NoResultsState /> : 
            <KanbanBoard 
              tasks={filteredTasks} columns={columns} 
              onAddTask={() => openNewTaskModal()} onDropTask={handleDropTask} 
              onTaskClick={openEditTaskModal} onAddColumn={handleAddColumn}
              isReadOnly={userRole === 'guest'}
            />}
        </div>
      );
      case 'timeline': return (
        <div className="flex flex-col h-full">
             <FilterBar 
               searchQuery={searchQuery} setSearchQuery={setSearchQuery} 
               filterPriority={filterPriority} setFilterPriority={setFilterPriority} 
               filterStatus={filterStatus} setFilterStatus={setFilterStatus} 
               onReset={resetFilters} columns={columns} 
             />
             {filteredTasks.length === 0 && tasks.length > 0 ? <NoResultsState /> : 
             <Timeline tasks={filteredTasks} onTaskClick={openEditTaskModal} />}
        </div>
      );
      case 'calendar': return (
        <div className="flex flex-col h-full">
             <FilterBar 
               searchQuery={searchQuery} setSearchQuery={setSearchQuery} 
               filterPriority={filterPriority} setFilterPriority={setFilterPriority} 
               filterStatus={filterStatus} setFilterStatus={setFilterStatus} 
               onReset={resetFilters} columns={columns} 
             />
             {filteredTasks.length === 0 && tasks.length > 0 ? <NoResultsState /> : 
             <CalendarView tasks={filteredTasks} onTaskClick={openEditTaskModal} onAddTask={openNewTaskModal} />}
        </div>
      );
      case 'settings': return (
        <SettingsView 
            tasks={filteredTasks} setTasks={setTasks} userSettings={userSettings} setUserSettings={setUserSettings} 
            isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} onLogout={handleLogout}
            columns={columns} onAddColumn={handleAddColumn} onDeleteColumn={handleDeleteColumn}
            onClose={() => { if (selectedProjectId) setActiveTab('dashboard'); else setActiveTab('projects'); }}
        />
      );
      default: return <Dashboard tasks={filteredTasks} projects={projects} columns={columns} onTaskClick={openEditTaskModal} onNavigate={handleDashboardNavigation} userName={userSettings.userName} onStatusChange={handleDropTask} />;
    }
  };

  if (loading) {
      return (
        <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
            <Loader2 size={48} className="text-indigo-600 animate-spin" />
        </div>
      );
  }

  if (isSeeding) {
      return (
        <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
            <Loader2 size={64} className="text-indigo-600 animate-spin" />
            <h2 className="text-2xl font-bold animate-pulse">Setting up Demo Environment...</h2>
            <p className="text-slate-500">Generating projects, tasks, and analytics data.</p>
        </div>
      );
  }

  if (!currentUser) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
         <AuthScreen 
            onLoginSuccess={() => {}} 
            onSeedingStart={() => setIsSeeding(true)}
            onSeedingEnd={() => setIsSeeding(false)}
         />
      </div>
    );
  }

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-300 relative">
        
        {currentUser.email === 'admin@dev.com' && <DevToolbar currentUser={currentUser} />}

        <Sidebar 
          activeTab={activeTab} setActiveTab={setActiveTab}
          isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen}
          onAddTask={() => openNewTaskModal()} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode}
          userName={userSettings.userName} userTitle={userSettings.userTitle}
          projects={projects} selectedProjectId={selectedProjectId} onSelectProject={handleSelectProject}
          onCreateProject={() => { setProjectToEdit(null); setIsProjectModalOpen(true); }}
          isDesktopOpen={isSidebarOpen}
          currentUserRole={userRole}
        />
        <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden relative transition-all duration-300">
          <BackgroundLayer activeTab={activeTab} isDarkMode={isDarkMode} />

          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between sticky top-0 z-40 h-16 relative">
             <div className="flex items-center gap-3">
                <button onClick={() => setIsMobileOpen(true)} className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                   <Menu size={24} />
                </button>
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                  className="hidden md:flex p-2 -ml-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                >
                   <PanelLeft size={20} />
                </button>
                {currentProject && (
                   <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{currentProject.name}</h2>
                      {currentProject.clientName && (
                         <p className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden md:block">{currentProject.clientName}</p>
                      )}
                   </div>
                )}
             </div>
             
             {/* Right Header Section */}
             <div className="flex items-center gap-2 relative">
                {/* Notification Center */}
                <NotificationCenter />

                {selectedProjectId && (
                  <div className="relative">
                    {/* Only show settings button if Admin */}
                    {userRole === 'admin' && (
                        <button 
                          onClick={() => setIsProjectSettingsOpen(!isProjectSettingsOpen)}
                          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                          title="Project Settings"
                        >
                            <Settings size={20} />
                        </button>
                    )}
                    {isProjectSettingsOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsProjectSettingsOpen(false)}></div>
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                            <button 
                              onClick={() => {
                                  setProjectToEdit(currentProject || null);
                                  setIsProjectModalOpen(true);
                                  setIsProjectSettingsOpen(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                            >
                              <Edit3 size={16} /> Project Settings
                            </button>
                            {currentProject?.ownerId === currentUser.id && (
                                <button 
                                  onClick={() => handleDeleteProject(currentProject.id)}
                                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                >
                                  <Trash2 size={16} /> Delete Project
                                </button>
                            )}
                        </div>
                      </>
                    )}
                  </div>
                )}
             </div>
          </div>

          <div className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar relative z-10">
             {renderContent()}
          </div>
        </main>
      </div>

      <TaskModal 
        isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} onSubmit={handleSaveTask}
        onDelete={editingTask ? handleDeleteTask : undefined} task={editingTask}
        currentUser={currentUser.username} availableTags={availableTags} onCreateTag={handleCreateTag}
        columns={columns} projectMembers={currentProject?.members || []} initialDate={initialTaskDate}
        isReadOnly={modalPermissions.isReadOnly}
        canEdit={modalPermissions.canEdit}
        canDelete={modalPermissions.canDelete}
      />

      <ProjectModal
         isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)}
         onSubmit={projectToEdit ? handleUpdateProject : handleCreateProject}
         project={projectToEdit} currentUser={{ uid: currentUser.id, email: currentUser.email, displayName: currentUser.username }}
         currentUserRole={userRole}
         onDelete={handleDeleteProject}
      />

      <ReminderModal 
        isOpen={isReminderModalOpen} onClose={() => setIsReminderModalOpen(false)}
        tasks={reminderTasks} onTaskClick={openEditTaskModal} onSnooze={handleSnooze}
      />
    </div>
  );
};

const App = () => {
  return (
    <NotificationProvider>
      <ProManageApp />
    </NotificationProvider>
  )
}

export default App;
