CREATE TABLE "MemoryClaim" (
  "id" TEXT NOT NULL,
  "imageId" TEXT NOT NULL,
  "emberMessageId" TEXT,
  "contributorId" TEXT,
  "userId" TEXT,
  "sourceSessionId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'human_memory',
  "questionType" TEXT,
  "claimType" TEXT NOT NULL,
  "subject" TEXT NOT NULL DEFAULT '',
  "value" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "rawText" TEXT,
  "confidence" DOUBLE PRECISION,
  "evidenceKind" TEXT NOT NULL DEFAULT 'human_memory',
  "resolutionMode" TEXT NOT NULL DEFAULT 'human_clarification',
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MemoryClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemoryConflict" (
  "id" TEXT NOT NULL,
  "imageId" TEXT NOT NULL,
  "claimType" TEXT NOT NULL,
  "subject" TEXT NOT NULL DEFAULT '',
  "summary" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolutionMode" TEXT NOT NULL DEFAULT 'human_clarification',
  "resolutionValue" TEXT,
  "resolutionNote" TEXT,
  "outreachQuestion" TEXT,
  "confidence" DOUBLE PRECISION,
  "metadataJson" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MemoryConflict_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemoryConflictClaim" (
  "conflictId" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "stance" TEXT NOT NULL DEFAULT 'disputed',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MemoryConflictClaim_pkey" PRIMARY KEY ("conflictId","claimId")
);

CREATE INDEX "MemoryClaim_imageId_claimType_subject_idx" ON "MemoryClaim"("imageId", "claimType", "subject");
CREATE INDEX "MemoryClaim_imageId_status_idx" ON "MemoryClaim"("imageId", "status");
CREATE INDEX "MemoryClaim_emberMessageId_idx" ON "MemoryClaim"("emberMessageId");
CREATE INDEX "MemoryClaim_sourceSessionId_createdAt_idx" ON "MemoryClaim"("sourceSessionId", "createdAt");
CREATE INDEX "MemoryClaim_contributorId_createdAt_idx" ON "MemoryClaim"("contributorId", "createdAt");
CREATE INDEX "MemoryClaim_userId_createdAt_idx" ON "MemoryClaim"("userId", "createdAt");
CREATE INDEX "MemoryConflict_imageId_status_idx" ON "MemoryConflict"("imageId", "status");
CREATE INDEX "MemoryConflict_imageId_claimType_subject_idx" ON "MemoryConflict"("imageId", "claimType", "subject");
CREATE INDEX "MemoryConflictClaim_claimId_idx" ON "MemoryConflictClaim"("claimId");

ALTER TABLE "MemoryClaim" ADD CONSTRAINT "MemoryClaim_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryClaim" ADD CONSTRAINT "MemoryClaim_emberMessageId_fkey" FOREIGN KEY ("emberMessageId") REFERENCES "EmberMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemoryClaim" ADD CONSTRAINT "MemoryClaim_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemoryClaim" ADD CONSTRAINT "MemoryClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemoryClaim" ADD CONSTRAINT "MemoryClaim_sourceSessionId_fkey" FOREIGN KEY ("sourceSessionId") REFERENCES "EmberSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemoryConflict" ADD CONSTRAINT "MemoryConflict_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryConflictClaim" ADD CONSTRAINT "MemoryConflictClaim_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "MemoryConflict"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemoryConflictClaim" ADD CONSTRAINT "MemoryConflictClaim_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "MemoryClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
