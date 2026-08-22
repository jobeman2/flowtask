'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { Button, Card, Badge } from '@flowtask/ui';
import { CheckCircle2, Circle, Clock, Plus, FolderKanban } from 'lucide-react';
import { CreateTaskModal } from './create-task-dialog';
import { TaskDetailModal } from './task-detail-modal';

export function TaskList() {
  const { workspaceId, isLoading: isAuthLoading } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'TODO' | 'DONE'>('ALL');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Fetch Projects for Filter bar
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.request<any[]>(`/projects?workspaceId=${workspaceId}`);
      return res.data || [];
    },
    enabled: Boolean(workspaceId),
  });

  // Fetch Tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', workspaceId, selectedProjectId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const url = selectedProjectId
        ? `/tasks?workspaceId=${workspaceId}&projectId=${selectedProjectId}`
        : `/tasks?workspaceId=${workspaceId}`;
      const res = await apiClient.request<any[]>(url);
      return res.data || [];
    },
    enabled: Boolean(workspaceId),
  });

  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!workspaceId) return;
      return apiClient.completeTask(taskId, workspaceId);
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
    },
  });

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
        <span>Loading workspace tasks...</span>
      </div>
    );
  }

  const filteredTasks = tasks.filter((t: any) => {
    if (statusFilter === 'TODO') return t.status !== 'DONE';
    if (statusFilter === 'DONE') return t.status === 'DONE';
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Project Horizontal Filter Scroll */}
      {projects.length > 0 && (
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedProjectId(null)}
            className={`px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap transition-all ${
              selectedProjectId === null
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            All Projects
          </button>
          {projects.map((p: any) => (
            <button
              key={p.id}
              onClick={() => setSelectedProjectId(p.id)}
              className={`px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                selectedProjectId === p.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: p.color || '#3b82f6' }}
              />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Status Filter and Add Action */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
          {(['ALL', 'TODO', 'DONE'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                statusFilter === f
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Add Task
        </Button>
      </div>

      {/* Task List Items */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-6">
          <Clock className="w-10 h-10 mx-auto text-slate-400 mb-2" />
          <h4 className="font-medium text-slate-700 dark:text-slate-200">No tasks in this view</h4>
          <p className="text-xs text-slate-500 mt-1">
            Tap the button above or send a message to the bot to create one.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task: any) => {
            const isDone = task.status === 'DONE';
            return (
              <Card
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={`cursor-pointer transition-all hover:border-slate-300 dark:hover:border-slate-700 active:scale-[0.99] ${
                  isDone ? 'opacity-60 bg-slate-50 dark:bg-slate-900/40' : ''
                }`}
              >
                <div className="flex items-start justify-between space-x-3">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        !isDone && completeMutation.mutate(task.id);
                      }}
                      className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors"
                      disabled={isDone || completeMutation.isPending}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium leading-snug break-words ${
                          isDone
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {task.title}
                      </p>
                      {task.project && (
                        <div className="mt-1 flex items-center space-x-1">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: task.project.color || '#3b82f6' }}
                          />
                          <span className="text-[11px] font-medium text-slate-500">
                            {task.project.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-1 shrink-0">
                    <Badge
                      variant={
                        task.priority === 'URGENT'
                          ? 'destructive'
                          : task.priority === 'HIGH'
                          ? 'warning'
                          : 'secondary'
                      }
                    >
                      {task.priority}
                    </Badge>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      {/* Task Detail & Comments Modal */}
      <TaskDetailModal
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  );
}
