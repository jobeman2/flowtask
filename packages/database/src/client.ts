// Resilient database client wrapper supporting both PrismaClient and in-memory mock storage with JSON disk persistence
import * as fs from 'fs';
import * as path from 'path';

export enum WorkspaceRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  CLIENT = 'CLIENT',
  GUEST = 'GUEST',
}

export enum WorkspaceType {
  PERSONAL = 'PERSONAL',
  TEAM = 'TEAM',
  CLIENT_COLLABORATION = 'CLIENT_COLLABORATION',
  ENTERPRISE = 'ENTERPRISE',
}

export enum TaskStatus {
  BACKLOG = 'BACKLOG',
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export enum TaskPriority {
  URGENT = 'URGENT',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  NONE = 'NONE',
}

export enum ReminderType {
  DUE_DATE = 'DUE_DATE',
  CUSTOM = 'CUSTOM',
  RECURRING = 'RECURRING',
}

export enum ReminderStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export enum SubscriptionStatus {
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export class MockPrismaClient {
  public users = new Map<string, any>();
  public telegramAccounts = new Map<string, any>();
  public workspaces = new Map<string, any>();
  public workspaceMembers = new Map<string, any>();
  public tasks = new Map<string, any>();
  public projects = new Map<string, any>();
  public labels = new Map<string, any>();
  public taskLabels = new Map<string, any>();
  public comments = new Map<string, any>();
  public reminders = new Map<string, any>();
  public activityLogs = new Map<string, any>();
  public telegramChats = new Map<string, any>();
  public plans = new Map<string, any>();
  public subscriptions = new Map<string, any>();
  public paymentOrders = new Map<string, any>();
  public telebirrSmsLogs = new Map<string, any>();

  constructor() {
    const loaded = this.loadFromDisk();
    this.seedDefaultPlans();
    if (!loaded) {
      this.seedDemoData();
    }
    this.saveToDisk();
  }

  private seedDefaultPlans() {
    const defaultPlans = [
      {
        id: 'plan_free',
        code: 'FREE',
        name: 'Starter (Free)',
        description: 'Core task management for individuals and small chats',
        priceEtbMonth: 0,
        maxMembers: 3,
        maxProjects: 2,
        maxTasks: 25,
        maxGroups: 1,
        hasAiFeatures: false,
        hasAttachments: false,
        hasDailyDigest: false,
        hasRecurring: false,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'plan_standard',
        code: 'STANDARD',
        name: 'Standard (Team)',
        description: 'Ideal for growing teams and active Telegram group chats',
        priceEtbMonth: 10,
        maxMembers: 10,
        maxProjects: 10,
        maxTasks: 9999,
        maxGroups: 5,
        hasAiFeatures: true,
        hasAttachments: true,
        hasDailyDigest: true,
        hasRecurring: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'plan_pro',
        code: 'PRO',
        name: 'Pro Individual',
        description: 'Unlimited capacity, recurring tasks, AI task extraction and attachments',
        priceEtbMonth: 199,
        maxMembers: 10,
        maxProjects: 9999,
        maxTasks: 9999,
        maxGroups: 10,
        hasAiFeatures: true,
        hasAttachments: true,
        hasDailyDigest: true,
        hasRecurring: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'plan_team',
        code: 'TEAM',
        name: 'Team Collaboration',
        description: 'Collaborate with your team inside Telegram groups with role permissions',
        priceEtbMonth: 999,
        maxMembers: 25,
        maxProjects: 9999,
        maxTasks: 9999,
        maxGroups: 25,
        hasAiFeatures: true,
        hasAttachments: true,
        hasDailyDigest: true,
        hasRecurring: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'plan_business',
        code: 'BUSINESS',
        name: 'Business Scale',
        description: 'Unlimited capacity for companies and client teams',
        priceEtbMonth: 2999,
        maxMembers: 9999,
        maxProjects: 9999,
        maxTasks: 9999,
        maxGroups: 9999,
        hasAiFeatures: true,
        hasAttachments: true,
        hasDailyDigest: true,
        hasRecurring: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'plan_enterprise',
        code: 'ENTERPRISE',
        name: 'Enterprise',
        description: 'Dedicated SLA, custom bot branding, and external sync',
        priceEtbMonth: 2500,
        maxMembers: 9999,
        maxProjects: 9999,
        maxTasks: 9999,
        maxGroups: 9999,
        hasAiFeatures: true,
        hasAttachments: true,
        hasDailyDigest: true,
        hasRecurring: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ];

    for (const p of defaultPlans) {
      this.plans.set(p.id, p);
      this.plans.set(p.code, p);
    }
  }

  private getDbFilePath(): string {
    const candidates = [
      path.resolve(process.cwd(), 'flowtask_db.json'),
      path.resolve(process.cwd(), '../../flowtask_db.json'),
      path.resolve(__dirname, '../../flowtask_db.json'),
      path.resolve(__dirname, '../flowtask_db.json'),
    ];
    if (process.platform === 'win32') {
      candidates.push('d:\\Thrive Inc\\FLOW TASK\\flowtask_db.json');
    }
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return path.resolve(process.cwd(), 'flowtask_db.json');
  }

  public loadFromDisk(): boolean {
    try {
      const filePath = this.getDbFilePath();
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        if (raw.trim()) {
          const data = JSON.parse(raw);
          if (data.users) this.users = new Map(Object.entries(data.users));
          if (data.telegramAccounts) this.telegramAccounts = new Map(Object.entries(data.telegramAccounts));
          if (data.workspaces) this.workspaces = new Map(Object.entries(data.workspaces));
          if (data.workspaceMembers) this.workspaceMembers = new Map(Object.entries(data.workspaceMembers));
          if (data.tasks) this.tasks = new Map(Object.entries(data.tasks));
          if (data.projects) this.projects = new Map(Object.entries(data.projects));
          if (data.labels) this.labels = new Map(Object.entries(data.labels));
          if (data.taskLabels) this.taskLabels = new Map(Object.entries(data.taskLabels));
          if (data.comments) this.comments = new Map(Object.entries(data.comments));
          if (data.reminders) this.reminders = new Map(Object.entries(data.reminders));
          if (data.activityLogs) this.activityLogs = new Map(Object.entries(data.activityLogs));
          if (data.telegramChats) this.telegramChats = new Map(Object.entries(data.telegramChats));
          if (data.plans) this.plans = new Map(Object.entries(data.plans));
          if (data.subscriptions) this.subscriptions = new Map(Object.entries(data.subscriptions));
          if (data.paymentOrders) this.paymentOrders = new Map(Object.entries(data.paymentOrders));
          if (data.telebirrSmsLogs) this.telebirrSmsLogs = new Map(Object.entries(data.telebirrSmsLogs));
          return true;
        }
      }
    } catch {
      // Fallback
    }
    return false;
  }

  public saveToDisk(): void {
    try {
      const filePath = this.getDbFilePath();
      const payload = {
        users: Object.fromEntries(this.users),
        telegramAccounts: Object.fromEntries(this.telegramAccounts),
        workspaces: Object.fromEntries(this.workspaces),
        workspaceMembers: Object.fromEntries(this.workspaceMembers),
        tasks: Object.fromEntries(this.tasks),
        projects: Object.fromEntries(this.projects),
        labels: Object.fromEntries(this.labels),
        taskLabels: Object.fromEntries(this.taskLabels),
        comments: Object.fromEntries(this.comments),
        reminders: Object.fromEntries(this.reminders),
        activityLogs: Object.fromEntries(this.activityLogs),
        telegramChats: Object.fromEntries(this.telegramChats),
        plans: Object.fromEntries(this.plans),
        subscriptions: Object.fromEntries(this.subscriptions),
        paymentOrders: Object.fromEntries(this.paymentOrders),
        telebirrSmsLogs: Object.fromEntries(this.telebirrSmsLogs),
      };
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch {
      // Ignore write errors
    }
  }

  private seedDemoData() {
    const demoUser = {
      id: 'demo-user-1',
      email: 'demo@flowtask.app',
      name: 'Alex Rivera',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      timezone: 'UTC',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };
    this.users.set(demoUser.id, demoUser);

    const demoTgAccount = {
      id: 'tg-acc-1',
      telegramId: '123456789',
      username: 'alexrivera',
      firstName: 'Alex',
      lastName: 'Rivera',
      languageCode: 'en',
      isBot: false,
      userId: demoUser.id,
      authDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.telegramAccounts.set(demoTgAccount.id, demoTgAccount);

    const defaultWorkspace = {
      id: 'ws-personal-1',
      name: 'Personal Workspace',
      slug: 'personal-workspace',
      ownerId: demoUser.id,
      type: WorkspaceType.PERSONAL,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };
    this.workspaces.set(defaultWorkspace.id, defaultWorkspace);

    const teamWorkspace = {
      id: 'ws-team-1',
      name: 'Product & Growth Team',
      slug: 'product-growth-team',
      ownerId: demoUser.id,
      type: WorkspaceType.TEAM,
      createdAt: new Date('2026-01-02T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    };
    this.workspaces.set(teamWorkspace.id, teamWorkspace);

    const mem1 = {
      id: 'mem-1',
      workspaceId: defaultWorkspace.id,
      userId: demoUser.id,
      role: WorkspaceRole.OWNER,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const mem2 = {
      id: 'mem-2',
      workspaceId: teamWorkspace.id,
      userId: demoUser.id,
      role: WorkspaceRole.OWNER,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.workspaceMembers.set(mem1.id, mem1);
    this.workspaceMembers.set(mem2.id, mem2);

    const proj1 = {
      id: 'proj-1',
      workspaceId: defaultWorkspace.id,
      name: 'Product Launch 2.0',
      description: 'Q3 feature roadmap and release deliverables',
      color: '#3b82f6',
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const proj2 = {
      id: 'proj-2',
      workspaceId: defaultWorkspace.id,
      name: 'Marketing & Outreach',
      description: 'Growth campaigns and social outreach',
      color: '#ec4899',
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projects.set(proj1.id, proj1);
    this.projects.set(proj2.id, proj2);

    const lblUrgent = {
      id: 'lbl-1',
      workspaceId: defaultWorkspace.id,
      name: 'Urgent',
      color: '#ef4444',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const lblDesign = {
      id: 'lbl-2',
      workspaceId: defaultWorkspace.id,
      name: 'Design',
      color: '#8b5cf6',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const lblDev = {
      id: 'lbl-3',
      workspaceId: defaultWorkspace.id,
      name: 'Dev',
      color: '#10b981',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.labels.set(lblUrgent.id, lblUrgent);
    this.labels.set(lblDesign.id, lblDesign);
    this.labels.set(lblDev.id, lblDev);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0);
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 14, 0, 0);
    const overdue = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0);

    const sampleTasks = [
      {
        id: 'task-1',
        workspaceId: defaultWorkspace.id,
        projectId: proj1.id,
        title: 'Finalize Telegram Mini App UI specs',
        description: 'Review the high-fidelity mockups for task board and workspace switcher.',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.URGENT,
        creatorId: demoUser.id,
        assigneeId: demoUser.id,
        dueDate: today,
        isRecurring: false,
        completedAt: null,
        archivedAt: null,
        createdAt: new Date(Date.now() - 3600000 * 5),
        updatedAt: new Date(Date.now() - 3600000 * 2),
      },
      {
        id: 'task-2',
        workspaceId: defaultWorkspace.id,
        projectId: proj1.id,
        title: 'Implement database connection fallback',
        description: 'Support seamless offline mock engine and Postgres production switching.',
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        creatorId: demoUser.id,
        assigneeId: demoUser.id,
        dueDate: overdue,
        isRecurring: false,
        completedAt: new Date(),
        archivedAt: null,
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(),
      },
      {
        id: 'task-3',
        workspaceId: defaultWorkspace.id,
        projectId: proj2.id,
        title: 'Draft announcement post for Ethiopian tech community',
        description: 'Highlight Telegram-native task workflows and Telebirr/Chapa integration.',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        creatorId: demoUser.id,
        assigneeId: demoUser.id,
        dueDate: tomorrow,
        isRecurring: false,
        completedAt: null,
        archivedAt: null,
        createdAt: new Date(Date.now() - 1800000),
        updatedAt: new Date(Date.now() - 1800000),
      },
      {
        id: 'task-4',
        workspaceId: defaultWorkspace.id,
        projectId: null,
        title: 'Set up weekly progress sync reminder',
        description: 'Auto-post weekly accomplishments to team group.',
        status: TaskStatus.BACKLOG,
        priority: TaskPriority.LOW,
        creatorId: demoUser.id,
        assigneeId: demoUser.id,
        dueDate: null,
        isRecurring: true,
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO',
        completedAt: null,
        archivedAt: null,
        createdAt: new Date(Date.now() - 7200000),
        updatedAt: new Date(Date.now() - 7200000),
      },
    ];

    for (const t of sampleTasks) {
      this.tasks.set(t.id, t);
    }

    this.taskLabels.set('tl-1', { taskId: 'task-1', labelId: lblUrgent.id });
    this.taskLabels.set('tl-2', { taskId: 'task-1', labelId: lblDesign.id });
    this.taskLabels.set('tl-3', { taskId: 'task-2', labelId: lblDev.id });

    const comment1 = {
      id: 'comm-1',
      taskId: 'task-1',
      authorId: demoUser.id,
      content: 'Initial UI components are verified in Telegram WebApp wrapper.',
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(Date.now() - 3600000),
    };
    this.comments.set(comment1.id, comment1);
  }

  private resolveTaskRelations(task: any, include?: any) {
    if (!task) return null;
    const res = { ...task };

    if (include?.creator) {
      const u = this.users.get(task.creatorId);
      res.creator = u ? { id: u.id, name: u.name, avatarUrl: u.avatarUrl } : null;
    }
    if (include?.assignee) {
      const u = task.assigneeId ? this.users.get(task.assigneeId) : null;
      res.assignee = u ? { id: u.id, name: u.name, avatarUrl: u.avatarUrl } : null;
    }
    if (include?.project) {
      res.project = task.projectId ? this.projects.get(task.projectId) || null : null;
    }
    if (include?.labels) {
      const mappings = Array.from(this.taskLabels.values()).filter((tl: any) => tl.taskId === task.id);
      res.labels = mappings.map((tl: any) => ({
        taskId: tl.taskId,
        labelId: tl.labelId,
        label: this.labels.get(tl.labelId) || { id: tl.labelId, name: 'Tag', color: '#6366f1' },
      }));
    }
    if (include?.comments) {
      const taskComments = Array.from(this.comments.values())
        .filter((c: any) => c.taskId === task.id)
        .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      res.comments = taskComments.map((c: any) => ({
        ...c,
        author: this.users.get(c.authorId) || { id: c.authorId, name: 'User' },
      }));
    }
    if (include?.reminders) {
      res.reminders = Array.from(this.reminders.values()).filter((r: any) => r.taskId === task.id);
    }
    if (include?._count) {
      res._count = {
        comments: Array.from(this.comments.values()).filter((c: any) => c.taskId === task.id).length,
        reminders: Array.from(this.reminders.values()).filter((r: any) => r.taskId === task.id).length,
      };
    }
    return res;
  }

  user = {
    findUnique: async ({ where, include }: any) => {
      this.loadFromDisk();
      let u: any = null;
      if (where?.id) u = this.users.get(where.id) || null;
      else if (where?.email) u = Array.from(this.users.values()).find((user: any) => user.email === where.email) || null;
      if (!u) return null;
      const res: any = { ...u };
      if (include?.telegramAccounts) {
        res.telegramAccounts = Array.from(this.telegramAccounts.values()).filter((t: any) => t.userId === u.id);
      }
      if (include?.workspaceMembers) {
        res.workspaceMembers = Array.from(this.workspaceMembers.values()).filter((m: any) => m.userId === u.id);
      }
      return res;
    },
    findFirst: async ({ where, include }: any = {}) => {
      this.loadFromDisk();
      let u: any = null;
      if (where?.id) u = this.users.get(where.id) || null;
      else if (where?.email) u = Array.from(this.users.values()).find((user: any) => user.email === where.email) || null;
      else u = Array.from(this.users.values())[0] || null;
      if (!u) return null;
      const res: any = { ...u };
      if (include?.telegramAccounts) {
        res.telegramAccounts = Array.from(this.telegramAccounts.values()).filter((t: any) => t.userId === u.id);
      }
      if (include?.workspaceMembers) {
        res.workspaceMembers = Array.from(this.workspaceMembers.values()).filter((m: any) => m.userId === u.id);
      }
      return res;
    },
    findUniqueOrThrow: async (params: any) => (await this.user.findUnique(params)) || { id: 'demo-user-1', name: 'Alex Rivera' },
    findMany: async () => {
      this.loadFromDisk();
      return Array.from(this.users.values());
    },
    create: async ({ data }: any) => {
      this.loadFromDisk();
      const id = data.id || `user_${Date.now()}`;
      const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
      this.users.set(id, record);
      this.saveToDisk();
      return record;
    },
    update: async ({ where, data }: any) => {
      this.loadFromDisk();
      const user = this.users.get(where.id);
      if (user) {
        Object.assign(user, data, { updatedAt: new Date() });
        this.saveToDisk();
      }
      return user;
    },
  };

  telegramAccount = {
    findUnique: async ({ where, include }: any) => {
      this.loadFromDisk();
      let acc: any = null;
      if (where?.telegramId) {
        acc = Array.from(this.telegramAccounts.values()).find((a: any) => a.telegramId === where.telegramId) || null;
      } else if (where?.username) {
        const clean = where.username.replace(/^@/, '').toLowerCase();
        const matching = Array.from(this.telegramAccounts.values()).filter((a: any) => a.username?.toLowerCase() === clean);
        acc = matching.find((a: any) => a.telegramId && /^\d+$/.test(a.telegramId)) || matching[0] || null;
      } else if (where?.id) {
        acc = this.telegramAccounts.get(where.id) || null;
      }
      if (!acc) return null;
      if (include?.user || true) {
        const user = this.users.get(acc.userId);
        const members = Array.from(this.workspaceMembers.values()).filter((m: any) => m.userId === acc.userId);
        return {
          ...acc,
          user: {
            ...user,
            workspaceMembers: members.map((m: any) => ({
              ...m,
              workspace: this.workspaces.get(m.workspaceId) || { id: m.workspaceId, name: 'Workspace', type: WorkspaceType.PERSONAL },
            })),
          },
        };
      }
      return acc;
    },
    findFirst: async ({ where, include }: any = {}) => {
      this.loadFromDisk();
      let acc: any = null;
      if (where?.telegramId) {
        acc = Array.from(this.telegramAccounts.values()).find((a: any) => a.telegramId === where.telegramId) || null;
      } else if (where?.username) {
        const rawUsername = typeof where.username === 'string' ? where.username : (where.username?.equals || '');
        const clean = rawUsername.replace(/^@/, '').toLowerCase();
        const matching = Array.from(this.telegramAccounts.values()).filter((a: any) => a.username?.toLowerCase() === clean);
        // Prioritize accounts with real numeric telegramId (e.g. 6854918950) over placeholder strings (tg_...)
        acc = matching.find((a: any) => a.telegramId && /^\d+$/.test(a.telegramId)) || matching[0] || null;
      } else if (where?.userId) {
        const matching = Array.from(this.telegramAccounts.values()).filter((a: any) => a.userId === where.userId);
        acc = matching.find((a: any) => a.telegramId && /^\d+$/.test(a.telegramId)) || matching[0] || null;
      }
      if (!acc) return null;
      if (include?.user) {
        const user = this.users.get(acc.userId);
        const members = Array.from(this.workspaceMembers.values()).filter((m: any) => m.userId === acc.userId);
        return {
          ...acc,
          user: {
            ...user,
            workspaceMembers: members.map((m: any) => ({
              ...m,
              workspace: this.workspaces.get(m.workspaceId) || { id: m.workspaceId, name: 'Workspace', type: WorkspaceType.PERSONAL },
            })),
          },
        };
      }
      return acc;
    },
    create: async ({ data }: any) => {
      this.loadFromDisk();
      const id = data.id || `tg_${Date.now()}`;
      const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
      this.telegramAccounts.set(id, record);
      this.saveToDisk();
      return record;
    },
    update: async ({ where, data }: any) => {
      this.loadFromDisk();
      const acc = this.telegramAccounts.get(where.id);
      if (acc) {
        Object.assign(acc, data, { updatedAt: new Date() });
        this.saveToDisk();
      }
      return acc;
    },
  };

  consolidateUserAccounts(realUserId: string, realTelegramId: string, username?: string | null) {
    this.loadFromDisk();
    if (!username && !realTelegramId) return;
    const cleanUsername = username ? username.replace(/^@/, '').toLowerCase() : null;

    // Find all placeholder telegram accounts matching this username or with invalid telegramId
    const placeholders = Array.from(this.telegramAccounts.values()).filter((a: any) => {
      if (a.userId === realUserId) return false;
      const isPlaceholderTg = !a.telegramId || a.telegramId.startsWith('tg_') || !/^\d+$/.test(a.telegramId);
      const matchesUser = cleanUsername && a.username?.toLowerCase() === cleanUsername;
      return isPlaceholderTg && matchesUser;
    });

    for (const ph of placeholders) {
      const oldUserId = ph.userId;
      // 1. Move tasks assigned or created by placeholder user to real user
      for (const [taskId, task] of this.tasks.entries()) {
        let changed = false;
        if (task.assigneeId === oldUserId) {
          task.assigneeId = realUserId;
          changed = true;
        }
        if (task.creatorId === oldUserId) {
          task.creatorId = realUserId;
          changed = true;
        }
        if (changed) {
          this.tasks.set(taskId, task);
        }
      }

      // 2. Move workspace memberships
      for (const [memId, mem] of this.workspaceMembers.entries()) {
        if (mem.userId === oldUserId) {
          // Check if real user already a member of this workspace
          const already = Array.from(this.workspaceMembers.values()).find(
            (m: any) => m.workspaceId === mem.workspaceId && m.userId === realUserId
          );
          if (!already) {
            mem.userId = realUserId;
            this.workspaceMembers.set(memId, mem);
          } else {
            this.workspaceMembers.delete(memId);
          }
        }
      }

      // 3. Remove placeholder telegram account
      this.telegramAccounts.delete(ph.id);
      if (oldUserId && oldUserId !== realUserId) {
        this.users.delete(oldUserId);
      }
    }

    this.saveToDisk();
  }

  workspace = {
    create: async ({ data }: any) => {
      this.loadFromDisk();
      const id = data.id || `ws_${Date.now()}`;
      const record = { id, slug: data.slug || `ws-${Date.now()}`, type: data.type || WorkspaceType.PERSONAL, createdAt: new Date(), updatedAt: new Date(), ...data };
      this.workspaces.set(id, record);
      if (data.members?.create) {
        const mId = `mem_${Date.now()}`;
        this.workspaceMembers.set(mId, {
          id: mId,
          workspaceId: id,
          userId: data.members.create.userId,
          role: data.members.create.role || WorkspaceRole.OWNER,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      this.saveToDisk();
      return record;
    },
    findUnique: async ({ where, include }: any) => {
      this.loadFromDisk();
      const ws = (where?.id ? this.workspaces.get(where.id) : Array.from(this.workspaces.values()).find((w: any) => w.slug === where?.slug)) || null;
      if (!ws) return null;
      const res: any = { ...ws };
      if (include?.members) {
        let mems = Array.from(this.workspaceMembers.values()).filter((m: any) => m.workspaceId === ws.id);
        if (include.members.where?.userId) {
          mems = mems.filter((m: any) => m.userId === include.members.where.userId);
        }
        res.members = mems;
      }
      return res;
    },
    findFirst: async ({ where, include }: any = {}) => {
      this.loadFromDisk();
      let ws: any = null;
      if (where?.id) ws = this.workspaces.get(where.id) || null;
      else if (where?.slug) ws = Array.from(this.workspaces.values()).find((w: any) => w.slug === where.slug) || null;
      else ws = Array.from(this.workspaces.values())[0] || null;
      if (!ws) return null;
      const res: any = { ...ws };
      if (include?.members) {
        let mems = Array.from(this.workspaceMembers.values()).filter((m: any) => m.workspaceId === ws.id);
        if (include.members.where?.userId) {
          mems = mems.filter((m: any) => m.userId === include.members.where.userId);
        }
        res.members = mems;
      }
      return res;
    },
    findMany: async ({ where }: any = {}) => {
      this.loadFromDisk();
      let list = Array.from(this.workspaces.values());
      if (where?.members?.some?.userId) {
        const wsIds = Array.from(this.workspaceMembers.values())
          .filter((m: any) => m.userId === where.members.some.userId)
          .map((m: any) => m.workspaceId);
        list = list.filter((ws: any) => wsIds.includes(ws.id));
      }
      if (where?.ownerId) {
        list = list.filter((ws: any) => ws.ownerId === where.ownerId);
      }
      return list;
    },
    update: async ({ where, data }: any) => {
      this.loadFromDisk();
      const ws = this.workspaces.get(where.id);
      if (ws) {
        Object.assign(ws, data, { updatedAt: new Date() });
        this.saveToDisk();
      }
      return ws;
    },
  };

  workspaceMember = {
    findMany: async ({ where, include }: any = {}) => {
      this.loadFromDisk();
      let list = Array.from(this.workspaceMembers.values());
      if (where?.userId) list = list.filter((m: any) => m.userId === where.userId);
      if (where?.workspaceId) list = list.filter((m: any) => m.workspaceId === where.workspaceId);
      if (where?.role) list = list.filter((m: any) => m.role === where.role);

      return list.map((m: any) => {
        const ws = this.workspaces.get(m.workspaceId) || { id: m.workspaceId, name: 'Workspace', type: WorkspaceType.PERSONAL };
        const taskCount = Array.from(this.tasks.values()).filter((t: any) => t.workspaceId === m.workspaceId && !t.archivedAt).length;
        const memberCount = Array.from(this.workspaceMembers.values()).filter((wm: any) => wm.workspaceId === m.workspaceId).length;
        const projCount = Array.from(this.projects.values()).filter((p: any) => p.workspaceId === m.workspaceId && !p.isArchived).length;
        const userObj = this.users.get(m.userId) || { id: m.userId, name: 'Team Member' };
        const tgAccount = Array.from(this.telegramAccounts.values()).find((tg: any) => tg.userId === m.userId);

        const res: any = {
          ...m,
          workspace: {
            ...ws,
            _count: { members: memberCount, tasks: taskCount, projects: projCount },
          },
        };

        if (include?.user) {
          res.user = {
            ...userObj,
            telegramAccounts: tgAccount ? [tgAccount] : [],
          };
        }
        return res;
      });
    },
    findUnique: async ({ where, include }: any) => {
      this.loadFromDisk();
      let mem: any = null;
      if (where?.id) {
        mem = this.workspaceMembers.get(where.id) || null;
      } else if (where?.workspaceId_userId) {
        mem = Array.from(this.workspaceMembers.values()).find(
          (m: any) =>
            m.workspaceId === where.workspaceId_userId.workspaceId &&
            m.userId === where.workspaceId_userId.userId
        ) || null;
      }
      if (!mem) return null;
      const res: any = { ...mem };
      if (include?.user) {
        const userObj = this.users.get(mem.userId) || { id: mem.userId, name: 'Team Member' };
        const tgAccount = Array.from(this.telegramAccounts.values()).find((tg: any) => tg.userId === mem.userId);
        res.user = {
          ...userObj,
          telegramAccounts: tgAccount ? [tgAccount] : [],
        };
      }
      if (include?.workspace) {
        res.workspace = this.workspaces.get(mem.workspaceId) || null;
      }
      return res;
    },
    findFirst: async ({ where, include }: any = {}) => {
      this.loadFromDisk();
      const mem = Array.from(this.workspaceMembers.values()).find((m: any) => {
        if (where?.workspaceId && m.workspaceId !== where.workspaceId) return false;
        if (where?.userId && m.userId !== where.userId) return false;
        return true;
      }) || null;
      if (!mem) return null;
      const res: any = { ...mem };
      if (include?.user) {
        const userObj = this.users.get(mem.userId) || { id: mem.userId, name: 'Team Member' };
        const tgAccount = Array.from(this.telegramAccounts.values()).find((tg: any) => tg.userId === mem.userId);
        res.user = {
          ...userObj,
          telegramAccounts: tgAccount ? [tgAccount] : [],
        };
      }
      if (include?.workspace) {
        res.workspace = this.workspaces.get(mem.workspaceId) || null;
      }
      return res;
    },
    create: async ({ data, include }: any) => {
      this.loadFromDisk();
      const id = data.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
      this.workspaceMembers.set(id, record);
      this.saveToDisk();
      const res: any = { ...record };
      if (include?.user) {
        const userObj = this.users.get(data.userId) || { id: data.userId, name: 'Team Member' };
        const tgAccount = Array.from(this.telegramAccounts.values()).find((tg: any) => tg.userId === data.userId);
        res.user = {
          ...userObj,
          telegramAccounts: tgAccount ? [tgAccount] : [],
        };
      }
      return res;
    },
    delete: async ({ where }: any) => {
      this.loadFromDisk();
      let targetId = where?.id;
      if (!targetId && where?.workspaceId_userId) {
        const mem = Array.from(this.workspaceMembers.values()).find(
          (m: any) =>
            m.workspaceId === where.workspaceId_userId.workspaceId &&
            m.userId === where.workspaceId_userId.userId
        );
        targetId = mem?.id;
      }
      if (targetId) {
        const mem = this.workspaceMembers.get(targetId);
        this.workspaceMembers.delete(targetId);
        this.saveToDisk();
        return mem || { id: targetId };
      }
      return { id: 'deleted' };
    },
  };

  task = {
    create: async ({ data, include }: any) => {
      this.loadFromDisk();
      const id = data.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const { labels, ...directFields } = data;
      const record = {
        id,
        status: directFields.status || TaskStatus.TODO,
        priority: directFields.priority || TaskPriority.MEDIUM,
        dueDate: directFields.dueDate ? new Date(directFields.dueDate) : null,
        isRecurring: directFields.isRecurring || false,
        recurrenceRule: directFields.recurrenceRule || null,
        completedAt: directFields.status === TaskStatus.DONE ? new Date() : null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...directFields,
      };
      this.tasks.set(id, record);

      if (labels?.create && Array.isArray(labels.create)) {
        for (const l of labels.create) {
          const tlId = `tl_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
          this.taskLabels.set(tlId, { taskId: id, labelId: l.labelId });
        }
      }

      this.saveToDisk();
      return this.resolveTaskRelations(record, include);
    },
    findMany: async ({ where, include, orderBy, take, skip }: any = {}) => {
      this.loadFromDisk();
      let items = Array.from(this.tasks.values());

      if (where?.workspaceId) items = items.filter((t: any) => t.workspaceId === where.workspaceId);
      if (where?.projectId !== undefined) items = items.filter((t: any) => t.projectId === where.projectId);
      if (where?.assigneeId) items = items.filter((t: any) => t.assigneeId === where.assigneeId);
      if (where?.creatorId) items = items.filter((t: any) => t.creatorId === where.creatorId);

      if (where?.archivedAt === null) {
        items = items.filter((t: any) => !t.archivedAt);
      } else if (where?.archivedAt !== undefined) {
        items = items.filter((t: any) => Boolean(t.archivedAt) === Boolean(where.archivedAt));
      }

      if (where?.status) {
        if (typeof where.status === 'string') items = items.filter((t: any) => t.status === where.status);
        if (where.status.in) items = items.filter((t: any) => where.status.in.includes(t.status));
        if (where.status.not) items = items.filter((t: any) => t.status !== where.status.not);
      }

      if (where?.priority) {
        if (typeof where.priority === 'string') items = items.filter((t: any) => t.priority === where.priority);
        if (where.priority.in) items = items.filter((t: any) => where.priority.in.includes(t.priority));
      }

      if (where?.dueDate) {
        if (where.dueDate.gte) items = items.filter((t: any) => t.dueDate && new Date(t.dueDate) >= new Date(where.dueDate.gte));
        if (where.dueDate.lte) items = items.filter((t: any) => t.dueDate && new Date(t.dueDate) <= new Date(where.dueDate.lte));
        if (where.dueDate.lt) items = items.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date(where.dueDate.lt));
        if (where.dueDate.gt) items = items.filter((t: any) => t.dueDate && new Date(t.dueDate) > new Date(where.dueDate.gt));
        if (where.dueDate.not === null) items = items.filter((t: any) => t.dueDate !== null);
      }

      if (where?.OR && Array.isArray(where.OR)) {
        items = items.filter((t: any) => {
          return where.OR.some((cond: any) => {
            if (cond.title?.contains) {
              return t.title?.toLowerCase().includes(cond.title.contains.toLowerCase());
            }
            if (cond.description?.contains) {
              return t.description?.toLowerCase().includes(cond.description.contains.toLowerCase());
            }
            return false;
          });
        });
      }

      // Ordering
      if (orderBy) {
        const orderKey = Object.keys(orderBy)[0] || 'createdAt';
        const direction = orderBy[orderKey] === 'asc' ? 1 : -1;
        items.sort((a: any, b: any) => {
          const valA = a[orderKey] ? new Date(a[orderKey]).getTime() || a[orderKey] : 0;
          const valB = b[orderKey] ? new Date(b[orderKey]).getTime() || b[orderKey] : 0;
          if (valA > valB) return direction;
          if (valA < valB) return -direction;
          return 0;
        });
      } else {
        items.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      if (skip) items = items.slice(skip);
      if (take) items = items.slice(0, take);

      return items.map((t: any) => this.resolveTaskRelations(t, include));
    },
    findFirst: async ({ where, include }: any = {}) => {
      this.loadFromDisk();
      const items = await this.task.findMany({ where, include });
      return items[0] || null;
    },
    findUnique: async ({ where, include }: any = {}) => {
      this.loadFromDisk();
      if (where?.id) {
        const task = this.tasks.get(where.id);
        return task ? this.resolveTaskRelations(task, include) : null;
      }
      return null;
    },
    count: async ({ where }: any = {}) => {
      this.loadFromDisk();
      const items = await this.task.findMany({ where });
      return items.length;
    },
    update: async ({ where, data, include }: any) => {
      this.loadFromDisk();
      const task = this.tasks.get(where.id);
      if (task) {
        Object.assign(task, data, { updatedAt: new Date() });
        this.saveToDisk();
      }
      return task ? this.resolveTaskRelations(task, include) : null;
    },
    delete: async ({ where }: any) => {
      this.loadFromDisk();
      const task = this.tasks.get(where.id);
      this.tasks.delete(where.id);
      this.saveToDisk();
      return task || { deleted: true };
    },
  };

  project = {
    findMany: async ({ where, include }: any = {}) => {
      this.loadFromDisk();
      let list = Array.from(this.projects.values());
      if (where?.workspaceId) list = list.filter((p: any) => p.workspaceId === where.workspaceId);
      if (where?.isArchived !== undefined) list = list.filter((p: any) => p.isArchived === where.isArchived);

      if (include?._count) {
        return list.map((p: any) => ({
          ...p,
          _count: {
            tasks: Array.from(this.tasks.values()).filter((t: any) => t.projectId === p.id && !t.archivedAt).length,
          },
        }));
      }
      return list;
    },
    findFirst: async ({ where, include }: any = {}) => {
      this.loadFromDisk();
      const list = await this.project.findMany({ where, include });
      return list[0] || null;
    },
    findUnique: async ({ where }: any = {}) => {
      this.loadFromDisk();
      return this.projects.get(where.id) || null;
    },
    create: async ({ data }: any) => {
      this.loadFromDisk();
      const id = data.id || `proj_${Date.now()}`;
      const record = { id, isArchived: false, createdAt: new Date(), updatedAt: new Date(), ...data };
      this.projects.set(id, record);
      this.saveToDisk();
      return record;
    },
    update: async ({ where, data }: any) => {
      this.loadFromDisk();
      const proj = this.projects.get(where.id);
      if (proj) {
        Object.assign(proj, data, { updatedAt: new Date() });
        this.saveToDisk();
      }
      return proj;
    },
    delete: async ({ where }: any) => {
      this.loadFromDisk();
      const proj = this.projects.get(where.id);
      this.projects.delete(where.id);
      this.saveToDisk();
      return proj || { deleted: true };
    },
  };

  label = {
    findMany: async ({ where }: any = {}) => {
      this.loadFromDisk();
      let list = Array.from(this.labels.values());
      if (where?.workspaceId) list = list.filter((l: any) => l.workspaceId === where.workspaceId);
      return list;
    },
    findUnique: async ({ where }: any = {}) => {
      this.loadFromDisk();
      return this.labels.get(where.id) || null;
    },
    findFirst: async ({ where }: any = {}) => {
      this.loadFromDisk();
      if (where?.name && where?.workspaceId) {
        return Array.from(this.labels.values()).find((l: any) => l.workspaceId === where.workspaceId && l.name.toLowerCase() === where.name.toLowerCase()) || null;
      }
      if (where?.id) return this.labels.get(where.id) || null;
      return null;
    },
    create: async ({ data }: any) => {
      this.loadFromDisk();
      const id = data.id || `lbl_${Date.now()}`;
      const record = { id, color: data.color || '#6366f1', createdAt: new Date(), updatedAt: new Date(), ...data };
      this.labels.set(id, record);
      this.saveToDisk();
      return record;
    },
    update: async ({ where, data }: any) => {
      this.loadFromDisk();
      const lbl = this.labels.get(where.id);
      if (lbl) {
        Object.assign(lbl, data, { updatedAt: new Date() });
        this.saveToDisk();
      }
      return lbl;
    },
    delete: async ({ where }: any) => {
      this.loadFromDisk();
      const lbl = this.labels.get(where.id);
      this.labels.delete(where.id);
      this.saveToDisk();
      return lbl || { deleted: true };
    },
  };

  taskLabel = {
    findMany: async ({ where }: any = {}) => {
      this.loadFromDisk();
      let list = Array.from(this.taskLabels.values());
      if (where?.taskId) list = list.filter((tl: any) => tl.taskId === where.taskId);
      if (where?.labelId) list = list.filter((tl: any) => tl.labelId === where.labelId);
      return list;
    },
    create: async ({ data }: any) => {
      this.loadFromDisk();
      const id = `tl_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
      this.taskLabels.set(id, data);
      this.saveToDisk();
      return data;
    },
    createMany: async ({ data }: any) => {
      this.loadFromDisk();
      if (Array.isArray(data)) {
        for (const item of data) {
          const id = `tl_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
          this.taskLabels.set(id, item);
        }
        this.saveToDisk();
      }
      return { count: data?.length || 0 };
    },
    deleteMany: async ({ where }: any = {}) => {
      this.loadFromDisk();
      let count = 0;
      for (const [key, val] of Array.from(this.taskLabels.entries())) {
        if (where?.taskId && val.taskId === where.taskId) {
          this.taskLabels.delete(key);
          count++;
        } else if (where?.labelId && val.labelId === where.labelId) {
          this.taskLabels.delete(key);
          count++;
        }
      }
      this.saveToDisk();
      return { count };
    },
  };

  comment = {
    findMany: async ({ where, include, orderBy }: any = {}) => {
      this.loadFromDisk();
      let list = Array.from(this.comments.values());
      if (where?.taskId) list = list.filter((c: any) => c.taskId === where.taskId);

      if (orderBy?.createdAt === 'asc') {
        list.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      } else {
        list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      if (include?.author) {
        list = list.map((c: any) => ({
          ...c,
          author: this.users.get(c.authorId) || { id: c.authorId, name: 'User' },
        }));
      }
      return list;
    },
    create: async ({ data, include }: any) => {
      this.loadFromDisk();
      const id = data.id || `comm_${Date.now()}`;
      const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
      this.comments.set(id, record);
      this.saveToDisk();
      if (include?.author) {
        return {
          ...record,
          author: this.users.get(record.authorId) || { id: record.authorId, name: 'User' },
        };
      }
      return record;
    },
    delete: async ({ where }: any) => {
      this.loadFromDisk();
      const c = this.comments.get(where.id);
      this.comments.delete(where.id);
      this.saveToDisk();
      return c || { deleted: true };
    },
  };

  reminder = {
    create: async ({ data }: any) => {
      this.loadFromDisk();
      const id = data.id || `rem_${Date.now()}`;
      const record = { id, status: ReminderStatus.PENDING, snoozeCount: 0, createdAt: new Date(), updatedAt: new Date(), ...data };
      this.reminders.set(id, record);
      this.saveToDisk();
      return record;
    },
    findMany: async ({ where, include }: any = {}) => {
      this.loadFromDisk();
      let list = Array.from(this.reminders.values());
      if (where?.taskId) list = list.filter((r: any) => r.taskId === where.taskId);
      if (where?.status) list = list.filter((r: any) => r.status === where.status);
      if (where?.remindAt?.lte) list = list.filter((r: any) => new Date(r.remindAt) <= new Date(where.remindAt.lte));
      if (include?.task) {
        list = list.map((r: any) => ({
          ...r,
          task: this.tasks.get(r.taskId) || null,
        }));
      }
      return list;
    },
    update: async ({ where, data }: any) => {
      this.loadFromDisk();
      const rem = this.reminders.get(where.id);
      if (rem) {
        Object.assign(rem, data, { updatedAt: new Date() });
        this.saveToDisk();
      }
      return rem;
    },
    delete: async ({ where }: any) => {
      this.loadFromDisk();
      const rem = this.reminders.get(where.id);
      this.reminders.delete(where.id);
      this.saveToDisk();
      return rem || { deleted: true };
    },
  };

  activityLog = {
    create: async ({ data }: any) => {
      this.loadFromDisk();
      const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const record = { id, createdAt: new Date(), ...data };
      this.activityLogs.set(id, record);
      this.saveToDisk();
      return record;
    },
    findMany: async ({ where, include }: any = {}) => {
      this.loadFromDisk();
      let list = Array.from(this.activityLogs.values());
      if (where?.workspaceId) list = list.filter((a: any) => a.workspaceId === where.workspaceId);
      if (where?.entityId) list = list.filter((a: any) => a.entityId === where.entityId);
      list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (include?.actor) {
        list = list.map((a: any) => ({
          ...a,
          actor: a.actorId ? this.users.get(a.actorId) || { id: a.actorId, name: 'User' } : null,
        }));
      }
      return list;
    },
  };

  telegramChat = {
    findUnique: async ({ where }: any) => {
      this.loadFromDisk();
      if (where?.chatId) return Array.from(this.telegramChats.values()).find((c: any) => c.chatId === where.chatId) || null;
      if (where?.id) return this.telegramChats.get(where.id) || null;
      return null;
    },
    findFirst: async ({ where }: any = {}) => {
      this.loadFromDisk();
      if (where?.chatId) return Array.from(this.telegramChats.values()).find((c: any) => c.chatId === where.chatId) || null;
      if (where?.workspaceId) return Array.from(this.telegramChats.values()).find((c: any) => c.workspaceId === where.workspaceId) || null;
      if (where?.id) return this.telegramChats.get(where.id) || null;
      return null;
    },
    findMany: async ({ where, include }: any = {}) => {
      this.loadFromDisk();
      let list = Array.from(this.telegramChats.values());
      if (where?.workspaceId) {
        if (typeof where.workspaceId === 'string') {
          list = list.filter((c: any) => c.workspaceId === where.workspaceId);
        } else if (where.workspaceId.in && Array.isArray(where.workspaceId.in)) {
          list = list.filter((c: any) => where.workspaceId.in.includes(c.workspaceId));
        } else if (where.workspaceId.notIn && Array.isArray(where.workspaceId.notIn)) {
          list = list.filter((c: any) => !where.workspaceId.notIn.includes(c.workspaceId));
        }
      }
      if (where?.chatId) {
        list = list.filter((c: any) => c.chatId === where.chatId);
      }
      if (include?.workspace) {
        list = list.map((c: any) => {
          const ws = this.workspaces.get(c.workspaceId);
          if (!ws) return c;
          const memberCount = Array.from(this.workspaceMembers.values()).filter((m: any) => m.workspaceId === ws.id).length;
          const taskCount = Array.from(this.tasks.values()).filter((t: any) => t.workspaceId === ws.id).length;
          const projectCount = Array.from(this.projects.values()).filter((p: any) => p.workspaceId === ws.id).length;
          return {
            ...c,
            workspace: {
              ...ws,
              _count: { members: memberCount, tasks: taskCount, projects: projectCount },
            },
          };
        });
      }
      return list;
    },
    create: async ({ data }: any) => {
      this.loadFromDisk();
      const id = data.id || `chat_${Date.now()}`;
      const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
      this.telegramChats.set(id, record);
      this.saveToDisk();
      return record;
    },
    update: async ({ where, data }: any) => {
      this.loadFromDisk();
      const chat = this.telegramChats.get(where.id);
      if (chat) {
        Object.assign(chat, data, { updatedAt: new Date() });
        this.saveToDisk();
      }
      return chat;
    },
  };

  plan = {
    upsert: async ({ create }: any) => create,
    findMany: async () => {
      this.loadFromDisk();
      return Array.from(this.plans.values());
    },
    findUnique: async ({ where }: any) => {
      this.loadFromDisk();
      return Array.from(this.plans.values()).find((p: any) => 
        (where?.code && p.code?.toUpperCase() === where.code?.toUpperCase()) ||
        (where?.id && (p.id === where.id || p.code?.toLowerCase() === where.id?.replace(/^plan_/, '').toLowerCase()))
      ) || null;
    },
  };

  public getPlanByIdOrCode(planIdOrCode: string) {
    if (!planIdOrCode) return null;
    const search = planIdOrCode.toLowerCase();
    const cleanSearch = search.replace(/^plan_/, '');
    return (
      Array.from(this.plans.values()).find((p: any) => {
        const pId = (p.id || '').toLowerCase();
        const pCode = (p.code || '').toLowerCase();
        return (
          pId === search ||
          pCode === search ||
          pCode === cleanSearch ||
          pId === `plan_${cleanSearch}`
        );
      }) || null
    );
  }

  subscription = {
    findUnique: async ({ where, include }: any) => {
      this.loadFromDisk();
      let sub = Array.from(this.subscriptions.values()).find((s: any) => 
        (where?.workspaceId && s.workspaceId === where.workspaceId) ||
        (where?.userId && s.userId === where.userId) ||
        (where?.id && s.id === where.id)
      ) || null;
      if (sub && include?.plan) {
        sub = { ...sub, plan: this.getPlanByIdOrCode(sub.planId) };
      }
      return sub;
    },
    findFirst: async ({ where, include, orderBy }: any = {}) => {
      this.loadFromDisk();
      let list = Array.from(this.subscriptions.values());

      // If where.OR is passed (e.g. [{ userId }, { workspaceId: { in: [...] } }])
      if (where?.OR && Array.isArray(where.OR)) {
        list = list.filter((s: any) => {
          return where.OR.some((cond: any) => {
            if (cond.userId && s.userId === cond.userId) return true;
            if (cond.workspaceId && typeof cond.workspaceId === 'string' && s.workspaceId === cond.workspaceId) return true;
            if (cond.workspaceId?.in && Array.isArray(cond.workspaceId.in) && cond.workspaceId.in.includes(s.workspaceId)) return true;
            return false;
          });
        });
      }

      if (where?.userId) {
        list = list.filter((s: any) => {
          if (s.userId === where.userId) return true;
          // Check if workspace is owned by this user
          const ws = this.workspaces.get(s.workspaceId);
          return ws && ws.ownerId === where.userId;
        });
      }

      if (where?.workspaceId) {
        if (typeof where.workspaceId === 'string') {
          list = list.filter((s: any) => s.workspaceId === where.workspaceId);
        } else if (where.workspaceId.in && Array.isArray(where.workspaceId.in)) {
          list = list.filter((s: any) => where.workspaceId.in.includes(s.workspaceId));
        }
      }

      if (where?.status) {
        list = list.filter((s: any) => s.status === where.status);
      }

      if (where?.plan?.code?.not) {
        list = list.filter((s: any) => {
          const planObj = this.getPlanByIdOrCode(s.planId);
          return planObj && planObj.code !== where.plan.code.not;
        });
      }

      // Sort by currentPeriodEnd desc if requested
      if (orderBy?.currentPeriodEnd === 'desc') {
        list = list.sort((a: any, b: any) => new Date(b.currentPeriodEnd || 0).getTime() - new Date(a.currentPeriodEnd || 0).getTime());
      }

      let sub = list[0] || null;
      if (sub && include?.plan) {
        sub = { ...sub, plan: this.getPlanByIdOrCode(sub.planId) };
      }
      return sub;
    },
    findMany: async ({ where, include }: any = {}) => {
      this.loadFromDisk();
      let list = Array.from(this.subscriptions.values());
      if (where?.workspaceId) list = list.filter((s: any) => s.workspaceId === where.workspaceId);
      if (where?.userId) list = list.filter((s: any) => s.userId === where.userId);
      if (where?.status) list = list.filter((s: any) => s.status === where.status);
      if (include?.plan) {
        return list.map((s: any) => ({
          ...s,
          plan: this.getPlanByIdOrCode(s.planId),
        }));
      }
      return list;
    },
    create: async ({ data, include }: any) => {
      this.loadFromDisk();
      const id = data.id || `sub_${Date.now()}`;
      const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
      this.subscriptions.set(id, record);
      this.saveToDisk();
      if (include?.plan) {
        return { ...record, plan: this.getPlanByIdOrCode(record.planId) };
      }
      return record;
    },
    update: async ({ where, data, include }: any) => {
      this.loadFromDisk();
      let sub = Array.from(this.subscriptions.values()).find((s: any) => s.id === where?.id || s.workspaceId === where?.workspaceId || (where?.userId && s.userId === where.userId));
      if (sub) {
        Object.assign(sub, data, { updatedAt: new Date() });
        this.saveToDisk();
      }
      if (sub && include?.plan) {
        return { ...sub, plan: this.getPlanByIdOrCode(sub.planId) };
      }
      return sub || null;
    },
    upsert: async ({ where, update, create, include }: any) => {
      this.loadFromDisk();
      let sub = Array.from(this.subscriptions.values()).find((s: any) => 
        (where?.workspaceId && s.workspaceId === where.workspaceId) ||
        (where?.userId && s.userId === where.userId)
      );
      if (sub) {
        Object.assign(sub, update, { updatedAt: new Date() });
        this.saveToDisk();
      } else {
        const id = `sub_${Date.now()}`;
        sub = { id, createdAt: new Date(), updatedAt: new Date(), ...create };
        this.subscriptions.set(id, sub);
        this.saveToDisk();
      }
      if (sub && include?.plan) {
        return { ...sub, plan: this.getPlanByIdOrCode(sub.planId) };
      }
      return sub;
    },
  };

  paymentOrder = {
    findUnique: async ({ where }: any) => {
      this.loadFromDisk();
      if (where?.id) return this.paymentOrders.get(where.id) || null;
      if (where?.orderCode) return Array.from(this.paymentOrders.values()).find((o: any) => o.orderCode === where.orderCode) || null;
      return null;
    },
    findFirst: async ({ where }: any = {}) => {
      this.loadFromDisk();
      return Array.from(this.paymentOrders.values()).find((o: any) => {
        if (where?.id && o.id !== where.id) return false;
        if (where?.orderCode && o.orderCode !== where.orderCode) return false;
        if (where?.workspaceId && o.workspaceId !== where.workspaceId) return false;
        if (where?.transactionId && o.transactionId?.toUpperCase() !== where.transactionId?.toUpperCase()) return false;
        if (where?.status && o.status !== where.status) return false;
        return true;
      }) || null;
    },
    findMany: async ({ where }: any = {}) => {
      this.loadFromDisk();
      let list = Array.from(this.paymentOrders.values());
      if (where?.workspaceId) list = list.filter((o: any) => o.workspaceId === where.workspaceId);
      if (where?.userId) list = list.filter((o: any) => o.userId === where.userId);
      if (where?.status) list = list.filter((o: any) => o.status === where.status);
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    create: async ({ data }: any) => {
      this.loadFromDisk();
      const id = data.id || `order_${Date.now()}`;
      const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
      this.paymentOrders.set(id, record);
      this.saveToDisk();
      return record;
    },
    update: async ({ where, data }: any) => {
      this.loadFromDisk();
      const order = this.paymentOrders.get(where.id) || Array.from(this.paymentOrders.values()).find((o: any) => o.orderCode === where?.orderCode);
      if (order) {
        Object.assign(order, data, { updatedAt: new Date() });
        this.saveToDisk();
      }
      return order;
    },
  };

  telebirrSmsLog = {
    findUnique: async ({ where }: any) => {
      this.loadFromDisk();
      if (where?.id) return this.telebirrSmsLogs.get(where.id) || null;
      if (where?.extractedTxId) {
        return Array.from(this.telebirrSmsLogs.values()).find(
          (l: any) => l.extractedTxId?.toUpperCase() === where.extractedTxId?.toUpperCase()
        ) || null;
      }
      return null;
    },
    findFirst: async ({ where }: any = {}) => {
      this.loadFromDisk();
      return Array.from(this.telebirrSmsLogs.values()).find((l: any) => {
        if (where?.extractedTxId && l.extractedTxId?.toUpperCase() !== where.extractedTxId?.toUpperCase()) return false;
        if (where?.isMatched !== undefined && l.isMatched !== where.isMatched) return false;
        return true;
      }) || null;
    },
    findMany: async ({ where }: any = {}) => {
      this.loadFromDisk();
      let list = Array.from(this.telebirrSmsLogs.values());
      if (where?.isMatched !== undefined) list = list.filter((l: any) => l.isMatched === where.isMatched);
      return list.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    },
    create: async ({ data }: any) => {
      this.loadFromDisk();
      const id = data.id || `sms_${Date.now()}`;
      const record = { id, receivedAt: new Date(), ...data };
      this.telebirrSmsLogs.set(id, record);
      this.saveToDisk();
      return record;
    },
    update: async ({ where, data }: any) => {
      this.loadFromDisk();
      const log = this.telebirrSmsLogs.get(where.id);
      if (log) {
        Object.assign(log, data);
        this.saveToDisk();
      }
      return log;
    },
  };

  async $connect() {}
  async $disconnect() {}
  async $transaction(fn: any) {
    if (typeof fn === 'function') {
      return fn(this);
    }
    return Promise.all(fn);
  }
  async $queryRaw(..._args: any[]) {
    return [{ 1: 1 }];
  }
}

export const prisma = new MockPrismaClient();
export { MockPrismaClient as PrismaClient };

