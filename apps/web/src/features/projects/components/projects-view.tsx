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
  Crown,
  Zap,
  Flag,
  UserCheck,
  Tag,
} from 'lucide-react';
import { TaskCard } from '../../tasks/components/task-card';
import { KanbanView } from '../../tasks/components/kanban-view';
import { AiProjectManagerModal } from '../../ai/components/ai-project-manager-modal';
import { ClickUpSyncModal } from '../../settings/components/clickup-sync-modal';

interface ProjectsViewProps {
  onSelectProject: (projectId: string | null) => void;
  selectedProjectId: string | null;
  onSelectTask: (taskId: string) => void;
  onOpenCreate: (projectId?: string) => void;
  isOwnerOrAdmin: boolean;
}

export interface ProjectMetadata {
  emoji?: string;
  leadId?: string;
  leadName?: string;
  memberIds?: string[];
  priority?: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  targetDate?: string;
  status?: 'ACTIVE' | 'PLANNED' | 'COMPLETED' | 'ON_HOLD';
  spaceName?: string;
}

const NOTION_EMOJIS = ['🎯', '🚀', '💻', '📱', '🎨', '📈', '⚡', '💡', '📝', '🛠️', '📦', '🔥', '📊', '🌐', '🛡️', '🤖'];

const PROJECT_TEMPLATES = {
  sprint: {
    label: 'ClickUp Sprint Cycle',
    emoji: '⚡',
    spaceName: 'Sprint Space',
    priority: 'HIGH' as const,
    description: 'Agile sprint cycle tracking active deliverables, code reviews, and QA verification.',
    tasks: [
      { title: 'Refine sprint goals and backlog', status: 'DONE', priority: 'HIGH' },
      { title: 'Implement core API endpoints & schema', status: 'IN_PROGRESS', priority: 'URGENT' },
      { title: 'Frontend UI components & state hooks', status: 'TODO', priority: 'HIGH' },
      { title: 'Run QA regression and bot sandbox checks', status: 'TODO', priority: 'MEDIUM' },
      { title: 'Sprint retrospective and release review', status: 'TODO', priority: 'LOW' },
    ],
  },
  product: {
    label: 'Notion Product Roadmap',
    emoji: '🚀',
    spaceName: 'Product Wiki',
    priority: 'HIGH' as const,
    description: 'Track roadmap features, UX design, core build, and launch readiness.',
    tasks: [
      { title: 'Draft product specification document', status: 'DONE', priority: 'HIGH' },
      { title: 'Design user flow and interactive wireframes', status: 'IN_PROGRESS', priority: 'HIGH' },
      { title: 'Build core application features & database', status: 'TODO', priority: 'URGENT' },
      { title: 'Security audit and permission testing', status: 'TODO', priority: 'HIGH' },
      { title: 'Prepare launch communications & release pin', status: 'TODO', priority: 'MEDIUM' },
    ],
  },
  marketing: {
    label: 'Growth Campaign',
    emoji: '📈',
    spaceName: 'Growth Engine',
    priority: 'MEDIUM' as const,
    description: 'Coordinate campaign deliverables from brief to social distribution and analytics.',
    tasks: [
      { title: 'Write campaign brief & target audience', status: 'DONE', priority: 'MEDIUM' },
      { title: 'Produce creative graphics, banners & copy', status: 'IN_PROGRESS', priority: 'HIGH' },
      { title: 'Broadcast Telegram community announcement', status: 'TODO', priority: 'URGENT' },
      { title: 'Track conversion analytics and user signups', status: 'TODO', priority: 'MEDIUM' },
    ],
  },
} as const;

type ProjectFilter = 'ALL' | 'ASSIGNED_TO_ME' | 'ACTIVE' | 'PLANNED' | 'COMPLETED';
const INBOX_PROJECT_ID = '__flowtask_inbox__';

const META_TAG_REGEX = /<!--project-meta:(.*?)-->/;
const EMOJI_TAG_REGEX = /<!--emoji:(.*?)-->/;

