'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { ProjectsView } from '../../projects/components/projects-view';
import { TeamView } from '../../team/components/team-view';
import { PricingModal } from '../../billing/components/pricing-modal';
import {
  Folder,
  Users,
  Crown,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

type SubSection = 'PROJECTS' | 'TEAM';

export function MoreView() {
  const { workspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const [activeSection, setActiveSection] = useState<SubSection>('PROJECTS');
  const [isPricingOpen, setIsPricingOpen] = useState(false);

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
    <div className="space-y-4 pb-24 animate-in fade-in">
      {/* 1. Subscription Status / Upgrade Banner */}
      {isUpgraded ? (
        <div
          onClick={() => {
            triggerHaptic('medium');
            setIsPricingOpen(true);
          }}
          className="p-4 bg-gradient-to-br from-flow-800 via-flow-700 to-teal-600 rounded-3xl text-white shadow-flow-md cursor-pointer active:scale-[0.99] transition-all flex items-center justify-between gap-3 relative overflow-hidden"
        >
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs">
              <Sparkles className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-sm leading-tight">
                  {subscription?.plan?.name || `${planCode} Plan`}
                </h4>
                <span className="text-[10px] font-black bg-white/25 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Active
                </span>
              </div>
              <p className="text-xs text-flow-100 mt-0.5">
                {subscription?.currentPeriodEnd
                  ? `Active until ${new Date(subscription.currentPeriodEnd).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : 'Unlimited team tasks & Telegram sync'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 opacity-80 shrink-0" />
        </div>
      ) : (
        <div
          onClick={() => {
            triggerHaptic('medium');
            setIsPricingOpen(true);
          }}
          className="p-4 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 rounded-3xl text-white shadow-md cursor-pointer active:scale-[0.99] transition-all flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-sm leading-tight">Upgrade with Telebirr</h4>
              <p className="text-xs text-white/80 mt-0.5">
                Unlock unlimited tasks, Telegram group boards & image attachments
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 opacity-80 shrink-0" />
        </div>
      )}

      {/* 2. Sub-Section Switcher Tabs */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setActiveSection('PROJECTS');
          }}
          className={`py-2 px-3 text-center text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeSection === 'PROJECTS'
              ? 'bg-flow-600 text-white shadow-flow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Folder className="w-4 h-4" />
          <span>Projects & Labels</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setActiveSection('TEAM');
          }}
          className={`py-2 px-3 text-center text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeSection === 'TEAM'
              ? 'bg-flow-600 text-white shadow-flow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team & Roles</span>
        </button>
      </div>

      {/* 3. Section Content */}
      {activeSection === 'PROJECTS' ? (
        <ProjectsView
          selectedProjectId={null}
          onSelectProject={() => {}}
        />
      ) : (
        <TeamView />
      )}

      {/* Pricing Modal */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
      />
    </div>
  );
}
