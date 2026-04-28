import type { CaravanUnavailability } from '~~/shared/types'

const unavailabilities = ref<CaravanUnavailability[]>([])
const range = ref<{ from: string, to: string } | null>(null)
const loading = ref(false)
let realtimeBound = false

function overlapsRange(u: CaravanUnavailability): boolean {
  if (!range.value) return false
  return u.from < range.value.to && u.to > range.value.from
}

function applyEvent(event: string, payload: any) {
  if (event === 'unavailability:created') {
    const u = payload as CaravanUnavailability
    if (!overlapsRange(u)) return
    if (unavailabilities.value.find(x => x.id === u.id)) return
    unavailabilities.value = [...unavailabilities.value, u]
  } else if (event === 'unavailability:deleted') {
    const { id } = payload as { id: string, caravanId: string }
    unavailabilities.value = unavailabilities.value.filter(u => u.id !== id)
  }
}

export function useUnavailabilities() {
  async function fetchRange(from: string, to: string) {
    range.value = { from, to }
    loading.value = true
    try {
      const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
      const data = await $fetch<CaravanUnavailability[]>('/api/unavailabilities', {
        query: { from, to },
        headers
      })
      unavailabilities.value = data
    } finally {
      loading.value = false
    }
  }

  function ensureRealtime() {
    if (realtimeBound || !import.meta.client) return
    realtimeBound = true
    const { subscribePermanent } = useRealtime()
    subscribePermanent(applyEvent)
  }

  // Pour la maj optimiste après une mutation locale
  function applyCreated(u: CaravanUnavailability) {
    applyEvent('unavailability:created', u)
  }
  function applyDeleted(id: string, caravanId: string) {
    applyEvent('unavailability:deleted', { id, caravanId })
  }

  return { unavailabilities, range, loading, fetchRange, ensureRealtime, applyCreated, applyDeleted }
}
