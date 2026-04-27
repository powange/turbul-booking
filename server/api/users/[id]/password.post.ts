import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { auth } from '~~/server/utils/auth'
import { logAudit } from '~~/server/utils/audit'

const schema = z.object({
  password: z.string().min(8).max(200)
})

// Réinitialise le mot de passe d'un utilisateur (réservé aux admins).
// On utilise le hasher interne de better-auth pour rester compatible
// avec sa vérification au login.
export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, 'ADMIN')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const body = await readValidatedBody(event, schema.parse)

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Utilisateur introuvable' })

  const ctx = await auth.$context
  const hash = await ctx.password.hash(body.password)

  // Le compte "credential" porte le hash du mot de passe (better-auth schema)
  const credential = await prisma.account.findFirst({
    where: { userId: id, providerId: 'credential' }
  })

  if (credential) {
    await prisma.account.update({
      where: { id: credential.id },
      data: { password: hash, updatedAt: new Date() }
    })
  } else {
    // Cas exceptionnel : pas de compte credential — on en crée un.
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: target.email,
        providerId: 'credential',
        userId: id,
        password: hash,
        updatedAt: new Date()
      }
    })
  }

  // Invalider toutes les sessions actives de l'utilisateur (forcer reconnexion)
  await prisma.session.deleteMany({ where: { userId: id } })

  await logAudit({
    userId: admin.id,
    action: 'USER_PASSWORD_RESET',
    entityType: 'User',
    entityId: id
  })

  return { success: true }
})
