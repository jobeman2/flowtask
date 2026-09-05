import { Context, InlineKeyboard } from 'grammy';
import { botConfig } from '../config/bot.config';
import { handleBotAddedToGroup } from './group.handler';
import { prisma, WorkspaceRole, WorkspaceType } from '@flowtask/database';

export async function handleStart(ctx: Context) {
  if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
    return handleBotAddedToGroup(ctx);
  }

  const tgUser = ctx.from;
  if (!tgUser) return;

  const tgIdStr = tgUser.id.toString();
  const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'User';
  const rawUsername = tgUser.username ? tgUser.username.replace(/^@/, '').toLowerCase() : null;

  // 1. Find or create real account in database
  let account = await prisma.telegramAccount.findUnique({
    where: { telegramId: tgIdStr },
    include: { user: true },
  });

  if (!account && rawUsername) {
    account = await prisma.telegramAccount.findFirst({
      where: { username: rawUsername },
      include: { user: true },
    });

    if (account) {
      await prisma.telegramAccount.update({
        where: { id: account.id },
        data: {
          telegramId: tgIdStr,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name || null,
          username: tgUser.username || null,
        },
      });
    }
  }

  let userId: string;

  if (!account) {
    const newUser = await prisma.user.create({
      data: {
        name: displayName,
        timezone: 'UTC',
      },
    });

    const newAcc = await prisma.telegramAccount.create({
      data: {
        telegramId: tgIdStr,
        username: tgUser.username || null,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        userId: newUser.id,
      },
      include: { user: true },
    });

    // Create personal workspace for user
    await prisma.workspace.create({
      data: {
        name: `${tgUser.first_name}'s Workspace`,
        slug: `ws-${tgUser.id}-${Date.now().toString(36)}`,
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

    account = newAcc;
    userId = newUser.id;
  } else {
    userId = account.userId;
    // Keep profile fresh
    await prisma.telegramAccount.update({
      where: { id: account.id },
      data: {
        telegramId: tgIdStr,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        username: tgUser.username || null,
      },
    });
  }

  // 2. Consolidate any placeholder accounts that match this username
  try {
    if (typeof (prisma as any).consolidateUserAccounts === 'function') {
      (prisma as any).consolidateUserAccounts(userId, tgIdStr, rawUsername);
    }
  } catch (err) {
    console.warn('Account consolidation check:', err);
  }

  // 3. Check for invite payload: /start invite_<workspaceId>
  const text = ctx.message?.text || '';
  const param = text.split(' ')[1]?.trim() || '';

  if (param.startsWith('invite_')) {
    const targetWorkspaceId = param.replace('invite_', '');
    const ws = await prisma.workspace.findUnique({ where: { id: targetWorkspaceId } });

    if (ws) {
      // Check if already a member
      const existingMember = await prisma.workspaceMember.findFirst({
        where: { workspaceId: targetWorkspaceId, userId },
      });

      if (!existingMember) {
        // Create active membership
        await prisma.workspaceMember.create({
          data: {
            workspaceId: targetWorkspaceId,
            userId,
            role: WorkspaceRole.MEMBER,
          },
        });
      }

      const isHttps = botConfig.webAppUrl.startsWith('https://');
      const wsUrl = `${botConfig.webAppUrl}?workspaceId=${ws.id}`;
      const inviteKeyboard = new InlineKeyboard();

      if (isHttps) {
        inviteKeyboard.webApp('🚀 Open Workspace in Mini App', wsUrl).row();
      } else {
        inviteKeyboard.url('🚀 Open Workspace in Mini App', 'https://flowtask.app').row();
      }

      inviteKeyboard.text('📊 Today Work', 'action:today_work');

      const safeWsName = ws.name.replace(/[_*[\]()~`>#+-=|{}.!]/g, '\\$&');
      await ctx.reply(
        `🎉 *Welcome to ${safeWsName}\\!*\n\n` +
        `You have joined the workspace team\\. You can now collaborate, view tasks, and receive task assignments directly here in the bot and in the Mini App\\.`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: inviteKeyboard,
        }
      );
      return;
    }
  }

  // 4. Default welcome screen with quick actions
  const keyboard = new InlineKeyboard();
  const isHttps = botConfig.webAppUrl.startsWith('https://');

  if (isHttps) {
    keyboard.webApp('🚀 Open Mini App', botConfig.webAppUrl).row();
  } else {
    keyboard.url('🚀 Open Web App', 'https://flowtask.app').row();
  }

  keyboard
    .text('📝 Quick Task', 'action:quick_task')
    .text('📊 Today Work', 'action:today_work');

  const firstName = (tgUser.first_name || 'there').replace(/[_*[\]()~`>#+-=|{}.!]/g, '\\$&');

  const welcomeText = `👋 *Welcome to FlowTask, ${firstName}\\!*

Turn your Telegram conversations into organized, actionable work\\.

✨ *Quick Guide:*
• Type \`/task <title>\` to quickly create a task\\.
• Forward any message here to turn it into a task\\.
• Use the Mini App below for rich visual task boards, calendar & teams\\.`;

  await ctx.reply(welcomeText, {
    parse_mode: 'MarkdownV2',
    reply_markup: keyboard,
  });
}
