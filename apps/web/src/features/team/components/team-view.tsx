'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  Search,
  UserPlus,
  X,
} from 'lucide-react';

export function TeamView() {
  const { workspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Fetch Team Members
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getWorkspaceMembers(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: Boolean(workspaceId),
  });

  // Invite Member Mutation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!inviteIdentifier.trim() || !workspaceId) return;
      setInviteError(null);
      const res = await apiClient.inviteWorkspaceMember(workspaceId, {
        username: inviteIdentifier.trim().replace(/^@/, ''),
        role: inviteRole,
      });
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      setInviteIdentifier('');
      setInviteError(null);
      setIsInviteOpen(false);
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      setInviteError(err.message || 'Failed to invite member');
    },
  });

  // Filter Members
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter((m: any) => {
      const nameMatch = m.user?.name?.toLowerCase().includes(q);
      const emailMatch = m.user?.email?.toLowerCase().includes(q);
      const roleMatch = m.role?.toLowerCase().includes(q);
      return nameMatch || emailMatch || roleMatch;
    });
  }, [members, searchQuery]);

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-300">
      {/* 1. Header */}
      <div className="flex items-center justify-between pt-1">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Team
        </h2>
        <span className="text-xs font-semibold text-slate-400">
          {members.length} members
        </span>
      </div>

      {/* 2. Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search team members..."
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* 3. Members List */}
      <div className="space-y-2.5">
        {filteredMembers.map((member: any) => {
          const isOwner = member.role === 'OWNER';
          const isAdmin = member.role === 'ADMIN';
          const memberName = member.user?.name || 'Teammate';
          const username = member.user?.telegramAccount?.username
            ? `@${member.user.telegramAccount.username}`
            : member.user?.email || 'Member';

          return (
            <div
              key={member.id}
              className="bg-white dark:bg-slate-900/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800/80 shadow-xs flex items-center justify-between gap-3"
            >
              {/* Avatar + Info */}
              <div className="flex items-center gap-3 min-w-0">
                {member.user?.avatarUrl ? (
                  <img
                    src={member.user.avatarUrl}
                    alt={memberName}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                    {memberName[0]?.toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {memberName}
                  </h4>
                  <p className="text-[11px] font-medium text-slate-400 truncate">
                    {username}
                  </p>
                </div>
              </div>

              {/* Role Badge */}
              <div className="shrink-0">
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    isOwner
                      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/50'
                      : isAdmin
                      ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200/50'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {isOwner ? 'Owner' : isAdmin ? 'Admin' : 'Member'}
                </span>
              </div>
            </div>
          );
        })}

        {filteredMembers.length === 0 && !isLoading && (
          <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 font-medium">
            No team members found.
          </div>
        )}
      </div>

      {/* 4. Bottom Invite Action Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('medium');
            setIsInviteOpen(true);
          }}
          className="w-full py-3.5 rounded-2xl font-bold text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 hover:bg-blue-100 flex items-center justify-center gap-2 transition-all active:scale-98"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Invite Member</span>
        </button>
      </div>

      {/* Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Invite Teammate</h3>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inviteError && (
              <div className="p-2.5 bg-rose-50 text-rose-700 text-xs rounded-xl font-semibold">
                {inviteError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                inviteMutation.mutate();
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Telegram Username or Phone
                </label>
                <input
                  type="text"
                  value={inviteIdentifier}
                  onChange={(e) => setInviteIdentifier(e.target.value)}
                  placeholder="@username or phone"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium cursor-pointer"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="w-full py-3 rounded-2xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 active:scale-98 transition-all"
                >
                  {inviteMutation.isPending ? 'Sending Invite...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
