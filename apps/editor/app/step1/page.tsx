'use client'

import useScene from '@pascal-app/core/store'
import { WallNode, ZoneNode, SiteNode, BuildingNode, LevelNode } from '@pascal-app/core/schema'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { generateArrangement } from '@/lib/prefab/assembly'
import { rectangleCorners } from '@/lib/prefab/assembly'
import { MODULE_CATALOG } from '@/lib/prefab/catalog'
import { parseCustomerRequest } from '@/lib/prefab/stage1'

const WALL_THICKNESS = 0.15
const WALL_HEIGHT = 2.7

export default function Step1Page() {
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

      const arrangement = generateArrangement(stage1.modules)
      if (!arrangement.valid) {
        setStatus({ text: `Stage 2 rejected this configuration:\n${arrangement.warnings.join('\n')}`, kind: 'warn' })
        setBusy(false)
        return
      }

      setStatus({ text: 'Stage 2 done. Building the scene graph...', kind: 'idle' })

      // Reset any local editor state before building a fresh scene, so we
      // don't accidentally merge with whatever was in this browser's
      // IndexedDB-persisted store from a previous session.
      const scene = useScene.getState()
      scene.clearScene()

      const site = SiteNode.parse({ name: `Customer request — ${new Date().toLocaleDateString()}` })
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
      setStatus({ text: 'Saving scene...', kind: 'idle' })

      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customerRequest.slice(0, 100),
          graph: { nodes: finalState.nodes, rootNodeIds: finalState.rootNodeIds },
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`Failed to save scene: ${response.status} ${body}`)
      }

      const meta = await response.json()
      setStatus({ text: 'Done — opening the scene...', kind: 'ok' })
      router.push(`/scene/${meta.id}?autoScreenshot=1`)
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
          Your API key stays in this browser tab and is sent directly to Anthropic — it never
          touches our servers except when we save the finished scene graph.
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
