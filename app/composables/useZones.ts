import type { Zone } from '~~/shared/types'
import { createRealtimeCollection } from './createRealtimeCollection'

const collection = createRealtimeCollection<Zone>({
  fetchUrl: '/api/zones',
  events: {
    created: 'zone:created',
    updated: 'zone:updated',
    deleted: 'zone:deleted'
  }
})

export function useZones() {
  return {
    zones: collection.items,
    isReady: collection.isReady,
    refresh: () => collection.fetch(),
    ensureRealtime: collection.ensureRealtime,
    applyCreated: collection.applyCreated,
    applyUpdated: collection.applyUpdated,
    applyDeleted: collection.applyDeleted
  }
}
