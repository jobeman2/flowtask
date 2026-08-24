import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus } from '@flowtask/database';

export async function handleTasksList(ctx: Context, filter: 'PENDING' | 'DONE' | 'ALL' = 'PENDING', page = 1) {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const pageSize = 5;
  const skip = (page - 1) * pageSize;

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
    await ctx.reply('⚠️ Please run /start first to initialize your workspace.');
    return;
  }

  const workspaceId = account.user.workspaceMembers[0].workspaceId;

  // Build where filter
  const where: any = { workspaceId };
  if (filter === 'PENDING') {
    where.status = { not: TaskStatus.DONE };
  } else if (filter === 'DONE') {
    where.status = TaskStatus.DONE;
  }

  const [tasks, totalCount] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.task.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Build response message
  const filterTitle = filter === 'PENDING' ? '⏳ Active Tasks' : filter === 'DONE' ? '✅ Completed Tasks' : '📝 All Tasks';
  let message = `📋 *${filterTitle}* \\(Page ${page}/${totalPages}\\)\n` +
    `🏢 Workspace: _${account.user.workspaceMembers[0].workspace.name}_\n\n`;

  if (tasks.length === 0) {
    message += `_No tasks found in this view\\._\n\n💡 Use \`/task <title>\` to add a new task\\.`;
  } else {
    tasks.forEach((t: any, idx: number) => {
      const num = skip + idx + 1;
      const statusIcon = t.status === TaskStatus.DONE ? '✅' : t.priority === 'URGENT' ? '🔴' : t.priority === 'HIGH' ? '🟡' : '⚪';
      const dueStr = t.dueDate ? ` 📅 ${new Date(t.dueDate).toLocaleDateString()}` : '';
      const cleanTitle = t.title.replace(/[_*[\]()~`>#+-=|{}.!]/g, '\\$&');
      message += `${num}\\. ${statusIcon} *${cleanTitle}*${dueStr}\n`;
    });
  }

  // Keyboard navigation
  const keyboard = new InlineKeyboard();

  // Task item detail selector buttons
  if (tasks.length > 0) {
    const itemButtons = tasks.map((t: any, idx: number) => ({
      text: `${skip + idx + 1}`,
      data: `task:view:${t.id}`,
    }));

    itemButtons.forEach((b: any) => keyboard.text(b.text, b.data));
    keyboard.row();
  }

  // Filter selector tabs
  keyboard
    .text(filter === 'PENDING' ? '• ⏳ Active •' : '⏳ Active', `tasks:filter:PENDING:${page}`)
    .text(filter === 'DONE' ? '• ✅ Done •' : '✅ Done', `tasks:filter:DONE:${page}`)
    .text(filter === 'ALL' ? '• 📝 All •' : '📝 All', `tasks:filter:ALL:${page}`)
    .row();

  // Pagination controls
  if (totalPages > 1) {
    if (page > 1) {
      keyboard.text('⬅️ Prev', `tasks:page:${filter}:${page - 1}`);
    }
    keyboard.text(`${page} / ${totalPages}`, `tasks:page:${filter}:${page}`);
    if (page < totalPages) {
      keyboard.text('Next ➡️', `tasks:page:${filter}:${page + 1}`);
    }
    keyboard.row();
  }

  keyboard.text('➕ Create New Task', 'action:quick_task');

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard,
      });
    } catch {
      await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard,
      });
    }
    await ctx.answerCallbackQuery();
  } else {
    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: keyboard,
    });
  }
}
