'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { PricingModal } from '../../billing/components/pricing-modal';
import {
  Bell,
  Moon,
  Sun,
  Globe,
  HelpCircle,
  Info,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export function MoreView() {
  const { user, workspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const [isPricingOpen, setIsPricingOpen] = useState(false);
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
    <div className="space-y-5 pb-24 animate-in fade-in duration-300">
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
            {user?.name || 'FlowTask User'}
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

      {/* 3. Settings List */}
      <div className="bg-white dark:bg-slate-900/90 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-xs divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
        {/* Notifications */}
        <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-blue-500" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">Notifications</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="font-medium text-[11px]">Telegram DMs</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Appearance / Dark Mode */}
        <div
          onClick={toggleDarkMode}
          className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            {isDarkMode ? (
              <Moon className="w-4 h-4 text-purple-500" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
            <span className="font-semibold text-slate-800 dark:text-slate-200">Appearance</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="font-medium text-[11px]">{isDarkMode ? 'Dark' : 'Light'}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Language */}
        <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">Language</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="font-medium text-[11px]">English</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Help & Support */}
        <div
          onClick={() => {
            window.open('https://t.me/flowtaskmanager_bot', '_blank');
          }}
          className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <HelpCircle className="w-4 h-4 text-sky-500" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">Help & Support</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        {/* About FlowTask */}
        <div className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">About TaskFlow</span>
          </div>
          <span className="font-bold text-[11px] text-slate-400">v2.5.0</span>
        </div>
      </div>

      {/* Pricing Modal */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
      />
    </div>
  );
}
