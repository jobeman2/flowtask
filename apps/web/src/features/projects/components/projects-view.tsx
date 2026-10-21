'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Folder,
  Inbox as InboxIcon,
  LayoutGrid,
  List,
  Plus,
  Search,
  X,
  Layers,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  AlertCircle,
  Trash2,
  Calendar,
} from 'lucide-react';
import { TaskCard } from '../../tasks/components/task-card';
import { KanbanView } from '../../tasks/components/kanban-view';

interface ProjectsViewProps {
  onSelectProject: (projectId: string | null) => void;
  selectedProjectId: string | null;
  onSelectTask: (taskId: string) => void;
  onOpenCreate: (projectId?: string, phase?: string) => void;
  isOwnerOrAdmin: boolean;
}

const PROJECT_TEMPLATES = {
  product: {
    label: 'Product launch',
    description: 'Plan and deliver a product release from scope through launch review.',
    phases: ['Phase 1: Scope & Specs', 'Phase 2: Build & Core', 'Phase 3: QA & Polish', 'Phase 4: Launch'],
    tasks: [
      { title: 'Define launch goal and success metrics', phase: 'Phase 1: Scope & Specs' },
      { title: 'Confirm scope and technical owners', phase: 'Phase 1: Scope & Specs' },
      { title: 'Build core application features', phase: 'Phase 2: Build & Core' },
      { title: 'Run end-to-end testing and bug triage', phase: 'Phase 3: QA & Polish' },
      { title: 'Prepare launch communications and release', phase: 'Phase 4: Launch' },
    ],
  },
  sprint: {
    label: 'Sprint cycle',
    description: 'Plan a focused delivery cycle, track active work, and review the outcome.',
    phases: ['Sprint Backlog', 'Sprint In-Flight', 'Review & Retro'],
    tasks: [
      { title: 'Refine sprint goals and backlog', phase: 'Sprint Backlog' },
      { title: 'Execute sprint work items', phase: 'Sprint In-Flight' },
      { title: 'Review completed deliverables', phase: 'Review & Retro' },
      { title: 'Capture retrospective follow-ups', phase: 'Review & Retro' },
    ],
  },
  campaign: {
    label: 'Marketing campaign',
    description: 'Coordinate a campaign from brief to performance review.',
    phases: ['Brief & Research', 'Asset Production', 'Campaign Distribution', 'Analytics Review'],
    tasks: [
      { title: 'Write campaign brief & audience targeting', phase: 'Brief & Research' },
      { title: 'Produce creative graphics & videos', phase: 'Asset Production' },
      { title: 'Distribute campaign across channels', phase: 'Campaign Distribution' },
      { title: 'Analyze campaign reach and conversion', phase: 'Analytics Review' },
    ],
  },
} as const;

type ProjectFilter = 'ALL' | 'ACTIVE' | 'PLANNED' | 'COMPLETED';
const INBOX_PROJECT_ID = '__flowtask_inbox__';

const PHASE_TAG_REGEX = /<!--phases:(.*?)-->/;

