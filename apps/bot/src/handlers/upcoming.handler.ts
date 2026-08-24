import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus } from '@flowtask/database';

export async function handleUpcomingTasks(ctx: Context) {
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
  const next7Days = new Date();
  next7Days.setDate(next7Days.getDate() + 7);
  next7Days.setHours(23, 59, 59, 999);

  const tasks = await prisma.task.findMany({
    where: {
      workspaceId,
      status: { not: TaskStatus.DONE },
      dueDate: {
        gte: now,
        lte: next7Days,
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  if (tasks.length === 0) {
    await ctx.reply(
      `🗓 *No tasks due in the next 7 days.*\n\nUse \`/task <title> next monday\` to schedule ahead!`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Group tasks by date string
  const groups = new Map<string, any[]>();
  tasks.forEach((t: any) => {
    const key = new Date(t.dueDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  });

  let message = `🗓 *Upcoming 7-Day Forecast:*\n\n`;
  for (const [dayStr, dayTasks] of groups.entries()) {
    message += `📅 *${dayStr}*\n`;
    dayTasks.forEach((t: any) => {
      const prioIcon = t.priority === 'URGENT' ? '🔴' : t.priority === 'HIGH' ? '🟡' : '⚪';
      const time = new Date(t.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      message += `  • ${prioIcon} ${t.title} _(${time})_\n`;
    });
    message += '\n';
  }

  const keyboard = new InlineKeyboard()
    .text('📝 All Tasks', 'tasks:filter:PENDING:1')
    .text('➕ Add Task', 'action:quick_task');

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}
