'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { Button } from '@flowtask/ui';
import {
  X,
  Check,
  Crown,
  ArrowLeft,
  Copy,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const { user, workspaceId, subscription, setSubscription } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [mounted, setMounted] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [transactionId, setTransactionId] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = () => {
    setSelectedOrder(null);
    setVerificationResult(null);
    setTransactionId('');
    setErrorMsg(null);
    onClose();
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    triggerHaptic('light');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Current plan comes from user's account subscription
  const currentPlanCode = subscription?.planCode || 'FREE';

  // 1. Create Payment Order Mutation
  const createOrderMutation = useMutation({
    mutationFn: async (planCode: string) => {
      setErrorMsg(null);
      const targetWsId = workspaceId || user?.defaultWorkspaceId || '';
      const res = await apiClient.createPaymentOrder({
        workspaceId: targetWsId,
        planCode,
        durationDays: 30,
      });
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (orderData) => {
      triggerHaptic('medium');
      setSelectedOrder(orderData);
      setTransactionId('');
      setVerificationResult(null);
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to create order. Please try again.');
      triggerHaptic('heavy');
    },
  });

  // 2. Verify Payment Order Mutation
  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder?.orderId || !transactionId.trim()) {
        throw new Error('Please enter your Telebirr Transaction Number (TxID)');
      }
      setErrorMsg(null);
      const res = await apiClient.verifyPaymentOrder({
        orderId: selectedOrder.orderId,
        transactionId: transactionId.trim(),
      });
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data) => {
      setVerificationResult(data);
      triggerHaptic('medium');

      if (data?.verified && selectedOrder?.planCode) {
        // Immediately update user's subscription in auth context so badge & permissions refresh instantly
        setSubscription({
          planCode: selectedOrder.planCode,
          status: 'ACTIVE',
          currentPeriodEnd: data.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      queryClient.invalidateQueries({ queryKey: ['workspace-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Verification failed. Please check your Transaction ID.');
      triggerHaptic('heavy');
    },
  });

  if (!isOpen || !mounted) return null;

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
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
        
        {/* STEP 2: TELEBIRR CHECKOUT VIEW */}
        {selectedOrder ? (
          <div className="space-y-4">
            {/* Header with Back Button */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                {!verificationResult?.verified && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrder(null);
                      setErrorMsg(null);
                    }}
                    className="p-1.5 -ml-1 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-yellow-500 to-amber-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                  tb
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                    Pay with Telebirr
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedOrder.planName} · {selectedOrder.amountEtb} ETB / month
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Verification Success Celebration */}
            {verificationResult?.verified ? (
              <div className="py-6 text-center space-y-4 animate-in zoom-in-95">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                    Payment Verified & Activated!
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    {verificationResult.message || 'Your account has been upgraded successfully!'}
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                  💎 {selectedOrder.planName} is now ACTIVE!
                </div>
                <Button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md"
                >
                  Continue to FlowTask
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {errorMsg && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Step 1: Telebirr Transfer Info */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    <span>1. Transfer to Telebirr Account</span>
                    <span className="text-amber-600 font-extrabold">{selectedOrder.amountEtb} ETB</span>
                  </div>

                  {/* Phone */}
                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Phone Number</span>
                      <span className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                        {selectedOrder.telebirrPhone}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedOrder.telebirrPhone, 'phone')}
                      className="px-2.5 py-1 text-xs rounded-lg font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1"
                    >
                      {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'phone' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  {/* Receiver Name */}
                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Receiver Name</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {selectedOrder.telebirrAccountName}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                      Verified
                    </span>
                  </div>

                  {/* Reference Code */}
                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Reference Code (Remark)</span>
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                        {selectedOrder.orderCode}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedOrder.orderCode, 'code')}
                      className="px-2.5 py-1 text-xs rounded-lg font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1"
                    >
                      {copiedField === 'code' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'code' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Step 2: Verification Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                      2. Enter Telebirr TxID
                    </label>
                    <button
                      type="button"
                      onClick={() => setTransactionId('TT777')}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md hover:bg-blue-100 flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Use Test Code (TT777)</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="e.g. 2B7D91X8 or TT777"
                    value={transactionId}
                    onChange={(e) => {
                      setTransactionId(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 rounded-xl text-slate-900 dark:text-white font-mono font-bold text-sm outline-none uppercase tracking-wider"
                  />
                </div>

                <Button
                  type="button"
                  disabled={!transactionId.trim() || verifyMutation.isPending}
                  onClick={() => verifyMutation.mutate()}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-700 hover:to-yellow-600 text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{verifyMutation.isPending ? 'Verifying with Telebirr...' : 'Verify & Activate Plan'}</span>
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* STEP 1: PLAN SELECTION VIEW */
          <div>
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
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
                          variant={p.popular ? 'primary' : 'outline'}
                          onClick={() => createOrderMutation.mutate(p.code)}
                          disabled={createOrderMutation.isPending}
                          className={`w-full text-xs font-bold py-2 rounded-xl ${
                            p.popular
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
        )}
      </div>
    </div>,
    document.body
  );
}
