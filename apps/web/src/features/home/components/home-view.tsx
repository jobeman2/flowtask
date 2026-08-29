'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  ArrowRight,
  Check,
  Image as ImageIcon,
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

  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0); // 0 = Today, 1 = Tomorrow, -1 = Yesterday

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

  // Calculate dynamic greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Today's Date helpers
  const today = useMemo(() => new Date(), []);

  // Calendar Day Strip (7 days centered around today)
  const calendarDays = useMemo(() => {
    return [-2, -1, 0, 1, 2, 3, 4].map((offset) => {
      const d = new Date();
      d.setDate(today.getDate() + offset);
      return {
        offset,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: d.getDate(),
        isToday: offset === 0,
        fullDate: d,
      };
    });
  }, [today]);

  // Tasks needing attention (Overdue + Due Today + In Progress)
  const focusTasks = useMemo(() => {
    return tasks
      .filter((t: any) => t.status !== 'DONE' && t.status !== 'CANCELLED')
      .sort((a: any, b: any) => {
        // Priority weight
        const pWeight: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
        return (pWeight[b.priority] || 0) - (pWeight[a.priority] || 0);
      })
      .slice(0, 5);
  }, [tasks]);

  // Filter tasks for selected day in timeline
  const dayTimelineTasks = useMemo(() => {
    const targetDate = new Date();
    targetDate.setDate(today.getDate() + selectedDayOffset);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999).getTime();

    return tasks.filter((t: any) => {
      if (!t.dueDate) {
        // If no due date and viewing Today, show high priority active tasks
        return selectedDayOffset === 0 && t.status !== 'DONE';
      }
      const dueTime = new Date(t.dueDate).getTime();
      return dueTime >= startOfDay && dueTime <= endOfDay;
    });
  }, [tasks, selectedDayOffset, today]);

  const activeCount = stats?.totalActive ?? 0;
  const dueTodayCount = stats?.dueToday ?? 0;
  const overdueCount = stats?.overdue ?? 0;
  const completedCount = stats?.completed ?? 0;
  const completionRate = activeCount + completedCount > 0
    ? Math.round((completedCount / (activeCount + completedCount)) * 100)
    : 0;

  return (
    <div className="space-y-5 pb-24 animate-in fade-in">
      {/* 1. Header Greeting & Command Center Banner */}
      <section className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-bold text-flow-600 dark:text-flow-400 uppercase tracking-wider block">
              {greeting}, {user?.name?.split(' ')[0] || 'there'} 👋
            </span>
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
              {overdueCount > 0
                ? `${overdueCount} overdue · ${dueTodayCount} due today`
                : dueTodayCount > 0
                ? `${dueTodayCount} tasks due today`
                : 'All caught up for today!'}
            </h2>
          </div>

          {/* Quick Circular Progress Ring */}
          <div className="p-2.5 bg-flow-50 dark:bg-flow-950/50 rounded-2xl border border-flow-200/80 dark:border-flow-900 text-center shrink-0">
            <span className="block text-[10px] font-bold text-flow-700 dark:text-flow-300 uppercase">Done</span>
            <span className="text-sm font-black text-flow-700 dark:text-flow-400">{completionRate}%</span>
          </div>
        </div>
      </section>

      {/* 2. Hero Focus Carousel (Swipeable featured task cards) */}
      {focusTasks.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-xs font-black text-slate-900 dark:text-white tracking-tight uppercase">
              Focus Tasks
            </span>
            <button
              type="button"
              onClick={onNavigateTasks}
              className="text-[11px] font-bold text-flow-600 dark:text-flow-400 hover:underline flex items-center gap-0.5"
            >
              <span>View all ({tasks.length})</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-3 pt-1 no-scrollbar -mx-4 px-4 snap-x snap-mandatory">
            {focusTasks.map((task: any, index: number) => {
              const isFirst = index === 0;
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

              return (
                <div
                  key={task.id}
                  onClick={() => {
                    triggerHaptic('light');
                    onSelectTask(task.id);
                  }}
                  className={`w-[84vw] max-w-[310px] shrink-0 snap-center p-4 rounded-3xl cursor-pointer transition-all active:scale-[0.98] relative overflow-hidden flex flex-col justify-between min-h-[145px] ${
                    isFirst
                      ? 'bg-gradient-to-br from-flow-700 via-flow-600 to-teal-500 text-white shadow-flow-md'
                      : 'bg-slate-900 text-white dark:bg-slate-900 border border-slate-800 shadow-md'
                  }`}
                >
                  {/* Decorative Background Pattern */}
                  <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-xl pointer-events-none" />

                  {/* Top Metadata */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        isFirst
                          ? 'bg-white/20 text-white backdrop-blur-xs'
                          : 'bg-flow-500/20 text-flow-300'
                      }`}
                    >
                      {task.priority || 'NORMAL'}
                    </span>

                    {task.dueDate && (
                      <span className="text-[11px] font-bold text-white/80 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {isOverdue ? 'Overdue' : new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div className="my-3 space-y-1">
                    <h3 className="font-bold text-base text-white line-clamp-2 leading-tight">
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="text-xs text-white/70 line-clamp-1">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Bottom Footer: Progress & Teammate Avatar */}
                  <div className="pt-2 border-t border-white/15 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {task.assignee ? (
                        <div className="flex items-center gap-1">
                          {task.assignee.avatarUrl ? (
                            <img
                              src={task.assignee.avatarUrl}
                              alt={task.assignee.name || 'Assignee'}
                              className="w-5 h-5 rounded-full object-cover ring-1 ring-white"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                              {task.assignee.name?.[0] || 'U'}
                            </div>
                          )}
                          <span className="text-[11px] text-white/90 font-medium">
                            {task.assignee.name?.split(' ')[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-white/60">Unassigned</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {task.imageUrl && <ImageIcon className="w-3.5 h-3.5 text-white/80" />}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/15">
                        {task.status === 'IN_PROGRESS' ? 'In Progress' : 'To Do'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Interactive Calendar Strip */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-xs font-black text-slate-900 dark:text-white tracking-tight uppercase">
            Schedule & Agenda
          </span>
          <span className="text-xs font-semibold text-slate-400">
            {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div className="flex items-center justify-between gap-1 p-1.5 bg-slate-100 dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          {calendarDays.map((day) => {
            const isSelected = selectedDayOffset === day.offset;

            return (
              <button
                key={day.offset}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedDayOffset(day.offset);
                }}
                className={`flex-1 py-2 rounded-xl flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-gradient-to-tr from-flow-700 via-flow-600 to-teal-500 text-white shadow-flow-sm scale-105 font-bold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className={`text-[10px] uppercase font-bold ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                  {day.dayName}
                </span>
                <span className="text-sm font-black mt-0.5">
                  {day.dayNumber}
                </span>
                {day.isToday && !isSelected && (
                  <span className="w-1 h-1 rounded-full bg-flow-600 dark:bg-flow-400 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Day Timeline Agenda List */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {selectedDayOffset === 0 ? "Today's Queue" : selectedDayOffset === 1 ? "Tomorrow's Tasks" : "Day Agenda"}
          </span>
          <span className="text-xs font-bold text-flow-600 bg-flow-50 dark:bg-flow-950/40 px-2 py-0.5 rounded-lg">
            {dayTimelineTasks.length} tasks
          </span>
        </div>

        {dayTimelineTasks.length === 0 ? (
          <div className="p-6 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-flow-50 dark:bg-flow-950/60 text-flow-600 flex items-center justify-center mx-auto shadow-inner">
              <Check className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                No tasks scheduled for this day
              </h4>
              <p className="text-xs text-slate-400 mt-0.5 max-w-xs mx-auto">
                Turn any Telegram message or conversation into an actionable FlowTask.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-flow-600 hover:bg-flow-700 text-white font-bold text-xs shadow-flow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Task</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {dayTimelineTasks.map((task: any) => {
              const isDone = task.status === 'DONE';
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDone;

              return (
                <div
                  key={task.id}
                  onClick={() => {
                    triggerHaptic('light');
                    onSelectTask(task.id);
                  }}
                  className={`p-3.5 bg-white dark:bg-slate-900 rounded-2xl border transition-all cursor-pointer hover:border-flow-300 dark:hover:border-slate-700 shadow-xs active:scale-[0.99] flex items-center justify-between gap-3 ${
                    isDone ? 'opacity-50 bg-slate-50 dark:bg-slate-900/40' : ''
                  } ${isOverdue ? 'border-rose-200 dark:border-rose-900/40' : 'border-slate-200/80 dark:border-slate-800'}`}
                >
                  {/* Left Checkbox & Title */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        !isDone && completeMutation.mutate(task.id);
                      }}
                      className="text-slate-400 hover:text-flow-600 transition-colors shrink-0"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-flow-600" />
                      ) : (
                        <Circle className="w-5 h-5 hover:text-flow-600" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-bold leading-snug truncate ${
                          isDone
                            ? 'line-through text-slate-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {task.title}
                      </p>

                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                        {task.project && (
                          <span
                            className="font-bold px-1.5 py-0.2 rounded"
                            style={{ color: task.project.color || '#0d9488' }}
                          >
                            {task.project.name}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className={isOverdue ? 'text-rose-600 font-bold' : ''}>
                            {new Date(task.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Assignee / Priority Pill */}
                  <div className="shrink-0 flex items-center gap-2">
                    {task.assignee && (
                      <div className="flex items-center">
                        {task.assignee.avatarUrl ? (
                          <img
                            src={task.assignee.avatarUrl}
                            alt={task.assignee.name || 'Assignee'}
                            className="w-5 h-5 rounded-full object-cover ring-1 ring-white dark:ring-slate-800"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-flow-100 text-flow-700 flex items-center justify-center text-[10px] font-bold">
                            {task.assignee.name?.[0] || 'A'}
                          </div>
                        )}
                      </div>
                    )}

                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${
                        task.priority === 'URGENT'
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                          : task.priority === 'HIGH'
                          ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                          : 'bg-flow-50 text-flow-700 dark:bg-flow-950/60 dark:text-flow-300'
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
