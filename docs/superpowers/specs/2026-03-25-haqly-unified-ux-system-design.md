# HAQLY Unified UX System Design

**Date:** March 25, 2026  
**Product:** HAQLY ERP  
**Repository:** `FINOVA-ERP`  
**Scope:** Phase 1 UX foundation only

## Objective

Refactor HAQLY into a consistent enterprise ERP interface with one enforced UX system across all current and future modules.

Phase 1 establishes the frontend foundation only:

- one shell
- one navigation model
- one design-token system
- one page-layout system
- one action hierarchy
- one status language
- one record/list/create/detail/approval/report vocabulary

Phase 1 must not disrupt the current database system or backend integration contracts.

## Why This Exists

The current frontend behaves like a collection of mini-apps:

- navigation is duplicated between shell, module strips, and page-level controls
- routes and aliases expose overlapping business areas
- list, create, dashboard, and detail intents are mixed on the same screens
- modules apply different action language and status language
- permanent process-explainer blocks create noise inside operational pages
- module-specific patterns are not scaling across Home, Sales, Procurement, Inventory, Finance, Payroll, Reports, and Administration

This spec defines the single UX system that all modules must adopt.

## Product Rules

### Rule 1: One system, not many mini-apps

Every module must use the same:

- page shell
- spacing scale
- typography scale
- status language
- action hierarchy
- data-table behavior
- form behavior
- create workflow pattern
- detail-page structure

No module may invent a private layout or interaction pattern.

### Rule 2: Separate the three user intents

Every page must belong to exactly one mode:

- `Overview`
- `Records`
- `Create / Edit`

Pages must not permanently mix KPI/dashboard behavior, operational tables, and focused forms on the same screen.

### Rule 3: Remove permanent educational clutter

Process coaching, guided next actions, and prerequisite education must not live as permanent blocks inside operational pages.

Allowed placements:

- empty states
- onboarding panels
- contextual help drawer
- optional right-side help panel

### Rule 4: One primary action per screen

Each screen gets a single dominant CTA.

Examples:

- Sales invoice list: `Create Invoice`
- Vendor bills list: `Create Vendor Bill`
- Inventory movements list: `Record Movement`
- Payroll runs list: `Run Payroll`
- Home overview: no universal primary CTA unless role-specific

Secondary actions move into:

- overflow menu
- row action menu
- detail-page actions
- contextual drawer

### Rule 5: Same thing means same thing everywhere

The shared system vocabulary is:

- `Create`
- `Edit`
- `Save Draft`
- `Submit`
- `Approve`
- `Reject`
- `Post`
- `Export`
- `Archive`
- `Delete`

Terminology must not drift between modules.

## Phase 1 Scope

Phase 1 delivers the UX foundation only.

### In Scope

- global shell refactor
- global navigation schema
- global breadcrumb logic
- shared design tokens
- shared page-layout primitives
- shared status and action dictionary
- shared table, form, and page-toolbar patterns
- shared company/branch/period context handling
- alias-to-canonical route resolution in the UI layer
- compatibility hooks for the current NRS/FIRS e-invoicing direction

### Out of Scope

- database schema changes
- Prisma changes for UX-only work
- backend API contract changes
- backend business workflow rewrites
- route deletions that would break existing links in phase 1
- module-by-module visual migration beyond what is needed to prove the foundation
- invoice payload, orchestration, or credential changes for FIRS/NRS integration

## Information Architecture

### Global Navigation Schema

The shell must implement one canonical sidebar structure:

#### Home

- Dashboard
- My Work
- Notifications

#### Setup & Control

- Company
- Users & Roles
- Approval Rules
- Integrations
- Settings

#### Master Data

- Customers
- Suppliers
- Products & Services
- Warehouses
- Chart of Accounts
- Cost Centers
- Tax Codes
- Payroll Masters

#### Operations

- CRM
- Sales
- Procurement
- Inventory
- Payroll

#### Finance

- General Ledger
- Receivables
- Payables
- Bank & Cash
- Fixed Assets
- Tax

