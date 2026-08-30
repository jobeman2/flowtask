import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus } from '@flowtask/database';
import { resolveGroupWorkspace } from './group.handler';
import { botConfig } from '../config/bot.config';

export async function handleTasksList(ctx: Context, filter: 'PENDING' | 'DONE' | 'ALL' = 'PENDING', page = 1) {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const pageSize = 5;
  const skip = (page - 1) * pageSize;

  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  const workspace = await resolveGroupWorkspace(ctx, tgUser);
  const workspaceId = workspace.id;

  const account = await prisma.telegramAccount.findUnique({
    where: { telegramId: tgUser.id.toString() },
  });

  const member = account
    ? await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId: account.userId },
      })
    : null;

  const isOwnerOrAdmin = member?.role === 'OWNER' || member?.role === 'ADMIN' || workspace.ownerId === account?.userId;

  // Build where filter
  const where: any = { workspaceId, archivedAt: null };

  // If in group and not admin, restrict view strictly to tasks assigned to this user
  if (isGroup && !isOwnerOrAdmin && account?.userId) {
    where.assigneeId = account.userId;
  }

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
      include: { assignee: true, creator: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.task.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Build response message
  const filterTitle = filter === 'PENDING' ? '⏳ Active Tasks' : filter === 'DONE' ? '✅ Completed Tasks' : '📝 All Tasks';
  const privacyNotice = isGroup && !isOwnerOrAdmin ? `🔒 _Personal View \\(Only tasks assigned to you\\)_\n` : '';
  let message = `📋 *${filterTitle}* \\(Page ${page}/${totalPages}\\)\n` +
    `🏢 Workspace: _${escapeMarkdown(workspace.name)}_\n` +
    `${privacyNotice}\n`;

  if (tasks.length === 0) {
    message += `_No tasks found in this view\\._\n\n💡 Use \`/task <title>\` to add a new task\\.`;
  } else {
    tasks.forEach((t: any, idx: number) => {
      const globalIdx = skip + idx + 1;
      const statusIcon = t.status === TaskStatus.DONE ? '✅' : '⬜';
      const priorityIcon =
        t.priority === 'URGENT' ? '🚨' : t.priority === 'HIGH' ? '🔥' : t.priority === 'MEDIUM' ? '⚡' : '☕';

      const dueInfo = t.dueDate
        ? ` • ⏰ ${new Date(t.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
        : '';

      const assigneeInfo = t.assignee?.name ? ` • 👤 *${escapeMarkdown(t.assignee.name)}*` : '';

      message += `${globalIdx}\\. ${statusIcon} ${priorityIcon} *${escapeMarkdown(t.title)}*${assigneeInfo}${dueInfo}\n`;
    });
  }

  // Build Inline Keyboard
  const keyboard = new InlineKeyboard();

  if (tasks.length > 0 && filter === 'PENDING') {
    // Quick complete buttons for top tasks on this page
    const actionRow = tasks.slice(0, 3).map((t: any, idx: number) => {
      return InlineKeyboard.text(`✅ #${skip + idx + 1}`, `task:done:${t.id}`);
    });
    keyboard.row(...actionRow);
  }

  // Pagination buttons
  const navRow = [];
  if (page > 1) {
    navRow.push(InlineKeyboard.text('⬅️ Prev', `tasks:page:${filter}:${page - 1}`));
  }
  if (page < totalPages) {
    navRow.push(InlineKeyboard.text('Next ➡️', `tasks:page:${filter}:${page + 1}`));
  }
  if (navRow.length > 0) {
    keyboard.row(...navRow);
  }

  // Filter Switching Buttons
  keyboard.row(
    InlineKeyboard.text(filter === 'PENDING' ? '• Active •' : 'Active', `tasks:filter:PENDING:1`),
    InlineKeyboard.text(filter === 'DONE' ? '• Done •' : 'Done', `tasks:filter:DONE:1`),
    InlineKeyboard.text(filter === 'ALL' ? '• All •' : 'All', `tasks:filter:ALL:1`)
  );

  if (isGroup) {
    keyboard.row().url('📱 Open in FlowTask Mini App', botConfig.webAppUrl);
  } else {
    keyboard.row().webApp('📱 Open in FlowTask Mini App', botConfig.webAppUrl);
  }

  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: keyboard,
    });
  } else {
    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: keyboard,
    });
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
