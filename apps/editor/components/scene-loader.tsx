'use client'

// Node registry bootstrap is loaded once at the root via
// `<ClientBootstrap>` in `app/layout.tsx` — no per-page side-effect
// import here.
import {
  applySceneGraphToEditor,
  Editor,
  ItemsPanel,
  type SceneGraph,
  type SidebarTab,
} from '@pascal-app/editor'
import { emitter } from '@pascal-app/core'
import { Hammer, Layers, Package } from 'lucide-react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AutoScreenshot } from './auto-screenshot'
import { BuildTab } from './build-tab'
import { CommunityViewerToolbarLeft, CommunityViewerToolbarRight } from './viewer-toolbar'

// Mirrors the open-source editor's item panel (see app/page.tsx): no
// uploaded items in this deployment, so hide the Library/Community/Mine
// source chips and tag filters.
function SceneItemsPanel() {
  return <ItemsPanel showSourceFilter={false} showTagFilters={false} />
}

export interface SceneMeta {
  id: string
  name: string
  projectId: string | null
  thumbnailUrl: string | null
  version: number
  createdAt: string
  updatedAt: string
  ownerId: string | null
  sizeBytes: number
  nodeCount: number
}

const SIDEBAR_TABS: (SidebarTab & { component: React.ComponentType })[] = [
  {
    id: 'site',
    label: 'Scene',
    component: () => null, // Built-in SitePanel handles this
    mobileDefaultSnap: 0.5,
    mobileIcon: <Layers className="h-5 w-5" />,
    icon: (
      <Image
        alt=""
        className="h-8 w-8 object-contain"
        height={32}
        src="/icons/scene.webp"
        width={32}
      />
    ),
  },
  {
    id: 'build',
    label: 'Build',
    component: BuildTab,
    mobileDefaultSnap: 0.5,
    mobileIcon: <Hammer className="h-5 w-5" />,
    icon: (
      <Image
        alt=""
        className="h-8 w-8 object-contain"
        height={32}
        src="/icons/build.webp"
        width={32}
      />
    ),
  },
  {
    id: 'items',
    label: 'Items',
    component: SceneItemsPanel,
    mobileDefaultSnap: 0.5,
    mobileIcon: <Package className="h-5 w-5" />,
    icon: (
      <Image
        alt=""
        className="h-8 w-8 object-contain"
        height={32}
        src="/icons/couch.webp"
        width={32}
      />
    ),
  },
]

interface SceneLoaderProps {
  initialScene: SceneGraph
  meta: SceneMeta
}

type SceneGraphWithCollections = SceneGraph & {
  collections?: Record<string, unknown>
}

interface LiveSceneEvent {
  eventId: number
  sceneId: string
  version: number
  kind: string
  createdAt: string
  graph: SceneGraphWithCollections
}

function sceneGraphSignature(graph: SceneGraphWithCollections): string {
  return JSON.stringify({
    nodes: graph.nodes,
    rootNodeIds: graph.rootNodeIds,
    collections: graph.collections,
    installedPlugins: graph.installedPlugins,
  })
}

