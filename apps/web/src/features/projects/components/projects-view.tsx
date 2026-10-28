'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Folder,
  Inbox as InboxIcon,
  LayoutGrid,
  List,
  Plus,
  Search,
  X,
  Circle,
  Table as TableIcon,
  FileText,
  ChevronDown,
  ChevronRight,
  Check,
  User,
} from 'lucide-react';
import { KanbanView } from '../../tasks/components/kanban-view';

interface ProjectsViewProps {
  onSelectProject: (projectId: string | null) => void;
  selectedProjectId: string | null;
  onSelectTask: (taskId: string) => void;
  onOpenCreate: (projectId?: string) => void;
  isOwnerOrAdmin: boolean;
}

export interface ProjectMetadata {
  leadId?: string;
  leadName?: string;
  memberIds?: string[];
  priority?: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  targetDate?: string;
  status?: 'ACTIVE' | 'PLANNED' | 'COMPLETED' | 'ON_HOLD';
}

type ProjectFilter = 'ALL' | 'ASSIGNED_TO_ME' | 'ACTIVE' | 'PLANNED' | 'COMPLETED';
const INBOX_PROJECT_ID = '__flowtask_inbox__';

const META_TAG_REGEX = /<!--project-meta:(.*?)-->/;

export function parseProjectMetadata(description?: string): ProjectMetadata {
  const result: ProjectMetadata = {
    memberIds: [],
    priority: 'MEDIUM',
    status: 'ACTIVE',
  };

  if (!description) return result;

  const match = description.match(META_TAG_REGEX);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      return { ...result, ...parsed };
    } catch {}
  }
  return result;
}

export function serializeProjectDescription(cleanText: string, meta: ProjectMetadata): string {
  const clean = cleanText
    .replace(META_TAG_REGEX, '')
    .replace(/<!--emoji:(.*?)-->/, '')
    .replace(/<!--phases:(.*?)-->/, '')
    .trim();

  const metaTag = `<!--project-meta:${JSON.stringify(meta)}-->`;
  return clean ? `${clean}\n${metaTag}` : metaTag;
}

export function cleanProjectDescription(desc?: string): string {
  if (!desc) return '';
  return desc
    .replace(META_TAG_REGEX, '')
    .replace(/<!--emoji:(.*?)-->/, '')
    .replace(/<!--phases:(.*?)-->/, '')
    .trim();
}

