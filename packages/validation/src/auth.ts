import { z } from 'zod';

export const telegramAuthSchema = z.object({
  initData: z.string().min(1, 'Telegram initData is required'),
});

export const loginWithEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerWithEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type TelegramAuthInput = z.infer<typeof telegramAuthSchema>;
export type LoginWithEmailInput = z.infer<typeof loginWithEmailSchema>;
export type RegisterWithEmailInput = z.infer<typeof registerWithEmailSchema>;
