import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { QuranWord, QuranWordFile, QuranVerseEntry } from '~/types/quran'

/**
 * Page index: maps page number → chapter IDs on that page.
 * Loaded once on first use.
 */
let pageIndex: Record<number, number[]> | null = null

async function loadPageIndex(baseUrl: string): Promise<Record<number, number[]>> {
  if (pageIndex) return pageIndex
  const res = await fetch(`${baseUrl}/quran-pages/page-index.json`)
  pageIndex = await res.json()
  return pageIndex!
}

/**
 * Surah-page mapping: maps surah ID → array of {page, verseFrom, verseTo}.
 * Loaded once on first use.
 */
let surahPageMapping: Record<string, Array<{ page: number, verseFrom: number, verseTo: number }>> | null = null

async function loadSurahPageMapping(baseUrl: string): Promise<Record<string, Array<{ page: number, verseFrom: number, verseTo: number }>>> {
  if (surahPageMapping) return surahPageMapping
  const res = await fetch(`${baseUrl}/quran-pages/surah-page-mapping.json`)
  surahPageMapping = await res.json()
  return surahPageMapping!
}

/**
 * Chapter word cache: avoids re-fetching the same chapter JSON.
 */
const chapterCache = new Map<number, QuranVerseEntry[]>()

async function loadChapterWords(chapterId: number, baseUrl: string): Promise<QuranVerseEntry[]> {
  if (chapterCache.has(chapterId)) return chapterCache.get(chapterId)!
  const res = await fetch(`${baseUrl}/quran-words/${chapterId}.json`)
  const data: QuranWordFile = await res.json()
  chapterCache.set(chapterId, data)
  return data
}

/** Info about a surah that starts on a specific page. */
export interface SurahStartInfo {
  surahId: number
  firstVerseLine: number
  hasBismillah: boolean
}

