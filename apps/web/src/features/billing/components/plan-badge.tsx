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
    queryKey: ['my-subscription'],
    queryFn: async () => {
      const res = await apiClient.getMySubscription();
      return res.data;
    },
  });

  const planCode = subscription?.plan?.code || subscription?.planCode || 'FREE';
  const isFree = planCode === 'FREE';

  return (
    <>
      <button
        type="button"
        onClick={() => setIsPricingOpen(true)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-xs shrink-0 active:scale-95 ${
          planCode === 'PRO'
            ? 'bg-gradient-to-r from-purple-700 to-indigo-600 text-white shadow-purple-500/20'
            : planCode === 'STANDARD'
            ? 'bg-gradient-to-r from-flow-700 via-flow-600 to-teal-500 text-white shadow-flow-sm'
            : 'bg-amber-500/10 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/20'
        }`}
      >
        {planCode === 'PRO' ? (
          <Crown className="w-3 h-3" />
        ) : planCode === 'STANDARD' ? (
          <Sparkles className="w-3 h-3" />
        ) : (
          <Zap className="w-3 h-3 text-amber-500" />
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
