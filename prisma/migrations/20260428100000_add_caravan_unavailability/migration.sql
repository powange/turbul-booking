-- CreateTable
CREATE TABLE "CaravanUnavailability" (
    "id" TEXT NOT NULL,
    "caravanId" TEXT NOT NULL,
    "from" DATE NOT NULL,
    "to" DATE NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaravanUnavailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaravanUnavailability_caravanId_from_to_idx" ON "CaravanUnavailability"("caravanId", "from", "to");

-- CreateIndex
CREATE INDEX "CaravanUnavailability_from_to_idx" ON "CaravanUnavailability"("from", "to");

-- AddForeignKey
ALTER TABLE "CaravanUnavailability" ADD CONSTRAINT "CaravanUnavailability_caravanId_fkey" FOREIGN KEY ("caravanId") REFERENCES "Caravan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaravanUnavailability" ADD CONSTRAINT "CaravanUnavailability_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
