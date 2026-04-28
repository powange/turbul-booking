-- CreateTable
CREATE TABLE "Wall" (
    "id" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "thickness" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "points" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wall_pkey" PRIMARY KEY ("id")
);
