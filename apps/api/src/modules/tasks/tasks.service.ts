import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { TaskStatus } from '@flowtask/database';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService
  ) {}

  private async checkTaskPermission(
    workspaceId: string,
    userId: string,
    task?: any,
    action: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'COMPLETE' = 'VIEW'
  ) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!member && workspace?.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    if (action === 'VIEW' || action === 'CREATE') return;

    const isOwnerOrAdmin =
      workspace?.ownerId === userId || member?.role === 'OWNER' || member?.role === 'ADMIN';

    if (task) {
      const isCreator = task.creatorId === userId;
      const isAssignee = task.assigneeId === userId;

      if (action === 'DELETE') {
        if (!isOwnerOrAdmin && !isCreator) {
          throw new ForbiddenException('Only the task creator or a workspace admin can delete this task.');
        }
      }

      if (action === 'COMPLETE') {
        if (task.assigneeId && !isAssignee) {
          throw new ForbiddenException('Only the assigned teammate can mark this task as done.');
        }
      }

      if (action === 'UPDATE') {
        if (!isOwnerOrAdmin && !isCreator && !isAssignee) {
          throw new ForbiddenException(
            'Only the task assignee, creator, or workspace admin can modify this task.'
          );
        }
      }
    }
  }

  async listTasks(
    workspaceId: string,
    userId: string,
    query: PaginationDto & { status?: TaskStatus; projectId?: string; assigneeId?: string }
  ) {
    await this.checkTaskPermission(workspaceId, userId, null, 'VIEW');

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      workspaceId,
      archivedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.projectId) {
      where.projectId = query.projectId;
    }

    if (query.assigneeId) {
      where.assigneeId = query.assigneeId;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
        include: {
          creator: { select: { id: true, name: true, avatarUrl: true } },
          assignee: { select: { id: true, name: true, avatarUrl: true } },
          project: { select: { id: true, name: true, color: true } },
          labels: { include: { label: true } },
          _count: { select: { comments: true, reminders: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: tasks,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getTaskById(taskId: string, workspaceId: string, userId?: string) {
    if (userId) {
      await this.checkTaskPermission(workspaceId, userId, null, 'VIEW');
    }

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        project: true,
        labels: { include: { label: true } },
        comments: {
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
        reminders: true,
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    return task;
  }

  async createTask(dto: CreateTaskDto, creatorId: string) {
    await this.checkTaskPermission(dto.workspaceId, creatorId, null, 'CREATE');

    const { labelIds, ...taskData } = dto;

    const result = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          workspaceId: taskData.workspaceId,
          projectId: taskData.projectId,
          title: taskData.title,
          description: taskData.description,
          status: taskData.status,
          priority: taskData.priority,
          creatorId,
          assigneeId: taskData.assigneeId,
          imageUrl: taskData.imageUrl || null,
          dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
          isRecurring: Boolean(taskData.isRecurring),
          recurrenceRule: taskData.isRecurring ? taskData.recurrenceRule || 'FREQ=WEEKLY' : null,
          labels: labelIds?.length
            ? {
                create: labelIds.map((labelId) => ({ labelId })),
              }
            : undefined,
        },
        include: {
          creator: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
          project: true,
        },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          workspaceId: taskData.workspaceId,
          actorId: creatorId,
          entityType: 'TASK',
          entityId: task.id,
          action: 'TASK_CREATED',
          metadata: { title: task.title },
        },
      });

      return task;
    });

    // Dispatch notifications asynchronously (non-blocking)
    try {
      const creator = await this.prisma.user.findUnique({ where: { id: creatorId } });
      const workspace = await this.prisma.workspace.findUnique({ where: { id: dto.workspaceId } });
      const creatorTg = await this.prisma.telegramAccount.findFirst({ where: { userId: creatorId } });
      const targetTg = dto.assigneeId
        ? await this.prisma.telegramAccount.findFirst({ where: { userId: dto.assigneeId } })
        : null;
      const assigneeUser = dto.assigneeId
        ? await this.prisma.user.findUnique({ where: { id: dto.assigneeId } })
        : null;

      // 1. Send DM to the assignee (if assigned to someone else)
      if (targetTg?.telegramId && dto.assigneeId !== creatorId) {
        await this.telegramService.notifyTaskAssigned({
          targetTelegramId: targetTg.telegramId,
          taskId: result.id,
          taskTitle: dto.title,
          description: dto.description || null,
          priority: dto.priority || 'MEDIUM',
          workspaceName: workspace?.name || 'Team Workspace',
          assignerName: creator?.name || 'A teammate',
          dueDate: dto.dueDate || null,
        });
      }

      // 2. Send DM confirmation to the creator
      if (creatorTg?.telegramId) {
        await this.telegramService.notifyTaskCreatedForCreator({
          targetTelegramId: creatorTg.telegramId,
          taskId: result.id,
          taskTitle: dto.title,
          priority: dto.priority || 'MEDIUM',
          workspaceName: workspace?.name || 'Team Workspace',
          assigneeName: assigneeUser?.name || (dto.assigneeId === creatorId ? 'You' : null),
          dueDate: dto.dueDate || null,
        });
      }

      // 3. If workspace is linked to a Telegram Group, broadcast to the group chat
      const groupChat = await this.prisma.telegramChat.findFirst({
        where: { workspaceId: dto.workspaceId },
      });

      if (groupChat?.chatId) {
        await this.telegramService.notifyGroupTaskCreated({
          groupChatId: groupChat.chatId,
          taskId: result.id,
          taskTitle: dto.title,
          description: dto.description || null,
          priority: dto.priority || 'MEDIUM',
          workspaceName: workspace?.name || groupChat.title || 'Group Board',
          creatorName: creator?.name || 'A teammate',
          assigneeName: assigneeUser?.name || null,
          dueDate: dto.dueDate || null,
          imageUrl: result.imageUrl || dto.imageUrl || null,
        });
      }
    } catch {
      // Non-blocking notification
    }

    return result;
  }

  async updateTask(taskId: string, workspaceId: string, dto: UpdateTaskDto, userId: string) {
    const existing = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    await this.checkTaskPermission(
      workspaceId,
      userId,
      existing,
      dto.status === 'DONE' ? 'COMPLETE' : 'UPDATE'
    );

    const { labelIds, ...updateFields } = dto;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (labelIds !== undefined) {
        await tx.taskLabel.deleteMany({ where: { taskId } });
        if (labelIds.length > 0) {
          await tx.taskLabel.createMany({
            data: labelIds.map((labelId) => ({ taskId, labelId })),
          });
        }
      }

      const res = await tx.task.update({
        where: { id: taskId },
        data: {
          ...updateFields,
          dueDate: updateFields.dueDate ? new Date(updateFields.dueDate) : undefined,
          completedAt:
            updateFields.status === 'DONE' && existing.status !== 'DONE'
              ? new Date()
              : updateFields.status && updateFields.status !== 'DONE'
              ? null
              : undefined,
        },
        include: {
          creator: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
          project: true,
          labels: { include: { label: true } },
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          actorId: userId,
          entityType: 'TASK',
          entityId: taskId,
          action: 'TASK_UPDATED',
          metadata: { changes: updateFields },
        },
      });

      return res;
    });

    // If task was newly assigned or reassigned to a different teammate
    if (dto.assigneeId && dto.assigneeId !== existing.assigneeId && dto.assigneeId !== userId) {
      try {
        const updater = await this.prisma.user.findUnique({ where: { id: userId } });
        const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
        const targetTg = await this.prisma.telegramAccount.findFirst({ where: { userId: dto.assigneeId } });
        if (targetTg?.telegramId) {
          await this.telegramService.notifyTaskAssigned({
            targetTelegramId: targetTg.telegramId,
            taskId: updated.id,
            taskTitle: updated.title,
            description: updated.description || null,
            priority: updated.priority,
            workspaceName: workspace?.name || 'Team Workspace',
            assignerName: updater?.name || 'A teammate',
            dueDate: updated.dueDate ? new Date(updated.dueDate).toISOString() : null,
          });
        }
      } catch {
        // Non-blocking notification
      }
    }

    // If task was marked as DONE, notify creator and group
    if (updateFields.status === 'DONE' && existing.status !== 'DONE') {
      try {
        const completer = await this.prisma.user.findUnique({ where: { id: userId } });
        const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
        const creatorTg = existing.creatorId
          ? await this.prisma.telegramAccount.findFirst({ where: { userId: existing.creatorId } })
          : null;

        // 1. Notify creator if completed by someone else
        if (creatorTg?.telegramId && existing.creatorId !== userId) {
          await this.telegramService.notifyTaskCompleted({
            targetTelegramId: creatorTg.telegramId,
            taskTitle: updated.title,
            workspaceName: workspace?.name || 'Team Workspace',
            completedByName: completer?.name || 'A teammate',
          });
        }

        // 2. Broadcast completion to group chat if connected
        const groupChat = await this.prisma.telegramChat.findFirst({
          where: { workspaceId },
        });

        if (groupChat?.chatId) {
          await this.telegramService.notifyGroupTaskCompleted({
            groupChatId: groupChat.chatId,
            taskTitle: updated.title,
            workspaceName: workspace?.name || groupChat.title || 'Group Board',
            completedByName: completer?.name || 'A teammate',
          });
        }
      } catch {
        // Non-blocking notification
      }
    }

    return updated;
  }

  async completeTask(taskId: string, workspaceId: string, userId: string) {
    return this.updateTask(
      taskId,
      workspaceId,
      { status: TaskStatus.DONE },
      userId
    );
  }

  async deleteTask(taskId: string, workspaceId: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.checkTaskPermission(workspaceId, userId, task, 'DELETE');

    await this.prisma.task.delete({ where: { id: taskId } });

    await this.prisma.activityLog.create({
      data: {
        workspaceId,
        actorId: userId,
        entityType: 'TASK',
        entityId: taskId,
        action: 'TASK_DELETED',
        metadata: { title: task.title },
      },
    });

    return { deleted: true };
  }

  async getWorkspaceStats(workspaceId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { workspaceId, archivedAt: null },
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let totalActive = 0;
    let completed = 0;
    let overdue = 0;
    let dueToday = 0;
    let upcoming = 0;

    const byPriority: Record<string, number> = {
      URGENT: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      NONE: 0,
    };

    const byStatus: Record<string, number> = {
      BACKLOG: 0,
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
      CANCELLED: 0,
    };

    for (const t of tasks) {
      if (byStatus[t.status] !== undefined) {
        byStatus[t.status]++;
      }

      if (t.status === TaskStatus.DONE) {
        completed++;
        continue;
      }

      if (t.status === TaskStatus.CANCELLED) {
        continue;
      }

      totalActive++;

      if (byPriority[t.priority] !== undefined) {
        byPriority[t.priority]++;
      }

      if (t.dueDate) {
        const d = new Date(t.dueDate);
        if (d < startOfToday) {
          overdue++;
        } else if (d >= startOfToday && d <= endOfToday) {
          dueToday++;
        } else if (d > endOfToday) {
          upcoming++;
        }
      }
    }

    const projects = await this.prisma.project.findMany({
      where: { workspaceId, isArchived: false },
      include: { _count: true },
    });

    return {
      success: true,
      data: {
        totalActive,
        completed,
        overdue,
        dueToday,
        upcoming,
        totalTasks: tasks.length,
        byPriority,
        byStatus,
        projectsCount: projects.length,
        projectsSummary: projects.map((p: any) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          taskCount: p._count?.tasks || 0,
        })),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
