import type { AssetInput } from '@pascal-app/core/schema'
import { catalogItem } from './item-catalog'

export type RoomType = 'bedroom' | 'bathroom' | 'kitchen' | 'living' | 'hallway' | 'storage'

export interface FurniturePlacement {
  name: string
  position: [number, number, number]
  rotation: [number, number, number]
  asset: AssetInput
  // Per-slot material overrides (ItemNode.slots — see
  // packages/core/src/schema/nodes/item.ts). Consumed by whatever builds
  // the actual ItemNode from this placement (see app/step1/page.tsx's
  // buildAndSaveScene, and replica-apartment-1.ts's own `item()` helper).
  slots?: Record<string, string>
}

// `library:<id>` refs point at a real, confirmed-existing entry in
// MATERIAL_CATALOG (packages/core/src/material-library.ts) — e.g.
// 'wood-woodfine1' is tagged `surfaces: ['floor', 'wall', 'furniture']`,
// a light natural wood finish safe to use on furniture.
//
// UNVERIFIED PIECE: the slot key ('wood' below) is a guess, not confirmed.
// Per-item paintable regions are named inside each glb (material names
// prefixed `slot_…`, see packages/core/src/lib/slots.ts /
// deriveSlotId) — there's no static list of them in this repo, and the
// live editor's material-paint panel is what would normally show the
// real name. A wrong slot key is harmless (dangling refs silently render
// the item's default material — packages/core/src/schema/nodes/item.ts,
// `slots` field docstring), it just won't recolor anything. To confirm:
// open a generated scene, click the dresser/bedside-table, use its
// paint/material tool — whatever region label it shows, lowercase it and
// swap it in below (e.g. "Frame" -> 'frame').
const LIGHT_WOOD_SLOT_OVERRIDE: Record<string, string> = { wood: 'library:wood-woodfine1' }

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
 *
 * Assets are pulled live from the full catalog (`./item-catalog`) instead
 * of a hand-copied local subset, so dimensions/offsets here always match
 * what the editor UI actually renders.
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
    slots?: Record<string, string>,
  ): FurniturePlacement => ({ name: asset.name, position: [x, 0, z], rotation, asset, slots })

  const placements: FurniturePlacement[] = []

  switch (roomType) {
    case 'bedroom': {
      const doubleBed = catalogItem('doubleBed')
      const [bedW, , bedD] = doubleBed.dimensions ?? [1.52, 0.71, 2]
      placements.push(place(doubleBed, centerX, maxZ - bedD / 2 - 0.1, facing(180)))
      if (width > bedW + 1.1) {
        const bedsideTable = catalogItem('bedsideTable')
        // Recolored: this item renders dark reddish wood by default, which
        // clashes with the "浅原木主色" brief — see LIGHT_WOOD_SLOT_OVERRIDE
        // above for why the slot key is unverified.
        placements.push(place(bedsideTable, centerX - bedW / 2 - 0.35, maxZ - 0.35, facing(180), LIGHT_WOOD_SLOT_OVERRIDE))
        placements.push(place(bedsideTable, centerX + bedW / 2 + 0.35, maxZ - 0.35, facing(180), LIGHT_WOOD_SLOT_OVERRIDE))
      }
      if (area >= 10) {
        const dresser = catalogItem('dresser')
        const [, , dresserD] = dresser.dimensions ?? [1.23, 0.73, 0.61]
        // Recolored, same reason as bedsideTable above.
        placements.push(place(dresser, minX + dresserD / 2 + 0.1, centerZFraction(minZ, maxZ, 0.7), facing(90), LIGHT_WOOD_SLOT_OVERRIDE))
      }
      if (area >= 13) {
        const closet = catalogItem('closet')
        const [, , closetD] = closet.dimensions ?? [1.95, 2.26, 0.6]
        placements.push(place(closet, maxX - closetD / 2 - 0.1, centerZFraction(minZ, maxZ, 0.3), facing(270)))
      }
      break
    }
    case 'bathroom': {
      const useTub = area >= 6.5
      placements.push(place(catalogItem('toilet'), minX + width * 0.28, maxZ - 0.35, facing(180)))
      placements.push(place(catalogItem('bathroomSink'), maxX - width * 0.28, maxZ - 0.4, facing(180)))
      if (useTub) {
        placements.push(place(catalogItem('bathtub'), centerX, minZ + 0.6, facing(0)))
      } else {
        placements.push(place(catalogItem('showerSquare'), centerX, minZ + 0.5, facing(0)))
      }
      break
    }
    case 'kitchen': {
      const useFullKitchen = width >= 2.6
      const counter = useFullKitchen ? catalogItem('kitchen') : catalogItem('kitchenCounter')
      const [, , counterD] = counter.dimensions ?? [2.38, 1.03, 0.84]
      placements.push(place(counter, centerX, maxZ - counterD / 2 - 0.05, facing(180)))
      if (width >= 3.5) {
        placements.push(place(catalogItem('stove'), minX + 0.55, maxZ - 0.5, facing(180)))
      }
      placements.push(place(catalogItem('fridge'), minX + 0.4, minZ + 0.4, facing(90)))
      break
    }
    case 'living': {
      const sofa = catalogItem('sofa')
      const [, , sofaD] = sofa.dimensions ?? [2.06, 0.74, 1.01]
      placements.push(place(sofa, centerX, maxZ - sofaD / 2 - 0.1, facing(180)))
      placements.push(place(catalogItem('livingroomChair'), minX + 0.65, minZ + width * 0.3, facing(90)))
      // coffee-table and tv-stand deliberately NOT placed: both catalog
      // items render as dark reddish-brown wood (confirmed by screenshot,
      // not just their tags), which clashes with the "纯白墙面 + 浅原木
      // 主色，无深色重色家具" brief. The catalog has no lighter-wood
      // alternative for either category, so the room goes without a
      // coffee table / TV stand for now rather than mix in a dark
      // wood piece. Re-add via catalogItem('coffeeTable') /
      // catalogItem('tvStand') once a light-wood variant exists.
      break
    }
    case 'storage':
      placements.push(place(catalogItem('closet'), centerX, maxZ - 0.35, facing(180)))
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
