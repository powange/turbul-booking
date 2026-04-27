import { addPeer, removePeer } from '~~/server/utils/realtime'

// Endpoint WebSocket pour la synchronisation temps réel.
// Tous les clients connectés reçoivent les événements (caravan:*, bed:*, booking:*).
export default defineWebSocketHandler({
  open(peer) {
    addPeer(peer)
  },
  close(peer) {
    removePeer(peer)
  },
  error(peer, error) {
    console.error('[ws] error', error)
    removePeer(peer)
  }
})
