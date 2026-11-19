import { ref, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMushafStore } from '~/stores/mushafStore'
import { useQuranStore, type Verse } from '~/stores/quranStore'
import { useReaderSettingsStore } from '~/stores/readerSettingsStore'

interface VerseSegment {
  surahNumber: number
  name: string
  from: number
  to: number
}

// Keyed by `${sourceId}:${page}` and shared by every column/sheet so a page is fetched once per source
const pageCache = new Map<string, Promise<Verse[]>>()
let surahsRequested = false

function fetchPageVerses(page: number, keys: string[], sourceId: number | undefined): Promise<Verse[]> {
  const cacheKey = `${sourceId}:${page}`
  const cached = pageCache.get(cacheKey)
  if (cached) return cached

  const request = $fetch<{ success: boolean; data: { verses: Verse[] } }>('/api/verses/by-keys', {
    method: 'POST',
    body: { keys, sourceId },
  }).then(res => (res.success ? res.data.verses : []))
  pageCache.set(cacheKey, request)
  request.then(
    verses => {
      if (verses.length === 0) pageCache.delete(cacheKey)
    },
    () => pageCache.delete(cacheKey),
  )
  return request
}

/** Splits a translation on `(*n*)` markers into text and footnote-number parts. */
export function splitFootnoteMarkers(text: string): { type: 'text' | 'footnote'; value: string }[] {
  const parts: { type: 'text' | 'footnote'; value: string }[] = []
  const regex = /\(\*(\d+)\*\)/g
  let lastIndex = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ type: 'text', value: text.substring(lastIndex, match.index) })
    parts.push({ type: 'footnote', value: match[1] ?? '' })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push({ type: 'text', value: text.substring(lastIndex) })
  return parts
}

/** Translations for one Mushaf page, kept local so the global quran store state is untouched. */
export function usePageTranslations(page: Ref<number>, enabled: Ref<boolean> = ref(true)) {
  const mushafStore = useMushafStore()
  const quranStore = useQuranStore()
  const { selectedSourceId } = storeToRefs(useReaderSettingsStore())

  const verses = ref<Verse[]>([])
  const segments = ref<VerseSegment[]>([])
  const loading = ref(false)
  let requestId = 0

  function buildSegments(keys: string[]): VerseSegment[] {
    const result: VerseSegment[] = []
    for (const key of keys) {
      const [surah, verse] = key.split(':').map(Number)
      if (!surah || !verse) continue
      const last = result[result.length - 1]
      if (last && last.surahNumber === surah) {
        last.from = Math.min(last.from, verse)
        last.to = Math.max(last.to, verse)
      }
      else {
        const name = quranStore.surahs.find(s => s.id === surah)?.name_thai ?? ''
        result.push({ surahNumber: surah, name, from: verse, to: verse })
      }
    }
    return result
  }

  watch(
    [
      page,
      enabled,
      selectedSourceId,
      () => mushafStore.getPageVerseKeys(page.value).join(','),
      () => quranStore.surahs.length,
    ],
    async () => {
      if (!import.meta.client) return
      if (!enabled.value) {
        requestId++
        loading.value = false
        return
      }
      const keys = mushafStore.getPageVerseKeys(page.value)
      segments.value = buildSegments(keys)
      if (quranStore.surahs.length === 0 && !surahsRequested) {
        surahsRequested = true
        quranStore.fetchSurahs()
      }
      if (keys.length === 0) {
        requestId++
        loading.value = false
        verses.value = []
        return
      }
      const id = ++requestId
      loading.value = true
      try {
        const result = await fetchPageVerses(page.value, keys, selectedSourceId.value)
        if (id === requestId) verses.value = result
      }
      catch (e) {
        if (id === requestId) verses.value = []
        console.error('Failed to load page translations:', e)
      }
      finally {
        if (id === requestId) loading.value = false
      }
    },
    { immediate: true },
  )

  return { verses, segments, loading }
}
