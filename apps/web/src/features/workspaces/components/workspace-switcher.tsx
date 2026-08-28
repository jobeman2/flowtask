'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { Layers, Plus, Users, User, X, Building2 } from 'lucide-react';
import { Button } from '@flowtask/ui';

export function WorkspaceSwitcher() {
  const { workspaceId, setWorkspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsType, setNewWsType] = useState<'TEAM' | 'PERSONAL'>('TEAM');

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await apiClient.getWorkspaces();
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
  });

  const createWsMutation = useMutation({
    mutationFn: async () => {
      if (!newWsName.trim()) return;
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
      setIsCreating(false);
    },
  });

  const currentWorkspace = workspaces.find((w: any) => w.id === workspaceId);

  return (
    <>
      <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center space-x-1.5 px-2 py-0.5">
          {currentWorkspace?.type === 'TEAM' ? (
            <Building2 className="w-4 h-4 text-blue-600" />
          ) : (
            <Layers className="w-4 h-4 text-slate-500" />
          )}
          <select
            value={workspaceId || ''}
            onChange={(e) => {
              if (e.target.value === '__NEW__') {
                setIsCreating(true);
              } else {
                triggerHaptic('light');
                setWorkspaceId(e.target.value);
              }
            }}
            className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer max-w-[130px] truncate"
          >
            {workspaces.map((ws: any) => (
              <option key={ws.id} value={ws.id} className="bg-white dark:bg-slate-900 text-xs">
                {ws.name} ({ws.type === 'TEAM' ? 'Team' : 'Personal'})
              </option>
            ))}
            <option value="__NEW__" className="bg-white dark:bg-slate-900 text-blue-600 font-bold">
              + New Workspace...
            </option>
          </select>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 transition-colors"
          title="Create New Team Workspace"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Create Workspace Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <span>Create Workspace</span>
              </h3>
              <button
                onClick={() => setIsCreating(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Design Team, Growth Squad"
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
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40'
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
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40'
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
                onClick={() => setIsCreating(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!newWsName.trim() || createWsMutation.isPending}
                onClick={() => createWsMutation.mutate()}
                className="rounded-xl text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {createWsMutation.isPending ? 'Creating...' : 'Create Workspace'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
