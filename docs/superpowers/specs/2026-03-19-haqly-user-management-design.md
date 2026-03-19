# HAQLY User Management Design

**Date:** 2026-03-19
**Status:** Approved for planning
**Product:** HAQLY ERP

## Goal

Make Administration user management fully live, intuitive, and database-backed so administrators can update user details, assign multiple roles, reset passwords, and archive or reactivate users without confusing or inactive UI actions.

## Problem Statement

The current Administration page already points toward a live user-management workflow, but the experience is inconsistent:

- some user actions are present in the UI but are not wired cleanly enough to trust
- the screen mixes real ERP-backed controls with browser-only patterns
- role assignment needs to reflect HAQLY's actual many-to-many authorization model
- the action labeled as delete should behave and read like archive or deactivate instead of suggesting hard deletion

This creates uncertainty for admins and makes the page feel less reliable than the rest of the ERP.

## Scope

This design covers one sub-project only: Administration user management.

Included:

- live user directory improvements in the Administration module
- update user profile details
- assign multiple roles per user
- reset user passwords with session revocation messaging
- archive/deactivate and reactivate users
- clearer action labels, form states, and success or error messages
- frontend and backend alignment so actions map to the database correctly

Explicitly out of scope for this pass:

- persistent user scope restrictions by tenant, company, branch, warehouse, or department
- broader inactive bulk actions in unrelated modules such as Finance and Tax
- redesigning the entire identity and access management model
- introducing new authorization rules that change how permission checks currently work

## Existing System Context

The current database already supports the core model needed for this work:

- `User`
- `Role`
- `UserRole`
- `Permission`
- `RolePermission`

This means HAQLY already supports many-to-many role assignment. That should remain the source of truth for authorization. A user may carry multiple role bundles at the same time because ERP users often operate across finance, inventory, approvals, reporting, and operations.

Current backend capabilities already present:

- list users
- get single user
- create user
- update user profile and active state
- assign roles through the admin module
- reset password
- soft archive via the delete endpoint

Current frontend capabilities already present:

- live user list on the Administration page
- create user form
- row action menu for edit, role assignment, password reset, and deactivate

The main gap is cohesion and usability, not a missing foundational data model.

## Design Principles

- Keep the user table visible as the admin's control center.
- Prefer side-panel editing over full-page navigation for speed and context retention.
- Use archive/deactivate language that matches real behavior.
- Support multiple assigned roles for authorization.
- Keep v1 simple by not mixing in scope persistence yet.
- Reserve space in the UI and types for future scope-based access controls.

## Chosen Approach

Use a live user directory plus a right-side editor panel in the Administration page.

Why this approach:

- it keeps the existing admin workflow intact instead of forcing a new route structure
- it allows fast edits while preserving table context
- it handles multi-role assignment cleanly without cluttering the table
- it gives HAQLY a clear extension point for future scope controls

Alternatives considered and rejected:

1. Dedicated user details pages
Reason not chosen: better for a larger IAM feature set, but adds navigation friction and is heavier than needed for this pass.

2. Inline table editing
Reason not chosen: acceptable for very small edits, but poor for multi-role assignment, password reset, and archive workflows.

## User Experience Design

### User Directory Table

The table remains the main anchor and should show:

- user name
- email
- active or inactive status
- assigned roles summary
- last activity

Primary actions:

- `New user`
- `Edit`
- `Reset password`
- `Deactivate`
- `Reactivate`

Terminology changes:

- remove `Delete user` from the primary admin wording
- use `Deactivate` or `Archive`
- use `Reactivate` for returning access

### Side Editor Panel

Selecting `Edit` opens a side panel with grouped sections:

1. `Profile`
   - first name
   - last name
   - email

2. `Access`
   - active or inactive state
   - archive/deactivate guidance text

3. `Roles`
   - multi-select checklist of assignable roles
   - optional primary display role for UI convenience only
   - note that access is based on all assigned roles

4. `Security`
   - password reset action
   - generated password helper
   - warning that active sessions will be revoked

The panel should keep interactions clear and admin-friendly:

- one main save action for profile and role changes
- explicit destructive-style confirmation for deactivation
- distinct success messages for profile, role, password, and status changes

## Authorization Model

HAQLY v1 user management must not limit authorization to one role.

Rules:

- users can hold multiple roles
- roles act as permission bundles
- effective access is based on all assigned roles combined
- any UI notion of a primary role is display-only and must not become the authorization source of truth

Deferred but anticipated:

- scope restrictions by tenant, company, branch, warehouse, and department

This pass should avoid storing those scopes unless required for basic operation, but the UI structure and type shape should make them easy to add next.

## Backend Design

### Data Model

No schema changes are required for v1 user management because the existing `User`, `Role`, and `UserRole` model already supports the agreed design.

Soft archive behavior should remain in place to preserve audit and relational integrity.

### API Contract

`GET /users`

