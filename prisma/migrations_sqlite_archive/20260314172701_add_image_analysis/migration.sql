-- CreateTable
CREATE TABLE "ImageAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "imageId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "summary" TEXT,
    "visualDescription" TEXT,
    "metadataSummary" TEXT,
    "mood" TEXT,
    "peopleJson" TEXT,
    "placesJson" TEXT,
    "thingsJson" TEXT,
    "activitiesJson" TEXT,
    "visibleTextJson" TEXT,
    "keywordsJson" TEXT,
    "openQuestionsJson" TEXT,
    "metadataJson" TEXT,
    "capturedAt" DATETIME,
    "latitude" REAL,
    "longitude" REAL,
    "cameraMake" TEXT,
    "cameraModel" TEXT,
    "lensModel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImageAnalysis_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageAnalysis_imageId_key" ON "ImageAnalysis"("imageId");
