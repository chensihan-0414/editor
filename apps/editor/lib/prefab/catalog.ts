/**
 * Factory module catalog — placeholder data pending factory confirmation.
 * Swap the values here once real specs are available; nothing downstream
 * needs to change.
 */

export type Edge = 'N' | 'E' | 'S' | 'W'

export interface ModuleSpec {
  id: string
  label: string
  category: 'bedroom' | 'bathroom' | 'kitchen' | 'living' | 'connector' | 'exterior' | 'utility' | 'storage'
  size: { length: number; width: number }
  connectableEdges: Edge[]
  constraints?: {
    forbiddenAdjacentTo?: string[]
    exteriorWallOnly?: boolean
    maxPerConfiguration?: number
  }
}

export const MODULE_CATALOG: Record<string, ModuleSpec> = {
  'bedroom-std': { id: 'bedroom-std', label: 'Standard bedroom', category: 'bedroom', size: { length: 6, width: 3 }, connectableEdges: ['N', 'E', 'S', 'W'] },
  'bedroom-master': { id: 'bedroom-master', label: 'Master bedroom', category: 'bedroom', size: { length: 6, width: 3.6 }, connectableEdges: ['N', 'E', 'S'] },
  'bathroom-std': { id: 'bathroom-std', label: 'Bathroom', category: 'bathroom', size: { length: 2.5, width: 2 }, connectableEdges: ['N'], constraints: { forbiddenAdjacentTo: ['kitchen-open'] } },
  'kitchen-open': { id: 'kitchen-open', label: 'Open kitchen', category: 'kitchen', size: { length: 4, width: 3 }, connectableEdges: ['E', 'S'] },
  'living-room': { id: 'living-room', label: 'Living room', category: 'living', size: { length: 6, width: 4 }, connectableEdges: ['N', 'E', 'S', 'W'] },
  'hallway-connector': { id: 'hallway-connector', label: 'Hallway connector', category: 'connector', size: { length: 1.5, width: 3 }, connectableEdges: ['E', 'W'] },
  'porch-covered': { id: 'porch-covered', label: 'Covered porch', category: 'exterior', size: { length: 3, width: 1.5 }, connectableEdges: ['N'], constraints: { exteriorWallOnly: true } },
  'utility-mechanical': { id: 'utility-mechanical', label: 'Utility', category: 'utility', size: { length: 1.5, width: 1.5 }, connectableEdges: ['N'] },
  'storage-loft': { id: 'storage-loft', label: 'Loft storage', category: 'storage', size: { length: 6, width: 3 }, connectableEdges: [], constraints: { maxPerConfiguration: 1 } },
}

export const ASSEMBLY_LIMITS = { maxModulesPerConfiguration: 6 }
