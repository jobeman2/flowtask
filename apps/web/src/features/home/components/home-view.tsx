'use client';

import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { Check, ChevronRight, Plus } from 'lucide-react';

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
    if (priority === 'URGENT' || priority === 'HIGH') return 'bg-rose-500 ring-rose-500/20';
    if (priority === 'MEDIUM') return 'bg-amber-500 ring-amber-500/20';
    return 'bg-blue-500 ring-blue-500/20';
  };

  // Format Due Date
  const formatDue = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const totalAll = metrics.myTasks + metrics.completed;
  const progressPercent = totalAll > 0 ? Math.round((metrics.completed / totalAll) * 100) : 0;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* 1. Bespoke Hero Greeting Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-3xl p-5 text-white shadow-xl shadow-blue-500/15 border border-blue-400/20">
        {/* Subtle background glow */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-blue-200">
                Workspace Dashboard
              </span>
              <h2 className="text-xl font-extrabold tracking-tight">
                {greeting}, {firstName} 👋
              </h2>
            </div>
            <div className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-bold tracking-tight text-white border border-white/20">
              {progressPercent}% Done
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="w-full bg-black/20 rounded-full h-2 overflow-hidden p-0.5 backdrop-blur-xs">
              <div
                className="bg-gradient-to-r from-emerald-400 to-teal-300 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-blue-100 font-medium">
              <span>{metrics.completed} completed</span>
              <span>{metrics.myTasks} pending</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Bespoke 6 KPI Metric Grid */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Overview
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {/* Card 1: My Tasks */}
          <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:border-blue-200 transition-all">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
              {metrics.myTasks}
            </span>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-1">
              My Tasks
            </span>
          </div>

          {/* Card 2: In Progress */}
          <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:border-amber-200 transition-all">
            <span className="text-2xl font-black text-amber-500 dark:text-amber-400 tracking-tight">
              {metrics.inProgress}
            </span>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-1">
              In Progress
            </span>
          </div>

          {/* Card 3: Completed */}
          <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:border-emerald-200 transition-all">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {metrics.completed}
            </span>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-1">
              Completed
            </span>
          </div>

          {/* Card 4: Overdue */}
          <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:border-rose-200 transition-all">
            <span className="text-2xl font-black text-rose-500 dark:text-rose-400 tracking-tight">
              {metrics.overdue}
            </span>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-1">
              Overdue
            </span>
          </div>

          {/* Card 5: Due Today */}
          <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:border-purple-200 transition-all">
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
              {metrics.dueToday}
            </span>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-1">
              Due Today
            </span>
          </div>

          {/* Card 6: Upcoming */}
          <div className="bg-white dark:bg-slate-900/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:border-sky-200 transition-all">
            <span className="text-2xl font-black text-sky-500 dark:text-sky-400 tracking-tight">
              {metrics.upcoming}
            </span>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-1">
              Upcoming
            </span>
          </div>
        </div>
      </div>

      {/* 3. My Tasks Priority Feed */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
            Recent Tasks
          </h3>
          <button
            type="button"
            onClick={onNavigateTasks}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
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
                className="bg-white dark:bg-slate-900/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.03)] flex items-center justify-between gap-3.5 hover:border-blue-200 dark:hover:border-blue-900/50 hover:shadow-md transition-all cursor-pointer group"
              >
                {/* Left side: Circular Checkbox + Title & Tag */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
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
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'border-2 border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:scale-105'
                    }`}
                  >
                    {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <h4
                      className={`text-[13px] font-bold truncate leading-snug tracking-tight ${
                        isDone
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors'
                      }`}
                    >
                      {task.title}
                    </h4>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/60 border border-blue-100/50 dark:border-blue-900/50 px-2 py-0.5 rounded-md">
                        {projectTag}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side: Relative Due Date & Priority Dot */}
                <div className="flex items-center gap-2 shrink-0">
                  {dueText && (
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                      {dueText}
                    </span>
                  )}
                  <span className={`w-2 h-2 rounded-full ring-2 ${getPriorityDot(task.priority)}`} />
                </div>
              </div>
            );
          })}

          {tasks.length === 0 && (
            <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2.5">
              <p className="text-xs font-bold text-slate-500">No tasks on your board yet.</p>
              <button
                type="button"
                onClick={onOpenCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-500/25 hover:bg-blue-700 transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Create First Task</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
