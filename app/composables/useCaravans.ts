import type { Caravan, Bed } from '~~/shared/types'

const caravans = ref<Caravan[]>([])
const isReady = ref(false)
let realtimeBound = false

function applyEvent(event: string, payload: any) {
  switch (event) {
    case 'caravan:created': {
      if (!caravans.value.find(c => c.id === payload.id)) {
        caravans.value = [...caravans.value, payload]
      }
      break
    }
    case 'caravan:updated': {
      caravans.value = caravans.value.map(c =>
        c.id === payload.id ? { ...c, ...payload, beds: payload.beds ?? c.beds } : c
      )
      break
    }
    case 'caravan:deleted': {
      caravans.value = caravans.value.filter(c => c.id !== payload.id)
      break
    }
    case 'bed:created': {
      const bed = payload as Bed
      caravans.value = caravans.value.map((c) => {
        if (c.id !== bed.caravanId) return c
        if (c.beds.find(b => b.id === bed.id)) return c
        return { ...c, beds: [...c.beds, bed] }
      })
      break
    }
    case 'bed:updated': {
      const bed = payload as Bed
      caravans.value = caravans.value.map((c) => {
        if (c.id !== bed.caravanId) return c
        return { ...c, beds: c.beds.map(b => b.id === bed.id ? bed : b) }
      })
      break
    }
    case 'bed:deleted': {
      const { id, caravanId } = payload as { id: string, caravanId: string }
      caravans.value = caravans.value.map((c) => {
        if (c.id !== caravanId) return c
        return { ...c, beds: c.beds.filter(b => b.id !== id) }
      })
      break
    }
  }
}

export function useCaravans() {
  async function refresh() {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    const data = await $fetch<Caravan[]>('/api/caravans', { headers })
    caravans.value = data
    isReady.value = true
  }

  function ensureRealtime() {
    if (realtimeBound || !import.meta.client) return
    realtimeBound = true
    const { subscribePermanent } = useRealtime()
    subscribePermanent(applyEvent)
  }

  // Permet de mettre à jour un lit en local sans attendre la diffusion WS
  // (utile pour les actions optimistes type toggle linge).
  function applyBedUpdate(bed: Bed) {
    applyEvent('bed:updated', bed)
  }

  return { caravans, isReady, refresh, ensureRealtime, applyBedUpdate }
}
