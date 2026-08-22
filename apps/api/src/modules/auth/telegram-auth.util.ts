import * as crypto from 'crypto';
import { TelegramUser } from '@flowtask/types';

export interface ValidatedTelegramData {
  user: TelegramUser;
  authDate: Date;
  queryId?: string;
  startParam?: string;
  chatType?: string;
}

/**
 * Validates Telegram WebApp initData string using HMAC-SHA256 as specified in official Telegram documentation:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramWebAppData(
  initData: string,
  botToken: string
): ValidatedTelegramData | null {
  if (!initData || !botToken) {
    return null;
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) {
      return null;
    }

    urlParams.delete('hash');

    // Sort keys alphabetically
    const keys = Array.from(urlParams.keys()).sort();
    const dataCheckString = keys
      .map((key) => `${key}=${urlParams.get(key)}`)
      .join('\n');

    // secret_key = HMAC_SHA256("WebAppData", bot_token)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // calculated_hash = HMAC_SHA256(secret_key, data_check_string)
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      return null;
    }

    const userRaw = urlParams.get('user');
    if (!userRaw) {
      return null;
    }

    const user = JSON.parse(userRaw) as TelegramUser;
    const authDateSeconds = parseInt(urlParams.get('auth_date') || '0', 10);
    const authDate = new Date(authDateSeconds * 1000);

    // Expire auth older than 24 hours
    const now = Date.now();
    if (now - authDate.getTime() > 86400 * 1000) {
      // Expired initData
      return null;
    }

    return {
      user,
      authDate,
      queryId: urlParams.get('query_id') || undefined,
      startParam: urlParams.get('start_param') || undefined,
      chatType: urlParams.get('chat_type') || undefined,
    };
  } catch {
    return null;
  }
}
