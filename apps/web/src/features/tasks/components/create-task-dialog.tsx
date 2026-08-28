'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { Button } from '@flowtask/ui';
import { Calendar, Folder, RefreshCw, X, User } from 'lucide-react';

export function CreateTaskModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [projectId, setProjectId] = useState<string>('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState('');
  const { workspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getProjects(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: !!workspaceId && isOpen,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getWorkspaceMembers(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: !!workspaceId && isOpen,
  });

  const setQuickDate = (days: number | null) => {
    if (days === null) {
      setDueDate('');
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(18, 0, 0, 0);
    // format as YYYY-MM-DDThh:mm
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setDueDate(localIso);
  };

  const [formError, setFormError] = useState<string | null>(null);

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !title.trim()) {
        throw new Error('Workspace or title missing');
      }
      setFormError(null);
      const res = await apiClient.createTask({
        workspaceId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        projectId: projectId || undefined,
        assigneeId: assigneeId || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        isRecurring,
        recurrenceRule: isRecurring ? recurrenceRule || 'FREQ=WEEKLY' : undefined,
      });

      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      setTitle('');
      setDescription('');
      setDueDate('');
      setProjectId('');
      setAssigneeId('');
      setIsRecurring(false);
      setRecurrenceRule('');
      setFormError(null);
      onClose();
    },
    onError: (err: any) => {
      setFormError(err?.message || 'Failed to create task');
      triggerHaptic('heavy');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Create New Task</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-medium">
            {formError}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTaskMutation.mutate();
          }}
          className="mt-4 space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Finalize quarterly client report"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Description & Notes
            </label>
            <textarea
              rows={2}
              placeholder="Add deliverables, links, or context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Quick Due Date Presets */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              Due Date & Quick Presets
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => setQuickDate(0)}
                className="px-2.5 py-1 text-xs rounded-lg font-medium bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 hover:bg-blue-100"
              >
                Today 6pm
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(1)}
                className="px-2.5 py-1 text-xs rounded-lg font-medium bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 hover:bg-purple-100"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(3)}
                className="px-2.5 py-1 text-xs rounded-lg font-medium bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 hover:bg-amber-100"
              >
                In 3 Days
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(7)}
                className="px-2.5 py-1 text-xs rounded-lg font-medium bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 hover:bg-emerald-100"
              >
                Next Week
              </button>
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setQuickDate(null)}
                  className="px-2 py-1 text-xs rounded-lg font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-xs"
            />
          </div>

          {/* Project, Assignee & Recurrence */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-indigo-500" />
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-xs truncate"
              >
                <option value="">General Inbox</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-500" />
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-xs truncate"
              >
                <option value="">Unassigned (Me)</option>
                {members.map((m: any) => {
                  const u = m.user || { name: 'Member', id: m.userId };
                  return (
                    <option key={u.id} value={u.id}>
                      {u.name} ({m.role})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
                Recurring
              </label>
              <select
                value={isRecurring ? recurrenceRule || 'FREQ=WEEKLY' : ''}
                onChange={(e) => {
                  if (!e.target.value) {
                    setIsRecurring(false);
                    setRecurrenceRule('');
                  } else {
                    setIsRecurring(true);
                    setRecurrenceRule(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              >
                <option value="">Does Not Repeat</option>
                <option value="FREQ=DAILY">Daily</option>
                <option value="FREQ=WEEKLY">Weekly</option>
                <option value="FREQ=MONTHLY">Monthly</option>
              </select>
            </div>
          </div>

          {/* Priority */}
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Priority
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'LOW', label: 'Low', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
                { id: 'MEDIUM', label: 'Medium', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
                { id: 'HIGH', label: 'High', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
                { id: 'URGENT', label: 'Urgent', color: 'bg-rose-500/10 text-rose-600 border-rose-500/30' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriority(p.id)}
                  className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-all ${
                    priority === p.id
                      ? `${p.color} ring-2 ring-blue-500 font-bold shadow-sm`
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 flex space-x-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="w-1/3 rounded-xl text-xs py-2.5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || createTaskMutation.isPending}
              className="w-2/3 rounded-xl text-xs py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {createTaskMutation.isPending ? 'Saving...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
