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

export const useMushafStore = defineStore('mushaf', () => {
  const { public: { assetsBaseUrl } } = useRuntimeConfig()
  const currentPage = ref(1)
  const totalPages = 604
  const loading = ref(false)

  // Cache of words grouped by page number
  const pageWordsCache = ref<Map<number, QuranWord[]>>(new Map())

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
   * Load the current page plus its neighbors (sliding window of 3).
   */
  async function loadWindow(centerPage: number) {
    loading.value = true
    currentPage.value = centerPage

    const pages = [centerPage]
    if (centerPage > 1) pages.push(centerPage - 1)
    if (centerPage < totalPages) pages.push(centerPage + 1)

    await Promise.all(pages.map(p => fetchPageWords(p)))
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
    return result
  })

  return {
    currentPage,
    totalPages,
    loading,
    pageWordsCache,
    fetchPageWords,
    getPageLines,
    loadWindow,
    goToPage,
    nextPage,
    prevPage,
    windowWords,
  }
})
