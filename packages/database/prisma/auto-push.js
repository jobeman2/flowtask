const { execSync } = require('child_process');

// Only run prisma db push if DATABASE_URL is set and not pointing to local dev mock
const dbUrl = process.env.DATABASE_URL || '';
const useMock = process.env.USE_MOCK_DB === 'true';

if (dbUrl && !useMock && !dbUrl.includes('localhost:5432/flowtask')) {
  console.log('[Database Build] Live PostgreSQL detected. Pushing schema to ensure all tables exist...');
  try {
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    console.log('[Database Build] Successfully synchronized schema with database!');
  } catch (err) {
    console.warn('[Database Build] Warning: prisma db push encountered an issue, proceeding with build:', err.message);
  }
} else {
  console.log('[Database Build] Skipping db push (local development or mock mode)');
}
