'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  RefreshCw,
  Users,
  Copy,
  Check,
  Link2,
  Share2,
  UserX,
  ShieldAlert,
} from 'lucide-react';

export function TeamView() {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!workspaceId) return;
      const res = await apiClient.removeWorkspaceMember(workspaceId, memberId);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      setMemberToRemove(null);
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      alert(err.message || 'Failed to remove member');
    },
  });

  // Fetch all workspaces to inspect current workspace telegram link
  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces', user?.id],
    queryFn: async () => {
      const res = await apiClient.getWorkspaces();
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: !!user,
  });

  const currentWorkspace = workspaces.find((w: any) => w.id === workspaceId);

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

  // Sync Telegram Group Mutation
  const syncGroupMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) return;
      setSyncStatus(null);
      const res = await apiClient.syncTelegramGroup(workspaceId);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data) => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      setSyncStatus(data?.message || 'Telegram group members synchronized successfully!');
      setTimeout(() => setSyncStatus(null), 4000);
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      setSyncStatus(err.message || 'Failed to synchronize group members');
      setTimeout(() => setSyncStatus(null), 5000);
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

      {/* Telegram Group Sync Banner if linked */}
      {currentWorkspace?.telegramChat && (
        <div className="bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-900/60 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {currentWorkspace.telegramChat.title || 'Telegram Group'}
              </div>
              <div className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1">
                <span>Group Synced</span>
                <span>•</span>
                <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {canManageMembers && (
            <button
              type="button"
              disabled={syncGroupMutation.isPending}
              onClick={() => {
                triggerHaptic('light');
                syncGroupMutation.mutate();
              }}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all shrink-0 active:scale-95"
            >
              <RefreshCw className={`w-3 h-3 ${syncGroupMutation.isPending ? 'animate-spin' : ''}`} />
              <span>{syncGroupMutation.isPending ? 'Syncing...' : 'Sync Members'}</span>
            </button>
          )}
        </div>
      )}

      {syncStatus && (
        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs font-semibold animate-in fade-in">
          {syncStatus}
        </div>
      )}

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

              {/* Role Badge & Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
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

                {canManageMembers && !isOwner && member.userId !== user?.id && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      setMemberToRemove({ id: member.id, name: memberName });
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Remove from workspace"
                  >
                    <UserX className="w-3.5 h-3.5" />
                  </button>
                )}
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

      {/* 4. Invite Member Bottom Sheet (Portaled to document.body) */}
      {isInviteOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[85dvh] overflow-y-auto">
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

            {/* Direct Bot Link Option */}
            <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-200">
                <Link2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Direct Bot Invite Link</span>
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-snug">
                Share this link so anyone can open the bot and instantly join this workspace.
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    const link = `https://t.me/flowtaskmanager_bot?start=invite_${workspaceId}`;
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(link);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2500);
                    }
                  }}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(`https://t.me/flowtaskmanager_bot?start=invite_${workspaceId}`)}&text=${encodeURIComponent(`Join our workspace team on FlowTask!`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => triggerHaptic('light')}
                  className="py-1.5 px-2.5 rounded-xl bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 font-bold text-xs flex items-center justify-center gap-1 shadow-xs active:scale-95"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">or invite by username</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

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
        </div>,
        document.body
      )}

      {/* Remove Member Confirmation Modal */}
      {memberToRemove && mounted && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-5 h-5" />
              <h4 className="text-sm font-extrabold">Remove Member</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to remove <span className="font-bold text-slate-900 dark:text-white">{memberToRemove.name}</span> from this workspace?
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removeMemberMutation.isPending}
                onClick={() => removeMemberMutation.mutate(memberToRemove.id)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-xs"
              >
                {removeMemberMutation.isPending ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
