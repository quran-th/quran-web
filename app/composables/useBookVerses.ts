import { ref, type Ref } from 'vue'
import type { QuranVerseEntry } from '~/types/quran'

export interface BookThaiSegment {
  type: 'text' | 'footnote-ref'
  content: string
  footnoteNumber?: number
}

export interface BookVerse {
  key: string
  surahNumber: number
  verseNumber: number
  arabic: string
  pageNumber: number
  thaiSegments: BookThaiSegment[]
  footnotes: { number: number; text: string }[]
}

interface ByKeysVerse {
  surahNumber: number
  verseNumber: number
  translation: string | null
  footnotes: { number: number; text: string }[]
}

interface ByKeysResponse {
  success: boolean
  data: { verses: ByKeysVerse[]; sourceId: number }
}

const CHUNK_SIZE = 25
const arabicDigits = '٠١٢٣٤٥٦٧٨٩'

interface ArabicVerse {
  arabic: string
  pageNumber: number
}

const arabicByVerseCache = new Map<number, Promise<Map<number, ArabicVerse>>>()

function toArabicIndic(n: number): string {
  return String(n).replace(/\d/g, d => arabicDigits[Number(d)]!)
}

// UthmanicHafs draws bare Arabic-Indic digits as the ornamented ayah number;
// a leading U+06DD would add a second, empty ornament.
function buildArabic(entry: QuranVerseEntry): string {
  const text = entry.words
    .filter(w => w.char_type_name === 'word')
    .map(w => w.text_qpc_hafs || w.text_uthmani)
    .join(' ')
  return `${text} ${toArabicIndic(entry.verse_number)}`
}

function loadArabic(surahNumber: number, baseUrl: string): Promise<Map<number, ArabicVerse>> {
  let promise = arabicByVerseCache.get(surahNumber)
  if (!promise) {
    promise = fetch(`${baseUrl}/quran-words/${surahNumber}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`quran-words ${surahNumber}: ${res.status}`)
        return res.json() as Promise<QuranVerseEntry[]>
      })
      .then(entries => new Map(entries.map(e => [e.verse_number, { arabic: buildArabic(e), pageNumber: e.page_number }])))
    arabicByVerseCache.set(surahNumber, promise)
    promise.catch(() => arabicByVerseCache.delete(surahNumber))
  }
  return promise
}

function toSegments(text: string): BookThaiSegment[] {
  const segments: BookThaiSegment[] = []
  const re = /\(\*(\d+)\*\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'footnote-ref', content: match[0], footnoteNumber: Number(match[1]) })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) segments.push({ type: 'text', content: text.slice(lastIndex) })
  return segments
}

export function useBookVerses(surahNumber: Ref<number>, sourceId: Ref<number | undefined>) {
  const { public: { assetsBaseUrl } } = useRuntimeConfig()

  const verses = ref<BookVerse[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  let generation = 0
  let inFlight = new Map<number, Promise<void>>()
  let loadedChunks = new Set<number>()
  let pending = 0

  function reset() {
    generation++
    inFlight = new Map()
    loadedChunks = new Set()
    pending = 0
    verses.value = []
    loading.value = false
    error.value = null
  }

  async function fetchChunk(chunk: number, gen: number, surah: number, source: number | undefined) {
    const arabicPromise = loadArabic(surah, assetsBaseUrl)
    const arabicMap = await arabicPromise
    const from = chunk * CHUNK_SIZE + 1
    const to = Math.min(from + CHUNK_SIZE - 1, arabicMap.size)
    const keys: string[] = []
    for (let v = from; v <= to; v++) keys.push(`${surah}:${v}`)
    if (keys.length === 0) return

    const response = await fetch('/api/verses/by-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys, sourceId: source }),
    })
    const res: ByKeysResponse = await response.json()
    if (!res.success) throw new Error(`verses/by-keys failed for ${surah}:${from}-${to}`)
    if (gen !== generation) return

    const loaded: BookVerse[] = res.data.verses.map(v => ({
      key: `${v.surahNumber}:${v.verseNumber}`,
      surahNumber: v.surahNumber,
      verseNumber: v.verseNumber,
      arabic: arabicMap.get(v.verseNumber)?.arabic ?? '',
      pageNumber: arabicMap.get(v.verseNumber)?.pageNumber ?? 0,
      thaiSegments: toSegments(v.translation ?? ''),
      footnotes: v.footnotes ?? [],
    }))
    const byNumber = new Map(verses.value.map(v => [v.verseNumber, v]))
    for (const v of loaded) byNumber.set(v.verseNumber, v)
    verses.value = [...byNumber.values()].sort((a, b) => a.verseNumber - b.verseNumber)
    loadedChunks.add(chunk)
  }

  async function ensureLoaded(fromVerse: number, toVerse: number): Promise<void> {
    const gen = generation
    const surah = surahNumber.value
    const source = sourceId.value
    const first = Math.floor((Math.max(fromVerse, 1) - 1) / CHUNK_SIZE)
    const last = Math.floor((Math.max(toVerse, 1) - 1) / CHUNK_SIZE)

    const waits: Promise<void>[] = []
    for (let chunk = first; chunk <= last; chunk++) {
      if (loadedChunks.has(chunk)) continue
      let request = inFlight.get(chunk)
      if (!request) {
        pending++
        loading.value = true
        const map = inFlight
        request = fetchChunk(chunk, gen, surah, source)
          .catch((e) => {
            if (gen === generation) error.value = e instanceof Error ? e.message : String(e)
            throw e
          })
          .finally(() => {
            map.delete(chunk)
            if (gen === generation && --pending === 0) loading.value = false
          })
        map.set(chunk, request)
      }
      waits.push(request)
    }
    await Promise.all(waits)
  }

  return { verses, loading, error, ensureLoaded, reset }
}
