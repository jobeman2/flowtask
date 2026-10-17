'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { useTelegram } from '../../../hooks/use-telegram';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, CircleDot, Folder, Inbox as InboxIcon, LayoutGrid, List, Plus, Search, X } from 'lucide-react';
import { TaskCard } from '../../tasks/components/task-card';
import { KanbanView } from '../../tasks/components/kanban-view';

interface ProjectsViewProps {
  onSelectProject: (projectId: string | null) => void;
  selectedProjectId: string | null;
  onSelectTask: (taskId: string) => void;
  onOpenCreate: (projectId?: string) => void;
  isOwnerOrAdmin: boolean;
}

const PROJECT_TEMPLATES = {
  product: {
    label: 'Product launch',
    description: 'Plan and deliver a product release from scope through launch review.',
    tasks: ['Define the launch goal and success metrics', 'Confirm scope and owners', 'Build and test the release', 'Prepare launch communications', 'Review launch results'],
  },
  sprint: {
    label: 'Sprint',
    description: 'Plan a focused delivery cycle, track work, and review the outcome.',
    tasks: ['Set the sprint goal', 'Break work into issues', 'Review completed work', 'Capture follow-up actions'],
  },
  campaign: {
    label: 'Campaign',
    description: 'Coordinate a campaign from brief to performance review.',
    tasks: ['Write the campaign brief', 'Confirm audience and channels', 'Create and review assets', 'Launch the campaign', 'Review performance'],
  },
} as const;

type ProjectFilter = 'ALL' | 'ACTIVE' | 'PLANNED' | 'COMPLETED';
const INBOX_PROJECT_ID = '__flowtask_inbox__';

