'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Step 3 — after Step 1 builds a scene and redirects here with
 * ?autoScreenshot=1, wait for the 3D canvas to render a few frames, then
 * capture it the same way the editor's own "Take Screenshot" command
 * palette action does (packages/editor/src/components/ui/command-palette/
 * editor-commands.tsx — canvas.toDataURL('image/png')), and show it as an
 * overlay with a download link instead of triggering an automatic
 * download.
 */
export function AutoScreenshot() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('autoScreenshot') !== '1') return

    let cancelled = false
    const timer = setTimeout(() => {
      if (cancelled) return
      const canvas = document.querySelector('canvas')
      if (!canvas) return
      try {
        setImageUrl(canvas.toDataURL('image/png'))
      } catch {
        // Canvas may be tainted or not yet ready — leave imageUrl unset,
        // the user can still use the editor's own screenshot command.
      }
      // Strip the query param so refreshing doesn't re-trigger this.
      router.replace(window.location.pathname)
    }, 3000)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchParams, router])

  if (!imageUrl) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={() => setImageUrl(null)}
    >
      <div
        className="max-h-[85vh] max-w-3xl overflow-auto rounded-lg bg-background p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-sm">Step 3 — generated image</p>
        {/* biome-ignore lint: preview of a locally generated data URL */}
        <img alt="Generated house preview" className="w-full rounded-md border border-border" src={imageUrl} />
        <div className="mt-3 flex justify-end gap-2">
          <a
            className="rounded-md border border-border px-3 py-1.5 text-sm"
            download={`house_${Date.now()}.png`}
            href={imageUrl}
          >
            Download PNG
          </a>
          <button
            className="rounded-md bg-foreground px-3 py-1.5 text-background text-sm"
            onClick={() => setImageUrl(null)}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
