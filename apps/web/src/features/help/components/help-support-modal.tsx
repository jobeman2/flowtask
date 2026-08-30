'use client';

import React, { useState } from 'react';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  X,
  Search,
  BookOpen,
  Terminal,
  Layers,
  ShieldCheck,
  CreditCard,
  ChevronDown,
  ExternalLink,
  MessageCircle,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpSupportModal({ isOpen, onClose }: HelpSupportModalProps) {
  const { triggerHaptic } = useTelegram();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'GETTING_STARTED' | 'COMMANDS' | 'VIEWS' | 'PERMISSIONS' | 'BILLING'>('ALL');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq-1');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = [
    { id: 'ALL', label: 'All Topics', icon: BookOpen },
    { id: 'GETTING_STARTED', label: 'Quickstart', icon: Sparkles },
    { id: 'COMMANDS', label: 'Bot Commands', icon: Terminal },
    { id: 'VIEWS', label: 'Multi-Views', icon: Layers },
    { id: 'PERMISSIONS', label: 'Permissions', icon: ShieldCheck },
    { id: 'BILLING', label: 'Telebirr', icon: CreditCard },
  ] as const;

  const faqs = [
    {
      id: 'faq-1',
      category: 'GETTING_STARTED',
      question: 'How do I start using Flow in Telegram groups?',
      answer:
        'Simply add @flowtaskmanager_bot to your Telegram group or team chat. The bot will automatically create a connected workspace for your group members. Anyone can start posting tasks with natural language like /task Buy domain tomorrow @username.',
    },
    {
      id: 'faq-2',
      category: 'COMMANDS',
      question: 'What are the main Telegram bot commands?',
      answer:
        '• /task <title> <datetime> <@user> — Create tasks with auto date parser\n• /board — View live Kanban board columns in Telegram\n• /inbox — View all your assigned tasks across all workspaces\n• /projects — Overview of project milestone progress\n• /leaderboard — Top completing teammates in the last 7 days\n• /stats — Detailed productivity and status breakdown\n• /done <task_id> — Quick mark task completed',
    },
    {
      id: 'faq-3',
      category: 'PERMISSIONS',
      question: 'Who can mark an assigned task as Done?',
      answer:
        'For security and accountability, strictly ONLY the assigned user (@assignee) can mark an assigned task as done. If another user attempts to mark it done, the bot and mini app will protect it and require the assignee to complete it.',
    },
    {
      id: 'faq-4',
      category: 'VIEWS',
      question: 'How do the 4 Multi-View modes work?',
      answer:
        '• List View: Fast daily checklist with search and filter pills\n• Board View: Interactive Kanban columns (To Do → In Progress → In Review → Done)\n• Calendar View: Monthly date calendar with agenda by time\n• Projects View: Milestone boards with task counters and custom color palettes.',
    },
    {
      id: 'faq-5',
      category: 'BILLING',
      question: 'How does Telebirr payment and upgrade work?',
      answer:
        'You can upgrade your workspace for just 10 ETB/month using Telebirr. Click on the Upgrade banner in Profile to open the Telebirr checkout dialog and pay directly using your Ethiopian phone number.',
    },
  ];

  const commandsList = [
    { cmd: '/task Design landing page tomorrow at 4pm @assignee', desc: 'Create task with smart date parser' },
    { cmd: '/board', desc: 'Live Kanban column summary in group' },
    { cmd: '/inbox', desc: 'Grouped tasks across all workspaces' },
    { cmd: '/projects', desc: 'Active milestone boards and progress' },
    { cmd: '/leaderboard', desc: 'Team completion leaderboard' },
    { cmd: '/stats', desc: 'Workspace productivity metrics' },
  ];

  const filteredFaqs = faqs.filter((f) => {
    if (activeCategory !== 'ALL' && f.category !== activeCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
    }
    return true;
  });

  const handleCopy = (text: string) => {
    triggerHaptic('medium');
    navigator.clipboard.writeText(text);
    setCopiedCommand(text);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in font-sans">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
              ?
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Help & Support
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guides, commands & questions..."
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-full pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 font-medium transition-colors"
          />
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveCategory(cat.id as any);
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Telegram Command Cheatsheet */}
        {(activeCategory === 'ALL' || activeCategory === 'COMMANDS') && !searchQuery && (
          <div className="space-y-2 pt-1">
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-blue-500" />
              <span>Telegram Bot Commands</span>
            </h4>
            <div className="space-y-1.5">
              {commandsList.map((item) => (
                <div
                  key={item.cmd}
                  onClick={() => handleCopy(item.cmd)}
                  className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 cursor-pointer hover:border-blue-200 transition-all group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold font-mono text-blue-600 dark:text-blue-400 truncate">
                      {item.cmd}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                      {item.desc}
                    </p>
                  </div>
                  <button className="text-slate-400 group-hover:text-blue-600 shrink-0 p-1">
                    {copiedCommand === item.cmd ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAQs Accordion */}
        <div className="space-y-2 pt-1">
          <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-purple-500" />
            <span>Frequently Asked Questions</span>
          </h4>

          <div className="space-y-2">
            {filteredFaqs.map((faq) => {
              const isExpanded = expandedFaqId === faq.id;

              return (
                <div
                  key={faq.id}
                  className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setExpandedFaqId(isExpanded ? null : faq.id);
                    }}
                    className="w-full p-3 text-left flex items-center justify-between gap-2 font-bold text-xs text-slate-800 dark:text-slate-200"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                        isExpanded ? 'rotate-180 text-blue-600' : ''
                      }`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium whitespace-pre-line border-t border-slate-100/60 dark:border-slate-800/60 pt-2 animate-in fade-in">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredFaqs.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400 font-medium">
                No matching topics found. Try searching another keyword.
              </div>
            )}
          </div>
        </div>

        {/* Live Telegram Support Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-white" />
              <h4 className="text-xs font-extrabold">Need Live Assistance?</h4>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-white/80" />
          </div>
          <p className="text-[11px] text-blue-100 font-medium">
            Contact the Flow Support Bot directly on Telegram for real-time help.
          </p>
          <a
            href="https://t.me/flowtaskmanager_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full py-2 rounded-xl bg-white text-blue-600 font-extrabold text-xs shadow-sm hover:bg-blue-50 transition-colors"
          >
            Open Telegram Support Bot
          </a>
        </div>
      </div>
    </div>
  );
}
