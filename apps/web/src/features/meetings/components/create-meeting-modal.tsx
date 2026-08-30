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
  Link,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: Date;
}

export function CreateMeetingModal({ isOpen, onClose, initialDate }: CreateMeetingModalProps) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
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
      let platformLabel = '🎙️ Telegram Voice Call';

      if (platform === 'GOOGLE_MEET') {
        platformLabel = '🌐 Google Meet';
        if (!finalUrl) finalUrl = 'https://meet.google.com/new';
      } else if (platform === 'ZOOM') {
        platformLabel = '💻 Zoom Call';
        if (!finalUrl) finalUrl = 'https://zoom.us/join';
      } else if (platform === 'IN_PERSON') {
        platformLabel = '🏢 In-Person Office Room';
        if (!finalUrl) finalUrl = 'Meeting Room A';
      } else {
        if (!finalUrl) finalUrl = 'Telegram Group Call';
      }

      const description =
        `🎙️ Platform: ${platformLabel}\n` +
        `🔗 Join URL: ${finalUrl}\n` +
        `⏱️ Duration: ${duration}\n` +
        `👤 Host: ${user?.name || 'Team Lead'}\n\n` +
        `📋 Agenda:\n${agenda.trim()}`;

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
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in font-sans">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 text-white flex items-center justify-center font-extrabold shadow-md shadow-indigo-500/20">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-none">
                Schedule Meeting
              </h3>
              <p className="text-[10px] text-slate-400 font-medium pt-0.5">
                Automated team alerts & 1-tap call join
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs rounded-2xl font-semibold flex items-center gap-2">
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
          <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
            Meeting Topic / Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sprint Planning, Client Demo, Design Review"
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-indigo-500 font-medium transition-colors"
          />
        </div>

        {/* Platform Selection Tabs */}
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
            Meeting Platform
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'TELEGRAM', label: 'Telegram Call', icon: Mic, color: 'text-sky-500' },
              { id: 'GOOGLE_MEET', label: 'Google Meet', icon: Video, color: 'text-emerald-500' },
              { id: 'ZOOM', label: 'Zoom Video', icon: Video, color: 'text-blue-500' },
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
                  className={`p-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 border ${
                    isSel
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${p.color}`} />
                  <span className="truncate">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Meeting Link / Location (Optional) */}
        {platform !== 'TELEGRAM' && (
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-indigo-500" />
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
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-indigo-500 font-medium transition-colors"
            />
          </div>
        )}

        {/* Date, Time & Duration */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-500" />
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-500" />
              Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
              Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-medium"
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
          <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-purple-500" />
              Agenda & Key Points
            </span>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
              ⚡ Converts to tasks
            </span>
          </label>
          <textarea
            rows={2}
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            placeholder="• Topic 1\n• Topic 2"
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-indigo-500 font-medium resize-none leading-relaxed"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="button"
            disabled={createMeetingMutation.isPending}
            onClick={() => createMeetingMutation.mutate()}
            className="w-full py-3.5 rounded-2xl font-extrabold text-xs text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:opacity-95 shadow-md shadow-indigo-500/25 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Calendar className="w-4 h-4" />
            <span>
              {createMeetingMutation.isPending
                ? 'Scheduling Meeting...'
                : 'Schedule & Alert Team'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
