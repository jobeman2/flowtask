'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { KanbanView } from './kanban-view';
import { CalendarView } from './calendar-view';
import { ProjectsView } from '../../projects/components/projects-view';
import { TaskCard } from './task-card';
import {
  Search,
  Layers,
  LayoutGrid,
  Calendar as CalendarIcon,
  List,
  Folder,
  ChevronDown,
} from 'lucide-react';

interface TasksViewProps {
  onSelectTask: (taskId: string) => void;
  onOpenCreate: () => void;
}

export type ViewMode = 'LIST' | 'BOARD' | 'CALENDAR' | 'PROJECTS';

type StatusFilter = 'ALL' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'BACKLOG' | 'DONE' | 'CANCELLED';

const STATUS_LABELS: Record<StatusFilter, string> = {
  ALL: 'All',
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const PAGE_SIZE = 20;

export function TasksView({ onSelectTask, onOpenCreate }: TasksViewProps) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [activeView, setActiveView] = useState<ViewMode>('LIST');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Fetch Tasks — no polling, SSE live events handle updates
  const { data: tasks = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ['tasks', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getTasks(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });

  // Fetch Projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getProjects(workspaceId);
      return Array.isArray(res.data) ? res.data : [];
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

  // Filter Tasks (client-side, on top of already-fetched data)
  const filteredTasks = useMemo(() => {
    setPage(1); // reset page when filters change
    return tasks.filter((t: any) => {
      if (activeFilter !== 'ALL' && t.status !== activeFilter) return false;
      if (selectedProjectId && t.projectId !== selectedProjectId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (t.title || '').toLowerCase().includes(q);
        const matchesProject = (t.project?.name || '').toLowerCase().includes(q);
        const matchesAssignee = (t.assignee?.name || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesProject && !matchesAssignee) return false;
      }
      return true;
    });
  }, [tasks, activeFilter, selectedProjectId, searchQuery]);

  // Paginate
  const paginatedTasks = useMemo(
    () => filteredTasks.slice(0, page * PAGE_SIZE),
    [filteredTasks, page]
  );
  const hasMore = paginatedTasks.length < filteredTasks.length;

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-300 font-sans">
      {/* 1. Multi-View Mode Switcher */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 w-full">
        {([
          { id: 'LIST', label: 'List', icon: List },
          { id: 'BOARD', label: 'Board', icon: LayoutGrid },
          { id: 'CALENDAR', label: 'Calendar', icon: CalendarIcon },
          { id: 'PROJECTS', label: 'Projects', icon: Folder },
        ] as const).map((view) => {
          const Icon = view.icon;
          const isActive = activeView === view.id;
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => { triggerHaptic('light'); setActiveView(view.id); }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{view.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Render Active View */}
      {activeView === 'PROJECTS' && (
        <ProjectsView
          selectedProjectId={selectedProjectId}
          onSelectProject={(projId) => { setSelectedProjectId(projId); setActiveView('LIST'); }}
        />
      )}

      {activeView === 'BOARD' && (
        <KanbanView tasks={filteredTasks} onSelectTask={onSelectTask} onOpenCreate={onOpenCreate} />
      )}

      {activeView === 'CALENDAR' && (
        <CalendarView tasks={tasks} onSelectTask={onSelectTask} onOpenCreate={onOpenCreate} />
      )}

      {activeView === 'LIST' && (
        <div className="space-y-4">
          {/* Project Quick Filter Chips */}
          {projects.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); setSelectedProjectId(null); }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedProjectId === null
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>All Projects</span>
              </button>
              {projects.map((proj: any) => {
                const isSel = selectedProjectId === proj.id;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => { triggerHaptic('light'); setSelectedProjectId(isSel ? null : proj.id); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      isSel
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: proj.color || '#3b82f6' }} />
                    <span>{proj.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Status Filter Pills — all 7 statuses */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {(['ALL', 'BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'] as StatusFilter[]).map((filter) => {
              const isActive = activeFilter === filter;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => { triggerHaptic('light'); setActiveFilter(filter); setPage(1); }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {STATUS_LABELS[filter]}
                </button>
              );
            })}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search tasks by title, project, assignee..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full pl-9 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 font-medium transition-colors shadow-xs"
            />
          </div>

          {/* Task Cards — paginated */}
          <div className="space-y-2.5">
            {isTasksLoading && (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!isTasksLoading && paginatedTasks.map((task: any) => (
              <TaskCard
                key={task.id}
                task={task}
                currentUserId={user?.id}
                onSelect={onSelectTask}
                onComplete={(id) => completeMutation.mutate(id)}
                isCompleting={completeMutation.isPending}
              />
            ))}

            {!isTasksLoading && filteredTasks.length === 0 && (
              <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2.5">
                <p className="text-xs font-bold text-slate-500">
                  {activeFilter === 'ALL'
                    ? 'No tasks yet.'
                    : `No tasks with status "${STATUS_LABELS[activeFilter]}".`}
                </p>
                <button
                  type="button"
                  onClick={onOpenCreate}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  + Create a new task
                </button>
              </div>
            )}

            {/* Load More */}
            {hasMore && (
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); setPage((p) => p + 1); }}
                className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-200 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
                <span>Load more ({filteredTasks.length - paginatedTasks.length} remaining)</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
