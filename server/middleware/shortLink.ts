import { defineEventHandler, getQuery, sendRedirect } from 'h3'

interface MushafPage {
  page: number
  verseFrom: number
  verseTo: number
}

/**
 * Legacy and non-canonical URLs → clean /{surah}/{ayah} in a single redirect:
 *   /2:255?t=3  (also /2%3A255)        → /2/255?translation=3
 *   /surah/2                           → /2
 *   /surah/2/255, /surah/2?ayah=255    → /2/255
 *   /surah/2?page=42                   → /2/253   (first ayah of Mushaf page 42)
 *   /02/0255                           → /2/255   (leading zeros would be duplicate URLs)
 * Other query params (translation, reciter, play) are carried over.
 */

// Only the resolved value is cached: sharing an in-flight promise across
// requests is unsafe on Workers (cancelled request → aborted fetch for all)
let pageMapping: Record<string, MushafPage[]> | null = null

async function loadPageMapping(assetsBaseUrl: string) {
  if (pageMapping) return pageMapping
  try {
    pageMapping = await $fetch<Record<string, MushafPage[]>>(
      `${assetsBaseUrl}/quran-pages/surah-page-mapping.json`,
    )
  }
  catch (e) {
    console.error('Failed to load surah page mapping:', e)
  }
  return pageMapping
}

function buildTarget(surah: number, ayah: number | null, query: Record<string, unknown>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (['page', 'ayah', 't'].includes(key) || value === undefined) continue
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, String(v))
  }
  if (query.t !== undefined && query.translation === undefined) {
    params.set('translation', String(query.t))
  }
  // ayah 0 keeps its segment so the page answers 404 instead of silently showing ayah 1
  const path = ayah !== null && ayah !== 1 ? `/${surah}/${ayah}` : `/${surah}`
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const short = event.path.match(/^\/(\d+)(?::|%3A)(\d+)\/?(?:\?|$)/i)
  if (short) {
    return sendRedirect(event, buildTarget(Number(short[1]), Number(short[2]), query), 301)
  }

  // 0+\d+ (not 0\d*): a bare "0" segment must fall through to the page's 404, not redirect to itself
  const padded = event.path.match(/^\/(0+\d+)(?:\/(\d+))?\/?(?:\?|$)|^\/(\d+)\/(0+\d+)\/?(?:\?|$)/)
  if (padded) {
    const surah = Number(padded[1] ?? padded[3])
    const ayahSegment = padded[2] ?? padded[4]
    return sendRedirect(event, buildTarget(surah, ayahSegment ? Number(ayahSegment) : null, query), 301)
  }

  const legacy = event.path.match(/^\/surah\/(\d+)(?:\/(\d+))?\/?(?:\?|$)/)
  if (!legacy) return

  const surah = Number(legacy[1])
  const ayahValue = legacy[2] ?? query.ayah
  let ayah = ayahValue !== undefined ? Number(ayahValue) : null

  const pageNumber = Number(query.page)
  if (ayah === null && pageNumber) {
    const { public: { assetsBaseUrl } } = useRuntimeConfig(event)
    const mapping = await loadPageMapping(assetsBaseUrl)
    if (!mapping) {
      // Temporary: a 301 here would be cached forever even after the CDN recovers
      return sendRedirect(event, buildTarget(surah, null, query), 302)
    }
    ayah = mapping[String(surah)]?.find((p) => p.page === pageNumber)?.verseFrom ?? null
  }

  return sendRedirect(event, buildTarget(surah, ayah, query), 301)
})