export function ProjectsView({ onSelectProject, selectedProjectId, onSelectTask, onOpenCreate, isOwnerOrAdmin }: ProjectsViewProps) {
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
      const projectResult = await apiClient.createProject(workspaceId, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });
      if (projectResult.error || !projectResult.data?.id) {
        throw new Error(projectResult.error || 'Could not create the project.');
      }

      const template = templateId === 'blank' ? null : PROJECT_TEMPLATES[templateId];
      if (template) {
        for (const title of template.tasks) {
          const taskResult = await apiClient.createTask({
            workspaceId,
            projectId: projectResult.data.id,
            title,
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
      // The project is created before its starter issues, so refresh in case
      // a later starter issue fails after the project has already been saved.
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project-issues-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    },
  });

  const colorPalette = ['#2563eb', '#7c3aed', '#db2777', '#e11d48', '#d97706', '#059669', '#0891b2', '#475569'];

  const projectRows = useMemo(() => projects.map((project: any) => {
    const projectTasks = tasks.filter((task: any) => task.projectId === project.id && !task.archivedAt);
    const completed = projectTasks.filter((task: any) => task.status === 'DONE').length;
    const blocked = projectTasks.filter((task: any) => task.taskMetadata?.isBlocked).length;
    const active = projectTasks.some((task: any) => task.status === 'IN_PROGRESS' || task.status === 'IN_REVIEW');
    const state = projectTasks.length > 0 && completed === projectTasks.length
      ? 'COMPLETED'
      : active ? 'ACTIVE' : 'PLANNED';
    const upcoming = projectTasks
      .filter((task: any) => task.dueDate && task.status !== 'DONE')
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
    return { project, projectTasks, completed, blocked, state, upcoming };
  }), [projects, tasks]);

  const filteredProjects = projectRows.filter((row: any) => {
    if (filter !== 'ALL' && row.state !== filter) return false;
    return !search.trim() || `${row.project.name} ${row.project.description || ''}`.toLowerCase().includes(search.toLowerCase());
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
        project={{ id: INBOX_PROJECT_ID, name: 'Inbox', description: 'Unassigned tasks and Telegram captures waiting to be triaged.' }}
        projectTasks={inboxTasks}
        completed={inboxCompleted}
        blocked={inboxBlocked}
        state="ACTIVE"
        upcoming={inboxUpcoming}
        isInbox
        onBack={() => onSelectProject(null)}
        onSelectTask={onSelectTask}
        onOpenCreate={() => onOpenCreate()}
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
        onOpenCreate={() => onOpenCreate(selectedProject.project.id)}
        isOwnerOrAdmin={isOwnerOrAdmin}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in font-sans">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Projects</h2>
          <p className="text-xs text-slate-400 font-medium">Goals, delivery progress, and the issues moving work forward</p>
        </div>
        <button type="button" onClick={() => { triggerHaptic('light'); setName(''); setDescription(''); setColor('#2563eb'); setTemplateId('blank'); createProjectMutation.reset(); setIsCreating(true); }} className="px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/25 active:scale-95 transition-all">
          <Plus className="w-3.5 h-3.5 stroke-[3]" /><span>New Project</span>
        </button>
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget) setIsCreating(false); }}>
          <form role="dialog" aria-modal="true" aria-labelledby="new-project-title" onSubmit={(event) => { event.preventDefault(); if (name.trim() && !createProjectMutation.isPending) createProjectMutation.mutate(); }} className="w-full max-w-lg max-h-[calc(100dvh-0.75rem)] sm:max-h-[88dvh] rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 id="new-project-title" className="text-base font-semibold text-slate-900 dark:text-white">New project</h3>
              <button type="button" aria-label="Close project form" onClick={() => setIsCreating(false)} className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
            </header>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="project-name" className="text-xs font-medium text-slate-600 dark:text-slate-300">Project name</label>
                <input id="project-name" type="text" required placeholder="e.g. Mobile app launch" value={name} onChange={(event) => setName(event.target.value)} className="w-full px-3.5 py-3 text-[16px] sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white focus:border-blue-500" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="project-goal" className="text-xs font-medium text-slate-600 dark:text-slate-300">Goal <span className="text-slate-400">(optional)</span></label>
                <textarea id="project-goal" rows={3} placeholder="What should this project accomplish?" value={description} onChange={(event) => setDescription(event.target.value)} className="w-full px-3.5 py-3 text-[16px] sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white focus:border-blue-500 resize-y" />
              </div>
              <details className="group rounded-xl border border-slate-200 dark:border-slate-800">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 [&::-webkit-details-marker]:hidden">Template and color<ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" /></summary>
                <div className="space-y-4 border-t border-slate-100 px-3.5 py-4 dark:border-slate-800">
                  <div className="space-y-1.5">
                    <label htmlFor="project-template" className="text-xs font-medium text-slate-600 dark:text-slate-300">Start from</label>
                    <select id="project-template" value={templateId} onChange={(event) => {
                      const value = event.target.value as keyof typeof PROJECT_TEMPLATES | 'blank';
                      setTemplateId(value);
                      setDescription(value === 'blank' ? '' : PROJECT_TEMPLATES[value].description);
                    }} className="w-full px-3.5 py-3 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white focus:border-blue-500">
                      <option value="blank">Blank project</option>
                      {Object.entries(PROJECT_TEMPLATES).map(([key, template]) => <option key={key} value={key}>{template.label}</option>)}
                    </select>
                    {templateId !== 'blank' && <p className="text-xs text-slate-500">{PROJECT_TEMPLATES[templateId].tasks.length} starter issues will be added.</p>}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Project color</p>
                    <div className="flex items-center gap-3">{colorPalette.map((entry) => <button key={entry} type="button" aria-label={`Use project color ${entry}`} aria-pressed={color === entry} onClick={() => setColor(entry)} className={`w-7 h-7 rounded-full transition-transform ${color === entry ? 'scale-110 ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' : ''}`} style={{ backgroundColor: entry }} />)}</div>
                  </div>
                </div>
              </details>
              {createProjectMutation.error && <p role="alert" className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-xl p-3">{createProjectMutation.error.message}</p>}
            </div>
            <footer className="shrink-0 border-t border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom,1rem))] backdrop-blur-md flex gap-2">
              <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800">Cancel</button>
              <button type="submit" disabled={!name.trim() || createProjectMutation.isPending} className="flex-1 px-4 py-3 rounded-xl text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm disabled:opacity-50">
                {createProjectMutation.isPending ? 'Creating…' : templateId === 'blank' ? 'Create project' : `Create project with ${PROJECT_TEMPLATES[templateId].tasks.length} issues`}
              </button>
            </footer>
          </form>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full pl-9 pr-4 py-2.5 text-xs outline-none focus:border-blue-500" />
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {(['ALL', 'ACTIVE', 'PLANNED', 'COMPLETED'] as ProjectFilter[]).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap ${filter === value ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{value === 'ALL' ? 'All projects' : value[0] + value.slice(1).toLowerCase()}</button>)}
      </div>

      <button type="button" onClick={() => onSelectProject(INBOX_PROJECT_ID)} className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-dashed border-blue-200 dark:border-blue-900/70 bg-blue-50/60 dark:bg-blue-950/20 text-left hover:border-blue-400 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 flex items-center justify-center"><InboxIcon className="w-4 h-4" /></span>
          <span className="min-w-0"><span className="block text-xs font-extrabold text-slate-900 dark:text-white">Inbox</span><span className="block text-[10px] text-slate-500 truncate">Unassigned work and Telegram captures to triage</span></span>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-700 dark:text-blue-300"><span className="px-2 py-1 rounded-full bg-white dark:bg-slate-900">{inboxTasks.length}</span><ArrowRight className="w-3.5 h-3.5" /></span>
      </button>

      {isLoading ? <div className="py-8 text-center text-xs text-slate-400 animate-pulse">Loading projects…</div>
        : filteredProjects.length === 0 ? <div className="py-10 text-center bg-white dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2"><Folder className="w-8 h-8 text-slate-300 mx-auto" /><p className="text-xs font-bold text-slate-700 dark:text-slate-300">No projects in this view</p><p className="text-[11px] text-slate-400">Create a project or change your filters.</p></div>
        : <div className="space-y-3">{filteredProjects.map(({ project, projectTasks, completed, blocked, state, upcoming }: any) => {
          const isSelected = selectedProjectId === project.id;
          const count = projectTasks.length;
          const progress = count ? Math.round((completed / count) * 100) : 0;
          return <article key={project.id} className={`p-4 rounded-2xl border bg-white dark:bg-slate-900 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.03)] ${isSelected ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-slate-100 dark:border-slate-800'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-1.5 h-11 rounded-full shrink-0" style={{ backgroundColor: project.color || '#2563eb' }} />
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{project.name}</h3>
                  {project.description && <p className="text-xs text-slate-500 line-clamp-2 mt-1">{project.description}</p>}
                </div>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${state === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : state === 'ACTIVE' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                {state === 'COMPLETED' ? <CheckCircle2 className="w-3 h-3" /> : <CircleDot className="w-3 h-3" />}{state === 'COMPLETED' ? 'Completed' : state === 'ACTIVE' ? 'In progress' : 'Planned'}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-[10px] font-semibold text-slate-500"><span>Issue progress</span><span>{completed}/{count} complete · {progress}%</span></div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: project.color || '#2563eb' }} /></div>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{blocked > 0 ? <span className="text-amber-600 font-bold">{blocked} blocked</span> : `${count} ${count === 1 ? 'issue' : 'issues'}`}</span>
                {upcoming && <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" />Next due {new Date(upcoming.dueDate).toLocaleDateString()}</span>}
              </div>
            </div>
            <button type="button" onClick={() => { triggerHaptic('light'); onSelectProject(project.id); }} className="w-full mt-3 flex items-center justify-between text-[11px] font-bold text-blue-600 dark:text-blue-400">
              <span>Open project</span><ArrowRight className="w-3.5 h-3.5" />
            </button>
          </article>;
        })}</div>}
    </div>
  );
}

function ProjectWorkspace({ project, projectTasks, completed, blocked, state, upcoming, onBack, onSelectTask, onOpenCreate, isOwnerOrAdmin, isInbox = false }: any) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'LIST' | 'BOARD'>('LIST');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

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
  const assigneeCompletionMutation = useMutation({
    mutationFn: async ({ taskId, completedAssigneeIds }: { taskId: string; completedAssigneeIds: string[] }) => {
      if (!workspaceId) throw new Error('No active workspace selected.');
      const result = await apiClient.updateTask(taskId, workspaceId, { completedAssigneeIds });
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project-issues-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    },
  });

  const visibleTasks = projectTasks.filter((task: any) => {
    const assignees = Array.isArray(task.assignees) && task.assignees.length > 0 ? task.assignees : (task.assignee ? [task.assignee] : []);
    const assignedToMe = assignees.some((assignee: any) => assignee.id === user?.id) || task.assigneeId === user?.id;
    const isUnassigned = assignees.length === 0 && !task.assigneeId;
    return isUnassigned || assignedToMe || task.creatorId === user?.id || isOwnerOrAdmin;
  });
  const filteredTasks = visibleTasks.filter((task: any) => {
    if (statusFilter !== 'ALL' && task.status !== statusFilter) return false;
    if (search.trim() && !`${task.title || ''} ${task.description || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const progress = projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0;
  const openCount = projectTasks.filter((task: any) => task.status !== 'DONE' && task.status !== 'CANCELLED').length;
  const statusFilters = [
    ['ALL', 'All issues'], ['BACKLOG', 'Backlog'], ['TODO', 'To do'],
    ['IN_PROGRESS', 'In progress'], ['IN_REVIEW', 'In review'], ['DONE', 'Done'],
  ];

  return (
    <div className="space-y-4 pb-24 animate-in fade-in font-sans">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600"><ArrowLeft className="w-3.5 h-3.5" />All projects</button>
      <section className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-2 h-12 rounded-full shrink-0" style={{ backgroundColor: project.color || '#2563eb' }} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{project.name}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isInbox ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' : state === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : state === 'ACTIVE' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{isInbox ? 'Needs triage' : state === 'COMPLETED' ? 'Completed' : state === 'ACTIVE' ? 'In progress' : 'Planned'}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{project.description || 'Add a project goal to give the team a shared outcome to work toward.'}</p>
            </div>
          </div>
          <button type="button" onClick={onOpenCreate} className="shrink-0 px-3 py-2 rounded-xl bg-blue-600 text-white text-[11px] font-bold flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />{isInbox ? 'Capture task' : 'New issue'}</button>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
          {isInbox ? <>
            <div><div className="text-[10px] text-slate-500">Open</div><div className="text-sm font-extrabold text-slate-900 dark:text-white">{openCount}</div></div>
            <div><div className="text-[10px] text-slate-500">Blocked</div><div className={`text-sm font-extrabold ${blocked ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>{blocked}</div></div>
            <div><div className="text-[10px] text-slate-500">To triage</div><div className="text-sm font-extrabold text-slate-900 dark:text-white">{projectTasks.length}</div></div>
          </> : <>
            <div><div className="text-[10px] text-slate-500">Progress</div><div className="text-sm font-extrabold text-slate-900 dark:text-white">{progress}%</div></div>
            <div><div className="text-[10px] text-slate-500">Issues</div><div className="text-sm font-extrabold text-slate-900 dark:text-white">{completed}/{projectTasks.length} done</div></div>
            <div><div className="text-[10px] text-slate-500">Blocked</div><div className={`text-sm font-extrabold ${blocked ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>{blocked}</div></div>
          </>}
        </div>
        {!isInbox && <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: project.color || '#2563eb' }} /></div>}
        {upcoming && <div className="text-[10px] text-slate-500 inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" />Next issue due {new Date(upcoming.dueDate).toLocaleDateString()}</div>}
      </section>

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Issues <span className="text-slate-400">{projectTasks.length}</span></h3>
        <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          <button type="button" title="List view" onClick={() => setView('LIST')} className={`p-1.5 rounded-lg ${view === 'LIST' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-500'}`}><List className="w-3.5 h-3.5" /></button>
          <button type="button" title="Board view" onClick={() => setView('BOARD')} className={`p-1.5 rounded-lg ${view === 'BOARD' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-500'}`}><LayoutGrid className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {view === 'LIST' && <>
        <div className="relative"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search project issues" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full pl-9 pr-4 py-2.5 text-xs outline-none focus:border-blue-500" /></div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">{statusFilters.map(([value, label]) => <button key={value} type="button" onClick={() => setStatusFilter(value)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap ${statusFilter === value ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{label}</button>)}</div>
        <div className="space-y-2">{filteredTasks.map((task: any) => <TaskCard key={task.id} task={task} currentUserId={user?.id} onSelect={onSelectTask} onComplete={(taskId) => completeMutation.mutate(taskId)} onToggleAssigneeDone={(taskId, completedAssigneeIds) => assigneeCompletionMutation.mutate({ taskId, completedAssigneeIds })} isCompleting={completeMutation.isPending || assigneeCompletionMutation.isPending} />)}
          {filteredTasks.length === 0 && <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500">{isInbox ? 'Inbox is clear. New Telegram captures without a project will show up here.' : 'No issues match this view. Add an issue to move the project forward.'}</div>}
        </div>
      </>}
      {view === 'BOARD' && <KanbanView tasks={visibleTasks} onSelectTask={onSelectTask} onOpenCreate={onOpenCreate} />}
    </div>
  );
}
