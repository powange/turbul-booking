import { createAuthClient } from 'better-auth/vue'
import { inferAdditionalFields } from 'better-auth/client/plugins'

// Côté serveur (SSR), il faut une URL absolue. Côté client, on reste en relatif.
const baseURL = import.meta.server
  ? (process.env.BETTER_AUTH_URL || process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000')
  : ''

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    inferAdditionalFields({
      user: {
        role: {
          type: 'string'
        }
      }
    })
  ]
})

export type Role = 'ADMIN' | 'MANAGER' | 'VIEWER'
