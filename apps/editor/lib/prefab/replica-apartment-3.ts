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
 * Hand-authored layout approximating the "Japanese style" reference render
 * (recommended-for-market card #3): a single open studio — entry, a small
 * kitchen peninsula with two stools, and a bedroom area separated only by
 * a shoji sliding screen (no real wall) — plus a small ensuite bathroom.
 * Tatami flooring, warm light wood, paper lantern lighting. Same
 * fixed-floor-plan approach as replica-apartment-1.ts / -2.ts, reachable
 * via /step1?replica=apartment-3.
 *
 * Not modeled (same caveat as apartment-1/-2 — this builder only creates
 * vertical walls + items, no roof, no decorative surfaces):
 *   - The shoji sliding screen between the studio and the bedroom. There's
 *     no matching catalog asset (nearest is a solid interior wall, which
 *     would block the open sightline the reference has) and no door node
 *     type for a non-wall divider, so the "Bedroom" zone below is placed
 *     as open floor area with no wall or door on that edge at all —
 *     visually the closest approximation without misrepresenting a solid
 *     wall that isn't in the reference.
 *   - The entry rock garden (gravel + stones) and tatami mat texture —
 *     no matching catalog items.
 *   - Wall-hung textile art, paper lantern floor lamp specifically (using
 *     the catalog's generic `floor-lamp` instead — see substitutions
 *     below).
 *
 * Asset substitutions against the full catalog (`./item-catalog`):
 *   - The two stools at the kitchen peninsula (image) map directly to
 *     `stool` — same item already used in apartment-1's kitchen island,
 *     no dining table needed here (unlike apartment-2, which has a
 *     separate outdoor dining set).
 *   - Kitchen -> the compound `kitchen` item, same reasoning as
 *     apartment-2 (built-in cooktop, one continuous counter run).
 *   - Paper lantern bedside light -> `floorLamp` (catalog id
 *     `floor-lamp`) as the closest available lighting fixture.
 *
 * Walls: pure white (#ffffff), same as apartment-1 — the reference's
 * walls read as warm white/cream, not green like apartment-2's.
 */

const WALL_THICKNESS = 0.15
const WALL_HEIGHT = 2.7
const DOOR_WIDTH = 0.9
const DOOR_HEIGHT = 2.1

const WALL_MATERIAL = {
  preset: 'white' as const,
  properties: { color: '#ffffff', roughness: 0.85, metalness: 0, opacity: 1, transparent: false, side: 'front' as const },
}

// Same unverified-slot-key caveat as the other replica/furnishing files:
// the paintable region name is baked into each glb and isn't discoverable
// from this codebase. A wrong key is harmless — it just won't recolor.
const LIGHT_WOOD_SLOT_OVERRIDE: Record<string, string> = { wood: 'library:wood-woodfine1' }

function facing(deg: 0 | 90 | 180 | 270): [number, number, number] {
  return [0, (deg * Math.PI) / 180, 0]
}

export async function buildAndSaveApartmentReplica3(
  sceneName = 'Reference apartment — Japanese studio',
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

  // Perimeter, 6m x 4.5m. Bathroom is a real walled-off room in the NE
  // corner (1.8m x 1.8m); everything else is open floor, including the
  // bedroom area (no wall — see file header on the shoji screen).
  const south = makeWall([0, 0], [6, 0])
  const east = makeWall([6, 0], [6, 4.5])
  const north = makeWall([6, 4.5], [0, 4.5])
  const west = makeWall([0, 4.5], [0, 0])
  const bathWestWall = makeWall([4.2, 2.7], [4.2, 4.5]) // studio <-> bathroom
  const bathSouthWall = makeWall([4.2, 2.7], [6, 2.7]) // bedroom <-> bathroom

  const allWalls = [south, east, north, west, bathWestWall, bathSouthWall]
  for (const wall of allWalls) scene.createNode(wall, level.id)

  const zones: { name: string; polygon: [number, number][]; wallIds: string[]; metadata?: Record<string, unknown> }[] = [
    {
      name: 'Open studio (entry + kitchen)',
      polygon: [
        [0, 0],
        [3.6, 0],
        [3.6, 2.7],
        [4.2, 2.7],
        [4.2, 4.5],
        [0, 4.5],
      ],
      wallIds: [south.id, bathWestWall.id, north.id, west.id],
    },
    {
      name: 'Bedroom (shoji screen not modeled — open to studio, no wall)',
      polygon: [
        [3.6, 0],
        [6, 0],
        [6, 2.7],
        [3.6, 2.7],
      ],
      wallIds: [south.id, east.id, bathSouthWall.id],
    },
    {
      name: 'Bathroom',
      polygon: [
        [4.2, 2.7],
        [6, 2.7],
        [6, 4.5],
        [4.2, 4.5],
      ],
      wallIds: [bathSouthWall.id, east.id, north.id, bathWestWall.id],
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
      metadata: { autoFurnished: true, replica: 'apartment-3', ...metadata },
    })
    scene.createNode(node, level.id)
  }

  // Bedroom: bed against the south wall, headboard at the wall, opening
  // toward the studio (no wall on that side).
  item(catalogItem('doubleBed'), 4.8, 1.1, 0)
  item(catalogItem('bedsideTable'), 5.65, 0.35, 0, undefined, LIGHT_WOOD_SLOT_OVERRIDE)
  item(catalogItem('floorLamp'), 4.1, 1.1, 0)

  // Entry storage.
  item(catalogItem('closet'), 0.5, 1, 90)

  // Kitchen peninsula along the north wall, with two stools on the south
  // (room-facing) side instead of a separate dining table — matches the
  // reference's two-seat counter, not a freestanding table.
  item(catalogItem('kitchen'), 1.9, 4.03, 180)
  item(catalogItem('stool'), 1.4, 3.5, 0)
  item(catalogItem('stool'), 2.4, 3.5, 0)

  // Ensuite bathroom.
  item(catalogItem('toilet'), 5.6, 3.1, 270)
  item(catalogItem('bathroomSink'), 4.5, 3.8, 90)

  // Entry door.
  const entryDoor = DoorNode.parse({
    wallId: south.id,
    parentId: south.id,
    position: [1, DOOR_HEIGHT / 2, 0],
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
  })
  scene.createNode(entryDoor, south.id)

  const bathroomDoor = DoorNode.parse({
    wallId: bathWestWall.id,
    parentId: bathWestWall.id,
    position: [0.9, DOOR_HEIGHT / 2, 0], // wall runs Z:2.7->4.5, centered
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
