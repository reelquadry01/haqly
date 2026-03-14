# Connected Business Process Engine Audit

## Root causes found

1. Shared master data already exists in the schema (`Customer`, `Supplier`, `Product`, `Warehouse`, `Account`, `TaxConfig`), but users were not being shown those records as prerequisites before starting downstream transactions.
2. Operational pages were optimized for direct entry, so invoices, bills, stock movements, and journals felt like isolated tasks rather than steps in one business chain.
3. Cross-module visibility was weak in the UI: users could save a document, but they were not shown what feeds it, what it creates next, or where to drill afterward.
4. Several end-to-end document chains are still simplified in the current data model. The schema does not yet have first-class quotations, sales orders, deliveries, requisitions, purchase orders, or goods-received-note tables, so some process paths must be guided with clear assumptions rather than fully enforced today.

## Refactor direction implemented

- Added a reusable workflow-rules layer in `apps/web/lib/process-flows.ts`.
- Added a reusable connected-process UI block in `apps/web/components/ui/process-architecture-panel.tsx`.
- Applied the pattern to the live Sales, Procurement, Inventory, CRM, and Finance workspaces.
- Re-grouped dashboard browse menus so the product reads more like:
  - Foundation
  - Parties
  - Operations
  - Finance & Analysis

## Connected process patterns now in the UI

Each refactored module now shows:

1. Prerequisites
   - what must exist first
   - what is missing
   - which missing setup can be created or opened next
2. Business flow
   - where the process starts
   - what document/status comes next
   - where the data flows downstream
3. Related records
   - live counts from source-of-truth data
4. Guided next actions
   - jump links into the correct next workspace or desk
5. Current workflow note
   - transparent note when the current schema still uses a simplified path

## Invoice scenario now

### Direct invoice path
1. Customer must exist in CRM/shared master data.
2. Item or service must exist in product master.
3. Tax setup should exist for compliant VAT handling.
4. User opens Sales and is shown readiness before creating an invoice.
5. User creates the invoice from shared customer and item master data.
6. Invoice is saved and then appears in:
   - sales register
   - customer statement flow
   - receivables/ledger follow-through

### Order-based invoice path
- The UI now explains that order-based invoicing is the intended downstream flow.
- The current schema does not yet have first-class sales-order and delivery entities, so the live implementation still centers on direct invoice creation.

## Assumptions still explicit

- Procurement currently uses a live bill-first path because requisition/PO/GRN entities are not yet modeled as separate persistent documents.
- CRM currently hands off most strongly through approved customer onboarding to invoicing, because leads/opportunities/quotes are still lighter-weight placeholders.
- Finance uses the full journal module plus live operational document counts, but deeper server-side lineage endpoints will strengthen traceability further.
