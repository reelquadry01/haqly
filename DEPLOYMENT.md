# Deploying Haqly

Haqly is a two-part application and the parts deploy to different places:

| Part | Path | Where it goes |
| --- | --- | --- |
| Web (Next.js 15) | `apps/web` | Vercel |
| API (NestJS 10) | `apps/api` | A long-running Node host — Render, Railway, Fly.io |
| Database | `prisma/schema.prisma` | Neon PostgreSQL |

The API does **not** belong on Vercel. It is a stateful long-running Nest server
with a Prisma connection pool; Vercel's serverless functions would open a new
pool per invocation and exhaust Neon's connection limit.

## 1. Database (Neon)

Neon gives you two connection strings. You need both:

- **Pooled** (host contains `-pooler`) → `DATABASE_URL`. This is what the running API uses.
- **Direct** (no `-pooler`) → `DIRECT_URL`. Prisma uses this for migrations only.

Both must carry `?sslmode=require`; the API refuses to boot in production without it.

Apply the schema before the first deploy:

```bash
npm run prisma:migrate:deploy
```

The two migrations in `prisma/migrations/` build the full 68-model schema
(77 tables). Verify with `npx prisma migrate status`.

### Create the first admin

A migrated database has no users, so nothing can log in until you seed one:

```bash
SEED_ADMIN_EMAIL="you@yourcompany.com" \
SEED_ADMIN_PASSWORD="a-long-random-password" \
NODE_ENV=production npm run seed
```

This also loads the permission set, the SuperAdmin role, and a base chart of
accounts. It creates no companies or sample data.

Two things worth knowing:

- In production the seed **refuses to run without `SEED_ADMIN_PASSWORD`**, rather
  than falling back to the development default, which is published in this repo.
- Re-running the seed **leaves an existing admin untouched**. It is safe to call
  from a deploy hook. To rotate that account's password and unlock it, opt in
  explicitly with `SEED_ADMIN_RESET_PASSWORD=true`.

## 2. API

Set these environment variables on your host:

| Variable | Notes |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | Most hosts inject this; the app defaults to 3000 |
| `DATABASE_URL` | Neon **pooled** string, with `sslmode=require` |
| `DIRECT_URL` | Neon **direct** string, needed by the migrate step |
| `ACCESS_TOKEN_SECRET` | ≥ 32 chars, random |
| `REFRESH_TOKEN_SECRET` | ≥ 32 chars, random, different from the access secret |
| `ALLOWED_ORIGINS` | Comma-separated. **Must include your Vercel URL** or the browser blocks every request |

Generate the secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Build and run:

```bash
npm install
npm run api:build                       # runs prisma generate, then tsc
npm run migrate:deploy --workspace apps/api
npm start --workspace apps/api          # node dist/main.js
```

Health check: `GET /api/v1/health` returns `{"status":"ok"}` with database status.

## 3. Web (Vercel)

`vercel.json` at the repo root already configures the build, so import the
repository with its default settings and add one environment variable:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://<your-api-host>/api/v1` |

`NEXT_PUBLIC_*` values are inlined into the client bundle at build time, so set
this **before** triggering the build. Changing it later requires a redeploy, not
just a restart.

## 4. After the first deploy

1. Confirm `GET /api/v1/health` returns ok.
2. Log in with the seeded admin, then change its password from the UI.
3. Confirm the web app can reach the API — a CORS error in the browser console
   means `ALLOWED_ORIGINS` on the API is missing the Vercel origin.
4. Create the first company, branch, and chart of accounts before importing any
   transactional data. The opening-balance importers need them to resolve
   references, and supplier payments additionally need an **open accounting
   period** covering the payment date.

## Data migration order

The bulk importers under `/api/v1/imports/*` have real dependencies. Load them
in this order:

1. `chart-of-accounts` — mark the AR and AP accounts as control accounts
   (`isControlAccount: true`, `controlSource: "AR"` / `"AP"`); the receipt and
   payment importers resolve against them.
2. `branches`, `departments`, `warehouses`, `bank-accounts`
3. `customers`, `suppliers`, `products`, `tax-configs`, `asset-categories`
4. `gl-opening-balances`, `ar-opening-balances`, `ap-opening-balances`
5. `customer-receipts`, `supplier-payments`, `fixed-assets`, `stock-opening-balances`
6. `gl-journal-dump` for legacy transaction history

Every importer reports `{ dataset, created, updated, failed, errors[] }` and
rejects bad rows individually — except `gl-opening-balances`, which is
all-or-nothing because a partially posted opening balance would leave the ledger
out of balance.
