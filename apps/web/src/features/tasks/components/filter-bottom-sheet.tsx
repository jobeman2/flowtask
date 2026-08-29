'use client';

import React from 'react';
import { useTelegram } from '../../../hooks/use-telegram';
import { Button } from '@flowtask/ui';
import { X, Filter, RotateCcw } from 'lucide-react';

export interface FilterState {
  status: string | null;
  priority: string | null;
  projectId: string | null;
  assignedToMe: boolean;
  assigneeId: string | null;
  sortBy: 'DUE_DATE' | 'CREATED' | 'PRIORITY';
}

interface FilterBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onApplyFilters: (newFilters: FilterState) => void;
  projects: any[];
  members: any[];
}

export function FilterBottomSheet({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  projects,
  members,
}: FilterBottomSheetProps) {
  const { triggerHaptic } = useTelegram();
  const [localFilters, setLocalFilters] = React.useState<FilterState>(filters);

  React.useEffect(() => {
    setLocalFilters(filters);
  }, [filters, isOpen]);

  if (!isOpen) return null;

  const handleReset = () => {
    triggerHaptic('light');
    const resetState: FilterState = {
      status: null,
      priority: null,
      projectId: null,
      assignedToMe: false,
      assigneeId: null,
      sortBy: 'DUE_DATE',
    };
    setLocalFilters(resetState);
  };

  const handleApply = () => {
    triggerHaptic('medium');
    onApplyFilters(localFilters);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-0 animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto space-y-5">
        {/* Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto" />

        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-flow-600 dark:text-flow-400" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Filter & Sort
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 1. Priority */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Priority
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: null, label: 'All Priorities' },
              { id: 'URGENT', label: '🔴 Urgent' },
              { id: 'HIGH', label: '🟠 High' },
              { id: 'MEDIUM', label: '🟡 Medium' },
              { id: 'LOW', label: '🔵 Low' },
            ].map((p) => {
              const isSelected = localFilters.priority === p.id;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setLocalFilters({ ...localFilters, priority: p.id });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-flow-600 text-white shadow-flow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Assignee */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Assignee
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setLocalFilters({ ...localFilters, assignedToMe: false, assigneeId: null });
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                !localFilters.assignedToMe && !localFilters.assigneeId
                  ? 'bg-flow-600 text-white shadow-flow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Everyone
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setLocalFilters({ ...localFilters, assignedToMe: !localFilters.assignedToMe, assigneeId: null });
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                localFilters.assignedToMe
                  ? 'bg-flow-600 text-white shadow-flow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              👤 Assigned to Me
            </button>
            {members.map((m: any) => {
              const isSelected = localFilters.assigneeId === m.user?.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setLocalFilters({
                      ...localFilters,
                      assigneeId: isSelected ? null : m.user?.id,
                      assignedToMe: false,
                    });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-flow-600 text-white shadow-flow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {m.user?.avatarUrl && (
                    <img
                      src={m.user.avatarUrl}
                      alt={m.user.name || 'Member'}
                      className="w-3.5 h-3.5 rounded-full object-cover"
                    />
                  )}
                  <span>{m.user?.name || 'Member'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Projects */}
        {projects.length > 0 && (
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Project
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setLocalFilters({ ...localFilters, projectId: null });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  !localFilters.projectId
                    ? 'bg-flow-600 text-white shadow-flow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                All Projects
              </button>
              {projects.map((proj: any) => {
                const isSelected = localFilters.projectId === proj.id;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setLocalFilters({
                        ...localFilters,
                        projectId: isSelected ? null : proj.id,
                      });
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-flow-600 text-white shadow-flow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: proj.color || '#0d9488' }}
                    />
                    <span>{proj.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. Sort By */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Sort Order
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'DUE_DATE', label: 'Due Date' },
              { id: 'PRIORITY', label: 'Priority' },
              { id: 'CREATED', label: 'Recently Added' },
            ].map((s) => {
              const isSelected = localFilters.sortBy === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setLocalFilters({ ...localFilters, sortBy: s.id as any });
                  }}
                  className={`py-2 px-2 text-center text-xs font-bold rounded-xl transition-all ${
                    isSelected
                      ? 'bg-flow-600 text-white shadow-flow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Apply Action Button */}
        <div className="pt-2">
          <Button
            type="button"
            onClick={handleApply}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-flow-700 via-flow-600 to-teal-500 hover:from-flow-800 hover:to-teal-600 text-white font-bold text-sm shadow-flow-md"
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
}
