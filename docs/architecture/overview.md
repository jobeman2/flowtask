# Architectural Overview

## 1. Core Philosophy
FlowTask decouples user interaction channels from domain business logic. Telegram is treated purely as an **ingress/channel adapter**. The task domain, workspace tenancy, reminders, and user profiles operate independently of whether an action came from a Telegram DM, Telegram Group, Telegram Mini App, Web Dashboard, or REST API.

## 2. Ingress & Layer Separation
```
User Ingress (Telegram / Mini App / Web)
                  │
                  ▼
         [Interface Adapters]
      (Bot Handlers / REST Controllers)
                  │
                  ▼
         [Application Layer]
(Use Cases, Commands, Queries, Orchestration)
                  │
                  ▼
           [Domain Layer]
  (Entities, Value Objects, Domain Policies)
                  │
                  ▼
        [Infrastructure Layer]
(Prisma ORM, PostgreSQL, Redis / BullMQ, SMS/Telegram APIs)
```

## 3. Modular Monolith Approach
FlowTask starts as a modular monolith inside `apps/api`. Each feature area (tasks, workspaces, auth, telegram, reminders, billing) is contained in its own module with clear boundaries, allowing high cohesion, rapid evolution, and effortless extraction into microservices should future scale demand it.
