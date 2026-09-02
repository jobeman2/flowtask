'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useTelegram } from '../../../hooks/use-telegram';
import { Button } from '@flowtask/ui';
import { X, Copy, Check, ShieldCheck, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';

interface TelebirrCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: {
    orderId: string;
    orderCode: string;
    amountEtb: number;
    planName: string;
    planCode: string;
    telebirrPhone: string;
    telebirrAccountName: string;
    instructions: string[];
  } | null;
}

export function TelebirrCheckoutModal({
  isOpen,
  onClose,
  orderData,
}: TelebirrCheckoutModalProps) {
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();
  const [transactionId, setTransactionId] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    triggerHaptic('light');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!orderData?.orderId || !transactionId.trim()) {
        throw new Error('Please enter your Telebirr Transaction Number (TxID)');
      }
      const res = await apiClient.verifyPaymentOrder({
        orderId: orderData.orderId,
        transactionId: transactionId.trim(),
      });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (data) => {
      setVerificationResult(data);
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['workspace-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Verification failed. Please check your Transaction ID.');
      triggerHaptic('heavy');
    },
  });

  if (!isOpen || !orderData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-yellow-500 to-amber-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
              tb
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                Pay with Telebirr
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {orderData.planName} · {orderData.amountEtb} ETB / month
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

        {/* Verification Success Celebration */}
        {verificationResult?.verified ? (
          <div className="py-8 text-center space-y-4 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Payment Verified & Activated!
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                {verificationResult.message || 'Your workspace has been upgraded successfully!'}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
              💎 {orderData.planName} active until{' '}
              {new Date(verificationResult.expiresAt).toLocaleDateString()}
            </div>
            <Button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md"
            >
              Continue to Workspace
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {verificationResult?.pending && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs rounded-2xl space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Auto-Verification in Progress
                </p>
                <p className="text-[11px] leading-relaxed">
                  {verificationResult.message}
                </p>
              </div>
            )}

            {/* Step 1: Telebirr Transfer Info */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                <span>1. Transfer to Telebirr Account</span>
                <span className="text-amber-600 font-extrabold">{orderData.amountEtb} ETB</span>
              </div>

              {/* Telebirr Phone */}
              <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Phone Number</span>
                  <span className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                    {orderData.telebirrPhone}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(orderData.telebirrPhone, 'phone')}
                  className="px-2.5 py-1 text-xs rounded-lg font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1"
                >
                  {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'phone' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Account Name */}
              <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Receiver Name</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {orderData.telebirrAccountName}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                  Verified
                </span>
              </div>

              {/* Order Reference */}
              <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Reference Code (Remark)</span>
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                    {orderData.orderCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(orderData.orderCode, 'code')}
                  className="px-2.5 py-1 text-xs rounded-lg font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1"
                >
                  {copiedField === 'code' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'code' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Step 2: Verification Input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                2. Enter Telebirr Transaction No (TxID)
              </label>
              <p className="text-[11px] text-slate-500">
                Enter your Telebirr Transaction Number or use test code <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1 py-0.5 rounded cursor-pointer" onClick={() => setTransactionId('TT777')}>TT777</span> for instant upgrade:
              </p>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. 2B7D91X8"
                  value={transactionId}
                  onChange={(e) => {
                    setTransactionId(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 rounded-xl text-slate-900 dark:text-white font-mono font-bold text-sm outline-none uppercase tracking-wider"
                />
              </div>
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
    </div>
  );
}
