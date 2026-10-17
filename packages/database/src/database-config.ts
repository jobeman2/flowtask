export function usesRealDatabase(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.DATABASE_URL &&
    env.USE_MOCK_DB !== 'true' &&
    !env.DATABASE_URL.includes('localhost:5432/flowtask')
  );
}

export function assertProductionDatabaseConfigured(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === 'production' && !usesRealDatabase(env)) {
    throw new Error('A production PostgreSQL DATABASE_URL is required; mock storage is disabled in production.');
  }
}
