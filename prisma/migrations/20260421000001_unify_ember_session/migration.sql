-- Create EmberSession (unifies ChatSession + Conversation)
CREATE TABLE "EmberSession" (
  "id"               TEXT NOT NULL,
  "imageId"          TEXT NOT NULL,
  "userId"           TEXT,
  "contributorId"    TEXT,
  "browserId"        TEXT,
  "sessionType"      TEXT NOT NULL DEFAULT 'chat',
  "status"           TEXT NOT NULL DEFAULT 'active',
  "currentStep"      TEXT,
  "personaName"      TEXT,
  "personaTraits"    TEXT,
  "personaVoice"     TEXT,
  "personaBackstory" TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmberSession_pkey" PRIMARY KEY ("id")
);

-- Create EmberMessage (unifies ChatMessage + Message + Response)
CREATE TABLE "EmberMessage" (
  "id"            TEXT NOT NULL,
  "sessionId"     TEXT NOT NULL,
  "role"          TEXT NOT NULL,
  "content"       TEXT NOT NULL,
  "source"        TEXT NOT NULL DEFAULT 'web',
  "imageFilename" TEXT,
  "question"      TEXT,
  "questionType"  TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmberMessage_pkey" PRIMARY KEY ("id")
);

-- Migrate ChatSession → EmberSession
INSERT INTO "EmberSession" ("id", "imageId", "userId", "browserId", "sessionType", "status", "personaName", "personaTraits", "personaVoice", "personaBackstory", "createdAt", "updatedAt")
SELECT "id", "imageId", "userId", "browserId", 'chat', 'active', "personaName", "personaTraits", "personaVoice", "personaBackstory", "createdAt", "createdAt"
FROM "ChatSession";

-- Migrate ChatMessage → EmberMessage
INSERT INTO "EmberMessage" ("id", "sessionId", "role", "content", "source", "imageFilename", "createdAt")
SELECT "id", "sessionId", "role", "content", 'web', "imageFilename", "createdAt"
FROM "ChatMessage";

-- Migrate Conversation → EmberSession
INSERT INTO "EmberSession" ("id", "imageId", "contributorId", "sessionType", "status", "currentStep", "createdAt", "updatedAt")
SELECT c."id", co."imageId", c."contributorId", 'chat', c."status", c."currentStep", c."createdAt", c."updatedAt"
FROM "Conversation" c
JOIN "Contributor" co ON co."id" = c."contributorId";

-- Migrate Message → EmberMessage
INSERT INTO "EmberMessage" ("id", "sessionId", "role", "content", "source", "createdAt")
SELECT "id", "conversationId", "role", "content", "source", "createdAt"
FROM "Message";

-- Migrate Response → EmberMessage (answer becomes content, question/questionType stored in new fields)
INSERT INTO "EmberMessage" ("id", "sessionId", "role", "content", "source", "question", "questionType", "createdAt")
SELECT "id", "conversationId", 'user', "answer", "source", "question", "questionType", "createdAt"
FROM "Response";

-- Update VoiceCall.conversationId → emberSessionId (same IDs, Conversation rows are now EmberSession rows)
ALTER TABLE "VoiceCall" RENAME COLUMN "conversationId" TO "emberSessionId";

-- Add foreign key constraints
ALTER TABLE "EmberSession" ADD CONSTRAINT "EmberSession_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmberSession" ADD CONSTRAINT "EmberSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmberSession" ADD CONSTRAINT "EmberSession_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmberMessage" ADD CONSTRAINT "EmberMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EmberSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoiceCall" ADD CONSTRAINT "VoiceCall_emberSessionId_fkey" FOREIGN KEY ("emberSessionId") REFERENCES "EmberSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add unique and index constraints
CREATE UNIQUE INDEX "EmberSession_contributorId_key" ON "EmberSession"("contributorId");
CREATE UNIQUE INDEX "EmberSession_userId_imageId_key" ON "EmberSession"("userId", "imageId");
CREATE UNIQUE INDEX "EmberSession_browserId_imageId_key" ON "EmberSession"("browserId", "imageId");
CREATE INDEX "EmberSession_imageId_idx" ON "EmberSession"("imageId");
CREATE INDEX "EmberSession_userId_idx" ON "EmberSession"("userId");
CREATE INDEX "EmberMessage_sessionId_createdAt_idx" ON "EmberMessage"("sessionId", "createdAt");
CREATE INDEX "VoiceCall_emberSessionId_createdAt_idx" ON "VoiceCall"("emberSessionId", "createdAt");

-- Drop old FK from VoiceCall → Conversation before dropping Conversation
ALTER TABLE "VoiceCall" DROP CONSTRAINT IF EXISTS "VoiceCall_conversationId_fkey";

-- Drop old tables
DROP TABLE "ChatMessage";
DROP TABLE "ChatSession";
DROP TABLE "Response";
DROP TABLE "Message";
DROP TABLE "Conversation";
