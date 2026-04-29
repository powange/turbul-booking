import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free' // augmente Leaflet avec `layer.pm.*`
import type { Ref } from 'vue'
import type { Wall } from '~~/shared/types'
import { latLngsToPoints, pointsToLatLngs } from '~/utils/leafletGeo'

export interface UsePlanWallsOptions {
  walls: Ref<Wall[]>
  selectedWallId: Ref<string | null>
  wallDrawMode: Ref<boolean>
  draftWallColor: Ref<string | undefined>
  draftWallThickness: Ref<number | undefined>
  canEdit: Ref<boolean>
  onSelectWall: (id: string | null) => void
  onWallCreated: (points: Array<[number, number]>) => void
  onWallEdited: (id: string, points: Array<[number, number]>) => void
}

/**
 * Couche murs décoratifs — polylignes libres dessinées via Geoman.
 * Mêmes mécaniques que les zones (édition Geoman sur la sélection) mais
 * pour des polylignes non fermées.
 *
 * Panes : les murs sont placés dans l'`overlayPane` (par défaut) puis
 * explicitement renvoyés en arrière via `bringToBack()` pour rester sous
 * les polygones de caravanes du même pane.
 */
export function usePlanWalls(opts: UsePlanWallsOptions) {
  let map: L.Map | null = null
  const wallPolylines = new Map<string, L.Polyline>()
  let editingWallId: string | null = null

  function wallStyle(w: Wall) {
    return {
      color: w.color,
      weight: w.thickness,
      opacity: 1,
      lineCap: 'round' as L.LineCapShape,
      lineJoin: 'round' as L.LineJoinShape
    }
  }

  function enableGeomanEdit(id: string) {
    const target = wallPolylines.get(id)
    if (!target) return
    target.pm.enable({
      allowSelfIntersection: true,
      snappable: false,
      draggable: true
    })
    const onUpdate = () => {
      opts.onWallEdited(id, latLngsToPoints(target))
    }
    target.on('pm:edit', onUpdate)
    target.on('pm:dragend', onUpdate)
  }

  function syncWall(w: Wall) {
    if (!map) return
    const existing = wallPolylines.get(w.id)

    if (existing && editingWallId === w.id) {
      existing.setStyle(wallStyle(w))
      return
    }

    const latlngs = pointsToLatLngs(w.points)

    if (existing) {
      existing.setLatLngs(latlngs)
      existing.setStyle(wallStyle(w))
    } else {
      const polyline = L.polyline(latlngs, {
        ...wallStyle(w),
        interactive: true
      })
      polyline.on('click', (e) => {
        if (opts.wallDrawMode.value) return
        L.DomEvent.stopPropagation(e)
        if (opts.canEdit.value) opts.onSelectWall(w.id)
      })
      polyline.addTo(map)
      // Renvoie en arrière dans l'overlay pour passer sous les
      // polygones de caravanes (qui partagent le même pane).
      polyline.bringToBack()
      wallPolylines.set(w.id, polyline)

      if (editingWallId === w.id) enableGeomanEdit(w.id)
    }
  }

  function removeWall(id: string) {
    const p = wallPolylines.get(id)
    if (!p) return
    p.pm?.disable?.()
    p.remove()
    wallPolylines.delete(id)
    if (editingWallId === id) editingWallId = null
  }

  function diffSyncWalls(list: Wall[]) {
    if (!map) return
    const newIds = new Set(list.map(w => w.id))
    for (const id of [...wallPolylines.keys()]) {
      if (!newIds.has(id)) removeWall(id)
    }
    for (const w of list) syncWall(w)
  }

  function applyEditMode(id: string | null) {
    if (!map) return
    if (editingWallId && editingWallId !== id) {
      const prev = wallPolylines.get(editingWallId)
      if (prev) {
        prev.pm.disable()
        prev.off('pm:edit')
        prev.off('pm:dragend')
      }
    }
    editingWallId = id
    if (id) enableGeomanEdit(id)
  }

  function startDraw() {
    if (!map) return
    const color = opts.draftWallColor.value ?? '#1f2937'
    const weight = opts.draftWallThickness.value ?? 3
    map.pm.enableDraw('Line', {
      snappable: false,
      pathOptions: { color, weight, lineCap: 'round', lineJoin: 'round' },
      hintlineStyle: { color, dashArray: [5, 5] },
      templineStyle: { color }
    })
  }

  function stopDraw() {
    if (!map) return
    if (map.pm.globalDrawModeEnabled?.()) map.pm.disableDraw()
  }

  function attach(m: L.Map) {
    map = m
    diffSyncWalls(opts.walls.value)
    if (opts.wallDrawMode.value) startDraw()
    if (opts.selectedWallId.value) applyEditMode(opts.selectedWallId.value)
  }

  function detach() {
    wallPolylines.forEach(p => p.remove())
    wallPolylines.clear()
    editingWallId = null
    map = null
  }

  watch(opts.walls, list => diffSyncWalls(list), { deep: true })
  watch(opts.wallDrawMode, (mode) => {
    if (mode) startDraw()
    else stopDraw()
  })
  watch(opts.selectedWallId, id => applyEditMode(id))
  watch(opts.draftWallColor, () => {
    if (opts.wallDrawMode.value) {
      stopDraw()
      startDraw()
    }
  })
  watch(opts.draftWallThickness, () => {
    if (opts.wallDrawMode.value) {
      stopDraw()
      startDraw()
    }
  })

  return { attach, detach, onPmCreate: opts.onWallCreated }
}
