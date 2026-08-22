import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const botConfig = {
  token: process.env.TELEGRAM_BOT_TOKEN || '',
  webAppUrl: process.env.WEB_BASE_URL || 'http://localhost:3000',
  isDev: process.env.NODE_ENV !== 'production',
};
