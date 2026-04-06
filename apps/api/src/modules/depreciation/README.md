# Depreciation Module

Handles depreciation policies, period runs, line-level results, and GL journal posting.

## Endpoints
- `POST /depreciation/policies` — create a depreciation policy
- `GET /depreciation/policies` — list policies
- `POST /depreciation/runs` — execute a depreciation run for a period
- `GET /depreciation/runs` — list runs with lines
- `DELETE /depreciation/runs/:id` — roll back a run (re-opens the period)

## Methods supported
- Straight-line (SL)
- Declining balance (DB)

## Integration
- Posts depreciation journals to the GL via the Posting module
- Period rollback removes posted lines and reverses GL entries
