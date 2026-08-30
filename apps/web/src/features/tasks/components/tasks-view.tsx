'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  Search,
  Check,
} from 'lucide-react';

interface TasksViewProps {
  onSelectTask: (taskId: string) => void;
  onOpenCreate: () => void;
}

export function TasksView({
  onSelectTask,
  onOpenCreate,
}: TasksViewProps) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'TODO' | 'IN_PROGRESS' | 'DONE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getTasks(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: Boolean(workspaceId),
  });

  // Complete Task Mutation
  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!workspaceId) return;
      return apiClient.completeTask(taskId, workspaceId);
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    },
  });

  // Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t: any) => {
      // Status Filter
      if (activeFilter === 'TODO' && t.status !== 'TODO') return false;
      if (activeFilter === 'IN_PROGRESS' && t.status !== 'IN_PROGRESS') return false;
      if (activeFilter === 'DONE' && t.status !== 'DONE') return false;

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesProject = t.project?.name?.toLowerCase().includes(q);
        const matchesAssignee = t.assignee?.name?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesProject && !matchesAssignee) return false;
      }

      return true;
    });
  }, [tasks, activeFilter, searchQuery]);

  // Priority Dot Color
  const getPriorityDot = (priority: string) => {
    if (priority === 'URGENT' || priority === 'HIGH') return 'bg-rose-500';
    if (priority === 'MEDIUM') return 'bg-amber-500';
    return 'bg-blue-500';
  };

  // Format Due Date
  const formatDue = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Due Tomorrow';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-300">
      {/* 1. Header & Title */}
      <div className="flex items-center justify-between pt-1">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          My Tasks
        </h2>
      </div>

      {/* 2. Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {(['ALL', 'TODO', 'IN_PROGRESS', 'DONE'] as const).map((filter) => {
          const labels = {
            ALL: 'All',
            TODO: 'To Do',
            IN_PROGRESS: 'In Progress',
            DONE: 'Done',
          };
          const isActive = activeFilter === filter;

          return (
            <button
              key={filter}
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveFilter(filter);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {labels[filter]}
            </button>
          );
        })}
      </div>

      {/* 3. Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tasks by title, project, assignee..."
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* 4. Task Cards List */}
      <div className="space-y-2.5">
        {filteredTasks.map((task: any) => {
          const isDone = task.status === 'DONE';
          const dueText = formatDue(task.dueDate);
          const projectTag = task.project?.name || (task.labels?.[0]?.name ? task.labels[0].name : 'Development');

          return (
            <div
              key={task.id}
              onClick={() => onSelectTask(task.id)}
              className="bg-white dark:bg-slate-900/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800/80 shadow-xs flex items-center justify-between gap-3 hover:border-blue-200 dark:hover:border-blue-900/50 transition-all cursor-pointer group"
            >
              {/* Left side: Circular Checkbox + Title & Tag */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isDone) return;
                    if (task.assigneeId && task.assigneeId !== user?.id) {
                      triggerHaptic('heavy');
                      alert(`Only ${task.assignee?.name || 'the assignee'} can complete this task.`);
                      return;
                    }
                    completeMutation.mutate(task.id);
                  }}
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    isDone
                      ? 'bg-blue-600 text-white'
                      : 'border-2 border-slate-300 dark:border-slate-600 hover:border-blue-500'
                  }`}
                >
                  {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                </button>

                <div className="min-w-0 flex-1">
                  <h4
                    className={`text-[13px] font-semibold truncate leading-snug ${
                      isDone
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {task.title}
                  </h4>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full">
                      {projectTag}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right side: Relative Due Date & Priority Dot */}
              <div className="flex items-center gap-1.5 shrink-0">
                {dueText && (
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    {dueText}
                  </span>
                )}
                <span className={`w-2 h-2 rounded-full ${getPriorityDot(task.priority)}`} />
              </div>
            </div>
          );
        })}

        {filteredTasks.length === 0 && !isLoading && (
          <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
            <p className="text-xs font-semibold text-slate-500">No tasks match your filter.</p>
            <button
              type="button"
              onClick={onOpenCreate}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              + Create a new task
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
