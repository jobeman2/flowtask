import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus, WorkspaceType, WorkspaceRole } from '@flowtask/database';
import { botConfig } from '../config/bot.config';

/**
 * Resolves or auto-provisions a Team Workspace for a Telegram Group.
 * If called in private chat, returns the user's primary workspace.
 */
export async function resolveGroupWorkspace(ctx: Context, tgUser?: any) {
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

  if (!tgUser) {
    tgUser = ctx.from || (ctx as any).senderChat || (ctx as any).myChatMember?.from || (ctx as any).chatMember?.from || { id: 'admin', first_name: 'Admin' };
  }

  const tgIdStr = (tgUser.id || ctx.chat?.id || 'admin').toString();
  const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.title || tgUser.username || (ctx.chat && 'title' in ctx.chat ? ctx.chat.title : 'User');

  // 1. Ensure user account exists
  let account = await prisma.telegramAccount.findUnique({
    where: { telegramId: tgIdStr },
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

  if (!account) {
    const user = await prisma.user.create({
      data: {
        name: displayName,
      },
    });

    account = await prisma.telegramAccount.create({
      data: {
        telegramId: tgIdStr,
        username: tgUser.username || null,
        firstName: displayName,
        lastName: tgUser.last_name || null,
        userId: user.id,
      },
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
  }

  if (!isGroup) {
    // Private chat: return active or first workspace
    if (account.user.workspaceMembers.length > 0) {
      return account.user.workspaceMembers[0].workspace;
    }
    // Create personal workspace if none
    const newWs = await prisma.workspace.create({
      data: {
        name: `${tgUser.first_name}'s Workspace`,
        slug: `ws-${tgUser.id}-${Date.now().toString(36)}`,
        ownerId: account.userId,
        type: WorkspaceType.PERSONAL,
        members: {
          create: {
            userId: account.userId,
            role: WorkspaceRole.OWNER,
          },
        },
      },
    });
    return newWs;
  }

  // 2. Group Chat: Find or Create Team Workspace linked to this group
  const chatIdStr = ctx.chat!.id.toString();
  const groupTitle = ctx.chat && 'title' in ctx.chat ? ctx.chat.title : 'Team Group';

  let tgChat = await prisma.telegramChat.findFirst({
    where: { chatId: chatIdStr },
  });

  let groupWorkspace: any = null;

  if (tgChat && tgChat.workspaceId) {
    groupWorkspace = await prisma.workspace.findUnique({
      where: { id: tgChat.workspaceId },
    });
  }

  if (!groupWorkspace) {
    // Auto-create a Team Workspace for this Telegram Group
    const slug = `grp-${Math.abs(ctx.chat!.id).toString(36)}-${Date.now().toString(36)}`;
    groupWorkspace = await prisma.workspace.create({
      data: {
        name: `${groupTitle} Board`,
        slug,
        ownerId: account.userId,
        type: WorkspaceType.TEAM,
        members: {
          create: {
            userId: account.userId,
            role: WorkspaceRole.ADMIN,
          },
        },
      },
    });

    if (tgChat) {
      await prisma.telegramChat.update({
        where: { id: tgChat.id },
        data: { workspaceId: groupWorkspace.id, title: groupTitle },
      });
    } else {
      await prisma.telegramChat.create({
        data: {
          chatId: chatIdStr,
          workspaceId: groupWorkspace.id,
          type: ctx.chat!.type,
          title: groupTitle,
        },
      });
    }
  }

  // 3. Ensure the current sender is a member of the group workspace
  const isMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: groupWorkspace.id,
      userId: account.userId,
    },
  });

  if (!isMember) {
    await prisma.workspaceMember.create({
      data: {
        workspaceId: groupWorkspace.id,
        userId: account.userId,
        role: WorkspaceRole.MEMBER,
      },
    });
  }

  // 4. Auto-import group administrators from Telegram
  try {
    const admins = await ctx.api.getChatAdministrators(ctx.chat!.id);
    for (const admin of admins) {
      if (admin.user.is_bot) continue;
      const adminTgId = admin.user.id.toString();
      const adminName = [admin.user.first_name, admin.user.last_name].filter(Boolean).join(' ') || admin.user.username || 'Team Member';

      let adminAcc = await prisma.telegramAccount.findUnique({
        where: { telegramId: adminTgId },
        include: { user: true },
      });

      if (!adminAcc) {
        const u = await prisma.user.create({ data: { name: adminName } });
        adminAcc = await prisma.telegramAccount.create({
          data: {
            telegramId: adminTgId,
            username: admin.user.username || null,
            firstName: admin.user.first_name,
            lastName: admin.user.last_name || null,
            userId: u.id,
          },
          include: { user: true },
        });
      }

      const existingMem = await prisma.workspaceMember.findFirst({
        where: { workspaceId: groupWorkspace.id, userId: adminAcc.userId },
      });

      if (!existingMem) {
        await prisma.workspaceMember.create({
          data: {
            workspaceId: groupWorkspace.id,
            userId: adminAcc.userId,
            role: admin.status === 'creator' ? WorkspaceRole.OWNER : WorkspaceRole.ADMIN,
          },
        });
      }
    }
  } catch (err: any) {
    console.warn('Could not auto-fetch group admins:', err.message);
  }

  return groupWorkspace;
}

/**
 * Greets the group when the bot is added or initialized.
 */
export async function handleBotAddedToGroup(ctx: Context) {
  const tgUser = ctx.from || (ctx as any).myChatMember?.from || (ctx as any).chatMember?.from;
  if (!tgUser) return;

  const workspace = await resolveGroupWorkspace(ctx, tgUser);

  const keyboard = new InlineKeyboard()
    .url('📱 Open Group Mini App', botConfig.webAppUrl)
    .row()
    .text('📋 Active Tasks', 'tasks:filter:PENDING:1')
    .text('📊 Team Summary', 'action:group_summary');

  await ctx.reply(
    `👥 *FlowTask Group Task Board Initialized!*\n\n` +
    `🏢 *Workspace:* *${escapeMarkdown(workspace.name)}*\n` +
    `This Telegram group is now synced with your team's collaborative task board.\n\n` +
    `🚀 *Group Commands:*\n` +
    `• \`/task <title> [@member] [!priority] [due date]\` — Add task\n` +
    `• *Reply* to any group message with \`/task\` to turn it into a task\n` +
    `• \`/tasks\` — List all active group tasks\n` +
    `• \`/mytasks\` or \`/assigned\` — View tasks assigned to you\n` +
    `• \`/summary\` — Daily standup and workload report\n` +
    `• \`/done <id>\` — Quick-complete a task\n\n` +
    `_Tip: Tag teammates with @username to assign tasks instantly!_`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
}

/**
 * Shows group information and task metrics.
 */
export async function handleGroupInfo(ctx: Context) {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const workspace = await resolveGroupWorkspace(ctx, tgUser);
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    include: { user: true },
  });

  const pendingTasks = await prisma.task.count({
    where: { workspaceId: workspace.id, status: { not: TaskStatus.DONE }, archivedAt: null },
  });

  const completedTasks = await prisma.task.count({
    where: { workspaceId: workspace.id, status: TaskStatus.DONE },
  });

  const keyboard = new InlineKeyboard()
    .url('📱 Open Group Mini App', botConfig.webAppUrl)
    .row()
    .text('📋 View Tasks', 'tasks:filter:PENDING:1');

  await ctx.reply(
    `🏢 *Group Workspace:* *${escapeMarkdown(workspace.name)}*\n\n` +
    `👥 *Team Members:* ${members.length}\n` +
    `⏳ *Active Tasks:* ${pendingTasks}\n` +
    `✅ *Completed Tasks:* ${completedTasks}\n\n` +
    `_Use \`/task <title>\` to add action items for your team!_`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
}

/**
 * Generates a standup / workload summary for the group.
 */
export async function handleGroupSummary(ctx: Context) {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const workspace = await resolveGroupWorkspace(ctx, tgUser);

  const activeTasks = await prisma.task.findMany({
    where: {
      workspaceId: workspace.id,
      status: { not: TaskStatus.DONE },
      archivedAt: null,
    },
    include: {
      assignee: true,
      creator: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });

  if (activeTasks.length === 0) {
    const keyboard = new InlineKeyboard().url('📱 Open Mini App', botConfig.webAppUrl);
    await ctx.reply(
      `📊 *Group Task Summary — ${escapeMarkdown(workspace.name)}*\n\n` +
      `🎉 *Zero pending tasks!* Everything is done.\n\n` +
      `_Type \`/task <title>\` to create a new action item._`,
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
    return;
  }

  let text = `📊 *Group Standup & Task Summary*\n` +
    `🏢 *${escapeMarkdown(workspace.name)}* (${activeTasks.length} active tasks)\n\n`;

  const keyboard = new InlineKeyboard();

  activeTasks.forEach((task: any, index: number) => {
    const priorityIcon =
      task.priority === 'URGENT' ? '🚨' : task.priority === 'HIGH' ? '🔥' : task.priority === 'MEDIUM' ? '⚡' : '☕';
    const assigneeStr = task.assignee?.name ? ` • 👤 *${task.assignee.name}*` : ' • 👤 _Unassigned_';
    const dueStr = task.dueDate ? ` • ⏰ ${new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : '';

    text += `${index + 1}\\. ${priorityIcon} *${escapeMarkdown(task.title)}*${assigneeStr}${dueStr}\n`;

    if (index < 5) {
      keyboard.text(`✅ #${index + 1}`, `task:done:${task.id}`);
    }
  });

  keyboard.row().url('📱 Open Group Board in Mini App', botConfig.webAppUrl);

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
