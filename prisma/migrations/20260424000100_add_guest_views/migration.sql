ALTER TABLE "User" ADD COLUMN "lastSeenGuestViewsAt" TIMESTAMP(3);

CREATE TABLE "GuestView" (
  "id" TEXT NOT NULL,
  "contributorId" TEXT NOT NULL,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuestView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuestView_contributorId_viewedAt_idx" ON "GuestView" ("contributorId", "viewedAt");

ALTER TABLE "GuestView"
  ADD CONSTRAINT "GuestView_contributorId_fkey"
  FOREIGN KEY ("contributorId") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
