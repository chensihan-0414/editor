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
 * Hand-authored layout for apartment-3, "modern Japanese log style whole
 * house" (v2 — replaces the earlier Japandi/tatami-room version). Reachable
 * via /step1?replica=apartment-3.
 *
 * Design brief (verbatim, 2026-08-07, v2):
 * "45° isometric cutaway dollhouse view, pure plain white background,
 * modern Japanese log style whole house 3D architectural render, miniature
 * diorama texture, a large amount of light oak design is adopted in the
 * whole space, wooden floors cover the entire house with delicate and
 * natural wood grain, cabinets, door frames, furniture, bar counters and
 * tatami all adopt unified log color system; spatial layout from left to
 * right: pet leisure area on the far left, adjacent small dining area for
 * two people, open kitchen and living room in the middle, bathroom, second
 * bedroom and master bedroom on the right; off-white walls form a soft
 * contrast with log color, minimalist and restrained soft furnishings,
 * light beige sofas, white bedding and black bar stools as embellishments;
 * soft natural daylight, clear and soft shadows, matte solid wood material,
 * architectural-level realistic rendering, accurate perspective,
 * coordinated spatial proportion, clean and tidy picture, 8K ultra HD"
 *
 * What changed vs. v1 (the "Japandi 1-bedroom" version):
 *   - Whole-house wood floor: TRIED AND REVERTED. This brief explicitly
 *     calls out "wooden floors cover the entire house," so a `SlabNode`
 *     spanning the full footprint was added — but after deploying, the live
 *     scene started rendering as flat gray/textureless (walls and furniture
 *     too, not just the floor), and refreshing didn't fix it, meaning the
 *     saved scene data itself was the problem, not a transient browser
 *     issue. No SlabNode had ever been used in any hand-authored replica
 *     file before this, so it's the prime suspect (likely: the slab polygon
 *     sitting exactly on the wall footprint with zero inset produced
 *     degenerate render geometry). Reverted; floor material is out of scope
 *     again until a SlabNode can be verified working against the real
 *     renderer. If you want this retried, it needs to happen somewhere it
 *     can actually be visually checked before shipping, not guessed blind.
 *   - Dedicated tatami room removed. v1 had a stand-alone tatami room; this
 *     brief's explicit left-to-right room list no longer includes one — it
 *     only mentions "tatami" once, describing it as part of the unified
 *     log-color material palette, not as a separate zone. Replaced with a
 *     second bedroom, per the brief's explicit list.
 *   - Bathroom simplified back to one room (no wet/dry split stub wall) —
 *     this brief just says "bathroom," unlike v1's brief which explicitly
 *     asked for "separated wet-dry bathroom."
 *   - Right-side circulation redone: v1 had the bathroom only reachable by
 *     walking through the tatami room. This version gives bathroom, second
 *     bedroom, and master bedroom each their own direct door off the
 *     open living area, stacked front-to-back — cleaner circulation, no
 *     walking through one private room to reach another.
 *
 * Not modeled — no matching catalog asset, same "flag it, don't fake it"
 * approach as the other replica files:
 *   - Wooden pet beds / puppy ornaments (pet corner stays empty, labeled).
 *   - Camera/render style notes (45° isometric cutaway, dollhouse/diorama
 *     look, lighting, 8K) — renderer/viewer settings, not something this
 *     wall/zone/item builder controls.
 *   - Whole-house wood floor — see "What changed vs. v1" above; tried,
 *     broke the live scene, reverted.
 *
 * Matched fairly directly: `kitchen`, `kitchenBar` (island), `stool` x3
 * (catalog default is black — matches "black bar stools as embellishments"
 * directly, no override needed), two `sofa` (catalog default reads as a
 * light/neutral upholstery — matches "light beige sofas," no color variant
 * exists to pick a more specific beige), `tvStand`, `coffeeTable`,
 * `rectangularCarpet`, `diningTableOak` + `diningChair` x2 (2-person dining,
 * down from x4 in v1), `doubleBed` + `bedsideTable` x2 (master bedroom;
 * catalog default bedding reads as white — matches "white bedding," no
 * color variant to pick a more specific one), `singleBed` + `bedsideTable`
 * x1 (new second bedroom), `showerSquare`, `bathroomSink`, `toilet`.
 */

const WALL_THICKNESS = 0.15
const WALL_HEIGHT = 2.7
const DOOR_WIDTH = 0.9
const DOOR_HEIGHT = 2.1

// Off-white walls, per the brief's own wording ("off-white walls form a
// soft contrast with log color") — both interior and exterior set, as in
// v1, since exterior wall material was a standing ask for this project.
const OFF_WHITE_MATERIAL = {
  preset: 'custom' as const,
  properties: { color: '#f0ece2', roughness: 0.85, metalness: 0, opacity: 1, transparent: false, side: 'front' as const },
}

function facing(deg: 0 | 90 | 180 | 270): [number, number, number] {
  return [0, (deg * Math.PI) / 180, 0]
}

