import { Bot, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus } from '@flowtask/database';
import { botConfig } from '../config/bot.config';

export class ReminderScheduler {
  private timer: NodeJS.Timeout | null = null;
  private bot: Bot;
  private alertedTaskIds = new Set<string>();

  constructor(bot: Bot) {
    this.bot = bot;
  }

  public start(intervalMs: number = 30000) {
    if (this.timer) return;
    console.log('⏰ ReminderScheduler & Due Date Monitor started (polling every 30s)...');
    this.timer = setInterval(() => {
      this.checkReminders();
      this.checkDueDateAlarms();
    }, intervalMs);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async checkReminders() {
    const now = new Date();

    try {
      // Find all pending reminders that are ready to fire
      const pending = await prisma.reminder.findMany({
        where: {
          status: 'PENDING',
          remindAt: { lte: now },
        },
      });

      for (const rem of pending) {
        // If it was snoozed and snooze time hasn't passed, skip
        if (rem.snoozedUntil && new Date(rem.snoozedUntil) > now) {
          continue;
        }

        const task = await prisma.task.findFirst({
          where: { id: rem.taskId },
        });

        if (!task || task.status === TaskStatus.DONE) {
          await prisma.reminder.update({
            where: { id: rem.id },
            data: { status: 'CANCELLED' },
          });
          continue;
        }

        // Find recipient telegram ID (assignee or creator)
        const recipientUserId = task.assigneeId || task.creatorId;
        const account = await prisma.telegramAccount.findUnique({
          where: { userId: recipientUserId },
        });

        if (account?.telegramId) {
          const keyboard = new InlineKeyboard()
            .text('✅ Done', `task:done:${task.id}`)
            .text('💤 +15m', `remind:snooze:${rem.id}:15m`)
            .text('💤 +1h', `remind:snooze:${rem.id}:1h`)
            .row()
            .url('📱 Open in FlowTask Mini App', botConfig.webAppUrl);

          const dueStr = task.dueDate
            ? `\n📅 *Due:* ${new Date(task.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : '';

          try {
            await this.bot.api.sendMessage(
              account.telegramId,
              `⏰ *Task Reminder Alert*\n\n` +
                `📌 *"${task.title}"*` +
                dueStr +
                `\n\n⚡ Status: \`${task.status}\` | Priority: \`${task.priority}\``,
              {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
              }
            );

            // Mark as sent
            await prisma.reminder.update({
              where: { id: rem.id },
              data: { status: 'SENT' },
            });
          } catch (err: any) {
            console.error(`Failed to dispatch reminder to ${account.telegramId}:`, err.message);
          }
        }
      }
    } catch (err: any) {
      console.error('Error during reminder check cycle:', err.message);
    }
  }

  public async checkDueDateAlarms() {
    const now = new Date();
    const oneHourAhead = new Date(now.getTime() + 60 * 60 * 1000);

    try {
      const approachingTasks = await prisma.task.findMany({
        where: {
          status: { not: TaskStatus.DONE },
          dueDate: { gte: now, lte: oneHourAhead },
          archivedAt: null,
        },
      });

      for (const task of approachingTasks) {
        const key = `${task.id}_1h_alarm`;
        if (this.alertedTaskIds.has(key)) continue;

        const recipientUserId = task.assigneeId || task.creatorId;
        const account = await prisma.telegramAccount.findUnique({
          where: { userId: recipientUserId },
        });

        if (account?.telegramId) {
          const minutesLeft = Math.max(1, Math.round((new Date(task.dueDate!).getTime() - now.getTime()) / 60000));
          const keyboard = new InlineKeyboard()
            .text('✅ Mark Done', `task:done:${task.id}`)
            .row()
            .url('📱 Open in FlowTask Mini App', botConfig.webAppUrl);

          try {
            await this.bot.api.sendMessage(
              account.telegramId,
              `🚨 *Deadline Alert — Due in ${minutesLeft} Minutes!*\n\n` +
                `📝 *Task:* *${task.title}*\n` +
                `⚡ *Priority:* \`${task.priority}\`\n` +
                `⏰ *Deadline:* ${new Date(task.dueDate!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n\n` +
                `_Tap below when completed!_`,
              { parse_mode: 'Markdown', reply_markup: keyboard }
            );
            this.alertedTaskIds.add(key);
          } catch (err: any) {
            console.warn(`Could not dispatch deadline alarm to ${account.telegramId}:`, err.message);
          }
        }
      }
    } catch (err: any) {
      console.error('Error in due date alarm cycle:', err.message);
    }
  }
}
