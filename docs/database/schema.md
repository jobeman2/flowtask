# Database Architecture & Entity Specifications

## Core Entities
- `User`: Primary user profile with timezone and avatar.
- `TelegramAccount`: 1-to-N linkage between Telegram accounts and FlowTask users.
- `Workspace`: Multi-tenant boundary with unique slug and membership roles (`OWNER`, `ADMIN`, `MEMBER`, `GUEST`).
- `WorkspaceMember`: Mapping user to workspace with specific role.
- `TelegramChat`: Maps Telegram groups/supergroups to workspaces.
- `Project`: Project organization container within a workspace.
- `Task`: Task entity with workspace scoping, priority, status, assignee, and source message tracing.
- `Label` & `TaskLabel`: Categorization taxonomy.
- `Comment`: Collaborative discussion thread on tasks.
- `Reminder`: Scheduled reminders with due date or custom trigger times.
- `ActivityLog`: Comprehensive immutable audit trail for team activities.
- `Plan` & `Subscription`: Billing and entitlement tier mappings (ETB pricing support).
