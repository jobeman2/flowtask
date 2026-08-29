'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  CheckCircle2,
  Circle,
  Plus,
  Search,
  Calendar,
  MessageSquare,
  RefreshCw,
  X,
  Filter,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { FilterBottomSheet, FilterState } from './filter-bottom-sheet';

type SegmentTab = 'ALL' | 'MINE' | 'TODAY' | 'UPCOMING' | 'DONE';

interface TasksViewProps {
  onSelectTask: (taskId: string) => void;
  onOpenCreate: () => void;
}

export function TasksView({ onSelectTask, onOpenCreate }: TasksViewProps) {
  const { workspaceId, user: currentUser } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [activeSegment, setActiveSegment] = useState<SegmentTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    status: null,
    priority: null,
    projectId: null,
    assignedToMe: false,
    assigneeId: null,
    sortBy: 'DUE_DATE',
  });

  // 1. Fetch Projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getProjects(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: Boolean(workspaceId),
  });

  // 2. Fetch Workspace Members
  const { data: members = [] } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getWorkspaceMembers(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: Boolean(workspaceId),
  });

  // 3. Fetch Tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getTasks(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: Boolean(workspaceId),
  });

  // Complete Task Mutation
  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!workspaceId) return;
      return apiClient.completeTask(taskId, workspaceId);
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    },
  });

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status) count++;
    if (filters.priority) count++;
    if (filters.projectId) count++;
    if (filters.assignedToMe || filters.assigneeId) count++;
    if (filters.sortBy !== 'DUE_DATE') count++;
    return count;
  }, [filters]);

  // Filtered & Sorted Tasks
  const filteredTasks = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    let list = tasks.filter((t: any) => {
      // Segment Tab Filter
      if (activeSegment === 'DONE') {
        if (t.status !== 'DONE') return false;
      } else {
        if (t.status === 'DONE') return false;
      }

      if (activeSegment === 'MINE') {
        if (!currentUser?.id || t.assigneeId !== currentUser.id) return false;
      }

      if (activeSegment === 'TODAY') {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate).getTime();
        if (d < startOfToday || d > endOfToday) return false;
      }

      if (activeSegment === 'UPCOMING') {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate).getTime();
        if (d <= endOfToday) return false;
      }

      // Bottom Sheet Filters
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.projectId && t.projectId !== filters.projectId) return false;
      if (filters.assignedToMe && t.assigneeId !== currentUser?.id) return false;
      if (filters.assigneeId && t.assigneeId !== filters.assigneeId) return false;

      // Live search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }

      return true;
    });

    // Sorting
    list = [...list].sort((a: any, b: any) => {
      if (filters.sortBy === 'PRIORITY') {
        const pWeight: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
        return (pWeight[b.priority] || 0) - (pWeight[a.priority] || 0);
      }
      if (filters.sortBy === 'CREATED') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      // Default: DUE_DATE
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return list;
  }, [tasks, activeSegment, filters, searchQuery, currentUser]);

  return (
    <div className="space-y-4 pb-24 animate-in fade-in">
      {/* 1. Header & Segment Tabs */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        {(
          [
            { id: 'ALL', label: 'All Tasks' },
            { id: 'MINE', label: 'Mine' },
            { id: 'TODAY', label: 'Today' },
            { id: 'UPCOMING', label: 'Upcoming' },
            { id: 'DONE', label: 'Done' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveSegment(tab.id);
            }}
            className={`flex-1 py-2 px-2 text-center text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
              activeSegment === tab.id
                ? 'bg-flow-600 text-white shadow-flow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 2. Integrated Search Bar & Filter Button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search tasks, descriptions, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-2.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-flow-500 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Sheet Trigger */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setIsFilterOpen(true);
          }}
          className={`p-2.5 rounded-2xl border flex items-center gap-1.5 transition-all shadow-xs shrink-0 ${
            activeFilterCount > 0
              ? 'bg-flow-50 dark:bg-flow-950/60 border-flow-500 text-flow-700 dark:text-flow-300 font-bold'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-500 hover:text-slate-800'
          }`}
        >
          <Filter className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-flow-600 text-white text-[10px] flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* 3. Task Cards Feed */}
      {filteredTasks.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-flow-50 dark:bg-flow-950/60 text-flow-600 flex items-center justify-center mx-auto shadow-inner">
            <Sparkles className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              {searchQuery || activeFilterCount > 0
                ? 'No matching tasks'
                : activeSegment === 'DONE'
                ? 'No completed tasks yet'
                : activeSegment === 'MINE'
                ? 'No tasks assigned to you'
                : 'Your task list is clear'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              {searchQuery || activeFilterCount > 0
                ? 'Try adjusting your search query or reset active filters.'
                : 'Turn Telegram conversations into organized work with FlowTask.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-flow-600 hover:bg-flow-700 text-white font-bold text-xs shadow-flow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task: any) => {
            const isDone = task.status === 'DONE';
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDone;

            return (
              <div
                key={task.id}
                onClick={() => {
                  triggerHaptic('light');
                  onSelectTask(task.id);
                }}
                className={`p-4 bg-white dark:bg-slate-900 rounded-3xl border transition-all cursor-pointer hover:border-flow-400 dark:hover:border-slate-700 shadow-sm active:scale-[0.99] ${
                  isDone ? 'opacity-55 bg-slate-50/90 dark:bg-slate-900/40' : ''
                } ${isOverdue ? 'border-rose-200 dark:border-rose-900/50 ring-1 ring-rose-500/10' : 'border-slate-200/80 dark:border-slate-800'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Checkbox & Details */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        !isDone && completeMutation.mutate(task.id);
                      }}
                      className="mt-0.5 text-slate-400 hover:text-flow-600 transition-colors shrink-0"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-flow-600" />
                      ) : (
                        <Circle className="w-5 h-5 hover:text-flow-600" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-bold leading-snug break-words ${
                          isDone
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {task.title}
                      </p>

                      {task.description && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {task.description}
                        </p>
                      )}

                      {/* Metadata Pill Row */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {task.project && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-xs"
                            style={{ backgroundColor: task.project.color || '#0d9488' }}
                          >
                            {task.project.name}
                          </span>
                        )}

                        {task.dueDate && (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isOverdue
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            <span>
                              {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </span>
                        )}

                        {task.isRecurring && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-flow-700 dark:text-flow-300 bg-flow-50 dark:bg-flow-950/40 px-2 py-0.5 rounded-md">
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span>Repeats</span>
                          </span>
                        )}

                        {task.imageUrl && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                            <ImageIcon className="w-3 h-3" />
                            <span>Image</span>
                          </span>
                        )}

                        {task._count?.comments > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                            <MessageSquare className="w-3 h-3" />
                            <span>{task._count.comments}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Priority Pill & Assignee Avatar */}
                  <div className="shrink-0 flex flex-col items-end justify-between self-stretch gap-2">
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${
                        task.priority === 'URGENT'
                          ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/50'
                          : task.priority === 'HIGH'
                          ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/50'
                          : task.priority === 'MEDIUM'
                          ? 'bg-flow-50 text-flow-700 border-flow-200 dark:bg-flow-950/50'
                          : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800'
                      }`}
                    >
                      {task.priority || 'NORMAL'}
                    </span>

                    {task.assignee && (
                      <div>
                        {task.assignee.avatarUrl ? (
                          <img
                            src={task.assignee.avatarUrl}
                            alt={task.assignee.name || 'Assignee'}
                            className="w-6 h-6 rounded-full object-cover ring-1 ring-white dark:ring-slate-800 shadow-xs"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-flow-700 via-flow-600 to-teal-400 text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                            {task.assignee.name?.[0]?.toUpperCase() || 'A'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter Bottom Sheet */}
      <FilterBottomSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onApplyFilters={(newFilters) => setFilters(newFilters)}
        projects={projects}
        members={members}
      />
    </div>
  );
}
