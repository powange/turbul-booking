import { authClient, type Role } from '~/lib/authClient'

const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  MANAGER: 2,
  ADMIN: 3
}

export function useAuth() {
  const session = authClient.useSession()

  const user = computed(() => session.value.data?.user ?? null)
  const isAuthenticated = computed(() => !!user.value)
  const role = computed<Role | null>(() => (user.value?.role as Role | undefined) ?? null)
  const isLoading = computed(() => session.value.isPending)

  function hasRole(min: Role): boolean {
    if (!role.value) return false
    return ROLE_RANK[role.value] >= ROLE_RANK[min]
  }

  async function signOut() {
    await authClient.signOut()
    await navigateTo('/login')
  }

  return {
    session,
    user,
    role,
    isAuthenticated,
    isLoading,
    hasRole,
    signOut
  }
}
