import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { QuranWord } from '~/types/quran'

export interface Surah {
  id: number
  name: string
  englishName: string
  englishNameTranslation: string
  revelationType: string
  numberOfAyahs: number
}

export interface Footnote {
  number: number
  text: string
}

export const useQuranStore = defineStore('quran', () => {
  const { public: { assetsBaseUrl } } = useRuntimeConfig()
  const surahs = ref<Surah[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const currentSurah = ref<Surah | null>(null)
  const verseWords = ref<Map<number, QuranWord[]>>(new Map())

  /** All words for the current surah — used by useQcfFont composable */
  const allWords = computed<QuranWord[]>(() => {
    const words: QuranWord[] = []
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

  async function fetchSurah(id: number, sourceId?: number) {
    loading.value = true
    error.value = null
    currentSurah.value = null
    verseWords.value = new Map()
    try {
      const url = sourceId ? `/api/surahs/${id}?sourceId=${sourceId}` : `/api/surahs/${id}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      if (result.success) {
        currentSurah.value = result.data
        await fetchVerseWords(id)
      }
      else {
        error.value = result.message || 'Failed to fetch surah'
      }
    }
    catch (e) {
      error.value = 'Network error or surah not found'
      console.error(e)
    }
    finally {
      loading.value = false
    }
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
    loading,
    error,
    allWords,
    verseWords,
    fetchSurahs,
    fetchSurah,
    getWordsForVerse,
  }
})
