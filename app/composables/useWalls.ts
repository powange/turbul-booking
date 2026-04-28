import type { Wall } from '~~/shared/types'
import { createRealtimeCollection } from './createRealtimeCollection'

const collection = createRealtimeCollection<Wall>({
  fetchUrl: '/api/walls',
  events: {
    created: 'wall:created',
    updated: 'wall:updated',
    deleted: 'wall:deleted'
  }
})

export function useWalls() {
  return {
    walls: collection.items,
    isReady: collection.isReady,
    refresh: () => collection.fetch(),
    ensureRealtime: collection.ensureRealtime,
    applyCreated: collection.applyCreated,
    applyUpdated: collection.applyUpdated,
    applyDeleted: collection.applyDeleted
  }
}
