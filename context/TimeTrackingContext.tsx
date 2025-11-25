
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Task, TimeLog } from '../types';
import { db, auth } from '../firebase';
import { doc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { useNotification } from './NotificationContext';

const ACTIVE_TIMER_KEY = 'promanage_active_timer';

interface ActiveTimer {
  taskId: string;
  taskTitle: string;
  startTime: number;
  projectId?: string;
}

interface TimeTrackingContextType {
  activeTimer: ActiveTimer | null;
  startTimer: (task: Task) => void;
  stopTimer: () => Promise<void>;
  formatDuration: (seconds: number) => string;
  formatDurationShort: (seconds: number) => string;
}

const TimeTrackingContext = createContext<TimeTrackingContextType | undefined>(undefined);

export const TimeTrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { notify } = useNotification();
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_TIMER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    if (activeTimer) {
      localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(activeTimer));
    } else {
      localStorage.removeItem(ACTIVE_TIMER_KEY);
    }
  }, [activeTimer]);

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDurationShort = (seconds: number) => {
    if (!seconds) return '00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const mm = minutes.toString().padStart(2, '0');
    const ss = secs.toString().padStart(2, '0');
    
    if (hours > 0) {
        const hh = hours.toString().padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
  };

  const startTimer = async (task: Task) => {
    const user = auth.currentUser;
    if (!user) {
        notify('error', "You must be logged in to track time.");
        return;
    }

    if (activeTimer) {
        if (activeTimer.taskId === task.id) return; // Already running
        await stopTimer(); // Stop current before starting new
    }

    const newTimer: ActiveTimer = {
        taskId: task.id,
        taskTitle: task.title,
        startTime: Date.now(),
        projectId: task.projectId
    };
    
    setActiveTimer(newTimer);
    notify('success', `Timer started: ${task.title.substring(0, 20)}...`);
  };

  const stopTimer = async () => {
    if (!activeTimer) return;
    
    const user = auth.currentUser;
    if (!user) {
        // If user logged out, we just clear the timer locally to avoid errors
        setActiveTimer(null);
        return;
    }

    const endTime = Date.now();
    const durationMs = endTime - activeTimer.startTime;
    const durationSeconds = Math.floor(durationMs / 1000);

    if (durationSeconds < 5) {
        // Discard extremely short logs (< 5 seconds)
        setActiveTimer(null);
        notify('info', "Timer discarded (too short).");
        return;
    }

    try {
        const taskRef = doc(db, 'tasks', activeTimer.taskId);
        
        const newLog: TimeLog = {
            id: Date.now().toString(),
            userId: user.uid,
            startTime: activeTimer.startTime,
            endTime: endTime,
            durationSeconds: durationSeconds
        };

        await updateDoc(taskRef, {
            totalTimeSeconds: increment(durationSeconds),
            timeLogs: arrayUnion(newLog)
        });

        setActiveTimer(null);
        notify('success', `Time logged: ${formatDuration(durationSeconds)}`);
    } catch (error) {
        console.error("Failed to save time log:", error);
        notify('error', "Failed to save time log. Check console.");
        // Don't clear timer on error so user can retry or manual save
    }
  };

  return (
    <TimeTrackingContext.Provider value={{ activeTimer, startTimer, stopTimer, formatDuration, formatDurationShort }}>
      {children}
    </TimeTrackingContext.Provider>
  );
};

export const useTimeTracking = () => {
  const context = useContext(TimeTrackingContext);
  if (!context) {
    throw new Error('useTimeTracking must be used within a TimeTrackingProvider');
  }
  return context;
};
