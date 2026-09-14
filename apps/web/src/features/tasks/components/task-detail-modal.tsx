'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { useNotifications } from '../../../providers/notification-provider';
import {
  X,
  Calendar,
  Flag,
  User,
  Users,
  Send,
  MessageSquare,
  Paperclip,
  FileText,
  Mic,
  Plus,
  Trash2,
  ExternalLink,
  Building2,
  CheckCircle2,
  Video,
  Edit3,
  RotateCcw,
  Download,
  Eye,
  Zap,
  Sparkles,
  Loader2,
  Check,
  Reply,
  CornerDownRight,
  Edit2,
} from 'lucide-react';
import { parseTaskMeta } from './task-card';
import { MeetingDetailModal } from '../../meetings/components/meeting-detail-modal';

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.65));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

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
  uploaderId?: string;
  uploaderName?: string;
}

export function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  const [isUploading, setIsUploading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);

  // Editing Task State for Creator / Admin
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
  const [isAssignDropdownOpen, setIsAssignDropdownOpen] = useState(false);
  const [assignMemberSearch, setAssignMemberSearch] = useState('');
  const [editPriority, setEditPriority] = useState<string>('MEDIUM');
  const [editDueDate, setEditDueDate] = useState('');

  // Comment reply & edit state
  const [replyingTo, setReplyingTo] = useState<{ id: string; author: string; snippet: string } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState<string>('');

  // Attachments State (initialized empty and populated from real task.imageUrl or uploaded files)
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  // Comment input state
  const [newComment, setNewComment] = useState('');

  const handleClose = () => {
    setIsEditing(false);
    setPreviewAttachment(null);
    setNewComment('');
    setIsAssignDropdownOpen(false);
    setReplyingTo(null);
    setEditingCommentId(null);
    setEditCommentText('');
    onClose();
  };

  React.useEffect(() => {
    if (!taskId) {
      setIsEditing(false);
      setPreviewAttachment(null);
      setNewComment('');
      setIsAssignDropdownOpen(false);
      setReplyingTo(null);
      setEditingCommentId(null);
      setEditCommentText('');
    }
  }, [taskId]);

  // Fetch Task Details
  const { data: task, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      if (!taskId || !workspaceId) return null;
      const res = await apiClient.getTaskById(taskId, workspaceId);
      return res.data;
    },
    enabled: Boolean(taskId && workspaceId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Sync state when task data loads or changes
  React.useEffect(() => {
    if (!task) return;

    setEditTitle(task.title || '');
    setEditDescription(task.description || '');
    const initialAssigneeIds = Array.isArray(task.assignees) && task.assignees.length > 0
      ? task.assignees.map((a: any) => a.id)
      : (task.assigneeId ? [task.assigneeId] : []);
    setEditAssigneeIds(initialAssigneeIds);
    setEditPriority(task.priority || 'MEDIUM');
    setEditDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '');

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
  }, [task?.id, task?.imageUrl, task?.attachments, task?.description, task?.createdAt, task?.status]);

  // Auto-progress: when task is opened, if it's TODO, auto-move to IN_PROGRESS
  React.useEffect(() => {
    if (!task || !workspaceId || !task.id) return;
    if (task.status === 'TODO' && task.assigneeId) {
      apiClient.updateTask(task.id, workspaceId, { status: 'IN_PROGRESS' }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['task', task.id] });
        queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      }).catch(() => {});
    }
  }, [task?.id]); // Only run once when task loads

  // Complete Task Mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!taskId || !workspaceId) return;
      // Use updateTask with status:DONE for reliability (same as status pipeline)
      return apiClient.updateTask(taskId, workspaceId, { status: 'DONE' });
    },
    onSuccess: () => {
      triggerHaptic('heavy');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
      addNotification({ type: 'TASK_COMPLETED', title: 'Task Completed', message: `"${task?.title || 'Task'}" marked as done` });
    },
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!taskId || !workspaceId) return;
      return apiClient.updateTask(taskId, workspaceId, { status });
    },
    onSuccess: (_data, status) => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
      if (status === 'IN_PROGRESS') {
        addNotification({ type: 'SYSTEM', title: 'Task Reopened', message: 'Task moved back to In Progress' });
      }
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
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  // Update Comment Mutation
  const updateCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      if (!taskId || !workspaceId) return;
      const res = await apiClient.updateComment(taskId, commentId, workspaceId, content);
      if (res?.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      triggerHaptic('medium');
      setEditingCommentId(null);
      setEditCommentText('');
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      alert(err.message || 'Failed to update comment');
    },
  });

  // Delete Comment Mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!taskId || !workspaceId) return;
      const res = await apiClient.deleteComment(taskId, commentId, workspaceId);
      if (res?.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      alert(err.message || 'Failed to delete comment');
    },
  });

  // Workspaces Query to check User's Role (Owner, Admin, Member)
  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces', user?.id],
    queryFn: async () => {
      const res = await apiClient.getWorkspaces();
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: !!user,
  });

  const currentWorkspace = workspaces.find((w: any) => w.id === workspaceId);
  const userRole = currentWorkspace?.role;
  const isOwnerOrAdmin = userRole === 'OWNER' || userRole === 'ADMIN';
  const isCreator = Boolean(task?.creatorId && task.creatorId === user?.id);
  const canDeleteTask = isOwnerOrAdmin || isCreator;
  const canEditTask = isOwnerOrAdmin || isCreator;

  // Workspace Members for Assignee selection
  const { data: members = [] } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getWorkspaceMembers(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: Boolean(workspaceId),
  });

  // Update Task Mutation (Title, Description, Assignee, Priority, Due Date, etc.)
  const updateTaskMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!taskId || !workspaceId) return;
      const res = await apiClient.updateTask(taskId, workspaceId, payload);
      if (res?.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
      setIsEditing(false);
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      alert(err.message || 'Failed to update task');
    },
  });

  const persistAttachments = async (newAtts: AttachmentItem[]) => {
    if (!taskId || !workspaceId) return;
    try {
      setIsUploading(true);
      const jsonStr = newAtts.length > 0 ? JSON.stringify(newAtts) : null;
      const res = await apiClient.updateTask(taskId, workspaceId, {
        attachments: newAtts,
        imageUrl: jsonStr,
      });
      if (res?.error) {
        throw new Error(res.error);
      }
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    } catch (err: any) {
      triggerHaptic('heavy');
      alert(err.message || 'Failed to save attachment');
    } finally {
      setIsUploading(false);
    }
  };

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

      const deletedTitle = task?.title || 'Task';
      addNotification({
        type: 'SYSTEM',
        title: 'Task Deleted',
        message: `"${deletedTitle}" has been removed`,
      });

      onClose();
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      alert(err.message || 'Failed to delete task');
    },
  });

  const handleDeleteTask = () => {
    if (!canDeleteTask) {
      alert('Only the task creator or a workspace admin can delete this task.');
      return;
    }
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

  const meta = parseTaskMeta(task);

  if (task && meta.isMeeting) {
    return (
      <MeetingDetailModal
        isOpen={Boolean(taskId)}
        onClose={onClose}
        meetingTask={task}
      />
    );
  }

  const canDeleteAttachment = (att?: AttachmentItem | null) => {
    if (!att) return false;
    if (isOwnerOrAdmin || isCreator) return true;
    if (att.uploaderId && user?.id && att.uploaderId === user.id) return true;
    return false;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    triggerHaptic('medium');
    setIsUploading(true);
    const filesArray = Array.from(files);
    const newItems: AttachmentItem[] = [];

    try {
      for (const file of filesArray) {
        if (file.size > 10 * 1024 * 1024) {
          alert(`"${file.name}" is larger than 10MB limit.`);
          continue;
        }

        const isImg = file.type.startsWith('image/');
        const isAudio = file.type.startsWith('audio/');
        const dataUrl = await compressImageFile(file);

        const newAtt: AttachmentItem = {
          id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
          name: file.name,
          url: dataUrl,
          type: isImg ? 'image' : isAudio ? 'audio' : 'document',
          size: `${Math.max(1, Math.round((dataUrl.length * 0.75) / 1024))} KB`,
          uploadedAt: 'Just now',
          uploaderId: user?.id,
          uploaderName: user?.name || user?.username || 'You',
        };
        newItems.push(newAtt);
      }

      if (newItems.length > 0) {
        const updated = [...newItems, ...attachments];
        setAttachments(updated);
        await persistAttachments(updated);
      }
    } catch (err: any) {
      triggerHaptic('heavy');
      alert(err.message || 'Failed to upload attachment');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = (id: string) => {
    const target = attachments.find((a) => a.id === id);
    if (target && !canDeleteAttachment(target)) {
      triggerHaptic('heavy');
      alert('Only the member who attached this file or a workspace admin can remove it.');
      return;
    }
    triggerHaptic('medium');
    const updated = attachments.filter((a) => a.id !== id);
    setAttachments(updated);
    persistAttachments(updated);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || addCommentMutation.isPending) return;
    let finalContent = newComment.trim();
    if (replyingTo) {
      finalContent = `[replyTo:${replyingTo.id}|${replyingTo.author}] ${finalContent}`;
    }
    addCommentMutation.mutate(finalContent);
  };

  const commentsList = (task?.comments || []).map((c: any) => {
    let rawText = c.content || '';
    let replyMeta: { id: string; author: string } | null = null;
    const match = rawText.match(/^\[replyTo:([^|\]]+)\|([^\]]+)\]\s*/);
    if (match) {
      replyMeta = { id: match[1], author: match[2] };
      rawText = rawText.replace(match[0], '');
    }

    return {
      id: c.id,
      authorId: c.authorId || c.author?.id,
      user: c.author?.name || 'Teammate',
      avatar: c.author?.avatarUrl,
      text: rawText,
      replyMeta,
      time: c.createdAt
        ? new Date(c.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Just now',
    };
  });

  const cleanDescription = task?.description
    ? task.description.replace(/^-\s*\[[ xX]\]\s*.+$/gm, '').trim() || task.description
    : null;

  const allAssignees: any[] = Array.isArray(task?.assignees) && task.assignees.length > 0
    ? task.assignees
    : (task?.assignee ? [task.assignee] : []);
  const currentAssigneeIds = allAssignees.map((a: any) => a.id);

  const completedUserIds: string[] = Array.isArray(task?.completedAssigneeIds)
    ? task.completedAssigneeIds
    : (task?.status === 'DONE' ? currentAssigneeIds : []);

  const isAssigneeOfTask = user?.id ? currentAssigneeIds.includes(user.id) : false;
  const isMyPartDone = user?.id ? completedUserIds.includes(user.id) : false;

  const handleAddAssignee = (targetUserId: string) => {
    triggerHaptic('medium');
    const updated = Array.from(new Set([...currentAssigneeIds, targetUserId]));
    updateTaskMutation.mutate({ assigneeIds: updated });
    setIsAssignDropdownOpen(false);
  };

  const handleRemoveAssignee = (targetUserId: string) => {
    triggerHaptic('medium');
    const updated = currentAssigneeIds.filter((id: string) => id !== targetUserId);
    updateTaskMutation.mutate({ assigneeIds: updated });
  };

  const handleToggleMyCompletion = () => {
    if (!user?.id) return;
    triggerHaptic('medium');
    const isDoneCurrently = completedUserIds.includes(user.id);
    const updated = isDoneCurrently
      ? completedUserIds.filter((id) => id !== user.id)
      : [...completedUserIds, user.id];
    updateTaskMutation.mutate({ completedAssigneeIds: updated });
  };

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm font-sans">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/60 dark:border-slate-800 max-h-[90dvh] flex flex-col animate-in slide-in-from-bottom duration-200">
          {/* Top Fixed Header */}
          <div className="flex items-center justify-between p-4 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-0.5">Task Details</p>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Task Overview</h3>
            </div>
            <div className="flex items-center gap-1.5">
              {canEditTask && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setIsEditing(!isEditing);
                  }}
                  title={isEditing ? 'Close Edit Form' : 'Edit Task'}
                  className={`p-1.5 rounded-full transition-colors ${
                    isEditing
                      ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400'
                      : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
              {canDeleteTask && (
                <button
                  type="button"
                  onClick={handleDeleteTask}
                  disabled={deleteTaskMutation.isPending}
                  title="Delete Task"
                  className="p-1.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleClose}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 animate-pulse font-medium">
              Loading task details...
            </div>
          ) : task ? (
            <div className="space-y-4">
              {/* Edit Task Form (for Creator or Admin) */}
              {isEditing && (
                <div className="space-y-3 p-3.5 bg-blue-50/50 dark:bg-blue-950/30 rounded-3xl border border-blue-200 dark:border-blue-800/60 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Task Details
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Task title..."
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-slate-900 dark:text-white focus:border-blue-500"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      placeholder="Add task description..."
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium text-slate-900 dark:text-white focus:border-blue-500 resize-none"
                    />
                  </div>

                  {/* Assignees Multi-Selection */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                        Assignees ({editAssigneeIds.length})
                      </label>
                      {editAssigneeIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setEditAssigneeIds([])}
                          className="text-[10px] text-rose-500 font-bold hover:underline"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    <div className="max-h-32 overflow-y-auto p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-0.5">
                      {members.map((m: any) => {
                        const isChecked = editAssigneeIds.includes(m.user?.id);
                        return (
                          <label
                            key={m.user?.id}
                            className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs font-semibold transition-colors"
                          >
                            <span className="truncate text-slate-800 dark:text-slate-200">
                              {m.user?.name || m.user?.username || 'Member'}
                            </span>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setEditAssigneeIds(editAssigneeIds.filter((id) => id !== m.user?.id));
                                } else {
                                  setEditAssigneeIds([...editAssigneeIds, m.user?.id]);
                                }
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Priority & Due Date */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Priority</label>
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-slate-900 dark:text-white focus:border-blue-500"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Due Date</label>
                      <input
                        type="datetime-local"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-slate-900 dark:text-white focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!editTitle.trim()) return alert('Task title cannot be empty');
                      updateTaskMutation.mutate({
                        title: editTitle.trim(),
                        description: editDescription.trim(),
                        assigneeId: editAssigneeIds[0] || null,
                        assigneeIds: editAssigneeIds,
                        priority: editPriority,
                        dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
                      });
                    }}
                    disabled={updateTaskMutation.isPending}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-98 disabled:opacity-50"
                  >
                    {updateTaskMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}

              {/* Title & Favorite Star */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {meta.isMeeting && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        Meeting {meta.platform ? `(${meta.platform})` : ''}
                      </span>
                    )}
                    {meta.isClickUp && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        ClickUp {meta.clickUpSpace ? `(${meta.clickUpSpace})` : ''}
                      </span>
                    )}
                    {meta.isNotion && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        Notion
                      </span>
                    )}
                    {meta.isAi && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Flow AI
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                    {meta.cleanTitle || task.title}
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
                  </div>
                </div>
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
                          // Only creator or admin can move to IN_REVIEW or DONE
                          if ((st.id === 'IN_REVIEW' || st.id === 'DONE') && !isCreator && !isOwnerOrAdmin) {
                            triggerHaptic('heavy');
                            alert('Only the task creator or workspace admin can move a task to Review or Done.');
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
                  {canEditTask ? (
                    <select
                      value={task.priority || 'MEDIUM'}
                      onChange={(e) => {
                        triggerHaptic('medium');
                        updateTaskMutation.mutate({ priority: e.target.value });
                      }}
                      className={`px-2 py-0.5 text-xs font-extrabold rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none cursor-pointer ${priorityColor}`}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  ) : (
                    <span className={`font-extrabold flex items-center gap-1.5 ${priorityColor}`}>
                      <span className={`w-2 h-2 rounded-full ${task.priority === 'HIGH' || task.priority === 'URGENT' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                      {task.priority || 'MEDIUM'}
                    </span>
                  )}
                </div>

                {/* Multi-Assignees & Progress Section */}
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-500 flex items-center gap-2 text-xs">
                      <Users className="w-4 h-4 text-blue-500" />
                      Assignees ({allAssignees.length})
                    </span>

                    {/* Quick + Add / Reassign button */}
                    {canEditTask && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setIsAssignDropdownOpen(!isAssignDropdownOpen);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 flex items-center gap-1 transition-all border border-blue-200/60 dark:border-blue-800/60"
                        >
                          <Plus className="w-3 h-3 stroke-[3]" />
                          <span>Assign Member</span>
                        </button>

                        {/* Assignee Search & Select Dropdown */}
                        {isAssignDropdownOpen && (
                          <div
                            className="absolute right-0 top-8 z-50 w-60 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-150"
                          >
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-1.5">
                              <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                                Assign Teammates
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsAssignDropdownOpen(false)}
                                className="p-0.5 text-slate-400 hover:text-slate-600 rounded-md"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={assignMemberSearch}
                              onChange={(e) => setAssignMemberSearch(e.target.value)}
                              placeholder="Search member..."
                              className="w-full px-2.5 py-1 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-200"
                            />
                            <div className="max-h-44 overflow-y-auto no-scrollbar space-y-1">
                              {members
                                .filter((m: any) => {
                                  const name = (m.user?.name || m.user?.username || '').toLowerCase();
                                  return name.includes(assignMemberSearch.toLowerCase());
                                })
                                .map((m: any) => {
                                  const isAssigned = currentAssigneeIds.includes(m.user?.id);
                                  return (
                                    <button
                                      key={m.user?.id}
                                      type="button"
                                      onClick={() => {
                                        if (isAssigned) {
                                          handleRemoveAssignee(m.user?.id);
                                        } else {
                                          handleAddAssignee(m.user?.id);
                                        }
                                      }}
                                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-xl text-left text-xs transition-colors ${
                                        isAssigned
                                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                                          : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-medium'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        {m.user?.avatarUrl ? (
                                          <img src={m.user.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                                        ) : (
                                          <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                                            {(m.user?.name || m.user?.username || 'U')[0]?.toUpperCase()}
                                          </span>
                                        )}
                                        <span className="truncate">
                                          {m.user?.name || m.user?.username || 'Member'}
                                        </span>
                                      </div>
                                      {isAssigned ? (
                                        <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 stroke-[2.5]" />
                                      ) : (
                                        <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      )}
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Assignee Cards with Individual Completion Status */}
                  {allAssignees.length === 0 ? (
                    <div className="text-xs text-slate-400 py-1 font-medium italic">
                      Unassigned (no teammates assigned yet)
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                      {allAssignees.map((u: any) => {
                        const isDone = completedUserIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-xs transition-all ${
                              isDone
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/70 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="relative shrink-0">
                                {u.avatarUrl ? (
                                  <img src={u.avatarUrl} alt={u.name} className="w-6 h-6 rounded-full object-cover" />
                                ) : (
                                  <span className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-[10px] flex items-center justify-center font-black">
                                    {u.name?.[0]?.toUpperCase() || 'U'}
                                  </span>
                                )}
                                {isDone && (
                                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center text-white ring-1 ring-white dark:ring-slate-900 text-[8px] font-black">
                                    ✓
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-[11px] truncate leading-tight">{u.name}</p>
                                <span className={`text-[9px] font-bold ${isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                  {isDone ? 'Part Completed ✓' : 'In Progress'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {canEditTask && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAssignee(u.id)}
                                  className="p-1 text-slate-400 hover:text-rose-500 rounded-md transition-colors"
                                  title="Unassign teammate"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Multi-assignee Progress Bar & "Mark My Part as Done" Toggle */}
                  {allAssignees.length > 0 && (
                    <div className="pt-1.5 space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                        <span>Assignee Progress</span>
                        <span className="text-blue-600 dark:text-blue-400 font-extrabold">
                          {completedUserIds.filter((id) => currentAssigneeIds.includes(id)).length} of {allAssignees.length} completed
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300"
                          style={{
                            width: `${
                              allAssignees.length > 0
                                ? (completedUserIds.filter((id) => currentAssigneeIds.includes(id)).length / allAssignees.length) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>

                      {/* If logged-in user is assigned, show 1-tap "Mark My Part Done" button */}
                      {isAssigneeOfTask && (
                        <button
                          type="button"
                          onClick={handleToggleMyCompletion}
                          className={`w-full py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all active:scale-98 shadow-xs ${
                            isMyPartDone
                              ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{isMyPartDone ? '✓ Your Part is Completed (Tap to reopen)' : 'Mark My Part as Done'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Created By */}
                <div className="flex items-center justify-between pt-2">
                  <span className="font-bold text-slate-500 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-500" />
                    Created By
                  </span>
                  <div className="flex items-center gap-1.5">
                    {task.creator?.avatarUrl ? (
                      <img src={task.creator.avatarUrl} alt={task.creator.name} className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-[9px] flex items-center justify-center font-black">
                        {task.creator?.name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    )}
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">
                      {task.creator?.name || 'Workspace Member'}
                    </span>
                    {task.createdAt && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        • {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Team Workspace */}
                <div className="flex items-center justify-between pt-2">
                  <span className="font-bold text-slate-500 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-500" />
                    Workspace
                  </span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">
                    {task.workspace?.name || 'Flow Workspace'}
                  </span>
                </div>

                {/* Meeting Details & Join Link */}
                {meta.isMeeting && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="font-bold text-blue-500 flex items-center gap-2">
                      <Video className="w-4 h-4 text-blue-500" />
                      Meeting
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">
                        {meta.platform || 'Call'} {meta.duration ? `(${meta.duration})` : ''}
                      </span>
                      {meta.joinUrl && (
                        <a
                          href={meta.joinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black shadow-xs transition-colors"
                        >
                          Join <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Completed On Timestamp */}
                {task.status === 'DONE' && task.completedAt && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Completed
                    </span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                      {new Date(task.completedAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
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
                    {isUploading && (
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Uploading...
                      </span>
                    )}
                  </div>

                  {/* Upload button with overlay file input for iOS compatibility */}
                  <div
                    className={`relative overflow-hidden cursor-pointer px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 font-bold text-[10px] flex items-center gap-1 transition-all ${
                      isUploading ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    {isUploading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3 stroke-[3]" />
                    )}
                    <span>{isUploading ? 'Uploading...' : 'Upload'}</span>
                    <input
                      type="file"
                      multiple
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      onChange={handleFileUpload}
                      onClick={(e) => {
                        (e.target as HTMLInputElement).value = '';
                      }}
                      accept="image/*,application/pdf,audio/*,.doc,.docx"
                      disabled={isUploading}
                    />
                  </div>
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
                        onClick={() => setPreviewAttachment(att)}
                      >
                        {att.type === 'image' ? (
                          <img
                            src={att.url}
                            alt={att.name}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-white"
                          />
                        ) : att.type === 'audio' ? (
                          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
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
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment(att)}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                          title="Preview Attachment"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canDeleteAttachment(att) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(att.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                            title="Remove Attachment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {attachments.length === 0 && (
                    <div
                      className={`relative overflow-hidden cursor-pointer block p-4 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 font-medium hover:border-blue-300 hover:text-blue-500 transition-colors ${
                        isUploading ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 mx-auto mb-1 text-blue-500 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 mx-auto mb-1 text-slate-400" />
                      )}
                      <span>{isUploading ? 'Saving files...' : 'Tap to attach photos, documents or voice files'}</span>
                      <input
                        type="file"
                        multiple
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={handleFileUpload}
                        onClick={(e) => {
                          (e.target as HTMLInputElement).value = '';
                        }}
                        accept="image/*,application/pdf,audio/*,.doc,.docx"
                        disabled={isUploading}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Activity & Discussions Feed with Threaded Replies, Edit, and Delete */}
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

                <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                  {commentsList.length === 0 ? (
                    <div className="p-3 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 font-medium">
                      No comments or updates yet.
                    </div>
                  ) : (
                    commentsList.map((c: any) => {
                      const isAuthor = Boolean(user?.id && (c.authorId === user.id || c.user === user.name));
                      const canDelete = isAuthor || isOwnerOrAdmin;
                      const isBeingEdited = editingCommentId === c.id;

                      return (
                        <div
                          key={c.id}
                          className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1 border border-slate-100 dark:border-slate-800"
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
                              {isAuthor && (
                                <span className="text-[8px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                                  You
                                </span>
                              )}
                            </span>

                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-medium text-[9px]">{c.time}</span>
                              {/* Reply, Edit & Delete action buttons */}
                              <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-700">
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic('light');
                                    setReplyingTo({ id: c.id, author: c.user, snippet: c.text.slice(0, 30) });
                                  }}
                                  className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors"
                                  title="Reply to comment"
                                >
                                  <Reply className="w-3 h-3" />
                                </button>
                                {isAuthor && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic('light');
                                      setEditingCommentId(c.id);
                                      setEditCommentText(c.text);
                                    }}
                                    className="text-slate-400 hover:text-amber-600 p-0.5 rounded transition-colors"
                                    title="Edit comment"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm('Are you sure you want to delete this comment?')) {
                                        deleteCommentMutation.mutate(c.id);
                                      }
                                    }}
                                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                                    title="Delete comment"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Reply Quote Banner if this is a reply to another comment */}
                          {c.replyMeta && (
                            <div className="ml-5 my-0.5 px-2 py-0.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border-l-2 border-blue-500 text-[10px] text-slate-600 dark:text-slate-400 flex items-center gap-1">
                              <CornerDownRight className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                              <span>Replying to <strong className="text-blue-600 dark:text-blue-400">@{c.replyMeta.author}</strong></span>
                            </div>
                          )}

                          {/* Inline Edit Form OR Comment Text */}
                          {isBeingEdited ? (
                            <div className="pt-1 pl-5 space-y-1.5">
                              <textarea
                                value={editCommentText}
                                onChange={(e) => setEditCommentText(e.target.value)}
                                className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-800 dark:text-slate-200 focus:border-blue-500"
                                rows={2}
                                autoFocus
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCommentId(null);
                                    setEditCommentText('');
                                  }}
                                  className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 rounded-lg"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!editCommentText.trim()) return;
                                    updateCommentMutation.mutate({ commentId: c.id, content: editCommentText.trim() });
                                  }}
                                  disabled={!editCommentText.trim() || updateCommentMutation.isPending}
                                  className="px-3 py-1 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-50"
                                >
                                  {updateCommentMutation.isPending ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed pl-5 whitespace-pre-wrap">
                              {c.text}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Replying banner indicator */}
                {replyingTo && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 rounded-xl border border-blue-200 dark:border-blue-800 text-[11px] text-blue-700 dark:text-blue-300 animate-in fade-in duration-150">
                    <span className="flex items-center gap-1.5 font-medium truncate">
                      <Reply className="w-3 h-3 shrink-0 text-blue-500" />
                      <span>Replying to <strong>@{replyingTo.author}</strong></span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="p-0.5 text-blue-400 hover:text-blue-700 rounded-md"
                      title="Cancel reply"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Add Comment Box */}
                <form onSubmit={handleAddComment} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onFocus={handleInputFocus}
                    placeholder={replyingTo ? `Write a reply to @${replyingTo.author}...` : 'Post comment or team note...'}
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
                {canDeleteTask && (
                  <button
                    type="button"
                    onClick={handleDeleteTask}
                    disabled={deleteTaskMutation.isPending}
                    className="px-4 py-3.5 rounded-2xl font-extrabold text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/40 active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                )}

                {isDone ? (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      updateStatusMutation.mutate('IN_PROGRESS');
                    }}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 py-3.5 rounded-2xl font-extrabold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-all active:scale-98 flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reopen Task</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isCreator && !isOwnerOrAdmin) {
                        triggerHaptic('heavy');
                        alert('Only the task creator or workspace admin can mark this task as done.');
                        return;
                      }
                      completeMutation.mutate();
                    }}
                    disabled={completeMutation.isPending}
                    className="flex-1 py-3.5 rounded-2xl font-extrabold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark as Done</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              Task could not be found.
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Comprehensive Attachment Preview Modal */}
      {previewAttachment && (
        <div
          onClick={() => setPreviewAttachment(null)}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in font-sans"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[88vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="w-4 h-4 text-blue-500 shrink-0" />
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                  {previewAttachment.name}
                </h4>
              </div>
              <button
                onClick={() => setPreviewAttachment(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview content based on type */}
            <div className="space-y-3">
              {previewAttachment.type === 'image' ? (
                <div className="rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-[50vh]">
                  <img
                    src={previewAttachment.url}
                    alt={previewAttachment.name}
                    className="max-w-full max-h-[50vh] object-contain"
                  />
                </div>
              ) : previewAttachment.type === 'audio' ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl space-y-2 text-center">
                  <Mic className="w-8 h-8 text-blue-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Audio Recording</p>
                  <audio controls src={previewAttachment.url} className="w-full" />
                </div>
              ) : (
                <div className="space-y-2">
                  {previewAttachment.url?.startsWith('data:application/pdf') || previewAttachment.url?.endsWith('.pdf') ? (
                    <iframe
                      src={previewAttachment.url}
                      title={previewAttachment.name}
                      className="w-full h-72 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white"
                    />
                  ) : (
                    <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                      <FileText className="w-10 h-10 text-blue-500 mx-auto" />
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {previewAttachment.name}
                      </p>
                      <p className="text-[11px] text-slate-400">{previewAttachment.size}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons: Open in New Tab / Download / Delete */}
              <div className="flex items-center gap-2 pt-2">
                <a
                  href={previewAttachment.url}
                  download={previewAttachment.name}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download / Open</span>
                </a>

                {canDeleteAttachment(previewAttachment) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteAttachment(previewAttachment.id);
                      setPreviewAttachment(null);
                    }}
                    className="p-2.5 rounded-xl text-rose-600 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 transition-colors"
                    title="Delete Attachment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
