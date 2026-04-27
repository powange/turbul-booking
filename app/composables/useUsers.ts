import type { AdminUser, Role } from '~~/shared/types'

export function useUsers() {
  const users = ref<AdminUser[]>([])
  const loading = ref(false)

  async function refresh() {
    loading.value = true
    try {
      const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
      users.value = await $fetch<AdminUser[]>('/api/users', { headers })
    } finally {
      loading.value = false
    }
  }

  async function create(data: { name: string, email: string, password: string, role: Role }): Promise<AdminUser> {
    const u = await $fetch<AdminUser>('/api/users', { method: 'POST', body: data })
    await refresh()
    return u
  }

  async function update(id: string, data: { name?: string, email?: string, role?: Role }): Promise<AdminUser> {
    const u = await $fetch<AdminUser>(`/api/users/${id}`, { method: 'PATCH', body: data })
    await refresh()
    return u
  }

  async function resetPassword(id: string, password: string): Promise<void> {
    await $fetch(`/api/users/${id}/password`, { method: 'POST', body: { password } })
  }

  async function remove(id: string): Promise<void> {
    await $fetch(`/api/users/${id}`, { method: 'DELETE' })
    users.value = users.value.filter(u => u.id !== id)
  }

  return { users, loading, refresh, create, update, resetPassword, remove }
}
