'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { PricingModal } from '../../billing/components/pricing-modal';
import { Layers, Plus, Users, User, X, Building2, Crown } from 'lucide-react';
import { Button } from '@flowtask/ui';

export function WorkspaceSwitcher() {
  const { user, workspaceId, setWorkspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsType, setNewWsType] = useState<'TEAM' | 'PERSONAL'>('TEAM');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <>
      <div className="relative">
        <div
          onClick={() => {
            triggerHaptic('light');
            setIsDropdownOpen(!isDropdownOpen);
          }}
          className="flex items-center space-x-1.5 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-xs py-1 px-3 rounded-full border border-slate-200/80 dark:border-slate-700/70 shadow-xs cursor-pointer hover:border-blue-300 transition-all select-none"
        >
          {currentWorkspace?.type === 'TEAM' ? (
            <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          ) : (
            <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}

          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 max-w-[95px] sm:max-w-[130px] truncate">
            {currentWorkspace?.name || 'My Workspace'}
          </span>

          <Plus
            onClick={(e) => {
              e.stopPropagation();
              setIsDropdownOpen(false);
              setErrorMessage(null);
              setIsCreating(true);
            }}
            className="w-3.5 h-3.5 text-slate-400 hover:text-blue-600 ml-0.5 stroke-[2.5] shrink-0"
          />
        </div>

        {/* Custom iOS-style Dropdown Menu */}
        {isDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsDropdownOpen(false)}
            />
            <div className="absolute top-full left-0 mt-1.5 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 font-sans">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2.5 py-1">
                Workspaces
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {workspaces.map((ws: any) => {
                  const isSelected = ws.id === workspaceId;
                  return (
                    <div
                      key={ws.id}
                      onClick={() => {
                        triggerHaptic('medium');
                        setWorkspaceId(ws.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {ws.type === 'TEAM' ? (
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Layers className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        )}
                        <span className="truncate">{ws.name}</span>
                      </div>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                <div
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setErrorMessage(null);
                    setIsCreating(true);
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Create Workspace</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Workspace Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-flow-600" />
                <span>Create Workspace</span>
              </h3>
              <button
                onClick={() => {
                  setErrorMessage(null);
                  setIsCreating(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
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
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-flow-500 font-medium"
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
                        ? 'border-flow-500 bg-flow-50/50 dark:bg-flow-950/40 ring-1 ring-flow-500'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                    }`}
                  >
                    <Users className="w-4 h-4 text-flow-600 mb-1" />
                    <div className="font-bold text-xs text-slate-900 dark:text-white">Team</div>
                    <div className="text-[10px] text-slate-500">Multiple members & delegation</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewWsType('PERSONAL')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      newWsType === 'PERSONAL'
                        ? 'border-flow-500 bg-flow-50/50 dark:bg-flow-950/40 ring-1 ring-flow-500'
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
                className="rounded-xl text-xs bg-flow-600 hover:bg-flow-700 text-white font-bold shadow-flow-sm"
              >
                {createWsMutation.isPending ? 'Creating...' : 'Create Workspace'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Modal */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
      />
    </>
  );
}
