'use client'

import useScene from '@pascal-app/core/store'
import { WallNode, ZoneNode, SiteNode, BuildingNode, LevelNode, ItemNode, DoorNode } from '@pascal-app/core/schema'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { generateArrangement, rectangleCorners } from '@/lib/prefab/assembly'
import { MODULE_CATALOG } from '@/lib/prefab/catalog'
import { clipEdgeToSolidSegments, computeModuleRects, computeOpenBoundaries, type WallSegment } from '@/lib/prefab/connect'
import { furnishRoomPlacements, type RoomType } from '@/lib/prefab/furnishing'
import { buildAndSaveApartmentReplica1 } from '@/lib/prefab/replica-apartment-1'
import { buildAndSaveApartmentReplica2 } from '@/lib/prefab/replica-apartment-2'
import { parseCustomerRequest } from '@/lib/prefab/stage1'

// Fixed, hand-authored layouts that bypass the generic module packer
// entirely — reachable via /step1?replica=<id>. Add new entries here as
// more reference layouts get built (see lib/prefab/replica-apartment-1.ts).
const REPLICA_BUILDERS: Record<string, (name?: string) => ReturnType<typeof buildAndSaveApartmentReplica1>> = {
  'apartment-1': buildAndSaveApartmentReplica1,
  'apartment-2': buildAndSaveApartmentReplica2,
}

const WALL_THICKNESS = 0.15
const WALL_HEIGHT = 2.7

// One style preset, applied to every generated wall for now. Switched from
// a warm off-white (#f5f1ea) to pure white per reference-image feedback:
// "色彩严格控制：纯白墙面 + 浅原木主色" — the target look is stark white
// walls against light oak furniture/flooring, not a warm plaster tone.
// Keep this in sync with WALL_MATERIAL in lib/prefab/replica-apartment-1.ts.
const MODERN_MINIMALIST_WALL_MATERIAL = {
  preset: 'white' as const,
  properties: { color: '#ffffff', roughness: 0.85, metalness: 0, opacity: 1, transparent: false, side: 'front' as const },
}

// Which of our module catalog IDs get auto-furnished, and with which of
// Pascal's built-in room types. Modules not listed here (porch, utility)
// are left as bare structure — there's no matching furniture set for them.
const MODULE_ROOM_TYPE: Record<string, RoomType> = {
  'bedroom-std': 'bedroom',
  'bedroom-master': 'bedroom',
  'bathroom-std': 'bathroom',
  'kitchen-open': 'kitchen',
  'living-room': 'living',
  'hallway-connector': 'hallway',
  'storage-loft': 'storage',
}

interface IncomingModuleRequest {
  market?: string
  modules: { moduleId: string; quantity: number }[]
  furnish?: boolean
}

