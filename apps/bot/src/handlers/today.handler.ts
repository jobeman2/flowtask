import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus } from '@flowtask/database';

export async function handleTodayTasks(ctx: Context) {
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

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const tasks = await prisma.task.findMany({
    where: {
      workspaceId,
      status: { not: TaskStatus.DONE },
      dueDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  if (tasks.length === 0) {
    await ctx.reply(
      `🎉 *No tasks due today!*\n\n` +
      `Your schedule is clear. Use \`/task <title>\` to add something or \`/upcoming\` to look ahead.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  let message = `📅 *Tasks Due Today (${new Date().toLocaleDateString()}):*\n\n`;
  const keyboard = new InlineKeyboard();

  tasks.forEach((t: any, idx: number) => {
    const prioIcon = t.priority === 'URGENT' ? '🔴' : t.priority === 'HIGH' ? '🟡' : '🔵';
    const timeStr = t.dueDate ? `[${new Date(t.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]` : '';
    message += `${idx + 1}. ${prioIcon} *${t.title}* ${timeStr}\n`;

    keyboard
      .text(`✅ #${idx + 1} Done`, `task:done:${t.id}`)
      .text(`ℹ️ View`, `task:view:${t.id}`)
      .row();
  });

  keyboard.text('🔙 All Tasks', 'tasks:filter:PENDING:1');

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}
