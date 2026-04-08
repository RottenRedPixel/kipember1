-- CreateTable
CREATE TABLE "VoiceCallClip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "imageId" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "voiceCallId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "significance" TEXT,
    "speaker" TEXT,
    "audioUrl" TEXT,
    "startMs" INTEGER,
    "endMs" INTEGER,
    "canUseForTitle" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VoiceCallClip_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VoiceCallClip_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VoiceCallClip_voiceCallId_fkey" FOREIGN KEY ("voiceCallId") REFERENCES "VoiceCall" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VoiceCallClip_imageId_createdAt_idx" ON "VoiceCallClip"("imageId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCallClip_contributorId_createdAt_idx" ON "VoiceCallClip"("contributorId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCallClip_voiceCallId_createdAt_idx" ON "VoiceCallClip"("voiceCallId", "createdAt");
