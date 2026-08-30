'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { Button } from '@flowtask/ui';
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Search,
  Calendar,
  MessageSquare,
  RefreshCw,
  X,
  Filter,
  User,
  Image as ImageIcon,
  Bot,
} from 'lucide-react';
import { CreateTaskModal } from './create-task-dialog';
import { TaskDetailModal } from './task-detail-modal';
import { ProjectsView } from '../../projects/components/projects-view';
import { TeamView } from '../../team/components/team-view';

type TabView = 'ALL' | 'ASSIGNED' | 'TODAY' | 'UPCOMING' | 'PROJECTS' | 'TEAM' | 'DONE';

export function TaskList() {
  const { workspaceId, user: currentUser, isLoading: isAuthLoading } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabView>('ALL');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // 1. Fetch Task Statistics
  const { data: stats } = useQuery({
    queryKey: ['task-stats', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const res = await apiClient.getTaskStats(workspaceId);
      return res.data;
    },
    enabled: !!workspaceId,
  });

  // 2. Fetch Projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getProjects(workspaceId);
      return res.data || [];
    },
    enabled: !!workspaceId,
  });

  // 3. Fetch Tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', workspaceId, selectedProjectId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getTasks(workspaceId, {
        projectId: selectedProjectId || undefined,
      });
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: !!workspaceId,
  });

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

  // Filtering Logic based on activeTab, search, priority, project
  const filteredTasks = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return tasks.filter((t: any) => {
      // Tab view filter
      if (activeTab === 'DONE') {
        if (t.status !== 'DONE') return false;
      } else {
        if (t.status === 'DONE') return false;
      }

      if (activeTab === 'ASSIGNED') {
        if (!currentUser?.id || t.assigneeId !== currentUser.id) return false;
      }

      if (activeTab === 'TODAY') {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        if (d < startOfToday || d > endOfToday) return false;
      }

      if (activeTab === 'UPCOMING') {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        if (d <= endOfToday) return false;
      }

      // Priority filter
      if (priorityFilter && t.priority !== priorityFilter) {
        return false;
      }

      // Live search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }

      return true;
    });
  }, [tasks, activeTab, priorityFilter, searchQuery]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
        <span className="text-xs font-medium">Loading workspace tasks...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Quick Stats Metric Cards */}
      <div className="grid grid-cols-4 gap-2">
        <div
          onClick={() => {
            setActiveTab('ALL');
            setSelectedProjectId(null);
          }}
          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 ring-2 ring-blue-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Active</span>
          <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400 block mt-0.5">
            {stats?.totalActive ?? 0}
          </span>
        </div>

        <div
          onClick={() => {
            setActiveTab('TODAY');
            setSelectedProjectId(null);
          }}
          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'TODAY'
              ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Today</span>
          <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400 block mt-0.5">
            {stats?.dueToday ?? 0}
          </span>
        </div>

        <div
          onClick={() => {
            setActiveTab('TODAY');
            setSelectedProjectId(null);
          }}
          className="p-3 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 cursor-pointer hover:border-slate-300"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Overdue</span>
          <span className="text-lg font-extrabold text-rose-600 dark:text-rose-400 block mt-0.5">
            {stats?.overdue ?? 0}
          </span>
        </div>

        <div
          onClick={() => {
            setActiveTab('DONE');
            setSelectedProjectId(null);
          }}
          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'DONE'
              ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Done</span>
          <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 block mt-0.5">
            {stats?.completed ?? 0}
          </span>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-slate-800 pb-1">
        <div className="flex items-center space-x-1">
          {(
            [
              { id: 'ALL', label: 'All Tasks' },
              { id: 'ASSIGNED', label: '👤 Assigned to Me' },
              { id: 'TODAY', label: 'Today' },
              { id: 'UPCOMING', label: 'Upcoming' },
              { id: 'PROJECTS', label: 'Projects' },
              { id: 'TEAM', label: 'Team' },
              { id: 'DONE', label: 'Done' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                triggerHaptic('light');
                setActiveTab(tab.id);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Button
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="rounded-xl px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1 shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </Button>
      </div>

      {/* 3. Conditional Sub-Views */}
      {activeTab === 'TEAM' ? (
        <TeamView />
      ) : activeTab === 'PROJECTS' ? (
        <ProjectsView
          selectedProjectId={selectedProjectId}
          onSelectProject={(pId) => {
            setSelectedProjectId(pId);
            if (pId) {
              setActiveTab('ALL');
            }
          }}
        />
      ) : (
        <>
          {/* Search and Priority Filter Bar */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search tasks by title or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Chips: Projects & Priority */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3" />
                Filter:
              </span>

              {/* Priority Chips */}
              {[
                { id: null, label: 'Any' },
                { id: 'URGENT', label: '🔴 Urgent' },
                { id: 'HIGH', label: '🟠 High' },
                { id: 'MEDIUM', label: '🟡 Medium' },
                { id: 'LOW', label: '🔵 Low' },
              ].map((p) => (
                <button
                  key={p.label}
                  onClick={() => setPriorityFilter(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    priorityFilter === p.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/60'
                  }`}
                >
                  {p.label}
                </button>
              ))}

              {/* Project Filter Badges if any selected */}
              {selectedProjectId && (
                <div className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-lg font-semibold shrink-0">
                  <span>Project: {projects.find((p: any) => p.id === selectedProjectId)?.name || 'Filtered'}</span>
                  <button onClick={() => setSelectedProjectId(null)}>
                    <X className="w-3 h-3 ml-0.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Task Cards List */}
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 space-y-2">
              <Clock className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
              <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">No tasks found</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                {searchQuery || priorityFilter
                  ? 'Try clearing the active filters or search terms.'
                  : activeTab === 'DONE'
                  ? 'No completed tasks yet.'
                  : 'Tap "+ Add" above to schedule a task or forward messages from Telegram.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((task: any) => {
                const isDone = task.status === 'DONE';
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDone;

                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedTaskId(task.id);
                    }}
                    className={`p-3.5 bg-white dark:bg-slate-900 rounded-2xl border transition-all cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 shadow-sm active:scale-[0.99] ${
                      isDone ? 'opacity-60 bg-slate-50/80 dark:bg-slate-900/40' : ''
                    } ${isOverdue ? 'border-rose-200 dark:border-rose-900/50' : 'border-slate-200 dark:border-slate-800'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            !isDone && completeMutation.mutate(task.id);
                          }}
                          className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
                          disabled={isDone || completeMutation.isPending}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Circle className="w-5 h-5 hover:text-emerald-600" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-semibold leading-snug break-words ${
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

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {(task.description?.includes('🤖') || task.description?.includes('AI Project Manager') || task.title?.includes('[AI]')) && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 shadow-2xs">
                                <Bot className="w-3 h-3" />
                                <span>Flow AI</span>
                              </span>
                            )}

                            {task.project && (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-xs"
                                style={{ backgroundColor: task.project.color || '#3b82f6' }}
                              >
                                {task.project.name}
                              </span>
                            )}

                            {task.dueDate && (
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                                  isOverdue
                                    ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                              </span>
                            )}

                            {task.isRecurring && (
                              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                                <RefreshCw className="w-2.5 h-2.5" />
                                <span>Repeats</span>
                              </span>
                            )}

                            {task.assignee && (
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                                  task.assigneeId === currentUser?.id
                                    ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-300 dark:border-indigo-700 shadow-xs'
                                    : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40'
                                }`}
                              >
                                {task.assignee.avatarUrl ? (
                                  <img
                                    src={task.assignee.avatarUrl}
                                    alt={task.assignee.name || 'Assignee'}
                                    className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                                  />
                                ) : (
                                  <User className="w-2.5 h-2.5" />
                                )}
                                <span>{task.assigneeId === currentUser?.id ? '👤 Assigned to You' : task.assignee.name || 'Assigned'}</span>
                              </span>
                            )}

                            {task.imageUrl && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                                <ImageIcon className="w-3 h-3" />
                                <span>Image</span>
                              </span>
                            )}

                            {task._count?.comments > 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                                <MessageSquare className="w-3 h-3" />
                                <span>{task._count.comments}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg border ${
                            task.priority === 'URGENT'
                              ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                              : task.priority === 'HIGH'
                              ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                              : task.priority === 'MEDIUM'
                              ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                              : 'bg-slate-500/10 text-slate-600 border-slate-500/30'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <CreateTaskModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      <TaskDetailModal
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  );
}

