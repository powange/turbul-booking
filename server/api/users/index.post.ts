import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { auth } from '~~/server/utils/auth'
import { logAudit } from '~~/server/utils/audit'

const ROLES = ['ADMIN', 'MANAGER', 'VIEWER'] as const

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(ROLES)
})

// Création d'un compte par un administrateur.
// Le nouvel utilisateur doit ensuite se connecter avec ses identifiants.
export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, 'ADMIN')
  const body = await readValidatedBody(event, schema.parse)

  // Vérifier l'unicité de l'email avant d'appeler better-auth
  const existing = await prisma.user.findUnique({ where: { email: body.email } })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Un compte avec cet email existe déjà.' })
  }

  // better-auth se charge du hash du mot de passe et de la création de l'Account
  await auth.api.signUpEmail({
    body: {
      email: body.email,
      password: body.password,
      name: body.name
    }
  })

  // Promouvoir au rôle demandé + marquer comme vérifié (pas d'email de vérification)
  const user = await prisma.user.update({
    where: { email: body.email },
    data: { role: body.role, emailVerified: true },
    select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true, emailVerified: true }
  })

  await logAudit({
    userId: admin.id,
    action: 'USER_CREATE',
    entityType: 'User',
    entityId: user.id,
    payload: { email: body.email, role: body.role }
  })

  return user
})
