-- CreateTable
CREATE TABLE "SportsMode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "imageId" TEXT NOT NULL,
    "sportType" TEXT,
    "subjectName" TEXT,
    "teamName" TEXT,
    "opponentName" TEXT,
    "eventName" TEXT,
    "season" TEXT,
    "outcome" TEXT,
    "finalScore" TEXT,
    "rawDetails" TEXT NOT NULL,
    "summary" TEXT,
    "statLinesJson" TEXT,
    "highlightsJson" TEXT,
    "parsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SportsMode_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SportsMode_imageId_key" ON "SportsMode"("imageId");
