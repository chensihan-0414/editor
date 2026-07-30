import { MODULE_CATALOG, ASSEMBLY_LIMITS } from './catalog'

export interface ModuleRequest {
  moduleId: string
  quantity: number
}

export interface PlacedModule {
  moduleId: string
  instanceId: string
  position: { x: number; z: number }
  rotation: 0 | 90 | 180 | 270
}

export interface Arrangement {
  modules: PlacedModule[]
  valid: boolean
  warnings: string[]
}

export function expandRequest(requests: ModuleRequest[]): string[] {
  return requests.flatMap((r) => Array(r.quantity).fill(r.moduleId))
}

export function checkAdjacencyConstraints(moduleIds: string[]): string[] {
  const warnings: string[] = []
  const present = new Set(moduleIds)
  for (const id of present) {
    const spec = MODULE_CATALOG[id]
    if (!spec?.constraints?.forbiddenAdjacentTo) continue
    for (const forbiddenId of spec.constraints.forbiddenAdjacentTo) {
      if (present.has(forbiddenId) && !present.has('hallway-connector')) {
        warnings.push(`${spec.label} and ${MODULE_CATALOG[forbiddenId]?.label} both present without a hallway-connector.`)
      }
    }
  }
  return warnings
}

export function packModulesIntoRows(moduleIds: string[]): PlacedModule[] {
  const totalArea = moduleIds.reduce((sum, id) => sum + MODULE_CATALOG[id].size.length * MODULE_CATALOG[id].size.width, 0)
  const targetRowWidth = Math.sqrt(totalArea) * 1.3
  const placed: PlacedModule[] = []
  let cursorX = 0, cursorZ = 0, rowHeight = 0
  moduleIds.forEach((moduleId, i) => {
    const { length, width } = MODULE_CATALOG[moduleId].size
    if (cursorX > 0 && cursorX + length > targetRowWidth) {
      cursorX = 0; cursorZ += rowHeight; rowHeight = 0
    }
    placed.push({ moduleId, instanceId: `${moduleId}_${i}`, position: { x: cursorX, z: cursorZ }, rotation: 0 })
    cursorX += length
    rowHeight = Math.max(rowHeight, width)
  })
  return placed
}

export function generateArrangement(requests: ModuleRequest[]): Arrangement {
  const moduleIds = expandRequest(requests)
  const warnings = checkAdjacencyConstraints(moduleIds)
  if (moduleIds.length > ASSEMBLY_LIMITS.maxModulesPerConfiguration) {
    return {
      modules: [],
      valid: false,
      warnings: [...warnings, `Configuration has ${moduleIds.length} modules, exceeding the placeholder limit of ${ASSEMBLY_LIMITS.maxModulesPerConfiguration}. Flagged for engineer review.`],
    }
  }
  return { modules: packModulesIntoRows(moduleIds), valid: true, warnings }
}

export function rectangleCorners(origin: { x: number; z: number }, length: number, width: number, rotation: number): [number, number][] {
  const dims = rotation === 90 || rotation === 270 ? [width, length] : [length, width]
  const [l, w] = dims
  return [[origin.x, origin.z], [origin.x + l, origin.z], [origin.x + l, origin.z + w], [origin.x, origin.z + w]]
}
