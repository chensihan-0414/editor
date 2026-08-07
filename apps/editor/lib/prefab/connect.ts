import { MODULE_CATALOG } from './catalog'
import type { PlacedModule } from './assembly'

/**
 * Turns a flat list of placed prefab modules (each drawn as its own sealed
 * 4-wall box by the old code) into a single connected house: shared
 * boundaries between touching modules become open doorways instead of two
 * overlapping walls, and the exterior gets one entry door.
 *
 * This is what was missing before: `packModulesIntoRows` placed modules
 * edge-to-edge, but nothing ever detected that adjacency or cut an opening
 * into it, so every module rendered as an isolated sealed room with no way
 * in or out — visually and functionally broken, even though each box's own
 * geometry was individually correct.
 */

export interface ModuleRect {
  instanceId: string
  moduleId: string
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface OpenBoundary {
  /** 'x' = a vertical boundary at a fixed X, spanning Z. 'z' = a horizontal boundary at a fixed Z, spanning X. */
  axis: 'x' | 'z'
  coord: number
  from: number
  to: number
}

export interface WallSegment {
  from: number
  to: number
}

// Matches the default DoorNode width (packages/core/src/schema/nodes/door.ts)
// — an opening narrower than this isn't treated as a real doorway, it stays walled.
const MIN_OPENING = 0.9
const MIN_WALL_SEGMENT = 0.2
const EPS = 0.01

export function computeModuleRects(modules: PlacedModule[]): ModuleRect[] {
  return modules.map((m) => {
    const spec = MODULE_CATALOG[m.moduleId]
    const [l, w] =
      m.rotation === 90 || m.rotation === 270
        ? [spec.size.width, spec.size.length]
        : [spec.size.length, spec.size.width]
    return {
      instanceId: m.instanceId,
      moduleId: m.moduleId,
      minX: m.position.x,
      maxX: m.position.x + l,
      minZ: m.position.z,
      maxZ: m.position.z + w,
    }
  })
}

/** Finds every place two module rectangles touch along enough of their shared edge to fit a doorway. */
export function computeOpenBoundaries(rects: ModuleRect[]): OpenBoundary[] {
  const openings: OpenBoundary[] = []
  for (let i = 0; i < rects.length; i++) {
    const a = rects[i]
    for (let j = i + 1; j < rects.length; j++) {
      const b = rects[j]

      if (Math.abs(a.maxX - b.minX) < EPS || Math.abs(b.maxX - a.minX) < EPS) {
        const coord = Math.abs(a.maxX - b.minX) < EPS ? a.maxX : b.maxX
        const from = Math.max(a.minZ, b.minZ)
        const to = Math.min(a.maxZ, b.maxZ)
        if (to - from >= MIN_OPENING) openings.push({ axis: 'x', coord, from, to })
      }

      if (Math.abs(a.maxZ - b.minZ) < EPS || Math.abs(b.maxZ - a.minZ) < EPS) {
        const coord = Math.abs(a.maxZ - b.minZ) < EPS ? a.maxZ : b.maxZ
        const from = Math.max(a.minX, b.minX)
        const to = Math.min(a.maxX, b.maxX)
        if (to - from >= MIN_OPENING) openings.push({ axis: 'z', coord, from, to })
      }
    }
  }
  return openings
}

/**
 * Subtracts any open-boundary intervals lying on this exact edge from
 * [from, to], returning the solid wall sub-segments that remain. An edge
 * fully covered by an opening (typical same-width neighbor in a row)
 * returns an empty array — no wall drawn there at all, on either side,
 * since both modules clip against the same shared interval.
 */
export function clipEdgeToSolidSegments(
  axis: 'x' | 'z',
  coord: number,
  from: number,
  to: number,
  openings: OpenBoundary[],
): WallSegment[] {
  const cuts = openings
    .filter((o) => o.axis === axis && Math.abs(o.coord - coord) < EPS)
    .map((o) => ({ from: Math.max(o.from, from), to: Math.min(o.to, to) }))
    .filter((o) => o.to > o.from)
    .sort((a, b) => a.from - b.from)

  const segments: WallSegment[] = []
  let cursor = from
  for (const cut of cuts) {
    if (cut.from > cursor + EPS) segments.push({ from: cursor, to: cut.from })
    cursor = Math.max(cursor, cut.to)
  }
  if (to > cursor + EPS) segments.push({ from: cursor, to })
  return segments.filter((s) => s.to - s.from >= MIN_WALL_SEGMENT)
}
