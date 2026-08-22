import { Bot } from 'grammy';
import { botConfig } from './config/bot.config';
import { handleStart } from './handlers/start.handler';
import { handleHelp } from './handlers/help.handler';
import { handleTaskCommand } from './handlers/task.handler';

export function createBot() {
  if (!botConfig.token) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN is not set. Bot will run in mock mode.');
  }

  const bot = new Bot(botConfig.token || 'mock_token_for_dev');

  // Command handlers
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('task', handleTaskCommand);

  // Callback query handlers
  bot.callbackQuery('action:quick_task', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('Send `/task <title>` or type any message to create a task.', { parse_mode: 'Markdown' });
  });

  bot.callbackQuery('action:today_work', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('📅 Open the Mini App to view your schedule for today.');
  });

  // Catch errors
  bot.catch((err) => {
    console.error('Error in Telegram bot execution:', err);
  });

  return bot;
}
