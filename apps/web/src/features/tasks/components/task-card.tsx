'use client';

import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  Calendar,
  Video,
  Mic,
  ExternalLink,
  Bot,
  CheckSquare,
  Zap,
  FileText,
  AlertTriangle,
  Paperclip,
  Image as ImageIcon,
  Users,
  X,
  Download,
} from 'lucide-react';
import { useTelegram } from '../../../hooks/use-telegram';

export function isTaskSeen(task: any): boolean {
  if (!task) return false;
  if (task.status === 'DONE' || task.status === 'IN_PROGRESS' || task.status === 'IN_REVIEW') return true;
  if (Array.isArray(task.comments) && task.comments.length > 0) return true;
  if (task.completedAt) return true;
  if (typeof window !== 'undefined') {
    try {
      const seen = JSON.parse(localStorage.getItem('flowtask_seen_tasks') || '[]');
      if (Array.isArray(seen) && seen.includes(task.id)) return true;
    } catch {}
  }
  return false;
}

export function markTaskSeen(taskId: string) {
  if (typeof window === 'undefined' || !taskId) return;
  try {
    const seen = JSON.parse(localStorage.getItem('flowtask_seen_tasks') || '[]');
    if (!seen.includes(taskId)) {
      seen.push(taskId);
      localStorage.setItem('flowtask_seen_tasks', JSON.stringify(seen.slice(-500)));
    }
  } catch {}
}

export type TaskCategory = 'ALL' | 'TASK' | 'MEETING' | 'CLICKUP' | 'NOTION';

export interface TaskItemMeta {
  category: 'TASK' | 'MEETING' | 'CLICKUP' | 'NOTION';
  cleanTitle: string;
  isMeeting: boolean;
  isClickUp: boolean;
  isNotion: boolean;
  isAi: boolean;
  platform?: string | null;
  joinUrl?: string | null;
  duration?: string | null;
  clickUpSpace?: string | null;
  subtaskCount?: { total: number; completed: number } | null;
}

export function parseTaskMeta(task: any): TaskItemMeta {
  if (!task) {
    return {
      category: 'TASK',
      cleanTitle: '',
      isMeeting: false,
      isClickUp: false,
      isNotion: false,
      isAi: false,
      platform: null,
      joinUrl: null,
      duration: null,
      clickUpSpace: null,
      subtaskCount: null,
    };
  }
  const rawTitle = (task.title || '').trim();
  const desc = task.description || '';
  const projName = task.project?.name || '';

  const isMeeting =
    rawTitle.toLowerCase().startsWith('[meeting]') ||
    task.type === 'MEETING' ||
    desc.includes('🎙️ Platform:') ||
    desc.includes('Join URL:');

  const isClickUp =
    rawTitle.toLowerCase().startsWith('[clickup]') ||
    desc.toLowerCase().includes('clickup space:') ||
    projName.toLowerCase().includes('clickup');

  const isNotion =
    rawTitle.toLowerCase().startsWith('[notion]') ||
    desc.toLowerCase().includes('notion database:') ||
    projName.toLowerCase().includes('notion');

  const isAi =
    rawTitle.toLowerCase().startsWith('[ai]') ||
    desc.includes('🤖 Flow AI') ||
    desc.includes('AI Project Manager');

  let category: 'TASK' | 'MEETING' | 'CLICKUP' | 'NOTION' = 'TASK';
  if (isMeeting) category = 'MEETING';
  else if (isClickUp) category = 'CLICKUP';
  else if (isNotion) category = 'NOTION';

  const cleanTitle = rawTitle
    .replace(/^\[(meeting|clickup|notion|ai)\]\s*/i, '')
    .trim() || rawTitle;

  let platform: string | null = null;
  let joinUrl: string | null = null;
  let duration: string | null = null;
  if (isMeeting) {
    const rawPlat = desc.match(/Platform:\s*([^\n\r]+)/i)?.[1]?.trim() || null;
    platform = rawPlat ? rawPlat.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim() : null;
    joinUrl = desc.match(/(?:Join URL|URL|Link):\s*([^\n\r]+)/i)?.[1]?.trim() || null;
    duration = desc.match(/Duration:\s*([^\n\r]+)/i)?.[1]?.trim() || null;
  }

  let clickUpSpace: string | null = null;
  if (isClickUp) {
    clickUpSpace = desc.match(/ClickUp Space:\s*([^\n\r]+)/i)?.[1]?.trim() || null;
  }

  // Parse subtask checklist items
  let subtaskCount: { total: number; completed: number } | null = null;
  if (desc && (desc.includes('- [ ]') || desc.includes('- [x]') || desc.includes('- [X]'))) {
    const lines = desc.split('\n');
    let total = 0;
    let completed = 0;
    lines.forEach((l: string) => {
      if (/^-\s*\[\s*\]/.test(l)) {
        total++;
      } else if (/^-\s*\[[xX]\]/.test(l)) {
        total++;
        completed++;
      }
    });
    if (total > 0) {
      subtaskCount = { total, completed };
    }
  }

  return {
    category,
    cleanTitle,
    isMeeting,
    isClickUp,
    isNotion,
    isAi,
    platform,
    joinUrl,
    duration,
    clickUpSpace,
    subtaskCount,
  };
}

