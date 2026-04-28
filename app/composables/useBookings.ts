import type { Booking } from '~~/shared/types'
import { createRealtimeCollection } from './createRealtimeCollection'

const collection = createRealtimeCollection<Booking>({
  fetchUrl: '/api/bookings',
  events: {
    created: 'booking:created',
    deleted: 'booking:deleted'
  },
  // Une réservation est une nuit unique → on filtre par appartenance à
  // la fenêtre [from, to) actuellement chargée.
  rangeOverlap: (b, range) => b.date >= range.from && b.date < range.to,
  mapFetched: (raw) => {
    const b = raw as Booking
    return { ...b, date: String(b.date).slice(0, 10) }
  },
  mapEvent: (raw) => {
    const b = raw as Booking
    return { ...b, date: String(b.date).slice(0, 10) }
  }
})

export function useBookings() {
  return {
    bookings: collection.items,
    range: collection.range,
    loading: collection.loading,
    fetchRange: (from: string, to: string) => collection.fetch({ from, to }),
    ensureRealtime: collection.ensureRealtime,
    applyCreated: collection.applyCreated,
    applyDeleted: collection.applyDeleted
  }
}
