import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'

// Renvoie les valeurs distinctes pour peupler les filtres (actions, entités, users).
export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')

  const [actions, entityTypes, users] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' }
    }),
    prisma.auditLog.findMany({
      distinct: ['entityType'],
      select: { entityType: true },
      orderBy: { entityType: 'asc' }
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' }
    })
  ])

  return {
    actions: actions.map(a => a.action),
    entityTypes: entityTypes.map(e => e.entityType),
    users
  }
})
