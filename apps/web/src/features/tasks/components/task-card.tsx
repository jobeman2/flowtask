'use client';

import React from 'react';
import {
  Check,
  Calendar,
  Clock,
  Video,
  Mic,
  ExternalLink,
  Bot,
  User,
  CheckSquare,
  Zap,
  FileText,
} from 'lucide-react';
import { useTelegram } from '../../../hooks/use-telegram';

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
    platform = desc.match(/Platform:\s*([^\n\r]+)/i)?.[1]?.trim() || null;
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

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDone || isCompleting) return;
    if (task.assigneeId && task.assigneeId !== currentUserId) {
      triggerHaptic('heavy');
      alert(`Only ${task.assignee?.name || 'the assignee'} can complete this task.`);
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

  // Priority config
  const priorityConfig = {
    URGENT: { color: 'bg-rose-500', label: 'Urgent', textColor: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50' },
    HIGH:   { color: 'bg-orange-400', label: 'High',   textColor: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/50' },
    MEDIUM: { color: 'bg-amber-400',  label: 'Medium', textColor: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/50'  },
    LOW:    { color: 'bg-slate-400',  label: 'Low',    textColor: 'text-slate-500 dark:text-slate-400',  bg: 'bg-slate-100 dark:bg-slate-800'     },
  } as const;
  const priority = (task.priority as keyof typeof priorityConfig) || 'LOW';
  const pCfg = priorityConfig[priority] ?? priorityConfig.LOW;

  return (
    <div
      onClick={() => {
        triggerHaptic('light');
        onSelect(task.id);
      }}
      className={`relative rounded-2xl border transition-all cursor-pointer group overflow-hidden ${
        isDone
          ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-800/60 shadow-none opacity-75'
          : meta.isMeeting
          ? 'bg-white dark:bg-slate-900 border-purple-200/80 dark:border-purple-900/50 shadow-[0_2px_12px_-2px_rgba(168,85,247,0.10)] hover:shadow-[0_4px_20px_-4px_rgba(168,85,247,0.18)] hover:border-purple-300'
          : meta.isClickUp
          ? 'bg-white dark:bg-slate-900 border-violet-200/80 dark:border-violet-900/50 shadow-[0_2px_12px_-2px_rgba(139,92,246,0.10)] hover:shadow-[0_4px_20px_-4px_rgba(139,92,246,0.18)] hover:border-violet-300'
          : meta.isNotion
          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-slate-300'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900/50'
      } active:scale-[0.99]`}
    >
      {/* Left accent stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3.5px] rounded-l-2xl ${
        isDone        ? 'bg-slate-300 dark:bg-slate-700'
        : meta.isMeeting ? 'bg-purple-500'
        : meta.isClickUp  ? 'bg-violet-500'
        : meta.isNotion   ? 'bg-slate-600 dark:bg-slate-400'
        : priority === 'URGENT' ? 'bg-rose-500'
        : priority === 'HIGH'   ? 'bg-orange-400'
        : 'bg-blue-500'
      }`} />

      <div className="pl-4 pr-3.5 py-3.5">
        {/* TOP ROW: source badge + priority dot + assignee */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Source badges */}
            {meta.isMeeting && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                <Video className="w-2.5 h-2.5" />
                <span>Meeting</span>
              </span>
            )}
            {meta.isClickUp && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-violet-100 dark:bg-violet-950/70 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60">
                <Zap className="w-2.5 h-2.5 fill-violet-600 dark:fill-violet-300" />
                <span>ClickUp</span>
              </span>
            )}
            {meta.isNotion && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <FileText className="w-2.5 h-2.5" />
                <span>Notion</span>
              </span>
            )}
            {meta.isAi && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                <Bot className="w-2.5 h-2.5" />
                <span>Flow AI</span>
              </span>
            )}

            {/* Priority dot + label (always shown, skipped if done) */}
            {!isDone && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${pCfg.bg} ${pCfg.textColor}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pCfg.color}`} />
                {pCfg.label}
              </span>
            )}
          </div>

          {/* Assignee avatar or initial */}
          <div className="shrink-0">
            {task.assignee?.avatarUrl ? (
              <img src={task.assignee.avatarUrl} alt={task.assignee.name || 'Assignee'} className="w-6 h-6 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
            ) : task.assignee?.name ? (
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold text-[10px] flex items-center justify-center border border-blue-200/60 dark:border-blue-800/60">
                {task.assignee.name[0].toUpperCase()}
              </div>
            ) : null}
          </div>
        </div>

        {/* MAIN ROW: checkbox + title */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={handleCheckboxClick}
            disabled={isDone || isCompleting}
            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${
              isDone
                ? 'bg-emerald-500 text-white shadow-xs'
                : meta.isMeeting
                ? 'border-2 border-purple-300 dark:border-purple-600 hover:border-purple-500 hover:scale-105'
                : meta.isClickUp
                ? 'border-2 border-violet-300 dark:border-violet-600 hover:border-violet-500 hover:scale-105'
                : priority === 'URGENT' || priority === 'HIGH'
                ? 'border-2 border-rose-400 dark:border-rose-500 hover:border-rose-500 hover:scale-105'
                : 'border-2 border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:scale-105'
            }`}
          >
            {isDone && <Check className="w-3 h-3 stroke-[3]" />}
          </button>

          <div className="min-w-0 flex-1">
            {/* Title */}
            <h4 className={`text-xs font-bold leading-snug tracking-tight break-words ${
              isDone
                ? 'line-through text-slate-400 dark:text-slate-500'
                : 'text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors'
            }`}>
              {meta.cleanTitle}
            </h4>

            {/* Completed banner */}
            {isDone && (
              <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
                Completed
              </div>
            )}

            {/* Sub-meta: project, due date, subtasks, join button */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {!meta.isMeeting && !meta.isClickUp && !meta.isNotion && (
                <span
                  className="text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1"
                  style={{ backgroundColor: `${projectColor}18`, color: projectColor }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: projectColor }} />
                  {projectTag}
                </span>
              )}

              {meta.platform && (
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Mic className="w-2.5 h-2.5 text-purple-500" />
                  {meta.platform}
                </span>
              )}

              {meta.clickUpSpace && (
                <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                  {meta.clickUpSpace}
                </span>
              )}

              {dueInfo && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                  dueInfo.isAlert
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                    : dueInfo.isToday
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                  <Calendar className="w-2.5 h-2.5" />
                  {dueInfo.label}
                </span>
              )}

              {meta.subtaskCount && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <CheckSquare className="w-2.5 h-2.5 text-blue-500" />
                  {meta.subtaskCount.completed}/{meta.subtaskCount.total}
                </span>
              )}

              {meta.joinUrl && /^(https?:\/\/|tg:\/\/)/i.test(meta.joinUrl) && (
                <button
                  type="button"
                  onClick={handleJoinClick}
                  className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 shadow-xs transition-colors"
                >
                  <Video className="w-2.5 h-2.5" />
                  <span>Join Call</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
