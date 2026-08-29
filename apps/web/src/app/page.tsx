'use client';

import React from 'react';
import { useAuth } from '../providers/telegram-provider';
import { useTelegram } from '../hooks/use-telegram';
import { WorkspaceSwitcher } from '../features/workspaces/components/workspace-switcher';
import { PlanBadge } from '../features/billing/components/plan-badge';
import { TaskList } from '../features/tasks/components/task-list';
import { CheckSquare } from 'lucide-react';

export default function HomePage() {
  const { user, error } = useAuth();
  const { isInsideTelegram } = useTelegram();

  return (
    <div className="flex flex-col flex-1 space-y-4 pb-12">
      {/* Top Header */}
      <header className="flex items-center justify-between pt-2">
        <div className="flex items-center space-x-2.5">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name || 'User'}
              className="w-9 h-9 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs shrink-0"
            />
          ) : (
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl text-white shadow-xs">
              <CheckSquare className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>FlowTask</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {user ? `Hi, ${user.name}` : 'Telegram Task SaaS'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <PlanBadge />
          <WorkspaceSwitcher />
        </div>
      </header>

      {/* Auth / Status Error Banner if any */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* Main Task List Feature View */}
      <section className="flex-1 mt-2">
        <TaskList />
      </section>

      {/* Footer info */}
      <footer className="mt-auto pt-6 text-center text-xs text-slate-400 space-y-2">
        {isInsideTelegram ? (
          <span>Connected via Telegram WebApp</span>
        ) : (
          <div className="flex flex-col items-center gap-1.5 p-3 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-medium text-slate-500">Preview as Telegram Account:</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => (window.location.href = '?user=jovany')}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs"
              >
                Jovany (@jobeman)
              </button>
              <button
                onClick={() => (window.location.href = '?user=tumim')}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-purple-600 text-white hover:bg-purple-700 shadow-xs"
              >
                Tumim (@tuma124)
              </button>
              <button
                onClick={() => (window.location.href = '?user=dev')}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300"
              >
                Dev Tester
              </button>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
