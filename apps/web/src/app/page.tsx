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
    <div className="flex flex-col flex-1 space-y-4 pb-20 min-h-screen font-sans">
      {/* 1. Bespoke Top Header with Official FLOW Branding */}
      <header className="flex items-center justify-between pt-1.5 pb-2 px-1 gap-2 sticky top-0 z-30 bg-[#F8FAFC]/90 dark:bg-[#0B1120]/90 backdrop-blur-md">
        <div className="flex items-center space-x-2.5 min-w-0">
          {/* Official FLOW Brand Logo */}
          <div className="flex items-center gap-1.5 shrink-0">
            <img
              src="/flow-logo.png"
              alt="FLOW"
              className="h-6 w-auto object-contain"
            />
            {isUpgraded && (
              <span
                onClick={() => setIsPricingOpen(true)}
                className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 cursor-pointer tracking-wider flex items-center gap-1"
              >
                <Sparkles className="w-2.5 h-2.5 fill-blue-600" />
                {planCode}
              </span>
            )}
          </div>
        </div>

        {/* Right side: Workspace Switcher & User Avatar */}
        <div className="flex items-center gap-2 shrink-0">
          <WorkspaceSwitcher />

          <div
            onClick={() => setActiveNav('PROFILE')}
            className="w-8 h-8 rounded-full bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-200/50 dark:border-blue-700/50 cursor-pointer overflow-hidden ring-2 ring-transparent hover:ring-blue-500/30 transition-all"
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

      {/* 4. Sleek Floating Island Navigation Dock */}
      <BottomNav
        activeTab={activeNav}
        onTabChange={(tab) => setActiveNav(tab)}
        onOpenCreate={() => setIsCreateOpen(true)}
      />
    </div>
  );
}
