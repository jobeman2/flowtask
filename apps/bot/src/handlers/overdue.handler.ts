import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus } from '@flowtask/database';

export async function handleOverdueTasks(ctx: Context) {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const account = await prisma.telegramAccount.findUnique({
    where: { telegramId: tgUser.id.toString() },
    include: {
      user: {
        include: {
          workspaceMembers: {
            take: 1,
            include: { workspace: true },
          },
        },
      },
    },
  });

  if (!account || !account.user.workspaceMembers.length) {
    await ctx.reply('⚠️ Please run /start first.');
    return;
  }

  const workspaceId = account.user.workspaceMembers[0].workspaceId;
  const now = new Date();

  const tasks = await prisma.task.findMany({
    where: {
      workspaceId,
      status: { not: TaskStatus.DONE },
      dueDate: {
        lt: now,
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  if (tasks.length === 0) {
    await ctx.reply(`✨ *Awesome! You have no overdue tasks.*`, { parse_mode: 'Markdown' });
    return;
  }

  let message = `⚠️ *Overdue Tasks (${tasks.length}):*\n\n`;
  const keyboard = new InlineKeyboard();

  tasks.forEach((t: any, idx: number) => {
    const prioIcon = t.priority === 'URGENT' ? '🔴' : t.priority === 'HIGH' ? '🟡' : '⚪';
    const dueFormatted = t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '';
    message += `${idx + 1}. ${prioIcon} *${t.title}* _(Due: ${dueFormatted})_\n`;

    keyboard
      .text(`✅ Done #${idx + 1}`, `task:done:${t.id}`)
      .text(`📅 To Today`, `task:set_date:${t.id}:today`)
      .row();
  });

  keyboard.text('🔙 View Active Tasks', 'tasks:filter:PENDING:1');

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}
