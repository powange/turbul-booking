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
  hasCleanLinen: boolean
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

export interface CaravanUnavailability {
  id: string
  caravanId: string
  from: string // ISO date "YYYY-MM-DD"
  to: string // ISO date "YYYY-MM-DD" (exclusif)
  reason: string | null
  createdById: string
  createdAt: string
}

export interface CaravanIssue {
  id: string
  caravanId: string
  label: string
  createdAt: string
  createdById: string
  resolvedAt: string | null
  resolvedById: string | null
}

export type PrintFrameOrientation = 'landscape' | 'portrait'

export interface PrintFrame {
  id: string
  lat: number
  lng: number
  /** Grand côté en mètres (= 297mm équivalent), indépendant de l'orientation. */
  widthMeters: number
  rotation: number // degrés horaires depuis le nord
  orientation: PrintFrameOrientation
  createdAt: string
  updatedAt: string
}

export interface Zone {
  id: string
  name: string
  color: string
  filled: boolean
  points: Array<[number, number]>
  createdAt: string
  updatedAt: string
}

export interface Wall {
  id: string
  color: string
  thickness: number
  points: Array<[number, number]>
  createdAt: string
  updatedAt: string
}

export type LandmarkIconFormat = 'png' | 'svg'

export interface LandmarkIcon {
  id: string
  name: string
  format: LandmarkIconFormat
  mimeType: string
  sizeBytes: number
  createdAt: string
  updatedAt: string
  createdById: string | null
}

export interface Landmark {
  id: string
  name: string
  lat: number
  lng: number
  iconId: string
  sizePx: number
  /** Hex `#rrggbb`, ignoré si l'icône est en PNG. NULL = couleur par défaut. */
  color: string | null
  createdAt: string
  updatedAt: string
}

export type RealtimeEvent
  = | 'caravan:created'
    | 'caravan:updated'
    | 'caravan:deleted'
    | 'bed:created'
    | 'bed:updated'
    | 'bed:deleted'
    | 'booking:created'
    | 'booking:deleted'
    | 'guest:created'
    | 'guest:updated'
    | 'zone:created'
    | 'zone:updated'
    | 'zone:deleted'
    | 'wall:created'
    | 'wall:updated'
    | 'wall:deleted'
    | 'unavailability:created'
    | 'unavailability:deleted'
    | 'issue:created'
    | 'issue:updated'
    | 'issue:deleted'
    | 'printFrame:updated'
    | 'printFrame:deleted'
    | 'landmarkIcon:created'
    | 'landmarkIcon:deleted'
    | 'landmark:created'
    | 'landmark:updated'
    | 'landmark:deleted'

export interface RealtimeMessage<T = unknown> {
  event: RealtimeEvent
  payload: T
}
