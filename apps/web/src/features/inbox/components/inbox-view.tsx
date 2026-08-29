'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { Button } from '@flowtask/ui';
import {
  Send,
  RefreshCw,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export function InboxView() {
  const { workspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  // Fetch Activity
  const { data: activities = [] } = useQuery({
    queryKey: ['activity', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getActivity(workspaceId);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: Boolean(workspaceId),
  });

  // Sync Telegram Group Members
  const syncTelegramMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) return;
      return apiClient.syncTelegramGroup(workspaceId);
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  return (
    <div className="space-y-4 pb-24 animate-in fade-in">
      {/* 1. Telegram Ingestion Highlight Banner */}
      <div className="p-4.5 bg-gradient-to-br from-flow-800 via-flow-700 to-teal-600 text-white rounded-3xl shadow-flow-md space-y-3 relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="flex items-center gap-2 font-bold text-sm text-flow-100">
          <Send className="w-4 h-4" />
          <span>Telegram Integration Active</span>
        </div>
        <p className="text-xs text-white/90 leading-relaxed">
          Forward any message to <span className="font-bold">@flowtaskmanager_bot</span> or reply with <code className="bg-white/20 px-1 py-0.5 rounded text-white font-mono">/task</code> in your Telegram group chats to capture work instantly.
        </p>
        <div className="pt-1 flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => syncTelegramMutation.mutate()}
            disabled={syncTelegramMutation.isPending}
            className="rounded-xl px-3 py-1.5 text-xs bg-white text-flow-800 hover:bg-flow-50 font-bold shadow-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncTelegramMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{syncTelegramMutation.isPending ? 'Syncing...' : 'Sync Telegram Group'}</span>
          </Button>
        </div>
      </div>

      {/* 2. Activity Feed Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-xs font-black text-slate-900 dark:text-white tracking-tight uppercase">
            Workspace Activity Feed
          </span>
          <span className="text-xs font-semibold text-slate-400">
            {activities.length} updates
          </span>
        </div>

        {activities.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
            <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
            <h4 className="font-bold text-xs text-slate-700 dark:text-slate-200">No recent activity</h4>
            <p className="text-[11px] text-slate-400">
              Task changes, completions, and Telegram bot captures will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((act: any) => (
              <div
                key={act.id}
                className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-xl bg-flow-50 dark:bg-flow-950/60 text-flow-600 flex items-center justify-center font-bold shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-snug">
                    <span className="font-bold text-slate-900 dark:text-white">{act.user?.name || 'Teammate'}</span>{' '}
                    {act.action?.toLowerCase() || 'updated'}{' '}
                    <span className="font-semibold text-flow-700 dark:text-flow-400">{act.task?.title || 'task'}</span>
                  </p>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {new Date(act.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
