import useScene from '@pascal-app/core/store'
import {
  WallNode,
  ZoneNode,
  SiteNode,
  BuildingNode,
  LevelNode,
  ItemNode,
  DoorNode,
  type AssetInput,
} from '@pascal-app/core/schema'
import { catalogItem } from './item-catalog'

/**
 * Hand-authored layout approximating the reference render the user shared
 * (open kitchen + living room, ensuite bedroom, bathroom, entry closet, and
 * a small pet corner). Unlike step1's generic module packer, this is a
 * fixed floor plan — the L-shaped/open adjacency in the reference photo
 * isn't something the rectangular module packer in assembly.ts can produce,
 * so this builds walls/zones/items directly instead of going through
 * generateArrangement().
 *
 * Asset coverage against the full catalog (`./item-catalog`, 111 items —
 * see that file's header for why this replaced the earlier 22-item local
 * subset):
 *   - Matched 1:1: sofa, livingroom-chair, kitchen-counter,
 *     kitchen-bar (island), stove, fridge, double-bed, bedside-table,
 *     dresser, closet, toilet, bathroom-sink, shower-square.
 *   - Deliberately NOT placed, despite having a matching catalog id
 *     (style mismatch, confirmed by screenshot rather than guessed from
 *     tags — see "Walls & furniture color" below): coffee-table,
 *     tv-stand, stool.
 *   - Substituted (no closer match in the catalog):
 *       - bench at the foot of the bed -> dresser
 *   - Skipped entirely (no reasonable substitute in the catalog):
 *       - the entry console desk + 2 chairs
 *       - the two dog beds / pet toys
 *     The "Pet corner" zone is still created and labeled so it's visible
 *     and easy to furnish later once a pet-bed asset exists — nothing is
 *     placed inside it today.
 *
 * Note: the island used to be a second, freestanding `kitchen-counter`
 * (no island item in the old 22-item subset) — deep/wide enough that it
 * read as a partition wall between the kitchen and living room, working
 * against the "厨房→中岛→客厅视线完全贯通" brief. It's now the real
 * `kitchenBar` item (`wooden-kitchen-bar-moa2hhh4`), a slender wood/quartz
 * bar sized like an actual island rather than a cabinet run.
 *
 * Walls & furniture color: walls switched from a warm off-white (#f5f1ea)
 * to pure white (#ffffff) per "色彩严格控制：纯白墙面 + 浅原木主色" — see
 * WALL_MATERIAL below. Furniture color is a harder problem: the catalog
 * has exactly one fixed model per item id (no light/dark variants).
 * Rendering the scene and inspecting it directly (not just reading tags)
 * showed `coffee-table` and `tv-stand` both render as dark reddish-brown
 * wood, and `stool` has a black seat — all three clash with "浅原木主色，
 * 无深色重色家具" and were removed from placement rather than left in
 * (see the `item(...)` calls below). Re-add any of them via
 * `catalogItem(...)` once a lighter-toned catalog variant exists, or once
 * someone manually recolors the placed instance in the editor via its
 * per-slot material override (ItemNode.slots — requires opening the item
 * in the editor UI, since paintable slot ids live inside each glb, not in
 * this file).
 */

const WALL_THICKNESS = 0.15
const WALL_HEIGHT = 2.7
const DOOR_WIDTH = 0.9
const DOOR_HEIGHT = 2.1

const WALL_MATERIAL = {
  preset: 'white' as const,
  properties: { color: '#ffffff', roughness: 0.85, metalness: 0, opacity: 1, transparent: false, side: 'front' as const },
}

function facing(deg: 0 | 90 | 180 | 270): [number, number, number] {
  return [0, (deg * Math.PI) / 180, 0]
}

