export type Role = 'ADMIN' | 'MANAGER' | 'VIEWER'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: Role
  emailVerified: boolean
  createdAt: string
  updatedAt: string
}

export interface Bed {
  id: string
  caravanId: string
  label: string
  capacity: number
  position: number
}

export interface Caravan {
  id: string
  name: string
  lat: number
  lng: number
  rotation: number
  width: number
  length: number
  hasElectricity: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  beds: Bed[]
}

export interface Guest {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  createdAt: string
  updatedAt: string
}

export interface Booking {
  id: string
  bedId: string
  guestId: string
  date: string // ISO date "YYYY-MM-DD"
  createdById: string
  createdAt: string
  guest?: Guest
}

export type RealtimeEvent =
  | 'caravan:created'
  | 'caravan:updated'
  | 'caravan:deleted'
  | 'bed:created'
  | 'bed:updated'
  | 'bed:deleted'
  | 'booking:created'
  | 'booking:deleted'
  | 'guest:created'
  | 'guest:updated'

export interface RealtimeMessage<T = unknown> {
  event: RealtimeEvent
  payload: T
}
