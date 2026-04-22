WITH duplicate_owner_sessions AS (
  SELECT
    source."id" AS "sourceId",
    target."id" AS "targetId",
    contributor."id" AS "contributorId",
    contributor."userId" AS "userId"
  FROM "EmberSession" AS source
  JOIN "Contributor" AS contributor ON source."contributorId" = contributor."id"
  JOIN "Image" AS image ON contributor."imageId" = image."id"
  JOIN "EmberSession" AS target
    ON target."imageId" = source."imageId"
    AND target."sessionType" = source."sessionType"
    AND target."participantType" = 'owner'
    AND target."participantId" = contributor."userId"
    AND target."id" <> source."id"
  WHERE source."sessionType" = 'chat'
    AND contributor."userId" IS NOT NULL
    AND image."ownerId" = contributor."userId"
)
UPDATE "EmberMessage" AS message
SET "sessionId" = duplicate_owner_sessions."targetId"
FROM duplicate_owner_sessions
WHERE message."sessionId" = duplicate_owner_sessions."sourceId";

WITH duplicate_owner_sessions AS (
  SELECT
    source."id" AS "sourceId",
    target."id" AS "targetId"
  FROM "EmberSession" AS source
  JOIN "Contributor" AS contributor ON source."contributorId" = contributor."id"
  JOIN "Image" AS image ON contributor."imageId" = image."id"
  JOIN "EmberSession" AS target
    ON target."imageId" = source."imageId"
    AND target."sessionType" = source."sessionType"
    AND target."participantType" = 'owner'
    AND target."participantId" = contributor."userId"
    AND target."id" <> source."id"
  WHERE source."sessionType" = 'chat'
    AND contributor."userId" IS NOT NULL
    AND image."ownerId" = contributor."userId"
)
UPDATE "VoiceCall" AS call
SET "emberSessionId" = duplicate_owner_sessions."targetId"
FROM duplicate_owner_sessions
WHERE call."emberSessionId" = duplicate_owner_sessions."sourceId";

WITH duplicate_owner_sessions AS (
  SELECT source."id" AS "sourceId"
  FROM "EmberSession" AS source
  JOIN "Contributor" AS contributor ON source."contributorId" = contributor."id"
  JOIN "Image" AS image ON contributor."imageId" = image."id"
  JOIN "EmberSession" AS target
    ON target."imageId" = source."imageId"
    AND target."sessionType" = source."sessionType"
    AND target."participantType" = 'owner'
    AND target."participantId" = contributor."userId"
    AND target."id" <> source."id"
  WHERE source."sessionType" = 'chat'
    AND contributor."userId" IS NOT NULL
    AND image."ownerId" = contributor."userId"
)
DELETE FROM "EmberSession" AS session
USING duplicate_owner_sessions
WHERE session."id" = duplicate_owner_sessions."sourceId";

WITH duplicate_owner_sessions AS (
  SELECT
    target."id" AS "targetId",
    contributor."id" AS "contributorId",
    contributor."userId" AS "userId"
  FROM "Contributor" AS contributor
  JOIN "Image" AS image ON contributor."imageId" = image."id"
  JOIN "EmberSession" AS target
    ON target."imageId" = image."id"
    AND target."sessionType" = 'chat'
    AND target."participantType" = 'owner'
    AND target."participantId" = contributor."userId"
  WHERE contributor."userId" IS NOT NULL
    AND image."ownerId" = contributor."userId"
)
UPDATE "EmberSession" AS target
SET "contributorId" = COALESCE(target."contributorId", duplicate_owner_sessions."contributorId"),
    "userId" = COALESCE(target."userId", duplicate_owner_sessions."userId")
FROM duplicate_owner_sessions
WHERE target."id" = duplicate_owner_sessions."targetId"
  AND (
    target."contributorId" IS NULL
    OR target."userId" IS NULL
  );

UPDATE "EmberSession" AS session
SET "participantType" = 'owner',
    "participantId" = contributor."userId",
    "userId" = COALESCE(session."userId", contributor."userId")
FROM "Contributor" AS contributor
JOIN "Image" AS image ON contributor."imageId" = image."id"
WHERE session."contributorId" = contributor."id"
  AND session."sessionType" = 'chat'
  AND contributor."userId" IS NOT NULL
  AND image."ownerId" = contributor."userId";

UPDATE "EmberSession"
SET "participantType" = 'contributor',
    "participantId" = "contributorId"
WHERE "contributorId" IS NOT NULL
  AND ("participantType" IS NULL OR "participantId" IS NULL);

UPDATE "EmberSession" AS es
SET "participantType" = CASE
    WHEN image."ownerId" = es."userId" THEN 'owner'
    ELSE 'contributor'
  END,
  "participantId" = es."userId"
FROM "Image" AS image
WHERE es."imageId" = image."id"
  AND es."userId" IS NOT NULL
  AND ("participantType" IS NULL OR "participantId" IS NULL);

UPDATE "EmberSession"
SET "participantType" = 'guest',
    "participantId" = "browserId"
WHERE "browserId" IS NOT NULL
  AND ("participantType" IS NULL OR "participantId" IS NULL);

UPDATE "EmberSession"
SET "participantType" = 'guest',
    "participantId" = "id"
WHERE "participantType" IS NULL
   OR "participantId" IS NULL;

DROP INDEX IF EXISTS "EmberSession_userId_imageId_key";
DROP INDEX IF EXISTS "EmberSession_browserId_imageId_key";

CREATE INDEX IF NOT EXISTS "EmberSession_userId_imageId_idx" ON "EmberSession"("userId", "imageId");
CREATE INDEX IF NOT EXISTS "EmberSession_browserId_imageId_idx" ON "EmberSession"("browserId", "imageId");

ALTER TABLE "EmberSession" ALTER COLUMN "participantType" SET NOT NULL;
ALTER TABLE "EmberSession" ALTER COLUMN "participantId" SET NOT NULL;
