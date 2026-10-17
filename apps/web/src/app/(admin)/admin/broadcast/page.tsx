'use client';

import React, { useState } from 'react';
import {
  Radio,
  Send,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { adminClient } from '../../../../lib/admin-client';

export default function AdminBroadcastPage() {
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'ALL_GROUPS' | 'SUPER_ADMINS'>('ALL_GROUPS');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    if (!confirm('Are you sure you want to broadcast this announcement?')) return;

    setIsSending(true);
    setFeedback(null);

    try {
      const res = await adminClient.broadcastAnnouncement(message, target);
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: res.data.message || 'Announcement broadcast successfully sent!',
        });
        setMessage('');
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to dispatch broadcast',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Connection error',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Global Platform Broadcast
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Send announcements, release notices, or maintenance alerts to all connected Telegram groups.
        </p>
      </div>

      {/* 2. Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 3. Composer & Preview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Composer Form */}
        <form
          onSubmit={handleBroadcast}
          className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Compose Announcement
            </h3>
            <Radio className="w-4 h-4 text-blue-600 animate-pulse" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Audience Target
            </label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as any)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL_GROUPS">All Linked Telegram Groups</option>
              <option value="SUPER_ADMINS">Super Administrators Only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Message Content (Markdown supported)
            </label>
            <textarea
              rows={6}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="📢 Announcement: FlowTask 2.0 has launched with automated Telebirr matching!"
              className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={!message.trim() || isSending}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{isSending ? 'Dispatching...' : 'Send Broadcast Announcement'}</span>
          </button>
        </form>

        {/* Live Preview Box */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Telegram Chat Preview
            </h3>
            <MessageSquare className="w-4 h-4 text-slate-400" />
          </div>

          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 min-h-[220px] flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold text-blue-600">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>FlowTask Bot @flowtask_bot</span>
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans">
                {message.trim() || 'Your message preview will appear here in real time...'}
              </div>
            </div>

            <div className="text-[10px] text-slate-400 text-right font-mono mt-4">
              Just now · Broadcast
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
