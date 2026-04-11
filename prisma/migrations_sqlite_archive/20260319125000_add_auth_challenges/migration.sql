CREATE TABLE "AuthChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "tokenHash" TEXT,
    "codeHash" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "name" TEXT,
    "metadataJson" TEXT,
    "userId" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AuthChallenge_tokenHash_key" ON "AuthChallenge"("tokenHash");
CREATE INDEX "AuthChallenge_type_createdAt_idx" ON "AuthChallenge"("type", "createdAt");
CREATE INDEX "AuthChallenge_type_email_createdAt_idx" ON "AuthChallenge"("type", "email", "createdAt");
CREATE INDEX "AuthChallenge_type_phoneNumber_createdAt_idx" ON "AuthChallenge"("type", "phoneNumber", "createdAt");
CREATE INDEX "AuthChallenge_userId_createdAt_idx" ON "AuthChallenge"("userId", "createdAt");
