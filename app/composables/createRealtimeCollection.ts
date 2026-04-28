import type { Ref } from 'vue'

interface RealtimeCollectionOptions<T extends { id: string }> {
  /** URL pour récupérer la collection en GET. */
  fetchUrl: string
  /**
   * Préfixe d'événement WS, ex: "booking" pour brancher sur
   * "booking:created" / "booking:updated" / "booking:deleted".
   * Toutes les sous-clés ne sont pas obligatoires (certaines collections
   * n'ont pas de "updated", ex: bookings et unavailabilities sont
   * immuables).
   */
  events: {
    created?: string
    updated?: string
    deleted?: string
  }
  /**
   * Filtre fenêtre temporelle. Si fourni, les événements `created` et
   * `updated` ne sont appliqués que si l'item chevauche la range
   * actuellement chargée. À l'inverse, un item qui sort de la range
   * lors d'un `updated` est retiré.
   */
  rangeOverlap?: (item: T, range: { from: string, to: string }) => boolean
  /** Transforme la réponse du fetch (ex: normalise les dates ISO). */
  mapFetched?: (raw: any) => T
  /** Transforme le payload d'un événement WS (idem). */
  mapEvent?: (raw: any) => T
}

export interface RealtimeCollectionApi<T extends { id: string }> {
  items: Ref<T[]>
  range: Ref<{ from: string, to: string } | null>
  loading: Ref<boolean>
  isReady: Ref<boolean>
  fetch(query?: { from: string, to: string }): Promise<void>
  ensureRealtime(): void
  applyCreated(item: T): void
  applyUpdated(item: T): void
  applyDeleted(id: string): void
}

/**
 * Construit un store de collection synchronisée par WebSocket. État
 * module-level — chaque appel à cette factory au top-level d'un fichier
 * composable produit une instance partagée entre tous les consommateurs
 * de ce composable, comme dans le code original.
 *
 * Ne pas appeler à l'intérieur d'un setup() : l'état serait recréé à
 * chaque mount.
 */
export function createRealtimeCollection<T extends { id: string }>(
  opts: RealtimeCollectionOptions<T>
): RealtimeCollectionApi<T> {
  const items = ref<T[]>([]) as Ref<T[]>
  const range = ref<{ from: string, to: string } | null>(null)
  const loading = ref(false)
  const isReady = ref(false)
  let realtimeBound = false

  function isInRange(item: T): boolean {
    if (!opts.rangeOverlap) return true
    if (!range.value) return false
    return opts.rangeOverlap(item, range.value)
  }

  function applyCreated(item: T) {
    if (!isInRange(item)) return
    if (items.value.find(x => x.id === item.id)) return
    items.value = [...items.value, item]
  }

  function applyUpdated(item: T) {
    if (!isInRange(item)) {
      // L'item est sorti de la fenêtre : on le retire.
      items.value = items.value.filter(x => x.id !== item.id)
      return
    }
    items.value = items.value.map(x => x.id === item.id ? item : x)
  }

  function applyDeleted(id: string) {
    items.value = items.value.filter(x => x.id !== id)
  }

  function applyEvent(event: string, payload: any) {
    const mapped = opts.mapEvent ? opts.mapEvent(payload) : payload
    if (event === opts.events.created) {
      applyCreated(mapped as T)
    } else if (event === opts.events.updated) {
      applyUpdated(mapped as T)
    } else if (event === opts.events.deleted) {
      // Le payload de delete contient au minimum { id }, parfois avec
      // des champs additionnels (ex: caravanId pour bed:deleted).
      const id = (payload as { id: string }).id
      if (id) applyDeleted(id)
    }
  }

  async function fetchCollection(query?: { from: string, to: string }) {
    if (query) range.value = query
    loading.value = true
    try {
      const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
      const data = await $fetch<any[]>(opts.fetchUrl, {
        query,
        headers
      })
      items.value = opts.mapFetched ? data.map(opts.mapFetched) : data
      isReady.value = true
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

  return {
    items,
    range,
    loading,
    isReady,
    fetch: fetchCollection,
    ensureRealtime,
    applyCreated,
    applyUpdated,
    applyDeleted
  }
}
