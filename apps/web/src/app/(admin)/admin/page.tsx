'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Briefcase,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Receipt,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Layers,
  Sparkles,
} from 'lucide-react';
import { adminClient, AdminMetrics } from '../../../lib/admin-client';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminClient.getMetrics();
      if (res.data) {
        setMetrics(res.data);
      } else {
        setError(res.error || 'Failed to load metrics');
      }
    } catch (err: any) {
      setError(err.message || 'Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
        <button
          onClick={fetchMetrics}
          className="mt-4 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const pendingCount = metrics?.financials?.pendingReceiptsCount || 0;

  return (
    <div className="space-y-8">
      {/* 1. Header Banner & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Platform Master Console
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time telemetry, user adoption, Telegram group integrations, and revenue oversight.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchMetrics}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Refresh</span>
          </button>

          <Link
            href="/admin/receipts"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition-colors shadow-sm shadow-blue-600/30"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Review Receipts</span>
          </Link>
        </div>
      </div>

      {/* 2. Pending Bank Receipt Alert (if any) */}
      {pendingCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                {pendingCount} Pending Bank Transfer Receipt{pendingCount > 1 ? 's' : ''} Awaiting Review
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Users have uploaded CBE / Awash / Telebirr payment screenshots for plan activation.
              </div>
            </div>
          </div>

          <Link
            href="/admin/receipts"
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm shadow-amber-600/30"
          >
            <span>Review Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* 3. Four Core Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Users */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Users
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {metrics?.users?.total?.toLocaleString() ?? 0}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                +{metrics?.users?.todaySignups ?? 0} today
              </span>
              <span>•</span>
              <span>+{metrics?.users?.weeklySignups ?? 0} this week</span>
            </div>
          </div>
        </div>

        {/* Card 2: Workspaces & Groups */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Workspaces & Groups
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {metrics?.workspaces?.total?.toLocaleString() ?? 0}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {metrics?.workspaces?.connectedTelegramGroups ?? 0}
              </span>
              <span>Telegram groups linked</span>
            </div>
          </div>
        </div>

        {/* Card 3: Platform Tasks */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Platform Tasks
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {metrics?.tasks?.total?.toLocaleString() ?? 0}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {metrics?.tasks?.completionRate ?? '0%'}
              </span>
              <span>completion rate ({metrics?.tasks?.completed ?? 0} done)</span>
            </div>
          </div>
        </div>

        {/* Card 4: Financials */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Revenue
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {metrics?.financials?.totalRevenueEtb?.toLocaleString() ?? 0}{' '}
              <span className="text-base font-bold text-slate-400">ETB</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {metrics?.financials?.verifiedOrdersCount ?? 0} orders
              </span>
              <span>•</span>
              <span>{metrics?.financials?.paidSubscribers ?? 0} active subs</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Subscriptions Breakdown & Quick Navigation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription Plans Breakdown */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Subscription Plan Mix
            </h3>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Pro Plan (199 ETB/mo)
                </span>
              </div>
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {metrics?.financials?.proSubscriptions ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-indigo-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Team Collaboration (999 ETB/mo)
                </span>
              </div>
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {metrics?.financials?.teamSubscriptions ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-slate-400" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Starter (Free)
                </span>
              </div>
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {(metrics?.workspaces?.total ?? 0) - (metrics?.financials?.paidSubscribers ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Management Actions */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Platform Controls & Shortcuts
            </h3>
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/admin/receipts"
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center font-bold text-xs">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {pendingCount} Pending
                  </span>
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white mt-3">
                  Bank Screenshot Approval
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Inspect user bank receipts (CBE, Awash, Telebirr) with 1-click Approve or Reject.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:gap-2 transition-all">
                <span>Open Approval Queue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            <Link
              href="/admin/workspaces"
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center font-bold text-xs">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {metrics?.workspaces?.total ?? 0} Workspaces
                  </span>
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white mt-3">
                  Workspace Plan Overrides
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Promote or grant Free / Pro / Team access directly to any workspace or client.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:gap-2 transition-all">
                <span>Manage Workspaces</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