#### Insights

- Reports
- Analytics
- Saved Reports
- Audit Trail

### Route Behavior

Primary navigation must use canonical business areas.

Legacy or overlapping routes remain supported in phase 1 as aliases only. The shell must resolve them into a canonical context for navigation and breadcrumbs.

Examples:

- `/accounting` resolves to `Finance`
- `/purchases` resolves to `Procurement`
- `/human-resources` resolves to the canonical `Payroll` context for phase 1
- `/financial-management` resolves to the canonical `Insights > Reports` context for phase 1

### Top Bar

The top bar may only contain global context and global utilities:

- global search
- company selector
- branch selector
- period selector
- global create menu
- notifications
- user menu

Behavior:

- current company, branch, and period must always be visible
- changing company, branch, or period must warn when there is unsaved work
- all pages consume the same global scope provider

### Breadcrumb Standard

Breadcrumbs must resolve through one shared system:

`Module > Workflow Area > Page > Record`

Examples:

- `Sales > Invoicing > Invoice List`
- `Sales > Invoicing > Invoice Detail > INV-0026`
- `Payroll > Payroll Runs > March 2026 Payroll`
- `Inventory > Stock Movements > Movement Detail > MOV-0192`

## Module Template System

### Shared Module Vocabulary

Each module may expose these standard internal areas where applicable:

- `Overview`
- `Records`
- `Create`
- `Approvals`
- `Reports`

Not every module uses all five, but the labels and layout model must stay consistent.

### Approved Page Types

Every page must be one of these:

- Dashboard page
- List page
- Detail page
- Create page
- Edit page
- Approval queue page
- Report page
- Settings page
- Import page

No hybrid page type should be introduced unless it extends one of these primitives explicitly.

## Shell Architecture

Phase 1 introduces one reusable shell system.

### Required Layout Primitives

- `AppShell`
- `Sidebar`
- `Topbar`
- `PageContainer`
- `PageHeader`
- `PageToolbar`
- `PageContent`
- `PageAside`
- `PageSection`

### Required Layout Variants

#### Dashboard Layout

Structure:

- page header
- KPI row
- charts row
- alerts or exceptions row
- recent activity or work queue row

#### List Layout

Structure:

- page header
- toolbar with search, filters, views, and export
- main data table
- optional filter drawer

#### Detail Layout

Structure:

- page header with actions
- summary card
- related sections as tabs or stacked sections
- side metadata/actions panel

#### Create/Edit Layout

Structure:

- page header
- focused form body
- optional stepper for complex flows
- persistent action footer

No list or reporting table may sit below the form on the same page.

#### Approval Queue Layout

Structure:

- page header
- queue summary cards
- approval table
- detail drawer or side panel
- drawer action footer

## Design System

Create a single source of truth under:

`apps/web/src/design-system/tokens/`

Required files:

- `colors.ts`
- `spacing.ts`
- `typography.ts`
- `radius.ts`
- `shadows.ts`
- `zIndex.ts`
- `motion.ts`

### Typography

The shared typography system must implement the approved scale:

- `xs` = `12px`
- `sm` = `13px`
- `base` = `14px`
- `md` = `16px`
- `lg` = `18px`
- `xl` = `20px`
- `2xl` = `24px`
- `3xl` = `30px`

Usage rules:

- page title: `2xl semibold`
- section title: `xl semibold`
- card title: `md semibold`
- body text: `base regular`
- helper text: `xs regular`
- table header: `xs medium uppercase`

### Spacing

The shared spacing system must implement the approved scale:

- `0` = `0`
- `1` = `4px`
- `2` = `8px`
- `3` = `12px`
- `4` = `16px`
- `5` = `20px`
- `6` = `24px`
- `8` = `32px`
- `10` = `40px`
- `12` = `48px`
- `16` = `64px`

Usage rule:

- layout spacing must use tokens only

## Shared Action And Status Language

### Primary Action Hierarchy

Every page has one dominant primary action.

Secondary actions must move into:

- page toolbar overflow
- row action menus
- detail actions
- contextual drawers

### Shared Status Dictionary

The system must support a centralized status dictionary spanning operational workflows and the e-invoicing stream.

Core statuses:

- `Draft`
- `Pending Approval`
- `Approved`
- `Posted`
- `Rejected`
- `Archived`

Compliance-compatible statuses:

- `Ready for Submission`
- `Submitted`
- `Validated`
- `Synced`
- `Failed Validation`

These states must be handled through one shared badge and status mapping system, not redefined per module.

## Data And Integration Safety

Phase 1 is frontend-only and must not interfere with the current database system.

### Hard Safety Rules

- do not change database tables for UX-only work
- do not change Prisma models for UX-only work
- do not change API payload shapes for UX-only work
- do not change backend workflow semantics for UX-only work
- do not couple shell/navigation changes to backend refactors

### Current Workspace Compatibility

The shell and page system must continue to work with the current:

- company selector
- branch selector
- period selector
- route model
- workspace state provider
- module data-fetching contracts

## NRS/FIRS E-Invoicing Alignment

Phase 1 must remain compatible with the official Nigerian Revenue Service / FIRS e-invoicing direction already documented in HAQLY.

### UX Compatibility Requirements

- e-invoicing remains part of the shared product, not a separate mini-app
- invoice records must be able to show FIRS/NRS lifecycle states through the shared status system
- shared detail layouts must support future validation, sign, confirm, download, and sync surfaces
- action vocabulary must support compliance-specific actions without inventing new page structures
- module shell changes must not break existing e-invoicing module boundaries or orchestration assumptions

### Explicit Non-Goal

Phase 1 does not implement or alter:

- FIRS credential storage
- FIRS outbound client behavior
- FIRS payload mapping
- IRN orchestration
- webhook handling

It only ensures the shared UX system can host those capabilities cleanly.

## Recommended Rollout Order After Phase 1

1. UX foundation
2. shared page templates
3. canonical navigation and breadcrumb migration
4. module rollout in this order:
   - Home
   - Sales
   - Procurement
   - Inventory
   - Finance
   - Payroll
   - Reports
   - Administration

## Smallest Proof Slice

Implementation planning for phase 1 must stay tightly scoped by proving the foundation on the smallest representative slice first.

The minimum proof slice is:

- global shell
- canonical navigation resolver
- canonical breadcrumb resolver
- shared token system
- list layout
- detail layout
- create/edit layout
- dashboard layout
- status dictionary
- action hierarchy

The proof pages for that slice should be:

- Home dashboard
- Sales invoice list
- Sales invoice create page
- Sales invoice detail page

These pages exercise the shell, dashboard, records, create, and detail modes without forcing a full module migration in phase 1.

## Verification Strategy

Phase 1 must ship with proof that the new system is safe and consistent.

### Automated Verification

- navigation resolver tests
- breadcrumb tests
- status dictionary tests
- shared layout tests
- context-switching tests for company, branch, and period
- regression tests for alias routes and canonical route resolution

### Manual Verification

- shell renders correctly on desktop and laptop widths
- shell and page layouts remain usable on common tablet-width breakpoints even if mobile optimization is not a phase 1 target
- primary CTA behavior is consistent across sample pages
- no page permanently mixes dashboard, list, and form modes
- current e-invoicing-facing pages still render inside the new shell assumptions without workflow breakage
- keyboard navigation works for primary shell controls, menus, and page actions
- visible focus states remain present across interactive controls
- color/status treatment remains understandable without relying on color alone

## Acceptance Criteria

Phase 1 is complete when:

- one canonical shell exists
- one canonical nav schema exists
- one breadcrumb resolver exists
- one shared token system exists
- one approved page-layout system exists
- one shared action dictionary exists
- one shared status dictionary exists
- the shell and proof pages meet basic keyboard, focus, and desktop/laptop responsiveness requirements
- current backend contracts remain intact
- database behavior remains untouched
- the foundation is explicitly compatible with the NRS/FIRS e-invoicing direction
