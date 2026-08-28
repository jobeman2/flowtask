'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { Button } from '@flowtask/ui';
import { X, Send, Calendar, MessageSquare, Trash2, Check, User } from 'lucide-react';

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const { workspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getWorkspaceMembers(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: Boolean(workspaceId && taskId),
  });

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', taskId, workspaceId],
    queryFn: async () => {
      if (!taskId || !workspaceId) return null;
      const res = await apiClient.getTaskById(taskId, workspaceId);
      return res.data;
    },
    enabled: Boolean(taskId && workspaceId),
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', taskId, workspaceId],
    queryFn: async () => {
      if (!taskId || !workspaceId) return [];
      const res = await apiClient.getComments(taskId, workspaceId);
      return res.data || [];
    },
    enabled: Boolean(taskId && workspaceId),
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!taskId || !workspaceId || !commentText.trim()) return;
      return apiClient.addComment(taskId, workspaceId, commentText.trim());
    },
    onSuccess: () => {
      triggerHaptic('light');
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', taskId, workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!taskId || !workspaceId) return;
      return apiClient.updateTask(taskId, workspaceId, updates);
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['task', taskId, workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      if (!taskId || !workspaceId) return;
      return apiClient.deleteTask(taskId, workspaceId);
    },
    onSuccess: () => {
      triggerHaptic('heavy');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
      onClose();
    },
  });

  if (!taskId) return null;

  const statuses = [
    { id: 'TODO', label: 'To Do', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
    { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400' },
    { id: 'IN_REVIEW', label: 'In Review', color: 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400' },
    { id: 'DONE', label: 'Done', color: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status:</span>
            <select
              value={task?.status || 'TODO'}
              onChange={(e) => updateTaskMutation.mutate({ status: e.target.value })}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-none outline-none cursor-pointer focus:ring-2 focus:ring-blue-500"
            >
              <option value="BACKLOG">Backlog</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center space-x-1">
            {!isConfirmingDelete ? (
              <button
                onClick={() => setIsConfirmingDelete(true)}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="Delete Task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => deleteTaskMutation.mutate()}
                  className="px-2.5 py-1 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
                >
                  Confirm Delete
                </button>
                <button
                  onClick={() => setIsConfirmingDelete(false)}
                  className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading || !task ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Loading task details...
            </div>
          ) : (
            <>
              {/* Quick Status Bar */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                {statuses.map((s) => {
                  const isActive = task.status === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => updateTaskMutation.mutate({ status: s.id })}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isActive && <Check className="w-3 h-3" />}
                      {s.label}
                    </button>
                  );
                })}
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {task.title}
                </h2>
                {task.description && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {task.description}
                  </p>
                )}
              </div>

              {/* Task Metadata Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold ${
                    task.priority === 'URGENT'
                      ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                      : task.priority === 'HIGH'
                      ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      : task.priority === 'MEDIUM'
                      ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  }`}
                >
                  {task.priority} Priority
                </span>

                {task.project && (
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold text-white shadow-sm"
                    style={{ backgroundColor: task.project.color || '#3b82f6' }}
                  >
                    {task.project.name}
                  </span>
                )}

                {task.dueDate && (
                  <span className="inline-flex items-center text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    <span>Due: {new Date(task.dueDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                )}

                {/* Interactive Assignee Picker */}
                <div className="inline-flex items-center text-xs font-semibold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl gap-1.5 border border-slate-200 dark:border-slate-700">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                  <select
                    value={task.assigneeId || ''}
                    onChange={(e) => updateTaskMutation.mutate({ assigneeId: e.target.value || null })}
                    className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m: any) => {
                      const u = m.user || { name: 'Member', id: m.userId };
                      return (
                        <option key={u.id} value={u.id} className="bg-white dark:bg-slate-900">
                          {u.name} ({m.role})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {task.labels && task.labels.length > 0 && task.labels.map((tl: any) => (
                  <span
                    key={tl.labelId || tl.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  >
                    #{tl.label?.name || 'tag'}
                  </span>
                ))}
              </div>

              {/* Comments & Discussion */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                  <div className="flex items-center space-x-1.5">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    <span>Activity & Discussion ({comments.length})</span>
                  </div>
                </div>

                {comments.length === 0 ? (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center text-xs text-slate-400 italic">
                    No comments yet. Post an update or note below!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {comments.map((comment: any) => (
                      <div
                        key={comment.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1.5 border border-slate-100 dark:border-slate-800/80"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 dark:text-slate-200">
                            {comment.author?.name || 'User'}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Comment Input Footer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addCommentMutation.mutate();
          }}
          className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-2 bg-slate-50/50 dark:bg-slate-900"
        >
          <input
            type="text"
            placeholder="Write a comment or update..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 px-3.5 py-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!commentText.trim() || addCommentMutation.isPending}
            className="rounded-xl px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
