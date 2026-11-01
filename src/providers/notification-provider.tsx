'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const showNotification = useCallback((message: string, type: NotificationType = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      timers.current.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
    timers.current.set(id, timer);
  }, []);

  const removeNotification = (id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <div className="fixed bottom-8 right-8 z-[200] flex flex-col gap-4 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className={`pointer-events-auto min-w-[320px] p-5 rounded-2xl border flex items-center gap-4 shadow-2xl backdrop-blur-md ${
                n.type === 'success'
                  ? 'bg-lime-50 border-lime-700 text-lime-800'
                  : n.type === 'error'
                    ? 'bg-red-50 border-red-700 text-red-800'
                    : 'bg-blue-50 border-blue-700 text-blue-800'
              }`}
            >
              <div className="shrink-0">
                {n.type === 'success' && <CheckCircle2 size={24} />}
                {n.type === 'error' && <AlertCircle size={24} />}
                {n.type === 'info' && <Info size={24} />}
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold normal-case tracking-normal mb-0.5">{n.type}</p>
                <p className="text-sm font-semibold text-slate-900">{n.message}</p>
              </div>
              <button aria-label="Dismiss notification" onClick={() => removeNotification(n.id)} className="p-3 hover:bg-black/5 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
}
