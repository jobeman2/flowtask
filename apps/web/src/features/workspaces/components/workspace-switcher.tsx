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

  const currentWorkspace = workspaces.find((w: any) => w.id === workspaceId);

  return (
    <>
      <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/90 p-0.5 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs shrink-0">
        <div className="flex items-center space-x-1">
          {currentWorkspace?.type === 'TEAM' ? (
            <Building2 className="w-3.5 h-3.5 text-flow-600 shrink-0" />
          ) : (
            <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}
          <select
            value={workspaceId || ''}
            onChange={(e) => {
              if (e.target.value === '__NEW__') {
                setErrorMessage(null);
                setIsCreating(true);
              } else {
                triggerHaptic('light');
                setWorkspaceId(e.target.value);
              }
            }}
            className="bg-transparent text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer max-w-[85px] sm:max-w-[120px] truncate"
          >
            {workspaces.map((ws: any) => (
              <option key={ws.id} value={ws.id} className="bg-white dark:bg-slate-900 text-xs">
                {ws.name} ({ws.type === 'TEAM' ? 'Team' : 'Personal'})
              </option>
            ))}
            <option value="__NEW__" className="bg-white dark:bg-slate-900 text-flow-600 font-bold">
              + New Workspace...
            </option>
          </select>
        </div>

        <button
          onClick={() => {
            setErrorMessage(null);
            setIsCreating(true);
          }}
          className="p-0.5 rounded text-slate-400 hover:text-flow-600 transition-colors shrink-0"
          title="Create New Team Workspace"
        >
          <Plus className="w-3 h-3" />
        </button>
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
