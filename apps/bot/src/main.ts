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
