
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { User, ActivityType } from '../types';

export const logProjectActivity = async (
  projectId: string,
  taskId: string,
  taskTitle: string,
  action: string,
  user: User | { id: string; username: string; avatar?: string },
  details: string,
  type: ActivityType = 'generic'
) => {
  if (!projectId) return;

  try {
    await addDoc(collection(db, 'projects', projectId, 'activities'), {
      projectId,
      taskId,
      taskTitle,
      action,
      details,
      type,
      userId: user.id,
      userName: user.username,
      userAvatar: user.avatar || '',
      timestamp: serverTimestamp() // Server time for accurate sorting
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};
