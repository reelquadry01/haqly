ALTER TABLE "TaxConfig" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "TaxConfig" ADD COLUMN IF NOT EXISTS "taxType" TEXT;
ALTER TABLE "TaxConfig" ADD COLUMN IF NOT EXISTS "recoverable" BOOLEAN;
ALTER TABLE "TaxConfig" ADD COLUMN IF NOT EXISTS "filingFrequency" TEXT;
ALTER TABLE "TaxConfig" ADD COLUMN IF NOT EXISTS "outputAccountId" INTEGER;
ALTER TABLE "TaxConfig" ADD COLUMN IF NOT EXISTS "inputAccountId" INTEGER;
ALTER TABLE "TaxConfig" ADD COLUMN IF NOT EXISTS "liabilityAccountId" INTEGER;
UPDATE "TaxConfig"
SET "code" = COALESCE("code", UPPER(REPLACE("name", ' ', '_'))),
    "taxType" = COALESCE("taxType", 'VAT'),
    "recoverable" = COALESCE("recoverable", false),
    "filingFrequency" = COALESCE("filingFrequency", 'MONTHLY')
WHERE "code" IS NULL OR "taxType" IS NULL OR "recoverable" IS NULL OR "filingFrequency" IS NULL;