'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { Button, Badge } from '@flowtask/ui';
import { X, Send, Calendar, User, Tag, MessageSquare, CheckCircle2, Clock } from 'lucide-react';

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const { workspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', taskId, workspaceId],
    queryFn: async () => {
      if (!taskId || !workspaceId) return null;
      const res = await apiClient.request<any>(`/tasks/${taskId}?workspaceId=${workspaceId}`);
      return res.data;
    },
    enabled: Boolean(taskId && workspaceId),
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', taskId, workspaceId],
    queryFn: async () => {
      if (!taskId || !workspaceId) return [];
      const res = await apiClient.request<any[]>(`/tasks/${taskId}/comments?workspaceId=${workspaceId}`);
      return res.data || [];
    },
    enabled: Boolean(taskId && workspaceId),
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!taskId || !workspaceId || !commentText.trim()) return;
      return apiClient.request(`/tasks/${taskId}/comments?workspaceId=${workspaceId}`, {
        method: 'POST',
        body: JSON.stringify({ content: commentText.trim() }),
      });
    },
    onSuccess: () => {
      triggerHaptic('light');
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', taskId, workspaceId] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!taskId || !workspaceId) return;
      return apiClient.request(`/tasks/${taskId}?workspaceId=${workspaceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['task', taskId, workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
    },
  });

  if (!taskId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <select
              value={task?.status || 'TODO'}
              onChange={(e) => updateStatusMutation.mutate(e.target.value)}
              className="text-xs font-semibold uppercase px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-none outline-none cursor-pointer"
            >
              <option value="BACKLOG">Backlog</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading || !task ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Loading task details...
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {task.title}
                </h2>
                {task.description && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                    {task.description}
                  </p>
                )}
              </div>

              {/* Task Metadata Chips */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Badge
                  variant={
                    task.priority === 'URGENT'
                      ? 'destructive'
                      : task.priority === 'HIGH'
                      ? 'warning'
                      : 'secondary'
                  }
                >
                  Priority: {task.priority}
                </Badge>

                {task.project && (
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: task.project.color || '#3b82f6' }}
                  >
                    {task.project.name}
                  </span>
                )}

                {task.dueDate && (
                  <span className="inline-flex items-center text-xs text-slate-500 space-x-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                  </span>
                )}
              </div>

              {/* Comments & Discussion */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <MessageSquare className="w-4 h-4" />
                  <span>Discussion ({comments.length})</span>
                </div>

                {comments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No comments yet. Start the conversation below.</p>
                ) : (
                  <div className="space-y-2">
                    {comments.map((comment: any) => (
                      <div
                        key={comment.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-900 dark:text-slate-200">
                            {comment.author?.name || 'Anonymous'}
                          </span>
                          <span className="text-slate-400">
                            {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300">
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
          className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-2"
        >
          <input
            type="text"
            placeholder="Write a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 rounded-xl outline-none text-slate-900 dark:text-white"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!commentText.trim() || addCommentMutation.isPending}
            className="rounded-xl px-3"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
