'use client';

import React from 'react';
import { useTelegram } from '../../hooks/use-telegram';
import {
  Home,
  CheckSquare,
  Plus,
  Users,
  User,
} from 'lucide-react';

export type NavTab = 'HOME' | 'TASKS' | 'TEAM' | 'PROFILE';

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
      <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full border border-slate-200/80 dark:border-slate-800/80 shadow-xl px-4 py-2 flex items-center justify-between pointer-events-auto transition-all">
        {/* Home Tab */}
        <button
          type="button"
          onClick={() => handleTabClick('HOME')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-full transition-all ${
            activeTab === 'HOME'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <Home className={`w-5 h-5 transition-transform ${activeTab === 'HOME' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">Home</span>
        </button>

        {/* Tasks Tab */}
        <button
          type="button"
          onClick={() => handleTabClick('TASKS')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-full transition-all ${
            activeTab === 'TASKS'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <CheckSquare className={`w-5 h-5 transition-transform ${activeTab === 'TASKS' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">Tasks</span>
        </button>

        {/* Central Floating Plus Button */}
        <div className="relative -top-3 flex items-center justify-center px-1">
          <button
            type="button"
            onClick={handlePlusClick}
            aria-label="Create New Task"
            className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 active:scale-95 transition-all duration-200 ring-4 ring-white dark:ring-slate-900 cursor-pointer"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
        </div>

        {/* Team Tab */}
        <button
          type="button"
          onClick={() => handleTabClick('TEAM')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-full transition-all ${
            activeTab === 'TEAM'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <Users className={`w-5 h-5 transition-transform ${activeTab === 'TEAM' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">Team</span>
        </button>

        {/* Profile Tab */}
        <button
          type="button"
          onClick={() => handleTabClick('PROFILE')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-full transition-all ${
            activeTab === 'PROFILE'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <User className={`w-5 h-5 transition-transform ${activeTab === 'PROFILE' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-0.5 tracking-tight">Profile</span>
        </button>
      </div>
    </nav>
  );
}
