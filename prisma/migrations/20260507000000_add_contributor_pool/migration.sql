CREATE TABLE "ContributorPool" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributorPool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContributorPool_ownerId_userId_key" ON "ContributorPool"("ownerId", "userId");
CREATE INDEX "ContributorPool_ownerId_idx" ON "ContributorPool"("ownerId");

ALTER TABLE "ContributorPool" ADD CONSTRAINT "ContributorPool_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContributorPool" ADD CONSTRAINT "ContributorPool_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
