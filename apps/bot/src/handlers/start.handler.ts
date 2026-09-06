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

  // 3. Check for invite payload: /start invite_<id>
  const text = ctx.message?.text || '';
  const param = text.split(' ')[1]?.trim() || '';

  if (param.startsWith('invite_')) {
    const invitePayload = param.replace('invite_', '');
    // Check if invitePayload is an invitation ID or workspace ID
    let inv = await (prisma as any).workspaceInvitation.findUnique({
      where: { id: invitePayload },
      include: { workspace: true },
    });

    if (!inv) {
      // Check if it's a workspace ID directly
      inv = await (prisma as any).workspaceInvitation.findFirst({
        where: {
          workspaceId: invitePayload,
          status: 'PENDING',
          OR: [
            { inviteeUserId: userId },
            { targetTelegramId: tgIdStr },
            ...(rawUsername ? [{ targetUsername: rawUsername }] : []),
          ],
        },
        include: { workspace: true },
      });
    }

    if (inv && inv.workspace) {
      const invKeyboard = new InlineKeyboard()
        .text('✅ Accept Invitation', `invite:accept:${inv.workspaceId}:${inv.id}`)
        .text('❌ Decline', `invite:decline:${inv.workspaceId}:${inv.id}`)
        .row();

      if (botConfig.webAppUrl.startsWith('https://')) {
        invKeyboard.webApp('📱 View in Mini App', botConfig.webAppUrl);
      }

      await ctx.reply(
        `👋 *Workspace Team Invitation!*\n\n` +
        `You have been invited to join *${inv.workspace.name}* as \`${inv.role}\`.\n\n` +
        `Click *Accept Invitation* below to join the team and access tasks!`,
        {
          parse_mode: 'Markdown',
          reply_markup: invKeyboard,
        }
      );
      return;
    }
  }

  // 4. Always check if user has any pending invitations across all workspaces!
  const pendingInvitations = await (prisma as any).workspaceInvitation.findMany({
    where: {
      status: 'PENDING',
      OR: [
        { inviteeUserId: userId },
        { targetTelegramId: tgIdStr },
        ...(rawUsername ? [{ targetUsername: rawUsername }] : []),
      ],
    },
    include: {
      workspace: true,
      inviter: true,
    },
  });

  if (pendingInvitations && pendingInvitations.length > 0) {
    for (const pInv of pendingInvitations) {
      if (!pInv.workspace) continue;
      const invKeyboard = new InlineKeyboard()
        .text('✅ Accept Invitation', `invite:accept:${pInv.workspaceId}:${pInv.id}`)
        .text('❌ Decline', `invite:decline:${pInv.workspaceId}:${pInv.id}`)
        .row();

      if (botConfig.webAppUrl.startsWith('https://')) {
        invKeyboard.webApp('📱 View in Mini App', botConfig.webAppUrl);
      }

      const inviterName = pInv.inviter?.name || 'A teammate';
      await ctx.reply(
        `📬 *Pending Workspace Invitation!*\n\n` +
        `🏢 *Workspace:* *${pInv.workspace.name}*\n` +
        `🛡️ *Role:* \`${pInv.role}\`\n` +
        `👤 *Invited by:* *${inviterName}*\n\n` +
        `Would you like to accept this invitation and join the workspace?`,
        {
          parse_mode: 'Markdown',
          reply_markup: invKeyboard,
        }
      );
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
