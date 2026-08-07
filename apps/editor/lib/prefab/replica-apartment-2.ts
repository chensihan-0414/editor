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
 * Hand-authored layout approximating the "Tropical climate" reference
 * render (recommended-for-market card #2): a small open-plan bungalow —
 * bedroom and kitchen share one room with no dividing wall, a small
 * ensuite bathroom in one corner, and a covered outdoor deck with a
 * dining set out front. Same fixed-floor-plan approach as
 * replica-apartment-1.ts, reachable via /step1?replica=apartment-2.
 *
 * Not modeled (outside what this hand-authored wall/zone/item builder
 * does — see replica-apartment-1.ts for the same caveat):
 *   - The pitched green roof + wood slat sun-shade awnings over the
 *     windows/porch. This builder only creates vertical walls, no roof
 *     geometry, same as apartment-1.
 *   - Exterior landscaping (tropical plants, timber deck steps).
 *
 * Asset substitutions against the full catalog (`./item-catalog`, 111
 * items):
 *   - Round dining table -> `diningTableOak` (catalog id
 *     `dining-table-mo9ms5yh`, tagged oak/scandinavian/minimalist —
 *     light wood, but rectangular; the catalog has no round table).
 *     Deliberately NOT `diningTable` (id `dining-table`), which is
 *     tagged `walnut` (dark wood) — same style problem flagged in
 *     replica-apartment-1.ts and furnishing.ts.
 *   - Kitchen -> the compound `kitchen` catalog item (cabinetry + built-in
 *     cooktop in one model), not `kitchenCounter` + a separate `stove` —
 *     closer to the reference's single continuous counter run.
 *
 * Walls use the same WALL_MATERIAL as apartment-1 (pure white, #ffffff).
 */

const WALL_THICKNESS = 0.15
const WALL_HEIGHT = 2.7
const DOOR_WIDTH = 0.9
const DOOR_HEIGHT = 2.1

const WALL_MATERIAL = {
  preset: 'white' as const,
  properties: { color: '#ffffff', roughness: 0.85, metalness: 0, opacity: 1, transparent: false, side: 'front' as const },
}

// Same unverified-slot-key caveat as furnishing.ts / replica-apartment-1.ts:
// the paintable region name is baked into each glb and isn't discoverable
// from this codebase. A wrong key is harmless — it just won't recolor.
const LIGHT_WOOD_SLOT_OVERRIDE: Record<string, string> = { wood: 'library:wood-woodfine1' }

function facing(deg: 0 | 90 | 180 | 270): [number, number, number] {
  return [0, (deg * Math.PI) / 180, 0]
}

export async function buildAndSaveApartmentReplica2(
  sceneName = 'Reference apartment — tropical bungalow',
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

  // Perimeter, 6m x 4.5m. Bathroom is carved out of the SE corner (1.8m x
  // 1.8m); the rest is one open bedroom + kitchen room, matching the
  // reference's single-room-plus-ensuite feel.
  const south = makeWall([0, 0], [6, 0])
  const east = makeWall([6, 0], [6, 4.5])
  const north = makeWall([6, 4.5], [0, 4.5])
  const west = makeWall([0, 4.5], [0, 0])
  const bathWestWall = makeWall([4.2, 0], [4.2, 1.8]) // open room <-> bathroom
  const bathNorthWall = makeWall([4.2, 1.8], [6, 1.8]) // open room <-> bathroom

  const allWalls = [south, east, north, west, bathWestWall, bathNorthWall]
  for (const wall of allWalls) scene.createNode(wall, level.id)

  const zones: { name: string; polygon: [number, number][]; wallIds: string[]; metadata?: Record<string, unknown> }[] = [
    {
      name: 'Open bedroom + kitchen',
      polygon: [
        [0, 0],
        [4.2, 0],
        [4.2, 1.8],
        [6, 1.8],
        [6, 4.5],
        [0, 4.5],
      ],
      wallIds: [south.id, bathWestWall.id, bathNorthWall.id, east.id, north.id, west.id],
    },
    {
      name: 'Bathroom',
      polygon: [
        [4.2, 0],
        [6, 0],
        [6, 1.8],
        [4.2, 1.8],
      ],
      wallIds: [south.id, east.id, bathNorthWall.id, bathWestWall.id],
    },
    {
      name: 'Covered porch (roof not modeled)',
      polygon: [
        [0, -3],
        [6, -3],
        [6, 0],
        [0, 0],
      ],
      wallIds: [south.id],
      metadata: { note: 'Reference has a pitched roof + wood slat sun shades over this deck — not modeled by this builder (walls/zones/items only, same as replica-apartment-1.ts).' },
    },
  ]
  for (const z of zones) {
    const zone = ZoneNode.parse({ name: z.name, polygon: z.polygon, boundaryWallIds: z.wallIds, metadata: z.metadata })
    scene.createNode(zone, level.id)
  }

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
      metadata: { autoFurnished: true, replica: 'apartment-2', ...metadata },
    })
    scene.createNode(node, level.id)
  }

  // Bed against the north wall (west side of it), matching the reference's
  // bedroom-on-the-left layout.
  item(catalogItem('doubleBed'), 1.5, 3.4, 180)
  item(catalogItem('bedsideTable'), 2.61, 4.15, 180, undefined, LIGHT_WOOD_SLOT_OVERRIDE)

  // Kitchen, sharing the same north wall east of the bed — no dividing
  // wall between bedroom and kitchen, matching the reference's open plan.
  item(catalogItem('kitchen'), 4.2, 4.03, 180)
  item(catalogItem('fridge'), 5.6, 4.03, 180)

  // Ensuite bathroom (SE corner).
  item(catalogItem('toilet'), 5.6, 0.4, 180)
  item(catalogItem('bathroomSink'), 4.5, 0.9, 90)

  // Covered porch: outdoor dining set (light oak table, not the reference's
  // round one — see file header for why).
  item(catalogItem('diningTableOak'), 3, -1.5, 0)
  item(catalogItem('diningChair'), 2.3, -0.75, 180)
  item(catalogItem('diningChair'), 3.7, -0.75, 180)
  item(catalogItem('diningChair'), 2.3, -2.25, 0)
  item(catalogItem('diningChair'), 3.7, -2.25, 0)

  // Entry door: main room <-> porch.
  const entryDoor = DoorNode.parse({
    wallId: south.id,
    parentId: south.id,
    position: [2, DOOR_HEIGHT / 2, 0],
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
  })
  scene.createNode(entryDoor, south.id)

  const bathroomDoor = DoorNode.parse({
    wallId: bathWestWall.id,
    parentId: bathWestWall.id,
    position: [0.9, DOOR_HEIGHT / 2, 0], // wall runs Z:0->1.8, centered
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
  })
  scene.createNode(bathroomDoor, bathWestWall.id)

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
