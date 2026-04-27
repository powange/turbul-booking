import type { RealtimeEvent, RealtimeMessage } from '~~/shared/types'

type Handler = (event: RealtimeEvent, payload: any) => void

const subscribers = new Set<Handler>()
let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function dispatch(event: RealtimeEvent, payload: any) {
  for (const sub of subscribers) {
    try {
      sub(event, payload)
    } catch (err) {
      console.error('[realtime] subscriber error', err)
    }
  }
}

function connect() {
  if (!import.meta.client || ws) return
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${protocol}//${window.location.host}/_ws`)

  ws.onmessage = (e) => {
    try {
      const msg: RealtimeMessage = JSON.parse(e.data)
      dispatch(msg.event, msg.payload)
    } catch (err) {
      console.error('[realtime] message parse error', err)
    }
  }
  ws.onclose = () => {
    ws = null
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, 2000)
  }
  ws.onerror = () => { /* géré par onclose */ }
}

export function useRealtime() {
  /** Souscription persistante (lifetime = onglet). */
  function subscribePermanent(handler: Handler) {
    subscribers.add(handler)
    if (import.meta.client) connect()
  }

  /** Souscription liée au scope du composant courant. */
  function subscribe(handler: Handler) {
    subscribers.add(handler)
    if (import.meta.client) connect()
    onScopeDispose(() => subscribers.delete(handler))
  }

  function ensureConnected() {
    if (import.meta.client) connect()
  }

  return { subscribe, subscribePermanent, ensureConnected }
}
