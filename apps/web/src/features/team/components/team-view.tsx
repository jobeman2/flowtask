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
  Bot,
  Sparkles,
} from 'lucide-react';

export function TeamView() {
  const { workspaceId, user } = useAuth();
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

  // Determine current user's role in this workspace
  const currentMember = members.find((m: any) => m.userId === user?.id);
  const currentRole = currentMember?.role || 'MEMBER';
  const canManageMembers = currentRole === 'OWNER' || currentRole === 'ADMIN';

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
      const name = m.user?.name?.toLowerCase() || '';
      const username = m.user?.telegramAccount?.username?.toLowerCase() || '';
      return name.includes(q) || username.includes(q);
    });
  }, [members, searchQuery]);

  return (
    <div className="space-y-4 pb-24 font-sans animate-in fade-in duration-300">
      {/* 1. Header with Invite Action */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Workspace Team
          </h3>
          <p className="text-xs text-slate-400 font-medium">
            Manage teammates, roles & AI copilot
          </p>
        </div>
        {canManageMembers && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setIsInviteOpen(true);
          }}
          className="p-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition-all"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Invite</span>
        </button>
        )}
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-slate-400">
          {members.length + 1} active members
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
        {/* 🤖 Permanent Virtual AI Copilot Member */}
        <div className="bg-gradient-to-r from-purple-50/70 via-indigo-50/50 to-pink-50/50 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-pink-950/20 rounded-2xl p-3.5 border border-purple-200/80 dark:border-purple-800/60 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 text-white flex items-center justify-center font-bold shadow-md shadow-purple-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                  Flow AI
                </h4>
                <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
              </div>
              <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 truncate">
                @flowtaskmanager_bot • Autonomous PM
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs">
              AI Copilot
            </span>
          </div>
        </div>

        {/* Human Team Members */}
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

      {/* 4. Invite Member Bottom Sheet */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Invite Teammate
                </h3>
              </div>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inviteError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-semibold">
                {inviteError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                Telegram @username or Email
              </label>
              <input
                type="text"
                value={inviteIdentifier}
                onChange={(e) => setInviteIdentifier(e.target.value)}
                placeholder="@username (e.g. @john_doe)"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                Member Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInviteRole('MEMBER')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    inviteRole === 'MEMBER'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Member
                </button>
                <button
                  type="button"
                  onClick={() => setInviteRole('ADMIN')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    inviteRole === 'ADMIN'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={inviteMutation.isPending || !inviteIdentifier.trim()}
              onClick={() => inviteMutation.mutate()}
              className="w-full py-3 rounded-2xl font-extrabold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {inviteMutation.isPending ? 'Sending Invite...' : 'Send Telegram Invite'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
