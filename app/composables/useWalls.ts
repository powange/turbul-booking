import type { Wall } from '~~/shared/types'

const walls = ref<Wall[]>([])
const isReady = ref(false)
let realtimeBound = false

function applyEvent(event: string, payload: any) {
  switch (event) {
    case 'wall:created': {
      if (!walls.value.find(w => w.id === payload.id)) {
        walls.value = [...walls.value, payload]
      }
      break
    }
    case 'wall:updated': {
      walls.value = walls.value.map(w => w.id === payload.id ? payload : w)
      break
    }
    case 'wall:deleted': {
      walls.value = walls.value.filter(w => w.id !== payload.id)
      break
    }
  }
}

export function useWalls() {
  async function refresh() {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    const data = await $fetch<Wall[]>('/api/walls', { headers })
    walls.value = data
    isReady.value = true
  }

  function ensureRealtime() {
    if (realtimeBound || !import.meta.client) return
    realtimeBound = true
    const { subscribePermanent } = useRealtime()
    subscribePermanent(applyEvent)
  }

  return { walls, isReady, refresh, ensureRealtime }
}
