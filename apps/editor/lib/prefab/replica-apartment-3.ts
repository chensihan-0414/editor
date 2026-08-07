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
 * Hand-authored layout for the "Japandi minimalist 1-bedroom" design brief
 * (full text kept verbatim below for future reference). Left-to-right zone
 * order per the brief: pet corner -> dining nook -> open kitchen/island/
 * living -> [tatami room -> bathroom (wet+dry)] / master bedroom on the
 * right. Reachable via /step1?replica=apartment-3. This REPLACES the
 * earlier, much smaller "Japanese studio" version of apartment-3 — the new
 * brief is a full redesign, not an incremental tweak.
 *
 * Design brief (verbatim, 2026-08-07):
 * "45° isometric cutaway dollhouse view, pure plain white background,
 * Japandi minimalist 1-bedroom apartment 3D architectural render, miniature
 * diorama texture; layout order from left to right: left pet area with
 * wooden pet beds and puppy ornaments, adjacent small dining nook with
 * wooden table and chairs; open central zone: full light oak kitchen
 * cabinetry with stove and sink, large wooden kitchen island with 3 black
 * bar stools, living area with two sofas, TV cabinet, coffee table and
 * light grey rug; right side includes separated wet-dry bathroom (shower,
 * vanity sink, toilet room), tatami room, master bedroom with double bed;
 * light oak flooring, off-white walls, warm neutral palette, soft diffused
 * natural daylight, gentle soft shadows, matte wood texture, subtle daily
 * decor details, accurate perspective and spatial proportion,
 * photorealistic, 8K ultra HD, clean minimalist composition"
 *
 * Not modeled — no matching catalog asset, same "flag it, don't fake it"
 * approach as apartment-1/2:
 *   - Wooden pet beds / puppy ornaments (pet corner stays empty, labeled).
 *   - Tatami mat flooring/texture (tatami room stays empty, labeled — it
 *     doubles as the walkway to the bathroom, a real layout pattern in
 *     small Japanese apartments, not just a leftover space).
 *   - Camera/render style notes (45° isometric cutaway, dollhouse/diorama
 *     look, lighting, 8K) — those are renderer/viewer settings, not
 *     something this wall/zone/item builder controls.
 *   - Floor material ("light oak flooring") — this builder has never set
 *     floor materials (no SlabNode), only walls; out of scope here too
 *     unless asked to extend it.
 *
 * Matched fairly directly: `kitchen` (full cabinetry+stove+sink),
 * `kitchenBar` (the island — see replica-apartment-1.ts's header for why
 * this id and not a plain kitchen-counter), `stool` x3 at the island
 * (catalog default is a black seat — matches "3 black bar stools", no
 * light-wood override needed here unlike apartment-1/furnishing.ts), two
 * `sofa`, `tvStand`, `coffeeTable`, `rectangularCarpet` (light grey rug),
 * `diningTableOak` + `diningChair` x4 (wooden dining set — oak variant,
 * not the walnut `diningTable`, consistent with the rest of this session's
 * "avoid the dark walnut items" pattern), `doubleBed` + `bedsideTable` x2,
 * `showerSquare`, `bathroomSink`, `toilet`.
 *
 * Walls: both interiorMaterial AND exteriorMaterial are set this time
 * (previous replica files only set interiorMaterial) — off-white per the
 * brief, per the user's request to also cover exterior walls.
 */

const WALL_THICKNESS = 0.15
const WALL_HEIGHT = 2.7
const DOOR_WIDTH = 0.9
const DOOR_HEIGHT = 2.1

// "Off-white" — warmer/greyer than the stark #ffffff used in apartment-1,
// per this brief's own wording ("off-white walls", not "pure white").
const OFF_WHITE_MATERIAL = {
  preset: 'custom' as const,
  properties: { color: '#f0ece2', roughness: 0.85, metalness: 0, opacity: 1, transparent: false, side: 'front' as const },
}

function facing(deg: 0 | 90 | 180 | 270): [number, number, number] {
  return [0, (deg * Math.PI) / 180, 0]
}

