import type { PrintFrame } from '~~/shared/types'

// Singleton (au plus un cadre par installation), donc état module-level
// avec ref<PrintFrame | null>. Diffère de la factory createRealtimeCollection
// qui gère des collections.
const frame = ref<PrintFrame | null>(null)
const isReady = ref(false)
let realtimeBound = false

function applyEvent(event: string, payload: unknown) {
  if (event === 'printFrame:updated') {
    frame.value = payload as PrintFrame
  } else if (event === 'printFrame:deleted') {
    frame.value = null
  }
}

export function usePrintFrame() {
  async function refresh() {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    const data = await $fetch<PrintFrame | null>('/api/print-frame', { headers })
    frame.value = data
    isReady.value = true
  }

  function ensureRealtime() {
    if (realtimeBound || !import.meta.client) return
    realtimeBound = true
    const { subscribePermanent } = useRealtime()
    subscribePermanent(applyEvent)
  }

  function applyUpdate(updated: PrintFrame) {
    applyEvent('printFrame:updated', updated)
  }

  function applyDelete() {
    applyEvent('printFrame:deleted', null)
  }

  return { frame, isReady, refresh, ensureRealtime, applyUpdate, applyDelete }
}