interface TaskCardProps {
  task: any;
  currentUserId?: string;
  onSelect: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  isCompleting?: boolean;
}

export function TaskCard({
  task,
  currentUserId,
  onSelect,
  onComplete,
  isCompleting = false,
}: TaskCardProps) {
  const { triggerHaptic } = useTelegram();
  const meta = parseTaskMeta(task);
  const isDone = task.status === 'DONE';
  const isSeen = isTaskSeen(task);

  // Format Due Date
  const formatDue = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    const isPast = d.getTime() < now.getTime() - 24 * 60 * 60 * 1000;
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    let label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    if (isToday) {
      label = `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    return {
      label,
      isAlert: isPast && !isDone,
      isToday,
    };
  };

  const dueInfo = formatDue(task.dueDate);
  const projectTag = task.project?.name || (task.labels?.[0]?.name ? task.labels[0].name : 'General');
  const projectColor = task.project?.color || '#2563eb';

  const [cardPreviewImage, setCardPreviewImage] = useState<string | null>(null);

  const assigneesList: any[] = Array.isArray(task?.assignees) && task.assignees.length > 0
    ? task.assignees
    : (task?.assignee ? [task.assignee] : []);
  const completedUserIds: string[] = Array.isArray(task?.completedAssigneeIds)
    ? task.completedAssigneeIds
    : (isDone ? assigneesList.map((a: any) => a.id) : []);

  const totalAssignees = assigneesList.length;
  const completedCount = assigneesList.filter((a: any) => completedUserIds.includes(a.id)).length;

  // Extract attachment preview images
  const previewImages: string[] = [];
  let totalAttachmentsCount = 0;

  if (Array.isArray(task.attachments) && task.attachments.length > 0) {
    totalAttachmentsCount = task.attachments.length;
    task.attachments.forEach((a: any) => {
      if ((a.type === 'image' || a.isImage || a.url?.startsWith('data:image/')) && a.url) {
        previewImages.push(a.url);
      }
    });
  } else if (task.imageUrl) {
    try {
      if (task.imageUrl.startsWith('[')) {
        const parsed = JSON.parse(task.imageUrl);
        if (Array.isArray(parsed)) {
          totalAttachmentsCount = parsed.length;
          parsed.forEach((a: any) => {
            if (a.url) previewImages.push(a.url);
          });
        }
      } else {
        totalAttachmentsCount = 1;
        previewImages.push(task.imageUrl);
      }
    } catch {
      totalAttachmentsCount = 1;
      previewImages.push(task.imageUrl);
    }
  }

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDone || isCompleting) return;
    const isOneOfAssignees = assigneesList.some((a: any) => a.id === currentUserId);
    if (task.assigneeId && !isOneOfAssignees && task.creatorId !== currentUserId) {
      triggerHaptic('heavy');
      alert(`Only an assignee or creator can complete this task.`);
      return;
    }
    triggerHaptic('medium');
    onComplete(task.id);
  };

  const handleJoinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (meta.joinUrl && /^(https?:\/\/|tg:\/\/)/i.test(meta.joinUrl)) {
      window.open(meta.joinUrl, '_blank');
    }
  };

  return (
    <div
      onClick={() => {
        triggerHaptic('light');
        markTaskSeen(task.id);
        onSelect(task.id);
      }}
      className={`relative rounded-2xl p-3.5 border transition-all cursor-pointer group shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.03)] hover:shadow-md active:scale-[0.99] overflow-hidden ${
        isDone
          ? 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800 opacity-65'
          : meta.isMeeting
          ? 'bg-white dark:bg-slate-800/90 border-blue-200/80 dark:border-blue-900/50 hover:border-blue-300 shadow-[0_3px_12px_-3px_rgba(59,130,246,0.12)]'
          : meta.isClickUp
          ? 'bg-white dark:bg-slate-800/90 border-violet-200/80 dark:border-violet-900/50 hover:border-violet-300 shadow-[0_3px_12px_-3px_rgba(139,92,246,0.12)]'
          : meta.isNotion
          ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-slate-300 shadow-[0_3px_12px_-3px_rgba(0,0,0,0.05)]'
          : task.priority === 'URGENT' || task.priority === 'HIGH'
          ? 'bg-white dark:bg-slate-800/90 border-rose-200/80 dark:border-rose-900/50 hover:border-rose-300 shadow-[0_3px_12px_-3px_rgba(244,63,94,0.1)]'
          : 'bg-white dark:bg-slate-800/90 border-slate-200/90 dark:border-slate-700/80 hover:border-blue-300 shadow-[0_3px_12px_-3px_rgba(59,130,246,0.07)]'
      }`}
    >
      {/* Sleek left accent indicator pill (does not touch corners) */}
      <div
        className={`absolute left-0.5 top-3 bottom-3 w-1 rounded-full ${
          isDone
            ? 'bg-slate-300 dark:bg-slate-700'
            : meta.isMeeting
            ? 'bg-blue-600'
            : meta.isClickUp
            ? 'bg-violet-500'
            : meta.isNotion
            ? 'bg-slate-600 dark:bg-slate-400'
            : task.priority === 'URGENT' || dueInfo?.isAlert
            ? 'bg-rose-500'
            : task.priority === 'HIGH'
            ? 'bg-orange-500'
            : 'bg-blue-500'
        }`}
      />

      <div className="flex items-start gap-2.5 pl-1.5">
        {/* Checkbox button (Meetings cannot be marked as done like tasks) */}
        {meta.isMeeting ? (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60"
            title="Meeting"
          >
            <Video className="w-3 h-3" />
          </div>
        ) : (
          <button
            type="button"
            onClick={handleCheckboxClick}
            disabled={isDone || isCompleting}
            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${
              isDone
                ? 'bg-emerald-600 text-white shadow-xs'
                : meta.isClickUp
                ? 'border-2 border-violet-400 dark:border-violet-600 hover:border-violet-500 hover:scale-105'
                : 'border-2 border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:scale-105'
            }`}
          >
            {isDone && <Check className="w-3 h-3 stroke-[3]" />}
          </button>
        )}

        {/* Main Content Area */}
        <div className="min-w-0 flex-1">
          {/* Top Line: Title + Telegram Double Ticks + Assignee Avatar */}
          <div className="flex items-start justify-between gap-2">
            <h4
              className={`text-[13px] font-bold leading-snug tracking-tight break-words ${
                isDone
                  ? 'line-through text-slate-400 dark:text-slate-500'
                  : 'text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors'
              }`}
            >
              {meta.cleanTitle}
            </h4>

            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
              {/* Telegram-style Seen / Opened Ticks */}
              <div
                className="flex items-center"
                title={isSeen ? 'Seen by assignee' : 'Delivered'}
              >
                {isSeen ? (
                  <CheckCheck className="w-3.5 h-3.5 text-blue-500 stroke-[2.5]" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 stroke-[2]" />
                )}
              </div>

              {/* Assignee Avatar Cluster / Single Avatar */}
              {totalAssignees > 1 ? (
                <div className="flex items-center -space-x-1.5 overflow-visible">
                  {assigneesList.slice(0, 3).map((a: any, aIdx: number) => {
                    const isUserDone = completedUserIds.includes(a.id) || isDone;
                    return (
                      <div
                        key={a.id || aIdx}
                        className="relative group/avatar"
                        title={`${a.name || 'Member'}${isUserDone ? ' (Completed)' : ' (In Progress)'}`}
                      >
                        {a.avatarUrl ? (
                          <img
                            src={a.avatarUrl}
                            alt={a.name || 'Assignee'}
                            className={`w-5 h-5 rounded-full object-cover border-2 ${
                              isUserDone
                                ? 'border-emerald-500 ring-1 ring-emerald-400/40'
                                : 'border-white dark:border-slate-900'
                            } shadow-2xs shrink-0`}
                          />
                        ) : (
                          <div
                            className={`w-5 h-5 rounded-full ${
                              isUserDone
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-500'
                                : 'bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border-2 border-white dark:border-slate-900'
                            } font-bold text-[9px] flex items-center justify-center shadow-2xs shrink-0`}
                          >
                            {a.name?.[0]?.toUpperCase() || 'U'}
                          </div>
                        )}
                        {isUserDone && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full flex items-center justify-center border border-white dark:border-slate-900 text-white shadow-xs">
                            <Check className="w-1.5 h-1.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {totalAssignees > 3 && (
                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-[8px] flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-2xs shrink-0">
                      +{totalAssignees - 3}
                    </div>
                  )}
                </div>
              ) : task?.assignee?.avatarUrl ? (
                <div className="relative" title={`${task.assignee?.name || 'Assignee'}${isDone ? ' (Completed)' : ''}`}>
                  <img
                    src={task.assignee.avatarUrl}
                    alt={task.assignee?.name || 'Assignee'}
                    className={`w-5 h-5 rounded-full object-cover border ${
                      isDone ? 'border-emerald-500 ring-1 ring-emerald-400/40' : 'border-slate-200 dark:border-slate-700'
                    } shadow-2xs shrink-0`}
                  />
                  {isDone && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full flex items-center justify-center border border-white dark:border-slate-900 text-white shadow-xs">
                      <Check className="w-1.5 h-1.5 stroke-[3]" />
                    </span>
                  )}
                </div>
              ) : task?.assignee?.name ? (
                <div className="relative" title={`${task.assignee?.name || 'Assignee'}${isDone ? ' (Completed)' : ''}`}>
                  <div className={`w-5 h-5 rounded-full ${
                    isDone
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-500'
                      : 'bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-700/60'
                  } font-bold text-[9px] flex items-center justify-center shadow-2xs shrink-0`}>
                    {task.assignee.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  {isDone && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full flex items-center justify-center border border-white dark:border-slate-900 text-white shadow-xs">
                      <Check className="w-1.5 h-1.5 stroke-[3]" />
                    </span>
                  )}
                </div>
              ) : (task?.priority === 'URGENT' || task?.priority === 'HIGH') ? (
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              ) : null}
            </div>
          </div>

          {/* Attachment Images Preview Carousel / Grid */}
          {previewImages.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar py-0.5">
              {previewImages.slice(0, 3).map((imgUrl, idx) => (
                <div
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('light');
                    setCardPreviewImage(imgUrl);
                  }}
                  className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shrink-0 shadow-2xs group-hover:border-blue-300 transition-colors cursor-pointer hover:opacity-90 active:scale-95"
                >
                  <img
                    src={imgUrl}
                    alt={`Attachment preview ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {idx === 2 && previewImages.length > 3 && (
                    <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white font-black text-[10px]">
                      +{previewImages.length - 3}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Bottom Line: Badges & Metadata (Clean compact chips) */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {totalAttachmentsCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                {previewImages.length > 0 ? (
                  <ImageIcon className="w-2.5 h-2.5 text-blue-500" />
                ) : (
                  <Paperclip className="w-2.5 h-2.5 text-slate-500" />
                )}
                <span>{totalAttachmentsCount}</span>
              </span>
            )}

            {/* Category / Source Badges */}
            {meta.isMeeting && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 shadow-2xs">
                <Video className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                <span>Meeting</span>
              </span>
            )}

            {meta.isClickUp && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-violet-50 dark:bg-violet-950/70 text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800/80 shadow-2xs">
                <Zap className="w-2.5 h-2.5 text-violet-600 dark:text-violet-400 fill-violet-500" />
                <span>ClickUp</span>
              </span>
            )}

            {meta.isNotion && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs">
                <FileText className="w-2.5 h-2.5 text-slate-600 dark:text-slate-300" />
                <span>Notion</span>
              </span>
            )}

            {meta.isAi && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 shadow-2xs">
                <Bot className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-300" />
                <span>Flow AI</span>
              </span>
            )}

            {(task.priority === 'URGENT' || dueInfo?.isAlert) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 shadow-2xs">
                <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
                <span>{dueInfo?.isAlert ? 'Overdue' : 'Urgent'}</span>
              </span>
            )}

            {/* Project Tag */}
            {!meta.isMeeting && !meta.isClickUp && !meta.isNotion && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: `${projectColor}15`,
                  color: projectColor,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: projectColor }}
                />
                <span>{projectTag}</span>
              </span>
            )}

            {/* Due Date */}
            {dueInfo && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  dueInfo.isAlert
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                    : dueInfo.isToday
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                <Calendar className="w-2.5 h-2.5" />
                <span>{dueInfo.label}</span>
              </span>
            )}

            {/* Subtasks Counter */}
            {meta.subtaskCount && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <CheckSquare className="w-2.5 h-2.5 text-blue-500" />
                <span>
                  {meta.subtaskCount.completed}/{meta.subtaskCount.total}
                </span>
              </span>
            )}

            {meta.platform && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md truncate max-w-[150px]">
                <Mic className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                <span className="truncate">{meta.platform}</span>
              </span>
            )}

            {meta.clickUpSpace && (
              <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded-md truncate max-w-[130px]">
                {meta.clickUpSpace}
              </span>
            )}

            {/* Multi-Assignee Completion Progress Badge */}
            {totalAssignees > 1 && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                  completedCount === totalAssignees
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60'
                    : completedCount > 0
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
                title={`Completed: ${assigneesList.filter(a => completedUserIds.includes(a.id)).map(a => a.name).join(', ') || 'None'} | In Progress: ${assigneesList.filter(a => !completedUserIds.includes(a.id)).map(a => a.name).join(', ') || 'None'}`}
              >
                <Users className="w-2.5 h-2.5" />
                <span>{completedCount}/{totalAssignees} completed</span>
              </span>
            )}

            {/* Join Call Action Button for Meetings */}
            {meta.joinUrl && /^(https?:\/\/|tg:\/\/)/i.test(meta.joinUrl) && (
              <button
                type="button"
                onClick={handleJoinClick}
                className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
              >
                <Video className="w-2.5 h-2.5" />
                <span>Join</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-80" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Attachment Image Fullscreen Lightbox Modal */}
      {cardPreviewImage && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setCardPreviewImage(null);
          }}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Attachment Preview
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCardPreviewImage(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-[60vh]">
              <img
                src={cardPreviewImage}
                alt="Attachment preview"
                className="max-w-full max-h-[60vh] object-contain"
              />
            </div>

            <div className="pt-1 flex items-center gap-2">
              <a
                href={cardPreviewImage}
                target="_blank"
                rel="noreferrer"
                download="attachment"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Open / Download</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