export function ProjectsView({
  onSelectProject,
  selectedProjectId,
  onSelectTask,
  onOpenCreate,
  isOwnerOrAdmin,
}: ProjectsViewProps) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  // Create Project State
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState('');
  const [filter, setFilter] = useState<ProjectFilter>('ALL');
  const [search, setSearch] = useState('');

  // Fetch Workspace Members
  const { data: members = [] } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getWorkspaceMembers(workspaceId);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: Boolean(workspaceId),
  });

  // Default lead to current user when creating
  React.useEffect(() => {
    if (user?.id && !selectedLeadId) {
      setSelectedLeadId(user.id);
    }
  }, [user?.id, selectedLeadId]);

  // Fetch Projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getProjects(workspaceId);
      return res.data || [];
    },
    enabled: Boolean(workspaceId),
  });

  // Fetch Tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['project-issues-summary', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const allTasks: any[] = [];
      let page = 1;
      let pageTasks: any[] = [];
      do {
        const res = await apiClient.getTasks(workspaceId, { page, limit: 100 });
        if (res.error) throw new Error(res.error);
        pageTasks = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
        allTasks.push(...pageTasks);
        page += 1;
      } while (pageTasks.length === 100);
      return allTasks;
    },
    enabled: Boolean(workspaceId),
  });

  // Create Project Mutation
  const createProjectMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !name.trim()) throw new Error('Add a project name first.');

      const leadMember = members.find((m: any) => (m.userId || m.user?.id) === selectedLeadId);
      const leadName = leadMember?.user?.name || leadMember?.name || user?.name || 'Lead';

      const meta: ProjectMetadata = {
        leadId: selectedLeadId || user?.id,
        leadName,
        memberIds: selectedMemberIds.length > 0 ? selectedMemberIds : [user?.id || ''],
        priority: 'MEDIUM',
        targetDate: targetDate || undefined,
        status: 'ACTIVE',
      };

      const finalDescription = serializeProjectDescription(description.trim(), meta);

      const projectResult = await apiClient.createProject(workspaceId, {
        name: name.trim(),
        description: finalDescription,
        color: '#2563eb',
      });

      if (projectResult.error || !projectResult.data?.id) {
        throw new Error(projectResult.error || 'Could not create project.');
      }

      return projectResult.data;
    },
    onSuccess: (project: any) => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project-issues-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
      setName('');
      setDescription('');
      setSelectedMemberIds([]);
      setTargetDate('');
      setIsCreating(false);
      onSelectProject(project.id);
    },
  });

  const projectRows = useMemo(() => {
    return projects.map((project: any) => {
      const projectTasks = tasks.filter((task: any) => task.projectId === project.id && !task.archivedAt);
      const completed = projectTasks.filter((task: any) => task.status === 'DONE').length;
      const blocked = projectTasks.filter((task: any) => task.taskMetadata?.isBlocked).length;
      const active = projectTasks.some((task: any) => task.status === 'IN_PROGRESS' || task.status === 'IN_REVIEW');
      const state =
        projectTasks.length > 0 && completed === projectTasks.length ? 'COMPLETED' : active ? 'ACTIVE' : 'PLANNED';
      const upcoming = projectTasks
        .filter((task: any) => task.dueDate && task.status !== 'DONE')
        .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

      const meta = parseProjectMetadata(project.description);
      return { project, projectTasks, completed, blocked, state, upcoming, meta };
    });
  }, [projects, tasks]);

  const filteredProjects = projectRows.filter((row: any) => {
    if (filter === 'ASSIGNED_TO_ME') {
      const isLead = row.meta.leadId === user?.id;
      const isMember = (row.meta.memberIds || []).includes(user?.id);
      if (!isLead && !isMember) return false;
    } else if (filter !== 'ALL' && row.state !== filter) {
      return false;
    }

    return (
      !search.trim() ||
      `${row.project.name} ${row.project.description || ''}`.toLowerCase().includes(search.toLowerCase())
    );
  });

  const selectedProject = projectRows.find((row: any) => row.project.id === selectedProjectId);
  const inboxTasks = tasks.filter((task: any) => !task.projectId && !task.archivedAt);
  const inboxCompleted = inboxTasks.filter((task: any) => task.status === 'DONE').length;
  const inboxBlocked = inboxTasks.filter((task: any) => task.taskMetadata?.isBlocked).length;
  const inboxUpcoming = inboxTasks
    .filter((task: any) => task.dueDate && task.status !== 'DONE')
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  if (selectedProjectId === INBOX_PROJECT_ID) {
    return (
      <ProjectWorkspace
        project={{
          id: INBOX_PROJECT_ID,
          name: 'Inbox',
          description: 'Unassigned tasks waiting to be organized.',
          color: '#2563eb',
        }}
        projectTasks={inboxTasks}
        completed={inboxCompleted}
        blocked={inboxBlocked}
        state="ACTIVE"
        upcoming={inboxUpcoming}
        meta={{}}
        members={members}
        isInbox
        onBack={() => onSelectProject(null)}
        onSelectTask={onSelectTask}
        onOpenCreate={onOpenCreate}
        isOwnerOrAdmin={isOwnerOrAdmin}
      />
    );
  }

  if (selectedProject) {
    return (
      <ProjectWorkspace
        {...selectedProject}
        members={members}
        onBack={() => onSelectProject(null)}
        onSelectTask={onSelectTask}
        onOpenCreate={onOpenCreate}
        isOwnerOrAdmin={isOwnerOrAdmin}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in font-sans pb-28">
      {/* Clean Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Projects</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold">
              {projects.length}
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-medium">Workspaces and team deliverables</p>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setIsCreating(true);
          }}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Project</span>
        </button>
      </div>

      {/* Clean Create Project Modal */}
      {isCreating && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsCreating(false);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createProjectMutation.mutate();
            }}
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 animate-in slide-in-from-bottom duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Create Project</h3>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Project Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Project Name</label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Website Redesign"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-900 dark:text-white"
                required
              />
            </div>

            {/* Project Lead */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Project Lead</label>
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white font-semibold"
              >
                {members.map((m: any) => {
                  const mId = m.userId || m.user?.id || m.id;
                  const mName = m.user?.name || m.name || m.user?.username || 'Member';
                  return (
                    <option key={mId} value={mId}>
                      {mName}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Assign Team Members */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Assign Team Members</span>
                <span className="text-[10px] text-slate-400 font-normal">{selectedMemberIds.length} assigned</span>
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar p-1 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                {members.map((m: any) => {
                  const mId = m.userId || m.user?.id || m.id;
                  const mName = m.user?.name || m.name || 'Member';
                  const isSelected = selectedMemberIds.includes(mId);

                  return (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        if (isSelected) {
                          setSelectedMemberIds((prev) => prev.filter((id) => id !== mId));
                        } else {
                          setSelectedMemberIds((prev) => [...prev, mId]);
                        }
                      }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span>{mName}</span>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Due Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Target Date</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-semibold text-slate-900 dark:text-white"
              />
            </div>

            {/* Description / Scope Brief */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Description (Optional)</label>
              <textarea
                placeholder="What is this project delivering?"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-slate-900 dark:text-white resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || createProjectMutation.isPending}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-xs"
              >
                {createProjectMutation.isPending ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Clean Search Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search projects or team..."
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-4 py-2 text-xs outline-none focus:border-blue-500 text-slate-900 dark:text-white font-medium"
        />
      </div>

      {/* Clean Filter Tabs */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar">
        {[
          ['ALL', 'All Projects'],
          ['ASSIGNED_TO_ME', 'Assigned to Me'],
          ['ACTIVE', 'In Progress'],
          ['PLANNED', 'Planned'],
          ['COMPLETED', 'Completed'],
        ].map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setFilter(val as ProjectFilter);
            }}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
              filter === val
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Clean Inbox Row */}
      <button
        type="button"
        onClick={() => onSelectProject(INBOX_PROJECT_ID)}
        className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left hover:border-blue-300 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <InboxIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-bold text-slate-900 dark:text-white">Inbox</span>
            <span className="block text-[10px] text-slate-400 truncate">Unassigned tasks waiting to be organized</span>
          </div>
        </div>
        <span className="text-xs font-bold text-blue-600 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60">
          {inboxTasks.length}
        </span>
      </button>

      {/* Projects List */}
      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-400 animate-pulse">Loading projects…</div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
          <Folder className="w-6 h-6 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No projects found</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredProjects.map(({ project, projectTasks, completed, state, upcoming, meta }: any) => {
            const count = projectTasks.length;
            const progress = count ? Math.round((completed / count) * 100) : 0;
            const cleanDesc = cleanProjectDescription(project.description);

            const leadMember = members.find((m: any) => (m.userId || m.user?.id) === meta.leadId);
            const leadName = leadMember?.user?.name || meta.leadName || 'Lead';

            return (
              <article
                key={project.id}
                onClick={() => {
                  triggerHaptic('light');
                  onSelectProject(project.id);
                }}
                className="group relative rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-500 shadow-2xs hover:shadow-xs transition-all cursor-pointer p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                        {project.name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          state === 'COMPLETED'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : state === 'ACTIVE'
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {state === 'COMPLETED' ? 'Completed' : state === 'ACTIVE' ? 'In progress' : 'Planned'}
                      </span>
                    </div>

                    {cleanDesc && (
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{cleanDesc}</p>
                    )}
                  </div>

                  <span className="text-xs font-bold text-slate-400 shrink-0">
                    {completed}/{count} done
                  </span>
                </div>

                {/* Progress bar line */}
                <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-3">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Meta footer: Lead + Upcoming */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-medium">
                  <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                    <span className="font-bold text-blue-600 dark:text-blue-400">Lead:</span> {leadName}
                  </span>
                  {upcoming && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3 text-slate-400" />
                      Due {new Date(upcoming.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================================================================
 * CLEAN PROJECT WORKSPACE (MONOCHROMATIC BLUE THEME, NO CLUTTER)
 * ========================================================================================= */
function ProjectWorkspace({
  project,
  projectTasks,
  completed,
  meta = {},
  members = [],
  onBack,
  onSelectTask,
  onOpenCreate,
  isInbox = false,
}: any) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  const [activeView, setActiveView] = useState<'TABLE' | 'LIST' | 'BOARD' | 'DOCS'>('LIST');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [inlineTaskInput, setInlineTaskInput] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLeadId, setEditLeadId] = useState('');
  const [editMemberIds, setEditMemberIds] = useState<string[]>([]);
  const [editTargetDate, setEditTargetDate] = useState('');

  // Mutations
  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!workspaceId) throw new Error('No workspace');
      return apiClient.completeTask(taskId, workspaceId);
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project-issues-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      if (!workspaceId) throw new Error('No workspace');
      const result = await apiClient.updateTask(taskId, workspaceId, { status });
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      triggerHaptic('light');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project-issues-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    },
  });

  const updateTaskPriorityMutation = useMutation({
    mutationFn: async ({ taskId, priority }: { taskId: string; priority: string }) => {
      if (!workspaceId) throw new Error('No workspace');
      const result = await apiClient.updateTask(taskId, workspaceId, { priority });
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      triggerHaptic('light');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project-issues-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId || isInbox) throw new Error('Project editing is unavailable.');
      if (!editName.trim()) throw new Error('Add a project name first.');

      const leadMember = members.find((m: any) => (m.userId || m.user?.id || m.id) === editLeadId);
      const nextMeta: ProjectMetadata = {
        ...meta,
        leadId: editLeadId || undefined,
        leadName: leadMember?.user?.name || leadMember?.name || user?.name || 'Team Lead',
        memberIds: editMemberIds,
        targetDate: editTargetDate || undefined,
      };
      const result = await apiClient.updateProject(project.id, workspaceId, {
        name: editName.trim(),
        description: serializeProjectDescription(editDescription.trim(), nextMeta),
      });
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      setIsEditingProject(false);
    },
  });

  const quickCreateTaskMutation = useMutation({
    mutationFn: async ({ title, status = 'TODO' }: { title: string; status?: string }) => {
      if (!workspaceId) throw new Error('No active workspace selected.');
      if (!title.trim()) throw new Error('Enter a task name first.');
      const result = await apiClient.createTask({
        workspaceId,
        projectId: isInbox ? undefined : project.id,
        title: title.trim(),
        status,
        priority: 'MEDIUM',
        assigneeId: meta.leadId || user?.id,
      });
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project-issues-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
      setInlineTaskInput('');
    },
  });

  const filteredTasks = useMemo(() => {
    return projectTasks.filter((task: any) => {
      if (statusFilter !== 'ALL' && task.status !== statusFilter) return false;
      if (search.trim() && !`${task.title || ''} ${task.description || ''}`.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [projectTasks, statusFilter, search]);

  const cleanDesc = cleanProjectDescription(project.description);
  const leadMember = members.find((m: any) => (m.userId || m.user?.id) === meta.leadId);
  const leadName = leadMember?.user?.name || meta.leadName || 'Team Lead';

  // Group tasks by status (Only show groups that have tasks)
  const groupedTasks = useMemo(() => {
    const map: Record<string, any[]> = {
      BACKLOG: [],
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
      CANCELLED: [],
    };
    for (const t of filteredTasks) {
      if (map[t.status]) map[t.status].push(t);
      else map.TODO.push(t);
    }
    return map;
  }, [filteredTasks]);

  return (
    <div className="space-y-3.5 pb-28 animate-in fade-in font-sans">
      {/* Top Bar: Back & Add Task */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Projects</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenCreate(isInbox ? undefined : project.id)}
          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New task</span>
        </button>
      </div>

      {/* Clean Compact Project Info (Takes ~70px instead of 300px!) */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-extrabold text-slate-900 dark:text-white truncate">{project.name}</h1>
            {cleanDesc && <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{cleanDesc}</p>}
          </div>

          <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            {completed}/{projectTasks.length} done
          </span>
        </div>

        {/* Clean Single-line Meta */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span>
              <strong className="text-slate-700 dark:text-slate-300 font-bold">Lead:</strong> {leadName}
            </span>
            <span>
              <strong className="text-slate-700 dark:text-slate-300 font-bold">Team:</strong> {meta.memberIds?.length || 1}
            </span>
          </div>
          {meta.targetDate && (
            <span className="text-[10px] text-slate-400">
              Due {new Date(meta.targetDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Views Switcher: Table | List | Board | Overview */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveView('TABLE');
            }}
            className={`flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeView === 'TABLE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveView('LIST');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeView === 'LIST'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveView('BOARD');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeView === 'BOARD'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Board</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveView('DOCS');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeView === 'DOCS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>
        </div>

        <span className="text-xs font-bold text-slate-400">
          {projectTasks.length} {projectTasks.length === 1 ? 'task' : 'tasks'}
        </span>
      </div>

      {/* 1. PROJECT TABLE: editable task status and priority properties */}
      {activeView === 'TABLE' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search project tasks..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-600 dark:text-slate-300 outline-none"
            >
              <option value="ALL">All statuses</option>
              <option value="BACKLOG">Backlog</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          {(updateTaskStatusMutation.error || updateTaskPriorityMutation.error) && (
            <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">
              {(updateTaskStatusMutation.error || updateTaskPriorityMutation.error) instanceof Error
                ? (updateTaskStatusMutation.error || updateTaskPriorityMutation.error)?.message
                : 'Could not update task.'}
            </p>
          )}

          {filteredTasks.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No tasks match this view</p>
              <button
                type="button"
                onClick={() => onOpenCreate(isInbox ? undefined : project.id)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                + Add a task
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { key: 'BACKLOG', label: 'Backlog', items: groupedTasks.BACKLOG },
                { key: 'TODO', label: 'To Do', items: groupedTasks.TODO },
                { key: 'IN_PROGRESS', label: 'In Progress', items: groupedTasks.IN_PROGRESS },
                { key: 'IN_REVIEW', label: 'In Review', items: groupedTasks.IN_REVIEW },
                { key: 'DONE', label: 'Completed', items: groupedTasks.DONE },
                { key: 'CANCELLED', label: 'Cancelled', items: groupedTasks.CANCELLED },
              ]
                .filter((group) => group.items.length > 0)
                .map((group) => {
                  const isCollapsed = Boolean(collapsedGroups[group.key]);
                  return (
                    <section key={group.key} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setCollapsedGroups((previous) => ({ ...previous, [group.key]: !previous[group.key] }))}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800"
                      >
                        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{group.label}</span>
                        <span className="text-[10px] font-semibold text-slate-400">{group.items.length}</span>
                      </button>
                      {!isCollapsed && (
                        <div className="overflow-x-auto">
                          <div className="min-w-[620px]">
                            <div className="grid grid-cols-[minmax(190px,1fr)_112px_104px_112px_100px] gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 border-b border-slate-100 dark:border-slate-800">
                              <span>Task</span><span>Status</span><span>Priority</span><span>Assignee</span><span>Due date</span>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                              {group.items.map((task: any) => {
                                const assignee = task.assignees?.[0] || task.assignee;
                                return (
                                  <div
                                    key={task.id}
                                    onClick={() => onSelectTask(task.id)}
                                    className="grid grid-cols-[minmax(190px,1fr)_112px_104px_112px_100px] gap-2 items-center px-3 py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <button
                                        type="button"
                                        aria-label={task.status === 'DONE' ? 'Task completed' : 'Complete task'}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          completeMutation.mutate(task.id);
                                        }}
                                        className="shrink-0 text-slate-400 hover:text-blue-600 transition-colors"
                                      >
                                        {task.status === 'DONE' ? <CheckCircle2 className="w-4 h-4 text-blue-600" /> : <Circle className="w-4 h-4" />}
                                      </button>
                                      <span className={`text-xs font-semibold truncate ${task.status === 'DONE' ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                        {task.title}
                                      </span>
                                    </div>
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <select
                                        aria-label={`Status for ${task.title}`}
                                        value={task.status}
                                        onChange={(e) => updateTaskStatusMutation.mutate({ taskId: task.id, status: e.target.value })}
                                        className="w-full text-[10px] font-bold px-1.5 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 outline-none"
                                      >
                                        <option value="BACKLOG">Backlog</option>
                                        <option value="TODO">To Do</option>
                                        <option value="IN_PROGRESS">In Progress</option>
                                        <option value="IN_REVIEW">In Review</option>
                                        <option value="DONE">Done</option>
                                        <option value="CANCELLED">Cancelled</option>
                                      </select>
                                    </div>
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <select
                                        aria-label={`Priority for ${task.title}`}
                                        value={task.priority || 'MEDIUM'}
                                        onChange={(e) => updateTaskPriorityMutation.mutate({ taskId: task.id, priority: e.target.value })}
                                        className="w-full text-[10px] font-bold px-1.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 outline-none"
                                      >
                                        <option value="URGENT">Urgent</option>
                                        <option value="HIGH">High</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="LOW">Low</option>
                                        <option value="NONE">None</option>
                                      </select>
                                    </div>
                                    <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate" title={assignee?.name || 'Unassigned'}>
                                      {assignee?.name || 'Unassigned'}
                                    </span>
                                    <span className="text-[11px] text-slate-500 truncate">
                                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inlineTaskInput.trim()) quickCreateTaskMutation.mutate({ title: inlineTaskInput.trim() });
            }}
            className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl"
          >
            <Plus className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Add a task to this project..."
              value={inlineTaskInput}
              onChange={(e) => setInlineTaskInput(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none font-medium"
            />
            {inlineTaskInput.trim() && (
              <button type="submit" disabled={quickCreateTaskMutation.isPending} className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 shrink-0">
                {quickCreateTaskMutation.isPending ? 'Adding…' : 'Add'}
              </button>
            )}
          </form>
          {quickCreateTaskMutation.error && (
            <p role="alert" className="text-[11px] text-red-600 dark:text-red-400 px-1">
              {quickCreateTaskMutation.error instanceof Error ? quickCreateTaskMutation.error.message : 'Could not create task.'}
            </p>
          )}
        </div>
      )}

      {/* 2. CLEAN TASKS LIST (BLUE/SLATE THEME, NO EMPTY BOXES) */}
      {activeView === 'LIST' && (
        <div className="space-y-3">
          {/* Filter Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-600 dark:text-slate-300 outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="BACKLOG">Backlog</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Unified Clean Task List */}
          {filteredTasks.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No tasks in this project yet</p>
              <button
                type="button"
                onClick={() => onOpenCreate(project.id)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                + Add your first task
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { key: 'BACKLOG', label: 'Backlog', items: groupedTasks.BACKLOG },
                { key: 'TODO', label: 'To Do', items: groupedTasks.TODO },
                { key: 'IN_PROGRESS', label: 'In Progress', items: groupedTasks.IN_PROGRESS },
                { key: 'IN_REVIEW', label: 'In Review', items: groupedTasks.IN_REVIEW },
                { key: 'DONE', label: 'Completed', items: groupedTasks.DONE },
                { key: 'CANCELLED', label: 'Cancelled', items: groupedTasks.CANCELLED },
              ]
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.key} className="space-y-1.5">
                    {/* Clean Minimal Status Header */}
                    <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                      <span>{group.label}</span>
                      <span className="text-slate-400 font-semibold">({group.items.length})</span>
                    </div>

                    {/* Task Rows in Clean Slate/Blue Card */}
                    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden shadow-2xs">
                      {group.items.map((task: any) => {
                        const isDone = task.status === 'DONE';
                        const primaryAssignee = task.assignees?.[0] || task.assignee;

                        return (
                          <div
                            key={task.id}
                            onClick={() => onSelectTask(task.id)}
                            className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  completeMutation.mutate(task.id);
                                }}
                                className="shrink-0 text-slate-400 hover:text-blue-600 transition-colors"
                              >
                                {isDone ? (
                                  <CheckCircle2 className="w-4 h-4 text-blue-600 fill-blue-50 dark:fill-blue-950" />
                                ) : (
                                  <Circle className="w-4 h-4" />
                                )}
                              </button>

                              <span
                                className={`text-xs font-semibold truncate ${
                                  isDone
                                    ? 'line-through text-slate-400 dark:text-slate-500'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {task.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {/* Clean Monochromatic Status Pill */}
                              <select
                                value={task.status}
                                onChange={(e) =>
                                  updateTaskStatusMutation.mutate({ taskId: task.id, status: e.target.value })
                                }
                                className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 outline-none cursor-pointer"
                              >
                                <option value="BACKLOG">Backlog</option>
                                <option value="TODO">To Do</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="IN_REVIEW">In Review</option>
                                <option value="DONE">Done</option>
                                <option value="CANCELLED">Cancelled</option>
                              </select>

                              {/* Assignee Avatar */}
                              {primaryAssignee && (
                                <div
                                  title={primaryAssignee.name}
                                  className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[8px] font-extrabold flex items-center justify-center shrink-0"
                                >
                                  {(primaryAssignee.name || 'U').slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Clean Inline + Add Task Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inlineTaskInput.trim()) {
                quickCreateTaskMutation.mutate({ title: inlineTaskInput.trim() });
              }
            }}
            className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs"
          >
            <Plus className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Add task to this project... (Press Enter)"
              value={inlineTaskInput}
              onChange={(e) => setInlineTaskInput(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none font-medium"
            />
            {inlineTaskInput.trim() && (
              <button
                type="submit"
                disabled={quickCreateTaskMutation.isPending}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 shrink-0 shadow-xs"
              >
                Add
              </button>
            )}
          </form>
        </div>
      )}

      {/* 3. BOARD VIEW (KANBAN) */}
      {activeView === 'BOARD' && (
        <KanbanView
          tasks={filteredTasks}
          onSelectTask={onSelectTask}
          onOpenCreate={() => onOpenCreate(isInbox ? undefined : project.id)}
        />
      )}

      {/* 4. DOCS / OVERVIEW VIEW */}
      {activeView === 'DOCS' && (
        <section className="space-y-3">
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Project brief</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Goals, ownership, and target date</p>
              </div>
              {!isInbox && !isEditingProject && (
                <button
                  type="button"
                  onClick={() => {
                    setEditName(project.name || '');
                    setEditDescription(cleanDesc);
                    setEditLeadId(meta.leadId || user?.id || '');
                    setEditMemberIds(meta.memberIds || []);
                    setEditTargetDate(meta.targetDate ? new Date(meta.targetDate).toISOString().slice(0, 10) : '');
                    updateProjectMutation.reset();
                    setIsEditingProject(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60"
                >
                  Edit details
                </button>
              )}
            </div>

            {isEditingProject ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  updateProjectMutation.mutate();
                }}
                className="space-y-3 pt-1"
              >
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Project name</span>
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    required
                    maxLength={120}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Project brief</span>
                  <textarea
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    rows={4}
                    placeholder="What is this project delivering?"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-slate-900 dark:text-white resize-y"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Project lead</span>
                    <select
                      value={editLeadId}
                      onChange={(event) => setEditLeadId(event.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                    >
                      {members.map((member: any) => {
                        const memberId = member.userId || member.user?.id || member.id;
                        const memberName = member.user?.name || member.name || member.user?.username || 'Member';
                        return <option key={memberId} value={memberId}>{memberName}</option>;
                      })}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Target date</span>
                    <input
                      type="date"
                      value={editTargetDate}
                      onChange={(event) => setEditTargetDate(event.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white"
                    />
                  </label>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Project team</span>
                    <span className="text-[10px] text-slate-400">{editMemberIds.length} selected</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((member: any) => {
                      const memberId = member.userId || member.user?.id || member.id;
                      const memberName = member.user?.name || member.name || 'Member';
                      const selected = editMemberIds.includes(memberId);
                      return (
                        <button
                          key={memberId}
                          type="button"
                          onClick={() => setEditMemberIds((previous) => selected ? previous.filter((id) => id !== memberId) : [...previous, memberId])}
                          className={`px-2 py-1 rounded-lg text-[10px] font-semibold border ${selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                        >
                          {memberName}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {updateProjectMutation.error && (
                  <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">
                    {updateProjectMutation.error instanceof Error ? updateProjectMutation.error.message : 'Could not update project.'}
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setIsEditingProject(false)} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800">Cancel</button>
                  <button type="submit" disabled={!editName.trim() || updateProjectMutation.isPending} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                    {updateProjectMutation.isPending ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {cleanDesc || 'No project description added yet.'}
                </p>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Project team</h4>
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <User className="w-4 h-4 text-blue-600" />
                    <span><strong>Lead:</strong> {leadName}</span>
                  </div>
                  {(meta.memberIds || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(meta.memberIds || []).map((memberId: string) => {
                        const member = members.find((item: any) => (item.userId || item.user?.id || item.id) === memberId);
                        const memberName = member?.user?.name || member?.name || 'Member';
                        return <span key={memberId} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-300">{memberName}</span>;
                      })}
                    </div>
                  )}
                  {meta.targetDate && (
                    <div className="text-xs text-slate-600 dark:text-slate-300"><strong>Target:</strong> {new Date(meta.targetDate).toLocaleDateString()}</div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
