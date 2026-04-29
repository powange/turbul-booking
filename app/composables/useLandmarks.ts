import type { Landmark } from '~~/shared/types'
import { createRealtimeCollection } from './createRealtimeCollection'

const collection = createRealtimeCollection<Landmark>({
  fetchUrl: '/api/landmarks',
  events: {
    created: 'landmark:created',
    updated: 'landmark:updated',
    deleted: 'landmark:deleted'
  }
})

export function useLandmarks() {
  return {
    landmarks: collection.items,
    isReady: collection.isReady,
    refresh: () => collection.fetch(),
    ensureRealtime: collection.ensureRealtime,
    applyCreated: collection.applyCreated,
    applyUpdated: collection.applyUpdated,
    applyDeleted: collection.applyDeleted
  }
}
