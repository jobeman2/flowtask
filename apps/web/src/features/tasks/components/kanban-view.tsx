'use client';

import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  Clock,
  User,
  Plus,
} from 'lucide-react';

interface KanbanViewProps {
  tasks: any[];
  onSelectTask: (taskId: string) => void;
  onOpenCreate: () => void;
}

export function KanbanView({ tasks, onSelectTask, onOpenCreate }: KanbanViewProps) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      if (!workspaceId) return;
      return apiClient.updateTask(taskId, workspaceId, { status });
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    },
  });

  const columns = [
    {
      id: 'TODO',
      label: 'To Do',
      dotColor: 'bg-slate-400',
      bgLight: 'bg-slate-50 dark:bg-slate-900/50',
      borderLight: 'border-slate-200 dark:border-slate-800',
      nextStatus: 'IN_PROGRESS',
      nextLabel: 'Start →',
    },
    {
      id: 'IN_PROGRESS',
      label: 'In Progress',
      dotColor: 'bg-amber-500',
      bgLight: 'bg-amber-50/40 dark:bg-amber-950/20',
      borderLight: 'border-amber-100 dark:border-amber-900/40',
      nextStatus: 'IN_REVIEW',
      nextLabel: 'Review →',
    },
    {
      id: 'IN_REVIEW',
      label: 'In Review',
      dotColor: 'bg-purple-500',
      bgLight: 'bg-purple-50/40 dark:bg-purple-950/20',
      borderLight: 'border-purple-100 dark:border-purple-900/40',
      nextStatus: 'DONE',
      nextLabel: 'Complete ✓',
    },
    {
      id: 'DONE',
      label: 'Completed',
      dotColor: 'bg-emerald-500',
      bgLight: 'bg-emerald-50/40 dark:bg-emerald-950/20',
      borderLight: 'border-emerald-100 dark:border-emerald-900/40',
      nextStatus: null,
      nextLabel: null,
    },
  ];

  const getPriorityDot = (priority: string) => {
    if (priority === 'URGENT' || priority === 'HIGH') return 'bg-rose-500 ring-rose-500/20';
    if (priority === 'MEDIUM') return 'bg-amber-500 ring-amber-500/20';
    return 'bg-blue-500 ring-blue-500/20';
  };

  const formatDue = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-6 pt-1 snap-x font-sans">
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);

        return (
          <div
            key={col.id}
            className={`w-[280px] shrink-0 ${col.bgLight} rounded-3xl p-3.5 border ${col.borderLight} flex flex-col snap-center space-y-3 shadow-xs`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-200">
                  {col.label}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-2xs border border-slate-100 dark:border-slate-700">
                {colTasks.length}
              </span>
            </div>

            {/* Task Cards in this Column */}
            <div className="space-y-2.5 flex-1 min-h-[120px] max-h-[62vh] overflow-y-auto no-scrollbar">
              {colTasks.map((task) => {
                const dueText = formatDue(task.dueDate);
                const projectTag = task.project?.name || (task.labels?.[0]?.name ? task.labels[0].name : 'General');
                const projectColor = task.project?.color || '#2563eb';

                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-100 dark:border-slate-800/80 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-blue-200 transition-all cursor-pointer space-y-2.5"
                  >
                    {/* Top Row: Tag + Priority */}
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className="text-[9px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1"
                        style={{
                          backgroundColor: `${projectColor}15`,
                          color: projectColor,
                          borderColor: `${projectColor}30`,
                          borderWidth: '1px',
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: projectColor }} />
                        {projectTag}
                      </span>
                      <span className={`w-2 h-2 rounded-full ring-2 ${getPriorityDot(task.priority)}`} />
                    </div>

                    {/* Task Title */}
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                      {task.title}
                    </h4>

                    {/* Footer Row: Assignee + Date + Move Action */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-50 dark:border-slate-800/60 text-[10px] text-slate-400 font-medium">
                      <div className="flex items-center gap-1.5">
                        {task.assignee?.name ? (
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-semibold truncate max-w-[90px]">
                            <User className="w-3 h-3 text-purple-500" />
                            {task.assignee.name.split(' ')[0]}
                          </span>
                        ) : (
                          <span>Unassigned</span>
                        )}
                      </div>

                      {dueText && (
                        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <Clock className="w-3 h-3" />
                          {dueText}
                        </span>
                      )}
                    </div>

                    {/* Quick Move Button */}
                    {col.nextStatus && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (task.assigneeId && task.assigneeId !== user?.id && col.nextStatus === 'DONE') {
                            triggerHaptic('heavy');
                            alert(`Only ${task.assignee?.name || 'the assignee'} can complete this task.`);
                            return;
                          }
                          updateStatusMutation.mutate({
                            taskId: task.id,
                            status: col.nextStatus,
                          });
                        }}
                        className="w-full py-1.5 rounded-xl text-[10px] font-bold bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center gap-1 transition-all"
                      >
                        <span>{col.nextLabel}</span>
                      </button>
                    )}
                  </div>
                );
              })}

              {colTasks.length === 0 && (
                <div className="py-8 text-center text-[11px] font-semibold text-slate-400 dark:text-slate-600 border border-dashed border-slate-200/60 dark:border-slate-800 rounded-2xl">
                  No tasks in {col.label}
                </div>
              )}
            </div>

            {/* Quick Add Button */}
            <button
              type="button"
              onClick={onOpenCreate}
              className="w-full py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 bg-white/60 dark:bg-slate-800/40 hover:bg-white border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