async function buildAndSaveScene(
  modules: { moduleId: string; quantity: number }[],
  sceneName: string,
  furnish = true,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const arrangement = generateArrangement(modules)
  if (!arrangement.valid) {
    return { ok: false, error: `Stage 2 rejected this configuration:\n${arrangement.warnings.join('\n')}` }
  }

  const scene = useScene.getState()
  scene.clearScene()

  const site = SiteNode.parse({ name: sceneName })
  scene.createNode(site)
  const building = BuildingNode.parse({ name: 'Main house' })
  scene.createNode(building, site.id)
  const level = LevelNode.parse({ name: 'Ground floor', level: 0 })
  scene.createNode(level, building.id)

  // Shared boundaries between touching modules become open doorways instead
  // of two overlapping walls (see lib/prefab/connect.ts for why the old
  // per-module 4-wall loop produced disconnected, double-walled rooms).
  const rects = computeModuleRects(arrangement.modules)
  const openings = computeOpenBoundaries(rects)

  const makeWall = (start: [number, number], end: [number, number]) =>
    WallNode.parse({
      start,
      end,
      thickness: WALL_THICKNESS,
      height: WALL_HEIGHT,
      interiorMaterial: MODERN_MINIMALIST_WALL_MATERIAL,
    })

  interface DoorCandidate {
    wallId: string
    start: [number, number]
    end: [number, number]
    isLiving: boolean
    length: number
  }
  const doorCandidates: DoorCandidate[] = []
  const allSegments: { wallId: string; start: [number, number]; end: [number, number]; length: number }[] = []

  for (const placed of arrangement.modules) {
    const spec = MODULE_CATALOG[placed.moduleId]
    const rect = rects.find((r) => r.instanceId === placed.instanceId)
    if (!rect) continue
    const corners = rectangleCorners(placed.position, spec.size.length, spec.size.width, placed.rotation)
    const wallIds: string[] = []
    const isLiving = MODULE_ROOM_TYPE[placed.moduleId] === 'living'

    const addSegment = (
      segments: WallSegment[],
      toPoints: (seg: WallSegment) => [[number, number], [number, number]],
      isSouth: boolean,
    ) => {
      for (const seg of segments) {
        const [start, end] = toPoints(seg)
        const wall = makeWall(start, end)
        scene.createNode(wall, level.id)
        wallIds.push(wall.id)
        const length = Math.hypot(end[0] - start[0], end[1] - start[1])
        allSegments.push({ wallId: wall.id, start, end, length })
        if (isSouth) doorCandidates.push({ wallId: wall.id, start, end, isLiving, length })
      }
    }

    // South (min Z, X increasing) — the side furnishRoomPlacements treats as each room's entry.
    addSegment(
      clipEdgeToSolidSegments('z', rect.minZ, rect.minX, rect.maxX, openings),
      (seg) => [
        [seg.from, rect.minZ],
        [seg.to, rect.minZ],
      ],
      true,
    )
    // East (max X, Z increasing)
    addSegment(
      clipEdgeToSolidSegments('x', rect.maxX, rect.minZ, rect.maxZ, openings),
      (seg) => [
        [rect.maxX, seg.from],
        [rect.maxX, seg.to],
      ],
      false,
    )
    // North (max Z, X decreasing — preserves original wall winding)
    addSegment(
      clipEdgeToSolidSegments('z', rect.maxZ, rect.minX, rect.maxX, openings),
      (seg) => [
        [seg.to, rect.maxZ],
        [seg.from, rect.maxZ],
      ],
      false,
    )
    // West (min X, Z decreasing — preserves original wall winding)
    addSegment(
      clipEdgeToSolidSegments('x', rect.minX, rect.minZ, rect.maxZ, openings),
      (seg) => [
        [rect.minX, seg.to],
        [rect.minX, seg.from],
      ],
      false,
    )

    const zone = ZoneNode.parse({
      name: spec.label,
      polygon: corners,
      boundaryWallIds: wallIds,
      metadata: { moduleId: placed.moduleId },
    })
    scene.createNode(zone, level.id)

    const roomType = MODULE_ROOM_TYPE[placed.moduleId]
    if (roomType && furnish) {
      const furniture = furnishRoomPlacements(roomType, corners)
      for (const piece of furniture) {
        const item = ItemNode.parse({
          name: piece.name,
          position: piece.position,
          rotation: piece.rotation,
          asset: piece.asset,
          slots: piece.slots,
          metadata: { moduleId: placed.moduleId, autoFurnished: true },
        })
        scene.createNode(item, level.id)
      }
    }
  }

  // Exactly one exterior entry door: prefer the living room's south wall
  // (matches furnishRoomPlacements' entry-side convention), else the
  // longest available south-facing wall, else any wall long enough to fit one.
  const DOOR_WIDTH = 0.9
  const DOOR_HEIGHT = 2.1
  const doorPool = doorCandidates.length > 0 ? doorCandidates : allSegments.map((s) => ({ ...s, isLiving: false }))
  const doorWall = doorPool
    .filter((c) => c.length >= DOOR_WIDTH + 0.3)
    .sort((a, b) => (b.isLiving ? 1 : 0) - (a.isLiving ? 1 : 0) || b.length - a.length)[0]
  if (doorWall) {
    const localX = Math.min(Math.max(doorWall.length / 2, DOOR_WIDTH / 2), doorWall.length - DOOR_WIDTH / 2)
    const door = DoorNode.parse({
      wallId: doorWall.wallId,
      parentId: doorWall.wallId,
      position: [localX, DOOR_HEIGHT / 2, 0],
      width: DOOR_WIDTH,
      height: DOOR_HEIGHT,
      doorCategory: 'interior',
    })
    scene.createNode(door, doorWall.wallId)
  }

  const finalState = useScene.getState()
  const sceneApiToken = process.env.NEXT_PUBLIC_PASCAL_SCENE_API_TOKEN
  const tokenDiagnostic = sceneApiToken
    ? `token present, length ${sceneApiToken.length}`
    : 'token MISSING from this build'
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
    return {
      ok: false,
      error: `Failed to save scene: ${response.status} ${await response.text()} [diagnostic: ${tokenDiagnostic}]`,
    }
  }

  const meta = await response.json()
  return { ok: true, id: meta.id }
}

