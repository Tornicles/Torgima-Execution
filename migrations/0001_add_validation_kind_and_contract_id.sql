DO $$ BEGIN
  CREATE TYPE "public"."validation_kind" AS ENUM (
    'legacy',
    'intelligence',
    'erector',
    'readiness',
    'path_selection',
    'unknown'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "validations" ADD COLUMN IF NOT EXISTS "contract_id" uuid;
ALTER TABLE "validations" ALTER COLUMN "contract_id" SET DEFAULT gen_random_uuid();
UPDATE "validations" SET "contract_id" = gen_random_uuid() WHERE "contract_id" IS NULL;
ALTER TABLE "validations" ALTER COLUMN "contract_id" SET NOT NULL;

ALTER TABLE "validations" ADD COLUMN IF NOT EXISTS "validation_kind" "public"."validation_kind";
UPDATE "validations" SET "validation_kind" = 'unknown' WHERE "validation_kind" IS NULL;
ALTER TABLE "validations" ALTER COLUMN "validation_kind" SET DEFAULT 'unknown';
ALTER TABLE "validations" ALTER COLUMN "validation_kind" SET NOT NULL;

ALTER TABLE "validations" ADD COLUMN IF NOT EXISTS "payload_version" integer;
UPDATE "validations" SET "payload_version" = 1 WHERE "payload_version" IS NULL;
ALTER TABLE "validations" ALTER COLUMN "payload_version" SET DEFAULT 1;
ALTER TABLE "validations" ALTER COLUMN "payload_version" SET NOT NULL;

ALTER TABLE "validations" ADD COLUMN IF NOT EXISTS "selected_path_type" text;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_validations_contract_id"
  ON "validations" USING btree ("contract_id");