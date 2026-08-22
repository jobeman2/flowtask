# Backend Architecture & Module Boundaries

## 1. Directory Blueprint (`apps/api/src/modules/`)
- `auth`: Issues JWTs, validates Telegram WebApp `initData` HMAC-SHA256 signatures.
- `users`: User profiles, timezone settings, linked accounts.
- `workspaces`: Multi-tenant boundary, role-based access control (OWNER, ADMIN, MEMBER, GUEST).
- `tasks`: Core task lifecycle, assignments, priority, status changes, labels, comments, and activity audit logging.
- `telegram`: Webhook handler, Telegram API integration, update router.
- `health`: Liveness & readiness probes checking PostgreSQL connection.

## 2. Multi-Tenancy Strategy
Every query and mutation must respect `workspaceId`. No direct unscoped task lookups are allowed.
Tenant isolation is enforced in controllers and services via `WorkspaceGuard` and strict database constraints.
