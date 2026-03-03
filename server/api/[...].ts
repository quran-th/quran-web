/**
 * Catch-all proxy for the quran-api backend.
 *
 * Routes all /api/* requests to the configured backend URL so that
 * $fetch('/api/...') works from both the Nitro SSR process and the browser.
 *
 * Dev:  NUXT_QURAN_API_URL defaults to http://localhost:8787
 * Prod: set NUXT_QURAN_API_URL in the Cloudflare Pages environment variables
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  // Strip the /api prefix that Nuxt adds — backend routes don't have it
  const path = event.path.replace(/^\/api/, '')
  return proxyRequest(event, `${config.quranApiUrl}${path}`)
})
