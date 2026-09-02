import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const botConfig = {
  token: process.env.TELEGRAM_BOT_TOKEN || '8873821619:AAH8gJq-Lz1jzL-BB7xm0nVoe-b0_KpJ1Jo',
  webAppUrl: process.env.WEB_BASE_URL || 'https://flowtask.ethiodeploy.com',
  isDev: process.env.NODE_ENV !== 'production',
};
