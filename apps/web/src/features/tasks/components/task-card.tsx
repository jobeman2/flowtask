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
  AlertTriangle,
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

  return (
    <div
      onClick={() => {
        triggerHaptic('light');
        onSelect(task.id);
      }}
      className={`relative rounded-2xl p-3.5 border transition-all cursor-pointer group shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.03)] hover:shadow-md active:scale-[0.99] overflow-hidden ${
        isDone
          ? 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800 opacity-65'
          : meta.isMeeting
          ? 'bg-white dark:bg-slate-800/90 border-purple-200/80 dark:border-purple-900/50 hover:border-purple-300 shadow-[0_3px_12px_-3px_rgba(168,85,247,0.12)]'
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
            ? 'bg-purple-500'
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
        {/* Checkbox button */}
        <button
          type="button"
          onClick={handleCheckboxClick}
          disabled={isDone || isCompleting}
          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${
            isDone
              ? 'bg-emerald-600 text-white shadow-xs'
              : meta.isMeeting
              ? 'border-2 border-purple-400 dark:border-purple-600 hover:border-purple-500 hover:scale-105'
              : meta.isClickUp
              ? 'border-2 border-violet-400 dark:border-violet-600 hover:border-violet-500 hover:scale-105'
              : 'border-2 border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:scale-105'
          }`}
        >
          {isDone && <Check className="w-3 h-3 stroke-[3]" />}
        </button>

        {/* Main Content Area */}
        <div className="min-w-0 flex-1">
          {/* Top Line: Title + Assignee Avatar */}
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

            {/* Assignee Avatar / Initial or subtle priority dot */}
            {task?.assignee?.avatarUrl ? (
              <img
                src={task.assignee.avatarUrl}
                alt={task.assignee?.name || 'Assignee'}
                className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0 mt-0.5"
              />
            ) : task?.assignee?.name ? (
              <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold text-[9px] flex items-center justify-center border border-blue-200/60 dark:border-blue-700/60 shadow-2xs shrink-0 mt-0.5">
                {task.assignee.name?.[0]?.toUpperCase() || 'U'}
              </div>
            ) : (task?.priority === 'URGENT' || task?.priority === 'HIGH') ? (
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1.5" />
            ) : null}
          </div>

          {/* Bottom Line: Badges & Metadata (Clean compact chips) */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {/* Category / Source Badges */}
            {meta.isMeeting && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80 shadow-2xs">
                <Video className="w-2.5 h-2.5 text-purple-600 dark:text-purple-300" />
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
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md truncate max-w-[130px]">
                {meta.platform}
              </span>
            )}

            {meta.clickUpSpace && (
              <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded-md truncate max-w-[130px]">
                {meta.clickUpSpace}
              </span>
            )}

            {/* Join Call Action Button for Meetings */}
            {meta.joinUrl && /^(https?:\/\/|tg:\/\/)/i.test(meta.joinUrl) && (
              <button
                type="button"
                onClick={handleJoinClick}
                className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors"
              >
                <Video className="w-2.5 h-2.5" />
                <span>Join</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-80" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
