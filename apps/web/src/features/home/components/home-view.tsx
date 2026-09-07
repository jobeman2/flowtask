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
  User,
  Video,
  Zap,
  FileText,
  AlertTriangle,
  Layers,
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

  type HomeFilter = 'MY_TASKS_URGENT' | 'URGENT' | 'MEETINGS' | 'ALL';
  const [homeFilter, setHomeFilter] = useState<HomeFilter>('MY_TASKS_URGENT');

  // Dynamic Filter Counts
  const filterCounts = useMemo(() => {
    const now = Date.now();
    let myTasksUrgentCount = 0;
    let urgentCount = 0;
    let meetingCount = 0;

    tasks.forEach((t: any) => {
      const meta = parseTaskMeta(t);
      const isMyTask = t.assigneeId === user?.id || (t.creatorId === user?.id && !t.assigneeId);
      const isUrgent = t.priority === 'URGENT' || t.priority === 'HIGH';
      const isOverdue = t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== 'DONE';
      const isMeeting = meta.isMeeting;

      if (isUrgent || isOverdue) {
        urgentCount++;
      }
      if (isMeeting) {
        meetingCount++;
      }
      if (isMyTask || isUrgent || isOverdue || (isMeeting && t.status !== 'DONE')) {
        myTasksUrgentCount++;
      }
    });

    return {
      myTasksUrgent: myTasksUrgentCount,
      urgent: urgentCount,
      meeting: meetingCount,
      all: tasks.length,
    };
  }, [tasks, user?.id]);

  const filteredTasks = useMemo(() => {
    const now = Date.now();
    return tasks.filter((t: any) => {
      if (homeFilter === 'ALL') return true;
      const meta = parseTaskMeta(t);
      const isUrgent = t.priority === 'URGENT' || t.priority === 'HIGH';
      const isOverdue = t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== 'DONE';
      const isMeeting = meta.isMeeting;

      if (homeFilter === 'URGENT') {
        return isUrgent || isOverdue;
      }
      if (homeFilter === 'MEETINGS') {
        return isMeeting;
      }
      if (homeFilter === 'MY_TASKS_URGENT') {
        const isMyTask = t.assigneeId === user?.id || (t.creatorId === user?.id && !t.assigneeId);
        return isMyTask || isUrgent || isOverdue || (isMeeting && t.status !== 'DONE');
      }
      return true;
    });
  }, [tasks, homeFilter, user?.id]);

  const totalAll = metrics.active + metrics.completed;
  const progressPercent = totalAll > 0 ? Math.round((metrics.completed / totalAll) * 100) : 0;

  // Active highlighted priority task
  const activeFocusTask = tasks.find((t: any) => t.status === 'IN_PROGRESS') || tasks.find((t: any) => t.status !== 'DONE');

  return (
    <div className="space-y-5 pb-32 animate-in fade-in duration-300 font-sans">
      {/* 1. Hero Focus Card (Soft Indigo/Slate Modern Glassmorphic Palette) */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 shadow-xl shadow-slate-950/15 border border-slate-800/80">
        {/* Subtle decorative ambient glow */}
        <div className="absolute -top-12 -right-12 w-44 h-44 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-blue-500/15 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase text-indigo-200 border border-white/10">
                <Sparkles className="w-2.5 h-2.5 text-amber-300 fill-amber-300" />
                <span>Daily Focus</span>
              </span>
              <h2 className="text-xl font-extrabold tracking-tight mt-1 leading-tight truncate text-white">
                {greeting}, {firstName}
              </h2>
            </div>

            {/* Circular Progress Badge - Clean vertical alignment */}
            <div className="flex flex-col items-center justify-center bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl w-14 h-14 shrink-0 shadow-xs">
              <span className="text-base font-black tracking-tight text-white">{progressPercent}%</span>
              <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">done</span>
            </div>
          </div>

          {/* Active Highlight Banner or Progress */}
          {activeFocusTask ? (
            <div
              onClick={() => onSelectTask(activeFocusTask.id)}
              className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-2xl p-3 border border-white/15 cursor-pointer transition-all flex items-center justify-between gap-3 group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300">
                  {activeFocusTask.title?.toLowerCase().startsWith('[meeting]') ? (
                    <>
                      <Video className="w-3 h-3 text-purple-300 shrink-0" />
                      <span className="text-purple-200">Next Meeting</span>
                    </>
                  ) : activeFocusTask.title?.toLowerCase().startsWith('[clickup]') ? (
                    <>
                      <Zap className="w-3 h-3 text-violet-300 fill-violet-300 shrink-0" />
                      <span className="text-violet-200">ClickUp Task</span>
                    </>
                  ) : activeFocusTask.title?.toLowerCase().startsWith('[notion]') ? (
                    <>
                      <FileText className="w-3 h-3 text-slate-300 shrink-0" />
                      <span className="text-slate-200">Notion Task</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3 text-sky-300 shrink-0" />
                      <span className="text-sky-200">Current Task</span>
                    </>
                  )}
                </div>
                <h4 className="text-xs font-bold truncate text-white mt-1 group-hover:text-indigo-100 transition-colors">
                  {activeFocusTask.title?.replace(/^\[(meeting|clickup|notion|ai)\]\s*/i, '')}
                </h4>
              </div>
              <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-white/25 transition-all">
                <ChevronRight className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-3.5 py-2.5 border border-white/15 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-xs font-semibold text-slate-200 truncate">
                  All tasks completed! Great job today.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenCreate}
                className="text-[11px] font-bold px-3 py-1.5 bg-white text-slate-900 rounded-xl shadow-xs hover:bg-slate-100 transition-all active:scale-95 shrink-0 flex items-center gap-1"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
                <span>Add</span>
              </button>
            </div>
          )}

          {/* Progress Bar & Sub-stats (Brand blue/sky gradient palette) */}
          <div className="space-y-1.5 pt-0.5">
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden p-0.5 backdrop-blur-xs">
              <div
                className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300 h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                style={{ width: `${Math.max(5, progressPercent)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-300 font-semibold px-0.5">
              <span>{metrics.completed} Completed</span>
              <span>{metrics.active} Pending</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Metrics Pill Row */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Card 1: Active Tasks */}
        <div
          onClick={onNavigateTasks}
          className="bg-white dark:bg-slate-800/90 rounded-2xl p-3 border border-slate-200/90 dark:border-slate-700/80 shadow-[0_2px_8px_rgba(15,23,42,0.05)] cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-all active:scale-98"
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
          className="bg-white dark:bg-slate-800/90 rounded-2xl p-3 border border-slate-200/90 dark:border-slate-700/80 shadow-[0_2px_8px_rgba(15,23,42,0.05)] cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-all active:scale-98"
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
          className="bg-white dark:bg-slate-800/90 rounded-2xl p-3 border border-slate-200/90 dark:border-slate-700/80 shadow-[0_2px_8px_rgba(15,23,42,0.05)] cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-all active:scale-98"
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
              {filteredTasks.filter((t: any) => t.status !== 'DONE').length} active in this view
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

        {/* Category Filters: My Tasks & Urgent (Default), Urgent Notices, Meetings, All Board */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setHomeFilter('MY_TASKS_URGENT');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              homeFilter === 'MY_TASKS_URGENT'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 border border-slate-200/90 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700/60'
            }`}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            <span>My Tasks & Urgent</span>
            <span className={`text-[10px] ${homeFilter === 'MY_TASKS_URGENT' ? 'text-blue-100' : 'text-slate-400'}`}>
              ({filterCounts.myTasksUrgent})
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setHomeFilter('URGENT');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              homeFilter === 'URGENT'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800/90 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Urgent Notices</span>
            <span className={`text-[10px] ${homeFilter === 'URGENT' ? 'text-rose-100' : 'text-rose-400'}`}>
              ({filterCounts.urgent})
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setHomeFilter('MEETINGS');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              homeFilter === 'MEETINGS'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800/90 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/60 hover:bg-purple-50 dark:hover:bg-purple-950/30'
            }`}
          >
            <Video className="w-3.5 h-3.5 shrink-0" />
            <span>Meetings</span>
            <span className={`text-[10px] ${homeFilter === 'MEETINGS' ? 'text-purple-100' : 'text-purple-400'}`}>
              ({filterCounts.meeting})
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setHomeFilter('ALL');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              homeFilter === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-white dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 border border-slate-200/90 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>All Board</span>
            <span className={`text-[10px] ${homeFilter === 'ALL' ? 'opacity-75' : 'text-slate-400'}`}>
              ({filterCounts.all})
            </span>
          </button>
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
            <div className="p-8 text-center bg-white dark:bg-slate-800/80 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                {homeFilter === 'MY_TASKS_URGENT'
                  ? 'No assigned or urgent tasks right now.'
                  : homeFilter === 'URGENT'
                  ? 'No urgent notices or overdue items.'
                  : homeFilter === 'MEETINGS'
                  ? 'No scheduled meetings.'
                  : 'No tasks on your board yet.'}
              </p>
              {homeFilter === 'ALL' && (
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

