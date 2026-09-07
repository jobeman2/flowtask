'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { KanbanView } from './kanban-view';
import { CalendarView } from './calendar-view';
import { ProjectsView } from '../../projects/components/projects-view';
import { TaskCard, parseTaskMeta, TaskCategory } from './task-card';
import {
  Search,
  Check,
  Layers,
  LayoutGrid,
  Calendar as CalendarIcon,
  List,
  Folder,
} from 'lucide-react';

interface TasksViewProps {
  onSelectTask: (taskId: string) => void;
  onOpenCreate: () => void;
}

export type ViewMode = 'LIST' | 'BOARD' | 'CALENDAR' | 'PROJECTS';

export function TasksView({
  onSelectTask,
  onOpenCreate,
}: TasksViewProps) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [activeView, setActiveView] = useState<ViewMode>('LIST');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory>('ALL');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'TODO' | 'IN_PROGRESS' | 'DONE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Tasks (Live synchronized)
  const { data: tasks = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ['tasks', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getTasks(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: Boolean(workspaceId),
    refetchInterval: 3000,
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

  // Dynamic Category Counts
  const categoryCounts = useMemo(() => {
    let taskCount = 0;
    let meetingCount = 0;
    let clickupCount = 0;
    let notionCount = 0;

    tasks.forEach((t: any) => {
      const meta = parseTaskMeta(t);
      if (meta.isMeeting) meetingCount++;
      else if (meta.isClickUp) clickupCount++;
      else if (meta.isNotion) notionCount++;
      else taskCount++;
    });

    return {
      all: tasks.length,
      task: taskCount,
      meeting: meetingCount,
      clickup: clickupCount,
      notion: notionCount,
    };
  }, [tasks]);

  // Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t: any) => {
      // Category Filter (Meetings, ClickUp, Notion, Normal Task)
      if (categoryFilter !== 'ALL') {
        const meta = parseTaskMeta(t);
        if (categoryFilter === 'MEETING' && !meta.isMeeting) return false;
        if (categoryFilter === 'CLICKUP' && !meta.isClickUp) return false;
        if (categoryFilter === 'NOTION' && !meta.isNotion) return false;
        if (categoryFilter === 'TASK' && (meta.isMeeting || meta.isClickUp || meta.isNotion)) return false;
      }

      // Status Filter
      if (activeFilter === 'TODO' && t.status !== 'TODO') return false;
      if (activeFilter === 'IN_PROGRESS' && t.status !== 'IN_PROGRESS') return false;
      if (activeFilter === 'DONE' && t.status !== 'DONE') return false;

      // Project Filter
      if (selectedProjectId && t.projectId !== selectedProjectId) return false;

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesProject = t.project?.name?.toLowerCase().includes(q);
        const matchesAssignee = t.assignee?.name?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesProject && !matchesAssignee) return false;
      }

      return true;
    });
  }, [tasks, categoryFilter, activeFilter, selectedProjectId, searchQuery]);

  // Priority Dot Color
  const getPriorityDot = (priority: string) => {
    if (priority === 'URGENT' || priority === 'HIGH') return 'bg-rose-500 ring-rose-500/20';
    if (priority === 'MEDIUM') return 'bg-amber-500 ring-amber-500/20';
    return 'bg-blue-500 ring-blue-500/20';
  };

  // Format Due Date
  const formatDue = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-300 font-sans">
      {/* 1. Multi-View Mode Switcher (List | Board | Calendar | Projects) */}
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
              onClick={() => {
                triggerHaptic('light');
                setActiveView(view.id);
              }}
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
          onSelectProject={(projId) => {
            setSelectedProjectId(projId);
            setActiveView('LIST');
          }}
        />
      )}

      {activeView === 'BOARD' && (
        <KanbanView
          tasks={filteredTasks}
          onSelectTask={onSelectTask}
          onOpenCreate={onOpenCreate}
        />
      )}

      {activeView === 'CALENDAR' && (
        <CalendarView
          tasks={tasks}
          onSelectTask={onSelectTask}
          onOpenCreate={onOpenCreate}
        />
      )}

      {activeView === 'LIST' && (
        <div className="space-y-4">
          {/* Project Quick Filter Chips */}
          {projects.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedProjectId(null);
                }}
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
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedProjectId(isSel ? null : proj.id);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      isSel
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: proj.color || '#3b82f6' }}
                    />
                    <span>{proj.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Category Filter Pills (All, Tasks, Meetings, ClickUp, Notion) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setCategoryFilter('ALL');
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                categoryFilter === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <span>All</span>
              <span className="text-[10px] opacity-75">({categoryCounts.all})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setCategoryFilter('TASK');
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                categoryFilter === 'TASK'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <span>📋 Tasks</span>
              <span className="text-[10px] opacity-75">({categoryCounts.task})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setCategoryFilter('MEETING');
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                categoryFilter === 'MEETING'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100'
              }`}
            >
              <span>🎙️ Meetings</span>
              <span className="text-[10px] opacity-75">({categoryCounts.meeting})</span>
            </button>

            {(categoryCounts.clickup > 0 || categoryFilter === 'CLICKUP') && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setCategoryFilter('CLICKUP');
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                  categoryFilter === 'CLICKUP'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100'
                }`}
              >
                <span>⚡ ClickUp</span>
                <span className="text-[10px] opacity-75">({categoryCounts.clickup})</span>
              </button>
            )}

            {(categoryCounts.notion > 0 || categoryFilter === 'NOTION') && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setCategoryFilter('NOTION');
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                  categoryFilter === 'NOTION'
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                <span>📓 Notion</span>
                <span className="text-[10px] opacity-75">({categoryCounts.notion})</span>
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {(['ALL', 'TODO', 'IN_PROGRESS', 'DONE'] as const).map((filter) => {
              const labels = {
                ALL: 'All Status',
                TODO: 'To Do',
                IN_PROGRESS: 'In Progress',
                DONE: 'Done',
              };
              const isActive = activeFilter === filter;

              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveFilter(filter);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {labels[filter]}
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
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks by title, project, assignee..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full pl-9 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 font-medium transition-colors shadow-xs"
            />
          </div>

          {/* Task Cards List */}
          <div className="space-y-2.5">
            {filteredTasks.map((task: any) => (
              <TaskCard
                key={task.id}
                task={task}
                currentUserId={user?.id}
                onSelect={onSelectTask}
                onComplete={(id) => completeMutation.mutate(id)}
                isCompleting={completeMutation.isPending}
              />
            ))}

            {filteredTasks.length === 0 && !isTasksLoading && (
              <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2.5">
                <p className="text-xs font-bold text-slate-500">
                  {categoryFilter === 'ALL'
                    ? 'No tasks match your filter.'
                    : `No ${categoryFilter.toLowerCase()} items found.`}
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
          </div>
        </div>
      )}
    </div>
  );
}
