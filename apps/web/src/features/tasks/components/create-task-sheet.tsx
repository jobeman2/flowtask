'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { useNotifications } from '../../../providers/notification-provider';
import {
  X,
  Calendar,
  Clock,
  User,
  Users,
  Paperclip,
  Trash2,
  FileText,
  Search,
  Check,
  ChevronDown,
  FolderKanban,
  CheckCircle2,
  UploadCloud,
  Image as ImageIcon,
  CheckSquare,
  Square,
} from 'lucide-react';

interface CreateTaskSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

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
        const maxDim = 1280;

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
          resolve(canvas.toDataURL('image/jpeg', 0.78));
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

export function CreateTaskSheet({ isOpen, onClose }: CreateTaskSheetProps) {
  const { workspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCustomDate, setShowCustomDate] = useState(false);

  // Custom Project Select State
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  // Custom Assignee Multi-Select Dropdown State
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target as Node)) {
        setIsAssigneeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
  };

  const setQuickDueDate = (offsetDays: number, hour = 18) => {
    triggerHaptic('light');
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(hour, 0, 0, 0);
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

  // Toggle single assignee in multi-select
  const toggleAssignee = (userId: string) => {
    triggerHaptic('light');
    if (assigneeIds.includes(userId)) {
      setAssigneeIds(assigneeIds.filter((id) => id !== userId));
    } else {
      setAssigneeIds([...assigneeIds, userId]);
    }
  };

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
        assigneeId: assigneeIds[0] || undefined,
        assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
        projectId: projectId || undefined,
        attachments: attachments.map((a) => ({
          id: a.id,
          name: a.name,
          url: a.url,
          type: a.type,
          size: a.size,
          uploadedAt: 'Just now',
        })),
        imageUrl: attachments.find((a) => a.isImage)?.url || undefined,
      });

      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data: any) => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });

      const taskName = data?.title || title.trim() || 'New task';
      addNotification({
        type: 'TASK_CREATED',
        title: 'Task Created',
        message: `"${taskName}" created successfully`,
        data: { taskId: data?.id },
      });

      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setDueDate('');
      setAssigneeIds([]);
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

  // Multi-File upload handler
  const handleMultipleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    triggerHaptic('medium');
    const filesArray = Array.from(files);

    try {
      const newItems: any[] = [];
      for (const file of filesArray) {
        if (file.size > 10 * 1024 * 1024) {
          alert(`"${file.name}" exceeds 10MB limit.`);
          continue;
        }

        const isImg = file.type.startsWith('image/');
        const isAud = file.type.startsWith('audio/');
        const dataUrl = await compressImageFile(file);

        newItems.push({
          id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
          name: file.name,
          url: dataUrl,
          isImage: isImg,
          type: isImg ? 'image' : isAud ? 'audio' : 'document',
          size: `${Math.max(1, Math.round((dataUrl.length * 0.75) / 1024))} KB`,
        });
      }

      if (newItems.length > 0) {
        setAttachments((prev) => [...prev, ...newItems]);
      }
    } catch (err: any) {
      alert('Failed to process attachment');
    } finally {
      e.target.value = '';
    }
  };

  const selectedProject = projects.find((p: any) => p.id === projectId);
  const selectedMembers = members.filter((m: any) => assigneeIds.includes(m.userId));

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm font-sans"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          (document.activeElement as HTMLElement)?.blur();
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-800 max-h-[90dvh] flex flex-col animate-in slide-in-from-bottom duration-200">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-0.5">New Task</p>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Create Task</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-semibold">
            {errorMsg}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            (document.activeElement as HTMLElement)?.blur();
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
              onFocus={handleInputFocus}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  descriptionInputRef.current?.focus();
                }
              }}
              placeholder="What needs to be done?"
              required
              enterKeyHint="next"
              autoCapitalize="sentences"
              autoCorrect="on"
              spellCheck={true}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-[16px] sm:text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium transition-all"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Description
            </label>
            <textarea
              ref={descriptionInputRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onFocus={handleInputFocus}
              placeholder="Add more details, checklists, or links..."
              rows={3}
              enterKeyHint="done"
              autoCapitalize="sentences"
              autoCorrect="on"
              spellCheck={true}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-[16px] sm:text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium resize-none transition-all"
            />
          </div>

          {/* Project / Category - Modern Custom Select UI */}
          <div className="space-y-1 relative" ref={projectDropdownRef}>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Project / Category</span>
              {selectedProject && (
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                  Selected
                </span>
              )}
            </label>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsProjectDropdownOpen(!isProjectDropdownOpen);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border transition-all text-left ${
                isProjectDropdownOpen
                  ? 'bg-white dark:bg-slate-800 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                  style={{
                    backgroundColor: selectedProject ? (selectedProject.color || '#3b82f6') : '#94a3b8',
                  }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {selectedProject ? selectedProject.name : 'General / Default Project'}
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                  isProjectDropdownOpen ? 'rotate-180 text-blue-500' : ''
                }`}
              />
            </button>

            {/* Custom Dropdown Picker */}
            {isProjectDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150 space-y-1 max-h-56 overflow-y-auto no-scrollbar">
                {projects.length > 3 && (
                  <div className="px-1 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search projects..."
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        className="w-full bg-transparent text-[16px] sm:text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Default / No Project Option */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setProjectId('');
                    setIsProjectDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    !projectId
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                    <span>General / Default Project</span>
                  </div>
                  {!projectId && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 stroke-[2.5]" />}
                </button>

                {/* Filtered Project Options */}
                {projects
                  .filter((p: any) =>
                    !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase())
                  )
                  .map((p: any) => {
                    const isSelected = projectId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setProjectId(p.id);
                          setIsProjectDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: p.color || '#3b82f6' }}
                          />
                          <span className="truncate">{p.name}</span>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 stroke-[2.5] shrink-0" />
                        )}
                      </button>
                    );
                  })}
              </div>
            )}
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
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 hover:bg-blue-100 transition-all shrink-0 active:scale-95"
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
                onFocus={handleInputFocus}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-[16px] sm:text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium transition-colors"
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
                    {p === 'URGENT' ? 'Urgent' : p === 'HIGH' ? 'High' : p === 'MEDIUM' ? 'Medium' : 'Low'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assignee Multi-Select Dropdown with Search */}
          <div className="space-y-1 relative" ref={assigneeDropdownRef}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>Assignees</span>
                {assigneeIds.length > 0 && (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60">
                    ({assigneeIds.length})
                  </span>
                )}
              </label>
              {assigneeIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setAssigneeIds([]);
                  }}
                  className="text-[10px] text-slate-400 hover:text-rose-500 font-bold transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Custom Assignee Dropdown Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border transition-all text-left ${
                isAssigneeDropdownOpen
                  ? 'bg-white dark:bg-slate-800 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {selectedMembers.length === 0 ? (
                  <div className="flex items-center gap-2 text-slate-400 font-medium text-xs">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>Select Assignees (Unassigned)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Overlapping Avatars */}
                    <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                      {selectedMembers.slice(0, 3).map((m: any) =>
                        m.user?.avatarUrl ? (
                          <img
                            key={m.id}
                            src={m.user.avatarUrl}
                            alt={m.user?.name}
                            className="inline-block h-5 w-5 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover"
                          />
                        ) : (
                          <div
                            key={m.id}
                            className="inline-flex h-5 w-5 rounded-full bg-blue-500 text-white items-center justify-center text-[9px] font-bold ring-2 ring-white dark:ring-slate-900"
                          >
                            {m.user?.name?.[0]?.toUpperCase() || 'U'}
                          </div>
                        )
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {selectedMembers.map((m: any) => m.user?.name || 'Teammate').join(', ')}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {selectedMembers.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    {selectedMembers.length}
                  </span>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    isAssigneeDropdownOpen ? 'rotate-180 text-blue-500' : ''
                  }`}
                />
              </div>
            </button>

            {/* Dropdown Menu */}
            {isAssigneeDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150 space-y-1.5 max-h-60 overflow-y-auto no-scrollbar">
                {/* Search Bar */}
                <div className="px-1 pb-1 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search team members..."
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      className="w-full bg-transparent text-[16px] sm:text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none font-medium"
                    />
                  </div>
                  {members.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        if (assigneeIds.length === members.length) {
                          setAssigneeIds([]);
                        } else {
                          setAssigneeIds(members.map((m: any) => m.userId));
                        }
                      }}
                      className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 px-1"
                    >
                      {assigneeIds.length === members.length ? 'Clear' : 'Select All'}
                    </button>
                  )}
                </div>

                {/* Members list with checkboxes */}
                <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar">
                  {members
                    .filter((m: any) => {
                      const name = (m.user?.name || '').toLowerCase();
                      const username = (m.user?.telegramAccount?.username || '').toLowerCase();
                      const q = assigneeSearch.toLowerCase();
                      return !q || name.includes(q) || username.includes(q);
                    })
                    .map((m: any) => {
                      const isSelected = assigneeIds.includes(m.userId);
                      const name = m.user?.name || 'Teammate';
                      const tgUsername = m.user?.telegramAccount?.username ? `@${m.user.telegramAccount.username}` : '';
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleAssignee(m.userId)}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {m.user?.avatarUrl ? (
                              <img src={m.user.avatarUrl} alt={name} className="w-5 h-5 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[10px] font-black shrink-0">
                                {name[0]?.toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 text-left">
                              <p className="font-bold text-slate-900 dark:text-white truncate text-xs">{name}</p>
                              {tgUsername && <p className="text-[10px] text-slate-400 truncate">{tgUsername}</p>}
                            </div>
                          </div>

                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  {members.length === 0 && (
                    <div className="p-3 text-center text-xs text-slate-400">No members found in this workspace.</div>
                  )}
                </div>
              </div>
            )}

            {/* Selected Assignees Pills */}
            {selectedMembers.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {selectedMembers.map((m: any) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200/60 dark:border-blue-800/60"
                  >
                    <span>{m.user?.name || 'Teammate'}</span>
                    <button
                      type="button"
                      onClick={() => toggleAssignee(m.userId)}
                      className="p-0.5 hover:text-rose-500 rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 📎 Attachments & Media Upload - Multiple at once with Modern UI */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-blue-500" />
                <span>Attachments & Files</span>
                {attachments.length > 0 && (
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    {attachments.length}
                  </span>
                )}
              </label>
              {attachments.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setAttachments([]);
                  }}
                  className="text-[10px] text-slate-400 hover:text-rose-500 font-bold transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Modern Multi-File Dropzone / Upload Trigger */}
            <label className="cursor-pointer group flex items-center justify-between p-3 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/30 transition-all">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 flex items-center justify-center shrink-0">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors">
                    Add files or photos
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Select multiple at once (Photos, PDFs, Docs)
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 font-bold text-[11px] shadow-xs group-hover:border-blue-300">
                + Browse
              </span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleMultipleFileUpload}
                accept="image/*,application/pdf,audio/*,.doc,.docx,.xls,.xlsx,.zip"
              />
            </label>

            {/* Attached Files List / Cards */}
            {attachments.length > 0 && (
              <div className="space-y-1.5 max-h-44 overflow-y-auto no-scrollbar pt-1">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs hover:border-blue-300 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {att.isImage ? (
                        <img
                          src={att.url}
                          alt={att.name}
                          className="w-8 h-8 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-white"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 dark:text-white truncate text-[11px]">
                          {att.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {att.size} • {att.type}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setAttachments(attachments.filter((a) => a.id !== att.id));
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors shrink-0"
                      title="Remove file"
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
              className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating Task...' : 'Create Task'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
