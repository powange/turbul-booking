import type { Peer } from 'crossws'

// Tous les WebSockets connectés à /_ws.
// Un Set en mémoire suffit pour une instance unique (cas Turbul).
const peers = new Set<Peer>()

export function addPeer(peer: Peer) {
  peers.add(peer)
}

export function removePeer(peer: Peer) {
  peers.delete(peer)
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

export function broadcast(event: RealtimeEvent, payload: unknown) {
  const message = JSON.stringify({ event, payload })
  for (const peer of peers) {
    try {
      peer.send(message)
    } catch (err) {
      console.error('[realtime] send failed', err)
    }
  }
}
