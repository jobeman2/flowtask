# 🚀 FlowTask — Telegram Task Manager SaaS

> **Turn Telegram conversations into organized, actionable work.**

FlowTask is a Telegram-first task-management platform in active development. It uses a modular monolith API built with NestJS, PostgreSQL (Prisma), a Next.js Mini App, and a Grammy bot. Redis/BullMQ is not currently used by the runtime.

---

## 🏗 System Architecture

```text
/
├── apps/
│   ├── api/          # NestJS modular monolith REST API & Webhook handler
│   ├── web/          # Next.js 15 App Router Telegram Mini App & Web client
│   └── bot/          # Grammy Telegram Bot service & command adapter
├── packages/
│   ├── database/     # Prisma schema, client singleton, seeds
│   ├── types/        # Shared TypeScript domain models & DTOs
│   ├── validation/   # Zod validation schemas
│   ├── config/       # Shared constants and configurations
│   ├── ui/           # Shared Tailwind/shadcn UI design system components
│   └── eslint-config/# Monorepo strict ESLint rules
└── docs/             # Full architectural specifications & documentation
```

---

## ⚡ Quickstart (No Docker Required)

### 1. Requirements
- Node.js `v20+` or `v24+`
- pnpm `v9+` or `v11+`
- PostgreSQL database (Local or Cloud e.g., Supabase / Neon)

### 2. Setup Environment
Copy `.env.example` to `.env` and fill in your connection strings:
```bash
cp .env.example .env
```

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Setup Database
For local development, generate Prisma Client and synchronize a local database:
```bash
pnpm --filter @flowtask/database db:generate
pnpm --filter @flowtask/database db:push
pnpm --filter @flowtask/database db:seed
```

Production builds never change database schema. Review and commit Prisma migration files, then run `pnpm db:deploy` as a separate release step. See [Runtime and deployment](docs/deployment.md); this repository does not yet contain an initial migration history.

### 5. Run in Development Mode
Start API, Web Mini App, and Bot concurrently:
```bash
pnpm dev
```

- **Web / Mini App**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:4000/api/v1](http://localhost:4000/api/v1)
- **API Documentation (Swagger)**: [http://localhost:4000/docs](http://localhost:4000/docs)

---

## 🧪 Testing & Code Quality

```bash
# Run unit & integration tests
pnpm test

# Run strict TypeScript typechecks across all apps and packages
pnpm typecheck

# Run ESLint across monorepo
pnpm lint

# Build all packages & applications
pnpm build
```

---

## 📖 Documentation
- [Architecture Overview](docs/architecture/overview.md)
- [Backend Architecture & Module Boundaries](docs/architecture/backend.md)
- [Telegram Mini App & Bot Integration](docs/architecture/telegram.md)
- [Database Schema & Data Model](docs/database/schema.md)
- [Product Roadmap & MVP Scope](docs/product/mvp.md)
- [Runtime and deployment](docs/deployment.md)
