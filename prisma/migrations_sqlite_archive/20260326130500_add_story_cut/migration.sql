-- CreateTable
CREATE TABLE "StoryCut" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "imageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "focus" TEXT,
    "durationSeconds" INTEGER NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "script" TEXT NOT NULL,
    "blocksJson" TEXT NOT NULL,
    "metadataJson" TEXT,
    "selectedMediaJson" TEXT,
    "selectedContributorJson" TEXT,
    "includeOwner" BOOLEAN NOT NULL DEFAULT true,
    "includeEmberVoice" BOOLEAN NOT NULL DEFAULT true,
    "includeNarratorVoice" BOOLEAN NOT NULL DEFAULT true,
    "emberVoiceId" TEXT,
    "emberVoiceLabel" TEXT,
    "narratorVoiceId" TEXT,
    "narratorVoiceLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoryCut_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StoryCut_imageId_key" ON "StoryCut"("imageId");
