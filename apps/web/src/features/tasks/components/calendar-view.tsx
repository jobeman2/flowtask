'use client';

import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Check,
} from 'lucide-react';

interface CalendarViewProps {
  tasks: any[];
  onSelectTask: (taskId: string) => void;
  onOpenCreate: () => void;
}

export function CalendarView({ tasks, onSelectTask, onOpenCreate }: CalendarViewProps) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

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

  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Compute month days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayIndex = (firstDay.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDay.getDate();

    const days = [];

    // Empty padding slots
    for (let i = 0; i < startingDayIndex; i++) {
      days.push({ dayNumber: null, dateObj: null });
    }

    // Actual days
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, month, d);
      days.push({ dayNumber: d, dateObj });
    }

    return days;
  }, [currentDate]);

  // Tasks for the currently selected date
  const selectedDateTasks = useMemo(() => {
    const selYear = selectedDate.getFullYear();
    const selMonth = selectedDate.getMonth();
    const selDay = selectedDate.getDate();

    return tasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return (
        d.getFullYear() === selYear &&
        d.getMonth() === selMonth &&
        d.getDate() === selDay
      );
    });
  }, [tasks, selectedDate]);

  // Check if date has tasks
  const hasTasksOnDate = (dateObj: Date | null) => {
    if (!dateObj) return false;
    const y = dateObj.getFullYear();
    const m = dateObj.getMonth();
    const d = dateObj.getDate();

    return tasks.some((t) => {
      if (!t.dueDate) return false;
      const dt = new Date(t.dueDate);
      return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
    });
  };

  const handlePrevMonth = () => {
    triggerHaptic('light');
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    triggerHaptic('light');
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4 font-sans animate-in fade-in">
      {/* Month Navigator Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-100 dark:border-slate-800/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
            {monthName}
          </h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 text-center text-[10px] font-extrabold text-slate-400">
          <span>MO</span>
          <span>TU</span>
          <span>WE</span>
          <span>TH</span>
          <span>FR</span>
          <span>SA</span>
          <span>SU</span>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
          {calendarDays.map((item, idx) => {
            if (!item.dayNumber || !item.dateObj) {
              return <div key={`empty-${idx}`} className="h-8" />;
            }

            const isSelected = isSameDay(item.dateObj, selectedDate);
            const isToday = isSameDay(item.dateObj, new Date());
            const hasTask = hasTasksOnDate(item.dateObj);

            return (
              <button
                key={item.dayNumber}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  if (item.dateObj) setSelectedDate(item.dateObj);
                }}
                className={`h-8 w-8 mx-auto rounded-full flex flex-col items-center justify-center font-bold relative transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-105'
                    : isToday
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-extrabold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{item.dayNumber}</span>
                {hasTask && !isSelected && (
                  <span className="w-1 h-1 bg-blue-500 rounded-full absolute bottom-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Date Agenda Feed */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
            <span>Agenda for</span>
            <span className="text-blue-600 dark:text-blue-400">
              {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </h4>
          <span className="text-[10px] font-bold text-slate-400">
            {selectedDateTasks.length} {selectedDateTasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        <div className="space-y-2.5">
          {selectedDateTasks.map((task) => {
            const isDone = task.status === 'DONE';
            const projectTag = task.project?.name || (task.labels?.[0]?.name ? task.labels[0].name : 'General');
            const projectColor = task.project?.color || '#2563eb';

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] flex items-center justify-between gap-3 hover:border-blue-200 transition-all cursor-pointer group"
              >
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
                      className={`text-[13px] font-bold truncate ${
                        isDone ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {task.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[9px] font-extrabold px-2 py-0.2 rounded-md"
                        style={{
                          backgroundColor: `${projectColor}15`,
                          color: projectColor,
                        }}
                      >
                        {projectTag}
                      </span>
                    </div>
                  </div>
                </div>

                {task.dueDate && (
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    <span>{formatTime(task.dueDate)}</span>
                  </div>
                )}
              </div>
            );
          })}

          {selectedDateTasks.length === 0 && (
            <div className="p-6 text-center bg-white dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <p className="text-xs font-semibold text-slate-400">No tasks scheduled for this day</p>
              <button
                type="button"
                onClick={onOpenCreate}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                + Schedule a task
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
