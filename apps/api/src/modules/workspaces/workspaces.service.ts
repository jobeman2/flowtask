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

    const chats = Array.from((this.prisma as any).telegramChats?.values?.() || []) as any[];

    return memberships.map((m) => {
      const linkedChat = chats.find((c: any) => c.workspaceId === m.workspaceId) as any;
      return {
        ...m.workspace,
        role: m.role,
        telegramChat: linkedChat ? { id: linkedChat.id, title: linkedChat.title, chatId: linkedChat.chatId, type: linkedChat.type } : null,
        memberCount: m.workspace._count.members,
        taskCount: m.workspace._count.tasks,
        projectCount: m.workspace._count.projects,
      };
    });
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

  async syncTelegramGroup(workspaceId: string, currentUserId: string) {
    // 1. Find linked telegram chat for this workspace
    let tgChat = await this.prisma.telegramChat.findFirst({
      where: { workspaceId },
    });

    if (!tgChat) {
      const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
      if (!ws) throw new NotFoundException('Workspace not found');
      throw new NotFoundException('No Telegram Group linked to this workspace. Please add @flowtaskmanager_bot to your Telegram group.');
    }

    const chatId = tgChat.chatId;

    // 2. Fetch admins and chat info from Telegram Bot API
    const [admins, chatInfo] = await Promise.all([
      this.telegramService.getChatAdministrators(chatId),
      this.telegramService.getChatInfo(chatId),
    ]);

    if (chatInfo?.title) {
      await this.prisma.telegramChat.update({
        where: { id: tgChat.id },
        data: { title: chatInfo.title },
      });
      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { name: `${chatInfo.title} Board` },
      });
    }

    const importedMembers: any[] = [];

    // 3. Process each administrator / member from Telegram
    for (const item of admins) {
      const tgUser = item.user;
      if (!tgUser || tgUser.is_bot) continue;

      const tgIdStr = tgUser.id.toString();
      const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'Team Member';

      // Find or create User
      let account = await this.prisma.telegramAccount.findUnique({
        where: { telegramId: tgIdStr },
        include: { user: true },
      });

      let userId: string;

      if (!account && tgUser.username) {
        account = await this.prisma.telegramAccount.findFirst({
          where: { username: tgUser.username },
          include: { user: true },
        });
      }

      if (!account) {
        const newUser = await this.prisma.user.create({
          data: {
            name: displayName,
            timezone: 'UTC',
          },
        });

        account = await this.prisma.telegramAccount.create({
          data: {
            telegramId: tgIdStr,
            username: tgUser.username || null,
            firstName: tgUser.first_name,
            lastName: tgUser.last_name || null,
            userId: newUser.id,
          },
          include: { user: true },
        });

        // Also give them their personal workspace
        await this.prisma.workspace.create({
          data: {
            name: `${displayName}'s Workspace`,
            slug: `ws-${tgIdStr}-${Date.now().toString(36)}`,
            ownerId: newUser.id,
            type: WorkspaceType.PERSONAL,
            members: {
              create: {
                userId: newUser.id,
                role: WorkspaceRole.OWNER,
              },
            },
          },
        });

        userId = newUser.id;
      } else {
        userId = account.user.id;
        // Update profile
        await this.prisma.telegramAccount.update({
          where: { id: account.id },
          data: {
            telegramId: tgIdStr,
            username: tgUser.username || null,
            firstName: tgUser.first_name,
            lastName: tgUser.last_name || null,
          },
        });
        await this.prisma.user.update({
          where: { id: userId },
          data: { name: displayName },
        });
      }

      // Check if already member of this workspace
      const isMember = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId, userId },
      });

      const role = item.status === 'creator' ? WorkspaceRole.OWNER : WorkspaceRole.ADMIN;

      if (!isMember) {
        const newMember = await this.prisma.workspaceMember.create({
          data: {
            workspaceId,
            userId,
            role,
          },
          include: { user: true },
        });
        importedMembers.push(newMember);
      } else {
        importedMembers.push(isMember);
      }
    }

    return {
      success: true,
      message: `Successfully synchronized ${importedMembers.length} member(s) from Telegram group "${tgChat.title}"!`,
      groupTitle: tgChat.title,
      memberCount: importedMembers.length,
      imported: importedMembers,
    };
  }
}
