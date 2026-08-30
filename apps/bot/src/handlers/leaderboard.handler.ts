import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus } from '@flowtask/database';
import { botConfig } from '../config/bot.config';

export async function handleLeaderboard(ctx: Context): Promise<void> {
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  const tgUser = ctx.from;
  if (!tgUser) return;

  let activeWorkspaceId: string | null = null;
  let workspaceName = 'Team Workspace';

  if (isGroup && ctx.chat) {
    const groupChat = await prisma.telegramChat.findUnique({
      where: { chatId: ctx.chat.id.toString() },
      include: { workspace: true },
    });
    if (groupChat?.workspaceId) {
      activeWorkspaceId = groupChat.workspaceId;
      workspaceName = groupChat.workspace?.name || groupChat.title || 'Group Board';
    }
  }

  if (!activeWorkspaceId) {
    const account = await prisma.telegramAccount.findUnique({
      where: { telegramId: tgUser.id.toString() },
    });
    if (account?.userId) {
      const membership = await prisma.workspaceMember.findFirst({
        where: { userId: account.userId },
        include: { workspace: true },
        orderBy: { createdAt: 'asc' },
      });
      if (membership) {
        activeWorkspaceId = membership.workspaceId;
        workspaceName = membership.workspace?.name || 'Your Workspace';
      }
    }
  }

  if (!activeWorkspaceId) {
    await ctx.reply('⚠️ No active workspace found. Please run /start or open the Mini App.');
    return;
  }

  // Calculate stats for the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const completedTasks = await prisma.task.findMany({
    where: {
      workspaceId: activeWorkspaceId,
      status: TaskStatus.DONE,
      updatedAt: { gte: sevenDaysAgo },
    },
    include: {
      assignee: true,
      creator: true,
    },
  });

  const allActiveTasks = await prisma.task.findMany({
    where: {
      workspaceId: activeWorkspaceId,
      status: { not: TaskStatus.DONE },
      archivedAt: null,
    },
  });

  // Tally by user
  const userCounts = new Map<string, { name: string; completed: number }>();

  for (const t of completedTasks) {
    const personName = t.assignee?.name || t.creator?.name || 'Teammate';
    const current = userCounts.get(personName) || { name: personName, completed: 0 };
    current.completed += 1;
    userCounts.set(personName, current);
  }

  const sortedLeaders = Array.from(userCounts.values()).sort((a, b) => b.completed - a.completed);

  const totalClosed = completedTasks.length;
  const totalOpen = allActiveTasks.length;
  const totalAll = totalClosed + totalOpen;
  const completionRate = totalAll > 0 ? Math.round((totalClosed / totalAll) * 100) : 0;

  let text = `🏆 *Weekly Productivity Leaderboard*\n`;
  text += `🏢 *${escapeMarkdown(workspaceName)}* (Last 7 Days)\n\n`;

  if (sortedLeaders.length === 0) {
    text += `_No tasks completed in the last 7 days yet._\n`;
    text += `_Complete tasks to earn a spot on the leaderboard!_\n\n`;
  } else {
    const medals = ['🥇', '🥈', '🥉', '🎖️', '🎖️'];
    sortedLeaders.slice(0, 5).forEach((leader, idx) => {
      const medal = medals[idx] || '•';
      text += `${medal} *${escapeMarkdown(leader.name)}*: *${leader.completed}* tasks completed\n`;
    });
    text += `\n`;
  }

  text += `📊 *Team Velocity & Momentum:*\n`;
  text += `• ✅ *Completed (7d):* \`${totalClosed}\` tasks\n`;
  text += `• ⏳ *Currently Pending:* \`${totalOpen}\` tasks\n`;
  text += `• 🎯 *Completion Rate:* \`${completionRate}%\`\n`;

  const keyboard = new InlineKeyboard();
  if (isGroup) {
    keyboard.url('📱 Open Full Analytics in Mini App', botConfig.webAppUrl);
  } else {
    keyboard.webApp('📱 Open Full Analytics in Mini App', botConfig.webAppUrl);
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

export async function handleStats(ctx: Context): Promise<void> {
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  const tgUser = ctx.from;
  if (!tgUser) return;

  let activeWorkspaceId: string | null = null;
  let workspaceName = 'Team Workspace';

  if (isGroup && ctx.chat) {
    const groupChat = await prisma.telegramChat.findUnique({
      where: { chatId: ctx.chat.id.toString() },
      include: { workspace: true },
    });
    if (groupChat?.workspaceId) {
      activeWorkspaceId = groupChat.workspaceId;
      workspaceName = groupChat.workspace?.name || groupChat.title || 'Group Board';
    }
  }

  if (!activeWorkspaceId) {
    const account = await prisma.telegramAccount.findUnique({
      where: { telegramId: tgUser.id.toString() },
    });
    if (account?.userId) {
      const membership = await prisma.workspaceMember.findFirst({
        where: { userId: account.userId },
        include: { workspace: true },
      });
      if (membership) {
        activeWorkspaceId = membership.workspaceId;
        workspaceName = membership.workspace?.name || 'Your Workspace';
      }
    }
  }

  if (!activeWorkspaceId) {
    await ctx.reply('⚠️ No active workspace found. Please run /start or open the Mini App.');
    return;
  }

  const tasks = await prisma.task.findMany({
    where: { workspaceId: activeWorkspaceId, archivedAt: null },
  });

  const total = tasks.length;
  const done = tasks.filter((t: any) => t.status === TaskStatus.DONE).length;
  const inProgress = tasks.filter((t: any) => t.status === TaskStatus.IN_PROGRESS).length;
  const todo = tasks.filter((t: any) => t.status === TaskStatus.TODO).length;

  const urgent = tasks.filter((t: any) => t.priority === 'URGENT' && t.status !== TaskStatus.DONE).length;
  const high = tasks.filter((t: any) => t.priority === 'HIGH' && t.status !== TaskStatus.DONE).length;
  const medium = tasks.filter((t: any) => t.priority === 'MEDIUM' && t.status !== TaskStatus.DONE).length;
  const low = tasks.filter((t: any) => t.priority === 'LOW' && t.status !== TaskStatus.DONE).length;

  const now = new Date();
  const overdue = tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.DONE).length;

  let text = `📊 *Workspace Productivity Overview*\n`;
  text += `🏢 *${escapeMarkdown(workspaceName)}*\n\n`;

  text += `📈 *Task Breakdown:*\n`;
  text += `• Total Tasks: *${total}*\n`;
  text += `• ✅ Completed: *${done}*\n`;
  text += `• 🔄 In Progress: *${inProgress}*\n`;
  text += `• ⏳ To Do: *${todo}*\n`;
  if (overdue > 0) {
    text += `• 🚨 *Overdue:* *${overdue}* tasks\n`;
  }
  text += `\n`;

  text += `⚡ *Pending Priority Distribution:*\n`;
  text += `• 🚨 Urgent: *${urgent}*\n`;
  text += `• 🔥 High: *${high}*\n`;
  text += `• ⚡ Medium: *${medium}*\n`;
  text += `• ☕ Low: *${low}*\n`;

  const keyboard = new InlineKeyboard();
  if (isGroup) {
    keyboard.url('📱 Open Mini App Board', botConfig.webAppUrl);
  } else {
    keyboard.webApp('📱 Open Mini App Board', botConfig.webAppUrl);
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
