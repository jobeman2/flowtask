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
    onStart: (botInfo) => {
      console.info(`✅ FlowTask Bot @${botInfo.username} is active and listening!`);
    },
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error starting Telegram bot:', err);
  process.exit(1);
});
