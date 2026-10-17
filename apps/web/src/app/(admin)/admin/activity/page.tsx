'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  Receipt,
  UserPlus,
  CheckSquare,
  Clock,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { adminClient, PlatformActivityItem } from '../../../../lib/admin-client';

export default function AdminActivityPage() {
  const [events, setEvents] = useState<PlatformActivityItem[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivity = async () => {
    setIsLoading(true);
    try {
      const res = await adminClient.getActivity();
      if (res.data) {
        setEvents(res.data);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, []);

  const filtered = events.filter((e) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'PAYMENTS') return e.type === 'PAYMENT';
    if (filterType === 'SIGNUPS') return e.type === 'USER_SIGNUP';
    if (filterType === 'TASKS') return e.type === 'TASK_CREATED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Live Platform Activity Stream
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time chronological events across users, tasks, and payments on FlowTask.
          </p>
        </div>

        <button
          onClick={fetchActivity}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* 2. Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'ALL', label: 'All Activities' },
          { id: 'PAYMENTS', label: 'Billing & Receipts' },
          { id: 'SIGNUPS', label: 'New Signups' },
          { id: 'TASKS', label: 'Tasks Created' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              filterType === tab.id
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Event List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs p-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
            <span className="text-xs font-semibold">Loading feed...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs font-bold">
            No events found in this category.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {filtered.map((evt) => {
              const isPayment = evt.type === 'PAYMENT';
              const isSignup = evt.type === 'USER_SIGNUP';
              const isTask = evt.type === 'TASK_CREATED';

              return (
                <div key={evt.id} className="relative flex items-start justify-between gap-4">
                  {/* Bullet */}
                  <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] shadow-sm ${
                    isPayment ? 'bg-amber-500' : isSignup ? 'bg-blue-500' : 'bg-emerald-500'
                  }`}>
                    {isPayment ? (
                      <Receipt className="w-3 h-3" />
                    ) : isSignup ? (
                      <UserPlus className="w-3 h-3" />
                    ) : (
                      <CheckSquare className="w-3 h-3" />
                    )}
                  </div>

                  {/* Body */}
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{evt.title}</span>
                      <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${evt.badgeColor}`}>
                        {evt.badge}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {evt.description}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="text-[11px] text-slate-400 font-mono shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
