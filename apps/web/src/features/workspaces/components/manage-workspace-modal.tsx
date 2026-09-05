'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  X,
  Building2,
  Trash2,
  LogOut,
  UserX,
  Crown,
  ShieldAlert,
  AlertTriangle,
  Users,
  Send,
  CheckCircle2,
} from 'lucide-react';

interface ManageWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ManageWorkspaceModal({ isOpen, onClose }: ManageWorkspaceModalProps) {
  const { user, workspaceId, setWorkspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'DANGER'>('MEMBERS');
  const [inviteInput, setInviteInput] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'DELETE' | 'LEAVE' | 'REMOVE_MEMBER';
    memberId?: string;
    memberName?: string;
  } | null>(null);

  // Fetch workspaces
  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces', user?.id],
    queryFn: async () => {
      const res = await apiClient.getWorkspaces();
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: !!user,
  });

  const currentWorkspace = workspaces.find((w: any) => w.id === workspaceId);

  // Fetch members
  const { data: members = [] } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getWorkspaceMembers(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: Boolean(workspaceId),
  });

  const currentMember = members.find((m: any) => m.userId === user?.id);
  const isOwner = currentWorkspace?.ownerId === user?.id || currentMember?.role === 'OWNER';
  const isAdmin = currentMember?.role === 'ADMIN' || isOwner;

  // Invite Mutation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!inviteInput.trim() || !workspaceId) return;
      setErrorMsg(null);
      setInviteSuccess(null);
      const cleanUsername = inviteInput.trim().replace(/^@/, '');
      const res = await apiClient.inviteWorkspaceMember(workspaceId, {
        username: cleanUsername,
        role: 'MEMBER',
      });
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      setInviteSuccess(`Invited @${inviteInput.trim().replace(/^@/, '')}!`);
      setInviteInput('');
      setTimeout(() => setInviteSuccess(null), 3000);
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      setErrorMsg(err.message || 'Failed to invite member');
    },
  });

  // Remove Member Mutation
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
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setConfirmAction(null);
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      setErrorMsg(err.message || 'Failed to remove member');
    },
  });

  // Leave Workspace Mutation
  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) return;
      const res = await apiClient.leaveWorkspace(workspaceId);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      triggerHaptic('heavy');
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      const remaining = workspaces.filter((w: any) => w.id !== workspaceId);
      if (remaining.length > 0) {
        setWorkspaceId(remaining[0].id);
      }
      setConfirmAction(null);
      onClose();
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      setErrorMsg(err.message || 'Failed to leave workspace');
    },
  });

  // Delete Workspace Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) return;
      const res = await apiClient.deleteWorkspace(workspaceId);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      triggerHaptic('heavy');
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      const remaining = workspaces.filter((w: any) => w.id !== workspaceId);
      if (remaining.length > 0) {
        setWorkspaceId(remaining[0].id);
      }
      setConfirmAction(null);
      onClose();
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      setErrorMsg(err.message || 'Failed to delete workspace');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in font-sans">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[88vh] overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate max-w-[200px]">
                {currentWorkspace?.name || 'Workspace'}
              </h3>
              <p className="text-[10px] font-semibold text-slate-400">
                {currentWorkspace?.telegramChat ? 'Telegram Group Board' : 'Team Workspace'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('MEMBERS');
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'MEMBERS'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Members ({members.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('DANGER');
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'DANGER'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Workspace Actions</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs rounded-2xl font-semibold">
            {errorMsg}
          </div>
        )}

        {inviteSuccess && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs rounded-2xl font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>{inviteSuccess}</span>
          </div>
        )}

        {/* Tab 1: Members Management */}
        {activeTab === 'MEMBERS' && (
          <div className="space-y-3">
            {/* Quick Add by Username */}
            {isAdmin && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  inviteMutation.mutate();
                }}
                className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-1.5 pl-3 rounded-2xl border border-slate-200 dark:border-slate-700"
              >
                <input
                  type="text"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  placeholder="Invite by @username..."
                  className="bg-transparent flex-1 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none font-medium"
                />
                <button
                  type="submit"
                  disabled={!inviteInput.trim() || inviteMutation.isPending}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-1 shadow-xs"
                >
                  <Send className="w-3 h-3" />
                  <span>{inviteMutation.isPending ? 'Inviting...' : 'Add'}</span>
                </button>
              </form>
            )}

            {/* Members List */}
            <div className="space-y-2 max-h-[45vh] overflow-y-auto no-scrollbar">
              {members.map((member: any) => {
                const isMemberOwner = member.role === 'OWNER';
                const isCurrent = member.userId === user?.id;
                const memberName = member.user?.name || 'Teammate';
                const username = member.user?.telegramAccount?.username
                  ? `@${member.user.telegramAccount.username}`
                  : member.user?.email || '';

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {member.user?.avatarUrl ? (
                        <img
                          src={member.user.avatarUrl}
                          alt={memberName}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {memberName[0]?.toUpperCase() || 'U'}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {memberName}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded-full font-bold">
                              You
                            </span>
                          )}
                          {isMemberOwner && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                        </div>
                        {username && (
                          <p className="text-[10px] text-slate-400 truncate">{username}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300">
                        {member.role}
                      </span>

                      {/* Remove member button */}
                      {isAdmin && !isMemberOwner && !isCurrent && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('medium');
                            setConfirmAction({
                              type: 'REMOVE_MEMBER',
                              memberId: member.id,
                              memberName,
                            });
                          }}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Remove member"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Danger Zone / Workspace Actions */}
        {activeTab === 'DANGER' && (
          <div className="space-y-3">
            {/* Leave Workspace Option (for non-owners) */}
            {!isOwner && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2">
                  <LogOut className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Leave Workspace</h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  You will be removed from this workspace and will no longer see its tasks or boards.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('medium');
                    setConfirmAction({ type: 'LEAVE' });
                  }}
                  className="w-full py-2 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 transition-colors active:scale-98"
                >
                  Leave this Workspace
                </button>
              </div>
            )}

            {/* Delete Workspace Option (for owners) */}
            {isOwner && (
              <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 space-y-2">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                  <Trash2 className="w-4 h-4" />
                  <h4 className="text-xs font-bold">
                    {currentWorkspace?.telegramChat ? 'Disconnect & Delete Board' : 'Delete Workspace'}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Permanently deletes this workspace and all associated tasks, projects, and comments. This action cannot be undone.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('heavy');
                    setConfirmAction({ type: 'DELETE' });
                  }}
                  className="w-full py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs active:scale-98"
                >
                  {currentWorkspace?.telegramChat ? 'Delete Group Board' : 'Delete Workspace'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Confirmation Modal Overlay */}
        {confirmAction && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/90 border border-rose-200 dark:border-rose-800 space-y-3 animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h4 className="text-xs font-extrabold">
                {confirmAction.type === 'DELETE'
                  ? 'Confirm Workspace Deletion'
                  : confirmAction.type === 'LEAVE'
                  ? 'Confirm Leaving Workspace'
                  : `Remove ${confirmAction.memberName || 'member'}?`}
              </h4>
            </div>

            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
              {confirmAction.type === 'DELETE'
                ? `Are you sure you want to permanently delete "${currentWorkspace?.name}"? All tasks and projects will be erased.`
                : confirmAction.type === 'LEAVE'
                ? `Are you sure you want to leave "${currentWorkspace?.name}"?`
                : `Are you sure you want to remove ${confirmAction.memberName} from this workspace?`}
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  deleteMutation.isPending ||
                  leaveMutation.isPending ||
                  removeMemberMutation.isPending
                }
                onClick={() => {
                  if (confirmAction.type === 'DELETE') {
                    deleteMutation.mutate();
                  } else if (confirmAction.type === 'LEAVE') {
                    leaveMutation.mutate();
                  } else if (confirmAction.type === 'REMOVE_MEMBER' && confirmAction.memberId) {
                    removeMemberMutation.mutate(confirmAction.memberId);
                  }
                }}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-xs"
              >
                {deleteMutation.isPending || leaveMutation.isPending || removeMemberMutation.isPending
                  ? 'Processing...'
                  : 'Yes, Proceed'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