export async function buildAndSaveApartmentReplica3(
  sceneName = 'Reference apartment — modern Japanese log style',
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

  // Perimeter, 14m x 7m. Left 9m (x:0-9) is one open volume — pet corner,
  // 2-person dining, open kitchen + living — matching the brief's "from
  // left to right ... open kitchen and living room in the middle" wording
  // (no interior walls carving up that flow). Right 5m (x:9-14) is walled
  // into three rooms stacked front-to-back, each with its own door
  // straight off the open area: bathroom, second bedroom, master bedroom.
  const south = makeWall([0, 0], [14, 0])
  const east = makeWall([14, 0], [14, 7])
  const north = makeWall([14, 7], [0, 7])
  const west = makeWall([0, 7], [0, 0])
  const rightDivider = makeWall([9, 0], [9, 7]) // open zone <-> the 3 right-side rooms
  const bathBedroomDivider = makeWall([9, 2.2], [14, 2.2]) // bathroom <-> second bedroom
  const bedroomDivider = makeWall([9, 4.6], [14, 4.6]) // second bedroom <-> master bedroom

  const allWalls = [south, east, north, west, rightDivider, bathBedroomDivider, bedroomDivider]
  for (const wall of allWalls) scene.createNode(wall, level.id)

  // NOTE: a whole-house wood-floor SlabNode was added here for the "wooden
  // floors cover the entire house" ask, then reverted — the live app
  // started showing this scene as flat gray/textureless (walls AND
  // furniture, not just the floor) and refreshing didn't fix it, which
  // points to the slab geometry (its polygon sits exactly on the wall
  // footprint with zero inset) breaking something at render time badly
  // enough to poison the whole scene's material state. No SlabNode has
  // ever been used successfully in any of these hand-authored replica
  // files before — this was the first attempt, and it's untested against
  // the real renderer. Reverted until it can be verified working; floor
  // material stays out of scope for now, same as apartment-1.

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
      name: 'Dining area (2-person)',
      polygon: [
        [0, 0],
        [3.5, 0],
        [3.5, 5],
        [0, 5],
      ],
      wallIds: [south.id, west.id],
    },
    {
      name: 'Open kitchen + living room',
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
      name: 'Bathroom',
      polygon: [
        [9, 0],
        [14, 0],
        [14, 2.2],
        [9, 2.2],
      ],
      wallIds: [south.id, east.id, bathBedroomDivider.id, rightDivider.id],
    },
    {
      name: 'Second bedroom',
      polygon: [
        [9, 2.2],
        [14, 2.2],
        [14, 4.6],
        [9, 4.6],
      ],
      wallIds: [bathBedroomDivider.id, east.id, bedroomDivider.id, rightDivider.id],
    },
    {
      name: 'Master bedroom',
      polygon: [
        [9, 4.6],
        [14, 4.6],
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

  // Dining area — 2-person, one table + 2 chairs on opposite sides.
  item(catalogItem('diningTableOak'), 1.75, 2.2, 0)
  item(catalogItem('diningChair'), 1.0, 2.2, 90)
  item(catalogItem('diningChair'), 2.5, 2.2, 270)

  // Kitchen, along the north wall.
  item(catalogItem('kitchen'), 4.5, 6.53, 180)
  item(catalogItem('fridge'), 8.4, 6.55, 180)

  // Kitchen island + 3 black bar stools.
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

  // Bathroom.
  item(catalogItem('showerSquare'), 9.9, 0.5, 90)
  item(catalogItem('bathroomSink'), 13.4, 0.5, 0)
  item(catalogItem('toilet'), 13.4, 1.8, 0)

  // Second bedroom — single bed + one bedside table.
  item(catalogItem('singleBed'), 11.5, 3.9, 0)
  item(catalogItem('bedsideTable'), 9.6, 3.9, 0)

  // Master bedroom — double bed + two bedside tables.
  item(catalogItem('doubleBed'), 11.5, 5.9, 180)
  item(catalogItem('bedsideTable'), 10.39, 6.65, 180)
  item(catalogItem('bedsideTable'), 12.61, 6.65, 180)

  // Doors: entry off the south wall into the dining area, plus one direct
  // door per right-side room off the rightDivider wall — no walking
  // through one private room to reach another.
  const entryDoor = DoorNode.parse({
    wallId: south.id,
    parentId: south.id,
    position: [1.5, DOOR_HEIGHT / 2, 0],
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
  })
  scene.createNode(entryDoor, south.id)

  const bathroomDoor = DoorNode.parse({
    wallId: rightDivider.id,
    parentId: rightDivider.id,
    position: [1.1, DOOR_HEIGHT / 2, 0], // bathroom strip is z:0-2.2, centered
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
  })
  scene.createNode(bathroomDoor, rightDivider.id)

  const secondBedroomDoor = DoorNode.parse({
    wallId: rightDivider.id,
    parentId: rightDivider.id,
    position: [3.4, DOOR_HEIGHT / 2, 0], // second bedroom strip is z:2.2-4.6, centered
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
  })
  scene.createNode(secondBedroomDoor, rightDivider.id)

  const masterBedroomDoor = DoorNode.parse({
    wallId: rightDivider.id,
    parentId: rightDivider.id,
    position: [5.8, DOOR_HEIGHT / 2, 0], // master bedroom strip is z:4.6-7, centered
    width: DOOR_WIDTH,
    height: DOOR_HEIGHT,
  })
  scene.createNode(masterBedroomDoor, rightDivider.id)

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
