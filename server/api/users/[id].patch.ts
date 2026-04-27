import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'

const ROLES = ['ADMIN', 'MANAGER', 'VIEWER'] as const

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  role: z.enum(ROLES).optional()
}).refine(d => Object.keys(d).length > 0, { message: 'Aucun champ à mettre à jour' })

export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, 'ADMIN')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const body = await readValidatedBody(event, schema.parse)

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Utilisateur introuvable' })

  // Empêcher l'admin de retirer son propre statut ADMIN s'il est le dernier
  if (body.role && body.role !== 'ADMIN' && target.id === admin.id) {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
    if (adminCount <= 1) {
      throw createError({ statusCode: 409, statusMessage: 'Impossible : vous êtes le dernier administrateur.' })
    }
  }

  // Vérifier l'unicité du nouvel email
  if (body.email && body.email !== target.email) {
    const existing = await prisma.user.findUnique({ where: { email: body.email } })
    if (existing) {
      throw createError({ statusCode: 409, statusMessage: 'Un compte avec cet email existe déjà.' })
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: body,
    select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true, emailVerified: true }
  })

  await logAudit({
    userId: admin.id,
    action: 'USER_UPDATE',
    entityType: 'User',
    entityId: id,
    payload: body
  })

  return user
})
