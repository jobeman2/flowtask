import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { WorkspaceType, WorkspaceRole } from '@flowtask/database';

@Injectable()
export class WorkspacesService {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService
  ) {}

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

  async listMembers(workspaceId: string, currentUserId: string) {
    const isMember = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: currentUserId },
    });

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!isMember && workspace?.ownerId !== currentUserId) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: true,
      },
    });

    return members.map((m: any) => {
      const assignedCount = Array.from((this.prisma as any).tasks?.values?.() || [])
        .filter((t: any) => t.workspaceId === workspaceId && t.assigneeId === m.userId && t.status !== 'DONE' && !t.archivedAt)
        .length;

      return {
        id: m.id,
        workspaceId: m.workspaceId,
        userId: m.userId,
        role: m.role,
        createdAt: m.createdAt,
        user: m.user,
        activeTasksCount: assignedCount,
      };
    });
  }

  async addMember(
    workspaceId: string,
    currentUserId: string,
    payload: {
      userId?: string;
      username?: string;
      email?: string;
      name?: string;
      role?: WorkspaceRole;
    }
  ) {
    const currentMember = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: currentUserId },
    });
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    const isOwnerOrAdmin = workspace?.ownerId === currentUserId || currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN';

    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Only owners and admins can invite members');
    }

    let targetUserId = payload.userId;

    // If targetUserId not directly provided, find by username or email, or create user
    if (!targetUserId) {
      if (payload.username) {
        const cleanUsername = payload.username.replace(/^@/, '').trim();
        const tgAcc = await this.prisma.telegramAccount.findUnique({
          where: { telegramId: cleanUsername },
        });
        if (tgAcc) {
          targetUserId = tgAcc.userId;
        } else {
          // Create placeholder user for this username
          const newUser = await this.prisma.user.create({
            data: {
              name: payload.name || `@${cleanUsername}`,
            },
          });
          await this.prisma.telegramAccount.create({
            data: {
              telegramId: `tg_${cleanUsername}_${Date.now()}`,
              username: cleanUsername,
              firstName: payload.name || cleanUsername,
              userId: newUser.id,
            },
          });
          targetUserId = newUser.id;
        }
      } else if (payload.email) {
        const existingUser = await this.prisma.user.findFirst({
          where: { email: payload.email.trim().toLowerCase() },
        });
        if (existingUser) {
          targetUserId = existingUser.id;
        } else {
          const newUser = await this.prisma.user.create({
            data: {
              name: payload.name || payload.email.split('@')[0],
              email: payload.email.trim().toLowerCase(),
            },
          });
          targetUserId = newUser.id;
        }
      } else if (payload.name) {
        const newUser = await this.prisma.user.create({
          data: {
            name: payload.name.trim(),
          },
        });
        targetUserId = newUser.id;
      }
    }

    if (!targetUserId) {
      throw new NotFoundException('Please specify a valid userId, Telegram @username, email, or name to invite');
    }

    const existing = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUserId },
    });

    if (existing) {
      throw new ConflictException('User is already a member of this workspace');
    }

    const createdMember = await this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: targetUserId,
        role: payload.role || WorkspaceRole.MEMBER,
      },
      include: {
        user: true,
      },
    });

    // Send Telegram Notification to the invited user
    try {
      const inviter = await this.prisma.user.findUnique({ where: { id: currentUserId } });
      const targetTg = await this.prisma.telegramAccount.findFirst({ where: { userId: targetUserId } });
      if (targetTg?.telegramId) {
        await this.telegramService.notifyWorkspaceInvite({
          targetTelegramId: targetTg.telegramId,
          workspaceName: workspace?.name || 'Team Workspace',
          role: createdMember.role,
          inviterName: inviter?.name || 'A teammate',
        });
      }
    } catch {
      // Non-blocking notification
    }

    return createdMember;
  }

  async removeMember(
    workspaceId: string,
    currentUserId: string,
    memberId: string
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    const currentMember = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: currentUserId },
    });

    const isOwnerOrAdmin = workspace?.ownerId === currentUserId || currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN';

    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Only owners and admins can remove members');
    }

    const target = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        id: memberId,
      },
    });

    if (!target) {
      // Try finding by userId
      const targetByUser = await this.prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId: memberId,
        },
      });
      if (!targetByUser) {
        throw new NotFoundException('Member not found in this workspace');
      }
      if (targetByUser.role === 'OWNER' || targetByUser.userId === workspace?.ownerId) {
        throw new ForbiddenException('Cannot remove the workspace owner');
      }
      return this.prisma.workspaceMember.delete({
        where: { id: targetByUser.id },
      });
    }

    if (target.role === 'OWNER' || target.userId === workspace?.ownerId) {
      throw new ForbiddenException('Cannot remove the workspace owner');
    }

    return this.prisma.workspaceMember.delete({
      where: { id: target.id },
    });
  }
}
