'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  X,
  Star,
  Calendar,
  Flag,
  User,
  Users,
  CheckSquare,
  Square,
} from 'lucide-react';

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const { workspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [isFavorite, setIsFavorite] = useState(true);

  // Fetch Task Details
  const { data: task, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      if (!taskId || !workspaceId) return null;
      const res = await apiClient.getTaskById(taskId, workspaceId);
      return res.data;
    },
    enabled: Boolean(taskId && workspaceId),
  });

  // Complete Task Mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!taskId || !workspaceId) return;
      return apiClient.completeTask(taskId, workspaceId);
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    },
  });

  if (!taskId) return null;

  const isDone = task?.status === 'DONE';
  const projectTag = task?.project?.name || (task?.labels?.[0]?.name ? task.labels[0].name : 'UI/UX Design');

  const priorityColor =
    task?.priority === 'URGENT' || task?.priority === 'HIGH'
      ? 'text-rose-500'
      : task?.priority === 'MEDIUM'
      ? 'text-amber-500'
      : 'text-blue-500';

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Top Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400">Task Details</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
            Loading task details...
          </div>
        ) : task ? (
          <div className="space-y-4">
            {/* Title & Star */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {task.title}
                </h3>
                <div className="mt-2">
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-full">
                    {projectTag}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsFavorite(!isFavorite);
                }}
                className="p-1 text-amber-400 hover:text-amber-500 transition-colors shrink-0"
              >
                <Star className={`w-5 h-5 ${isFavorite ? 'fill-amber-400' : ''}`} />
              </button>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
              {task.description || 'No description provided for this task.'}
            </p>

            {/* Key-Value Attribute Rows */}
            <div className="space-y-2 pt-1 text-xs">
              {/* Due Date */}
              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <span className="font-semibold text-slate-500 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  Due Date
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {formatDueDate(task.dueDate)}
                </span>
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <span className="font-semibold text-slate-500 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-amber-500" />
                  Priority
                </span>
                <span className={`font-bold flex items-center gap-1.5 ${priorityColor}`}>
                  <span className={`w-2 h-2 rounded-full ${task.priority === 'HIGH' || task.priority === 'URGENT' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                  {task.priority || 'MEDIUM'}
                </span>
              </div>

              {/* Assignee */}
              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <span className="font-semibold text-slate-500 flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-500" />
                  Assignee
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {task.assignee?.name || 'Unassigned'}
                </span>
              </div>

              {/* Team */}
              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <span className="font-semibold text-slate-500 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-500" />
                  Team
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {task.workspace?.name || 'FlowTask Board'}
                </span>
              </div>
            </div>

            {/* Subtasks Checklist */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Subtasks</h4>
              <div className="space-y-1.5">
                {[
                  { id: '1', title: 'Create wireframes', completed: true },
                  { id: '2', title: 'Design UI', completed: true },
                  { id: '3', title: 'Get feedback', completed: false },
                ].map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 p-1.5 rounded-lg"
                  >
                    {sub.completed ? (
                      <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className={sub.completed ? 'line-through text-slate-400' : ''}>
                      {sub.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Button: Mark Done / Edit Task */}
            <div className="pt-3">
              <button
                type="button"
                onClick={() => {
                  if (isDone) return;
                  completeMutation.mutate();
                }}
                className={`w-full py-3.5 rounded-2xl font-bold text-sm text-white shadow-md transition-all active:scale-98 ${
                  isDone
                    ? 'bg-emerald-600 cursor-default'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
                }`}
              >
                {isDone ? '✅ Task Completed' : 'Mark as Done'}
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            Task could not be found.
          </div>
        )}
      </div>
    </div>
  );
}
