'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  X,
  Sparkles,
  Bot,
  Layers,
  Calendar,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  User,
  Zap,
} from 'lucide-react';

interface AiProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ClassifiedTask {
  id: string;
  title: string;
  description: string;
  domain: string;
  domainColor: string;
  suggestedAssigneeName?: string;
  suggestedAssigneeId?: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueInDays: number;
}

const IDEA_SUGGESTIONS = [
  'Launch Telebirr recurring payments & receipt notifications',
  'Food delivery mini app with menu, cart & driver dispatch',
  'Full Design system overhaul with Tailwind dark mode tokens',
  '2-week high-priority bugfix & security audit sprint',
];

export function AiProjectManagerModal({ isOpen, onClose }: AiProjectManagerModalProps) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [prompt, setPrompt] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);
  const [tasks, setTasks] = useState<ClassifiedTask[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);
  const [deployedCount, setDeployedCount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch workspace members for assignment dropdowns
  const { data: members = [] } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getWorkspaceMembers(workspaceId);
      return res.data || [];
    },
    enabled: Boolean(workspaceId && isOpen),
  });

  if (!isOpen) return null;

  const handleClassifyPrompt = async (customPrompt?: string) => {
    const textToUse = customPrompt || prompt;
    if (!textToUse.trim()) {
      triggerHaptic('heavy');
      setErrorMsg('Please enter a project idea or select a template.');
      return;
    }

    setErrorMsg(null);
    setIsClassifying(true);
    setDeployedCount(null);
    triggerHaptic('medium');

    try {
      const res = await fetch('/api/ai/project-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToUse.trim(),
          workspaceMembers: members,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to analyze project idea');
      }

      setTasks(data.tasks || []);
      // Select all tasks by default
      setSelectedTaskIds(new Set((data.tasks || []).map((t: any) => t.id)));
      setIsClassifying(false);
      triggerHaptic('light');
    } catch (err: any) {
      setIsClassifying(false);
      triggerHaptic('heavy');
      setErrorMsg(err.message || 'AI Classification encountered an error.');
    }
  };

  const handleToggleSelectTask = (taskId: string) => {
    triggerHaptic('light');
    const newSet = new Set(selectedTaskIds);
    if (newSet.has(taskId)) {
      newSet.delete(taskId);
    } else {
      newSet.add(taskId);
    }
    setSelectedTaskIds(newSet);
  };

  const handleDeploySelectedTasks = async () => {
    if (!workspaceId || selectedTaskIds.size === 0) return;

    const tasksToDeploy = tasks.filter((t) => selectedTaskIds.has(t.id));
    setIsDeploying(true);
    setDeployProgress(10);
    triggerHaptic('medium');

    try {
      let completed = 0;
      for (const t of tasksToDeploy) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (t.dueInDays || 3));

        await apiClient.createTask({
          workspaceId,
          title: t.title,
          description: `${t.description}\n\n🏷️ Domain: ${t.domain}\n🤖 AI Project Manager Recommendation`,
          priority: t.priority,
          dueDate: dueDate.toISOString(),
          assigneeId: t.suggestedAssigneeId || user?.id,
        });

        completed++;
        setDeployProgress(Math.round((completed / tasksToDeploy.length) * 100));
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      triggerHaptic('heavy');
      setDeployedCount(completed);
      setIsDeploying(false);
      setTasks([]);
      setSelectedTaskIds(new Set());

      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
    } catch (err: any) {
      setIsDeploying(false);
      triggerHaptic('heavy');
      setErrorMsg(err.message || 'Failed to create tasks on Kanban.');
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in font-sans">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 text-white flex items-center justify-center font-extrabold shadow-md shadow-purple-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-none">
                  AI Project Manager
                </h3>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  Test Tool
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium pt-0.5">
                Idea prompt classifier & smart team task allocator
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

        {/* Success Banner */}
        {deployedCount !== null && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-emerald-800 dark:text-emerald-300 text-xs font-bold space-y-1 animate-in fade-in shadow-xs">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Sprint Deployed! Created {deployedCount} Tasks on Kanban!</span>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pl-5.5 leading-relaxed">
              All tasks have been classified, assigned to team members, and added to your Board & Calendar.
            </p>
          </div>
        )}

        {/* Prompt Input Box */}
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>Describe your project idea or sprint goal</span>
          </label>
          <div className="relative">
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. We need to launch Telebirr payments next week: backend webhook, payment sheet UI, automated receipt bot, and social media flyers."
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-purple-500 font-medium resize-none leading-relaxed transition-colors"
            />
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        {tasks.length === 0 && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              💡 Quick Idea Starters
            </label>
            <div className="flex flex-col gap-1.5">
              {IDEA_SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPrompt(s);
                    handleClassifyPrompt(s);
                  }}
                  className="text-left p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 text-[11px] font-bold text-purple-900 dark:text-purple-200 hover:border-purple-300 transition-all flex items-center justify-between group"
                >
                  <span className="truncate pr-2">{s}</span>
                  <Zap className="w-3 h-3 text-purple-500 group-hover:scale-110 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Generate / Classify Button */}
        {tasks.length === 0 && (
          <button
            type="button"
            disabled={isClassifying || !prompt.trim()}
            onClick={() => handleClassifyPrompt()}
            className="w-full py-3.5 rounded-2xl font-extrabold text-xs text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:opacity-95 shadow-md shadow-purple-500/25 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isClassifying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>AI is Classifying Tasks & Matching Team...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>⚡ Classify & Assign Team Tasks</span>
              </>
            )}
          </button>
        )}

        {/* Classified Tasks Feed */}
        {tasks.length > 0 && (
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-500" />
                <span>AI Classified Tasks ({selectedTaskIds.size}/{tasks.length})</span>
              </h4>
              <button
                type="button"
                onClick={() => setTasks([])}
                className="text-[10px] text-slate-400 hover:text-slate-600 font-bold"
              >
                Reset
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
              {tasks.map((t) => {
                const isSelected = selectedTaskIds.has(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => handleToggleSelectTask(t.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md text-white"
                          style={{ backgroundColor: t.domainColor }}
                        >
                          {t.domain}
                        </span>
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {t.priority}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Due in {t.dueInDays}d
                      </span>
                    </div>

                    <h5 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                      {t.title}
                    </h5>

                    <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {t.description}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-purple-500" />
                        <span>Assigned to: <strong className="text-purple-600 dark:text-purple-400">{t.suggestedAssigneeName}</strong></span>
                      </div>
                      <span className="text-purple-600 dark:text-purple-400 font-extrabold">
                        {isSelected ? '✓ Included' : 'Excluded'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Deploy Progress */}
            {isDeploying && (
              <div className="space-y-1.5 p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                <div className="flex justify-between items-center text-xs font-bold text-purple-900 dark:text-purple-200">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" />
                    Deploying tasks to Kanban...
                  </span>
                  <span>{deployProgress}%</span>
                </div>
                <div className="w-full bg-purple-200 dark:bg-purple-900/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all duration-200"
                    style={{ width: `${deployProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Deploy All Tasks Button */}
            <button
              type="button"
              disabled={isDeploying || selectedTaskIds.size === 0}
              onClick={handleDeploySelectedTasks}
              className="w-full py-3.5 rounded-2xl font-extrabold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 shadow-md shadow-emerald-500/25 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Zap className="w-4 h-4" />
              <span>
                {isDeploying
                  ? 'Deploying Tasks...'
                  : `⚡ Approve & Deploy ${selectedTaskIds.size} Tasks to Kanban`}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
