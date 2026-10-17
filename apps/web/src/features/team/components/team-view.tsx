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
  Building2,
  Plus,
  Send,
  Settings,
} from 'lucide-react';
import { ManageWorkspaceModal } from '../../workspaces/components/manage-workspace-modal';

export function TeamView() {
  const { workspaceId, setWorkspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'WORKSPACES'>('MEMBERS');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);

  // Invite History for 1-tap easy inviting
  const [inviteHistory, setInviteHistory] = useState<Array<{ name: string; username: string }>>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(`flowtask_invite_history_${user?.id}`);
      if (saved) setInviteHistory(JSON.parse(saved));
    } catch {}
  }, [user?.id]);

  const saveToInviteHistory = (rawIdentifier: string) => {
    if (typeof window === 'undefined') return;
    try {
      const clean = rawIdentifier.replace(/^@/, '').trim();
      if (!clean) return;
      setInviteHistory((prev) => {
        const updated = [
          { name: `@${clean}`, username: clean },
          ...prev.filter((i) => i.username.toLowerCase() !== clean.toLowerCase()),
        ].slice(0, 8);
        try {
          localStorage.setItem(`flowtask_invite_history_${user?.id}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    } catch {}
  };

  // Workspaces Management State
  const [isCreatingWs, setIsCreatingWs] = useState(false);
  const [createWsMode, setCreateWsMode] = useState<'STANDARD' | 'TELEGRAM'>('STANDARD');
  const [linkTargetOption, setLinkTargetOption] = useState<'CURRENT' | 'NEW'>('CURRENT');
  const [newWsName, setNewWsName] = useState('');
  const [newWsType, setNewWsType] = useState<'TEAM' | 'PERSONAL'>('TEAM');
  const [telegramInput, setTelegramInput] = useState('');
  const [createWsError, setCreateWsError] = useState<string | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

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
  const tgWorkspaces = useMemo(() => workspaces.filter((w: any) => Boolean(w.telegramChat)), [workspaces]);
  const otherWorkspaces = useMemo(() => workspaces.filter((w: any) => !w.telegramChat), [workspaces]);

  // Create Workspace Mutation
  const createWsMutation = useMutation({
    mutationFn: async () => {
      if (!newWsName.trim()) return;
      setCreateWsError(null);
      const res = await apiClient.createWorkspace(newWsName.trim(), newWsType);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (newWs) => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      if (newWs?.id) {
        setWorkspaceId(newWs.id);
      }
      setNewWsName('');
      setCreateWsError(null);
      setIsCreatingWs(false);
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      setCreateWsError(err.message || 'Failed to create workspace');
    },
  });

  // Connect Telegram Group Mutation
  const connectTgMutation = useMutation({
    mutationFn: async () => {
      if (!telegramInput.trim()) return;
      setCreateWsError(null);
      const targetWsId = linkTargetOption === 'CURRENT' && workspaceId ? workspaceId : undefined;
      const res = await apiClient.connectTelegramGroup(telegramInput.trim(), targetWsId);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data) => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      if (data?.workspaceId) {
        setWorkspaceId(data.workspaceId);
      }
      setTelegramInput('');
      setCreateWsError(null);
      setIsCreatingWs(false);
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      setCreateWsError(err.message || 'Failed to connect Telegram group');
    },
  });

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

  // Invite Member Mutation (supports single or multiple usernames)
  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!inviteIdentifier.trim() || !workspaceId) return;
      setInviteError(null);

      const rawUsernames = inviteIdentifier
        .split(/[\s,]+/)
        .map((u) => u.trim().replace(/^@/, ''))
        .filter(Boolean);

      if (rawUsernames.length === 0) return;

      const results = await Promise.allSettled(
        rawUsernames.map((username) =>
          apiClient.inviteWorkspaceMember(workspaceId, {
            username,
            role: inviteRole,
          })
        )
      );

      const successfulUsernames: string[] = [];
      const failedUsernames: { username: string; error: string }[] = [];

      results.forEach((res, idx) => {
        const username = rawUsernames[idx];
        if (res.status === 'fulfilled' && !res.value.error) {
          successfulUsernames.push(username);
        } else {
          const err = res.status === 'fulfilled' ? res.value.error : (res.reason?.message || 'Failed');
          failedUsernames.push({ username, error: err || 'Failed' });
        }
      });

      if (successfulUsernames.length === 0 && failedUsernames.length > 0) {
        throw new Error(failedUsernames.map((f) => `@${f.username}: ${f.error}`).join('\n'));
      }

      return { successfulUsernames, failedUsernames };
    },
    onSuccess: (data) => {
      triggerHaptic('medium');
      if (data?.successfulUsernames) {
        data.successfulUsernames.forEach((u) => saveToInviteHistory(u));
      }
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      setInviteIdentifier('');
      setInviteError(null);
      setIsInviteOpen(false);

      if (data?.failedUsernames && data.failedUsernames.length > 0) {
        setSyncStatus(
          `Invited ${data.successfulUsernames.length} members. Failed: ${data.failedUsernames.map((f) => `@${f.username}`).join(', ')}`
        );
        setTimeout(() => setSyncStatus(null), 6000);
      }
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      setInviteError(err.message || 'Failed to invite members');
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
      {/* 1. View Mode Switcher: Team Members vs Workspaces & Groups */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 w-full">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('MEMBERS');
          }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all text-center ${
            activeTab === 'MEMBERS'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          Members ({members.length + 1})
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('WORKSPACES');
          }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all text-center ${
            activeTab === 'WORKSPACES'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          Workspaces ({workspaces.length})
        </button>
      </div>


      {/* TAB 1: TEAM MEMBERS */}
      {activeTab === 'MEMBERS' && (
        <div className="space-y-4">
          {/* Header with Invite Action */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Team Members
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {currentWorkspace?.name || 'Current Workspace'} — {members.length + 1} members
              </p>
            </div>
            {canManageMembers && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsInviteOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs active:scale-95 transition-all shrink-0"
              >
                <UserPlus className="w-3 h-3" />
                <span>Invite</span>
              </button>
            )}
          </div>

          {/* Telegram Group Sync Banner if linked */}
          {currentWorkspace?.telegramChat && (
            <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
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


          {/* Search Bar */}
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

          {/* Members List */}
          <div className="space-y-2.5">
            {/* 🤖 Permanent Virtual AI Copilot Member */}
            <div className="bg-gradient-to-r from-blue-50/80 via-sky-50/60 to-indigo-50/60 dark:from-blue-950/40 dark:via-sky-950/30 dark:to-indigo-950/30 rounded-2xl p-3.5 border border-blue-200/80 dark:border-blue-800/60 shadow-xs flex items-center justify-between gap-3 hover:border-blue-300 dark:hover:border-blue-700 transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 via-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/25">
                    <Bot className="w-5 h-5" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      Flow AI
                    </h4>
                    <Sparkles className="w-3.5 h-3.5 text-blue-500 fill-blue-500/30 animate-pulse" />
                  </div>
                  <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 truncate">
                    @flowtaskmanager_bot • Autonomous PM
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-xs flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-sky-200" />
                  <span>AI Copilot</span>
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
                        {memberName?.[0]?.toUpperCase() || 'U'}
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
        </div>
      )}

      {/* TAB 2: WORKSPACES & GROUPS MANAGEMENT */}
      {activeTab === 'WORKSPACES' && (
        <div className="space-y-4">
          {/* Header with Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Workspaces
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Teams & connected Telegram groups
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setCreateWsMode('STANDARD');
                  setCreateWsError(null);
                  setIsCreatingWs(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-all active:scale-95"
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setCreateWsMode('TELEGRAM');
                  setCreateWsError(null);
                  setIsCreatingWs(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 font-bold text-[11px] flex items-center gap-1 transition-all active:scale-95"
              >
                <Send className="w-3 h-3" />
                <span>Link Group</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Summary Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800/80 shadow-xs">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                <Building2 className="w-3 h-3 text-blue-500" />
                <span>Active Board</span>
              </div>
              <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                {currentWorkspace?.name || 'Workspace'}
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Currently active</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800/80 shadow-xs">
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                <Users className="w-3 h-3 text-blue-500" />
                <span>Total Teams</span>
              </div>
              <div className="text-base font-black text-slate-900 dark:text-white leading-none">
                {workspaces.length}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold mt-1">
                {tgWorkspaces.length} Telegram • {otherWorkspaces.length} standard
              </div>
            </div>
          </div>

          {/* Workspaces List */}
          <div className="space-y-2.5">
            {workspaces.map((ws: any) => {
              const isCurrent = ws.id === workspaceId;
              const hasTelegram = Boolean(ws.telegramChat);
              const memberCount = ws._count?.members || ws.members?.length || (isCurrent ? members.length : 1);
              const taskCount = ws.taskCount ?? ws._count?.tasks ?? 0;
              const isOwner = ws.ownerId === user?.id;

              return (
                <div
                  key={ws.id}
                  onClick={() => {
                    if (!isCurrent) {
                      triggerHaptic('medium');
                      setWorkspaceId(ws.id);
                    }
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                    isCurrent
                      ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/80 shadow-[0_2px_12px_-2px_rgba(59,130,246,0.15)]'
                      : 'bg-white dark:bg-slate-900/90 border-slate-100 dark:border-slate-800/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs shadow-xs ${
                          hasTelegram
                            ? 'bg-blue-500 text-white'
                            : isCurrent
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {hasTelegram ? <Users className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {ws.name}
                          </h4>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                          {hasTelegram && (
                            <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-0.5">
                              <span>Telegram: {ws.telegramChat?.title || ws.name || 'Group'}</span>
                            </span>
                          )}
                          <span>•</span>
                          <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span className="text-slate-500 dark:text-slate-400 font-medium">
                            {taskCount} task{taskCount !== 1 ? 's' : ''}
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            {isOwner ? 'Owner' : 'Member'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {isCurrent ? (
                        <>
                          <div className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold flex items-center gap-1 border border-emerald-200 dark:border-emerald-800/60">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Active</span>
                          </div>
                          {canManageMembers && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerHaptic('light');
                                setIsManageModalOpen(true);
                              }}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Workspace Settings"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {taskCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[10px] font-bold border border-blue-100 dark:border-blue-900/40">
                              {taskCount}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('medium');
                              setWorkspaceId(ws.id);
                            }}
                            className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-300 text-[10px] font-bold transition-all"
                          >
                            Switch
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Invite Member Bottom Sheet (Portaled to document.body) */}
      {isInviteOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-3xl p-5 shadow-2xl border border-slate-200/60 dark:border-slate-800 space-y-4 max-h-[88dvh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))]">
            {/* Top Handle Indicator */}
            <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto -mt-1 mb-2 shrink-0" />

            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-blue-600 via-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-blue-500/20 shrink-0">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white leading-none">
                    Invite Teammate
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium pt-0.5">
                    Add members to current workspace
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
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
                placeholder="@username or multiple (e.g. @alice @bob, @carol)"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 font-medium"
              />
              <p className="text-[10px] text-slate-400 font-medium">
                Tip: Enter multiple usernames separated by spaces or commas to invite them all at once.
              </p>

              {/* 1-Tap Recent Collaborators */}
              {inviteHistory.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Recent Collaborators
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {inviteHistory.map((item) => (
                      <button
                        key={item.username}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setInviteIdentifier((prev) => (prev ? `${prev} @${item.username}` : `@${item.username}`));
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/60 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200/60 dark:border-slate-700/60 active:scale-95"
                      >
                        <UserPlus className="w-3 h-3 text-blue-500" />
                        <span>@{item.username}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
              {inviteMutation.isPending ? 'Sending Invites...' : 'Send Telegram Invite(s)'}
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

      {/* 5. Create Workspace / Connect Telegram Group Modal */}
      {isCreatingWs && mounted && createPortal(
        <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-3xl p-5 shadow-2xl border border-slate-200/60 dark:border-slate-800 space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))]">
            {/* Top Handle Indicator */}
            <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto -mt-1 mb-2 shrink-0" />

            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-blue-600 via-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-blue-500/20 shrink-0">
                  {createWsMode === 'TELEGRAM' ? <Users className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white leading-none">
                    {createWsMode === 'TELEGRAM' ? 'Connect Telegram Group' : 'Create Workspace'}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium pt-0.5">
                    {createWsMode === 'TELEGRAM' ? 'Sync team chat & tasks' : 'New team collaboration board'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingWs(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setCreateWsMode('STANDARD');
                  setCreateWsError(null);
                }}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  createWsMode === 'STANDARD'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Standard Workspace
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateWsMode('TELEGRAM');
                  setCreateWsError(null);
                }}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  createWsMode === 'TELEGRAM'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Telegram Group
              </button>
            </div>

            {createWsError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-medium">
                {createWsError}
              </div>
            )}

            {createWsMode === 'STANDARD' ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                    placeholder="e.g. Marketing Team, Operations"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewWsType('TEAM')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        newWsType === 'TEAM'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Team
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewWsType('PERSONAL')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        newWsType === 'PERSONAL'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Personal
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={createWsMutation.isPending || !newWsName.trim()}
                  onClick={() => createWsMutation.mutate()}
                  className="w-full py-2.5 rounded-2xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-98 transition-all disabled:opacity-50"
                >
                  {createWsMutation.isPending ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Linking Target
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLinkTargetOption('CURRENT')}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all truncate text-center ${
                        linkTargetOption === 'CURRENT'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Link Current
                    </button>
                    <button
                      type="button"
                      onClick={() => setLinkTargetOption('NEW')}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all truncate text-center ${
                        linkTargetOption === 'NEW'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Create New
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 pt-0.5">
                    {linkTargetOption === 'CURRENT'
                      ? `Links this Telegram group directly to "${currentWorkspace?.name || 'Current Workspace'}".`
                      : 'Creates a brand new workspace for this Telegram group.'}
                  </p>
                </div>

                {/* Option 1: 1-Tap Add Bot & Auto-Connect */}
                <a
                  href={`https://t.me/flowtaskmanager_bot?startgroup=link_${currentWorkspace?.id || ''}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-3 rounded-2xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 text-center"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>➕ Add Bot to Group (Auto-connects)</span>
                </a>

                <div className="flex items-center gap-2 pt-0.5 pb-0.5">
                  <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Or link existing group</span>
                  <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Public Group Link or Chat ID
                  </label>
                  <input
                    type="text"
                    value={telegramInput}
                    onChange={(e) => setTelegramInput(e.target.value)}
                    placeholder="e.g. @your_group or https://t.me/your_group"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium"
                  />
                  {(telegramInput.includes('+') || telegramInput.includes('joinchat')) ? (
                    <p className="text-[10px] text-amber-500 font-medium pt-0.5">
                      ⚠️ Private invite links cannot be queried directly. Simply send <code className="font-bold">/link</code> in your group to connect it in 1 tap!
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 pt-0.5">
                      💡 Tip: If you already added the bot, just send <code className="font-bold text-blue-500">/link</code> inside your Telegram group!
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={connectTgMutation.isPending || !telegramInput.trim()}
                  onClick={() => connectTgMutation.mutate()}
                  className="w-full py-2.5 rounded-2xl font-bold text-xs text-white bg-sky-500 hover:bg-sky-600 shadow-md shadow-sky-500/20 active:scale-98 transition-all disabled:opacity-50"
                >
                  {connectTgMutation.isPending ? 'Connecting...' : 'Connect Group'}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 6. Manage Workspace Settings Modal */}
      <ManageWorkspaceModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
      />
    </div>
  );
}