export async function buildAndSaveApartmentReplica1(
  sceneName = 'Reference apartment — open plan',
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const scene = useScene.getState()
  scene.clearScene()

  const site = SiteNode.parse({ name: sceneName })
  scene.createNode(site)
  const building = BuildingNode.parse({ name: 'Main house' })
  scene.createNode(building, site.id)
  const level = LevelNode.parse({ name: 'Ground floor', level: 0 })
  scene.createNode(level, building.id)

  const makeWall = (start: [number, number], end: [number, number]) =>
    WallNode.parse({ start, end, thickness: WALL_THICKNESS, height: WALL_HEIGHT, interiorMaterial: WALL_MATERIAL })

  // Perimeter, 10m x 7m.
  const south = makeWall([0, 0], [10, 0])
  const east = makeWall([10, 0], [10, 7])
  const north = makeWall([10, 7], [0, 7])
  const west = makeWall([0, 7], [0, 0])
  // Interior: carves the bedroom (top-right) and bathroom (bottom-right)
  // out of the open-plan rectangle, matching the reference's ensuite feel.
  const wallToBedroom = makeWall([7, 7], [7, 3]) // open-plan <-> bedroom
  const wallToBathroom = makeWall([7, 3], [7, 0]) // open-plan <-> bathroom
  const bedroomBathroomDivider = makeWall([7, 3], [10, 3])

  const allWalls = [south, east, north, west, wallToBedroom, wallToBathroom, bedroomBathroomDivider]
  for (const wall of allWalls) scene.createNode(wall, level.id)

  const zones: { name: string; polygon: [number, number][]; wallIds: string[]; metadata?: Record<string, unknown> }[] = [
    { name: 'Open kitchen + living', polygon: [[0, 0], [7, 0], [7, 7], [0, 7]], wallIds: [south.id, wallToBathroom.id, wallToBedroom.id, north.id, west.id] },
    { name: 'Bedroom', polygon: [[7, 3], [10, 3], [10, 7], [7, 7]], wallIds: [bedroomBathroomDivider.id, east.id, north.id, wallToBedroom.id] },
    { name: 'Bathroom', polygon: [[7, 0], [10, 0], [10, 3], [7, 3]], wallIds: [south.id, east.id, bedroomBathroomDivider.id, wallToBathroom.id] },
    {
      name: 'Pet corner (no bed asset yet)',
      polygon: [[0, 1.5], [1.5, 1.5], [1.5, 3], [0, 3]],
      wallIds: [west.id],
      metadata: { note: 'Reference photo has two dog beds here — no matching catalog asset, left empty on purpose.' },
    },
  ]
  for (const z of zones) {
    const zone = ZoneNode.parse({ name: z.name, polygon: z.polygon, boundaryWallIds: z.wallIds, metadata: z.metadata })
    scene.createNode(zone, level.id)
  }

  // Unverified guess at the paintable slot key — see the matching constant
  // and long comment in lib/prefab/furnishing.ts for why (glb slot names
  // aren't discoverable from this codebase; a wrong key just silently
  // doesn't recolor, it never breaks anything).
  const LIGHT_WOOD_SLOT_OVERRIDE: Record<string, string> = { wood: 'library:wood-woodfine1' }

  const item = (
    asset: AssetInput,
    x: number,
    z: number,
    rotationDeg: 0 | 90 | 180 | 270,
    metadata?: Record<string, unknown>,
    slots?: Record<string, string>,
  ) => {
    const node = ItemNode.parse({
      name: asset.name,
      position: [x, 0, z],
      rotation: facing(rotationDeg),
      asset,
      slots,
      metadata: { autoFurnished: true, replica: 'apartment-1', ...metadata },
    })
    scene.createNode(node, level.id)
  }

  // Kitchen, along the north wall of the open-plan zone.
  item(catalogItem('kitchenCounter'), 2, 6.6, 180)
  item(catalogItem('stove'), 3.6, 6.5, 180)
  item(catalogItem('fridge'), 5.7, 6.55, 180)

  // Island between kitchen and living — a real freestanding bar item
  // (wooden-kitchen-bar-moa2hhh4), not a full kitchen-counter run, so it
  // doesn't read as a wall splitting the kitchen/living sightline.
  // No stools placed on it: catalog `stool` renders with a black seat,
  // which clashes with the "浅原木主色，无深色重色家具" brief and the
  // catalog has no lighter-seat alternative — bar sits empty for now
  // rather than mix in a dark accent. Re-add via catalogItem('stool')
  // once a light-color stool exists.
  item(catalogItem('kitchenBar'), 5.5, 4, 0)

  // Living room, two sofas as in the reference. No coffee table or TV
  // stand: both catalog items render as dark reddish-brown wood
  // (confirmed by screenshot), which clashes with the same brief — see
  // the matching note in lib/prefab/furnishing.ts for the 'living' case.
  item(catalogItem('sofa'), 2.2, 3.4, 180)
  item(catalogItem('sofa'), 4.6, 3.2, 180)
  item(catalogItem('livingroomChair'), 4.1, 1.5, 270)

  // Entry closet.
  item(catalogItem('closet'), 0.5, 1, 90)

  // Bedroom. bedsideTable/dresser recolored — see LIGHT_WOOD_SLOT_OVERRIDE
  // above (both render dark reddish wood by default).
  item(catalogItem('doubleBed'), 8.5, 5.9, 180)
  item(catalogItem('bedsideTable'), 7.4, 5.9, 180, undefined, LIGHT_WOOD_SLOT_OVERRIDE)
  item(catalogItem('dresser'), 9.4, 3.6, 180, { substituteFor: 'foot-of-bed storage bench' }, LIGHT_WOOD_SLOT_OVERRIDE)

  // Bathroom.
  item(catalogItem('bathroomSink'), 8.5, 0.5, 0)
  item(catalogItem('toilet'), 9.4, 2.5, 180)
  item(catalogItem('showerSquare'), 7.6, 2.5, 0)

  // Doors: entry, plus one into the bedroom and one into the bathroom.
  const entryDoor = DoorNode.parse({
    wallId: south.id,
    parentId: south.id,
    position: [2, DOOR_HEIGHT / 2, 0],
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
  })
  scene.createNode(entryDoor, south.id)

  const bedroomDoor = DoorNode.parse({
    wallId: wallToBedroom.id,
    parentId: wallToBedroom.id,
    position: [2, DOOR_HEIGHT / 2, 0], // wall runs Z:7->3 (length 4), 2m from the north end
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
  })
  scene.createNode(bedroomDoor, wallToBedroom.id)

  const bathroomDoor = DoorNode.parse({
    wallId: wallToBathroom.id,
    parentId: wallToBathroom.id,
    position: [1.5, DOOR_HEIGHT / 2, 0], // wall runs Z:3->0 (length 3), centered
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
  })
  scene.createNode(bathroomDoor, wallToBathroom.id)

  const finalState = useScene.getState()
  const sceneApiToken = process.env.NEXT_PUBLIC_PASCAL_SCENE_API_TOKEN
  const response = await fetch('/api/scenes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sceneApiToken ? { 'x-pascal-scene-token': sceneApiToken } : {}),
    },
    body: JSON.stringify({
      name: sceneName,
      graph: { nodes: finalState.nodes, rootNodeIds: finalState.rootNodeIds },
    }),
  })

  if (!response.ok) {
    return { ok: false, error: `Failed to save scene: ${response.status} ${await response.text()}` }
  }

  const meta = await response.json()
  return { ok: true, id: meta.id }
}
