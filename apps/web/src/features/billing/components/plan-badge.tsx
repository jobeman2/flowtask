'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { PricingModal } from './pricing-modal';
import { Crown, Sparkles, Zap } from 'lucide-react';

export function PlanBadge() {
  const { workspaceId } = useAuth();
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
  const isFree = planCode === 'FREE';

  return (
    <>
      <button
        type="button"
        onClick={() => setIsPricingOpen(true)}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
          planCode === 'PRO'
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-500/20'
            : planCode === 'STANDARD'
            ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-blue-500/20'
            : 'bg-amber-500/10 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/20'
        }`}
      >
        {planCode === 'PRO' ? (
          <Crown className="w-3.5 h-3.5" />
        ) : planCode === 'STANDARD' ? (
          <Sparkles className="w-3.5 h-3.5" />
        ) : (
          <Zap className="w-3.5 h-3.5 text-amber-500" />
        )}
        <span>{isFree ? 'Upgrade' : planCode}</span>
      </button>

      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
      />
    </>
  );
}
