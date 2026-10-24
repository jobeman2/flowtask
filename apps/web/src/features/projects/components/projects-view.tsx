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
  Circle,
  Clock,
  AlertCircle,
  Calendar,
  Table as TableIcon,
  FileText,
  Sparkles,
  Users,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Check,
} from 'lucide-react';
import { TaskCard } from '../../tasks/components/task-card';
import { KanbanView } from '../../tasks/components/kanban-view';

interface ProjectsViewProps {
  onSelectProject: (projectId: string | null) => void;
  selectedProjectId: string | null;
  onSelectTask: (taskId: string) => void;
  onOpenCreate: (projectId?: string) => void;
  isOwnerOrAdmin: boolean;
}

const NOTION_EMOJIS = ['🎯', '🚀', '💻', '📱', '🎨', '📈', '⚡', '💡', '📝', '🛠️', '📦', '🔥', '📊', '🌐', '🛡️'];

const PROJECT_TEMPLATES = {
  product: {
    label: 'Product Roadmap',
    emoji: '🚀',
    description: 'Track roadmap features, UX design, core build, and launch readiness.',
    tasks: [
      { title: 'Define product scope & success metrics', status: 'TODO', priority: 'HIGH' },
      { title: 'Design user flow and wireframes', status: 'IN_PROGRESS', priority: 'HIGH' },
      { title: 'Build core application features & API', status: 'TODO', priority: 'URGENT' },
      { title: 'Run end-to-end testing & bug triage', status: 'BACKLOG', priority: 'MEDIUM' },
      { title: 'Prepare launch communications & release', status: 'BACKLOG', priority: 'MEDIUM' },
    ],
  },
  sprint: {
    label: 'Sprint Cycle',
    emoji: '⚡',
    description: 'Plan focused sprint cycle work items, active tasks, and retrospective review.',
    tasks: [
      { title: 'Refine sprint goals and backlog', status: 'DONE', priority: 'HIGH' },
      { title: 'Execute sprint core deliverables', status: 'IN_PROGRESS', priority: 'URGENT' },
      { title: 'Code review and QA verification', status: 'TODO', priority: 'HIGH' },
      { title: 'Sprint retrospective and follow-ups', status: 'BACKLOG', priority: 'LOW' },
    ],
  },
  marketing: {
    label: 'Marketing Campaign',
    emoji: '📈',
    description: 'Coordinate campaign deliverables from brief to social distribution and analytics.',
    tasks: [
      { title: 'Write campaign brief & targeting', status: 'DONE', priority: 'HIGH' },
      { title: 'Produce creative graphics & copy', status: 'IN_PROGRESS', priority: 'HIGH' },
      { title: 'Distribute across social channels', status: 'TODO', priority: 'MEDIUM' },
      { title: 'Review campaign reach and conversions', status: 'BACKLOG', priority: 'LOW' },
    ],
  },
} as const;

type ProjectFilter = 'ALL' | 'ACTIVE' | 'PLANNED' | 'COMPLETED';
const INBOX_PROJECT_ID = '__flowtask_inbox__';

const EMOJI_TAG_REGEX = /<!--emoji:(.*?)-->/;

function getProjectEmoji(name: string, description?: string): string {
  if (description) {
    const match = description.match(EMOJI_TAG_REGEX);
    if (match && match[1]) return match[1];
  }
  const emojiMatch = name.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
  if (emojiMatch) return emojiMatch[0];
  const lower = name.toLowerCase();
  if (lower.includes('launch') || lower.includes('product')) return '🚀';
  if (lower.includes('design') || lower.includes('ui')) return '🎨';
  if (lower.includes('dev') || lower.includes('api') || lower.includes('code')) return '💻';
  if (lower.includes('market') || lower.includes('growth')) return '📈';
  if (lower.includes('sprint')) return '⚡';
  if (lower.includes('mobile') || lower.includes('app')) return '📱';
  if (lower.includes('research') || lower.includes('doc')) return '📝';
  if (lower.includes('qa') || lower.includes('test')) return '🛠️';
  return '🎯';
}

