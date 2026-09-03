'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { KanbanView } from './kanban-view';
import { CalendarView } from './calendar-view';
import { ProjectsView } from '../../projects/components/projects-view';
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
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'TODO' | 'IN_PROGRESS' | 'DONE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Tasks
  const { data: tasks = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ['tasks', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getTasks(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: Boolean(workspaceId),
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

  // Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t: any) => {
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
  }, [tasks, activeFilter, selectedProjectId, searchQuery]);

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
            {filteredTasks.map((task: any) => {
              const isDone = task.status === 'DONE';
              const dueText = formatDue(task.dueDate);
              const projectTag = task.project?.name || (task.labels?.[0]?.name ? task.labels[0].name : 'General');
              const projectColor = task.project?.color || '#2563eb';

              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  className="bg-white dark:bg-slate-900/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left side: Circular Checkbox + Title & Tags */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isDone) return;
                          if (task.assigneeId && task.assigneeId !== user?.id) {
                            triggerHaptic('heavy');
                            alert(`Only ${task.assignee?.name || 'the assignee'} can complete this task.`);
                            return;
                          }
                          completeMutation.mutate(task.id);
                        }}
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                          isDone
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'border-2 border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:scale-105'
                        }`}
                      >
                        {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <h4
                          className={`text-xs font-bold leading-snug tracking-tight truncate ${
                            isDone
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors'
                          }`}
                        >
                          {task.title}
                        </h4>

                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className="text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1"
                            style={{
                              backgroundColor: `${projectColor}15`,
                              color: projectColor,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: projectColor }}
                            />
                            <span>{projectTag}</span>
                          </span>

                          {dueText && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              {dueText}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side: Assignee Avatar or Priority indicator */}
                    <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                      {task.assignee?.avatarUrl ? (
                        <img
                          src={task.assignee.avatarUrl}
                          alt={task.assignee.name || 'Assignee'}
                          className="w-6 h-6 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                      ) : task.assignee?.name ? (
                        <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold text-[10px] flex items-center justify-center">
                          {task.assignee.name[0].toUpperCase()}
                        </div>
                      ) : (
                        <span className={`w-2 h-2 rounded-full ring-2 ${getPriorityDot(task.priority)}`} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTasks.length === 0 && !isTasksLoading && (
              <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2.5">
                <p className="text-xs font-bold text-slate-500">No tasks match your filter.</p>
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
