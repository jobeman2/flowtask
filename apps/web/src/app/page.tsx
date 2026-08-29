'use client';

import React, { useState } from 'react';
import { useAuth } from '../providers/telegram-provider';
import { WorkspaceSwitcher } from '../features/workspaces/components/workspace-switcher';
import { PlanBadge } from '../features/billing/components/plan-badge';
import { BottomNav, NavTab } from '../components/navigation/bottom-nav';
import { HomeView } from '../features/home/components/home-view';
import { TasksView } from '../features/tasks/components/tasks-view';
import { InboxView } from '../features/inbox/components/inbox-view';
import { MoreView } from '../features/more/components/more-view';
import { CreateTaskSheet } from '../features/tasks/components/create-task-sheet';
import { TaskDetailModal } from '../features/tasks/components/task-detail-modal';
import { CheckSquare } from 'lucide-react';

export default function HomePage() {
  const { user, error } = useAuth();
  const [activeNav, setActiveNav] = useState<NavTab>('HOME');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="flex flex-col flex-1 space-y-3 pb-16 min-h-screen">
      {/* 1. Modern Top Header */}
      <header className="flex items-center justify-between pt-1 pb-2 gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name || 'User'}
              className="w-9 h-9 rounded-2xl object-cover border-2 border-white dark:border-slate-800 shadow-flow-sm shrink-0 ring-1 ring-flow-500/20"
            />
          ) : (
            <div className="w-9 h-9 bg-gradient-to-tr from-flow-700 via-flow-600 to-teal-400 rounded-2xl text-white flex items-center justify-center font-black shadow-flow-sm shrink-0">
              <CheckSquare className="w-4.5 h-4.5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-black text-sm tracking-tight text-slate-900 dark:text-white truncate leading-tight">
              FlowTask
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold truncate">
              {user ? user.name : 'Telegram Native'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <PlanBadge />
          <WorkspaceSwitcher />
        </div>
      </header>

      {/* Auth Error Banner if any */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl">
          {error}
        </div>
      )}

      {/* 2. Main Screen Area (Switched by Bottom Nav) */}
      <main className="flex-1">
        {activeNav === 'HOME' && (
          <HomeView
            onSelectTask={(id) => setSelectedTaskId(id)}
            onOpenCreate={() => setIsCreateOpen(true)}
            onNavigateTasks={() => setActiveNav('TASKS')}
          />
        )}

        {activeNav === 'TASKS' && (
          <TasksView
            onSelectTask={(id) => setSelectedTaskId(id)}
            onOpenCreate={() => setIsCreateOpen(true)}
          />
        )}

        {activeNav === 'INBOX' && <InboxView />}

        {activeNav === 'MORE' && <MoreView />}
      </main>

      {/* 3. Reusable Task Modals */}
      <CreateTaskSheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      <TaskDetailModal
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />

      {/* 4. Fixed Modern Mobile Bottom Navigation Dock */}
      <BottomNav
        activeTab={activeNav}
        onTabChange={(tab) => setActiveNav(tab)}
        onOpenCreate={() => setIsCreateOpen(true)}
      />
    </div>
  );
}
