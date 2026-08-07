import type { AssetInput } from '@pascal-app/core/schema'
import { CATALOG_ITEMS } from '@pascal-app/editor/catalog'

/**
 * Single source of truth for furniture/fixture assets used by the
 * code-based scene generators (furnishing.ts, replica-apartment-1.ts, and
 * anything else that places items programmatically).
 *
 * Before this file existed, furnishing.ts and replica-apartment-1.ts each
 * hand-copied a small subset of items as local `AssetInput` consts pointing
 * at local `/items/<id>/model.glb` paths — a 22-item subset mirroring the
 * MCP `furnish_room` tool's browser-unsafe catalog module. That subset was
 * stale: dimensions/offsets were rough guesses, and it excluded ~90 items
 * that exist in the real, authoritative catalog the editor UI's item
 * picker uses (`@pascal-app/editor/catalog`, 111 items, hosted on Pascal's
 * public Supabase Storage CDN — a different bucket than this project's own
 * Supabase project used for scene persistence).
 *
 * This file pulls directly from that real catalog, so generated scenes use
 * the same models, thumbnails, and (importantly) the same real dimensions
 * and mesh-pivot offsets as the editor UI — no more guessed bounding boxes.
 */

const catalogById = new Map<string, AssetInput>(CATALOG_ITEMS.map((item) => [item.id, item]))

/**
 * Looks up a catalog item by its real id. Throws instead of silently
 * returning undefined — a typo'd id here would otherwise show up as a
 * missing/invisible item deep inside a generated scene, which is much
 * harder to debug than a build-time/first-call error.
 */
export function getCatalogItem(id: string): AssetInput {
  const item = catalogById.get(id)
  if (!item) {
    const available = CATALOG_ITEMS.map((i) => i.id).sort().join(', ')
    throw new Error(`item-catalog: no catalog item with id "${id}". Available ids: ${available}`)
  }
  return item
}

/**
 * Semantic name -> real catalog id, so call sites read as `ITEM.sofa`
 * instead of a bare string. Keep this list in sync with what the
 * generators actually use; add entries as needed rather than importing
 * `getCatalogItem` with raw strings everywhere.
 *
 * Coverage notes (checked against all 111 catalog ids, see
 * packages/editor/src/components/ui/item-catalog/catalog-items.tsx):
 *   - Bar stools now have a real match: `stool`. Earlier revisions of
 *     replica-apartment-1.ts substituted `dining-chair` for these because
 *     the small 22-item subset didn't include a stool — that substitution
 *     is no longer necessary and has been removed.
 *   - Pet beds / dog beds: still no matching catalog item. The "Pet
 *     corner" zone in replica-apartment-1.ts stays intentionally empty.
 */
export const ITEM_IDS = {
  // Living room
  sofa: 'sofa',
  coffeeTable: 'coffee-table',
  tvStand: 'tv-stand',
  livingroomChair: 'livingroom-chair',
  loungeChair: 'lounge-chair',
  bookshelf: 'bookshelf',
  rectangularCarpet: 'rectangular-carpet',

  // Dining / kitchen seating
  diningTable: 'dining-table',
  diningChair: 'dining-chair',
  stool: 'stool',

  // Kitchen
  kitchen: 'kitchen',
  kitchenCounter: 'kitchen-counter',
  kitchenCabinet: 'kitchen-cabinet',
  hood: 'hood',
  stove: 'stove',
  fridge: 'fridge',
  dishwasher: 'dishwasher-movn72ls',

  // Bedroom
  doubleBed: 'double-bed',
  singleBed: 'single-bed',
  bunkBed: 'bunkbed',
  bedsideTable: 'bedside-table',
  dresser: 'dresser',
  closet: 'closet',

  // Bathroom
  toilet: 'toilet',
  bathroomSink: 'bathroom-sink',
  showerSquare: 'shower-square',
  showerAngle: 'shower-angle',
  bathtub: 'bathtub',
  washingMachine: 'washing-machine',

  // Office / misc
  officeDesk: 'office-table',
  officeChair: 'office-chair',
  standingDesk: 'standing-desk-mo8wgz95',
} as const

export type ItemKey = keyof typeof ITEM_IDS

/** Convenience accessor: `catalogItem('sofa')` instead of `getCatalogItem(ITEM_IDS.sofa)`. */
export function catalogItem(key: ItemKey): AssetInput {
  return getCatalogItem(ITEM_IDS[key])
}
