'use client';

import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  Check,
  ChevronRight,
  Plus,
  Clock,
  Calendar,
  Sparkles,
  Flame,
  CheckCircle2,
} from 'lucide-react';

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

  // Calculate Metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const activeTasks = tasks.filter((t: any) => t.status !== 'DONE');
    const completed = tasks.filter((t: any) => t.status === 'DONE').length;
    const inProgress = tasks.filter((t: any) => t.status === 'IN_PROGRESS').length;
    const dueToday = tasks.filter((t: any) => {
      if (!t.dueDate || t.status === 'DONE') return false;
      const d = new Date(t.dueDate);
      return d >= now && d <= todayEnd;
    }).length;

    return {
      active: activeTasks.length || stats?.totalActive || 0,
      inProgress,
      completed: completed || stats?.completed || 0,
      dueToday: dueToday || stats?.dueToday || 0,
    };
  }, [tasks, stats]);

  // Format Due Date with clean Badge
  const formatDue = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'Overdue', isAlert: true };
    if (diffDays === 0) return { label: 'Today', isAlert: false };
    if (diffDays === 1) return { label: 'Tomorrow', isAlert: false };
    return {
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isAlert: false,
    };
  };

  const totalAll = metrics.active + metrics.completed;
  const progressPercent = totalAll > 0 ? Math.round((metrics.completed / totalAll) * 100) : 0;

  // Active highlighted priority task
  const activeFocusTask = tasks.find((t: any) => t.status === 'IN_PROGRESS') || tasks.find((t: any) => t.status !== 'DONE');

  return (
    <div className="space-y-5 pb-32 animate-in fade-in duration-300 font-sans">
      {/* 1. Hero Focus Card (Pure Blue Brand Palette) */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-600 via-blue-600 to-blue-700 p-5 text-white shadow-xl shadow-blue-500/20 border border-blue-400/25">
        {/* Subtle decorative background rings */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-sky-400/20 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase text-blue-100">
                <Sparkles className="w-2.5 h-2.5 text-amber-300 fill-amber-300" />
                <span>Daily Focus</span>
              </span>
              <h2 className="text-xl font-extrabold tracking-tight mt-1.5 leading-tight">
                {greeting}, {firstName} 👋
              </h2>
            </div>

            {/* Circular Progress Badge */}
            <div className="flex flex-col items-center justify-center bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl w-13 h-13 shrink-0">
              <span className="text-sm font-black tracking-tight">{progressPercent}%</span>
              <span className="text-[9px] font-bold text-blue-100 uppercase tracking-wider">done</span>
            </div>
          </div>

          {/* Active Highlight Banner or Progress */}
          {activeFocusTask ? (
            <div
              onClick={() => onSelectTask(activeFocusTask.id)}
              className="bg-black/20 hover:bg-black/30 backdrop-blur-md rounded-2xl p-3 border border-white/15 cursor-pointer transition-all flex items-center justify-between gap-3 group"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-200">
                  <Clock className="w-3 h-3 text-blue-300" />
                  <span>Current Task</span>
                </div>
                <h4 className="text-xs font-bold truncate text-white mt-0.5 group-hover:text-blue-100 transition-colors">
                  {activeFocusTask.title}
                </h4>
              </div>
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ) : (
            <div className="bg-black/15 backdrop-blur-xs rounded-2xl p-3 border border-white/10 flex items-center justify-between">
              <p className="text-xs font-semibold text-blue-100">All tasks completed! You're on fire 🔥</p>
              <button
                type="button"
                onClick={onOpenCreate}
                className="text-[11px] font-bold px-3 py-1 bg-white text-blue-600 rounded-full shadow-xs"
              >
                + Add
              </button>
            </div>
          )}

          {/* Progress Bar & Sub-stats */}
          <div className="space-y-1.5 pt-0.5">
            <div className="w-full bg-black/25 rounded-full h-2 overflow-hidden p-0.5 backdrop-blur-xs">
              <div
                className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.max(5, progressPercent)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-blue-100 font-semibold px-0.5">
              <span>{metrics.completed} Completed</span>
              <span>{metrics.active} Pending</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sleek Metrics Pill Row (Pure Blue Palette) */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Card 1: Active Tasks */}
        <div
          onClick={onNavigateTasks}
          className="bg-white dark:bg-slate-900/90 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)] cursor-pointer hover:border-blue-200 transition-all active:scale-98"
        >
          <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
            <Flame className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
            {metrics.active}
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
            Active Tasks
          </div>
        </div>

        {/* Card 2: In Progress */}
        <div
          onClick={onNavigateTasks}
          className="bg-white dark:bg-slate-900/90 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)] cursor-pointer hover:border-blue-200 transition-all active:scale-98"
        >
          <div className="w-7 h-7 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-2">
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
            {metrics.inProgress}
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
            In Progress
          </div>
        </div>

        {/* Card 3: Due Today */}
        <div
          onClick={onNavigateTasks}
          className="bg-white dark:bg-slate-900/90 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)] cursor-pointer hover:border-blue-200 transition-all active:scale-98"
        >
          <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
            {metrics.dueToday}
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
            Due Today
          </div>
        </div>
      </div>

      {/* 3. Task List Section Header */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
              Tasks
            </h3>
            <p className="text-[11px] font-medium text-slate-400">
              {metrics.active} remaining for this board
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateTasks}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
          >
            <span>See All</span>
            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>

        {/* 4. Pinterest-Inspired Task Cards */}
        <div className="space-y-2.5">
          {tasks.slice(0, 6).map((task: any) => {
            const isDone = task.status === 'DONE';
            const dueInfo = formatDue(task.dueDate);
            const projectTag = task.project?.name || (task.labels?.[0]?.name ? task.labels[0].name : 'General');
            const projectColor = task.project?.color || '#2563eb';

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className="bg-white dark:bg-slate-900/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900/50 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Interactive Circular Checkbox + Task Info */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
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
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                        isDone
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'border-2 border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:scale-105'
                      }`}
                    >
                      {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <h4
                        className={`text-xs font-bold leading-snug tracking-tight truncate ${
                          isDone
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors'
                        }`}
                      >
                        {task.title}
                      </h4>

                      {/* Project Tag Pill & Due Date */}
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className="text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1"
                          style={{
                            backgroundColor: `${projectColor}15`,
                            color: projectColor,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: projectColor }}
                          />
                          <span>{projectTag}</span>
                        </span>

                        {dueInfo && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                              dueInfo.isAlert
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            <Calendar className="w-2.5 h-2.5" />
                            <span>{dueInfo.label}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side: Assignee Avatar or Priority Dot */}
                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    {task.assignee?.avatarUrl ? (
                      <img
                        src={task.assignee.avatarUrl}
                        alt={task.assignee.name || 'Assignee'}
                        className="w-6 h-6 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      />
                    ) : task.assignee?.name ? (
                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold text-[10px] flex items-center justify-center">
                        {task.assignee.name[0].toUpperCase()}
                      </div>
                    ) : (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          task.priority === 'URGENT' || task.priority === 'HIGH'
                            ? 'bg-rose-500'
                            : task.priority === 'MEDIUM'
                            ? 'bg-amber-400'
                            : 'bg-blue-400'
                        }`}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {tasks.length === 0 && (
            <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                No tasks on your board yet.
              </p>
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

