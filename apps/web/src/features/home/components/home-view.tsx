'use client';

import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { Check, ChevronRight } from 'lucide-react';

interface HomeViewProps {
  onSelectTask: (taskId: string) => void;
  onOpenCreate: () => void;
  onNavigateTasks: () => void;
}

export function HomeView({
  onSelectTask,
  onOpenCreate,
  onNavigateTasks,
}: HomeViewProps) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  // 1. Fetch Task Statistics
  const { data: stats } = useQuery({
    queryKey: ['task-stats', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const res = await apiClient.getTaskStats(workspaceId);
      return res.data;
    },
    enabled: Boolean(workspaceId),
  });

  // 2. Fetch Tasks
  const { data: tasks = [] } = useQuery({
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

  // Dynamic greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = user?.name ? user.name.split(' ')[0] : 'Teammate';

  // Calculate the 6 KPI Metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const myTasks = tasks.filter((t: any) => t.status !== 'DONE' && t.assigneeId === user?.id).length || tasks.filter((t: any) => t.status !== 'DONE').length;
    const inProgress = tasks.filter((t: any) => t.status === 'IN_PROGRESS').length;
    const completed = tasks.filter((t: any) => t.status === 'DONE').length;
    const overdue = tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE').length;
    const dueToday = tasks.filter((t: any) => {
      if (!t.dueDate || t.status === 'DONE') return false;
      const d = new Date(t.dueDate);
      return d >= now && d <= todayEnd;
    }).length;
    const upcoming = tasks.filter((t: any) => {
      if (!t.dueDate || t.status === 'DONE') return false;
      return new Date(t.dueDate) > todayEnd;
    }).length;

    return {
      myTasks: myTasks || stats?.totalActive || 0,
      inProgress: inProgress || 0,
      completed: completed || stats?.completed || 0,
      overdue: overdue || stats?.overdue || 0,
      dueToday: dueToday || stats?.dueToday || 0,
      upcoming: upcoming || stats?.upcoming || 0,
    };
  }, [tasks, stats, user]);

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
    <div className="space-y-5 pb-20 animate-in fade-in duration-300">
      {/* 1. Header Greeting */}
      <div className="space-y-0.5 pt-1">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
          <span>{greeting}, {firstName}</span>
          <span>👋</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Let&apos;s get things done today.
        </p>
      </div>

      {/* 2. KPI Metrics Grid (3 columns x 2 rows) */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Box 1: My Tasks */}
        <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100/80 dark:border-blue-900/40 rounded-2xl p-3 flex flex-col justify-between shadow-xs">
          <span className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
            {metrics.myTasks}
          </span>
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-1">
            My Tasks
          </span>
        </div>

        {/* Box 2: In Progress */}
        <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-100/80 dark:border-amber-900/40 rounded-2xl p-3 flex flex-col justify-between shadow-xs">
          <span className="text-2xl font-black text-amber-500 dark:text-amber-400 tracking-tight">
            {metrics.inProgress}
          </span>
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-1">
            In Progress
          </span>
        </div>

        {/* Box 3: Completed */}
        <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-100/80 dark:border-emerald-900/40 rounded-2xl p-3 flex flex-col justify-between shadow-xs">
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
            {metrics.completed}
          </span>
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-1">
            Completed
          </span>
        </div>

        {/* Box 4: Overdue */}
        <div className="bg-rose-50/80 dark:bg-rose-950/30 border border-rose-100/80 dark:border-rose-900/40 rounded-2xl p-3 flex flex-col justify-between shadow-xs">
          <span className="text-2xl font-black text-rose-500 dark:text-rose-400 tracking-tight">
            {metrics.overdue}
          </span>
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-1">
            Overdue
          </span>
        </div>

        {/* Box 5: Due Today */}
        <div className="bg-purple-50/80 dark:bg-purple-950/30 border border-purple-100/80 dark:border-purple-900/40 rounded-2xl p-3 flex flex-col justify-between shadow-xs">
          <span className="text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
            {metrics.dueToday}
          </span>
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-1">
            Due Today
          </span>
        </div>

        {/* Box 6: Upcoming */}
        <div className="bg-sky-50/80 dark:bg-sky-950/30 border border-sky-100/80 dark:border-sky-900/40 rounded-2xl p-3 flex flex-col justify-between shadow-xs">
          <span className="text-2xl font-black text-sky-600 dark:text-sky-400 tracking-tight">
            {metrics.upcoming}
          </span>
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-1">
            Upcoming
          </span>
        </div>
      </div>

      {/* 3. My Tasks Section Header */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            My Tasks
          </h3>
          <button
            type="button"
            onClick={onNavigateTasks}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
          >
            <span>See all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 4. Task Cards List */}
        <div className="space-y-2.5">
          {tasks.slice(0, 6).map((task: any) => {
            const isDone = task.status === 'DONE';
            const dueText = formatDue(task.dueDate);
            const projectTag = task.project?.name || (task.labels?.[0]?.name ? task.labels[0].name : 'General');

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

          {tasks.length === 0 && (
            <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <p className="text-xs font-semibold text-slate-500">No tasks created yet.</p>
              <button
                type="button"
                onClick={onOpenCreate}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                + Create your first task
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
