ALTER TABLE "EmberSession" ADD COLUMN "participantType" TEXT;
ALTER TABLE "EmberSession" ADD COLUMN "participantId" TEXT;

UPDATE "EmberSession"
SET "participantType" = 'contributor',
    "participantId" = "contributorId"
WHERE "contributorId" IS NOT NULL
  AND "participantType" IS NULL
  AND "participantId" IS NULL;

UPDATE "EmberSession" AS es
SET "participantType" = CASE
    WHEN image."ownerId" = es."userId" THEN 'owner'
    ELSE 'contributor'
  END,
  "participantId" = es."userId"
FROM "Image" AS image
WHERE es."imageId" = image."id"
  AND es."userId" IS NOT NULL
  AND es."participantType" IS NULL
  AND es."participantId" IS NULL;

UPDATE "EmberSession"
SET "participantType" = 'guest',
    "participantId" = "browserId"
WHERE "browserId" IS NOT NULL
  AND "participantType" IS NULL
  AND "participantId" IS NULL;

CREATE UNIQUE INDEX "EmberSession_imageId_sessionType_participantType_participantId_key"
  ON "EmberSession"("imageId", "sessionType", "participantType", "participantId");

CREATE INDEX "EmberSession_sessionType_imageId_idx" ON "EmberSession"("sessionType", "imageId");
CREATE INDEX "EmberSession_participantType_participantId_idx" ON "EmberSession"("participantType", "participantId");
