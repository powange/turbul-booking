import L from 'leaflet'
import type { Ref } from 'vue'
import type { PrintFrame } from '~~/shared/types'
import {
  M_PER_DEG_LAT,
  a4Corners,
  a4EdgeHandle,
  metersPerDegLng
} from '~/utils/geo'

export interface UsePlanPrintFrameOptions {
  frame: Ref<PrintFrame | null>
  /** Visible seulement en mode édition. */
  visible: Ref<boolean>
  canEdit: Ref<boolean>
  /** Drag du label central → déplacement. */
  onMove: (lat: number, lng: number) => void
  /** Drag d'un coin → redimensionnement (ratio A4 préservé). */
  onResize: (widthMeters: number) => void
  /** Drag de la poignée ↻ → rotation. */
  onRotate: (rotationDeg: number) => void
}

// Le polygone du cadre vit dans l'overlayPane par défaut puis est
// explicitement poussé au-dessus des caravanes et murs via bringToFront().
// Les poignées (markers) restent dans le markerPane (z 600) au-dessus
// de tout.
//
// Le coin est sur la demi-diagonale du rectangle. La diagonale est
// invariante par orientation (landscape ↔ portrait juste swap des
// dimensions), donc le facteur half_diag → grand côté est le même
// dans les deux cas.
// half_diag² = (long/2)² + (short/2)² avec short = long × (210/297)
//        ⇒ long = 2 × half_diag / sqrt(1 + (210/297)²)
const A4_RATIO = 210 / 297
const HALF_DIAG_TO_LONG = 2 / Math.sqrt(1 + A4_RATIO * A4_RATIO)

/**
 * Couche "Cadre PDF" : rectangle à ratio A4 paysage (singleton) avec
 * édition par manipulation directe sur la carte :
 *  - étiquette centrale draggable (move)
 *  - 4 coins draggables (resize, ratio préservé)
 *  - poignée ↻ au-dessus du bord supérieur (rotation)
 *
 * Pendant un drag, on met à jour visuellement TOUTES les autres poignées
 * (en plus du polygone) pour que l'ensemble reste cohérent. Au dragend,
 * on émet l'événement correspondant ; le parent persiste, la diffusion
 * WS rebouge tout.
 */