function cleanProjectDescription(desc?: string): string {
  if (!desc) return '';
  return desc.replace(EMOJI_TAG_REGEX, '').replace(/<!--phases:(.*?)-->/, '').trim();
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
  const [selectedEmoji, setSelectedEmoji] = useState('🎯');
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
      const emoji = template ? template.emoji : selectedEmoji;
      const descWithEmoji = `${cleanProjectDescription(description)}\n<!--emoji:${emoji}-->`.trim();

      const projectResult = await apiClient.createProject(workspaceId, {
        name: name.trim(),
        description: descWithEmoji || undefined,
        color,
      });
      if (projectResult.error || !projectResult.data?.id) {
        throw new Error(projectResult.error || 'Could not create the project.');
      }

      if (template) {
        for (const item of template.tasks) {
          await apiClient.createTask({
            workspaceId,
            projectId: projectResult.data.id,
            title: item.title,
            status: item.status,
            priority: item.priority as any,
          });
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
      setSelectedEmoji('🎯');
      setTemplateId('blank');
      setIsCreating(false);
      onSelectProject(project.id);
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
      const emoji = getProjectEmoji(project.name, project.description);
      return { project, projectTasks, completed, blocked, state, upcoming, emoji };
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
          description: 'Unassigned tasks and quick captures waiting to be triaged.',
          color: '#6366f1',
        }}
        projectTasks={inboxTasks}
        completed={inboxCompleted}
        blocked={inboxBlocked}
        state="ACTIVE"
        upcoming={inboxUpcoming}
        emoji="📥"
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
    <div className="space-y-4 animate-in fade-in font-sans pb-28">
      {/* Workspace Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Projects</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
              {projects.length}
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            Notion-style workspace databases & roadmaps
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

      {/* Create Project Sheet / Modal */}
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
            className="w-full max-w-md rounded-t-[28px] sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-4 animate-in slide-in-from-bottom duration-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Workspace
                </p>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">New Notion Project</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Template Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Start from template</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTemplateId('blank');
                    setSelectedEmoji('🎯');
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    templateId === 'blank'
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 dark:border-blue-500'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40'
                  }`}
                >
                  <span className="text-sm">🎯 Blank Project</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">Start fresh with empty database</p>
                </button>
                {(Object.entries(PROJECT_TEMPLATES) as [keyof typeof PROJECT_TEMPLATES, any][]).map(([key, t]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setTemplateId(key);
                      setName(t.label);
                      setDescription(t.description);
                      setSelectedEmoji(t.emoji);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      templateId === key
                        ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 dark:border-blue-500'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-sm">{t.emoji} {t.label}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{t.tasks.length} starter tasks</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Emoji & Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Project icon & name</label>
              <div className="flex gap-2">
                <div className="relative group">
                  <span className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl cursor-pointer border border-slate-200 dark:border-slate-700">
                    {selectedEmoji}
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Mobile App Redesign"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 font-bold text-slate-900 dark:text-white"
                  required
                />
              </div>

              {/* Emoji quick pick bar */}
              <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
                {NOTION_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setSelectedEmoji(em)}
                    className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-transform ${
                      selectedEmoji === em
                        ? 'bg-blue-100 dark:bg-blue-900/60 ring-2 ring-blue-500 scale-110'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* Description / Goal */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Project goal & brief</label>
              <textarea
                placeholder="What is the shared outcome this project is delivering?"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-slate-900 dark:text-white resize-none"
              />
            </div>

            {/* Color Accent */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Accent color</label>
              <div className="flex gap-2">
                {colorPalette.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => setColor(swatch)}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      color === swatch ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''
                    }`}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || createProjectMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-500/20"
              >
                {createProjectMutation.isPending ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search projects..."
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full pl-9 pr-4 py-2 text-xs outline-none focus:border-blue-500 text-slate-900 dark:text-white"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {(['ALL', 'ACTIVE', 'PLANNED', 'COMPLETED'] as ProjectFilter[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
              filter === value
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {value === 'ALL' ? 'All projects' : value[0] + value.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Notion-style Inbox Card */}
      <button
        type="button"
        onClick={() => onSelectProject(INBOX_PROJECT_ID)}
        className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-900/70 bg-gradient-to-r from-indigo-50/50 via-blue-50/40 to-transparent dark:from-indigo-950/20 dark:via-blue-950/10 text-left hover:border-indigo-400 transition-colors group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg shadow-xs group-hover:scale-105 transition-transform">
            📥
          </span>
          <div className="min-w-0">
            <span className="block text-xs font-extrabold text-slate-900 dark:text-white">Workspace Inbox</span>
            <span className="block text-[10px] text-slate-500 truncate">
              Unassigned tasks & quick captures waiting to be triaged
            </span>
          </div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
          <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 shadow-2xs font-extrabold">
            {inboxTasks.length}
          </span>
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </button>

      {/* Projects List / Grid */}
      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-400 animate-pulse">Loading projects…</div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-10 text-center bg-white dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
          <Folder className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No projects found</p>
          <p className="text-[11px] text-slate-400">Create your first Notion project to organize your team.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProjects.map(({ project, projectTasks, completed, blocked, state, upcoming, emoji }: any) => {
            const count = projectTasks.length;
            const progress = count ? Math.round((completed / count) * 100) : 0;
            const cleanDesc = cleanProjectDescription(project.description);

            return (
              <article
                key={project.id}
                onClick={() => {
                  triggerHaptic('light');
                  onSelectProject(project.id);
                }}
                className="group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/90 bg-white dark:bg-slate-900 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.03)] hover:border-blue-400/60 dark:hover:border-blue-500/60 hover:shadow-md transition-all cursor-pointer p-4"
              >
                {/* Top color strip */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: project.color || '#2563eb' }}
                />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                      {emoji}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                          {project.name}
                        </h3>
                      </div>
                      {cleanDesc && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {cleanDesc}
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
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

                {/* Progress Bar & Stats */}
                <div className="mt-3.5 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                    <span>Database items</span>
                    <span>
                      {completed}/{count} done · {progress}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%`, backgroundColor: project.color || '#2563eb' }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                    <span>
                      {blocked > 0 ? (
                        <span className="text-amber-600 font-bold">{blocked} blocked</span>
                      ) : (
                        `${count} ${count === 1 ? 'task' : 'tasks'}`
                      )}
                    </span>
                    {upcoming && (
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <CalendarDays className="w-3 h-3" />
                        Due {new Date(upcoming.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
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
 * NOTION-STYLE PROJECT WORKSPACE
 * ========================================================================================= */
function ProjectWorkspace({
  project,
  projectTasks,
  completed,
  blocked,
  state,
  upcoming,
  emoji,
  onBack,
  onSelectTask,
  onOpenCreate,
  isOwnerOrAdmin,
  isInbox = false,
}: any) {
  const { workspaceId, user } = useAuth();
  const { triggerHaptic } = useTelegram();
  const queryClient = useQueryClient();

  // Notion Database Views: TABLE | BOARD | LIST | OVERVIEW
  const [activeView, setActiveView] = useState<'TABLE' | 'BOARD' | 'LIST' | 'OVERVIEW'>('TABLE');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [inlineTaskInput, setInlineTaskInput] = useState('');

  // Complete Task Mutation
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

  // Cycle Status Mutation
  const cycleStatusMutation = useMutation({
    mutationFn: async ({ taskId, currentStatus }: { taskId: string; currentStatus: string }) => {
      if (!workspaceId) throw new Error('No workspace');
      const order = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
      const nextIdx = (order.indexOf(currentStatus) + 1) % order.length;
      const nextStatus = order[nextIdx] || 'TODO';
      return apiClient.updateTask(taskId, workspaceId, { status: nextStatus });
    },
    onSuccess: () => {
      triggerHaptic('light');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project-issues-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    },
  });

  // Quick Create Task Mutation (Inline)
  const quickCreateTaskMutation = useMutation({
    mutationFn: async ({ title, status = 'TODO' }: { title: string; status?: string }) => {
      if (!workspaceId || !title.trim()) return;
      return apiClient.createTask({
        workspaceId,
        projectId: isInbox ? undefined : project.id,
        title: title.trim(),
        status,
        priority: 'MEDIUM',
      });
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project-issues-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
      setInlineTaskInput('');
    },
  });

  const visibleTasks = useMemo(() => {
    return projectTasks.filter((task: any) => {
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
  }, [projectTasks, user, isOwnerOrAdmin]);

  const filteredTasks = useMemo(() => {
    return visibleTasks.filter((task: any) => {
      if (statusFilter !== 'ALL' && task.status !== statusFilter) return false;
      if (search.trim() && !`${task.title || ''} ${task.description || ''}`.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [visibleTasks, statusFilter, search]);

  const progress = projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0;
  const projectEmoji = emoji || getProjectEmoji(project.name, project.description);
  const cleanDesc = cleanProjectDescription(project.description);

  return (
    <div className="space-y-4 pb-28 animate-in fade-in font-sans">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>All projects</span>
      </button>

      {/* Notion Page Cover & Header */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        {/* Decorative Cover Gradient */}
        <div
          className="h-20 w-full opacity-90 transition-all"
          style={{
            background: `linear-gradient(135deg, ${project.color || '#2563eb'} 0%, #1e1b4b 100%)`,
          }}
        />

        <div className="p-4 pt-0 relative">
          {/* Floating Emoji Icon */}
          <div className="-mt-8 mb-2 flex items-center justify-between">
            <span className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border-4 border-white dark:border-slate-900 shadow-md flex items-center justify-center text-3xl shrink-0">
              {projectEmoji}
            </span>

            <button
              type="button"
              onClick={() => onOpenCreate(isInbox ? undefined : project.id)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>{isInbox ? 'Capture task' : 'New task'}</span>
            </button>
          </div>

          {/* Project Title & Status */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{project.name}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  state === 'COMPLETED'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : state === 'ACTIVE'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {state === 'COMPLETED' ? 'Completed' : state === 'ACTIVE' ? 'In progress' : 'Planned'}
              </span>
            </div>

            <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed">
              {cleanDesc || 'Project workspace database. Manage roadmaps, deliverables, and team execution.'}
            </p>
          </div>

          {/* Notion Properties Bar */}
          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 dark:border-slate-800 mt-4 pt-3 text-[11px]">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Progress</span>
              <span className="font-extrabold text-slate-900 dark:text-white">{progress}%</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tasks</span>
              <span className="font-extrabold text-slate-900 dark:text-white">
                {completed}/{projectTasks.length} done
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Blocked</span>
              <span className={`font-extrabold ${blocked ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
                {blocked} blocked
              </span>
            </div>
          </div>

          {/* Progress bar line */}
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-3">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: project.color || '#2563eb' }}
            />
          </div>
        </div>
      </section>

      {/* Notion Database Navigation Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveView('TABLE');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              activeView === 'TABLE'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
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
              setActiveView('BOARD');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              activeView === 'BOARD'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
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
              setActiveView('LIST');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              activeView === 'LIST'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
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
              setActiveView('OVERVIEW');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              activeView === 'OVERVIEW'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Docs</span>
          </button>
        </div>

        <span className="text-xs font-bold text-slate-400 shrink-0">
          {projectTasks.length} {projectTasks.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* 1. NOTION TABLE VIEW */}
      {activeView === 'TABLE' && (
        <div className="space-y-3">
          {/* Quick Filters & Search */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter table..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-600 dark:text-slate-300 outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
            </select>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 p-3 bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              <div className="col-span-6 sm:col-span-5">Task Name</div>
              <div className="col-span-3 sm:col-span-3">Status</div>
              <div className="col-span-3 sm:col-span-2">Priority</div>
              <div className="hidden sm:block sm:col-span-2">Due</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredTasks.map((task: any) => {
                const isDone = task.status === 'DONE';
                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    {/* Name + Checkbox */}
                    <div className="col-span-6 sm:col-span-5 flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          completeMutation.mutate(task.id);
                        }}
                        className="shrink-0 text-slate-400 hover:text-emerald-500 transition-colors"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-50 dark:fill-emerald-950" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>
                      <span
                        className={`text-xs font-semibold truncate ${
                          isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>

                    {/* Status Pill (Clickable cycle) */}
                    <div className="col-span-3 sm:col-span-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleStatusMutation.mutate({ taskId: task.id, currentStatus: task.status });
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 ${
                          task.status === 'DONE'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : task.status === 'IN_PROGRESS'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                            : task.status === 'IN_REVIEW'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{task.status.replace('_', ' ')}</span>
                      </button>
                    </div>

                    {/* Priority Tag */}
                    <div className="col-span-3 sm:col-span-2">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          task.priority === 'URGENT'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                            : task.priority === 'HIGH'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                            : task.priority === 'MEDIUM'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>

                    {/* Due Date */}
                    <div className="hidden sm:block sm:col-span-2 text-[10px] text-slate-400">
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                    </div>
                  </div>
                );
              })}

              {filteredTasks.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400">
                  No tasks match this filter. Add one below!
                </div>
              )}
            </div>

            {/* Signature Notion Table: Inline + New Row */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (inlineTaskInput.trim()) {
                  quickCreateTaskMutation.mutate({ title: inlineTaskInput.trim() });
                }
              }}
              className="flex items-center gap-2 p-3 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800"
            >
              <Plus className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="+ Add task... (Press Enter)"
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
        </div>
      )}

      {/* 2. NOTION BOARD VIEW (KANBAN) */}
      {activeView === 'BOARD' && (
        <KanbanView
          tasks={visibleTasks}
          onSelectTask={onSelectTask}
          onOpenCreate={() => onOpenCreate(isInbox ? undefined : project.id)}
        />
      )}

      {/* 3. NOTION LIST VIEW */}
      {activeView === 'LIST' && (
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
              No tasks in this list. Click "New task" to add work items.
            </div>
          )}
        </div>
      )}

      {/* 4. NOTION DOCS / OVERVIEW VIEW */}
      {activeView === 'OVERVIEW' && (
        <section className="space-y-4">
          <div className="p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <FileText className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Project Specification</h3>
                <p className="text-[11px] text-slate-400">Goals, deliverables, and team alignment</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {cleanDesc || 'No project description added yet. Edit project properties to add a scope brief.'}
            </div>

            {/* Key Deliverables Status */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Key Deliverables ({projectTasks.length})
              </h4>
              <div className="space-y-1.5">
                {projectTasks.slice(0, 6).map((t: any) => (
                  <div
                    key={t.id}
                    onClick={() => onSelectTask(t.id)}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {t.status === 'DONE' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className={`truncate font-semibold ${t.status === 'DONE' ? 'line-through text-slate-400' : ''}`}>
                        {t.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 shrink-0 ml-2">
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
