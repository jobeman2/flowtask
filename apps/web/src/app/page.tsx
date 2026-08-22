'use client';

import React from 'react';
import { useAuth } from '../providers/telegram-provider';
import { useTelegram } from '../hooks/use-telegram';
import { WorkspaceSwitcher } from '../features/workspaces/components/workspace-switcher';
import { TaskList } from '../features/tasks/components/task-list';
import { CheckSquare, User as UserIcon } from 'lucide-react';

export default function HomePage() {
  const { user, isLoading, error } = useAuth();
  const { isInsideTelegram } = useTelegram();

  return (
    <div className="flex flex-col flex-1 space-y-4 pb-12">
      {/* Top Header */}
      <header className="flex items-center justify-between pt-2">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-blue-600 rounded-xl text-white shadow-sm">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
              FlowTask
            </h1>
            <p className="text-xs text-slate-500">
              {user ? `Hi, ${user.name}` : 'Telegram Task SaaS'}
            </p>
          </div>
        </div>

        <WorkspaceSwitcher />
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
      <footer className="mt-auto pt-6 text-center text-xs text-slate-400">
        {isInsideTelegram ? (
          <span>Connected via Telegram WebApp</span>
        ) : (
          <span>Web Preview Mode</span>
        )}
      </footer>
    </div>
  );
}
