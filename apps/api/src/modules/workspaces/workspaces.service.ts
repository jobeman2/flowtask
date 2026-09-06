import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { WorkspaceType, WorkspaceRole, InvitationStatus } from '@flowtask/database';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WorkspacesService {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
    private configService: ConfigService,
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

    const workspaceIds = memberships.map((m) => m.workspaceId);

    // Fetch linked Telegram chats only for user's actual workspaces
    const telegramChats = workspaceIds.length > 0
      ? await (this.prisma as any).telegramChat.findMany({
          where: { workspaceId: { in: workspaceIds } },
        })
      : [];

    return memberships.map((m) => {
      const linkedChat = telegramChats.find((c: any) => c.workspaceId === m.workspaceId);
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
    let member = await this.prisma.workspaceMember.findUnique({
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
    // 1. Look up user's best plan to determine workspace limit
    const ownedWorkspaces = await this.prisma.workspace.findMany({
      where: { ownerId: userId },
    });
    const ownedIds = ownedWorkspaces.map((w) => w.id);
    const ownedCount = ownedWorkspaces.length;

    // Find user's best active subscription (by userId directly or across their owned workspaces)
    const activeSub = await this.prisma.subscription.findFirst({
      where: {
        OR: [
          { userId },
          ...(ownedIds.length > 0 ? [{ workspaceId: { in: ownedIds } }] : []),
        ],
        status: 'ACTIVE',
        plan: { code: { not: 'FREE' } },
      },
      include: { plan: true },
      orderBy: { currentPeriodEnd: 'desc' },
    });

    const planCode = activeSub?.plan?.code || 'FREE';

    const maxAllowedWorkspaces =
      planCode === 'BUSINESS' ? 999 :
      planCode === 'TEAM'     ? 10  :
      planCode === 'PRO'      ? 5   : 1; // FREE = 1

    if (ownedCount >= maxAllowedWorkspaces) {
      const upgradeMsg =
        maxAllowedWorkspaces === 1
          ? 'The Free plan is limited to 1 workspace. Upgrade to Pro or Team with Telebirr to create more!'
          : `Your ${planCode} plan allows up to ${maxAllowedWorkspaces} workspaces. Upgrade to Business for unlimited!`;
      throw new ForbiddenException(upgradeMsg);
    }

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
        user: {
          include: {
            _count: {
              select: {
                assignedTasks: {
                  where: { workspaceId, status: { notIn: ['DONE', 'CANCELLED'] }, archivedAt: null },
                },
              },
            },
          },
        },
      },
    });

    return members.map((m: any) => {
      return {
        id: m.id,
        workspaceId: m.workspaceId,
        userId: m.userId,
        role: m.role,
        createdAt: m.createdAt,
        user: m.user,
        activeTasksCount: m.user?._count?.assignedTasks ?? 0,
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
        const cleanUsername = payload.username.replace(/^@/, '').trim().toLowerCase();
        
        // Find existing Telegram account by username (prioritizing real numeric accounts)
        let tgAcc = await this.prisma.telegramAccount.findFirst({
          where: { username: cleanUsername },
        });

        if (tgAcc) {
          targetUserId = tgAcc.userId;
        } else {
          // Check if a user with that name already exists
          const allUsers = await this.prisma.user.findMany();
          const existingUser = allUsers.find(
            (u) => u.name?.toLowerCase() === cleanUsername || u.name?.toLowerCase() === `@${cleanUsername}`
          );

          if (existingUser) {
            targetUserId = existingUser.id;
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

    // Lookup any target telegram account info
    const targetTg = await this.prisma.telegramAccount.findFirst({ where: { userId: targetUserId } });
    const targetTelegramId = targetTg?.telegramId || null;
    const targetUsername = payload.username
      ? payload.username.replace(/^@/, '').trim().toLowerCase()
      : targetTg?.username || null;

    // Check if an existing PENDING invitation is already sent
    let invitation = await (this.prisma as any).workspaceInvitation.findFirst({
      where: {
        workspaceId,
        status: InvitationStatus.PENDING,
        OR: [
          ...(targetUserId ? [{ inviteeUserId: targetUserId }] : []),
          ...(targetTelegramId ? [{ targetTelegramId }] : []),
          ...(targetUsername ? [{ targetUsername }] : []),
        ],
      },
    });

    if (!invitation) {
      invitation = await (this.prisma as any).workspaceInvitation.create({
        data: {
          workspaceId,
          inviterId: currentUserId,
          inviteeUserId: targetUserId,
          targetTelegramId,
          targetUsername,
          role: payload.role || WorkspaceRole.MEMBER,
          status: InvitationStatus.PENDING,
        },
        include: {
          workspace: true,
          inviter: true,
          invitee: true,
        },
      });
    }

    // Generate deep-link for direct bot acceptance
    const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME') || 'flowtaskmanager_bot';
    const inviteLink = `https://t.me/${botUsername}?start=invite_${invitation.id}`;

    // Send Telegram Notification to the invited user
    try {
      const inviter = await this.prisma.user.findUnique({ where: { id: currentUserId } });
      if (targetTelegramId && /^\d+$/.test(targetTelegramId)) {
        await this.telegramService.notifyWorkspaceInvite({
          targetTelegramId,
          workspaceId,
          workspaceName: workspace?.name || 'Team Workspace',
          role: invitation.role,
          inviterName: inviter?.name || 'A teammate',
          memberId: invitation.id,
        });
      }
    } catch {
      // Non-blocking notification
    }

    return {
      ...invitation,
      inviteLink,
    };
  }

  async listPendingInvitations(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { telegramAccounts: true },
    });

    const tgIds = user?.telegramAccounts?.map((t) => t.telegramId).filter(Boolean) || [];
    const usernames = user?.telegramAccounts?.map((t) => t.username?.toLowerCase()).filter(Boolean) as string[] || [];

    const invitations = await (this.prisma as any).workspaceInvitation.findMany({
      where: {
        status: InvitationStatus.PENDING,
        OR: [
          { inviteeUserId: userId },
          ...tgIds.map((id) => ({ targetTelegramId: id })),
          ...usernames.map((u) => ({ targetUsername: u })),
        ],
      },
      include: {
        workspace: true,
        inviter: true,
      },
    });

    return invitations;
  }

  async acceptInvitation(invitationId: string, userId: string) {
    const invitation = await (this.prisma as any).workspaceInvitation.findUnique({
      where: { id: invitationId },
      include: { workspace: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or expired');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(`Invitation is already ${invitation.status.toLowerCase()}`);
    }

    // Ensure user is not already a member
    let member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: invitation.workspaceId,
        userId,
      },
    });

    if (!member) {
      member = await this.prisma.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role || WorkspaceRole.MEMBER,
        },
      });
    }

    // Mark invitation as accepted
    await (this.prisma as any).workspaceInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.ACCEPTED,
        inviteeUserId: userId,
      },
    });

    return {
      success: true,
      member,
      workspace: invitation.workspace,
    };
  }

  async declineInvitation(invitationId: string, userId: string) {
    const invitation = await (this.prisma as any).workspaceInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    await (this.prisma as any).workspaceInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.DECLINED,
        inviteeUserId: userId,
      },
    });

    return { success: true, message: 'Invitation declined' };
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

  async leaveWorkspace(workspaceId: string, currentUserId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: currentUserId },
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this workspace');
    }

    // If the owner is leaving a personal workspace, block it
    if (workspace.type === WorkspaceType.PERSONAL && workspace.ownerId === currentUserId) {
      throw new BadRequestException('You cannot leave your personal workspace. You can delete or rename it.');
    }

    // If the owner is leaving a team workspace, transfer ownership or delete if last member
    if (workspace.ownerId === currentUserId) {
      const nextMember = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId, userId: { not: currentUserId } },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      });

      if (nextMember) {
        await this.prisma.workspace.update({
          where: { id: workspaceId },
          data: { ownerId: nextMember.userId },
        });
        await this.prisma.workspaceMember.update({
          where: { id: nextMember.id },
          data: { role: WorkspaceRole.OWNER },
        });
      } else {
        // Last member leaving: delete the workspace
        return this.deleteWorkspace(workspaceId, currentUserId);
      }
    }

    await this.prisma.workspaceMember.delete({
      where: { id: member.id },
    });

    return { success: true, message: 'Successfully left the workspace' };
  }

  async deleteWorkspace(workspaceId: string, currentUserId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: currentUserId },
    });

    const isAuthorized =
      workspace.ownerId === currentUserId ||
      membership?.role === WorkspaceRole.OWNER ||
      (workspace.type === WorkspaceType.TEAM && membership?.role === WorkspaceRole.ADMIN);

    if (!isAuthorized) {
      throw new ForbiddenException('Only the workspace owner or admin can delete this workspace');
    }

    // Comprehensive cascading delete inside transaction so no foreign keys fail
    await this.prisma.$transaction(async (tx: any) => {
      // 1. Delete tasks and their related sub-entities
      const tasks = await tx.task.findMany({
        where: { workspaceId },
        select: { id: true },
      });
      const taskIds = tasks.map((t: any) => t.id);

      if (taskIds.length > 0) {
        if (tx.reminder?.deleteMany) {
          await tx.reminder.deleteMany({ where: { taskId: { in: taskIds } } });
        }
        if (tx.comment?.deleteMany) {
          await tx.comment.deleteMany({ where: { taskId: { in: taskIds } } });
        }
        if (tx.taskLabel?.deleteMany) {
          await tx.taskLabel.deleteMany({ where: { taskId: { in: taskIds } } });
        }
        await tx.task.deleteMany({ where: { id: { in: taskIds } } });
      }

      // 2. Delete workspace entities
      if (tx.telegramChat?.deleteMany) {
        await tx.telegramChat.deleteMany({ where: { workspaceId } });
      }
      if (tx.project?.deleteMany) {
        await tx.project.deleteMany({ where: { workspaceId } });
      }
      if (tx.label?.deleteMany) {
        await tx.label.deleteMany({ where: { workspaceId } });
      }
      if (tx.activityLog?.deleteMany) {
        await tx.activityLog.deleteMany({ where: { workspaceId } });
      }
      if (tx.subscription?.deleteMany) {
        await tx.subscription.deleteMany({ where: { workspaceId } });
      }
      if (tx.paymentOrder?.deleteMany) {
        await tx.paymentOrder.deleteMany({ where: { workspaceId } });
      }
      await tx.workspaceMember.deleteMany({ where: { workspaceId } });

      // 3. Delete workspace record
      await tx.workspace.delete({ where: { id: workspaceId } });
    });

    return { success: true, message: 'Workspace deleted successfully' };
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

      // Resolve member avatar from Telegram Bot API
      let avatarUrl: string | null = null;
      try {
        avatarUrl = await this.telegramService.getUserProfilePhotoUrl(tgIdStr);
      } catch {
        // Non-blocking
      }

      if (!account) {
        const newUser = await this.prisma.user.create({
          data: {
            name: displayName,
            avatarUrl,
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
          data: {
            name: displayName,
            avatarUrl: avatarUrl || undefined,
          },
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

  async connectTelegramGroup(userId: string, chatIdOrUsername: string) {
    const userTgAccount = await this.prisma.telegramAccount.findFirst({
      where: { userId },
    });

    if (!userTgAccount?.telegramId) {
      throw new BadRequestException('Please link your Telegram account before connecting a Telegram group');
    }

    let query = chatIdOrUsername.trim();
    if (query.startsWith('https://t.me/')) {
      query = query.replace('https://t.me/', '');
    }
    if (query.startsWith('@')) {
      query = query.replace('@', '');
    }

    const chatInfo = await this.telegramService.getChatInfo(query);
    if (!chatInfo || !chatInfo.id) {
      throw new NotFoundException(
        `Telegram group "${query}" was not found or @flowtaskmanager_bot is not added to it. Please add @flowtaskmanager_bot as an Admin to your group first!`
      );
    }

    const chatId = String(chatInfo.id);

    const memberInfo = await this.telegramService.getChatMember(chatId, userTgAccount.telegramId);
    if (!memberInfo || (memberInfo.status !== 'creator' && memberInfo.status !== 'administrator')) {
      throw new ForbiddenException(
        `You must be an Administrator or Creator of "${chatInfo.title || query}" in Telegram to connect it as a workspace.`
      );
    }

    let tgChat = await (this.prisma as any).telegramChat.findUnique({
      where: { chatId },
      include: { workspace: true },
    });

    let workspaceId: string;

    if (!tgChat) {
      const title = chatInfo.title || 'Telegram Team';
      const slug = `tg-${chatId.replace(/[^0-9]/g, '')}-${Date.now().toString(36)}`;
      const newWs = await this.prisma.workspace.create({
        data: {
          name: title,
          slug,
          ownerId: userId,
          type: WorkspaceType.TEAM,
          members: {
            create: {
              userId,
              role: memberInfo.status === 'creator' ? WorkspaceRole.OWNER : WorkspaceRole.ADMIN,
            },
          },
        },
      });

      tgChat = await (this.prisma as any).telegramChat.create({
        data: {
          chatId,
          title,
          type: chatInfo.type || 'group',
          workspaceId: newWs.id,
        },
      });

      workspaceId = newWs.id;
    } else {
      workspaceId = tgChat.workspaceId;
      const isMember = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId, userId },
      });
      if (!isMember) {
        await this.prisma.workspaceMember.create({
          data: {
            workspaceId,
            userId,
            role: memberInfo.status === 'creator' ? WorkspaceRole.OWNER : WorkspaceRole.ADMIN,
          },
        });
      }
    }

    // Sync all members from the group
    const syncRes = await this.syncTelegramGroup(workspaceId, userId);

    return {
      workspaceId,
      telegramChat: tgChat,
      syncResult: syncRes,
    };
  }
}
