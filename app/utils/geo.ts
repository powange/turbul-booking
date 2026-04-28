// Conversion mètre ↔ degrés autour d'une latitude.
// 1° de latitude ≈ 111 320 m. 1° de longitude ≈ 111 320 m × cos(lat).
const M_PER_DEG_LAT = 111_320

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
