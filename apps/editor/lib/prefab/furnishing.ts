import type { AssetInput } from '@pascal-app/core/schema'

export type RoomType = 'bedroom' | 'bathroom' | 'kitchen' | 'living' | 'hallway' | 'storage'

export interface FurniturePlacement {
  name: string
  position: [number, number, number]
  rotation: [number, number, number]
  asset: AssetInput
}

// Built-in catalog subset used for auto-furnishing. Mirrors the small,
// always-available set the MCP `furnish_room` tool draws from — dimensions,
// offsets and src paths match the real assets shipped under `public/items/`.
const DOUBLE_BED: AssetInput = {
  id: 'double-bed', category: 'furniture', name: 'Double Bed',
  thumbnail: '/items/double-bed/thumbnail.webp', src: '/items/double-bed/model.glb',
  dimensions: [2, 0.8, 2.5], tags: ['floor', 'bedroom'], offset: [0, 0, -0.03],
}
const BEDSIDE_TABLE: AssetInput = {
  id: 'bedside-table', category: 'furniture', name: 'Bedside Table',
  thumbnail: '/items/bedside-table/thumbnail.webp', src: '/items/bedside-table/model.glb',
  dimensions: [0.5, 0.5, 0.5], tags: ['floor', 'bedroom'], offset: [0, 0, -0.01],
  surface: { height: 0.5 },
}
const DRESSER: AssetInput = {
  id: 'dresser', category: 'furniture', name: 'Dresser',
  thumbnail: '/items/dresser/thumbnail.webp', src: '/items/dresser/model.glb',
  dimensions: [1.5, 0.8, 1], tags: ['floor', 'storage', 'bedroom'],
  surface: { height: 0.8 },
}
const CLOSET: AssetInput = {
  id: 'closet', category: 'furniture', name: 'Closet',
  thumbnail: '/items/closet/thumbnail.webp', src: '/items/closet/model.glb',
  dimensions: [2, 2.5, 1], tags: ['floor', 'storage', 'bedroom'], offset: [0, 0, -0.01],
}
const TOILET: AssetInput = {
  id: 'toilet', category: 'bathroom', name: 'Toilet',
  thumbnail: '/items/toilet/thumbnail.webp', src: '/items/toilet/model.glb',
  dimensions: [1, 0.9, 1], tags: ['floor', 'large', 'bathroom'], offset: [0, 0, -0.23],
}
const BATHROOM_SINK: AssetInput = {
  id: 'bathroom-sink', category: 'bathroom', name: 'Bathroom Sink',
  thumbnail: '/items/bathroom-sink/thumbnail.webp', src: '/items/bathroom-sink/model.glb',
  dimensions: [2, 1, 1.5], tags: ['floor', 'large', 'bathroom'], offset: [0.11, 0, 0.02],
}
const SHOWER: AssetInput = {
  id: 'shower-square', category: 'bathroom', name: 'Squared Shower',
  thumbnail: '/items/shower-square/thumbnail.webp', src: '/items/shower-square/model.glb',
  dimensions: [1, 2, 1], tags: ['floor', 'large', 'bathroom'], offset: [0.41, 0, -0.42],
}
const KITCHEN: AssetInput = {
  id: 'kitchen', category: 'kitchen', name: 'Kitchen',
  thumbnail: '/items/kitchen/thumbnail.webp', src: '/items/kitchen/model.glb',
  dimensions: [2.5, 1.1, 1], tags: ['floor', 'large', 'kitchen'],
}
const KITCHEN_COUNTER: AssetInput = {
  id: 'kitchen-counter', category: 'kitchen', name: 'Kitchen Counter',
  thumbnail: '/items/kitchen-counter/thumbnail.webp', src: '/items/kitchen-counter/model.glb',
  dimensions: [2, 0.8, 1], tags: ['floor', 'large', 'storage', 'kitchen'],
  surface: { height: 0.75 },
}
const STOVE: AssetInput = {
  id: 'stove', category: 'kitchen', name: 'Stove',
  thumbnail: '/items/stove/thumbnail.webp', src: '/items/stove/model.glb',
  dimensions: [1, 1, 1], tags: ['floor', 'large', 'kitchen'], offset: [0, 0, -0.05],
}
const FRIDGE: AssetInput = {
  id: 'fridge', category: 'kitchen', name: 'Fridge',
  thumbnail: '/items/fridge/thumbnail.webp', src: '/items/fridge/model.glb',
  dimensions: [1, 2, 1], tags: ['floor', 'large', 'kitchen'], offset: [0.01, 0, -0.05],
}
const SOFA: AssetInput = {
  id: 'sofa', category: 'furniture', name: 'Sofa',
  thumbnail: '/items/sofa/thumbnail.webp', src: '/items/sofa/model.glb',
  dimensions: [2.5, 0.8, 1.5], tags: ['floor', 'seating', 'living'], offset: [0, 0, 0.04],
}
const COFFEE_TABLE: AssetInput = {
  id: 'coffee-table', category: 'furniture', name: 'Coffee Table',
  thumbnail: '/items/coffee-table/thumbnail.webp', src: '/items/coffee-table/model.glb',
  dimensions: [2, 0.4, 1.5], tags: ['floor', 'table', 'living'], surface: { height: 0.3 },
}
const TV_STAND: AssetInput = {
  id: 'tv-stand', category: 'furniture', name: 'TV Stand',
  thumbnail: '/items/tv-stand/thumbnail.webp', src: '/items/tv-stand/model.glb',
  dimensions: [2, 0.4, 0.5], tags: ['floor', 'storage', 'living'], offset: [0, 0.21, 0],
  surface: { height: 0.36 },
}
const LIVINGROOM_CHAIR: AssetInput = {
  id: 'livingroom-chair', category: 'furniture', name: 'Livingroom Chair',
  thumbnail: '/items/livingroom-chair/thumbnail.webp', src: '/items/livingroom-chair/model.glb',
  dimensions: [1.5, 0.8, 1.5], tags: ['floor', 'seating', 'living'], offset: [0.01, 0, 0],
}

