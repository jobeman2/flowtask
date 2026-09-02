import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().default('http://localhost:4000'),
  WEB_BASE_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:4000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars').default('dev-secret-key-1234567890-flowtask'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  TELEGRAM_BOT_TOKEN: z.string().default('8873821619:AAH8gJq-Lz1jzL-BB7xm0nVoe-b0_KpJ1Jo'),
  TELEGRAM_BOT_USERNAME: z.string().default('FlowTaskBot'),
  TELEGRAM_WEBHOOK_SECRET: z.string().default(''),
  TELEGRAM_USE_WEBHOOK: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  TELEGRAM_WEBHOOK_URL: z.string().default(''),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateConfig(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    console.error('❌ Environment validation failed:', parsed.error.format());
    throw new Error('Invalid environment configuration');
  }
  return parsed.data;
}
