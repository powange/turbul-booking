import { authClient } from '~/lib/authClient'

const PUBLIC_ROUTES = new Set(['/login', '/signup'])

export default defineNuxtRouteMiddleware(async (to) => {
  if (PUBLIC_ROUTES.has(to.path)) return

  const headers = import.meta.server
    ? useRequestHeaders(['cookie'])
    : undefined

  const { data } = await authClient.getSession({
    fetchOptions: { headers }
  })

  if (!data?.user) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
