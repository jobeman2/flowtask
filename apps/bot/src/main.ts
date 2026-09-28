import { createBot } from './bot';
import { botConfig } from './config/bot.config';

async function bootstrap() {
  if (!botConfig.token) {
    console.warn('⚠️ FlowTask Bot: No TELEGRAM_BOT_TOKEN provided. Skipping polling start.');
    return;
  }

  const bot = createBot();
  console.info('🤖 Starting FlowTask Telegram Bot runner in long-polling mode...');
  await bot.start({
    onStart: async (botInfo) => {
      console.info(`✅ FlowTask Bot @${botInfo.username} is active and listening!`);

      // Register bot command list shown in Telegram's / menu
      try {
        await bot.api.setMyCommands([
          { command: 'task', description: 'Create a task: /task Prepare report !high tomorrow' },
          { command: 'tasks', description: 'List your pending tasks' },
          { command: 'today', description: "Show today's tasks" },
          { command: 'assigned', description: 'Tasks assigned to you' },
          { command: 'upcoming', description: 'View upcoming tasks this week' },
          { command: 'overdue', description: 'View overdue tasks' },
          { command: 'board', description: 'Show Kanban board summary' },
          { command: 'meeting', description: 'Schedule a meeting: /meeting Tomorrow 3pm Sprint Review' },
          { command: 'team', description: 'View your team members' },
          { command: 'leaderboard', description: 'Weekly productivity leaderboard' },
          { command: 'stats', description: 'Workspace task analytics' },
          { command: 'ai', description: 'AI Project Manager: /ai Launch Telebirr payments (PRO)' },
          { command: 'workspace', description: 'Manage your workspaces' },
          { command: 'help', description: 'Show all available commands' },
        ]);
        console.info('📋 Bot commands registered with Telegram.');
      } catch (e) {
        console.warn('Could not register bot commands:', e);
      }

      // Set Telegram chat menu button to open Mini App
      if (botConfig.webAppUrl.startsWith('https://')) {
        try {
          await bot.api.setChatMenuButton({
            menu_button: {
              type: 'web_app',
              text: '🚀 FlowTask App',
              web_app: { url: botConfig.webAppUrl },
            },
          });
          console.info(`🔗 Telegram Chat Menu Button configured with WebApp URL: ${botConfig.webAppUrl}`);
        } catch (e) {
          console.warn('Could not set chat menu button:', e);
        }
      }
    },
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error starting Telegram bot:', err);
  process.exit(1);
});
