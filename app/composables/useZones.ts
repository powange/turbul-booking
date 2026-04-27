import type { Zone } from '~~/shared/types'

const zones = ref<Zone[]>([])
const isReady = ref(false)
let realtimeBound = false

function applyEvent(event: string, payload: any) {
  switch (event) {
    case 'zone:created': {
      if (!zones.value.find(z => z.id === payload.id)) {
        zones.value = [...zones.value, payload]
      }
      break
    }
    case 'zone:updated': {
      zones.value = zones.value.map(z => z.id === payload.id ? payload : z)
      break
    }
    case 'zone:deleted': {
      zones.value = zones.value.filter(z => z.id !== payload.id)
      break
    }
  }
}

export function useZones() {
  async function refresh() {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    const data = await $fetch<Zone[]>('/api/zones', { headers })
    zones.value = data
    isReady.value = true
  }

  function ensureRealtime() {
    if (realtimeBound || !import.meta.client) return
    realtimeBound = true
    const { subscribePermanent } = useRealtime()
    subscribePermanent(applyEvent)
  }

  return { zones, isReady, refresh, ensureRealtime }
}