export const useMushafStore = defineStore('mushaf', () => {
  const { public: { assetsBaseUrl } } = useRuntimeConfig()
  const currentPage = ref(1)
  const totalPages = 604
  const loading = ref(false)

  // Cache of words grouped by page number
  const pageWordsCache = ref<Map<number, QuranWord[]>>(new Map())

  // Cached bismillah words (from 1:1 positions 1-4, loaded once)
  const bismillahWords = ref<QuranWord[] | null>(null)

  /**
   * Fetch words for a specific Mushaf page.
   * Loads chapter data via page-index and filters words for this page.
   */
  async function fetchPageWords(pageNumber: number): Promise<QuranWord[]> {
    if (pageWordsCache.value.has(pageNumber)) {
      return pageWordsCache.value.get(pageNumber)!
    }

    const index = await loadPageIndex(assetsBaseUrl)
    const chapters = index[pageNumber]
    if (!chapters || chapters.length === 0) return []

    // Load all chapters that contribute to this page
    const allChapterData = await Promise.all(chapters.map(ch => loadChapterWords(ch, assetsBaseUrl)))

    // Flatten all words from all verses, filtering to this page.
    // Words are collected in reading order (verse by verse, position by position).
    type WordWithOrder = QuranWord & { _order: number }
    const words: WordWithOrder[] = []
    let order = 0
    for (const verses of allChapterData) {
      for (const verse of verses) {
        for (const word of verse.words || []) {
          if (word.page_number === pageNumber) {
            words.push({
              ...word,
              verse_key: verse.verse_key,
              verse_number: verse.verse_number,
              _order: order++, // preserve reading order across verses
            })
          }
        }
      }
    }

    // Sort by line_number, then by reading order (NOT by position,
    // because position is within the verse and would reorder verse
    // blocks on shared lines — e.g. verse 7 pos 1 before verse 6 pos 10).
    words.sort((a, b) => {
      if (a.line_number !== b.line_number) return a.line_number - b.line_number
      return a._order - b._order
    })

    pageWordsCache.value.set(pageNumber, words)
    return words
  }

  /**
   * Group cached page words into lines:  { 1: [...words], 2: [...words], ... }
   */
  function getPageLines(pageNumber: number): Record<number, QuranWord[]> {
    const words = pageWordsCache.value.get(pageNumber)
    if (!words) return {}

    const lines: Record<number, QuranWord[]> = {}
    for (const word of words) {
      const ln = word.line_number
      if (!lines[ln]) lines[ln] = []
      lines[ln].push(word)
    }
    return lines
  }

  /**
   * Detect which surahs start on a given page and at which line.
   * Returns an array of SurahStartInfo, ordered by first verse line.
   */
  function getSurahStartsOnPage(pageNumber: number): SurahStartInfo[] {
    const results: SurahStartInfo[] = []
    const words = pageWordsCache.value.get(pageNumber)
    if (!words || words.length === 0) return results

    // Check each word to see if it's verse_number=1 of any surah
    const seen = new Set<number>()
    for (const word of words) {
      if (word.verse_number === 1 && word.char_type_name === 'word' && word.verse_key) {
        const surahId = parseInt(word.verse_key!.split(':')[0])
        if (!seen.has(surahId)) {
          seen.add(surahId)
          results.push({
            surahId,
            firstVerseLine: word.line_number,
            hasBismillah: surahId !== 9 && surahId !== 1,
          })
        }
      }
    }

    return results
  }

  /**
   * Load bismillah words from surah 1, verse 1 (positions 1-4 only, skip end marker).
   * Cached after first load.
   */
  async function fetchBismillahWords(): Promise<QuranWord[]> {
    if (bismillahWords.value) return bismillahWords.value

    const data = await loadChapterWords(1, assetsBaseUrl)
    const firstVerse = data[0] // verse 1:1
    if (!firstVerse) return []

    // Take words 1-4 only (skip position 5 which is the end marker)
    const words = firstVerse.words
      .filter(w => w.char_type_name === 'word')
      .slice(0, 4)

    bismillahWords.value = words
    return words
  }

  /**
   * Load the current page plus its neighbors (sliding window of 3).
   */
  async function loadWindow(centerPage: number) {
    loading.value = true
    currentPage.value = centerPage

    const pages = [centerPage]
    if (centerPage > 1) pages.push(centerPage - 1)
    if (centerPage < totalPages) pages.push(centerPage + 1)

    await Promise.all(pages.map(p => fetchPageWords(p)))

    // Pre-load bismillah words if any surah starts on this page
    const surahStarts = getSurahStartsOnPage(centerPage)
    if (surahStarts.some(s => s.hasBismillah)) {
      await fetchBismillahWords()
    }

    loading.value = false
  }

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return
    loadWindow(page)
  }

  function nextPage() {
    goToPage(currentPage.value + 1)
  }

  function prevPage() {
    goToPage(currentPage.value - 1)
  }

  /**
   * All words currently in the 3-page window — used by useQcfFont to load fonts.
   */
  const windowWords = computed<QuranWord[]>(() => {
    const result: QuranWord[] = []
    const center = currentPage.value
    for (const pg of [center - 1, center, center + 1]) {
      const words = pageWordsCache.value.get(pg)
      if (words) result.push(...words)
    }
    // Include bismillah words so their QCF font (page 1) gets loaded
    if (bismillahWords.value && bismillahWords.value.length > 0) {
      result.push(...bismillahWords.value)
    }
    return result
  })

  // Expose unique verse keys (e.g. "2:282") strictly belonging to the current visible page.
  // This is used to query the backend for exact page translations, including overflow parts.
  const currentPageVerseKeys = computed<string[]>(() => {
    const words = pageWordsCache.value.get(currentPage.value)
    if (!words) return []

    // We use a Set to keep unique keys, and they are inherently ordered by their first appearance
    // in the already-sorted `words` array.
    const keys = new Set<string>()
    for (const w of words) {
      if (w.verse_key) keys.add(w.verse_key)
    }
    return Array.from(keys)
  })

  return {
    currentPage,
    totalPages,
    loading,
    pageWordsCache,
    bismillahWords,
    fetchPageWords,
    getPageLines,
    getSurahStartsOnPage,
    fetchBismillahWords,
    loadWindow,
    goToPage,
    nextPage,
    prevPage,
    windowWords,
    currentPageVerseKeys,
  }
})
