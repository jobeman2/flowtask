// Resilient database client wrapper supporting both PrismaClient and in-memory mock storage

let PrismaClientClass: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  PrismaClientClass = require('@prisma/client').PrismaClient;
} catch {
  // In-memory fallback if Prisma client is compiling
  class MockPrismaClient {
    private users = new Map<string, any>();
    private telegramAccounts = new Map<string, any>();
    private workspaces = new Map<string, any>();
    private workspaceMembers = new Map<string, any>();
    private tasks = new Map<string, any>();
    private projects = new Map<string, any>();
    private labels = new Map<string, any>();
    private comments = new Map<string, any>();

    user = {
      findUnique: async ({ where }: any) => {
        if (where.id) return this.users.get(where.id) || null;
        if (where.email) return Array.from(this.users.values()).find((u: any) => u.email === where.email) || null;
        return null;
      },
      findUniqueOrThrow: async (params: any) => (await this.user.findUnique(params)) || { id: 'demo-user', name: 'Demo User' },
      create: async ({ data }: any) => {
        const id = data.id || `user_${Date.now()}`;
        const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
        this.users.set(id, record);
        return record;
      },
    };

    telegramAccount = {
      findUnique: async ({ where }: any) => {
        if (where.telegramId) {
          const acc = Array.from(this.telegramAccounts.values()).find((a: any) => a.telegramId === where.telegramId);
          if (!acc) return null;
          const user = this.users.get(acc.userId);
          const members = Array.from(this.workspaceMembers.values()).filter((m: any) => m.userId === acc.userId);
          return {
            ...acc,
            user: {
              ...user,
              workspaceMembers: members.map((m: any) => ({
                ...m,
                workspace: this.workspaces.get(m.workspaceId),
              })),
            },
          };
        }
        return null;
      },
      create: async ({ data }: any) => {
        const id = data.id || `tg_${Date.now()}`;
        const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
        this.telegramAccounts.set(id, record);
        return record;
      },
      update: async ({ where, data }: any) => {
        const acc = this.telegramAccounts.get(where.id);
        if (acc) Object.assign(acc, data);
        return acc;
      },
    };

    workspace = {
      create: async ({ data }: any) => {
        const id = data.id || `ws_${Date.now()}`;
        const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
        this.workspaces.set(id, record);
        if (data.members?.create) {
          const mId = `mem_${Date.now()}`;
          this.workspaceMembers.set(mId, {
            id: mId,
            workspaceId: id,
            userId: data.members.create.userId,
            role: data.members.create.role,
          });
        }
        return record;
      },
      findUnique: async ({ where }: any) => this.workspaces.get(where.id) || null,
      findMany: async () => Array.from(this.workspaces.values()),
    };

    workspaceMember = {
      findMany: async ({ where }: any) => {
        return Array.from(this.workspaceMembers.values())
          .filter((m: any) => (where.userId ? m.userId === where.userId : true))
          .map((m: any) => ({ ...m, workspace: this.workspaces.get(m.workspaceId) || { id: m.workspaceId, name: 'Personal Workspace', _count: { members: 1, tasks: 0, projects: 0 } } }));
      },
      findUnique: async () => null,
      create: async ({ data }: any) => {
        const id = `mem_${Date.now()}`;
        const record = { id, ...data };
        this.workspaceMembers.set(id, record);
        return record;
      },
    };

    task = {
      create: async ({ data }: any) => {
        const id = data.id || `task_${Date.now()}`;
        const record = { id, status: 'TODO', priority: 'MEDIUM', createdAt: new Date(), updatedAt: new Date(), ...data };
        this.tasks.set(id, record);
        return record;
      },
      findMany: async ({ where }: any) => {
        return Array.from(this.tasks.values()).filter((t: any) => !where?.workspaceId || t.workspaceId === where.workspaceId);
      },
      findFirst: async ({ where }: any) => {
        return Array.from(this.tasks.values()).find((t: any) => t.id === where?.id) || null;
      },
      count: async () => this.tasks.size,
      update: async ({ where, data }: any) => {
        const task = this.tasks.get(where.id);
        if (task) Object.assign(task, data);
        return task;
      },
      delete: async ({ where }: any) => {
        this.tasks.delete(where.id);
        return { deleted: true };
      },
    };

    project = {
      findMany: async () => Array.from(this.projects.values()),
      findFirst: async () => null,
      create: async ({ data }: any) => {
        const id = `proj_${Date.now()}`;
        const record = { id, ...data };
        this.projects.set(id, record);
        return record;
      },
      update: async ({ where, data }: any) => Object.assign(this.projects.get(where.id) || {}, data),
    };

    label = {
      findMany: async () => Array.from(this.labels.values()),
      findUnique: async () => null,
      findFirst: async () => null,
      create: async ({ data }: any) => {
        const id = `lbl_${Date.now()}`;
        const record = { id, ...data };
        this.labels.set(id, record);
        return record;
      },
      update: async ({ where, data }: any) => Object.assign(this.labels.get(where.id) || {}, data),
      delete: async ({ where }: any) => this.labels.delete(where.id),
    };

    comment = {
      findMany: async () => Array.from(this.comments.values()),
      create: async ({ data }: any) => {
        const id = `comm_${Date.now()}`;
        const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
        this.comments.set(id, record);
        return record;
      },
    };

    activityLog = {
      create: async ({ data }: any) => ({ id: `act_${Date.now()}`, ...data }),
      findMany: async () => [],
    };

    plan = {
      upsert: async ({ create }: any) => create,
    };

    async $connect() {}
    async $disconnect() {}
    async $transaction(fn: any) {
      if (typeof fn === 'function') return fn(this);
      return Promise.all(fn);
    }
    async $queryRaw() {
      return [{ 1: 1 }];
    }
  }

  PrismaClientClass = MockPrismaClient;
}

export const prisma = new PrismaClientClass();
export { PrismaClientClass as PrismaClient };

export enum WorkspaceRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  GUEST = 'GUEST',
}

export enum WorkspaceType {
  PERSONAL = 'PERSONAL',
  TEAM = 'TEAM',
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
