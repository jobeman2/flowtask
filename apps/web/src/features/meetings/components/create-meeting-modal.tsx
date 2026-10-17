'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { useNotifications } from '../../../providers/notification-provider';
import {
  X,
  Calendar,
  Clock,
  Video,
  Mic,
  MapPin,
  Link,
  CheckCircle2,
  AlertCircle,
  FileText,
  Zap,
} from 'lucide-react';

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: Date;
}

export function CreateMeetingModal({ isOpen, onClose, initialDate }: CreateMeetingModalProps) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const { showToast } = useNotifications();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<'TELEGRAM' | 'GOOGLE_MEET' | 'ZOOM' | 'IN_PERSON'>('TELEGRAM');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [duration, setDuration] = useState('30m');
  const [date, setDate] = useState(
    initialDate
      ? initialDate.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [time, setTime] = useState('10:00');
  const [agenda, setAgenda] = useState('• Review sprint progress & blockers\n• Action items and assignments');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const createMeetingMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error('No active workspace selected');
      if (!title.trim()) throw new Error('Meeting topic is required');

      // Combine date and time
      const [year, month, day] = date.split('-').map(Number);
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledDateTime = new Date(year, month - 1, day, hours, minutes);

      let finalUrl = meetingUrl.trim();
      let platformLabel = 'Telegram Voice Call';

      if (platform === 'GOOGLE_MEET') {
        platformLabel = 'Google Meet';
        if (!finalUrl) finalUrl = 'https://meet.google.com/new';
      } else if (platform === 'ZOOM') {
        platformLabel = 'Zoom Call';
        if (!finalUrl) finalUrl = 'https://zoom.us/join';
      } else if (platform === 'IN_PERSON') {
        platformLabel = 'In-Person Office Room';
        if (!finalUrl) finalUrl = 'Meeting Room A';
      } else {
        if (!finalUrl) finalUrl = 'Telegram Group Call';
      }

      const description =
        `Platform: ${platformLabel}\n` +
        `Join URL: ${finalUrl}\n` +
        `Duration: ${duration}\n` +
        `Host: ${user?.name || 'Team Lead'}\n\n` +
        `Agenda:\n${agenda.trim()}`;

      const res = await apiClient.createTask({
        workspaceId,
        title: `[Meeting] ${title.trim()}`,
        description,
        priority: 'HIGH',
        dueDate: scheduledDateTime.toISOString(),
        assigneeId: user?.id,
      });

      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      triggerHaptic('heavy');
      setIsSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });

      showToast({
        type: 'TASK_CREATED',
        title: 'Meeting Scheduled',
        message: `Meeting "${title.trim() || 'Meeting'}" scheduled successfully`,
      });

      setTimeout(() => {
        setIsSuccess(false);
        setTitle('');
        setMeetingUrl('');
        onClose();
      }, 1000);
    },
    onError: (err: any) => {
      triggerHaptic('heavy');
      setErrorMsg(err.message || 'Failed to schedule meeting');
    },
  });

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in font-sans"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-meeting-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-3xl p-4 sm:p-5 shadow-2xl border border-slate-200/60 dark:border-slate-800 space-y-4 max-h-[calc(100dvh-0.75rem)] sm:max-h-[92dvh] overflow-y-auto overscroll-contain no-scrollbar pb-[max(1rem,env(safe-area-inset-bottom,1rem))]"
      >
        {/* Top Handle Indicator */}
        <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto -mt-1 mb-1 shrink-0" />

        {/* Header */}
        <div className="sticky top-[-1rem] sm:top-[-1.25rem] z-10 -mx-4 sm:-mx-5 px-4 sm:px-5 pt-3 pb-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 via-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white leading-none">
                Schedule Meeting
              </h3>
              <p className="text-[10px] text-slate-400 font-medium pt-0.5">
                Automated team alerts & 1-tap call join
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close meeting form"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs rounded-2xl font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isSuccess && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-emerald-800 dark:text-emerald-300 text-xs font-bold space-y-0.5 animate-in fade-in flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p>Meeting Scheduled Successfully!</p>
              <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                Added to calendar & team agenda.
              </p>
            </div>
          </div>
        )}

        {/* Meeting Title Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Meeting Topic / Title</span>
            <span className="text-[10px] text-slate-400 font-semibold">Required</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sprint Planning, Client Demo, Design Review"
            className="w-full bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl px-4 py-3 text-[16px] sm:text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-bold transition-all shadow-2xs"
          />
        </div>

        {/* Platform Selection Tabs */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-700 dark:text-slate-300">
            Meeting Platform
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'TELEGRAM', label: 'Telegram Call', icon: Mic, color: 'text-sky-500' },
              { id: 'GOOGLE_MEET', label: 'Google Meet', icon: Video, color: 'text-blue-500' },
              { id: 'ZOOM', label: 'Zoom Video', icon: Video, color: 'text-indigo-500' },
              { id: 'IN_PERSON', label: 'In-Person Room', icon: MapPin, color: 'text-rose-500' },
            ].map((p) => {
              const isSel = platform === p.id;
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setPlatform(p.id as any);
                  }}
                  className={`p-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2.5 border active:scale-95 ${
                    isSel
                      ? 'bg-blue-50/90 dark:bg-blue-950/60 border-2 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm shadow-blue-500/15'
                      : 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isSel ? 'bg-blue-100 dark:bg-blue-900/60' : 'bg-white dark:bg-slate-700/60'}`}>
                    <Icon className={`w-3.5 h-3.5 ${p.color}`} />
                  </div>
                  <span className="truncate">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Meeting Link / Location (Optional) */}
        {platform !== 'TELEGRAM' && (
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-blue-500" />
              <span>{platform === 'IN_PERSON' ? 'Room / Location' : 'Call Link / URL'}</span>
            </label>
            <input
              type="text"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder={
                platform === 'GOOGLE_MEET'
                  ? 'https://meet.google.com/abc-defg-hij'
                  : platform === 'ZOOM'
                  ? 'https://zoom.us/j/123456789'
                  : 'Meeting Room 3B, 2nd Floor'
              }
              className="w-full bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl px-4 py-2.5 text-[16px] sm:text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium transition-all shadow-2xs"
            />
          </div>
        )}

        {/* Date, Time & Duration */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-blue-500" />
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-bold shadow-2xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-500" />
              Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-bold shadow-2xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
              Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 font-bold shadow-2xs"
            >
              <option value="15m">15 mins</option>
              <option value="30m">30 mins</option>
              <option value="45m">45 mins</option>
              <option value="1h">1 hour</option>
              <option value="1.5h">1.5 hours</option>
            </select>
          </div>
        </div>

        {/* Agenda & Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-500" />
              Agenda & Key Points
            </span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Converts to tasks
            </span>
          </label>
          <textarea
            rows={2}
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            placeholder="• Topic 1&#10;• Topic 2"
            className="w-full bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-3.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium resize-none leading-relaxed shadow-2xs"
          />
        </div>

        {/* Submit Button */}
        <div className="sticky bottom-[-1rem] sm:bottom-[-1.25rem] -mx-4 sm:-mx-5 px-4 sm:px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,1rem))] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={createMeetingMutation.isPending}
            onClick={() => createMeetingMutation.mutate()}
            className="w-full py-3.5 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/25 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Calendar className="w-4 h-4 text-sky-200" />
            <span>
              {createMeetingMutation.isPending
                ? 'Scheduling…'
                : 'Schedule & Alert Team'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}


