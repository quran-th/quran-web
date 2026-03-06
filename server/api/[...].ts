/**
 * Catch-all proxy for the quran-api backend.
 *
 * Production: Uses Cloudflare Service Binding (QURAN_API) — zero-latency,
 * no HTTP overhead, no env var required.
 *
 * Dev: Falls back to HTTP proxy via NUXT_QURAN_API_URL (default: http://localhost:8787)
 */
export default defineEventHandler(async (event) => {
  const path = event.path.replace(/^\/api/, '')

  // Production: Cloudflare Service Binding
  // Guarded by import.meta.dev because nitro-cloudflare-dev exposes a stub
  // QURAN_API Fetcher in dev that can't actually route to the local worker.
  if (!import.meta.dev) {
    const env = event.context.cloudflare?.env
    if (env?.QURAN_API) {
      const hasBody = !['GET', 'HEAD'].includes(event.method)
      return env.QURAN_API.fetch(
        new Request(new URL(path, 'https://quran-api.internal'), {
          method: event.method,
          headers: getRequestHeaders(event),
          body: hasBody ? await readRawBody(event) : undefined,
        })
      )
    }
  }

  // Dev: HTTP proxy to local quran-api
  const config = useRuntimeConfig()
  return proxyRequest(event, `${config.quranApiUrl}${path}`)
})
