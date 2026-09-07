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
  Paperclip,
  FileText,
  Mic,
  Plus,
  Trash2,
  ExternalLink,
} from 'lucide-react';

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
}

interface AttachmentItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'document' | 'audio';
  size?: string;
  uploadedAt: string;
}

export function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [isFavorite, setIsFavorite] = useState(true);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Subtasks State (initialized empty and populated from real task description/checklists)
  const [subtasks, setSubtasks] = useState<Array<{ id: string; title: string; completed: boolean }>>([]);

  // Attachments State (initialized empty and populated from real task.imageUrl or uploaded files)
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  // Comment input state
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

  // Sync state when task data loads or changes
  React.useEffect(() => {
    if (!task) return;

    // Attachments: seed from real task attachments or imageUrl
    const initialAtts: AttachmentItem[] = [];
    if (Array.isArray(task.attachments) && task.attachments.length > 0) {
      task.attachments.forEach((a: any, i: number) => {
        initialAtts.push({
          id: a.id || `att-${i}`,
          name: a.name || `Attachment ${i + 1}`,
          url: a.url,
          type: a.type || (a.isImage ? 'image' : 'document'),
          size: a.size || 'Attached',
          uploadedAt: a.uploadedAt || (task.createdAt ? new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Attached'),
        });
      });
    } else if (task.imageUrl) {
      try {
        if (task.imageUrl.startsWith('[')) {
          const parsed = JSON.parse(task.imageUrl);
          parsed.forEach((a: any, i: number) => {
            initialAtts.push({
              id: a.id || `att-${i}`,
              name: a.name || `Attachment ${i + 1}`,
              url: a.url,
              type: a.type || (a.isImage ? 'image' : 'document'),
              size: a.size || 'Attached',
              uploadedAt: a.uploadedAt || 'Attached',
            });
          });
        } else {
          const fileName = task.imageUrl.startsWith('data:')
            ? 'Task Attachment Photo'
            : (task.imageUrl.split('/').pop() || 'Task Image');
          initialAtts.push({
            id: 'att-main',
            name: fileName,
            url: task.imageUrl,
            type: 'image',
            size: 'Attached',
            uploadedAt: task.createdAt
              ? new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : 'Attached',
          });
        }
      } catch {
        initialAtts.push({
          id: 'att-main',
          name: 'Task Image',
          url: task.imageUrl,
          type: 'image',
          size: 'Attached',
          uploadedAt: task.createdAt
            ? new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : 'Attached',
        });
      }
    }
    setAttachments(initialAtts);

    // Subtasks: parse checklist items from description if present (e.g. - [ ] or - [x])
    if (task.description && (task.description.includes('- [ ]') || task.description.includes('- [x]') || task.description.includes('- [X]'))) {
      const lines = task.description.split('\n');
      const parsed: Array<{ id: string; title: string; completed: boolean }> = [];
      lines.forEach((line: string, idx: number) => {
        const uncheckedMatch = line.match(/^-\s*\[\s*\]\s*(.+)$/);
        const checkedMatch = line.match(/^-\s*\[[xX]\]\s*(.+)$/);
        if (uncheckedMatch) {
          parsed.push({ id: `sub-${idx}`, title: uncheckedMatch[1].trim(), completed: false });
        } else if (checkedMatch) {
          parsed.push({ id: `sub-${idx}`, title: checkedMatch[1].trim(), completed: true });
        }
      });
      setSubtasks(parsed);
    } else {
      setSubtasks([]);
    }
  }, [task?.id, task?.imageUrl, task?.attachments, task?.description, task?.createdAt]);

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

  // Add Comment Mutation
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!taskId || !workspaceId || !content.trim()) return;
      return apiClient.addComment(taskId, workspaceId, content.trim());
    },
    onSuccess: () => {
      triggerHaptic('medium');
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  // Delete Task Mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      if (!taskId || !workspaceId) return;
      const res = await apiClient.deleteTask(taskId, workspaceId);
      if (res?.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      triggerHaptic('heavy');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
      onClose();
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      alert(err.message || 'Failed to delete task');
    },
  });

  const handleDeleteTask = () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      deleteTaskMutation.mutate();
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
  };

  if (!taskId) return null;

  const isDone = task?.status === 'DONE';
  const projectTag = task?.project?.name || (task?.labels?.[0]?.name ? task.labels[0].name : 'Default Project');
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    triggerHaptic('medium');
    const filesArray = Array.from(files);

    filesArray.forEach((file) => {
      const isImg = file.type.startsWith('image/');
      const isAudio = file.type.startsWith('audio/');

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const newAtt: AttachmentItem = {
          id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
          name: file.name,
          url: dataUrl,
          type: isImg ? 'image' : isAudio ? 'audio' : 'document',
          size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
          uploadedAt: 'Just now',
        };
        setAttachments((prev) => [newAtt, ...prev]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleDeleteAttachment = (id: string) => {
    triggerHaptic('medium');
    setAttachments(attachments.filter((a) => a.id !== id));
    if (id === 'att-main' && workspaceId && taskId) {
      apiClient.updateTask(taskId, workspaceId, { imageUrl: null }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['task', taskId] });
        queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      });
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || addCommentMutation.isPending) return;
    addCommentMutation.mutate(newComment.trim());
  };

  const commentsList = (task?.comments || []).map((c: any) => ({
    id: c.id,
    user: c.author?.name || 'Teammate',
    avatar: c.author?.avatarUrl,
    text: c.content,
    time: c.createdAt
      ? new Date(c.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Just now',
  }));

  const cleanDescription = task?.description
    ? task.description.replace(/^-\s*\[[ xX]\]\s*.+$/gm, '').trim() || task.description
    : null;

  const allAssignees = Array.isArray(task?.assignees) && task.assignees.length > 0
    ? task.assignees
    : (task?.assignee ? [task.assignee] : []);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in font-sans">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar">
          {/* Top Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Task Overview
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleDeleteTask}
                disabled={deleteTaskMutation.isPending}
                title="Delete Task"
                className="p-1.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
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
                    { id: 'TODO', label: 'To Do' },
                    { id: 'IN_PROGRESS', label: 'In Progress' },
                    { id: 'IN_REVIEW', label: 'In Review' },
                    { id: 'DONE', label: 'Done' },
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
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 font-medium whitespace-pre-wrap">
                {cleanDescription || 'No description provided for this task.'}
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

                {/* Assignees */}
                <div className="flex items-start justify-between pt-2 gap-2">
                  <span className="font-bold text-slate-500 flex items-center gap-2 shrink-0 pt-0.5">
                    <Users className="w-4 h-4 text-purple-500" />
                    Assignees
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {allAssignees.length === 0 ? (
                      <span className="font-extrabold text-slate-400">Unassigned</span>
                    ) : (
                      allAssignees.map((u: any) => (
                        <span
                          key={u.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-200/50 dark:border-purple-800/50"
                        >
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt={u.name} className="w-3.5 h-3.5 rounded-full object-cover" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 text-[9px] flex items-center justify-center font-black">
                              {u.name?.[0]?.toUpperCase() || 'U'}
                            </span>
                          )}
                          <span>{u.name}</span>
                        </span>
                      ))
                    )}
                  </div>
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

              {/* 📎 Attachments & Media Gallery */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-500" />
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                      Attachments & Media
                    </h4>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {attachments.length}
                    </span>
                  </div>

                  {/* Upload button with hidden multiple file input */}
                  <label className="cursor-pointer px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 font-bold text-[10px] flex items-center gap-1 transition-all">
                    <Plus className="w-3 h-3 stroke-[3]" />
                    <span>Upload</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileUpload}
                      accept="image/*,application/pdf,audio/*,.doc,.docx,.zip"
                    />
                  </label>
                </div>

                {/* Attachments List */}
                <div className="space-y-1.5">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2.5 text-xs hover:border-blue-200 transition-all group"
                    >
                      <div
                        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                        onClick={() => {
                          if (att.type === 'image') setPreviewImage(att.url);
                        }}
                      >
                        {att.type === 'image' ? (
                          <img
                            src={att.url}
                            alt={att.name}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-white"
                          />
                        ) : att.type === 'audio' ? (
                          <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center shrink-0">
                            <Mic className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                            {att.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {att.size} • {att.uploadedAt}
                          </p>
                        </div>
                      </div>

                      {/* Actions: View / Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        {att.type === 'image' && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(att.url)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded-lg"
                            title="Preview Image"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          title="Remove Attachment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {attachments.length === 0 && (
                    <div className="p-3 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 font-medium">
                      No files attached yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Subtasks Checklist Section */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                      Checklist & Subtasks
                    </h4>
                    {subtasks.length > 0 && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                        {completedSubtasksCount}/{subtasks.length}
                      </span>
                    )}
                  </div>
                  {subtasks.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-400">{subtasksPercent}%</span>
                  )}
                </div>

                {/* Progress Line */}
                {subtasks.length > 0 && (
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${subtasksPercent}%` }}
                    />
                  </div>
                )}

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

                  {subtasks.length === 0 && (
                    <div className="p-3 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 font-medium">
                      No subtasks or checklist items yet.
                    </div>
                  )}

                  {/* Add Subtask input */}
                  <form onSubmit={handleAddSubtask} className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onFocus={handleInputFocus}
                      placeholder="+ Add subtask item..."
                      enterKeyHint="done"
                      autoCapitalize="sentences"
                      className="flex-1 px-3 py-2 text-[16px] sm:text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white font-medium transition-all focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-xs hover:bg-blue-700 active:scale-95 transition-all"
                    >
                      Add
                    </button>
                  </form>
                </div>
              </div>

              {/* Activity & Discussions Feed */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                      Activity & Discussion
                    </h4>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {commentsList.length}
                  </span>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                  {commentsList.length === 0 ? (
                    <div className="p-3 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 font-medium">
                      No comments or updates yet.
                    </div>
                  ) : (
                    commentsList.map((c: any) => (
                      <div
                        key={c.id}
                        className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs space-y-0.5 border border-slate-100 dark:border-slate-800"
                      >
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            {c.avatar ? (
                              <img src={c.avatar} alt={c.user} className="w-3.5 h-3.5 rounded-full object-cover" />
                            ) : (
                              <span className="w-3.5 h-3.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center text-[8px] font-bold">
                                {c.user[0]?.toUpperCase()}
                              </span>
                            )}
                            {c.user}
                          </span>
                          <span className="text-slate-400 font-medium">{c.time}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed pl-5">
                          {c.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment Box */}
                <form onSubmit={handleAddComment} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onFocus={handleInputFocus}
                    placeholder="Post comment or team note..."
                    enterKeyHint="send"
                    autoCapitalize="sentences"
                    className="flex-1 px-3 py-2 text-[16px] sm:text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white font-medium transition-all focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!newComment.trim() || addCommentMutation.isPending}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

              {/* Action Buttons: Delete Task & Mark as Done */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDeleteTask}
                  disabled={deleteTaskMutation.isPending}
                  className="px-4 py-3.5 rounded-2xl font-extrabold text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/40 active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>

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
                  className={`flex-1 py-3.5 rounded-2xl font-extrabold text-xs text-white shadow-md transition-all active:scale-98 ${
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

      {/* Full Screen Image Lightbox Preview */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 cursor-pointer animate-in fade-in"
        >
          <div className="relative max-w-lg max-h-[85vh]">
            <img
              src={previewImage}
              alt="Attachment Preview"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 p-2 bg-slate-900 text-white rounded-full border border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
