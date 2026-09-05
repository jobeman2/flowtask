import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus } from '@flowtask/database';
import { botConfig } from '../config/bot.config';

export async function handleAssignedTasks(ctx: Context) {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const account = await prisma.telegramAccount.findUnique({
    where: { telegramId: tgUser.id.toString() },
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
    await ctx.reply('⚠️ Please open the FlowTask Mini App or run /start first to initialize your account.');
    return;
  }

  // 1. Fetch user's accessible workspaces
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: account.userId },
    include: { workspace: true },
  });
  const workspaceMap = new Map(memberships.map((m: any) => [m.workspaceId, m.workspace?.name || 'Workspace']));

  // 2. Find all active tasks assigned to this user across all their workspaces
  const assignedTasks = await prisma.task.findMany({
    where: {
      assigneeId: account.userId,
      status: { not: TaskStatus.DONE },
      archivedAt: null,
    },
    include: {
      creator: true,
      project: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
  });

  if (assignedTasks.length === 0) {
    const keyboard = new InlineKeyboard()
      .webApp('📱 Open FlowTask Mini App', botConfig.webAppUrl);

    await ctx.reply(
      `📥 *Your Assigned Tasks Inbox*\n\n` +
      `🎉 You're all caught up! You have no pending tasks assigned to you right now.\n\n` +
      `_When teammates delegate tasks to you in any workspace, they will appear here grouped by project._`,
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
    return;
  }

  // 3. Group tasks by workspace
  const grouped = new Map<string, any[]>();
  for (const task of assignedTasks) {
    const list = grouped.get(task.workspaceId) || [];
    list.push(task);
    grouped.set(task.workspaceId, list);
  }

  let text = `📥 *Your Inbox — Assigned Tasks* (${assignedTasks.length} pending in ${grouped.size} workspaces)\n\n`;

  const keyboard = new InlineKeyboard();
  let globalIndex = 1;

  for (const [wsId, tasks] of grouped.entries()) {
    const wsName = String(workspaceMap.get(wsId) || 'Team Workspace');
    text += `🏢 *${escapeMarkdown(wsName)}* (${tasks.length})\n`;

    for (const task of tasks) {
      const priorityIcon =
        task.priority === 'URGENT' ? '🚨' : task.priority === 'HIGH' ? '🔥' : task.priority === 'MEDIUM' ? '⚡' : '☕';
      const dueInfo = task.dueDate
        ? ` • ⏰ ${new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
        : '';
      const creatorName = task.creator?.name ? ` • 👤 from *${task.creator.name}*` : '';

      text += `  ${globalIndex}\\. ${priorityIcon} *${escapeMarkdown(task.title)}*${creatorName}${dueInfo}\n`;

      keyboard
        .text(`✅ #${globalIndex}`, `task:done:${task.id}`)
        .text(`🔍 Details`, `task:view:${task.id}`)
        .row();

      globalIndex++;
    }
    text += `\n`;
  }

  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  if (isGroup) {
    keyboard.url('📱 Open Full Task Board in Mini App', botConfig.webAppUrl);
  } else {
    keyboard.webApp('📱 Open Full Task Board in Mini App', botConfig.webAppUrl);
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
