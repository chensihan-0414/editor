import { createHash } from 'node:crypto'
import type { SceneGraph } from '@pascal-app/core/clone-scene-graph'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { generateSlug, isValidSlug, sanitizeSlug } from './slug'
import {
  type ProjectCreateOptions,
  type ProjectStatus,
  type SceneEvent,
  type SceneEventAppendOptions,
  type SceneEventListOptions,
  SceneInvalidError,
  type SceneListOptions,
  type SceneMeta,
  type SceneMutateOptions,
  SceneNotFoundError,
  type SceneSaveOptions,
  type SceneStore,
  SceneTooLargeError,
  SceneVersionConflictError,
  type SceneWithGraph,
} from './types'

/**
 * Postgres/Supabase-backed implementation of `SceneStore`.
 *
 * Same data model as `SqliteSceneStore` (see sqlite-scene-store.ts) but
 * targets a shared Postgres database over the network instead of a local
 * file — this is what makes it safe to run on stateless/serverless hosts
 * like Vercel, where SqliteSceneStore's local file would not persist
 * between invocations.
 *
 * Run `supabase-schema.sql` (in this same folder) against your Supabase
 * project once before using this. Configure via env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (server-side key — never expose to the browser)
 *
 * Concurrency note: unlike the SQLite version's `BEGIN IMMEDIATE`
 * transaction, writes here use an optimistic compare-and-swap on `version`
 * via the UPDATE's WHERE clause, followed by a separate revision-history
 * insert. There's a small window between those two calls where they are
 * not atomic as a pair — acceptable for this project's write volume, but
 * worth knowing if this ever needs to handle heavy concurrent writes.
 */

const DEFAULT_MAX_SCENE_BYTES = 10 * 1024 * 1024
const DEFAULT_LIST_LIMIT = 100
const MAX_NAME_LENGTH = 200
const MIN_NAME_LENGTH = 1

export interface SupabaseSceneStoreOptions {
  env?: NodeJS.ProcessEnv
  maxSceneBytes?: number
}

interface SceneRow {
  id: string
  name: string
  project_id: string | null
  owner_id: string | null
  thumbnail_url: string | null
  version: number
  created_at: string
  updated_at: string
  size_bytes: number
  node_count: number
  graph_json: unknown
}

interface SceneEventRow {
  event_id: number
  scene_id: string
  version: number
  kind: string
  created_at: string
  graph_json: unknown
}

interface ProjectPlaceholder {
  id: string
  name: string
  ownerId: string | null
  thumbnailUrl: string | null
  createdAt: string
  updatedAt: string
}

const GraphSchema = z.object({
  nodes: z.record(z.string(), z.unknown()),
  rootNodeIds: z.array(z.string()),
  collections: z.record(z.string(), z.unknown()).optional(),
})

function resolveMaxSceneBytes(
  env: NodeJS.ProcessEnv | undefined,
  explicit: number | undefined,
): number {
  if (explicit !== undefined) {
    if (!Number.isInteger(explicit) || explicit <= 0) {
      throw new SceneInvalidError('maxSceneBytes must be a positive integer')
    }
    return explicit
  }
  const raw = env?.PASCAL_MAX_SCENE_BYTES
  if (raw === undefined || raw === '') return DEFAULT_MAX_SCENE_BYTES
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new SceneInvalidError('PASCAL_MAX_SCENE_BYTES must be a positive integer')
  }
  return parsed
}

function editorUrlForScene(id: string): string {
  return `/editor/${id}`
}

function hashGraph(graph: unknown): string {
  return createHash('sha256').update(JSON.stringify(graph)).digest('hex')
}

function rowToMeta(row: SceneRow): SceneMeta {
  const editorUrl = editorUrlForScene(row.id)
  return {
    id: row.id,
    name: row.name,
    projectId: row.project_id,
    ownerId: row.owner_id,
    thumbnailUrl: row.thumbnail_url,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sizeBytes: row.size_bytes,
    nodeCount: row.node_count,
    editorUrl,
    url: editorUrl,
    published: true,
    graphHash: hashGraph(row.graph_json),
  }
}

