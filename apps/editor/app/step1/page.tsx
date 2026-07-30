'use client'

import useScene from '@pascal-app/core/store'
import { WallNode, ZoneNode, SiteNode, BuildingNode, LevelNode } from '@pascal-app/core/schema'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { generateArrangement, rectangleCorners } from '@/lib/prefab/assembly'
import { MODULE_CATALOG } from '@/lib/prefab/catalog'
import { parseCustomerRequest } from '@/lib/prefab/stage1'

const WALL_THICKNESS = 0.15
const WALL_HEIGHT = 2.7

interface IncomingModuleRequest {
  market?: string
  modules: { moduleId: string; quantity: number }[]
}

async function buildAndSaveScene(
  modules: { moduleId: string; quantity: number }[],
  sceneName: string,
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

  for (const placed of arrangement.modules) {
    const spec = MODULE_CATALOG[placed.moduleId]
    const corners = rectangleCorners(placed.position, spec.size.length, spec.size.width, placed.rotation)
    const wallIds: string[] = []
    for (let i = 0; i < corners.length; i++) {
      const wall = WallNode.parse({
        start: corners[i],
        end: corners[(i + 1) % corners.length],
        thickness: WALL_THICKNESS,
        height: WALL_HEIGHT,
      })
      scene.createNode(wall, level.id)
      wallIds.push(wall.id)
    }
    const zone = ZoneNode.parse({
      name: spec.label,
      polygon: corners,
      boundaryWallIds: wallIds,
      metadata: { moduleId: placed.moduleId },
    })
    scene.createNode(zone, level.id)
  }

  const finalState = useScene.getState()
  const response = await fetch('/api/scenes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
      const result = await buildAndSaveScene(parsed.modules, sceneName)
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

function Step1Inner() {
  const searchParams = useSearchParams()
  const dataParam = searchParams.get('data')
  return dataParam ? <AutoBuildFromQuery dataParam={dataParam} /> : <ManualStep1Form />
}

export default function Step1Page() {
  return (
    <Suspense fallback={null}>
      <Step1Inner />
    </Suspense>
  )
}