// Rotation convention (degrees, converted to radians on the Y axis):
// 0 -> item faces +Z, 90 -> faces +X, 180 -> faces -Z, 270 -> faces -X.
function facing(deg: 0 | 90 | 180 | 270): [number, number, number] {
  return [0, (deg * Math.PI) / 180, 0]
}

/**
 * Auto-furnishes a rectangular room. `corners` follows the same
 * bottom-left/bottom-right/top-right/top-left winding `rectangleCorners`
 * produces, so the room's open (entry) side is assumed to be the low-Z
 * edge and furniture anchors against the opposite (high-Z, "back") wall.
 */
export function furnishRoomPlacements(
  roomType: RoomType,
  corners: [number, number][],
): FurniturePlacement[] {
  const xs = corners.map((c) => c[0])
  const zs = corners.map((c) => c[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const width = maxX - minX
  const depth = maxZ - minZ
  const centerX = (minX + maxX) / 2
  const area = width * depth

  const place = (
    asset: AssetInput,
    x: number,
    z: number,
    rotation: [number, number, number],
  ): FurniturePlacement => ({ name: asset.name, position: [x, 0, z], rotation, asset })

  const placements: FurniturePlacement[] = []

  switch (roomType) {
    case 'bedroom': {
      const [bedW, , bedD] = DOUBLE_BED.dimensions ?? [2, 0.8, 2.5]
      placements.push(place(DOUBLE_BED, centerX, maxZ - bedD / 2 - 0.1, facing(180)))
      if (width > bedW + 1.1) {
        placements.push(place(BEDSIDE_TABLE, centerX - bedW / 2 - 0.35, maxZ - 0.35, facing(180)))
        placements.push(place(BEDSIDE_TABLE, centerX + bedW / 2 + 0.35, maxZ - 0.35, facing(180)))
      }
      if (area >= 10) {
        const [, , dresserD] = DRESSER.dimensions ?? [1.5, 0.8, 1]
        placements.push(place(DRESSER, minX + dresserD / 2 + 0.1, centerZFraction(minZ, maxZ, 0.7), facing(90)))
      }
      if (area >= 13) {
        const [, , closetD] = CLOSET.dimensions ?? [2, 2.5, 1]
        placements.push(place(CLOSET, maxX - closetD / 2 - 0.1, centerZFraction(minZ, maxZ, 0.3), facing(270)))
      }
      break
    }
    case 'bathroom': {
      const useTub = area >= 6.5
      placements.push(place(TOILET, minX + width * 0.28, maxZ - 0.55, facing(180)))
      placements.push(place(BATHROOM_SINK, maxX - width * 0.28, maxZ - 0.6, facing(180)))
      if (!useTub) {
        placements.push(place(SHOWER, centerX, minZ + 0.6, facing(0)))
      }
      break
    }
    case 'kitchen': {
      const useFullKitchen = width >= 2.6
      const counter = useFullKitchen ? KITCHEN : KITCHEN_COUNTER
      const [, , counterD] = counter.dimensions ?? [2.5, 1.1, 1]
      placements.push(place(counter, centerX, maxZ - counterD / 2 - 0.05, facing(180)))
      if (width >= 3.5) {
        placements.push(place(STOVE, minX + 0.6, maxZ - 0.55, facing(180)))
      }
      placements.push(place(FRIDGE, minX + 0.55, minZ + 0.55, facing(90)))
      break
    }
    case 'living': {
      const [, , sofaD] = SOFA.dimensions ?? [2.5, 0.8, 1.5]
      placements.push(place(SOFA, centerX, maxZ - sofaD / 2 - 0.1, facing(180)))
      placements.push(place(COFFEE_TABLE, centerX, centerZFraction(minZ, maxZ, 0.5), facing(180)))
      placements.push(place(LIVINGROOM_CHAIR, minX + 0.85, minZ + width * 0.3, facing(90)))
      placements.push(place(TV_STAND, centerX, minZ + 0.35, facing(0)))
      break
    }
    case 'storage':
      placements.push(place(CLOSET, centerX, maxZ - 0.55, facing(180)))
      break
    case 'hallway':
      // No verified catalog asset for hallway furnishing yet — leave bare.
      break
  }

  return placements
}

function centerZFraction(minZ: number, maxZ: number, fraction: number): number {
  return minZ + (maxZ - minZ) * fraction
}
