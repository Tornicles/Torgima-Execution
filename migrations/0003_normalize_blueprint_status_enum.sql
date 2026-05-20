-- R5: Align blueprint_status PostgreSQL enum with @workspace/state-machine BlueprintStatusValues
ALTER TYPE "blueprint_status" ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE "blueprint_status" ADD VALUE IF NOT EXISTS 'awaiting_selection';
