'use client';

import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { CreateMeetingModal } from '../../meetings/components/create-meeting-modal';
import { MeetingDetailModal } from '../../meetings/components/meeting-detail-modal';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Check,
  Video,
  Calendar as CalendarIcon,
  ExternalLink,
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
  const [isCreateMeetingOpen, setIsCreateMeetingOpen] = useState(false);
  const [selectedMeetingTask, setSelectedMeetingTask] = useState<any>(null);

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

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const handlePrevMonth = () => {
    triggerHaptic('light');
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    triggerHaptic('light');
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    triggerHaptic('medium');
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <>
      <div className="space-y-4 pb-24 font-sans animate-in fade-in duration-300">
        {/* Top Meeting & Task Quick Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              setIsCreateMeetingOpen(true);
            }}
            className="p-3 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center gap-1.5"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Schedule Meeting</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onOpenCreate();
            }}
            className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-xs shadow-xs hover:border-blue-300 active:scale-98 transition-all flex items-center justify-center gap-1.5"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-blue-500" />
            <span>+ Add Due Task</span>
          </button>
        </div>

        {/* Calendar Card */}
        <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-4 border border-slate-100 dark:border-slate-800/80 shadow-xs space-y-4">
          {/* Calendar Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {monthName}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">Monthly Schedule</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleToday}
                className="px-2.5 py-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 rounded-xl hover:bg-blue-100 transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
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
              {selectedDateTasks.length} {selectedDateTasks.length === 1 ? 'event' : 'events'}
            </span>
          </div>

          <div className="space-y-2.5">
            {selectedDateTasks.map((task) => {
              const isMeeting = task.title.toLowerCase().startsWith('[meeting]');
              const isDone = task.status === 'DONE';
              const projectTag = task.project?.name || (task.labels?.[0]?.name ? task.labels[0].name : 'General');
              const projectColor = task.project?.color || '#2563eb';

              // Extract meeting call link if available
              const urlMatch = task.description?.match(/Join URL:\s*(https?:\/\/[^\n\s]+)/i);
              const joinUrl = urlMatch ? urlMatch[1] : null;

              if (isMeeting) {
                const meetingCleanTitle = task.title.replace(/^\[Meeting\]\s*/i, '');
                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      triggerHaptic('medium');
                      setSelectedMeetingTask(task);
                    }}
                    className="bg-gradient-to-r from-purple-50 via-indigo-50 to-pink-50 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-pink-950/20 rounded-2xl p-3.5 border border-purple-200/80 dark:border-purple-800/60 shadow-xs flex items-center justify-between gap-3 hover:border-purple-400 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Video className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                            MEETING
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {meetingCleanTitle}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          <span>{task.dueDate ? formatTime(task.dueDate) : 'Scheduled'}</span>
                          <span>•</span>
                          <span>Tap for agenda & tasks</span>
                        </div>
                      </div>
                    </div>

                    {joinUrl && (
                      <a
                        href={joinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('heavy');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-blue-600 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs hover:bg-blue-700 shrink-0"
                      >
                        <span>Join</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                );
              }

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
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                          Task
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {task.title}
                        </h4>
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
                <p className="text-xs font-semibold text-slate-400">No events or meetings scheduled</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateMeetingOpen(true)}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Video className="w-3 h-3" />
                    <span>+ Meeting</span>
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={onOpenCreate}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <CalendarIcon className="w-3 h-3" />
                    <span>+ Task</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meeting Modals */}
      <CreateMeetingModal
        isOpen={isCreateMeetingOpen}
        onClose={() => setIsCreateMeetingOpen(false)}
        initialDate={selectedDate}
      />

      <MeetingDetailModal
        isOpen={Boolean(selectedMeetingTask)}
        onClose={() => setSelectedMeetingTask(null)}
        meetingTask={selectedMeetingTask}
      />
    </>
  );
}
