'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { Button } from '@flowtask/ui';
import { TelebirrCheckoutModal } from './telebirr-checkout-modal';
import {
  X,
  Check,
  Zap,
  Crown,
} from 'lucide-react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const { workspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: subscription } = useQuery({
    queryKey: ['workspace-subscription', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const res = await apiClient.getWorkspaceSubscription(workspaceId);
      return res.data;
    },
    enabled: Boolean(workspaceId && isOpen),
  });

  const createOrderMutation = useMutation({
    mutationFn: async (planCode: string) => {
      if (!workspaceId) throw new Error('No active workspace selected');
      const res = await apiClient.createPaymentOrder({
        workspaceId,
        planCode,
        durationDays: 30,
      });
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (orderData) => {
      triggerHaptic('medium');
      setSelectedOrder(orderData);
      setIsCheckoutOpen(true);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to create order');
      triggerHaptic('heavy');
    },
  });

  if (!isOpen) return null;

  const currentPlanCode = subscription?.plan?.code || 'FREE';

  const plans = [
    {
      code: 'FREE',
      name: 'Starter (Free)',
      price: '0 ETB',
      period: 'forever',
      description: 'Essential task management for individuals and small chats',
      popular: false,
      color: 'border-slate-200 dark:border-slate-800',
      badge: 'Free',
      features: [
        '1 Workspace',
        'Up to 3 Team Members',
        'Up to 25 Active Tasks',
        '1 Telegram Group Board',
        'Core Bot Commands (/task, /today)',
      ],
    },
    {
      code: 'STANDARD',
      name: 'Standard (Team)',
      price: '350 ETB',
      period: '/ month',
      description: 'Ideal for growing squads and active Telegram groups',
      popular: true,
      color: 'border-blue-500 ring-2 ring-blue-500/20 shadow-blue-500/10',
      badge: 'Most Popular',
      features: [
        'Unlimited Active Tasks',
        'Up to 10 Team Members',
        'Up to 5 Telegram Group Boards',
        '🖼️ Image & Screenshot Attachments',
        '⏰ Automated Morning Digests',
        '🔁 Recurring Tasks (Daily/Weekly)',
      ],
    },
    {
      code: 'PRO',
      name: 'Pro (Agency)',
      price: '950 ETB',
      period: '/ month',
      description: 'Maximum speed for companies managing multiple clients',
      popular: false,
      color: 'border-purple-500 dark:border-purple-600',
      badge: 'Full Power',
      features: [
        'Unlimited Team Members',
        'Unlimited Telegram Groups',
        'Multiple Projects & Color Labels',
        '⚡ Priority Bot Instant Mentions',
        'HD Image Lightbox Attachments',
        'Activity History & Export Logs',
      ],
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
        <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-gradient-to-tr from-amber-500 to-yellow-500 rounded-xl text-white shadow-xs">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                  Plans & Pricing (ETB)
                </h3>
                <p className="text-xs text-slate-500">
                  Upgrade your workspace with local Telebirr payment
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {errorMsg && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Plan Cards Grid */}
          <div className="grid grid-cols-1 gap-3.5 pt-4">
            {plans.map((p) => {
              const isCurrent = currentPlanCode === p.code;

              return (
                <div
                  key={p.code}
                  className={`relative p-4 rounded-2xl border bg-slate-50/50 dark:bg-slate-800/40 transition-all ${
                    p.color
                  } ${isCurrent ? 'bg-blue-50/20 dark:bg-blue-950/20' : ''}`}
                >
                  {p.popular && (
                    <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-xs">
                      {p.badge}
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Current Active
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-base font-black text-slate-900 dark:text-white">
                        {p.price}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">{p.period}</div>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    {p.features.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[11px] font-medium">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action Button */}
                  <div className="mt-3.5">
                    {isCurrent ? (
                      <div className="w-full py-2 text-center text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        Active on this Workspace
                      </div>
                    ) : p.code === 'FREE' ? (
                      <div className="w-full py-2 text-center text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        Default Plan
                      </div>
                    ) : (
                      <Button
                        onClick={() => createOrderMutation.mutate(p.code)}
                        disabled={createOrderMutation.isPending}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Upgrade with Telebirr ({p.price})</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Telebirr Checkout Sheet */}
      <TelebirrCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          onClose();
        }}
        orderData={selectedOrder}
      />
    </>
  );
}
