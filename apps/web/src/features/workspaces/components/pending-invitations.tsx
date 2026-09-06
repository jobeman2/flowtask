'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { Check, X, Users } from 'lucide-react';

export function PendingInvitationsBanner() {
  const { user, selectWorkspace } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const { data: invitations = [] } = useQuery({
    queryKey: ['pending-invitations', user?.id],
    queryFn: async () => {
      const res = await apiClient.getPendingInvitations();
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  const acceptMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await apiClient.acceptInvitation(invitationId);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data) => {
      triggerHaptic('success');
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      if (data?.workspace?.id) {
        selectWorkspace(data.workspace.id);
      }
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      alert(err.message || 'Failed to accept invitation');
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await apiClient.declineInvitation(invitationId);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['pending-invitations'] });
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      alert(err.message || 'Failed to decline invitation');
    },
  });

  if (!invitations || invitations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mb-2">
      {invitations.map((inv: any) => (
        <div
          key={inv.id}
          className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200/90 dark:border-blue-800/80 rounded-2xl shadow-sm flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                    {inv.workspace?.name || 'Workspace'}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                    {inv.role}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Invited by <strong className="font-semibold text-slate-700 dark:text-slate-300">{inv.inviter?.name || 'Teammate'}</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              disabled={acceptMutation.isPending || declineMutation.isPending}
              onClick={() => {
                triggerHaptic('light');
                acceptMutation.mutate(inv.id);
              }}
              className="flex-1 py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{acceptMutation.isPending ? 'Joining...' : 'Accept & Join'}</span>
            </button>

            <button
              type="button"
              disabled={acceptMutation.isPending || declineMutation.isPending}
              onClick={() => {
                triggerHaptic('light');
                declineMutation.mutate(inv.id);
              }}
              className="py-1.5 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
            >
              <X className="w-3.5 h-3.5" />
              <span>Decline</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
