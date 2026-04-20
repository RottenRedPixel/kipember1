-- Add userId to ChatSession for persistent per-user chat threads
ALTER TABLE "ChatSession" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Add foreign key constraint (skip if already exists)
DO $$ BEGIN
  ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add unique index for userId + imageId lookup
CREATE UNIQUE INDEX IF NOT EXISTS "ChatSession_userId_imageId_key" ON "ChatSession"("userId", "imageId");

-- Add index for userId lookups
CREATE INDEX IF NOT EXISTS "ChatSession_userId_idx" ON "ChatSession"("userId");

-- Add imageFilename to ChatMessage for persisting uploaded photo references
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "imageFilename" TEXT;

-- Add analysisText to ImageAttachment for storing full vision analysis JSON
ALTER TABLE "ImageAttachment" ADD COLUMN IF NOT EXISTS "analysisText" TEXT;