export function SceneLoader({ initialScene, meta }: SceneLoaderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAutoScreenshotRequest = searchParams.get('autoScreenshot') === '1'
  const [autoShotUrl, setAutoShotUrl] = useState<string | null>(null)
  const versionRef = useRef(meta.version)
  const lastRemoteGraphJsonRef = useRef<string | null>(null)
  const suppressRemoteSaveUntilRef = useRef(0)
  const [conflict, setConflict] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Set right before we ask the thumbnail pipeline for a frame on behalf of the
  // "Save image" button, so handleThumb downloads that frame instead of running
  // the autosave/thumbnail-upload path.
  const saveDownloadRef = useRef(false)
  const [factoryNote, setFactoryNote] = useState(false)

  const handleLoad = useCallback(async () => initialScene, [initialScene])

  const handleSave = useCallback(
    async (graph: SceneGraph, options?: { keepalive?: boolean }) => {
      const graphJson = sceneGraphSignature(graph)
      const isRecentRemoteApply = Date.now() < suppressRemoteSaveUntilRef.current
      if (lastRemoteGraphJsonRef.current === graphJson) {
        lastRemoteGraphJsonRef.current = null
        suppressRemoteSaveUntilRef.current = 0
        return
      }
      if (isRecentRemoteApply) return

      try {
        const sceneApiToken = process.env.NEXT_PUBLIC_PASCAL_SCENE_API_TOKEN
        const response = await fetch(`/api/scenes/${meta.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'If-Match': String(versionRef.current),
            ...(sceneApiToken ? { 'x-pascal-scene-token': sceneApiToken } : {}),
          },
          body: JSON.stringify({ name: meta.name, graph }),
          // `keepalive` lets the request outlive a page unload (the autosave
          // flush on refresh/close). Browsers cap keepalive bodies at 64KB, so
          // only the unload flush opts in — normal debounced saves omit it and
          // can carry arbitrarily large scenes.
          keepalive: options?.keepalive,
        })

        if (response.status === 409) {
          setConflict(true)
          return
        }

        if (!response.ok) {
          setSaveError(`Save failed (${response.status})`)
          return
        }

        const next = (await response.json()) as SceneMeta
        versionRef.current = next.version
        setSaveError(null)
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Save failed')
      }
    },
    [meta.id, meta.name],
  )

  useEffect(() => {
    const source = new EventSource(`/api/scenes/${meta.id}/events`)

    source.addEventListener('scene', (event) => {
      let payload: LiveSceneEvent
      try {
        payload = JSON.parse((event as MessageEvent<string>).data) as LiveSceneEvent
      } catch {
        return
      }
      if (payload.sceneId !== meta.id) return
      if (payload.version <= versionRef.current) return

      versionRef.current = payload.version
      lastRemoteGraphJsonRef.current = sceneGraphSignature(payload.graph)
      suppressRemoteSaveUntilRef.current = Date.now() + 2500
      applySceneGraphToEditor(payload.graph)
      setConflict(false)
      setSaveError(null)
    })

    source.addEventListener('error', () => {
      if (source.readyState === EventSource.CLOSED) {
        setSaveError('Live scene connection closed')
      }
    })

    return () => source.close()
  }, [meta.id])

  // Step 3: trigger Pascal's own thumbnail/snapshot pipeline (the same one
  // used for project thumbnails) instead of reading the visible <canvas>
  // directly — WebGPU canvases here don't reliably keep a readable buffer
  // for external code, which is what made the old canvas.toDataURL()
  // approach capture blank frames regardless of how long it waited.
  useEffect(() => {
    if (!isAutoScreenshotRequest) return
    const timer = setTimeout(() => {
      emitter.emit('camera-controls:generate-thumbnail', { captureMode: 'viewport' })
    }, 2500)
    return () => clearTimeout(timer)
  }, [isAutoScreenshotRequest])

  const handleSaveDesign = useCallback(() => {
    saveDownloadRef.current = true
    emitter.emit('camera-controls:generate-thumbnail', { captureMode: 'viewport' })
  }, [])

  const handleThumb = useCallback(
    async (blob: Blob) => {
      if (saveDownloadRef.current) {
        saveDownloadRef.current = false
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${meta.name.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'design'}.png`
        document.body.appendChild(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
        return
      }
      if (isAutoScreenshotRequest) {
        setAutoShotUrl(URL.createObjectURL(blob))
        router.replace(window.location.pathname)
        return
      }
      // TODO(phase7): upload thumbnail via POST /api/scenes/[id]/thumbnail.
      // Stub endpoint is not yet implemented in v0.1 — skip upload for now.
      await fetch(`/api/scenes/${meta.id}/thumbnail`, {
        method: 'POST',
        // Intentionally no body — endpoint is a stub.
      }).catch(() => {
        // Swallow errors silently; thumbnail upload is best-effort.
      })
    },
    [meta.id, meta.name, isAutoScreenshotRequest, router],
  )

  return (
    <div className="relative h-screen w-screen">
      {/* Step 3: shows the captured PNG when arriving from Step 1 with
          ?autoScreenshot=1 — capture itself is triggered by the effect
          above and received via handleThumb; this just displays it. */}
      <AutoScreenshot imageUrl={autoShotUrl} onClose={() => setAutoShotUrl(null)} />
      {conflict && (
        <div className="pointer-events-auto absolute top-4 left-1/2 z-50 w-full max-w-md -translate-x-1/2 rounded-lg border border-border bg-background p-4 shadow-xl">
          <h2 className="font-semibold text-sm">Another session saved first — refresh?</h2>
          <p className="mt-1 text-muted-foreground text-xs">
            Your changes haven&apos;t been saved. Reload to pick up the latest version.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              className="rounded-md border border-border bg-accent px-3 py-1.5 font-medium text-xs hover:bg-accent/80"
              onClick={() => router.refresh()}
              type="button"
            >
              Reload
            </button>
            <button
              className="rounded-md border border-border bg-background px-3 py-1.5 font-medium text-xs hover:bg-accent/40"
              onClick={() => setConflict(false)}
              type="button"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {saveError && !conflict && (
        <div className="pointer-events-auto absolute top-4 left-1/2 z-50 w-full max-w-md -translate-x-1/2 rounded-lg border border-destructive/50 bg-background p-3 shadow-xl">
          <p className="font-medium text-destructive text-xs">{saveError}</p>
        </div>
      )}
      <div className="pointer-events-none absolute top-4 right-4 z-40 flex items-center gap-2">
        {factoryNote && (
          <span className="pointer-events-auto rounded-md border border-border bg-background/90 px-3 py-1.5 font-medium text-muted-foreground text-xs shadow-sm backdrop-blur">
            Factory hand-off coming soon
          </span>
        )}
        <button
          className="pointer-events-auto rounded-md border border-border bg-background/90 px-3 py-1.5 font-medium text-xs shadow-sm backdrop-blur hover:bg-accent/40"
          onClick={() => {
            setFactoryNote(true)
            setTimeout(() => setFactoryNote(false), 3000)
          }}
          type="button"
        >
          Contact factory
        </button>
        <button
          className="pointer-events-auto rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 font-medium text-xs shadow-sm backdrop-blur hover:bg-primary/20"
          onClick={handleSaveDesign}
          type="button"
        >
          Save image
        </button>
        <a
          className="pointer-events-auto rounded-md border border-border bg-background/90 px-3 py-1.5 font-medium text-xs shadow-sm backdrop-blur hover:bg-accent/40"
          href="https://request-mauve.vercel.app/"
        >
          Home
        </a>
      </div>
      <Editor
        layoutVersion="v2"
        onLoad={handleLoad}
        onSave={handleSave}
        onThumbnailCapture={handleThumb}
        projectId={meta.projectId ?? 'default'}
        sidebarTabs={SIDEBAR_TABS}
        viewerToolbarLeft={<CommunityViewerToolbarLeft />}
        viewerToolbarRight={<CommunityViewerToolbarRight />}
      />
    </div>
  )
}
