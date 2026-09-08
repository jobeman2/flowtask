'use client';

import React from 'react';
import { useNotifications, AppNotification } from '../../providers/notification-provider';
import {
  CheckCircle2,
  UserPlus,
  Users,
  X,
  Bell,
  Check,
  LogOut,
  AlertCircle,
} from 'lucide-react';

export function ToastContainer() {
  const { activeToast, dismissToast } = useNotifications();

  if (!activeToast) return null;

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'TASK_ASSIGNED':
        return <UserPlus className="w-4 h-4 text-blue-500 shrink-0" />;
      case 'TASK_COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'TASK_CREATED':
        return <Check className="w-4 h-4 text-sky-500 shrink-0" />;
      case 'INVITATION_ACCEPTED':
        return <Users className="w-4 h-4 text-purple-500 shrink-0" />;
      case 'INVITATION_RECEIVED':
        return <Bell className="w-4 h-4 text-indigo-500 shrink-0" />;
      case 'MEMBER_LEFT':
        return <LogOut className="w-4 h-4 text-amber-500 shrink-0" />;
      default:
        return <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />;
    }
  };

  return (
    <div className="fixed top-3 inset-x-3 z-[100] flex justify-center pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="w-full max-w-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-slate-200/80 dark:border-slate-700/80 pointer-events-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-2xs">
            {getIcon(activeToast.type)}
          </div>
          <div className="min-w-0">
            <h5 className="text-xs font-black text-slate-900 dark:text-white truncate leading-tight">
              {activeToast.title}
            </h5>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium leading-tight">
              {activeToast.message}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={dismissToast}
          className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
