-- Run this manually when ready to rename DB tables/columns
-- This is safe to run after the code deploy is confirmed working

ALTER TABLE "Image" RENAME TO "Ember";
ALTER TABLE "ImageAttachment" RENAME TO "EmberAttachment";
ALTER TABLE "ImageAnalysis" RENAME TO "EmberAnalysis";
ALTER TABLE "ImageTag" RENAME TO "EmberTag";

-- Rename imageId columns to emberId on all tables that have them
ALTER TABLE "EmberAttachment" RENAME COLUMN "imageId" TO "emberId";
ALTER TABLE "EmberAnalysis" RENAME COLUMN "imageId" TO "emberId";
ALTER TABLE "EmberContributor" RENAME COLUMN "imageId" TO "emberId";
ALTER TABLE "EmberSession" RENAME COLUMN "imageId" TO "emberId";
ALTER TABLE "MemoryClaim" RENAME COLUMN "imageId" TO "emberId";
ALTER TABLE "MemoryConflict" RENAME COLUMN "imageId" TO "emberId";
ALTER TABLE "Wiki" RENAME COLUMN "imageId" TO "emberId";
ALTER TABLE "Snapshot" RENAME COLUMN "imageId" TO "emberId";
ALTER TABLE "EmberTag" RENAME COLUMN "imageId" TO "emberId";
ALTER TABLE "VoiceCallClip" RENAME COLUMN "imageId" TO "emberId";
