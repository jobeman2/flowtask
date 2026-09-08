'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
  markAsRead: (id: string) => void;
  dismissNotification: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  syncActivityLogs: (logs: any[], workspaceOwnerId?: string) => void;
  settings: NotificationSettings;
  updateSettings: (partial: Partial<NotificationSettings>) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  activeToast: null,
  dismissToast: () => {},
  addNotification: () => {},
  markAsRead: () => {},
  dismissNotification: () => {},
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
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(new Set());
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);

  const storageKey = user?.id ? `flowtask_active_notifs_${user.id}` : 'flowtask_active_notifs_guest';
  const readKey = user?.id ? `flowtask_read_ids_${user.id}` : 'flowtask_read_ids_guest';
  const settingsKey = user?.id ? `flowtask_notif_settings_${user.id}` : 'flowtask_notif_settings_guest';

  const readNotifIdsRef = useRef(readNotifIds);
  readNotifIdsRef.current = readNotifIds;

  // 1. Load active notifications, read IDs, and settings from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let savedReadIds = new Set<string>();
    try {
      const readRaw = localStorage.getItem(readKey);
      if (readRaw) {
        const parsed = JSON.parse(readRaw);
        if (Array.isArray(parsed)) {
          savedReadIds = new Set(parsed);
          setReadNotifIds(savedReadIds);
        }
      }
    } catch {}

    try {
      const savedNotifs = localStorage.getItem(storageKey);
      if (savedNotifs) {
        const parsed: AppNotification[] = JSON.parse(savedNotifs);
        // Only keep unread notifications that have not been read/dismissed
        const filtered = Array.isArray(parsed)
          ? parsed.filter((n) => !n.read && !savedReadIds.has(n.id))
          : [];
        setNotifications(filtered);
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
  }, [storageKey, readKey, settingsKey]);

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

  // Mark single notification as read -> DISAPPEARS from active list
  const markAsRead = useCallback(
    (id: string) => {
      setReadNotifIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(readKey, JSON.stringify(Array.from(next).slice(-200)));
          } catch {}
        }
        return next;
      });

      setNotifications((prev) => {
        const updated = prev.filter((n) => n.id !== id);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(storageKey, JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });
    },
    [readKey, storageKey]
  );

  const dismissNotification = markAsRead;

  // Mark all as read -> ALL DISAPPEAR from active list
  const markAllAsRead = useCallback(() => {
    setReadNotifIds((readSet) => {
      const next = new Set(readSet instanceof Set ? readSet : []);
      if (Array.isArray(notifications)) {
        notifications.forEach((n) => {
          if (n?.id) next.add(n.id);
        });
      }
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(readKey, JSON.stringify(Array.from(next).slice(-200)));
          localStorage.setItem(storageKey, JSON.stringify([]));
        } catch {}
      }
      return next;
    });
    setNotifications([]);
  }, [notifications, readKey, storageKey]);

  const clearAll = markAllAsRead;

  // Add individual live notification (strictly personalized)
  const addNotification = useCallback(
    (notif: {
      type: AppNotification['type'];
      title: string;
      message: string;
      data?: any;
    }) => {
      if (!notif) return;
      // 1. Check user alert toggles
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

      const notifId =
        notif.data?.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // 2. If already read or dismissed in past, ignore
      const currentReadIds =
        readNotifIdsRef.current instanceof Set ? readNotifIdsRef.current : new Set<string>();
      if (currentReadIds.has(notifId)) return;

      const newNotif: AppNotification = {
        id: notifId,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        timestamp: new Date().toISOString(),
        read: false,
        data: notif.data,
      };

      setNotifications((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        // Prevent duplicate toasts/notifications for same ID or identical content within 3s
        if (
          safePrev.some(
            (p) =>
              p?.id === newNotif.id ||
              (p?.title === notif.title &&
                p?.message === notif.message &&
                Math.abs(new Date(p.timestamp).getTime() - Date.now()) < 3000)
          )
        ) {
          return safePrev;
        }

        const updated = [newNotif, ...safePrev].slice(0, 50);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(storageKey, JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });

      // Show floating mini toast
      if (settings.toastsEnabled) {
        if (settings.hapticsEnabled) {
          triggerHaptic('light');
        }
        setActiveToast(newNotif);
      }
    },
    [settings, triggerHaptic, storageKey]
  );

  // Sync Activity Logs strictly personalized for the logged-in user
  const syncActivityLogs = useCallback(
    (logs: any[], workspaceOwnerId?: string) => {
      if (!Array.isArray(logs) || logs.length === 0 || !user?.id) return;

      const currentUserId = user.id;
      const currentReadIds =
        readNotifIdsRef.current instanceof Set ? readNotifIdsRef.current : new Set<string>();

      try {
        setNotifications((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          const existingIds = new Set(safePrev.map((p) => p?.id).filter(Boolean));
          const newItems: AppNotification[] = [];

          for (const log of logs) {
            if (!log || typeof log !== 'object') continue;
            // Never notify user of their own actions
            if (log.actorId === currentUserId) continue;

            // Never re-add notifications the user already read/dismissed
            if (log.id && currentReadIds.has(log.id)) continue;

            // If already in active list, skip
            if (log.id && existingIds.has(log.id)) continue;

          const action = log.action;
          const taskTitle = log.metadata?.title || 'a task';
          const actorName = log.actor?.name || 'A teammate';

          let type: AppNotification['type'] | null = null;
          let title = '';
          let message = '';

          if (action === 'TASK_ASSIGNED') {
            const isAssignedToMe =
              log.metadata?.assigneeId === currentUserId ||
              (Array.isArray(log.metadata?.assigneeIds) &&
                log.metadata.assigneeIds.includes(currentUserId));

            // ONLY show TASK_ASSIGNED if the user is the assigned teammate!
            if (isAssignedToMe) {
              type = 'TASK_ASSIGNED';
              title = 'Task Assigned To You';
              message = `You were assigned to "${taskTitle}" by ${log.metadata?.assignerName || actorName}`;
            }
          } else if (action === 'TASK_CREATED') {
            const isAssignedToMe =
              log.metadata?.assigneeId === currentUserId ||
              (Array.isArray(log.metadata?.assigneeIds) &&
                log.metadata.assigneeIds.includes(currentUserId));
            const isWorkspaceOwner = workspaceOwnerId && workspaceOwnerId === currentUserId;

            if (isAssignedToMe) {
              type = 'TASK_CREATED';
              title = 'New Task Assigned';
              message = `"${taskTitle}" was created and assigned to you by ${actorName}`;
            } else if (isWorkspaceOwner) {
              type = 'TASK_CREATED';
              title = 'New Task Created';
              message = `"${taskTitle}" was added to your workspace by ${actorName}`;
            }
          } else if (action === 'TASK_COMPLETED') {
            const isCreator = log.metadata?.creatorId === currentUserId;
            const isWorkspaceOwner =
              (log.metadata?.workspaceOwnerId && log.metadata.workspaceOwnerId === currentUserId) ||
              (workspaceOwnerId && workspaceOwnerId === currentUserId);

            // ONLY notify if current user is the task creator or workspace owner!
            if (isCreator || isWorkspaceOwner) {
              type = 'TASK_COMPLETED';
              title = 'Task Completed';
              message = `"${taskTitle}" was marked as done by ${log.metadata?.completedByName || actorName}!`;
            }
          } else if (action === 'INVITATION_ACCEPTED') {
            const isInviter = log.metadata?.inviterId === currentUserId;
            const isWorkspaceOwner =
              (log.metadata?.ownerId && log.metadata.ownerId === currentUserId) ||
              (workspaceOwnerId && workspaceOwnerId === currentUserId);

            // ONLY notify inviter or workspace owner
            if (isInviter || isWorkspaceOwner) {
              type = 'INVITATION_ACCEPTED';
              title = 'Teammate Joined';
              message = `${actorName} accepted the invitation to join the workspace!`;
            }
          } else if (action === 'MEMBER_LEFT') {
            const isWorkspaceOwner =
              (log.metadata?.ownerId && log.metadata.ownerId === currentUserId) ||
              (workspaceOwnerId && workspaceOwnerId === currentUserId);

            // ONLY notify workspace owner
            if (isWorkspaceOwner) {
              type = 'MEMBER_LEFT';
              title = 'Member Left';
              message = `${actorName} left the workspace.`;
            }
          }

          if (type) {
            newItems.push({
              id: log.id,
              type,
              title,
              message,
              timestamp: log.createdAt || new Date().toISOString(),
              read: false,
              data: {
                ...log,
                taskId: log.entityType === 'TASK' ? log.entityId : log.metadata?.taskId,
              },
            });
          }
        }

        if (newItems.length === 0) return prev;

        const combined = [...newItems, ...prev];
        combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const truncated = combined.slice(0, 50);

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(storageKey, JSON.stringify(truncated));
          } catch {}
        }

        return truncated;
      });
      } catch {
        // Non-blocking
      }
    },
    [user?.id, storageKey]
  );

  // Auto-dismiss floating toast after 3.5s
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [activeToast]);

  const unreadCount = Array.isArray(notifications) ? notifications.length : 0;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        activeToast,
        dismissToast,
        addNotification,
        markAsRead,
        dismissNotification,
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
