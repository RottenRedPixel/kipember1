-- AlterTable: add owner / contributor threshold fields
ALTER TABLE "ProgressTrackerStep"
  ADD COLUMN "ownerRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "contributorMin" INTEGER DEFAULT 0;

-- Multi-party steps inherit the prior "owner + at least one contributor"
-- behavior. Single-action steps stay at contributorMin = 0.
UPDATE "ProgressTrackerStep"
SET "contributorMin" = 1
WHERE "slug" IN ('story-circle', 'why', 'emotional-states');
