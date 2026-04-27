import type { Booking } from '~~/shared/types'

const bookings = ref<Booking[]>([])
const range = ref<{ from: string, to: string } | null>(null)
const loading = ref(false)
let realtimeBound = false

function inRange(dateIso: string): boolean {
  if (!range.value) return false
  return dateIso >= range.value.from && dateIso < range.value.to
}

function applyEvent(event: string, payload: any) {
  if (event === 'booking:created') {
    const date = String(payload.date).slice(0, 10)
    if (!inRange(date)) return
    if (bookings.value.find(b => b.id === payload.id)) return
    bookings.value = [...bookings.value, { ...payload, date }]
  } else if (event === 'booking:deleted') {
    bookings.value = bookings.value.filter(b => b.id !== payload.id)
  }
}

export function useBookings() {
  async function fetchRange(from: string, to: string) {
    range.value = { from, to }
    loading.value = true
    try {
      const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
      const data = await $fetch<Booking[]>('/api/bookings', {
        query: { from, to },
        headers
      })
      bookings.value = data.map(b => ({ ...b, date: String(b.date).slice(0, 10) }))
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

  return { bookings, range, loading, fetchRange, ensureRealtime }
}
