import type { LandmarkIcon } from '~~/shared/types'
import { createRealtimeCollection } from './createRealtimeCollection'

// La factory createRealtimeCollection ne gère pas le cas "pas d'updated".
// Pour les icônes on a created + deleted (les métadonnées sont en effet
// immuables après upload).
const collection = createRealtimeCollection<LandmarkIcon>({
  fetchUrl: '/api/landmark-icons',
  events: {
    created: 'landmarkIcon:created',
    deleted: 'landmarkIcon:deleted'
  }
})

export function useLandmarkIcons() {
  return {
    icons: collection.items,
    isReady: collection.isReady,
    refresh: () => collection.fetch(),
    ensureRealtime: collection.ensureRealtime,
    applyCreated: collection.applyCreated,
    applyDeleted: collection.applyDeleted
  }
}
