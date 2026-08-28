'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { Button } from '@flowtask/ui';
import {
  Users,
  UserPlus,
  Shield,
  UserCheck,
  Trash2,
  X,
  Send,
  AtSign,
  Check,
  Sparkles,
} from 'lucide-react';

export function TeamView() {
  const { workspaceId, user: currentUser } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch Workspace Members
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getWorkspaceMembers(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: !!workspaceId,
  });

  // Invite Member Mutation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !inviteInput.trim()) {
        throw new Error('Please enter a username or email');
      }
      setErrorMsg(null);
      setSuccessMsg(null);

      const isEmail = inviteInput.includes('@') && inviteInput.includes('.');
      const isTg = inviteInput.startsWith('@') || !isEmail;

      const res = await apiClient.inviteWorkspaceMember(workspaceId, {
        username: isTg ? inviteInput.replace(/^@/, '').trim() : undefined,
        email: isEmail ? inviteInput.trim() : undefined,
        name: nameInput.trim() || undefined,
        role: selectedRole,
      });

      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      setSuccessMsg('Teammate added to workspace successfully!');
      setInviteInput('');
      setNameInput('');
      setTimeout(() => {
        setIsInviteOpen(false);
        setSuccessMsg(null);
      }, 1200);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to invite member');
      triggerHaptic('heavy');
    },
  });

  // Remove Member Mutation
  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!workspaceId) return;
      const res = await apiClient.removeWorkspaceMember(workspaceId, memberId);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      triggerHaptic('light');
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
  });

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Team Workspace Members</span>
          </h2>
          <p className="text-xs text-slate-500">
            Collaborate, assign tasks, and track team progress
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            triggerHaptic('light');
            setIsInviteOpen(true);
          }}
          className="rounded-xl text-xs flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Member</span>
        </Button>
      </div>

      {/* Inline Invite Modal */}
      {isInviteOpen && (
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              Invite Teammate
            </h4>
            <button
              onClick={() => setIsInviteOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl font-medium flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              {successMsg}
            </div>
          )}

          <div className="space-y-2">
            <div className="relative">
              <AtSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="Telegram @username or email (e.g. @samuel_dev)"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <input
              type="text"
              placeholder="Display Name (optional)"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
            />

            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-slate-500 font-medium">Role:</span>
              <div className="flex gap-1.5">
                {(['MEMBER', 'ADMIN'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRole(r)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                      selectedRole === r
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsInviteOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!inviteInput.trim() || inviteMutation.isPending}
              onClick={() => inviteMutation.mutate()}
              className="rounded-xl text-xs bg-blue-600 text-white font-bold flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{inviteMutation.isPending ? 'Adding...' : 'Add Teammate'}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Members List */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading team members...</div>
      ) : members.length === 0 ? (
        <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No teammates yet</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Add team members to delegate tasks and collaborate across Telegram.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {members.map((m: any) => {
            const memberUser = m.user || { name: 'Teammate', id: m.userId };
            const isOwner = m.role === 'OWNER';
            const isAdmin = m.role === 'ADMIN';
            const isSelf = memberUser.id === currentUser?.id;

            return (
              <div
                key={m.id || m.userId}
                className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                    {memberUser.name?.slice(0, 2).toUpperCase() || 'TM'}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {memberUser.name}
                      </h4>
                      {isSelf && (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold px-1.5 py-0.2 rounded-md">
                          You
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 truncate">
                      {memberUser.email || (memberUser.telegramAccounts?.[0]?.username ? `@${memberUser.telegramAccounts[0].username}` : 'Team Member')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-xl uppercase tracking-wider ${
                      isOwner
                        ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        : isAdmin
                        ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isOwner ? (
                      <Shield className="w-3 h-3 text-amber-500" />
                    ) : (
                      <UserCheck className="w-3 h-3 text-purple-500" />
                    )}
                    {m.role}
                  </span>

                  {!isOwner && !isSelf && (
                    <button
                      onClick={() => removeMutation.mutate(m.id || m.userId)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                      title="Remove member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
