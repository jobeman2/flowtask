'use client';

import React from 'react';
import { useNotifications, AppNotification } from '../../providers/notification-provider';
import { useTelegram } from '../../hooks/use-telegram';
import {
  Bell,
  CheckCheck,
  Trash2,
  X,
  UserPlus,
  CheckCircle2,
  Users,
  LogOut,
  Sliders,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export function NotificationsModal({ isOpen, onClose, onOpenSettings }: NotificationsModalProps) {
  const { notifications, unreadCount, markAllAsRead, clearAll, settings, updateSettings } =
    useNotifications();
  const { triggerHaptic } = useTelegram();
  const [showQuickSettings, setShowQuickSettings] = React.useState(false);

  if (!isOpen) return null;

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'TASK_ASSIGNED':
        return <UserPlus className="w-4 h-4 text-blue-500" />;
      case 'TASK_COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'INVITATION_ACCEPTED':
        return <Users className="w-4 h-4 text-purple-500" />;
      case 'INVITATION_RECEIVED':
        return <Bell className="w-4 h-4 text-indigo-500" />;
      case 'MEMBER_LEFT':
        return <LogOut className="w-4 h-4 text-amber-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in font-sans">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold relative">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Notifications
              </h3>
              <p className="text-[10px] font-semibold text-slate-400">
                {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setShowQuickSettings(!showQuickSettings);
              }}
              title="Notification Settings"
              className={`p-1.5 rounded-xl transition-colors ${
                showQuickSettings
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Settings Drawer Toggle */}
        {showQuickSettings && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 space-y-2 text-xs">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              In-App Alert Toggles
            </span>

            <div className="flex items-center justify-between py-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                Floating Mini Toasts
              </span>
              <input
                type="checkbox"
                checked={settings.toastsEnabled}
                onChange={(e) => updateSettings({ toastsEnabled: e.target.checked })}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                Task Assignments
              </span>
              <input
                type="checkbox"
                checked={settings.taskAssigned}
                onChange={(e) => updateSettings({ taskAssigned: e.target.checked })}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                Team & Workspace Activity
              </span>
              <input
                type="checkbox"
                checked={settings.teamActivity}
                onChange={(e) => updateSettings({ teamActivity: e.target.checked })}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Action bar (Mark all read, Clear) */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between px-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                markAllAsRead();
              }}
              className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                clearAll();
              }}
              className="text-slate-400 hover:text-rose-500 font-bold transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="space-y-2 overflow-y-auto flex-1 no-scrollbar pr-0.5">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-3 rounded-2xl border transition-all flex items-start gap-2.5 ${
                notif.read
                  ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'
                  : 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200/80 dark:border-blue-800/80 shadow-2xs'
              }`}
            >
              <div className="w-7 h-7 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                {getIcon(notif.type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h4
                    className={`text-xs truncate ${
                      notif.read ? 'font-bold text-slate-700 dark:text-slate-300' : 'font-extrabold text-slate-900 dark:text-white'
                    }`}
                  >
                    {notif.title}
                  </h4>
                  <span className="text-[9px] text-slate-400 font-medium shrink-0 flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {formatTime(notif.timestamp)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                  {notif.message}
                </p>
              </div>
            </div>
          ))}

          {notifications.length === 0 && (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2 my-auto">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Bell className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                No notifications yet
              </p>
              <p className="text-[10px] text-slate-400">
                You will be notified when tasks are assigned, completed, or teammates join.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
