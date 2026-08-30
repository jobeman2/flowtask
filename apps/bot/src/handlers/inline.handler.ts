import { Context, InlineQueryResultBuilder, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus } from '@flowtask/database';
import { botConfig } from '../config/bot.config';

export async function handleInlineQuery(ctx: Context): Promise<void> {
  const query = ctx.inlineQuery?.query?.trim() || '';
  const tgUser = ctx.inlineQuery?.from;
  if (!tgUser) return;

  const account = await prisma.telegramAccount.findUnique({
    where: { telegramId: tgUser.id.toString() },
  });

  if (!account) {
    const notAuthResult = InlineQueryResultBuilder.article(
      'not_auth',
      '⚠️ FlowTask: Account Not Connected',
      {
        description: 'Tap /start in bot or open Mini App to connect your account.',
      }
    ).text(
      `👋 *Welcome to FlowTask!*\n\nPlease start [@${ctx.me?.username || 'flowtaskmanager_bot'}](https://t.me/${ctx.me?.username || 'flowtaskmanager_bot'}) or open the Mini App to sync your tasks.`,
      { parse_mode: 'Markdown' }
    );

    await ctx.answerInlineQuery([notAuthResult], { cache_time: 5 });
    return;
  }

  // Fetch workspaces the user is a member of
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: account.userId },
    include: { workspace: true },
  });
  const workspaceIds = memberships.map((m: any) => m.workspaceId);

  const results: any[] = [];

  // 1. Quick Action: Share Active Assigned Tasks
  const myAssignedTasks = await prisma.task.findMany({
    where: {
      assigneeId: account.userId,
      status: { not: TaskStatus.DONE },
      archivedAt: null,
    },
    include: { creator: true, project: true },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });

  if (query === '' || query.toLowerCase() === 'my' || query.toLowerCase() === 'inbox') {
    if (myAssignedTasks.length > 0) {
      // Summary card of all assigned tasks
      let summaryText = `📋 *My Assigned Tasks (${myAssignedTasks.length} Pending)*\n\n`;
      myAssignedTasks.forEach((t: any, idx: number) => {
        const pIcon = t.priority === 'URGENT' ? '🚨' : t.priority === 'HIGH' ? '🔥' : t.priority === 'MEDIUM' ? '⚡' : '☕';
        const dueStr = t.dueDate ? ` • ⏰ ${new Date(t.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : '';
        summaryText += `${idx + 1}\\. ${pIcon} *${escapeMarkdown(t.title)}*${dueStr}\n`;
      });
      summaryText += `\n_Managed with FlowTask_`;

      const summaryKeyboard = new InlineKeyboard().url('📱 Open FlowTask Mini App', botConfig.webAppUrl);

      results.push(
        InlineQueryResultBuilder.article('my_tasks_summary', `📋 Share My Pending Tasks (${myAssignedTasks.length})`, {
          description: `Drop a list of all your ${myAssignedTasks.length} pending tasks into this chat.`,
          reply_markup: summaryKeyboard,
        }).text(summaryText, { parse_mode: 'Markdown' })
      );
    }
  }

  // 2. Individual Task Cards (matching query or recent)
  const searchFilter = query && query.toLowerCase() !== 'my' && query.toLowerCase() !== 'inbox'
    ? {
        workspaceId: { in: workspaceIds },
        title: { contains: query, mode: 'insensitive' as const },
        archivedAt: null,
      }
    : {
        workspaceId: { in: workspaceIds },
        status: { not: TaskStatus.DONE },
        archivedAt: null,
      };

  const tasks = await prisma.task.findMany({
    where: searchFilter,
    include: { creator: true, assignee: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  tasks.forEach((task: any) => {
    const pIcon = task.priority === 'URGENT' ? '🚨' : task.priority === 'HIGH' ? '🔥' : task.priority === 'MEDIUM' ? '⚡' : '☕';
    const statusText = task.status === TaskStatus.DONE ? '✅ Done' : '⏳ In Progress';
    const dueStr = task.dueDate
      ? `\n⏰ *Due:* ${new Date(task.dueDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      : '';
    const assigneeStr = task.assignee?.name ? `\n👤 *Assigned to:* ${task.assignee.name}` : '';
    const creatorStr = task.creator?.name ? `\n👑 *Created by:* ${task.creator.name}` : '';

    const cardText =
      `📌 *Task Card: ${escapeMarkdown(task.title)}*\n\n` +
      `${pIcon} *Priority:* \`${task.priority}\`\n` +
      `📊 *Status:* \`${statusText}\`` +
      `${assigneeStr}` +
      `${creatorStr}` +
      `${dueStr}\n\n` +
      `_Shared via FlowTask Inline_`;

    const taskKeyboard = new InlineKeyboard()
      .text('✅ Mark Done', `task:done:${task.id}`)
      .row()
      .url('📱 Open in FlowTask Mini App', botConfig.webAppUrl);

    results.push(
      InlineQueryResultBuilder.article(`task_${task.id}`, `${pIcon} ${task.title}`, {
        description: `Priority: ${task.priority} | Status: ${task.status} ${task.assignee?.name ? `| @${task.assignee.name}` : ''}`,
        reply_markup: taskKeyboard,
      }).text(cardText, { parse_mode: 'Markdown' })
    );
  });

  // 3. Fallback / Create Prompt if query was typed
  if (query.startsWith('new ') || query.startsWith('add ')) {
    const rawTitle = query.replace(/^(new|add)\s+/i, '').trim();
    if (rawTitle) {
      results.unshift(
        InlineQueryResultBuilder.article('quick_create_prompt', `✨ Quick Action: /task ${rawTitle}`, {
          description: `Tap to send "/task ${rawTitle}" into the chat for instant creation`,
        }).text(`/task ${rawTitle}`)
      );
    }
  }

  if (results.length === 0) {
    results.push(
      InlineQueryResultBuilder.article('no_tasks', '🔍 No matching tasks found', {
        description: `Type "@${ctx.me?.username || 'flowtaskmanager_bot'} new <Task Name>" to create one.`,
      }).text(`Type \`/task <title>\` to create your first task in FlowTask!`, { parse_mode: 'Markdown' })
    );
  }

  await ctx.answerInlineQuery(results, { cache_time: 2, is_personal: true });
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
