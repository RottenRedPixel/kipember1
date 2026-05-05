-- CreateTable
CREATE TABLE "ProgressTrackerStep" (
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgressTrackerStep_pkey" PRIMARY KEY ("slug")
);

-- Seed the 10 default tracker steps. Slugs match the wiki's
-- id="tracker-<slug>" anchors so admin toggles drive the bar directly.
INSERT INTO "ProgressTrackerStep" ("slug", "label", "enabled", "position", "updatedAt") VALUES
  ('contributors',     'Contributor',      true, 0, CURRENT_TIMESTAMP),
  ('people',           'People',           true, 1, CURRENT_TIMESTAMP),
  ('title',            'Title',            true, 2, CURRENT_TIMESTAMP),
  ('snapshot',         'Snapshot',         true, 3, CURRENT_TIMESTAMP),
  ('time-place',       'Time & Place',     true, 4, CURRENT_TIMESTAMP),
  ('photos',           'Cover Photo',      true, 5, CURRENT_TIMESTAMP),
  ('image-analysis',   'Image Analysis',   true, 6, CURRENT_TIMESTAMP),
  ('story-circle',     'Story Circle',     true, 7, CURRENT_TIMESTAMP),
  ('why',              'Why',              true, 8, CURRENT_TIMESTAMP),
  ('emotional-states', 'Emotional States', true, 9, CURRENT_TIMESTAMP);
