# Fixed Assets Module

Manages the full asset lifecycle: acquisition, transfers, disposals, and GL posting events.

## Endpoints
- `POST /fixed-assets` — create an asset
- `GET /fixed-assets` — list assets (filter by companyId)
- `PATCH /fixed-assets/:id` — update asset fields or status
- `POST /fixed-assets/:id/dispose` — record asset disposal

## Integration
- Depreciation runs are handled by the Depreciation module
- GL posting on acquisition and disposal is wired via the Posting module
