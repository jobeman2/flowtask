'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  X,
  Calendar,
  Clock,
  Video,
  Mic,
  MapPin,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Trash2,
  ListTodo,
} from 'lucide-react';

interface MeetingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingTask: any;
}

export function MeetingDetailModal({
  isOpen,
  onClose,
  meetingTask,
}: MeetingDetailModalProps) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [convertedCount, setConvertedCount] = useState<number | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // Extract Meeting Details
  const title = meetingTask?.title ? meetingTask.title.replace(/^\[Meeting\]\s*/i, '') : 'Team Meeting';
  const description = meetingTask?.description || '';

  // Extract URL from description
  const urlMatch = description.match(/Join URL:\s*([^\n]+)/i);
  const meetingUrl = urlMatch ? urlMatch[1].trim() : null;

  // Extract Platform from description
  const platformMatch = description.match(/Platform:\s*([^\n]+)/i);
  const platform = platformMatch ? platformMatch[1].trim() : '🎙️ Telegram Voice Call';

  // Extract Duration from description
  const durationMatch = description.match(/Duration:\s*([^\n]+)/i);
  const duration = durationMatch ? durationMatch[1].trim() : '30 mins';

  // Extract Host from description
  const hostMatch = description.match(/Host:\s*([^\n]+)/i);
  const host = hostMatch ? hostMatch[1].trim() : (meetingTask?.creator?.name || 'Team Lead');

  // Format Date & Time
  const dueDateObj = meetingTask?.dueDate ? new Date(meetingTask.dueDate) : new Date();
  const formattedDate = dueDateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const formattedTime = dueDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Delete Meeting Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !meetingTask?.id) return;
      return apiClient.deleteTask(meetingTask.id, workspaceId);
    },
    onSuccess: () => {
      triggerHaptic('heavy');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
      onClose();
    },
  });

  // Complete / End Meeting Mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !meetingTask?.id) return;
      return apiClient.completeTask(meetingTask.id, workspaceId);
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
      onClose();
    },
  });

  // Convert Agenda Action Items into Real FlowTask Tasks
  const handleConvertToTasks = async () => {
    if (!workspaceId || !description) return;
    setIsConverting(true);
    triggerHaptic('medium');

    try {
      // Find bullet points or numbered items
      const lines = description.split('\n');
      const actionItems: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (
          trimmed.startsWith('•') ||
          trimmed.startsWith('-') ||
          trimmed.startsWith('*') ||
          /^\d+\./.test(trimmed)
        ) {
          const cleanItem = trimmed.replace(/^([•\-*]|\d+\.)\s*/, '').trim();
          if (cleanItem && !cleanItem.toLowerCase().includes('agenda')) {
            actionItems.push(cleanItem);
          }
        }
      }

      if (actionItems.length === 0) {
        actionItems.push(`Follow up on ${title}`);
      }

      let count = 0;
      for (const item of actionItems) {
        await apiClient.createTask({
          workspaceId,
          title: item,
          description: `Action item generated from meeting: "${title}"`,
          priority: 'MEDIUM',
          assigneeId: user?.id,
        });
        count++;
      }

      triggerHaptic('heavy');
      setConvertedCount(count);
      setIsConverting(false);
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    } catch {
      setIsConverting(false);
    }
  };

  if (!isOpen || !meetingTask) return null;

  const isLink = meetingUrl && (meetingUrl.startsWith('http://') || meetingUrl.startsWith('https://'));

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in font-sans">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 text-white flex items-center justify-center font-extrabold shadow-md shadow-indigo-500/20">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                Scheduled Meeting
              </span>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight mt-0.5">
                {title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Items Converted Banner */}
        {convertedCount !== null && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Created {convertedCount} Action Item Tasks on Kanban Board!</span>
          </div>
        )}

        {/* Date, Time & Duration Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              <span>{formattedDate}</span>
            </div>
            <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">
              {formattedTime} ({duration})
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center gap-1.5">
              {platform.includes('Google') ? (
                <Video className="w-3.5 h-3.5 text-emerald-500" />
              ) : platform.includes('In-Person') ? (
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
              ) : (
                <Mic className="w-3.5 h-3.5 text-sky-500" />
              )}
              <span>{platform}</span>
            </div>
            <span>Host: {host}</span>
          </div>
        </div>

        {/* Join Call Action Button */}
        {isLink ? (
          <a
            href={meetingUrl!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => triggerHaptic('heavy')}
            className="w-full py-3.5 rounded-2xl font-extrabold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 shadow-md shadow-emerald-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <Video className="w-4 h-4" />
            <span>Join Video Conference</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        ) : (
          <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-sky-600" />
              <span>Telegram Group Voice Chat</span>
            </div>
            <span className="text-[10px] bg-sky-200/60 dark:bg-sky-900 px-2 py-0.5 rounded-full font-extrabold">
              Open Group Call
            </span>
          </div>
        )}

        {/* Agenda Section */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <ListTodo className="w-3.5 h-3.5 text-purple-500" />
              Meeting Agenda & Discussion
            </h4>
            <button
              type="button"
              disabled={isConverting}
              onClick={handleConvertToTasks}
              className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-900/50 px-2.5 py-1 rounded-xl hover:bg-purple-100 transition-all flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>{isConverting ? 'Creating...' : '⚡ Convert to Tasks'}</span>
            </button>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium leading-relaxed max-h-32 overflow-y-auto no-scrollbar">
            {description.replace(/^🎙️ Platform:[^\n]+\n🔗 Join URL:[^\n]+\n⏱️ Duration:[^\n]+\n👤 Host:[^\n]+\n\n/i, '') || '• Review sprint progress and deliverables\n• Discuss blockers and timeline'}
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={completeMutation.isPending}
            onClick={() => completeMutation.mutate()}
            className="py-2.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mark Completed</span>
          </button>

          <button
            type="button"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
            className="py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 transition-all flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Delete Meeting</span>
          </button>
        </div>
      </div>
    </div>
  );
}
