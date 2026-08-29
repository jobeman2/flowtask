'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { Button } from '@flowtask/ui';
import { Folder, Plus, ArrowRight, X } from 'lucide-react';

interface ProjectsViewProps {
  onSelectProject: (projectId: string | null) => void;
  selectedProjectId: string | null;
}

export function ProjectsView({ onSelectProject, selectedProjectId }: ProjectsViewProps) {
  const { workspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getProjects(workspaceId);
      return res.data || [];
    },
    enabled: !!workspaceId,
  });

  const { data: stats } = useQuery({
    queryKey: ['task-stats', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const res = await apiClient.getTaskStats(workspaceId);
      return res.data;
    },
    enabled: !!workspaceId,
  });

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !name.trim()) return;
      return apiClient.createProject(workspaceId, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
      setName('');
      setDescription('');
      setIsCreating(false);
    },
  });

  const colorPalette = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#ef4444', // red
    '#f59e0b', // amber
    '#10b981', // emerald
    '#06b6d4', // cyan
    '#64748b', // slate
  ];

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Workspace Projects</h2>
          <p className="text-xs text-slate-500">Organize tasks into milestones and boards</p>
        </div>
        <Button
          size="sm"
          onClick={() => setIsCreating(true)}
          className="rounded-xl text-xs flex items-center gap-1 bg-flow-600 hover:bg-flow-700 text-white font-bold shadow-flow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </Button>
      </div>

      {/* New Project Inline Modal / Form */}
      {isCreating && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Create Project
            </h4>
            <button
              onClick={() => setIsCreating(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            required
            autoFocus
            placeholder="Project name (e.g. Mobile App Redesign)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Brief description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Color:</span>
            <div className="flex gap-1.5">
              {colorPalette.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-blue-500 ring-offset-2' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
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
              disabled={!name.trim() || createProjectMutation.isPending}
              onClick={() => createProjectMutation.mutate()}
              className="rounded-xl text-xs bg-blue-600 text-white font-semibold"
            >
              {createProjectMutation.isPending ? 'Creating...' : 'Save Project'}
            </Button>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="py-10 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          <Folder className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">No projects yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Group related tasks into organized projects</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {projects.map((proj: any) => {
            const isSelected = selectedProjectId === proj.id;
            const projectStat = stats?.projectsSummary?.find((p) => p.id === proj.id);
            const count = projectStat?.taskCount ?? 0;

            return (
              <div
                key={proj.id}
                onClick={() => {
                  triggerHaptic('light');
                  onSelectProject(isSelected ? null : proj.id);
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className="w-3.5 h-10 rounded-full shadow-sm"
                    style={{ backgroundColor: proj.color || '#3b82f6' }}
                  />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      {proj.name}
                      {isSelected && (
                        <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full">
                          Active Filter
                        </span>
                      )}
                    </h3>
                    {proj.description && (
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{proj.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {count} {count === 1 ? 'task' : 'tasks'}
                  </span>
                  <ArrowRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-blue-600 translate-x-1' : 'text-slate-400'}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
