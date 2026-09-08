'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './telegram-provider';
import { useTelegram } from '../hooks/use-telegram';

export interface AppNotification {
  id: string;
  type:
    | 'TASK_ASSIGNED'
    | 'TASK_CREATED'
    | 'TASK_COMPLETED'
    | 'INVITATION_ACCEPTED'
    | 'INVITATION_RECEIVED'
    | 'MEMBER_LEFT'
    | 'SYSTEM';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: any;
}

export interface NotificationSettings {
  toastsEnabled: boolean;
  taskAssigned: boolean;
  taskCreated: boolean;
  taskCompleted: boolean;
  teamActivity: boolean;
  hapticsEnabled: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  toastsEnabled: true,
  taskAssigned: true,
  taskCreated: true,
  taskCompleted: true,
  teamActivity: true,
  hapticsEnabled: true,
};

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  activeToast: AppNotification | null;
  dismissToast: () => void;
  addNotification: (notif: {
    type: AppNotification['type'];
    title: string;
    message: string;
    data?: any;
  }) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  syncActivityLogs: (logs: any[]) => void;
  settings: NotificationSettings;
  updateSettings: (partial: Partial<NotificationSettings>) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  activeToast: null,
  dismissToast: () => {},
  addNotification: () => {},
  markAllAsRead: () => {},
  clearAll: () => {},
  syncActivityLogs: () => {},
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);

  const storageKey = user?.id ? `flowtask_notifications_${user.id}` : 'flowtask_notifications_guest';
  const settingsKey = user?.id ? `flowtask_notif_settings_${user.id}` : 'flowtask_notif_settings_guest';

  // Load notifications and settings from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedNotifs = localStorage.getItem(storageKey);
      if (savedNotifs) {
        setNotifications(JSON.parse(savedNotifs));
      } else {
        setNotifications([]);
      }
    } catch {
      setNotifications([]);
    }

    try {
      const savedSettings = localStorage.getItem(settingsKey);
      if (savedSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
      }
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
  }, [storageKey, settingsKey]);

  // Save notifications to localStorage
  const persistNotifications = useCallback((newNotifs: AppNotification[]) => {
    setNotifications(newNotifs);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newNotifs.slice(0, 50)));
      } catch {}
    }
  }, [storageKey]);

  // Update Settings
  const updateSettings = useCallback((partial: Partial<NotificationSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...partial };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(settingsKey, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  }, [settingsKey]);

  const dismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  const addNotification = useCallback(
    (notif: {
      type: AppNotification['type'];
      title: string;
      message: string;
      data?: any;
    }) => {
      // Check user preferences
      if (notif.type === 'TASK_ASSIGNED' && !settings.taskAssigned) return;
      if (notif.type === 'TASK_CREATED' && !settings.taskCreated) return;
      if (notif.type === 'TASK_COMPLETED' && !settings.taskCompleted) return;
      if (
        (notif.type === 'INVITATION_ACCEPTED' ||
          notif.type === 'INVITATION_RECEIVED' ||
          notif.type === 'MEMBER_LEFT') &&
        !settings.teamActivity
      ) {
        return;
      }

      const newNotif: AppNotification = {
        id: notif.data?.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        timestamp: new Date().toISOString(),
        read: false,
        data: notif.data,
      };

      setNotifications((prev) => {
        // Prevent duplicate toasts/notifications within 2s for identical title/message
        if (
          prev.some(
            (p) =>
              p.title === notif.title &&
              p.message === notif.message &&
              Math.abs(new Date(p.timestamp).getTime() - Date.now()) < 3000
          )
        ) {
          return prev;
        }

        const updated = [newNotif, ...prev].slice(0, 50);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(storageKey, JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });

      // Show toast if enabled
      if (settings.toastsEnabled) {
        if (settings.hapticsEnabled) {
          triggerHaptic('light');
        }
        setActiveToast(newNotif);
      }
    },
    [settings, triggerHaptic, storageKey]
  );

  const syncActivityLogs = useCallback(
    (logs: any[]) => {
      if (!Array.isArray(logs) || logs.length === 0) return;

      setNotifications((prev) => {
        const readMap = new Map<string, boolean>();
        prev.forEach((p) => {
          readMap.set(p.id, p.read);
        });

        const mapped: AppNotification[] = [];

        logs.forEach((log) => {
          const action = log.action;
          let type: AppNotification['type'] | null = null;
          let title = '';
          let message = '';

          const taskTitle = log.metadata?.title || 'a task';
          const actorName = log.actor?.name || 'A teammate';

          if (action === 'TASK_ASSIGNED') {
            type = 'TASK_ASSIGNED';
            const isAssignedToMe = log.metadata?.assigneeId === user?.id;
            title = isAssignedToMe ? 'Task Assigned To You' : 'Task Assigned';
            message = isAssignedToMe
              ? `You were assigned to "${taskTitle}" by ${log.metadata?.assignerName || actorName}`
              : `"${taskTitle}" was assigned to ${log.metadata?.assigneeName || 'a teammate'}`;
          } else if (action === 'TASK_CREATED') {
            type = 'TASK_CREATED';
            title = 'New Task Created';
            message = `"${taskTitle}" was created by ${actorName}`;
          } else if (action === 'TASK_COMPLETED') {
            type = 'TASK_COMPLETED';
            title = 'Task Completed';
            message = `"${taskTitle}" was marked as done by ${log.metadata?.completedByName || actorName}!`;
          } else if (action === 'INVITATION_ACCEPTED') {
            type = 'INVITATION_ACCEPTED';
            title = 'Teammate Joined';
            message = `${actorName} joined the workspace!`;
          } else if (action === 'MEMBER_LEFT') {
            type = 'MEMBER_LEFT';
            title = 'Member Left';
            message = `${actorName} left the workspace.`;
          }

          if (type) {
            mapped.push({
              id: log.id,
              type,
              title,
              message,
              timestamp: log.createdAt || new Date().toISOString(),
              read: readMap.has(log.id) ? readMap.get(log.id)! : false,
              data: log,
            });
          }
        });

        // Merge mapped items with any local items
        const combined = [...prev];
        mapped.forEach((m) => {
          if (!combined.some((c) => c.id === m.id)) {
            combined.push(m);
          }
        });

        combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const truncated = combined.slice(0, 50);

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(storageKey, JSON.stringify(truncated));
          } catch {}
        }

        return truncated;
      });
    },
    [user?.id, storageKey]
  );

  // Auto-dismiss toast after 3.5s
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [activeToast]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  }, [storageKey]);

  const clearAll = useCallback(() => {
    setNotifications([]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify([]));
      } catch {}
    }
  }, [storageKey]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        activeToast,
        dismissToast,
        addNotification,
        markAllAsRead,
        clearAll,
        syncActivityLogs,
        settings,
        updateSettings,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
