import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, 'ADMIN')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  if (id === admin.id) {
    throw createError({ statusCode: 409, statusMessage: 'Vous ne pouvez pas supprimer votre propre compte.' })
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Utilisateur introuvable' })

  if (target.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
    if (adminCount <= 1) {
      throw createError({ statusCode: 409, statusMessage: 'Impossible : c\'est le dernier administrateur.' })
    }
  }

  // Réservations passées créées par ce user → on ne peut pas Restrict-cascade
  // car createdById est Restrict. On garde l'historique en réassignant à l'admin
  // qui supprime, ce qui préserve la traçabilité.
  await prisma.booking.updateMany({
    where: { createdById: id },
    data: { createdById: admin.id }
  })

  // Cascade côté SQL : Session, Account → onDelete: Cascade
  // AuditLog → onDelete: SetNull (l'historique reste, l'auteur disparaît)
  await prisma.user.delete({ where: { id } })

  await logAudit({
    userId: admin.id,
    action: 'USER_DELETE',
    entityType: 'User',
    entityId: id,
    payload: { email: target.email, role: target.role }
  })

  return { success: true }
})
