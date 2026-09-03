export interface User {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TelegramAccount {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  languageCode: string | null;
  isBot: boolean;
  userId: string;
  authDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  user: User;
  telegramAccount?: TelegramAccount | null;
  accessToken: string;
  defaultWorkspaceId?: string;
  subscription?: {
    planCode: string;
    status: string;
    currentPeriodEnd: Date | null;
  } | null;
}
