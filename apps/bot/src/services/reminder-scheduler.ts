import { Bot, InlineKeyboard } from 'grammy';
import { prisma, TaskStatus } from '@flowtask/database';

export class ReminderScheduler {
  private timer: NodeJS.Timeout | null = null;
  private bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  public start(intervalMs: number = 30000) {
    if (this.timer) return;
    console.log('⏰ ReminderScheduler started (polling every 30s)...');
    this.timer = setInterval(() => this.checkReminders(), intervalMs);
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

        // Find recipient telegram ID
        const account = await prisma.telegramAccount.findUnique({
          where: { userId: task.creatorId },
        });

        if (account?.telegramId) {
          const keyboard = new InlineKeyboard()
            .text('✅ Done', `task:done:${task.id}`)
            .text('💤 +15m', `remind:snooze:${rem.id}:15m`)
            .text('💤 +1h', `remind:snooze:${rem.id}:1h`)
            .row()
            .text('💤 +1d', `remind:snooze:${rem.id}:1d`)
            .text('ℹ️ Details', `task:view:${task.id}`);

          const dueStr = task.dueDate ? `\n📅 *Due:* ${new Date(task.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';

          try {
            await this.bot.api.sendMessage(
              account.telegramId,
              `⏰ *Task Reminder*\n\n` +
              `📌 *"${task.title}"*` +
              dueStr +
              `\n\n⚡ Status: \`${task.status}\` | Priority: \`${task.priority}\``,
              {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
              }
            );

            // Mark as sent or update status
            await prisma.reminder.update({
              where: { id: rem.id },
              data: { status: 'SENT' },
            });
          } catch (err) {
            console.error(`Failed to dispatch reminder to ${account.telegramId}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Error during reminder check cycle:', err);
    }
  }
}