function AutoBuildFromQuery({ dataParam }: { dataParam: string }) {
  const router = useRouter()
  const [status, setStatus] = useState('Reading your request...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      let parsed: IncomingModuleRequest
      try {
        parsed = JSON.parse(decodeURIComponent(dataParam))
      } catch {
        setError('Could not read the incoming request data.')
        return
      }
      if (!Array.isArray(parsed.modules)) {
        setError('Incoming data is missing a "modules" list.')
        return
      }

      setStatus('Building your house...')
      const sceneName = parsed.market ? `Customer request — ${parsed.market}` : 'Customer request'
      const result = await buildAndSaveScene(parsed.modules, sceneName, parsed.furnish ?? true)
      if (cancelled) return

      if (!result.ok) {
        setError(result.error)
        return
      }
      setStatus('Done — opening your house...')
      router.push(`/scene/${result.id}?autoScreenshot=1`)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [dataParam, router])

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-medium text-lg">{status}</p>
      {error && <pre className="whitespace-pre-wrap text-left text-red-600 text-sm">{error}</pre>}
    </div>
  )
}

function ManualStep1Form() {
  const router = useRouter()
  const [apiKey, setApiKey] = useState('')
  const [customerRequest, setCustomerRequest] = useState('')
  const [status, setStatus] = useState<{ text: string; kind: 'idle' | 'error' | 'warn' | 'ok' }>({
    text: '',
    kind: 'idle',
  })
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    if (!apiKey.trim()) {
      setStatus({ text: 'Please enter your Anthropic API key.', kind: 'error' })
      return
    }
    if (!customerRequest.trim()) {
      setStatus({ text: 'Please enter the customer request.', kind: 'error' })
      return
    }

    setBusy(true)
    setStatus({ text: 'Stage 1: asking Claude to parse the request...', kind: 'idle' })

    try {
      const stage1 = await parseCustomerRequest(customerRequest, apiKey)
      const unmappedNote = stage1.unmapped.length ? ` (unmapped: ${stage1.unmapped.join(', ')})` : ''
      setStatus({ text: `Stage 1 done: ${stage1.modules.length} module types found.${unmappedNote}`, kind: 'idle' })

      const result = await buildAndSaveScene(stage1.modules, customerRequest.slice(0, 100))
      if (!result.ok) {
        setStatus({ text: result.error, kind: 'warn' })
        setBusy(false)
        return
      }
      setStatus({ text: 'Done — opening the scene...', kind: 'ok' })
      router.push(`/scene/${result.id}?autoScreenshot=1`)
    } catch (err) {
      setStatus({ text: `Error: ${err instanceof Error ? err.message : String(err)}`, kind: 'error' })
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-6">
      <div>
        <h1 className="font-semibold text-xl">Step 1 — customer request</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          No structured request came in from a link, so describe it in your own words instead.
          Your API key stays in this browser tab.
        </p>
      </div>

      <label className="text-sm">
        Anthropic API key
        <input
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          type="password"
          value={apiKey}
        />
      </label>

      <label className="text-sm">
        Customer request
        <textarea
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          onChange={(e) => setCustomerRequest(e.target.value)}
          placeholder="2 bedrooms, 1 bathroom, a covered porch"
          rows={4}
          value={customerRequest}
        />
      </label>

      <button
        className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm disabled:opacity-50"
        disabled={busy}
        onClick={handleSubmit}
        type="button"
      >
        {busy ? 'Working...' : 'Generate house'}
      </button>

      {status.text && (
        <pre
          className={`whitespace-pre-wrap text-xs ${
            status.kind === 'error' ? 'text-red-600' : status.kind === 'warn' ? 'text-amber-600' : status.kind === 'ok' ? 'text-green-700' : 'text-muted-foreground'
          }`}
        >
          {status.text}
        </pre>
      )}
    </div>
  )
}

function AutoBuildReplica({ replicaId }: { replicaId: string }) {
  const router = useRouter()
  const [status, setStatus] = useState('Building your house...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      const build = REPLICA_BUILDERS[replicaId]
      if (!build) {
        setError(`Unknown replica id "${replicaId}". Available: ${Object.keys(REPLICA_BUILDERS).join(', ')}`)
        return
      }
      const result = await build()
      if (cancelled) return
      if (!result.ok) {
        setError(result.error)
        return
      }
      setStatus('Done — opening your house...')
      router.push(`/scene/${result.id}?autoScreenshot=1`)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [replicaId, router])

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-medium text-lg">{status}</p>
      {error && <pre className="whitespace-pre-wrap text-left text-red-600 text-sm">{error}</pre>}
    </div>
  )
}

function Step1Inner() {
  const searchParams = useSearchParams()
  const replicaParam = searchParams.get('replica')
  const dataParam = searchParams.get('data')
  if (replicaParam) return <AutoBuildReplica replicaId={replicaParam} />
  return dataParam ? <AutoBuildFromQuery dataParam={dataParam} /> : <ManualStep1Form />
}

export default function Step1Page() {
  return (
    <Suspense fallback={null}>
      <Step1Inner />
    </Suspense>
  )
}
