'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  X,
  Calendar,
  Clock,
  User,
  Paperclip,
  Trash2,
  FileText,
  Search,
  Check,
} from 'lucide-react';

interface CreateTaskSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateTaskSheet({ isOpen, onClose }: CreateTaskSheetProps) {
  const { workspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string; isImage: boolean }>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);

  const setQuickDueDate = (offsetDays: number, hour = 18) => {
    triggerHaptic('light');
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(hour, 0, 0, 0);
    // Format for datetime-local: YYYY-MM-DDTHH:mm
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setDueDate(localIso);
  };

  // Fetch Team Members
  const { data: members = [] } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getWorkspaceMembers(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: Boolean(workspaceId),
  });

  // Fetch Projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getProjects(workspaceId);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: Boolean(workspaceId),
  });

  // Create Task Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Please enter a task title');
      if (!workspaceId) throw new Error('No active workspace selected');

      setErrorMsg(null);
      const res = await apiClient.createTask({
        workspaceId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        assigneeId: assigneeId || undefined,
        projectId: projectId || undefined,
      });

      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });

      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setDueDate('');
      setAssigneeId('');
      setProjectId('');
      setAttachments([]);
      setErrorMsg(null);
      onClose();
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      setErrorMsg(err.message || 'Failed to create task');
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    triggerHaptic('medium');
    const file = files[0];
    const isImage = file.type.startsWith('image/');

    const reader = new FileReader();
    reader.onload = () => {
      setAttachments([...attachments, { name: file.name, url: reader.result as string, isImage }]);
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in font-sans">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Top Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Create Task</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-semibold">
            {errorMsg}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-4"
        >
          {/* Task Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Task Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 font-medium transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details..."
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 font-medium resize-none transition-colors"
            />
          </div>

          {/* Project / Category */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Project / Category
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium transition-colors cursor-pointer appearance-none"
            >
              <option value="">General / Default</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date & Quick Time Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Due Date & Time
              </label>
              {dueDate && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setDueDate('');
                  }}
                  className="text-[10px] text-rose-500 font-bold hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick date chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <button
                type="button"
                onClick={() => setQuickDueDate(0, 18)}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 hover:bg-blue-100 transition-all shrink-0 active:scale-95"
              >
                Today 6pm
              </button>
              <button
                type="button"
                onClick={() => setQuickDueDate(1, 10)}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 hover:bg-indigo-100 transition-all shrink-0 active:scale-95"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setQuickDueDate(2, 18)}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-all shrink-0 active:scale-95"
              >
                In 2 Days
              </button>
              <button
                type="button"
                onClick={() => setQuickDueDate(7, 10)}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-all shrink-0 active:scale-95"
              >
                Next Week
              </button>
              <button
                type="button"
                onClick={() => setShowCustomDate(!showCustomDate)}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-all shrink-0"
              >
                {showCustomDate ? 'Hide Picker' : 'Custom...'}
              </button>
            </div>

            {/* Custom DateTime picker (toggleable or auto-shown if set) */}
            {(showCustomDate || dueDate) && (
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium transition-colors"
              />
            )}
          </div>

          {/* Priority Pills */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Priority
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => {
                const isSel = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setPriority(p);
                    }}
                    className={`py-2 rounded-xl text-[11px] font-bold transition-all ${
                      isSel
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {p === 'URGENT' ? '🚨 Urgent' : p === 'HIGH' ? '🔥 High' : p === 'MEDIUM' ? '⚡ Med' : '☕ Low'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assignee Selection (Quick Teammate Chips & Search) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Assignee
              </label>
              {assigneeId && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setAssigneeId('');
                  }}
                  className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
                >
                  Unassign
                </button>
              )}
            </div>

            {/* Teammate quick avatar/username chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setAssigneeId('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  !assigneeId
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                <span>Unassigned</span>
              </button>

              {members.map((m: any) => {
                const isSelected = assigneeId === m.userId;
                const name = m.user?.name || 'Teammate';
                const tgUsername = m.user?.telegramAccount?.username ? `@${m.user.telegramAccount.username}` : '';
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setAssigneeId(m.userId);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {m.user?.avatarUrl ? (
                      <img src={m.user.avatarUrl} alt={name} className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-blue-200 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[9px] font-black">
                        {name[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="truncate max-w-[90px]">{tgUsername || name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 📎 Attachments & Media Upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-blue-500" />
                Attach File or Photo
              </span>
              <label className="cursor-pointer text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline">
                + Browse
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="image/*,application/pdf,.doc,.docx"
                />
              </label>
            </label>

            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {att.isImage ? (
                        <img src={att.url} alt="thumbnail" className="w-6 h-6 rounded-md object-cover" />
                      ) : (
                        <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      )}
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {att.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 active:scale-98 transition-all disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating Task...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
