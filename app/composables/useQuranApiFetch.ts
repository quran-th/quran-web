/**
 * Provides a fetch function that bypasses the HTTP proxy on the server side.
 *
 * On the server (SSR / _payload.json), Nuxt's $fetch creates a child H3 event
 * that does not inherit the parent request's cloudflare.env. Accessing the
 * QURAN_API service binding through $fetch('/api/...') therefore always fails.
 *
 * The fix (per Nitro Cloudflare docs): capture useRequestEvent() at the
 * synchronous setup level — this IS the original request event and always has
 * cloudflare.env — then call the service binding directly without creating a
 * child event.
 *
 * On the client, falls back to the standard $fetch proxy.
 */
export function useQuranApiFetch() {
  // Captured synchronously at setup time — gives us the original request event
  // with cloudflare.env. Must be called at the top level of setup, not inside
  // an async callback, to guarantee the Nuxt context is available.
  const event = import.meta.server ? useRequestEvent() : undefined

  return async <T>(path: string): Promise<T> => {
    if (import.meta.server && !import.meta.dev) {
      const binding = event?.context?.cloudflare?.env?.QURAN_API
      if (binding) {
        const res = await binding.fetch(
          new Request(new URL(path, 'https://quran-api.internal')),
        )
        if (!res.ok) {
          throw createError({ statusCode: res.status, statusMessage: `quran-api error: ${res.status}` })
        }
        return res.json() as T
      }
    }

    // Client-side, or dev (where service binding is unavailable)
    return $fetch<T>(`/api${path}`)
  }
}
