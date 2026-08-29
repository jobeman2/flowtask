'use client';

import React from 'react';
import { useTelegram } from '../../hooks/use-telegram';
import {
  Compass,
  CheckSquare,
  Plus,
  Inbox,
  LayoutGrid,
} from 'lucide-react';

export type NavTab = 'HOME' | 'TASKS' | 'INBOX' | 'MORE';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenCreate: () => void;
}

export function BottomNav({
  activeTab,
  onTabChange,
  onOpenCreate,
}: BottomNavProps) {
  const { triggerHaptic } = useTelegram();

  const handleTabClick = (tab: NavTab) => {
    triggerHaptic('light');
    onTabChange(tab);
  };

  const handlePlusClick = () => {
    triggerHaptic('medium');
    onOpenCreate();
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2 pointer-events-none flex justify-center">
      <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl px-3 py-2 flex items-center justify-between pointer-events-auto transition-all">
        {/* Home Tab */}
        <button
          type="button"
          onClick={() => handleTabClick('HOME')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
            activeTab === 'HOME'
              ? 'text-flow-600 dark:text-flow-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <Compass className={`w-5 h-5 transition-transform ${activeTab === 'HOME' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">Home</span>
        </button>

        {/* Tasks Tab */}
        <button
          type="button"
          onClick={() => handleTabClick('TASKS')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
            activeTab === 'TASKS'
              ? 'text-flow-600 dark:text-flow-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <CheckSquare className={`w-5 h-5 transition-transform ${activeTab === 'TASKS' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">Tasks</span>
        </button>

        {/* Central Floating Plus Button */}
        <div className="relative -top-4 flex items-center justify-center px-1">
          <button
            type="button"
            onClick={handlePlusClick}
            aria-label="Create New Task"
            className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-flow-700 via-flow-600 to-teal-400 text-white flex items-center justify-center shadow-flow-md hover:shadow-flow-lg active:scale-95 transition-all duration-200 ring-4 ring-white dark:ring-slate-900 cursor-pointer"
          >
            <Plus className="w-7 h-7 stroke-[2.8]" />
          </button>
        </div>

        {/* Inbox / Telegram Tab */}
        <button
          type="button"
          onClick={() => handleTabClick('INBOX')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
            activeTab === 'INBOX'
              ? 'text-flow-600 dark:text-flow-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <Inbox className={`w-5 h-5 transition-transform ${activeTab === 'INBOX' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">Inbox</span>
        </button>

        {/* More / Workspace Tab */}
        <button
          type="button"
          onClick={() => handleTabClick('MORE')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
            activeTab === 'MORE'
              ? 'text-flow-600 dark:text-flow-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <LayoutGrid className={`w-5 h-5 transition-transform ${activeTab === 'MORE' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">More</span>
        </button>
      </div>
    </nav>
  );
}
