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
  Crown,
} from 'lucide-react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const { workspaceId, subscription, setSubscription } = useAuth();
  const { triggerHaptic } = useTelegram();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Current plan comes from user's account subscription (no extra API call needed)
  const currentPlanCode = subscription?.planCode || 'FREE';

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

  const plans = [
    {
      code: 'FREE',
      name: 'Free Starter',
      price: '0 ETB',
      period: 'forever',
      description: 'Essential task management for individuals',
      popular: false,
      color: 'border-slate-200 dark:border-slate-800',
      badge: 'Free',
      features: [
        '1 Workspace',
        'Up to 3 Projects',
        '1 Team Member',
        '1 Telegram Group Board',
        'Core Bot Commands',
      ],
    },
    {
      code: 'PRO',
      name: 'Pro Individual',
      price: '199 ETB',
      period: '/ month',
      description: 'Unlimited projects, reminders, and AI task extraction',
      popular: true,
      color: 'border-blue-500 ring-2 ring-blue-500/20 shadow-blue-500/10',
      badge: 'Most Popular',
      features: [
        '5 Workspaces',
        'Unlimited Projects',
        'AI Task Extraction',
        '🔄 Recurring Tasks',
        '⏰ Morning Digests',
        '📎 Image Attachments',
      ],
    },
    {
      code: 'TEAM',
      name: 'Team Collaboration',
      price: '999 ETB',
      period: '/ month',
      description: 'Collaborate with your team inside Telegram groups',
      popular: false,
      color: 'border-purple-500 dark:border-purple-600',
      badge: 'For Teams',
      features: [
        '10 Workspaces',
        'Up to 15 Members',
        'Team Task Board',
        '5 Telegram Groups',
        'Role-based Permissions',
        'Activity History',
      ],
    },
    {
      code: 'BUSINESS',
      name: 'Business Scale',
      price: '2,999 ETB',
      period: '/ month',
      description: 'Enterprise-grade management with advanced analytics',
      popular: false,
      color: 'border-amber-500 dark:border-amber-600',
      badge: 'Enterprise',
      features: [
        'Unlimited Workspaces',
        'Up to 100 Members',
        'Unlimited Groups',
        'Advanced Analytics',
        'Priority Support',
        'Custom Integrations',
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
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {errorMsg && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Pricing Grid */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((p) => {
              const isCurrent = currentPlanCode === p.code;

              return (
                <div
                  key={p.code}
                  className={`relative flex flex-col justify-between p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border transition-all ${p.color}`}
                >
                  {p.popular && (
                    <span className="absolute -top-2.5 right-4 px-2 py-0.5 bg-blue-600 text-white text-[9px] font-extrabold uppercase rounded-full tracking-wider shadow-xs">
                      {p.badge}
                    </span>
                  )}

                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {p.name}
                    </h4>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-xl font-black text-slate-900 dark:text-white">
                        {p.price}
                      </span>
                      <span className="text-[10px] text-slate-500">{p.period}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                      {p.description}
                    </p>

                    <div className="my-3 border-t border-slate-200 dark:border-slate-700/60" />

                    <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                      {p.features.map((f, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 pt-2">
                    {isCurrent ? (
                      <Button
                        variant="secondary"
                        disabled
                        className="w-full text-xs font-bold py-2 rounded-xl"
                      >
                        Active Plan
                      </Button>
                    ) : (
                      <Button
                        variant={p.code === 'STANDARD' ? 'primary' : 'outline'}
                        onClick={() => createOrderMutation.mutate(p.code)}
                        disabled={createOrderMutation.isPending}
                        className={`w-full text-xs font-bold py-2 rounded-xl ${
                          p.code === 'STANDARD'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20'
                            : ''
                        }`}
                      >
                        {createOrderMutation.isPending ? 'Processing...' : `Upgrade with Telebirr`}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-blue-600 dark:text-blue-400">⚡ Telebirr Direct</span>
              <span className="text-[11px] text-slate-500">Fast 1-tap checkout in Birr</span>
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
              Instant Activation
            </span>
          </div>
        </div>
      </div>

      {/* Telebirr Modal */}
      {selectedOrder && (
        <TelebirrCheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => {
            setIsCheckoutOpen(false);
            setSelectedOrder(null);
          }}
          orderData={selectedOrder}
          onSuccess={(planCode) => {
            // Immediately update user's subscription in auth context so badge refreshes
            setSubscription({
              planCode,
              status: 'ACTIVE',
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            });
            setIsCheckoutOpen(false);
            setSelectedOrder(null);
            onClose();
          }}
        />
      )}
    </>
  );
}
