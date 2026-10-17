import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { assertProductionDatabaseConfigured, usesRealDatabase } from '../../../packages/database/src/database-config';
import { PrismaService } from '../src/database/prisma.service';

describe('database deployment safety', () => {
  it('does not push schema during builds and exposes migrations as a separate command', () => {
    const packageJsonPath = resolve(__dirname, '../../../packages/database/package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    expect(packageJson.scripts.build).not.toMatch(/db:push|auto-push/);
    expect(packageJson.scripts['db:deploy']).toBe('prisma migrate deploy');
  });

  it('rejects missing, mock, and local demo databases in production', () => {
    expect(() => assertProductionDatabaseConfigured({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(/production PostgreSQL/);
    expect(() => assertProductionDatabaseConfigured({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://local', USE_MOCK_DB: 'true' } as NodeJS.ProcessEnv)).toThrow(/production PostgreSQL/);
    expect(usesRealDatabase({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/flowtask' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('allows a configured production PostgreSQL database', () => {
    const env = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://db.example/flowtask' } as NodeJS.ProcessEnv;
    expect(usesRealDatabase(env)).toBe(true);
    expect(() => assertProductionDatabaseConfigured(env)).not.toThrow();
  });

  it('fails startup when the configured database connection fails', async () => {
    const connectionError = new Error('database unavailable');
    const service = Object.create(PrismaService.prototype) as PrismaService;
    Object.assign(service, {
      $connect: vi.fn().mockRejectedValue(connectionError),
      logger: { error: vi.fn(), log: vi.fn() },
    });

    await expect(service.onModuleInit()).rejects.toBe(connectionError);
  });
});