function parseProjectPhases(description?: string): string[] {
  if (!description) return [];
  const match = description.match(PHASE_TAG_REGEX);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeProjectPhases(phases: string[], description?: string): string {
  const cleanDesc = (description || '').replace(PHASE_TAG_REGEX, '').trim();
  const validPhases = Array.from(new Set(phases.map((p) => p.trim()).filter(Boolean)));
  if (validPhases.length === 0) return cleanDesc;
  return cleanDesc
    ? `${cleanDesc}\n<!--phases:${JSON.stringify(validPhases)}-->`
    : `<!--phases:${JSON.stringify(validPhases)}-->`;
}

export function ProjectsView({
  onSelectProject,
  selectedProjectId,
  onSelectTask,
  onOpenCreate,
  isOwnerOrAdmin,
}: ProjectsViewProps) {
  const { workspaceId } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [templateId, setTemplateId] = useState<keyof typeof PROJECT_TEMPLATES | 'blank'>('blank');
  const [filter, setFilter] = useState<ProjectFilter>('ALL');
  const [search, setSearch] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await apiClient.getProjects(workspaceId);
      return res.data || [];
    },
    enabled: Boolean(workspaceId),
  });

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

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !name.trim()) throw new Error('Add a project name first.');
      const template = templateId === 'blank' ? null : PROJECT_TEMPLATES[templateId];
      const initialPhases = template ? [...template.phases] : [];
      const finalDescription = serializeProjectPhases(initialPhases, description.trim() || undefined);

      const projectResult = await apiClient.createProject(workspaceId, {
        name: name.trim(),
        description: finalDescription || undefined,
        color,
      });
      if (projectResult.error || !projectResult.data?.id) {
        throw new Error(projectResult.error || 'Could not create the project.');
      }

      if (template) {
        for (const item of template.tasks) {
          const taskResult = await apiClient.createTask({
            workspaceId,
            projectId: projectResult.data.id,
            title: item.title,
            phase: item.phase,
            status: 'BACKLOG',
            priority: 'MEDIUM',
          });
          if (taskResult.error) {
            throw new Error(`Project created, but a starter issue failed: ${taskResult.error}`);
          }
        }
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
      setTemplateId('blank');
      setIsCreating(false);
      onSelectProject(project.id);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project-issues-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    },
  });

  const colorPalette = ['#2563eb', '#7c3aed', '#db2777', '#e11d48', '#d97706', '#059669', '#0891b2', '#475569'];

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
      return { project, projectTasks, completed, blocked, state, upcoming };
    });
  }, [projects, tasks]);

  const filteredProjects = projectRows.filter((row: any) => {
    if (filter !== 'ALL' && row.state !== filter) return false;
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
          description: 'Unassigned tasks and Telegram captures waiting to be triaged.',
        }}
        projectTasks={inboxTasks}
        completed={inboxCompleted}
        blocked={inboxBlocked}
        state="ACTIVE"
        upcoming={inboxUpcoming}
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
        onBack={() => onSelectProject(null)}
        onSelectTask={onSelectTask}
        onOpenCreate={onOpenCreate}
        isOwnerOrAdmin={isOwnerOrAdmin}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in font-sans">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Projects</h2>
          <p className="text-xs text-slate-400 font-medium">
            Phased milestones, goals, and delivery progress
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setIsCreating(true);
          }}
          className="px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/25 active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>New Project</span>
        </button>
      </div>

      {isCreating && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsCreating(false);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim() && !createProjectMutation.isPending) createProjectMutation.mutate();
            }}
            className="w-full max-w-md max-h-[calc(100dvh-0.75rem)] sm:max-h-[90dvh] rounded-t-[28px] sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/70 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Projects
                </p>
                <h3 id="new-project-title" className="text-base font-extrabold text-slate-900 dark:text-white">
                  Create a project
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Set a goal and organize work into Linear-style phases.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close project form"
                onClick={() => setIsCreating(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </header>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="project-template" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Start from template
                </label>
                <select
                  id="project-template"
                  value={templateId}
                  onChange={(event) => {
                    const value = event.target.value as keyof typeof PROJECT_TEMPLATES | 'blank';
                    setTemplateId(value);
                    setDescription(value === 'blank' ? '' : PROJECT_TEMPLATES[value].description);
                  }}
                  className="w-full px-3.5 py-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none text-slate-900 dark:text-white focus:border-blue-500"
                >
                  <option value="blank">Blank project</option>
                  {Object.entries(PROJECT_TEMPLATES).map(([key, template]) => (
                    <option key={key} value={key}>
                      {template.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">
                  {templateId === 'blank'
                    ? 'Start empty and add your own phases.'
                    : `${PROJECT_TEMPLATES[templateId].phases.length} phases and ${PROJECT_TEMPLATES[templateId].tasks.length} starter issues will be organized.`}
                </p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="project-name" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Project name
                  </label>
                  <input
                    id="project-name"
                    type="text"
                    required
                    placeholder="e.g. Mobile App V2"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full px-3.5 py-3 text-[16px] sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none text-slate-900 dark:text-white focus:border-blue-500 font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="project-goal" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Goal <span className="font-normal text-slate-400">· optional</span>
                  </label>
                  <textarea
                    id="project-goal"
                    rows={3}
                    placeholder="What outcome should this project achieve?"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="w-full px-3.5 py-3 text-[16px] sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none text-slate-900 dark:text-white focus:border-blue-500 font-medium resize-y"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Project color</p>
                <div className="flex items-center gap-3">
                  {colorPalette.map((entry) => (
                    <button
                      key={entry}
                      type="button"
                      aria-label={`Use project color ${entry}`}
                      aria-pressed={color === entry}
                      onClick={() => setColor(entry)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        color === entry ? 'scale-110 ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' : ''
                      }`}
                      style={{ backgroundColor: entry }}
                    />
                  ))}
                </div>
              </div>
              {createProjectMutation.error && (
                <p role="alert" className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-xl p-3">
                  {createProjectMutation.error.message}
                </p>
              )}
            </div>
            <footer className="shrink-0 border-t border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom,1rem))] backdrop-blur-md flex gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || createProjectMutation.isPending}
                className="flex-1 px-4 py-3 rounded-xl text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm disabled:opacity-50"
              >
                {createProjectMutation.isPending
                  ? 'Creating…'
                  : templateId === 'blank'
                  ? 'Create project'
                  : `Create project + ${PROJECT_TEMPLATES[templateId].phases.length} phases`}
              </button>
            </footer>
          </form>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search projects"
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full pl-9 pr-4 py-2.5 text-xs outline-none focus:border-blue-500"
        />
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {(['ALL', 'ACTIVE', 'PLANNED', 'COMPLETED'] as ProjectFilter[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
              filter === value
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {value === 'ALL' ? 'All projects' : value[0] + value.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onSelectProject(INBOX_PROJECT_ID)}
        className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-dashed border-blue-200 dark:border-blue-900/70 bg-blue-50/60 dark:bg-blue-950/20 text-left hover:border-blue-400 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <InboxIcon className="w-4 h-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-extrabold text-slate-900 dark:text-white">Inbox</span>
            <span className="block text-[10px] text-slate-500 truncate">
              Unassigned work and Telegram captures to triage
            </span>
          </span>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
          <span className="px-2 py-1 rounded-full bg-white dark:bg-slate-900">{inboxTasks.length}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </button>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-400 animate-pulse">Loading projects…</div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-10 text-center bg-white dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
          <Folder className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No projects in this view</p>
          <p className="text-[11px] text-slate-400">Create a project or change your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProjects.map(({ project, projectTasks, completed, blocked, state, upcoming }: any) => {
            const isSelected = selectedProjectId === project.id;
            const count = projectTasks.length;
            const progress = count ? Math.round((completed / count) * 100) : 0;
            const phases = parseProjectPhases(project.description);

            return (
              <article
                key={project.id}
                className={`p-4 rounded-2xl border bg-white dark:bg-slate-900 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.03)] ${
                  isSelected ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-slate-100 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="w-1.5 h-11 rounded-full shrink-0"
                      style={{ backgroundColor: project.color || '#2563eb' }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{project.name}</h3>
                        {phases.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800/80">
                            <Layers className="w-3 h-3" />
                            {phases.length} {phases.length === 1 ? 'phase' : 'phases'}
                          </span>
                        )}
                      </div>
                      {project.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {project.description.replace(PHASE_TAG_REGEX, '').trim()}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                      state === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : state === 'ACTIVE'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {state === 'COMPLETED' ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <CircleDot className="w-3 h-3" />
                    )}
                    {state === 'COMPLETED' ? 'Completed' : state === 'ACTIVE' ? 'In progress' : 'Planned'}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                    <span>Issue progress</span>
                    <span>
                      {completed}/{count} complete · {progress}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progress}%`, backgroundColor: project.color || '#2563eb' }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>
                      {blocked > 0 ? (
                        <span className="text-amber-600 font-bold">{blocked} blocked</span>
                      ) : (
                        `${count} ${count === 1 ? 'issue' : 'issues'}`
                      )}
                    </span>
                    {upcoming && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        Next due {new Date(upcoming.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    onSelectProject(project.id);
                  }}
                  className="w-full mt-3 flex items-center justify-between text-[11px] font-bold text-blue-600 dark:text-blue-400"
                >
                  <span>Open project workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProjectWorkspace({
  project,
  projectTasks,
  completed,
  blocked,
  state,
  upcoming,
  onBack,
  onSelectTask,
  onOpenCreate,
  isOwnerOrAdmin,
  isInbox = false,
}: any) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();



  // Phases derived from project description + tasks with phases
  const projectPhases = useMemo(() => {
    if (isInbox) return [];
    const fromDesc = parseProjectPhases(project.description);
    const fromTasks = projectTasks
      .map((t: any) => t.phase || t.taskMetadata?.phase)
      .filter((p: any) => typeof p === 'string' && p.trim()) as string[];
    const combined = Array.from(new Set([...fromDesc, ...fromTasks]));
    return combined;
  }, [project.description, projectTasks, isInbox]);

  const hasPhases = projectPhases.length > 0;
  const [view, setView] = useState<'PHASES' | 'LIST' | 'BOARD'>(
    !isInbox && hasPhases ? 'PHASES' : 'LIST'
  );

  React.useEffect(() => {
    if (!hasPhases && view === 'PHASES') {
      setView('LIST');
    }
  }, [hasPhases, view]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Linear Phase State
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});
  const [isAddPhaseOpen, setIsAddPhaseOpen] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [inlineTaskInput, setInlineTaskInput] = useState<Record<string, string>>({});

  // Mutations
  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!workspaceId) throw new Error('No active workspace selected.');
      const result = await apiClient.completeTask(taskId, workspaceId);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project-issues-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ taskId, currentStatus }: { taskId: string; currentStatus: string }) => {
      if (!workspaceId) throw new Error('No active workspace selected.');
      const nextStatus =
        currentStatus === 'DONE'
          ? 'TODO'
          : currentStatus === 'TODO'
          ? 'IN_PROGRESS'
          : currentStatus === 'IN_PROGRESS'
          ? 'DONE'
          : 'DONE';
      const result = await apiClient.updateTask(taskId, workspaceId, { status: nextStatus });
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      triggerHaptic('light');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project-issues-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    },
  });

  const updatePhaseMutation = useMutation({
    mutationFn: async ({ taskId, phase }: { taskId: string; phase: string | null }) => {
      if (!workspaceId) throw new Error('No active workspace selected.');
      const result = await apiClient.updateTask(taskId, workspaceId, { phase });
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      triggerHaptic('light');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project-issues-summary', workspaceId] });
    },
  });

  const quickCreateTaskMutation = useMutation({
    mutationFn: async ({ phase, title }: { phase?: string; title: string }) => {
      if (!workspaceId || !title.trim()) return;
      const result = await apiClient.createTask({
        workspaceId,
        projectId: isInbox ? undefined : project.id,
        phase: phase || undefined,
        title: title.trim(),
        status: 'TODO',
        priority: 'MEDIUM',
      });
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_, vars) => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project-issues-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
      const phaseKey = vars.phase || '__none__';
      setInlineTaskInput((prev) => ({ ...prev, [phaseKey]: '' }));
    },
  });

  const savePhasesMutation = useMutation({
    mutationFn: async (updatedPhases: string[]) => {
      if (!workspaceId || isInbox) return;
      const newDescription = serializeProjectPhases(updatedPhases, project.description);
      const res = await apiClient.updateProject(project.id, workspaceId, { description: newDescription });
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      setIsAddPhaseOpen(false);
      setNewPhaseName('');
    },
  });



  const togglePhaseCollapse = (phase: string) => {
    triggerHaptic('light');
    setCollapsedPhases((prev) => ({ ...prev, [phase]: !prev[phase] }));
  };

  const handleAddPhase = (phaseNameToAdd: string) => {
    const trimmed = phaseNameToAdd.trim();
    if (!trimmed || projectPhases.includes(trimmed)) return;
    const nextList = [...projectPhases, trimmed];
    savePhasesMutation.mutate(nextList);
  };

  const handleRemovePhase = (phaseToRemove: string) => {
    const nextList = projectPhases.filter((p) => p !== phaseToRemove);
    savePhasesMutation.mutate(nextList);
  };

  const visibleTasks = projectTasks.filter((task: any) => {
    const assignees =
      Array.isArray(task.assignees) && task.assignees.length > 0
        ? task.assignees
        : task.assignee
        ? [task.assignee]
        : [];
    const assignedToMe = assignees.some((assignee: any) => assignee.id === user?.id) || task.assigneeId === user?.id;
    const isUnassigned = assignees.length === 0 && !task.assigneeId;
    return isUnassigned || assignedToMe || task.creatorId === user?.id || isOwnerOrAdmin;
  });

  const filteredTasks = visibleTasks.filter((task: any) => {
    if (statusFilter !== 'ALL' && task.status !== statusFilter) return false;
    if (search.trim() && !`${task.title || ''} ${task.description || ''}`.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  const progress = projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0;
  const openCount = projectTasks.filter((task: any) => task.status !== 'DONE' && task.status !== 'CANCELLED').length;
  const statusFilters = [
    ['ALL', 'All issues'],
    ['BACKLOG', 'Backlog'],
    ['TODO', 'To do'],
    ['IN_PROGRESS', 'In progress'],
    ['IN_REVIEW', 'In review'],
    ['DONE', 'Done'],
  ];

  // Group filtered tasks by phase
  const tasksByPhase = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const phase of projectPhases) {
      map.set(phase, []);
    }
    const unphased: any[] = [];
    for (const t of filteredTasks) {
      const p = t.phase || t.taskMetadata?.phase;
      if (p && map.has(p)) {
        map.get(p)!.push(t);
      } else if (p) {
        if (!map.has(p)) map.set(p, []);
        map.get(p)!.push(t);
      } else {
        unphased.push(t);
      }
    }
    return { map, unphased };
  }, [projectPhases, filteredTasks]);

  const cleanDescription = (project.description || '').replace(PHASE_TAG_REGEX, '').trim();

  return (
    <div className="space-y-4 pb-24 animate-in fade-in font-sans">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All projects
      </button>

      {/* Project Banner & Overall Progress */}
      <section className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-2 h-12 rounded-full shrink-0"
              style={{ backgroundColor: project.color || '#2563eb' }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{project.name}</h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isInbox
                      ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
                      : state === 'COMPLETED'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : state === 'ACTIVE'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {isInbox
                    ? 'Needs triage'
                    : state === 'COMPLETED'
                    ? 'Completed'
                    : state === 'ACTIVE'
                    ? 'In progress'
                    : 'Planned'}
                </span>
                {!isInbox && projectPhases.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border border-violet-200 dark:border-violet-800/80 flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {projectPhases.length} {projectPhases.length === 1 ? 'Phase' : 'Phases'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">
                {cleanDescription || 'Add a project goal to give the team a shared outcome to work toward.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenCreate(isInbox ? undefined : project.id)}
            className="shrink-0 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            {isInbox ? 'Capture task' : 'New issue'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
          {isInbox ? (
            <>
              <div>
                <div className="text-[10px] text-slate-500">Open</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">{openCount}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Blocked</div>
                <div className={`text-sm font-extrabold ${blocked ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
                  {blocked}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">To triage</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">{projectTasks.length}</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-[10px] text-slate-500">Progress</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">{progress}%</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Issues</div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {completed}/{projectTasks.length} done
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Blocked</div>
                <div className={`text-sm font-extrabold ${blocked ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
                  {blocked}
                </div>
              </div>
            </>
          )}
        </div>

        {!isInbox && (
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, backgroundColor: project.color || '#2563eb' }}
            />
          </div>
        )}
        {upcoming && (
          <div className="text-[10px] text-slate-500 inline-flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            Next issue due {new Date(upcoming.dueDate).toLocaleDateString()}
          </div>
        )}
      </section>

      {/* View Switcher: Phases (Linear) | List | Board */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
            Workspace <span className="text-slate-400 font-normal">({projectTasks.length})</span>
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {!isInbox && hasPhases && view === 'PHASES' && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsAddPhaseOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 bg-violet-50 hover:bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:hover:bg-violet-900/60 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/60 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Phase</span>
            </button>
          )}
          {!isInbox && !hasPhases && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsAddPhaseOpen(true);
              }}
              className="px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 bg-slate-100 dark:bg-slate-800 transition-all active:scale-95"
            >
              <Plus className="w-3 h-3 stroke-[2.5]" />
              <span>Add Phases</span>
            </button>
          )}
          <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {!isInbox && hasPhases && (
              <button
                type="button"
                title="Phases view (Linear style)"
                onClick={() => setView('PHASES')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  view === 'PHASES'
                    ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Phases</span>
              </button>
            )}
            <button
              type="button"
              title="List view"
              onClick={() => setView('LIST')}
              className={`p-1.5 rounded-lg transition-all ${
                view === 'LIST'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Board view"
              onClick={() => setView('BOARD')}
              className={`p-1.5 rounded-lg transition-all ${
                view === 'BOARD'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Add New Phase */}
      {isAddPhaseOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddPhaseOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-t-[28px] sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
                  <Layers className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Add Project Phase</h4>
                  <p className="text-[11px] text-slate-500">Group issues into a milestone or sprint</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPhaseOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Phase Name</label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Phase 1: Foundation"
                value={newPhaseName}
                onChange={(e) => setNewPhaseName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newPhaseName.trim()) handleAddPhase(newPhaseName);
                  }
                }}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white focus:border-violet-500 font-semibold"
              />
            </div>

            {/* Quick Templates */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Quick Suggestions</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Phase 1: Research & Scope',
                  'Phase 2: Core Build',
                  'Phase 3: QA & Testing',
                  'Phase 4: Launch',
                  'Sprint Planning',
                  'Maintenance & Polish',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      handleAddPhase(preset);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-violet-50 hover:text-violet-700 dark:bg-slate-800 dark:hover:bg-violet-950 dark:hover:text-violet-300 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 transition-all"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddPhaseOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newPhaseName.trim() || savePhasesMutation.isPending}
                onClick={() => handleAddPhase(newPhaseName)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {savePhasesMutation.isPending ? 'Adding…' : 'Create Phase'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. LINEAR PHASES VIEW */}
      {view === 'PHASES' && !isInbox && (
        <div className="space-y-4">
          {/* Empty state: No phases yet */}
          {projectPhases.length === 0 && tasksByPhase.unphased.length === 0 && (
            <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-3xl border border-dashed border-violet-200 dark:border-violet-900/60 space-y-3">
              <span className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400 flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6" />
              </span>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Organize work into Linear-style Phases
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Break down your project into distinct delivery milestones with individual task tracking and progress bars.
                </p>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const presets = ['Phase 1: Foundation', 'Phase 2: Core Build', 'Phase 3: QA & Testing', 'Phase 4: Launch'];
                    savePhasesMutation.mutate(presets);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-sm"
                >
                  Generate 4 Standard Phases
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddPhaseOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800"
                >
                  + Custom Phase
                </button>
              </div>
            </div>
          )}

          {/* Render each Phase Group */}
          {projectPhases.map((phase) => {
            const phaseTasks = tasksByPhase.map.get(phase) || [];
            const isCollapsed = Boolean(collapsedPhases[phase]);
            const completedInPhase = phaseTasks.filter((t) => t.status === 'DONE').length;
            const phaseProgress = phaseTasks.length ? Math.round((completedInPhase / phaseTasks.length) * 100) : 0;
            const allDone = phaseTasks.length > 0 && completedInPhase === phaseTasks.length;
            const hasActive = phaseTasks.some((t) => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW');
            const inlineValue = inlineTaskInput[phase] || '';

            return (
              <section
                key={phase}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.03)] overflow-hidden transition-all"
              >
                {/* Linear Phase Header */}
                <header className="p-3.5 bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div
                    onClick={() => togglePhaseCollapse(phase)}
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer select-none"
                  >
                    <button
                      type="button"
                      aria-label={isCollapsed ? 'Expand phase' : 'Collapse phase'}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-transform"
                    >
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <span className="p-1.5 rounded-lg bg-violet-100/70 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300">
                      <Layers className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-white truncate">{phase}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            allDone
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : hasActive
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                              : 'bg-slate-200/60 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300'
                          }`}
                        >
                          {allDone ? 'Completed' : hasActive ? 'In progress' : 'Planned'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Progress pill & Mini bar */}
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-600 transition-all duration-300"
                          style={{ width: `${phaseProgress}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                        {completedInPhase}/{phaseTasks.length} ({phaseProgress}%)
                      </span>
                    </div>

                    <span className="sm:hidden text-[10px] font-bold text-slate-500">
                      {completedInPhase}/{phaseTasks.length}
                    </span>

                    {/* Quick Add Issue into this phase */}
                    <button
                      type="button"
                      onClick={() => onOpenCreate(project.id, phase)}
                      title={`Add issue to ${phase}`}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    {/* Delete empty phase */}
                    {phaseTasks.length === 0 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePhase(phase)}
                        title="Remove empty phase"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </header>

                {/* Phase Body: Linear Issue Rows */}
                {!isCollapsed && (
                  <div className="p-2 space-y-1.5">
                    {phaseTasks.map((task) => (
                      <LinearIssueRow
                        key={task.id}
                        task={task}
                        availablePhases={projectPhases}
                        onSelect={() => onSelectTask(task.id)}
                        onToggleStatus={() =>
                          toggleStatusMutation.mutate({ taskId: task.id, currentStatus: task.status })
                        }
                        onMovePhase={(newP) => updatePhaseMutation.mutate({ taskId: task.id, phase: newP })}
                      />
                    ))}

                    {/* Quick Inline Issue Add for this phase */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (inlineValue.trim()) {
                          quickCreateTaskMutation.mutate({ phase, title: inlineValue });
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 focus-within:border-violet-500 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder={`Add issue to ${phase}... (Press Enter)`}
                        value={inlineValue}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInlineTaskInput((prev) => ({ ...prev, [phase]: val }));
                        }}
                        className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none font-medium"
                      />
                      {inlineValue.trim() && (
                        <button
                          type="submit"
                          disabled={quickCreateTaskMutation.isPending}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white bg-violet-600 hover:bg-violet-700 shrink-0 shadow-xs"
                        >
                          Add
                        </button>
                      )}
                    </form>
                  </div>
                )}
              </section>
            );
          })}

          {/* Unassigned / Backlog tasks without a phase */}
          {tasksByPhase.unphased.length > 0 && (
            <section className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
              <header className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <div
                  onClick={() => togglePhaseCollapse('__unassigned__')}
                  className="flex items-center gap-2.5 min-w-0 cursor-pointer select-none"
                >
                  <button
                    type="button"
                    aria-label="Toggle unassigned section"
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {collapsedPhases['__unassigned__'] ? (
                      <ChevronRight className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  <span className="p-1.5 rounded-lg bg-slate-200/70 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                    <CircleDot className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                      Unscheduled / No Phase ({tasksByPhase.unphased.length})
                    </h4>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-slate-400">
                  Assign tasks to a phase using the row dropdown
                </span>
              </header>

              {!collapsedPhases['__unassigned__'] && (
                <div className="p-2 space-y-1.5">
                  {tasksByPhase.unphased.map((task) => (
                    <LinearIssueRow
                      key={task.id}
                      task={task}
                      availablePhases={projectPhases}
                      onSelect={() => onSelectTask(task.id)}
                      onToggleStatus={() =>
                        toggleStatusMutation.mutate({ taskId: task.id, currentStatus: task.status })
                      }
                      onMovePhase={(newP) => updatePhaseMutation.mutate({ taskId: task.id, phase: newP })}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* 2. STANDARD LIST VIEW */}
      {view === 'LIST' && (
        <>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search project issues"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full pl-9 pr-4 py-2.5 text-xs outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {statusFilters.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                  statusFilter === value
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filteredTasks.map((task: any) => (
              <TaskCard
                key={task.id}
                task={task}
                currentUserId={user?.id}
                onSelect={onSelectTask}
                onComplete={(taskId) => completeMutation.mutate(taskId)}
                onToggleAssigneeDone={() => {}}
                isCompleting={completeMutation.isPending}
              />
            ))}
            {filteredTasks.length === 0 && (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                {isInbox
                  ? 'Inbox is clear. New Telegram captures without a project will show up here.'
                  : 'No issues match this view. Add an issue to move the project forward.'}
              </div>
            )}
          </div>
        </>
      )}

      {/* 3. KANBAN BOARD VIEW */}
      {view === 'BOARD' && (
        <KanbanView
          tasks={visibleTasks}
          onSelectTask={onSelectTask}
          onOpenCreate={() => onOpenCreate(isInbox ? undefined : project.id)}
        />
      )}
    </div>
  );
}

// Sleek Linear-style compact issue row
function LinearIssueRow({
  task,
  availablePhases,
  onSelect,
  onToggleStatus,
  onMovePhase,
}: {
  task: any;
  availablePhases: string[];
  onSelect: () => void;
  onToggleStatus: () => void;
  onMovePhase: (phase: string | null) => void;
}) {
  const isDone = task.status === 'DONE';
  const isInProgress = task.status === 'IN_PROGRESS';
  const isBacklog = task.status === 'BACKLOG';

  const priorityColor =
    task.priority === 'URGENT'
      ? 'text-rose-600 dark:text-rose-400'
      : task.priority === 'HIGH'
      ? 'text-amber-500'
      : task.priority === 'MEDIUM'
      ? 'text-blue-500'
      : 'text-slate-400';

  const assignees =
    Array.isArray(task.assignees) && task.assignees.length > 0
      ? task.assignees
      : task.assignee
      ? [task.assignee]
      : [];
  const primaryAssignee = assignees[0];

  return (
    <div
      onClick={onSelect}
      className="group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/90 hover:border-blue-400/50 dark:hover:border-blue-500/50 hover:shadow-xs transition-all cursor-pointer"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Status Toggle Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus();
          }}
          className="shrink-0 p-0.5 rounded-full hover:scale-110 active:scale-95 transition-transform"
          title={`Status: ${task.status}. Click to advance status.`}
        >
          {isDone ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-50 dark:fill-emerald-950" />
          ) : isInProgress ? (
            <Clock className="w-4 h-4 text-blue-500" />
          ) : isBacklog ? (
            <CircleDot className="w-4 h-4 text-slate-400" />
          ) : (
            <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
          )}
        </button>

        {/* Priority Icon */}
        <span className={`shrink-0 ${priorityColor}`} title={`Priority: ${task.priority}`}>
          {task.priority === 'URGENT' ? (
            <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
          ) : (
            <span className="flex items-end gap-0.5 h-3.5">
              <span className="w-0.5 h-1.5 rounded-full bg-current" />
              <span className={`w-0.5 rounded-full bg-current ${task.priority === 'LOW' ? 'h-1.5 opacity-30' : 'h-2.5'}`} />
              <span
                className={`w-0.5 rounded-full bg-current ${
                  task.priority === 'HIGH' ? 'h-3.5' : 'h-1.5 opacity-30'
                }`}
              />
            </span>
          )}
        </span>

        {/* Issue Title & blocked badge */}
        <span
          className={`text-xs font-semibold truncate ${
            isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'
          }`}
        >
          {task.title}
        </span>

        {task.taskMetadata?.isBlocked && (
          <span className="shrink-0 px-1.5 py-0.2 rounded-md text-[9px] font-extrabold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Blocked
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Due date */}
        {task.dueDate && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400">
            <Calendar className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}

        {/* Assignee Avatar */}
        {primaryAssignee ? (
          <div
            title={primaryAssignee.name}
            className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[9px] font-extrabold flex items-center justify-center shrink-0 border border-white dark:border-slate-800 shadow-2xs"
          >
            {primaryAssignee.name?.slice(0, 2).toUpperCase() || 'U'}
          </div>
        ) : null}

        {/* Quick Phase Changer Dropdown */}
        {availablePhases.length > 0 && (
          <select
            value={task.phase || task.taskMetadata?.phase || ''}
            onChange={(e) => onMovePhase(e.target.value || null)}
            className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 outline-none cursor-pointer hover:border-violet-400 transition-colors"
            title="Move issue to another phase"
          >
            <option value="">No phase</option>
            {availablePhases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
