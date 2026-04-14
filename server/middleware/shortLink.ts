import { defineEventHandler, sendRedirect } from 'h3'

export default defineEventHandler((event) => {
  const match = event.path.match(/^\/(\d+):(\d+)$/)
  if (match) {
    const surah = match[1]
    const ayah = match[2]
    return sendRedirect(event, `/surah/${surah}?ayah=${ayah}`, 301)
  }
})
