import { Context, InlineKeyboard } from 'grammy';
import { botConfig } from '../config/bot.config';
import { handleBotAddedToGroup } from './group.handler';

export async function handleStart(ctx: Context) {
  if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
    return handleBotAddedToGroup(ctx);
  }

  const user = ctx.from;
  if (!user) return;

  const keyboard = new InlineKeyboard();

  // Telegram requires HTTPS for WebApp buttons
  const isHttps = botConfig.webAppUrl.startsWith('https://');
  if (isHttps) {
    keyboard.webApp('🚀 Open Mini App', botConfig.webAppUrl).row();
  } else {
    keyboard.url('🚀 Open Web App', 'https://flowtask.app').row();
  }

  keyboard
    .text('📝 Quick Task', 'action:quick_task')
    .text('📊 Today Work', 'action:today_work');

  const firstName = (user.first_name || 'there').replace(/[_*[\]()~`>#+-=|{}.!]/g, '\\$&');

  const welcomeText = `👋 *Welcome to FlowTask, ${firstName}\\!*

Turn your Telegram conversations into organized, actionable work\\.

✨ *Quick Guide:*
• Type \`/task <title>\` to quickly create a task\\.
• Forward any message here to turn it into a task\\.
• Use the Mini App below for rich visual task boards, calendar & teams\\.`;

  await ctx.reply(welcomeText, {
    parse_mode: 'MarkdownV2',
    reply_markup: keyboard,
  });
}
