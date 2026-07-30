import type { SceneStore } from './types'

export * from './slug'
export * from './sqlite-scene-store'
export * from './supabase-scene-store'
export * from './types'

/**
 * Factory for Pascal's scene store.
 *
 * Picks a backend based on env, in this order:
 * 1. If `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set, uses
 *    `SupabaseSceneStore` — required for stateless hosts like Vercel,
 *    where a local SQLite file would not persist between invocations.
 * 2. Otherwise falls back to `SqliteSceneStore`, writing to
 *    `~/.pascal/data/pascal.db` by default; set `PASCAL_DB_PATH` for an
 *    exact file path or `PASCAL_DATA_DIR` for a directory containing
 *    `pascal.db`. This path only works on hosts with a persistent local
 *    filesystem (e.g. Railway, Render, your own machine) — not Vercel.
 */
export async function createSceneStore(env?: NodeJS.ProcessEnv): Promise<SceneStore> {
  const e = env ?? process.env
  if (e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) {
    const mod = await import('./supabase-scene-store')
    return new mod.SupabaseSceneStore({ env: e })
  }
  const mod = await import('./sqlite-scene-store')
  return new mod.SqliteSceneStore({ env: e })
}
