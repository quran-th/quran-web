import { defineEventHandler, getQuery, sendRedirect } from 'h3'

export default defineEventHandler((event) => {
  const match = event.path.match(/^\/(\d+):(\d+)/)
  if (match) {
    const surah = match[1]!
    const ayah = match[2]!
    const query = getQuery(event)
    const params = new URLSearchParams({ ayah })
    if (query.t) params.set('translation', query.t as string)
    return sendRedirect(event, `/surah/${surah}?${params.toString()}`, 301)
  }
})
