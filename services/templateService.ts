
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { Project, Task } from '../types';

/**
 * Save an existing project and its tasks as a reusable template.
 */
export const saveProjectAsTemplate = async (
  project: Project,
  templateName: string,
  userId: string
) => {
  // 1. Fetch all tasks associated with the project
  const tasksQuery = query(collection(db, 'tasks'), where('projectId', '==', project.id));
  const tasksSnap = await getDocs(tasksQuery);
  const tasks = tasksSnap.docs.map(doc => doc.data() as Task);

  // 2. Sanitize Project Data (Strip specific IDs and dates)
  const projectContent = {
    name: templateName, // The template name acts as the default new project name
    clientName: '', // Clear specific client info
    address: '', // Clear specific address
    // We don't save members, creating user will be owner/admin
  };

  // 3. Sanitize Tasks (Strip specific tracking info)
  const sanitizedTasks = tasks.map(t => {
    // Destructure to separate fields we want to exclude
    const { 
      id, projectId, ownerId, assignee, assigneeId, assigneeAvatar, 
      startDate, dueDate, comments, activityLog, timeLogs, attachments, 
      createdAt, updatedAt, deletedAt, isDeleted, importedAt,
      ...rest 
    } = t;
    
    return {
      ...rest,
      status: 'To Do', // Reset status to start
      assignee: 'Unassigned',
      assigneeId: 'UN',
      assigneeAvatar: '',
      startDate: '', // Reset dates
      dueDate: '',
      estimatedCost: t.estimatedCost || 0,
      estimatedHours: t.estimatedHours || 0,
      // Keep subtasks, tags, priority, description
      comments: [],
      activityLog: [],
      timeLogs: [],
      attachments: [] // Reset attachments as they might be specific files
    };
  });

  // 4. Save to 'templates' collection
  await addDoc(collection(db, 'templates'), {
    name: templateName,
    type: 'project',
    description: `Template created from project: ${project.name}`,
    content: {
      project: projectContent,
      tasks: sanitizedTasks
    },
    createdBy: userId,
    createdAt: serverTimestamp(),
    isDeleted: false
  });
};

/**
 * Save a specific task as a reusable template.
 */
export const saveTaskAsTemplate = async (
  task: Task,
  templateName: string,
  userId: string
) => {
  // 1. Sanitize Task Data
  const { 
    id, projectId, ownerId, assignee, assigneeId, assigneeAvatar, 
    startDate, dueDate, comments, activityLog, timeLogs, attachments, 
    createdAt, updatedAt, deletedAt, isDeleted, importedAt,
    ...rest 
  } = task;

  const taskContent = {
    ...rest,
    title: task.title, // Keep original title in content, templateName is for the template registry
    status: 'To Do',
    assignee: 'Unassigned',
    assigneeId: 'UN',
    assigneeAvatar: '',
    startDate: '',
    dueDate: '',
    comments: [],
    activityLog: [],
    timeLogs: [],
    attachments: []
  };

  // 2. Save to 'templates' collection
  await addDoc(collection(db, 'templates'), {
    name: templateName,
    type: 'task',
    description: `Template created from task: ${task.title}`,
    content: taskContent,
    createdBy: userId,
    createdAt: serverTimestamp(),
    isDeleted: false
  });
};
