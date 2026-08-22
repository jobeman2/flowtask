# 🚀 FlowTask — Telegram Task Manager SaaS

> **Turn Telegram conversations into organized, actionable work.**

FlowTask is a production-ready, scalable task-management platform whose primary interface is **Telegram** and the **Telegram Mini App**, built using a clean **Modular Monolith** architecture on top of NestJS, PostgreSQL (Prisma), Redis (BullMQ), Next.js, and Grammy.

---

## 🏗 System Architecture

```text
/
├── apps/
│   ├── api/          # NestJS modular monolith REST API & Webhook handler
│   ├── web/          # Next.js 15 App Router Telegram Mini App & Web client
│   └── bot/          # Grammy Telegram Bot service & command adapter
├── packages/
│   ├── database/     # Prisma schema, PostgreSQL migrations, client singleton, seeds
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
- Redis instance (Local or Cloud e.g., Upstash)

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
Generate Prisma Client and push schema to your PostgreSQL database:
```bash
pnpm --filter @flowtask/database db:generate
pnpm --filter @flowtask/database db:push
pnpm --filter @flowtask/database db:seed
```

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
