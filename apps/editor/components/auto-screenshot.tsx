'use client'

/**
 * Step 3 — pure display overlay for the auto-captured screenshot.
 *
 * The actual capture is triggered and received in scene-loader.tsx, via
 * Pascal's own thumbnail/snapshot pipeline (emitter.emit +
 * onThumbnailCapture) — the same mechanism used for real project
 * thumbnails. An earlier version of this component tried to read the
 * visible <canvas> directly with canvas.toDataURL(), which produced
 * blank images: the viewer renders through WebGPU, and that canvas
 * doesn't reliably keep a readable buffer for code outside its own
 * render loop, no matter how long you wait before reading it. Routing
 * through their real pipeline (packages/viewer/src/lib/snapshot-pipeline.ts)
 * sidesteps that entirely.
 */
export function AutoScreenshot({
  imageUrl,
  onClose,
}: {
  imageUrl: string | null
  onClose: () => void
}) {
  if (!imageUrl) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div
        className="max-h-[85vh] max-w-3xl overflow-auto rounded-lg bg-background p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-sm">Step 3 — generated image</p>
        {/* biome-ignore lint: preview of a locally generated object URL */}
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
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
