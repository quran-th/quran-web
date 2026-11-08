/** The deployed build's id; open pages compare it with their own to offer the update. */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { build: useRuntimeConfig(event).public.buildId }
})
