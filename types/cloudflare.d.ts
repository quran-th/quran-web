/**
 * Cloudflare Workers environment types
 * https://developers.cloudflare.com/workers/configuration/
 */

interface D1Database {
  prepare: (sql: string) => D1PreparedStatement
  exec: (sql: string) => Promise<D1Result>
  batch: (statements: D1Statement[]) => Promise<D1Result[]>
}

interface FetchService {
  fetch: (request: Request) => Promise<Response>
}

interface D1PreparedStatement {
  bind: (...values: unknown[]) => D1PreparedStatement
  first: () => Promise<Record<string, unknown> | null>
  run: () => Promise<D1Result>
  all: () => Promise<Record<string, unknown>[]>
}

interface D1Statement {
  sql: string
  args?: unknown[]
}

interface D1Result {
  success: boolean
  meta: D1Meta
  duration: number
}

interface D1Meta {
  duration: number
  last_row_id: number
  changes: number
  served_by: string
}

interface CloudflareEnv {
  QURAN_API?: FetchService
  // Add other bindings as needed:
  // DB?: D1Database
  // CACHE?: KVNamespace
  // ASSETS_BUCKET?: R2Bucket
}

declare module '#cloudflare' {
  export type CloudflareEnv = CloudflareEnv
}

interface H3EventContext {
  cloudflare?: {
    env: CloudflareEnv
  }
}
