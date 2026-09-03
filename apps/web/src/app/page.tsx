'use client';

import React, { useState } from 'react';
import { useAuth } from '../providers/telegram-provider';
import { WorkspaceSwitcher } from '../features/workspaces/components/workspace-switcher';
import { PricingModal } from '../features/billing/components/pricing-modal';
import { BottomNav, NavTab } from '../components/navigation/bottom-nav';
import { HomeView } from '../features/home/components/home-view';
import { TasksView } from '../features/tasks/components/tasks-view';
import { TeamView } from '../features/team/components/team-view';
import { MoreView } from '../features/more/components/more-view';
import { CreateTaskSheet } from '../features/tasks/components/create-task-sheet';
import { TaskDetailModal } from '../features/tasks/components/task-detail-modal';
import { Sparkles } from 'lucide-react';

export default function HomePage() {
  const { user, error, subscription } = useAuth();
  const [activeNav, setActiveNav] = useState<NavTab>('HOME');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);

  // Plan comes from the user's own account subscription (works cross-device automatically)
  const planCode = subscription?.planCode || 'FREE';
  const isUpgraded = planCode !== 'FREE';

  return (
    <div className="flex flex-col flex-1 space-y-4 pb-20 min-h-screen font-sans">
      {/* 1. Header: Account & Workspace on Left, Status/Upgrade on Right */}
      <header className="flex items-center justify-between pt-2 pb-2.5 px-1 gap-2 sticky top-0 z-30 bg-[#F8FAFC]/90 dark:bg-[#0B1120]/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/60">
        {/* Left Side: Avatar + Workspace Switcher */}
        <div className="flex items-center gap-2 min-w-0">
          {/* User Avatar */}
          <div
            onClick={() => setActiveNav('PROFILE')}
            className="w-8 h-8 rounded-full bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-extrabold text-xs border border-blue-200/60 dark:border-blue-700/60 cursor-pointer overflow-hidden shrink-0 shadow-2xs"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || 'User'}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{user?.name?.[0]?.toUpperCase() || 'U'}</span>
            )}
          </div>

          {/* Workspace Switcher Pill */}
          <WorkspaceSwitcher />
        </div>

        {/* Right Side: Plan Badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsPricingOpen(true)}
            className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 shadow-2xs ${
              isUpgraded
                ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="w-3 h-3 fill-amber-400 text-amber-500" />
            <span>{isUpgraded ? planCode : 'Free Plan'}</span>
          </button>
        </div>
      </header>

      {/* Auth Error Banner if any */}
      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs rounded-2xl font-medium">
          {error}
        </div>
      )}

      {/* 2. Main Screen Area (Switched by Bottom Nav) */}
      <main className="flex-1 px-1">
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

        {activeNav === 'TEAM' && <TeamView />}

        {activeNav === 'PROFILE' && <MoreView />}
      </main>

      {/* 3. Floating Bottom Navigation Island */}
      <BottomNav
        activeTab={activeNav}
        onTabChange={(tab) => setActiveNav(tab)}
        onOpenCreate={() => setIsCreateOpen(true)}
      />

      {/* 4. Global Modals & Sheets */}
      <CreateTaskSheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      <TaskDetailModal
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />

      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
      />
    </div>
  );
}
