// Middleware nommé "admin" : vérifie que l'utilisateur est connecté ET ADMIN.
// Le middleware global auth.global.ts gère déjà la connexion ; ici on n'ajoute
// que le contrôle de rôle. À utiliser via definePageMeta({ middleware: ['admin'] }).
import { authClient } from '~/lib/authClient'

export default defineNuxtRouteMiddleware(async (to) => {
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  const { data } = await authClient.getSession({ fetchOptions: { headers } })

  const role = (data?.user as any)?.role
  if (role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Accès réservé aux administrateurs.' })
  }
})
