'use client';

import React, { useEffect, useState } from 'react';
import {
  LineChart,
  TrendingUp,
  Cpu,
  Bot,
  Users,
  CheckCircle2,
  DollarSign,
  Briefcase,
  Layers,
  RefreshCw,
  Award,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { adminClient, AdminAnalytics } from '../../../../lib/admin-client';

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'USERS' | 'REVENUE'>('USERS');

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await adminClient.getAnalytics();
      if (res.data) {
        setData(res.data);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-2" />
      </div>
    );
  }

  // Find max value in timeline for scaling bar heights
  const maxUserSignup = Math.max(...(data?.growthTrend?.map((d) => d.users) || [1]), 1);
  const maxRevenue = Math.max(...(data?.growthTrend?.map((d) => d.revenueEtb) || [1]), 1);

  const totalTasks = Object.values(data?.tasksByStatus || {}).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-8">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Platform Analytics & Health
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Deep performance telemetry, user acquisition curves, and Telegram bot server metrics.
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* 2. System & Bot Health Bar */}
      {data?.systemHealth && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-900/90 to-slate-900 text-white border border-blue-800 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-400/30 shrink-0">
                <Bot className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">Telegram Bot Worker</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    ONLINE ({data.systemHealth.botMode})
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Listening to all connected Telegram groups & commands
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono">
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                <span className="block text-[10px] text-slate-400 uppercase font-sans">Uptime</span>
                <span className="font-bold text-white">{data.systemHealth.uptime}</span>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                <span className="block text-[10px] text-slate-400 uppercase font-sans">RAM Usage</span>
                <span className="font-bold text-white">{data.systemHealth.heapUsedMb} MB / {data.systemHealth.heapTotalMb} MB</span>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 col-span-2 sm:col-span-1">
                <span className="block text-[10px] text-slate-400 uppercase font-sans">Connected Groups</span>
                <span className="font-bold text-white">{data.systemHealth.connectedTelegramGroupsCount} Boards</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. 14-Day Growth Timeline Chart */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              14-Day Platform Trajectory
            </h3>
            <p className="text-xs text-slate-500">
              Daily customer velocity and revenue intake over the past two weeks.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('USERS')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'USERS'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Signups Curve
            </button>
            <button
              onClick={() => setActiveTab('REVENUE')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'REVENUE'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Revenue Intake (ETB)
            </button>
          </div>
        </div>

        {/* Visual Bar Chart */}
        <div className="h-56 flex items-end gap-2 sm:gap-4 pt-8 pb-2 border-b border-slate-100 dark:border-slate-800">
          {data?.growthTrend?.map((item) => {
            const val = activeTab === 'USERS' ? item.users : item.revenueEtb;
            const max = activeTab === 'USERS' ? maxUserSignup : maxRevenue;
            const heightPercent = Math.max(12, Math.round((val / max) * 100));

            return (
              <div
                key={item.date}
                className="flex-1 flex flex-col items-center h-full justify-end group relative"
              >
                {/* Tooltip on hover */}
                <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-mono py-1 px-2 rounded pointer-events-none whitespace-nowrap z-20 shadow-lg">
                  {item.date}: {val} {activeTab === 'REVENUE' ? 'ETB' : 'users'}
                </div>

                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t-lg transition-all ${
                    activeTab === 'USERS'
                      ? 'bg-blue-600 group-hover:bg-blue-500'
                      : 'bg-emerald-600 group-hover:bg-emerald-500'
                  }`}
                />
                <span className="text-[10px] font-mono text-slate-400 mt-2 rotate-45 sm:rotate-0 origin-left truncate max-w-[32px] sm:max-w-none">
                  {item.date.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Task Distribution & Priority Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Task Status Distribution */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Tasks by Status
            </h3>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="space-y-3">
            {Object.entries(data?.tasksByStatus || {}).map(([status, count]) => {
              const pct = Math.round((count / totalTasks) * 100);
              return (
                <div key={status} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{status}</span>
                    <span className="text-slate-500 font-mono">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full ${
                        status === 'DONE'
                          ? 'bg-emerald-500'
                          : status === 'IN_PROGRESS'
                          ? 'bg-blue-500'
                          : status === 'URGENT'
                          ? 'bg-rose-500'
                          : 'bg-slate-400'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Task Priority Distribution */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Tasks by Priority
            </h3>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>

          <div className="space-y-3">
            {Object.entries(data?.tasksByPriority || {}).map(([priority, count]) => {
              const pct = Math.round((count / totalTasks) * 100);
              return (
                <div key={priority} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{priority}</span>
                    <span className="text-slate-500 font-mono">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full ${
                        priority === 'URGENT'
                          ? 'bg-rose-500'
                          : priority === 'HIGH'
                          ? 'bg-amber-500'
                          : priority === 'MEDIUM'
                          ? 'bg-blue-500'
                          : 'bg-slate-400'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Top Workspaces and Power Users Ranking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Most Active Workspaces */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Top 5 Active Workspaces
            </h3>
            <Briefcase className="w-4 h-4 text-indigo-600" />
          </div>

          <div className="space-y-2.5">
            {data?.topWorkspaces?.map((ws, i) => (
              <div
                key={ws.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center font-bold text-[11px]">
                    #{i + 1}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {ws.name}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {ws.telegramGroup ? `Linked: ${ws.telegramGroup}` : 'No group'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {ws.tasksCount} tasks
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    {ws.membersCount} members
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Task Creators */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Top 5 Power Creators
            </h3>
            <Award className="w-4 h-4 text-amber-500" />
          </div>

          <div className="space-y-2.5">
            {data?.topCreators?.map((u, i) => (
              <div
                key={u.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center font-bold text-[11px]">
                    #{i + 1}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {u.name}
                    </span>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-mono">
                      {u.telegram || u.email || 'Telegram User'}
                    </span>
                  </div>
                </div>

                <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {u.tasksCount} created
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
