// Conversion mètre ↔ degrés autour d'une latitude.
// 1° de latitude ≈ 111 320 m. 1° de longitude ≈ 111 320 m × cos(lat).
export const M_PER_DEG_LAT = 111_320

export function metersPerDegLng(lat: number): number {
  return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)
}

export interface CaravanGeometry {
  lat: number
  lng: number
  rotation: number // degrés, 0 = grand axe pointant le Nord
  width: number // mètres (perpendiculaire au grand axe)
  length: number // mètres (le long du grand axe)
}

/**
 * Calcule les 4 coins (lat, lng) du rectangle représentant la caravane,
 * orienté selon `rotation` (sens horaire à partir du Nord).
 */
export function caravanCorners(geo: CaravanGeometry): Array<[number, number]> {
  const { lat, lng, rotation, width, length } = geo
  const angle = (rotation * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const halfW = width / 2
  const halfL = length / 2

  // Coins locaux (x = perpendiculaire, y = le long du grand axe)
  const local: Array<[number, number]> = [
    [-halfW, -halfL],
    [+halfW, -halfL],
    [+halfW, +halfL],
    [-halfW, +halfL]
  ]

  const mPerDegLng = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)

  return local.map(([dx, dy]) => {
    // Rotation horaire à partir du Nord
    const rx = dx * cos + dy * sin
    const ry = -dx * sin + dy * cos
    return [
      lat + ry / M_PER_DEG_LAT,
      lng + rx / mPerDegLng
    ]
  })
}

export type A4Orientation = 'landscape' | 'portrait'

/**
 * Demi-dimensions locales (X = est local, Y = nord local) d'un rectangle
 * au ratio A4 selon l'orientation. `longSideMeters` = grand côté (297mm
 * équivalent), indépendant de l'orientation.
 *
 *  - landscape : X = grand côté, Y = petit côté (papier "couché")
 *  - portrait  : X = petit côté, Y = grand côté (papier "debout")
 */
function a4HalfSizes(longSideMeters: number, orientation: A4Orientation): { halfX: number, halfY: number } {
  const shortSide = longSideMeters * (210 / 297)
  if (orientation === 'landscape') {
    return { halfX: longSideMeters / 2, halfY: shortSide / 2 }
  }
  return { halfX: shortSide / 2, halfY: longSideMeters / 2 }
}

/**
 * Calcule les 4 coins d'un rectangle au ratio A4 (297 × 210) centré sur
 * (lat, lng) avec rotation horaire optionnelle (en degrés depuis le
 * nord). `longSideMeters` représente toujours le grand côté du papier
 * (297mm équivalent) ; l'orientation détermine si ce grand côté est
 * horizontal (landscape) ou vertical (portrait) en repère local.
 * Renvoie les coins dans l'ordre SW, SE, NE, NW pour fermer un polygone.
 */
export function a4Corners(
  lat: number,
  lng: number,
  longSideMeters: number,
  rotationDeg = 0,
  orientation: A4Orientation = 'landscape'
): Array<[number, number]> {
  const { halfX, halfY } = a4HalfSizes(longSideMeters, orientation)
  const angle = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  const local: Array<[number, number]> = [
    [-halfX, -halfY],
    [+halfX, -halfY],
    [+halfX, +halfY],
    [-halfX, +halfY]
  ]

  const mPerDegLng = metersPerDegLng(lat)

  return local.map(([dx, dy]) => {
    // Rotation horaire depuis le nord (même convention que caravanCorners)
    const rx = dx * cos + dy * sin
    const ry = -dx * sin + dy * cos
    return [
      lat + ry / M_PER_DEG_LAT,
      lng + rx / mPerDegLng
    ]
  })
}

/**
 * Position d'une poignée le long de l'axe nord local du rectangle —
 * `side: 'top'` met la poignée au-dessus du bord supérieur (sens local),
 * `'bottom'` en-dessous du bord inférieur. La hauteur locale dépend de
 * l'orientation : c'est le PETIT côté en landscape, le GRAND côté en
 * portrait.
 */
export function a4EdgeHandle(
  lat: number,
  lng: number,
  longSideMeters: number,
  rotationDeg: number,
  side: 'top' | 'bottom',
  orientation: A4Orientation = 'landscape',
  offsetMeters = 5
): [number, number] {
  const { halfY } = a4HalfSizes(longSideMeters, orientation)
  const sign = side === 'top' ? 1 : -1
  const distFromCenter = sign * (halfY + offsetMeters)
  const angle = (rotationDeg * Math.PI) / 180
  const rN = distFromCenter * Math.cos(angle)
  const rE = distFromCenter * Math.sin(angle)
  return [
    lat + rN / M_PER_DEG_LAT,
    lng + rE / metersPerDegLng(lat)
  ]
}
