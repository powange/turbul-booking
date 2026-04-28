-- CreateTable
CREATE TABLE "CaravanIssue" (
    "id" TEXT NOT NULL,
    "caravanId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "CaravanIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaravanIssue_caravanId_resolvedAt_idx" ON "CaravanIssue"("caravanId", "resolvedAt");

-- AddForeignKey
ALTER TABLE "CaravanIssue" ADD CONSTRAINT "CaravanIssue_caravanId_fkey" FOREIGN KEY ("caravanId") REFERENCES "Caravan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaravanIssue" ADD CONSTRAINT "CaravanIssue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaravanIssue" ADD CONSTRAINT "CaravanIssue_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