function rowToProjectStatus(row: SceneRow): ProjectStatus {
  const editorUrl = editorUrlForScene(row.id)
  return {
    id: row.id,
    projectId: row.project_id ?? row.id,
    name: row.name,
    editorUrl,
    url: editorUrl,
    ownerId: row.owner_id,
    thumbnailUrl: row.thumbnail_url,
    publishedVersion: row.version,
    latestVersion: row.version,
    draftVersion: null,
    browserVisibleVersion: row.version,
    version: row.version,
    isEmpty: row.node_count === 0,
    sizeBytes: row.size_bytes,
    nodeCount: row.node_count,
    graphHash: hashGraph(row.graph_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function placeholderToProjectStatus(project: ProjectPlaceholder): ProjectStatus {
  const editorUrl = editorUrlForScene(project.id)
  return {
    id: project.id,
    projectId: project.id,
    name: project.name,
    editorUrl,
    url: editorUrl,
    ownerId: project.ownerId,
    thumbnailUrl: project.thumbnailUrl,
    publishedVersion: null,
    latestVersion: null,
    draftVersion: null,
    browserVisibleVersion: null,
    version: 0,
    isEmpty: true,
    sizeBytes: 0,
    nodeCount: 0,
    graphHash: null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

function assertValidName(name: string): void {
  if (typeof name !== 'string') {
    throw new SceneInvalidError('Scene name must be a string')
  }
  const trimmed = name.trim()
  if (trimmed.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    throw new SceneInvalidError(
      `Scene name must be ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} characters (got ${name.length})`,
    )
  }
}

function validateGraph(graph: unknown, context: string): SceneGraph {
  const result = GraphSchema.safeParse(graph)
  if (!result.success) {
    throw new SceneInvalidError(`Scene graph for ${context} has invalid shape: ${result.error}`)
  }
  const parsed = result.data
  for (const [nodeId, node] of Object.entries(parsed.nodes)) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      throw new SceneInvalidError(`Scene graph for ${context} has non-object node at "${nodeId}"`)
    }
    const typeField = (node as { type?: unknown }).type
    if (typeof typeField !== 'string' || typeField.length === 0) {
      throw new SceneInvalidError(
        `Scene graph for ${context} has node "${nodeId}" missing a string "type"`,
      )
    }
  }
  return parsed as SceneGraph
}

export class SupabaseSceneStore implements SceneStore {
  readonly backend = 'supabase' as const

  private readonly client: SupabaseClient
  private readonly maxSceneBytes: number
  private readonly projectPlaceholders = new Map<string, ProjectPlaceholder>()

  constructor(opts: SupabaseSceneStoreOptions = {}) {
    const env = opts.env ?? process.env
    const url = env.SUPABASE_URL
    const key = env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new SceneInvalidError(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use SupabaseSceneStore',
      )
    }
    this.client = createClient(url, key, { auth: { persistSession: false } })
    this.maxSceneBytes = resolveMaxSceneBytes(env, opts.maxSceneBytes)
  }

  async createProject(opts: ProjectCreateOptions): Promise<ProjectStatus> {
    assertValidName(opts.name)
    const id = opts.id ? sanitizeSlug(opts.id) : await this.generateUniqueId()
    if (!isValidSlug(id)) {
      throw new SceneInvalidError(`Invalid project id after sanitization: "${id}"`)
    }
    if (await this.getRow(id)) {
      throw new SceneInvalidError(`Project with id "${id}" already exists`)
    }
    const now = new Date().toISOString()
    const project: ProjectPlaceholder = {
      id,
      name: opts.name,
      ownerId: opts.ownerId ?? null,
      thumbnailUrl: null,
      createdAt: now,
      updatedAt: now,
    }
    this.projectPlaceholders.set(id, project)
    return placeholderToProjectStatus(project)
  }

  async getProjectStatus(id: string): Promise<ProjectStatus | null> {
    const safeId = sanitizeSlug(id)
    const row = await this.getRow(safeId)
    if (row) return rowToProjectStatus(row)
    const placeholder = this.projectPlaceholders.get(safeId)
    return placeholder ? placeholderToProjectStatus(placeholder) : null
  }

  async save(opts: SceneSaveOptions): Promise<SceneMeta> {
    assertValidName(opts.name)
    if (!opts.graph || typeof opts.graph !== 'object') {
      throw new SceneInvalidError('graph is required')
    }

    const providedId = opts.id
    const id = providedId ? sanitizeSlug(providedId) : await this.generateUniqueId()
    if (!isValidSlug(id)) {
      throw new SceneInvalidError(`Invalid scene id after sanitization: "${id}"`)
    }

    const existing = await this.getRow(id)
    const placeholder = this.projectPlaceholders.get(id)

    if (existing && providedId !== undefined && opts.expectedVersion === undefined) {
      throw new SceneInvalidError(
        `Scene with id "${id}" already exists. Pass a different id or provide expectedVersion to overwrite.`,
      )
    }
    if (opts.expectedVersion !== undefined) {
      const currentVersion = existing?.version ?? 0
      if (currentVersion !== opts.expectedVersion) {
        throw new SceneVersionConflictError(
          `Scene "${id}" version mismatch: expected ${opts.expectedVersion}, got ${currentVersion}`,
        )
      }
    }

    const sizeBytes = Buffer.byteLength(JSON.stringify(opts.graph), 'utf8')
    if (sizeBytes > this.maxSceneBytes) {
      throw new SceneTooLargeError(
        `Scene "${id}" is ${sizeBytes} bytes, exceeds cap of ${this.maxSceneBytes} bytes`,
      )
    }

    const now = new Date().toISOString()
    const version = (existing?.version ?? 0) + 1
    const createdAt = existing?.created_at ?? placeholder?.createdAt ?? now
    const nodeCount = Object.keys((opts.graph as SceneGraph).nodes ?? {}).length
    const projectId = opts.projectId ?? existing?.project_id ?? (placeholder ? id : null)
    const ownerId = opts.ownerId ?? existing?.owner_id ?? placeholder?.ownerId ?? null
    const thumbnailUrl =
      opts.thumbnailUrl ?? existing?.thumbnail_url ?? placeholder?.thumbnailUrl ?? null

    if (existing) {
      // Compare-and-swap: the WHERE clause only matches if version hasn't
      // moved since we read it above, giving us the same protection a
      // transaction+version-check gives the SQLite store.
      const { data, error } = await this.client
        .from('scenes')
        .update({
          name: opts.name,
          project_id: projectId,
          owner_id: ownerId,
          thumbnail_url: thumbnailUrl,
          version,
          updated_at: now,
          size_bytes: sizeBytes,
          node_count: nodeCount,
          graph_json: opts.graph,
        })
        .eq('id', id)
        .eq('version', existing.version)
        .select()
        .maybeSingle()
      if (error) throw new SceneInvalidError(`Supabase update failed: ${error.message}`)
      if (!data) {
        throw new SceneVersionConflictError(`Scene "${id}" was modified concurrently`)
      }
    } else {
      const { error } = await this.client.from('scenes').insert({
        id,
        name: opts.name,
        project_id: projectId,
        owner_id: ownerId,
        thumbnail_url: thumbnailUrl,
        version,
        created_at: createdAt,
        updated_at: now,
        size_bytes: sizeBytes,
        node_count: nodeCount,
        graph_json: opts.graph,
      })
      if (error) throw new SceneInvalidError(`Supabase insert failed: ${error.message}`)
    }

    await this.client.from('scene_revisions').insert({
      scene_id: id,
      version,
      graph_json: opts.graph,
      author_kind: 'mcp',
      author_id: ownerId,
      created_at: now,
    })

    this.projectPlaceholders.delete(id)

    return {
      id,
      name: opts.name,
      projectId,
      ownerId,
      thumbnailUrl,
      version,
      createdAt,
      updatedAt: now,
      sizeBytes,
      nodeCount,
      editorUrl: editorUrlForScene(id),
      url: editorUrlForScene(id),
      published: true,
      graphHash: hashGraph(opts.graph),
    }
  }

  async load(id: string): Promise<SceneWithGraph | null> {
    const row = await this.getRow(sanitizeSlug(id))
    if (!row) return null
    return {
      ...rowToMeta(row),
      graph: validateGraph(row.graph_json, row.id),
    }
  }

  async list(opts: SceneListOptions = {}): Promise<SceneMeta[]> {
    let query = this.client.from('scenes').select('*')
    if (opts.projectId !== undefined) query = query.eq('project_id', opts.projectId)
    if (opts.ownerId !== undefined) query = query.eq('owner_id', opts.ownerId)
    const limit = opts.limit ?? DEFAULT_LIST_LIMIT
    query = query.order('updated_at', { ascending: false }).order('id', { ascending: true }).limit(limit)

    const { data, error } = await query
    if (error) throw new SceneInvalidError(`Supabase list failed: ${error.message}`)
    return (data ?? []).map((row) => rowToMeta(row as SceneRow))
  }

  async delete(id: string, opts: SceneMutateOptions = {}): Promise<boolean> {
    const safeId = sanitizeSlug(id)
    const existing = await this.getRow(safeId)
    if (!existing) return false
    if (opts.expectedVersion !== undefined && existing.version !== opts.expectedVersion) {
      throw new SceneVersionConflictError(
        `Scene "${safeId}" version mismatch: expected ${opts.expectedVersion}, got ${existing.version}`,
      )
    }
    const { error } = await this.client.from('scenes').delete().eq('id', safeId)
    if (error) throw new SceneInvalidError(`Supabase delete failed: ${error.message}`)
    return true
  }

  async rename(id: string, newName: string, opts: SceneMutateOptions = {}): Promise<SceneMeta> {
    assertValidName(newName)
    const safeId = sanitizeSlug(id)
    const existing = await this.getRow(safeId)
    if (!existing) {
      throw new SceneNotFoundError(`Scene "${safeId}" not found`)
    }
    if (opts.expectedVersion !== undefined && existing.version !== opts.expectedVersion) {
      throw new SceneVersionConflictError(
        `Scene "${safeId}" version mismatch: expected ${opts.expectedVersion}, got ${existing.version}`,
      )
    }
    const now = new Date().toISOString()
    const nextVersion = existing.version + 1
    const { error } = await this.client
      .from('scenes')
      .update({ name: newName, version: nextVersion, updated_at: now })
      .eq('id', safeId)
      .eq('version', existing.version)
    if (error) throw new SceneInvalidError(`Supabase rename failed: ${error.message}`)

    await this.client.from('scene_revisions').insert({
      scene_id: safeId,
      version: nextVersion,
      graph_json: existing.graph_json,
      author_kind: 'mcp',
      author_id: existing.owner_id,
      created_at: now,
    })

    return { ...rowToMeta(existing), name: newName, version: nextVersion, updatedAt: now }
  }

  async appendSceneEvent(opts: SceneEventAppendOptions): Promise<SceneEvent> {
    const safeId = sanitizeSlug(opts.sceneId)
    const existing = await this.getRow(safeId)
    if (!existing) {
      throw new SceneNotFoundError(`Scene "${safeId}" not found`)
    }
    const now = new Date().toISOString()
    const { data, error } = await this.client
      .from('scene_events')
      .insert({
        scene_id: safeId,
        version: opts.version,
        kind: opts.kind,
        created_at: now,
        graph_json: opts.graph,
      })
      .select()
      .single()
    if (error || !data) {
      throw new SceneInvalidError(`Supabase event insert failed: ${error?.message}`)
    }
    return {
      eventId: Number((data as SceneEventRow).event_id),
      sceneId: safeId,
      version: opts.version,
      kind: opts.kind,
      createdAt: now,
      graph: opts.graph,
    }
  }

  async listSceneEvents(sceneId: string, opts: SceneEventListOptions = {}): Promise<SceneEvent[]> {
    const afterEventId = Math.max(0, opts.afterEventId ?? 0)
    const limit = opts.limit ?? 100
    const { data, error } = await this.client
      .from('scene_events')
      .select('*')
      .eq('scene_id', sanitizeSlug(sceneId))
      .gt('event_id', afterEventId)
      .order('event_id', { ascending: true })
      .limit(limit)
    if (error) throw new SceneInvalidError(`Supabase event list failed: ${error.message}`)
    return (data ?? []).map((row) => {
      const r = row as SceneEventRow
      return {
        eventId: Number(r.event_id),
        sceneId: r.scene_id,
        version: Number(r.version),
        kind: r.kind,
        createdAt: r.created_at,
        graph: validateGraph(r.graph_json, `${r.scene_id}@${r.version}`),
      }
    })
  }

  private async getRow(id: string): Promise<SceneRow | null> {
    const { data, error } = await this.client.from('scenes').select('*').eq('id', id).maybeSingle()
    if (error) throw new SceneInvalidError(`Supabase read failed: ${error.message}`)
    return (data as SceneRow | null) ?? null
  }

  private async generateUniqueId(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const id = generateSlug()
      if (!(await this.getRow(id))) return id
    }
    throw new SceneInvalidError('Failed to generate a unique scene id')
  }
}
