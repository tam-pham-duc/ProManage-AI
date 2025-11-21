
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import Toast, { ToastData, ToastType } from '../components/Toast';

export interface NotificationItem {
  id: string;
  type: ToastType;
  message: string;
  timestamp: number;
  read: boolean;
}

interface NotificationContextType {
  notify: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  history: NotificationItem[];
  clearHistory: () => void;
  markAsRead: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const HISTORY_KEY = 'promanage_notification_history';
const MAX_HISTORY = 50;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [history, setHistory] = useState<NotificationItem[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const addToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = Date.now().toString() + Math.random();
    
    // Add to active toasts (popups)
    setToasts(prev => {
      const newToasts = [...prev, { id, type, message, duration }];
      if (newToasts.length > 5) {
        return newToasts.slice(newToasts.length - 5);
      }
      return newToasts;
    });

    // Add to history (localStorage persistence)
    setHistory(prev => {
        const newItem: NotificationItem = { 
            id, 
            type, 
            message, 
            timestamp: Date.now(),
            read: false 
        };
        const newHistory = [newItem, ...prev].slice(0, MAX_HISTORY);
        return newHistory;
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
      setHistory([]);
  }, []);

  const markAsRead = useCallback(() => {
      setHistory(prev => prev.map(item => ({ ...item, read: true })));
  }, []);

  const unreadCount = history.filter(h => !h.read).length;

  const contextValue = {
    notify: addToast,
    success: (msg: string, dur?: number) => addToast('success', msg, dur),
    error: (msg: string, dur?: number) => addToast('error', msg, dur),
    info: (msg: string, dur?: number) => addToast('info', msg, dur),
    warning: (msg: string, dur?: number) => addToast('warning', msg, dur),
    history,
    clearHistory,
    markAsRead,
    unreadCount
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      
      {/* Fixed Container for Toasts */}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col items-end pointer-events-none gap-2">
         <div className="pointer-events-auto flex flex-col items-end">
            {toasts.map(toast => (
              <Toast key={toast.id} toast={toast} onRemove={removeToast} />
            ))}
         </div>
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
