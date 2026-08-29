'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { Button } from '@flowtask/ui';
import {
  X,
  Upload,
  Trash2,
  MessageSquareQuote,
  CheckCircle2,
} from 'lucide-react';

interface CreateTaskSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateTaskSheet({ isOpen, onClose }: CreateTaskSheetProps) {
  const { workspaceId, user: currentUser } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [activeMode, setActiveMode] = useState<'STANDARD' | 'TELEGRAM_FORWARD' | 'SCHEDULE'>('STANDARD');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [projectId, setProjectId] = useState<string>('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule] = useState('FREQ=WEEKLY');
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getProjects(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: Boolean(workspaceId && isOpen),
  });

  // Fetch Workspace Members
  const { data: members = [] } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getWorkspaceMembers(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: Boolean(workspaceId && isOpen),
  });

  const setQuickDate = (days: number | null) => {
    triggerHaptic('light');
    if (days === null) {
      setDueDate('');
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(18, 0, 0, 0);
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setDueDate(localIso);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image size exceeds 5MB limit');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
      triggerHaptic('light');
    };
    reader.readAsDataURL(file);
  };

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !title.trim()) {
        throw new Error('Please enter a task title');
      }
      setFormError(null);
      const res = await apiClient.createTask({
        workspaceId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        projectId: projectId || undefined,
        assigneeId: assigneeId || undefined,
        imageUrl: imageUrl.trim() || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        isRecurring,
        recurrenceRule: isRecurring ? recurrenceRule || 'FREQ=WEEKLY' : undefined,
      });

      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      resetForm();
      onClose();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create task');
      triggerHaptic('heavy');
    },
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setImageUrl('');
    setDueDate('');
    setProjectId('');
    setAssigneeId('');
    setIsRecurring(false);
    setFormError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-0 animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto space-y-4">
        {/* Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto" />

        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-flow-100 dark:bg-flow-950/60 text-flow-700 dark:text-flow-400 flex items-center justify-center font-bold text-xs">
              +
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Create FlowTask
              </h3>
              <p className="text-[11px] text-slate-400">
                Add to your workspace or turn Telegram chat into work
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Mode Switcher */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveMode('STANDARD');
            }}
            className={`py-2 px-1 text-center text-xs font-bold rounded-xl transition-all ${
              activeMode === 'STANDARD'
                ? 'bg-white dark:bg-slate-900 text-flow-700 dark:text-flow-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ✍️ New Task
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveMode('TELEGRAM_FORWARD');
            }}
            className={`py-2 px-1 text-center text-xs font-bold rounded-xl transition-all ${
              activeMode === 'TELEGRAM_FORWARD'
                ? 'bg-white dark:bg-slate-900 text-flow-700 dark:text-flow-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            💬 TG Forward
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveMode('SCHEDULE');
            }}
            className={`py-2 px-1 text-center text-xs font-bold rounded-xl transition-all ${
              activeMode === 'SCHEDULE'
                ? 'bg-white dark:bg-slate-900 text-flow-700 dark:text-flow-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ⏰ Schedule
          </button>
        </div>

        {formError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
            {formError}
          </div>
        )}

        {/* Mode A: Telegram Message Forward Guide */}
        {activeMode === 'TELEGRAM_FORWARD' ? (
          <div className="p-4 bg-flow-50/70 dark:bg-flow-950/30 rounded-2xl border border-flow-200/80 dark:border-flow-900/60 space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-flow-800 dark:text-flow-300 font-bold text-sm">
              <MessageSquareQuote className="w-5 h-5 text-flow-600" />
              <span>Turn Any Message into a FlowTask</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              FlowTask integrates natively with Telegram! You can create tasks from anywhere inside Telegram without opening forms:
            </p>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-flow-200 dark:border-flow-900">
                <span className="font-bold text-flow-700 dark:text-flow-400 block">1. Forward to Bot DM</span>
                <span className="text-slate-500 text-[11px]">Forward any message from a client or friend directly to @flowtaskmanager_bot.</span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-flow-200 dark:border-flow-900">
                <span className="font-bold text-flow-700 dark:text-flow-400 block">2. In Any Group Chat</span>
                <span className="text-slate-500 text-[11px]">Reply to any group message with <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-flow-600">/task</code> to capture it automatically!</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Standard Task Form Fields */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTaskMutation.mutate();
          }}
          className="space-y-3.5"
        >
          {/* Title Input */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Task Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Design mobile onboarding flow..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-3 bg-flow-50/40 dark:bg-slate-800 border-2 border-flow-100 dark:border-slate-700 focus:border-flow-500 rounded-2xl text-slate-900 dark:text-white font-semibold text-sm outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Description Preview */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Add key deliverables, bullet points, or instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:border-flow-500 rounded-2xl text-slate-900 dark:text-white text-xs outline-none transition-all resize-none"
            />
          </div>

          {/* Priority Pills */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Priority
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'URGENT', label: '🔴 Urgent', color: 'border-rose-500 text-rose-600 bg-rose-50' },
                { id: 'HIGH', label: '🟠 High', color: 'border-amber-500 text-amber-600 bg-amber-50' },
                { id: 'MEDIUM', label: '🟡 Med', color: 'border-flow-500 text-flow-600 bg-flow-50' },
                { id: 'LOW', label: '🔵 Low', color: 'border-blue-500 text-blue-600 bg-blue-50' },
              ].map((p) => {
                const isSelected = priority === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setPriority(p.id);
                    }}
                    className={`py-2 text-center text-xs font-bold rounded-xl border transition-all ${
                      isSelected
                        ? `${p.color} dark:bg-slate-800 shadow-xs ring-2 ring-flow-500/20`
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assignee & Project Selectors */}
          <div className="grid grid-cols-2 gap-2">
            {/* Assignee */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => {
                  triggerHaptic('light');
                  setAssigneeId(e.target.value);
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none"
              >
                <option value="">Unassigned</option>
                {currentUser && <option value={currentUser.id}>👤 Assign to Myself</option>}
                {members.map((m: any) => (
                  <option key={m.id} value={m.user?.id}>
                    {m.user?.name || 'Teammate'}
                  </option>
                ))}
              </select>
            </div>

            {/* Project */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => {
                  triggerHaptic('light');
                  setProjectId(e.target.value);
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none"
              >
                <option value="">No Project</option>
                {projects.map((proj: any) => (
                  <option key={proj.id} value={proj.id}>
                    📁 {proj.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date & Quick Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Due Date & Time
              </label>
              <div className="flex items-center gap-1 text-[10px] font-bold text-flow-600">
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className="px-2 py-0.5 rounded-md bg-flow-50 dark:bg-flow-950/40 hover:bg-flow-100"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="px-2 py-0.5 rounded-md bg-flow-50 dark:bg-flow-950/40 hover:bg-flow-100"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(7)}
                  className="px-2 py-0.5 rounded-md bg-flow-50 dark:bg-flow-950/40 hover:bg-flow-100"
                >
                  +1 Week
                </button>
              </div>
            </div>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none"
            />
          </div>

          {/* Image Attachment Upload */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              🖼️ Photo / Screenshot Attachment
            </label>
            {imageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <img
                  src={imageUrl}
                  alt="Attachment preview"
                  className="w-full max-h-36 object-cover bg-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-slate-300 dark:border-slate-700 hover:border-flow-500 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer transition-colors text-xs font-semibold text-slate-600 dark:text-slate-300">
                <Upload className="w-4 h-4 text-flow-600" />
                <span>Upload image or screenshot</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Submit CTA Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={createTaskMutation.isPending || !title.trim()}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-flow-700 via-flow-600 to-teal-500 hover:from-flow-800 hover:to-teal-600 text-white font-bold text-sm shadow-flow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{createTaskMutation.isPending ? 'Creating FlowTask...' : 'Create Task'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
