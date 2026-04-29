-- CreateTable
CREATE TABLE "LandmarkIcon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "LandmarkIcon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Landmark" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "iconId" TEXT NOT NULL,
    "sizePx" INTEGER NOT NULL DEFAULT 32,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Landmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandmarkIcon_createdAt_idx" ON "LandmarkIcon"("createdAt");

-- CreateIndex
CREATE INDEX "Landmark_iconId_idx" ON "Landmark"("iconId");

-- AddForeignKey
ALTER TABLE "LandmarkIcon" ADD CONSTRAINT "LandmarkIcon_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Landmark" ADD CONSTRAINT "Landmark_iconId_fkey" FOREIGN KEY ("iconId") REFERENCES "LandmarkIcon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
