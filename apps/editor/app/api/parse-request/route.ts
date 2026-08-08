import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { parseCustomerRequestDeepSeek } from '@/lib/prefab/stage1-deepseek'
import { guardSceneApiRequest, sceneApiJson, sceneApiPreflight } from '@/lib/scene-api-security'

// Public-facing endpoint for the "type what you need, AI builds it" flow on
// the request marketing site — a visitor's free-text description comes in
// here, gets parsed into a module list server-side (using OUR DeepSeek key,
// never one the visitor supplies), and the site then builds/redirects into
// the generated house via the existing /step1?data=... flow (buildStep1Url
// in request's script.js).
//
// Reuses the origin allowlist + per-IP rate limit machinery
// apps/editor/app/api/scenes/route.ts already relies on
// (lib/scene-api-security.ts) — same guard function, just with the
// shared-token check skipped (see below). Configure via the same env vars:
//   PASCAL_SCENE_API_ORIGINS   — must include the request site's real
//                                 production origin, or the browser fetch
//                                 from that domain gets a CORS rejection.
//   PASCAL_SCENE_API_RATE_LIMIT — requests/minute/IP, defaults to 120.
// PLUS a new one this route alone needs:
//   DEEPSEEK_API_KEY — the site owner's own DeepSeek API key (from
//                        platform.deepseek.com), used server-side only,
//                        never sent to the browser. Parsing is done by
//                        DeepSeek's deepseek-v4-flash model — see
//                        lib/prefab/stage1-deepseek.ts for why DeepSeek
//                        rather than the Anthropic-backed
//                        lib/prefab/stage1.ts (which app/step1/page.tsx's
//                        manual form still uses, unchanged).
//
// Auth token intentionally skipped (unlike /api/scenes): that token is
// already publicly embedded in the editor's own client bundle
// (NEXT_PUBLIC_PASCAL_SCENE_API_TOKEN), so requiring it here would just
// mean baking the same non-secret into request's script.js too — no real
// security gain, and one less thing to keep in sync across two repos.
// Origin allowlisting + the per-IP rate limit are the actual protections
// for this endpoint (it can only turn text into a module list — much
// lower blast radius than the scenes read/write API those checks were
// originally built for).
export const dynamic = 'force-dynamic'

const parseRequestSchema = z.object({
  text: z.string().min(1).max(2000),
})

export function OPTIONS(request: NextRequest) {
  return sceneApiPreflight(request)
}

export async function POST(request: NextRequest) {
  const guard = guardSceneApiRequest(request, { skipAuth: true })
  if (guard) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return sceneApiJson(
      request,
      { error: 'invalid_request', details: 'body must be valid JSON' },
      { status: 400 },
    )
  }

  const parsed = parseRequestSchema.safeParse(body)
  if (!parsed.success) {
    return sceneApiJson(
      request,
      { error: 'invalid_request', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return sceneApiJson(request, { error: 'server_not_configured' }, { status: 503 })
  }

  try {
    const result = await parseCustomerRequestDeepSeek(parsed.data.text, apiKey)
    return sceneApiJson(request, result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected_error'
    return sceneApiJson(request, { error: 'parse_failed', message }, { status: 502 })
  }
}
