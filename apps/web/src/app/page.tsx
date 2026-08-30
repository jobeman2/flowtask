'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
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
  const { user, workspaceId, error } = useAuth();
  const [activeNav, setActiveNav] = useState<NavTab>('HOME');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);

  // Fetch Subscription for subtle profile badge
  const { data: subscription } = useQuery({
    queryKey: ['workspace-subscription', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const res = await apiClient.getWorkspaceSubscription(workspaceId);
      return res.data;
    },
    enabled: Boolean(workspaceId),
  });

  const planCode = subscription?.plan?.code || 'FREE';
  const isUpgraded = planCode !== 'FREE';

  return (
    <div className="flex flex-col flex-1 space-y-3 pb-16 min-h-screen">
      {/* 1. Modern Top Header */}
      <header className="flex items-center justify-between pt-1 pb-2 gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          {/* Profile Avatar with subtle Plan Badge */}
          <div
            onClick={() => isUpgraded && setIsPricingOpen(true)}
            className="relative shrink-0 cursor-pointer group"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || 'User'}
                className="w-9 h-9 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-xs ring-1 ring-blue-500/20"
              />
            ) : (
              <div className="w-9 h-9 bg-blue-600 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-xs">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            )}

            {/* Small badge attached directly to avatar */}
            {isUpgraded && (
              <div
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-400 text-slate-900 border-2 border-white dark:border-slate-950 flex items-center justify-center shadow-xs"
                title={`${planCode} Plan`}
              >
                <Sparkles className="w-2 h-2 fill-slate-900" />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white truncate leading-tight">
                TaskFlow
              </h1>
              <span className="text-[9px] font-medium text-slate-400">
                mini app
              </span>
              {isUpgraded && (
                <span
                  onClick={() => setIsPricingOpen(true)}
                  className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300/40 cursor-pointer leading-tight tracking-wider"
                >
                  {planCode}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-semibold truncate">
              {user ? user.name : 'Telegram Native'}
            </p>
          </div>
        </div>

        {/* Right side: Clean Workspace Switcher only */}
        <div className="flex items-center shrink-0">
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

        {activeNav === 'TEAM' && <TeamView />}

        {activeNav === 'PROFILE' && <MoreView />}
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

      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
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
