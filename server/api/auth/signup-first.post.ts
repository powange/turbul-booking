import { z } from 'zod'
import { auth } from '~~/server/utils/auth'
import { prisma } from '~~/server/utils/db'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1)
})

// Inscription du tout premier compte uniquement.
// Ce compte devient ADMIN et l'inscription publique est ensuite fermée.
export default defineEventHandler(async (event) => {
  const userCount = await prisma.user.count()
  if (userCount > 0) {
    throw createError({
      statusCode: 403,
      statusMessage: 'L\'inscription publique est fermée. Demandez à un administrateur de créer votre compte.'
    })
  }

  const body = await readValidatedBody(event, schema.parse)

  // Crée le compte via better-auth (gère le hash et la création de session)
  const result = await auth.api.signUpEmail({
    body: {
      email: body.email,
      password: body.password,
      name: body.name
    },
    headers: event.headers,
    asResponse: true
  })

  // Promeut immédiatement l'utilisateur en ADMIN
  await prisma.user.update({
    where: { email: body.email },
    data: { role: 'ADMIN', emailVerified: true }
  })

  // Renvoie la réponse de better-auth (qui contient les cookies de session)
  return result
})
