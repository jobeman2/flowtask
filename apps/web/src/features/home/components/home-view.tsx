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
  Video,
  Zap,
  FileText,
} from 'lucide-react';
import { TaskCard, parseTaskMeta } from '../../tasks/components/task-card';

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

  const firstName = user?.name ? String(user.name).split(' ')[0] : 'Teammate';

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

    const activeCount = tasks.length > 0 ? activeTasks.length : stats?.totalActive || 0;
    const completedCount = tasks.length > 0 ? completed : stats?.completed || 0;

    return {
      active: activeCount,
      inProgress,
      completed: completedCount,
      dueToday: dueToday || stats?.dueToday || 0,
    };
  }, [tasks, stats]);

  // Home page: show tasks assigned to me (or created by me if unassigned)
  const myTasks = useMemo(() => {
    return tasks.filter((t: any) => {
      if (t.status === 'DONE') return false;
      // assigned to me, or created by me with no assignee
      return t.assigneeId === user?.id || (t.creatorId === user?.id && !t.assigneeId);
    });
  }, [tasks, user?.id]);

  // Meeting count for filter pill
  const meetingCount = useMemo(() => tasks.filter((t: any) => parseTaskMeta(t).isMeeting && t.status !== 'DONE').length, [tasks]);
  const clickupCount = useMemo(() => tasks.filter((t: any) => parseTaskMeta(t).isClickUp && t.status !== 'DONE').length, [tasks]);
  const notionCount  = useMemo(() => tasks.filter((t: any) => parseTaskMeta(t).isNotion  && t.status !== 'DONE').length, [tasks]);

  const [meetingFilter, setMeetingFilter] = useState(false);

  const displayedTasks = useMemo(() => {
    if (meetingFilter) return tasks.filter((t: any) => parseTaskMeta(t).isMeeting && t.status !== 'DONE');
    return myTasks;
  }, [myTasks, tasks, meetingFilter]);

  const totalAll = metrics.active + metrics.completed;
  const progressPercent = totalAll > 0 ? Math.round((metrics.completed / totalAll) * 100) : 0;

  // Active highlighted priority task (from my tasks)
  const activeFocusTask = myTasks.find((t: any) => t.status === 'IN_PROGRESS') || myTasks[0];
  const activeFocusMeta = activeFocusTask ? parseTaskMeta(activeFocusTask) : null;

  return (
    <div className="space-y-5 pb-32 animate-in fade-in duration-300 font-sans">
      {/* 1. Hero Focus Card — Blue brand palette (softer than full saturation) */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 p-5 text-white shadow-xl shadow-blue-600/25 border border-blue-400/20">
        {/* Subtle decorative glow */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-indigo-300/15 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Row 1: Greeting + Progress badge — always vertically centered */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/15 text-[10px] font-bold tracking-wider uppercase text-blue-100 border border-white/10">
                <Sparkles className="w-2.5 h-2.5 text-amber-300 fill-amber-300" />
                <span>Daily Focus</span>
              </span>
              <h2 className="text-xl font-extrabold tracking-tight mt-1.5 leading-tight text-white">
                {greeting}, {firstName}
              </h2>
            </div>

            {/* Progress badge */}
            <div className="flex flex-col items-center justify-center bg-white/15 border border-white/20 rounded-2xl w-14 h-14 shrink-0">
              <span className="text-base font-black tracking-tight">{progressPercent}%</span>
              <span className="text-[9px] font-bold text-blue-100 uppercase tracking-wider leading-none mt-0.5">done</span>
            </div>
          </div>

          {/* Row 2: Active task banner or all-done state */}
          {activeFocusTask && activeFocusMeta ? (
            <div
              onClick={() => onSelectTask(activeFocusTask.id)}
              className="bg-white/8 hover:bg-white/12 backdrop-blur-md rounded-2xl p-3 border border-white/10 cursor-pointer transition-all flex items-center justify-between gap-3 group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300">
                  {activeFocusMeta.isMeeting ? (
                    <><Video className="w-3 h-3 text-blue-300 shrink-0" /><span className="text-blue-200">Next Meeting</span></>
                  ) : activeFocusMeta.isClickUp ? (
                    <><Zap className="w-3 h-3 text-violet-300 shrink-0 fill-violet-300" /><span className="text-violet-200">ClickUp Task</span></>
                  ) : activeFocusMeta.isNotion ? (
                    <><FileText className="w-3 h-3 text-slate-300 shrink-0" /><span className="text-slate-200">Notion Task</span></>
                  ) : (
                    <><Clock className="w-3 h-3 text-sky-300 shrink-0" /><span className="text-sky-200">Current Task</span></>
                  )}
                </div>
                <h4 className="text-xs font-bold truncate text-white mt-0.5 group-hover:text-indigo-100 transition-colors">
                  {activeFocusMeta.cleanTitle || 'Untitled Task'}
                </h4>
              </div>
              <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ) : (
            <div className="bg-white/10 rounded-2xl px-3.5 py-2.5 border border-white/15 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                <p className="text-xs font-semibold text-blue-100 truncate">All caught up! Great job.</p>
              </div>
              <button
                type="button"
                onClick={onOpenCreate}
                className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 bg-white text-blue-600 rounded-xl shadow-xs hover:bg-blue-50 transition-all active:scale-95 shrink-0"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
                <span>Add</span>
              </button>
            </div>
          )}

            {/* Progress Bar */}
            <div className="space-y-1.5 pt-0.5">
              <div className="w-full bg-black/20 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-white/80 via-blue-100 to-indigo-200 h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_6px_rgba(255,255,255,0.3)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            <div className="flex justify-between text-[11px] text-blue-100 font-semibold px-0.5">
              <span>{metrics.completed} Completed</span>
              <span>{metrics.active} Pending</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Metrics Row */}
      <div className="grid grid-cols-3 gap-2.5">
        <div onClick={onNavigateTasks} className="bg-white dark:bg-slate-900/90 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)] cursor-pointer hover:border-blue-200 transition-all active:scale-98">
          <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
            <Flame className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white leading-none">{metrics.active}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Active Tasks</div>
        </div>

        <div onClick={onNavigateTasks} className="bg-white dark:bg-slate-900/90 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)] cursor-pointer hover:border-blue-200 transition-all active:scale-98">
          <div className="w-7 h-7 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-2">
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white leading-none">{metrics.inProgress}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">In Progress</div>
        </div>

        <div onClick={onNavigateTasks} className="bg-white dark:bg-slate-900/90 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)] cursor-pointer hover:border-blue-200 transition-all active:scale-98">
          <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white leading-none">{metrics.dueToday}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Due Today</div>
        </div>
      </div>

      {/* 3. Task List */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">My Tasks</h3>
            <p className="text-[11px] font-medium text-slate-400">
              {myTasks.length} assigned to you
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

        {/* Filter pills — only Meetings (and ClickUp/Notion if they have items) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); setMeetingFilter(false); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1 ${
              !meetingFilter
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>My Tasks</span>
            <span className="text-[10px] opacity-75">({myTasks.length})</span>
          </button>

          {meetingCount > 0 && (
            <button
              type="button"
              onClick={() => { triggerHaptic('light'); setMeetingFilter(true); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1 ${
                meetingFilter
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
              }`}
            >
              <Video className="w-3 h-3 shrink-0" />
              <span>Meetings</span>
              <span className="text-[10px] opacity-75">({meetingCount})</span>
            </button>
          )}
        </div>

        {/* Task Cards */}
        <div className="space-y-2.5">
          {displayedTasks.slice(0, 10).map((task: any) => (
            <TaskCard
              key={task.id}
              task={task}
              currentUserId={user?.id}
              onSelect={onSelectTask}
              onComplete={(id) => completeMutation.mutate(id)}
              isCompleting={completeMutation.isPending}
            />
          ))}

          {displayedTasks.length === 0 && (
            <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                {meetingFilter ? 'No scheduled meetings.' : 'No tasks assigned to you yet.'}
              </p>
              {!meetingFilter && (
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


