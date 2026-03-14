# ERP Platform – Architecture Blueprint

## Tech Stack (target)
- Frontend: Next.js 15, TypeScript, Tailwind, feature-sliced components, SSR/ISR for dashboards.
- Backend: NestJS 11, REST-first with OpenAPI, GraphQL-ready. BullMQ/Redis for jobs.
- DB: PostgreSQL (Neon-compatible). Prisma ORM. Migrations via Prisma Migrate.
- Files: S3-compatible storage (MinIO local, S3 prod). Playwright/Headless Chromium for PDF.
- Observability: pino logs, OpenTelemetry hooks, Sentry-ready.

## Module Map (domains)
- Auth & Users
- Organization & Settings
- Accounting & Finance
- Sales
- Purchases
- Inventory
- CRM & Contacts
- Payroll & HR (phase 3 start-ready)
- Reporting & Dashboards
- Notifications
- Audit & Logs
- Admin Control Panel
- Files & Attachments
- Integrations (provider adapters)
- **Fixed Assets & Depreciation**
- **Loans & Treasury**
- Maintenance (light, linked to assets)

## Boundary Rules
- Each module owns: models/entities, DTOs, services, controllers, validators, policies/permissions, events, report definitions, seed data.
- Shared layers: common (errors, pipes, guards), config, db, queue workers, integration adapters, UI component library, report/export service.
- Permissions enforced at guard + service level. Approvals require dual permission (`action` + `approve`) for sensitive ops.

## Data & Integrity Principles
- Financial and stock records are append-only; use reversals, not destructive updates. Soft delete only for non-ledger metadata.
- All postings run inside DB transactions. Use optimistic locking where concurrent updates are possible (stock, ledger).
- Period closing prevents new journals; reopening requires elevated permission and audit log.
- Event-driven side effects: sales/purchase/asset/loan operations emit domain events; handlers post GL/stock changes and enqueue notifications.

## Reporting Layer
- Materialized views where needed (trial balance snapshot, aged AR/AP, inventory valuation). Background refresh jobs.
- Exports: CSV/XLSX via SheetJS, PDF via Playwright. Large exports run in jobs; UI polls for completion.

## Deployment Shape
- Containers: web, api, worker, redis, postgres (Neon remote in prod), minio (dev only).
- Environment via dotenv + typed config. Health and readiness endpoints for k8s/compose.

## RBAC (starter roles)
- SuperAdmin, Admin, Accountant, Sales, Purchaser, InventoryMgr, HR, Treasury, Viewer.
- Key perms added: `fixed_assets:*`, `depreciation:*`, `loans:*`, `maintenance:*`.

## Roadmap (high level)
1) Foundation: repo, CI, config, Auth/RBAC, Org settings, base UI shell.
2) Accounting core: COA, journals, vouchers, AR/AP basics, trial balance/P&L/BS, audit baseline.
3) Sales & Purchases: SO/PO to invoice/bill, receipts/payments, AR/AP tie-in.
4) Inventory: products, warehouses, stock moves, adjustments, transfers, valuation, alerts.
5) **Fixed Assets & Depreciation**: asset master, capitalization, transfers, disposals, straight-line runs, GL posting, asset register.
6) **Loans & Treasury**: loan master, amortization schedules, payments, accruals, statements.
7) Dashboards & Reports: widgets, exports, scheduled reports, notifications.
8) Admin & Ops: module toggles, job monitor, error log surfacing, backup hooks.
9) Hardening: tests for critical flows, perf/index review, security review, deployment scripts.

## Folder Layout (monorepo)
```
erp-platform/
  apps/
    api/      # NestJS
    web/      # Next.js
  packages/
    ui/       # shared components
    types/    # shared TS types
    utils/    # shared helpers
    config/   # shared ESLint/tsconfig/tailwind
  prisma/     # schema and migrations
  docs/       # architecture, ADRs
  scripts/    # seeders, dev scripts
```

## Next Build Steps
- Scaffold Prisma schema (phase 1 + assets/loans tables).
- Generate NestJS modules with placeholders and shared guards/interceptors.
- Add seed script for demo company, roles, chart of accounts, sample products/assets/loan.
