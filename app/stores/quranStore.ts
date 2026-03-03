import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { QuranWord } from '~/types/quran'

export interface Surah {
  id: number
  name_simple: string
  name_arabic: string
  name_thai: string
  englishName: string
  englishNameTranslation: string
  revelation_place: string
  verses_count: number
}

export interface Footnote {
  number: number
  text: string
}

export interface Verse {
  verseNumber: number
  content: string
  translation: string
  footnotes: Footnote[]
  isVerified: boolean
}

export interface Pagination {
  offset: number
  limit: number
  total: number
  hasMore: boolean
}

export const useQuranStore = defineStore('quran', () => {
  const { public: { assetsBaseUrl } } = useRuntimeConfig()
  const surahs = ref<Surah[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref<string | null>(null)

  const currentSurah = ref<Surah | null>(null)
  const currentSourceId = ref<number | undefined>(undefined)
  const verses = ref<Verse[]>([])
  const pagination = ref<Pagination>({ offset: 0, limit: 30, total: 0, hasMore: false })
  const verseWords = ref<Map<number, QuranWord[]>>(new Map())

  /** All words for the current surah — used by useQcfFont composable */
  const allWords = computed<QuranWord[]>(() => {
    const words: QuranWord[] = []
    // Guard against deserialized SSR payload where Map becomes plain object
    if (!(verseWords.value instanceof Map)) return words
    for (const w of verseWords.value.values()) {
      words.push(...w)
    }
    return words
  })

  async function fetchSurahs() {
    loading.value = true
    error.value = null
    try {
      const response = await fetch('/api/surahs')
      const result = await response.json()
      if (result.success) {
        surahs.value = result.data
      }
      else {
        error.value = 'Failed to fetch surahs'
      }
    }
    catch (e) {
      error.value = 'Network error to backend'
      console.error(e)
    }
    finally {
      loading.value = false
    }
  }

  async function fetchVerses(surahId: number, sourceId: number | undefined, offset = 0, limit?: number) {
    const isLoadingInitial = offset === 0
    if (isLoadingInitial) {
      loading.value = true
    } else {
      loadingMore.value = true
    }
    error.value = null

    try {
      const params = new URLSearchParams({
        offset: offset.toString(),
        limit: (limit ?? 30).toString(),
      })
      if (sourceId !== undefined) {
        params.set('sourceId', sourceId.toString())
      }

      const url = `/api/surahs/${surahId}?${params.toString()}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      if (result.success) {
        const data = result.data

        // Update currentSurah metadata (excluding verses)
        currentSurah.value = {
          id: data.id,
          name_simple: data.name_simple,
          name_arabic: data.name_arabic,
          name_thai: data.name_thai,
          englishName: data.name_simple,
          englishNameTranslation: data.name_thai,
          revelation_place: data.revelation_place,
          verses_count: data.verses_count,
        }

        // Track the current sourceId
        currentSourceId.value = sourceId

        // Update verses array
        if (offset === 0) {
          verses.value = data.verses
        } else {
          verses.value = [...verses.value, ...data.verses]
        }

        // Update pagination
        pagination.value = data.pagination

        // Load word data only on initial fetch
        if (offset === 0) {
          await fetchVerseWords(surahId)
        }
      }
      else {
        error.value = result.message || 'Failed to fetch verses'
      }
    }
    catch (e) {
      error.value = 'Network error or surah not found'
      console.error(e)
    }
    finally {
      if (isLoadingInitial) {
        loading.value = false
      } else {
        loadingMore.value = false
      }
    }
  }

  async function fetchNextBatch() {
    if (!pagination.value.hasMore || loadingMore.value) {
      return
    }

    if (!currentSurah.value) {
      return
    }

    const nextOffset = pagination.value.offset + pagination.value.limit

    await fetchVerses(currentSurah.value.id, currentSourceId.value, nextOffset)
  }

  /**
   * Load QCF V2 word data from static JSON files.
   * These are pre-fetched from quran.com API and stored as {chapterId}.json
   */
  async function fetchVerseWords(chapterId: number) {
    try {
      const response = await fetch(`${assetsBaseUrl}/quran-words/${chapterId}.json`)
      if (!response.ok) {
        console.warn(`Word data not available for chapter ${chapterId}`)
        return
      }
      const verses = await response.json()
      const wordMap = new Map<number, QuranWord[]>()
      for (const verse of verses) {
        wordMap.set(verse.verse_number, verse.words)
      }
      verseWords.value = wordMap
    }
    catch (e) {
      console.warn('Failed to load word data:', e)
    }
  }

  /** Get words for a specific verse number */
  function getWordsForVerse(verseNumber: number): QuranWord[] {
    return verseWords.value.get(verseNumber) || []
  }

  return {
    surahs,
    currentSurah,
    currentSourceId,
    verses,
    pagination,
    loading,
    loadingMore,
    error,
    allWords,
    verseWords,
    fetchSurahs,
    fetchVerses,
    fetchVerseWords,
    fetchNextBatch,
    getWordsForVerse,
  }
})
