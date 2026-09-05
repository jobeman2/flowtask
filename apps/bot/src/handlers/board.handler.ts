import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus } from '@flowtask/database';
import { botConfig } from '../config/bot.config';

export async function handleBoardCommand(ctx: Context) {
  const telegramId = String(ctx.from?.id);
  if (!telegramId) return;

  const user = await prisma.user.findFirst({
    where: { telegramId },
    include: {
      workspaces: {
        include: {
          workspace: true,
        },
      },
    },
  });

  if (!user || user.workspaces.length === 0) {
    return ctx.reply('⚠️ No workspace found. Start with /start to initialize your Flow board.');
  }

  const workspace = user.workspaces[0].workspace;

  const tasks = await prisma.task.findMany({
    where: {
      workspaceId: workspace.id,
      status: { not: TaskStatus.CANCELLED },
    },
    include: {
      assignee: true,
      project: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const todo = tasks.filter((t: any) => t.status === TaskStatus.TODO);
  const inProgress = tasks.filter((t: any) => t.status === TaskStatus.IN_PROGRESS);
  const inReview = tasks.filter((t: any) => t.status === (TaskStatus as any).IN_REVIEW || (t.status as any) === 'IN_REVIEW');
  const done = tasks.filter((t: any) => t.status === TaskStatus.DONE);

  let msg = `📌 <b>${workspace.name} — Live Kanban Board</b>\n\n`;

  // To Do
  msg += `⚪ <b>To Do (${todo.length}):</b>\n`;
  if (todo.length === 0) msg += `  <i>(No tasks)</i>\n`;
  else {
    todo.slice(0, 3).forEach((t: any) => {
      msg += `  • ${t.title} ${t.assignee ? `(@${t.assignee.name})` : ''}\n`;
    });
    if (todo.length > 3) msg += `  <i>...and ${todo.length - 3} more</i>\n`;
  }
  msg += `\n`;

  // In Progress
  msg += `🟡 <b>In Progress (${inProgress.length}):</b>\n`;
  if (inProgress.length === 0) msg += `  <i>(No tasks)</i>\n`;
  else {
    inProgress.slice(0, 3).forEach((t: any) => {
      msg += `  • ${t.title} ${t.assignee ? `(@${t.assignee.name})` : ''}\n`;
    });
    if (inProgress.length > 3) msg += `  <i>...and ${inProgress.length - 3} more</i>\n`;
  }
  msg += `\n`;

  // In Review
  if (inReview.length > 0) {
    msg += `🟣 <b>In Review (${inReview.length}):</b>\n`;
    inReview.slice(0, 3).forEach((t: any) => {
      msg += `  • ${t.title} ${t.assignee ? `(@${t.assignee.name})` : ''}\n`;
    });
    msg += `\n`;
  }

  // Done
  msg += `🟢 <b>Completed (${done.length})</b>\n\n`;
  msg += `<i>Open Mini App for interactive drag-and-drop & timeline views.</i>`;

  const keyboard = new InlineKeyboard()
    .webApp('🚀 Open Interactive Board', botConfig.webAppUrl)
    .row()
    .text('🔄 Refresh', 'board:refresh');

  return ctx.reply(msg, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

export async function handleProjectsList(ctx: Context) {
  const telegramId = String(ctx.from?.id);
  if (!telegramId) return;

  const user = await prisma.user.findFirst({
    where: { telegramId },
    include: {
      workspaces: {
        include: {
          workspace: true,
        },
      },
    },
  });

  if (!user || user.workspaces.length === 0) {
    return ctx.reply('⚠️ No workspace found. Start with /start to set up your workspace.');
  }

  const workspace = user.workspaces[0].workspace;

  const projects = await prisma.project.findMany({
    where: { workspaceId: workspace.id },
    include: {
      tasks: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (projects.length === 0) {
    const keyboard = new InlineKeyboard().webApp('➕ Create First Project', botConfig.webAppUrl);
    return ctx.reply(
      `📁 <b>${workspace.name} Projects</b>\n\nNo projects created yet. Open the Mini App to create milestone boards.`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
  }

  let msg = `📁 <b>${workspace.name} Projects & Milestones</b>\n\n`;

  projects.forEach((p: any) => {
    const total = p.tasks.length;
    const completed = p.tasks.filter((t: any) => t.status === TaskStatus.DONE).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    msg += `🏷️ <b>${p.name}</b>\n`;
    if (p.description) msg += `  <i>${p.description}</i>\n`;
    msg += `  📊 Progress: <b>${percent}%</b> (${completed}/${total} tasks)\n\n`;
  });

  const keyboard = new InlineKeyboard()
    .webApp('🚀 Manage in Mini App', botConfig.webAppUrl);

  return ctx.reply(msg, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}
