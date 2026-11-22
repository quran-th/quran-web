import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { QuranWord, QuranWordFile, QuranVerseEntry } from '~/types/quran'

/**
 * Page index: maps page number → chapter IDs on that page.
 * Loaded once on first use.
 */
let pageIndex: Promise<Record<number, number[]>> | null = null

function loadPageIndex(baseUrl: string): Promise<Record<number, number[]>> {
  if (!pageIndex) {
    pageIndex = fetch(`${baseUrl}/quran-pages/page-index.json`).then(res => res.json())
    pageIndex.catch(() => {
      pageIndex = null
    })
  }
  return pageIndex
}


/**
 * Chapter word cache, holding the request itself so pages of one chapter loading
 * together share a single download.
 */
const chapterCache = new Map<number, Promise<QuranVerseEntry[]>>()

function loadChapterWords(chapterId: number, baseUrl: string): Promise<QuranVerseEntry[]> {
  let words = chapterCache.get(chapterId)
  if (!words) {
    words = fetch(`${baseUrl}/quran-words/${chapterId}.json`).then(res => res.json() as Promise<QuranWordFile>)
    words.catch(() => chapterCache.delete(chapterId))
    chapterCache.set(chapterId, words)
  }
  return words
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

  // Spread mode shows an odd (right) + even (left) page pair; set by the page
  const spreadMode = ref(false)

  const spreadPages = computed<[number, number]>(() => {
    const odd = currentPage.value % 2 === 1 ? currentPage.value : currentPage.value - 1
    return [odd, Math.min(odd + 1, totalPages)]
  })

  const hasPrevPage = computed(() => (spreadMode.value ? spreadPages.value[0] > 1 : currentPage.value > 1))
  const hasNextPage = computed(() => (spreadMode.value ? spreadPages.value[1] < totalPages : currentPage.value < totalPages))

  function visiblePages(): number[] {
    return spreadMode.value ? spreadPages.value : [currentPage.value]
  }

  function windowPages(): number[] {
    const [first, last] = spreadMode.value
      ? spreadPages.value
      : [currentPage.value, currentPage.value]
    const span = spreadMode.value ? 2 : 1
    const pages: number[] = []
    for (let p = first - span; p <= last + span; p++) {
      if (p >= 1 && p <= totalPages) pages.push(p)
    }
    return pages
  }

  /**
   * Load the visible page(s) plus neighbors: a sliding window of 3 pages, or
   * the current spread plus the previous and next spread (6 pages) in spread mode.
   */
  async function loadWindow(centerPage: number) {
    loading.value = true
    currentPage.value = spreadMode.value && centerPage % 2 === 0 ? centerPage - 1 : centerPage

    const visible = visiblePages()
    // Neighbouring pages only warm up the following turn. A page turn waits on this
    // promise (a view transition holds the old page frozen until it settles), so they never block it
    const neighbours = windowPages().filter(p => !visible.includes(p))
    Promise.all(neighbours.map(p => fetchPageWords(p))).catch(() => {})

    await Promise.all(visible.map(p => fetchPageWords(p)))

    // Pre-load bismillah words if any surah starts on a visible page
    if (visible.some(p => getSurahStartsOnPage(p).some(s => s.hasBismillah))) {
      await fetchBismillahWords()
    }

    loading.value = false
  }

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return
    return loadWindow(page)
  }

  function nextPage() {
    return goToPage(currentPage.value + (spreadMode.value ? 2 : 1))
  }

  function prevPage() {
    return goToPage(currentPage.value - (spreadMode.value ? 2 : 1))
  }

  /**
   * All words currently in the loaded window — used by useQcfFont to load fonts.
   */
  const windowWords = computed<QuranWord[]>(() => {
    const result: QuranWord[] = []
    for (const pg of windowPages()) {
      const words = pageWordsCache.value.get(pg)
      if (words) result.push(...words)
    }
    // Include bismillah words so their QCF font (page 1) gets loaded
    if (bismillahWords.value && bismillahWords.value.length > 0) {
      result.push(...bismillahWords.value)
    }
    return result
  })

  /** Unique verse keys (e.g. "2:282") of a page, in reading order. */
  function getPageVerseKeys(pageNumber: number): string[] {
    const words = pageWordsCache.value.get(pageNumber)
    if (!words) return []
    const keys = new Set<string>()
    for (const w of words) {
      if (w.verse_key) keys.add(w.verse_key)
    }
    return Array.from(keys)
  }

  const currentPageVerseKeys = computed<string[]>(() => getPageVerseKeys(currentPage.value))

  /** The Mushaf page an ayah is on; no ayah in this Mushaf runs across a page turn */
  async function getVersePage(verseKey: string): Promise<number | null> {
    const surah = Number(verseKey.split(':')[0])
    if (!surah) return null
    const verses = await loadChapterWords(surah, assetsBaseUrl)
    return verses.find(v => v.verse_key === verseKey)?.words[0]?.page_number ?? null
  }

  /** The first Mushaf page a surah appears on, from the page index */
  async function getSurahStartPage(surahId: number): Promise<number> {
    const index = await loadPageIndex(assetsBaseUrl)
    let first = totalPages
    for (const [page, chapters] of Object.entries(index)) {
      if (chapters.includes(surahId)) first = Math.min(first, Number(page))
    }
    return first
  }

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
    spreadMode,
    spreadPages,
    hasPrevPage,
    hasNextPage,
    getPageVerseKeys,
    getSurahStartPage,
    getVersePage,
  }
})
