import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { TaskStatus } from '@flowtask/database';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async listTasks(
    workspaceId: string,
    userId: string,
    query: PaginationDto & { status?: TaskStatus; projectId?: string; assigneeId?: string }
  ) {
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

  async getTaskById(taskId: string, workspaceId: string) {
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
    const { labelIds, ...taskData } = dto;

    return this.prisma.$transaction(async (tx) => {
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
          dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
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
  }

  async updateTask(taskId: string, workspaceId: string, dto: UpdateTaskDto, userId: string) {
    const existing = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    const { labelIds, ...updateFields } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (labelIds !== undefined) {
        await tx.taskLabel.deleteMany({ where: { taskId } });
        if (labelIds.length > 0) {
          await tx.taskLabel.createMany({
            data: labelIds.map((labelId) => ({ taskId, labelId })),
          });
        }
      }

      const updated = await tx.task.update({
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

      return updated;
    });
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
}
