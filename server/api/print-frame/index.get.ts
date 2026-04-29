import { prisma } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'

// Renvoie le cadre PDF singleton (ou null si non défini).
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const frame = await prisma.printFrame.findFirst({ orderBy: { updatedAt: 'desc' } })
  if (!frame) return null
  return {
    ...frame,
    createdAt: frame.createdAt.toISOString(),
    updatedAt: frame.updatedAt.toISOString()
  }
})
