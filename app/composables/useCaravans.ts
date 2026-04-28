import type { Caravan, Bed } from '~~/shared/types'

const caravans = ref<Caravan[]>([])
const isReady = ref(false)
let realtimeBound = false

// === Handlers de réconciliation par événement ===
// Chaque handler reste petit (complexité ≤ 3) et est testable isolément ;
// le dispatcher au bas du fichier route les events WS via une simple table.

function applyCaravanCreated(payload: unknown) {
  const c = payload as Caravan
  if (caravans.value.find(x => x.id === c.id)) return
  caravans.value = [...caravans.value, c]
}

function applyCaravanUpdated(payload: unknown) {
  const upd = payload as Caravan
  caravans.value = caravans.value.map(c =>
    c.id === upd.id ? { ...c, ...upd, beds: upd.beds ?? c.beds } : c
  )
}

function applyCaravanDeleted(payload: unknown) {
  const { id } = payload as { id: string }
  caravans.value = caravans.value.filter(c => c.id !== id)
}

function applyBedCreated(payload: unknown) {
  const bed = payload as Bed
  caravans.value = caravans.value.map((c) => {
    if (c.id !== bed.caravanId) return c
    if (c.beds.find(b => b.id === bed.id)) return c
    return { ...c, beds: [...c.beds, bed] }
  })
}

function applyBedUpdated(payload: unknown) {
  const bed = payload as Bed
  caravans.value = caravans.value.map((c) => {
    if (c.id !== bed.caravanId) return c
    return { ...c, beds: c.beds.map(b => b.id === bed.id ? bed : b) }
  })
}

function applyBedDeleted(payload: unknown) {
  const { id, caravanId } = payload as { id: string, caravanId: string }
  caravans.value = caravans.value.map((c) => {
    if (c.id !== caravanId) return c
    return { ...c, beds: c.beds.filter(b => b.id !== id) }
  })
}

const HANDLERS: Record<string, (payload: unknown) => void> = {
  'caravan:created': applyCaravanCreated,
  'caravan:updated': applyCaravanUpdated,
  'caravan:deleted': applyCaravanDeleted,
  'bed:created': applyBedCreated,
  'bed:updated': applyBedUpdated,
  'bed:deleted': applyBedDeleted
}

function applyEvent(event: string, payload: unknown) {
  HANDLERS[event]?.(payload)
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
    applyBedUpdated(bed)
  }

  return { caravans, isReady, refresh, ensureRealtime, applyBedUpdate }
}
