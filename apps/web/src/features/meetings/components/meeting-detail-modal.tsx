'use client';

import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  X,
  Clock,
  Video,
  Mic,
  MapPin,
  ExternalLink,
  Trash2,
  Users,
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
  const { workspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  // Extract Meeting Details
  const title = meetingTask?.title ? meetingTask.title.replace(/^\[Meeting\]\s*/i, '') : 'Team Meeting';
  const description = meetingTask?.description || '';

  // Extract URL from description
  const urlMatch = description.match(/Join URL:\s*([^\n]+)/i);
  const meetingUrl = urlMatch ? urlMatch[1].trim() : null;

  // Extract Platform from description
  const platformMatch = description.match(/Platform:\s*([^\n]+)/i);
  const rawPlatform = platformMatch ? platformMatch[1].trim() : 'Telegram Voice Call';
  const platform = rawPlatform.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim() || 'Telegram Voice Call';

  // Extract Duration from description
  const durationMatch = description.match(/Duration:\s*([^\n]+)/i);
  const duration = durationMatch ? durationMatch[1].trim() : '30 mins';

  // Extract Host from description
  const hostMatch = description.match(/Host:\s*([^\n]+)/i);
  const host = hostMatch ? hostMatch[1].trim() : (meetingTask?.creator?.name || 'Team Lead');

  // Extract actual agenda/description content (strip the metadata header)
  const agendaContent = description
    .replace(/^(🎙️\s*)?Platform:[^\n]+\n/i, '')
    .replace(/^(🔗\s*)?Join URL:[^\n]+\n/i, '')
    .replace(/^(⏱️\s*)?Duration:[^\n]+\n/i, '')
    .replace(/^(👤\s*)?Host:[^\n]+\n/i, '')
    .replace(/^\n+/, '')
    .replace(/^Agenda:\s*\n?/i, '')
    .trim();

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

  if (!isOpen || !meetingTask) return null;

  const isLink = meetingUrl && (meetingUrl.startsWith('http://') || meetingUrl.startsWith('https://'));

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm font-sans"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-800 max-h-[88dvh] flex flex-col animate-in slide-in-from-bottom duration-200">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-0.5">
              Meeting
            </p>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight truncate">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 ml-3"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Date, Time & Duration */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span>{formattedDate}</span>
              </div>
              <span className="text-blue-600 dark:text-blue-400 font-extrabold">
                {formattedTime} ({duration})
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5">
                {platform.toLowerCase().includes('google') ? (
                  <Video className="w-3.5 h-3.5 text-blue-500" />
                ) : platform.toLowerCase().includes('in-person') || platform.toLowerCase().includes('office') ? (
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-blue-500" />
                )}
                <span>{platform}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>{host}</span>
              </div>
            </div>
          </div>

          {/* Join Call Button */}
          {isLink ? (
            <a
              href={meetingUrl!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => triggerHaptic('heavy')}
              className="w-full py-3 rounded-2xl font-extrabold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Video className="w-4 h-4" />
              <span>Join Video Conference</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>
          ) : (
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-blue-600" />
                <span>Telegram Group Voice Chat</span>
              </div>
              <span className="text-[10px] bg-blue-200/60 dark:bg-blue-900 px-2.5 py-1 rounded-full font-extrabold">
                Open Group Call
              </span>
            </div>
          )}

          {/* Description / Agenda — only show if there is actual content */}
          {agendaContent && (
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-0.5">
                Details
              </h4>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium leading-relaxed">
                {agendaContent}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Bottom — Delete only */}
        <div className="p-4 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            type="button"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (confirm('Delete this meeting?')) {
                deleteMutation.mutate();
              }
            }}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 transition-all flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{deleteMutation.isPending ? 'Deleting...' : 'Delete Meeting'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
