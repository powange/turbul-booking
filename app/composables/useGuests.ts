import type { Guest } from '~~/shared/types'

export function useGuests() {
  async function search(q: string): Promise<Guest[]> {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    return await $fetch<Guest[]>('/api/guests', {
      query: q ? { q } : undefined,
      headers
    })
  }

  async function create(data: { firstName: string, lastName: string, email?: string, phone?: string }): Promise<Guest> {
    return await $fetch<Guest>('/api/guests', { method: 'POST', body: data })
  }

  return { search, create }
}
