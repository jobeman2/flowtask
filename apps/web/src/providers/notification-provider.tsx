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
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        timestamp: new Date().toISOString(),
        read: false,
        data: notif.data,
      };

      persistNotifications([newNotif, ...notifications]);

      // Show toast if enabled
      if (settings.toastsEnabled) {
        if (settings.hapticsEnabled) {
          triggerHaptic('light');
        }
        setActiveToast(newNotif);
      }
    },
    [notifications, settings, triggerHaptic, persistNotifications]
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
    const updated = notifications.map((n) => ({ ...n, read: true }));
    persistNotifications(updated);
  }, [notifications, persistNotifications]);

  const clearAll = useCallback(() => {
    persistNotifications([]);
  }, [persistNotifications]);

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
