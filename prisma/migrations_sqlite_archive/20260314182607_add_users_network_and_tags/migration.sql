/*
  Warnings:

  - Added the required column `ownerId` to the `Image` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "User" ("id", "name", "email", "phoneNumber", "passwordHash", "createdAt", "updatedAt")
VALUES (
    'legacy_owner_march_2026',
    'Legacy Owner',
    'legacy-owner@ember.local',
    NULL,
    'legacy:account',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImageTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "imageId" TEXT NOT NULL,
    "userId" TEXT,
    "contributorId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageTag_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImageTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImageTag_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ImageTag_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contributor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNumber" TEXT,
    "email" TEXT,
    "name" TEXT,
    "token" TEXT NOT NULL,
    "inviteSent" BOOLEAN NOT NULL DEFAULT false,
    "imageId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contributor_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Contributor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contributor" ("createdAt", "id", "imageId", "inviteSent", "name", "phoneNumber", "token") SELECT "createdAt", "id", "imageId", "inviteSent", "name", "phoneNumber", "token" FROM "Contributor";
DROP TABLE "Contributor";
ALTER TABLE "new_Contributor" RENAME TO "Contributor";
CREATE UNIQUE INDEX "Contributor_token_key" ON "Contributor"("token");
CREATE INDEX "Contributor_imageId_createdAt_idx" ON "Contributor"("imageId", "createdAt");
CREATE INDEX "Contributor_userId_createdAt_idx" ON "Contributor"("userId", "createdAt");
CREATE UNIQUE INDEX "Contributor_imageId_userId_key" ON "Contributor"("imageId", "userId");
CREATE TABLE "new_Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "ownerId" TEXT NOT NULL,
    "shareToNetwork" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Image_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Image" ("createdAt", "description", "filename", "id", "originalName", "visibility", "ownerId", "shareToNetwork")
SELECT "createdAt", "description", "filename", "id", "originalName", "visibility", 'legacy_owner_march_2026', false FROM "Image";
DROP TABLE "Image";
ALTER TABLE "new_Image" RENAME TO "Image";
CREATE INDEX "Image_ownerId_createdAt_idx" ON "Image"("ownerId", "createdAt");
CREATE INDEX "Image_shareToNetwork_createdAt_idx" ON "Image"("shareToNetwork", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_createdAt_idx" ON "UserSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Friendship_requesterId_status_idx" ON "Friendship"("requesterId", "status");

-- CreateIndex
CREATE INDEX "Friendship_addresseeId_status_idx" ON "Friendship"("addresseeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "ImageTag_imageId_createdAt_idx" ON "ImageTag"("imageId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageTag_userId_createdAt_idx" ON "ImageTag"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageTag_contributorId_createdAt_idx" ON "ImageTag"("contributorId", "createdAt");
