
import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast, { ToastData, ToastType } from '../components/Toast';

interface NotificationContextType {
  notify: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = Date.now().toString() + Math.random();
    setToasts(prev => {
      // Limit to 5 toasts, new ones at the bottom
      const newToasts = [...prev, { id, type, message, duration }];
      if (newToasts.length > 5) {
        return newToasts.slice(newToasts.length - 5);
      }
      return newToasts;
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const contextValue = {
    notify: addToast,
    success: (msg: string, dur?: number) => addToast('success', msg, dur),
    error: (msg: string, dur?: number) => addToast('error', msg, dur),
    info: (msg: string, dur?: number) => addToast('info', msg, dur),
    warning: (msg: string, dur?: number) => addToast('warning', msg, dur),
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
