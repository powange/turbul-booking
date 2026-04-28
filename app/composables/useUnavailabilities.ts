import type { CaravanUnavailability } from '~~/shared/types'
import { createRealtimeCollection } from './createRealtimeCollection'

const collection = createRealtimeCollection<CaravanUnavailability>({
  fetchUrl: '/api/unavailabilities',
  events: {
    created: 'unavailability:created',
    deleted: 'unavailability:deleted'
  },
  // Une indispo a une période [from, to) (to exclusif) ; elle apparaît
  // dans la fenêtre courante si elle la chevauche.
  rangeOverlap: (u, range) => u.from < range.to && u.to > range.from
})

export function useUnavailabilities() {
  return {
    unavailabilities: collection.items,
    range: collection.range,
    loading: collection.loading,
    fetchRange: (from: string, to: string) => collection.fetch({ from, to }),
    ensureRealtime: collection.ensureRealtime,
    applyCreated: collection.applyCreated,
    applyDeleted: collection.applyDeleted
  }
}
