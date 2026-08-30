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
  Send,
  MessageSquare,
} from 'lucide-react';

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [isFavorite, setIsFavorite] = useState(true);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [subtasks, setSubtasks] = useState<Array<{ id: string; title: string; completed: boolean }>>([
    { id: '1', title: 'Prepare requirements and review specs', completed: true },
    { id: '2', title: 'Execute implementation & testing', completed: true },
    { id: '3', title: 'QA review and team verification', completed: false },
  ]);
  const [comments, setComments] = useState<Array<{ id: string; user: string; text: string; time: string }>>([
    { id: '1', user: 'Flow Bot', text: 'Task dispatched to assignee via Telegram DM.', time: '2h ago' },
  ]);
  const [newComment, setNewComment] = useState('');

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

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!taskId || !workspaceId) return;
      return apiClient.updateTask(taskId, workspaceId, { status });
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  if (!taskId) return null;

  const isDone = task?.status === 'DONE';
  const projectTag = task?.project?.name || (task?.labels?.[0]?.name ? task.labels[0].name : 'General Project');
  const projectColor = task?.project?.color || '#2563eb';

  const priorityColor =
    task?.priority === 'URGENT' || task?.priority === 'HIGH'
      ? 'text-rose-500'
      : task?.priority === 'MEDIUM'
      ? 'text-amber-500'
      : 'text-blue-500';

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Not scheduled';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const completedSubtasksCount = subtasks.filter((s) => s.completed).length;
  const subtasksPercent = subtasks.length > 0 ? Math.round((completedSubtasksCount / subtasks.length) * 100) : 0;

  const handleToggleSubtask = (id: string) => {
    triggerHaptic('light');
    setSubtasks(subtasks.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s)));
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    triggerHaptic('medium');
    setSubtasks([...subtasks, { id: String(Date.now()), title: newSubtaskTitle.trim(), completed: false }]);
    setNewSubtaskTitle('');
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    triggerHaptic('medium');
    setComments([
      ...comments,
      {
        id: String(Date.now()),
        user: user?.name || 'You',
        text: newComment.trim(),
        time: 'Just now',
      },
    ]);
    setNewComment('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in font-sans">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Task Overview
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400 animate-pulse font-medium">
            Loading task details...
          </div>
        ) : task ? (
          <div className="space-y-4">
            {/* Title & Favorite Star */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5 min-w-0">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                  {task.title}
                </h3>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1"
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
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    #Task-{task.id.slice(-4).toUpperCase()}
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

            {/* Workflow Stage Pipeline Switcher */}
            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-bold text-slate-500">Status Stage</span>
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                {[
                  { id: 'TODO', label: 'To Do', color: 'text-slate-700 dark:text-slate-300' },
                  { id: 'IN_PROGRESS', label: 'In Progress', color: 'text-amber-600' },
                  { id: 'IN_REVIEW', label: 'In Review', color: 'text-purple-600' },
                  { id: 'DONE', label: 'Done', color: 'text-emerald-600' },
                ].map((st) => {
                  const isCurrent = task.status === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        if (st.id === 'DONE' && task.assigneeId && task.assigneeId !== user?.id) {
                          triggerHaptic('heavy');
                          alert(`Only ${task.assignee?.name || 'the assignee'} can mark this task as done.`);
                          return;
                        }
                        updateStatusMutation.mutate(st.id);
                      }}
                      className={`py-1.5 rounded-xl text-[10px] font-extrabold transition-all ${
                        isCurrent
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-blue-500/20'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 font-medium">
              {task.description || 'No description provided for this task.'}
            </p>

            {/* Key-Value Attributes List */}
            <div className="space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800/60">
              {/* Due Date */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-slate-500 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  Due Date
                </span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {formatDueDate(task.dueDate)}
                </span>
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-slate-500 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-amber-500" />
                  Priority
                </span>
                <span className={`font-extrabold flex items-center gap-1.5 ${priorityColor}`}>
                  <span className={`w-2 h-2 rounded-full ${task.priority === 'HIGH' || task.priority === 'URGENT' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                  {task.priority || 'MEDIUM'}
                </span>
              </div>

              {/* Assignee */}
              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-slate-500 flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-500" />
                  Assignee
                </span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {task.assignee?.name || 'Unassigned'}
                </span>
              </div>

              {/* Team Workspace */}
              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-slate-500 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-500" />
                  Team
                </span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">
                  {task.workspace?.name || 'Flow Workspace'}
                </span>
              </div>
            </div>

            {/* Subtasks Checklist Section */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                    Checklist & Subtasks
                  </h4>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    {completedSubtasksCount}/{subtasks.length}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{subtasksPercent}%</span>
              </div>

              {/* Progress Line */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${subtasksPercent}%` }}
                />
              </div>

              {/* Subtask Items */}
              <div className="space-y-1.5 pt-1">
                {subtasks.map((sub) => (
                  <div
                    key={sub.id}
                    onClick={() => handleToggleSubtask(sub.id)}
                    className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    {sub.completed ? (
                      <CheckSquare className="w-4 h-4 text-blue-600 shrink-0 stroke-[2.5]" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className={`flex-1 font-medium ${sub.completed ? 'line-through text-slate-400' : ''}`}>
                      {sub.title}
                    </span>
                  </div>
                ))}

                {/* Add Subtask input */}
                <form onSubmit={handleAddSubtask} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="+ Add subtask item..."
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white font-medium"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-xs"
                  >
                    Add
                  </button>
                </form>
              </div>
            </div>

            {/* Activity & Discussions Feed */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Activity & Discussion
                </h4>
              </div>

              <div className="space-y-2 max-h-32 overflow-y-auto no-scrollbar">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs space-y-0.5 border border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">{c.user}</span>
                      <span className="text-slate-400 font-medium">{c.time}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                      {c.text}
                    </p>
                  </div>
                ))}
              </div>

              {/* Add Comment Box */}
              <form onSubmit={handleAddComment} className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Post comment or team note..."
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white font-medium"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* Action Button: Mark Done / Complete */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  if (isDone) return;
                  if (task.assigneeId && task.assigneeId !== user?.id) {
                    triggerHaptic('heavy');
                    alert(`Only ${task.assignee?.name || 'the assignee'} can complete this task.`);
                    return;
                  }
                  completeMutation.mutate();
                }}
                className={`w-full py-3.5 rounded-2xl font-extrabold text-xs text-white shadow-md transition-all active:scale-98 ${
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
