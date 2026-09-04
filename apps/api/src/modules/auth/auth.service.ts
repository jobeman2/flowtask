import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { validateTelegramWebAppData } from './telegram-auth.util';
import { AuthSession } from '@flowtask/types';
import { WorkspaceType, WorkspaceRole } from '@flowtask/database';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private telegramService: TelegramService
  ) {}

  async validateAndAuthenticateTelegramUser(initData: string): Promise<AuthSession> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    // In development mode or test account mode, allow mock / dev fallback
    let validated = validateTelegramWebAppData(initData, botToken);
    if (!validated && (nodeEnv === 'development' || initData.startsWith('dev_user_') || initData.startsWith('dev_mock_'))) {
      if (initData.startsWith('dev_user_jovany') || initData.startsWith('dev_user_jobeman')) {
        validated = {
          user: {
            id: 6854918950,
            first_name: 'Jovany',
            username: 'jobeman',
            language_code: 'en',
            photo_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=jobeman',
          },
          authDate: new Date(),
        };
      } else if (initData.startsWith('dev_user_tumim') || initData.startsWith('dev_user_tuma')) {
        validated = {
          user: {
            id: 8139244394,
            first_name: 'Tumim',
            username: 'tuma124',
            language_code: 'en',
            photo_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=tuma124',
          },
          authDate: new Date(),
        };
      } else if (initData.startsWith('dev_mock_') || initData.startsWith('dev_user_')) {
        const rawSuffix = initData.replace(/^dev_(mock|user)_/, '') || '1';
        const numId = parseInt(rawSuffix, 10);
        const userIdNum = !isNaN(numId) && numId > 0
          ? (numId < 10000 ? 1000000000 + numId : numId)
          : Math.abs(rawSuffix.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0));
        validated = {
          user: {
            id: userIdNum,
            first_name: rawSuffix.charAt(0).toUpperCase() + rawSuffix.slice(1),
            last_name: 'Tester',
            username: `dev_user_${rawSuffix}`,
            language_code: 'en',
            photo_url: `https://api.dicebear.com/7.x/bottts/svg?seed=dev_${rawSuffix}`,
          },
          authDate: new Date(),
        };
      }
    }

    if (!validated) {
      throw new UnauthorizedException('Invalid or expired Telegram authentication signature');
    }

    const { user: tgUser, authDate } = validated;
    const telegramIdStr = tgUser.id.toString();
    const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || `User ${tgUser.id}`;

    // Find existing telegram account by telegramId
    let telegramAccount = await this.prisma.telegramAccount.findUnique({
      where: { telegramId: telegramIdStr },
      include: {
        user: {
          include: {
            workspaceMembers: {
              include: { workspace: true },
            },
          },
        },
      },
    });

    // If not found by telegramId, check if pre-invited by username
    if (!telegramAccount && tgUser.username) {
      telegramAccount = await this.prisma.telegramAccount.findFirst({
        where: { username: tgUser.username },
        include: {
          user: {
            include: {
              workspaceMembers: {
                include: { workspace: true },
              },
            },
          },
        },
      });

      if (telegramAccount) {
        // Link real telegramId and sync profile
        await this.prisma.telegramAccount.update({
          where: { id: telegramAccount.id },
          data: {
            telegramId: telegramIdStr,
            firstName: tgUser.first_name,
            lastName: tgUser.last_name || null,
            languageCode: tgUser.language_code || null,
            authDate,
          },
        });
        await this.prisma.user.update({
          where: { id: telegramAccount.userId },
          data: {
            name: displayName,
            avatarUrl: tgUser.photo_url || undefined,
          },
        });
        this.logger.log(`Linked pre-invited username @${tgUser.username} to Telegram ID ${telegramIdStr}`);
      }
    }

    let userId: string;
    let defaultWorkspaceId: string | undefined;

    if (!telegramAccount) {
      // Create User, TelegramAccount, and default personal Workspace inside a transaction
      const createdData = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name: displayName,
            avatarUrl: tgUser.photo_url || null,
            timezone: 'UTC',
          },
        });

        const newTgAccount = await tx.telegramAccount.create({
          data: {
            telegramId: telegramIdStr,
            username: tgUser.username || null,
            firstName: tgUser.first_name,
            lastName: tgUser.last_name || null,
            languageCode: tgUser.language_code || null,
            isBot: tgUser.is_bot || false,
            userId: newUser.id,
            authDate: authDate,
          },
        });

        const slug = `${tgUser.username || tgUser.first_name || 'workspace'}-${Date.now().toString(36)}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
        const newWorkspace = await tx.workspace.create({
          data: {
            name: `${displayName}'s Workspace`,
            slug,
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

        return { user: newUser, tgAccount: newTgAccount, workspace: newWorkspace };
      });

      userId = createdData.user.id;
      defaultWorkspaceId = createdData.workspace.id;
      this.logger.log(`Created new user from Telegram ID ${telegramIdStr}: User ${userId}`);
    } else {
      userId = telegramAccount.user.id;

      // Ensure user has and defaults to their own personal workspace
      const personalMembership = telegramAccount.user.workspaceMembers.find(
        (m: any) => m.workspace?.type === WorkspaceType.PERSONAL && m.role === WorkspaceRole.OWNER
      );

      if (personalMembership) {
        defaultWorkspaceId = personalMembership.workspaceId;
      } else {
        // Provision personal workspace for this user if missing
        const slug = `${tgUser.username || tgUser.first_name || 'workspace'}-${Date.now().toString(36)}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
        const newWorkspace = await this.prisma.workspace.create({
          data: {
            name: `${displayName}'s Workspace`,
            slug,
            ownerId: userId,
            type: WorkspaceType.PERSONAL,
            members: {
              create: {
                userId,
                role: WorkspaceRole.OWNER,
              },
            },
          },
        });
        defaultWorkspaceId = newWorkspace.id;
      }

      // Update telegram metadata
      await this.prisma.telegramAccount.update({
        where: { id: telegramAccount.id },
        data: {
          username: tgUser.username || null,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name || null,
          authDate,
        },
      });
      if (displayName) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { name: displayName },
        });
      }
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      telegramId: telegramIdStr,
    });

    // Resolve user's best active subscription so front-end knows their plan immediately
    let userSubscription: { planCode: string; status: string; currentPeriodEnd: Date | null } | null = null;
    try {
      const ownedWs = await this.prisma.workspace.findMany({ where: { ownerId: userId }, select: { id: true } });
      const activeSub = await this.prisma.subscription.findFirst({
        where: {
          OR: [
            { userId },
            { workspaceId: { in: ownedWs.map((w) => w.id) } },
          ],
          status: 'ACTIVE',
          plan: { code: { not: 'FREE' } },
        },
        include: { plan: true },
        orderBy: { currentPeriodEnd: 'desc' },
      });
      if (activeSub) {
        userSubscription = {
          planCode: activeSub.plan?.code || 'FREE',
          status: activeSub.status,
          currentPeriodEnd: activeSub.currentPeriodEnd,
        };
      }
    } catch {
      // Non-critical — fallback to FREE shown on frontend
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        timezone: user.timezone,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken,
      defaultWorkspaceId,
      subscription: userSubscription,
    };
  }

  async getSession(userId: string): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        telegramAccounts: true,
        workspaceMembers: {
          take: 1,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      telegramId: user.telegramAccounts[0]?.telegramId,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        timezone: user.timezone,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      telegramAccount: user.telegramAccounts[0] || null,
      accessToken,
      defaultWorkspaceId: user.workspaceMembers[0]?.workspaceId,
    };
  }
}
