'use client';

import React, { useState, useEffect } from 'react';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  X,
  Settings,
  Moon,
  Sun,
  LayoutGrid,
  List,
  Calendar,
  Smartphone,
  Clock,
  Trash2,
  CheckCircle2,
  Save,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { triggerHaptic } = useTelegram();

  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [defaultView, setDefaultView] = useState<'LIST' | 'BOARD' | 'CALENDAR'>('LIST');
  const [hapticLevel, setHapticLevel] = useState<'light' | 'medium' | 'heavy' | 'off'>('medium');
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [clearedSuccess, setClearedSuccess] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('flow_app_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.theme) setTheme(parsed.theme);
        if (parsed.defaultView) setDefaultView(parsed.defaultView);
        if (parsed.hapticLevel) setHapticLevel(parsed.hapticLevel);
        if (parsed.timeFormat) setTimeFormat(parsed.timeFormat);
      }
    } catch {}
  }, []);

  const handleSave = () => {
    triggerHaptic('medium');
    const settings = {
      theme,
      defaultView,
      hapticLevel,
      timeFormat,
    };
    try {
      localStorage.setItem('flow_app_settings', JSON.stringify(settings));
    } catch {}

    // Apply dark mode class
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleClearCache = () => {
    triggerHaptic('heavy');
    try {
      localStorage.removeItem('flow_app_settings');
      localStorage.removeItem('flow_notification_settings');
    } catch {}
    setClearedSuccess(true);
    setTimeout(() => setClearedSuccess(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in font-sans">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
              <Settings className="w-4 h-4" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              App Preferences
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Appearance Theme */}
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            Color Theme
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'light', label: 'Light', icon: Sun },
              { id: 'dark', label: 'Dark', icon: Moon },
              { id: 'system', label: 'System', icon: Smartphone },
            ].map((t) => {
              const Icon = t.icon;
              const isSel = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setTheme(t.id as any);
                  }}
                  className={`py-2 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    isSel
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Default Landing View */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <LayoutGrid className="w-3.5 h-3.5 text-blue-500" />
            Default View on Launch
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'LIST', label: 'List View', icon: List },
              { id: 'BOARD', label: 'Kanban', icon: LayoutGrid },
              { id: 'CALENDAR', label: 'Calendar', icon: Calendar },
            ].map((v) => {
              const Icon = v.icon;
              const isSel = defaultView === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setDefaultView(v.id as any);
                  }}
                  className={`py-2 px-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    isSel
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{v.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Haptic Feedback Level */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-purple-500" />
            Tactile Haptic Feedback
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['light', 'medium', 'heavy', 'off'] as const).map((lvl) => {
              const isSel = hapticLevel === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    triggerHaptic(lvl === 'off' ? 'light' : (lvl as any));
                    setHapticLevel(lvl);
                  }}
                  className={`py-2 rounded-xl text-[11px] font-bold capitalize transition-all ${
                    isSel
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 4: Time Format */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            Time Format
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: '12h', label: '12-Hour (05:00 PM)' },
              { id: '24h', label: '24-Hour (17:00)' },
            ].map((f) => {
              const isSel = timeFormat === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setTimeFormat(f.id as any);
                  }}
                  className={`py-2 px-3 rounded-2xl text-xs font-bold transition-all ${
                    isSel
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 5: Cache & Storage */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Local Storage Cache</h4>
              <p className="text-[10px] text-slate-400 font-medium">Clear cached offline data and preferences</p>
            </div>
            <button
              type="button"
              onClick={handleClearCache}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 transition-all flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>{clearedSuccess ? 'Cleared!' : 'Clear'}</span>
            </button>
          </div>
        </div>

        {/* Save Settings Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3.5 rounded-2xl font-extrabold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 active:scale-98 transition-all flex items-center justify-center gap-1.5"
          >
            {savedSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Settings Applied!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Preferences</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
