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
  const env = event.context.cloudflare?.env

  if (env?.QURAN_API) {
    const incoming = toWebRequest(event)
    const url = new URL(incoming.url)
    url.pathname = path
    return env.QURAN_API.fetch(new Request(url.toString(), incoming))
  }

  // Local dev fallback
  const config = useRuntimeConfig()
  return proxyRequest(event, `${config.quranApiUrl}${path}`)
})
