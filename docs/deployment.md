# Runtime and deployment

## Runtime services in this repository

- **PostgreSQL** is the persistent application database, accessed through Prisma. Production startup requires a non-mock PostgreSQL `DATABASE_URL` and exits if the database connection fails.
- **Redis is not currently part of the runtime.** `REDIS_URL` is accepted by configuration and `ioredis` is listed as an API dependency, but the application has no Redis client or BullMQ queue in use. A Redis service is not required for the current reminder implementation.
- **Reminders run in the bot process.** `ReminderScheduler` polls PostgreSQL every 30 seconds. Due-date alerts are also checked by that loop; their sent-once tracking is held in process memory. Run one bot scheduler instance to avoid duplicate delivery. Restarting the bot clears the in-memory due-date alert set.
- **The web client is a separate deployment.** The checked-in Nixpacks config builds and starts the API and bot only. It does not build or serve `apps/web`; deploy the Next.js app separately and configure `NEXT_PUBLIC_API_URL` to the API's `/api/v1` URL.

## Nixpacks API and bot service

The repository's `nixpacks.toml` installs with pnpm, generates Prisma Client, builds the API and bot, and starts both from one command. Configure at least:

- `NODE_ENV=production`
- `DATABASE_URL` for PostgreSQL
- `JWT_SECRET` and `JWT_EXPIRES_IN`
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`
- `WEB_BASE_URL`, `API_BASE_URL`, and `CORS_ORIGINS`
- `TELEGRAM_WEBHOOK_SECRET` and webhook variables when using Telegram webhook mode
- `GEMINI_API_KEY` only when using the bot's AI integration

Set the corresponding web variables in the separate Next.js deployment. There is no checked-in platform-specific web deployment configuration.

The current Nixpacks start command backgrounds the bot and then starts the API in the same service. Confirm the hosting platform supervises both child processes and restarts the service if either child exits; a dedicated process supervisor or separate bot/API services may be needed for reliable production operation.

## Database schema changes

Builds only generate Prisma Client and compile TypeScript. They do not mutate a database. `pnpm db:push` remains available for local development only. Production releases should run the separate `pnpm db:deploy` command, which invokes `prisma migrate deploy` and applies committed migration files.

**This repository currently has no `prisma/migrations` history.** Before using `db:deploy` for a production database, create and review the initial migration in development, commit it under `packages/database/prisma/migrations`, and verify it against a disposable database. For subsequent changes, create a migration with `prisma migrate dev --create-only --name <migration-name>`, review the SQL, commit it, and apply it in the release/deployment stage with `pnpm db:deploy`. Do not use `db:push` for production releases.

The `db:deploy` command is deliberately not part of the Nixpacks build or start command. Run it as an explicit release step with production database credentials after the migration has been reviewed and before starting the application version that requires it.