export function getProjectEmoji(name: string, description?: string): string {
  if (description) {
    const metaMatch = description.match(META_TAG_REGEX);
    if (metaMatch && metaMatch[1]) {
      try {
        const meta = JSON.parse(metaMatch[1]);
        if (meta.emoji) return meta.emoji;
      } catch {}
    }
    const emojiMatch = description.match(EMOJI_TAG_REGEX);
    if (emojiMatch && emojiMatch[1]) return emojiMatch[1];
  }
  const match = name.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
  if (match) return match[0];
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

export function parseProjectMetadata(description?: string, projectName?: string): ProjectMetadata {
  const result: ProjectMetadata = {
    emoji: projectName ? getProjectEmoji(projectName, description) : '🎯',
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

  const emojiMatch = description.match(EMOJI_TAG_REGEX);
  if (emojiMatch && emojiMatch[1]) {
    result.emoji = emojiMatch[1];
  }

  return result;
}

export function serializeProjectDescription(cleanText: string, meta: ProjectMetadata): string {
  const clean = cleanText
    .replace(META_TAG_REGEX, '')
    .replace(EMOJI_TAG_REGEX, '')
    .replace(/<!--phases:(.*?)-->/, '')
    .trim();

  const metaTag = `<!--project-meta:${JSON.stringify(meta)}-->`;
  return clean ? `${clean}\n${metaTag}` : metaTag;
}

export function cleanProjectDescription(desc?: string): string {
  if (!desc) return '';
  return desc
    .replace(META_TAG_REGEX, '')
    .replace(EMOJI_TAG_REGEX, '')
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
  const [selectedEmoji, setSelectedEmoji] = useState('🎯');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [targetDate, setTargetDate] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [templateId, setTemplateId] = useState<keyof typeof PROJECT_TEMPLATES | 'blank'>('blank');
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
      const template = templateId === 'blank' ? null : PROJECT_TEMPLATES[templateId];
      const emoji = template ? template.emoji : selectedEmoji;

      const leadMember = members.find((m: any) => (m.userId || m.user?.id) === selectedLeadId);
      const leadName = leadMember?.user?.name || leadMember?.name || user?.name || 'Lead';

      const meta: ProjectMetadata = {
        emoji,
        leadId: selectedLeadId || user?.id,
        leadName,
        memberIds: selectedMemberIds.length > 0 ? selectedMemberIds : [user?.id || ''],
        priority,
        targetDate: targetDate || undefined,
        status: 'ACTIVE',
        spaceName: template ? template.spaceName : 'FlowTask Space',
      };

      const finalDescription = serializeProjectDescription(description.trim(), meta);

      const projectResult = await apiClient.createProject(workspaceId, {
        name: name.trim(),
        description: finalDescription,
        color,
      });

      if (projectResult.error || !projectResult.data?.id) {
        throw new Error(projectResult.error || 'Could not create project.');
      }

      if (template) {
        for (const item of template.tasks) {
          await apiClient.createTask({
            workspaceId,
            projectId: projectResult.data.id,
            title: item.title,
            status: item.status,
            priority: item.priority as any,
            assigneeId: selectedLeadId || user?.id,
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
      setSelectedMemberIds([]);
      setTargetDate('');
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

      const meta = parseProjectMetadata(project.description, project.name);
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
          description: 'Unassigned tasks and quick captures waiting to be triaged.',
          color: '#6366f1',
        }}
        projectTasks={inboxTasks}
        completed={inboxCompleted}
        blocked={inboxBlocked}
        state="ACTIVE"
        upcoming={inboxUpcoming}
        meta={{ emoji: '📥', spaceName: 'Inbox Space' }}
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
      {/* Workspace Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Projects & Roadmaps</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
              {projects.length}
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            Notion pages & ClickUp-powered team workflows
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

      {/* Create Project Modal (Notion + ClickUp Hybrid) */}
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
            className="w-full max-w-md max-h-[90vh] overflow-y-auto no-scrollbar rounded-t-[28px] sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-4 animate-in slide-in-from-bottom duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  <Zap className="w-3 h-3" />
                  Notion & ClickUp Workspace
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Create Project</h3>
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
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Choose template</label>
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
                  <p className="text-[10px] text-slate-400 mt-0.5">Custom database</p>
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
                      setPriority(t.priority);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      templateId === key
                        ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 dark:border-blue-500'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-sm">{t.emoji} {t.label}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{t.tasks.length} starter issues</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Emoji & Project Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Icon & Project Name</label>
              <div className="flex gap-2">
                <span className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl shrink-0 border border-slate-200 dark:border-slate-700">
                  {selectedEmoji}
                </span>
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

            {/* Project Lead Assignment */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <span>Project Lead (Owner)</span>
              </label>
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
                      {mName} ({m.role || 'MEMBER'})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Assigned Team Members Multi-Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                  <span>Assign Team Members</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {selectedMemberIds.length} assigned
                </span>
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto no-scrollbar p-1 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
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
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-[9px] font-extrabold flex items-center justify-center">
                        {mName.slice(0, 2).toUpperCase()}
                      </span>
                      <span>{mName}</span>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ClickUp Priority & Target Due Date */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Flag className="w-3 h-3 text-rose-500" />
                  <span>Priority</span>
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-slate-900 dark:text-white"
                >
                  <option value="URGENT">🔴 Urgent</option>
                  <option value="HIGH">🟠 High</option>
                  <option value="MEDIUM">🔵 Normal</option>
                  <option value="LOW">⚪ Low</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-500" />
                  <span>Target Date</span>
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-semibold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Description / Scope Brief */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Project Brief & Goals</label>
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
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Theme Color</label>
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
          placeholder="Search projects, leads, or goals..."
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full pl-9 pr-4 py-2 text-xs outline-none focus:border-blue-500 text-slate-900 dark:text-white"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
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
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
              filter === val
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Notion & ClickUp Workspace Inbox Card */}
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

      {/* Projects Gallery */}
      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-400 animate-pulse">Loading projects…</div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-10 text-center bg-white dark:bg-slate-900/60 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
          <Folder className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No projects found</p>
          <p className="text-[11px] text-slate-400">Create a project and assign it to your team.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProjects.map(({ project, projectTasks, completed, blocked, state, upcoming, meta }: any) => {
            const count = projectTasks.length;
            const progress = count ? Math.round((completed / count) * 100) : 0;
            const cleanDesc = cleanProjectDescription(project.description);

            // Find lead & member details
            const leadMember = members.find((m: any) => (m.userId || m.user?.id) === meta.leadId);
            const leadName = leadMember?.user?.name || meta.leadName || 'Lead';

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
                      {meta.emoji || '🎯'}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                          {project.name}
                        </h3>

                        {/* ClickUp Priority Flag */}
                        {meta.priority && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold inline-flex items-center gap-0.5 ${
                              meta.priority === 'URGENT'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200'
                                : meta.priority === 'HIGH'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200'
                                : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            }`}
                          >
                            <Flag className="w-2.5 h-2.5" />
                            {meta.priority}
                          </span>
                        )}
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

                {/* Team & Lead Assignment Row */}
                <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-[10px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold shrink-0">
                      <Crown className="w-2.5 h-2.5 text-amber-600" />
                      <span>{leadName}</span>
                    </span>

                    {/* Assigned Members avatars stack */}
                    {meta.memberIds && meta.memberIds.length > 0 && (
                      <div className="flex items-center -space-x-1 overflow-hidden">
                        {meta.memberIds.slice(0, 3).map((mId: string, idx: number) => {
                          const mInfo = members.find((m: any) => (m.userId || m.user?.id) === mId);
                          const initials = (mInfo?.user?.name || mInfo?.name || 'M').slice(0, 2).toUpperCase();
                          return (
                            <div
                              key={mId || idx}
                              className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-white dark:border-slate-900 text-[8px] font-extrabold flex items-center justify-center shrink-0"
                            >
                              {initials}
                            </div>
                          );
                        })}
                        {meta.memberIds.length > 3 && (
                          <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-white dark:border-slate-900 text-[8px] font-bold flex items-center justify-center shrink-0">
                            +{meta.memberIds.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {meta.spaceName && (
                    <span className="text-slate-400 font-semibold truncate max-w-[120px]">
                      {meta.spaceName}
                    </span>
                  )}
                </div>

                {/* Progress Bar & Stats */}
                <div className="mt-2.5 space-y-1.5">
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
 * NOTION + CLICKUP HYBRID PROJECT WORKSPACE
 * ========================================================================================= */
function ProjectWorkspace({
  project,
  projectTasks,
  completed,
  blocked,
  state,
  upcoming,
  meta = {},
  members = [],
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
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isClickUpSyncOpen, setIsClickUpSyncOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Collapsible Status Groups in Table View (ClickUp Style)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

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
      return apiClient.updateTask(taskId, workspaceId, { status });
    },
    onSuccess: () => {
      triggerHaptic('light');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['project-issues-summary', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
    },
  });

  const quickCreateTaskMutation = useMutation({
    mutationFn: async ({ title, status = 'TODO' }: { title: string; status?: string }) => {
      if (!workspaceId || !title.trim()) return;
      return apiClient.createTask({
        workspaceId,
        projectId: isInbox ? undefined : project.id,
        title: title.trim(),
        status,
        priority: 'MEDIUM',
        assigneeId: meta.leadId || user?.id,
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

  // Update Project Members / Lead
  const updateProjectMetaMutation = useMutation({
    mutationFn: async (newMeta: Partial<ProjectMetadata>) => {
      if (!workspaceId || isInbox) return;
      const merged: ProjectMetadata = { ...meta, ...newMeta };
      const newDesc = serializeProjectDescription(project.description || '', merged);
      return apiClient.updateProject(project.id, workspaceId, { description: newDesc });
    },
    onSuccess: () => {
      triggerHaptic('medium');
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
      setIsAssignModalOpen(false);
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
  const projectEmoji = meta.emoji || getProjectEmoji(project.name, project.description);
  const cleanDesc = cleanProjectDescription(project.description);

  // Group tasks by status for ClickUp-style table sections
  const tasksByStatus = useMemo(() => {
    const groups: Record<string, any[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };
    for (const t of filteredTasks) {
      if (t.status === 'BACKLOG' || t.status === 'TODO') {
        groups.TODO.push(t);
      } else if (t.status === 'IN_PROGRESS') {
        groups.IN_PROGRESS.push(t);
      } else if (t.status === 'IN_REVIEW') {
        groups.IN_REVIEW.push(t);
      } else if (t.status === 'DONE') {
        groups.DONE.push(t);
      } else {
        groups.TODO.push(t);
      }
    }
    return groups;
  }, [filteredTasks]);

  const leadMember = members.find((m: any) => (m.userId || m.user?.id) === meta.leadId);
  const leadName = leadMember?.user?.name || meta.leadName || 'Team Lead';

  return (
    <div className="space-y-4 pb-28 animate-in fade-in font-sans">
      {/* Top Navigation Row */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All projects</span>
        </button>

        {/* Action Pills */}
        <div className="flex items-center gap-1.5">
          {!isInbox && (
            <>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsAiModalOpen(true);
                }}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800 flex items-center gap-1 hover:bg-violet-100 transition-all active:scale-95 shadow-2xs"
              >
                <Sparkles className="w-3 h-3 text-amber-500 fill-amber-400" />
                <span>AI Planner</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsClickUpSyncOpen(true);
                }}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1 hover:bg-slate-200 transition-all active:scale-95 shadow-2xs"
              >
                <Zap className="w-3 h-3 text-violet-500" />
                <span>ClickUp</span>
              </button>
            </>
          )}
        </div>
      </div>

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
          {/* Floating Emoji Icon & Actions */}
          <div className="-mt-8 mb-2 flex items-center justify-between">
            <span className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border-4 border-white dark:border-slate-900 shadow-md flex items-center justify-center text-3xl shrink-0">
              {projectEmoji}
            </span>

            <div className="flex items-center gap-2">
              {!isInbox && (
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                  <span>Assign Team</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onOpenCreate(isInbox ? undefined : project.id)}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>{isInbox ? 'Capture task' : 'New task'}</span>
              </button>
            </div>
          </div>

          {/* Project Title & Badges */}
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

              {meta.priority && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 flex items-center gap-1">
                  <Flag className="w-2.5 h-2.5" />
                  {meta.priority}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed">
              {cleanDesc || 'Project workspace database. Manage roadmaps, deliverables, and team execution.'}
            </p>
          </div>

          {/* ClickUp + Notion Properties Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-slate-100 dark:border-slate-800 mt-4 pt-3 text-[11px]">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Lead</span>
              <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1 truncate mt-0.5">
                <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="truncate">{leadName}</span>
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Team</span>
              <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1 mt-0.5">
                <Users className="w-3 h-3 text-blue-500 shrink-0" />
                <span>{meta.memberIds?.length || 1} members</span>
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Progress</span>
              <span className="font-extrabold text-slate-900 dark:text-white mt-0.5 block">
                {completed}/{projectTasks.length} ({progress}%)
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Target Due</span>
              <span className="font-extrabold text-slate-900 dark:text-white mt-0.5 block truncate">
                {meta.targetDate ? new Date(meta.targetDate).toLocaleDateString() : 'Continuous'}
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
          {projectTasks.length} {projectTasks.length === 1 ? 'task' : 'tasks'}
        </span>
      </div>

      {/* 1. NOTION + CLICKUP HYBRID TABLE VIEW */}
      {activeView === 'TABLE' && (
        <div className="space-y-4">
          {/* Quick Filters & Search */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter tasks..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-600 dark:text-slate-300 outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
            </select>
          </div>

          {/* ClickUp Style Status Groups */}
          {[
            { key: 'TODO', label: 'TO DO', color: '#64748b', bg: 'bg-slate-100 dark:bg-slate-800' },
            { key: 'IN_PROGRESS', label: 'IN PROGRESS', color: '#2563eb', bg: 'bg-blue-50 dark:bg-blue-950/40' },
            { key: 'IN_REVIEW', label: 'IN REVIEW', color: '#d97706', bg: 'bg-amber-50 dark:bg-amber-950/40' },
            { key: 'DONE', label: 'DONE', color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
          ].map((group) => {
            const groupTasks = tasksByStatus[group.key] || [];
            const isCollapsed = Boolean(collapsedGroups[group.key]);

            return (
              <div
                key={group.key}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs"
              >
                {/* Group Header (ClickUp style) */}
                <div
                  onClick={() => {
                    triggerHaptic('light');
                    setCollapsedGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }));
                  }}
                  className="flex items-center justify-between p-2.5 bg-slate-50/70 dark:bg-slate-800/50 cursor-pointer select-none border-b border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <button type="button" className="text-slate-400">
                      {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase text-white shadow-2xs"
                      style={{ backgroundColor: group.color }}
                    >
                      {group.label}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">({groupTasks.length})</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenCreate(project.id);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-200/50 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Group Rows */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {groupTasks.map((task: any) => {
                      const isDone = task.status === 'DONE';
                      const primaryAssignee = task.assignees?.[0] || task.assignee;

                      return (
                        <div
                          key={task.id}
                          onClick={() => onSelectTask(task.id)}
                          className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                        >
                          {/* Title + Checkbox */}
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

                          {/* ClickUp Status Pill Selector */}
                          <div className="col-span-3 sm:col-span-3" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={task.status}
                              onChange={(e) => updateTaskStatusMutation.mutate({ taskId: task.id, status: e.target.value })}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md outline-none cursor-pointer border ${
                                task.status === 'DONE'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : task.status === 'IN_PROGRESS'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                                  : task.status === 'IN_REVIEW'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              <option value="TODO">To Do</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="IN_REVIEW">In Review</option>
                              <option value="DONE">Done</option>
                            </select>
                          </div>

                          {/* Priority Flag */}
                          <div className="col-span-3 sm:col-span-2">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 ${
                                task.priority === 'URGENT'
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                  : task.priority === 'HIGH'
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                                  : task.priority === 'MEDIUM'
                                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              <Flag className="w-2.5 h-2.5" />
                              {task.priority}
                            </span>
                          </div>

                          {/* Assignee Avatar */}
                          <div className="hidden sm:flex sm:col-span-2 items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                            {primaryAssignee ? (
                              <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[8px] font-extrabold flex items-center justify-center shrink-0">
                                {(primaryAssignee.name || 'U').slice(0, 2).toUpperCase()}
                              </div>
                            ) : null}
                            <span className="truncate">{primaryAssignee?.name || 'Unassigned'}</span>
                          </div>
                        </div>
                      );
                    })}

                    {groupTasks.length === 0 && (
                      <div className="p-3 text-center text-[11px] text-slate-400 font-medium">
                        No {group.label.toLowerCase()} tasks
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Signature Notion Table: Inline + Add Task Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inlineTaskInput.trim()) {
                quickCreateTaskMutation.mutate({ title: inlineTaskInput.trim() });
              }
            }}
            className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs"
          >
            <Plus className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="+ Add new task to this project... (Press Enter)"
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <FileText className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Project Specification & Team</h3>
                  <p className="text-[11px] text-slate-400">Goals, ownership, and key deliverables</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAssignModalOpen(true)}
                className="px-2.5 py-1 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400"
              >
                Edit Team
              </button>
            </div>

            {/* Scope Brief */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {cleanDesc || 'No project description added yet. Edit project properties to add a scope brief.'}
            </div>

            {/* Team Roles Section */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>Assigned Project Team</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Lead Card */}
                <div className="p-3 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="p-1.5 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                      <Crown className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">{leadName}</p>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">Project Lead</p>
                    </div>
                  </div>
                </div>

                {/* Team Members */}
                {(meta.memberIds || []).map((mId: string) => {
                  const mInfo = members.find((m: any) => (m.userId || m.user?.id) === mId);
                  const mName = mInfo?.user?.name || mInfo?.name || 'Teammate';
                  const role = mInfo?.role || 'MEMBER';

                  return (
                    <div
                      key={mId}
                      className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-black flex items-center justify-center shrink-0">
                          {mName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{mName}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{role}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Key Deliverables Status */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Key Deliverables ({projectTasks.length})
              </h4>
              <div className="space-y-1.5">
                {projectTasks.slice(0, 8).map((t: any) => (
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

      {/* Team Assignment Modal */}
      {isAssignModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAssignModalOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-t-[28px] sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Assign Project Team</h3>
                <p className="text-[11px] text-slate-500">Select project lead and team contributors</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Select Lead */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <span>Project Lead</span>
              </label>
              <select
                value={meta.leadId || user?.id}
                onChange={(e) => {
                  const newLeadId = e.target.value;
                  const newLead = members.find((m: any) => (m.userId || m.user?.id) === newLeadId);
                  updateProjectMetaMutation.mutate({
                    leadId: newLeadId,
                    leadName: newLead?.user?.name || newLead?.name || 'Lead',
                  });
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-semibold text-slate-900 dark:text-white"
              >
                {members.map((m: any) => {
                  const mId = m.userId || m.user?.id || m.id;
                  const mName = m.user?.name || m.name || 'Member';
                  return (
                    <option key={mId} value={mId}>
                      {mName}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Toggle Team Members */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>Assigned Contributors</span>
              </label>
              <div className="space-y-1 max-h-48 overflow-y-auto no-scrollbar p-1">
                {members.map((m: any) => {
                  const mId = m.userId || m.user?.id || m.id;
                  const mName = m.user?.name || m.name || 'Member';
                  const isAssigned = (meta.memberIds || []).includes(mId);

                  return (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        const nextIds = isAssigned
                          ? (meta.memberIds || []).filter((id: string) => id !== mId)
                          : [...(meta.memberIds || []), mId];
                        updateProjectMetaMutation.mutate({ memberIds: nextIds });
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all ${
                        isAssigned
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[9px] font-extrabold flex items-center justify-center">
                          {mName.slice(0, 2).toUpperCase()}
                        </div>
                        <span>{mName}</span>
                      </div>
                      {isAssigned && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-extrabold text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Global Modals for AI and ClickUp */}
      <AiProjectManagerModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />

      <ClickUpSyncModal
        isOpen={isClickUpSyncOpen}
        onClose={() => setIsClickUpSyncOpen(false)}
      />
    </div>
  );
}
