/**
 * Catch-all proxy for the quran-api backend.
 *
 * Production: Uses Cloudflare Service Binding (QURAN_API) — zero-latency,
 * no HTTP overhead, no env var required.
 *
 * Dev: Falls back to HTTP proxy via NUXT_QURAN_API_URL (default: http://localhost:8787)
 */

// nitro-cloudflare-dev types every env binding as `unknown`
function isServiceBinding(value: unknown): value is { fetch: (request: Request) => Promise<Response> } {
  return typeof value === 'object' && value !== null && 'fetch' in value && typeof value.fetch === 'function'
}

export default defineEventHandler(async (event) => {
  const path = event.path.replace(/^\/api/, '')

  // Production: Cloudflare Service Binding
  // Guarded by import.meta.dev because nitro-cloudflare-dev exposes a stub
  // QURAN_API Fetcher in dev that can't actually route to the local worker.
  if (!import.meta.dev) {
    const binding = event.context.cloudflare?.env?.QURAN_API

    if (isServiceBinding(binding)) {
      const hasBody = !['GET', 'HEAD'].includes(event.method)
      const headers = getRequestHeaders(event)
      const filteredHeaders: Record<string, string> = Object.fromEntries(
        Object.entries(headers).filter(([, v]) => v !== undefined)
      ) as Record<string, string>
      return binding.fetch(
        new Request(new URL(path, 'https://quran-api.internal'), {
          method: event.method,
          headers: filteredHeaders,
          body: hasBody ? await readRawBody(event) : undefined,
        })
      )
    }
  }

  // Dev: HTTP proxy to local quran-api
  const config = useRuntimeConfig()
  return proxyRequest(event, `${config.quranApiUrl}${path}`)
})
