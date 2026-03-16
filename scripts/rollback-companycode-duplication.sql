BEGIN;

UPDATE "Company"
SET "code" = COALESCE("code", "companyCode")
WHERE "code" IS NULL
  AND "companyCode" IS NOT NULL;

ALTER TABLE "Company" DROP COLUMN IF EXISTS "companyCode";

COMMIT;
