-- Split the freeform `name` column on `User` and `AuthChallenge` into
-- `firstName` and `lastName`. Existing names are split on the first run of
-- whitespace: the first token becomes `firstName`, everything after it
-- becomes `lastName`. Empty / null names produce two NULLs.

-- User
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

UPDATE "User"
SET
  "firstName" = NULLIF(BTRIM(SPLIT_PART(BTRIM("name"), ' ', 1)), ''),
  "lastName"  = NULLIF(
    BTRIM(SUBSTRING(BTRIM("name") FROM POSITION(' ' IN BTRIM("name")) + 1)),
    ''
  )
WHERE "name" IS NOT NULL AND BTRIM("name") <> '';

-- POSITION returns 0 when there is no space; in that case SUBSTRING returns
-- the whole string, so guard against single-token names by clearing lastName
-- when there was no space.
UPDATE "User"
SET "lastName" = NULL
WHERE "name" IS NOT NULL
  AND BTRIM("name") <> ''
  AND POSITION(' ' IN BTRIM("name")) = 0;

ALTER TABLE "User" DROP COLUMN "name";

-- AuthChallenge
ALTER TABLE "AuthChallenge" ADD COLUMN "firstName" TEXT;
ALTER TABLE "AuthChallenge" ADD COLUMN "lastName" TEXT;

UPDATE "AuthChallenge"
SET
  "firstName" = NULLIF(BTRIM(SPLIT_PART(BTRIM("name"), ' ', 1)), ''),
  "lastName"  = NULLIF(
    BTRIM(SUBSTRING(BTRIM("name") FROM POSITION(' ' IN BTRIM("name")) + 1)),
    ''
  )
WHERE "name" IS NOT NULL AND BTRIM("name") <> '';

UPDATE "AuthChallenge"
SET "lastName" = NULL
WHERE "name" IS NOT NULL
  AND BTRIM("name") <> ''
  AND POSITION(' ' IN BTRIM("name")) = 0;

ALTER TABLE "AuthChallenge" DROP COLUMN "name";
