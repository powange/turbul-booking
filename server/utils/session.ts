import type { H3Event } from 'h3'
import { auth } from './auth'
import { prisma } from './db'

export type Role = 'ADMIN' | 'MANAGER' | 'VIEWER'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: Role
}

export async function getSessionUser(event: H3Event): Promise<SessionUser | null> {
  const session = await auth.api.getSession({
    headers: event.headers
  })

  if (!session?.user) return null

  // Re-read role from DB to avoid trusting a stale session payload.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true }
  })

  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role
  }
}

export async function requireUser(event: H3Event): Promise<SessionUser> {
  const user = await getSessionUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }
  return user
}

const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  MANAGER: 2,
  ADMIN: 3
}

export async function requireRole(event: H3Event, minimum: Role): Promise<SessionUser> {
  const user = await requireUser(event)
  if (ROLE_RANK[user.role] < ROLE_RANK[minimum]) {
    throw createError({ statusCode: 403, statusMessage: 'Accès refusé' })
  }
  return user
}
