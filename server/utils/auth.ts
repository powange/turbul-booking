import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './db'

// Origines autorisées pour la validation CSRF / origin de better-auth.
// Toujours inclure BETTER_AUTH_URL ; on peut ajouter d'autres origines via la
// variable BETTER_AUTH_TRUSTED_ORIGINS (séparées par virgules) pour gérer
// p.ex. un domaine secondaire ou un environnement de staging.
function buildTrustedOrigins(): string[] {
  const origins = new Set<string>()
  if (process.env.BETTER_AUTH_URL) origins.add(process.env.BETTER_AUTH_URL)
  const extra = process.env.BETTER_AUTH_TRUSTED_ORIGINS
  if (extra) {
    for (const o of extra.split(',').map(s => s.trim()).filter(Boolean)) {
      origins.add(o)
    }
  }
  return [...origins]
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql'
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: buildTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'VIEWER',
        input: false // never set from the client
      }
    }
  },
  advanced: {
    cookiePrefix: 'turbul'
  }
})

export type Auth = typeof auth
