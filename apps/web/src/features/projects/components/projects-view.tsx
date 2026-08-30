'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { Folder, Plus, ArrowRight, X, Sparkles } from 'lucide-react';

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
  const [color, setColor] = useState('#2563eb');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getProjects(workspaceId);
      return res.data || [];
    },
    enabled: Boolean(workspaceId),
  });

  const { data: stats } = useQuery({
    queryKey: ['task-stats', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const res = await apiClient.getTaskStats(workspaceId);
      return res.data;
    },
    enabled: Boolean(workspaceId),
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
    '#2563eb', // royal blue
    '#7c3aed', // violet
    '#db2777', // pink
    '#e11d48', // rose
    '#d97706', // amber
    '#059669', // emerald
    '#0891b2', // cyan
    '#475569', // slate
  ];

  return (
    <div className="space-y-4 animate-in fade-in font-sans">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Workspace Projects</h2>
          <p className="text-xs text-slate-400 font-medium">Organize tasks into milestones and boards</p>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setIsCreating(true);
          }}
          className="px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/25 active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>New Project</span>
        </button>
      </div>

      {/* New Project Inline Form */}
      {isCreating && (
        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-blue-200 dark:border-blue-800/80 shadow-lg space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create Project</span>
            </h4>
            <button
              onClick={() => setIsCreating(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              required
              autoFocus
              placeholder="Project Name (e.g. Mobile App Redesign)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none text-slate-900 dark:text-white focus:border-blue-500 font-semibold"
            />
            <input
              type="text"
              placeholder="Brief description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none text-slate-900 dark:text-white font-medium"
            />
          </div>

          {/* Color Palette */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-500 font-bold">Theme Color:</span>
            <div className="flex gap-2">
              {colorPalette.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-blue-500 ring-offset-2' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!name.trim() || createProjectMutation.isPending}
              onClick={() => createProjectMutation.mutate()}
              className="px-4 py-1.5 rounded-xl text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/25 active:scale-95 transition-all disabled:opacity-50"
            >
              {createProjectMutation.isPending ? 'Saving...' : 'Save Project'}
            </button>
          </div>
        </div>
      )}

      {/* Projects List */}
      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-400 animate-pulse">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="py-10 text-center bg-white dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
          <Folder className="w-8 h-8 text-slate-300 mx-auto mb-1" />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No projects created yet</p>
          <p className="text-[11px] text-slate-400 font-medium">Group related tasks into organized milestones</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {projects.map((proj: any) => {
            const isSelected = selectedProjectId === proj.id;
            const projectStat = stats?.projectsSummary?.find((p) => p.id === proj.id);
            const count = projectStat?.taskCount ?? 0;
            const projColor = proj.color || '#2563eb';

            return (
              <div
                key={proj.id}
                onClick={() => {
                  triggerHaptic('light');
                  onSelectProject(isSelected ? null : proj.id);
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between shadow-[0_2px_12px_-2px_rgba(0,0,0,0.03)] hover:shadow-md ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40'
                    : 'border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/90 hover:border-blue-200'
                }`}
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div
                    className="w-3 h-10 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: projColor }}
                  />
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 truncate">
                      <span>{proj.name}</span>
                      {isSelected && (
                        <span className="text-[9px] uppercase font-extrabold text-blue-600 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </h3>
                    {proj.description && (
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5 font-medium">{proj.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {count} {count === 1 ? 'task' : 'tasks'}
                  </span>
                  <ArrowRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-blue-600 translate-x-1' : 'text-slate-300 dark:text-slate-600'}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
