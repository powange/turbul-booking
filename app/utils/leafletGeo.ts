import type L from 'leaflet'

/** Convertit une liste de points [[lat, lng], …] en LatLng[] pour Leaflet. */
export function pointsToLatLngs(points: Array<[number, number]>): L.LatLngExpression[] {
  return points.map(([lat, lng]) => [lat, lng] as L.LatLngExpression)
}

/**
 * Extrait les sommets d'une polyligne ou d'un polygone Leaflet sous forme de
 * tableau de tuples [lat, lng]. Duck-typé sur `getLatLngs` car les types
 * Leaflet pour Polygon et Polyline sont génériquement incompatibles.
 */
export function latLngsToPoints(layer: { getLatLngs: () => L.LatLng[] | L.LatLng[][] | L.LatLng[][][] }): Array<[number, number]> {
  const raw = layer.getLatLngs() as L.LatLng[] | L.LatLng[][]
  const ring = Array.isArray(raw[0]) ? (raw as L.LatLng[][])[0]! : (raw as L.LatLng[])
  return ring.map(ll => [ll.lat, ll.lng] as [number, number])
}

/** Échappe une chaîne pour l'injecter sans risque dans du HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;'
  }[ch]!))
}
