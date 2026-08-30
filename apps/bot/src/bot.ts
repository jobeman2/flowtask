import { Bot, InlineKeyboard } from 'grammy';
import { botConfig } from './config/bot.config';
import { handleStart } from './handlers/start.handler';
import { handleHelp } from './handlers/help.handler';
import { handleTaskCommand } from './handlers/task.handler';
import { handleTasksList } from './handlers/tasks.handler';
import {
  handleTaskDetail,
  handleDateMenu,
  handlePriorityMenu,
  handleReminderMenu,
  handleRecurrenceMenu,
  handleDeleteConfirm,
} from './handlers/task-detail.handler';
import { handleTodayTasks } from './handlers/today.handler';
import { handleOverdueTasks } from './handlers/overdue.handler';
import { handleUpcomingTasks } from './handlers/upcoming.handler';
import { handleWorkspaceCommand, handleWorkspaceSwitch, handleWorkspaceCreate } from './handlers/workspace.handler';
import { handleTeamCommand } from './handlers/team.handler';
import { handleAssignedTasks } from './handlers/assigned.handler';
import { handleInlineQuery } from './handlers/inline.handler';
import { handleLeaderboard, handleStats } from './handlers/leaderboard.handler';
import { handleBoardCommand, handleProjectsList } from './handlers/board.handler';
import {
  handleBotAddedToGroup,
  handleGroupInfo,
  handleGroupSummary,
  resolveGroupWorkspace,
} from './handlers/group.handler';
import { ReminderScheduler } from './services/reminder-scheduler';
import { prisma, TaskStatus, TaskPriority } from '@flowtask/database';

