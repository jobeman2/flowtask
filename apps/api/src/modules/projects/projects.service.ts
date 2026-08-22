import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async listProjects(workspaceId: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        workspaceId,
        isArchived: false,
      },
      include: {
        _count: {
          select: {
            tasks: {
              where: {
                archivedAt: null,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return projects.map((p) => ({
      ...p,
      taskCount: p._count.tasks,
    }));
  }

  async getProjectById(projectId: string, workspaceId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      include: {
        tasks: {
          where: { archivedAt: null },
          include: {
            assignee: { select: { id: true, name: true, avatarUrl: true } },
            labels: { include: { label: true } },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    return project;
  }

  async createProject(dto: CreateProjectDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          workspaceId: dto.workspaceId,
          name: dto.name,
          description: dto.description,
          color: dto.color,
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId: dto.workspaceId,
          actorId: userId,
          entityType: 'PROJECT',
          entityId: project.id,
          action: 'PROJECT_CREATED',
          metadata: { name: project.name },
        },
      });

      return project;
    });
  }

  async updateProject(
    projectId: string,
    workspaceId: string,
    dto: UpdateProjectDto,
    userId: string
  ) {
    const existing = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: projectId },
        data: dto,
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          actorId: userId,
          entityType: 'PROJECT',
          entityId: projectId,
          action: 'PROJECT_UPDATED',
          metadata: { changes: dto },
        },
      });

      return updated;
    });
  }

  async archiveProject(projectId: string, workspaceId: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const archived = await tx.project.update({
        where: { id: projectId },
        data: { isArchived: true },
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          actorId: userId,
          entityType: 'PROJECT',
          entityId: projectId,
          action: 'PROJECT_ARCHIVED',
          metadata: { name: project.name },
        },
      });

      return archived;
    });
  }
}