export function usePlanPrintFrame(opts: UsePlanPrintFrameOptions) {
  let map: L.Map | null = null
  let polygon: L.Polygon | null = null
  let centerMarker: L.Marker | null = null
  let rotationMarker: L.Marker | null = null
  const cornerMarkers: L.Marker[] = []

  // Paramètres "en vol" pendant un drag — on émet seulement au dragend.
  let pendingWidth: number | null = null
  let pendingRotation: number | null = null

  // ============ Icônes ============
  function makeCenterIcon(): L.DivIcon {
    return L.divIcon({
      className: 'print-frame-marker',
      html: '<div class="print-frame-pin">Cadre PDF</div>',
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    })
  }
  function makeCornerIcon(): L.DivIcon {
    return L.divIcon({
      className: 'print-frame-marker',
      html: '<div class="print-frame-corner"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    })
  }
  function makeRotationIcon(): L.DivIcon {
    // SVG rotate-cw inline (Lucide)
    return L.divIcon({
      className: 'print-frame-marker',
      html: '<div class="print-frame-rotate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    })
  }

  // ============ Calculs ============
  function corners(f: PrintFrame): L.LatLngExpression[] {
    return a4Corners(f.lat, f.lng, f.widthMeters, f.rotation, f.orientation) as L.LatLngExpression[]
  }
  function rotationHandle(f: PrintFrame): L.LatLngExpression {
    return a4EdgeHandle(f.lat, f.lng, f.widthMeters, f.rotation, 'top', f.orientation) as L.LatLngExpression
  }
  function moveHandle(f: PrintFrame): L.LatLngExpression {
    return a4EdgeHandle(f.lat, f.lng, f.widthMeters, f.rotation, 'bottom', f.orientation) as L.LatLngExpression
  }

  function metersFromCenter(center: L.LatLng, p: L.LatLng): { dN: number, dE: number, dist: number } {
    const dLat = p.lat - center.lat
    const dLng = p.lng - center.lng
    const dN = dLat * M_PER_DEG_LAT
    const dE = dLng * metersPerDegLng(center.lat)
    return { dN, dE, dist: Math.sqrt(dN * dN + dE * dE) }
  }

  /** Inverse du moveHandle : depuis la position de la poignée bottom,
   *  retrouve les coordonnées du centre du rectangle. La hauteur locale
   *  dépend de l'orientation (petit côté en landscape, grand en portrait). */
  function centerFromMoveHandle(
    handleLL: L.LatLng,
    widthMeters: number,
    rotationDeg: number,
    orientation: PrintFrame['orientation'],
    offsetMeters = 5
  ): { lat: number, lng: number } {
    const localHeightMeters = orientation === 'landscape'
      ? widthMeters * (210 / 297)
      : widthMeters
    const D = localHeightMeters / 2 + offsetMeters
    const angle = (rotationDeg * Math.PI) / 180
    // Vecteur poignée → centre = +D dans la direction "nord" du rectangle
    const dE = D * Math.sin(angle)
    const dN = D * Math.cos(angle)
    return {
      lat: handleLL.lat + dN / M_PER_DEG_LAT,
      lng: handleLL.lng + dE / metersPerDegLng(handleLL.lat)
    }
  }

  // ============ Mises à jour visuelles ============
  function applyVisualState(
    f: { lat: number, lng: number, widthMeters: number, rotation: number, orientation: PrintFrame['orientation'] },
    except?: L.Marker
  ) {
    const newCorners = a4Corners(f.lat, f.lng, f.widthMeters, f.rotation, f.orientation)
    polygon?.setLatLngs(newCorners)
    cornerMarkers.forEach((cm, idx) => {
      if (cm !== except) cm.setLatLng(newCorners[idx]!)
    })
    if (rotationMarker !== except) {
      rotationMarker?.setLatLng(a4EdgeHandle(f.lat, f.lng, f.widthMeters, f.rotation, 'top', f.orientation))
    }
    if (centerMarker !== except) {
      centerMarker?.setLatLng(a4EdgeHandle(f.lat, f.lng, f.widthMeters, f.rotation, 'bottom', f.orientation))
    }
  }

  // ============ Drag handlers ============
  function onCenterDrag() {
    if (!centerMarker || !opts.frame.value) return
    const f = opts.frame.value
    const handleLL = centerMarker.getLatLng()
    const { lat, lng } = centerFromMoveHandle(handleLL, f.widthMeters, f.rotation, f.orientation)
    applyVisualState({ ...f, lat, lng }, centerMarker)
  }
  function onCenterDragEnd() {
    if (!centerMarker || !opts.frame.value) return
    const f = opts.frame.value
    const handleLL = centerMarker.getLatLng()
    const { lat, lng } = centerFromMoveHandle(handleLL, f.widthMeters, f.rotation, f.orientation)
    opts.onMove(lat, lng)
  }

  function onCornerDrag(m: L.Marker) {
    if (!opts.frame.value) return
    const f = opts.frame.value
    const center = L.latLng(f.lat, f.lng)
    const { dist } = metersFromCenter(center, m.getLatLng())
    // half_diag → grand côté (invariant par orientation, cf. constante).
    const newWidth = Math.max(1, dist * HALF_DIAG_TO_LONG)
    pendingWidth = newWidth
    applyVisualState({ ...f, widthMeters: newWidth }, m)
  }
  function onCornerDragEnd() {
    if (pendingWidth !== null) {
      opts.onResize(pendingWidth)
      pendingWidth = null
    }
  }

  function onRotationDrag() {
    if (!rotationMarker || !opts.frame.value) return
    const f = opts.frame.value
    const center = L.latLng(f.lat, f.lng)
    const { dN, dE } = metersFromCenter(center, rotationMarker.getLatLng())
    // Si le curseur est très près du centre, atan2 devient instable et
    // donne un angle aléatoire — on ignore le tick pour éviter les sauts.
    if (Math.abs(dN) < 0.01 && Math.abs(dE) < 0.01) return
    // Angle horaire depuis le nord = atan2(est, nord)
    const angle = ((Math.atan2(dE, dN) * 180) / Math.PI + 360) % 360
    pendingRotation = angle
    // Re-snap la poignée sur l'arc canonique (distance fixe = halfY + offset)
    // pour qu'elle reste collée au bord supérieur du rectangle. Sans ça,
    // le marker dérive librement sous le curseur (sensation de "téléport"
    // quand on l'éloigne radialement). applyVisualState s'occupe ensuite
    // du polygone, des coins et du marker move.
    rotationMarker.setLatLng(
      a4EdgeHandle(f.lat, f.lng, f.widthMeters, angle, 'top', f.orientation)
    )
    applyVisualState({ ...f, rotation: angle })
  }
  function onRotationDragEnd() {
    if (pendingRotation !== null) {
      opts.onRotate(pendingRotation)
      pendingRotation = null
    }
  }

  // ============ Création / sync layers ============
  function ensureLayers(f: PrintFrame) {
    if (!map) return
    // Capture non-nullable pour les closures (forEach) qui sinon voient
    // `map: L.Map | null`.
    const m0 = map
    const cornerLatLngs = corners(f)

    // Polygone — overlayPane par défaut + bringToFront pour passer
    // au-dessus des caravanes et murs.
    if (!polygon) {
      polygon = L.polygon(cornerLatLngs, {
        color: '#cb6743',
        weight: 2,
        dashArray: '6 4',
        fill: false,
        interactive: false
      }).addTo(m0)
      polygon.bringToFront()
    } else {
      polygon.setLatLngs(cornerLatLngs)
    }

    // Marker "déplacer" — sous le bord inférieur du rectangle (symétrique
    // de la poignée de rotation au-dessus). Variable nommée `centerMarker`
    // pour rétrocompat, mais positionnée hors du centre. Markers dans le
    // markerPane par défaut (z 600), au-dessus du polygone.
    const movePos = moveHandle(f)
    if (!centerMarker) {
      centerMarker = L.marker(movePos, {
        draggable: opts.canEdit.value,
        icon: makeCenterIcon(),
        autoPan: true
      }).addTo(m0)
      centerMarker.on('drag', onCenterDrag)
      centerMarker.on('dragend', onCenterDragEnd)
    } else {
      centerMarker.setLatLng(movePos)
      centerMarker.dragging?.[opts.canEdit.value ? 'enable' : 'disable']()
    }

    // 4 markers de coins
    cornerLatLngs.forEach((ll, idx) => {
      const existing = cornerMarkers[idx]
      if (existing) {
        existing.setLatLng(ll)
        existing.dragging?.[opts.canEdit.value ? 'enable' : 'disable']()
      } else {
        const m = L.marker(ll, {
          draggable: opts.canEdit.value,
          icon: makeCornerIcon(),
          autoPan: false
        }).addTo(m0)
        m.on('drag', () => onCornerDrag(m))
        m.on('dragend', onCornerDragEnd)
        cornerMarkers[idx] = m
      }
    })

    // Marker rotation
    const rotPos = rotationHandle(f)
    if (!rotationMarker) {
      rotationMarker = L.marker(rotPos, {
        draggable: opts.canEdit.value,
        icon: makeRotationIcon(),
        autoPan: false
      }).addTo(m0)
      rotationMarker.on('drag', onRotationDrag)
      rotationMarker.on('dragend', onRotationDragEnd)
    } else {
      rotationMarker.setLatLng(rotPos)
      rotationMarker.dragging?.[opts.canEdit.value ? 'enable' : 'disable']()
    }
  }

  function clearLayers() {
    if (polygon) {
      polygon.remove()
      polygon = null
    }
    if (centerMarker) {
      centerMarker.remove()
      centerMarker = null
    }
    if (rotationMarker) {
      rotationMarker.remove()
      rotationMarker = null
    }
    cornerMarkers.forEach(m => m.remove())
    cornerMarkers.length = 0
  }

  function sync() {
    if (!map) return
    const f = opts.frame.value
    if (!f || !opts.visible.value) {
      clearLayers()
      return
    }
    ensureLayers(f)
  }

  function attach(m: L.Map) {
    map = m
    sync()
  }

  function detach() {
    clearLayers()
    map = null
  }

  watch(opts.frame, () => sync(), { deep: true })
  watch(opts.visible, () => sync())
  watch(opts.canEdit, () => sync())

  return { attach, detach }
}