export async function buildAndSaveApartmentReplica3(
  sceneName = 'Reference apartment — Japandi 1-bedroom',
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
    WallNode.parse({
      start,
      end,
      thickness: WALL_THICKNESS,
      height: WALL_HEIGHT,
      interiorMaterial: OFF_WHITE_MATERIAL,
      exteriorMaterial: OFF_WHITE_MATERIAL,
    })

  // Perimeter, 14m x 7m. Left 9m is one open volume (pet corner, dining,
  // kitchen, island, living — no interior walls, matching the brief's
  // "open central zone" and general Japandi open-plan feel). Right 5m is
  // walled into tatami room (front-left of that section, doubling as the
  // walkway to the bathroom), bathroom (front-right, wet/dry split by a
  // short stub wall), and the master bedroom (the whole back strip).
  const south = makeWall([0, 0], [14, 0])
  const east = makeWall([14, 0], [14, 7])
  const north = makeWall([14, 7], [0, 7])
  const west = makeWall([0, 7], [0, 0])
  const rightDivider = makeWall([9, 0], [9, 7]) // open zone <-> right-side rooms
  const bedroomDivider = makeWall([9, 3.5], [14, 3.5]) // bedroom <-> tatami/bathroom row
  const bathTatamiDivider = makeWall([11.5, 0], [11.5, 3.5]) // tatami <-> bathroom
  const wetDryStub = makeWall([12.8, 0], [12.8, 2]) // short partial wall inside the bathroom — visually splits wet (shower) from dry (sink/toilet) without needing its own door; leaves z:2-3.5 open as a walkway, same as how a real wet/dry Japanese bathroom is usually just curtained/stepped, not fully partitioned

  const allWalls = [south, east, north, west, rightDivider, bedroomDivider, bathTatamiDivider, wetDryStub]
  for (const wall of allWalls) scene.createNode(wall, level.id)

  const zones: { name: string; polygon: [number, number][]; wallIds: string[]; metadata?: Record<string, unknown> }[] = [
    {
      name: 'Pet corner (no pet-bed asset yet)',
      polygon: [
        [0, 5],
        [2, 5],
        [2, 7],
        [0, 7],
      ],
      wallIds: [west.id, north.id],
      metadata: { note: 'Brief calls for wooden pet beds + puppy ornaments — no matching catalog asset, left empty on purpose.' },
    },
    {
      name: 'Dining nook',
      polygon: [
        [0, 0],
        [3.5, 0],
        [3.5, 5],
        [0, 5],
      ],
      wallIds: [south.id, west.id],
    },
    {
      name: 'Open kitchen + island + living',
      polygon: [
        [3.5, 0],
        [9, 0],
        [9, 7],
        [2, 7],
        [2, 5],
        [3.5, 5],
      ],
      wallIds: [south.id, rightDivider.id, north.id, west.id],
    },
    {
      name: 'Tatami room (mat texture not modeled — also the walkway to the bathroom)',
      polygon: [
        [9, 0],
        [11.5, 0],
        [11.5, 3.5],
        [9, 3.5],
      ],
      wallIds: [south.id, bathTatamiDivider.id, bedroomDivider.id, rightDivider.id],
    },
    {
      name: 'Bathroom (wet + dry)',
      polygon: [
        [11.5, 0],
        [14, 0],
        [14, 3.5],
        [11.5, 3.5],
      ],
      wallIds: [south.id, east.id, bedroomDivider.id, bathTatamiDivider.id, wetDryStub.id],
    },
    {
      name: 'Master bedroom',
      polygon: [
        [9, 3.5],
        [14, 3.5],
        [14, 7],
        [9, 7],
      ],
      wallIds: [bedroomDivider.id, east.id, north.id, rightDivider.id],
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

  // Dining nook.
  item(catalogItem('diningTableOak'), 1.75, 2.2, 0)
  item(catalogItem('diningChair'), 1.05, 1.5, 180)
  item(catalogItem('diningChair'), 2.45, 1.5, 180)
  item(catalogItem('diningChair'), 1.05, 2.9, 0)
  item(catalogItem('diningChair'), 2.45, 2.9, 0)

  // Kitchen, along the north wall.
  item(catalogItem('kitchen'), 4.5, 6.53, 180)
  item(catalogItem('fridge'), 8.4, 6.55, 180)

  // Kitchen island + 3 stools (brief wants black seats — catalog default,
  // no recolor needed here).
  item(catalogItem('kitchenBar'), 6.8, 4.5, 0)
  item(catalogItem('stool'), 6.2, 3.7, 0)
  item(catalogItem('stool'), 6.8, 3.7, 0)
  item(catalogItem('stool'), 7.4, 3.7, 0)

  // Living area: two sofas facing the TV, coffee table + rug between them.
  item(catalogItem('sofa'), 4.5, 2, 180)
  item(catalogItem('sofa'), 7, 2, 180)
  item(catalogItem('tvStand'), 5.75, 0.3, 0)
  item(catalogItem('coffeeTable'), 5.75, 1.2, 0)
  item(catalogItem('rectangularCarpet'), 5.75, 1.5, 0)

  // Bathroom: shower on the wet (west) side of the stub wall, sink + toilet
  // on the dry (east) side.
  item(catalogItem('showerSquare'), 12.15, 1, 0)
  item(catalogItem('bathroomSink'), 13.4, 2.8, 180)
  item(catalogItem('toilet'), 13.4, 0.6, 0)

  // Master bedroom.
  item(catalogItem('doubleBed'), 11.5, 5.9, 180)
  item(catalogItem('bedsideTable'), 10.39, 6.65, 180)
  item(catalogItem('bedsideTable'), 12.61, 6.65, 180)

  // Doors: entry (dining nook), tatami room, master bedroom, and bathroom
  // (reached via the tatami room, not directly off the open zone).
  const entryDoor = DoorNode.parse({
    wallId: south.id,
    parentId: south.id,
    position: [1.5, DOOR_HEIGHT / 2, 0],
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
  })
  scene.createNode(entryDoor, south.id)

  const tatamiDoor = DoorNode.parse({
    wallId: rightDivider.id,
    parentId: rightDivider.id,
    position: [1.75, DOOR_HEIGHT / 2, 0], // rightDivider runs Z:0->7; tatami is the 0-3.5 stretch, centered
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
  })
  scene.createNode(tatamiDoor, rightDivider.id)

  const bedroomDoor = DoorNode.parse({
    wallId: rightDivider.id,
    parentId: rightDivider.id,
    position: [5.25, DOOR_HEIGHT / 2, 0], // bedroom is the 3.5-7 stretch of the same wall, centered
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
  })
  scene.createNode(bedroomDoor, rightDivider.id)

  const bathroomDoor = DoorNode.parse({
    wallId: bathTatamiDivider.id,
    parentId: bathTatamiDivider.id,
    position: [1.75, DOOR_HEIGHT / 2, 0], // wall runs Z:0->3.5, centered
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
  })
  scene.createNode(bathroomDoor, bathTatamiDivider.id)

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