export function createBot() {
  if (!botConfig.token) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN is not set. Bot will run in mock mode.');
  }

  const bot = new Bot(botConfig.token || 'mock_token_for_dev');
  const scheduler = new ReminderScheduler(bot);
  scheduler.start();

  // --- GROUP EVENTS ---
  bot.on('message:new_chat_members', handleBotAddedToGroup);
  bot.on('my_chat_member', handleBotAddedToGroup);
  bot.on('chat_member', handleBotAddedToGroup);

  // Auto-sync any group sender as a team member
  bot.use(async (ctx, next) => {
    if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
      const tgUser = ctx.from;
      if (tgUser && !tgUser.is_bot) {
        try {
          await resolveGroupWorkspace(ctx, tgUser);
        } catch {
          // Ignore
        }
      }
    }
    await next();
  });

  // --- COMMAND ROUTES ---
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command(['task', 'create', 'add', 'todo'], handleTaskCommand);
  bot.command('tasks', (ctx) => handleTasksList(ctx, 'PENDING', 1));
  bot.command(['assigned', 'inbox', 'mytasks'], handleAssignedTasks);
  bot.command(['group', 'info'], handleGroupInfo);
  bot.command(['board', 'kanban'], handleBoardCommand);
  bot.command(['projects', 'project', 'milestones'], handleProjectsList);
  bot.command(['summary', 'standup'], handleGroupSummary);
  bot.command('today', handleTodayTasks);
  bot.command('overdue', handleOverdueTasks);
  bot.command('upcoming', handleUpcomingTasks);
  bot.command('team', handleTeamCommand);
  bot.command(['leaderboard', 'leaders', 'top'], handleLeaderboard);
  bot.command(['stats', 'analytics'], handleStats);
  bot.command(['workspace', 'workspaces', 'switch'], handleWorkspaceCommand);

  // Direct quick complete command: /done <id>
  bot.command(['done', 'complete'], async (ctx) => {
    const raw = ctx.message?.text?.replace(/^\/(done|complete)(@\w+)?\s*/i, '').trim();
    if (!raw) {
      await ctx.reply('⚠️ Please provide a task ID.\nExample: `/done task_123`', { parse_mode: 'Markdown' });
      return;
    }
    const task = await prisma.task.findFirst({ where: { id: raw } });
    if (!task) {
      await ctx.reply('⚠️ Task not found.');
      return;
    }
    await prisma.task.update({
      where: { id: task.id },
      data: { status: TaskStatus.DONE, completedAt: new Date() },
    });
    await ctx.reply(`✅ *Task Completed:* "${task.title}"`, { parse_mode: 'Markdown' });
  });

  // --- CALLBACK QUERY DISPATCHER ---

  // 1. Navigation & Quick Actions
  bot.callbackQuery('action:quick_task', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `📝 *Create a Task*\n\nType \`/task <title>\` with smart tags:\n` +
      `Example: \`/task Finalize client deck !urgent tomorrow 4pm\``,
      { parse_mode: 'Markdown' }
    );
  });

  bot.callbackQuery('action:today_work', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleTodayTasks(ctx);
  });

  bot.callbackQuery('action:workspace_menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleWorkspaceCommand(ctx);
  });

  bot.callbackQuery('action:group_summary', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleGroupSummary(ctx);
  });

  // 2. Task List Filtering & Pagination (tasks:filter:<filter>:<page> | tasks:page:<filter>:<page>)
  bot.callbackQuery(/^tasks:(filter|page):(\w+):(\d+)$/, async (ctx) => {
    const filter = ctx.match[2] as 'PENDING' | 'DONE' | 'ALL';
    const page = parseInt(ctx.match[3], 10);
    await handleTasksList(ctx, filter, page);
  });

  // 3. Task Detail View (task:view:<id>)
  bot.callbackQuery(/^task:view:(.+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    await handleTaskDetail(ctx, taskId);
  });

  // 4. Mark Done & Next Recurrence (task:done:<id>)
  bot.callbackQuery(/^task:done:(.+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const task = await prisma.task.findFirst({ where: { id: taskId } });

    if (!task) {
      await ctx.answerCallbackQuery({ text: 'Task not found.' });
      return;
    }

    const tgUser = ctx.from;
    if (tgUser) {
      let account = await prisma.telegramAccount.findUnique({
        where: { telegramId: tgUser.id.toString() },
      });

      if (!account && tgUser.username) {
        account = await prisma.telegramAccount.findFirst({
          where: { username: tgUser.username },
        });
      }

      const userId = account?.userId;

      if (userId && task.assigneeId && task.assigneeId !== userId) {
        let targetName = 'the assigned teammate';
        const assigneeAcc = await prisma.telegramAccount.findFirst({
          where: { userId: task.assigneeId },
        });
        if (assigneeAcc?.username) {
          targetName = `@${assigneeAcc.username}`;
        } else if (assigneeAcc?.firstName) {
          targetName = assigneeAcc.firstName;
        }

        await ctx.answerCallbackQuery({
          text: `🚫 Only ${targetName} can mark this task as done because it is assigned to them.`,
          show_alert: true,
        });
        return;
      }
    }

    if (task.status === TaskStatus.DONE) {
      await ctx.answerCallbackQuery({ text: 'This task is already completed.' });
      return;
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.DONE, completedAt: new Date() },
    });

    // If recurring task, spawn next deterministic occurrence
    if (task.isRecurring && task.recurrenceRule) {
      let nextDue: Date | null = null;
      const baseDate = task.dueDate ? new Date(task.dueDate) : new Date();

      if (task.recurrenceRule === 'DAILY') {
        nextDue = new Date(baseDate.getTime() + 86400000);
      } else if (task.recurrenceRule === 'WEEKLY' || task.recurrenceRule.startsWith('WEEKLY:')) {
        nextDue = new Date(baseDate.getTime() + 7 * 86400000);
      } else if (task.recurrenceRule === 'MONTHLY') {
        nextDue = new Date(baseDate.getTime());
        nextDue.setMonth(nextDue.getMonth() + 1);
      }

      if (nextDue) {
        await prisma.task.create({
          data: {
            workspaceId: task.workspaceId,
            projectId: task.projectId,
            title: task.title,
            priority: task.priority,
            status: TaskStatus.TODO,
            dueDate: nextDue,
            isRecurring: true,
            recurrenceRule: task.recurrenceRule,
            parentTaskId: task.id,
            creatorId: task.creatorId,
          },
        });
      }
    }

    const completerName = tgUser?.first_name || tgUser?.username || 'Teammate';
    await ctx.answerCallbackQuery({ text: '✅ Task completed!' });

    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
    if (isGroup) {
      try {
        await ctx.editMessageReplyMarkup({
          reply_markup: new InlineKeyboard()
            .text(`✅ Completed by ${completerName}`, `task:done_info:${taskId}`)
            .row()
            .url('📱 Open in FlowTask Mini App', botConfig.webAppUrl),
        });
      } catch {
        // Ignore edit markup error
      }
    } else {
      await handleTaskDetail(ctx, taskId);
    }
  });

  // 5. Reopen Task (task:reopen:<id>)
  bot.callbackQuery(/^task:reopen:(.+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    await prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.TODO, completedAt: null },
    });
    await ctx.answerCallbackQuery({ text: '🔄 Task reopened!' });
    await handleTaskDetail(ctx, taskId);
  });

  // 6. Submenus: Date, Priority, Reminders, Recurrence, Delete
  bot.callbackQuery(/^task:date_menu:(.+)$/, (ctx) => handleDateMenu(ctx, ctx.match[1]));
  bot.callbackQuery(/^task:prio_menu:(.+)$/, (ctx) => handlePriorityMenu(ctx, ctx.match[1]));
  bot.callbackQuery(/^task:remind_menu:(.+)$/, (ctx) => handleReminderMenu(ctx, ctx.match[1]));
  bot.callbackQuery(/^task:recur_menu:(.+)$/, (ctx) => handleRecurrenceMenu(ctx, ctx.match[1]));
  bot.callbackQuery(/^task:delete_confirm:(.+)$/, (ctx) => handleDeleteConfirm(ctx, ctx.match[1]));

  // 7. Set Date Action (task:set_date:<id>:<dateCode>)
  bot.callbackQuery(/^task:set_date:(.+):(\w+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const code = ctx.match[2];

    let newDate: Date | null = null;
    const now = new Date();

    if (code === 'today') {
      newDate = new Date();
      newDate.setHours(18, 0, 0, 0);
    } else if (code === 'tomorrow') {
      newDate = new Date(now.getTime() + 86400000);
      newDate.setHours(18, 0, 0, 0);
    } else if (code === 'in2d') {
      newDate = new Date(now.getTime() + 2 * 86400000);
      newDate.setHours(18, 0, 0, 0);
    } else if (code === 'next_mon') {
      newDate = new Date();
      const day = newDate.getDay();
      const diff = (1 - day + 7) % 7 || 7;
      newDate.setDate(newDate.getDate() + diff);
      newDate.setHours(18, 0, 0, 0);
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { dueDate: newDate },
    });

    await ctx.answerCallbackQuery({ text: newDate ? '📅 Deadline updated!' : 'Deadline removed.' });
    await handleTaskDetail(ctx, taskId);
  });

  // 8. Set Priority Action (task:set_prio:<id>:<prio>)
  bot.callbackQuery(/^task:set_prio:(.+):(\w+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const priority = ctx.match[2] as TaskPriority;

    await prisma.task.update({
      where: { id: taskId },
      data: { priority },
    });

    await ctx.answerCallbackQuery({ text: `⚡ Priority set to ${priority}!` });
    await handleTaskDetail(ctx, taskId);
  });

  // 9. Set Reminder Action (task:set_remind:<id>:<code>)
  bot.callbackQuery(/^task:set_remind:(.+):(.+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const code = ctx.match[2];

    const task = await prisma.task.findFirst({ where: { id: taskId } });
    if (!task) return;

    let remindAt = new Date();
    if (code === '15m') remindAt = new Date(Date.now() + 15 * 60000);
    else if (code === '1h') remindAt = new Date(Date.now() + 60 * 60000);
    else if (code === 'tmrw_9am') {
      remindAt = new Date(Date.now() + 86400000);
      remindAt.setHours(9, 0, 0, 0);
    } else if (code === '1h_before' && task.dueDate) {
      remindAt = new Date(new Date(task.dueDate).getTime() - 60 * 60000);
    }

    await prisma.reminder.create({
      data: {
        taskId,
        remindAt,
        type: 'CUSTOM',
      },
    });

    await ctx.answerCallbackQuery({ text: '⏰ Reminder scheduled!' });
    await handleTaskDetail(ctx, taskId);
  });

  // 10. Set Recurrence Action (task:set_recur:<id>:<rule>)
  bot.callbackQuery(/^task:set_recur:(.+):(\w+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const rule = ctx.match[2];

    const isRecurring = rule !== 'NONE';
    await prisma.task.update({
      where: { id: taskId },
      data: {
        isRecurring,
        recurrenceRule: isRecurring ? rule : null,
      },
    });

    await ctx.answerCallbackQuery({ text: isRecurring ? `🔁 Recurring set to ${rule}!` : 'Recurrence turned off.' });
    await handleTaskDetail(ctx, taskId);
  });

  // 11. Delete Task Action (task:delete_do:<id>)
  bot.callbackQuery(/^task:delete_do:(.+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    await prisma.task.delete({ where: { id: taskId } });

    await ctx.answerCallbackQuery({ text: '🗑 Task deleted.' });
    await handleTasksList(ctx, 'PENDING', 1);
  });

  // 12. Workspace Switch & Create (ws:switch:<id> | ws:create:<type>)
  bot.callbackQuery(/^ws:switch:(.+)$/, (ctx) => handleWorkspaceSwitch(ctx, ctx.match[1]));
  bot.callbackQuery(/^ws:create:(TEAM|CLIENT)$/, (ctx) => handleWorkspaceCreate(ctx, ctx.match[1] as 'TEAM' | 'CLIENT'));

  // 13. Snooze Reminder (remind:snooze:<id>:<duration>)
  bot.callbackQuery(/^remind:snooze:(.+):(15m|1h|1d)$/, async (ctx) => {
    const remId = ctx.match[1];
    const duration = ctx.match[2];

    const offsetMs = duration === '15m' ? 15 * 60000 : duration === '1h' ? 60 * 60000 : 24 * 3600000;
    const snoozedUntil = new Date(Date.now() + offsetMs);

    await prisma.reminder.update({
      where: { id: remId },
      data: {
        status: 'PENDING',
        snoozedUntil,
        snoozeCount: { increment: 1 },
      },
    });

    await ctx.answerCallbackQuery({ text: `💤 Snoozed for ${duration}!` });
    await ctx.editMessageText(
      `💤 *Reminder Snoozed for ${duration}*\n\nWill alert you again at: ${snoozedUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      { parse_mode: 'Markdown' }
    );
  });

  // 14. Accept Workspace Invite (invite:accept:<workspaceId>:<memberId>)
  bot.callbackQuery(/^invite:accept:(.+):(.+)$/, async (ctx) => {
    const workspaceId = ctx.match[1];
    const memberId = ctx.match[2];

    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      await ctx.answerCallbackQuery({ text: 'Workspace no longer exists.' });
      return;
    }

    const fromTgId = String(ctx.from?.id);
    const tgAcc = await prisma.telegramAccount.findFirst({ where: { telegramId: fromTgId } });
    
    if (memberId && memberId !== 'new') {
      try {
        await (prisma as any).workspaceMember.update({
          where: { id: memberId },
          data: { role: 'MEMBER' },
        });
      } catch {
        // Fallback
      }
    } else if (tgAcc?.userId) {
      try {
        await prisma.workspaceMember.create({
          data: {
            workspaceId,
            userId: tgAcc.userId,
            role: 'MEMBER',
          },
        });
      } catch {
        // Fallback
      }
    }

    await ctx.answerCallbackQuery({ text: '🎉 Invitation accepted!' });
    const webAppUrl = botConfig.webAppUrl || 'http://localhost:3000';
    await ctx.editMessageText(
      `🎉 *Invitation Accepted!*\n\nYou are now an active member of *${ws.name}*.\nYou can now view, collaborate, and manage tasks together!`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Open in FlowTask Mini App', web_app: { url: webAppUrl } }],
          ],
        },
      }
    );
  });

  // 15. Decline Workspace Invite (invite:decline:<workspaceId>:<memberId>)
  bot.callbackQuery(/^invite:decline:(.+):(.+)$/, async (ctx) => {
    const workspaceId = ctx.match[1];
    const memberId = ctx.match[2];

    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });

    if (memberId && memberId !== 'new') {
      try {
        await (prisma as any).workspaceMember.delete({
          where: { id: memberId },
        });
      } catch {
        // Fallback
      }
    }

    await ctx.answerCallbackQuery({ text: 'Invitation declined.' });
    await ctx.editMessageText(
      `❌ *Invitation Declined*\n\nYou declined the invitation to join *${ws?.name || 'the workspace'}*.`,
      { parse_mode: 'Markdown' }
    );
  });

  // Board refresh callback
  bot.callbackQuery('board:refresh', handleBoardCommand);

  // 16. Inline Query Handler (@flowtaskmanager_bot <query>)
  bot.on('inline_query', handleInlineQuery);

  // Global Error Handler
  bot.catch((err) => {
    console.error('Error in Telegram bot execution:', err);
  });

  return bot;
}
