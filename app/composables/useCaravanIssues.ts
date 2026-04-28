import type { CaravanIssue } from '~~/shared/types'
import { createRealtimeCollection } from './createRealtimeCollection'

const collection = createRealtimeCollection<CaravanIssue>({
  fetchUrl: '/api/issues',
  events: {
    created: 'issue:created',
    updated: 'issue:updated',
    deleted: 'issue:deleted'
  }
})

export function useCaravanIssues() {
  return {
    issues: collection.items,
    isReady: collection.isReady,
    refresh: () => collection.fetch(),
    ensureRealtime: collection.ensureRealtime,
    applyCreated: collection.applyCreated,
    applyUpdated: collection.applyUpdated,
    applyDeleted: collection.applyDeleted
  }
}
