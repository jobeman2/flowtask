'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { PricingModal } from '../../billing/components/pricing-modal';
import { Layers, Plus, Users, User, X, Building2, Crown, Sparkles } from 'lucide-react';
import { Button } from '@flowtask/ui';

export function WorkspaceSwitcher() {
  const { user, workspaceId, setWorkspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [mounted, setMounted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createMode, setCreateMode] = useState<'STANDARD' | 'TELEGRAM'>('STANDARD');
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsType, setNewWsType] = useState<'TEAM' | 'PERSONAL'>('TEAM');
  const [telegramInput, setTelegramInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces', user?.id],
    queryFn: async () => {
      const res = await apiClient.getWorkspaces();
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: !!user,
  });

  // Self-healing: if workspaceId is invalid, stale, or not found, automatically snap to user's first real workspace
  React.useEffect(() => {
    if (workspaces.length > 0) {
      const exists = workspaces.some((w: any) => w.id === workspaceId);
      if (!workspaceId || !exists) {
        setWorkspaceId(workspaces[0].id);
      }
    }
  }, [workspaces, workspaceId, setWorkspaceId]);

  const createWsMutation = useMutation({
    mutationFn: async () => {
      if (!newWsName.trim()) return;
      setErrorMessage(null);
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
      setErrorMessage(null);
      setIsCreating(false);
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      setErrorMessage(err.message || 'Failed to create workspace');
    },
  });

  const connectTgMutation = useMutation({
    mutationFn: async () => {
      if (!telegramInput.trim()) return;
      setErrorMessage(null);
      const res = await apiClient.connectTelegramGroup(telegramInput.trim());
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
      setErrorMessage(null);
      setIsCreating(false);
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      setErrorMessage(err.message || 'Failed to connect Telegram group');
    },
  });

  const currentWorkspace = workspaces.find((w: any) => w.id === workspaceId);

  // Separate bot-initiated Telegram groups from personal/team workspaces
  const tgWorkspaces = workspaces.filter((w: any) => Boolean(w.telegramChat));
  const otherWorkspaces = workspaces.filter((w: any) => !w.telegramChat);

  return (
    <>
      <div className="flex items-center space-x-1 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-xs py-1 px-2.5 rounded-full border border-slate-200/80 dark:border-slate-700/70 shadow-xs shrink-0 hover:border-blue-300 transition-colors">
        <div className="flex items-center space-x-1.5">
          {currentWorkspace?.type === 'TEAM' || currentWorkspace?.telegramChat ? (
            <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          ) : (
            <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}

          <select
            value={workspaceId || ''}
            onChange={(e) => {
              if (e.target.value === '__NEW__') {
                setCreateMode('STANDARD');
                setErrorMessage(null);
                setIsCreating(true);
              } else if (e.target.value === '__NEW_TG__') {
                setCreateMode('TELEGRAM');
                setErrorMessage(null);
                setIsCreating(true);
              } else {
                triggerHaptic('light');
                setWorkspaceId(e.target.value);
              }
            }}
            className="bg-transparent text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer max-w-[115px] sm:max-w-[160px] truncate"
          >
            {tgWorkspaces.length > 0 && (
              <optgroup label="Telegram Groups (Bot Initiated)">
                {tgWorkspaces.map((ws: any) => (
                  <option
                    key={ws.id}
                    value={ws.id}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-semibold"
                  >
                    👥 {ws.name} (Telegram)
                  </option>
                ))}
              </optgroup>
            )}

            <optgroup label="Workspaces">
              {otherWorkspaces.map((ws: any) => (
                <option
                  key={ws.id}
                  value={ws.id}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs"
                >
                  {ws.type === 'TEAM' ? '🏢' : '👤'} {ws.name} ({ws.type === 'TEAM' ? 'Team' : 'Personal'})
                </option>
              ))}
            </optgroup>

            <option value="__NEW__" className="bg-white dark:bg-slate-900 text-blue-600 font-bold">
              + New Workspace...
            </option>
            <option value="__NEW_TG__" className="bg-white dark:bg-slate-900 text-sky-600 font-bold">
              + Connect Telegram Group...
            </option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateMode('STANDARD');
            setErrorMessage(null);
            setIsCreating(true);
          }}
          className="p-0.5 rounded-full text-slate-400 hover:text-blue-600 transition-colors shrink-0"
          title="Create New Workspace"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>

      {/* Create Workspace Modal (Portaled outside sticky header so BottomNav never overlaps) */}
      {isCreating && mounted && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[85dvh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                {createMode === 'TELEGRAM' ? (
                  <>
                    <Users className="w-5 h-5 text-sky-600" />
                    <span>Connect Group Workspace</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <span>Create Workspace</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => {
                  setErrorMessage(null);
                  setIsCreating(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setCreateMode('STANDARD');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  createMode === 'STANDARD'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setCreateMode('TELEGRAM');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  createMode === 'TELEGRAM'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <span>Telegram Group</span>
                <span className="text-[9px] bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 px-1 rounded-sm font-extrabold">
                  PRO
                </span>
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs rounded-2xl space-y-2">
                <p className="leading-snug">{errorMessage}</p>
                <Button
                  size="sm"
                  onClick={() => {
                    setIsCreating(false);
                    setIsPricingOpen(true);
                  }}
                  className="w-full rounded-xl text-xs bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>Upgrade with Telebirr</span>
                </Button>
              </div>
            )}

            {createMode === 'STANDARD' ? (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. Marketing Team, Project Alpha"
                      value={newWsName}
                      onChange={(e) => setNewWsName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Workspace Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewWsType('TEAM')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          newWsType === 'TEAM'
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 ring-1 ring-blue-500'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                        }`}
                      >
                        <Users className="w-4 h-4 text-blue-600 mb-1" />
                        <div className="font-bold text-xs text-slate-900 dark:text-white">Team</div>
                        <div className="text-[10px] text-slate-500">Multiple members & delegation</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewWsType('PERSONAL')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          newWsType === 'PERSONAL'
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 ring-1 ring-blue-500'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                        }`}
                      >
                        <User className="w-4 h-4 text-slate-600 mb-1" />
                        <div className="font-bold text-xs text-slate-900 dark:text-white">Personal</div>
                        <div className="text-[10px] text-slate-500">Solo task management</div>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setErrorMessage(null);
                      setIsCreating(false);
                    }}
                    className="rounded-xl text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!newWsName.trim() || createWsMutation.isPending}
                    onClick={() => createWsMutation.mutate()}
                    className="rounded-xl text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs"
                  >
                    {createWsMutation.isPending ? 'Creating...' : 'Create Workspace'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-900/60 rounded-2xl p-3 text-xs text-sky-900 dark:text-sky-200 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                      <span>Group Admin Auto-Sync</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-sky-700 dark:text-sky-300">
                      Connect any Telegram group where you are an <strong>Admin or Creator</strong>. FlowTask will automatically sync group members and create a shared task workspace!
                    </p>
                  </div>

                  {/* Step 1: Add Bot */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Step 1: Add Bot to your Telegram Group
                    </label>
                    <a
                      href="https://t.me/flowtaskmanager_bot?startgroup=flowtask"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Add @flowtaskmanager_bot as Admin</span>
                    </a>
                  </div>

                  {/* Step 2: Enter Group ID or @username */}
                  <div className="space-y-1 pt-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Step 2: Enter Group @username or Chat ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. @myteamgroup or -100123456789"
                      value={telegramInput}
                      onChange={(e) => setTelegramInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 font-medium"
                    />
                    <p className="text-[10px] text-slate-400">
                      Enter the group's public username or numeric chat ID.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setErrorMessage(null);
                      setIsCreating(false);
                    }}
                    className="rounded-xl text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!telegramInput.trim() || connectTgMutation.isPending}
                    onClick={() => connectTgMutation.mutate()}
                    className="rounded-xl text-xs bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-xs"
                  >
                    {connectTgMutation.isPending ? 'Syncing...' : 'Connect & Sync Group'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Pricing Modal */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
      />
    </>
  );
}
