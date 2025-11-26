
import React from 'react';

export type Tab = 'dashboard' | 'kanban' | 'list' | 'timeline' | 'calendar' | 'map' | 'settings' | 'image-gen' | 'projects' | 'trash';

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple' | 'red' | 'orange';
  onClick?: () => void;
}

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export interface ImageGenerationConfig {
  prompt: string;
  aspectRatio: AspectRatio;
}

export interface GeneratedImage {
  url: string;
  prompt: string;
  aspectRatio: AspectRatio;
  timestamp: number;
}

export type TaskStatus = string;
export type TaskPriority = 'High' | 'Medium' | 'Low';
export type ProjectRole = 'admin' | 'member' | 'guest';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Comment {
  id: string;
  user: string;
  userId?: string;
  text: string;
  timestamp: string;
}

export type ActivityType = 'create' | 'update' | 'status_change' | 'priority_change' | 'comment' | 'attachment' | 'assign' | 'move' | 'alert' | 'generic';

export interface ActivityLog {
  id: string;
  action: string;
  timestamp: string;
  userName?: string;
  userId?: string;
  userAvatar?: string;
  details?: string;
  type?: ActivityType;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  colorClass: string;
}

export interface TimeLog {
  id: string;
  userId: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  notes?: string;
}

export interface Task {
  id: string;
  ownerId: string;
  createdBy?: string; // The UID of the user who created the task
  projectId?: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string;
  dueDate: string;
  assignee: string; // Display Name or Initials
  assigneeId?: string; // UID of the assignee
  assigneeAvatar?: string; // Avatar URL of the assignee
  description?: string;
  subtasks?: Subtask[];
  comments?: Comment[];
  activityLog?: ActivityLog[];
  attachments?: Attachment[];
  tags?: Tag[];
  dependencies?: string[]; // Array of Task IDs that this task depends on
  estimatedCost?: number;
  actualCost?: number;
  estimatedHours?: number;
  estimatedDays?: number;
  totalTimeSeconds?: number; // Time Tracking
  timeLogs?: TimeLog[]; // Time Tracking History
  createdAt?: any;
  updatedAt?: any;
  importedAt?: string;
  reminderDays?: number; // -1 (None), 0 (Same day), 1 (1 day before), etc.
  isDeleted?: boolean;
  deletedAt?: string;
  originalProjectId?: string; // Used to track project association when in trash
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
}

export interface ProjectMember {
  uid: string | null;
  email: string;
  displayName: string;
  role: ProjectRole;
  avatar?: string;
  status?: 'active' | 'pending';
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  clientName: string;
  address: string;
  status: string;
  createdAt: string;
  members?: ProjectMember[];
  memberUIDs?: string[];
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface Template {
  id: string;
  name: string;
  type: 'project' | 'task';
  description?: string;
  content: any;
  createdBy: string;
  createdAt: any;
  isDeleted?: boolean;
  deletedAt?: any;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  avatar?: string;
  jobTitle?: string;
  kanbanColumns?: KanbanColumn[];
}

export interface UserSettings {
  userName: string;
  userTitle: string;
  defaultView: Tab;
}
