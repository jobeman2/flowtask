'use client';

import React, { useState, useMemo } from 'react';
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
import { TaskCard, parseTaskMeta, TaskCategory } from '../../tasks/components/task-card';

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

  // 1. Fetch Task Statistics (Live synchronized)
  const { data: stats } = useQuery({
    queryKey: ['task-stats', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const res = await apiClient.getTaskStats(workspaceId);
      return res.data;
    },
    enabled: Boolean(workspaceId),
    refetchInterval: 3000,
  });

  // 2. Fetch Tasks (Live synchronized)
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getTasks(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: Boolean(workspaceId),
    refetchInterval: 3000,
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

  const [categoryFilter, setCategoryFilter] = useState<TaskCategory>('ALL');

  // Dynamic Category Counts
  const categoryCounts = useMemo(() => {
    let taskCount = 0;
    let meetingCount = 0;
    let clickupCount = 0;
    let notionCount = 0;

    tasks.forEach((t: any) => {
      const meta = parseTaskMeta(t);
      if (meta.isMeeting) meetingCount++;
      else if (meta.isClickUp) clickupCount++;
      else if (meta.isNotion) notionCount++;
      else taskCount++;
    });

    return {
      all: tasks.length,
      task: taskCount,
      meeting: meetingCount,
      clickup: clickupCount,
      notion: notionCount,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t: any) => {
      if (categoryFilter === 'ALL') return true;
      const meta = parseTaskMeta(t);
      if (categoryFilter === 'MEETING') return meta.isMeeting;
      if (categoryFilter === 'CLICKUP') return meta.isClickUp;
      if (categoryFilter === 'NOTION') return meta.isNotion;
      if (categoryFilter === 'TASK') return !meta.isMeeting && !meta.isClickUp && !meta.isNotion;
      return true;
    });
  }, [tasks, categoryFilter]);

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
                  <span>
                    {activeFocusTask.title?.toLowerCase().startsWith('[meeting]')
                      ? '🎙️ Next Meeting'
                      : activeFocusTask.title?.toLowerCase().startsWith('[clickup]')
                      ? '⚡ ClickUp Task'
                      : activeFocusTask.title?.toLowerCase().startsWith('[notion]')
                      ? '📓 Notion Task'
                      : 'Current Task'}
                  </span>
                </div>
                <h4 className="text-xs font-bold truncate text-white mt-0.5 group-hover:text-blue-100 transition-colors">
                  {activeFocusTask.title?.replace(/^\[(meeting|clickup|notion|ai)\]\s*/i, '')}
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

        {/* Category Filters: All, Tasks, Meetings, ClickUp, Notion */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setCategoryFilter('ALL');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1 ${
              categoryFilter === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>All</span>
            <span className="text-[10px] opacity-75">({categoryCounts.all})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setCategoryFilter('TASK');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1 ${
              categoryFilter === 'TASK'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>📋 Tasks</span>
            <span className="text-[10px] opacity-75">({categoryCounts.task})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setCategoryFilter('MEETING');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1 ${
              categoryFilter === 'MEETING'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100'
            }`}
          >
            <span>🎙️ Meetings</span>
            <span className="text-[10px] opacity-75">({categoryCounts.meeting})</span>
          </button>

          {(categoryCounts.clickup > 0 || categoryFilter === 'CLICKUP') && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setCategoryFilter('CLICKUP');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1 ${
                categoryFilter === 'CLICKUP'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100'
              }`}
            >
              <span>⚡ ClickUp</span>
              <span className="text-[10px] opacity-75">({categoryCounts.clickup})</span>
            </button>
          )}

          {(categoryCounts.notion > 0 || categoryFilter === 'NOTION') && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setCategoryFilter('NOTION');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1 ${
                categoryFilter === 'NOTION'
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <span>📓 Notion</span>
              <span className="text-[10px] opacity-75">({categoryCounts.notion})</span>
            </button>
          )}
        </div>

        {/* 4. Task Cards */}
        <div className="space-y-2.5">
          {filteredTasks.slice(0, 10).map((task: any) => (
            <TaskCard
              key={task.id}
              task={task}
              currentUserId={user?.id}
              onSelect={onSelectTask}
              onComplete={(id) => completeMutation.mutate(id)}
              isCompleting={completeMutation.isPending}
            />
          ))}

          {filteredTasks.length === 0 && (
            <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                {categoryFilter === 'ALL'
                  ? 'No tasks on your board yet.'
                  : `No ${categoryFilter.toLowerCase()} items found.`}
              </p>
              {categoryFilter === 'ALL' && (
                <button
                  type="button"
                  onClick={onOpenCreate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-500/25 hover:bg-blue-700 transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Create First Task</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

