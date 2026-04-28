// Middleware nommé "manager" : vérifie que l'utilisateur est connecté ET
// MANAGER ou ADMIN. À utiliser via definePageMeta({ middleware: ['manager'] }).
import { authClient } from '~/lib/authClient'

export default defineNuxtRouteMiddleware(async () => {
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  const { data } = await authClient.getSession({ fetchOptions: { headers } })

  const role = (data?.user as { role?: string } | undefined)?.role
  if (role !== 'MANAGER' && role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Accès réservé aux gérants.' })
  }
})
