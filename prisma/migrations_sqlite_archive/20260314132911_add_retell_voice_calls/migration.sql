-- CreateTable
CREATE TABLE "VoiceCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contributorId" TEXT NOT NULL,
    "conversationId" TEXT,
    "retellCallId" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL DEFAULT 'system',
    "callType" TEXT NOT NULL DEFAULT 'phone_call',
    "direction" TEXT,
    "fromNumber" TEXT,
    "toNumber" TEXT,
    "agentId" TEXT,
    "agentVersion" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'registered',
    "lastEventType" TEXT,
    "disconnectionReason" TEXT,
    "recordingUrl" TEXT,
    "publicLogUrl" TEXT,
    "transcript" TEXT,
    "transcriptObjectJson" TEXT,
    "transcriptWithToolCallsJson" TEXT,
    "metadataJson" TEXT,
    "dynamicVariablesJson" TEXT,
    "callAnalysisJson" TEXT,
    "callSummary" TEXT,
    "callSuccessful" BOOLEAN,
    "durationMs" INTEGER,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "analyzedAt" DATETIME,
    "memorySyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VoiceCall_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VoiceCall_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VoiceCallEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "voiceCallId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoiceCallEvent_voiceCallId_fkey" FOREIGN KEY ("voiceCallId") REFERENCES "VoiceCall" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'web',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("content", "conversationId", "createdAt", "id", "role") SELECT "content", "conversationId", "createdAt", "id", "role" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE TABLE "new_Response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'web',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Response_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Response" ("answer", "conversationId", "createdAt", "id", "question", "questionType") SELECT "answer", "conversationId", "createdAt", "id", "question", "questionType" FROM "Response";
DROP TABLE "Response";
ALTER TABLE "new_Response" RENAME TO "Response";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "VoiceCall_retellCallId_key" ON "VoiceCall"("retellCallId");

-- CreateIndex
CREATE INDEX "VoiceCall_contributorId_createdAt_idx" ON "VoiceCall"("contributorId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCall_conversationId_createdAt_idx" ON "VoiceCall"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCallEvent_voiceCallId_createdAt_idx" ON "VoiceCallEvent"("voiceCallId", "createdAt");
