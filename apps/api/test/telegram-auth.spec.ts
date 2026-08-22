import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';
import { validateTelegramWebAppData } from '../src/modules/auth/telegram-auth.util';

describe('Telegram WebApp Auth HMAC Validation', () => {
  const dummyBotToken = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ';

  function generateValidInitData(userObj: Record<string, unknown>, botToken: string): string {
    const authDate = Math.floor(Date.now() / 1000).toString();
    const userStr = JSON.stringify(userObj);

    const params = new URLSearchParams();
    params.set('auth_date', authDate);
    params.set('query_id', 'AAHdF6IQAAAAAN0XohD9p2ab');
    params.set('user', userStr);

    const keys = Array.from(params.keys()).sort();
    const dataCheckString = keys
      .map((key) => `${key}=${params.get(key)}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const hash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    params.set('hash', hash);
    return params.toString();
  }

  it('should successfully validate a genuine Telegram initData payload', () => {
    const userPayload = {
      id: 987654321,
      first_name: 'Abebe',
      last_name: 'Bikila',
      username: 'abebikila',
      language_code: 'en',
    };

    const validInitData = generateValidInitData(userPayload, dummyBotToken);
    const result = validateTelegramWebAppData(validInitData, dummyBotToken);

    expect(result).not.toBeNull();
    expect(result?.user.id).toBe(987654321);
    expect(result?.user.first_name).toBe('Abebe');
    expect(result?.user.username).toBe('abebikila');
  });

  it('should reject tampered initData hash', () => {
    const userPayload = {
      id: 987654321,
      first_name: 'Abebe',
    };

    let validInitData = generateValidInitData(userPayload, dummyBotToken);
    // Tamper with user id in query string
    validInitData = validInitData.replace('987654321', '111111111');

    const result = validateTelegramWebAppData(validInitData, dummyBotToken);
    expect(result).toBeNull();
  });

  it('should reject when bot token does not match', () => {
    const userPayload = {
      id: 987654321,
      first_name: 'Abebe',
    };

    const validInitData = generateValidInitData(userPayload, dummyBotToken);
    const result = validateTelegramWebAppData(validInitData, 'WRONG_BOT_TOKEN');

    expect(result).toBeNull();
  });
});
