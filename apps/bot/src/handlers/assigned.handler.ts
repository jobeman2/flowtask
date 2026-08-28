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

  // Find all active tasks assigned to this user across all their workspaces
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
    take: 10,
  });

  if (assignedTasks.length === 0) {
    const keyboard = new InlineKeyboard()
      .webApp('📱 Open FlowTask Mini App', botConfig.webAppUrl);

    await ctx.reply(
      `📥 *Your Assigned Tasks Inbox*\n\n` +
      `🎉 You're all caught up! You have no pending tasks assigned to you right now.\n\n` +
      `_When teammates delegate tasks to you, they will appear here in real-time._`,
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
    return;
  }

  let text = `📥 *Your Assigned Tasks Inbox* (${assignedTasks.length} pending)\n\n`;

  const keyboard = new InlineKeyboard();

  assignedTasks.forEach((task: any, index: number) => {
    const priorityIcon =
      task.priority === 'URGENT' ? '🚨' : task.priority === 'HIGH' ? '🔥' : task.priority === 'MEDIUM' ? '⚡' : '☕';
    const dueInfo = task.dueDate
      ? ` • ⏰ Due ${new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
      : '';
    const creatorName = task.creator?.name ? ` • 👤 from *${task.creator.name}*` : '';

    text += `${index + 1}\\. ${priorityIcon} *${escapeMarkdown(task.title)}*${creatorName}${dueInfo}\n`;

    keyboard
      .text(`✅ Done: #${index + 1}`, `task:done:${task.id}`)
      .text(`🔍 Details`, `task:view:${task.id}`)
      .row();
  });

  keyboard.webApp('📱 Open Full Task Board in Mini App', botConfig.webAppUrl);

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
