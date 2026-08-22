import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceType, WorkspaceRole } from '@flowtask/database';

@Injectable()
export class WorkspacesService {
  constructor(private prisma: PrismaService) {}

  async listUserWorkspaces(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                members: true,
                tasks: true,
                projects: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      ...m.workspace,
      role: m.role,
      memberCount: m.workspace._count.members,
      taskCount: m.workspace._count.tasks,
      projectCount: m.workspace._count.projects,
    }));
  }

  async getWorkspaceById(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      include: {
        workspace: {
          include: {
            projects: { where: { isArchived: false } },
            labels: true,
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    return {
      ...member.workspace,
      currentUserRole: member.role,
    };
  }

  async createWorkspace(userId: string, name: string, type: WorkspaceType = WorkspaceType.PERSONAL) {
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;

    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name,
          slug,
          ownerId: userId,
          type,
          members: {
            create: {
              userId,
              role: WorkspaceRole.OWNER,
            },
          },
        },
      });

      return workspace;
    });
  }

  async addMember(
    workspaceId: string,
    currentUserId: string,
    targetUserId: string,
    role: WorkspaceRole = WorkspaceRole.MEMBER
  ) {
    const currentMember = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: currentUserId } },
    });

    if (!currentMember || (currentMember.role !== 'OWNER' && currentMember.role !== 'ADMIN')) {
      throw new ForbiddenException('Only owners and admins can invite members');
    }

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });

    if (existing) {
      throw new ConflictException('User is already a member of this workspace');
    }

    return this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: targetUserId,
        role,
      },
    });
  }
}
