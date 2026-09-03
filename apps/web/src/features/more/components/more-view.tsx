'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { PricingModal } from '../../billing/components/pricing-modal';
import { HelpSupportModal } from '../../help/components/help-support-modal';
import { NotificationsModal } from '../../settings/components/notifications-modal';
import { SettingsModal } from '../../settings/components/settings-modal';
import { ClickUpSyncModal } from '../../settings/components/clickup-sync-modal';
import { CreateMeetingModal } from '../../meetings/components/create-meeting-modal';
import { AiProjectManagerModal } from '../../ai/components/ai-project-manager-modal';
import {
  Bell,
  Sliders,
  Moon,
  Sun,
  Globe,
  HelpCircle,
  Info,
  ChevronRight,
  Sparkles,
  ArrowRightLeft,
  Video,
  Bot,
} from 'lucide-react';

export function MoreView() {
  const { user, workspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isClickUpSyncOpen, setIsClickUpSyncOpen] = useState(false);
  const [isCreateMeetingOpen, setIsCreateMeetingOpen] = useState(false);
  const [isAiPmOpen, setIsAiPmOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Fetch Subscription
  const { data: subscription } = useQuery({
    queryKey: ['workspace-subscription', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const res = await apiClient.getWorkspaceSubscription(workspaceId);
      return res.data;
    },
    enabled: Boolean(workspaceId),
  });

  const isUpgraded = subscription?.plan?.code && subscription.plan.code !== 'FREE';

  const toggleDarkMode = () => {
    triggerHaptic('light');
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const username = user?.name ? `@${user.name.toLowerCase().replace(/\s+/g, '')}` : '@teammate';

  return (
    <div className="space-y-5 pb-24 animate-in fade-in duration-300 font-sans">
      {/* 1. Profile Card */}
      <div className="flex flex-col items-center justify-center p-5 bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-xs space-y-2 text-center">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name || 'Profile'}
            className="w-20 h-20 rounded-full object-cover border-4 border-blue-50 dark:border-blue-950/50 shadow-md ring-2 ring-blue-500/20"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-2xl shadow-md ring-2 ring-blue-500/20">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
        )}

        <div className="space-y-0.5 pt-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {user?.name || 'Flow User'}
          </h3>
          <p className="text-xs font-semibold text-slate-400">
            {username}
          </p>
        </div>
      </div>

      {/* 2. Subscription Plan Banner */}
      <div
        onClick={() => {
          triggerHaptic('medium');
          setIsPricingOpen(true);
        }}
        className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md flex items-center justify-between cursor-pointer active:scale-98 transition-all"
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
            <span className="text-xs font-extrabold uppercase tracking-wider">
              {isUpgraded ? 'Standard Plan Active' : 'Upgrade to Standard'}
            </span>
          </div>
          <p className="text-[11px] text-blue-100 font-medium">
            {isUpgraded
              ? 'Enjoy AI features, attachments & unlimited tasks'
              : 'Unlock 10 ETB/mo Telebirr Team features'}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-white/80 shrink-0" />
      </div>

      {/* 3. Settings & Tools List */}
      <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-xs divide-y divide-slate-100 dark:border-slate-800/80 text-xs">
        {/* 🤖 AI Project Manager (Copilot) */}
        <div
          onClick={() => {
            triggerHaptic('medium');
            setIsAiPmOpen(true);
          }}
          className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group bg-blue-50/30 dark:bg-blue-950/20"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <span className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                AI Project Manager
              </span>
              <p className="text-[10px] text-slate-400 font-medium">
                Idea to classified tasks & auto-assignments
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="font-black text-[9px] uppercase px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-xs">
              Beta
            </span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Meetings & Standups Scheduler */}
        <div
          onClick={() => {
            triggerHaptic('medium');
            setIsCreateMeetingOpen(true);
          }}
          className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Video className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Meetings & Standups
            </span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="font-semibold text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">
              Schedule & Join
            </span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* ClickUp Sync & Migration Tool */}
        <div
          onClick={() => {
            triggerHaptic('medium');
            setIsClickUpSyncOpen(true);
          }}
          className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              ClickUp ↔ Flow Sync
            </span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="font-extrabold text-[9px] uppercase px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              PRO
            </span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Notifications Modal trigger */}
        <div
          onClick={() => {
            triggerHaptic('light');
            setIsNotificationsOpen(true);
          }}
          className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Bell className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Notifications & Alarms
            </span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="font-medium text-[11px]">DMs & Due Alarms</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* General App Settings & Preferences */}
        <div
          onClick={() => {
            triggerHaptic('light');
            setIsSettingsOpen(true);
          }}
          className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center">
              <Sliders className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              App Preferences & Views
            </span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="font-medium text-[11px]">Theme, Views & Haptics</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Appearance Quick Toggle */}
        <div
          onClick={toggleDarkMode}
          className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              {isDarkMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-200">Quick Theme</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="font-medium text-[11px]">{isDarkMode ? 'Dark' : 'Light'}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Language */}
        <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Globe className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-200">Language</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="font-medium text-[11px]">English</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Help & Support Center */}
        <div
          onClick={() => {
            triggerHaptic('medium');
            setIsHelpOpen(true);
          }}
          className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <HelpCircle className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Help & Support Center
            </span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="font-semibold text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">
              Guides & FAQs
            </span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* About FLOW */}
        <div className="flex items-center justify-between p-3.5 text-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
              <Info className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-slate-600 dark:text-slate-400">Version</span>
          </div>
          <span className="font-bold text-[11px]">v2.6.0 (AI Agent Pro)</span>
        </div>
      </div>

      {/* Modals */}
      <AiProjectManagerModal
        isOpen={isAiPmOpen}
        onClose={() => setIsAiPmOpen(false)}
      />

      <CreateMeetingModal
        isOpen={isCreateMeetingOpen}
        onClose={() => setIsCreateMeetingOpen(false)}
      />

      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
      />

      <HelpSupportModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <ClickUpSyncModal
        isOpen={isClickUpSyncOpen}
        onClose={() => setIsClickUpSyncOpen(false)}
      />
    </div>
  );
}
