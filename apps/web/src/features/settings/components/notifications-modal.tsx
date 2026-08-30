'use client';

import React, { useState, useEffect } from 'react';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  X,
  Bell,
  Clock,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Sun,
  Save,
} from 'lucide-react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationsModal({ isOpen, onClose }: NotificationsModalProps) {
  const { triggerHaptic } = useTelegram();

  // Local state persisted in localStorage
  const [telegramDMs, setTelegramDMs] = useState(true);
  const [dueReminder1Hour, setDueReminder1Hour] = useState(true);
  const [dueReminder1Day, setDueReminder1Day] = useState(true);
  const [overdueAlerts, setOverdueAlerts] = useState(true);
  const [morningDigest, setMorningDigest] = useState(true);
  const [subtaskUpdates, setSubtaskUpdates] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('flow_notification_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.telegramDMs !== undefined) setTelegramDMs(parsed.telegramDMs);
        if (parsed.dueReminder1Hour !== undefined) setDueReminder1Hour(parsed.dueReminder1Hour);
        if (parsed.dueReminder1Day !== undefined) setDueReminder1Day(parsed.dueReminder1Day);
        if (parsed.overdueAlerts !== undefined) setOverdueAlerts(parsed.overdueAlerts);
        if (parsed.morningDigest !== undefined) setMorningDigest(parsed.morningDigest);
        if (parsed.subtaskUpdates !== undefined) setSubtaskUpdates(parsed.subtaskUpdates);
        if (parsed.soundEnabled !== undefined) setSoundEnabled(parsed.soundEnabled);
      }
    } catch {}
  }, []);

  const handleSave = () => {
    triggerHaptic('medium');
    const settings = {
      telegramDMs,
      dueReminder1Hour,
      dueReminder1Day,
      overdueAlerts,
      morningDigest,
      subtaskUpdates,
      soundEnabled,
    };
    try {
      localStorage.setItem('flow_notification_settings', JSON.stringify(settings));
    } catch {}

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in font-sans">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
              <Bell className="w-4 h-4" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Notification Preferences
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Telegram Direct Messages */}
        <div className="space-y-2">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Direct Alerts
          </h4>

          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 space-y-3">
            {/* Direct DM Toggle */}
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                  Telegram Private DMs
                </span>
                <p className="text-[10px] text-slate-400 font-medium">
                  Receive private DM when tasks are assigned to you
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setTelegramDMs(!telegramDMs);
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  telegramDMs ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform transform ${
                    telegramDMs ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Subtask Alerts */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
              <div className="space-y-0.5 min-w-0">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Subtask Check-off Alerts
                </span>
                <p className="text-[10px] text-slate-400 font-medium">
                  Notify when teammates check off task subtasks
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSubtaskUpdates(!subtaskUpdates);
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  subtaskUpdates ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform transform ${
                    subtaskUpdates ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Deadline Countdown Alarms */}
        <div className="space-y-2 pt-1">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Deadline & Due Reminders
          </h4>

          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 space-y-3 text-xs">
            {/* 1 Hour Before */}
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  1 Hour Countdown Alarm
                </span>
                <p className="text-[10px] text-slate-400 font-medium">
                  Urgent alert 60 minutes before scheduled due time
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setDueReminder1Hour(!dueReminder1Hour);
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  dueReminder1Hour ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform transform ${
                    dueReminder1Hour ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 1 Day Before */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
              <div className="space-y-0.5 min-w-0">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-500" />
                  24 Hours Before Due Date
                </span>
                <p className="text-[10px] text-slate-400 font-medium">
                  Advance reminder one day before due date
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setDueReminder1Day(!dueReminder1Day);
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  dueReminder1Day ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform transform ${
                    dueReminder1Day ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Overdue Alarms */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
              <div className="space-y-0.5 min-w-0">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  Immediate Overdue Alert
                </span>
                <p className="text-[10px] text-slate-400 font-medium">
                  Dispatched instantly if a deadline passes without completion
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setOverdueAlerts(!overdueAlerts);
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  overdueAlerts ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform transform ${
                    overdueAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: Daily Morning Briefing */}
        <div className="space-y-2 pt-1">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Digest & Briefing
          </h4>

          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  Daily Morning Digest (9:00 AM)
                </span>
                <p className="text-[10px] text-slate-400 font-medium">
                  Summary of your tasks scheduled for today
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setMorningDigest(!morningDigest);
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  morningDigest ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform transform ${
                    morningDigest ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3.5 rounded-2xl font-extrabold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 active:scale-98 transition-all flex items-center justify-center gap-1.5"
          >
            {savedSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Preferences Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Notification Settings</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
