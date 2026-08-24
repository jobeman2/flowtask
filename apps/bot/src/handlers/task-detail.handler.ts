import { Context, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus, TaskPriority } from '@flowtask/database';

export async function handleTaskDetail(ctx: Context, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId },
  });

  if (!task) {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'Task not found or deleted.' });
    await ctx.reply('⚠️ Task not found.');
    return;
  }

  const isDone = task.status === TaskStatus.DONE;
  const statusBadge = isDone ? '✅ DONE' : '⏳ IN PROGRESS';
  const prioBadge =
    task.priority === TaskPriority.URGENT ? '🔴 URGENT' :
    task.priority === TaskPriority.HIGH ? '🟡 HIGH' :
    task.priority === TaskPriority.LOW ? '⚪ LOW' : '🔵 MEDIUM';

  const dueStr = task.dueDate
    ? `${new Date(task.dueDate).toLocaleDateString()} ${new Date(task.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'None';

  const recurStr = task.isRecurring ? (task.recurrenceRule || 'Active') : 'Off';

  const message =
    `📌 *Task Details*\n\n` +
    `*Title:* ${task.title}\n` +
    `*Status:* \`${statusBadge}\`\n` +
    `*Priority:* \`${prioBadge}\`\n` +
    `*Due Date:* ${dueStr}\n` +
    `*Recurrence:* \`${recurStr}\`\n`;

  const keyboard = new InlineKeyboard();

  // Primary toggle
  if (isDone) {
    keyboard.text('🔄 Reopen Task', `task:reopen:${task.id}`).row();
  } else {
    keyboard.text('✅ Mark as Completed', `task:done:${task.id}`).row();
  }

  // Setting submenus
  keyboard
    .text('📅 Set Deadline', `task:date_menu:${task.id}`)
    .text('⚡ Set Priority', `task:prio_menu:${task.id}`)
    .row();

  keyboard
    .text('⏰ Remind Me', `task:remind_menu:${task.id}`)
    .text('🔁 Recurrence', `task:recur_menu:${task.id}`)
    .row();

  keyboard
    .text('🗑 Delete Task', `task:delete_confirm:${task.id}`)
    .text('🔙 Back to List', `tasks:filter:PENDING:1`);

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
    await ctx.answerCallbackQuery();
  } else {
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }
}

// Submenu: Date Picker
export async function handleDateMenu(ctx: Context, taskId: string) {
  const keyboard = new InlineKeyboard()
    .text('📅 Today (6 PM)', `task:set_date:${taskId}:today`)
    .text('📅 Tomorrow (6 PM)', `task:set_date:${taskId}:tomorrow`)
    .row()
    .text('📅 In 2 Days', `task:set_date:${taskId}:in2d`)
    .text('📅 Next Monday', `task:set_date:${taskId}:next_mon`)
    .row()
    .text('❌ Remove Deadline', `task:set_date:${taskId}:none`)
    .text('🔙 Back', `task:view:${taskId}`);

  const msg = '📅 *Select a Deadline for this task:*';
  if (ctx.callbackQuery) {
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  }
}

// Submenu: Priority Picker
export async function handlePriorityMenu(ctx: Context, taskId: string) {
  const keyboard = new InlineKeyboard()
    .text('🔴 Urgent', `task:set_prio:${taskId}:URGENT`)
    .text('🟡 High', `task:set_prio:${taskId}:HIGH`)
    .row()
    .text('🔵 Medium', `task:set_prio:${taskId}:MEDIUM`)
    .text('⚪ Low', `task:set_prio:${taskId}:LOW`)
    .row()
    .text('🔙 Back', `task:view:${taskId}`);

  const msg = '⚡ *Select Priority Level:*';
  if (ctx.callbackQuery) {
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  }
}

// Submenu: Reminder Picker
export async function handleReminderMenu(ctx: Context, taskId: string) {
  const keyboard = new InlineKeyboard()
    .text('⏰ In 15 Mins', `task:set_remind:${taskId}:15m`)
    .text('⏰ In 1 Hour', `task:set_remind:${taskId}:1h`)
    .row()
    .text('⏰ Tomorrow Morning', `task:set_remind:${taskId}:tmrw_9am`)
    .text('⏰ 1 Hour Before Due', `task:set_remind:${taskId}:1h_before`)
    .row()
    .text('🔙 Back', `task:view:${taskId}`);

  const msg = '⏰ *Set a Reminder:*';
  if (ctx.callbackQuery) {
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  }
}

// Submenu: Recurrence Picker
export async function handleRecurrenceMenu(ctx: Context, taskId: string) {
  const keyboard = new InlineKeyboard()
    .text('🔁 Daily', `task:set_recur:${taskId}:DAILY`)
    .text('🔁 Weekly', `task:set_recur:${taskId}:WEEKLY`)
    .row()
    .text('🔁 Monthly', `task:set_recur:${taskId}:MONTHLY`)
    .text('❌ Turn Off', `task:set_recur:${taskId}:NONE`)
    .row()
    .text('🔙 Back', `task:view:${taskId}`);

  const msg = '🔁 *Set Recurring Schedule:*';
  if (ctx.callbackQuery) {
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  }
}

// Submenu: Delete Confirmation
export async function handleDeleteConfirm(ctx: Context, taskId: string) {
  const keyboard = new InlineKeyboard()
    .text('⚠️ Yes, Delete', `task:delete_do:${taskId}`)
    .text('❌ Cancel', `task:view:${taskId}`);

  const msg = '⚠️ *Are you sure you want to permanently delete this task?*';
  if (ctx.callbackQuery) {
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  }
}