- returns live users
- must include `roles: string[]` where each entry is a role name
- should return enough fields for the user table and edit panel

`GET /users/:id`

- returns one user with the same role array contract
- v1 should keep the read shape simple and avoid introducing role objects unless required elsewhere

`PATCH /users/:id`

- updates first name, last name, email, and active state
- validates email uniqueness

`POST /admin/users/:id/roles`

- accepts `{ roles: string[] }` where each entry is a role name
- replaces the user's role assignments with the submitted role array
- remains the source of truth for many-to-many role assignment

`POST /users/:id/reset-password`

- updates password hash
- revokes refresh tokens or active sessions so the new password takes effect immediately
- v1 flow: the admin chooses the new temporary password in the UI, with a generate button as a helper
- HAQLY does not send an automatic notification in this pass; the admin shares the temporary password out of band

`DELETE /users/:id`

- remains soft archive behavior
- frontend must treat this as deactivate or archive, not hard delete
- this endpoint powers `Deactivate` in the Administration UI

`PATCH /users/:id`

- also powers `Reactivate` by sending `isActive: true`

### Backend Behavior Requirements

- user list and user detail endpoints must return role arrays consistently
- updating a user must not silently drop roles
- role reassignment must fully replace role bundle membership with the submitted set
- resetting password must revoke login continuity
- deactivated users must not be able to log in
- reactivated users must be able to log in again if other security conditions are satisfied

## Frontend Design

### Administration Page Changes

The Administration page should be updated so the user-management area is clearly live and distinct from browser-only controls.

Required improvements:

- show role summaries in the user table
- load full user data into the side editor panel
- support multiple selected roles in the editor
- rename misleading actions
- make reset password a clear modal or panel action
- align message text with real backend behavior

### Interaction Requirements

- `Edit user` opens the panel populated with the selected record
- `Assign roles` becomes part of the same editing experience rather than feeling like a detached action
- `Deactivate` must call the existing soft-archive endpoint and then refresh the directory
- `Reactivate` must call the user update endpoint with `isActive: true` and, if needed, `isLocked: false` support can be added in implementation if the current service requires it
- `Reset password` should warn that sessions are revoked and that the administrator must share the temporary password securely
- saving should refresh the live user directory after success

### Visual and UX Requirements

- the flow should be understandable without training
- action labels should read like ERP admin actions, not developer placeholders
- the screen should not imply hard deletion when data is only archived
- multi-role selection should remain simple even if many roles exist
- the reset-password control should make it obvious whether the password was typed manually or generated in the UI

## Error Handling

The UI should surface specific failures in plain language:

- duplicate email
- missing required fields
- no valid roles found
- password too short or invalid
- service unavailable

Prefer field-level or section-level clarity over generic banners when feasible, but keep the existing page-level feedback as a fallback.

## Testing Requirements

### Backend

Add or update tests for:

- listing users with role arrays
- updating user profile fields
- assigning multiple roles
- resetting password and revoking refresh tokens
- deactivating a user
- reactivating a user through update flow

### Frontend

At minimum verify:

- type safety for the administration page and API helpers
- user table renders role summaries
- editing flow submits profile and role changes correctly
- deactivate/reactivate actions call the right endpoints
- reset password flow calls the right endpoint and updates messaging

## API Examples

Read shape example:

```json
{
  "id": 14,
  "email": "finance.ops@haqly.com",
  "firstName": "Amina",
  "lastName": "Okoro",
  "isActive": true,
  "createdAt": "2026-03-18T09:15:00.000Z",
  "updatedAt": "2026-03-19T08:10:00.000Z",
  "roles": ["Accountant", "Inventory Officer"]
}
```

Role write example:

```json
{
  "roles": ["Accountant", "Approver"]
}
```

Password reset example:

```json
{
  "password": "Tmp42Secure!9"
}
```

## Acceptance Criteria

- administrators can edit user first name, last name, and email from Administration
- administrators can assign multiple roles to one user
- the UI makes it clear that authorization is based on all assigned roles
- administrators can reset a user's password and understand that sessions are revoked
- administrators can deactivate and reactivate users without hard deleting them
- the user directory refreshes from the database after updates
- user-management actions on the Administration page no longer feel inactive or misleading

## Risks And Mitigations

Risk: role assignment and profile editing remain split across separate save flows and confuse admins
Mitigation: unify them inside one editor panel and refresh the live list after every successful mutation

Risk: frontend wording continues to imply deletion
Mitigation: replace delete language with deactivate or archive language throughout the user-management surface

Risk: adding scope restrictions now would expand this task into a much larger IAM redesign
Mitigation: defer scope persistence to the next slice while leaving a clean extension point in the UI and types

## Follow-On Slice

The next logical security slice after this pass is scoped access control persistence:

- tenant
- company
- branch
- warehouse
- department

That work should be planned separately so this user-management cleanup can ship as a coherent, testable improvement first.
