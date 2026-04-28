import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

declare global {

  var __prisma__: PrismaClient | undefined
}

// Prisma 7 exige un adapter pour le runtime — l'URL de la base ne vient plus
// du schema mais directement d'env, et le driver Postgres est explicite.
function buildClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL non définie : impossible d\'instancier Prisma.')
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  })
}

export const prisma = globalThis.__prisma__ ?? buildClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma__ = prisma
}
